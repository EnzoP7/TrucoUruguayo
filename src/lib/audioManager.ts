// Sistema de audio para Truco Uruguayo
// Usa Web Audio API para sonidos sintetizados como placeholder.
// Para reemplazar con sonidos propios: poner archivos MP3 en public/sounds/{nombre}.mp3
// Nombres: card-play, truco, envido, flor, round-won, round-lost, game-won, game-lost, your-turn, notification, shuffle, cut

export type SoundType =
  | 'card-play'
  | 'truco'
  | 'envido'
  | 'flor'
  | 'round-won'
  | 'round-lost'
  | 'game-won'
  | 'game-lost'
  | 'your-turn'
  | 'notification'
  | 'shuffle'
  | 'cut';

class AudioManager {
  private ctx: AudioContext | null = null;
  private muted = false;
  private masterVolume = 0.5;
  private musicVolume = 0.25;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicGain: GainNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicPlaying = false;
  private mp3Cache: Map<string, AudioBuffer> = new Map();
  private mp3Checked: Set<string> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.muted = localStorage.getItem('truco_muted') === 'true';
      const savedVol = localStorage.getItem('truco_volume');
      if (savedVol !== null) this.masterVolume = parseFloat(savedVol);
    }
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Intenta cargar MP3, devuelve null si no existe
  private async tryLoadMp3(name: string): Promise<AudioBuffer | null> {
    if (this.mp3Cache.has(name)) return this.mp3Cache.get(name)!;
    if (this.mp3Checked.has(name)) return null;
    this.mp3Checked.add(name);
    try {
      const response = await fetch(`/sounds/${name}.mp3`);
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      const ctx = this.getContext();
      const audioBuffer = await ctx.decodeAudioData(buffer);
      this.mp3Cache.set(name, audioBuffer);
      return audioBuffer;
    } catch {
      return null;
    }
  }

  async play(sound: SoundType): Promise<void> {
    if (this.muted) return;
    // Intentar MP3 primero
    const mp3 = await this.tryLoadMp3(sound);
    if (mp3) {
      const ctx = this.getContext();
      const source = ctx.createBufferSource();
      source.buffer = mp3;
      const gain = ctx.createGain();
      gain.gain.value = this.masterVolume;
      source.connect(gain).connect(ctx.destination);
      source.start();
      return;
    }
    // Fallback: sintetizado
    this.playSynthesized(sound);
  }

  private playSynthesized(sound: SoundType): void {
    const ctx = this.getContext();
    const vol = this.masterVolume;

    switch (sound) {
      case 'card-play': this.synthCardPlay(ctx, vol); break;
      case 'truco': this.synthTruco(ctx, vol); break;
      case 'envido': this.synthEnvido(ctx, vol); break;
      case 'flor': this.synthFlor(ctx, vol); break;
      case 'round-won': this.synthRoundWon(ctx, vol); break;
      case 'round-lost': this.synthRoundLost(ctx, vol); break;
      case 'game-won': this.synthGameWon(ctx, vol); break;
      case 'game-lost': this.synthGameLost(ctx, vol); break;
      case 'your-turn': this.synthYourTurn(ctx, vol); break;
      case 'notification': this.synthNotification(ctx, vol); break;
      case 'shuffle': this.synthShuffle(ctx, vol); break;
      case 'cut': this.synthCut(ctx, vol); break;
    }
  }

  // === Sonidos sintetizados ===

  private synthCardPlay(ctx: AudioContext, vol: number): void {
    // Click percusivo corto - carta golpeando mesa
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.06);
  }

  private synthTruco(ctx: AudioContext, vol: number): void {
    // Golpe fuerte + tono grave
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.6, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    noise.connect(filter).connect(noiseGain).connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.15);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(vol * 0.4, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  private synthEnvido(ctx: AudioContext, vol: number): void {
    // Doble tono ascendente
    const t = ctx.currentTime;
    [0, 0.12].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = i === 0 ? 440 : 550;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(vol * 0.35, t + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.15);
    });
  }

  private synthFlor(ctx: AudioContext, vol: number): void {
    // Acorde brillante (C-E-G arpegiado rapido)
    const t = ctx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const delay = i * 0.06;
      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(vol * 0.3, t + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.3);
    });
  }

  private synthRoundWon(ctx: AudioContext, vol: number): void {
    const t = ctx.currentTime;
    [523, 659, 784].forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol * 0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  private synthRoundLost(ctx: AudioContext, vol: number): void {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  private synthGameWon(ctx: AudioContext, vol: number): void {
    const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const delay = i * 0.12;
      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(vol * 0.35, t + delay + 0.03);
      gain.gain.setValueAtTime(vol * 0.35, t + delay + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.6);
    });
  }

  private synthGameLost(ctx: AudioContext, vol: number): void {
    const t = ctx.currentTime;
    [392, 466, 523].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.8);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol * 0.2, t + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.9);
    });
  }

  private synthYourTurn(ctx: AudioContext, vol: number): void {
    const t = ctx.currentTime;
    [880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const delay = i * 0.1;
      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(vol * 0.2, t + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + 0.25);
    });
  }

  private synthNotification(ctx: AudioContext, vol: number): void {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  private synthShuffle(ctx: AudioContext, vol: number): void {
    // Barajado: ráfaga rápida de clicks tipo cartas mezclándose (~0.8s)
    const t = ctx.currentTime;
    const totalClicks = 14;
    const duration = 0.7;
    for (let i = 0; i < totalClicks; i++) {
      const clickTime = t + (i / totalClicks) * duration;
      // Cada click es un burst de ruido muy corto con pitch variable
      const noise = ctx.createBufferSource();
      const len = Math.floor(ctx.sampleRate * 0.012);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let s = 0; s < len; s++) {
        ch[s] = (Math.random() * 2 - 1) * Math.exp(-s / (len * 0.3));
      }
      noise.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      // Variar frecuencia para que suene como cartas diferentes
      filter.frequency.value = 1500 + Math.random() * 2000;
      filter.Q.value = 2;
      const gain = ctx.createGain();
      const clickVol = vol * (0.3 + Math.random() * 0.4);
      gain.gain.setValueAtTime(clickVol, clickTime);
      gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.015);
      noise.connect(filter).connect(gain).connect(ctx.destination);
      noise.start(clickTime);
      noise.stop(clickTime + 0.02);
    }
  }

  private synthCut(ctx: AudioContext, vol: number): void {
    // Corte: sonido de separar el mazo - un "thud" seco + slide
    const t = ctx.currentTime;
    // Thud grave
    const noise = ctx.createBufferSource();
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.12));
    }
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.1);
    // Slide suave (cartas deslizándose)
    const slideNoise = ctx.createBufferSource();
    const slideLen = ctx.sampleRate * 0.15;
    const slideBuf = ctx.createBuffer(1, slideLen, ctx.sampleRate);
    const slideData = slideBuf.getChannelData(0);
    for (let i = 0; i < slideLen; i++) {
      slideData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (slideLen * 0.5));
    }
    slideNoise.buffer = slideBuf;
    const slideFilter = ctx.createBiquadFilter();
    slideFilter.type = 'highpass';
    slideFilter.frequency.value = 3000;
    const slideGain = ctx.createGain();
    slideGain.gain.setValueAtTime(0, t + 0.05);
    slideGain.gain.linearRampToValueAtTime(vol * 0.3, t + 0.08);
    slideGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    slideNoise.connect(slideFilter).connect(slideGain).connect(ctx.destination);
    slideNoise.start(t + 0.05);
    slideNoise.stop(t + 0.22);
  }

  // === Musica de fondo (loop continuo sin interrupciones) ===

  private generateMusicBuffer(): AudioBuffer {
    const ctx = this.getContext();
    const bpm = 58;
    const beatsPerChord = 2;
    // 4 acordes x 2 beats cada uno = 8 beats
    const totalBeats = 8;
    const beatDuration = 60 / bpm;
    const totalDuration = totalBeats * beatDuration;
    const sampleRate = ctx.sampleRate;
    const totalSamples = Math.ceil(totalDuration * sampleRate);
    const buffer = ctx.createBuffer(2, totalSamples, sampleRate);

    // Progresion: Am - F - C - G (milonga suave)
    const chords: number[][] = [
      [220, 261.63, 329.63],  // Am
      [174.61, 220, 261.63],  // F
      [261.63, 329.63, 392],  // C
      [196, 246.94, 293.66],  // G
    ];

    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);

    for (let chordIdx = 0; chordIdx < chords.length; chordIdx++) {
      const chord = chords[chordIdx];
      const chordStartSample = Math.floor(chordIdx * beatsPerChord * beatDuration * sampleRate);
      const chordDurationSamples = Math.floor(beatsPerChord * beatDuration * sampleRate);

      for (let s = 0; s < chordDurationSamples; s++) {
        const globalSample = chordStartSample + s;
        if (globalSample >= totalSamples) break;

        const t = s / sampleRate;
        const chordDuration = beatsPerChord * beatDuration;

        // Envelope: fade in 0.2s, sustain, fade out last 0.3s
        let env = 1;
        if (t < 0.2) env = t / 0.2;
        if (t > chordDuration - 0.3) env = Math.max(0, (chordDuration - t) / 0.3);

        let sampleVal = 0;
        for (const freq of chord) {
          // Sine wave fundamental + suave harmonic (simula guitarra filtrada)
          sampleVal += Math.sin(2 * Math.PI * freq * t) * 0.12;
          sampleVal += Math.sin(2 * Math.PI * freq * 2 * t) * 0.03;
          // Un poco de detuning para calidez
          sampleVal += Math.sin(2 * Math.PI * (freq * 1.003) * t) * 0.04;
        }

        // Lowpass filter simulado con exponential decay del high-freq content
        sampleVal *= env * 0.15;

        // Slight stereo widening
        leftChannel[globalSample] += sampleVal * 1.05;
        rightChannel[globalSample] += sampleVal * 0.95;
      }
    }

    // Crossfade the last 0.15s with the beginning for seamless looping
    const crossfadeSamples = Math.floor(0.15 * sampleRate);
    for (let i = 0; i < crossfadeSamples; i++) {
      const fadeOut = 1 - i / crossfadeSamples;
      const fadeIn = i / crossfadeSamples;
      const endIdx = totalSamples - crossfadeSamples + i;

      leftChannel[endIdx] = leftChannel[endIdx] * fadeOut + leftChannel[i] * fadeIn;
      rightChannel[endIdx] = rightChannel[endIdx] * fadeOut + rightChannel[i] * fadeIn;
    }

    return buffer;
  }

  startMusic(): void {
    if (this.musicPlaying || this.muted) return;
    this.musicPlaying = true;

    const ctx = this.getContext();

    // Generate music buffer once
    if (!this.musicBuffer) {
      this.musicBuffer = this.generateMusicBuffer();
    }

    // Create gain node for volume control
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(ctx.destination);

    // Create looping source
    this.musicSource = ctx.createBufferSource();
    this.musicSource.buffer = this.musicBuffer;
    this.musicSource.loop = true;
    this.musicSource.connect(this.musicGain);
    this.musicSource.start();
  }

  stopMusic(): void {
    this.musicPlaying = false;
    if (this.musicSource) {
      try { this.musicSource.stop(); } catch { /* already stopped */ }
      this.musicSource = null;
    }
    if (this.musicGain) {
      this.musicGain.disconnect();
      this.musicGain = null;
    }
  }

  // === Control unificado ===

  setMuted(m: boolean): void {
    this.muted = m;
    if (typeof window !== 'undefined') {
      localStorage.setItem('truco_muted', String(m));
    }
    if (m) {
      this.stopMusic();
    } else if (!this.musicPlaying) {
      this.startMusic();
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    this.musicVolume = this.masterVolume * 0.5; // Música siempre al 50% del master
    if (this.musicGain) {
      this.musicGain.gain.value = this.musicVolume;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('truco_volume', String(this.masterVolume));
    }
  }

  getVolume(): number {
    return this.masterVolume;
  }

  // Backward compat: these methods still exist but map to the unified muted
  isMusicMuted(): boolean {
    return this.muted;
  }

  setMusicMuted(m: boolean): void {
    this.setMuted(m);
  }

  setMusicVolume(vol: number): void {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    if (this.musicGain) {
      this.musicGain.gain.value = this.musicVolume;
    }
  }

  // === Audio custom desde URL (para usuarios premium) ===

  async playFromUrl(url: string): Promise<void> {
    if (this.muted) return;
    try {
      if (this.mp3Cache.has(url)) {
        const buffer = this.mp3Cache.get(url)!;
        const ctx = this.getContext();
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = this.masterVolume;
        source.connect(gain).connect(ctx.destination);
        source.start();
        return;
      }
      const response = await fetch(url);
      if (!response.ok) return;
      const arrayBuffer = await response.arrayBuffer();
      const ctx = this.getContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.mp3Cache.set(url, audioBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      const gain = ctx.createGain();
      gain.gain.value = this.masterVolume;
      source.connect(gain).connect(ctx.destination);
      source.start();
    } catch {
      // Silencioso si falla - el caller puede hacer fallback
    }
  }

  async playWithCustom(sound: SoundType, customUrl?: string | null): Promise<void> {
    if (customUrl) {
      await this.playFromUrl(customUrl);
    } else {
      await this.play(sound);
    }
  }
}

const audioManager = new AudioManager();
export default audioManager;
