// Supabase Edge Function: מקבלת URL, שולפת את ה-HTML שלו (עוקף CORS מהצד לקוח) ומחזירה og:tags כ-JSON.
// פריסה: supabase functions deploy fetch-metadata

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 1_000_000;

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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const pageResponse = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LinkStopBot/1.0; +https://github.com/)",
        Accept: "text/html",
      },
    });

    if (!pageResponse.ok) {
      return jsonResponse({ error: "failed to fetch target url" }, 502);
    }

    const contentType = pageResponse.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return jsonResponse({ error: "target is not an html page" }, 415);
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
      }
      await reader.cancel().catch(() => {});
    }

    const title = extractMetaContent(html, "og:title") || extractTitleTag(html);
    const description = extractMetaContent(html, "og:description");
    const image = extractMetaContent(html, "og:image");
    const siteName = extractMetaContent(html, "og:site_name") || parsed.hostname;

    return jsonResponse({ title, description, image, siteName });
  } catch {
    return jsonResponse({ error: "fetch timed out or failed" }, 504);
  } finally {
    clearTimeout(timeoutId);
  }
});
