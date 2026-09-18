import { getLinks, deleteLink, updateLink } from "./storage.js";
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
const searchBarEl = document.getElementById("search-bar");
const searchInputEl = document.getElementById("search-input");

const EMPTY_MESSAGE_DEFAULT = emptyStateEl.textContent.trim();
const EMPTY_MESSAGE_NO_RESULTS = "לא נמצאו קישורים התואמים לחיפוש";

const confirmOverlayEl = document.getElementById("confirm-overlay");
const confirmMessageEl = document.getElementById("confirm-dialog-message");
const confirmCancelEl = document.getElementById("confirm-dialog-cancel");
const confirmConfirmEl = document.getElementById("confirm-dialog-confirm");

// תצוגת אישור מותאמת במקום confirm() הגנרי של הדפדפן - שומרת על מי שהיה בפוקוס
// לפני הפתיחה ומחזירה אליו בסגירה, ותומכת בביטול דרך Escape/לחיצה על הרקע.
function confirmDialog(message) {
  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement;
    confirmMessageEl.textContent = message;
    confirmOverlayEl.hidden = false;
    confirmCancelEl.focus();

    function close(result) {
      confirmOverlayEl.hidden = true;
      confirmConfirmEl.removeEventListener("click", onConfirm);
      confirmCancelEl.removeEventListener("click", onCancel);
      confirmOverlayEl.removeEventListener("click", onOverlayClick);
      confirmOverlayEl.removeEventListener("keydown", onKeydown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
      resolve(result);
    }

    function onConfirm() {
      close(true);
    }

    function onCancel() {
      close(false);
    }

    function onOverlayClick(event) {
      if (event.target === confirmOverlayEl) close(false);
    }

    function onKeydown(event) {
      if (event.key === "Escape") close(false);
    }

    confirmConfirmEl.addEventListener("click", onConfirm);
    confirmCancelEl.addEventListener("click", onCancel);
    confirmOverlayEl.addEventListener("click", onOverlayClick);
    confirmOverlayEl.addEventListener("keydown", onKeydown);
  });
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// כשאין כותרת/תמונה אמיתיות (חילוץ אוטומטי נכשל, למשל בגלל הגנת אנטי-בוט של האתר),
// אפשר לערוך את הכותרת ידנית - נשמר בלינק הנוכחי הזה בלבד עד שהמשתמש ילחץ על עריכה.
let editingId = null;

let searchTerm = "";

function filterLinks(links, term) {
  const query = term.trim().toLowerCase();
  if (!query) return links;
  return links.filter((link) => `${link.title} ${hostnameOf(link.url)}`.toLowerCase().includes(query));
}

function buildThumbnail(link) {
  if (link.image && isValidHttpUrl(link.image)) {
    const img = document.createElement("img");
    img.className = "link-card__thumb";
    img.src = link.image;
    img.alt = "";
    img.loading = "lazy";
    return img;
  }

  const placeholder = document.createElement("div");
  placeholder.className = "link-card__thumb link-card__thumb--placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  return placeholder;
}

function buildCard(link) {
  const card = document.createElement("li");
  card.className = "link-card";

  const isEditing = editingId === link.id;

  const wrapper = document.createElement(isEditing ? "div" : "a");
  wrapper.className = "link-card__open";
  if (!isEditing) {
    wrapper.href = link.url;
    wrapper.target = "_blank";
    wrapper.rel = "noopener noreferrer";
  }
  wrapper.appendChild(buildThumbnail(link));

  const info = document.createElement("div");
  info.className = "link-card__info";

  const meta = document.createElement("p");
  meta.className = "link-card__meta";
  const sourceLabel = SOURCE_LABELS[link.source] || SOURCE_LABELS.other;
  meta.textContent = `${sourceLabel} · ${hostnameOf(link.url)}`;

  if (isEditing) {
    const form = document.createElement("form");
    form.className = "link-card__edit-form";

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "link-card__title-input";
    titleInput.value = link.title;
    titleInput.setAttribute("aria-label", "כותרת הקישור");

    const saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.className = "link-card__icon-button";
    saveButton.setAttribute("aria-label", "שמור כותרת");
    saveButton.textContent = "✓";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "link-card__icon-button";
    cancelButton.setAttribute("aria-label", "בטל עריכה");
    cancelButton.textContent = "✕";
    cancelButton.addEventListener("click", () => {
      editingId = null;
      render();
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const newTitle = titleInput.value.trim();
      if (newTitle) updateLink(link.id, { title: newTitle });
      editingId = null;
      render();
    });

    form.append(titleInput, saveButton, cancelButton);
    info.append(form, meta);
  } else {
    const title = document.createElement("p");
    title.className = "link-card__title";
    title.textContent = link.title;
    info.append(title, meta);
  }

  wrapper.appendChild(info);
  card.appendChild(wrapper);

  if (!isEditing) {
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "link-card__icon-button";
    editButton.setAttribute("aria-label", `ערוך כותרת ל${link.title}`);
    editButton.textContent = "✏️";
    editButton.addEventListener("click", () => {
      editingId = link.id;
      render();
    });
    card.appendChild(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "link-card__delete";
    deleteButton.setAttribute("aria-label", `מחק את הקישור ${link.title}`);
    deleteButton.textContent = "🗑";
    deleteButton.addEventListener("click", async () => {
      const confirmed = await confirmDialog(`למחוק את "${link.title}"?`);
      if (confirmed) {
        deleteLink(link.id);
        render();
      }
    });
    card.appendChild(deleteButton);
  }

  return card;
}

function render() {
  const allLinks = getLinks();
  const links = filterLinks(allLinks, searchTerm);
  listEl.innerHTML = "";

  searchBarEl.hidden = allLinks.length === 0;
  emptyStateEl.hidden = links.length > 0;
  emptyStateEl.textContent = allLinks.length === 0 ? EMPTY_MESSAGE_DEFAULT : EMPTY_MESSAGE_NO_RESULTS;

  for (const link of links) {
    listEl.appendChild(buildCard(link));
  }

  if (editingId) {
    const input = listEl.querySelector(".link-card__title-input");
    if (input) {
      input.focus();
      input.select();
    }
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

searchInputEl.addEventListener("input", () => {
  searchTerm = searchInputEl.value;
  render();
});

if ("serviceWorker" in navigator) {
  // updateViaCache: "none" מבטיח שבדיקת עדכון ל-sw.js עצמו תמיד תעקוף את מטמון ה-HTTP.
  navigator.serviceWorker
    .register("/linkstop/sw.js", { updateViaCache: "none" })
    .then((registration) => {
      registration.update();
    })
    .catch(() => {
      // התקנת PWA לא קריטית לפעולת האפליקציה - כשל בהרשמה לא צריך לחסום שימוש
    });

  // ברגע שגרסה חדשה של ה-Service Worker משתלטת, נטען מחדש פעם אחת כדי שכל הקבצים יתעדכנו מיד.
  let reloadedOnce = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadedOnce) return;
    reloadedOnce = true;
    window.location.reload();
  });
}

render();
