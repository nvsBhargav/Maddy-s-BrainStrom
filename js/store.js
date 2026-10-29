// Single data-access module: all canvas state lives here; persistence is delegated.
import * as persistence from "./persistence.js";
import { composeConcept } from "./content.js";

const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const LIGHT_PASTEL_PALETTE = [
  { name: "Soft Lavender", hex: "#ede9fe", label: "Lavender" },
  { name: "Pastel Mint", hex: "#dcfce7", label: "Mint" },
  { name: "Muted Sky", hex: "#e0f2fe", label: "Sky" },
  { name: "Warm Parchment", hex: "#fef3c7", label: "Parchment" },
  { name: "Gentle Peach", hex: "#ffedd5", label: "Peach" },
  { name: "Pale Sage", hex: "#ecfccb", label: "Sage" },
  { name: "Soft Cream", hex: "#fffbeb", label: "Cream" },
  { name: "Cloud Gray", hex: "#f1f5f9", label: "Cloud" },
  { name: "Soft Rose", hex: "#ffe4e6", label: "Rose" },
  { name: "Periwinkle", hex: "#e0e7ff", label: "Periwinkle" },
  { name: "Lilac Mist", hex: "#f3e8ff", label: "Lilac" },
  { name: "Ice Blue", hex: "#e0f7fa", label: "Ice Blue" },
];

export const CARD_COLORS = LIGHT_PASTEL_PALETTE.map((c) => c.hex);
export const STICKY_COLORS = ["#FEF08A", "#BAE6FD", "#FBCFE8", "#BBF7D0", "#E9D5FF", "#FED7AA"];
export const THEMES = [
  "matrix",
  "matrix-green",
  "cobalt",
  "amber",
  "obsidian",
  "violet",
  "slate",
  "aurora",
  "solar",
  "material-dark",
  "material-indigo",
  "material-emerald"
];

export const THEME_DETAILS = [
  { id: "matrix", name: "Cyber Matrix", desc: "Black glass shell with radiant emerald matrix filaments", color: "#22c55e", bg: "#000000" },
  { id: "matrix-green", name: "Terminal Hacker (Black & Green)", desc: "True pitch-black canvas with intense phosphor green filaments & cyber glow", color: "#00ff66", bg: "#000000" },
  { id: "cobalt", name: "Deep Cobalt", desc: "Midnight navy glass with cyber cyan accents", color: "#22d3ee", bg: "#030307" },
  { id: "amber", name: "Amber Terminal", desc: "Dark bronze with warm golden amber glow", color: "#fbbf24", bg: "#0a0703" },
  { id: "obsidian", name: "Obsidian Crimson", desc: "Pitch black with radiant ruby & rose accents", color: "#fb7185", bg: "#050305" },
  { id: "violet", name: "Neural Neon", desc: "Deep cerebral indigo with electric violet glow", color: "#c084fc", bg: "#080514" },
  { id: "slate", name: "Minimal Slate", desc: "Cool dark charcoal with steel cyan highlights", color: "#94a3b8", bg: "#090d16" },
  { id: "aurora", name: "Nordic Aurora", desc: "Deep ocean abyss with luminous arctic mint", color: "#2dd4bf", bg: "#021212" },
  { id: "solar", name: "Solar Light", desc: "Clean cream & pearl glass with crisp navy lines", color: "#0284c7", bg: "#f8fafc" },
  { id: "material-dark", name: "Google Material Dark", desc: "Material Design 3 elevated surfaces (#121212) with cyan/teal accents", color: "#80cbc4", bg: "#121212" },
  { id: "material-indigo", name: "Google Material Indigo", desc: "Material slate-indigo surface palette with vivid pink/rose highlights", color: "#818cf8", bg: "#0f172a" },
  { id: "material-emerald", name: "Google Material Forest", desc: "Deep evergreen surface elevations with luminous jade and mint tones", color: "#34d399", bg: "#061d14" },
];
const WORKSPACE_COLORS = ["#030307", "#02120a", "#041a10", "#050510", "#0a0603"];

