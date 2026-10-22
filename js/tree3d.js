// Three.js 3D Interactive Spatial Visualization Engine for BrainVault
// Features:
// 1. Ambient 3D Cyber Neural Constellation (ambient particle web behind canvas)
// 2. Full Interactive 3D Orbit Space Mode (knowledge graph of cards floating in 3D orbit)
// 3. Space Themes: Light, Dark, Universe (starfields & nebula dust)
// 4. Floating Cards Animation with preserved arranged text lines
// 5. Interactive 3D Node Inspector showing nodes, tags, and 3-line overview
// 6. Direct Database Sync & Fetch from SQLite database mirror

export class Tree3DView {
  constructor({ store, canvas, toast }) {
    this.store = store;
    this.canvas = canvas;
    this.toast = toast;
    this.isActive = false;
    this.isBgActive = true;
    this.autoRotate = true;
    this.theme = localStorage.getItem("brainvault.3dtheme") || "universe";

    // 3D Scene elements
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.ambLight = null;
    this.dirLight1 = null;
    this.dirLight2 = null;
    this.grid = null;
    this.starField = null;
    this.nebulaPoints = null;
    this.shootingStar = null;
    this.shootingStarState = { active: false, timer: 0, t: 0, p1: null, p2: null };

    // Background ambient constellation
    this.bgScene = null;
    this.bgCamera = null;
    this.bgRenderer = null;
    this.bgPoints = null;
    this.bgLines = null;
    this.bgAnimId = null;

    // 3D Graph State
    this.animId = null;
    this.nodes3D = [];
    this.links3D = [];
    this.raycaster = null;
    this.mouse = null;
    this.isDragging = false;
    this.dragDistance = 0;
    this.prevMouse = { x: 0, y: 0 };
    this.rotation = { x: 0.25, y: -0.2 };
    this.distance = 1250;
    this.target = { x: 0, y: 0, z: 0 };
    this.eventsAttached = false;
    this.selectedNodeId = null;

    // Subscribe to store updates so 3D mode stays synced with database changes
    this.store.subscribe(() => {
      if (this.isActive) {
        this.buildGraph3D();
        if (this.selectedNodeId) {
          const updated = this.store.node(this.selectedNodeId) || this.store.sticky(this.selectedNodeId);
          if (updated) this.showNodeInfo(updated, !updated.prompt);
        }
      }
    });

    // Subscribe to store database sync events
    if (this.store.subscribeDb) {
      this.store.subscribeDb((status) => {
        this.updateDbStatus(status);
      });
    }

    this.initBackground();
  }

  updateDbStatus(status) {
    const statusEl = document.querySelector("#tree3dDbStatus");
    if (!statusEl) return;
    const isSyncing = status === "syncing";
    const isError = status === "error" || status === "offline";
    const label = isSyncing ? "Syncing..." : isError ? "Offline" : "DB Synced";
    const dotClass = isSyncing ? "is-syncing" : isError ? "is-error" : "is-synced";
    statusEl.innerHTML = `<span class="db-sync-dot ${dotClass}"></span> <span class="db-status-label">${label}</span>`;
  }

