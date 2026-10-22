// Persistence boundary. Only the store talks to this module.
// Local browser storage is the source of truth; the optional server API is a mirror.
const KEY = "brainvault.state.v2";
const LEGACY = {
  workspaces: "maddys_brainvault_workspaces_v2",
  active: "maddys_brainvault_active_ws_v2",
  nodes: "maddys_brainvault_nodes_v1",
  transform: "maddys_brainvault_transform_v1",
};

export function readState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn("Local state unreadable, starting fresh.", err);
  }
  return migrateLegacy();
}

export function writeState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.warn("Local save failed (storage full or blocked).", err);
    window.dispatchEvent(new CustomEvent("brainvault:storage-full"));
    return false;
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch (err) {
    console.warn("Could not clear local state.", err);
  }
}

// Best-effort import of the reference app's four legacy keys.
function migrateLegacy() {
  try {
    const workspaces = JSON.parse(localStorage.getItem(LEGACY.workspaces) || "null");
    if (!Array.isArray(workspaces) || !workspaces.length) return null;
    const nodes = JSON.parse(localStorage.getItem(LEGACY.nodes) || "[]");
    const transform = JSON.parse(localStorage.getItem(LEGACY.transform) || "null");
    return {
      version: 2,
      migrated: true,
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name || "Workspace",
        color: w.bgDarkColor || "#030307",
        themeId: w.themeId || "deep-cobalt",
        shadow: w.glassShadowIntensity ?? 75,
        createdAt: w.createdAt || Date.now(),
        updatedAt: w.updatedAt || Date.now(),
      })),
      nodes: nodes.map((n) => ({
        ...n,
        id: n.id || uid("node"),
        tags: n.tags || [],
        internalPadding: n.internalPadding ?? 20,
        workspaceId: n.workspaceId || workspaces[0].id,
      })),
      stickies: workspaces.flatMap((w) =>
        (w.stickyNotes || []).map((s) => ({ ...s, workspaceId: w.id }))
      ),
      links: [],
      activeWorkspaceId: localStorage.getItem(LEGACY.active) || workspaces[0].id,
      transform: transform || { x: 0, y: 70, scale: 0.65 },
      searchHistory: [],
    };
  } catch (err) {
    console.warn("Legacy migration skipped.", err);
    return null;
  }
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// --- Optional server mirror (same routes the reference uses) -----------------
export async function fetchRemote() {
  const res = await fetch("/api/db/notes");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function pushRemote(snapshot) {
  const res = await fetch("/api/db/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaces: snapshot.workspaces,
      nodes: snapshot.nodes,
      stickies: snapshot.stickies,
      links: snapshot.links,
      activeWorkspaceId: snapshot.activeWorkspaceId,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function statusRemote() {
  const res = await fetch("/api/db/status");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function saveToCloudGDrive(doc) {
  const res = await fetch("/api/gdrive/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
