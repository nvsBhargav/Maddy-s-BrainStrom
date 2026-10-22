// BrainVault Quick Command Palette (Cmd+K / Ctrl+K)
// Spotlight / Raycast-style cyber command bar for keyboard-first navigation and actions.

export class CommandPalette {
  constructor({ store, canvas, ui, sfx, toast } = {}) {
    this.store = store;
    this.canvas = canvas;
    this.ui = ui;
    this.sfx = sfx;
    this.toast = toast;
    this.isOpen = false;
    this.query = "";
    this.selectedIndex = 0;
    this.items = [];

    this.initDOM();
    this.bindKeyboard();
  }

  initDOM() {
    this.backdrop = document.createElement("div");
    this.backdrop.id = "commandPaletteBackdrop";
    this.backdrop.className = "cmd-palette-backdrop is-hidden";
    this.backdrop.setAttribute("role", "dialog");
    this.backdrop.setAttribute("aria-modal", "true");
    this.backdrop.setAttribute("aria-label", "Command Palette");

    this.backdrop.innerHTML = `
      <div class="cmd-palette-box">
        <div class="cmd-palette-search">
          <span class="cmd-search-icon">⌘</span>
          <input type="text" id="cmdPaletteInput" class="cmd-palette-input" placeholder="Type a command, search card, switch theme, or export..." autocomplete="off" spellcheck="false" />
          <span class="cmd-esc-badge">ESC</span>
        </div>
        <div class="cmd-palette-list" id="cmdPaletteList" role="listbox"></div>
        <div class="cmd-palette-footer">
          <div class="cmd-footer-keys">
            <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
            <span><kbd>↵</kbd> Select</span>
            <span><kbd>ESC</kbd> Close</span>
          </div>
          <span class="cmd-footer-brand">BrainVault Spotlight</span>
        </div>
      </div>
    `;

    document.body.appendChild(this.backdrop);

    this.input = this.backdrop.querySelector("#cmdPaletteInput");
    this.list = this.backdrop.querySelector("#cmdPaletteList");

    this.backdrop.addEventListener("click", (e) => {
      if (e.target === this.backdrop) this.close();
    });

    this.input.addEventListener("input", (e) => {
      this.query = e.target.value.toLowerCase().trim();
      this.selectedIndex = 0;
      this.renderList();
    });
  }

  bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        this.toggle();
        return;
      }

      if (!this.isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
        this.renderSelection();
        this.sfx?.play("click");
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.renderSelection();
        this.sfx?.play("click");
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const selected = this.items[this.selectedIndex];
        if (selected && selected.action) {
          this.execute(selected);
        }
      }
    });
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    this.query = "";
    this.selectedIndex = 0;
    this.input.value = "";
    this.backdrop.classList.remove("is-hidden");
    this.buildItems();
    this.renderList();
    this.sfx?.play("openPalette");
    setTimeout(() => this.input.focus(), 20);
  }

  close() {
    this.isOpen = false;
    this.backdrop.classList.add("is-hidden");
  }

  buildItems() {
    const ws = this.store.activeWorkspace();
    const nodes = this.store.nodes();
    const items = [];

    // 1. Cards in current workspace
    nodes.forEach((n) => {
      items.push({
        id: `card-${n.id}`,
        title: n.prompt || "Untitled Card",
        category: "CARDS",
        badge: (n.tags || [])[0] || (n.parentId ? "Sub-Node" : "Primary"),
        icon: "🧠",
        color: n.color || "#38bdf8",
        keywords: `${n.prompt} ${(n.tags || []).join(" ")} ${(n.text || "").slice(0, 100)}`,
        action: () => {
          this.canvas.select(n.id);
          this.canvas.centerOn(n);
          this.toast?.(`Focused on “${n.prompt.slice(0, 28)}”`);
        },
      });
    });

    // 2. Audio AI Briefings
    items.push(
      {
        id: "audio-workspace",
        title: "Listen to Workspace Executive Briefing",
        category: "AI AUDIO",
        badge: "TTS",
        icon: "🎧",
        keywords: "audio listen brief speak podcast sound tts voice workspace",
        action: () => window.audioBriefing?.playWorkspace(this.store),
      },
      {
        id: "audio-selected",
        title: "Listen to Selected Card Briefing",
        category: "AI AUDIO",
        badge: "TTS",
        icon: "🎧",
        keywords: "audio card listen speak current node note",
        action: () => {
          const selId = [...this.canvas.selected][0];
          const node = selId ? this.store.node(selId) : this.store.nodes()[0];
          if (node) window.audioBriefing?.playCard(node);
          else this.toast?.("No card selected to read.");
        },
      },
      {
        id: "audio-stop",
        title: "Stop Audio Briefing Playback",
        category: "AI AUDIO",
        badge: "Control",
        icon: "⏹",
        keywords: "stop pause audio mute briefing",
        action: () => window.audioBriefing?.stop(true),
      },
      {
        id: "voice-cute",
        title: "Voice: Smooth & Cute Voice (🌸 Sweet & Gentle)",
        category: "VOICE SETTINGS",
        badge: "CUTE",
        icon: "🌸",
        keywords: "voice cute smooth sweet gentle female anime tts audio description",
        action: () => {
          window.audioBriefing?.setPersona("cute");
          window.audioBriefing?.previewVoice();
        },
      },
      {
        id: "voice-kawaii",
        title: "Voice: Kawaii Anime AI (🎀 Playful & Cheerful)",
        category: "VOICE SETTINGS",
        badge: "KAWAII",
        icon: "🎀",
        keywords: "voice kawaii anime cheerful playful sweet tts",
        action: () => {
          window.audioBriefing?.setPersona("kawaii");
          window.audioBriefing?.previewVoice();
        },
      },
      {
        id: "voice-asmr",
        title: "Voice: Soft & Smooth ASMR (☁️ Calm & Relaxing)",
        category: "VOICE SETTINGS",
        badge: "ASMR",
        icon: "☁️",
        keywords: "voice asmr soft smooth calm relaxing study",
        action: () => {
          window.audioBriefing?.setPersona("asmr");
          window.audioBriefing?.previewVoice();
        },
      },
      {
        id: "voice-natural",
        title: "Voice: Natural AI Assistant (✨ Clear & Modern)",
        category: "VOICE SETTINGS",
        badge: "NATURAL",
        icon: "✨",
        keywords: "voice natural ai modern crystal clear crisp",
        action: () => {
          window.audioBriefing?.setPersona("natural");
          window.audioBriefing?.previewVoice();
        },
      },
      {
        id: "voice-preview",
        title: "Voice: Preview Current Spoken Audio Voice",
        category: "VOICE SETTINGS",
        badge: "PREVIEW",
        icon: "▶️",
        keywords: "preview voice sample audio test cute hear speak",
        action: () => window.audioBriefing?.previewVoice(),
      },
      {
        id: "voice-modal",
        title: "Voice: Open Audio Voice & Tone Customizer Modal",
        category: "VOICE SETTINGS",
        badge: "CUSTOMIZE",
        icon: "⚙️",
        keywords: "voice settings modal customize tune pitch speed audio description",
        action: () => window.audioBriefing?.openVoiceSelectorModal(),
      },
      {
        id: "term-open",
        title: "⚡ Cyber Terminal Shell & CPU Hardware Monitor",
        category: "SYSTEM TELEMETRY",
        badge: "TERMINAL",
        icon: "💻",
        keywords: "terminal shell cpu specs hardware cores gpu load memory monitor",
        action: () => window.cyberTerminal?.toggle(),
      }
    );

    // 3. Themes
    const themesList = [
      { id: "matrix-green", name: "Terminal Hacker (Black & Green)", icon: "🟢" },
      { id: "matrix", name: "Cyber Matrix (Emerald Glow)", icon: "❇️" },
      { id: "material-dark", name: "Google Material Dark", icon: "🌑" },
      { id: "material-indigo", name: "Google Material Indigo", icon: "🟣" },
      { id: "material-emerald", name: "Google Material Forest", icon: "🌲" },
      { id: "solar", name: "Solar Light (Day)", icon: "☀️" },
      { id: "cobalt", name: "Deep Cobalt (Midnight Navy)", icon: "🔷" },
      { id: "amber", name: "Amber Terminal", icon: "🟠" },
      { id: "obsidian", name: "Obsidian Crimson", icon: "🔴" },
    ];

    themesList.forEach((t) => {
      items.push({
        id: `theme-${t.id}`,
        title: `Switch Theme: ${t.name}`,
        category: "THEMES",
        badge: "Palette",
        icon: t.icon,
        keywords: `theme color palette style ${t.id} ${t.name}`,
        action: () => {
          this.store.setWorkspaceTheme(ws.id, t.id);
          this.ui.applyTheme();
          this.sfx?.play("themeSwitch");
          this.toast?.(`Theme set to ${t.name}`);
        },
      });
    });

    // 4. Exports
    items.push(
      {
        id: "export-html",
        title: "Export Standalone Interactive HTML (Single File)",
        category: "EXPORTS",
        badge: "Offline Web",
        icon: "🌐",
        keywords: "export html standalone interactive web page offline bundle",
        action: () => this.ui.downloadCards("html"),
      },
      {
        id: "export-obsidian",
        title: "Export to Obsidian Markdown Vault (.zip)",
        category: "EXPORTS",
        badge: "Vault",
        icon: "💎",
        keywords: "export obsidian markdown vault zip wikilinks frontmatter",
        action: () => this.ui.downloadCards("obsidian"),
      },
      {
        id: "export-pdf",
        title: "Export Print-Ready PDF Dossier (A4)",
        category: "EXPORTS",
        badge: "PDF",
        icon: "📄",
        keywords: "export pdf print document report dossier",
        action: () => this.ui.downloadCards("pdf"),
      },
      {
        id: "export-gdocs",
        title: "Sync & Export to Google Docs",
        category: "EXPORTS",
        badge: "Cloud",
        icon: "📑",
        keywords: "export google docs gdocs cloud drive",
        action: () => this.ui.exportToGDocs(),
      }
    );

    // 5. Views & Navigation
    items.push(
      {
        id: "nav-structure",
        title: "Open Structure Map & Network Topology",
        category: "NAVIGATION",
        badge: "Topology",
        icon: "🗺️",
        keywords: "structure map hierarchy tree topology subnodes",
        action: () => this.ui.openStructureMapModal(),
      },
      {
        id: "nav-3d",
        title: "Launch 3D Holographic Knowledge Orbit",
        category: "NAVIGATION",
        badge: "Three.js",
        icon: "🚀",
        keywords: "3d three space universe orbit holographic view",
        action: () => this.ui.openTree3D(),
      },
      {
        id: "nav-threats",
        title: "Open Threat Center & Top CVEs",
        category: "NAVIGATION",
        badge: "Cyber Sec",
        icon: "🛡️",
        keywords: "cve threats osv nvd cyber security vulnerabilities exploit",
        action: () => this.ui.openAdminDashboard("cves"),
      },
      {
        id: "nav-home",
        title: "Return to Maddy's BrainVault Home Portal",
        category: "NAVIGATION",
        badge: "Home",
        icon: "🏠",
        keywords: "home landing portal brain vault maddys",
        action: () => window.location.hash = "/home",
      }
    );

    // 6. Canvas Operations
    items.push(
      {
        id: "act-new-note",
        title: "Create New Note Card",
        category: "ACTIONS",
        badge: "Canvas",
        icon: "➕",
        keywords: "create add new card note prompt concept",
        action: () => {
          this.ui.askNote();
          this.sfx?.play("cardCreated");
        },
      },
      {
        id: "act-new-sticky",
        title: "Create Sticky Memo",
        category: "ACTIONS",
        badge: "Canvas",
        icon: "📌",
        keywords: "sticky memo note pin reminder",
        action: () => this.ui.askSticky(),
      },
      {
        id: "act-fit",
        title: "Fit Canvas to Screen",
        category: "ACTIONS",
        badge: "Camera",
        icon: "🔍",
        keywords: "fit zoom center screen frame canvas",
        action: () => this.canvas.zoomFit(),
      },
      {
        id: "act-arrange-tree",
        title: "Auto-Arrange: Tree Layout",
        category: "ACTIONS",
        badge: "Layout",
        icon: "🌲",
        keywords: "arrange layout tree hierarchy clean",
        action: () => this.canvas.arrangeTree(),
      },
      {
        id: "act-arrange-circular",
        title: "Auto-Arrange: Circular Radial Layout",
        category: "ACTIONS",
        badge: "Layout",
        icon: "📐",
        keywords: "arrange layout circular radial radial-form",
        action: () => this.canvas.arrangeCircular(),
      },
      {
        id: "act-arrange-grid",
        title: "Auto-Arrange: Bento Matrix Grid Layout",
        category: "ACTIONS",
        badge: "Layout",
        icon: "🔲",
        keywords: "arrange layout bento grid matrix multi-column clean",
        action: () => this.canvas.arrangeGrid(),
      },
      {
        id: "act-arrange-connected",
        title: "Auto-Arrange: Collision-Free Connected Links",
        category: "ACTIONS",
        badge: "Layout",
        icon: "🔗",
        keywords: "arrange layout connected no overlap collision",
        action: () => this.canvas.arrangeConnected(),
      },
      {
        id: "act-arrange-timeline",
        title: "Auto-Arrange: Sequential Timeline Stream",
        category: "ACTIONS",
        badge: "Layout",
        icon: "🌊",
        keywords: "arrange layout timeline stream chronological sequence flow",
        action: () => this.canvas.arrangeTimeline(),
      },
      {
        id: "act-toggle-sfx",
        title: "Toggle Cyber Audio Sound Effects (SFX)",
        category: "ACTIONS",
        badge: "Audio FX",
        icon: "🔊",
        keywords: "sound sfx audio volume cyber hum clicks",
        action: () => {
          const on = this.sfx?.toggle();
          this.toast?.(`Cyber Audio SFX: ${on ? "ENABLED 🔊" : "MUTED 🔇"}`);
        },
      }
    );

    this.allItems = items;
  }

  filterItems() {
    if (!this.query) {
      this.items = this.allItems;
      return;
    }
    const q = this.query;
    this.items = this.allItems.filter((it) => {
      const matchTitle = it.title.toLowerCase().includes(q);
      const matchCat = it.category.toLowerCase().includes(q);
      const matchKw = (it.keywords || "").toLowerCase().includes(q);
      return matchTitle || matchCat || matchKw;
    });
  }

  renderList() {
    this.filterItems();

    if (!this.items.length) {
      this.list.innerHTML = `
        <div class="cmd-empty-state">
          <p>No commands or cards matching "<b>${escapeHtml(this.query)}</b>"</p>
        </div>
      `;
      return;
    }

    this.list.innerHTML = this.items
      .map((it, idx) => {
        const isSel = idx === this.selectedIndex;
        return `
          <div class="cmd-item ${isSel ? "is-selected" : ""}" data-idx="${idx}" role="option" aria-selected="${isSel}">
            <div class="cmd-item-left">
              <span class="cmd-item-icon">${it.icon}</span>
              <span class="cmd-item-title">${escapeHtml(it.title)}</span>
            </div>
            <div class="cmd-item-right">
              ${it.badge ? `<span class="cmd-item-badge">${escapeHtml(it.badge)}</span>` : ""}
              <span class="cmd-item-cat">${escapeHtml(it.category)}</span>
            </div>
          </div>
        `;
      })
      .join("");

    this.list.querySelectorAll(".cmd-item").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = parseInt(el.dataset.idx, 10);
        this.selectedIndex = idx;
        const item = this.items[idx];
        if (item) this.execute(item);
      });
      el.addEventListener("mouseenter", () => {
        this.selectedIndex = parseInt(el.dataset.idx, 10);
        this.renderSelection();
      });
    });

    this.scrollSelectedIntoView();
  }

  renderSelection() {
    this.list.querySelectorAll(".cmd-item").forEach((el, idx) => {
      el.classList.toggle("is-selected", idx === this.selectedIndex);
    });
    this.scrollSelectedIntoView();
  }

  scrollSelectedIntoView() {
    const el = this.list.querySelector(`.cmd-item[data-idx="${this.selectedIndex}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }

  execute(item) {
    this.close();
    this.sfx?.play("click");
    if (item.action) {
      item.action();
    }
  }
}

function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
