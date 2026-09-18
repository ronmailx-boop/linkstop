// Supabase Edge Function: מקבלת URL, שולפת את ה-HTML שלו (עוקף CORS מהצד לקוח) ומחזירה og:tags כ-JSON.
// פריסה: supabase functions deploy fetch-metadata

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 1_000_000;
const RETRY_DELAY_MS = 500;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// חוסם ניסיונות SSRF לרשתות פנימיות/לוקאליות - הפונקציה הזו נגישה לכל אחד עם ה-anon key.
function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".local")) return true;
  if (/^127\./.test(lower) || lower === "0.0.0.0" || lower === "::1") return true;
  if (/^10\./.test(lower)) return true;
  if (/^192\.168\./.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true;
  if (/^169\.254\./.test(lower)) return true;
  return false;
}

function extractMetaContent(html: string, property: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeHtmlEntities(match[1]);
  }
  return "";
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractTitleTag(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : "";
}

// חלק מהאתרים (בעיקר חנויות SPA) לא שמים og:tags, אבל כן משאירים נתוני מוצר מובנים (Schema.org)
// בתוך <script type="application/ld+json"> בשרת - לצורך אינדוקס בגוגל - גם כשהתוכן עצמו נטען ב-JS.
function extractProductFromJsonLd(html: string): { title: string; image: string; description: string } {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];

  for (const block of blocks) {
    const jsonText = block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      continue;
    }

    for (const candidate of Array.isArray(parsed) ? parsed : [parsed]) {
      const items = candidate && typeof candidate === "object" && Array.isArray((candidate as Record<string, unknown>)["@graph"])
        ? ((candidate as Record<string, unknown>)["@graph"] as unknown[])
        : [candidate];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const type = record["@type"];
        const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
        if (!isProduct) continue;

        const image = record.image;
        const imageUrl = typeof image === "string"
          ? image
          : Array.isArray(image) && typeof image[0] === "string"
          ? image[0]
          : image && typeof (image as Record<string, unknown>).url === "string"
          ? ((image as Record<string, unknown>).url as string)
          : "";

        return {
          title: typeof record.name === "string" ? record.name : "",
          image: imageUrl,
          description: typeof record.description === "string" ? record.description : "",
        };
      }
    }
  }

  return { title: "", image: "", description: "" };
}

interface Metadata {
  title: string;
  description: string;
  image: string;
  siteName: string;
}

const YOUTUBE_HOSTS = ["youtube.com", "youtu.be", "m.youtube.com", "youtube-nocookie.com"];

function isYouTubeHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^www\./, "");
  return YOUTUBE_HOSTS.some((host) => lower === host || lower.endsWith(`.${host}`));
}

