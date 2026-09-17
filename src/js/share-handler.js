import { fetchMetadata } from "./metadata.js";
import { addLink } from "./storage.js";

const URL_REGEX = /https?:\/\/[^\s]+/i;

const SOURCE_DOMAINS = [
  { source: "whatsapp", hosts: ["wa.me", "whatsapp.com"] },
  { source: "facebook", hosts: ["facebook.com", "fb.watch"] },
];

// Chrome ממלא לרוב את שדה url בעצמו, אבל אפליקציות כמו וואטסאפ/פייסבוק
// לפעמים משתפות רק EXTRA_TEXT - הקישור אז "טמון" בתוך טקסט ההודעה.
export function extractSharedUrl(params) {
  const directUrl = params.get("url");
  if (directUrl) return directUrl.trim();

  const text = params.get("text") || "";
  const match = text.match(URL_REGEX);
  return match ? match[0].trim() : null;
}

export function detectSource(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const found = SOURCE_DOMAINS.find((entry) => entry.hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`)));
    return found ? found.source : "other";
  } catch {
    return "other";
  }
}

export function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// שולף מטא-דאטה (עם נפילה חינה למינימום אם השרת לא זמין) ושומר את הקישור.
export async function saveSharedLink(url) {
  const source = detectSource(url);
  const meta = await fetchMetadata(url);

  return addLink({
    url,
    title: meta?.title || url,
    image: meta?.image || "",
    description: meta?.description || "",
    source,
  });
}
