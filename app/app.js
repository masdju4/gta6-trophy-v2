// app.js — Leonida Legend controller: loads the trophy data, renders the checklist and
// detail panel, applies filters and the spoiler guard, syncs URL-hash deep links, and
// wires progress persistence, export and import. Everything runs offline.

import {
  loadEarnedNames,
  saveEarnedNames,
  clearStoredProgress,
  downloadProgressFile,
  readImportedProgress,
} from "./storage.js";
import { renderRoadmap } from "./roadmap.js";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "story", label: "Story" },
  { id: "collectible", label: "Collectibles" },
  { id: "activity", label: "Activities" },
  { id: "online", label: "Online" },
  { id: "missable", label: "Missable" },
  { id: "unearned", label: "Unearned" },
];

const GRADE_ORDER = ["platinum", "gold", "silver", "bronze"];
const GRADE_COLORS = { platinum: "#a9f1ff", gold: "#ffd166", silver: "#c9d1e0", bronze: "#d08a4e" };

const state = {
  trophies: [],
  earned: new Set(),
  view: "checklist",
  filter: "all",
  spoilersOn: true,
  selectedName: null,
};

const elements = {
  earnedCount: document.getElementById("earned-count"),
  earnedPercent: document.getElementById("earned-percent"),
  progressTrack: document.getElementById("progress-track"),
  progressFill: document.getElementById("progress-fill"),
  gradeTally: document.getElementById("grade-tally"),
  tabChecklist: document.getElementById("tab-checklist"),
  tabRoadmap: document.getElementById("tab-roadmap"),
  spoilerToggle: document.getElementById("spoiler-toggle"),
  exportButton: document.getElementById("export-progress"),
  importInput: document.getElementById("import-file"),
  resetButton: document.getElementById("reset-progress"),
  statusLine: document.getElementById("status-line"),
  filterBar: document.getElementById("filter-bar"),
  checklistView: document.getElementById("checklist-view"),
  roadmapView: document.getElementById("roadmap-view"),
  trophyList: document.getElementById("trophy-list"),
  detailPanel: document.getElementById("detail-panel"),
  roadmapContainer: document.getElementById("roadmap-container"),
};

/* ---------- URL hash deep links: #view=…&filter=…&spoilers=…&trophy=… ---------- */

export function trophySlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function readHashIntoState() {
  const params = new URLSearchParams(location.hash.slice(1));
  const view = params.get("view");
  if (view === "checklist" || view === "roadmap") state.view = view;
  const filter = params.get("filter");
  if (FILTERS.some((f) => f.id === filter)) state.filter = filter;
  const spoilers = params.get("spoilers");
  if (spoilers === "on") state.spoilersOn = true;
  if (spoilers === "off") state.spoilersOn = false;
  const slug = params.get("trophy");
  if (slug) {
    const match = state.trophies.find((t) => trophySlug(t.name) === slug);
    state.selectedName = match ? match.name : null;
  } else {
    state.selectedName = null;
  }
}

function writeStateToHash() {
  const params = new URLSearchParams();
  params.set("view", state.view);
  params.set("filter", state.filter);
  params.set("spoilers", state.spoilersOn ? "on" : "off");
  if (state.selectedName) params.set("trophy", trophySlug(state.selectedName));
  history.replaceState(null, "", "#" + params.toString());
}

/* ---------- filtering and spoiler masking ---------- */

function matchesFilter(trophy, filterId) {
  switch (filterId) {
    case "story": return trophy.kind === "story";
    case "collectible": return trophy.kind === "collectible";
    case "activity": return trophy.kind === "activity";
    case "online": return trophy.kind === "online";
    case "missable": return trophy.missable === true;
    case "unearned": return !state.earned.has(trophy.name);
    default: return true;
  }
}

function isMasked(trophy) {
  return state.spoilersOn && trophy.kind === "story" && !state.earned.has(trophy.name);
}

function setStatus(message, isError = false) {
  elements.statusLine.textContent = message;
  elements.statusLine.classList.toggle("error", isError);
}

/* ---------- header progress ---------- */

function renderProgress() {
  const total = state.trophies.length;
  const earnedCount = state.trophies.filter((t) => state.earned.has(t.name)).length;
  const percent = total ? Math.round((earnedCount / total) * 100) : 0;
  elements.earnedCount.textContent = `${earnedCount} / ${total}`;
  elements.earnedPercent.textContent = `${percent}%`;
  elements.progressFill.style.width = `${percent}%`;
  elements.progressTrack.setAttribute("aria-valuenow", String(earnedCount));

  elements.gradeTally.replaceChildren();
  for (const grade of GRADE_ORDER) {
    const ofGrade = state.trophies.filter((t) => t.grade === grade);
    const earnedOfGrade = ofGrade.filter((t) => state.earned.has(t.name)).length;
    const item = document.createElement("span");
    item.className = "tally-item";
    const dot = document.createElement("span");
    dot.className = "tally-dot";
    dot.style.background = GRADE_COLORS[grade];
    item.append(dot, document.createTextNode(`${grade} ${earnedOfGrade}/${ofGrade.length}`));
    elements.gradeTally.append(item);
  }
}

