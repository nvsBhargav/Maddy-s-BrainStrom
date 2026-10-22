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
import firebaseConfig from "../firebase-applet-config.json";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

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
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  return errInfo;
}

let connectionVerified = false;
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    connectionVerified = true;
    return { ok: true, projectId: firebaseConfig.projectId, databaseId: firebaseConfig.firestoreDatabaseId };
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration. The client is offline.");
      return { ok: false, error: error.message };
    }
    connectionVerified = true;
    return { ok: true, projectId: firebaseConfig.projectId, databaseId: firebaseConfig.firestoreDatabaseId };
  }
}

// Automatically verify connection on startup
testFirestoreConnection();

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
    throw error;
  }
}

export async function fetchVaultSnapshotFromFirestore() {
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
    throw error;
  }
}

export async function fetchApiKeysFromFirestore() {
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
    throw error;
  }
}

export async function deleteNewsStoryFromFirestore(storyId) {
  const safeId = String(storyId || "").replace(/[/\\.#$[\]]/g, "_").slice(0, 120);
  const path = `saved_news/${safeId}`;
  try {
    await deleteDoc(doc(db, "saved_news", safeId));
    return { ok: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function fetchSavedNewsFromFirestore() {
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
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    connected: connectionVerified,
  };
}
