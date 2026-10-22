// Canvas engine: camera, cards, sticky memos, links, selection, radar.
import { icon } from "./icons.js";
import { CARD_COLORS, LIGHT_PASTEL_PALETTE, STICKY_COLORS, isLightColor, ensureLightDecentColor, getSavedCustomColors, saveCustomColor, removeCustomColor } from "./store.js";
import { compressImage, formatBytes, MAX_IMAGE_BYTES } from "./images.js";

const MIN_SCALE = 0.15;
const MAX_SCALE = 2;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export class CanvasView {
  constructor({ root, store, onTerm, toast }) {
    this.root = root;
    this.store = store;
    this.onTerm = onTerm;
    this.toast = toast;
    this.stage = root.querySelector("#stage");
    this.links = root.querySelector("#links");
    this.hero = root.querySelector("#hero") || null;
    this.pill = root.querySelector("#selectionPill");
    this.radar = root.querySelector("#radar");
    this.radarMap = root.querySelector("#radarMap");
    this.zoomLabel = root.querySelector("#zoomLabel");
    this.selected = new Set();
    this._animatedCardIds = new Set();
    this.forceShowHero = false;
    this._glowTimeout = null;
    this.editingId = null;
    this.editingStickyId = null;
    this.linkFrom = null;
    this.lastSig = "";
    this.gesture = null;
    this.pendingImageNode = null;
    this.setupImageInput();
    this.attach();
    this.activePaletteNodeId = null;
    this.store.subscribe(() => {
      if (this.activePaletteNodeId) return;
      this.render();
    });
    this.render();
  }

  get camera() {
    return this.store.state.transform;
  }

  workspaceNodes() {
    return this.store.nodes();
  }

  setupImageInput() {
    this.fileInput = document.createElement("input");
    this.fileInput.type = "file";
    this.fileInput.accept = "image/*";
    this.fileInput.multiple = true;
    this.fileInput.hidden = true;
    this.fileInput.addEventListener("change", () => this.ingestImages());
    document.body.appendChild(this.fileInput);
  }

  requestImage(id) {
    const node = this.store.node(id);
    if (!node) return;
    if ((node.images || []).length >= 6) {
      this.toast?.("This card already holds 6 images — remove one first.");
      return;
    }
    this.pendingImageNode = id;
    this.fileInput.value = "";
    this.fileInput.click();
  }

  async ingestImages() {
    const id = this.pendingImageNode;
    this.pendingImageNode = null;
    const files = [...(this.fileInput.files || [])];
    if (!id || !files.length) return;
    const node = this.store.node(id);
    if (!node) return;
    const room = Math.max(0, 6 - (node.images || []).length);
    const batch = files.slice(0, room);
    if (files.length > room) this.toast?.(`Only ${room} more image${room === 1 ? "" : "s"} fit on this card.`);
    let added = 0;
    for (const file of batch) {
      try {
        const image = await compressImage(file);
        if (!this.store.addNodeImage(id, image)) break;
        added++;
      } catch (err) {
        this.toast?.(`${file.name}: ${err.message}`);
      }
    }
    if (added) {
      const current = this.store.node(id);
      const stored = (current?.images || []).reduce((sum, img) => sum + (img.bytes || 0), 0);
      const needed = 340 + Math.ceil((current?.images || []).length / 2) * 103;
      if (current && current.height < needed) this.store.updateNode(id, { height: Math.min(900, needed) });
      this.toast?.(`Attached ${added} image${added === 1 ? "" : "s"} · ${formatBytes(stored)} on card (100 KB cap each).`);
    }
  }

  insertBlock(id, kind) {
    const node = this.store.node(id);
    if (!node) return;
    const snippet =
      kind === "table"
        ? "\n\n| Column | Detail |\n| --- | --- |\n| Item | Value |\n| Item | Value |\n"
        : "\n\n```js\n// code block\nconst secure = true;\nconsole.log(secure);\n```\n";
    const text = `${(node.text || "").replace(/\s+$/, "")}${snippet}`;
    this.store.updateNode(id, { text });
    this.beginEdit(id);
    const area = this.stage.querySelector(`.card[data-id="${id}"] .card-textarea`);
    if (area) {
      area.focus();
      area.setSelectionRange(area.value.length, area.value.length);
      area.scrollTop = area.scrollHeight;
    }
  }

  openImage(nodeId, index) {
    const node = this.store.node(nodeId);
    const image = node?.images?.[index];
    if (!image) return;
    const overlay = document.createElement("div");
    overlay.className = "image-lightbox";
    overlay.innerHTML = `<figure><img src="${image.dataUrl}" alt="${escapeAttr(image.name)}"><figcaption>${escapeHtml(image.name)} · ${formatBytes(image.bytes || 0)} · ${image.width}×${image.height}</figcaption></figure>`;
    overlay.addEventListener("click", () => overlay.remove());
    document.body.appendChild(overlay);
  }

  // --- rendering ------------------------------------------------------------
  render() {
    const ws = this.store.state.activeWorkspaceId;
    const nodes = this.store.nodes(ws);
    const stickies = this.store.stickies(ws);
    const links = this.store.links(ws);
    const sig = JSON.stringify({
      ws,
      nodes: nodes.map((n) => ({ ...n, versions: n.versions.length })),
      stickies,
      links,
      editing: this.editingId,
      editingSticky: this.editingStickyId,
      linkFrom: this.linkFrom,
    });
    if (sig !== this.lastSig) {
      this.lastSig = sig;
      for (const id of [...this.selected]) if (!nodes.some((n) => n.id === id)) this.selected.delete(id);
      this.stage.innerHTML =
        `<svg class="links">${this.renderLinks(nodes, links)}</svg>` +
        nodes.map((n) => this.renderCard(n, nodes)).join("") +
        stickies.map((s, i) => this.renderSticky(s, i)).join("");
      this.links = this.stage.querySelector("svg.links");
      if (this.hero) this.hero.classList.toggle("is-hidden", !this.forceShowHero && (nodes.length + stickies.length > 0));
      this.renderPill();
      this.markSelection();
      this.animateCardsEntrance();
    }
    this.applyCamera();
    this.renderRadar();
  }

  applyCamera() {
    const { x, y, scale } = this.camera;
    this.stage.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    if (this._lastScale !== scale) {
      this._lastScale = scale;
      const pct = `${Math.round(scale * 100)}%`;
      if (this.zoomLabel) this.zoomLabel.textContent = pct;
      for (const el of this.stage.querySelectorAll(".tool-zoom")) {
        el.textContent = pct;
      }
    }
    this.root.style.setProperty("--shadow", `${this.store.activeWorkspace()?.shadow ?? 75}%`);
  }

  renderRadarThrottled() {
    if (this._radarRaf) return;
    this._radarRaf = requestAnimationFrame(() => {
      this._radarRaf = null;
      this.renderRadar();
    });
  }

  renderLinks(nodes, links) {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const paths = [];
    const markers = new Map();
    const SUB_PALETTE = ["#10b981", "#06b6d4", "#8b5cf6", "#ec4899", "#3b82f6", "#14b8a6", "#f43f5e", "#a855f7", "#eab308", "#84cc16"];

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const a = byId.get(link.sourceId);
      const b = byId.get(link.targetId);
      const aH = a.hideContent ? 120 : (a.height || 580);
      const bH = b.hideContent ? 120 : (b.height || 580);
      const x1 = a.x + a.width;
      const y1 = a.y + aH / 2;
      const x2 = b.x;
      const y2 = b.y + bH / 2;
      const bend = Math.max(60, Math.abs(x2 - x1) * 0.45);

      const isParentChild = b.parentId === a.id;
      const isSelected = this.selected.has(a.id) || this.selected.has(b.id);

      let strokeColor = link.color || "#22d3ee";
      if (!link.color) {
        if (isParentChild) {
          strokeColor = b.color || SUB_PALETTE[i % SUB_PALETTE.length];
        } else {
          strokeColor = SUB_PALETTE[(i + 3) % SUB_PALETTE.length];
        }
      }

      const markerId = `arrow-${link.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      markers.set(markerId, strokeColor);

      const strokeWidth = isSelected ? 3.5 : 2.2;
      const opacity = isSelected ? 1 : 0.85;

      let dashArrayAttr = "";
      if (link.pattern === "dashed") dashArrayAttr = 'stroke-dasharray="8 6"';
      else if (link.pattern === "dotted") dashArrayAttr = 'stroke-dasharray="3 5"';
      else if (link.pattern === "dash-dot") dashArrayAttr = 'stroke-dasharray="10 4 2 4"';

      const pathD = `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`;
      paths.push(
        `<path class="link ${isSelected ? "is-selected-link electric-conduit" : ""}" data-link="${link.id}" d="${pathD}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-opacity="${opacity}" ${dashArrayAttr} marker-end="url(#${markerId})" style="filter: drop-shadow(0 0 ${isSelected ? "10px" : "3.5px"} ${strokeColor}); cursor: pointer;" title="Click or double-click to customize line color and pattern"/>`,
        `<circle class="link-dot" cx="${(x1 + x2) / 2}" cy="${(y1 + y2) / 2}" r="${isSelected ? 6 : 5}" fill="${strokeColor}" stroke="#ffffff" stroke-width="1.5" data-link="${link.id}" data-link-dot="${link.id}" style="cursor: pointer;" title="Click to customize connection color & pattern (Alt+Click to disconnect)"/>`
      );

      // Electric Conduit Pulse: luminous energy particle traveling along the bezier curve
      if (isSelected || isParentChild) {
        const pulseDur = isSelected ? "1.4s" : "2.6s";
        const pulseR = isSelected ? "4.5" : "3.5";
        const pulseColor = isSelected ? "#00ff66" : strokeColor;
        paths.push(
          `<circle class="electric-pulse-particle" r="${pulseR}" fill="#ffffff" style="filter: drop-shadow(0 0 6px ${pulseColor}) drop-shadow(0 0 14px #ffffff); pointer-events: none;">
            <animateMotion dur="${pulseDur}" repeatCount="indefinite" path="${pathD}" />
          </circle>`
        );
      }
    }

    const defsMarkers = Array.from(markers.entries())
      .map(([id, col]) => `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${col}"/></marker>`)
      .join("");

    return `<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#22d3ee"/></marker>${defsMarkers}</defs>${paths.join("")}`;
  }

  renderCard(n, nodes) {
    const selected = this.selected.has(n.id);
    const index = nodes.filter((x) => !x.parentId).indexOf(n) + 1;
    const children = n.prompts || [];
    const w = n.width;
    const h = n.height;
    const editing = this.editingId === n.id;
    const version = `${n.versionIndex + 1}/${n.versions.length}`;
    const images = n.images || [];
    const gallery = images
      .map(
        (img, i) => `<figure class="card-shot">
          <img src="${img.dataUrl}" alt="${escapeAttr(img.name)}" loading="lazy" data-shot-index="${i}" data-shot-node="${n.id}" onerror="this.style.opacity='0.35';this.title='Image could not be loaded';">
          <button class="shot-remove" data-action="remove-image" data-image="${escapeAttr(img.id)}" title="Remove image" aria-label="Remove image">×</button>
        </figure>`
      )
      .join("");
    const kind = n.parentId ? "SUB-NODE" : "NODE";
    const tagChips = (n.tags || [])
      .map((t) => `<button class="tag" data-untag="${escapeAttr(t)}" title="Remove tag">${escapeHtml(t)} ×</button>`)
      .join("");
    const branches = children
      .map(
        (p) => `<button class="branch" data-branch="${escapeAttr(p)}" title="Open branch: ${escapeAttr(p)}">
          <span class="branch-kicker">SUB-NODE BRANCH</span>
          <span class="branch-title">${escapeHtml(p)}</span>
          ${icon("chevron", 12)}
        </button>`
      )
      .join("");

    const hierarchy = this.store.getNodeHierarchy?.(n.id) || { ancestors: [], subNodes: [], linked: [] };
    const suggestions = this.store.suggestExistingNodes?.(n.id) || [];

    const ancestorChips = hierarchy.ancestors
      .map(
        (a) => `<button class="h-chip ancestor" data-focus-node="${a.node.id}" title="Focus ${a.rel}: ${escapeAttr(a.node.prompt)}" style="--chip-col:${a.badgeColor};">
          <span class="chip-dot" style="background:${a.badgeColor}"></span>
          <span class="chip-rel">${a.rel}:</span>
          <span class="chip-name">${escapeHtml(a.node.prompt)}</span>
        </button>`
      )
      .join("");

    const subNodeChips = hierarchy.subNodes
      .map(
        (s) => `<button class="h-chip subnode" data-focus-node="${s.node.id}" title="Focus Sub-Node: ${escapeAttr(s.node.prompt)}" style="--chip-col:${s.badgeColor}; border-color:${s.badgeColor};">
          <span class="chip-dot" style="background:${s.badgeColor}"></span>
          <span class="chip-rel" style="color:${s.badgeColor}">${s.rel}:</span>
          <span class="chip-name">${escapeHtml(s.node.prompt)}</span>
        </button>`
      )
      .join("");

    const linkedChips = hierarchy.linked
      .map(
        (l) => `<button class="h-chip linked" data-focus-node="${l.node.id}" title="Focus Linked Node: ${escapeAttr(l.node.prompt)}" style="--chip-col:${l.badgeColor};">
          <span class="chip-dot" style="background:${l.badgeColor}"></span>
          <span class="chip-rel">Link:</span>
          <span class="chip-name">${escapeHtml(l.node.prompt)}</span>
        </button>`
      )
      .join("");

    const suggestChips = suggestions
      .slice(0, 3)
      .map(
        (sug) => `<button class="h-chip suggest-quick" data-connect-suggest="${sug.node.id}" data-for-node="${n.id}" title="Connect existing node (${sug.reason}): ${escapeAttr(sug.node.prompt)}" style="--chip-col:${sug.node.color || '#38bdf8'};">
          <span class="chip-plus">+</span>
          <span class="chip-rel">Suggest:</span>
          <span class="chip-name">${escapeHtml(sug.node.prompt)}</span>
        </button>`
      )
      .join("");

    const hierarchyRow = `
      <div class="card-hierarchy" aria-label="Connected hierarchy and suggested nodes">
        ${ancestorChips ? `<div class="h-group h-lineage-row"><span class="h-kicker h-label">PARENT PATH:</span>${ancestorChips}</div>` : ""}
        ${subNodeChips ? `<div class="h-group h-subnodes-row"><span class="h-kicker h-label">SUB-NODES (${hierarchy.subNodes.length}):</span>${subNodeChips}</div>` : ""}
        ${linkedChips ? `<div class="h-group h-linked-row"><span class="h-kicker h-label">LINKED (${hierarchy.linked.length}):</span>${linkedChips}</div>` : ""}
        <div class="h-group suggestions-group">
          <span class="h-kicker h-label">SUGGESTED:</span>
          ${suggestChips}
          <button class="h-chip suggest-btn suggest-more-btn" data-action="suggest-modal" data-node-id="${n.id}" title="Browse and connect existing nodes">+ Connect Existing (${suggestions.length})</button>
        </div>
      </div>
    `;

    return `<article class="card ${selected ? "is-selected" : ""} ${editing ? "is-editing" : ""} ${n.hideContent ? "is-content-hidden" : ""}"
      data-id="${n.id}" style="left:${n.x}px;top:${n.y}px;width:${w}px;${n.hideContent ? "height:auto;min-height:120px;" : `height:${h}px;`}--card:${n.color};--pad:${n.internalPadding ?? 20}px">
      <div class="card-toolbar ${selected ? "is-toolbar-visible" : ""}" role="toolbar" aria-label="Node actions">
        <button data-action="color-palette" data-node-id="${n.id}" class="tool-dot" style="--dot:${n.color}" title="Card colour: ${n.color} (Click to open palette)">
          <span class="tool-dot-swatch" style="background:${n.color}"></span>
        </button>
        <button data-action="color-palette" data-node-id="${n.id}" class="tool-color-btn" title="Change Card Colour & Open Palette">
          ${icon("palette", 14)} <span class="tool-color-txt">COLOR</span>
        </button>
        <button data-action="toggle-content" data-node-id="${n.id}" class="tool-toggle-content-btn" title="${n.hideContent ? "Show full card data & notes" : "Hide card data & notes"}">
          ${icon(n.hideContent ? "eye" : "eyeOff", 14)} <span>${n.hideContent ? "Show Content" : "Hide Content"}</span>
        </button>
        <button data-action="audio-brief" data-node-id="${n.id}" class="tool-listen-btn" title="🌸 Listen to Card Audio Description (Smooth & Cute Voice)">
          🌸 <span>Listen</span>
        </button>
        <span class="tool-chip">${kind} ${n.parentId ? "2.0" : `${index}.0`}</span>
        <span class="tool-zoom">${Math.round(this.camera.scale * 100)}%</span>
        <span class="tool-sep"></span>
        <button data-action="prev" title="Previous version" ${n.versionIndex <= 0 ? "disabled" : ""}>‹</button>
        <span class="tool-version">${version}</span>
        <button data-action="next" title="Next version" ${n.versionIndex >= n.versions.length - 1 ? "disabled" : ""}>›</button>
        <button data-action="child" title="New child node">${icon("plus", 14)}</button>
        <button data-action="regen" title="Regenerate">${icon("sparkles", 14)}</button>
        <button data-action="link" title="Link to another node" class="${this.linkFrom === n.id ? "is-armed" : ""}">${icon("link", 14)}</button>
        <button data-action="delete" class="danger" title="Delete node">${icon("x", 14)}</button>
      </div>
      <div class="card-inner">
        <div class="card-head">
          <span class="card-kind">${kind}</span>
          <span class="card-serial">${n.parentId ? "2" : index}.0</span>
          <span class="card-spacer"></span>
          <button class="chip-btn accent-btn-color card-change-color-btn" data-action="color-palette" data-node-id="${n.id}" title="Change Card Colour & Open Palette">
            <span class="color-chip-circle" style="background:${n.color || '#e0f2fe'}"></span>
            ${icon("palette", 12)} COLOR
          </button>
          <button class="chip-btn accent-btn-emerald card-add-child-btn" data-action="child" data-node-id="${n.id}" title="+ Create child node from this card (same color & connected electric link)">
            ${icon("plus", 12)} + CHILD
          </button>
          <button class="chip-btn accent-btn-cyan card-listen-voice-btn" data-action="audio-brief" data-node-id="${n.id}" title="🌸 Listen to Audio Description (Smooth & Cute Voice)">${icon("headphones", 12)} LISTEN 🌸</button>
          <button class="chip-btn accent-btn-indigo" data-action="save-gdocs" title="Save this card to Google Docs / Google Drive">${icon("download", 11)} GDOCS</button>
          <button class="chip-btn accent-btn-violet" data-action="clone" title="Duplicate card">${icon("layers", 11)} CLONE</button>
          <button class="chip-btn accent-btn-amber" data-action="copy" title="Copy text">${icon("copy", 12)} COPY</button>
        </div>
        <h2 class="card-title">${escapeHtml(n.prompt)}</h2>
        ${
          n.hideContent
            ? `<div class="card-collapsed-notice" data-action="toggle-content" title="Click to reveal full card data">
                <span class="collapsed-icon">${icon("eye", 15)}</span>
                <strong>Card content hidden</strong>
                <span class="collapsed-hint">— Click here or top menu to show</span>
               </div>`
            : `
              <div class="card-tagrow">${tagChips}<button class="chip-btn ghost" data-action="tag">+ Add / Manage Tags</button></div>
              ${hierarchyRow}
              ${images.length ? `<div class="card-gallery">${gallery}</div>` : ""}
              ${
                editing
                  ? `<div class="card-edit">
                      <div class="card-fmt-bar">
                        <div class="fmt-group">
                          <span class="fmt-label">Font:</span>
                          <select class="fmt-select" data-fmt="fontFamily" title="Note font family">
                            <option value="Space Grotesk" ${n.fontFamily === 'Space Grotesk' || !n.fontFamily ? 'selected' : ''}>Space Grotesk</option>
                            <option value="JetBrains Mono" ${n.fontFamily === 'JetBrains Mono' ? 'selected' : ''}>JetBrains Mono</option>
                            <option value="Tomorrow" ${n.fontFamily === 'Tomorrow' ? 'selected' : ''}>Tomorrow</option>
                            <option value="Inter" ${n.fontFamily === 'Inter' ? 'selected' : ''}>Inter</option>
                            <option value="Georgia" ${n.fontFamily === 'Georgia' ? 'selected' : ''}>Georgia</option>
                          </select>
                        </div>
                        <div class="fmt-group">
                          <span class="fmt-label">Size:</span>
                          <select class="fmt-select" data-fmt="fontSize" title="Text size">
                            <option value="12px" ${n.fontSize === '12px' ? 'selected' : ''}>12px Small</option>
                            <option value="14px" ${n.fontSize === '14px' || !n.fontSize ? 'selected' : ''}>14px Normal</option>
                            <option value="16px" ${n.fontSize === '16px' ? 'selected' : ''}>16px Medium</option>
                            <option value="18px" ${n.fontSize === '18px' ? 'selected' : ''}>18px Large</option>
                            <option value="22px" ${n.fontSize === '22px' ? 'selected' : ''}>22px Heading</option>
                            <option value="26px" ${n.fontSize === '26px' ? 'selected' : ''}>26px Title</option>
                          </select>
                        </div>
                        <div class="fmt-group fmt-color-group">
                          <span class="fmt-label">Color:</span>
                          <div class="fmt-color-dots">
                            <span class="fmt-dot color-dot" data-fmt-color="#0e0d33" style="background:#0e0d33" title="Dark Ink"></span>
                            <span class="fmt-dot color-dot" data-fmt-color="#0284c7" style="background:#0284c7" title="Ocean Cyan"></span>
                            <span class="fmt-dot color-dot" data-fmt-color="#16a34a" style="background:#16a34a" title="Emerald"></span>
                            <span class="fmt-dot color-dot" data-fmt-color="#d97706" style="background:#d97706" title="Amber"></span>
                            <span class="fmt-dot color-dot" data-fmt-color="#7c3aed" style="background:#7c3aed" title="Purple"></span>
                            <span class="fmt-dot color-dot" data-fmt-color="#e11d48" style="background:#e11d48" title="Rose"></span>
                          </div>
                          <input type="color" class="fmt-color-picker" data-fmt="textColor" value="${n.textColor || '#0e0d33'}" title="Pick custom text colour" />
                        </div>
                        <div class="fmt-sep"></div>
                        <div class="fmt-styles">
                          <button type="button" class="fmt-btn ${n.fontBold ? 'is-active' : ''}" data-fmt-action="bold" title="Bold (**text**)"><strong>B</strong></button>
                          <button type="button" class="fmt-btn ${n.fontItalic ? 'is-active' : ''}" data-fmt-action="italic" title="Italic (*text*)"><em>I</em></button>
                          <button type="button" class="fmt-btn" data-fmt-action="h1" title="Heading 1 (# ...)">H1</button>
                          <button type="button" class="fmt-btn" data-fmt-action="h2" title="Heading 2 (## ...)">H2</button>
                          <button type="button" class="fmt-btn" data-fmt-action="h3" title="Heading 3 (### ...)">H3</button>
                          <button type="button" class="fmt-btn" data-fmt-action="bullet" title="Bullet list">• List</button>
                          <button type="button" class="fmt-btn" data-fmt-action="numlist" title="Numbered list">1. List</button>
                          <button type="button" class="fmt-btn" data-fmt-action="colortag" title="Wrap in colored span">🎨 Tag</button>
                        </div>
                      </div>
                      <textarea class="card-textarea" spellcheck="false" style="font-family:'${n.fontFamily || "Space Grotesk"}', sans-serif; font-size:${n.fontSize || "14px"}; color:${n.textColor || "#14143c"}; font-weight:${n.fontBold ? "bold" : "normal"}; font-style:${n.fontItalic ? "italic" : "normal"};">${escapeHtml(n.text)}</textarea>
                      <div class="card-edit-actions">
                        <button class="btn small primary" data-action="save">${icon("check", 13)} Save</button>
                        <button class="btn small" data-action="cancel">Cancel</button>
                        <span class="hint">Markdown: **bold**, *italic*, ### heading, | tables |, &#96;&#96;&#96; code &#96;&#96;&#96;</span>
                      </div>
                    </div>`
                  : `<div class="card-body" data-body style="font-family:'${n.fontFamily || "Space Grotesk"}', system-ui, sans-serif; font-size:${n.fontSize || "13.5px"}; color:${n.textColor || "#23214f"}; font-weight:${n.fontBold ? "bold" : "normal"}; font-style:${n.fontItalic ? "italic" : "normal"};">${renderMarkdown(n.text || "_Empty card. Double-click or press EDIT to write._")}</div>`
              }
              <div class="card-foot">
                <span>${n.text ? `${n.text.length} CHARS` : "0 CHARS"} · ${Math.max(1, Math.ceil((n.text || "").trim().split(/\s+/).filter(Boolean).length / 180))}m READ · ${w}×${h}PX</span>
                <span class="foot-actions">
                  <button class="chip-btn accent-btn-emerald" data-action="image" title="Attach an image (compressed to 100 KB)">${icon("scan", 11)} IMAGE</button>
                  <button class="chip-btn accent-btn-cyan" data-action="image-url" title="Add image by URL">${icon("link", 11)} IMAGE URL</button>
                  <button class="chip-btn accent-btn-rose" data-action="table" title="Insert a table block">${icon("grid", 11)} TABLE</button>
                  <button class="chip-btn accent-btn-blue" data-action="code" title="Insert a code block">${icon("terminal", 11)} CODE</button>
                  <button class="chip-btn ${editing ? "accent-btn-save" : "accent-btn-edit"}" data-action="${editing ? "save" : "edit"}">${icon(editing ? "check" : "edit", 11)} ${editing ? "SAVE" : "EDIT NOTES"}</button>
                  <button class="chip-btn ghost" data-action="autofit">Auto-Fit</button>
                </span>
              </div>
              ${branches && !editing ? `<div class="branches">${branches}</div>` : ""}
            `
        }
      </div>
      <span class="resize-handle" data-resize title="Resize"></span>
    </article>`;
  }

  renderSticky(s, i) {
    const editing = this.editingStickyId === s.id;
    return `<article class="sticky" data-id="${s.id}" data-sticky="${s.id}" style="left:${s.x}px;top:${s.y}px;width:${s.width}px;height:${s.height}px;--sticky:${s.color}">
      <div class="sticky-head">
        <span>MEMO ${String(i + 1).padStart(2, "0")}</span>
        <span class="sticky-tools">
          <button data-sticky-action="color" title="Memo colour" class="sticky-dot" style="--dot:${s.color}"></button>
          <button data-sticky-action="delete" title="Delete memo">${icon("x", 12)}</button>
        </span>
      </div>
      ${editing ? "" : `<div class="sticky-body" data-sticky-body>${escapeHtml(s.text) || "Double-click to write…"}</div>`}
      ${editing ? `<textarea class="sticky-input" spellcheck="false">${escapeHtml(s.text)}</textarea>` : ""}
      <span class="resize-handle" data-sticky-resize></span>
    </article>`;
  }

  renderPill() {
    if (!this.pill) return;
    const count = this.selected.size;
    this.pill.classList.toggle("is-hidden", count === 0);
    if (count) {
      this.pill.innerHTML = `<span class="pill-dot"></span><strong>${count}</strong> node${count > 1 ? "s" : ""} selected
        <button class="pill-btn" data-pill="deselect">Deselect</button>`;
    }
  }

  renderRadar() {
    if (!this.radarMap) return;
    const ws = this.store.state.activeWorkspaceId;
    const nodes = this.store.nodes(ws);
    const stickies = this.store.stickies(ws);
    const cam = this.camera;
    const vw = this.root.clientWidth;
    const vh = this.root.clientHeight;
    const view = { x: -cam.x / cam.scale, y: -cam.y / cam.scale, w: vw / cam.scale, h: vh / cam.scale };
    const items = [...nodes, ...stickies];
    let minX = view.x;
    let minY = view.y;
    let maxX = view.x + view.w;
    let maxY = view.y + view.h;
    for (const it of items) {
      minX = Math.min(minX, it.x);
      minY = Math.min(minY, it.y);
      maxX = Math.max(maxX, it.x + it.width);
      maxY = Math.max(maxY, it.y + it.height);
    }
    const pad = 120;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const mapW = this.radarMap.clientWidth || 300;
    const mapH = this.radarMap.clientHeight || 130;
    const k = Math.min(mapW / spanX, mapH / spanY);
    const ox = (mapW - spanX * k) / 2;
    const oy = (mapH - spanY * k) / 2;
    const project = (it) => ({
      left: ox + (it.x - minX) * k,
      top: oy + (it.y - minY) * k,
      width: Math.max(3, it.width * k),
      height: Math.max(3, it.height * k),
    });
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const edges = this.store
      .links(ws)
      .map((l) => {
        const a = nodeById.get(l.sourceId);
        const b = nodeById.get(l.targetId);
        if (!a || !b) return "";
        const pa = project(a);
        const pb = project(b);
        return `<line x1="${pa.left + pa.width / 2}" y1="${pa.top + pa.height / 2}" x2="${pb.left + pb.width / 2}" y2="${pb.top + pb.height / 2}"/>`;
      })
      .join("");
    // Spatial density heatmap blobs
    const heatmapBlobs = [];
    const clusters = [];
    nodes.forEach((n) => {
      let added = false;
      for (const cl of clusters) {
        const last = cl[cl.length - 1];
        const dist = Math.hypot(n.x - last.x, n.y - last.y);
        if (dist < 1400) {
          cl.push(n);
          added = true;
          break;
        }
      }
      if (!added) clusters.push([n]);
    });

    clusters.forEach((cl) => {
      if (cl.length >= 2) {
        const avgX = cl.reduce((acc, c) => acc + c.x, 0) / cl.length;
        const avgY = cl.reduce((acc, c) => acc + c.y, 0) / cl.length;
        const pt = project({ x: avgX, y: avgY, width: 0, height: 0 });
        const radius = Math.max(16, Math.min(52, cl.length * 9));
        heatmapBlobs.push(
          `<circle cx="${pt.left}" cy="${pt.top}" r="${radius}" fill="url(#radarHeatBlob)" opacity="0.65" class="radar-heat-blob" />`
        );
      }
    });

    const heatmapDefs = `
      <defs>
        <radialGradient id="radarHeatBlob" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#00ff66" stop-opacity="0.55" />
          <stop offset="60%" stop-color="#22d3ee" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#22d3ee" stop-opacity="0" />
        </radialGradient>
      </defs>
    `;

    this.radarMap.innerHTML =
      `<svg class="radar-edges" width="${mapW}" height="${mapH}" aria-hidden="true">${heatmapDefs}${heatmapBlobs.join("")}${edges}</svg>` +
      nodes
        .map((n) => {
          const p = project(n);
          return `<span class="radar-node" data-id="${n.id}" title="${escapeAttr(n.prompt)} (Click to zoom to 80%)" style="left:${p.left}px;top:${p.top}px;width:${p.width}px;height:${p.height}px;background:${n.color};cursor:pointer;"></span>`;
        })
        .join("") +
      stickies
        .map((s) => {
          const p = project(s);
          return `<span class="radar-sticky" data-id="${s.id}" title="Memo: ${escapeAttr(s.text.slice(0, 30))} (Click to zoom to 80%)" style="left:${p.left}px;top:${p.top}px;width:${p.width}px;height:${p.height}px;background:${s.color};cursor:pointer;"></span>`;
        })
        .join("") +
      `<span class="radar-view" style="left:${ox + (view.x - minX) * k}px;top:${oy + (view.y - minY) * k}px;width:${view.w * k}px;height:${view.h * k}px"></span>`;
    this.radar.dataset.k = String(k);
    this.radarMap._project = { minX, minY, k, ox, oy };
  }

  zoomToCluster(type) {
    const nodes = this.workspaceNodes();
    let targets = nodes;
    if (type === "roots") {
      targets = nodes.filter((n) => !n.parentId);
    } else if (type === "subs") {
      targets = nodes.filter((n) => n.parentId);
    } else if (type === "active") {
      targets = nodes.filter((n) => this.selected.has(n.id));
    }
    if (!targets.length) targets = nodes;
    if (targets.length) {
      this.fitBounds(boundsOf(targets), 0.85);
      const label = type === "roots" ? "Root Branches" : type === "subs" ? "Sub-Nodes" : type === "active" ? "Focused Nodes" : "All Nodes";
      this.toast?.(`Cluster Zoom: ${label} (${targets.length})`);
    }
  }

  // --- camera ---------------------------------------------------------------
  setTransform(t, persist = true) {
    this.store.setTransform({ ...this.camera, ...t });
    if (persist) this.store.persist();
    this.applyCamera();
    this.renderRadar();
  }

  zoomAt(factor, px, py) {
    const cam = this.camera;
    const scale = clamp(cam.scale * factor, MIN_SCALE, MAX_SCALE);
    if (scale === cam.scale) return;
    const cx = px ?? this.root.clientWidth / 2;
    const cy = py ?? this.root.clientHeight / 2;
    const wx = (cx - cam.x) / cam.scale;
    const wy = (cy - cam.y) / cam.scale;
    this.setTransform({ scale, x: cx - wx * scale, y: cy - wy * scale });
  }

  zoomTo(scale = 0.8, targetIds = [...this.selected]) {
    const nodes = this.workspaceNodes().filter((n) => targetIds.includes(n.id));
    if (!nodes.length) {
      this.zoomAt(scale / this.camera.scale);
      return;
    }
    const bounds = boundsOf(nodes);
    this.fitBounds(bounds, scale);
  }

  fit() {
    const nodes = this.workspaceNodes();
    const stickies = this.store.stickies();
    const items = [...nodes, ...stickies];
    if (!items.length) {
      this.setTransform({ x: 0, y: 70, scale: 0.65 });
      return;
    }
    this.fitBounds(boundsOf(items), 1);
  }

  visibleLeft() {
    const sidebar = document.querySelector("#sidebar");
    const open = sidebar && !sidebar.classList.contains("is-collapsed");
    return open && window.innerWidth > 700 ? sidebar.getBoundingClientRect().width : 0;
  }

  visibleBox() {
    const left = this.visibleLeft();
    return { left, width: this.root.clientWidth - left, height: this.root.clientHeight };
  }

  fitBounds(bounds, maxScale = 1) {
    const box = this.visibleBox();
    const scale = clamp(Math.min((box.width - 180) / bounds.w, (box.height - 200) / bounds.h, maxScale), MIN_SCALE, MAX_SCALE);
    this.setTransform({
      scale,
      x: box.left + box.width / 2 - (bounds.x + bounds.w / 2) * scale,
      y: box.height / 2 - (bounds.y + bounds.h / 2) * scale,
    });
  }

  centerOn(node) {
    const cam = this.camera;
    const box = this.visibleBox();
    this.setTransform({
      x: box.left + box.width / 2 - (node.x + node.width / 2) * cam.scale,
      y: box.height / 2 - (node.y + node.height / 2) * cam.scale,
    });
  }

  smoothZoomToNode(node, targetScale = 0.7, duration = 450) {
    if (!node) return;
    this.select(node.id);
    const box = this.visibleBox();
    const startCam = { ...this.camera };
    const nodeW = node.width || (node.text !== undefined ? 260 : 760);
    const nodeH = node.height || (node.text !== undefined ? 220 : 580);
    const targetX = box.left + box.width / 2 - (node.x + nodeW / 2) * targetScale;
    const targetY = box.height / 2 - (node.y + nodeH / 2) * targetScale;

    // Trigger Tree.js 3D kinetic animation pulse
    if (window.tree3d && typeof window.tree3d.pulseToNode === "function") {
      window.tree3d.pulseToNode(node);
    }

    if (this._zoomAnim) cancelAnimationFrame(this._zoomAnim);
    const startTime = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = easeOutCubic(progress);
      const scale = startCam.scale + (targetScale - startCam.scale) * ease;
      const x = startCam.x + (targetX - startCam.x) * ease;
      const y = startCam.y + (targetY - startCam.y) * ease;
      this.setTransform({ scale, x, y }, progress === 1);
      if (progress < 1) {
        this._zoomAnim = requestAnimationFrame(step);
      } else {
        this._zoomAnim = null;
        const rawName = (node.prompt || node.text || "card").replace(/\n/g, " ").trim();
        const cleanName = rawName.length > 32 ? `${rawName.slice(0, 30)}…` : rawName;
        this.toast?.(`Magnified card to 80%: “${cleanName}”`);
      }
    };
    this._zoomAnim = requestAnimationFrame(step);
  }

  screenToWorld(clientX, clientY) {
    const rect = this.root.getBoundingClientRect();
    const cam = this.camera;
    return {
      x: (clientX - rect.left - cam.x) / cam.scale,
      y: (clientY - rect.top - cam.y) / cam.scale,
    };
  }

  viewportCenter() {
    const cam = this.camera;
    const box = this.visibleBox();
    return {
      x: (box.left + box.width / 2 - cam.x) / cam.scale,
      y: (box.height / 2 - cam.y) / cam.scale,
    };
  }

  // --- selection ------------------------------------------------------------
  select(id, additive = false) {
    if (!id) {
      this.selected.clear();
    } else if (additive) {
      this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id);
      this.sfx?.play("click");
    } else {
      this.selected.clear();
      this.selected.add(id);
      this.sfx?.play("click");
    }
    this.markSelection();
    this.renderPill();
    this.triggerSelectiveGlow(id);
  }

  triggerSelectiveGlow(id) {
    // Clear glow / blink from all cards
    for (const el of this.stage.querySelectorAll(".card, .sticky")) {
      el.classList.remove("card-glow-focus", "card-parent-glow");
    }
    if (this._glowTimeout) {
      clearTimeout(this._glowTimeout);
      this._glowTimeout = null;
    }
    if (!id) return;

    // Soft micro-blink ONLY the selected card
    const cardEl = this.stage.querySelector(`.card[data-id="${id}"], [data-sticky="${id}"]`);
    if (cardEl) {
      cardEl.classList.remove("card-glow-focus");
      void cardEl.offsetWidth;
      cardEl.classList.add("card-glow-focus");
    }

    // Soft micro-blink ONLY its direct parent card (via parentId or incoming link)
    const node = this.store.node(id);
    let parentId = node ? node.parentId : null;
    if (!parentId && node) {
      const ws = node.workspaceId || this.store.state.activeWorkspaceId;
      const links = this.store.links(ws) || [];
      const inLink = links.find((l) => l.targetId === node.id);
      if (inLink) parentId = inLink.sourceId;
    }
    let parentEl = null;
    if (parentId) {
      parentEl = this.stage.querySelector(`.card[data-id="${parentId}"]`);
      if (parentEl) {
        parentEl.classList.remove("card-parent-glow");
        void parentEl.offsetWidth;
        parentEl.classList.add("card-parent-glow");
      }
    }

    this._glowTimeout = setTimeout(() => {
      if (cardEl) cardEl.classList.remove("card-glow-focus");
      if (parentEl) parentEl.classList.remove("card-parent-glow");
    }, 1100);
  }

  // Hierarchical parent-to-child tree without overlapping
  arrangeTree() {
    const nodes = this.workspaceNodes();
    if (!nodes.length) {
      this.toast?.("Add some cards before arranging.");
      return;
    }
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const kids = new Map(nodes.map((n) => [n.id, []]));
    const roots = [];
    for (const n of nodes) {
      if (n.parentId && byId.has(n.parentId) && n.parentId !== n.id) {
        kids.get(n.parentId).push(n);
      } else {
        roots.push(n);
      }
    }
    if (!roots.length && nodes.length) {
      roots.push(nodes[0]);
    }
    const GAP_X = 140;
    const GAP_Y = 56;
    const subtree = new Map();
    const getNodeHeight = (n) => (n.hideContent ? 140 : (n.height || 580));
    const getNodeWidth = (n) => n.width || 760;

    const measureVisited = new Set();
    const measure = (n) => {
      if (measureVisited.has(n.id)) return getNodeHeight(n);
      measureVisited.add(n.id);
      const list = (kids.get(n.id) || []).filter((c) => !measureVisited.has(c.id));
      const selfH = getNodeHeight(n);
      if (!list.length) {
        subtree.set(n.id, selfH);
        return selfH;
      }
      const totalKidsH = list.reduce((sum, c) => sum + measure(c), 0) + GAP_Y * (list.length - 1);
      const total = Math.max(selfH, totalKidsH);
      subtree.set(n.id, total);
      return total;
    };
    roots.forEach(measure);

    const layout = {};
    const placeVisited = new Set();
    const place = (n, x, top) => {
      if (placeVisited.has(n.id)) return;
      placeVisited.add(n.id);
      const list = (kids.get(n.id) || []).filter((c) => !placeVisited.has(c.id));
      const totalH = subtree.get(n.id) || getNodeHeight(n);
      const selfH = getNodeHeight(n);
      const selfW = getNodeWidth(n);
      layout[n.id] = { x: Math.round(x), y: Math.round(top + (totalH - selfH) / 2) };
      const childTotalH = list.reduce((sum, c) => sum + (subtree.get(c.id) || getNodeHeight(c)), 0) + GAP_Y * (list.length - 1);
      let cy = top + (totalH - childTotalH) / 2;
      for (const c of list) {
        place(c, x + selfW + GAP_X, cy);
        cy += (subtree.get(c.id) || getNodeHeight(c)) + GAP_Y;
      }
    };
    let y = 0;
    for (const r of roots) {
      place(r, 0, y);
      y += (subtree.get(r.id) || getNodeHeight(r)) + GAP_Y * 2;
    }
    for (const n of nodes) {
      if (!layout[n.id]) {
        layout[n.id] = { x: 0, y: Math.round(y) };
        y += getNodeHeight(n) + GAP_Y * 2;
      }
    }
    this.store.applyLayout(layout);
    this.fit();
    this.toast?.("Cards arranged in Tree format (hierarchical parent → child).");
  }

  // Circular card arrangement: Radial form around central / root nodes
  arrangeCircular() {
    const nodes = this.workspaceNodes();
    if (!nodes.length) {
      this.toast?.("Add some cards before arranging.");
      return;
    }
    const layout = {};
    const getNodeWidth = (n) => n.width || 760;
    const getNodeHeight = (n) => (n.hideContent ? 140 : (n.height || 580));

    if (nodes.length === 1) {
      const single = nodes[0];
      const w = getNodeWidth(single);
      const h = getNodeHeight(single);
      layout[single.id] = { x: Math.round(-w / 2), y: Math.round(-h / 2) };
      this.store.applyLayout(layout);
      this.fit();
      this.toast?.("Card centered in Circular format.");
      return;
    }

    const byId = new Map(nodes.map((n) => [n.id, n]));
    const roots = nodes.filter((n) => !n.parentId || !byId.has(n.parentId));

    if (roots.length === 1 && nodes.length > 1) {
      const centerNode = roots[0];
      const cw = getNodeWidth(centerNode);
      const ch = getNodeHeight(centerNode);
      layout[centerNode.id] = { x: Math.round(-cw / 2), y: Math.round(-ch / 2) };

      const ringNodes = nodes.filter((n) => n.id !== centerNode.id);
      const count = ringNodes.length;
      const maxDim = Math.max(...ringNodes.map((n) => Math.hypot(getNodeWidth(n), getNodeHeight(n))));
      const radius = Math.max(780, (count * (maxDim + 120)) / (2 * Math.PI));

      for (let i = 0; i < count; i++) {
        const item = ringNodes[i];
        const angle = (2 * Math.PI * i) / count - Math.PI / 2;
        const w = getNodeWidth(item);
        const h = getNodeHeight(item);
        const cx = radius * Math.cos(angle);
        const cy = radius * Math.sin(angle);
        layout[item.id] = { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2) };
      }
    } else {
      const count = nodes.length;
      const maxDim = Math.max(...nodes.map((n) => Math.hypot(getNodeWidth(n), getNodeHeight(n))));
      const radius = Math.max(820, (count * (maxDim + 140)) / (2 * Math.PI));

      for (let i = 0; i < count; i++) {
        const item = nodes[i];
        const angle = (2 * Math.PI * i) / count - Math.PI / 2;
        const w = getNodeWidth(item);
        const h = getNodeHeight(item);
        const cx = radius * Math.cos(angle);
        const cy = radius * Math.sin(angle);
        layout[item.id] = { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2) };
      }
    }

    this.store.applyLayout(layout);
    this.fit();
    this.toast?.("Cards arranged in Circular radial format.");
  }

  // Bento Grid Matrix arrangement: Multi-column organized grid with dynamic masonry row heights
  arrangeGrid() {
    const nodes = this.workspaceNodes();
    if (!nodes.length) {
      this.toast?.("Add some cards before arranging.");
      return;
    }
    const layout = {};
    const getNodeWidth = (n) => n.width || 760;
    const getNodeHeight = (n) => (n.hideContent ? 140 : (n.height || 580));

    // Determine number of columns: 2 columns for 2-4 cards, 3 columns for 5-8 cards, 4 columns for 9+
    const colCount = nodes.length <= 4 ? Math.min(2, Math.max(1, nodes.length)) : nodes.length <= 8 ? 3 : 4;
    const GAP_X = 100;
    const GAP_Y = 80;

    const colHeights = new Array(colCount).fill(0);
    const colWidths = new Array(colCount).fill(760);

    // Group cards: roots first, followed by sub-nodes
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const roots = nodes.filter((n) => !n.parentId || !byId.has(n.parentId));
    const kids = nodes.filter((n) => n.parentId && byId.has(n.parentId));
    const sortedNodes = [...roots, ...kids];

    sortedNodes.forEach((n) => {
      let minCol = 0;
      for (let c = 1; c < colCount; c++) {
        if (colHeights[c] < colHeights[minCol]) minCol = c;
      }
      const w = getNodeWidth(n);
      const h = getNodeHeight(n);
      if (w > colWidths[minCol]) colWidths[minCol] = w;

      let x = 0;
      for (let c = 0; c < minCol; c++) {
        x += colWidths[c] + GAP_X;
      }
      const y = colHeights[minCol];
      layout[n.id] = { x: Math.round(x), y: Math.round(y) };
      colHeights[minCol] += h + GAP_Y;
    });

    this.store.applyLayout(layout);
    this.fit();
    this.toast?.("Cards arranged in Bento Grid Matrix (zero collision).");
  }

  // Sequential Timeline Stream arrangement: Chronological left-to-right alternating flow
  arrangeTimeline() {
    const nodes = this.workspaceNodes();
    if (!nodes.length) {
      this.toast?.("Add some cards before arranging.");
      return;
    }
    const layout = {};
    const getNodeWidth = (n) => n.width || 760;
    const getNodeHeight = (n) => (n.hideContent ? 140 : (n.height || 580));

    // Sort nodes by parent-to-child sequence
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const roots = nodes.filter((n) => !n.parentId || !byId.has(n.parentId));
    const ordered = [];
    const visited = new Set();
    const addWithKids = (n) => {
      if (visited.has(n.id)) return;
      visited.add(n.id);
      ordered.push(n);
      const myKids = nodes.filter((c) => c.parentId === n.id);
      for (const k of myKids) addWithKids(k);
    };
    roots.forEach(addWithKids);
    for (const n of nodes) {
      if (!visited.has(n.id)) ordered.push(n);
    }

    const GAP_X = 140;
    let curX = 0;
    ordered.forEach((n, idx) => {
      const w = getNodeWidth(n);
      // Alternating vertical tracks for fluid timeline stream
      const track = idx % 2 === 0 ? 40 : 360;
      layout[n.id] = { x: Math.round(curX), y: Math.round(track) };
      curX += w + GAP_X;
    });

    this.store.applyLayout(layout);
    this.fit();
    this.toast?.("Cards arranged in Sequential Timeline Stream.");
  }

  // Auto-arrange according to connections without overlapping
  arrangeConnected() {
    const nodes = this.workspaceNodes();
    if (!nodes.length) {
      this.toast?.("Add some cards before arranging.");
      return;
    }
    const ws = this.store.state.activeWorkspaceId;
    const links = this.store.links(ws);
    const byId = new Map(nodes.map((n) => [n.id, n]));

    const adj = new Map(nodes.map((n) => [n.id, new Set()]));
    for (const n of nodes) {
      if (n.parentId && byId.has(n.parentId)) {
        adj.get(n.id).add(n.parentId);
        adj.get(n.parentId).add(n.id);
      }
    }
    for (const l of links) {
      if (byId.has(l.sourceId) && byId.has(l.targetId)) {
        adj.get(l.sourceId).add(l.targetId);
        adj.get(l.targetId).add(l.sourceId);
      }
    }

    const visited = new Set();
    const components = [];
    for (const n of nodes) {
      if (visited.has(n.id)) continue;
      const comp = [];
      const queue = [n.id];
      visited.add(n.id);
      while (queue.length) {
        const cur = queue.shift();
        comp.push(byId.get(cur));
        for (const neighbor of adj.get(cur) || []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      components.push(comp);
    }

    const layout = {};
    const getNodeWidth = (n) => n.width || 760;
    const getNodeHeight = (n) => (n.hideContent ? 140 : (n.height || 580));
    const GAP = 100;

    let compOffsetX = 0;
    for (const comp of components) {
      comp.sort((a, b) => (adj.get(b.id)?.size || 0) - (adj.get(a.id)?.size || 0));

      const compPos = new Map();
      const first = comp[0];
      compPos.set(first.id, { x: 0, y: 0 });

      const q = [first.id];
      const placed = new Set([first.id]);
      while (q.length) {
        const pId = q.shift();
        const pPos = compPos.get(pId);
        const pNode = byId.get(pId);
        const pW = getNodeWidth(pNode);
        const pH = getNodeHeight(pNode);

        const neighbors = [...(adj.get(pId) || [])].filter((nid) => !placed.has(nid));
        const numN = neighbors.length;
        if (numN > 0) {
          const stepDist = Math.max(pW, pH) + GAP + 60;
          for (let i = 0; i < numN; i++) {
            const nId = neighbors[i];
            const angle = (2 * Math.PI * i) / numN;
            compPos.set(nId, {
              x: Math.round(pPos.x + stepDist * Math.cos(angle)),
              y: Math.round(pPos.y + stepDist * Math.sin(angle)),
            });
            placed.add(nId);
            q.push(nId);
          }
        }
      }

      for (const n of comp) {
        if (!compPos.has(n.id)) {
          compPos.set(n.id, { x: 0, y: (compPos.size + 1) * (getNodeHeight(n) + GAP) });
        }
      }

      // Iterative collision resolution to ensure ZERO overlap
      for (let iter = 0; iter < 45; iter++) {
        let collisionFound = false;
        for (let i = 0; i < comp.length; i++) {
          for (let j = i + 1; j < comp.length; j++) {
            const na = comp[i];
            const nb = comp[j];
            const pa = compPos.get(na.id);
            const pb = compPos.get(nb.id);
            const wa = getNodeWidth(na);
            const ha = getNodeHeight(na);
            const wb = getNodeWidth(nb);
            const hb = getNodeHeight(nb);

            const minOverlapX = (wa + wb) / 2 + GAP;
            const minOverlapY = (ha + hb) / 2 + GAP;

            const caX = pa.x + wa / 2;
            const caY = pa.y + ha / 2;
            const cbX = pb.x + wb / 2;
            const cbY = pb.y + hb / 2;

            let dx = cbX - caX;
            let dy = cbY - caY;
            if (dx === 0 && dy === 0) {
              pb.x += 10;
              pb.y += 10;
              dx = 10;
              dy = 10;
            }

            if (Math.abs(dx) < minOverlapX && Math.abs(dy) < minOverlapY) {
              collisionFound = true;
              const overlapX = minOverlapX - Math.abs(dx);
              const overlapY = minOverlapY - Math.abs(dy);

              if (overlapX < overlapY) {
                const push = (overlapX / 2) + 6;
                const sign = dx >= 0 ? 1 : -1;
                pa.x -= push * sign;
                pb.x += push * sign;
              } else {
                const push = (overlapY / 2) + 6;
                const sign = dy >= 0 ? 1 : -1;
                pa.y -= push * sign;
                pb.y += push * sign;
              }
            }
          }
        }
        if (!collisionFound) break;
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity;
      for (const n of comp) {
        const p = compPos.get(n.id);
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
      }
      for (const n of comp) {
        const p = compPos.get(n.id);
        const nx = Math.round(p.x - minX + compOffsetX);
        const ny = Math.round(p.y - minY);
        layout[n.id] = { x: nx, y: ny };
        maxX = Math.max(maxX, nx + getNodeWidth(n));
      }
      compOffsetX = maxX + GAP * 2;
    }

    this.store.applyLayout(layout);
    this.fit();
    this.toast?.("Cards auto-arranged by connections without overlapping.");
  }

  showHeroLanding() {
    this.select(null);
    this.forceShowHero = false;
    if (window.landingPage) {
      window.landingPage.open();
    } else if (window.ui?.landingPage) {
      window.ui.landingPage.open();
    } else {
      location.hash = "/home";
    }
    this.toast?.("Navigated to BrainVault Home.");
  }

  markSelection() {
    for (const el of this.stage.querySelectorAll(".card")) {
      const isSel = this.selected.has(el.dataset.id);
      el.classList.toggle("is-selected", isSel);
      const tb = el.querySelector(".card-toolbar");
      if (isSel && tb) {
        this.armToolbarTimer(el, tb, 7000);
      }
    }

    // Sync selection highlight to Left Panel Sidebar (both Workspace Nodes tree-rows and Notes tab note-rows)
    const sidebar = document.querySelector("#sidebar");
    if (sidebar) {
      const selectedId = [...this.selected][0] || null;
      sidebar.querySelectorAll(".tree-row, .note-row").forEach((row) => {
        const rowNodeId = row.dataset.focus || row.dataset.nodeId;
        const isMatched = Boolean(selectedId && rowNodeId === selectedId);
        row.classList.toggle("is-selected", isMatched);
        row.classList.toggle("is-active", isMatched);
      });
    }
  }

  armToolbarTimer(cardEl, toolbarEl, duration = 7000) {
    if (!cardEl || !toolbarEl) return;
    const cardId = cardEl.dataset.id;
    if (!this._toolbarTimers) this._toolbarTimers = new Map();
    if (this._toolbarTimers.has(cardId)) {
      clearTimeout(this._toolbarTimers.get(cardId));
    }

    toolbarEl.classList.remove("is-toolbar-expired");
    toolbarEl.classList.add("is-toolbar-visible");
    cardEl.classList.add("toolbar-active");

    const timer = setTimeout(() => {
      // Keep toolbar active while user is editing
      if (cardEl.classList.contains("is-editing") || this.editingId === cardId) {
        this.armToolbarTimer(cardEl, toolbarEl, 7000);
        return;
      }
      // If mouse is currently hovering directly on the toolbar, keep it visible until mouseleave
      if (toolbarEl.matches(":hover")) {
        const onLeave = () => {
          toolbarEl.removeEventListener("mouseleave", onLeave);
          this.armToolbarTimer(cardEl, toolbarEl, 7000);
        };
        toolbarEl.addEventListener("mouseleave", onLeave, { once: true });
        return;
      }
      toolbarEl.classList.remove("is-toolbar-visible");
      toolbarEl.classList.add("is-toolbar-expired");
      cardEl.classList.remove("toolbar-active");
      this._toolbarTimers.delete(cardId);
    }, duration);

    this._toolbarTimers.set(cardId, timer);
  }

  animateCardsEntrance() {
    if (typeof window.anime !== "function") return;
    if (!this._animatedCardIds) this._animatedCardIds = new Set();
    const cards = this.stage.querySelectorAll(".card, .sticky");
    const freshCards = [];
    cards.forEach((c) => {
      const id = c.dataset.id || c.dataset.sticky;
      // Do not apply entrance animation to actively edited cards
      if (this.editingId && (id === this.editingId || c.classList.contains("is-editing"))) {
        if (id) this._animatedCardIds.add(id);
        return;
      }
      if (id && !this._animatedCardIds.has(id)) {
        this._animatedCardIds.add(id);
        c.classList.add("has-animated-in");
        freshCards.push(c);
      }
    });
    if (!freshCards.length) return;
    window.anime({
      targets: freshCards,
      opacity: [0, 1],
      translateY: [12, 0],
      scale: [0.98, 1],
      delay: window.anime.stagger(25),
      duration: 280,
      easing: "easeOutCubic",
    });
  }

  animateCardTitle(cardEl) {
    if (typeof window.anime !== "function" || !cardEl) return;
    const title = cardEl.querySelector(".card-title");
    if (!title) return;
    window.anime({
      targets: title,
      opacity: [0.65, 1],
      translateY: [4, 0],
      duration: 320,
      easing: "easeOutQuad",
    });
  }

  // --- events ---------------------------------------------------------------
  attach() {
    const root = this.root;
    root.addEventListener("wheel", (e) => {
      if (e.target.closest("textarea, input")) return;
      e.preventDefault();
      const rect = root.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0016);
      this.zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
    }, { passive: false });

    root.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    window.addEventListener("pointerup", (e) => this.onPointerUp(e));
    window.addEventListener("pointercancel", () => this.endGesture());

    const awakenCardToolbar = (target) => {
      const card = target?.closest?.(".card");
      if (card) {
        const tb = card.querySelector(".card-toolbar");
        if (tb && (tb.classList.contains("is-toolbar-expired") || !tb.classList.contains("is-toolbar-visible"))) {
          this.armToolbarTimer(card, tb, 7000);
        }
      }
    };

    root.addEventListener("pointerenter", (e) => awakenCardToolbar(e.target), true);
    root.addEventListener("pointerover", (e) => awakenCardToolbar(e.target), true);
    root.addEventListener("pointermove", (e) => {
      const card = e.target?.closest?.(".card");
      if (card) {
        const tb = card.querySelector(".card-toolbar");
        if (tb && tb.classList.contains("is-toolbar-expired")) {
          this.armToolbarTimer(card, tb, 7000);
        }
      }
    }, { passive: true });

    root.addEventListener("click", (e) => this.onClick(e));
    root.addEventListener("dblclick", (e) => this.onDoubleClick(e));
    window.addEventListener("keydown", (e) => this.onKey(e));

    root.addEventListener("change", (e) => {
      const select = e.target.closest("[data-fmt]");
      if (select && select.tagName === "SELECT") {
        const card = select.closest(".card");
        const area = card?.querySelector(".card-textarea");
        if (area) {
          if (select.dataset.fmt === "fontFamily") area.style.fontFamily = `'${select.value}', sans-serif`;
          if (select.dataset.fmt === "fontSize") area.style.fontSize = select.value;
        }
      }
    });

    root.addEventListener("input", (e) => {
      const picker = e.target.closest("[data-fmt='textColor']");
      if (picker) {
        const card = picker.closest(".card");
        const area = card?.querySelector(".card-textarea");
        if (area) area.style.color = picker.value;
      }
    });

    root.addEventListener("click", (e) => {
      const term = e.target.closest("[data-term]");
      if (term) {
        e.stopPropagation();
        const card = term.closest(".card");
        if (card) this.onTerm?.(term.dataset.term, card.dataset.id);
      }
    });

    if (this.radarMap) {
      let radarDragging = false;
      let startX = 0;
      let startY = 0;

      this.radarMap.addEventListener("pointerdown", (e) => {
        const targetRadarNode = e.target.closest(".radar-node, .radar-sticky");
        startX = e.clientX;
        startY = e.clientY;
        radarDragging = false;
        const move = (ev) => {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5) {
            radarDragging = true;
          }
          this.panRadarTo(ev);
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        if (!targetRadarNode) move(e);
      });

      this.radarMap.addEventListener("click", (e) => {
        if (radarDragging) return;
        const targetRadarNode = e.target.closest(".radar-node, .radar-sticky");
        if (targetRadarNode) {
          e.stopPropagation();
          const id = targetRadarNode.dataset.id;
          const node = this.store.node(id) || this.store.sticky(id);
          if (node) {
            this.smoothZoomToNode(node, 0.8);
          }
        }
      });
    }

    if (this.radar) {
      this.radar.querySelectorAll("[data-radar-cluster]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.radar.querySelectorAll("[data-radar-cluster]").forEach((b) => b.classList.remove("is-active"));
          btn.classList.add("is-active");
          const cluster = btn.dataset.radarCluster;
          this.zoomToCluster(cluster);
          this.sfx?.play("click");
        });
      });

      this.radar.querySelector("#radarMinimizeBtn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.radar.classList.toggle("is-minimized");
        this.sfx?.play("click");
      });
    }
  }

  panRadarTo(e) {
    const rect = this.radarMap.getBoundingClientRect();
    const p = this.radarMap._project;
    if (!p) return;
    const x = p.minX + (e.clientX - rect.left - p.ox) / p.k;
    const y = p.minY + (e.clientY - rect.top - p.oy) / p.k;
    const cam = this.camera;
    this.setTransform({
      x: this.root.clientWidth / 2 - x * cam.scale,
      y: this.root.clientHeight / 2 - y * cam.scale,
    });
  }

  onPointerDown(e) {
    if (e.button !== 0 && e.button !== 1) return;
    if (e.target.closest("[data-pill]")) {
      this.select(null);
      return;
    }
    if (e.target.closest("#hero, #radar, .terminalbar, .selection-pill, .modal-root")) return;
    if (this.forceShowHero) {
      this.forceShowHero = false;
      const nodes = this.store.nodes();
      const stickies = this.store.stickies();
      if (this.hero) this.hero.classList.toggle("is-hidden", nodes.length + stickies.length > 0);
    }
    const card = e.target.closest(".card");
    const sticky = e.target.closest(".sticky");
    const resize = e.target.closest("[data-resize]");
    const stickyResize = e.target.closest("[data-sticky-resize]");
    const interactive = e.target.closest("button, a, input, textarea, .card-body [data-term]");

    if (resize && card) {
      const node = this.store.node(card.dataset.id);
      this.store.checkpoint();
      this.gesture = { type: "resize", node, el: card, start: this.screenToWorld(e.clientX, e.clientY), w: node.width, h: node.height };
      this.capture(e);
      return;
    }
    if (stickyResize && sticky) {
      const s = this.store.sticky(sticky.dataset.sticky);
      this.store.checkpoint();
      this.gesture = { type: "sticky-resize", sticky: s, el: sticky, start: this.screenToWorld(e.clientX, e.clientY), w: s.width, h: s.height };
      this.capture(e);
      return;
    }
    if (card) {
      if (interactive) {
        if (e.target.closest(".card-toolbar")) return;
        if (!this.selected.has(card.dataset.id)) {
          this.select(card.dataset.id, e.shiftKey);
        }
        return;
      }
      this.select(card.dataset.id, e.shiftKey);
      const node = this.store.node(card.dataset.id);
      this.store.checkpoint();
      const point = this.screenToWorld(e.clientX, e.clientY);
      this.gesture = { type: "drag", node, el: card, dx: point.x - node.x, dy: point.y - node.y };
      card.classList.add("is-dragging");
      this.capture(e, false);
      return;
    }
    if (sticky) {
      if (interactive) return;
      const s = this.store.sticky(sticky.dataset.sticky);
      this.store.checkpoint();
      const point = this.screenToWorld(e.clientX, e.clientY);
      this.gesture = { type: "sticky-drag", sticky: s, el: sticky, dx: point.x - s.x, dy: point.y - s.y };
      sticky.classList.add("is-dragging");
      this.capture(e, false);
      return;
    }

    // Background: pan, or marquee on double-click drag.
    this.select(null);
    const point = this.screenToWorld(e.clientX, e.clientY);
    if (e.detail >= 2) {
      this.gesture = { type: "marquee", start: point, el: this.ensureMarquee() };
      this.drawMarquee(point, point);
    } else {
      this.gesture = { type: "pan", start: { x: e.clientX, y: e.clientY }, cam: { ...this.camera } };
      this.root.classList.add("is-panning");
    }
    this.capture(e);
  }

  capture(e, prevent = true) {
    if (prevent) e.preventDefault();
  }

  onPointerMove(e) {
    const g = this.gesture;
    if (!g) return;
    if (g.type === "pan") {
      this.setTransform(
        { x: g.cam.x + (e.clientX - g.start.x), y: g.cam.y + (e.clientY - g.start.y) },
        false
      );
      return;
    }
    if (g.type === "drag" || g.type === "sticky-drag") {
      const point = this.screenToWorld(e.clientX, e.clientY);
      const obj = g.node || g.sticky;
      const nx = Math.round(point.x - g.dx);
      const ny = Math.round(point.y - g.dy);
      if (nx !== obj.x || ny !== obj.y) g.moved = true;
      obj.x = nx;
      obj.y = ny;
      g.el.style.left = `${obj.x}px`;
      g.el.style.top = `${obj.y}px`;
      this.refreshLinks();
      this.renderRadarThrottled();
      return;
    }
    if (g.type === "resize" || g.type === "sticky-resize") {
      const point = this.screenToWorld(e.clientX, e.clientY);
      const obj = g.node || g.sticky;
      const nw = Math.max(g.node ? 480 : 180, Math.round(g.w + point.x - g.start.x));
      const nh = Math.max(g.node ? 380 : 140, Math.round(g.h + point.y - g.start.y));
      if (nw !== obj.width || nh !== obj.height) g.moved = true;
      obj.width = nw;
      obj.height = nh;
      g.el.style.width = `${obj.width}px`;
      g.el.style.height = `${obj.height}px`;
      return;
    }
    if (g.type === "marquee") {
      this.drawMarquee(g.start, this.screenToWorld(e.clientX, e.clientY));
      return;
    }
  }

  onPointerUp() {
    const g = this.gesture;
    this._dragged = Boolean(g && g.moved);
    setTimeout(() => { this._dragged = false; }, 80);
    if (!g) return;
    if (g.moved && (g.type === "drag" || g.type === "sticky-drag")) {
      this.sfx?.play("cardSnap");
    }
    if (g.type === "drag") {
      g.el.classList.remove("is-dragging");
      if (g.moved) this.store.updateNode(g.node.id, { x: g.node.x, y: g.node.y }, { record: false });
    } else if (g.type === "resize") {
      if (g.moved) this.store.updateNode(g.node.id, { width: g.node.width, height: g.node.height }, { record: false });
    } else if (g.type === "sticky-drag") {
      g.el.classList.remove("is-dragging");
      if (g.moved) this.store.updateSticky(g.sticky.id, { x: g.sticky.x, y: g.sticky.y }, { record: false });
    } else if (g.type === "sticky-resize") {
      if (g.moved) this.store.updateSticky(g.sticky.id, { width: g.sticky.width, height: g.sticky.height }, { record: false });
    } else if (g.type === "marquee") {
      const rect = g.el.getBoundingClientRect();
      this.selected.clear();
      for (const el of this.stage.querySelectorAll(".card")) {
        const r = el.getBoundingClientRect();
        if (r.left < rect.right && r.right > rect.left && r.top < rect.bottom && r.bottom > rect.top) {
          this.selected.add(el.dataset.id);
        }
      }
      this.markSelection();
      this.renderPill();
      g.el.remove();
    } else if (g.type === "pan") {
      this.root.classList.remove("is-panning");
      this.store.persist();
    }
    this.gesture = null;
  }

  endGesture() {
    if (!this.gesture) return;
    this.gesture = null;
    this.root.classList.remove("is-panning");
  }

  ensureMarquee() {
    let el = this.root.querySelector(".marquee");
    if (!el) {
      el = document.createElement("div");
      el.className = "marquee";
      this.root.appendChild(el);
    }
    return el;
  }

  drawMarquee(a, b) {
    const el = this.gesture?.el;
    if (!el) return;
    const rootRect = this.root.getBoundingClientRect();
    const cam = this.camera;
    const x1 = a.x * cam.scale + cam.x;
    const y1 = a.y * cam.scale + cam.y;
    const x2 = b.x * cam.scale + cam.x;
    const y2 = b.y * cam.scale + cam.y;
    Object.assign(el.style, {
      left: `${Math.min(x1, x2)}px`,
      top: `${Math.min(y1, y2)}px`,
      width: `${Math.abs(x2 - x1)}px`,
      height: `${Math.abs(y2 - y1)}px`,
    });
  }

  refreshLinks() {
    if (!this.links) return;
    this.links.innerHTML = this.renderLinks(this.workspaceNodes(), this.store.links());
  }

  onClick(e) {
    const pill = e.target.closest("[data-pill]");
    if (pill) {
      this.select(null);
      return;
    }
    const focusNode = e.target.closest("[data-focus-node]");
    if (focusNode) {
      e.stopPropagation();
      const target = this.store.node(focusNode.dataset.focusNode);
      if (target) {
        this.select(target.id);
        this.centerOn(target);
        this.toast?.(`Focused “${target.prompt.slice(0, 30)}”`);
      }
      return;
    }
    const connectSuggest = e.target.closest("[data-connect-suggest]");
    if (connectSuggest) {
      e.stopPropagation();
      const forId = connectSuggest.dataset.forNode;
      const targetId = connectSuggest.dataset.connectSuggest;
      if (forId && targetId) {
        this.store.connectExistingNodes(forId, targetId);
        const tNode = this.store.node(targetId);
        this.toast?.(`Connected with “${(tNode?.prompt || "Node").slice(0, 30)}”`);
        this.render();
      }
      return;
    }
    const fmtBtn = e.target.closest("[data-fmt-action]");
    if (fmtBtn) {
      e.stopPropagation();
      const card = fmtBtn.closest(".card");
      if (card) this.handleFormatAction(card, fmtBtn.dataset.fmtAction, fmtBtn);
      return;
    }
    const fmtDot = e.target.closest("[data-fmt-color]");
    if (fmtDot) {
      e.stopPropagation();
      const card = fmtDot.closest(".card");
      if (card) {
        const color = fmtDot.dataset.fmtColor;
        const picker = card.querySelector("[data-fmt='textColor']");
        if (picker) picker.value = color;
        const area = card.querySelector(".card-textarea");
        if (area) area.style.color = color;
      }
      return;
    }
    const linkClick = e.target.closest("[data-link], [data-link-dot], [data-unlink]");
    if (linkClick) {
      const linkId = linkClick.dataset.link || linkClick.dataset.linkDot || linkClick.dataset.unlink;
      if (linkId) {
        if (e.altKey) {
          this.store.removeLink(linkId);
          this.refreshLinks();
          this.toast?.("Disconnected connection line (Alt+Click).");
        } else {
          this.openLinkStyleModal(linkId, e);
        }
      }
      return;
    }
    const untag = e.target.closest("[data-untag]");
    if (untag) {
      const card = untag.closest(".card");
      if (card) this.store.removeTag(card.dataset.id, untag.dataset.untag);
      return;
    }
    const stickyAction = e.target.closest("[data-sticky-action]");
    if (stickyAction) {
      const id = stickyAction.closest(".sticky")?.dataset.sticky;
      const s = this.store.sticky(id);
      if (!s) return;
      if (stickyAction.dataset.stickyAction === "delete") this.store.deleteSticky(id);
      if (stickyAction.dataset.stickyAction === "color") {
        const i = STICKY_COLORS.indexOf(s.color);
        this.store.updateSticky(id, { color: STICKY_COLORS[(i + 1) % STICKY_COLORS.length] });
      }
      return;
    }
    const shot = e.target.closest("[data-shot-index]");
    if (shot) {
      this.openImage(shot.dataset.shotNode, Number(shot.dataset.shotIndex));
      return;
    }
    const copyCode = e.target.closest("[data-copy-code]");
    if (copyCode) {
      const code = copyCode.closest(".md-code")?.querySelector("code")?.textContent || "";
      navigator.clipboard?.writeText(code).then(
        () => this.toast?.("Code copied."),
        () => this.toast?.("Clipboard blocked by the browser.")
      );
      return;
    }
    const anyCard = e.target.closest(".card");
    if (anyCard) {
      const tb = anyCard.querySelector(".card-toolbar");
      if (tb) this.armToolbarTimer(anyCard, tb, 7000);
      this.animateCardTitle(anyCard);

      // Single click on card (outside interactive buttons/inputs/links/tags) zooms to 70%
      const isInteractive = e.target.closest("button, a, input, textarea, select, [data-action], [data-focus-node], [data-connect-suggest], [data-unlink], [data-shot-index], [data-copy-code], [data-branch], .h-chip, .tag-chip");
      if (!isInteractive && !this._dragged) {
        const node = this.store.node(anyCard.dataset.id);
        if (node && !this.editingId) {
          this.smoothZoomToNode(node, 0.7);
        }
      }
    }

    const action = e.target.closest("[data-action]");
    if (!action) {
      const branch = e.target.closest("[data-branch]");
      if (branch) {
        const card = branch.closest(".card");
        this.openBranch(card.dataset.id, branch.dataset.branch);
      }
      return;
    }
    const card = action.closest(".card");
    if (!card) return;
    this.handleAction(action.dataset.action, card.dataset.id, card, action);
  }

  handleAction(action, id, cardEl, actionEl) {
    const node = this.store.node(id);
    if (!node) return;
    switch (action) {
      case "toggle-content": {
        const nextHide = !node.hideContent;
        this.store.updateNode(id, { hideContent: nextHide });
        this.toast?.(nextHide ? "Card content hidden." : "Card content revealed.");
        break;
      }
      case "audio-brief": {
        if (window.audioBriefing) {
          window.audioBriefing.playCard(node);
        } else {
          this.toast?.(`Playing card audio briefing...`);
        }
        break;
      }
      case "delete":
        this.selected.delete(id);
        this.store.deleteNode(id);
        this.toast("Node removed.");
        break;
      case "child":
        this.addChild(node, "New concept");
        break;
      case "regen":
        this.store.regenerateNode(id);
        this.toast("Regenerated concept matter.");
        break;
      case "edit":
        this.beginEdit(id);
        break;
      case "save":
        this.saveEdit(id, cardEl);
        break;
      case "cancel":
        this.editingId = null;
        this.render();
        break;
      case "copy":
        navigator.clipboard?.writeText(node.text || node.prompt).then(
          () => this.toast("Copied node text."),
          () => this.toast("Clipboard blocked by the browser.")
        );
        break;
      case "prev":
        this.store.stepVersion(id, -1);
        break;
      case "next":
        this.store.stepVersion(id, 1);
        break;
      case "autofit":
        this.store.updateNode(id, { height: Math.max(520, Math.min(960, 420 + Math.ceil((node.text.length || 0) / 70) * 26)) });
        break;
      case "image":
        this.requestImage(id);
        break;
      case "image-url":
        this.requestImageUrl(id);
        break;
      case "clone": {
        const copy = this.store.duplicateNode(id);
        if (copy) {
          this.select(copy.id);
          this.toast?.("Card duplicated.");
        }
        break;
      }
      case "save-gdocs":
        this.exportCardToGDocs(id);
        break;
      case "table":
        this.insertBlock(id, "table");
        break;
      case "code":
        this.insertBlock(id, "code");
        break;
      case "remove-image":
        this.store.removeNodeImage(id, actionEl?.dataset.image);
        this.toast?.("Image removed.");
        break;
      case "color":
      case "color-palette":
        this.openColorPalette(id, actionEl);
        break;
      case "tag":
        if (this.onTag) this.onTag(id);
        else this.addTagPrompt(id);
        break;
      case "suggest-modal": {
        const nodeId = actionEl?.dataset?.nodeId || id;
        this.openSuggestedNodesModal(nodeId);
        break;
      }
      case "link":
        if (this.linkFrom === id) {
          this.linkFrom = null;
          this.toast("Link cancelled.");
        } else if (this.linkFrom) {
          this.store.addLink(this.linkFrom, id);
          this.toast("Relationship linked.");
          this.linkFrom = null;
        } else {
          this.linkFrom = id;
          this.toast("Select a second node to link.");
        }
        this.render();
        break;
      default:
        break;
    }
  }

  requestImageUrl(id) {
    const node = this.store.node(id);
    if (!node) return;
    if ((node.images || []).length >= 6) {
      this.toast?.("This card already holds 6 images — remove one first.");
      return;
    }
    const sample = "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80";
    const raw = window.prompt("Enter image web URL (https://...):", sample);
    if (!raw || !raw.trim()) return;
    let url = raw.trim();
    if (!/^https?:\/\//i.test(url) && !url.startsWith("data:")) {
      url = `https://${url}`;
    }
    this.addImageUrlToNode(id, url);
  }

  async addImageUrlToNode(id, url) {
    const node = this.store.node(id);
    if (!node) return;
    this.toast?.("Attaching image by URL…");
    const filename = url.split("/").pop()?.split("?")[0] || "web-image.jpg";
    const imgObj = {
      id: `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: filename.slice(0, 32),
      dataUrl: url,
      width: 600,
      height: 400,
      bytes: 0,
      isUrl: true,
    };

    // Pre-test image loading to detect natural width & height if accessible
    const probe = new Image();
    probe.onload = () => {
      if (probe.naturalWidth && probe.naturalHeight) {
        imgObj.width = probe.naturalWidth;
        imgObj.height = probe.naturalHeight;
      }
    };
    probe.src = url;

    if (this.store.addNodeImage(id, imgObj)) {
      const current = this.store.node(id);
      const needed = 340 + Math.ceil((current?.images || []).length / 2) * 103;
      if (current && current.height < needed) {
        this.store.updateNode(id, { height: Math.min(900, needed) });
      }
      this.toast?.(`Image attached from URL to “${node.prompt.slice(0, 28)}…”`);
    } else {
      this.toast?.("Could not add image (limit of 6 reached).");
    }
  }

  async exportCardToGDocs(id) {
    const node = this.store.node(id);
    if (!node) return;
    const title = node.prompt || "BrainVault Note";
    const bodyHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;line-height:1.6;padding:24px;color:#1e293b}h1{color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:8px}</style></head><body><h1>${escapeHtml(title)}</h1><p><em>Exported from BrainVault Spatial Engine on ${new Date().toLocaleString()}</em></p><hr/><div>${(node.text || "").replace(/\n\n/g, "<p></p>").replace(/\n/g, "<br/>")}</div></body></html>`;

    // Copy to clipboard
    const fullText = `# ${title}\n\nExported from BrainVault on ${new Date().toLocaleString()}\n\n${node.text || ""}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(fullText);
      }
    } catch (_) {}

    // Save to server cloud folder
    try {
      await fetch("/api/gdrive/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: bodyHtml }),
      });
    } catch (_) {}

    const openNow = window.confirm(`"${title}" has been copied to your clipboard and synced to cloud storage!\n\nClick OK to open Google Docs (docs.new) in a new tab so you can paste (Ctrl+V) and save directly to your Google Cloud Drive.`);
    if (openNow) {
      window.open("https://docs.new", "_blank");
    }
    this.toast?.("Note copied & synced for Google Docs / Google Drive!");
  }

  openColorPalette(id, anchorEl) {
    const node = this.store.node(id);
    if (!node) return;

    // Toggle behavior: if already open on this node, close it
    if (this.activePaletteNodeId === id) {
      this.closeColorPalette();
      return;
    }

    // Close any previous palette
    this.closeColorPalette(false);

    const cardEl = this.stage.querySelector(`.card[data-id="${id}"]`);
    if (!cardEl) return;

    this.activePaletteNodeId = id;

    const popover = document.createElement("div");
    popover.className = "card-color-popover";
    popover.dataset.paletteNode = id;
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", "Card Colour Palette");

    // Smart positioning relative to anchor button if inside toolbar
    if (anchorEl && anchorEl.closest && anchorEl.closest(".card-toolbar")) {
      popover.style.top = "10px";
      popover.style.left = "8px";
      popover.style.right = "auto";
    }

    const currentColor = (node.color || "#e0f2fe").toLowerCase();
    const swatchesHtml = LIGHT_PASTEL_PALETTE.map((c) => {
      const isActive = currentColor === c.hex.toLowerCase();
      return `
        <button type="button" class="color-swatch-btn ${isActive ? "is-active" : ""}" data-color-hex="${c.hex}" data-color-name="${escapeAttr(c.name)}" title="${escapeAttr(c.name)} (${c.hex})">
          <span class="color-swatch-circle" style="background:${c.hex}"></span>
          <span class="color-swatch-name">${escapeHtml(c.name)}</span>
        </button>
      `;
    }).join("");

    const renderCustomSwatches = (activeColor) => {
      const customColors = getSavedCustomColors();
      if (!customColors.length) {
        return `<div class="card-color-empty-custom">No custom colours added yet. Pick any colour below and click <b>+ Add to My Colours</b>!</div>`;
      }
      return customColors.map((hex) => {
        const isActive = activeColor.toLowerCase() === hex.toLowerCase();
        return `
          <div class="my-color-item">
            <button type="button" class="color-swatch-btn my-color-swatch ${isActive ? "is-active" : ""}" data-color-hex="${hex}" data-color-name="Custom ${hex}" title="Custom colour ${hex}">
              <span class="color-swatch-circle" style="background:${hex}"></span>
              <span class="color-swatch-name">${hex.toUpperCase()}</span>
            </button>
            <button type="button" class="my-color-remove-btn" data-remove-custom="${hex}" title="Remove ${hex} from my custom colors">×</button>
          </div>
        `;
      }).join("");
    };

    popover.innerHTML = `
      <div class="card-color-popover-head">
        <div class="card-color-popover-title">
          ${icon("palette", 14)} <span>Card Colour</span>
        </div>
        <span class="card-color-popover-badge">Light & Decent</span>
        <button type="button" class="card-color-popover-close" data-palette-close title="Close colour palette">×</button>
      </div>

      <div class="card-color-popover-sub">
        <span>CURATED PASTEL PALETTE</span>
        <span>${LIGHT_PASTEL_PALETTE.length} SHADES</span>
      </div>
      <div class="card-color-grid">
        ${swatchesHtml}
      </div>

      <div class="card-color-popover-sub">
        <span>MY CUSTOM COLOURS</span>
        <button type="button" class="btn-text-sub add-current-color-btn" data-save-current title="Add current colour to My Custom Colours">+ Add Current</button>
      </div>
      <div class="card-custom-colors-grid">
        ${renderCustomSwatches(currentColor)}
      </div>

      <div class="card-color-popover-sub">
        <span>CUSTOM COLOUR PICKER</span>
        <span class="color-hex-display">${currentColor.toUpperCase()}</span>
      </div>
      <div class="card-color-custom-section">
        <div class="card-color-custom-row">
          <div class="custom-color-picker-wrap" style="background:${currentColor}">
            <input type="color" class="custom-color-input" value="${currentColor.startsWith('#') && currentColor.length === 7 ? currentColor : '#e0f2fe'}" title="Pick custom colour from system palette" />
          </div>
          <input type="text" class="custom-color-hex-input" value="${currentColor}" placeholder="#e0f2fe" maxlength="7" spellcheck="false" title="Enter hex color code" />
          <button type="button" class="custom-color-apply-btn" data-apply-custom title="Apply custom colour">Apply</button>
          <button type="button" class="custom-color-save-btn" data-save-custom title="Save to My Custom Colours">+ Add to My Colours</button>
        </div>
        <div class="card-color-custom-hint">
          <span>Auto-softened to light pastel paper tone</span>
          <span>Crisp dark text contrast</span>
        </div>
      </div>
    `;

    // Prevent popover events from propagating to canvas (prevents drag / panning)
    popover.addEventListener("pointerdown", (e) => e.stopPropagation());
    popover.addEventListener("mousedown", (e) => e.stopPropagation());
    popover.addEventListener("click", (e) => e.stopPropagation());
    popover.addEventListener("dblclick", (e) => e.stopPropagation());

    const hexInput = popover.querySelector(".custom-color-hex-input");
    const colorPicker = popover.querySelector(".custom-color-input");
    const pickerWrap = popover.querySelector(".custom-color-picker-wrap");
    const hexDisplay = popover.querySelector(".color-hex-display");
    const customGrid = popover.querySelector(".card-custom-colors-grid");

    const refreshCustomSwatches = (activeHex) => {
      if (customGrid) {
        customGrid.innerHTML = renderCustomSwatches(activeHex);
        bindCustomGridEvents();
      }
    };

    const bindCustomGridEvents = () => {
      if (!customGrid) return;
      customGrid.querySelectorAll("[data-color-hex]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const hex = btn.dataset.colorHex;
          updateActiveColor(hex);
          this.toast?.(`Custom colour applied: ${hex}`);
        });
      });
      customGrid.querySelectorAll("[data-remove-custom]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const hex = btn.dataset.removeCustom;
          removeCustomColor(hex);
          const current = hexInput ? hexInput.value : currentColor;
          refreshCustomSwatches(current);
          this.toast?.(`Removed ${hex} from My Custom Colours.`);
        });
      });
    };

    const updateActiveColor = (color) => {
      const safeColor = ensureLightDecentColor(color);
      if (hexInput) hexInput.value = safeColor;
      if (colorPicker && safeColor.length === 7) colorPicker.value = safeColor;
      if (pickerWrap) pickerWrap.style.background = safeColor;
      if (hexDisplay) hexDisplay.textContent = safeColor.toUpperCase();
      popover.querySelectorAll(".color-swatch-btn").forEach((b) => {
        b.classList.toggle("is-active", b.dataset.colorHex?.toLowerCase() === safeColor.toLowerCase());
      });
      this.applyCardColor(id, safeColor);
    };

    // Close button
    popover.querySelector("[data-palette-close]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeColorPalette();
    });

    // Curated swatches click
    popover.querySelectorAll(".card-color-grid [data-color-hex]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const hex = btn.dataset.colorHex;
        const name = btn.dataset.colorName;
        updateActiveColor(hex);
        this.toast?.(`Card colour: ${name} (${hex})`);
      });
    });

    // Custom color picker live updates
    const onCustomPicker = (e) => {
      const val = e.target.value;
      updateActiveColor(val);
    };
    colorPicker?.addEventListener("input", onCustomPicker);
    colorPicker?.addEventListener("change", onCustomPicker);

    // Custom hex input live / apply
    const applyHexFromInput = () => {
      let val = hexInput.value.trim();
      if (!val.startsWith("#")) val = "#" + val;
      if (/^#[0-9a-fA-F]{6}$/.test(val) || /^#[0-9a-fA-F]{3}$/.test(val)) {
        updateActiveColor(val);
        this.toast?.(`Custom colour applied: ${hexInput.value.toUpperCase()}`);
      }
    };

    hexInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyHexFromInput();
      }
    });

    popover.querySelector("[data-apply-custom]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      applyHexFromInput();
    });

    // Save custom color to palette
    const onSaveCustomColor = (e) => {
      e.stopPropagation();
      let val = hexInput ? hexInput.value.trim() : currentColor;
      const safe = ensureLightDecentColor(val);
      saveCustomColor(safe);
      updateActiveColor(safe);
      refreshCustomSwatches(safe);
      this.toast?.(`Saved ${safe.toUpperCase()} to My Custom Colours!`);
    };

    popover.querySelectorAll("[data-save-custom], [data-save-current]").forEach((btn) => {
      btn.addEventListener("click", onSaveCustomColor);
    });

    bindCustomGridEvents();

    cardEl.appendChild(popover);

    // Outside click & Escape listener
    const onOutside = (e) => {
      if (!popover.contains(e.target) && !e.target.closest('[data-action="color-palette"]') && !e.target.closest('[data-action="color"]')) {
        cleanup();
        this.closeColorPalette();
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        cleanup();
        this.closeColorPalette();
      }
    };
    const cleanup = () => {
      document.removeEventListener("pointerdown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
    this._paletteCleanup = cleanup;
    document.addEventListener("pointerdown", onOutside);
    document.addEventListener("keydown", onKey);
  }

  applyCardColor(id, color) {
    if (!color) return;
    const safeColor = ensureLightDecentColor(color);

    // 1. Immediately update DOM element in real-time
    const cardEl = this.stage.querySelector(`.card[data-id="${id}"]`);
    if (cardEl) {
      cardEl.style.setProperty("--card", safeColor);
      cardEl.style.backgroundColor = safeColor;
      const dot = cardEl.querySelector(".tool-dot");
      if (dot) dot.style.setProperty("--dot", safeColor);
      const dotSwatch = cardEl.querySelector(".tool-dot-swatch");
      if (dotSwatch) dotSwatch.style.backgroundColor = safeColor;
      const chipCircle = cardEl.querySelector(".color-chip-circle");
      if (chipCircle) chipCircle.style.backgroundColor = safeColor;
    }

    // 2. Persist in store (records undo state, updates localStorage, triggers db sync)
    this.store.updateNode(id, { color: safeColor });
    if (typeof this.store.saveToDatabase === "function") {
      this.store.saveToDatabase().catch((e) => console.warn("DB save deferred:", e));
    }

    // 3. Immediately update 3D textures in Three.js
    if (window.tree3d && typeof window.tree3d.buildGraph3D === "function") {
      window.tree3d.buildGraph3D();
    }
  }

  closeColorPalette(doRender = true) {
    if (this._paletteCleanup) {
      this._paletteCleanup();
      this._paletteCleanup = null;
    }
    this.activePaletteNodeId = null;
    const existing = document.querySelectorAll(".card-color-popover");
    existing.forEach((el) => el.remove());
    if (doRender) {
      this.render();
    }
  }

  cycleColor(id, node) {
    this.openColorPalette(id);
  }

  addTagPrompt(id) {
    const tag = window.prompt("Add a category label or tag:");
    if (tag) this.store.addTag(id, tag);
  }

  openBranch(parentId, prompt) {
    const existing = this.store.nodes().find((n) => n.parentId === parentId && n.prompt.includes(prompt));
    if (existing) {
      this.select(existing.id);
      this.centerOn(existing);
      return;
    }
    this.addChild(this.store.node(parentId), prompt);
  }

  addChild(parent, prompt) {
    if (!parent) return;
    const siblings = this.store.nodes().filter((n) => n.parentId === parent.id).length;
    const cardWidth = Math.max(760, parent.width || 760);
    const cardHeight = Math.max(580, parent.height || 580);
    const cleanParentTitle = parent.prompt.replace(/^(Node|Sub-Node)\s*\d*:\s*/i, "");
    const childPrompt = prompt && prompt !== "New concept" 
      ? prompt 
      : `${cleanParentTitle}: Sub-Concept ${siblings + 1}`;

    const node = this.store.createNode({
      prompt: childPrompt,
      parentId: parent.id,
      color: parent.color, // Inherit same colour property from selected card
      fontFamily: parent.fontFamily,
      fontSize: parent.fontSize,
      textColor: parent.textColor,
      fontBold: parent.fontBold,
      fontItalic: parent.fontItalic,
      x: parent.x + (parent.width || 760) + 140,
      y: parent.y + siblings * (cardHeight + 40),
      width: cardWidth,
      height: cardHeight,
    });

    // Make sure child link inherits parent's color if custom
    if (parent.color) {
      const link = this.store.links().find((l) => l.sourceId === parent.id && l.targetId === node.id);
      if (link && !link.color) {
        link.color = parent.color;
      }
    }

    this.select(node.id);
    this.centerOn(node);

    // Audio SFX conduit feedback
    if (window.sfx) {
      window.sfx.play("conduitPulse");
    }

    this.toast?.(`Created connected child node from “${cleanParentTitle.slice(0, 22)}” with matching color & neural conduit.`);
  }

  beginEdit(id) {
    this.editingId = id;
    this.render();
    const el = this.stage.querySelector(`.card[data-id="${id}"] .card-textarea`);
    el?.focus();
  }

  saveEdit(id, cardEl) {
    const area = cardEl.querySelector(".card-textarea");
    if (!area) return;
    this.editingId = null;
    const node = this.store.node(id);
    const fontSel = cardEl.querySelector("[data-fmt='fontFamily']");
    const sizeSel = cardEl.querySelector("[data-fmt='fontSize']");
    const colorInput = cardEl.querySelector("[data-fmt='textColor']");
    const boldBtn = cardEl.querySelector("[data-fmt-action='bold']");
    const italicBtn = cardEl.querySelector("[data-fmt-action='italic']");

    const fontFamily = fontSel ? fontSel.value : (node.fontFamily || "Space Grotesk");
    const fontSize = sizeSel ? sizeSel.value : (node.fontSize || "14px");
    const textColor = colorInput ? colorInput.value : (node.textColor || "");
    const fontBold = boldBtn ? boldBtn.classList.contains("is-active") : Boolean(node.fontBold);
    const fontItalic = italicBtn ? italicBtn.classList.contains("is-active") : Boolean(node.fontItalic);

    this.store.updateNode(id, {
      text: area.value,
      fontFamily,
      fontSize,
      textColor,
      fontBold,
      fontItalic,
      versions: node.versions.map((v, i) => (i === node.versionIndex ? { ...v, text: area.value } : v)),
    });
    this.toast("Note & typography saved.");
  }

  handleFormatAction(cardEl, action, btn) {
    const area = cardEl.querySelector(".card-textarea");
    if (!area) return;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const val = area.value;
    const selected = val.substring(start, end);

    let replacement = "";
    let newCursorPos = start;

    switch (action) {
      case "bold": {
        if (selected) {
          replacement = `**${selected}**`;
          newCursorPos = start + replacement.length;
        } else {
          btn.classList.toggle("is-active");
          const isBold = btn.classList.contains("is-active");
          area.style.fontWeight = isBold ? "bold" : "normal";
          return;
        }
        break;
      }
      case "italic": {
        if (selected) {
          replacement = `*${selected}*`;
          newCursorPos = start + replacement.length;
        } else {
          btn.classList.toggle("is-active");
          const isItalic = btn.classList.contains("is-active");
          area.style.fontStyle = isItalic ? "italic" : "normal";
          return;
        }
        break;
      }
      case "h1": {
        replacement = `\n# ${selected || "Heading 1"}\n`;
        newCursorPos = start + replacement.length;
        break;
      }
      case "h2": {
        replacement = `\n## ${selected || "Heading 2"}\n`;
        newCursorPos = start + replacement.length;
        break;
      }
      case "h3": {
        replacement = `\n### ${selected || "Heading 3"}\n`;
        newCursorPos = start + replacement.length;
        break;
      }
      case "bullet": {
        replacement = `\n- ${selected || "Key concept point"}\n`;
        newCursorPos = start + replacement.length;
        break;
      }
      case "numlist": {
        replacement = `\n1. ${selected || "Numbered research point"}\n`;
        newCursorPos = start + replacement.length;
        break;
      }
      case "colortag": {
        const picker = cardEl.querySelector("[data-fmt='textColor']");
        const col = picker?.value || "#0284c7";
        replacement = `<color=${col}>${selected || "highlighted text"}</color>`;
        newCursorPos = start + replacement.length;
        break;
      }
      default:
        break;
    }

    if (replacement) {
      area.value = val.substring(0, start) + replacement + val.substring(end);
      area.focus();
      area.setSelectionRange(newCursorPos, newCursorPos);
    }
  }

  openLinkStyleModal(linkId, evt) {
    const ws = this.store.state.activeWorkspaceId;
    const links = this.store.links(ws);
    const link = links.find((l) => l.id === linkId);
    if (!link) return;

    const modalRoot = document.querySelector("#modalRoot");
    if (!modalRoot) return;

    const sourceNode = this.store.node(link.sourceId);
    const targetNode = this.store.node(link.targetId);

    const colors = [
      { name: "Cyan", val: "#22d3ee" },
      { name: "Emerald", val: "#10b981" },
      { name: "Blue", val: "#3b82f6" },
      { name: "Purple", val: "#a855f7" },
      { name: "Rose", val: "#f43f5e" },
      { name: "Amber", val: "#f59e0b" },
      { name: "Lime", val: "#84cc16" },
      { name: "Teal", val: "#14b8a6" },
      { name: "White", val: "#ffffff" }
    ];

    const patterns = [
      { id: "solid", name: "Solid Line —" },
      { id: "dashed", name: "Dashed Line - - -" },
      { id: "dotted", name: "Dotted Line · · ·" },
      { id: "dash-dot", name: "Dash-Dot — · —" }
    ];

    const curColor = link.color || "#22d3ee";
    const curPattern = link.pattern || "solid";

    modalRoot.innerHTML = `
      <div class="modal is-open">
        <div class="modal-card link-style-modal" style="max-width: 440px;">
          <div class="modal-head">
            <h3>🔗 Connection Line Appearance</h3>
            <button class="modal-close" data-cmd="close">×</button>
          </div>
          <div class="modal-body" style="padding: 16px; display: flex; flex-direction: column; gap: 14px;">
            <p style="font-size: 12px; color: var(--muted); margin: 0;">
              Connected between <b>${escapeHtml(sourceNode?.prompt || "Source")}</b> and <b>${escapeHtml(targetNode?.prompt || "Target")}</b>
            </p>

            <div>
              <label style="font-family: var(--mono); font-size: 11px; font-weight: 700; color: #38bdf8; display: block; margin-bottom: 6px;">LINE COLOR</label>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                ${colors.map((c) => `
                  <button type="button" class="link-col-btn ${curColor === c.val ? 'is-selected' : ''}" data-link-color="${c.val}" title="${c.name}" style="width: 26px; height: 26px; border-radius: 50%; background: ${c.val}; border: 2px solid ${curColor === c.val ? '#ffffff' : 'rgba(0,0,0,0.4)'}; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></button>
                `).join("")}
                <input type="color" id="customLinkColor" value="${curColor}" style="width: 32px; height: 28px; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; background: transparent;" title="Pick custom color"/>
              </div>
            </div>

            <div>
              <label style="font-family: var(--mono); font-size: 11px; font-weight: 700; color: #38bdf8; display: block; margin-bottom: 6px;">LINE PATTERN</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                ${patterns.map((p) => `
                  <button type="button" class="btn small link-pat-btn ${curPattern === p.id ? 'primary' : ''}" data-link-pattern="${p.id}" style="font-family: var(--mono); font-size: 11px; text-align: left;">
                    ${p.name}
                  </button>
                `).join("")}
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
              <button type="button" class="btn small danger" id="btnDisconnectLinkModal">Disconnect Link</button>
              <button type="button" class="btn small primary" data-cmd="close">Done</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const closeBtn = modalRoot.querySelector('[data-cmd="close"]');
    closeBtn?.addEventListener("click", () => { modalRoot.innerHTML = ""; });
    const modalBackdrop = modalRoot.querySelector(".modal");
    modalBackdrop?.addEventListener("click", (e) => {
      if (e.target === modalBackdrop) modalRoot.innerHTML = "";
    });

    modalRoot.querySelectorAll("[data-link-color]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const col = btn.dataset.linkColor;
        this.store.updateLink(linkId, { color: col });
        this.refreshLinks();
        this.toast?.(`Updated connection line color to ${col}`);
        this.openLinkStyleModal(linkId);
      });
    });

    const customColInput = modalRoot.querySelector("#customLinkColor");
    customColInput?.addEventListener("change", (e) => {
      const col = e.target.value;
      this.store.updateLink(linkId, { color: col });
      this.refreshLinks();
      this.toast?.(`Updated connection line color to ${col}`);
      this.openLinkStyleModal(linkId);
    });

    modalRoot.querySelectorAll("[data-link-pattern]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pat = btn.dataset.linkPattern;
        this.store.updateLink(linkId, { pattern: pat });
        this.refreshLinks();
        this.toast?.(`Updated connection line pattern to ${pat}`);
        this.openLinkStyleModal(linkId);
      });
    });

    modalRoot.querySelector("#btnDisconnectLinkModal")?.addEventListener("click", () => {
      this.store.removeLink(linkId);
      modalRoot.innerHTML = "";
      this.refreshLinks();
      this.toast?.("Disconnected connection link.");
    });
  }

  openSuggestedNodesModal(nodeId) {
    const node = this.store.node(nodeId);
    if (!node) return;
    const modalRoot = document.querySelector("#modalRoot");
    if (!modalRoot) return;

    const allWorkspaceNodes = this.store.nodes().filter((n) => n.id !== nodeId);

    modalRoot.classList.remove("is-hidden");
    const renderList = (filter = "") => {
      const q = filter.trim().toLowerCase();
      const list = allWorkspaceNodes.filter(
        (n) => !q || n.prompt.toLowerCase().includes(q) || (n.tags || []).some((t) => t.toLowerCase().includes(q))
      );

      const itemsHtml = list.length
        ? list
            .map((cand) => {
              const isChild = cand.parentId === nodeId;
              const isParent = node.parentId === cand.id;
              const isLinked = this.store.links().some(
                (l) => (l.sourceId === nodeId && l.targetId === cand.id) || (l.sourceId === cand.id && l.targetId === nodeId)
              );
              let status = "Not connected";
              if (isChild) status = "Sub-Node";
              else if (isParent) status = "Parent Node";
              else if (isLinked) status = "Linked";

              return `<div class="suggest-modal-item suggest-row">
                <span class="suggest-dot" style="background:${cand.color || '#22d3ee'}"></span>
                <div class="suggest-info suggest-meta">
                  <strong class="suggest-title">${escapeHtml(cand.prompt)}</strong>
                  <span class="suggest-sub suggest-reason">${cand.parentId ? "Sub-Node" : "Primary Node"} · ${(cand.tags || []).slice(0, 3).map((t) => `#${t}`).join(" ") || "No tags"} · Status: <em>${status}</em></span>
                </div>
                <div class="suggest-actions">
                  ${
                    !isLinked && !isParent && !isChild
                      ? `
                    <button class="btn tiny primary" data-modal-connect="link" data-target="${cand.id}">+ Link</button>
                    <button class="btn tiny accent-emerald" data-modal-connect="sub" data-target="${cand.id}">+ Make Sub-Node</button>
                  `
                      : `<span class="suggest-connected-badge">Connected</span>`
                  }
                </div>
              </div>`;
            })
            .join("")
        : `<div class="suggest-empty">No other workspace nodes found. Use Explore or "+ Note" to add concepts!</div>`;

      modalRoot.innerHTML = `
        <div class="modal-card suggest-modal-box">
          <div class="modal-head">
            <div>
              <h3>Connect Existing Nodes to “${escapeHtml(node.prompt)}”</h3>
              <p class="modal-sub">Browse existing workspace nodes and connect as sub-node or link with distinct colors.</p>
            </div>
            <button class="modal-close" data-close-modal title="Close modal">×</button>
          </div>
          <div class="suggest-search-wrap">
            <input type="text" id="suggestSearchInput" class="suggest-search-input" placeholder="Search existing nodes by keyword or tag..." value="${escapeAttr(filter)}" />
          </div>
          <div class="suggest-list-wrap suggest-list">
            ${itemsHtml}
          </div>
        </div>
      `;

      modalRoot.querySelector("[data-close-modal]")?.addEventListener("click", () => {
        modalRoot.classList.add("is-hidden");
        modalRoot.innerHTML = "";
      });

      const searchInput = modalRoot.querySelector("#suggestSearchInput");
      searchInput?.addEventListener("input", (e) => {
        renderList(e.target.value);
        const nextInput = modalRoot.querySelector("#suggestSearchInput");
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
        }
      });

      modalRoot.querySelectorAll("[data-modal-connect]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const type = btn.dataset.modalConnect;
          const targetId = btn.dataset.target;
          if (type === "link") {
            const ok = this.store.connectExistingNodes(nodeId, targetId);
            if (ok) this.toast?.(`Linked with “${this.store.node(targetId)?.prompt || 'Node'}”`);
          } else if (type === "sub") {
            const ok = this.store.connectExistingAsSubNode(nodeId, targetId);
            if (ok) {
              this.toast?.(`Connected “${this.store.node(targetId)?.prompt || 'Node'}” as Sub-Node`);
            } else {
              this.toast?.("Cannot make sub-node: would create a circular loop.");
            }
          }
          this.render();
          renderList(modalRoot.querySelector("#suggestSearchInput")?.value || "");
        });
      });
    };

    renderList();
  }

  onDoubleClick(e) {
    // Check if double-clicked on a connection line or dot
    const linkPath = e.target.closest("[data-link], [data-link-dot], [data-unlink]");
    if (linkPath) {
      const linkId = linkPath.dataset.link || linkPath.dataset.linkDot || linkPath.dataset.unlink;
      if (linkId) {
        this.openLinkStyleModal(linkId, e);
        return;
      }
    }

    const card = e.target.closest(".card");
    if (card) {
      if (e.target.closest("button, textarea, input")) return;
      this.beginEdit(card.dataset.id);
      return;
    }
    const sticky = e.target.closest(".sticky");
    if (sticky) {
      if (e.target.closest("button")) return;
      this.editingStickyId = sticky.dataset.sticky;
      this.render();
      const area = this.stage.querySelector(`.sticky[data-sticky="${sticky.dataset.sticky}"] .sticky-input`);
      area?.focus();
      area?.addEventListener("blur", () => this.commitSticky(sticky.dataset.sticky), { once: true });
      area?.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") this.commitSticky(sticky.dataset.sticky);
      });
      return;
    }
  }

  commitSticky(id) {
    const area = this.stage.querySelector(`.sticky[data-sticky="${id}"] .sticky-input`);
    if (!area) return;
    this.editingStickyId = null;
    this.store.updateSticky(id, { text: area.value });
  }

  onKey(e) {
    if (e.target.closest?.("textarea, input")) {
      if (e.key === "Escape") {
        if (this.editingId) {
          this.editingId = null;
          this.render();
        }
      }
      return;
    }
    if (e.key === "Escape") {
      this.select(null);
      this.linkFrom = null;
      this.render();
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (this.selected.size) {
        for (const id of [...this.selected]) this.store.deleteNode(id);
        this.selected.clear();
        this.render();
      }
    }
  }
}


function nextCardColor(current) {
  const i = CARD_COLORS.indexOf(current);
  return CARD_COLORS[(i + 1) % CARD_COLORS.length];
}

function boundsOf(items) {
  const minX = Math.min(...items.map((i) => i.x));
  const minY = Math.min(...items.map((i) => i.y));
  const maxX = Math.max(...items.map((i) => i.x + i.width));
  const maxY = Math.max(...items.map((i) => i.y + i.height));
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

// Minimal markdown renderer with glossary links.
const isTableRow = (line) => /^\|.*\|$/.test(line.trim());
const isTableSeparator = (line) => /^\|[\s:|-]+\|$/.test(line.trim()) && line.includes("-");
const splitRow = (line) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function renderMarkdown(text) {
  if (!text) return "";
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let buffer = [];

  const flush = () => {
    if (!buffer.length) return;
    const block = buffer.join("\n");
    buffer = [];
    out.push(renderBlock(block));
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      flush();
      const lang = fence[1].trim();
      const code = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      out.push(renderCodeBlock(code.join("\n"), lang));
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^#{1,4}\s+/.test(line)) {
      flush();
      out.push(renderBlock(line));
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flush();
      const listLines = [line];
      while (i + 1 < lines.length && /^[-*]\s+/.test(lines[i + 1])) {
        listLines.push(lines[++i]);
      }
      out.push(renderBlock(listLines.join("\n")));
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      flush();
      const listLines = [line];
      while (i + 1 < lines.length && /^\d+\.\s+/.test(lines[i + 1])) {
        listLines.push(lines[++i]);
      }
      out.push(renderBlock(listLines.join("\n")));
      continue;
    }
    buffer.push(line);
  }
  flush();
  return out.join("");
}

function renderBlock(block) {
  const trimmed = block.trim();
  if (!trimmed) return "";
  const lines = trimmed.split(/\n/);
  if (lines.length >= 2 && isTableRow(lines[0]) && isTableSeparator(lines[1])) {
    const head = `<tr>${splitRow(lines[0]).map((c) => `<th>${inline(c)}</th>`).join("")}</tr>`;
    const body = lines
      .slice(2)
      .filter(isTableRow)
      .map((row) => `<tr>${splitRow(row).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
      .join("");
    return `<div class="md-table-wrap"><table class="md-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
  }
  const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
  if (heading) {
    const level = heading[1].length;
    return `<h${level} class="md-h${level} note-h${level}">${inline(heading[2])}</h${level}>`;
  }
  if (/^[-*]\s+/m.test(trimmed)) {
    const items = trimmed
      .split(/\n/)
      .filter((l) => /^[-*]\s+/.test(l))
      .map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ""))}</li>`)
      .join("");
    return `<ul class="note-ul">${items}</ul>`;
  }
  if (/^\d+\.\s+/m.test(trimmed)) {
    const items = trimmed
      .split(/\n/)
      .filter((l) => /^\d+\.\s+/.test(l))
      .map((l) => `<li>${inline(l.replace(/^\d+\.\s+/, ""))}</li>`)
      .join("");
    return `<ol class="note-ol">${items}</ol>`;
  }
  return `<p>${inline(trimmed).replace(/\n/g, "<br/>")}</p>`;
}