// יוטיוב חוסם/מסנן לעיתים og:tags לפי User-Agent (עמוד הסכמת עוגיות גנרי, בעיקר מ-IP אירופאי -
// הפונקציה רצה ב-eu-central-1) - ה-oEmbed הרשמי שלהם הוא ערוץ יציב ורשמי לכותרת + תמונת פריוויו.
async function fetchYouTubeOEmbed(targetUrl: string): Promise<Metadata | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`;
    const response = await fetch(oembedUrl, { signal: controller.signal });
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.title) return null;

    return {
      title: data.title,
      description: "",
      image: data.thumbnail_url || "",
      siteName: "YouTube",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// מזדהה כברירת מחדל כ-facebookexternalhit - הבוט הרשמי של פייסבוק ליצירת תצוגות מקדימות (זו הסיבה
// שתצוגה מקדימה עובדת בוואטסאפ/מסנג'ר). בלי זה, פייסבוק עלול להחזיר דף "התחבר כדי לצפות".
const FACEBOOK_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

// חלק מהאתרים (בעיקר חנויות עם הגנת אנטי-בוט) חוסמים ספציפית User-Agent של בוט מוכר - עבורם
// ננסה בניסיון השני להזדהות כדפדפן רגיל במקום.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchAndExtract(targetUrl: string, hostname: string, userAgent: string): Promise<Metadata> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const pageResponse = await fetch(targetUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html",
      },
    });

    if (!pageResponse.ok) {
      throw new Error(`upstream responded with ${pageResponse.status}`);
    }

    const contentType = pageResponse.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      throw new Error("target is not an html page");
    }

    const reader = pageResponse.body?.getReader();
    let html = "";
    let receivedBytes = 0;
    const decoder = new TextDecoder();

    if (reader) {
      while (receivedBytes < MAX_HTML_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedBytes += value.length;
        html += decoder.decode(value, { stream: true });
        if (html.includes("</head>") && extractMetaContent(html, "og:title") && extractMetaContent(html, "og:image")) {
          break; // מצאנו כבר הכל ב-head - אין טעם להמשיך לקרוא גוף עמוד של מאות KB
        }
      }
      await reader.cancel().catch(() => {});
    }

    let title = extractMetaContent(html, "og:title") || extractTitleTag(html);
    let image = extractMetaContent(html, "og:image");
    let description = extractMetaContent(html, "og:description");

    if (!title || !image) {
      // אתרי SPA (כמו חנויות) לפעמים לא שמים og:tags - ננסה לשלוף מנתוני Schema.org/Product בעמוד
      const productData = extractProductFromJsonLd(html);
      title = title || productData.title;
      image = image || productData.image;
      description = description || productData.description;
    }

    return {
      title,
      description,
      image,
      siteName: extractMetaContent(html, "og:site_name") || hostname,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// אתרים כמו פייסבוק מציגים לפעמים "שער" חסום/גנרי (בלי og:image ובלי og:description) כתוצאה
// מהגנת אנטי-בוט שלהם, ובניסיון חוזר מיידי מקבלים לרוב תוכן תקין - לכן ניסיון שני קטן ל"תקלות" מהסוג הזה.
function looksLikeBlockedPage(meta: Metadata): boolean {
  return !meta.image && !meta.description;
}

// אם יש כותרת אבל שום דבר אחר - זה נראה כמו "שער" זמני של פייסבוק, ששווה לנסות שוב עם אותו זיהוי.
// אם אין אפילו כותרת - כנראה חסימת בוט ממוקדת לפי User-Agent, ששווה לנסות שוב כדפדפן רגיל.
function pickRetryUserAgent(meta: Metadata): string {
  return meta.title ? FACEBOOK_UA : BROWSER_UA;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const targetUrl = new URL(req.url).searchParams.get("url");
  if (!targetUrl) {
    return jsonResponse({ error: "missing url parameter" }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return jsonResponse({ error: "invalid url" }, 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return jsonResponse({ error: "unsupported protocol" }, 400);
  }

  if (isBlockedHost(parsed.hostname)) {
    return jsonResponse({ error: "host not allowed" }, 400);
  }

  try {
    let meta: Metadata | null = isYouTubeHost(parsed.hostname) ? await fetchYouTubeOEmbed(parsed.toString()) : null;

    if (!meta) {
      meta = await fetchAndExtract(parsed.toString(), parsed.hostname, FACEBOOK_UA);

      if (looksLikeBlockedPage(meta)) {
        const retryUserAgent = pickRetryUserAgent(meta);
        if (retryUserAgent === FACEBOOK_UA) await delay(RETRY_DELAY_MS);
        try {
          const retryMeta = await fetchAndExtract(parsed.toString(), parsed.hostname, retryUserAgent);
          if (!looksLikeBlockedPage(retryMeta)) meta = retryMeta;
        } catch {
          // הניסיון הראשון כן הצליח חלקית - נשארים איתו במקום לזרוק שגיאה
        }
      }
    }

    return jsonResponse(meta);
  } catch {
    return jsonResponse({ error: "fetch timed out or failed" }, 504);
  }
});