  // --- Ambient 3D Constellation (Background Canvas) ---------------------------
  initBackground() {
    if (typeof window.THREE === "undefined") return;
    const THREE = window.THREE;

    const bgCanvas = document.createElement("canvas");
    bgCanvas.id = "tree3dBgCanvas";
    bgCanvas.className = "tree3d-bg-canvas";
    document.body.prepend(bgCanvas);

    const w = window.innerWidth;
    const h = window.innerHeight;

    this.bgScene = new THREE.Scene();
    this.bgCamera = new THREE.PerspectiveCamera(50, w / h, 1, 2000);
    this.bgCamera.position.z = 800;

    try {
      this.bgRenderer = new THREE.WebGLRenderer({ canvas: bgCanvas, alpha: true, antialias: true });
      this.bgRenderer.setSize(w, h);
      this.bgRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    } catch (err) {
      console.warn("Three.js WebGL background initialization skipped:", err);
      return;
    }

    const count = 90;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 1400;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 900;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 600;
      velocities.push({
        x: (Math.random() - 0.5) * 0.4,
        y: (Math.random() - 0.5) * 0.4,
        z: (Math.random() - 0.5) * 0.2,
      });
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const pMaterial = new THREE.PointsMaterial({
      color: 0x22d3ee,
      size: 4,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });

    this.bgPoints = new THREE.Points(geometry, pMaterial);
    this.bgPoints.userData = { velocities };
    this.bgScene.add(this.bgPoints);

    const lineGeo = new THREE.BufferGeometry();
    const maxLineSegs = 300;
    const linePositions = new Float32Array(maxLineSegs * 6);
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
    });
    this.bgLines = new THREE.LineSegments(lineGeo, lineMat);
    this.bgScene.add(this.bgLines);

    let targetX = 0;
    let targetY = 0;
    window.addEventListener("pointermove", (e) => {
      targetX = (e.clientX - w / 2) * 0.15;
      targetY = (e.clientY - h / 2) * 0.15;
    });

    const animateBg = () => {
      this.bgAnimId = requestAnimationFrame(animateBg);
      if (!this.isBgActive) return;

      const pos = this.bgPoints.geometry.attributes.position.array;
      const vels = this.bgPoints.userData.velocities;

      for (let i = 0; i < count; i++) {
        pos[i * 3] += vels[i].x;
        pos[i * 3 + 1] += vels[i].y;
        pos[i * 3 + 2] += vels[i].z;

        if (Math.abs(pos[i * 3]) > 700) vels[i].x *= -1;
        if (Math.abs(pos[i * 3 + 1]) > 450) vels[i].y *= -1;
        if (Math.abs(pos[i * 3 + 2]) > 300) vels[i].z *= -1;
      }
      this.bgPoints.geometry.attributes.position.needsUpdate = true;

      let lineIdx = 0;
      const lpos = this.bgLines.geometry.attributes.position.array;
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const dx = pos[i * 3] - pos[j * 3];
          const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
          const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
          const dist = Math.hypot(dx, dy, dz);
          if (dist < 130 && lineIdx < maxLineSegs * 6 - 6) {
            lpos[lineIdx++] = pos[i * 3];
            lpos[lineIdx++] = pos[i * 3 + 1];
            lpos[lineIdx++] = pos[i * 3 + 2];
            lpos[lineIdx++] = pos[j * 3];
            lpos[lineIdx++] = pos[j * 3 + 1];
            lpos[lineIdx++] = pos[j * 3 + 2];
          }
        }
      }
      for (let k = lineIdx; k < maxLineSegs * 6; k++) lpos[k] = 0;
      this.bgLines.geometry.attributes.position.needsUpdate = true;

      this.bgCamera.position.x += (targetX - this.bgCamera.position.x) * 0.03;
      this.bgCamera.position.y += (-targetY - this.bgCamera.position.y) * 0.03;
      this.bgCamera.lookAt(0, 0, 0);

      this.bgRenderer.render(this.bgScene, this.bgCamera);
    };
    animateBg();

    window.addEventListener("resize", () => {
      const rw = window.innerWidth;
      const rh = window.innerHeight;
      this.bgCamera.aspect = rw / rh;
      this.bgCamera.updateProjectionMatrix();
      this.bgRenderer.setSize(rw, rh);
    });
  }

  pulseToNode(node) {
    if (!node) return;
    if (this.isActive) {
      const mesh = this.nodes3D.find((m) => m.userData.item?.id === node.id);
      if (mesh) {
        this.selectAndFocusNode(node.id);
      }
      return;
    }
    // Background ambient 3D pulse wave on constellation particles
    if (this.bgPoints && this.bgPoints.geometry) {
      const pos = this.bgPoints.geometry.attributes.position.array;
      const count = pos.length / 3;
      const vels = this.bgPoints.userData?.velocities || [];
      for (let i = 0; i < count; i++) {
        if (vels[i]) {
          vels[i].x += (Math.random() - 0.5) * 3.5;
          vels[i].y += (Math.random() - 0.5) * 3.5;
          vels[i].z += (Math.random() - 0.5) * 2.5;
        }
      }
      if (this.bgPoints.material) {
        const origOpacity = this.bgPoints.material.opacity;
        this.bgPoints.material.opacity = Math.min(1, origOpacity * 1.7);
        setTimeout(() => {
          if (this.bgPoints?.material) this.bgPoints.material.opacity = origOpacity;
        }, 1100);
      }
    }
  }

  toggle3DMode() {
    if (this.isActive) {
      this.close3DMode();
    } else {
      this.open3DMode();
    }
  }

  open() {
    return this.open3DMode();
  }

  close() {
    return this.close3DMode();
  }

  open3DMode() {
    if (typeof window.THREE === "undefined") {
      this.toast?.("Three.js engine is still loading, please wait a moment.");
      return;
    }
    const THREE = window.THREE;
    this.isActive = true;
    this.isBgActive = false;

    this.ensureOverlay();
    const overlay = document.querySelector("#tree3dOverlay");
    overlay.classList.remove("is-hidden");
    overlay.style.display = "flex";
    overlay.style.pointerEvents = "auto";

    const canvas = document.querySelector("#tree3dCanvas");
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (!this.renderer) {
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(45, w / h, 1, 8000);
      this.updateCameraPos();

      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // Lighting setup
      this.ambLight = new THREE.AmbientLight(0xffffff, 0.7);
      this.scene.add(this.ambLight);

      this.dirLight1 = new THREE.DirectionalLight(0x22d3ee, 1.2);
      dir1Position: this.dirLight1.position.set(500, 700, 600);
      this.scene.add(this.dirLight1);

      this.dirLight2 = new THREE.DirectionalLight(0xa855f7, 0.9);
      this.dirLight2.position.set(-500, -350, -450);
      this.scene.add(this.dirLight2);

      // Cyber Spatial Grid
      this.grid = new THREE.GridHelper(3600, 48, 0x22d3ee, 0x1e293b);
      this.grid.position.y = -500;
      this.scene.add(this.grid);

      // Starfield & Cosmic Nebula for Universe theme
      this.initStarfield();
      this.initNebula();

      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();
    }

    this.applyTheme();
    this.buildGraph3D();

    if (!this.eventsAttached) {
      this.attach3DEvents();
      this.eventsAttached = true;
    }

    // Main 3D Orbit Animation Loop with Floating Waves
    if (!this.animId) {
      const renderLoop = () => {
        if (!this.isActive) { this.animId = null; return; }
        this.animId = requestAnimationFrame(renderLoop);

        // Auto-rotation when not orbiting
        if (this.autoRotate && !this.isDragging) {
          this.rotation.y += 0.0022;
          this.updateCameraPos();
        }

        const time = performance.now() * 0.0016;

        // Floating cards animation: smooth multi-axis orbital floating wave dynamics
        for (let i = 0; i < this.nodes3D.length; i++) {
          const mesh = this.nodes3D[i];
          if (mesh.userData.basePos) {
            const offset = mesh.userData.floatOffset || 0;
            const isSticky = Boolean(mesh.userData.isSticky);
            // Smooth vertical and gentle lateral floating wave dynamics with organic paper motion
            const waveY = isSticky ? 11.0 : 8.5;
            const waveX = isSticky ? 4.2 : 3.2;
            const waveZ = isSticky ? 5.8 : 4.0;
            mesh.position.y = mesh.userData.basePos.y + Math.sin(time * 1.15 + offset) * waveY;
            mesh.position.x = mesh.userData.basePos.x + Math.cos(time * 0.8 + offset) * waveX;
            mesh.position.z = mesh.userData.basePos.z + Math.sin(time * 0.6 + offset) * waveZ;
            mesh.rotation.x = Math.sin(time * 0.5 + offset) * 0.015;
            mesh.rotation.y = Math.cos(time * 0.4 + offset) * 0.015;
            mesh.rotation.z = (isSticky ? (offset % 2 === 0 ? 0.04 : -0.04) : 0) + Math.sin(time * 0.65 + offset) * 0.014;
          }
        }

        // Dynamic Cubic Bezier Links tracking floating cards matching 2D workspace curvature
        for (let j = 0; j < this.links3D.length; j++) {
          const item = this.links3D[j];
          if (item.sourceMesh && item.targetMesh && item.line?.geometry?.attributes?.position) {
            const p1 = item.sourceMesh.position;
            const p2 = item.targetMesh.position;
            const pos = item.line.geometry.attributes.position.array;
            const w1 = item.w1 || 300;
            const w2 = item.w2 || 300;
            const dx = p2.x - p1.x;
            const x1 = dx >= 0 ? p1.x + w1 / 2 : p1.x - w1 / 2;
            const y1 = p1.y;
            const z1 = p1.z;
            const x2 = dx >= 0 ? p2.x - w2 / 2 : p2.x + w2 / 2;
            const y2 = p2.y;
            const z2 = p2.z;

            const bend = Math.max(60, Math.abs(x2 - x1) * 0.45);
            const dir = x2 >= x1 ? 1 : -1;
            const cx1 = x1 + bend * dir;
            const cy1 = y1;
            const cz1 = z1;
            const cx2 = x2 - bend * dir;
            const cy2 = y2;
            const cz2 = z2;

            const segs = 32;
            for (let k = 0; k <= segs; k++) {
              const t = k / segs;
              const inv = 1 - t;
              const b0 = inv * inv * inv;
              const b1 = 3 * inv * inv * t;
              const b2 = 3 * inv * t * t;
              const b3 = t * t * t;
              pos[k * 3] = b0 * x1 + b1 * cx1 + b2 * cx2 + b3 * x2;
              pos[k * 3 + 1] = b0 * y1 + b1 * cy1 + b2 * cy2 + b3 * y2;
              pos[k * 3 + 2] = b0 * z1 + b1 * cz1 + b2 * cz2 + b3 * z2;
            }
            item.line.geometry.attributes.position.needsUpdate = true;

            // Electric current glow effect on connection line
            if (item.line && item.line.material) {
              const electricPulse = 0.76 + Math.sin(time * 14 + item.idx * 3.5) * 0.2 + (Math.random() - 0.5) * 0.06;
              item.line.material.opacity = Math.max(0.45, Math.min(1.0, electricPulse));
            }

            if (item.pulse) {
              const pulseT = ((time * 0.55 + item.idx * 0.22) % 1);
              const pinv = 1 - pulseT;
              const pb0 = pinv * pinv * pinv;
              const pb1 = 3 * pinv * pinv * pulseT;
              const pb2 = 3 * pinv * pulseT * pulseT;
              const pb3 = pulseT * pulseT * pulseT;
              item.pulse.position.x = pb0 * x1 + pb1 * cx1 + pb2 * cx2 + pb3 * x2;
              item.pulse.position.y = pb0 * y1 + pb1 * cy1 + pb2 * cy2 + pb3 * y2;
              item.pulse.position.z = pb0 * z1 + pb1 * cz1 + pb2 * cz2 + pb3 * z2;
            }

            if (item.spark) {
              const sparkT = ((time * 0.85 + item.idx * 0.35 + 0.5) % 1);
              const sinv = 1 - sparkT;
              const sb0 = sinv * sinv * sinv;
              const sb1 = 3 * sinv * sinv * sparkT;
              const sb2 = 3 * sinv * sparkT * sparkT;
              const sb3 = sparkT * sparkT * sparkT;
              item.spark.position.x = sb0 * x1 + sb1 * cx1 + sb2 * cx2 + sb3 * x2;
              item.spark.position.y = sb0 * y1 + sb1 * cy1 + sb2 * cy2 + sb3 * y2;
              item.spark.position.z = sb0 * z1 + sb1 * cz1 + sb2 * cz2 + sb3 * z2;
            }
          }
        }

        // Universe Starfield slow rotation & dynamic star twinkling
        if (this.starField && (this.theme === "universe" || this.theme === "dark")) {
          this.starField.rotation.y += 0.0003;
          this.starField.rotation.x += 0.0001;
          // Dynamic star twinkling without reallocating buffers
          const baseOpacity = this.theme === "universe" ? 0.92 : 0.45;
          this.starField.material.opacity = baseOpacity + Math.sin(time * 3.5) * 0.06;
        }
        if (this.nebulaPoints && this.theme === "universe") {
          this.nebulaPoints.rotation.y -= 0.0002;
          this.nebulaPoints.material.opacity = 0.35 + Math.sin(time * 1.8) * 0.05;
        }

        // Dynamic Shooting Star Meteor Streak in deep space (zero-allocation)
        if (this.shootingStar && (this.theme === "universe" || this.theme === "dark")) {
          const s = this.shootingStarState;
          if (!s.active) {
            s.timer += 0.016;
            if (s.timer > 3.2 + (Math.sin(time * 0.5) + 1) * 1.5) {
              s.active = true;
              s.timer = 0;
              s.t = 0;
              const r = 1800;
              const angle = Math.random() * Math.PI * 2;
              const height = (Math.random() - 0.5) * 800;
              if (!s.p1) s.p1 = new THREE.Vector3();
              if (!s.p2) s.p2 = new THREE.Vector3();
              s.p1.set(Math.cos(angle) * r, height + 400, Math.sin(angle) * r);
              s.p2.set(s.p1.x + (Math.random() - 0.5) * 600 - 350, s.p1.y - 750, s.p1.z + (Math.random() - 0.5) * 600);
            }
          } else {
            s.t += 0.038;
            if (s.t >= 1) {
              s.active = false;
              this.shootingStar.material.opacity = 0;
            } else {
              const tailT = Math.max(0, s.t - 0.22);
              const tx = s.p1.x + (s.p2.x - s.p1.x) * tailT;
              const ty = s.p1.y + (s.p2.y - s.p1.y) * tailT;
              const tz = s.p1.z + (s.p2.z - s.p1.z) * tailT;
              const hx = s.p1.x + (s.p2.x - s.p1.x) * s.t;
              const hy = s.p1.y + (s.p2.y - s.p1.y) * s.t;
              const hz = s.p1.z + (s.p2.z - s.p1.z) * s.t;
              const posAttr = this.shootingStar.geometry.attributes.position;
              posAttr.setXYZ(0, tx, ty, tz);
              posAttr.setXYZ(1, hx, hy, hz);
              posAttr.needsUpdate = true;
              const fade = Math.sin(s.t * Math.PI);
              this.shootingStar.material.opacity = fade * 0.92;
            }
          }
        }

        this.renderer.render(this.scene, this.camera);
      };
      renderLoop();
    }

    this.toast?.("3D Orbit Tree Mode Active — Explore cards floating in 3D space!");
  }

  ensureOverlay() {
    let view = document.querySelector("#tree3dOverlay");
    if (!view) {
      view = document.createElement("div");
      view.id = "tree3dOverlay";
      view.className = `tree3d-overlay theme-${this.theme}`;
      view.innerHTML = `
        <div class="tree3d-hud">
          <div class="tree3d-title">
            <span class="tree3d-badge">BRAINVAULT 3D SPATIAL KNOWLEDGE ENGINE</span>
            <strong>3D Orbit Knowledge Graph</strong>
          </div>

          <!-- Space Theme Switcher -->
          <div class="tree3d-theme-select" title="Change 3D Space Theme">
            <span class="tree3d-control-label">THEME:</span>
            <button class="btn small ${this.theme === 'dark' ? 'is-active' : ''}" data-tree3d-theme="dark">🌙 Dark</button>
            <button class="btn small ${this.theme === 'light' ? 'is-active' : ''}" data-tree3d-theme="light">☀️ Light</button>
            <button class="btn small ${this.theme === 'universe' ? 'is-active' : ''}" data-tree3d-theme="universe">🌌 Universe</button>
            <button class="btn small ${this.theme === 'neural' ? 'is-active' : ''}" data-tree3d-theme="neural">🧠 Neural Links</button>
          </div>

          <!-- Database Sync Controls -->
          <div class="tree3d-db-controls">
            <button class="btn small accent-emerald" id="tree3dSaveDb" title="Save all cards, stickies and links to SQLite Database">
              💾 Save to DB
            </button>
            <button class="btn small accent-cyan" id="tree3dFetchDb" title="Fetch latest notes from SQLite Database">
              🔄 Fetch from DB
            </button>
            <span class="tree3d-db-status" id="tree3dDbStatus">
              <span class="db-sync-dot"></span> <span class="db-status-label">DB Synced</span>
            </span>
          </div>

          <div class="tree3d-controls">
            <button class="btn small accent-indigo" id="tree3dAlign" title="Arrange all cards in clean non-overlapping 3D hierarchical tree layout">☲ Align 3D Tree</button>
            <button class="btn small" id="tree3dRotate">${this.autoRotate ? "Pause Orbit" : "Auto-Orbit"}</button>
            <button class="btn small" id="tree3dReset">Center View</button>
            <button class="btn small danger" id="tree3dClose">Exit 3D View [Esc]</button>
          </div>
        </div>

        <div id="tree3dNeuralBg" class="tree3d-neural-bg ${this.theme === 'neural' ? '' : 'is-hidden'}"></div>
        <canvas id="tree3dCanvas" class="tree3d-canvas"></canvas>

        <!-- 3D Node Interactive Inspector Panel -->
        <div id="tree3dNodeInfo" class="tree3d-node-info is-hidden">
          <div class="tree3d-info-header">
            <div class="tree3d-info-badge-wrap">
              <span id="tree3dInfoKind" class="tree3d-info-badge">NODE 1.0</span>
              <span id="tree3dInfoId" class="tree3d-info-id">node-id</span>
            </div>
            <button class="tree3d-info-close" id="tree3dInfoClose" title="Close info panel">×</button>
          </div>

          <h3 id="tree3dInfoTitle" class="tree3d-info-title">Card Title</h3>

          <!-- Connected Knowledge Nodes -->
          <div class="tree3d-info-nodes-section">
            <span class="tree3d-info-label">CONNECTED KNOWLEDGE NODES</span>
            <div id="tree3dInfoNodes" class="tree3d-info-nodes"></div>
          </div>

          <!-- Suggested Existing Nodes in 3D -->
          <div class="tree3d-info-suggest-section">
            <span class="tree3d-info-label">✦ SUGGESTED EXISTING NODES</span>
            <div id="tree3dInfoSuggestions" class="tree3d-info-suggestions"></div>
          </div>

          <div class="tree3d-info-tags-section">
            <span class="tree3d-info-label">TAGS</span>
            <div id="tree3dInfoTags" class="tree3d-info-tags"></div>
          </div>

          <!-- 3-Line Info Section -->
          <div class="tree3d-info-summary-box">
            <div class="tree3d-info-summary-header">
              <span class="tree3d-info-summary-icon">✦</span>
              <strong>3-LINE NOTE OVERVIEW</strong>
            </div>
            <div class="tree3d-info-lines">
              <div class="tree3d-info-line"><span class="line-num">1</span> <span id="tree3dLine1" class="line-text">Line 1</span></div>
              <div class="tree3d-info-line"><span class="line-num">2</span> <span id="tree3dLine2" class="line-text">Line 2</span></div>
              <div class="tree3d-info-line"><span class="line-num">3</span> <span id="tree3dLine3" class="line-text">Line 3</span></div>
            </div>
          </div>

          <!-- Original Arranged Content Preview & Live In-3D Note Editor -->
          <div class="tree3d-info-content-preview">
            <div class="tree3d-info-content-head">
              <span class="tree3d-info-label" id="tree3dInfoTextLabel">ARRANGED CONTENT</span>
              <button class="btn tiny" id="tree3dEditToggleBtn" title="Edit note content in 3D">✎ Edit Note</button>
            </div>
            <pre id="tree3dInfoRawText" class="tree3d-info-raw-text"></pre>
            <div id="tree3dInlineEditArea" class="tree3d-inline-edit-area is-hidden">
              <div class="tree3d-edit-fmt-bar">
                <select id="tree3dEditFont" class="fmt-select" title="Font family">
                  <option value="Space Grotesk">Space Grotesk</option>
                  <option value="JetBrains Mono">JetBrains Mono</option>
                  <option value="Tomorrow">Tomorrow</option>
                  <option value="Inter">Inter</option>
                  <option value="Georgia">Georgia</option>
                </select>
                <select id="tree3dEditSize" class="fmt-select" title="Text size">
                  <option value="12px">12px</option>
                  <option value="14px" selected>14px</option>
                  <option value="16px">16px</option>
                  <option value="18px">18px</option>
                  <option value="22px">22px</option>
                  <option value="26px">26px</option>
                </select>
                <input type="color" id="tree3dEditColor" class="fmt-color-picker" value="#00ffff" title="Shining text colour" />
                <button type="button" id="tree3dEditBold" class="fmt-btn" title="Bold (**text**)"><strong>B</strong></button>
                <button type="button" id="tree3dEditItalic" class="fmt-btn" title="Italic (*text*)"><em>I</em></button>
              </div>
              <textarea id="tree3dEditText" class="tree3d-edit-textarea" rows="7" placeholder="Type arranged note lines here..."></textarea>
              
              <!-- 3D Attached Images Gallery & URL Importer -->
              <div class="tree3d-images-section">
                <span class="tree3d-info-label">ATTACHED IMAGES (3D SYNC)</span>
                <div id="tree3dImagesList" class="tree3d-images-list"></div>
                <div class="tree3d-add-image-row">
                  <input type="url" id="tree3dImageInput" class="tree3d-img-input" placeholder="Paste image URL (https://...)" />
                  <button type="button" id="tree3dAddImageBtn" class="btn small">+ Add Image</button>
                </div>
              </div>

              <div class="tree3d-inline-edit-actions">
                <button class="btn small primary" id="tree3dSaveNoteBtn">✓ Save Note &amp; Images</button>
                <button class="btn small" id="tree3dCancelNoteBtn">Cancel</button>
              </div>
            </div>
          </div>

          <div class="tree3d-info-actions">
            <button class="btn small primary" id="tree3dFocusBtn">Focus in 3D</button>
            <button class="btn small accent-indigo" id="tree3dEditInCanvas">Edit in 2D Canvas</button>
            <button class="btn small" id="tree3dAddTagBtn">+ Add Tag</button>
          </div>
        </div>

        <div class="tree3d-hint">Orbit: Left Click Drag · Pan: Right Click Drag · Zoom: Scroll · Click Card: Inspect &amp; Read Text</div>
      `;
      document.body.appendChild(view);
    }
  }

  // --- Cosmic Universe Elements ----------------------------------------------
  initStarfield() {
    const THREE = window.THREE;
    const starCount = 3600;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    const palette = [
      new THREE.Color(0xa5f3fc), // cyan
      new THREE.Color(0xffffff), // white
      new THREE.Color(0xfef08a), // gold
      new THREE.Color(0xe9d5ff), // cosmic lavender
      new THREE.Color(0x93c5fd), // nebula blue
      new THREE.Color(0xf472b6), // rose star
    ];

    for (let i = 0; i < starCount; i++) {
      const r = 900 + Math.random() * 3200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPos[i * 3 + 2] = r * Math.cos(phi);

      const col = palette[Math.floor(Math.random() * palette.length)];
      starColors[i * 3] = col.r;
      starColors[i * 3 + 1] = col.g;
      starColors[i * 3 + 2] = col.b;
    }

    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 4,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
    });
    this.starField = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starField);

    // Dynamic Cosmic Shooting Star / Meteor Streak
    const shootGeo = new THREE.BufferGeometry();
    shootGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const shootMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      linewidth: 2,
    });
    this.shootingStar = new THREE.Line(shootGeo, shootMat);
    this.scene.add(this.shootingStar);
  }

  initNebula() {
    const THREE = window.THREE;
    const nebCount = 200;
    const nebGeo = new THREE.BufferGeometry();
    const nebPos = new Float32Array(nebCount * 3);
    const nebColors = new Float32Array(nebCount * 3);

    const nebPalette = [
      new THREE.Color(0x7c3aed), // purple
      new THREE.Color(0xec4899), // pink
      new THREE.Color(0x06b6d4), // cyan
      new THREE.Color(0x3b82f6), // sapphire
    ];

    for (let i = 0; i < nebCount; i++) {
      nebPos[i * 3] = (Math.random() - 0.5) * 3200;
      nebPos[i * 3 + 1] = (Math.random() - 0.5) * 2000;
      nebPos[i * 3 + 2] = (Math.random() - 0.5) * 2400;

      const c = nebPalette[Math.floor(Math.random() * nebPalette.length)];
      nebColors[i * 3] = c.r;
      nebColors[i * 3 + 1] = c.g;
      nebColors[i * 3 + 2] = c.b;
    }

    nebGeo.setAttribute("position", new THREE.BufferAttribute(nebPos, 3));
    nebGeo.setAttribute("color", new THREE.BufferAttribute(nebColors, 3));

    const nebMat = new THREE.PointsMaterial({
      size: 38,
      vertexColors: true,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    this.nebulaPoints = new THREE.Points(nebGeo, nebMat);
    this.scene.add(this.nebulaPoints);
  }

  // --- Themes: Light, Dark, Universe ----------------------------------------
  setTheme(themeName) {
    this.theme = themeName;
    localStorage.setItem("brainvault.3dtheme", themeName);
    this.applyTheme();
    this.rebuildCardTextures();
    this.toast?.(`Switched 3D Space Theme to ${themeName.toUpperCase()}`);
  }

  applyTheme() {
    const THREE = window.THREE;
    if (!this.scene) return;

    const overlay = document.querySelector("#tree3dOverlay");
    if (overlay) {
      overlay.className = `tree3d-overlay theme-${this.theme}`;
      overlay.querySelectorAll("[data-tree3d-theme]").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.tree3dTheme === this.theme);
      });
    }

    const neuralBg = document.querySelector("#tree3dNeuralBg");
    if (neuralBg) neuralBg.classList.toggle("is-hidden", this.theme !== "neural");

    // Reduced fog: max 35-40% gentle fade on zoom out so cards stay clearly visible
    if (this.theme === "light") {
      this.scene.background = new THREE.Color(0xeef2f7);
      this.scene.fog = new THREE.Fog(0xeef2f7, 2000, 7500);
      this.ambLight.color.setHex(0xffffff);
      this.ambLight.intensity = 1.1;
      this.dirLight1.color.setHex(0x0284c7);
      this.dirLight1.intensity = 0.8;
      this.dirLight2.color.setHex(0x9333ea);
      this.dirLight2.intensity = 0.5;
      if (this.grid) {
        this.grid.visible = true;
        this.grid.material.color.setHex(0x3b82f6);
      }
      if (this.starField) this.starField.visible = false;
      if (this.nebulaPoints) this.nebulaPoints.visible = false;
    } else if (this.theme === "dark") {
      this.scene.background = new THREE.Color(0x030307);
      this.scene.fog = new THREE.Fog(0x030307, 1800, 7500);
      this.ambLight.color.setHex(0xffffff);
      this.ambLight.intensity = 0.65;
      this.dirLight1.color.setHex(0x22d3ee);
      this.dirLight1.intensity = 1.2;
      this.dirLight2.color.setHex(0xa855f7);
      this.dirLight2.intensity = 0.9;
      if (this.grid) {
        this.grid.visible = true;
        this.grid.material.color.setHex(0x22d3ee);
      }
      if (this.starField) {
        this.starField.visible = true;
        this.starField.material.opacity = 0.45;
      }
      if (this.nebulaPoints) this.nebulaPoints.visible = false;
    } else if (this.theme === "neural") {
      // Neural Links Brain Theme: 70% large neural brain network with 80% fade-out
      this.scene.background = new THREE.Color(0x040714);
      this.scene.fog = new THREE.Fog(0x040714, 1800, 7500);
      this.ambLight.color.setHex(0x38bdf8);
      this.ambLight.intensity = 0.95;
      this.dirLight1.color.setHex(0x818cf8);
      this.dirLight1.intensity = 1.35;
      this.dirLight2.color.setHex(0x06b6d4);
      this.dirLight2.intensity = 1.1;
      if (this.grid) {
        this.grid.visible = false;
      }
      if (this.starField) {
        this.starField.visible = true;
        this.starField.material.opacity = 0.65;
      }
      if (this.nebulaPoints) {
        this.nebulaPoints.visible = false;
      }
    } else {
      // Universe Theme
      this.scene.background = new THREE.Color(0x02000d);
      this.scene.fog = new THREE.Fog(0x02000d, 1800, 7500);
      this.ambLight.color.setHex(0xc084fc);
      this.ambLight.intensity = 0.85;
      this.dirLight1.color.setHex(0x38bdf8);
      this.dirLight1.intensity = 1.35;
      this.dirLight2.color.setHex(0xf43f5e);
      this.dirLight2.intensity = 1.1;
      if (this.grid) {
        this.grid.visible = false;
      }
      if (this.starField) {
        this.starField.visible = true;
        this.starField.material.opacity = 0.95;
      }
      if (this.nebulaPoints) {
        this.nebulaPoints.visible = true;
      }
    }
  }

  // --- Dynamic High-Fidelity 2D Canvas Textures for 3D Cards ----------------
  createCardTexture(item, isSticky = false, theme = "dark") {
    const THREE = window.THREE;
    const canvas = document.createElement("canvas");
    // High-resolution canvas textures matching original card proportions (880x700 for nodes, 640x640 for stickies)
    const width = isSticky ? 640 : 880;
    const height = isSticky ? 640 : 700;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const is3DLight = (theme === "light");

    function hexToRgb(hex) {
      let c = (hex || "#7DD3FC").replace("#", "");
      if (c.length === 3) c = c.split("").map((x) => x + x).join("");
      const num = parseInt(c, 16) || 0x7dd3fc;
      return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    }

    function drawRoundedRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    if (isSticky) {
      if (is3DLight) {
        // LIGHT THEME ONLY: Dark black-grey / charcoal memo card in light 3D space
        const accentColor = item.color || "#fde047";
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#232632");
        bgGrad.addColorStop(0.55, "#151720");
        bgGrad.addColorStop(1, "#0a0c10");

        drawRoundedRect(6, 6, width - 12, height - 12, 16);
        ctx.fillStyle = bgGrad;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = accentColor;
        ctx.stroke();

        // Folded paper corner shadow effect at bottom-right
        ctx.beginPath();
        ctx.moveTo(width - 48, height - 6);
        ctx.lineTo(width - 6, height - 48);
        ctx.lineTo(width - 48, height - 48);
        ctx.closePath();
        ctx.fillStyle = "#050608";
        ctx.fill();

        // Header top band
        ctx.font = "bold 18px 'JetBrains Mono', monospace";
        ctx.fillStyle = accentColor;
        ctx.fillText("STICKY MEMO", 32, 44);

        ctx.beginPath();
        ctx.arc(width - 36, 38, 7, 0, Math.PI * 2);
        ctx.fillStyle = accentColor;
        ctx.fill();

        // Divider line
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(28, 64);
        ctx.lineTo(width - 28, 64);
        ctx.stroke();

        // Memo Body Content with preserved arranged lines
        const rawText = item.text || "";
        ctx.font = "22px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillStyle = "#f1f5f9";

        if (!rawText.trim()) {
          ctx.font = "italic 20px 'Space Grotesk', sans-serif";
          ctx.fillStyle = "rgba(241, 245, 249, 0.5)";
          ctx.fillText("Empty memo. Click to write notes…", 32, 110);
        } else {
          const lines = rawText.split("\n");
          let curY = 104;
          const maxBottom = height - 45;
          let overflow = false;

          for (let i = 0; i < lines.length; i++) {
            if (curY + 28 > maxBottom) {
              overflow = true;
              break;
            }
            const line = lines[i];
            if (!line.trim()) {
              curY += 16;
              continue;
            }
            const words = line.split(" ");
            let cur = "";
            for (const w of words) {
              const test = cur ? `${cur} ${w}` : w;
              if (ctx.measureText(test).width > width - 64 && cur) {
                ctx.fillText(cur, 32, curY);
                curY += 30;
                if (curY + 28 > maxBottom) {
                  overflow = true;
                  break;
                }
                cur = w;
              } else {
                cur = test;
              }
            }
            if (cur && !overflow) {
              ctx.fillText(cur, 32, curY);
              curY += 30;
            }
            if (overflow) break;
          }

          if (overflow) {
            ctx.font = "italic 16px 'JetBrains Mono', monospace";
            ctx.fillStyle = "rgba(241, 245, 249, 0.6)";
            ctx.fillText("… (more lines in inspector)", 32, curY);
          }
        }
      } else {
        const stickyColor = item.color || "#FEF08A";
      const { r, g, b } = hexToRgb(stickyColor);
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, `rgb(${Math.min(255, r + 24)}, ${Math.min(255, g + 24)}, ${Math.min(255, b + 24)})`);
      bgGrad.addColorStop(0.55, `rgb(${r}, ${g}, ${b})`);
      bgGrad.addColorStop(1, `rgb(${Math.round(r * 0.88)}, ${Math.round(g * 0.88)}, ${Math.round(b * 0.88)})`);

      drawRoundedRect(6, 6, width - 12, height - 12, 16);
      ctx.fillStyle = bgGrad;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "rgba(42, 36, 16, 0.2)";
      ctx.stroke();

      // Folded paper corner shadow effect at bottom-right
      ctx.beginPath();
      ctx.moveTo(width - 48, height - 6);
      ctx.lineTo(width - 6, height - 48);
      ctx.lineTo(width - 48, height - 48);
      ctx.closePath();
      ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
      ctx.fill();

      // Header top band
      ctx.font = "bold 18px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(42, 36, 16, 0.65)";
      ctx.fillText("STICKY MEMO", 32, 44);

      ctx.beginPath();
      ctx.arc(width - 36, 38, 7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(42, 36, 16, 0.4)";
      ctx.fill();

      // Divider line
      ctx.strokeStyle = "rgba(42, 36, 16, 0.15)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(28, 64);
      ctx.lineTo(width - 28, 64);
      ctx.stroke();

      // Memo Body Content with preserved arranged lines
      const rawText = item.text || "";
      ctx.font = "22px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillStyle = "#2a2410";

      if (!rawText.trim()) {
        ctx.font = "italic 20px 'Space Grotesk', sans-serif";
        ctx.fillStyle = "rgba(42, 36, 16, 0.5)";
        ctx.fillText("Empty memo. Click to write notes…", 32, 110);
      } else {
        const lines = rawText.split("\n");
        let curY = 104;
        const maxBottom = height - 45;
        let overflow = false;

        for (let i = 0; i < lines.length; i++) {
          if (curY + 28 > maxBottom) {
            overflow = true;
            break;
          }
          const line = lines[i];
          if (!line.trim()) {
            curY += 16;
            continue;
          }
          const words = line.split(" ");
          let cur = "";
          for (const w of words) {
            const test = cur ? `${cur} ${w}` : w;
            if (ctx.measureText(test).width > width - 64 && cur) {
              ctx.fillText(cur, 32, curY);
              curY += 30;
              if (curY + 28 > maxBottom) {
                overflow = true;
                break;
              }
              cur = w;
            } else {
              cur = test;
            }
          }
          if (cur && !overflow) {
            ctx.fillText(cur, 32, curY);
            curY += 30;
          }
          if (overflow) break;
        }

        if (overflow) {
          ctx.font = "italic 16px 'JetBrains Mono', monospace";
          ctx.fillStyle = "rgba(42, 36, 16, 0.6)";
          ctx.fillText("… (more lines in inspector)", 32, curY);
        }
      }
      }
    } else {
      if (is3DLight) {
        // LIGHT THEME ONLY: Dark black-grey / charcoal card with dark colours in light 3D workspace
        const nodeColor = item.color || "#38bdf8";
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#232631");
        bgGrad.addColorStop(0.45, "#151821");
        bgGrad.addColorStop(1, "#090a0f");

        drawRoundedRect(6, 6, width - 12, height - 12, 24);
        ctx.fillStyle = bgGrad;
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = nodeColor;
        ctx.stroke();

        // Top-left inset highlight
        drawRoundedRect(9, 9, width - 18, height - 18, 22);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.stroke();

        // Header Top Kicker & Serial Badge
        const kind = item.parentId ? "SUB-NODE" : "PRIMARY NODE";
        ctx.font = "bold 16px 'JetBrains Mono', monospace";
        const kickerWidth = ctx.measureText(kind).width + 24;

        drawRoundedRect(32, 26, kickerWidth, 30, 6);
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = nodeColor;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(kind, 44, 47);

        // Top-right status dot
        ctx.beginPath();
        ctx.arc(width - 44, 41, 7, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor;
        ctx.fill();

        // Header Divider
        ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(28, 72);
        ctx.lineTo(width - 28, 72);
        ctx.stroke();

        // Highlighting card names on node cards in 3D space with shining bright font colors
        const title = (item.prompt || "Untitled Card").trim();
        const shinePalettes = [
          { main: "#00f0ff", glow: "rgba(0, 240, 255, 0.85)", badge: "#0284c7" },   // Cosmic Cyan
          { main: "#fde047", glow: "rgba(253, 224, 71, 0.85)", badge: "#d97706" },  // Shining Solar Gold
          { main: "#4ade80", glow: "rgba(74, 222, 128, 0.85)", badge: "#059669" },  // Stellar Emerald
          { main: "#f472b6", glow: "rgba(244, 114, 182, 0.85)", badge: "#db2777" }, // Nebula Pink
          { main: "#a78bfa", glow: "rgba(167, 139, 250, 0.85)", badge: "#7c3aed" }, // Deep Galaxy Violet
          { main: "#38bdf8", glow: "rgba(56, 189, 248, 0.85)", badge: "#0284c7" },  // Electric Sky
        ];
        const titleIdSum = Math.abs(String(item.id || "").split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
        const chosenShine = (item.textColor && item.textColor.startsWith("#") && item.textColor !== "#0e0d33" && item.textColor !== "#23214f")
          ? { main: item.textColor, glow: item.textColor, badge: item.textColor }
          : shinePalettes[titleIdSum % shinePalettes.length];

        // High-contrast luminous dark glass banner for title
        drawRoundedRect(28, 78, width - 56, 48, 8);
        ctx.fillStyle = "rgba(7, 9, 14, 0.95)";
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = chosenShine.main;
        ctx.stroke();

        // Card Title text with shining luminous glow and bright core highlight
        const cardTitleFont = item.fontFamily || "'Space Grotesk'";
        ctx.font = `bold 26px ${cardTitleFont}, system-ui, sans-serif`;
        let displayTitle = title;
        if (ctx.measureText(displayTitle).width > width - 84) {
          while (displayTitle.length > 3 && ctx.measureText(displayTitle + "…").width > width - 84) {
            displayTitle = displayTitle.slice(0, -1);
          }
          displayTitle += "…";
        }

        // Pass 1: Luminous text glow
        ctx.save();
        ctx.shadowColor = chosenShine.glow;
        ctx.shadowBlur = 14;
        ctx.fillStyle = chosenShine.main;
        ctx.fillText(displayTitle, 40, 112);
        ctx.restore();

        // Pass 2: Crisp shining bright core highlight
        ctx.fillStyle = "#ffffff";
        ctx.fillText(displayTitle, 40, 112);

        // Tag chips row
        let contentStartY = 145;
        const tags = item.tags || [];
        if (tags.length > 0) {
          let tagX = 32;
          ctx.font = "bold 15px 'JetBrains Mono', monospace";
          for (const tag of tags.slice(0, 5)) {
            const tagText = `#${tag}`;
            const tagWidth = ctx.measureText(tagText).width + 18;
            if (tagX + tagWidth < width - 32) {
              drawRoundedRect(tagX, 134, tagWidth, 26, 6);
              ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
              ctx.fill();
              ctx.lineWidth = 1;
              ctx.strokeStyle = chosenShine.main;
              ctx.stroke();
              ctx.fillStyle = "#e2e8f0";
              ctx.fillText(tagText, tagX + 9, 152);
              tagX += tagWidth + 8;
            }
          }
          contentStartY = 178;
        }

        if (item.hideContent) {
          drawRoundedRect(28, contentStartY + 10, width - 56, 120, 12);
          ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = chosenShine.main;
          ctx.stroke();
          ctx.font = "bold 24px 'Space Grotesk', system-ui, sans-serif";
          ctx.fillStyle = "#f8fafc";
          ctx.fillText("👁️ Card Content Hidden", 54, contentStartY + 64);
          ctx.font = "17px 'JetBrains Mono', monospace";
          ctx.fillStyle = "rgba(226, 232, 240, 0.7)";
          ctx.fillText("Click top menu or inspector to show full notes", 54, contentStartY + 96);
          const texture = new THREE.CanvasTexture(canvas);
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          return texture;
        }

        // Arranged Text Lines for dark card in light mode
        const rawText = item.text || "";
        const maxBottom = height - 54;
        let y = contentStartY + 14;

        const userFont = item.fontFamily || "'Space Grotesk'";
        const userSize = item.fontSize ? Math.max(14, Math.min(28, parseInt(item.fontSize, 10) + 4)) : 19;
        const userColor = (item.textColor && item.textColor !== "#23214f" && item.textColor !== "#0e0d33")
          ? item.textColor
          : "#e2e8f0";
        const isBold = Boolean(item.fontBold);
        const isItalic = Boolean(item.fontItalic);
        const stylePrefix = `${isItalic ? "italic " : ""}${isBold ? "bold " : ""}`;

        if (!rawText.trim()) {
          ctx.font = "italic 19px 'Space Grotesk', sans-serif";
          ctx.fillStyle = "rgba(226, 232, 240, 0.55)";
          ctx.fillText("_Empty card. Double-click or click to write._", 32, y + 16);
        } else {
          const lines = rawText.split("\n");
          let overflow = false;

          for (let i = 0; i < lines.length; i++) {
            if (y + 24 > maxBottom) {
              overflow = true;
              break;
            }
            const line = lines[i];
            if (!line.trim()) {
              y += 12;
              continue;
            }

            // Markdown Heading (# or ## or ###)
            if (/^#{1,4}\s+/.test(line)) {
              const hMatch = line.match(/^(#{1,4})\s+(.*)$/);
              const hLevel = hMatch ? hMatch[1].length : 1;
              const headingText = (hMatch ? hMatch[2] : line).replace(/\*\*/g, "").replace(/`+/g, "").trim();
              const hSize = Math.max(20, 27 - hLevel * 2);
              ctx.font = `bold ${hSize}px ${userFont}, system-ui, sans-serif`;

              ctx.fillStyle = chosenShine.main;
              ctx.fillRect(32, y - hSize * 0.7, 4, hSize * 0.9);

              ctx.fillStyle = "#ffffff";
              ctx.fillText(headingText, 44, y);
              y += hSize + 10;
              continue;
            }

            // Bullet List Item (- / * / • ...)
            if (/^[-*•]\s+/.test(line)) {
              const cleanItem = line.replace(/^[-*•]\s+/, "").replace(/\*\*/g, "").replace(/`+/g, "").replace(/<[^>]*>/g, "").trim();
              ctx.font = `bold ${userSize}px ${userFont}, system-ui, sans-serif`;
              ctx.fillStyle = chosenShine.main;
              ctx.fillText("•", 34, y);

              ctx.font = `${stylePrefix}${userSize}px ${userFont}, system-ui, sans-serif`;
              ctx.fillStyle = userColor;
              const words = cleanItem.split(" ");
              let cur = "";
              for (const w of words) {
                const test = cur ? `${cur} ${w}` : w;
                if (ctx.measureText(test).width > width - 84 && cur) {
                  ctx.fillText(cur, 50, y);
                  y += userSize + 9;
                  if (y + 24 > maxBottom) {
                    overflow = true;
                    break;
                  }
                  cur = w;
                } else {
                  cur = test;
                }
              }
              if (cur && !overflow) {
                ctx.fillText(cur, 50, y);
                y += userSize + 9;
              }
              if (overflow) break;
              continue;
            }

            // Numbered List Item (1. ...)
            if (/^\d+\.\s+/.test(line)) {
              const prefixMatch = line.match(/^\d+\.\s+/);
              const prefix = prefixMatch ? prefixMatch[0] : "1. ";
              const cleanNumItem = line.slice(prefix.length).replace(/\*\*/g, "").replace(/`+/g, "").replace(/<[^>]*>/g, "").trim();
              ctx.font = `bold ${Math.max(14, userSize - 2)}px 'JetBrains Mono', monospace`;
              ctx.fillStyle = chosenShine.main;
              ctx.fillText(prefix.trim(), 32, y);

              ctx.font = `${stylePrefix}${userSize}px ${userFont}, system-ui, sans-serif`;
              ctx.fillStyle = userColor;
              const words = cleanNumItem.split(" ");
              let cur = "";
              for (const w of words) {
                const test = cur ? `${cur} ${w}` : w;
                if (ctx.measureText(test).width > width - 84 && cur) {
                  ctx.fillText(cur, 60, y);
                  y += userSize + 9;
                  if (y + 24 > maxBottom) {
                    overflow = true;
                    break;
                  }
                  cur = w;
                } else {
                  cur = test;
                }
              }
              if (cur && !overflow) {
                ctx.fillText(cur, 60, y);
                y += userSize + 9;
              }
              if (overflow) break;
              continue;
            }

            // Standard text line
            const cleanLine = line.replace(/\*\*/g, "").replace(/`+/g, "").replace(/<[^>]*>/g, "").trim();
            ctx.font = `${stylePrefix}${userSize}px ${userFont}, system-ui, sans-serif`;
            ctx.fillStyle = userColor;
            const words = cleanLine.split(" ");
            let cur = "";
            for (const w of words) {
              const test = cur ? `${cur} ${w}` : w;
              if (ctx.measureText(test).width > width - 68 && cur) {
                ctx.fillText(cur, 32, y);
                y += userSize + 9;
                if (y + 24 > maxBottom) {
                  overflow = true;
                  break;
                }
                cur = w;
              } else {
                cur = test;
              }
            }
            if (cur && !overflow) {
              ctx.fillText(cur, 32, y);
              y += userSize + 9;
            }
            if (overflow) break;
          }

          if (overflow) {
            ctx.font = "italic 16px 'JetBrains Mono', monospace";
            ctx.fillStyle = "rgba(226, 232, 240, 0.65)";
            ctx.fillText("… (more lines in inspector)", 32, y + 4);
          }
        }

        // Card Footer Bar for dark card
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(28, height - 38);
        ctx.lineTo(width - 28, height - 38);
        ctx.stroke();

        const charCount = (item.text || "").length;
        const readMins = Math.max(1, Math.ceil((item.text || "").trim().split(/\s+/).filter(Boolean).length / 180));
        ctx.font = "bold 13px 'JetBrains Mono', monospace";
        ctx.fillStyle = "rgba(226, 232, 240, 0.65)";
        ctx.fillText(`${charCount} CHARS · ${readMins}m READ · 3D ORBIT`, 32, height - 16);
        ctx.fillText("BRAINVAULT SPATIAL", width - 180, height - 16);
      } else {
        // Authentic Concept Card: rich paper gradient matching the card's original color!
      const nodeColor = item.color || "#e0f2fe";
      const { r, g, b } = hexToRgb(nodeColor);

      // Gradient matching BrainVault 2D canvas paper cards:
      // Light, luminous, decent pastel paper gradient
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, `rgb(${Math.min(255, Math.round(r + (255 - r) * 0.45))}, ${Math.min(255, Math.round(g + (255 - g) * 0.45))}, ${Math.min(255, Math.round(b + (255 - b) * 0.45))})`);
      bgGrad.addColorStop(0.55, `rgb(${r}, ${g}, ${b})`);
      bgGrad.addColorStop(1, `rgb(${Math.min(255, Math.max(0, Math.round(r * 0.92)))}, ${Math.min(255, Math.max(0, Math.round(g * 0.92)))}, ${Math.min(255, Math.max(0, Math.round(b * 0.92)))})`);

      drawRoundedRect(6, 6, width - 12, height - 12, 24);
      ctx.fillStyle = bgGrad;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(15, 14, 71, 0.32)";
      ctx.stroke();

      // Top-left inset highlight
      drawRoundedRect(9, 9, width - 18, height - 18, 22);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.stroke();

      // Header Top Kicker & Serial Badge
      const kind = item.parentId ? "SUB-NODE" : "PRIMARY NODE";
      ctx.font = "bold 16px 'JetBrains Mono', monospace";
      const kickerWidth = ctx.measureText(kind).width + 24;

      drawRoundedRect(32, 26, kickerWidth, 30, 6);
      ctx.fillStyle = "rgba(15, 14, 71, 0.12)";
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(15, 14, 71, 0.22)";
      ctx.stroke();
      ctx.fillStyle = "rgba(15, 14, 71, 0.85)";
      ctx.fillText(kind, 44, 47);

      // Top-right status dot
      ctx.beginPath();
      ctx.arc(width - 44, 41, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#1e3a8a";
      ctx.fill();

      // Header Divider
      ctx.strokeStyle = "rgba(15, 14, 71, 0.15)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(28, 72);
      ctx.lineTo(width - 28, 72);
      ctx.stroke();

      // Highlighting card names on node cards in 3D space with shining bright font colors
      const title = (item.prompt || "Untitled Card").trim();
      const shinePalettes = [
        { main: "#00f0ff", glow: "rgba(0, 240, 255, 0.85)", badge: "#0284c7" },   // Cosmic Cyan
        { main: "#fde047", glow: "rgba(253, 224, 71, 0.85)", badge: "#d97706" },  // Shining Solar Gold
        { main: "#4ade80", glow: "rgba(74, 222, 128, 0.85)", badge: "#059669" },  // Stellar Emerald
        { main: "#f472b6", glow: "rgba(244, 114, 182, 0.85)", badge: "#db2777" }, // Nebula Pink
        { main: "#a78bfa", glow: "rgba(167, 139, 250, 0.85)", badge: "#7c3aed" }, // Deep Galaxy Violet
        { main: "#38bdf8", glow: "rgba(56, 189, 248, 0.85)", badge: "#0284c7" },  // Electric Sky
      ];
      const titleIdSum = Math.abs(String(item.id || "").split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
      const chosenShine = (item.textColor && item.textColor.startsWith("#") && item.textColor !== "#0e0d33" && item.textColor !== "#23214f")
        ? { main: item.textColor, glow: item.textColor, badge: item.textColor }
        : shinePalettes[titleIdSum % shinePalettes.length];

      // High-contrast luminous glass banner for title
      drawRoundedRect(28, 78, width - 56, 48, 8);
      ctx.fillStyle = "rgba(10, 14, 38, 0.92)";
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = chosenShine.main;
      ctx.stroke();

      // Card Title text with shining luminous glow and bright core highlight
      const cardTitleFont = item.fontFamily || "'Space Grotesk'";
      ctx.font = `bold 26px ${cardTitleFont}, system-ui, sans-serif`;
      let displayTitle = title;
      if (ctx.measureText(displayTitle).width > width - 84) {
        while (displayTitle.length > 3 && ctx.measureText(displayTitle + "…").width > width - 84) {
          displayTitle = displayTitle.slice(0, -1);
        }
        displayTitle += "…";
      }

      // Pass 1: Luminous text glow
      ctx.save();
      ctx.shadowColor = chosenShine.glow;
      ctx.shadowBlur = 14;
      ctx.fillStyle = chosenShine.main;
      ctx.fillText(displayTitle, 40, 112);
      ctx.restore();

      // Pass 2: Crisp shining bright core highlight
      ctx.fillStyle = "#ffffff";
      ctx.fillText(displayTitle, 40, 112);

      // Tag chips row
      let contentStartY = 145;
      const tags = item.tags || [];
      if (tags.length > 0) {
        let tagX = 32;
        ctx.font = "bold 15px 'JetBrains Mono', monospace";
        for (const tag of tags.slice(0, 5)) {
          const tagText = `#${tag}`;
          const tagWidth = ctx.measureText(tagText).width + 18;
          if (tagX + tagWidth < width - 32) {
            drawRoundedRect(tagX, 134, tagWidth, 26, 6);
            ctx.fillStyle = "rgba(15, 14, 71, 0.12)";
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = chosenShine.main;
            ctx.stroke();
            ctx.fillStyle = "rgba(15, 14, 71, 0.9)";
            ctx.fillText(tagText, tagX + 9, 152);
            tagX += tagWidth + 8;
          }
        }
        contentStartY = 178;
      }

      if (item.hideContent) {
        drawRoundedRect(28, contentStartY + 10, width - 56, 120, 12);
        ctx.fillStyle = "rgba(15, 14, 71, 0.08)";
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = chosenShine.main;
        ctx.stroke();
        ctx.font = "bold 24px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillStyle = "rgba(15, 14, 71, 0.9)";
        ctx.fillText("👁️ Card Content Hidden", 54, contentStartY + 64);
        ctx.font = "17px 'JetBrains Mono', monospace";
        ctx.fillStyle = "rgba(15, 14, 71, 0.65)";
        ctx.fillText("Click top menu or inspector to show full notes", 54, contentStartY + 96);
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        return texture;
      }

      // Arranged Text Lines: honoring custom font, size, text color, bold and italic
      const rawText = item.text || "";
      const maxBottom = height - 54;
      let y = contentStartY + 14;

      const userFont = item.fontFamily || "'Space Grotesk'";
      const userSize = item.fontSize ? Math.max(14, Math.min(28, parseInt(item.fontSize, 10) + 4)) : 19;
      const userColor = item.textColor || "#23214f";
      const isBold = Boolean(item.fontBold);
      const isItalic = Boolean(item.fontItalic);
      const stylePrefix = `${isItalic ? "italic " : ""}${isBold ? "bold " : ""}`;

      if (!rawText.trim()) {
        ctx.font = "italic 19px 'Space Grotesk', sans-serif";
        ctx.fillStyle = "rgba(15, 14, 71, 0.55)";
        ctx.fillText("_Empty card. Double-click or click to write._", 32, y + 16);
      } else {
        const lines = rawText.split("\n");
        let overflow = false;

        for (let i = 0; i < lines.length; i++) {
          if (y + 24 > maxBottom) {
            overflow = true;
            break;
          }
          const line = lines[i];
          if (!line.trim()) {
            y += 12;
            continue;
          }

          // Markdown Heading (# or ## or ###)
          if (/^#{1,4}\s+/.test(line)) {
            const hMatch = line.match(/^(#{1,4})\s+(.*)$/);
            const hLevel = hMatch ? hMatch[1].length : 1;
            const headingText = (hMatch ? hMatch[2] : line).replace(/\*\*/g, "").replace(/`+/g, "").trim();
            const hSize = Math.max(20, 27 - hLevel * 2);
            ctx.font = `bold ${hSize}px ${userFont}, system-ui, sans-serif`;

            // Left bright accent indicator for heading
            ctx.fillStyle = chosenShine.main;
            ctx.fillRect(32, y - hSize * 0.7, 4, hSize * 0.9);

            ctx.fillStyle = userColor === "#23214f" ? "#0e0d33" : userColor;
            ctx.fillText(headingText, 44, y);
            y += hSize + 10;
            continue;
          }

          // Bullet List Item (- / * / • ...)
          if (/^[-*•]\s+/.test(line)) {
            const cleanItem = line.replace(/^[-*•]\s+/, "").replace(/\*\*/g, "").replace(/`+/g, "").replace(/<[^>]*>/g, "").trim();
            ctx.font = `bold ${userSize}px ${userFont}, system-ui, sans-serif`;
            ctx.fillStyle = chosenShine.main;
            ctx.fillText("•", 34, y);

            ctx.font = `${stylePrefix}${userSize}px ${userFont}, system-ui, sans-serif`;
            ctx.fillStyle = userColor;
            const words = cleanItem.split(" ");
            let cur = "";
            for (const w of words) {
              const test = cur ? `${cur} ${w}` : w;
              if (ctx.measureText(test).width > width - 84 && cur) {
                ctx.fillText(cur, 50, y);
                y += userSize + 9;
                if (y + 24 > maxBottom) {
                  overflow = true;
                  break;
                }
                cur = w;
              } else {
                cur = test;
              }
            }
            if (cur && !overflow) {
              ctx.fillText(cur, 50, y);
              y += userSize + 9;
            }
            if (overflow) break;
            continue;
          }

          // Numbered List Item (1. ...)
          if (/^\d+\.\s+/.test(line)) {
            const prefixMatch = line.match(/^\d+\.\s+/);
            const prefix = prefixMatch ? prefixMatch[0] : "1. ";
            const cleanNumItem = line.slice(prefix.length).replace(/\*\*/g, "").replace(/`+/g, "").replace(/<[^>]*>/g, "").trim();
            ctx.font = `bold ${Math.max(14, userSize - 2)}px 'JetBrains Mono', monospace`;
            ctx.fillStyle = chosenShine.main;
            ctx.fillText(prefix.trim(), 32, y);

            ctx.font = `${stylePrefix}${userSize}px ${userFont}, system-ui, sans-serif`;
            ctx.fillStyle = userColor;
            const words = cleanNumItem.split(" ");
            let cur = "";
            for (const w of words) {
              const test = cur ? `${cur} ${w}` : w;
              if (ctx.measureText(test).width > width - 84 && cur) {
                ctx.fillText(cur, 60, y);
                y += userSize + 9;
                if (y + 24 > maxBottom) {
                  overflow = true;
                  break;
                }
                cur = w;
              } else {
                cur = test;
              }
            }
            if (cur && !overflow) {
              ctx.fillText(cur, 60, y);
              y += userSize + 9;
            }
            if (overflow) break;
            continue;
          }

          // Standard Arranged Text Line
          const cleanLine = line.replace(/\*\*/g, "").replace(/`+/g, "").replace(/<[^>]*>/g, "").trim();
          ctx.font = `${stylePrefix}${userSize}px ${userFont}, system-ui, sans-serif`;
          ctx.fillStyle = userColor;
          const words = cleanLine.split(" ");
          let cur = "";
          for (const w of words) {
            const test = cur ? `${cur} ${w}` : w;
            if (ctx.measureText(test).width > width - 68 && cur) {
              ctx.fillText(cur, 32, y);
              y += userSize + 9;
              if (y + 24 > maxBottom) {
                overflow = true;
                break;
              }
              cur = w;
            } else {
              cur = test;
            }
          }
          if (cur && !overflow) {
            ctx.fillText(cur, 32, y);
            y += userSize + 9;
          }
          if (overflow) break;
        }

        if (overflow) {
          ctx.font = "italic 16px 'JetBrains Mono', monospace";
          ctx.fillStyle = "rgba(15, 14, 71, 0.65)";
          ctx.fillText("… (more lines in inspector)", 32, y + 4);
        }
      }

      // Card Footer Bar matching original 2D canvas card
      ctx.strokeStyle = "rgba(15, 14, 71, 0.15)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(28, height - 38);
      ctx.lineTo(width - 28, height - 38);
      ctx.stroke();

      const charCount = (item.text || "").length;
      const readMins = Math.max(1, Math.ceil((item.text || "").trim().split(/\s+/).filter(Boolean).length / 180));
      ctx.font = "bold 13px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(15, 14, 71, 0.6)";
      ctx.fillText(`${charCount} CHARS · ${readMins}m READ · 3D ORBIT`, 32, height - 16);
      ctx.fillText("BRAINVAULT SPATIAL", width - 180, height - 16);
    }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  rebuildCardTextures() {
    const isLight = this.theme === "light";
    for (const mesh of this.nodes3D) {
      if (mesh.userData.item) {
        const fresh = this.store.node(mesh.userData.item.id) || this.store.sticky(mesh.userData.item.id) || mesh.userData.item;
        mesh.userData.item = fresh;
        const tex = this.createCardTexture(fresh, mesh.userData.isSticky, this.theme);
        // Face 4 is the front face, Face 5 is the back face of BoxGeometry
        if (Array.isArray(mesh.material)) {
          const sideColor = isLight
            ? 0x111827
            : (mesh.userData.isSticky
                ? parseInt(((fresh.color) || "#FEF08A").replace("#", "0x"), 16)
                : parseInt(((fresh.color) || "#e0f2fe").replace("#", "0x"), 16));
          for (let i = 0; i < 4; i++) {
            if (mesh.material[i]) {
              mesh.material[i].color.setHex(sideColor);
            }
          }
          if (mesh.material[4]) {
            mesh.material[4].map = tex;
            mesh.material[4].needsUpdate = true;
          }
          if (mesh.material[5]) {
            mesh.material[5].map = tex;
            mesh.material[5].needsUpdate = true;
          }
        }
      }
    }
  }

  // --- Graph Construction in 3D Space ---------------------------------------
  buildGraph3D() {
    const THREE = window.THREE;
    if (!this.scene) return;

    // Clean up previous 3D nodes & links
    for (const mesh of this.nodes3D) {
      this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else if (mesh.material) {
        mesh.material.dispose();
      }
    }
    for (const linkObj of this.links3D) {
      if (linkObj.line) {
        this.scene.remove(linkObj.line);
        if (linkObj.line.geometry) linkObj.line.geometry.dispose();
        if (linkObj.line.material) linkObj.line.material.dispose();
      }
      if (linkObj.pulse) {
        this.scene.remove(linkObj.pulse);
        if (linkObj.pulse.geometry) linkObj.pulse.geometry.dispose();
        if (linkObj.pulse.material) linkObj.pulse.material.dispose();
      }
      if (linkObj.spark) {
        this.scene.remove(linkObj.spark);
        if (linkObj.spark.geometry) linkObj.spark.geometry.dispose();
        if (linkObj.spark.material) linkObj.spark.material.dispose();
      }
    }
    this.nodes3D = [];
    this.links3D = [];

    const nodes = this.store.nodes();
    const stickies = this.store.stickies();
    const links = this.store.links();

    // Calculate center offset from 2D coordinates
    let cx = 0, cy = 0;
    const allItems = [...nodes, ...stickies];
    if (allItems.length) {
      allItems.forEach((it) => {
        cx += it.x + (it.width || 500) / 2;
        cy += it.y + (it.height || 400) / 2;
      });
      cx /= allItems.length;
      cy /= allItems.length;
    }

    const nodePosMap = new Map();
    const meshMap = new Map();

    // 1. Build 3D Card Meshes for Nodes (proportional to original 2D cards)
    nodes.forEach((n, i) => {
      const w = 220;
      const h = n.hideContent ? 85 : 175;
      const d = 10;
      const geo = new THREE.BoxGeometry(w, h, d);

      const nodeColor = parseInt((n.color || "#e0f2fe").replace("#", "0x"), 16);
      const isLight = this.theme === "light";
      const sideColor = isLight ? 0x111827 : nodeColor;

      // Multi-material: Front and back face receive high-res authentic paper card texture
      const sideMat = new THREE.MeshStandardMaterial({
        color: sideColor,
        roughness: 0.35,
        metalness: 0.3,
        transparent: true,
        opacity: isLight ? 0.95 : 0.88,
      });
      const frontTexture = this.createCardTexture(n, false, this.theme);
      const frontMat = new THREE.MeshBasicMaterial({
        map: frontTexture,
        transparent: true,
        opacity: 0.98,
      });
      const backMat = new THREE.MeshBasicMaterial({
        map: frontTexture,
        transparent: true,
        opacity: 0.95,
      });

      // BoxGeometry faces: px, nx, py, ny, pz (front = index 4), nz (back = index 5)
      const materials = [sideMat, sideMat, sideMat, sideMat, frontMat, backMat];
      const mesh = new THREE.Mesh(geo, materials);

      // Map 2D coordinates to 3D with elevation tiers
      const depthOffset = n.parentId ? (i % 2 === 0 ? 80 : -80) : 0;
      const cardH = n.hideContent ? 120 : (n.height || 580);
      const posX = (n.x + n.width / 2 - cx) * 0.9;
      const posY = -(n.y + cardH / 2 - cy) * 0.9;
      const posZ = depthOffset;

      mesh.position.set(posX, posY, posZ);
      mesh.userData = {
        item: n,
        type: "card",
        isSticky: false,
        basePos: { x: posX, y: posY, z: posZ },
        floatOffset: i * 0.75,
      };

      // Glowing edges
      const edges = new THREE.EdgesGeometry(geo);
      const edgeLine = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({
          color: nodeColor,
          transparent: true,
          opacity: 0.75,
        })
      );
      mesh.add(edgeLine);

      this.scene.add(mesh);
      this.nodes3D.push(mesh);
      nodePosMap.set(n.id, mesh.position);
      meshMap.set(n.id, mesh);
    });

    // 2. Build 3D Card Meshes for Sticky Memos (proportional to sticky notes)
    stickies.forEach((s, idx) => {
      const w = 180;
      const h = 180;
      const d = 10;
      const geo = new THREE.BoxGeometry(w, h, d);

      const isLight = this.theme === "light";
      const stickyColor = parseInt((s.color || "#FEF08A").replace("#", "0x"), 16);
      const sideColor = isLight ? 0x111827 : stickyColor;
      const sideMat = new THREE.MeshStandardMaterial({
        color: sideColor,
        roughness: 0.4,
        metalness: 0.2,
      });
      const frontTexture = this.createCardTexture(s, true, this.theme);
      const frontMat = new THREE.MeshBasicMaterial({
        map: frontTexture,
        transparent: true,
        opacity: 0.98,
      });
      const backMat = new THREE.MeshBasicMaterial({
        map: frontTexture,
        transparent: true,
        opacity: 0.95,
      });

      const materials = [sideMat, sideMat, sideMat, sideMat, frontMat, backMat];
      const mesh = new THREE.Mesh(geo, materials);

      const sWidth = s.width || 260;
      const sHeight = s.height || 220;
      const posX = (s.x + sWidth / 2 - cx) * 0.9;
      const posY = -(s.y + sHeight / 2 - cy) * 0.9;
      const posZ = (idx % 2 === 0 ? 130 : -130);

      mesh.position.set(posX, posY, posZ);
      mesh.userData = {
        item: s,
        type: "sticky",
        isSticky: true,
        basePos: { x: posX, y: posY, z: posZ },
        floatOffset: (nodes.length + idx) * 0.75,
      };

      const edges = new THREE.EdgesGeometry(geo);
      const edgeLine = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: stickyColor, opacity: 0.85 })
      );
      mesh.add(edgeLine);

      this.scene.add(mesh);
      this.nodes3D.push(mesh);
      nodePosMap.set(s.id, mesh.position);
      meshMap.set(s.id, mesh);
    });

    // 3. Dynamic 3D Connecting Bezier Curves with distinct colors
    const SUB_PALETTE_HEX = [
      0x10b981, // Emerald
      0x06b6d4, // Cyan
      0x8b5cf6, // Violet
      0xec4899, // Pink
      0x3b82f6, // Blue
      0x14b8a6, // Teal
      0xf43f5e, // Rose
      0xa855f7, // Purple
      0xeab308, // Amber
      0x84cc16, // Lime
    ];

    links.forEach((l, idx) => {
      const p1 = nodePosMap.get(l.sourceId);
      const p2 = nodePosMap.get(l.targetId);
      const srcMesh = meshMap.get(l.sourceId);
      const tgtMesh = meshMap.get(l.targetId);
      if (!p1 || !p2 || !srcMesh || !tgtMesh) return;

      const targetItem = tgtMesh?.userData?.item;
      const sourceItem = srcMesh?.userData?.item;
      const isParentChild = Boolean(
        (targetItem && targetItem.parentId === sourceItem?.id) || (sourceItem && sourceItem.parentId === targetItem?.id)
      );

      let strokeColorHex = 0x22d3ee;
      if (isParentChild) {
        if (targetItem?.color) {
          try {
            strokeColorHex = parseInt(targetItem.color.replace("#", "0x"), 16) || SUB_PALETTE_HEX[idx % SUB_PALETTE_HEX.length];
          } catch (_) {
            strokeColorHex = SUB_PALETTE_HEX[idx % SUB_PALETTE_HEX.length];
          }
        } else {
          strokeColorHex = SUB_PALETTE_HEX[idx % SUB_PALETTE_HEX.length];
        }
      } else {
        strokeColorHex = SUB_PALETTE_HEX[(idx + 3) % SUB_PALETTE_HEX.length];
      }

      // Calculate card half-widths to connect edge-to-edge identical to 2D workspace
      const w1 = (srcMesh.geometry?.parameters?.width || (sourceItem?.width || 420) * 0.9);
      const w2 = (tgtMesh.geometry?.parameters?.width || (targetItem?.width || 420) * 0.9);
      const dx = p2.x - p1.x;
      const x1 = dx >= 0 ? p1.x + w1 / 2 : p1.x - w1 / 2;
      const y1 = p1.y;
      const z1 = p1.z;
      const x2 = dx >= 0 ? p2.x - w2 / 2 : p2.x + w2 / 2;
      const y2 = p2.y;
      const z2 = p2.z;

      const bend = Math.max(60, Math.abs(x2 - x1) * 0.45);
      const dir = x2 >= x1 ? 1 : -1;
      const cx1 = x1 + bend * dir;
      const cy1 = y1;
      const cz1 = z1;
      const cx2 = x2 - bend * dir;
      const cy2 = y2;
      const cz2 = z2;

      const segs = 32;
      const linePositions = new Float32Array((segs + 1) * 3);
      for (let k = 0; k <= segs; k++) {
        const t = k / segs;
        const inv = 1 - t;
        const b0 = inv * inv * inv;
        const b1 = 3 * inv * inv * t;
        const b2 = 3 * inv * t * t;
        const b3 = t * t * t;
        linePositions[k * 3] = b0 * x1 + b1 * cx1 + b2 * cx2 + b3 * x2;
        linePositions[k * 3 + 1] = b0 * y1 + b1 * cy1 + b2 * cy2 + b3 * y2;
        linePositions[k * 3 + 2] = b0 * z1 + b1 * cz1 + b2 * cz2 + b3 * z2;
      }

      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));

      const lineMat = new THREE.LineBasicMaterial({
        color: strokeColorHex,
        transparent: true,
        opacity: 0.88,
        linewidth: 2,
      });
      const curveMesh = new THREE.Line(lineGeo, lineMat);
      this.scene.add(curveMesh);

      // Glowing electric pulse particle traveling along curve
      const pulseGeo = new THREE.SphereGeometry(3.8, 8, 8);
      const pulseMat = new THREE.MeshBasicMaterial({
        color: strokeColorHex,
        transparent: true,
        opacity: 0.96,
      });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      pulseMesh.position.set(x1, y1, z1);
      this.scene.add(pulseMesh);

      // Secondary fast electric spark particle
      const sparkGeo = new THREE.SphereGeometry(2.4, 6, 6);
      const sparkMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.98,
      });
      const sparkMesh = new THREE.Mesh(sparkGeo, sparkMat);
      sparkMesh.position.set(x1, y1, z1);
      this.scene.add(sparkMesh);

      this.links3D.push({
        line: curveMesh,
        sourceMesh: srcMesh,
        targetMesh: tgtMesh,
        pulse: pulseMesh,
        spark: sparkMesh,
        strokeColorHex,
        idx,
        w1,
        w2,
      });
    });

    // Anime.js motion animation for notes in 3D space
    if (typeof window.anime === "function" && this.nodes3D.length) {
      this.nodes3D.forEach((mesh, idx) => {
        mesh.scale.set(0.001, 0.001, 0.001);
        const base = mesh.userData.basePos;
        if (base) {
          mesh.position.y = base.y - 80;
        }
        window.anime({
          targets: mesh.scale,
          x: 1,
          y: 1,
          z: 1,
          delay: idx * 45,
          duration: 650,
          easing: "easeOutBack",
        });
        if (base) {
          window.anime({
            targets: mesh.position,
            y: base.y,
            delay: idx * 45,
            duration: 750,
            easing: "easeOutCubic",
          });
        }
      });
    }
  }

  updateCameraPos() {
    const rx = this.rotation.x;
    const ry = this.rotation.y;
    this.camera.position.x = this.target.x + this.distance * Math.sin(ry) * Math.cos(rx);
    this.camera.position.y = this.target.y + this.distance * Math.sin(rx);
    this.camera.position.z = this.target.z + this.distance * Math.cos(ry) * Math.cos(rx);
    this.camera.lookAt(this.target.x, this.target.y, this.target.z);
  }

  // --- Interactive Node Inspector (Click Node -> Show Details & 3-Line Info) --
  showNodeInfo(item, isSticky = false) {
    if (!item) return;
    this.selectedNodeId = item.id;
    const panel = document.querySelector("#tree3dNodeInfo");
    if (!panel) return;

    const kindEl = panel.querySelector("#tree3dInfoKind");
    const idEl = panel.querySelector("#tree3dInfoId");
    const titleEl = panel.querySelector("#tree3dInfoTitle");
    const nodesEl = panel.querySelector("#tree3dInfoNodes");
    const tagsEl = panel.querySelector("#tree3dInfoTags");
    const line1El = panel.querySelector("#tree3dLine1");
    const line2El = panel.querySelector("#tree3dLine2");
    const line3El = panel.querySelector("#tree3dLine3");
    const rawTextEl = panel.querySelector("#tree3dInfoRawText");
    const addTagBtn = panel.querySelector("#tree3dAddTagBtn");

    const color = item.color || (isSticky ? "#FEF08A" : "#7DD3FC");
    const kind = isSticky ? "STICKY MEMO" : item.parentId ? "SUB-NODE" : "PRIMARY NODE";

    kindEl.textContent = kind;
    kindEl.style.borderColor = color;
    kindEl.style.color = color;
    idEl.textContent = item.id;

    titleEl.textContent = item.prompt || (isSticky ? "Sticky Note" : "Untitled Node");

    // 1. Render Connected Knowledge Nodes: Parent lineage and every sub-node with distinct colors!
    if (nodesEl) {
      if (!isSticky) {
        const hierarchy = this.store.getNodeHierarchy?.(item.id) || { ancestors: [], subNodes: [], linked: [] };
        const chips = [];

        // Ancestors up to root parent (distinct warm gold/amber lineage)
        for (const a of hierarchy.ancestors) {
          chips.push({
            id: a.node.id,
            rel: a.rel,
            prompt: a.node.prompt,
            badgeColor: a.badgeColor,
            typeClass: "ancestor",
          });
        }

        // Sub-nodes with distinct colors
        for (const s of hierarchy.subNodes) {
          chips.push({
            id: s.node.id,
            rel: s.rel,
            prompt: s.node.prompt,
            badgeColor: s.badgeColor,
            typeClass: "subnode",
          });
        }

        // Direct links
        for (const l of hierarchy.linked) {
          chips.push({
            id: l.node.id,
            rel: l.rel,
            prompt: l.node.prompt,
            badgeColor: l.badgeColor,
            typeClass: "linked",
          });
        }

        if (chips.length > 0) {
          nodesEl.innerHTML = chips
            .map(
              (c) => `<button class="tree3d-node-chip ${c.typeClass}" data-nav-node="${c.id}" title="Focus ${c.rel} in 3D orbit space" style="--chip-col:${c.badgeColor}; border-color:${c.badgeColor};">
                <span class="chip-dot" style="background:${c.badgeColor}"></span>
                <span class="chip-rel" style="color:${c.badgeColor}">${c.rel}:</span>
                <strong>${c.prompt || "Node"}</strong>
              </button>`
            )
            .join("");
          nodesEl.querySelectorAll("[data-nav-node]").forEach((btn) => {
            btn.addEventListener("click", () => {
              this.selectAndFocusNode(btn.dataset.navNode);
            });
          });
        } else {
          nodesEl.innerHTML = `<span class="tree3d-tag-none">Independent node (no connections)</span>`;
        }
      } else {
        nodesEl.innerHTML = `<span class="tree3d-tag-none">Sticky memo (freestanding)</span>`;
      }
    }

    // 1b. Render Suggested Existing Nodes in 3D
    const suggestEl = panel.querySelector("#tree3dInfoSuggestions");
    if (suggestEl) {
      if (!isSticky) {
        const suggestions = this.store.suggestExistingNodes?.(item.id) || [];
        if (suggestions.length > 0) {
          suggestEl.innerHTML = suggestions
            .slice(0, 5)
            .map(
              (s) => `<div class="tree3d-suggest-chip">
                <div class="tree3d-suggest-meta">
                  <strong class="tree3d-suggest-title">${s.prompt || s.node?.prompt || "Node"}</strong>
                  <span class="tree3d-suggest-reason">${s.reason || ""}</span>
                </div>
                <div class="tree3d-suggest-actions">
                  <button class="btn tiny primary" data-tree3d-connect-sub="${s.id || s.node?.id}" title="Connect as sub-node in 3D">+ Sub-Node</button>
                  <button class="btn tiny" data-tree3d-connect-link="${s.id || s.node?.id}" title="Link in 3D">+ Link</button>
                </div>
              </div>`
            )
            .join("");

          suggestEl.querySelectorAll("[data-tree3d-connect-sub]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              const targetId = btn.dataset.tree3dConnectSub;
              this.store.connectExistingAsSubNode(item.id, targetId);
              this.store.saveToDatabase?.();
              this.buildGraph3D();
              const updated = this.store.node(item.id);
              if (updated) this.showNodeInfo(updated, false);
              this.toast?.(`Connected node as sub-node in 3D space`);
            });
          });

          suggestEl.querySelectorAll("[data-tree3d-connect-link]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
              e.stopPropagation();
              const targetId = btn.dataset.tree3dConnectLink;
              this.store.connectExistingNodes(item.id, targetId);
              this.store.saveToDatabase?.();
              this.buildGraph3D();
              const updated = this.store.node(item.id);
              if (updated) this.showNodeInfo(updated, false);
              this.toast?.(`Connected direct link in 3D space`);
            });
          });
        } else {
          suggestEl.innerHTML = `<span class="tree3d-tag-none">All workspace nodes are connected</span>`;
        }
      } else {
        suggestEl.innerHTML = `<span class="tree3d-tag-none">Suggestions unavailable for stickies</span>`;
      }
    }

    // 2. Render Tags with Interactive Delete buttons ("and tags")
    const tags = item.tags || [];
    if (tags.length) {
      tagsEl.innerHTML = tags
        .map(
          (t) =>
            `<span class="tree3d-tag-chip">#${t} <button class="tree3d-tag-remove" data-untag="${t}" title="Remove tag">×</button></span>`
        )
        .join(" ");
      tagsEl.querySelectorAll("[data-untag]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const tag = btn.dataset.untag;
          this.store.removeTag(item.id, tag);
          this.buildGraph3D();
          const updated = this.store.node(item.id);
          if (updated) this.showNodeInfo(updated, false);
          this.toast?.(`Removed tag #${tag}`);
        });
      });
    } else {
      tagsEl.innerHTML = `<span class="tree3d-tag-none">${isSticky ? "Stickies have no tags" : "No tags attached"}</span>`;
    }
    if (addTagBtn) {
      addTagBtn.style.display = isSticky ? "none" : "";
    }

    // 3. Extract 3-line overview info ("and some 3 line info about that notes")
    const summary = this.extractThreeLineInfo(item);
    line1El.textContent = summary.line1;
    line2El.textContent = summary.line2;
    line3El.textContent = summary.line3;

    // 4. Arranged full text preview & In-3D direct editor
    const rawText = item.text || "";
    rawTextEl.textContent = rawText || "(Empty card content. Click '✎ Edit Note' to write.)";
    const lineCount = rawText.split("\n").filter(Boolean).length;
    const textLabel = panel.querySelector("#tree3dInfoTextLabel");
    if (textLabel) textLabel.textContent = `ARRANGED CONTENT (${lineCount} LINE${lineCount === 1 ? "" : "S"})`;

    // Reset inline edit area and populate typography controls
    const editArea = panel.querySelector("#tree3dInlineEditArea");
    const editText = panel.querySelector("#tree3dEditText");
    const editToggleBtn = panel.querySelector("#tree3dEditToggleBtn");
    const editFont = panel.querySelector("#tree3dEditFont");
    const editSize = panel.querySelector("#tree3dEditSize");
    const editColor = panel.querySelector("#tree3dEditColor");
    const editBold = panel.querySelector("#tree3dEditBold");
    const editItalic = panel.querySelector("#tree3dEditItalic");

    if (editFont) editFont.value = item.fontFamily || "Space Grotesk";
    if (editSize) editSize.value = item.fontSize || "14px";
    if (editColor) editColor.value = item.textColor || "#00ffff";
    if (editBold) editBold.classList.toggle("is-active", Boolean(item.fontBold));
    if (editItalic) editItalic.classList.toggle("is-active", Boolean(item.fontItalic));

    if (editArea && editText) {
      editArea.classList.add("is-hidden");
      rawTextEl.classList.remove("is-hidden");
      editText.value = rawText;
      if (editToggleBtn) editToggleBtn.textContent = "✎ Edit Note";
    }

    // 5. Populate attached images for 3D card
    const imgList = panel.querySelector("#tree3dImagesList");
    if (imgList) {
      const images = item.images || [];
      if (images.length > 0) {
        imgList.innerHTML = images
          .map(
            (img, i) => `
          <div class="tree3d-img-thumb" title="${img.name || 'Attached Image'}">
            <img src="${img.dataUrl || img.url || ''}" alt="Attachment" onerror="this.style.opacity='0.3'" />
            <button type="button" class="tree3d-img-remove" data-tree3d-del-img="${i}" title="Remove image">×</button>
          </div>
        `
          )
          .join("");
        imgList.querySelectorAll("[data-tree3d-del-img]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const idx = parseInt(btn.dataset.tree3dDelImg, 10);
            const freshImages = [...(item.images || [])];
            freshImages.splice(idx, 1);
            this.store.updateNode(item.id, { images: freshImages });
            this.store.saveToDatabase?.();
            this.rebuildCardTextures();
            this.showNodeInfo(this.store.node(item.id), isSticky);
            this.toast?.("Removed image from node in 3D");
          });
        });
      } else {
        imgList.innerHTML = `<span class="tree3d-tag-none">No images attached</span>`;
      }
    }

    panel.classList.remove("is-hidden");
  }

  selectAndFocusNode(nodeId) {
    const item = this.store.node(nodeId) || this.store.sticky(nodeId);
    if (!item) return;
    const isSticky = !item.prompt && Boolean(this.store.sticky(nodeId));
    this.showNodeInfo(item, isSticky);
    const mesh = this.nodes3D.find((m) => m.userData.item?.id === nodeId);
    if (mesh) this.focusNodeIn3D(mesh);
  }

  hideNodeInfo() {
    this.selectedNodeId = null;
    const panel = document.querySelector("#tree3dNodeInfo");
    if (panel) panel.classList.add("is-hidden");
  }

  extractThreeLineInfo(item) {
    const raw = (item.text || "").trim();
    const title = (item.prompt || (item.text ? "Sticky Memo" : "Untitled Card")).trim();
    const kind = item.parentId ? "Sub-Node branch component" : item.prompt ? "Primary knowledge pillar" : "Sticky memo";
    const tags = item.tags && item.tags.length ? item.tags.map((t) => `#${t}`).join(" ") : "No tags attached";

    if (!raw) {
      return {
        line1: `1. Title: ${title}`,
        line2: `2. Status: Ready for arranged notes content`,
        line3: `3. Structure: ${kind} · ${tags}`,
      };
    }

    // Split raw lines and clean markdown symbols for clean overview
    const lines = raw
      .split("\n")
      .map((l) => l.replace(/^#{1,4}\s+/, "").replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "").replace(/\*\*/g, "").replace(/`+/g, "").trim())
      .filter((l) => l.length > 0);

    if (lines.length >= 3) {
      return {
        line1: lines[0],
        line2: lines[1],
        line3: lines[2],
      };
    } else if (lines.length === 2) {
      return {
        line1: lines[0],
        line2: lines[1],
        line3: `Hierarchy: ${kind} · ${tags}`,
      };
    } else {
      return {
        line1: lines[0],
        line2: `Topic: ${title}`,
        line3: `Classification: ${kind} · ${tags}`,
      };
    }
  }

  focusNodeIn3D(mesh) {
    if (!mesh) return;
    const targetPos = mesh.position;
    const startTarget = { ...this.target };
    const startDistance = this.distance;
    const targetDistance = 750;
    const startTime = performance.now();
    const duration = 650;

    const animateFocus = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 0.5 - Math.cos(progress * Math.PI) / 2;

      this.target.x = startTarget.x + (targetPos.x - startTarget.x) * ease;
      this.target.y = startTarget.y + (targetPos.y - startTarget.y) * ease;
      this.target.z = startTarget.z + (targetPos.z - startTarget.z) * ease;
      this.distance = startDistance + (targetDistance - startDistance) * ease;
      this.updateCameraPos();

      if (progress < 1 && this.isActive) {
        requestAnimationFrame(animateFocus);
      }
    };
    requestAnimationFrame(animateFocus);
  }

  // --- Database Sync & Fetch ------------------------------------------------
  async saveToDatabase() {
    const btn = document.querySelector("#tree3dSaveDb");
    const statusEl = document.querySelector("#tree3dDbStatus");
    if (btn) btn.disabled = true;
    try {
      this.toast?.("Saving knowledge graph to database...");
      await this.store.saveToDatabase();
      this.toast?.("✓ Successfully synced all nodes to SQLite database!");
      if (statusEl) {
        statusEl.innerHTML = `<span class="db-sync-dot is-synced"></span> <span class="db-status-label">DB Synced</span>`;
      }
    } catch (err) {
      console.error("Database save failed:", err);
      this.toast?.("Database save error: " + (err.message || err));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async fetchFromDatabase() {
    const btn = document.querySelector("#tree3dFetchDb");
    const statusEl = document.querySelector("#tree3dDbStatus");
    if (btn) btn.disabled = true;
    try {
      this.toast?.("Fetching latest data from database...");
      const snap = await this.store.syncFromDatabase();
      const count = snap?.nodes?.length || this.store.nodes().length;
      this.toast?.(`✓ Fetched ${count} notes from SQLite database!`);
      this.buildGraph3D();
      if (statusEl) {
        statusEl.innerHTML = `<span class="db-sync-dot is-synced"></span> <span class="db-status-label">DB Synced</span>`;
      }
    } catch (err) {
      console.error("Database fetch failed:", err);
      this.toast?.("Database fetch error: " + (err.message || err));
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // --- 3D Hierarchical Collision-Free Card Alignment -------------------------
  arrange3DTreeHierarchical() {
    if (!this.nodes3D.length) return;
    const nodes = this.store.nodes();
    const stickies = this.store.stickies();

    const rootNodes = nodes.filter((n) => !n.parentId);
    const childMap = new Map();
    nodes
      .filter((n) => n.parentId)
      .forEach((ch) => {
        if (!childMap.has(ch.parentId)) childMap.set(ch.parentId, []);
        childMap.get(ch.parentId).push(ch);
      });

    const targetPos = new Map();
    const numRoots = rootNodes.length || 1;
    const rootSpacing = Math.max(380, 1200 / numRoots);

    rootNodes.forEach((r, idx) => {
      const rx = (idx - (numRoots - 1) / 2) * rootSpacing;
      const ry = 140;
      const rz = 0;
      targetPos.set(r.id, { x: rx, y: ry, z: rz });

      const children = childMap.get(r.id) || [];
      const numChildren = children.length;
      if (numChildren > 0) {
        const childSpacing = 280;
        children.forEach((c, cIdx) => {
          const cx = rx + (cIdx - (numChildren - 1) / 2) * childSpacing;
          const cy = -160;
          const cz = cIdx % 2 === 0 ? 120 : -120;
          targetPos.set(c.id, { x: cx, y: cy, z: cz });
        });
      }
    });

    nodes.forEach((n) => {
      if (!targetPos.has(n.id)) {
        targetPos.set(n.id, { x: 0, y: 0, z: 0 });
      }
    });

    stickies.forEach((s, sIdx) => {
      const sx = (numRoots / 2) * rootSpacing + 260;
      const sy = 120 - sIdx * 160;
      const sz = -80;
      targetPos.set(s.id, { x: sx, y: sy, z: sz });
    });

    // Smoothly animate 3D meshes to positions without collapsing
    this.nodes3D.forEach((mesh) => {
      const id = mesh.userData?.item?.id;
      const pos = targetPos.get(id);
      if (pos) {
        mesh.userData.basePos = { ...pos };
        if (typeof window.anime === "function") {
          window.anime({
            targets: mesh.position,
            x: pos.x,
            y: pos.y,
            z: pos.z,
            duration: 850,
            easing: "easeOutCubic",
          });
        } else {
          mesh.position.set(pos.x, pos.y, pos.z);
        }
      }
    });

    this.toast?.("Aligned all cards in collision-free 3D hierarchy!");
  }

  // --- Event Handling -------------------------------------------------------
  attach3DEvents() {
    const overlay = document.querySelector("#tree3dOverlay");
    const canvas = document.querySelector("#tree3dCanvas");

    overlay.querySelector("#tree3dAlign")?.addEventListener("click", () => this.arrange3DTreeHierarchical());
    overlay.querySelector("#tree3dClose")?.addEventListener("click", () => this.close3DMode());
    overlay.querySelector("#tree3dReset")?.addEventListener("click", () => {
      this.rotation = { x: 0.25, y: -0.2 };
      this.distance = 1250;
      this.target = { x: 0, y: 0, z: 0 };
      this.updateCameraPos();
    });
    overlay.querySelector("#tree3dRotate")?.addEventListener("click", (e) => {
      this.autoRotate = !this.autoRotate;
      e.target.textContent = this.autoRotate ? "Pause Orbit" : "Auto-Orbit";
    });

    // Theme Switcher Buttons
    overlay.querySelectorAll("[data-tree3d-theme]").forEach((btn) => {
      btn.addEventListener("click", () => this.setTheme(btn.dataset.tree3dTheme));
    });

    // Database Sync Buttons
    overlay.querySelector("#tree3dSaveDb")?.addEventListener("click", () => this.saveToDatabase());
    overlay.querySelector("#tree3dFetchDb")?.addEventListener("click", () => this.fetchFromDatabase());

    // Node Info Panel Actions
    overlay.querySelector("#tree3dInfoClose")?.addEventListener("click", () => this.hideNodeInfo());
    overlay.querySelector("#tree3dFocusBtn")?.addEventListener("click", () => {
      if (this.selectedNodeId) {
        const mesh = this.nodes3D.find((m) => m.userData.item?.id === this.selectedNodeId);
        if (mesh) this.focusNodeIn3D(mesh);
      }
    });
    overlay.querySelector("#tree3dEditInCanvas")?.addEventListener("click", () => {
      if (this.selectedNodeId) {
        const item = this.store.node(this.selectedNodeId) || this.store.sticky(this.selectedNodeId);
        if (item) {
          this.close3DMode();
          this.canvas.select(item.id);
          this.canvas.smoothZoomToNode(item, 0.8);
          this.toast?.(`Opened “${item.prompt || "Card"}” for editing in Canvas`);
        }
      }
    });
    overlay.querySelector("#tree3dAddTagBtn")?.addEventListener("click", () => {
      if (this.selectedNodeId) {
        const item = this.store.node(this.selectedNodeId);
        if (!item) return;
        const tag = window.prompt(`Enter tag name for "${item.prompt}":`);
        if (tag && tag.trim()) {
          this.store.addTag(item.id, tag.trim());
          this.store.saveToDatabase?.();
          this.buildGraph3D();
          this.showNodeInfo(this.store.node(item.id), false);
          this.toast?.(`Added tag #${tag.trim()} and saved to database`);
        }
      }
    });

    // In-3D Add Image Handler
    overlay.querySelector("#tree3dAddImageBtn")?.addEventListener("click", () => {
      if (!this.selectedNodeId) return;
      const inp = overlay.querySelector("#tree3dImageInput");
      const url = inp ? inp.value.trim() : "";
      if (!url) {
        this.toast?.("Please enter a valid image URL.");
        return;
      }
      const node = this.store.node(this.selectedNodeId);
      if (node) {
        const freshImages = [...(node.images || [])];
        freshImages.push({
          id: `img_${Date.now()}`,
          name: "3D Image",
          dataUrl: url,
          url: url,
        });
        this.store.updateNode(this.selectedNodeId, { images: freshImages });
        this.store.saveToDatabase?.();
        this.rebuildCardTextures();
        if (inp) inp.value = "";
        this.showNodeInfo(this.store.node(this.selectedNodeId), false);
        this.toast?.("Attached image in 3D and synced to database!");
      }
    });

    // In-3D Live Note Editing Handlers
    overlay.querySelector("#tree3dEditToggleBtn")?.addEventListener("click", () => {
      const editArea = overlay.querySelector("#tree3dInlineEditArea");
      const rawTextEl = overlay.querySelector("#tree3dInfoRawText");
      const editToggleBtn = overlay.querySelector("#tree3dEditToggleBtn");
      const isEditing = editArea && !editArea.classList.contains("is-hidden");
      if (isEditing) {
        editArea.classList.add("is-hidden");
        rawTextEl.classList.remove("is-hidden");
        if (editToggleBtn) editToggleBtn.textContent = "✎ Edit Note";
      } else {
        editArea.classList.remove("is-hidden");
        rawTextEl.classList.add("is-hidden");
        if (editToggleBtn) editToggleBtn.textContent = "Preview";
        const editText = overlay.querySelector("#tree3dEditText");
        if (editText) editText.focus();
      }
    });

    overlay.querySelector("#tree3dCancelNoteBtn")?.addEventListener("click", () => {
      const editArea = overlay.querySelector("#tree3dInlineEditArea");
      const rawTextEl = overlay.querySelector("#tree3dInfoRawText");
      const editToggleBtn = overlay.querySelector("#tree3dEditToggleBtn");
      if (editArea) editArea.classList.add("is-hidden");
      if (rawTextEl) rawTextEl.classList.remove("is-hidden");
      if (editToggleBtn) editToggleBtn.textContent = "✎ Edit Note";
    });

    overlay.querySelector("#tree3dSaveNoteBtn")?.addEventListener("click", () => {
      if (this.selectedNodeId) {
        const editText = overlay.querySelector("#tree3dEditText");
        if (!editText) return;
        const newText = editText.value;
        const editFont = overlay.querySelector("#tree3dEditFont");
        const editSize = overlay.querySelector("#tree3dEditSize");
        const editColor = overlay.querySelector("#tree3dEditColor");
        const editBold = overlay.querySelector("#tree3dEditBold");
        const editItalic = overlay.querySelector("#tree3dEditItalic");

        const patch = {
          text: newText,
          fontFamily: editFont ? editFont.value : undefined,
          fontSize: editSize ? editSize.value : undefined,
          textColor: editColor ? editColor.value : undefined,
          fontBold: editBold ? editBold.classList.contains("is-active") : undefined,
          fontItalic: editItalic ? editItalic.classList.contains("is-active") : undefined,
        };

        const node = this.store.node(this.selectedNodeId);
        const isSticky = !node && Boolean(this.store.sticky(this.selectedNodeId));
        if (isSticky) {
          this.store.updateSticky(this.selectedNodeId, { text: newText });
        } else if (node) {
          this.store.updateNode(this.selectedNodeId, patch);
        }
        this.store.saveToDatabase?.();
        this.rebuildCardTextures();
        const updated = this.store.node(this.selectedNodeId) || this.store.sticky(this.selectedNodeId);
        if (updated) this.showNodeInfo(updated, isSticky);
        this.toast?.("✓ Saved note changes and synced typography to database!");
      }
    });

    overlay.querySelector("#tree3dEditBold")?.addEventListener("click", (e) => {
      e.currentTarget.classList.toggle("is-active");
    });
    overlay.querySelector("#tree3dEditItalic")?.addEventListener("click", (e) => {
      e.currentTarget.classList.toggle("is-active");
    });

    // Mouse Orbit & Dragging
    canvas.addEventListener("pointerdown", (e) => {
      this.isDragging = true;
      this.dragDistance = 0;
      this.prevMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener("pointermove", (e) => {
      if (!this.isActive) return;
      if (this.isDragging) {
        const dx = e.clientX - this.prevMouse.x;
        const dy = e.clientY - this.prevMouse.y;
        this.dragDistance += Math.hypot(dx, dy);

        if (e.buttons === 2 || e.shiftKey) {
          // Pan camera on right drag or Shift+drag
          const factor = this.distance * 0.001;
          this.target.x -= dx * factor * Math.cos(this.rotation.y);
          this.target.z += dx * factor * Math.sin(this.rotation.y);
          this.target.y += dy * factor;
        } else {
          // Smooth natural space movement on left drag: orbit + pan translation in sync with cursor
          this.rotation.y += dx * 0.005;
          this.rotation.x = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.rotation.x + dy * 0.005));
          const panFactor = this.distance * 0.0006;
          this.target.x -= dx * Math.cos(this.rotation.y) * panFactor;
          this.target.y += dy * panFactor;
          this.target.z -= dx * Math.sin(this.rotation.y) * panFactor;
        }
        this.prevMouse = { x: e.clientX, y: e.clientY };
        this.updateCameraPos();
        canvas.style.cursor = "grabbing";
      } else {
        // Cursor raycast
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.nodes3D);
        canvas.style.cursor = intersects.length ? "pointer" : "grab";
      }
    });

    window.addEventListener("pointerup", (e) => {
      if (!this.isActive) return;
      this.isDragging = false;
      canvas.style.cursor = "grab";
    });

    // Double-click on node card in 3D: enter direct edit mode immediately
    canvas.addEventListener("dblclick", (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.nodes3D);
      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        const item = clickedMesh.userData.item;
        if (item) {
          this.showNodeInfo(item, clickedMesh.userData.isSticky);
          this.focusNodeIn3D(clickedMesh);
          const editArea = overlay.querySelector("#tree3dInlineEditArea");
          const rawTextEl = overlay.querySelector("#tree3dInfoRawText");
          const editToggleBtn = overlay.querySelector("#tree3dEditToggleBtn");
          if (editArea) editArea.classList.remove("is-hidden");
          if (rawTextEl) rawTextEl.classList.add("is-hidden");
          if (editToggleBtn) editToggleBtn.textContent = "Preview";
          const editText = overlay.querySelector("#tree3dEditText");
          if (editText) {
            editText.value = item.text || "";
            editText.focus();
          }
          this.toast?.(`Directly editing “${item.prompt || "Card"}” in 3D space`);
        }
      }
    });

    // Click on node in 3D: Inspect node, show tags and 3-line info!
    canvas.addEventListener("click", (e) => {
      if (this.dragDistance > 6) return; // Ignore drag release
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.nodes3D);

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        const item = clickedMesh.userData.item;
        if (item) {
          this.showNodeInfo(item, clickedMesh.userData.isSticky);
          this.focusNodeIn3D(clickedMesh);
          this.toast?.(`Selected “${item.prompt || "Card"}” — Showing Tags & 3-Line Info`);
        }
      } else {
        // Clicked empty space: hide info panel
        this.hideNodeInfo();
      }
    });

    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.distance = Math.max(350, Math.min(3500, this.distance + e.deltaY * 0.9));
        this.updateCameraPos();
      },
      { passive: false }
    );

    window.addEventListener("keydown", (e) => {
      if (this.isActive && e.key === "Escape") {
        this.close3DMode();
      }
    });
  }

  close3DMode() {
    this.isActive = false;
    this.isBgActive = true;
    this.hideNodeInfo();
    this.isDragging = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    const view = document.querySelector("#tree3dOverlay");
    if (view) {
      view.classList.add("is-hidden");
      view.style.display = "none";
      view.style.pointerEvents = "none";
    }
    const header = document.querySelector("#appHeader");
    if (header) {
      header.style.pointerEvents = "auto";
    }
    document.body.style.pointerEvents = "auto";
  }
}
