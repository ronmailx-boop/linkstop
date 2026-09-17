import { getLinks, deleteLink } from "./storage.js";
import { saveSharedLink, isValidHttpUrl } from "./share-handler.js";

const SOURCE_LABELS = {
  whatsapp: "וואטסאפ",
  facebook: "פייסבוק",
  other: "אתר",
};

const listEl = document.getElementById("links-list");
const emptyStateEl = document.getElementById("empty-state");
const formEl = document.getElementById("add-link-form");
const inputEl = document.getElementById("url-input");
const addButtonEl = document.getElementById("add-button");
const statusEl = document.getElementById("form-status");

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function buildCard(link) {
  const card = document.createElement("li");
  card.className = "link-card";

  const openLink = document.createElement("a");
  openLink.className = "link-card__open";
  openLink.href = link.url;
  openLink.target = "_blank";
  openLink.rel = "noopener noreferrer";

  if (link.image && isValidHttpUrl(link.image)) {
    const img = document.createElement("img");
    img.className = "link-card__thumb";
    img.src = link.image;
    img.alt = "";
    img.loading = "lazy";
    openLink.appendChild(img);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "link-card__thumb link-card__thumb--placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    openLink.appendChild(placeholder);
  }

  const info = document.createElement("div");
  info.className = "link-card__info";

  const title = document.createElement("p");
  title.className = "link-card__title";
  title.textContent = link.title;

  const meta = document.createElement("p");
  meta.className = "link-card__meta";
  const sourceLabel = SOURCE_LABELS[link.source] || SOURCE_LABELS.other;
  meta.textContent = `${sourceLabel} · ${hostnameOf(link.url)}`;

  info.append(title, meta);
  openLink.appendChild(info);

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "link-card__delete";
  deleteButton.setAttribute("aria-label", `מחק את הקישור ${link.title}`);
  deleteButton.textContent = "🗑";
  deleteButton.addEventListener("click", () => {
    if (confirm("למחוק את הקישור הזה?")) {
      deleteLink(link.id);
      render();
    }
  });

  card.append(openLink, deleteButton);
  return card;
}

function render() {
  const links = getLinks();
  listEl.innerHTML = "";

  emptyStateEl.hidden = links.length > 0;

  for (const link of links) {
    listEl.appendChild(buildCard(link));
  }
}

function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.classList.toggle("form-status--error", Boolean(isError));
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  const url = inputEl.value.trim();

  if (!isValidHttpUrl(url)) {
    setStatus("כתובת הקישור לא תקינה", true);
    return;
  }

  addButtonEl.disabled = true;
  setStatus("שומר קישור...", false);

  try {
    await saveSharedLink(url);
    inputEl.value = "";
    setStatus("", false);
    render();
  } catch {
    setStatus("שגיאה בשמירת הקישור, נסה שוב", true);
  } finally {
    addButtonEl.disabled = false;
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/linkstop/sw.js").catch(() => {
    // התקנת PWA לא קריטית לפעולת האפליקציה - כשל בהרשמה לא צריך לחסום שימוש
  });
}

render();
