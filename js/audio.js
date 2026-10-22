// BrainVault Interactive Audio / Speech AI Briefings (TTS Audio Player)
// Pure zero-dependency client-side implementation using standard Web Speech API (window.speechSynthesis).
// Ultra-lightweight, 0KB extra bundle size, works 100% offline with zero network latency.

export const VOICE_PERSONAS = {
  cute: {
    id: "cute",
    name: "🌸 Smooth & Cute",
    label: "Cute & Sweet",
    pitch: 1.26,
    rate: 1.04,
    description: "Sweet, gentle, warm feminine tone with melodious inflection.",
    previewText: "Hi there! I'm your smooth and cute BrainVault voice assistant. Let me read your notes and research for you! 💕",
  },
  kawaii: {
    id: "kawaii",
    name: "🎀 Kawaii Anime",
    label: "Kawaii AI",
    pitch: 1.38,
    rate: 1.08,
    description: "Playful, bright, cheerful high-pitch voice inspired by anime companions.",
    previewText: "Yay! Kawaii voice mode activated! Let's explore your cyber workspace together! ✨",
  },
  asmr: {
    id: "asmr",
    name: "☁️ Soft & Smooth ASMR",
    label: "Soft ASMR",
    pitch: 1.06,
    rate: 0.94,
    description: "Calm, soothing, velvety soft tone for focused and relaxed studying.",
    previewText: "Take a deep breath. Let's explore your knowledge workspace calmly and smoothly.",
  },
  natural: {
    id: "natural",
    name: "✨ Natural AI",
    label: "Natural AI",
    pitch: 1.14,
    rate: 1.02,
    description: "Modern, polished, expressive synthetic voice with crystal clarity.",
    previewText: "Welcome to BrainVault. Streaming executive intelligence brief with crystal clarity.",
  },
  host: {
    id: "host",
    name: "🎙️ Studio Host",
    label: "Studio Host",
    pitch: 1.00,
    rate: 1.00,
    description: "Neutral, balanced professional briefing tone.",
    previewText: "BrainVault executive summary ready. Initializing briefing playback.",
  },
};

export class AudioBriefingPlayer {
  constructor({ toast } = {}) {
    this.toast = toast;
    this.synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    this.utterance = null;
    this.isPlaying = false;
    this.isPaused = false;
    this.currentText = "";
    this.currentTitle = "";
    this.currentSource = "";

    // Load saved preferences or default to Smooth & Cute
    const savedPersona = localStorage.getItem("brainvault_voice_persona");
    this.currentPersona = (savedPersona && VOICE_PERSONAS[savedPersona]) ? savedPersona : "cute";
    
    const personaDefaults = VOICE_PERSONAS[this.currentPersona] || VOICE_PERSONAS.cute;
    this.currentPitch = parseFloat(localStorage.getItem("brainvault_voice_pitch") || String(personaDefaults.pitch));
    this.currentSpeed = parseFloat(localStorage.getItem("brainvault_voice_speed") || String(personaDefaults.rate));
    this.savedVoiceURI = localStorage.getItem("brainvault_voice_uri") || "";

    this.selectedVoice = null;
    this.voices = [];
    this.timer = null;
    this.elapsedSeconds = 0;
    this.estimatedSeconds = 0;
    this.currentCharIndex = 0;
    this.isMinimized = false;
    this.isDrawerOpen = false;

    this.initDOM();
    this.initVoices();
  }

