import { SUPABASE_FUNCTION_URL, SUPABASE_ANON_KEY } from "./config.js";

const FETCH_TIMEOUT_MS = 8000;

// שולף og:title / og:image / og:description מה-Edge Function של Supabase.
// בכשל (רשת/שרת/timeout) מחזיר null במקום לזרוק - הקורא אחראי להציג הודעה בעברית וליפול חזרה לנתונים מינימליים.
export async function fetchMetadata(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const endpoint = `${SUPABASE_FUNCTION_URL}?url=${encodeURIComponent(url)}`;
    const response = await fetch(endpoint, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      title: data.title || "",
      description: data.description || "",
      image: data.image || "",
      siteName: data.siteName || "",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
