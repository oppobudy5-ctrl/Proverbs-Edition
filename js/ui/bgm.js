// =============================================================================
// bgm.js — Pemutar musik latar (opsional). State disimpan di localStorage.
// =============================================================================

const BGM_KEY = "bibleTime.bgm.v2";
const BGM_ICON = {
  on:  "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polygon points=\"11 5 6 9 2 9 2 15 6 15 11 19 11 5\"/><path d=\"M15.54 8.46a5 5 0 0 1 0 7.07\"/><path d=\"M19.07 4.93a10 10 0 0 1 0 14.14\"/></svg>",
  low: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polygon points=\"11 5 6 9 2 9 2 15 6 15 11 19 11 5\"/><path d=\"M15.54 8.46a5 5 0 0 1 0 7.07\"/></svg>",
  off: "<svg viewBox=\"0 0 24 24\" width=\"16\" height=\"16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polygon points=\"11 5 6 9 2 9 2 15 6 15 11 19 11 5\"/><line x1=\"23\" y1=\"9\" x2=\"17\" y2=\"15\"/><line x1=\"17\" y1=\"9\" x2=\"23\" y2=\"15\"/></svg>",
};

export const Bgm = {
  audio: null, btnMute: null, btnMin: null, btnMax: null, slider: null,
  pendingPlay: false, available: true,
  state: { playing: false, volume: 0.4, lastVolume: 0.4 },

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(BGM_KEY) || "{}");
      if (typeof saved.playing === "boolean") this.state.playing = saved.playing;
      if (typeof saved.volume === "number") this.state.volume = Math.max(0, Math.min(1, saved.volume));
      if (typeof saved.lastVolume === "number") this.state.lastVolume = Math.max(0.05, Math.min(1, saved.lastVolume));
    } catch {}
    if (this.state.volume > 0) this.state.lastVolume = this.state.volume;
  },
  save() { try { localStorage.setItem(BGM_KEY, JSON.stringify(this.state)); } catch {} },

  init() {
    this.load();
    this.audio = document.getElementById("bgm-audio");
    this.btnMute = document.getElementById("bgm-mute");
    this.btnMin = document.getElementById("bgm-min");
    this.btnMax = document.getElementById("bgm-max");
    this.slider = document.getElementById("bgm-volume");
    if (!this.audio || !this.slider) return;
    this.audio.volume = this.state.volume;
    this.btnMute && this.btnMute.addEventListener("click", () => this.toggleMute());
    this.btnMin && this.btnMin.addEventListener("click", () => this.setVolume(0, true));
    this.btnMax && this.btnMax.addEventListener("click", () => this.setVolume(1, true));
    this.slider.addEventListener("input", (e) => this.setVolume(+e.target.value / 100, true));
    this.audio.addEventListener("play", () => this.render());
    this.audio.addEventListener("pause", () => this.render());
    this.audio.addEventListener("error", () => { this.available = false; this.pendingPlay = false; this.render(); });
    this.render();
    if (this.state.playing && this.state.volume > 0) this.tryPlay();
  },

  tryPlay() {
    if (!this.audio || !this.available) return;
    this.audio.preload = "auto";
    const p = this.audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        if (this.audio.error) { this.available = false; this.render(); return; }
        this.pendingPlay = true;
        this.render();
        const resume = () => {
          if (!this.pendingPlay) return;
          this.audio.play().then(() => { this.pendingPlay = false; this.render(); }).catch(() => {});
          document.removeEventListener("click", resume, true);
          document.removeEventListener("keydown", resume, true);
        };
        document.addEventListener("click", resume, true);
        document.addEventListener("keydown", resume, true);
      });
    }
  },

  toggleMute() {
    if (this.state.volume > 0) {
      this.state.lastVolume = this.state.volume;
      this.setVolume(0, true);
    } else {
      this.setVolume(this.state.lastVolume || 0.4, true);
    }
  },

  setVolume(v, userGesture) {
    v = Math.max(0, Math.min(1, v));
    this.state.volume = v;
    if (v > 0) this.state.lastVolume = v;
    if (this.audio) this.audio.volume = v;
    if (v > 0) {
      this.state.playing = true;
      if (userGesture) this.tryPlay();
    } else {
      this.state.playing = false;
      this.pendingPlay = false;
      if (this.audio) this.audio.pause();
    }
    this.save();
    this.render();
  },

  render() {
    if (!this.slider) return;
    const v = Math.round(this.state.volume * 100);
    const playing = this.state.playing && this.audio && !this.audio.paused;
    const muted = this.state.volume === 0;
    const lowVol = this.state.volume > 0 && this.state.volume < 0.45;
    if (this.btnMute) {
      this.btnMute.innerHTML = muted ? BGM_ICON.off : (lowVol ? BGM_ICON.low : BGM_ICON.on);
      this.btnMute.classList.toggle("is-on", playing && !muted);
      this.btnMute.classList.toggle("is-pending", this.pendingPlay);
      this.btnMute.setAttribute("aria-label", muted ? "Aktifkan musik latar" : "Bisukan musik latar");
    }
    if (+this.slider.value !== v) this.slider.value = v;
    this.slider.style.setProperty("--bgm-pct", v + "%");
    const pill = document.getElementById("bgm-pill");
    if (pill) {
      pill.classList.toggle("bgm-unavailable", !this.available);
      pill.title = this.available ? "" : "Musik latar belum tersedia \u2014 tambahkan file assets/audio/bgm.mp3";
    }
  },
};