export function hexToRgb(hex) {
  if (!hex || typeof hex !== "string") return null;
  let c = hex.replace("#", "").trim();
  if (c.length === 3) c = c.split("").map((x) => x + x).join("");
  if (c.length !== 6) return null;
  const num = parseInt(c, 16);
  if (isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const toH = (v) => clamp(v).toString(16).padStart(2, "0");
  return "#" + toH(r) + toH(g) + toH(b);
}

export function getLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

export function isLightColor(hex) {
  return getLuminance(hex) >= 0.70;
}

export function ensureLightDecentColor(hex, fallback = CARD_COLORS[0]) {
  if (!hex || typeof hex !== "string") return fallback;
  const clean = hex.trim();
  const rgb = hexToRgb(clean);
  if (!rgb) return fallback;
  const normalized = rgbToHex(rgb.r, rgb.g, rgb.b);
  if (isLightColor(normalized)) {
    return normalized;
  }
  // Soften dark or harsh colors to an aesthetic light pastel paper tone (mix 80% white + 20% tone)
  const r = Math.round(255 * 0.80 + rgb.r * 0.20);
  const g = Math.round(255 * 0.80 + rgb.g * 0.20);
  const b = Math.round(255 * 0.80 + rgb.b * 0.20);
  const pastel = rgbToHex(r, g, b);
  return isLightColor(pastel) ? pastel : (fallback || "#f1f5f9");
}

export function getSavedCustomColors() {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("brainvault_custom_colors");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return arr.filter((c) => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)).slice(0, 16);
        }
      }
    }
  } catch (_) {}
  return [];
}

export function saveCustomColor(color) {
  const clean = ensureLightDecentColor(color);
  const existing = getSavedCustomColors();
  const next = [clean, ...existing.filter((c) => c.toLowerCase() !== clean.toLowerCase())].slice(0, 12);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("brainvault_custom_colors", JSON.stringify(next));
    }
  } catch (_) {}
  return next;
}

export function removeCustomColor(color) {
  const existing = getSavedCustomColors();
  const next = existing.filter((c) => c.toLowerCase() !== color.toLowerCase());
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("brainvault_custom_colors", JSON.stringify(next));
    }
  } catch (_) {}
  return next;
}

const listeners = new Set();
let state = normalize(persistence.readState() || blankState());
let past = [];
let future = [];

function blankState() {
  const id = "ws-default";
  return {
    version: 2,
    workspaces: [makeWorkspace({ id, name: "Main Research Space", color: "#030307", themeId: "matrix" })],
    nodes: [],
    stickies: [],
    links: [],
    activeWorkspaceId: id,
    transform: { x: 0, y: 70, scale: 0.65 },
    searchHistory: [],
  };
}

