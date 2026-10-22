// Persistence boundary. Only the store talks to this module.
// Local browser storage, Firebase Firestore, and the server API work in concert.
import {
  saveVaultSnapshotToFirestore,
  fetchVaultSnapshotFromFirestore,
  testFirestoreConnection,
  getFirebaseMetadata,
} from "./firebaseClient.js";

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

// --- Dual Firebase Firestore + Server Database Mirror ------------------------
export async function fetchRemote() {
  // 1. Try Firebase Firestore first
  try {
    const firestoreSnap = await fetchVaultSnapshotFromFirestore();
    if (firestoreSnap && Array.isArray(firestoreSnap.workspaces) && firestoreSnap.workspaces.length > 0) {
      return { ok: true, source: "firebase-firestore", snapshot: firestoreSnap };
    }
  } catch (err) {
    console.warn("Firestore fetch fallback to server API:", err);
  }

  // 2. Fallback to Express server database (/api/db/notes)
  const res = await fetch("/api/db/notes");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function pushRemote(snapshot) {
  const payload = {
    workspaces: snapshot.workspaces || [],
    nodes: snapshot.nodes || [],
    stickies: snapshot.stickies || [],
    links: snapshot.links || [],
    activeWorkspaceId: snapshot.activeWorkspaceId || "ws-default",
  };

  const results = await Promise.allSettled([
    saveVaultSnapshotToFirestore(payload),
    fetch("/api/db/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }),
  ]);

  const anySuccess = results.some((r) => r.status === "fulfilled");
  if (!anySuccess) {
    throw new Error("Both Firestore and Server DB sync failed");
  }
  return { ok: true, syncedTo: ["firebase-firestore", "server-db"] };
}

export async function statusRemote() {
  const [fbStatus, apiStatus] = await Promise.allSettled([
    testFirestoreConnection(),
    fetch("/api/db/status").then((r) => (r.ok ? r.json() : null)),
  ]);

  const fbMeta = getFirebaseMetadata();
  const isFbOk = fbStatus.status === "fulfilled" && fbStatus.value?.ok;
  const apiVal = apiStatus.status === "fulfilled" ? apiStatus.value : null;

  return {
    ok: isFbOk || Boolean(apiVal?.ok),
    engine: "Firebase Firestore + Node Server DB",
    database: `${fbMeta.projectId} (${fbMeta.databaseId})`,
    firebaseConnected: isFbOk,
    serverConnected: Boolean(apiVal?.ok),
  };
}

export async function saveToCloudGDrive(docData) {
  const res = await fetch("/api/gdrive/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(docData),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