/* ---------- filter bar ---------- */

function renderFilterBar() {
  elements.filterBar.replaceChildren();
  for (const filter of FILTERS) {
    const count = state.trophies.filter((t) => matchesFilter(t, filter.id)).length;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "filter-chip" + (filter.id === "missable" ? " missable-chip" : "");
    chip.setAttribute("aria-pressed", String(state.filter === filter.id));
    chip.append(document.createTextNode(filter.label));
    const countSpan = document.createElement("span");
    countSpan.className = "chip-count";
    countSpan.textContent = String(count);
    chip.append(countSpan);
    chip.addEventListener("click", () => {
      state.filter = filter.id;
      writeStateToHash();
      renderChecklist();
      renderFilterBar();
    });
    elements.filterBar.append(chip);
  }
}

/* ---------- checklist ---------- */

function renderChecklist() {
  elements.trophyList.replaceChildren();
  const visible = state.trophies.filter((t) => matchesFilter(t, state.filter));

  if (visible.length === 0) {
    const note = document.createElement("li");
    note.className = "empty-note";
    note.textContent = state.filter === "online"
      ? "No online trophies: the PS5 list is fully offline — all 55 trophies are earned in the single-player game."
      : "Nothing matches this filter right now.";
    elements.trophyList.append(note);
    return;
  }

  for (const trophy of visible) {
    const earned = state.earned.has(trophy.name);
    const masked = isMasked(trophy);

    const row = document.createElement("li");
    row.className = "trophy-row" + (earned ? " earned" : "") + (state.selectedName === trophy.name ? " selected" : "");

    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "earned-box";
    box.checked = earned;
    box.setAttribute("aria-label", `Mark ${masked ? "hidden story trophy" : trophy.name} as earned`);
    box.addEventListener("click", (event) => event.stopPropagation());
    box.addEventListener("change", () => toggleEarned(trophy.name, box.checked));

    const badge = document.createElement("span");
    badge.className = `grade-badge grade-${trophy.grade}`;
    badge.textContent = trophy.grade;

    const text = document.createElement("span");
    text.className = "trophy-text";
    const nameButton = document.createElement("button");
    nameButton.type = "button";
    nameButton.className = "trophy-name" + (masked ? " masked" : "");
    nameButton.textContent = masked ? "???" : trophy.name;
    const desc = document.createElement("span");
    desc.className = "trophy-desc" + (masked ? " masked" : "");
    desc.textContent = masked ? "???" : trophy.description;
    text.append(nameButton, desc);

    const tags = document.createElement("span");
    tags.className = "row-tags";
    if (trophy.missable) tags.append(makeTag("MISSABLE", "tag-missable"));
    if (earned) tags.append(makeTag("EARNED", "tag-earned"));
    else if (trophy.hidden) tags.append(makeTag("hidden", "tag-hidden"));
    tags.append(makeTag(trophy.kind, "tag-kind"));

    row.append(box, badge, text, tags);
    row.addEventListener("click", () => openTrophy(trophy.name));
    elements.trophyList.append(row);
  }
}

function makeTag(label, extraClass) {
  const tag = document.createElement("span");
  tag.className = "tag " + extraClass;
  tag.textContent = label;
  return tag;
}

/* ---------- detail panel: guide, cited sources, roadmap placement ---------- */

function renderDetailPanel() {
  const panel = elements.detailPanel;
  panel.replaceChildren();
  const trophy = state.trophies.find((t) => t.name === state.selectedName);

  if (!trophy) {
    const empty = document.createElement("p");
    empty.className = "detail-empty";
    empty.textContent = "Select a trophy to read its guide, sources and roadmap placement. Progress is saved in this browser; export it to carry it between devices.";
    panel.append(empty);
    return;
  }

  const earned = state.earned.has(trophy.name);
  const masked = isMasked(trophy);

  const head = document.createElement("div");
  head.className = "detail-head";
  const badge = document.createElement("span");
  badge.className = `grade-badge grade-${trophy.grade}`;
  badge.textContent = trophy.grade;
  head.append(badge, makeTag(trophy.kind, "tag-kind"));
  if (trophy.hidden) head.append(makeTag("hidden on PSN", "tag-hidden"));
  const close = document.createElement("button");
  close.type = "button";
  close.className = "detail-close";
  close.textContent = "✕";
  close.setAttribute("aria-label", "Close guide");
  close.addEventListener("click", closeTrophy);
  head.append(close);
  panel.append(head);

  const title = document.createElement("h2");
  title.className = "detail-title" + (masked ? " masked" : "");
  title.textContent = masked ? "???" : trophy.name;
  panel.append(title);

  if (trophy.missable) {
    const banner = document.createElement("p");
    banner.className = "missable-banner";
    banner.textContent = "⚠ Missable — its window can close. See the guide for when to do it.";
    panel.append(banner);
  }

  const desc = document.createElement("p");
  desc.className = "detail-desc" + (masked ? " masked" : "");
  desc.textContent = masked ? "???" : trophy.description;
  panel.append(desc);

  if (masked) {
    const note = document.createElement("p");
    note.className = "spoiler-note";
    note.textContent = "Spoiler guard is on: this story trophy's name, description and guide stay hidden until you earn it. Switch the guard off in the toolbar to reveal them.";
    panel.append(note);
  } else {
    appendSection(panel, "Guide", trophy.guide, "detail-guide");
    appendSection(panel, `Roadmap · stage ${trophy.stage}`, trophy.roadmapNote, "detail-roadmap");

    const label = document.createElement("p");
    label.className = "detail-section-label";
    label.textContent = "Sources";
    const list = document.createElement("ul");
    list.className = "source-list";
    for (const source of trophy.sources) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = source.label;
      item.append(link);
      list.append(item);
    }
    panel.append(label, list);
  }

  const actions = document.createElement("div");
  actions.className = "detail-actions";
  const mark = document.createElement("button");
  mark.type = "button";
  mark.className = "mark-earned";
  mark.textContent = earned ? "Unmark as earned" : "Mark as earned";
  mark.addEventListener("click", () => toggleEarned(trophy.name, !earned));
  actions.append(mark);
  panel.append(actions);
}

