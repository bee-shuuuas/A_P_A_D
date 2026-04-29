const STORAGE_KEYS = {
  customPapers: "apad.customPapers",
  readingLog: "apad.readingLog"
};

const state = {
  papers: [],
  customPapers: [],
  readingLog: {}
};

document.addEventListener("DOMContentLoaded", async () => {
  await loadState();
  bindGlobalActions();
  renderPage();
});

async function loadState() {
  const basePapers = await fetchPapers();
  state.customPapers = readStorage(STORAGE_KEYS.customPapers, []);
  state.readingLog = readStorage(STORAGE_KEYS.readingLog, {});
  state.papers = mergePapers(basePapers, state.customPapers).map(applyReadingLog).sort(sortByTargetDate);
}

async function fetchPapers() {
  try {
    const response = await fetch("data/papers.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Paper data failed with ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(error);
    return [];
  }
}

function mergePapers(basePapers, customPapers) {
  const byId = new Map();
  [...basePapers, ...customPapers].forEach((paper) => {
    if (paper && paper.id) {
      byId.set(paper.id, normalizePaper(paper));
    }
  });
  return [...byId.values()];
}

function normalizePaper(paper) {
  return {
    id: String(paper.id || slugify(paper.title || "paper")),
    title: paper.title || "Untitled paper",
    authors: paper.authors || "Unknown authors",
    venue: paper.venue || "Unknown venue",
    published: paper.published || "",
    targetDate: paper.targetDate || "",
    status: paper.status || "queued",
    tags: Array.isArray(paper.tags) ? paper.tags.filter(Boolean) : splitTags(paper.tags || ""),
    link: paper.link || "",
    pdf: paper.pdf || "",
    summary: paper.summary || "",
    local: Boolean(paper.local)
  };
}

function applyReadingLog(paper) {
  const log = state.readingLog[paper.id] || {};
  return {
    ...paper,
    effectiveStatus: log.status || paper.status || "queued",
    readDate: log.readDate || "",
    notes: log.notes || ""
  };
}

function sortByTargetDate(a, b) {
  const first = a.targetDate || "9999-12-31";
  const second = b.targetDate || "9999-12-31";
  if (first !== second) {
    return first.localeCompare(second);
  }
  return a.title.localeCompare(b.title);
}

function bindGlobalActions() {
  document.body.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      return;
    }

    const action = actionButton.dataset.action;
    const id = actionButton.dataset.id;
    if (!id) {
      return;
    }

    if (action === "mark-read") {
      updatePaperLog(id, { status: "read", readDate: todayKey() });
    }

    if (action === "mark-reading") {
      updatePaperLog(id, { status: "reading" });
    }

    if (action === "save-paper") {
      updatePaperLog(id, { status: "saved" });
    }
  });
}

function renderPage() {
  const page = document.body.dataset.page;
  renderStats();

  if (page === "home") {
    renderHome();
  }

  if (page === "papers") {
    renderLibrary();
  }

  if (page === "tags") {
    renderTags();
  }

  if (page === "paper") {
    renderPaperDetail();
  }

  if (page === "add") {
    renderAddPage();
  }
}

function renderStats() {
  const total = state.papers.length;
  const read = state.papers.filter((paper) => paper.effectiveStatus === "read").length;
  const queue = state.papers.filter((paper) => paper.effectiveStatus !== "read").length;
  const streak = calculateStreak();

  setText("statTotal", total);
  setText("statRead", read);
  setText("statQueue", queue);
  setText("statStreak", streak);
}

function renderHome() {
  const todayPaper = document.getElementById("todayPaper");
  const recentPapers = document.getElementById("recentPapers");
  const historyList = document.getElementById("historyList");

  const queue = state.papers.filter((paper) => paper.effectiveStatus !== "read");
  const focus = queue.find((paper) => !paper.targetDate || paper.targetDate >= todayKey()) || queue[0] || state.papers[0];
  const upcoming = queue.filter((paper) => !focus || paper.id !== focus.id).slice(0, 4);

  todayPaper.innerHTML = focus
    ? renderPaperCard(focus, { featured: true })
    : renderEmpty("Your reading list is empty.");

  recentPapers.innerHTML = upcoming.length
    ? upcoming.map((paper) => renderPaperCard(paper)).join("")
    : renderEmpty("No queued papers right now.");

  const history = state.papers
    .filter((paper) => paper.effectiveStatus === "read")
    .sort((a, b) => (b.readDate || "").localeCompare(a.readDate || ""))
    .slice(0, 5);

  historyList.innerHTML = history.length
    ? history.map(renderHistoryItem).join("")
    : renderEmpty("No completed papers yet.");
}

