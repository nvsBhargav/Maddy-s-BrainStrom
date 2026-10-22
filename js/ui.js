// UI shell: header, sidebar, hero, dictionary, modals. Rendering lives here, state in store.js.
import { icon } from "./icons.js";
import { TOPIC_POOL, TRY_TOPICS, VOCABULARY, glossaryDef } from "./content.js";
import { loadFeed, feedToCardText, feedToStickyText, feedToIntelCardText, generateKeyDetails7, generate10LineBrief, timeAgo } from "./feeds.js";
import { buildReport, exportReport } from "./report.js";
import { THEMES, THEME_DETAILS } from "./store.js";
import { AdminDashboard } from "./admin.js";
import { AudioBriefingPlayer } from "./audio.js";
import { CyberTerminal } from "./terminal.js";

export class UI {
  constructor({ store, canvas, toast, tree3d }) {
    this.store = store;
    this.canvas = canvas;
    this.toast = toast;
    this.tree3d = tree3d;
    this.tab = "workspaces";
    this.dictIndex = 0;
    this.modal = null;
    this.adminDashboard = null;
    this.unlockedWorkspaces = new Set();
    this.audio = new AudioBriefingPlayer({ toast: (m) => this.toast(m) });
    window.audioBriefing = this.audio;
    this.terminal = new CyberTerminal({ store: this.store, canvas: this.canvas, toast: (m) => this.toast(m), ui: this });
    window.cyberTerminal = this.terminal;

    this.header = document.querySelector("#appHeader");
    this.sidebar = document.querySelector("#sidebar");
    this.sidebarBody = document.querySelector("#sidebarBody");
    this.hero = document.querySelector("#hero");
    this.modalRoot = document.querySelector("#modalRoot");
    this.searchInput = document.querySelector("#searchInput");

    this.bind();
    this.store.subscribe(() => this.render());
    this.store.subscribeDb?.(() => this.renderHeader());
    this.render();
  }