function appendSection(panel, labelText, bodyText, bodyClass) {
  const label = document.createElement("p");
  label.className = "detail-section-label";
  label.textContent = labelText;
  const body = document.createElement("p");
  body.className = bodyClass;
  body.textContent = bodyText;
  panel.append(label, body);
}

/* ---------- state changes ---------- */

function toggleEarned(name, earned) {
  if (earned) state.earned.add(name);
  else state.earned.delete(name);
  saveEarnedNames(state.earned);
  renderAll();
}

function openTrophy(name) {
  state.selectedName = name;
  state.view = "checklist";
  writeStateToHash();
  renderAll();
  if (window.innerWidth < 1024) elements.detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeTrophy() {
  state.selectedName = null;
  writeStateToHash();
  renderAll();
}

function renderAll() {
  elements.tabChecklist.setAttribute("aria-selected", String(state.view === "checklist"));
  elements.tabRoadmap.setAttribute("aria-selected", String(state.view === "roadmap"));
  elements.checklistView.hidden = state.view !== "checklist";
  elements.roadmapView.hidden = state.view !== "roadmap";
  elements.spoilerToggle.checked = state.spoilersOn;

  renderProgress();
  renderFilterBar();
  renderChecklist();
  renderDetailPanel();
  renderRoadmap(elements.roadmapContainer, state.trophies, state.earned, state.spoilersOn, openTrophy);
}

/* ---------- toolbar wiring ---------- */

elements.tabChecklist.addEventListener("click", () => {
  state.view = "checklist";
  writeStateToHash();
  renderAll();
  window.scrollTo(0, 0);
});
elements.tabRoadmap.addEventListener("click", () => {
  state.view = "roadmap";
  writeStateToHash();
  renderAll();
  window.scrollTo(0, 0);
});
elements.spoilerToggle.addEventListener("change", () => {
  state.spoilersOn = elements.spoilerToggle.checked;
  writeStateToHash();
  renderAll();
});
elements.exportButton.addEventListener("click", () => {
  const count = downloadProgressFile(state.earned);
  setStatus(`Exported ${count} earned ${count === 1 ? "trophy" : "trophies"} to gta6-trophy-progress.json`);
});
elements.importInput.addEventListener("change", async () => {
  const file = elements.importInput.files[0];
  elements.importInput.value = "";
  if (!file) return;
  try {
    const validNames = new Set(state.trophies.map((t) => t.name));
    const { earned, unknownCount } = await readImportedProgress(file, validNames);
    state.earned = new Set(earned);
    saveEarnedNames(state.earned);
    renderAll();
    setStatus(`Imported ${earned.length} earned ${earned.length === 1 ? "trophy" : "trophies"}${unknownCount ? ` (${unknownCount} unknown ${unknownCount === 1 ? "name" : "names"} skipped)` : ""}.`);
  } catch (error) {
    setStatus(`Import failed: ${error.message}`, true);
  }
});
elements.resetButton.addEventListener("click", () => {
  if (!confirm("Clear all earned trophies in this browser?")) return;
  state.earned = new Set();
  clearStoredProgress();
  renderAll();
  setStatus("Progress cleared.");
});
window.addEventListener("hashchange", () => {
  readHashIntoState();
  renderAll();
  window.scrollTo(0, 0);
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.selectedName) closeTrophy();
});

/* ---------- boot ---------- */

const response = await fetch("data/trophies.json");
if (!response.ok) throw new Error(`Could not load trophy data (${response.status})`);
const data = await response.json();
state.trophies = data.trophies;
state.earned = new Set(loadEarnedNames().filter((name) => state.trophies.some((t) => t.name === name)));
readHashIntoState();
writeStateToHash();
renderAll();