function renderLibrary() {
  const tagFilter = document.getElementById("tagFilter");
  const searchInput = document.getElementById("paperSearch");
  const statusFilter = document.getElementById("statusFilter");

  const currentTag = tagFilter.value || "all";
  const tags = getTagCounts();
  tagFilter.innerHTML = `<option value="all">All tags</option>${[...tags.keys()]
    .sort()
    .map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`)
    .join("")}`;
  tagFilter.value = tags.has(currentTag) ? currentTag : "all";

  searchInput.oninput = renderLibraryList;
  tagFilter.onchange = renderLibraryList;
  statusFilter.onchange = renderLibraryList;
  renderLibraryList();
}

function renderLibraryList() {
  const searchInput = document.getElementById("paperSearch");
  const tagFilter = document.getElementById("tagFilter");
  const statusFilter = document.getElementById("statusFilter");
  const papersList = document.getElementById("papersList");
  const paperCount = document.getElementById("paperCount");

  const query = searchInput.value.trim().toLowerCase();
  const tag = tagFilter.value;
  const status = statusFilter.value;

  const filtered = state.papers.filter((paper) => {
    const haystack = [
      paper.title,
      paper.authors,
      paper.venue,
      paper.summary,
      ...paper.tags
    ].join(" ").toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const matchesTag = tag === "all" || paper.tags.includes(tag);
    const matchesStatus = status === "all" || paper.effectiveStatus === status;
    return matchesSearch && matchesTag && matchesStatus;
  });

  paperCount.textContent = `${filtered.length} paper${filtered.length === 1 ? "" : "s"}`;
  papersList.innerHTML = filtered.length
    ? filtered.map((paper) => renderPaperCard(paper)).join("")
    : renderEmpty("No papers match these filters.");
}

function renderTags() {
  const tagCloud = document.getElementById("tagCloud");
  const tagGroups = document.getElementById("tagGroups");
  const counts = getTagCounts();
  const tags = [...counts.keys()].sort();

  tagCloud.innerHTML = tags.length
    ? tags.map((tag) => `<a class="tag" href="#${encodeURIComponent(tag)}">${escapeHtml(tag)} (${counts.get(tag)})</a>`).join("")
    : renderEmpty("No tags yet.");

  tagGroups.innerHTML = tags.map((tag) => {
    const papers = state.papers.filter((paper) => paper.tags.includes(tag));
    return `
      <section class="panel tag-section" id="${escapeHtml(tag)}">
        <div class="section-header">
          <div>
            <p class="eyebrow">${papers.length} paper${papers.length === 1 ? "" : "s"}</p>
            <h2>${escapeHtml(tag)}</h2>
          </div>
        </div>
        <div class="paper-list grid-list">
          ${papers.map((paper) => renderPaperCard(paper)).join("")}
        </div>
      </section>
    `;
  }).join("");
}

function renderPaperDetail() {
  const detail = document.getElementById("paperDetail");
  const id = new URLSearchParams(window.location.search).get("id");
  const paper = state.papers.find((item) => item.id === id);

  if (!paper) {
    detail.innerHTML = renderEmpty("Paper not found.");
    return;
  }

  document.title = `${paper.title} | A_P_A_D`;
  const log = state.readingLog[paper.id] || {};

  detail.innerHTML = `
    <section class="detail-layout">
      <article class="panel detail-panel">
        <div>
          <p class="eyebrow">${escapeHtml(paper.venue)}</p>
          <h1 class="detail-title">${escapeHtml(paper.title)}</h1>
          <p class="paper-authors">${escapeHtml(paper.authors)}</p>
        </div>
        <div class="paper-meta">
          ${paper.published ? `<span class="meta-pill">Published ${formatDate(paper.published)}</span>` : ""}
          ${paper.targetDate ? `<span class="meta-pill">Target ${formatDate(paper.targetDate)}</span>` : ""}
          <span class="status-badge">${statusLabel(paper.effectiveStatus)}</span>
        </div>
        <div class="tags">${paper.tags.map(renderTag).join("")}</div>
        ${paper.summary ? `<p class="detail-summary">${escapeHtml(paper.summary)}</p>` : ""}
        <div class="card-actions">
          ${paper.link ? `<a class="button primary" href="${escapeAttribute(paper.link)}" target="_blank" rel="noopener">Open paper</a>` : ""}
          ${paper.pdf ? `<a class="button secondary" href="${escapeAttribute(paper.pdf)}" target="_blank" rel="noopener">PDF</a>` : ""}
          ${paper.effectiveStatus === "read"
            ? `<button class="button ghost" type="button" data-action="mark-reading" data-id="${escapeAttribute(paper.id)}">Reopen</button>`
            : `<button class="button ghost" type="button" data-action="mark-read" data-id="${escapeAttribute(paper.id)}">Mark read</button>`}
          <button class="button ghost" type="button" data-action="save-paper" data-id="${escapeAttribute(paper.id)}">Save</button>
        </div>
      </article>

      <aside class="panel">
        <div class="section-header">
          <div>
            <p class="eyebrow">Reading log</p>
            <h2>Notes</h2>
          </div>
        </div>
        <form id="notesForm" class="notes-form">
          <label>
            <span>Status</span>
            <select name="status">
              ${["queued", "reading", "saved", "read"].map((status) => (
                `<option value="${status}" ${paper.effectiveStatus === status ? "selected" : ""}>${statusLabel(status)}</option>`
              )).join("")}
            </select>
          </label>
          <label>
            <span>Read date</span>
            <input name="readDate" type="date" value="${escapeAttribute(log.readDate || paper.readDate || "")}">
          </label>
          <label>
            <span>Notes</span>
            <textarea name="notes" rows="10"></textarea>
          </label>
          <button class="button primary" type="submit">Save notes</button>
        </form>
      </aside>
    </section>
  `;

  const notesForm = document.getElementById("notesForm");
  notesForm.elements.notes.value = log.notes || "";
  notesForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(notesForm);
    const nextStatus = formData.get("status") || "queued";
    updatePaperLog(paper.id, {
      status: nextStatus,
      readDate: formData.get("readDate") || (nextStatus === "read" ? todayKey() : ""),
      notes: formData.get("notes") || ""
    });
  });
}

function renderAddPage() {
  const form = document.getElementById("paperForm");
  const exportButton = document.getElementById("exportData");
  const importInput = document.getElementById("importData");
  const summary = document.getElementById("addPageSummary");

  const targetDateInput = form.elements.targetDate;
  if (!targetDateInput.value) {
    targetDateInput.value = todayKey();
  }

  summary.innerHTML = `
    <strong>${state.customPapers.length}</strong> local paper${state.customPapers.length === 1 ? "" : "s"}<br>
    <strong>${Object.keys(state.readingLog).length}</strong> reading log entr${Object.keys(state.readingLog).length === 1 ? "y" : "ies"}
  `;

  form.onsubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    if (!title) {
      return;
    }

    const paper = normalizePaper({
      id: `${slugify(title)}-${Date.now().toString(36)}`,
      title,
      authors: formData.get("authors"),
      venue: formData.get("venue"),
      published: formData.get("published"),
      targetDate: formData.get("targetDate"),
      status: formData.get("status"),
      link: formData.get("link"),
      pdf: formData.get("pdf"),
      tags: splitTags(formData.get("tags")),
      summary: formData.get("summary"),
      local: true
    });

    state.customPapers.unshift(paper);
    writeStorage(STORAGE_KEYS.customPapers, state.customPapers);

    if (paper.status === "read") {
      updatePaperLog(paper.id, { status: "read", readDate: todayKey() }, false);
    }

    window.location.href = `paper.html?id=${encodeURIComponent(paper.id)}`;
  };

  exportButton.onclick = exportLocalData;
  importInput.onchange = importLocalData;
}

function renderPaperCard(paper, options = {}) {
  const status = paper.effectiveStatus || paper.status || "queued";
  const classes = ["paper-card", `status-${status}`];
  if (options.featured) {
    classes.push("featured");
  }

  return `
    <article class="${classes.join(" ")}">
      <div class="paper-topline">
        <span class="status-badge">${statusLabel(status)}</span>
        ${paper.targetDate ? `<span class="meta-pill">${formatDate(paper.targetDate)}</span>` : ""}
      </div>
      <h3 class="paper-title">
        <a href="paper.html?id=${encodeURIComponent(paper.id)}">${escapeHtml(paper.title)}</a>
      </h3>
      <p class="paper-authors">${escapeHtml(paper.authors)}</p>
      <div class="paper-meta">
        ${paper.venue ? `<span>${escapeHtml(paper.venue)}</span>` : ""}
        ${paper.local ? `<span class="meta-pill">Local</span>` : ""}
      </div>
      ${paper.summary ? `<p class="paper-summary">${escapeHtml(paper.summary)}</p>` : ""}
      <div class="tags">${paper.tags.map(renderTag).join("")}</div>
      <div class="card-actions">
        <a class="button secondary" href="paper.html?id=${encodeURIComponent(paper.id)}">Details</a>
        ${paper.link ? `<a class="button ghost" href="${escapeAttribute(paper.link)}" target="_blank" rel="noopener">Paper</a>` : ""}
        ${status === "read"
          ? `<button class="button ghost" type="button" data-action="mark-reading" data-id="${escapeAttribute(paper.id)}">Reopen</button>`
          : `<button class="button primary" type="button" data-action="mark-read" data-id="${escapeAttribute(paper.id)}">Mark read</button>`}
      </div>
    </article>
  `;
}

function renderHistoryItem(paper) {
  return `
    <a class="history-item" href="paper.html?id=${encodeURIComponent(paper.id)}">
      <strong>${escapeHtml(paper.title)}</strong>
      <span>${paper.readDate ? formatDate(paper.readDate) : "Read"}</span>
    </a>
  `;
}

function renderTag(tag) {
  return `<a class="tag" href="tags.html#${encodeURIComponent(tag)}">${escapeHtml(tag)}</a>`;
}

function renderEmpty(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function getTagCounts() {
  return state.papers.reduce((counts, paper) => {
    paper.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    return counts;
  }, new Map());
}

function updatePaperLog(id, patch, shouldRender = true) {
  const previous = state.readingLog[id] || {};
  state.readingLog[id] = { ...previous, ...patch };

  if (state.readingLog[id].status === "read" && !state.readingLog[id].readDate) {
    state.readingLog[id].readDate = todayKey();
  }

  writeStorage(STORAGE_KEYS.readingLog, state.readingLog);
  state.papers = state.papers.map(applyReadingLog);

  if (shouldRender) {
    renderPage();
  }
}

function calculateStreak() {
  const readDates = new Set(
    Object.values(state.readingLog)
      .filter((log) => log.status === "read" && log.readDate)
      .map((log) => log.readDate)
  );
  let streak = 0;
  const cursor = new Date(`${todayKey()}T00:00:00`);

  while (readDates.has(dateToKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function exportLocalData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    customPapers: state.customPapers,
    readingLog: state.readingLog
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `apad-export-${todayKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importLocalData(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(reader.result);
      const importedPapers = Array.isArray(payload.customPapers) ? payload.customPapers.map(normalizePaper) : [];
      const importedLog = payload.readingLog && typeof payload.readingLog === "object" ? payload.readingLog : {};
      const mergedPapers = mergePapers(state.customPapers, importedPapers);

      state.customPapers = mergedPapers;
      state.readingLog = { ...state.readingLog, ...importedLog };
      writeStorage(STORAGE_KEYS.customPapers, state.customPapers);
      writeStorage(STORAGE_KEYS.readingLog, state.readingLog);
      loadState().then(renderPage);
    } catch (error) {
      console.warn(error);
    }
  };
  reader.readAsText(file);
}

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn(error);
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function splitTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function slugify(value) {
  return String(value || "paper")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 72) || "paper";
}

function statusLabel(status) {
  const labels = {
    queued: "Queued",
    reading: "Reading",
    saved: "Saved",
    read: "Read"
  };
  return labels[status] || "Queued";
}

function formatDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function todayKey() {
  return dateToKey(new Date());
}

function dateToKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
