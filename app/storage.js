// storage.js — earned-trophy persistence: localStorage save/load, JSON export download,
// JSON import validation. No network: everything stays in the browser and in local files.

const STORAGE_KEY = "leonida-legend-progress-v1";

export function loadEarnedNames() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((name) => typeof name === "string") : [];
  } catch {
    return [];
  }
}

export function saveEarnedNames(earnedNames) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...earnedNames]));
  } catch {
    // Storage may be unavailable (private mode); the session still works in memory.
  }
}

export function clearStoredProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

export function buildExportPayload(earnedNames) {
  return {
    app: "leonida-legend-gta6-tracker",
    game: "Grand Theft Auto VI",
    platform: "PlayStation 5",
    version: 1,
    exportedAt: new Date().toISOString(),
    earned: [...earnedNames].sort(),
  };
}

export function downloadProgressFile(earnedNames) {
  const payload = buildExportPayload(earnedNames);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = "gta6-trophy-progress.json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  return payload.earned.length;
}

export async function readImportedProgress(file, validNames) {
  const data = JSON.parse(await file.text());
  const list = Array.isArray(data) ? data : Array.isArray(data?.earned) ? data.earned : null;
  if (!list || !list.every((name) => typeof name === "string")) {
    throw new Error("Not a progress file: expected an earned-name array or an object with an \"earned\" array.");
  }
  const earned = list.filter((name) => validNames.has(name));
  return { earned, unknownCount: list.length - earned.length };
}