const CODE_KEYWORDS = /\b(const|let|var|function|return|if|else|for|while|do|class|extends|new|async|await|import|from|export|default|try|catch|finally|throw|typeof|instanceof|this|true|false|null|undefined|def|elif|lambda|pass|raise|with|as|yield|struct|enum|fn|pub|mut|use|impl|match|print|echo)\b/g;

function highlightCode(code, lang) {
  const escaped = escapeHtml(code);
  const tokens = [];
  const stash = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  let out = escaped;
  // Comments first, then strings, keywords and numbers. Placeholders keep
  // later passes from rewriting markup inside earlier tokens.
  out = out.replace(/(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/g, (m) => stash(`<span class="tok-com">${m}</span>`));
  out = out.replace(/(&quot;.*?&quot;|&#39;.*?&#39;|`[^`]*`)/g, (m) => stash(`<span class="tok-str">${m}</span>`));
  out = out.replace(CODE_KEYWORDS, (m) => stash(`<span class="tok-key">${m}</span>`));
  out = out.replace(/\b(\d+(?:\.\d+)?)\b/g, (m) => stash(`<span class="tok-num">${m}</span>`));
  out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)] || "");
  return `<div class="md-code"><div class="md-code-head"><span>${escapeHtml(lang || "code")}</span><button class="md-code-copy" data-copy-code title="Copy code">COPY</button></div><pre><code>${out}</code></pre></div>`;
}

