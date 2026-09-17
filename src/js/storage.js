const STORAGE_KEY = "linkstop_links";

export function getLinks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const links = raw ? JSON.parse(raw) : [];
    return Array.isArray(links) ? links : [];
  } catch {
    return [];
  }
}

function saveLinks(links) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

export function addLink(link) {
  const links = getLinks();
  const entry = {
    id: crypto.randomUUID(),
    url: link.url,
    title: link.title || link.url,
    image: link.image || "",
    description: link.description || "",
    source: link.source || "other",
    createdAt: new Date().toISOString(),
  };
  links.unshift(entry);
  saveLinks(links);
  return entry;
}

export function deleteLink(id) {
  const links = getLinks().filter((link) => link.id !== id);
  saveLinks(links);
}