  // --- wiring ---------------------------------------------------------------
  bind() {
    document.querySelector("#appHeader").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cmd]");
      if (btn) this.command(btn.dataset.cmd);
    });

    const searchForm = document.querySelector("#searchForm");
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const topic = this.searchInput.value.trim();
      const gPopup = document.querySelector("#googleSearchPopup");
      if (gPopup) gPopup.classList.add("is-hidden");
      if (topic) this.explore(topic);
    });

    // Google search lightweight popup integration
    const gPopup = document.querySelector("#googleSearchPopup");
    const gBtn = document.querySelector("#googleSearchBtn");
    const gClose = document.querySelector("#gsearchClose");
    const gQueryText = document.querySelector("#gsearchQueryText");
    const gAddNoteBtn = document.querySelector("#gsearchAddNoteBtn");
    const gExternalLink = document.querySelector("#gsearchExternalLink");
    const gCopyBtn = document.querySelector("#gsearchCopyBtn");
    const gIframe = document.querySelector("#gsearchIframe");
    const gSnippet = document.querySelector("#gsearchSnippet");
    const gSnippetTitle = document.querySelector("#gsearchSnippetTitle");
    const gSnippetExtract = document.querySelector("#gsearchSnippetExtract");

    const updateGoogleSearch = (q) => {
      const query = (q || "").trim();
      if (!query) {
        if (gPopup) gPopup.classList.add("is-hidden");
        return;
      }
      if (gPopup) gPopup.classList.remove("is-hidden");
      if (gQueryText) gQueryText.textContent = query;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      const embedUrl = `https://www.google.com/search?igu=1&q=${encodeURIComponent(query)}`;
      if (gExternalLink) gExternalLink.href = searchUrl;
      if (gIframe && gIframe.dataset.lastQuery !== query) {
        gIframe.dataset.lastQuery = query;
        gIframe.src = embedUrl;
      }

      // Fast, lightweight web topic summary preview
      if (gSnippet) {
        gSnippet.classList.add("is-hidden");
        const reqId = ++updateGoogleSearch._reqId;
        const normalized = query.replace(/\s+/g, "_");
        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(normalized)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (reqId !== updateGoogleSearch._reqId) return;
            if (data && data.extract) {
              if (gSnippetTitle) gSnippetTitle.textContent = data.title || query;
              if (gSnippetExtract) gSnippetExtract.textContent = data.extract;
              gSnippet.classList.remove("is-hidden");
            }
          })
          .catch(() => {});
      }
    };
    updateGoogleSearch._reqId = 0;

    this.searchInput.addEventListener("input", (e) => {
      const q = e.target.value;
      if (q.trim().length >= 2) {
        updateGoogleSearch(q);
      } else {
        if (gPopup) gPopup.classList.add("is-hidden");
      }
    });

    if (gBtn) {
      gBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const current = this.searchInput.value.trim() || "Spatial Knowledge Engine";
        this.searchInput.value = current;
        updateGoogleSearch(current);
      });
    }

    if (gClose) {
      gClose.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (gPopup) gPopup.classList.add("is-hidden");
      });
    }

    // Draggable header for Google search popup
    const gHeader = gPopup?.querySelector(".gsearch-header");
    if (gPopup && gHeader) {
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let initialLeft = 0;
      let initialTop = 0;

      gHeader.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button, a, input")) return;
        isDragging = true;
        gPopup.classList.add("is-dragging");
        const rect = gPopup.getBoundingClientRect();
        // If not fixed yet, convert to fixed positioning for free-drag anywhere
        gPopup.style.position = "fixed";
        gPopup.style.left = `${rect.left}px`;
        gPopup.style.top = `${rect.top}px`;
        gPopup.style.bottom = "auto";
        gPopup.style.right = "auto";
        gPopup.style.margin = "0";

        startX = e.clientX;
        startY = e.clientY;
        initialLeft = rect.left;
        initialTop = rect.top;
        gHeader.setPointerCapture(e.pointerId);
      });

      gHeader.addEventListener("pointermove", (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newLeft = Math.max(10, Math.min(window.innerWidth - 80, initialLeft + dx));
        const newTop = Math.max(10, Math.min(window.innerHeight - 60, initialTop + dy));
        gPopup.style.left = `${newLeft}px`;
        gPopup.style.top = `${newTop}px`;
      });

      const stopDrag = (e) => {
        if (isDragging) {
          isDragging = false;
          gPopup.classList.remove("is-dragging");
          try { gHeader.releasePointerCapture(e.pointerId); } catch (_) {}
        }
      };
      gHeader.addEventListener("pointerup", stopDrag);
      gHeader.addEventListener("pointercancel", stopDrag);
    }

    if (gAddNoteBtn) {
      gAddNoteBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const q = (gQueryText?.textContent || this.searchInput.value || "").trim();
        if (q && q !== "Type topic…") {
          this.explore(q);
          if (gPopup) gPopup.classList.add("is-hidden");
          this.searchInput.value = "";
        }
      });
    }

    if (gCopyBtn) {
      gCopyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const q = (gQueryText?.textContent || this.searchInput.value || "").trim();
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(q || "BrainVault")}`;
        navigator.clipboard?.writeText(searchUrl);
        this.toast?.("Copied Google Search link to clipboard.");
      });
    }

    document.addEventListener("click", (e) => {
      if (!e.target.closest("#searchForm") && gPopup && !gPopup.classList.contains("is-hidden")) {
        gPopup.classList.add("is-hidden");
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && gPopup && !gPopup.classList.contains("is-hidden")) {
        gPopup.classList.add("is-hidden");
      }
    });

    // #panelToggle is handled by the header's [data-cmd] delegation; a second
    // listener here would toggle the panel twice and leave it unchanged.

    document.querySelector("#sidebarTabs").addEventListener("click", (e) => {
      const tab = e.target.closest("[data-tab]");
      if (!tab) return;
      this.tab = tab.dataset.tab;
      this.renderSidebar();
    });

    this.sidebarBody.addEventListener("click", (e) => this.onSidebarClick(e));
    this.sidebar.addEventListener("click", (e) => {
      if (e.target.closest('[data-cmd="panel"]')) this.togglePanel();
    });
    this.sidebarBody.addEventListener("input", (e) => {
      if (e.target.id === "shadowSlider") {
        this.store.setWorkspaceShadow(this.store.state.activeWorkspaceId, Number(e.target.value));
      }
      if (e.target.id === "noteFilter") {
        const query = e.target.value.toLowerCase();
        let visibleCount = 0;
        const rows = this.sidebarBody.querySelectorAll(".note-row");
        for (const row of rows) {
          const match = !query || row.dataset.search.includes(query);
          row.hidden = !match;
          if (match) visibleCount++;
        }
        const summarySpan = this.sidebarBody.querySelector(".notes-summary span");
        if (summarySpan) {
          summarySpan.textContent = `Showing ${visibleCount} of ${rows.length} notes`;
        }
      }
    });
    this.sidebarBody.addEventListener("change", (e) => {
      const color = e.target.closest("[data-ws-color]");
      if (color) this.store.setWorkspaceColor(color.dataset.wsColor, color.value);
    });

    if (this.hero) {
      this.hero.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = this.hero.querySelector("#exploreInput");
        const topic = input?.value.trim();
        if (topic) this.explore(topic);
        else input?.focus();
      });
      this.hero.addEventListener("click", (e) => {
        const chip = e.target.closest("[data-topic]");
        if (chip) this.explore(chip.dataset.topic);
        const cmd = e.target.closest("[data-hero-cmd]");
        if (cmd) this.command(cmd.dataset.heroCmd);
      });
    }

    document.querySelector("#radar").addEventListener("click", (e) => {
      const zoomBtn = e.target.closest("[data-zoom]");
      if (zoomBtn) {
        if (zoomBtn.dataset.zoom === "in") this.canvas.zoomAt(1.15);
        if (zoomBtn.dataset.zoom === "out") this.canvas.zoomAt(1 / 1.15);
        if (zoomBtn.dataset.zoom === "fit") this.canvas.fit();
        return;
      }
      if (e.target.closest("#zoomLabel")) {
        const sel = [...this.canvas.selected][0];
        const n = sel ? this.store.node(sel) : this.store.nodes()[0];
        if (n) this.canvas.smoothZoomToNode(n, 0.8);
        else this.canvas.zoomTo(0.8);
        return;
      }
      const radarAction = e.target.closest("[data-radar-action]");
      if (radarAction?.dataset.radarAction === "tree3d") {
        this.tree3d?.toggle3DMode();
        return;
      }
      if (radarAction?.dataset.radarAction === "theme") {
        const ws = this.store.activeWorkspace();
        const current = ws?.themeId || "matrix";
        const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
        this.store.setWorkspaceTheme(ws.id, next);
        this.applyTheme();
        this.toast(`Workspace theme: ${next === "matrix" ? "Black + Green" : next === "cobalt" ? "Deep Cobalt" : "Amber Deck"}.`);
        return;
      }
      const markActiveLayout = (targetBtn) => {
        document.querySelectorAll(".radar-layout-chip").forEach((el) => el.classList.remove("is-active"));
        if (targetBtn) targetBtn.classList.add("is-active");
      };
      if (radarAction?.dataset.radarAction === "tree") {
        markActiveLayout(radarAction);
        this.canvas.arrangeTree();
        return;
      }
      if (radarAction?.dataset.radarAction === "circular") {
        markActiveLayout(radarAction);
        this.canvas.arrangeCircular();
        return;
      }
      if (radarAction?.dataset.radarAction === "grid") {
        markActiveLayout(radarAction);
        this.canvas.arrangeGrid();
        return;
      }
      if (radarAction?.dataset.radarAction === "connected") {
        markActiveLayout(radarAction);
        this.canvas.arrangeConnected();
        return;
      }
      if (radarAction?.dataset.radarAction === "timeline") {
        markActiveLayout(radarAction);
        this.canvas.arrangeTimeline();
        return;
      }
      if (radarAction?.dataset.radarAction === "lines") this.toast?.("Parent → child links are drawn on the radar and the canvas.");
    });

    this.modalRoot.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-modal]") || e.target === this.modalRoot) return this.closeModal();
      const feedTab = e.target.closest("[data-feed-tab]");
      if (feedTab) {
        this.feedState.tab = feedTab.dataset.feedTab;
        return this.refreshFeed();
      }
      if (e.target.closest("[data-feed-retry]")) return this.refreshFeed(true);
      const feedListen = e.target.closest("[data-feed-listen]");
      if (feedListen) {
        const a = this.feedState?.articles[Number(feedListen.dataset.feedListen)];
        if (a) {
          const brief10 = generate10LineBrief(a);
          this.audio?.playFeed({ ...a, brief10Lines: brief10 });
        }
        return;
      }
      const feedListenBrief = e.target.closest("[data-feed-listen-brief]");
      if (feedListenBrief) {
        const a = this.feedState?.articles[Number(feedListenBrief.dataset.feedListenBrief)];
        if (a) {
          const brief10 = generate10LineBrief(a);
          this.audio?.playFeed({ ...a, brief10Lines: brief10 });
        }
        return;
      }
      const intel = e.target.closest("[data-feed-intel]");
      if (intel) return this.openFeedIntel(Number(intel.dataset.feedIntel));
      const intelCard = e.target.closest("[data-feed-intel-card]");
      if (intelCard) return this.importFeedIntelCard(Number(intelCard.dataset.feedIntelCard));
      const imp = e.target.closest("[data-feed-import]");
      if (imp) return this.importFeedCard(Number(imp.dataset.feedImport));
      const stick = e.target.closest("[data-feed-sticky]");
      if (stick) return this.importFeedSticky(Number(stick.dataset.feedSticky));
      if (e.target.closest("[data-feed-top3]")) return this.importFeedTop3();
      if (e.target.closest("[data-news-open]")) return this.openFeeds();
      if (e.target.closest("[data-hub-cves]")) {
        this.closeModal();
        return this.openAdminDashboard("cves");
      }
      if (e.target.closest("[data-hub-osv]")) {
        this.closeModal();
        return this.openAdminDashboard("osv");
      }
      const action = e.target.closest("[data-modal-action]");
      if (action) this.modalAction(action.dataset.modalAction);
    });
    this.modalRoot.addEventListener("submit", (e) => {
      if (e.target.id === "feedSearchForm") {
        e.preventDefault();
        this.feedState.query = this.modalRoot.querySelector("#feedSearch").value.trim();
        this.refreshFeed(true);
      }
    });

    window.addEventListener("hashchange", () => this.route());
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.modal) this.closeModal();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? this.store.redo() : this.store.undo();
        return;
      }

      // Fast keyboard shortcuts:
      // Alt+N -> Live News Tab
      // Alt+D -> NewsData.io Tab
      // Alt+C -> Top CVEs Tab
      // Alt+T -> NVD Threat Center
      // Alt+O -> OSV.dev News
      // Alt+3 -> 3D Holographic View
      // Alt+G -> Google Docs Modal
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "n") {
          e.preventDefault();
          this.openAdminDashboard("news");
          this.toast?.("Opened Live News tab (Alt+N)");
        } else if (key === "d") {
          e.preventDefault();
          this.openAdminDashboard("newsdata");
          this.toast?.("Opened NewsData.io tab (Alt+D)");
        } else if (key === "c") {
          e.preventDefault();
          this.openAdminDashboard("cves");
          this.toast?.("Opened Top CVEs tab (Alt+C)");
        } else if (key === "t") {
          e.preventDefault();
          this.openAdminDashboard("threats");
          this.toast?.("Opened NVD Threat Center (Alt+T)");
        } else if (key === "o") {
          e.preventDefault();
          this.openAdminDashboard("osv");
          this.toast?.("Opened OSV.dev Security News (Alt+O)");
        } else if (key === "3") {
          e.preventDefault();
          this.tree3d?.toggle3DMode();
          this.toast?.("Toggled 3D Holographic Graph View (Alt+3)");
        } else if (key === "g") {
          e.preventDefault();
          this.openGDocsModal();
        }
      }
    });
  }

  route() {
    const hash = location.hash.replace(/^#/, "");
    if (hash === "" || hash === "/" || hash === "/home" || hash === "home") {
      if (this.landingPage) this.landingPage.open();
      else if (window.landingPage) window.landingPage.open();
      return;
    }

    // Entering any non-home route closes the dedicated landing page
    if (this.landingPage?.isOpen) this.landingPage.close();
    else if (window.landingPage?.isOpen) window.landingPage.close();

    if (hash === "/threats" || hash === "/nvd" || hash === "threats" || hash === "nvd") {
      this.openAdminDashboard("threats");
      return;
    }
    if (hash === "/cves" || hash === "cves" || hash === "/top-cves" || hash === "top-cves") {
      this.openAdminDashboard("cves");
      return;
    }
    if (hash === "/osv" || hash === "osv" || hash === "/osv-news" || hash === "osv-news") {
      this.openAdminDashboard("osv");
      return;
    }
    if (hash === "/currents" || hash === "currents") {
      this.openAdminDashboard("currents");
      return;
    }
    if (hash === "/newsdata" || hash === "newsdata") {
      this.openAdminDashboard("newsdata");
      return;
    }
    const match = hash.match(/^\/w\/([^/]+)/);
    const workspaces = this.store.state.workspaces;
    if (match && workspaces.some((w) => w.id === match[1])) {
      const targetId = match[1];
      const ws = workspaces.find((w) => w.id === targetId);
      if (ws && ws.passwordProtected && !this.unlockedWorkspaces.has(targetId)) {
        this.goToWorkspace(targetId);
        return;
      }
      this.store.selectWorkspace(targetId);
    } else {
      location.hash = `/w/${this.store.state.activeWorkspaceId}`;
    }
    this.renderHeader();
  }

  goToWorkspace(id) {
    if (this.landingPage?.isOpen) this.landingPage.close();
    else if (window.landingPage?.isOpen) window.landingPage.close();
    const ws = this.store.state.workspaces.find((w) => w.id === id);
    if (ws && ws.passwordProtected && !this.unlockedWorkspaces.has(id)) {
      this.askText({
        title: "Workspace Locked",
        hint: `“${ws.name}” is password-protected. Enter workspace password (or Admin key) to unlock:`,
        value: "",
      }).then((pass) => {
        if (!pass) {
          this.toast("Workspace access cancelled.");
          return;
        }
        if (pass === ws.password || pass === "Maddy" || pass === "vault") {
          this.unlockedWorkspaces.add(id);
          this.toast(`🔓 Unlocked “${ws.name}”.`);
          location.hash = `/w/${id}`;
          this.store.selectWorkspace(id);
        } else {
          this.toast("❌ Incorrect workspace password.");
        }
      });
      return;
    }
    location.hash = `/w/${id}`;
    this.store.selectWorkspace(id);
  }

  // --- commands -------------------------------------------------------------
  command(cmd) {
    switch (cmd) {
      case "home":
        this.closeModal();
        if (window.tree3d && window.tree3d.isActive) window.tree3d.close3DMode();
        if (this.adminDashboard?.isOpen) this.adminDashboard.close();
        const searchPopup = document.querySelector("#googleSearchPopup");
        if (searchPopup) searchPopup.classList.add("is-hidden");
        location.hash = "/home";
        if (this.landingPage) {
          this.landingPage.open();
        } else if (window.landingPage) {
          window.landingPage.open();
        }
        break;
      case "panel":
        this.togglePanel();
        break;
      case "note":
        this.addCustomNote();
        break;
      case "random":
        this.explore(TOPIC_POOL[Math.floor(Math.random() * TOPIC_POOL.length)]);
        break;
      case "sticky":
        this.addSticky();
        break;
      case "feeds":
        this.openFeeds();
        break;
      case "news":
        this.openAdminDashboard("news");
        break;
      case "fit":
        this.canvas.fit();
        this.toast("Workspace magnification: complete view fitted to screen.");
        break;
      case "tree":
        this.canvas.arrangeTree();
        break;
      case "circular":
        this.canvas.arrangeCircular();
        break;
      case "grid":
        this.canvas.arrangeGrid();
        break;
      case "connected":
        this.canvas.arrangeConnected();
        break;
      case "timeline":
        this.canvas.arrangeTimeline();
        break;
      case "google":
        updateGoogleSearch(this.searchInput.value.trim() || "Spatial Knowledge Engine");
        break;
      case "palette":
        this.palette?.toggle();
        break;
      case "toggle-sfx": {
        const on = this.sfx?.toggle();
        this.toast?.(`Cyber Audio SFX: ${on ? "ENABLED 🔊" : "MUTED 🔇"}`);
        break;
      }
      case "audio-brief":
        this.audio?.playWorkspace(this.store);
        break;
      case "voice-settings":
        this.audio?.openVoiceSelectorModal();
        break;
      case "terminal":
        this.terminal?.toggle();
        break;
      case "export":
        this.openExport();
        break;
      case "undo":
        this.store.undo() ? this.toast("Undone.") : this.toast("Nothing to undo.");
        break;
      case "redo":
        this.store.redo() ? this.toast("Redone.") : this.toast("Nothing to redo.");
        break;
      case "reset":
        this.resetWorkspace();
        break;
      case "help":
        this.openShortcuts();
        break;
      case "threats":
        this.openAdminDashboard("threats");
        break;
      case "cves":
        this.openAdminDashboard("cves");
        break;
      case "osv":
        this.openAdminDashboard("osv");
        break;
      case "currents":
        this.openAdminDashboard("currents");
        break;
      case "newsdata":
        this.openAdminDashboard("newsdata");
        break;
      case "admin":
        this.openAdminDashboard("vaults");
        break;
      case "connections":
        this.openConnections();
        break;
      case "dbsync":
        this.openDbSync();
        break;
      case "tree3d":
        this.tree3d?.toggle3DMode();
        break;
      case "gdocs":
        this.openGDocsDialog();
        break;
      case "structure-map":
      case "hierarchy":
        this.openStructureMapModal();
        break;
      case "workspace-themes":
      case "themes":
        this.openWorkspaceThemesModal();
        break;
      default:
        break;
    }
  }

  openStructureMapModal(selectedWsId = null) {
    const workspaces = this.store.state.workspaces || [];
    const activeWs = this.store.activeWorkspace();
    let currentWsId = selectedWsId || activeWs?.id || workspaces[0]?.id || "main";
    let currentViewMode = "beside"; // Default: beside view with highlighted parent nodes and small sub-node headings

    const renderModal = (searchQuery = "") => {
      const q = searchQuery.toLowerCase().trim();
      const currentWs = workspaces.find((w) => w.id === currentWsId) || activeWs;

      // Get all nodes for current workspace
      const allWsNodes = (this.store.state.nodes || []).filter((n) => (n.workspaceId || "main") === currentWs.id);
      const rootNodes = allWsNodes.filter((n) => !n.parentId);
      const childMap = new Map();
      allWsNodes
        .filter((n) => n.parentId)
        .forEach((ch) => {
          if (!childMap.has(ch.parentId)) childMap.set(ch.parentId, []);
          childMap.get(ch.parentId).push(ch);
        });

      // Filter by search query if present
      let visibleRoots = rootNodes;
      if (q) {
        visibleRoots = rootNodes.filter((r) => {
          const matchRoot =
            (r.prompt || "").toLowerCase().includes(q) ||
            (r.text || "").toLowerCase().includes(q) ||
            (r.tags || []).some((t) => t.toLowerCase().includes(q));
          const children = childMap.get(r.id) || [];
          const matchChildren = children.some(
            (c) =>
              (c.prompt || "").toLowerCase().includes(q) ||
              (c.text || "").toLowerCase().includes(q) ||
              (c.tags || []).some((t) => t.toLowerCase().includes(q))
          );
          return matchRoot || matchChildren;
        });
      }

      this.modalRoot.innerHTML = `
        <div id="structureMapModal" class="modal hierarchy-modal-overlay" role="dialog" aria-modal="true">
          <div class="modal-card hierarchy-modal-card">
            <div class="modal-head hierarchy-modal-head">
              <div>
                <div class="hierarchy-title-row">
                  <span class="hierarchy-title-badge">NETWORK TOPOLOGY &amp; HIERARCHY</span>
                  <h2 class="hierarchy-title">Workspace Structure &amp; Connected Sub-Nodes</h2>
                </div>
                <p class="hierarchy-subtitle">Live relationship map showing parent nodes in authentic highlight colors with connected sub-node heading names beside.</p>
              </div>
              <button class="modal-close" id="hierarchyCloseBtn" aria-label="Close structure map">×</button>
            </div>

            <!-- Workspace Selector Strip -->
            <div class="hierarchy-ws-selector">
              <span class="hierarchy-ws-label">WORKSPACES:</span>
              <div class="hierarchy-ws-chips">
                ${workspaces
                  .map((w) => {
                    const isActive = w.id === currentWsId;
                    const nodeCount = (this.store.state.nodes || []).filter((n) => (n.workspaceId || "main") === w.id).length;
                    return `
                    <button type="button" class="hierarchy-ws-btn ${isActive ? "is-active" : ""}" data-ws-select="${w.id}">
                      <span class="chip-dot" style="background:${w.color || "#38bdf8"}"></span>
                      <span>${escapeHtml(w.name || "Workspace")}</span>
                      <strong style="opacity:0.8;font-size:10px;">(${nodeCount})</strong>
                    </button>
                  `;
                  })
                  .join("")}
              </div>
            </div>

            <!-- Search & View Mode Switcher -->
            <div class="hierarchy-toolbar-row">
              <div class="hierarchy-search-bar">
                <span data-icon="search" data-size="14"></span>
                <input type="search" id="hierarchySearchInput" placeholder="Filter parent nodes or subnodes by name or keyword…" value="${escapeAttr(
                  searchQuery
                )}" />
              </div>
              <div class="hierarchy-view-toggle-strip">
                <button type="button" class="hierarchy-view-chip ${currentViewMode === "beside" ? "is-active" : ""}" data-view-mode="beside" title="Parent nodes in highlight color with subnode headings beside">
                  🌿 Beside View (Headings Only)
                </button>
                <button type="button" class="hierarchy-view-chip ${currentViewMode === "detailed" ? "is-active" : ""}" data-view-mode="detailed" title="Full card preview cards">
                  📑 Detailed Cards
                </button>
              </div>
            </div>

            <!-- Hierarchy Tree Container -->
            <div class="hierarchy-tree-scroll" id="hierarchyTreeContent">
              ${
                visibleRoots.length === 0
                  ? `
                <div class="hierarchy-empty-state">
                  <p>No nodes found matching your query in <b>${escapeHtml(currentWs.name)}</b>.</p>
                </div>
              `
                  : currentViewMode === "beside"
                  ? visibleRoots
                      .map((root, rIdx) => {
                        const rootColor = root.color || "#38bdf8";
                        const children = childMap.get(root.id) || [];
                        const rootDescTitle = (root.text || "").replace(/^#+\s*/, "").split("\n")[0].slice(0, 85) || root.prompt;

                        return `
                  <div class="hierarchy-branch-row">
                    <!-- Parent Node in Highlight Colour -->
                    <div class="hierarchy-parent-highlight-box" style="border: 2px solid ${rootColor}; background: linear-gradient(135deg, ${rootColor}25 0%, ${rootColor}08 100%); box-shadow: 0 0 18px ${rootColor}35;">
                      <div class="hierarchy-parent-top">
                        <span class="hierarchy-edge-badge" style="background:${rootColor}33; border: 1px solid ${rootColor}; color:${rootColor}; font-weight:800;">
                          PARENT NODE ${rIdx + 1}.0
                        </span>
                        <button class="hierarchy-focus-btn" data-focus-node="${root.id}" title="Focus parent card on canvas">Focus ↗</button>
                      </div>
                      <h3 class="hierarchy-parent-title" style="color:${rootColor};">${escapeHtml(root.prompt || "Untitled Node")}</h3>
                      <div class="hierarchy-desc-titlebar" style="background:${rootColor}15; border-left: 3px solid ${rootColor}; margin: 6px 0 0; padding: 6px 10px;">
                        <div class="hierarchy-desc-kicker" style="color:${rootColor};">● ${root.tags?.length ? '#' + root.tags.join(' #') : 'CONCEPT SUMMARY'}</div>
                        <div class="hierarchy-desc-heading" style="font-size:12px; color:#f1f5f9;">${escapeHtml(rootDescTitle)}</div>
                      </div>
                    </div>

                    <!-- Connector Arrow / Link -->
                    <div class="hierarchy-branch-conduit" style="color:${rootColor};">
                      <span class="conduit-arrow">➔</span>
                    </div>

                    <!-- Sub-nodes Heading Names Only in Small Text Beside of It -->
                    <div class="hierarchy-subnodes-beside">
                      <div class="hierarchy-subnodes-beside-header">
                        <span class="subnodes-beside-label">CONNECTED SUBNODES (${children.length})</span>
                        <span class="subnodes-beside-hint">Headings only · click to focus</span>
                      </div>
                      <div class="subnodes-heading-flow">
                        ${children.length > 0 ? children.map((sub, sIdx) => {
                          const subColor = sub.color || rootColor || "#38bdf8";
                          // Heading name only
                          const subHeadingOnly = (sub.prompt || "Sub-node").replace(/^(Node|Sub-Node)\s*[\d.]*:\s*/i, "");
                          return `
                            <button type="button" class="subnode-heading-chip" data-focus-node="${sub.id}" style="border-left: 3px solid ${subColor};" title="Click to focus sub-node on canvas">
                              <span class="subnode-chip-dot" style="background:${subColor};"></span>
                              <span class="subnode-chip-index">${rIdx + 1}.${sIdx + 1}</span>
                              <span class="subnode-heading-small">${escapeHtml(subHeadingOnly)}</span>
                              <span class="subnode-focus-arrow">↗</span>
                            </button>
                          `;
                        }).join("") : `<span class="subnodes-empty-pill">No subnodes connected</span>`}
                      </div>
                    </div>
                  </div>
                `;
                      })
                      .join("")
                  : visibleRoots
                      .map((root, rIdx) => {
                        const rootColor = root.color || "#38bdf8";
                        const children = childMap.get(root.id) || [];
                        const preview = (root.text || "").slice(0, 140) + ((root.text || "").length > 140 ? "…" : "");
                        const tags = root.tags || [];
                        const rootDescTitle = (root.text || "").replace(/^#+\s*/, "").split("\n")[0].slice(0, 95) || root.prompt;

                        return `
                  <div class="hierarchy-root-item">
                    <!-- Root Node Card with Colored Edge -->
                    <div class="hierarchy-card-box" style="border: 2.5px solid ${rootColor}; box-shadow: 0 4px 20px ${rootColor}33;">
                      <div class="hierarchy-card-head">
                        <div class="hierarchy-card-meta">
                          <span class="hierarchy-edge-badge" style="background:${rootColor}22; border:1px solid ${rootColor}66; color:${rootColor};">
                            NODE ${rIdx + 1}.0
                          </span>
                          <h3 class="hierarchy-card-title">${escapeHtml(root.prompt || "Untitled Node")}</h3>
                        </div>
                        <div class="hierarchy-card-head-btns">
                          <button class="hierarchy-focus-btn" data-focus-node="${root.id}" title="Focus on canvas">Focus Card ↗</button>
                        </div>
                      </div>

                      <!-- Distinct Node Description Title Bar -->
                      <div class="hierarchy-desc-titlebar" style="background:${rootColor}18; border-left: 3.5px solid ${rootColor};">
                        <div class="hierarchy-desc-kicker"><span style="color:${rootColor};">●</span> DESCRIPTION TITLE BAR &amp; CONCEPT SUMMARY</div>
                        <div class="hierarchy-desc-heading">${escapeHtml(rootDescTitle)}</div>
                      </div>

                      ${preview ? `<p class="hierarchy-card-preview">${escapeHtml(preview)}</p>` : ""}

                      <div class="hierarchy-card-actions">
                        <div class="hierarchy-tags-strip">
                          ${tags.map((t) => `<span class="hierarchy-tag-pill">#${escapeHtml(t)}</span>`).join("")}
                          ${tags.length === 0 ? `<span style="font-size:10.5px;color:#64748b;">No tags</span>` : ""}
                        </div>
                        <span style="font-family:var(--mono);font-size:10px;color:#94a3b8;">${children.length} sub-node${
                          children.length === 1 ? "" : "s"
                        }</span>
                      </div>
                    </div>

                    <!-- Connected Sub-nodes List -->
                    ${
                      children.length > 0
                        ? `
                      <div class="hierarchy-subnodes-container">
                        ${children
                          .map((sub, sIdx) => {
                            const subColor = sub.color || "#34d399";
                            const subPreview = (sub.text || "").slice(0, 110) + ((sub.text || "").length > 110 ? "…" : "");
                            const subTags = sub.tags || [];
                            const subDescTitle = (sub.text || "").replace(/^#+\s*/, "").split("\n")[0].slice(0, 95) || sub.prompt;

                            return `
                            <div class="hierarchy-subnode-wrapper">
                              <div class="hierarchy-card-box hierarchy-subcard-box" style="border: 2px solid ${subColor}; box-shadow: 0 4px 16px ${subColor}28;">
                                <div class="hierarchy-card-head">
                                  <div class="hierarchy-card-meta">
                                    <span class="hierarchy-edge-badge" style="background:${subColor}22; border:1px solid ${subColor}66; color:${subColor};">
                                      SUB-NODE ${rIdx + 1}.${sIdx + 1}
                                    </span>
                                    <h4 class="hierarchy-card-title" style="font-size:13.5px;">${escapeHtml(sub.prompt || "Sub-node")}</h4>
                                  </div>
                                  <button class="hierarchy-focus-btn" data-focus-node="${sub.id}" style="padding:2px 8px;font-size:9.5px;" title="Focus sub-node on canvas">Focus ↗</button>
                                </div>

                                <!-- Sub-node Description Title Bar -->
                                <div class="hierarchy-desc-titlebar subnode-desc-bar" style="background:${subColor}18; border-left: 3px solid ${subColor};">
                                  <div class="hierarchy-desc-kicker"><span style="color:${subColor};">●</span> SUB-NODE DESCRIPTION TITLE BAR</div>
                                  <div class="hierarchy-desc-heading" style="font-size:12px;">${escapeHtml(subDescTitle)}</div>
                                </div>

                                ${subPreview ? `<p class="hierarchy-card-preview" style="font-size:11.5px;">${escapeHtml(subPreview)}</p>` : ""}
                                <div class="hierarchy-tags-strip">
                                  ${subTags.map((t) => `<span class="hierarchy-tag-pill">#${escapeHtml(t)}</span>`).join("")}
                                </div>
                              </div>
                            </div>
                          `;
                          })
                          .join("")}
                      </div>
                    `
                        : ""
                    }
                  </div>
                `;
                      })
                      .join("")
              }
            </div>
          </div>
        </div>
      `;

      // Event handlers
      this.modalRoot.querySelector("#hierarchyCloseBtn")?.addEventListener("click", () => {
        this.modalRoot.innerHTML = "";
      });
      const modalBackdrop = this.modalRoot.querySelector(".hierarchy-modal-overlay");
      modalBackdrop?.addEventListener("click", (e) => {
        if (e.target === modalBackdrop) this.modalRoot.innerHTML = "";
      });

      this.modalRoot.querySelectorAll("[data-ws-select]").forEach((btn) => {
        btn.addEventListener("click", () => {
          currentWsId = btn.dataset.wsSelect;
          renderModal(this.modalRoot.querySelector("#hierarchySearchInput")?.value || "");
        });
      });

      this.modalRoot.querySelectorAll("[data-view-mode]").forEach((btn) => {
        btn.addEventListener("click", () => {
          currentViewMode = btn.dataset.viewMode;
          renderModal(this.modalRoot.querySelector("#hierarchySearchInput")?.value || "");
        });
      });

      const searchInp = this.modalRoot.querySelector("#hierarchySearchInput");
      searchInp?.addEventListener("input", (e) => {
        renderModal(e.target.value);
        const newInp = this.modalRoot.querySelector("#hierarchySearchInput");
        if (newInp) {
          newInp.focus();
          newInp.selectionStart = newInp.selectionEnd = newInp.value.length;
        }
      });

      this.modalRoot.querySelectorAll("[data-focus-node]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const nodeId = btn.dataset.focusNode;
          const node = this.store.node(nodeId);
          if (node) {
            this.modalRoot.innerHTML = "";
            if (node.workspaceId && node.workspaceId !== this.store.state.activeWorkspaceId) {
              this.goToWorkspace(node.workspaceId);
            }
            this.canvas.select(node.id);
            this.canvas.smoothZoomToNode(node, 0.75);
            this.toast?.(`Focused “${node.prompt || "Card"}” on workspace canvas`);
          }
        });
      });
    };

    renderModal();
  }

  openWorkspaceThemesModal() {
    const activeWs = this.store.activeWorkspace();
    const currentTheme = activeWs?.themeId || "matrix";

    this.modalRoot.innerHTML = `
      <div id="workspaceThemesModal" class="modal theme-picker-overlay" role="dialog" aria-modal="true">
        <div class="modal-card theme-picker-card">
          <div class="modal-head">
            <div>
              <h2 style="margin:0;font-family:var(--display);font-size:19px;color:#f8fafc;">Workspace Themes &amp; Color Palettes</h2>
              <p style="margin:3px 0 0;font-size:12px;color:#94a3b8;">Select an atmospheric theme for “${escapeHtml(
                activeWs?.name || "Workspace"
              )}”. All settings persist automatically.</p>
            </div>
            <button class="modal-close" id="themePickerCloseBtn">×</button>
          </div>
          <div class="theme-picker-grid">
            ${THEME_DETAILS.map((t) => {
              const isActive = t.id === currentTheme;
              return `
                <div class="theme-card-option ${isActive ? "is-active" : ""}" data-theme-id="${t.id}">
                  ${isActive ? `<span class="theme-card-active-pill">ACTIVE</span>` : ""}
                  <div class="theme-swatches-strip">
                    <div class="theme-swatch-box" style="background:${t.bg}"></div>
                    <div class="theme-swatch-box" style="background:${t.color}"></div>
                    <div class="theme-swatch-box" style="background:${t.bg};filter:invert(0.2);"></div>
                  </div>
                  <div class="theme-card-info">
                    <h4>${escapeHtml(t.name)}</h4>
                    <p>${escapeHtml(t.desc)}</p>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `;

    this.modalRoot.querySelector("#themePickerCloseBtn")?.addEventListener("click", () => {
      this.modalRoot.innerHTML = "";
    });
    const backdrop = this.modalRoot.querySelector(".theme-picker-overlay");
    backdrop?.addEventListener("click", (e) => {
      if (e.target === backdrop) this.modalRoot.innerHTML = "";
    });

    this.modalRoot.querySelectorAll("[data-theme-id]").forEach((card) => {
      card.addEventListener("click", () => {
        const themeId = card.dataset.themeId;
        if (activeWs) {
          this.store.setWorkspaceTheme(activeWs.id, themeId);
          this.applyTheme();
          const detail = THEME_DETAILS.find((t) => t.id === themeId);
          this.toast?.(`Applied workspace theme: ${detail?.name || themeId}`);
          this.modalRoot.innerHTML = "";
        }
      });
    });
  }

  openAdminDashboard(initialTab = "vaults") {
    if (!this.adminDashboard) {
      this.adminDashboard = new AdminDashboard({
        store: this.store,
        canvas: this.canvas,
        toast: (msg) => this.toast(msg),
      });
      window.adminDashboard = this.adminDashboard;
    }
    this.adminDashboard.open(initialTab);
  }

  explore(topic) {
    const clean = topic.trim();
    if (!clean) return;
    this.store.recordSearch(clean);
    const center = this.canvas.viewportCenter();
    const count = this.store.nodes().length;
    const node = this.store.createNode({
      prompt: clean,
      x: Math.round(center.x - 380 + (count % 3) * 120),
      y: Math.round(center.y - 290 + (count % 3) * 90),
      width: 760,
      height: 580,
    });
    this.canvas.select(node.id);
    this.canvas.centerOn(node);
    this.toast(`Mapped “${clean}” to the canvas.`);
    this.searchInput.value = "";
  }

  addCustomNote() {
    const center = this.canvas.viewportCenter();
    const node = this.store.createNode({
      prompt: "Untitled Note",
      isCustom: true,
      x: Math.round(center.x - 380),
      y: Math.round(center.y - 290),
      width: 760,
      height: 580,
    });
    this.canvas.select(node.id);
    this.canvas.beginEdit(node.id);
    this.toast("Blank note created. Double-click to write.");
  }

  addSticky(text = "") {
    const box = this.canvas.visibleBox();
    const point = this.canvas.screenToWorld(box.left + 70, box.height - 290);
    const sticky = this.store.createSticky({
      x: Math.round(point.x + (Math.random() * 40 - 20)),
      y: Math.round(point.y + (Math.random() * 30 - 15)),
      text,
    });
    this.toast("Added sticky memo to workspace.");
    return sticky;
  }

  togglePanel() {
    this.sidebar.classList.toggle("is-collapsed");
    document.querySelector("#panelToggle").classList.toggle("is-active", !this.sidebar.classList.contains("is-collapsed"));
  }

  resetWorkspace() {
    const ws = this.store.activeWorkspace();
    if (!confirm(`Reset “${ws.name}”? This removes every node and memo in this workspace.`)) return;
    for (const n of this.store.nodes()) this.store.deleteNode(n.id);
    for (const s of this.store.stickies()) this.store.deleteSticky(s.id);
    this.toast("Canvas reset.");
  }

  openExport() {
    const selected = [...this.canvas.selected];
    const scoped = selected.length
      ? this.store.nodes().filter((n) => this.canvas.selected.has(n.id))
      : this.store.nodes();
    if (!scoped.length) {
      this.toast?.("Add or select a card first, then export.");
      return;
    }
    const scope = selected.length ? `${selected.length} selected card${selected.length === 1 ? "" : "s"}` : `all ${scoped.length} card${scoped.length === 1 ? "" : "s"} in this workspace`;
    this.openModal(`
      <div class="modal-head">
        <div><span class="eyebrow">EXPORT DOSSIER</span><h2>Download cards</h2>
        <p>${escapeHtml(scope)} · includes tags, tables, code blocks and links.</p></div>
        <button class="icon-btn" data-close-modal aria-label="Close">${icon("x", 18)}</button>
      </div>
      <div class="modal-body">
        <div class="export-grid">
          <button class="export-option accent-html" data-modal-action="export-html"><strong>🌐 INTERACTIVE HTML</strong><span>Standalone offline interactive webpage</span></button>
          <button class="export-option accent-obsidian" data-modal-action="export-obsidian"><strong>💎 OBSIDIAN VAULT (.ZIP)</strong><span>Markdown vault with frontmatter &amp; [[wikilinks]]</span></button>
          <button class="export-option accent-gdocs" data-modal-action="export-gdocs"><strong>GOOGLE DOCS</strong><span>Save to Google Docs (docs.new)</span></button>
          <button class="export-option accent-gdrive" data-modal-action="export-gdrive"><strong>GOOGLE DRIVE</strong><span>Cloud sync &amp; open drive</span></button>
          <button class="export-option" data-modal-action="export-pdf"><strong>PDF</strong><span>Print-ready A4 document</span></button>
          <button class="export-option" data-modal-action="export-doc"><strong>DOC</strong><span>Editable Word document</span></button>
          <button class="export-option" data-modal-action="export-txt"><strong>TXT</strong><span>Plain text, smallest file</span></button>
        </div>
        <p class="export-hint">Tip: select cards on the canvas (shift-click) to export only those.</p>
      </div>
    `);
  }

  downloadCards(format) {
    const selected = [...this.canvas.selected];
    const nodes = selected.length ? this.store.nodes().filter((n) => this.canvas.selected.has(n.id)) : this.store.nodes();
    if (!nodes.length) {
      this.toast?.("Nothing to export yet.");
      return;
    }
    try {
      const report = buildReport({ workspace: this.store.activeWorkspace(), nodes, links: this.store.links() });
      const extra = {
        workspace: this.store.activeWorkspace(),
        nodes,
        links: this.store.links(),
        stickies: this.store.stickies(),
      };
      const filename = exportReport(report, format, extra);
      this.closeModal();
      this.toast?.(`Downloaded ${filename}.`);
    } catch (err) {
      this.toast?.(`Export failed: ${err.message}`);
    }
  }

  exportWorkspace() {
    const ws = this.store.activeWorkspace();
    const nodes = this.store.nodes();
    const stickies = this.store.stickies();
    const link = this.store.links();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const lines = [
      `# ${ws.name}`,
      `Exported ${new Date().toLocaleString()} · ${nodes.length} nodes · ${stickies.length} memos`,
      "",
      ...nodes.map(
        (n) =>
          `## ${n.prompt}\n\n${n.text || "_(empty)_"}\n\n${
            link.filter((l) => l.sourceId === n.id && byId.get(l.targetId)).map((l) => `→ ${byId.get(l.targetId).prompt}`).join("\n")
          }`
      ),
      ...(stickies.length ? ["", "## Sticky memos", ...stickies.map((s) => `- ${s.text || "(empty memo)"}`)] : []),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${ws.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-brainvault.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast("Workspace dossier downloaded as Markdown.");
  }

  // --- dictionary -----------------------------------------------------------
  addDictionaryTerm(term) {
    const center = this.canvas.viewportCenter();
    const def = glossaryDef(term);
    const node = this.store.createNode({
      prompt: def.term,
      x: Math.round(center.x - 380),
      y: Math.round(center.y - 290),
      width: 760,
      height: 580,
    });
    this.store.updateNode(node.id, {
      text: `### ${def.term}\n\n${def.definition}\n\n**Frame of use:** ${def.frame}\n\n> ${def.example}`,
    });
    this.canvas.select(node.id);
    this.canvas.centerOn(node);
    this.toast(`“${def.term}” added as a canvas node.`);
  }

  // --- sidebar --------------------------------------------------------------
  applyTheme() {
    const ws = this.store.activeWorkspace();
    const theme = THEMES.includes(ws?.themeId) ? ws.themeId : "matrix";
    document.documentElement.dataset.theme = theme;
  }

  render() {
    this.applyTheme();
    this.renderHeader();
    this.renderSidebar();
    const currentHash = location.hash.replace(/^#/, "");
    if (this.landingPage?.isOpen || currentHash === "/home" || currentHash === "home" || currentHash === "" || currentHash === "/") return;
    if (currentHash.startsWith("/threats") || currentHash.startsWith("/cves") || currentHash.startsWith("/osv") || currentHash.startsWith("/newsdata")) return;
    const want = `#/w/${this.store.state.activeWorkspaceId}`;
    if (location.hash !== want) history.replaceState(null, "", want);
  }

  renderHeader() {
    const ws = this.store.activeWorkspace();
    const nodes = this.store.nodes();
    const count = nodes.length;
    document.querySelector("#termWorkspace").textContent = ws?.name || "Workspace";
    document.querySelector("#nodeCount").textContent = count;
    document.querySelector("#nodeCount").parentElement?.classList.toggle("has-nodes", count > 0);
    const title = document.querySelector("#workspaceTitle");
    if (title) title.textContent = ws?.name || "Workspace";
    document.title = `${ws?.name || "BrainVault"} · BrainVault`;
    const undo = this.header.querySelector('[data-cmd="undo"]');
    const redo = this.header.querySelector('[data-cmd="redo"]');
    if (undo) undo.disabled = !this.store.canUndo;
    if (redo) redo.disabled = !this.store.canRedo;
    const tabBtns = document.querySelectorAll("#sidebarTabs [data-tab]");
    tabBtns.forEach((b) => b.classList.toggle("is-active", b.dataset.tab === this.tab));

    // Update DB Sync chip status dynamically
    const dbBtn = document.querySelector("#dbSyncBtn");
    if (dbBtn) {
      const status = this.store.dbStatus || "synced";
      dbBtn.classList.remove("status-syncing", "status-offline");
      const label = dbBtn.querySelector(".db-sync-label");
      if (status === "syncing") {
        dbBtn.classList.add("status-syncing");
        if (label) label.textContent = "Syncing…";
        dbBtn.title = "Syncing with SQLite Database (brainvault.db)…";
      } else if (status === "offline" || status === "error") {
        dbBtn.classList.add("status-offline");
        if (label) label.textContent = "Local Mode";
        dbBtn.title = "SQLite backend disconnected. Operating in local storage mode.";
      } else {
        if (label) label.textContent = "DB Synced";
        dbBtn.title = "SQLite Database & Local DB Synced (Click to manage sync)";
      }
    }
  }

  renderSidebar() {
    document.querySelectorAll("#sidebarTabs [data-tab]").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.tab === this.tab)
    );
    const body = this.sidebarBody;
    const ws = this.store.activeWorkspace();
    if (!ws) return;
    if (this.tab === "workspaces") body.innerHTML = this.templateWorkspaces(ws);
    else if (this.tab === "notes") body.innerHTML = this.templateNotes();
    else if (this.tab === "sticky") body.innerHTML = this.templateStickies();
    else if (this.tab === "dictionary") body.innerHTML = this.templateDictionary();
    else if (this.tab === "plugins") body.innerHTML = this.templatePlugins();
    this.renderStats();

    if (typeof window.anime === "function") {
      const items = body.querySelectorAll(".ws-card, .tree-row, .note-row, .sticky-row, .note-hier-row, .recent-row");
      if (items.length) {
        window.anime({
          targets: items,
          opacity: [0, 1],
          translateX: [-10, 0],
          delay: window.anime.stagger(20),
          duration: 260,
          easing: "easeOutQuad",
        });
      }
    }
  }

  renderStats() {
    const nodes = this.store.nodes();
    document.querySelector("#statTotal").textContent = nodes.length;
    document.querySelector("#statPrimary").textContent = nodes.filter((n) => !n.parentId).length;
    document.querySelector("#statSub").textContent = nodes.filter((n) => n.parentId).length;
  }

  templateWorkspaces(ws) {
    const history = this.store.state.searchHistory;
    const workspaces = this.store.state.workspaces;
    const wsNodes = this.store.nodes();
    const tree = wsNodes.filter((n) => !n.parentId);
    return `
      <div class="side-section">
        <div class="side-label"><span>${icon("sparkles", 12)} RECENT SEARCHES</span><span class="hint-chip">LAST ${Math.min(5, history.length)}</span></div>
        ${
          history.length
            ? history.slice(0, 5).map((t) => `<button class="recent-row" data-recent="${escapeAttr(t)}"><span class="dot"></span><span class="truncate">${escapeHtml(t)}</span><span class="regen">REGEN</span></button>`).join("")
            : `<p class="side-empty">No recent searches yet. Explore any topic above.</p>`
        }
      </div>
      <div class="side-section tight">
        <button class="btn wide" data-ws-new>${icon("plus", 15)} + NEW WORKSPACE</button>
        <div class="slider-row">
          <span class="slider-label">${icon("layers", 12)} Panel Shadow Intensity</span>
          <span class="value-chip">${ws.shadow}%</span>
        </div>
        <input id="shadowSlider" type="range" min="0" max="100" step="5" value="${ws.shadow}" aria-label="Panel shadow intensity" />
      </div>
      <div class="side-section grow">
        <div class="side-label"><span>WORKSPACES (${workspaces.length})</span><span class="hint-chip">LOCAL</span></div>
        ${workspaces
          .map(
            (w) => `
          <div class="ws-card ${w.id === ws.id ? "is-active" : ""}" data-ws="${w.id}">
            <span class="ws-colorbar" style="background:${w.color}"></span>
            <div class="ws-main" data-ws-open="${w.id}">
              <strong class="truncate">${escapeHtml(w.name)}</strong>
              <span class="ws-meta">${this.store.nodes(w.id).length} nodes · ${w.color}</span>
            </div>
            <div class="ws-actions">
              <label class="icon-btn" title="Workspace colour"><input type="color" data-ws-color="${w.id}" value="${w.color}" aria-label="Workspace colour" />${icon("palette", 13)}</label>
              <button class="icon-btn" data-ws-rename="${w.id}" title="Rename workspace">${icon("edit", 13)}</button>
              <button class="icon-btn" data-ws-dup="${w.id}" title="Duplicate workspace">${icon("copy", 13)}</button>
              <button class="icon-btn danger" data-ws-del="${w.id}" title="Delete workspace" ${workspaces.length <= 1 ? "disabled" : ""}>${icon("trash", 13)}</button>
            </div>
          </div>`
          )
          .join("")}
        <div class="side-label spaced"><span>WORKSPACE NODES (${wsNodes.length})</span></div>
        ${
          tree.length
            ? tree
                .map((n) => {
                  const kids = wsNodes.filter((x) => x.parentId === n.id);
                  const isNodeSelected = this.canvas?.selected?.has(n.id);
                  return `<div class="tree-node">
                    <button class="tree-row ${isNodeSelected ? 'is-selected is-active' : ''}" data-focus="${n.id}" style="--row-color:${n.color};">
                      <span class="dot" style="background:${n.color}"></span>
                      <span class="truncate">${escapeHtml(n.prompt)}</span>
                      <span class="tree-badge">${kids.length ? `+${kids.length}` : "0"}</span>
                    </button>
                    ${kids
                      .map((k) => {
                        const isKidSelected = this.canvas?.selected?.has(k.id);
                        return `<button class="tree-row sub ${isKidSelected ? 'is-selected is-active' : ''}" data-focus="${k.id}" style="--row-color:${k.color};"><span class="dot" style="background:${k.color}"></span><span class="truncate">${escapeHtml(k.prompt)}</span></button>`;
                      })
                      .join("")}
                  </div>`;
                })
                .join("")
            : `<p class="side-empty">No cards in this workspace yet. Explore a topic or add a note.</p>`
        }
      </div>
      <div class="side-section db">
        <div class="side-label"><span>${icon("save", 12)} DATABASE SYNC</span><span class="db-status"><i></i>LOCAL</span></div>
        <p class="side-empty">Browser storage is the source of truth. Server mirror is optional.</p>
        <div class="db-actions">
          <button class="btn small" data-db="save">${icon("save", 13)} SAVE TO DB</button>
          <button class="btn small" data-db="sync">${icon("refresh", 13)} SYNC FROM DB</button>
        </div>
      </div>`;
  }

  templateNotes() {
    const allNodes = this.store.nodes();
    const words = allNodes.reduce((n, node) => n + (node.text || "").split(/\s+/).filter(Boolean).length, 0);

    // Group hierarchically: primary roots followed immediately by their children sub-nodes
    const roots = allNodes.filter((n) => !n.parentId);
    const childMap = new Map();
    for (const n of allNodes) {
      if (n.parentId) {
        if (!childMap.has(n.parentId)) childMap.set(n.parentId, []);
        childMap.get(n.parentId).push(n);
      }
    }

    const orderedItems = [];
    const visited = new Set();
    const traverse = (node, depth, parentNode) => {
      visited.add(node.id);
      orderedItems.push({
        node,
        depth,
        isSub: !!node.parentId,
        parentNode,
      });
      const children = childMap.get(node.id) || [];
      for (const child of children) {
        traverse(child, depth + 1, node);
      }
    };

    for (const r of roots) {
      traverse(r, 0, null);
    }
    // Any remaining or orphaned nodes
    for (const n of allNodes) {
      if (!visited.has(n.id)) {
        const p = allNodes.find((x) => x.id === n.parentId) || null;
        orderedItems.push({
          node: n,
          depth: n.parentId ? 1 : 0,
          isSub: !!n.parentId,
          parentNode: p,
        });
      }
    }

    return `
      <div class="side-section">
        <button class="btn wide" data-note-new>${icon("plus", 15)} + NEW NOTE</button>
        <input class="side-search" type="search" placeholder="Search notes by title or text…" id="noteFilter" />
        <div class="notes-summary"><span>Showing ${allNodes.length} of ${allNodes.length} notes</span><strong>${words} total words</strong></div>
      </div>
      <div class="side-section grow notes-list">
        ${orderedItems
          .map(({ node: n, isSub, depth, parentNode }) => {
            const cardColor = n.color || "#38bdf8";
            const wordCount = (n.text || "").split(/\s+/).filter(Boolean).length;
            const parentName = parentNode ? parentNode.prompt : "";
            const searchTerms = `${n.prompt} ${n.text || ""} ${isSub ? "sub-node child" : "primary root"} ${parentName}`.toLowerCase();

            const isSelected = this.canvas?.selected?.has(n.id);

            return `<div class="note-row ${isSub ? "is-sub-node" : "is-primary-node"}${isSelected ? " is-selected" : ""}"
                         style="--row-color: ${cardColor};"
                         data-depth="${depth}"
                         data-node-id="${n.id}"
                         data-search="${escapeAttr(searchTerms)}">
              ${isSub ? `<span class="note-branch-connector" title="Sub-node of: ${escapeAttr(parentName || "Parent")}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v12h12"/><path d="m14 11 4 4-4 4"/></svg></span>` : ""}
              <span class="dot" style="background:${cardColor}; box-shadow: 0 0 8px ${cardColor};"></span>
              <button class="note-main" data-focus="${n.id}" title="Focus “${escapeAttr(n.prompt)}”">
                <span class="note-title truncate">${escapeHtml(n.prompt)}</span>
                <span class="note-meta">
                  <span class="note-pill ${isSub ? "pill-sub" : "pill-primary"}">${isSub ? "SUB-NODE" : "PRIMARY"}</span>
                  <span class="note-words">${wordCount} W</span>
                  ${isSub && parentName ? `<span class="note-parent-hint truncate" title="Child of ${escapeAttr(parentName)}">↳ ${escapeHtml(parentName)}</span>` : ""}
                </span>
              </button>
              <div class="note-actions">
                <button class="icon-btn" data-focus="${n.id}" title="Jump to note">${icon("eye", 13)}</button>
                <button class="icon-btn" data-note-edit="${n.id}" title="Edit note">${icon("edit", 13)}</button>
                <button class="icon-btn danger" data-note-del="${n.id}" title="Delete note">${icon("trash", 13)}</button>
              </div>
            </div>`;
          })
          .join("") || `<p class="side-empty">No notes yet.</p>`}
      </div>`;
  }

  templateStickies() {
    const stickies = this.store.stickies();
    return `<div class="side-section">
        <button class="btn wide" data-sticky-new>${icon("sticky", 15)} + NEW STICKY MEMO</button>
      </div>
      <div class="side-section grow">
        <div class="side-label"><span>STICKY MEMOS (${stickies.length})</span></div>
        ${
          stickies
            .map(
              (s, i) => `<div class="memo-row" style="--sticky:${s.color}">
                <span class="memo-index">${String(i + 1).padStart(2, "0")}</span>
                <button class="memo-main" data-memo-focus="${s.id}">
                  <span class="truncate">${escapeHtml(s.text || "(Empty sticky memo)")}</span>
                </button>
                <button class="icon-btn danger" data-memo-del="${s.id}">${icon("trash", 12)}</button>
              </div>`
            )
            .join("") || `<p class="side-empty">No sticky notes on this workspace yet.</p>`
        }
      </div>`;
  }

  templateDictionary() {
    const term = VOCABULARY[this.dictIndex % VOCABULARY.length];
    return `<div class="side-section">
        <input class="side-search" type="search" placeholder="Search vocabulary term bank…" id="dictFilter" />
      </div>
      <div class="side-section">
        <div class="daily-term">
          <div class="side-label"><span>${icon("book", 12)} DAILY TERM FOCUS</span><button class="chip-btn" data-dict-next>${icon("refresh", 11)} Next Term</button></div>
          <h3>${escapeHtml(term.term)}</h3>
          <p class="ipa">${escapeHtml(term.ipa)} <span>·</span> ${escapeHtml(term.pos)}</p>
          <p class="def">${escapeHtml(term.definition)}</p>
          <div class="frame"><span>FRAME OF USE:</span> ${escapeHtml(term.frame)}<q>${escapeHtml(term.example)}</q></div>
          <button class="btn wide primary" data-dict-add="${escapeAttr(term.term)}">${icon("plus", 13)} Add Term as Canvas Node</button>
        </div>
      </div>
      <div class="side-section grow">
        <div class="side-label"><span>VOCABULARY LIST (${VOCABULARY.length} TERMS)</span></div>
        ${VOCABULARY.map(
          (v) => `<div class="vocab-row">
            <div class="vocab-head"><strong>${escapeHtml(v.term)}</strong><button class="chip-btn" data-dict-add="${escapeAttr(v.term)}">+ Add</button></div>
            <p>${escapeHtml(v.definition)}</p>
            <span class="vocab-frame">Frame: ${escapeHtml(v.frame)}</span>
          </div>`
        ).join("")}
      </div>`;
  }

  templatePlugins() {
    const plugins = [
      ["Top Weaponized CVEs (2020–2026)", "Active", "Live weaponized CVE database with CVSS v3.1/v4.0, CISA KEV & NVD 2.0 sync."],
      ["OSV.dev Security News", "Active", "Open source vulnerability research and supply chain telemetry dispatches."],
      ["Notes List Manager", "Active", "Structured multi-column list, filters, inline editing."],
      ["Linux CLI Terminal", "Active", "Shell strip docked to the canvas for quick commands."],
      ["Document Exporter", "Active", "PNG, Markdown, PDF and TXT dossier exports."],
      ["Markdown & Syntax", "Active", "Live headings, bold, glossary links, code and tables."],
      ["Glass Theme Customizer", "Active", "Shadow intensity and per-workspace colour themes."],
      ["Voice Memo Recorder", "Free Plugin", "Attach audio memos to cards (next pass)."],
      ["AI Auto-Tagger", "Free Plugin", "Key points and tags extracted from long notes (next pass)."],
    ];
    return `<div class="side-section grow">
        <div class="side-label"><span>${icon("grid", 12)} FREE ADD-ON PLUGINS</span></div>
        ${plugins
          .map(
            ([title, status, desc]) => `<div class="plugin-row">
              <div class="plugin-head"><strong>${title}</strong><span class="status ${status === "Active" ? "on" : ""}">${status}</span></div>
              <p>${desc}</p>
            </div>`
          )
          .join("")}
        <button class="btn wide accent-cyan" data-cves-launch style="margin-bottom: 8px;">⚡ TOP CVES (2020–2026) DATABASE</button>
        <button class="btn wide accent-emerald" data-osv-launch style="margin-bottom: 8px;">🛡️ OSV.DEV SECURITY NEWS</button>
        <button class="btn wide accent-purple" data-admin-launch style="margin-bottom: 8px;">${icon("shield", 13)} BRAINVAULT MASTER ADMIN PANEL</button>
        <button class="btn wide" data-news-hub>${icon("radio", 13)} LAUNCH NEWS API HUB</button>
      </div>`;
  }

  // --- sidebar events -------------------------------------------------------
  onSidebarClick(e) {
    const act = (sel) => e.target.closest(sel);
    if (act("[data-cves-launch]")) return this.openAdminDashboard("cves");
    if (act("[data-osv-launch]")) return this.openAdminDashboard("osv");
    if (act("[data-admin-launch]")) return this.openAdminDashboard("vaults");
    if (act("[data-ws-new]")) {
      this.askText({
        title: "New workspace",
        hint: "Each workspace keeps its own cards, memos, theme and camera framing.",
        value: `Workspace ${this.store.state.workspaces.length + 1}`,
      }).then((name) => {
        if (name === null) return;
        const ws = this.store.createWorkspace(name || undefined);
        this.goToWorkspace(ws.id);
        this.canvas.fit();
        this.toast(`Created “${ws.name}”.`);
      });
      return;
    }
    if (act("[data-ws-open]")) return this.goToWorkspace(act("[data-ws-open]").dataset.wsOpen);
    if (act("[data-ws-rename]")) {
      const id = act("[data-ws-rename]").dataset.wsRename;
      const ws = this.store.state.workspaces.find((w) => w.id === id);
      this.askText({ title: "Rename workspace", hint: "The new name syncs to the header, terminal and export.", value: ws.name }).then((name) => {
        if (name !== null) this.store.renameWorkspace(id, name);
      });
      return;
    }
    if (act("[data-ws-dup]")) {
      const copy = this.store.duplicateWorkspace(act("[data-ws-dup]").dataset.wsDup);
      if (copy) {
        this.goToWorkspace(copy.id);
        this.toast(`Duplicated as “${copy.name}”.`);
      }
      return;
    }
    if (act("[data-ws-del]")) {
      const id = act("[data-ws-del]").dataset.wsDel;
      const ws = this.store.state.workspaces.find((w) => w.id === id);
      if (!confirm(`Delete workspace “${ws.name}” and all of its cards?`)) return;
      if (this.store.deleteWorkspace(id)) {
        this.goToWorkspace(this.store.state.activeWorkspaceId);
        this.toast("Workspace deleted.");
      }
      return;
    }
    if (act("[data-recent]")) return this.explore(act("[data-recent]").dataset.recent);
    if (act("[data-note-new]")) return this.addCustomNote();
    if (act("[data-note-edit]")) {
      const node = this.store.node(act("[data-note-edit]").dataset.noteEdit);
      if (node) {
        if (typeof this.canvas.smoothZoomToNode === "function") {
          this.canvas.smoothZoomToNode(node, 0.8);
        } else {
          this.canvas.select(node.id);
          this.canvas.centerOn(node);
        }
        this.canvas.beginEdit(node.id);
      }
      return;
    }
    if (act("[data-note-del]")) return this.store.deleteNode(act("[data-note-del]").dataset.noteDel);
    const focusTarget = act("[data-focus]");
    const clickedNoteRow = act(".note-row");
    const focusId = focusTarget?.dataset?.focus || clickedNoteRow?.dataset?.nodeId;
    if (focusId) {
      const node = this.store.node(focusId);
      if (node) {
        if (typeof this.canvas.smoothZoomToNode === "function") {
          this.canvas.smoothZoomToNode(node, 0.8);
        } else {
          this.canvas.select(node.id);
          this.canvas.centerOn(node);
        }
        // Animated subtle micro-glow effect on card & parent
        const cardEl = this.canvas.root.querySelector(`[data-id="${node.id}"]`);
        if (cardEl) {
          cardEl.classList.remove("card-glow-focus");
          void cardEl.offsetWidth;
          cardEl.classList.add("card-glow-focus");
          setTimeout(() => cardEl?.classList.remove("card-glow-focus"), 1100);
        }
        if (node.parentId) {
          const parentEl = this.canvas.root.querySelector(`[data-id="${node.parentId}"]`);
          if (parentEl) {
            parentEl.classList.remove("card-parent-glow");
            void parentEl.offsetWidth;
            parentEl.classList.add("card-parent-glow");
            setTimeout(() => parentEl?.classList.remove("card-parent-glow"), 1100);
          }
        }
        // Three.js 3D animation pulse
        if (window.tree3d && typeof window.tree3d.pulseToNode === "function") {
          window.tree3d.pulseToNode(node);
        }
        this.toast(`Focused “${node.prompt}” (80% Zoom)`);
        const allRows = this.sidebarBody.querySelectorAll(".note-row");
        for (const r of allRows) {
          r.classList.toggle("is-selected", r.dataset.nodeId === node.id);
        }
      }
      return;
    }
    if (act("[data-sticky-new]")) return this.addSticky();
    if (act("[data-memo-focus]")) {
      const s = this.store.sticky(act("[data-memo-focus]").dataset.memoFocus);
      if (s) {
        if (typeof this.canvas.smoothZoomToNode === "function") {
          this.canvas.smoothZoomToNode(s, 0.8);
        } else {
          this.store.setTransform({ x: this.rootCenterX(s), y: this.rootCenterY(s) });
        }
        this.toast(`Focused sticky memo (80% Zoom)`);
      }
      return;
    }
    if (act("[data-memo-del]")) return this.store.deleteSticky(act("[data-memo-del]").dataset.memoDel);
    if (act("[data-dict-next]")) {
      this.dictIndex = (this.dictIndex + 1) % VOCABULARY.length;
      this.renderSidebar();
      return;
    }
    if (act("[data-dict-add]")) return this.addDictionaryTerm(act("[data-dict-add]").dataset.dictAdd);
    if (act("[data-news-hub]")) return this.openNewsHub();
    if (act("[data-db]")) return this.syncDatabase(act("[data-db]").dataset.db);
    if (act("[data-untag]")) return this.store.removeTag(act("[data-untag]").dataset.untag);
  }

  rootCenterX(s) {
    return this.canvas.root.clientWidth / 2 - (s.x + s.width / 2) * this.canvas.camera.scale;
  }
  rootCenterY(s) {
    return this.canvas.root.clientHeight / 2 - (s.y + s.height / 2) * this.canvas.camera.scale;
  }

  async syncDatabase(kind) {
    try {
      if (kind === "save") {
        await this.store.saveToDatabase();
        this.toast("Snapshot saved to the server database.");
      } else {
        await this.store.syncFromDatabase();
        this.toast("Workspace synced from the server database.");
      }
    } catch (err) {
      this.toast("No server database attached — local browser storage is safe.");
    }
  }

  // --- modals ---------------------------------------------------------------
  // --- live feeds -----------------------------------------------------------
  openFeeds() {
    this.feedState = { tab: "cyber", query: "", articles: [], errors: [], fetchedAt: null, status: "loading" };
    this.openModal(`
      <div class="modal-head">
        <div><span class="eyebrow">LIVE · HN · DEV.TO · NVD · GITHUB · HUGGING FACE · OPENALEX</span><h2>Security &amp; Research Feeds</h2>
        <p>Keyless, CORS-open sources: cyber news, malware, bug bounties and fresh papers. Import any story as a card or memo.</p></div>
        <button class="icon-btn" data-close-modal aria-label="Close">${icon("x", 18)}</button>
      </div>
      <div class="modal-body">
        <div class="feed-tabs">
          <button class="feed-tab is-active" data-feed-tab="cyber">Cyber</button>
          <button class="feed-tab" data-feed-tab="malware">Malware</button>
          <button class="feed-tab" data-feed-tab="bounties">Bug Bounties</button>
          <button class="feed-tab" data-feed-tab="research">Research</button>
        </div>
        <form class="feed-toolbar" id="feedSearchForm" autocomplete="off">
          <input class="side-search" id="feedSearch" type="search" placeholder="Search all feeds (e.g., ransomware, CVE-2026, LLM security)…" aria-label="Search feeds" />
          <button class="btn primary" type="submit">${icon("search", 13)} SEARCH</button>
        </form>
        <div class="feed-live" id="feedLive"></div>
      </div>
    `);
    this.refreshFeed();
  }

  feedSkeleton() {
    return `<div class="skeleton-list">${Array.from({ length: 3 })
      .map(() => `<div class="feed-skeleton"><span class="sk sk-sm"></span><span class="sk sk-lg"></span><span class="sk sk-md"></span><div class="sk-actions"><span class="sk sk-btn"></span><span class="sk sk-btn"></span></div></div>`)
      .join("")}</div>`;
  }

  renderFeedBody() {
    const live = document.querySelector("#feedLive");
    if (!live || !this.feedState) return;
    const st = this.feedState;
    document.querySelectorAll("[data-feed-tab]").forEach((b) => b.classList.toggle("is-active", b.dataset.feedTab === st.tab));
    if (st.status === "loading") {
      live.innerHTML = this.feedSkeleton();
      return;
    }
    if (!st.articles.length && (st.status === "error" || st.errors.length)) {
      live.innerHTML = `<div class="feed-error">${icon("radio", 15)}<div><strong>Feeds unreachable.</strong><p>${st.errors.map(escapeHtml).join(" · ")}</p></div><button class="btn small" data-feed-retry>${icon("refresh", 12)} RETRY</button></div>`;
      return;
    }
    const banner = st.errors.length
      ? `<div class="feed-banner">${icon("radio", 13)} Partial outage — ${st.errors.map(escapeHtml).join(" · ")}</div>`
      : "";
    const items = st.articles
      .map(
        (a, i) => `<div class="feed-item">
          <div class="feed-head">
            <span class="feed-src ${a.source}">${escapeHtml(a.sourceLabel)}</span>
            ${a.badge ? `<span class="feed-badge">${escapeHtml(String(a.badge))}</span>` : ""}
            <span class="feed-meta">${escapeHtml(a.author)} · ${escapeHtml(timeAgo(a.publishedAt))}${
              a.source === "nvd" || a.source === "gh"
                ? ` · CVSS ${a.points || "n/a"}`
                : a.source === "hf" || a.source === "openalex"
                  ? ` · ${a.points} upvotes/citations`
                  : ` · ▲ ${a.points} · ${a.comments} comments`
            }</span>
          </div>
          <a class="feed-title" href="${escapeAttr(a.url)}" target="_blank" rel="noreferrer">${escapeHtml(a.title)}</a>
          ${a.excerpt ? `<p class="feed-desc">${escapeHtml(a.excerpt)}</p>` : ""}
          ${a.keywords.length ? `<div class="feed-tags">${a.keywords.map((k) => `<span class="feed-tag">${escapeHtml(k)}</span>`).join("")}</div>` : ""}
          <div class="feed-actions">
            <button class="btn small accent-cyan" data-feed-listen="${i}">🎧 BRIEF</button>
            <button class="btn small accent-violet" data-feed-intel="${i}">${icon("sparkles", 12)} 7 KEY DETAILS &amp; 10-LINE BRIEF</button>
            <button class="btn small primary" data-feed-import="${i}">${icon("plus", 12)} + CARD</button>
            <button class="btn small accent-emerald" data-feed-intel-card="${i}">${icon("layers", 12)} + INTEL CARD</button>
            <button class="btn small accent-gold" data-feed-sticky="${i}">${icon("sticky", 12)} MEMO</button>
            <a class="chip-btn" href="${escapeAttr(a.url)}" target="_blank" rel="noreferrer">SOURCE ↗</a>
            ${a.discussionUrl && a.discussionUrl !== a.url ? `<a class="chip-btn" href="${escapeAttr(a.discussionUrl)}" target="_blank" rel="noreferrer">FORUM ↗</a>` : ""}
          </div>
        </div>`
      )
      .join("");
    const empty = st.articles.length ? "" : `<p class="side-empty">No stories matched. Try another search term.</p>`;
    const bottom = st.articles.length
      ? `<div class="feed-bottom">
          <button class="btn primary" data-feed-top3>${icon("plus", 13)} IMPORT TOP 3 AS CARDS</button>
          <span class="feed-status">Fetched ${st.fetchedAt ? st.fetchedAt.toLocaleTimeString() : ""} · ${st.articles.length} stories · ${(st.sources || []).map(escapeHtml).join(" + ") || "live sources"} <button class="chip-btn" data-feed-retry>REFRESH</button></span>
        </div>`
      : "";
    live.innerHTML = `${banner}${items ? `<div class="feed-list">${items}</div>` : ""}${empty}${bottom}`;
  }

  openFeedIntel(index) {
    const a = this.feedState?.articles[index];
    if (!a) return;
    const details7 = generateKeyDetails7(a);
    const brief10 = generate10LineBrief(a);

    this.openModal(`
      <div class="modal-head">
        <div>
          <span class="eyebrow">${escapeHtml(a.sourceLabel)} · INTELLIGENCE BRIEFING</span>
          <h2>${escapeHtml(a.title)}</h2>
          <p>By ${escapeHtml(a.author)} · ${escapeHtml(timeAgo(a.publishedAt))} · ${a.badge || `${a.points} pts`}</p>
        </div>
        <button class="icon-btn" data-close-modal aria-label="Close">${icon("x", 18)}</button>
      </div>
      <div class="modal-body intel-modal-body">
        <div class="intel-block">
          <div class="intel-head">
            <span class="intel-tag" style="background:#8b5cf6">10-LINE BRIEF</span>
            <h3>Comprehensive Intelligence Brief (10 Lines)</h3>
          </div>
          <div class="brief-10-lines">
            ${brief10.map((line, idx) => `
              <div class="brief-row">
                <span class="brief-idx">${idx + 1}</span>
                <span class="brief-content">${escapeHtml(line.replace(/^\d+\.\s*/, ""))}</span>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="intel-block">
          <div class="intel-head">
            <span class="intel-tag" style="background:#06b6d4">7 KEY DETAILS</span>
            <h3>Key Details of 7 (In-Depth Technical Analysis)</h3>
          </div>
          <div class="details-7-grid">
            ${details7.map((k) => `
              <div class="detail-7-card">
                <div class="detail-7-num">DETAIL 0${k.num}</div>
                <div class="detail-7-title">${escapeHtml(k.title)}</div>
                <div class="detail-7-text">${escapeHtml(k.detail)}</div>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="intel-footer-actions">
          <button class="btn primary accent-cyan" data-feed-listen-brief="${index}">🎧 LISTEN 10-LINE BRIEF</button>
          <button class="btn primary accent-emerald" data-feed-intel-card="${index}">${icon("plus", 14)} IMPORT FULL INTEL CARD TO CANVAS</button>
          <button class="btn" data-feed-sticky="${index}">${icon("sticky", 13)} PIN TO MEMO</button>
          <a class="chip-btn" href="${escapeAttr(a.url)}" target="_blank" rel="noreferrer">OPEN SOURCE ↗</a>
        </div>
      </div>
    `);
  }

  importFeedIntelCard(index) {
    const a = this.feedState?.articles[index];
    if (!a) return;
    const center = this.canvas.viewportCenter();
    const node = this.store.createNode({
      prompt: a.title.length > 80 ? `${a.title.slice(0, 77)}…` : a.title,
      isCustom: true,
      x: Math.round(center.x - 340),
      y: Math.round(center.y - 300),
      width: 720,
      height: 640,
    });
    this.store.updateNode(node.id, {
      text: feedToIntelCardText(a),
      tags: [...(a.keywords || []).slice(0, 3), "intelligence", a.source],
    });
    this.closeModal();
    this.canvas.select(node.id);
    this.canvas.centerOn(node);
    this.toast(`Imported 7 Key Details & 10-Line Brief as canvas node.`);
  }

  async openDbSync() {
    let status = null;
    try {
      status = await this.store.databaseStatus();
    } catch (_) {}

    const wsCount = this.store.state.workspaces.length;
    const nodeCount = this.store.nodes().length;
    const stickyCount = this.store.stickies().length;
    const connState = status?.ok ? "Connected (SQLite3 Database)" : "Local Storage Mode";

    this.openModal(`
      <div class="modal-head">
        <div>
          <span class="eyebrow">PERSISTENCE &amp; DATABASE</span>
          <h2>Local DB &amp; SQLite Dual Sync</h2>
          <p>Created notes and workspaces automatically save to both your browser local DB and backend SQLite database.</p>
        </div>
        <button class="icon-btn" data-close-modal aria-label="Close">${icon("x", 18)}</button>
      </div>
      <div class="modal-body">
        <div class="db-sync-card">
          <div class="db-sync-head">
            <span class="db-badge ${status?.ok ? "is-online" : "is-local"}">● ${connState}</span>
            <span class="db-time">Engine: ${status?.engine || "sqlite3"} · ${status?.database || "brainvault.db"}</span>
          </div>
          <div class="db-stats-row">
            <div class="db-stat-box"><strong>${wsCount}</strong><span>Workspaces</span></div>
            <div class="db-stat-box"><strong>${nodeCount}</strong><span>Canvas Nodes</span></div>
            <div class="db-stat-box"><strong>${stickyCount}</strong><span>Sticky Memos</span></div>
          </div>
        </div>

        <div class="db-actions-list">
          <button class="btn primary accent-emerald" id="dbSaveNow">
            ${icon("download", 14)} SAVE TO DATABASE (SQLITE) NOW
          </button>
          <button class="btn accent-cyan" id="dbPullNow">
            ${icon("refresh", 14)} SYNC &amp; PULL FROM DATABASE
          </button>
        </div>

        <p class="export-hint">
          Dual-Persistence is ACTIVE: Any card or workspace created or modified is instantly saved to both Local DB (localStorage) and SQLite (brainvault.db).
        </p>
      </div>
    `);

    document.querySelector("#dbSaveNow")?.addEventListener("click", async () => {
      try {
        await this.store.saveToDatabase();
        this.toast("Saved all notes & workspaces to SQLite database!");
        this.closeModal();
      } catch (err) {
        this.toast(`Save failed: ${err.message}`);
      }
    });

    document.querySelector("#dbPullNow")?.addEventListener("click", async () => {
      try {
        await this.store.syncFromDatabase();
        this.toast("Synced and restored notes from SQLite database!");
        this.closeModal();
      } catch (err) {
        this.toast(`Sync failed: ${err.message}`);
      }
    });
  }

  openGDocsDialog() {
    const ws = this.store.activeWorkspace();
    const nodes = this.store.nodes();
    const selected = [...this.canvas.selected];
    const targetNodes = selected.length ? nodes.filter((n) => this.canvas.selected.has(n.id)) : nodes;
    
    this.openModal(`
      <div class="modal-head">
        <div>
          <span class="eyebrow">GOOGLE DRIVE &amp; GOOGLE DOCS</span>
          <h2>Save to Cloud (GDrive / GDocs)</h2>
          <p>Export your research notes formatted and ready to save to your Google Cloud account.</p>
        </div>
        <button class="icon-btn" data-close-modal aria-label="Close">${icon("x", 18)}</button>
      </div>
      <div class="modal-body">
        <div class="export-grid">
          <button class="export-option accent-gdocs" id="gdocsNewTab">
            <strong>SAVE TO GOOGLE DOCS</strong>
            <span>Copies formatted dossier and opens docs.new</span>
          </button>
          <button class="export-option accent-gdrive" id="gdriveSyncFolder">
            <strong>SYNC TO GOOGLE DRIVE</strong>
            <span>Saves HTML/DOC to cloud_gdrive_sync folder</span>
          </button>
          <button class="export-option" id="gdriveOpenWeb">
            <strong>OPEN GOOGLE DRIVE</strong>
            <span>Open Google Drive cloud web app</span>
          </button>
        </div>
        <p class="export-hint">
          Target: ${targetNodes.length} node(s) in "${escapeHtml(ws.name)}". Content is formatted with clean typography, tables, and links.
        </p>
      </div>
    `);

    document.querySelector("#gdocsNewTab")?.addEventListener("click", async () => {
      await this.exportToGDocs();
      this.closeModal();
    });

    document.querySelector("#gdriveSyncFolder")?.addEventListener("click", async () => {
      await this.exportToGDrive();
      this.closeModal();
    });

    document.querySelector("#gdriveOpenWeb")?.addEventListener("click", () => {
      window.open("https://drive.google.com", "_blank");
      this.closeModal();
    });
  }

  async exportToGDocs() {
    const ws = this.store.activeWorkspace();
    const selected = [...this.canvas.selected];
    const nodes = selected.length ? this.store.nodes().filter((n) => this.canvas.selected.has(n.id)) : this.store.nodes();
    const title = `${ws.name} - BrainVault Dossier`;

    const markdownDoc = [
      `# ${title}`,
      `*Exported on ${new Date().toLocaleString()} · ${nodes.length} research nodes*`,
      "",
      ...nodes.map((n, i) => `## ${i + 1}. ${n.prompt}\n\n${n.text || ""}\n`),
    ].join("\n");

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(markdownDoc);
      }
    } catch (_) {}

    try {
      await fetch("/api/gdrive/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: `<h1>${escapeHtml(title)}</h1><p><em>Exported on ${new Date().toLocaleString()}</em></p><hr/>` +
            nodes.map((n) => `<h3>${escapeHtml(n.prompt)}</h3><p>${(n.text || "").replace(/\n/g, "<br/>")}</p>`).join(""),
        }),
      });
    } catch (_) {}

    const open = window.confirm(`Dossier copied to clipboard and backed up to cloud sync!\n\nClick OK to open Google Docs (docs.new) in a new tab so you can paste (Ctrl+V) and save directly to your Google Docs.`);
    if (open) window.open("https://docs.new", "_blank");
    this.toast?.("Copied and ready for Google Docs!");
  }

  async exportToGDrive() {
    const ws = this.store.activeWorkspace();
    const nodes = this.store.nodes();
    const title = `${ws.name} - Cloud Backup`;
    try {
      const res = await fetch("/api/gdrive/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: `<h1>${escapeHtml(title)}</h1><p>BrainVault Cloud Backup · ${nodes.length} nodes</p><pre>${escapeHtml(JSON.stringify(this.store.state, null, 2))}</pre>`,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        this.toast(`Saved to Google Drive cloud sync folder: ${data.filename}`);
        const openDrive = window.confirm(`Saved to cloud sync folder: ${data.filename}.\n\nClick OK to open Google Drive in a new tab.`);
        if (openDrive) window.open("https://drive.google.com", "_blank");
      }
    } catch (err) {
      this.toast(`Drive save failed: ${err.message}`);
    }
  }

  async refreshFeed(bust = false) {
    if (!this.feedState) return;
    const st = this.feedState;
    st.status = "loading";
    this.renderFeedBody();
    try {
      const data = await loadFeed(st.tab, { query: st.query, bust });
      st.articles = data.articles;
      st.errors = data.errors;
      st.fetchedAt = data.fetchedAt;
      st.sources = data.sources;
      st.status = "ready";
    } catch (err) {
      st.errors = [String(err?.message || err)];
      st.articles = [];
      st.status = "error";
    }
    this.renderFeedBody();
  }

  importFeedCard(index) {
    const a = this.feedState?.articles[index];
    if (!a) return;
    const center = this.canvas.viewportCenter();
    const offset = this.store.nodes().length % 4;
    const node = this.store.createNode({
      prompt: a.title.length > 90 ? `${a.title.slice(0, 87)}…` : a.title,
      isCustom: true,
      x: Math.round(center.x - 380 + offset * 120),
      y: Math.round(center.y - 290 + offset * 110),
      width: 760,
      height: 580,
    });
    this.store.updateNode(node.id, { text: feedToCardText(a), tags: a.keywords.slice(0, 3) });
    this.canvas.select(node.id);
    this.canvas.centerOn(node);
    this.toast(`Imported “${a.title.slice(0, 48)}…” as a card.`);
  }

  importFeedSticky(index) {
    const a = this.feedState?.articles[index];
    if (!a) return;
    const box = this.canvas.visibleBox();
    const point = this.canvas.screenToWorld(box.left + box.width / 2, box.height / 2);
    this.store.createSticky({ x: Math.round(point.x - 130), y: Math.round(point.y - 110), text: feedToStickyText(a) });
    this.toast("Story pinned as a sticky memo.");
  }

  importFeedTop3() {
    const n = Math.min(3, this.feedState?.articles.length || 0);
    if (!n) return;
    for (let i = 0; i < n; i++) this.importFeedCard(i);
    this.toast(`Imported top ${n} stories as cards.`);
  }

  openNewsHub() {
    const rows = [
      ["Top Weaponized CVEs (2020–2026)", "live", "SQLite database of top critical weaponized CVEs with CISA KEV tags & CVSS scores."],
      ["NIST NVD 2.0 API Ingest", "live", "Live CVE 2.0 API integration merging live vulnerability records into database."],
      ["OSV.dev Security News", "live", "Open source vulnerability research and supply chain telemetry dispatches."],
      ["Wired News (WuBook Bridge)", "live", "Science, tech and cyber threat dispatches bridged via WuBook xrws service."],
      ["Hacker News (Algolia)", "live", "Cyber news, malware chatter and bug-bounty write-ups, freshest first."],
      ["Dev.to", "live", "Security, malware and bug-bounty article tags."],
      ["GitHub Advisories", "live", "Vulnerability and malware advisories, newest first."],
      ["Hugging Face Papers", "live", "Daily papers plus a cybersecurity paper search."],
      ["OpenAlex", "live", "Latest cybersecurity research records and citations."],
      ["arXiv export API", "blocked", "Sends no CORS header, so browsers refuse the read."],
      ["Reddit r/netsec", "blocked", "Public JSON endpoints answer 403 to browser clients."],
      ["CISA KEV / Semantic Scholar", "blocked", "No CORS header on their public endpoints."],
    ];
    this.openModal(`
      <div class="modal-head">
        <div><span class="eyebrow">FREE DATA HUB</span><h2>Live News &amp; Free Data Hub</h2>
        <p>Live status of every candidate source, checked against the browser's CORS rules.</p></div>
        <button class="icon-btn" data-close-modal aria-label="Close">${icon("x", 18)}</button>
      </div>
      <div class="modal-body">
        <div class="hub-rows">
          ${rows
            .map(
              ([name, status, note]) => `<div class="hub-row">
                <strong>${escapeHtml(name)}</strong>
                <span class="hub-status ${status}">${status === "live" ? "LIVE" : status === "key" ? "KEY NEEDED" : "BLOCKED"}</span>
                <p>${escapeHtml(note)}</p>
              </div>`
            )
            .join("")}
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 14px;">
          <button class="btn wide accent-cyan" data-hub-cves>⚡ LAUNCH TOP CVES (2020–2026) EXPLORER</button>
          <button class="btn wide accent-emerald" data-hub-osv>🛡️ LAUNCH OSV.DEV DISPATCHES</button>
          <button class="btn primary wide" data-news-open>${icon("radio", 13)} OPEN LIVE FEEDS (HN + DEV.TO)</button>
        </div>
      </div>
    `);
  }

  openConnections() {
    this.openModal(`
      <div class="modal-head">
        <div><span class="eyebrow">DATA BOUNDARY</span><h2>Connections</h2><p>One store, two mirrors.</p></div>
        <button class="icon-btn" data-close-modal aria-label="Close">${icon("x", 18)}</button>
      </div>
      <div class="modal-body">
        <div class="conn-row"><strong>Local machine</strong><span class="status on">Active</span><p>Every edit is written to <code>localStorage</code> under <code>brainvault.state.v2</code> immediately.</p></div>
        <div class="conn-row"><strong>Server database</strong><span class="status">Optional</span><p>POST/GET <code>/api/db/notes</code>. The sidebar buttons attempt the mirror and fall back to local mode.</p></div>
        <div class="conn-row"><strong>Cloud listener</strong><span class="status">Planned</span><p>Firestore or Supabase live sync plugs into the same persistence boundary.</p></div>
      </div>
    `);
  }

  openShortcuts() {
    const rows = [
      ["Scroll / pinch", "Zoom workspace"],
      ["Drag background", "Pan infinite canvas"],
      ["Drag card", "Move concept card"],
      ["Double-click card", "Edit note matter"],
      ["Double-click drag", "Marquee select cards"],
      ["Delete", "Remove selected cards"],
      ["⌘/Ctrl + Z", "Undo"],
      ["⌘/Ctrl + Shift + Z", "Redo"],
      ["Escape", "Deselect / close"],
    ];
    this.openModal(`
      <div class="modal-head">
        <div><span class="eyebrow">CANVAS MANUAL</span><h2>Keyboard &amp; pointer shortcuts</h2><p>Everything on the canvas has a direct gesture.</p></div>
        <button class="icon-btn" data-close-modal aria-label="Close">${icon("x", 18)}</button>
      </div>
      <div class="modal-body"><div class="shortcut-list">${rows
        .map(([k, d]) => `<div class="shortcut-row"><kbd>${k}</kbd><span>${d}</span></div>`)
        .join("")}</div></div>
    `);
  }

  askText({ title, hint, value = "" }) {
    return new Promise((resolve) => {
      this.openModal(`
        <div class="modal-head">
          <div><span class="eyebrow">STUDIO</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(hint || "")}</p></div>
          <button class="icon-btn" data-close-modal aria-label="Close">${icon("x", 18)}</button>
        </div>
        <form class="modal-body ask-form" id="askForm">
          <label class="ask-label">Name<input id="askInput" class="side-search" type="text" value="${escapeAttr(value)}" autocomplete="off" /></label>
          <div class="ask-actions"><button class="btn primary" type="submit">${icon("check", 13)} Save</button><button class="btn" type="button" data-close-modal>Cancel</button></div>
        </form>`);
      const form = this.modalRoot.querySelector("#askForm");
      const input = this.modalRoot.querySelector("#askInput");
      input.focus();
      input.select();
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        this._askResolver = null;
        this.closeModal();
        resolve(text);
      });
      this._askResolver = resolve;
    });
  }

  openModal(html) {
    this.modal = html;
    this.modalRoot.innerHTML = `<div class="modal-card">${html}</div>`;
    this.modalRoot.classList.remove("is-hidden");
  }

  closeModal() {
    if (this._askResolver) {
      this._askResolver(null);
      this._askResolver = null;
    }
    this.modal = null;
    this.modalRoot.classList.add("is-hidden");
    this.modalRoot.innerHTML = "";
  }

  modalAction(action) {
    if (action === "sample") this.explore("Cyber Threat Intelligence");
    if (action === "export-html") this.downloadCards("html");
    if (action === "export-obsidian") this.downloadCards("obsidian");
    if (action === "export-pdf") this.downloadCards("pdf");
    if (action === "export-doc") this.downloadCards("doc");
    if (action === "export-txt") this.downloadCards("txt");
    if (action === "export-gdocs") this.exportToGDocs();
    if (action === "export-gdrive") this.exportToGDrive();
  }

  askTag(nodeId) {
    this.askText({ title: "Add category label", hint: "Tags appear on the card and are matched by the sidebar search.", value: "" }).then((tag) => {
      if (tag) this.store.addTag(nodeId, tag);
    });
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
