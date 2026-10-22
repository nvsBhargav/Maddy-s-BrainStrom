// App bootstrap: hydrate icons, build the canvas engine and UI shell, start routing.
import { store } from "./store.js";
import { CanvasView } from "./canvas.js";
import { UI } from "./ui.js";
import { icon } from "./icons.js";
import { composeConcept, glossaryDef, VOCABULARY } from "./content.js";
import { Tree3DView } from "./tree3d.js";
import { LandingPage } from "./landing.js";
import { sfx } from "./sfx.js";
import { CommandPalette } from "./palette.js";

function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll("[data-icon]")) {
    const size = Number(el.dataset.size || 17);
    el.innerHTML = icon(el.dataset.icon, size);
  }
}

function toast(message) {
  const host = document.querySelector("#toasts");
  if (!host) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .25s";
    setTimeout(() => el.remove(), 260);
  }, 2600);
}

hydrateIcons();

// Surface local-storage failures instead of silently dropping edits.
let storageWarned = false;
window.addEventListener("brainvault:storage-full", () => {
  if (storageWarned) return;
  storageWarned = true;
  toast("Browser storage is full — remove a card image or export a backup. Recent edits may not be saved.");
  setTimeout(() => (storageWarned = false), 15000);
});

const canvasRoot = document.querySelector("#canvas");
const canvas = new CanvasView({
  root: canvasRoot,
  store,
  toast,
  onTerm: (term, parentId) => {
    const parent = store.node(parentId);
    if (!parent) return;
    const existing = store.nodes().find((n) => n.parentId === parent.id && n.prompt.endsWith(`: ${term}`));
    if (existing) {
      canvas.select(existing.id);
      canvas.centerOn(existing);
      toast(`Focused “${term}” branch.`);
      return;
    }
    const siblings = store.nodes().filter((n) => n.parentId === parent.id).length;
    const cardWidth = Math.max(760, parent.width || 760);
    const cardHeight = Math.max(580, parent.height || 580);
    const node = store.createNode({
      prompt: term,
      parentId: parent.id,
      x: parent.x + (parent.width || 760) + 140,
      y: parent.y + siblings * (cardHeight + 40),
      width: cardWidth,
      height: cardHeight,
    });
    const def = glossaryDef(term);
    const concept = composeConcept(term, { sub: true });
    store.updateNode(node.id, {
      text: `${concept.text}\n\n**Dictionary — ${def.term}**\n\n${def.definition}\n\n*Frame of use:* ${def.frame}`,
    });
    canvas.select(node.id);
    canvas.centerOn(node);
    toast(`Dictionary branch “${term}” opened.`);
  },
});

const tree3d = new Tree3DView({ store, canvas, toast });
window.tree3d = tree3d;
window.store = store;
window.canvas = canvas;
window.sfx = sfx;
const ui = new UI({ store, canvas, toast, tree3d });
window.ui = ui;
const palette = new CommandPalette({ store, canvas, ui, sfx, toast });
window.palette = palette;
ui.palette = palette;
const landingPage = new LandingPage({ ui, store, canvas, toast });
ui.landingPage = landingPage;
window.landingPage = landingPage;
window.brainApp = { store, canvas, ui, tree3d, landingPage, palette, sfx };
canvas.onTag = (id) => ui.askTag(id);

// Sync SFX UI button indicator
function syncSfxBtn() {
  const btn = document.querySelector("#sfxToggleBtn");
  if (!btn) return;
  const isOn = sfx.enabled;
  btn.classList.toggle("is-active", isOn);
  const badge = btn.querySelector(".sfx-status-badge");
  if (badge) badge.textContent = isOn ? "ON" : "MUTED";
}
syncSfxBtn();
window.addEventListener("brainvault:sfx-toggled", syncSfxBtn);

// Term bank is also reachable from the canvas toolbar; keep the count honest in the footer.
store.subscribe(() => {
  const term = document.querySelector("#termWorkspace");
  if (term) term.textContent = store.activeWorkspace()?.name || "Workspace";
});

ui.route();
hydrateIcons();
void VOCABULARY;

if (!store.nodes().length) {
  // First run: keep the hero framed nicely in the viewport.
  canvas.setTransform({ x: 0, y: 70, scale: 0.85 }, false);
  store.persist();
}
canvas.render();

// Register Progressive Web App Service Worker for sub-50ms offline loads
if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      // console.log("BrainVault ServiceWorker registered:", reg.scope);
    }).catch((err) => {
      console.warn("ServiceWorker registration failed:", err);
    });
  });
}

// Check SQLite backend database on boot and hydrate if remote has data
store.initRemoteSync?.().then((res) => {
  if (res?.loaded === "remote") {
    canvas.render();
    toast(`Loaded ${res.count} notes from SQLite database.`);
  }
});