function renderCodeBlock(code, lang) {
  if (!code) return "";
  return highlightCode(code, lang);
}

// Inline markdown: images, links, glossary terms, bold, italic, code, colors.
function inline(text) {
  let out = escapeHtml(text);
  // Images first, so ![alt](url) is never mistaken for a glossary link.
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => `<img class="md-img" src="${url}" alt="${alt}" loading="lazy">`);
  out = out.replace(/\*\*\[([^\]]+)\]\(([^)]+)\)\*\*/g, (_, label, term) => `<strong>${term_btn(term, label)}</strong>`);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, term) => term_btn(term, label));
  // Bold & Italic (***text***)
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  // Bold (**text** or __text__)
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // Italic (*text* or _text_)
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1<em>$2</em>");
  out = out.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  // Colored text tags: <color=#...>text</color>
  out = out.replace(/&lt;color=([#a-zA-Z0-9]+)&gt;(.*?)&lt;\/color&gt;/gi, '<span style="color:$1;font-weight:600">$2</span>');
  out = out.replace(/&lt;span style=&quot;color:\s*([#a-zA-Z0-9]+)&quot;&gt;(.*?)&lt;\/span&gt;/gi, '<span style="color:$1">$2</span>');
  // Bare URLs become real links (imported feed stories, pasted links).
  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<>()]+)/g, (_, pre, url) => {
    const clean = url.replace(/[.,;:]+$/, "");
    const rest = url.slice(clean.length);
    return `${pre}<a class="card-link" href="${clean}" target="_blank" rel="noreferrer">${clean}</a>${rest}`;
  });
  return out;
}

function term_btn(term, label) {
  return `<button class="gloss" data-term="${escapeAttr(term.trim())}" title="Open dictionary branch">${escapeHtml(label.trim())}</button>`;
}