  initDOM() {
    this.hud = document.querySelector("#audioBriefingPlayer");
    if (!this.hud) return;

    this.titleEl = this.hud.querySelector("#audioHudTitle");
    this.sourceEl = this.hud.querySelector("#audioHudSource");
    this.playPauseBtn = this.hud.querySelector("#audioPlayPauseBtn");
    this.playIcon = this.hud.querySelector("#audioPlayIcon");
    this.stopBtn = this.hud.querySelector("#audioStopBtn");
    this.timeElapsedEl = this.hud.querySelector("#audioHudTimeElapsed");
    this.timeTotalEl = this.hud.querySelector("#audioHudTimeTotal");
    this.progressBar = this.hud.querySelector("#audioProgressBar");
    this.progressTrack = this.hud.querySelector("#audioProgressTrack");
    this.visualizer = this.hud.querySelector("#audioVisualizer");

    // Persona bar & voice selection
    this.personaBar = this.hud.querySelector("#audioPersonaBar");
    this.voiceSelect = this.hud.querySelector("#audioVoiceSelect");
    this.previewBtn = this.hud.querySelector("#audioVoicePreviewBtn");
    this.settingsBtn = this.hud.querySelector("#audioVoiceSettingsBtn");
    this.drawer = this.hud.querySelector("#audioVoiceDrawer");
    this.pitchRange = this.hud.querySelector("#audioPitchRange");
    this.pitchValEl = this.hud.querySelector("#audioPitchVal");
    this.rateRange = this.hud.querySelector("#audioRateRange");
    this.rateValEl = this.hud.querySelector("#audioRateVal");
    this.drawerVoiceTag = this.hud.querySelector("#drawerVoiceTag");

    this.minimizeBtn = this.hud.querySelector("#audioHudMinimizeBtn");
    this.closeBtn = this.hud.querySelector("#audioHudCloseBtn");

    // Events
    this.playPauseBtn?.addEventListener("click", () => this.togglePlayPause());
    this.stopBtn?.addEventListener("click", () => this.stop());
    this.minimizeBtn?.addEventListener("click", () => this.toggleMinimize());
    this.closeBtn?.addEventListener("click", () => this.close());

    // Speed pills
    this.hud.querySelectorAll(".speed-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        const speed = parseFloat(pill.dataset.speed || "1");
        this.setSpeed(speed);
      });
    });

    // Persona chip clicks
    this.personaBar?.addEventListener("click", (e) => {
      const chip = e.target.closest(".audio-persona-chip");
      if (!chip) return;
      const key = chip.dataset.persona;
      if (key && VOICE_PERSONAS[key]) {
        this.setPersona(key);
      }
    });

    // Voice dropdown selection
    this.voiceSelect?.addEventListener("change", (e) => {
      const uri = e.target.value;
      const found = this.voices.find((v) => (v.voiceURI || v.name) === uri);
      if (found) {
        this.selectedVoice = found;
        this.savedVoiceURI = found.voiceURI || found.name;
        localStorage.setItem("brainvault_voice_uri", this.savedVoiceURI);
        this.updateDrawerTag();
        this.toast?.(`Voice selected: ${found.name.slice(0, 26)}`);
        if (this.isPlaying) {
          this.restartFromCurrentPosition();
        }
      }
    });

    // Preview button
    this.previewBtn?.addEventListener("click", () => {
      this.previewVoice();
    });

    // Settings drawer toggle
    this.settingsBtn?.addEventListener("click", () => {
      this.toggleDrawer();
    });

    // Pitch range slider
    this.pitchRange?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      this.currentPitch = val;
      if (this.pitchValEl) this.pitchValEl.textContent = `${val.toFixed(2)}x`;
      localStorage.setItem("brainvault_voice_pitch", String(val));
      if (this.isPlaying) this.restartFromCurrentPosition();
    });

    // Rate range slider
    this.rateRange?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      this.currentSpeed = val;
      if (this.rateValEl) this.rateValEl.textContent = `${val.toFixed(2)}x`;
      localStorage.setItem("brainvault_voice_speed", String(val));
      this.syncSpeedPills();
      if (this.isPlaying) this.restartFromCurrentPosition();
    });

    // Track click for scrubbing / skipping
    this.progressTrack?.addEventListener("click", (e) => {
      if (!this.currentText || !this.isPlaying) return;
      const rect = this.progressTrack.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.seekToFraction(pct);
    });

    // Initial slider values
    if (this.pitchRange) this.pitchRange.value = this.currentPitch;
    if (this.pitchValEl) this.pitchValEl.textContent = `${this.currentPitch.toFixed(2)}x`;
    if (this.rateRange) this.rateRange.value = this.currentSpeed;
    if (this.rateValEl) this.rateValEl.textContent = `${this.currentSpeed.toFixed(2)}x`;
    this.syncPersonaUI();
  }

  isCuteVoice(voice) {
    if (!voice) return false;
    const name = (voice.name || "").toLowerCase();
    // Keywords indicating smooth, sweet, gentle feminine or natural high quality voices
    return /jenny|aria|ana|michelle|steffan|google.*female|google.*us|samantha|victoria|zira|karen|moira|fiona|tessa|veena|cute|sweet/i.test(name);
  }

  isNaturalVoice(voice) {
    if (!voice) return false;
    const name = (voice.name || "").toLowerCase();
    return /natural|enhanced|google|siri|neural|online/i.test(name);
  }

  initVoices() {
    if (!this.synth) return;

    const populate = () => {
      const list = this.synth.getVoices() || [];
      if (!list.length) return;
      this.voices = list;

      if (this.voiceSelect) {
        this.voiceSelect.innerHTML = "";

        // Categorize voices
        const cuteVoices = list.filter((v) => this.isCuteVoice(v));
        const naturalVoices = list.filter((v) => !this.isCuteVoice(v) && this.isNaturalVoice(v));
        const otherVoices = list.filter((v) => !this.isCuteVoice(v) && !this.isNaturalVoice(v));

        const createOptGroup = (label, items) => {
          if (!items.length) return;
          const group = document.createElement("optgroup");
          group.label = label;
          items.forEach((v) => {
            const opt = document.createElement("option");
            opt.value = v.voiceURI || v.name;
            const isCute = this.isCuteVoice(v);
            const isNat = this.isNaturalVoice(v);
            const badge = isCute ? "🌸 " : isNat ? "✨ " : "";
            opt.textContent = `${badge}${v.name.slice(0, 24)} (${v.lang})`;
            group.appendChild(opt);
          });
          this.voiceSelect.appendChild(group);
        };

        createOptGroup("🌸 Smooth & Cute Voices (Recommended)", cuteVoices);
        createOptGroup("✨ Natural AI Voices", naturalVoices);
        createOptGroup("🌐 All System Voices", otherVoices);

        // Pick preferred voice:
        // 1. If savedVoiceURI matches
        let matched = this.savedVoiceURI ? list.find((v) => (v.voiceURI || v.name) === this.savedVoiceURI) : null;

        // 2. Otherwise default to best Cute & Smooth voice
        if (!matched && cuteVoices.length) {
          // Prefer Jenny or Google Female or English cute voice
          matched = cuteVoices.find((v) => /jenny/i.test(v.name)) ||
                    cuteVoices.find((v) => /google/i.test(v.name)) ||
                    cuteVoices.find((v) => (v.lang || "").startsWith("en")) ||
                    cuteVoices[0];
        }

        // 3. Fallback to natural voice or first available
        if (!matched) {
          matched = naturalVoices[0] || list.find((v) => (v.lang || "").startsWith("en")) || list[0];
        }

        if (matched) {
          this.selectedVoice = matched;
          this.voiceSelect.value = matched.voiceURI || matched.name;
          this.updateDrawerTag();
        }
      }
    };

    populate();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = populate;
    }
  }

  setPersona(key) {
    const p = VOICE_PERSONAS[key];
    if (!p) return;

    this.currentPersona = key;
    this.currentPitch = p.pitch;
    this.currentSpeed = p.rate;

    localStorage.setItem("brainvault_voice_persona", key);
    localStorage.setItem("brainvault_voice_pitch", String(p.pitch));
    localStorage.setItem("brainvault_voice_speed", String(p.rate));

    // Update UI controls
    this.syncPersonaUI();
    if (this.pitchRange) this.pitchRange.value = this.currentPitch;
    if (this.pitchValEl) this.pitchValEl.textContent = `${this.currentPitch.toFixed(2)}x`;
    if (this.rateRange) this.rateRange.value = this.currentSpeed;
    if (this.rateValEl) this.rateValEl.textContent = `${this.currentSpeed.toFixed(2)}x`;
    this.syncSpeedPills();

    // If switching to cute or kawaii, auto-select a cute voice if not already on one
    if ((key === "cute" || key === "kawaii") && this.selectedVoice && !this.isCuteVoice(this.selectedVoice)) {
      const cuteOne = this.voices.find((v) => this.isCuteVoice(v));
      if (cuteOne) {
        this.selectedVoice = cuteOne;
        this.savedVoiceURI = cuteOne.voiceURI || cuteOne.name;
        localStorage.setItem("brainvault_voice_uri", this.savedVoiceURI);
        if (this.voiceSelect) this.voiceSelect.value = this.savedVoiceURI;
      }
    }

    this.updateDrawerTag();
    this.toast?.(`Voice preset applied: ${p.name}`);

    if (this.isPlaying) {
      this.restartFromCurrentPosition();
    }
  }

  syncPersonaUI() {
    if (!this.personaBar) return;
    this.personaBar.querySelectorAll(".audio-persona-chip").forEach((chip) => {
      chip.classList.toggle("is-active", chip.dataset.persona === this.currentPersona);
    });
  }

  syncSpeedPills() {
    if (!this.hud) return;
    this.hud.querySelectorAll(".speed-pill").forEach((pill) => {
      const sp = parseFloat(pill.dataset.speed || "1");
      pill.classList.toggle("is-active", Math.abs(sp - this.currentSpeed) < 0.08);
    });
  }

  updateDrawerTag() {
    if (!this.drawerVoiceTag) return;
    const persona = VOICE_PERSONAS[this.currentPersona]?.name || "Voice Active";
    const voiceName = this.selectedVoice ? this.selectedVoice.name.slice(0, 18) : "Default";
    this.drawerVoiceTag.textContent = `${persona} · ${voiceName}`;
  }

  toggleDrawer() {
    if (!this.drawer) return;
    this.isDrawerOpen = !this.isDrawerOpen;
    this.drawer.classList.toggle("is-hidden", !this.isDrawerOpen);
    if (this.settingsBtn) {
      this.settingsBtn.classList.toggle("is-active", this.isDrawerOpen);
    }
  }

  previewVoice() {
    if (!this.synth) {
      this.toast?.("Speech synthesis not supported in this browser.");
      return;
    }

    const persona = VOICE_PERSONAS[this.currentPersona] || VOICE_PERSONAS.cute;
    const phrase = persona.previewText;

    this.stop(false);
    this.toast?.(`Previewing: ${persona.name}... 💕`);

    if (this.hud) {
      this.hud.classList.remove("is-hidden");
      if (this.titleEl) this.titleEl.textContent = `Preview: ${persona.name}`;
      if (this.sourceEl) this.sourceEl.textContent = this.selectedVoice?.name || "BrainVault Voice Synthesizer";
    }

    this.currentText = phrase;
    this.currentCharIndex = 0;
    this.estimatedSeconds = 4;
    this.speakUtterance(phrase);
  }

  formatTime(totalSec) {
    if (!totalSec || isNaN(totalSec) || totalSec < 0) return "00:00";
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  cleanSpeechText(raw) {
    if (!raw) return "";
    return String(raw)
      .replace(/```[\s\S]*?```/g, "Code block omitted.") // Remove big code snippets
      .replace(/`([^`]+)`/g, "$1") // inline code
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1") // markdown links
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "") // images
      .replace(/#{1,6}\s+/g, "") // headers
      .replace(/[*_~>]/g, "") // bold/italic/quotes
      .replace(/\bhttps?:\/\/\S+/gi, "link") // raw urls
      .replace(/\|\s*[-:]+\s*\|/g, " ") // table separators
      .replace(/\|/g, ", ") // table pipes
      .replace(/\s+/g, " ")
      .trim();
  }

  play({ title = "Audio Briefing", text = "", source = "BrainVault AI Synthesizer" } = {}) {
    if (!this.synth) {
      this.toast?.("Speech Synthesis is not supported in this browser environment.");
      return;
    }

    const clean = this.cleanSpeechText(text);
    if (!clean) {
      this.toast?.("No spoken text available for briefing.");
      return;
    }

    this.stop(false);

    this.currentText = clean;
    this.currentTitle = title;
    this.currentSource = source;
    this.currentCharIndex = 0;
    this.elapsedSeconds = 0;

    // Estimate speaking duration: avg 150 words per minute at 1.0x
    const words = clean.split(/\s+/).length;
    this.estimatedSeconds = Math.max(3, Math.round((words / (150 * this.currentSpeed)) * 60));

    // Show HUD
    if (this.hud) {
      this.hud.classList.remove("is-hidden");
      this.hud.classList.remove("is-minimized");
      if (this.titleEl) this.titleEl.textContent = title;
      if (this.sourceEl) this.sourceEl.textContent = source;
      if (this.timeElapsedEl) this.timeElapsedEl.textContent = "00:00";
      if (this.timeTotalEl) this.timeTotalEl.textContent = this.formatTime(this.estimatedSeconds);
      if (this.progressBar) this.progressBar.style.width = "0%";
    }

    this.speakUtterance(clean);
  }

  speakUtterance(textToSpeak, startCharOffset = 0) {
    if (!this.synth) return;
    this.synth.cancel();

    const utter = new SpeechSynthesisUtterance(textToSpeak);
    this.utterance = utter;

    if (this.selectedVoice) utter.voice = this.selectedVoice;
    utter.rate = this.currentSpeed;
    utter.pitch = this.currentPitch;

    utter.onstart = () => {
      this.isPlaying = true;
      this.isPaused = false;
      this.updateControlsState();
      this.startTimer();
      this.setVisualizerActive(true);
    };

    utter.onboundary = (event) => {
      if (event.name === "word" || event.charIndex !== undefined) {
        this.currentCharIndex = startCharOffset + event.charIndex;
        const total = this.currentText.length || 1;
        const pct = Math.min(100, Math.max(0, (this.currentCharIndex / total) * 100));
        if (this.progressBar) this.progressBar.style.width = `${pct}%`;
      }
    };

    utter.onpause = () => {
      this.isPaused = true;
      this.updateControlsState();
      this.setVisualizerActive(false);
      this.stopTimer();
    };

    utter.onresume = () => {
      this.isPaused = false;
      this.updateControlsState();
      this.setVisualizerActive(true);
      this.startTimer();
    };

    utter.onend = () => {
      this.isPlaying = false;
      this.isPaused = false;
      this.updateControlsState();
      this.setVisualizerActive(false);
      this.stopTimer();
      if (this.progressBar) this.progressBar.style.width = "100%";
      if (this.timeElapsedEl) this.timeElapsedEl.textContent = this.formatTime(this.estimatedSeconds);
    };

    utter.onerror = (e) => {
      if (e.error !== "canceled" && e.error !== "interrupted") {
        console.warn("Speech synthesis notice:", e.error);
      }
      this.isPlaying = false;
      this.isPaused = false;
      this.updateControlsState();
      this.setVisualizerActive(false);
      this.stopTimer();
    };

    try {
      this.synth.speak(utter);
    } catch (err) {
      console.error("Audio playback error:", err);
    }
  }

  togglePlayPause() {
    if (!this.synth) return;
    if (!this.isPlaying && this.currentText) {
      this.play({ title: this.currentTitle, text: this.currentText, source: this.currentSource });
      return;
    }
    if (this.synth.speaking) {
      if (this.synth.paused) {
        this.synth.resume();
        this.isPaused = false;
      } else {
        this.synth.pause();
        this.isPaused = true;
      }
      this.updateControlsState();
      this.setVisualizerActive(!this.isPaused);
    }
  }

  stop(hideHud = true) {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (_) {}
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.stopTimer();
    this.setVisualizerActive(false);
    this.updateControlsState();
    if (this.progressBar) this.progressBar.style.width = "0%";
    if (hideHud && this.hud) {
      this.hud.classList.add("is-hidden");
    }
  }

  close() {
    this.stop(true);
  }

  toggleMinimize() {
    if (!this.hud) return;
    this.isMinimized = !this.isMinimized;
    this.hud.classList.toggle("is-minimized", this.isMinimized);
    if (this.minimizeBtn) {
      this.minimizeBtn.textContent = this.isMinimized ? "□" : "_";
    }
  }

  setSpeed(speed) {
    this.currentSpeed = speed;
    localStorage.setItem("brainvault_voice_speed", String(speed));
    if (this.rateRange) this.rateRange.value = speed;
    if (this.rateValEl) this.rateValEl.textContent = `${speed.toFixed(2)}x`;
    this.syncSpeedPills();
    if (this.isPlaying) {
      this.restartFromCurrentPosition();
    }
  }

  seekToFraction(fraction) {
    if (!this.currentText) return;
    const targetChar = Math.floor(fraction * this.currentText.length);
    this.currentCharIndex = targetChar;
    this.elapsedSeconds = Math.floor(fraction * this.estimatedSeconds);
    if (this.timeElapsedEl) this.timeElapsedEl.textContent = this.formatTime(this.elapsedSeconds);
    if (this.progressBar) this.progressBar.style.width = `${fraction * 100}%`;
    this.restartFromCurrentPosition();
  }

  restartFromCurrentPosition() {
    if (!this.currentText || !this.synth) return;
    const remaining = this.currentText.slice(this.currentCharIndex);
    this.speakUtterance(remaining, this.currentCharIndex);
  }

  startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => {
      this.elapsedSeconds += 1;
      if (this.timeElapsedEl) this.timeElapsedEl.textContent = this.formatTime(this.elapsedSeconds);
    }, 1000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setVisualizerActive(active) {
    if (!this.visualizer) return;
    this.visualizer.classList.toggle("is-active", active);
  }

  updateControlsState() {
    if (this.playIcon) {
      this.playIcon.textContent = this.isPlaying && !this.isPaused ? "⏸" : "▶";
    }
    if (this.playPauseBtn) {
      this.playPauseBtn.title = this.isPlaying && !this.isPaused ? "Pause Briefing" : "Play Briefing";
    }
  }

  // --- Specialized Briefing Generators ---------------------------------------

  playCard(node) {
    if (!node) return;
    const title = node.prompt || "Card Intelligence";
    const tags = (node.tags || []).join(", ");
    const intro = `Card Briefing: ${title}. ${tags ? `Categorized under: ${tags}.` : ""}`;
    const fullText = `${intro}\n\n${node.text || "No detailed notes recorded."}`;
    this.play({
      title: `Card: ${title.slice(0, 36)}`,
      text: fullText,
      source: "BrainVault Knowledge Node",
    });
    const persona = VOICE_PERSONAS[this.currentPersona]?.name || "Voice";
    this.toast?.(`🌸 Reading card with ${persona}: ${title.slice(0, 26)}...`);
  }

  playFeed(article) {
    if (!article) return;
    const title = article.title || "Intelligence Story";
    const lines = [
      `Cyber Intelligence Brief: ${title}.`,
      `Reported by ${article.author || "Security Analyst"} on ${article.sourceLabel || "Security Feed"}.`,
      article.excerpt || "",
      "Key briefing points:",
      ...(article.brief10Lines || [article.excerpt || ""]),
    ];
    this.play({
      title: `Brief: ${title.slice(0, 36)}`,
      text: lines.join(" \n"),
      source: article.sourceLabel || "Cyber Security Feed",
    });
    this.toast?.(`Playing 10-line audio briefing for: ${title.slice(0, 30)}...`);
  }

  playCve(cve) {
    if (!cve) return;
    const id = cve.cveId || "CVE Advisory";
    const sev = cve.severity || "CRITICAL";
    const score = cve.score || "9.8";
    const lines = [
      `Cyber Threat Advisory for ${id}.`,
      `Severity classification: ${sev}, with a CVSS score of ${score}.`,
      `Target Platform: ${cve.vendor || "Enterprise Infrastructure"}.`,
      `Attack Vector: ${cve.attackVector || "Network, unauthenticated exploitation"}.`,
      cve.briefing ? `Root flaw analysis: ${cve.briefing}.` : "",
      cve.cisaKev ? "Warning: Confirmed in CISA Known Exploited Vulnerabilities catalog." : "",
      cve.remediation ? `Mitigation playbook: ${cve.remediation}.` : "Immediate security patching recommended.",
    ];
    this.play({
      title: `${id} · ${sev}`,
      text: lines.filter(Boolean).join(" \n"),
      source: "NIST NVD & CISA KEV Intelligence",
    });
    this.toast?.(`Streaming audio briefing for ${id}...`);
  }

  playWorkspace(store) {
    if (!store) return;
    const ws = store.activeWorkspace();
    const nodes = store.nodes();
    const stickies = store.stickies();

    if (!nodes.length) {
      this.toast?.("Add cards to this workspace first to hear an executive briefing.");
      return;
    }

    const lines = [
      `Executive Workspace Briefing for ${ws?.name || "BrainVault Research"}.`,
      `This workspace contains ${nodes.length} research card nodes and ${stickies.length} sticky memos.`,
      "Primary research concepts include:",
      ...nodes.slice(0, 8).map((n, i) => `Concept ${i + 1}: ${n.prompt}. ${(n.text || "").slice(0, 120)}.`),
      nodes.length > 8 ? `Plus ${nodes.length - 8} additional related sub-nodes.` : "",
      "End of executive audio briefing.",
    ];

    this.play({
      title: `Workspace: ${ws?.name || "BrainVault"}`,
      text: lines.join(" \n"),
      source: "BrainVault Workspace Synthesis",
    });
    this.toast?.(`Streaming executive workspace audio briefing...`);
  }

  // --- Voice Selection & Persona Modal --------------------------------------

  openVoiceSelectorModal() {
    const existing = document.querySelector(".voice-selector-modal-backdrop");
    if (existing) existing.remove();

    const backdrop = document.createElement("div");
    backdrop.className = "voice-selector-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "voice-selector-modal";

    const personaCardsHtml = Object.values(VOICE_PERSONAS).map((p) => `
      <div class="persona-option-card ${p.id === this.currentPersona ? "is-selected" : ""}" data-persona-id="${p.id}">
        <div class="persona-card-header">
          <span class="persona-card-name">${p.name}</span>
          <span class="persona-card-badge">${p.pitch}x pitch</span>
        </div>
        <div class="persona-card-desc">${p.description}</div>
        <button type="button" class="persona-card-test-btn" data-test-persona="${p.id}">
          ▶ Hear Sample
        </button>
      </div>
    `).join("");

    modal.innerHTML = `
      <div class="voice-modal-header">
        <div class="voice-modal-title-row">
          <span class="voice-modal-icon">🌸</span>
          <div>
            <h3 class="voice-modal-title">Audio Description Voice & Tone</h3>
            <span class="voice-modal-sub">Choose a smooth &amp; cute AI voice or customize pitch and cadence</span>
          </div>
        </div>
        <button class="voice-modal-close" title="Close">×</button>
      </div>

      <div class="voice-modal-body">
        <div class="voice-section-title">Select Voice Persona</div>
        <div class="persona-options-grid">
          ${personaCardsHtml}
        </div>

        <div class="voice-section-title" style="margin-top:16px;">Browser Voice Engine</div>
        <div class="voice-modal-select-row">
          <select class="voice-modal-dropdown" id="modalVoiceSelect"></select>
          <button type="button" class="voice-modal-preview-btn" id="modalVoicePreviewBtn">▶ Test Voice</button>
        </div>

        <div class="voice-modal-slider-box">
          <div class="voice-slider-item">
            <div class="slider-head">
              <span>Sweetness / Pitch</span>
              <strong id="modalPitchVal">${this.currentPitch.toFixed(2)}x</strong>
            </div>
            <input type="range" min="0.6" max="1.8" step="0.02" value="${this.currentPitch}" id="modalPitchRange" class="audio-slider" />
          </div>
          <div class="voice-slider-item">
            <div class="slider-head">
              <span>Cadence / Speed</span>
              <strong id="modalRateVal">${this.currentSpeed.toFixed(2)}x</strong>
            </div>
            <input type="range" min="0.7" max="1.6" step="0.02" value="${this.currentSpeed}" id="modalRateRange" class="audio-slider" />
          </div>
        </div>
      </div>

      <div class="voice-modal-footer">
        <span class="voice-footer-hint">Voices are synthesized locally with 0 network latency.</span>
        <button class="voice-modal-done-btn">Done</button>
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Populate modal voices
    const modalSelect = modal.querySelector("#modalVoiceSelect");
    if (modalSelect && this.voiceSelect) {
      modalSelect.innerHTML = this.voiceSelect.innerHTML;
      modalSelect.value = this.voiceSelect.value;
    }

    // Modal Events
    const closeModal = () => {
      backdrop.classList.add("is-closing");
      setTimeout(() => backdrop.remove(), 160);
    };

    modal.querySelector(".voice-modal-close")?.addEventListener("click", closeModal);
    modal.querySelector(".voice-modal-done-btn")?.addEventListener("click", closeModal);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });

    // Persona selection in modal
    modal.querySelectorAll(".persona-option-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        if (e.target.closest(".persona-card-test-btn")) return;
        const pid = card.dataset.personaId;
        this.setPersona(pid);
        modal.querySelectorAll(".persona-option-card").forEach((c) => c.classList.toggle("is-selected", c.dataset.personaId === pid));
        const modalPitch = modal.querySelector("#modalPitchRange");
        const modalRate = modal.querySelector("#modalRateRange");
        if (modalPitch) {
          modalPitch.value = this.currentPitch;
          modal.querySelector("#modalPitchVal").textContent = `${this.currentPitch.toFixed(2)}x`;
        }
        if (modalRate) {
          modalRate.value = this.currentSpeed;
          modal.querySelector("#modalRateVal").textContent = `${this.currentSpeed.toFixed(2)}x`;
        }
      });
    });

    // Test buttons in modal
    modal.querySelectorAll(".persona-card-test-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pid = btn.dataset.testPersona;
        this.setPersona(pid);
        modal.querySelectorAll(".persona-option-card").forEach((c) => c.classList.toggle("is-selected", c.dataset.personaId === pid));
        this.previewVoice();
      });
    });

    // Modal voice select change
    modalSelect?.addEventListener("change", (e) => {
      const uri = e.target.value;
      if (this.voiceSelect) {
        this.voiceSelect.value = uri;
        this.voiceSelect.dispatchEvent(new Event("change"));
      }
    });

    // Modal preview btn
    modal.querySelector("#modalVoicePreviewBtn")?.addEventListener("click", () => {
      this.previewVoice();
    });

    // Modal sliders
    modal.querySelector("#modalPitchRange")?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      this.currentPitch = val;
      modal.querySelector("#modalPitchVal").textContent = `${val.toFixed(2)}x`;
      if (this.pitchRange) {
        this.pitchRange.value = val;
        if (this.pitchValEl) this.pitchValEl.textContent = `${val.toFixed(2)}x`;
      }
      localStorage.setItem("brainvault_voice_pitch", String(val));
    });

    modal.querySelector("#modalRateRange")?.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      this.currentSpeed = val;
      modal.querySelector("#modalRateVal").textContent = `${val.toFixed(2)}x`;
      if (this.rateRange) {
        this.rateRange.value = val;
        if (this.rateValEl) this.rateValEl.textContent = `${val.toFixed(2)}x`;
      }
      localStorage.setItem("brainvault_voice_speed", String(val));
      this.syncSpeedPills();
    });
  }
}
