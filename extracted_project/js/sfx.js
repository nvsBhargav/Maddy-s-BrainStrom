// BrainVault Web Audio Cyber Sound Effects (Pure Synthetic SFX)
// 100% procedural audio synthesized via window.AudioContext.
// Zero external audio files (0 KB network overhead), instant playback, works 100% offline.

export class CyberSoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = typeof localStorage !== "undefined" ? localStorage.getItem("brainvault_sfx") !== "false" : true;
  }

  ensureContext() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("brainvault_sfx", String(this.enabled));
    }
    if (this.enabled) {
      this.play("click");
    }
    return this.enabled;
  }

  play(type = "click") {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      switch (type) {
        case "click": {
          // Sharp micro-cyber blip (12ms)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(1400, t);
          osc.frequency.exponentialRampToValueAtTime(750, t + 0.015);
          gain.gain.setValueAtTime(0.06, t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.02);
          break;
        }

        case "cardSnap": {
          // Tactile card drop / magnetic snap (35ms)
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          osc.type = "triangle";
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(450, t);
          filter.frequency.exponentialRampToValueAtTime(90, t + 0.04);
          osc.frequency.setValueAtTime(180, t);
          osc.frequency.exponentialRampToValueAtTime(55, t + 0.038);
          gain.gain.setValueAtTime(0.12, t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.045);
          break;
        }

        case "conduitPulse": {
          // Ethereal resonant neural pulse (C5 + E5 harmonic ping)
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.type = "sine";
          osc2.type = "sine";
          osc1.frequency.setValueAtTime(523.25, t); // C5
          osc2.frequency.setValueAtTime(659.25, t); // E5
          osc1.frequency.exponentialRampToValueAtTime(1046.5, t + 0.12);
          gain.gain.setValueAtTime(0.08, t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.start(t);
          osc2.start(t);
          osc1.stop(t + 0.15);
          osc2.stop(t + 0.15);
          break;
        }

        case "cardCreated": {
          // Uplifting 3-tone arpeggio (C5 -> E5 -> G5)
          const notes = [523.25, 659.25, 783.99];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const noteT = t + idx * 0.05;
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, noteT);
            gain.gain.setValueAtTime(0.07, noteT);
            gain.gain.exponentialRampToValueAtTime(0.0001, noteT + 0.09);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(noteT);
            osc.stop(noteT + 0.1);
          });
          break;
        }

        case "openPalette": {
          // Soft futuristic shimmer
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          osc.type = "sine";
          filter.type = "bandpass";
          filter.frequency.setValueAtTime(800, t);
          filter.frequency.exponentialRampToValueAtTime(2400, t + 0.08);
          osc.frequency.setValueAtTime(880, t);
          gain.gain.setValueAtTime(0.08, t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.1);
          break;
        }

        case "themeSwitch": {
          // Deep atmospheric futuristic sub-bass sweep
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(75, t);
          osc.frequency.exponentialRampToValueAtTime(280, t + 0.16);
          gain.gain.setValueAtTime(0.12, t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.2);
          break;
        }

        default:
          break;
      }
    } catch (_) {
      // Audio playback fails gracefully if audio context is blocked
    }
  }
}

export const sfx = new CyberSoundFX();
if (typeof window !== "undefined") {
  window.sfx = sfx;
}
