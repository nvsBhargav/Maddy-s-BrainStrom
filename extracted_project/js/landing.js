// Maddy's BrainVault — Dedicated Full-Page Landing & Home Experience
// Powered by Three.js Particle Physics and Anime.js Kinetic Choreography

export class LandingPage {
  constructor({ ui, store, canvas, toast }) {
    this.ui = ui;
    this.store = store;
    this.canvas = canvas;
    this.toast = toast;
    this.isOpen = false;

    // Three.js Particle System handles
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particleMesh = null;
    this.lineMesh = null;
    this.particleData = [];
    this.numParticles = 700;
    this.animFrameId = null;
    this.clock = null;
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetMouseX = 0;
    this.targetMouseY = 0;

    // Anime.js handles
    this.pulseAnim = null;

    this.init();
  }

  init() {
    this.root = document.querySelector("#landingPage");
    if (!this.root) return;

    this.canvasEl = document.querySelector("#landingParticleCanvas");
    this.exploreForm = document.querySelector("#landingExploreForm");
    this.exploreInput = document.querySelector("#landingExploreInput");

    this.bindEvents();
    this.initThreeParticles();

    const hash = location.hash.replace(/^#/, "");
    if (hash === "/home" || hash === "home") {
      this.open();
    }
  }

  bindEvents() {
    // 1. Enter Workspace Buttons
    const enterWsButtons = [
      document.querySelector("#landingNavWsBtn"),
      document.querySelector("#landingEnterWsCta"),
    ].filter(Boolean);

    enterWsButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.enterWorkspace();
      });
    });

    // 2. 3D Knowledge Orbit Buttons
    const orbit3dButtons = [
      document.querySelector("#landingNav3dBtn"),
      document.querySelector("#landingOrbit3dCta"),
    ].filter(Boolean);

    orbit3dButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.close();
        if (window.tree3d) window.tree3d.open();
        else if (this.ui?.tree3d) this.ui.tree3d.open();
      });
    });

    // 3. Threat Center Buttons
    const threatButtons = [
      document.querySelector("#landingNavThreatBtn"),
      document.querySelector("#landingThreatCta"),
    ].filter(Boolean);

    threatButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.close();
        this.ui.openAdminDashboard("threats");
      });
    });

    // 3b. 2020-2026 Vulnerability & Malware Trends Button
    const trendsBtn = document.querySelector("#landingTrendsCta");
    if (trendsBtn) {
      trendsBtn.addEventListener("click", () => {
        this.close();
        this.ui.openAdminDashboard("trends");
      });
    }

    // 4. Quick Note and Sticky Buttons
    const newNoteBtn = document.querySelector("#landingNewNoteCta");
    if (newNoteBtn) {
      newNoteBtn.addEventListener("click", () => {
        this.enterWorkspace();
        setTimeout(() => this.ui.addCustomNote(), 150);
      });
    }

    const newStickyBtn = document.querySelector("#landingNewStickyCta");
    if (newStickyBtn) {
      newStickyBtn.addEventListener("click", () => {
        this.enterWorkspace();
        setTimeout(() => this.ui.addSticky(), 150);
      });
    }

    // 5. Explore Search Form
    if (this.exploreForm) {
      this.exploreForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const topic = this.exploreInput?.value.trim();
        if (topic) {
          this.exploreTopic(topic);
        } else if (this.exploreInput) {
          this.exploreInput.focus();
        }
      });
    }

    // 6. Dice Random Exploration Button
    const diceBtn = document.querySelector("#landingDiceBtn");
    if (diceBtn) {
      diceBtn.addEventListener("click", () => {
        const TOPIC_POOL = [
          "Cyber Threat Intelligence",
          "Zero Trust Architecture",
          "Post-Quantum Cryptography",
          "Ransomware Economics",
          "Autonomous AI Agents",
          "Cloud Security Posture",
          "Memory Safety & Rust",
          "API Gateway Hardening",
          "Software Supply Chain Attacks",
        ];
        const randomTopic = TOPIC_POOL[Math.floor(Math.random() * TOPIC_POOL.length)];
        if (this.exploreInput) this.exploreInput.value = randomTopic;
        this.exploreTopic(randomTopic);
      });
    }

    // 7. Topic Chips
    this.root.querySelectorAll("[data-topic]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const topic = chip.dataset.topic;
        if (topic) this.exploreTopic(topic);
      });
    });

    // 8. Feature Highlight Cards Click
    this.root.querySelectorAll(".landing-feature-card[data-action]").forEach((card) => {
      card.addEventListener("click", () => {
        const action = card.dataset.action;
        if (action === "workspace") {
          this.enterWorkspace();
        } else if (action === "3d") {
          this.close();
          if (window.tree3d) window.tree3d.open();
          else if (this.ui?.tree3d) this.ui.tree3d.open();
        } else if (action === "threats") {
          this.close();
          this.ui.openAdminDashboard("threats");
        } else if (action === "dbsync") {
          this.enterWorkspace();
          setTimeout(() => this.ui.openDbSync(), 150);
        }
      });
    });

    // 9. Parallax Mouse Listener
    window.addEventListener("mousemove", (e) => {
      if (!this.isOpen) return;
      this.targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this.targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    // 10. Window Resize Listener
    window.addEventListener("resize", () => {
      if (this.renderer && this.camera && this.canvasEl) {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      }
    });

    // 11. Escape key returns to canvas
    window.addEventListener("keydown", (e) => {
      if (this.isOpen && e.key === "Escape") {
        this.enterWorkspace();
      }
    });
  }

  // --- Three.js Particle Constellation Engine --------------------------------
  initThreeParticles() {
    const THREE = window.THREE;
    if (!THREE || !this.canvasEl) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x030307, 0.00085);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 1, 3500);
    this.camera.position.z = 950;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvasEl,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Particle Point Cloud
    const particlePositions = new Float32Array(this.numParticles * 3);
    const particleColors = new Float32Array(this.numParticles * 3);
    this.particleData = [];

    const palette = [
      new THREE.Color(0x00f0ff), // Cosmic Cyan
      new THREE.Color(0x10b981), // Emerald Neon
      new THREE.Color(0xa855f7), // Galaxy Violet
      new THREE.Color(0xf59e0b), // Amber Phosphor
      new THREE.Color(0x38bdf8), // Electric Sky
    ];

    const r = 1100;
    const rHalf = r / 2;

    for (let i = 0; i < this.numParticles; i++) {
      const x = Math.random() * r - rHalf;
      const y = Math.random() * r - rHalf;
      const z = Math.random() * r - rHalf;

      particlePositions[i * 3] = x;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = z;

      const col = palette[Math.floor(Math.random() * palette.length)];
      particleColors[i * 3] = col.r;
      particleColors[i * 3 + 1] = col.g;
      particleColors[i * 3 + 2] = col.b;

      this.particleData.push({
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.85,
          (Math.random() - 0.5) * 0.85,
          (Math.random() - 0.5) * 0.85
        ),
        numConnections: 0,
        baseY: y,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.DynamicDrawUsage));
    pointGeo.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));

    // Generate circular glow point texture dynamically
    const pCanvas = document.createElement("canvas");
    pCanvas.width = 64;
    pCanvas.height = 64;
    const pCtx = pCanvas.getContext("2d");
    const pGrad = pCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    pGrad.addColorStop(0, "rgba(255, 255, 255, 1)");
    pGrad.addColorStop(0.2, "rgba(34, 211, 238, 0.9)");
    pGrad.addColorStop(0.6, "rgba(56, 189, 248, 0.25)");
    pGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    pCtx.fillStyle = pGrad;
    pCtx.fillRect(0, 0, 64, 64);
    const pTexture = new THREE.CanvasTexture(pCanvas);

    const pointMat = new THREE.PointsMaterial({
      size: 16,
      map: pTexture,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.92,
    });

    this.particleMesh = new THREE.Points(pointGeo, pointMat);
    this.scene.add(this.particleMesh);

    // Dynamic Filaments Constellation Line Mesh
    const maxLineSegments = this.numParticles * 12;
    const linePositions = new Float32Array(maxLineSegments * 3);
    const lineColors = new Float32Array(maxLineSegments * 3);

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
    lineGeo.setAttribute("color", new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage));

    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    });

    this.lineMesh = new THREE.LineSegments(lineGeo, lineMat);
    this.scene.add(this.lineMesh);

    // Ambient floating geometric holographic nodes in background
    const polyGeo1 = new THREE.IcosahedronGeometry(70, 1);
    const polyMat1 = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    this.bgPoly1 = new THREE.Mesh(polyGeo1, polyMat1);
    this.bgPoly1.position.set(-420, 180, -250);
    this.scene.add(this.bgPoly1);

    const polyGeo2 = new THREE.DodecahedronGeometry(85, 1);
    const polyMat2 = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      wireframe: true,
      transparent: true,
      opacity: 0.14,
    });
    this.bgPoly2 = new THREE.Mesh(polyGeo2, polyMat2);
    this.bgPoly2.position.set(460, -140, -300);
    this.scene.add(this.bgPoly2);
  }

  animateParticles() {
    if (!this.isOpen) return;

    const THREE = window.THREE;
    const time = this.clock ? this.clock.getElapsedTime() : Date.now() * 0.001;

    // Smooth lerp mouse parallax
    this.mouseX += (this.targetMouseX - this.mouseX) * 0.05;
    this.mouseY += (this.targetMouseY - this.mouseY) * 0.05;

    if (this.camera) {
      this.camera.position.x = this.mouseX * 160;
      this.camera.position.y = this.mouseY * 120;
      this.camera.lookAt(this.scene.position);
    }

    if (this.bgPoly1) {
      this.bgPoly1.rotation.x += 0.004;
      this.bgPoly1.rotation.y += 0.006;
      this.bgPoly1.position.y = 180 + Math.sin(time * 0.8) * 20;
    }
    if (this.bgPoly2) {
      this.bgPoly2.rotation.x -= 0.003;
      this.bgPoly2.rotation.y -= 0.005;
      this.bgPoly2.position.y = -140 + Math.cos(time * 0.7) * 25;
    }

    const posAttr = this.particleMesh?.geometry.attributes.position;
    if (posAttr && this.lineMesh) {
      const positions = posAttr.array;
      const linePos = this.lineMesh.geometry.attributes.position.array;
      const lineCol = this.lineMesh.geometry.attributes.color.array;

      let vertexPosIndex = 0;
      let colorPosIndex = 0;
      let numConnectedLines = 0;

      const r = 1100;
      const rHalf = r / 2;
      const connectDist = 95;

      for (let i = 0; i < this.numParticles; i++) {
        const pData = this.particleData[i];

        // Kinetic physics velocity step
        positions[i * 3] += pData.velocity.x;
        positions[i * 3 + 1] += pData.velocity.y + Math.sin(time * 1.5 + pData.phase) * 0.35;
        positions[i * 3 + 2] += pData.velocity.z;

        // Boundary reflection
        if (positions[i * 3] < -rHalf || positions[i * 3] > rHalf) pData.velocity.x = -pData.velocity.x;
        if (positions[i * 3 + 1] < -rHalf || positions[i * 3 + 1] > rHalf) pData.velocity.y = -pData.velocity.y;
        if (positions[i * 3 + 2] < -rHalf || positions[i * 3 + 2] > rHalf) pData.velocity.z = -pData.velocity.z;

        // Constellation filaments connection calculation
        for (let j = i + 1; j < this.numParticles; j++) {
          const dx = positions[i * 3] - positions[j * 3];
          const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
          const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < connectDist && numConnectedLines < 1800) {
            const alpha = 1.0 - dist / connectDist;

            linePos[vertexPosIndex++] = positions[i * 3];
            linePos[vertexPosIndex++] = positions[i * 3 + 1];
            linePos[vertexPosIndex++] = positions[i * 3 + 2];

            linePos[vertexPosIndex++] = positions[j * 3];
            linePos[vertexPosIndex++] = positions[j * 3 + 1];
            linePos[vertexPosIndex++] = positions[j * 3 + 2];

            // Cyan-emerald cyber gradient on filaments
            lineCol[colorPosIndex++] = 0.05 * alpha;
            lineCol[colorPosIndex++] = 0.85 * alpha;
            lineCol[colorPosIndex++] = 0.95 * alpha;

            lineCol[colorPosIndex++] = 0.1 * alpha;
            lineCol[colorPosIndex++] = 0.95 * alpha;
            lineCol[colorPosIndex++] = 0.65 * alpha;

            numConnectedLines++;
          }
        }
      }

      posAttr.needsUpdate = true;

      this.lineMesh.geometry.setDrawRange(0, numConnectedLines * 2);
      this.lineMesh.geometry.attributes.position.needsUpdate = true;
      this.lineMesh.geometry.attributes.color.needsUpdate = true;
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }

    this.animFrameId = requestAnimationFrame(() => this.animateParticles());
  }

  // --- Anime.js Visual Choreography & Micro-Interactions ----------------------
  triggerAnimeEntrance() {
    const anime = window.anime;
    if (!anime) return;

    // Reset initial element states for clean animation if supported
    if (typeof anime.remove === "function") {
      anime.remove([
        ".landing-brain-aura",
        ".landing-kicker",
        ".landing-hero-title",
        ".landing-tagline",
        ".landing-hero-copy",
        "#landingExploreForm",
        ".landing-topic-chip",
        ".landing-cta-btn",
        ".landing-feature-card",
      ]);
    }

    // 1. Brain Icon Elastic Entrance
    anime({
      targets: ".landing-brain-aura",
      scale: [0.65, 1],
      opacity: [0, 1],
      duration: 1100,
      easing: "easeOutElastic(1, .6)",
    });

    // 2. Continuous breathing aura loop
    if (this.pulseAnim) this.pulseAnim.pause();
    this.pulseAnim = anime({
      targets: ".landing-brain-glow",
      scale: [1, 1.25],
      opacity: [0.45, 0.9],
      duration: 2200,
      direction: "alternate",
      loop: true,
      easing: "easeInOutSine",
    });

    // 3. Staggered text & header reveal
    anime({
      targets: ".landing-kicker",
      translateY: [25, 0],
      opacity: [0, 1],
      duration: 650,
      delay: 100,
      easing: "easeOutCubic",
    });

    anime({
      targets: ".landing-hero-title",
      translateY: [40, 0],
      opacity: [0, 1],
      duration: 850,
      delay: 180,
      easing: "easeOutCubic",
    });

    anime({
      targets: ".landing-tagline",
      translateY: [25, 0],
      opacity: [0, 1],
      duration: 700,
      delay: 260,
      easing: "easeOutCubic",
    });

    anime({
      targets: ".landing-hero-copy",
      translateY: [25, 0],
      opacity: [0, 1],
      duration: 750,
      delay: 340,
      easing: "easeOutCubic",
    });

    // 4. Explore Search Form
    anime({
      targets: "#landingExploreForm",
      scale: [0.93, 1],
      translateY: [30, 0],
      opacity: [0, 1],
      duration: 800,
      delay: 420,
      easing: "easeOutCubic",
    });

    // 5. Topic Pills Stagger
    anime({
      targets: ".landing-topic-chip",
      scale: [0.82, 1],
      opacity: [0, 1],
      delay: anime.stagger(45, { start: 500 }),
      duration: 600,
      easing: "easeOutBack",
    });

    // 6. Action Buttons Stagger
    anime({
      targets: ".landing-cta-btn",
      translateY: [25, 0],
      opacity: [0, 1],
      delay: anime.stagger(55, { start: 620 }),
      duration: 650,
      easing: "easeOutCubic",
    });

    // 7. Feature Cards Stagger
    anime({
      targets: ".landing-feature-card",
      translateY: [40, 0],
      opacity: [0, 1],
      delay: anime.stagger(80, { start: 740 }),
      duration: 750,
      easing: "easeOutCubic",
    });
  }

  // --- Page Transitions & Navigation Handlers -------------------------------
  open() {
    this.isOpen = true;
    if (this.root) {
      this.root.classList.remove("is-hidden");
      this.root.scrollTop = 0;
    }

    // Update active workspace name on landing nav if element exists
    const activeWs = this.store.activeWorkspace();
    const wsLabel = this.root?.querySelector("#landingActiveWsLabel");
    if (wsLabel) wsLabel.textContent = activeWs?.name || "Main Workspace";

    // Start 3D particle rendering loop
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animateParticles();

    // Trigger Anime.js kinetic choreography
    this.triggerAnimeEntrance();

    // Focus exploration input gently
    setTimeout(() => {
      if (this.isOpen && this.exploreInput) {
        this.exploreInput.focus();
      }
    }, 450);
  }

  close() {
    this.isOpen = false;
    if (this.root) {
      this.root.classList.add("is-hidden");
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.pulseAnim) {
      this.pulseAnim.pause();
    }
  }

  enterWorkspace() {
    this.close();
    const activeWs = this.store.activeWorkspace();
    const targetWsId = activeWs?.id || this.store.state.activeWorkspaceId || "main";
    location.hash = `/w/${targetWsId}`;
    this.canvas.render();
    this.toast?.(`Entered “${activeWs?.name || "Workspace"}” Canvas`);
  }

  exploreTopic(topic) {
    this.close();
    const activeWs = this.store.activeWorkspace();
    location.hash = `/w/${activeWs?.id || "main"}`;
    this.ui.explore(topic);
    this.toast?.(`Exploring “${topic}” in Workspace…`);
  }
}