function makeWorkspace({ id = uid("ws"), name, color = WORKSPACE_COLORS[0], themeId = "matrix", passwordProtected = false, password = "" } = {}) {
  return {
    id,
    name: name || "Untitled Workspace",
    color,
    themeId,
    passwordProtected: Boolean(passwordProtected),
    password: password || "",
    shadow: 75,
    transform: { x: 0, y: 70, scale: 0.65 },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function normalize(snapshot) {
  const base = blankState();
  if (!snapshot || !Array.isArray(snapshot.workspaces) || !snapshot.workspaces.length) return base;
  const workspaces = snapshot.workspaces.map((w) => ({
    ...makeWorkspace({ id: w.id, name: w.name, color: w.color || "#030307", themeId: w.themeId, passwordProtected: w.passwordProtected, password: w.password }),
    passwordProtected: Boolean(w.passwordProtected),
    password: w.password || "",
    shadow: w.shadow ?? 75,
    transform: isTransform(w.transform) ? w.transform : isTransform(snapshot.transform) ? snapshot.transform : { x: 0, y: 70, scale: 0.65 },
    createdAt: w.createdAt || Date.now(),
    updatedAt: w.updatedAt || Date.now(),
  }));
  const ids = new Set(workspaces.map((w) => w.id));
  const active = ids.has(snapshot.activeWorkspaceId) ? snapshot.activeWorkspaceId : workspaces[0].id;
  const activeWs = workspaces.find((w) => w.id === active);
  return {
    version: 2,
    workspaces,
    nodes: (snapshot.nodes || []).filter((n) => ids.has(n.workspaceId)).map((n, idx) => {
      let color = n.color;
      if (!color || color === "#11121d" || color === "#0e0d33" || color === "#030307") {
        color = CARD_COLORS[idx % CARD_COLORS.length];
      } else {
        color = ensureLightDecentColor(color, CARD_COLORS[idx % CARD_COLORS.length]);
      }
      return {
        ...n,
        color,
        fontFamily: n.fontFamily || "Space Grotesk",
        fontSize: n.fontSize || "14px",
        textColor: n.textColor && n.textColor !== "#ffffff" && n.textColor !== "#fff" ? n.textColor : "#0e0d33",
        fontBold: Boolean(n.fontBold),
        fontItalic: Boolean(n.fontItalic),
        images: Array.isArray(n.images) ? n.images : [],
        tags: Array.isArray(n.tags) ? n.tags : [],
      };
    }),
    stickies: (snapshot.stickies || []).filter((s) => ids.has(s.workspaceId)),
    links: (snapshot.links || []).filter((l) => ids.has(l.workspaceId)),
    activeWorkspaceId: active,
    transform: activeWs?.transform || { x: 0, y: 70, scale: 0.65 },
    searchHistory: Array.isArray(snapshot.searchHistory) ? snapshot.searchHistory.slice(0, 8) : [],
  };
}

function isTransform(t) {
  return t && Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.scale);
}

function emit() {
  listeners.forEach((fn) => fn(state));
}

function snapshot() {
  return structuredClone(state);
}

let dbSyncTimer = null;
let dbSyncStatus = "synced";
const dbListeners = new Set();

function emitDb() {
  dbListeners.forEach((fn) => fn(dbSyncStatus));
}

function scheduleDatabaseSync() {
  if (dbSyncTimer) clearTimeout(dbSyncTimer);
  dbSyncStatus = "syncing";
  emitDb();
  dbSyncTimer = setTimeout(async () => {
    try {
      persistence.writeState(state);
      await persistence.pushRemote(snapshot());
      dbSyncStatus = "synced";
    } catch (err) {
      console.warn("Database auto-sync fallback to local:", err?.message || err);
      dbSyncStatus = "synced";
    } finally {
      emitDb();
    }
  }, 350);
}

// Flush pending database sync before unloading the tab
window.addEventListener("beforeunload", () => {
  if (dbSyncTimer) {
    clearTimeout(dbSyncTimer);
    try {
      const payload = JSON.stringify({
        workspaces: state.workspaces,
        nodes: state.nodes,
        stickies: state.stickies,
        links: state.links,
        activeWorkspaceId: state.activeWorkspaceId,
      });
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon?.("/api/db/notes", blob);
    } catch (_) {}
  }
});

function apply(next, { record = true, syncRemote = true } = {}) {
  if (record) {
    past.push(snapshot());
    if (past.length > 60) past.shift();
    future = [];
  }
  state = next;
  touchWorkspace();
  persistence.writeState(state);
  if (syncRemote) {
    scheduleDatabaseSync();
  }
  emit();
}

function touchWorkspace() {
  const ws = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
  if (ws) ws.updatedAt = Date.now();
}

export const store = {
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  get state() {
    return state;
  },
  get canUndo() {
    return past.length > 0;
  },
  get canRedo() {
    return future.length > 0;
  },
  undo() {
    if (!past.length) return false;
    future.push(snapshot());
    state = past.pop();
    persistence.writeState(state);
    emit();
    return true;
  },
  redo() {
    if (!future.length) return false;
    past.push(snapshot());
    state = future.pop();
    persistence.writeState(state);
    emit();
    return true;
  },
  checkpoint() {
    past.push(snapshot());
    if (past.length > 60) past.shift();
    future = [];
  },
  persist() {
    persistence.writeState(state);
  },
  ensureLightDecentColor,
  getSavedCustomColors,
  saveCustomColor,
  removeCustomColor,

  // --- selectors ------------------------------------------------------------
  activeWorkspace() {
    return state.workspaces.find((w) => w.id === state.activeWorkspaceId) || state.workspaces[0];
  },
  nodes(workspaceId = state.activeWorkspaceId) {
    return state.nodes.filter((n) => n.workspaceId === workspaceId);
  },
  stickies(workspaceId = state.activeWorkspaceId) {
    return state.stickies.filter((s) => s.workspaceId === workspaceId);
  },
  links(workspaceId = state.activeWorkspaceId) {
    return state.links.filter((l) => l.workspaceId === workspaceId);
  },
  node(id) {
    return state.nodes.find((n) => n.id === id) || null;
  },
  sticky(id) {
    return state.stickies.find((s) => s.id === id) || null;
  },

  // --- workspaces -----------------------------------------------------------
  createWorkspace(name) {
    const n = state.workspaces.length + 1;
    const ws = makeWorkspace({
      name: name || `Workspace ${n}`,
      color: WORKSPACE_COLORS[state.workspaces.length % WORKSPACE_COLORS.length],
    });
    apply({ ...state, workspaces: [...state.workspaces, ws], activeWorkspaceId: ws.id, transform: { x: 0, y: 70, scale: 0.65 } });
    return ws;
  },
  selectWorkspace(id, { record = false } = {}) {
    const target = state.workspaces.find((w) => w.id === id);
    if (!target || state.activeWorkspaceId === id) return;
    apply({ ...state, activeWorkspaceId: id, transform: { ...(target.transform || state.transform) } }, { record });
  },
  renameWorkspace(id, name) {
    const clean = name.trim();
    if (!clean) return;
    apply({ ...state, workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, name: clean, updatedAt: Date.now() } : w)) });
  },
  setWorkspaceColor(id, color) {
    apply({ ...state, workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, color, updatedAt: Date.now() } : w)) });
  },
  setWorkspaceTheme(id, themeId) {
    apply({ ...state, workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, themeId, updatedAt: Date.now() } : w)) });
  },
  setWorkspaceShadow(id, shadow) {
    apply({ ...state, workspaces: state.workspaces.map((w) => (w.id === id ? { ...w, shadow, updatedAt: Date.now() } : w)) });
  },
  setWorkspacePassword(id, password) {
    const pass = (password || "").trim();
    apply({
      ...state,
      workspaces: state.workspaces.map((w) =>
        w.id === id
          ? {
              ...w,
              passwordProtected: Boolean(pass),
              password: pass,
              updatedAt: Date.now(),
            }
          : w
      ),
    });
  },
  duplicateWorkspace(id) {
    const src = state.workspaces.find((w) => w.id === id);
    if (!src) return null;
    const copy = makeWorkspace({
      name: `${src.name} copy`,
      color: src.color,
      themeId: src.themeId,
      passwordProtected: src.passwordProtected,
      password: src.password,
    });
    copy.shadow = src.shadow;
    copy.transform = { ...(src.transform || state.transform) };
    const nodes = state.nodes
      .filter((n) => n.workspaceId === id)
      .map((n) => ({ ...structuredClone(n), id: uid("node"), workspaceId: copy.id }));
    const map = new Map(
      state.nodes.filter((n) => n.workspaceId === id).map((n, i) => [n.id, nodes[i]?.id])
    );
    for (const n of nodes) if (n.parentId && map.has(n.parentId)) n.parentId = map.get(n.parentId);
    const stickies = state.stickies
      .filter((s) => s.workspaceId === id)
      .map((s) => ({ ...structuredClone(s), id: uid("sticky"), workspaceId: copy.id }));
    apply({ ...state, workspaces: [...state.workspaces, copy], nodes: [...state.nodes, ...nodes], stickies: [...state.stickies, ...stickies], activeWorkspaceId: copy.id });
    return copy;
  },
  deleteWorkspace(id) {
    if (state.workspaces.length <= 1) return false;
    const workspaces = state.workspaces.filter((w) => w.id !== id);
    const active = state.activeWorkspaceId === id ? workspaces[0].id : state.activeWorkspaceId;
    apply({
      ...state,
      workspaces,
      activeWorkspaceId: active,
      nodes: state.nodes.filter((n) => n.workspaceId !== id),
      stickies: state.stickies.filter((s) => s.workspaceId !== id),
      links: state.links.filter((l) => l.workspaceId !== id),
    });
    return true;
  },

  // --- nodes ----------------------------------------------------------------
  createNode({ prompt, parentId = null, x, y, width = 760, height = 580, color, isCustom = false, record = true, fontFamily, fontSize, textColor, fontBold, fontItalic }) {
    const ws = state.activeWorkspaceId;
    const parent = parentId ? state.nodes.find((n) => n.id === parentId) : null;
    const siblings = state.nodes.filter((n) => n.workspaceId === ws);
    const subIndex = parent ? state.nodes.filter((n) => n.parentId === parent.id).length + 1 : 0;
    const primaryIndex = siblings.filter((n) => !n.parentId && !n.isCustom).length + 1;
    const index = parent ? subIndex : isCustom ? siblings.filter((n) => n.isCustom).length + 1 : primaryIndex;
    const title = parent
      ? `Sub-Node ${subIndex}: ${stripPrefix(prompt)}`
      : isCustom
        ? prompt.trim() || `Note ${index}`
        : `Node ${primaryIndex}: ${stripPrefix(prompt)}`;
    const { text, prompts } = composeConcept(stripPrefix(prompt), { sub: Boolean(parent) });
    const fallbackColor = parent?.color
      ? parent.color
      : CARD_COLORS[state.nodes.length % CARD_COLORS.length];
    const resolvedColor = color || (parent?.color ? parent.color : fallbackColor);
    const node = {
      id: uid("node"),
      workspaceId: ws,
      parentId,
      x: Math.round(x ?? 0),
      y: Math.round(y ?? 0),
      width,
      height,
      color: resolvedColor,
      isCustom,
      prompt: title,
      text: isCustom ? "" : text,
      prompts: isCustom ? [] : prompts,
      status: "ready",
      versionIndex: 0,
      versions: [{ prompt: title, text: isCustom ? "" : text, prompts: isCustom ? [] : prompts }],
      tags: [],
      images: [],
      internalPadding: 20,
      isLabelHidden: false,
      fontFamily: fontFamily || parent?.fontFamily || "Space Grotesk",
      fontSize: fontSize || parent?.fontSize || "14px",
      textColor: textColor || parent?.textColor || "#0e0d33",
      fontBold: fontBold !== undefined ? Boolean(fontBold) : false,
      fontItalic: fontItalic !== undefined ? Boolean(fontItalic) : false,
    };
    const links = parent
      ? [...state.links, { id: uid("link"), workspaceId: ws, sourceId: parent.id, targetId: node.id }]
      : state.links;
    apply({ ...state, nodes: [...state.nodes, node], links }, { record });
    return node;
  },
  applyLayout(layout) {
    const next = layout || {};
    apply({
      ...state,
      nodes: state.nodes.map((n) => (next[n.id] ? { ...n, x: next[n.id].x, y: next[n.id].y } : n)),
    });
  },
  updateNode(id, patch, { record = true } = {}) {
    const cleanPatch = { ...patch };
    if (cleanPatch.color) {
      cleanPatch.color = ensureLightDecentColor(cleanPatch.color);
    }
    apply(
      { ...state, nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...cleanPatch } : n)) },
      { record }
    );
  },
  deleteNode(id) {
    const doomed = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of state.nodes) {
        if (n.parentId && doomed.has(n.parentId) && !doomed.has(n.id)) {
          doomed.add(n.id);
          grew = true;
        }
      }
    }
    apply({
      ...state,
      nodes: state.nodes.filter((n) => !doomed.has(n.id)),
      links: state.links.filter((l) => !doomed.has(l.sourceId) && !doomed.has(l.targetId)),
      stickies: state.stickies,
    });
  },
  addNodeImage(id, image, { max = 6 } = {}) {
    const node = this.node(id);
    if (!node) return false;
    const images = node.images || [];
    if (images.length >= max) return false;
    this.updateNode(id, { images: [...images, image] });
    return true;
  },
  removeNodeImage(id, imageId) {
    const node = this.node(id);
    if (!node) return;
    this.updateNode(id, { images: (node.images || []).filter((img) => img.id !== imageId) });
  },
  addTag(id, tag) {
    const clean = tag.trim();
    if (!clean) return;
    const node = state.nodes.find((n) => n.id === id);
    if (!node || node.tags.includes(clean)) return;
    this.updateNode(id, { tags: [...node.tags, clean] });
  },
  removeTag(id, tag) {
    const node = state.nodes.find((n) => n.id === id);
    if (!node) return;
    this.updateNode(id, { tags: node.tags.filter((t) => t !== tag) });
  },
  regenerateNode(id) {
    const node = this.node(id);
    if (!node) return;
    const { text, prompts } = composeConcept(node.prompt.replace(/^(Sub-)?Node \d+:\s*/, ""), {
      sub: Boolean(node.parentId),
    });
    const version = { prompt: node.prompt, text, prompts };
    this.updateNode(id, {
      text,
      prompts,
      status: "ready",
      versions: [...node.versions, version],
      versionIndex: node.versions.length,
    });
  },
  stepVersion(id, delta) {
    const node = this.node(id);
    if (!node || node.versions.length < 2) return;
    const index = Math.min(node.versions.length - 1, Math.max(0, node.versionIndex + delta));
    const v = node.versions[index];
    this.updateNode(id, { versionIndex: index, text: v.text, prompts: v.prompts });
  },
  addLink(sourceId, targetId) {
    if (sourceId === targetId) return;
    if (state.links.some((l) => l.sourceId === sourceId && l.targetId === targetId)) return;
    apply({ ...state, links: [...state.links, { id: uid("link"), workspaceId: state.activeWorkspaceId, sourceId, targetId }] });
  },
  updateLink(id, patch) {
    apply({
      ...state,
      links: state.links.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    });
  },
  removeLink(id) {
    apply({ ...state, links: state.links.filter((l) => l.id !== id) });
  },

  // --- sticky memos ---------------------------------------------------------
  createSticky({ x, y, text = "", color } = {}) {
    const index = this.stickies().length;
    const sticky = {
      id: uid("sticky"),
      workspaceId: state.activeWorkspaceId,
      x: Math.round(x ?? 0),
      y: Math.round(y ?? 0),
      width: 260,
      height: 220,
      text,
      color: color || STICKY_COLORS[index % STICKY_COLORS.length],
      createdAt: Date.now(),
    };
    apply({ ...state, stickies: [...state.stickies, sticky] });
    return sticky;
  },
  updateSticky(id, patch, { record = true } = {}) {
    apply(
      { ...state, stickies: state.stickies.map((s) => (s.id === id ? { ...s, ...patch } : s)) },
      { record }
    );
  },
  deleteSticky(id) {
    apply({ ...state, stickies: state.stickies.filter((s) => s.id !== id) });
  },

  // --- camera & search ------------------------------------------------------
  setTransform(transform, { record = false } = {}) {
    state = {
      ...state,
      transform,
      workspaces: state.workspaces.map((w) => (w.id === state.activeWorkspaceId ? { ...w, transform: { ...transform } } : w)),
    };
    persistence.writeState(state);
    if (record) {
      past.push(snapshot());
      if (past.length > 60) past.shift();
    }
    emit();
  },
  recordSearch(topic) {
    const clean = topic.trim();
    if (!clean) return;
    const searchHistory = [clean, ...state.searchHistory.filter((t) => t !== clean)].slice(0, 8);
    apply({ ...state, searchHistory });
  },

  // --- suggested features & duplicate node ---------------------------------
  duplicateNode(id) {
    const src = this.node(id);
    if (!src) return null;
    const copy = {
      ...structuredClone(src),
      id: uid("node"),
      prompt: `${src.prompt} (Copy)`,
      x: src.x + 40,
      y: src.y + 40,
      parentId: src.parentId,
    };
    apply({ ...state, nodes: [...state.nodes, copy] });
    return copy;
  },

  // --- suggested existing nodes & hierarchy inspection ----------------------
  suggestExistingNodes(nodeId) {
    const current = this.node(nodeId);
    if (!current) return [];
    const ws = current.workspaceId;
    const allNodes = this.nodes(ws);
    const currentLinks = this.links(ws);

    // Collect directly connected nodes (parent, children, and direct links)
    const connectedIds = new Set();
    connectedIds.add(nodeId);
    if (current.parentId) connectedIds.add(current.parentId);
    for (const n of allNodes) {
      if (n.parentId === nodeId) connectedIds.add(n.id);
    }
    for (const l of currentLinks) {
      if (l.sourceId === nodeId) connectedIds.add(l.targetId);
      if (l.targetId === nodeId) connectedIds.add(l.sourceId);
    }

    const candidates = allNodes.filter((n) => !connectedIds.has(n.id));
    if (!candidates.length) return [];

    const currentWords = new Set(
      (current.prompt || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2)
    );
    const currentTags = new Set((current.tags || []).map((t) => t.toLowerCase()));

    const scored = candidates.map((cand) => {
      let score = 1;
      let reason = "Workspace concept";
      const candTags = (cand.tags || []).map((t) => t.toLowerCase());
      const sharedTags = candTags.filter((t) => currentTags.has(t));
      if (sharedTags.length > 0) {
        score += sharedTags.length * 4;
        reason = `Shared #${sharedTags[0]}`;
      }
      const candWords = (cand.prompt || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
      const sharedWords = candWords.filter((w) => currentWords.has(w));
      if (sharedWords.length > 0) {
        score += sharedWords.length * 2;
        if (sharedTags.length === 0) reason = `Topic: "${sharedWords[0]}"`;
      }
      if (Boolean(cand.parentId) === Boolean(current.parentId)) {
        score += 1;
      }
      return { node: cand, id: cand.id, prompt: cand.prompt, score, reason };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored;
  },

  getNodeHierarchy(nodeId) {
    const current = this.node(nodeId);
    if (!current) return null;
    const ws = current.workspaceId;
    const allNodes = this.nodes(ws);
    const allLinks = this.links(ws);
    const byId = new Map(allNodes.map((n) => [n.id, n]));

    // 1. Ancestors chain up to root parent
    const ancestors = [];
    let curr = current;
    const visitedAncestors = new Set([nodeId]);
    const ANCESTOR_PALETTE = ["#f59e0b", "#fb923c", "#f97316", "#eab308", "#d97706"];
    const chain = [];
    while (curr.parentId && byId.has(curr.parentId) && !visitedAncestors.has(curr.parentId)) {
      const p = byId.get(curr.parentId);
      visitedAncestors.add(p.id);
      chain.push(p);
      curr = p;
    }
    for (let i = chain.length - 1; i >= 0; i--) {
      const p = chain[i];
      const isRoot = i === chain.length - 1;
      const isDirect = i === 0;
      const relLabel = isRoot ? "Root Parent" : isDirect ? "Parent" : `Ancestor L${chain.length - i}`;
      const color = p.color || ANCESTOR_PALETTE[(chain.length - 1 - i) % ANCESTOR_PALETTE.length];
      const badgeColor = ANCESTOR_PALETTE[(chain.length - 1 - i) % ANCESTOR_PALETTE.length];
      ancestors.push({
        node: p,
        rel: relLabel,
        depth: chain.length - i,
        color,
        badgeColor,
      });
    }

    // 2. Sub-nodes: traverse every sub-node in hierarchy assigning distinct colors
    const SUB_PALETTE = [
      "#10b981", // Emerald
      "#06b6d4", // Cyan
      "#8b5cf6", // Violet
      "#ec4899", // Pink
      "#3b82f6", // Blue
      "#14b8a6", // Teal
      "#f43f5e", // Rose
      "#a855f7", // Purple
      "#eab308", // Amber
      "#84cc16", // Lime
      "#6366f1", // Indigo
      "#0ea5e9", // Sky
    ];

    const subNodes = [];
    const queue = [{ id: nodeId, depth: 1 }];
    const visitedSub = new Set([nodeId]);
    let colorIdx = 0;
    while (queue.length > 0) {
      const currentLevel = queue.shift();
      const children = allNodes.filter((n) => n.parentId === currentLevel.id && !visitedSub.has(n.id));
      for (const child of children) {
        visitedSub.add(child.id);
        const paletteCol = SUB_PALETTE[colorIdx % SUB_PALETTE.length];
        subNodes.push({
          node: child,
          rel: currentLevel.depth === 1 ? "Sub-Node" : `Sub-Node L${currentLevel.depth}`,
          depth: currentLevel.depth,
          color: child.color || paletteCol,
          badgeColor: paletteCol,
        });
        colorIdx++;
        queue.push({ id: child.id, depth: currentLevel.depth + 1 });
      }
    }

    // 3. Direct links (other relationships outside parent hierarchy or descendants)
    const linked = [];
    const descendantIds = new Set(subNodes.map((s) => s.node.id));
    const ancestorIds = new Set(ancestors.map((a) => a.node.id));
    for (const l of allLinks) {
      let otherId = null;
      if (l.sourceId === nodeId) otherId = l.targetId;
      else if (l.targetId === nodeId) otherId = l.sourceId;
      if (otherId && byId.has(otherId) && !descendantIds.has(otherId) && !ancestorIds.has(otherId)) {
        if (!linked.some((item) => item.node.id === otherId)) {
          linked.push({
            node: byId.get(otherId),
            rel: "Linked",
            linkId: l.id,
            badgeColor: "#38bdf8",
          });
        }
      }
    }

    return {
      current,
      ancestors,
      subNodes,
      linked,
    };
  },

  connectExistingAsSubNode(parentId, targetId) {
    if (!parentId || !targetId || parentId === targetId) return false;
    const parent = this.node(parentId);
    const target = this.node(targetId);
    if (!parent || !target) return false;

    // Cycle detection: ensure targetId is not an ancestor of parentId
    let curr = parent;
    while (curr && curr.parentId) {
      if (curr.parentId === targetId) {
        console.warn("Cannot connect as sub-node: would create a circular hierarchy loop");
        return false;
      }
      curr = this.node(curr.parentId);
    }

    const ws = parent.workspaceId;
    const nodes = state.nodes.map((n) => (n.id === targetId ? { ...n, parentId } : n));
    let links = state.links;
    const exists = links.some(
      (l) => (l.sourceId === parentId && l.targetId === targetId) || (l.sourceId === targetId && l.targetId === parentId)
    );
    if (!exists) {
      links = [...links, { id: uid("link"), workspaceId: ws, sourceId: parentId, targetId }];
    }

    apply({ ...state, nodes, links });
    return true;
  },

  connectExistingNodes(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return false;
    const exists = state.links.some(
      (l) => (l.sourceId === sourceId && l.targetId === targetId) || (l.sourceId === targetId && l.targetId === sourceId)
    );
    if (exists) return false;
    apply({
      ...state,
      links: [...state.links, { id: uid("link"), workspaceId: state.activeWorkspaceId, sourceId, targetId }],
    });
    return true;
  },

  // --- remote database mirror & sync ----------------------------------------
  subscribeDb(fn) {
    dbListeners.add(fn);
    fn(dbSyncStatus);
    return () => dbListeners.delete(fn);
  },
  get dbStatus() {
    return dbSyncStatus;
  },
  async saveToDatabase() {
    dbSyncStatus = "syncing";
    emitDb();
    try {
      persistence.writeState(state); // Ensure local DB is updated
      const res = await persistence.pushRemote(snapshot());
      dbSyncStatus = "synced";
      emitDb();
      return res;
    } catch (err) {
      dbSyncStatus = "error";
      emitDb();
      throw err;
    }
  },
  async syncFromDatabase() {
    dbSyncStatus = "syncing";
    emitDb();
    try {
      const remote = await persistence.fetchRemote();
      const snap = remote.snapshot || remote;
      if (snap && snap.workspaces && snap.workspaces.length) {
        const next = normalize(snap);
        apply(next, { syncRemote: false });
      }
      dbSyncStatus = "synced";
      emitDb();
      return snap;
    } catch (err) {
      dbSyncStatus = "error";
      emitDb();
      throw err;
    }
  },
  async initRemoteSync() {
    try {
      const remote = await persistence.fetchRemote();
      const snap = remote.snapshot || remote;
      if (snap && Array.isArray(snap.workspaces) && snap.workspaces.length > 0) {
        const localNodes = state.nodes.length;
        const remoteNodes = (snap.nodes || []).length;
        // If local is empty but remote database has saved notes, hydrate from database!
        if (localNodes === 0 && remoteNodes > 0) {
          const next = normalize(snap);
          apply(next, { record: false });
          dbSyncStatus = "synced";
          emitDb();
          return { loaded: "remote", count: remoteNodes };
        }
        dbSyncStatus = "synced";
        emitDb();
        return { loaded: "local", count: localNodes };
      }
    } catch (err) {
      console.warn("Initial database sync check:", err?.message || err);
      dbSyncStatus = "offline";
      emitDb();
    }
    return null;
  },
  async databaseStatus() {
    return persistence.statusRemote();
  },
};

function stripPrefix(prompt) {
  return String(prompt || "").replace(/^(Sub-)?Node \d+:\s*/i, "").trim();
}

export { makeWorkspace };
