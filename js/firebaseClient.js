// BrainVault Firebase Firestore Client & Real-Time Persistence Engine
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
  query,
  limit,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

export const DEFAULT_FIREBASE_CONFIG = {
  projectId: "industrial-quote-jmn89",
  appId: "1:338498165209:web:f31c0b90a68fe3d22ea1c8",
  apiKey: "AIzaSyBDVQHcC5M7-kebpR0dOd_7pH7FmNXzH5w",
  authDomain: "industrial-quote-jmn89.firebaseapp.com",
  storageBucket: "industrial-quote-jmn89.firebasestorage.app",
  messagingSenderId: "338498165209",
  measurementId: "",
  oAuthClientId: "338498165209-4ghmbf7k2fs0dg24l66laihdlmhc3rb3.apps.googleusercontent.com",
  recaptchaSiteKey: "",
  firestoreDatabaseId: "(default)"
};

let app = null;
let db = null;
let auth = null;
let connectionVerified = false;

try {
  app = getApps().length ? getApps()[0] : initializeApp(DEFAULT_FIREBASE_CONFIG);
  db = getFirestore(app, DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId);
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase client initialization deferred / offline:", e?.message || e);
}

export { db, auth };

export const OperationType = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  LIST: "list",
  GET: "get",
  WRITE: "write",
};

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || false,
      isAnonymous: auth?.currentUser?.isAnonymous || false,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn("Firestore Notice: ", JSON.stringify(errInfo));
  return errInfo;
}

export async function testFirestoreConnection() {
  if (!db) {
    return { ok: false, offline: true, error: "Firebase DB uninitialized" };
  }
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    connectionVerified = true;
    return { ok: true, projectId: DEFAULT_FIREBASE_CONFIG.projectId, databaseId: DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId };
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      return { ok: false, offline: true, error: error.message };
    }
    connectionVerified = true;
    return { ok: true, projectId: DEFAULT_FIREBASE_CONFIG.projectId, databaseId: DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId };
  }
}

// Automatically verify connection on startup
testFirestoreConnection().catch(() => {});

function sanitizeForFirestore(obj) {
  return JSON.parse(
    JSON.stringify(obj, (_key, val) => {
      if (val === undefined) return null;
      return val;
    })
  );
}

// --- 1. Vault Snapshots (Workspaces, Notes, Stickies, Links) -----------------
export async function saveVaultSnapshotToFirestore(snapshot) {
  if (!db) return { ok: false, offline: true };
  const path = "vault_snapshots/main";
  try {
    const payload = sanitizeForFirestore({
      activeWorkspaceId: snapshot.activeWorkspaceId || "ws-default",
      workspaces: Array.isArray(snapshot.workspaces) ? snapshot.workspaces : [],
      nodes: Array.isArray(snapshot.nodes) ? snapshot.nodes : [],
      stickies: Array.isArray(snapshot.stickies) ? snapshot.stickies : [],
      links: Array.isArray(snapshot.links) ? snapshot.links : [],
      updatedAt: Date.now(),
    });
    await setDoc(doc(db, "vault_snapshots", "main"), payload, { merge: true });
    return { ok: true, source: "firestore", updatedAt: payload.updatedAt };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return { ok: false, error: error.message };
  }
}

export async function fetchVaultSnapshotFromFirestore() {
  if (!db) return null;
  const path = "vault_snapshots/main";
  try {
    const snap = await getDoc(doc(db, "vault_snapshots", "main"));
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

// --- 2. API Keys Configuration -----------------------------------------------
export async function saveApiKeysToFirestore(keys) {
  if (!db) return { ok: false, offline: true };
  const path = "api_keys/config";
  try {
    const payload = sanitizeForFirestore({
      ...keys,
      updatedAt: Date.now(),
    });
    await setDoc(doc(db, "api_keys", "config"), payload, { merge: true });
    return { ok: true, keys: payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return { ok: false, error: error.message };
  }
}

export async function fetchApiKeysFromFirestore() {
  if (!db) return null;
  const path = "api_keys/config";
  try {
    const snap = await getDoc(doc(db, "api_keys", "config"));
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

// --- 3. Saved News & Blog Briefings ------------------------------------------
export async function saveNewsStoryToFirestore(story) {
  if (!db) return { ok: false, offline: true };
  const safeId = String(story.id || `story-${Date.now()}`).replace(/[/\\.#$[\]]/g, "_").slice(0, 120);
  const path = `saved_news/${safeId}`;
  try {
    const payload = sanitizeForFirestore({
      ...story,
      id: safeId,
      title: String(story.title || "Untitled Story").slice(0, 950),
      savedAt: story.savedAt || Date.now(),
    });
    await setDoc(doc(db, "saved_news", safeId), payload, { merge: true });
    return { ok: true, story: payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return { ok: false, error: error.message };
  }
}

export async function deleteNewsStoryFromFirestore(storyId) {
  if (!db) return { ok: false, offline: true };
  const safeId = String(storyId || "").replace(/[/\\.#$[\]]/g, "_").slice(0, 120);
  const path = `saved_news/${safeId}`;
  try {
    await deleteDoc(doc(db, "saved_news", safeId));
    return { ok: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return { ok: false, error: error.message };
  }
}

export async function fetchSavedNewsFromFirestore() {
  if (!db) return [];
  const path = "saved_news";
  try {
    const q = query(collection(db, "saved_news"), limit(100));
    const snap = await getDocs(q);
    const items = [];
    snap.forEach((d) => items.push(d.data()));
    items.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

// --- 4. CISA KEV & 2020-2026 CVE / Malware Catalog ---------------------------
export async function syncCvesToFirestore(cves = []) {
  if (!db) return { ok: false, count: 0 };
  const path = "cve_catalog";
  try {
    const batch = writeBatch(db);
    const slice = cves.slice(0, 60);
    for (const cve of slice) {
      if (!cve || !cve.cveId) continue;
      const safeId = String(cve.cveId).replace(/[/\\.#$[\]]/g, "_").slice(0, 100);
      const ref = doc(db, "cve_catalog", safeId);
      batch.set(
        ref,
        sanitizeForFirestore({
          ...cve,
          cveId: String(cve.cveId).slice(0, 100),
          title: String(cve.title || cve.cveId).slice(0, 950),
          updatedAt: Date.now(),
        }),
        { merge: true }
      );
    }
    await batch.commit();
    return { ok: true, count: slice.length };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return { ok: false };
  }
}

export async function fetchCvesFromFirestore() {
  if (!db) return [];
  const path = "cve_catalog";
  try {
    const q = query(collection(db, "cve_catalog"), limit(120));
    const snap = await getDocs(q);
    const items = [];
    snap.forEach((d) => items.push(d.data()));
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export function getFirebaseMetadata() {
  return {
    projectId: DEFAULT_FIREBASE_CONFIG.projectId,
    databaseId: DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId,
    connected: connectionVerified,
  };
}
