// ─────────────────────────────────────────────────────────────
//  KITTEN BIRTHDAY RUN — SOUND ENGINE (pure Web Audio)
// ─────────────────────────────────────────────────────────────
const SFX = (() => {
  let audioCtx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let bgmRunning = false;
  let bgmLoopHandle = null;
  let loopSection = 0;
  let bgmNextChunkTime = 0;

  const BPM = 142;
  const BEAT = 60 / BPM;
  const BAR = BEAT * 4;
  const LOOP_BARS = 16;
  const LOOP_DUR = LOOP_BARS * BAR;

  const NOTE = {
    C4: 261.63,
    D4: 293.66,
    E4: 329.63,
    F4: 349.23,
    G4: 392.0,
    A4: 440.0,
    B4: 493.88,
    C5: 523.25,
    D5: 587.33,
    E5: 659.25,
    F5: 698.46,
    G5: 783.99,
    A5: 880.0,
    B5: 987.77,
    C6: 1046.5,
    D6: 1174.66,
    E6: 1318.51,
    G6: 1567.98,
    C3: 130.81,
    G3: 196.0,
    F3: 174.61,
    Am3: 220.0,
  };

  function init() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.82;
      masterGain.connect(audioCtx.destination);
      musicGain = audioCtx.createGain();
      musicGain.gain.value = 0.38;
      musicGain.connect(masterGain);
      sfxGain = audioCtx.createGain();
      sfxGain.gain.value = 1.0;
      sfxGain.connect(masterGain);
    } catch (e) {
      console.warn("Web Audio not supported");
    }
  }

  function resume() {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }

  // -------------------------------------------------------------
  //  Basic sound primitives
  // -------------------------------------------------------------
  function osc(type, freq, startT, dur, gainPeak, gainEnd, dest, detune = 0) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(0.001, startT);
    g.gain.linearRampToValueAtTime(gainPeak, startT + 0.01);
    g.gain.exponentialRampToValueAtTime(
      Math.max(gainEnd, 0.0001),
      startT + dur,
    );
    o.connect(g);
    g.connect(dest || sfxGain);
    o.start(startT);
    o.stop(startT + dur + 0.02);
  }

  function noise(dur, startT, gainPeak, gainEnd, lpFreq, dest) {
    if (!audioCtx) return;
    const bufSize = audioCtx.sampleRate * dur;
    const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const flt = audioCtx.createBiquadFilter();
    flt.type = "lowpass";
    flt.frequency.value = lpFreq;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(gainPeak, startT);
    g.gain.exponentialRampToValueAtTime(
      Math.max(gainEnd, 0.0001),
      startT + dur,
    );
    src.connect(flt);
    flt.connect(g);
    g.connect(dest || sfxGain);
    src.start(startT);
    src.stop(startT + dur + 0.01);
  }

  // -------------------------------------------------------------
  //  SFX
  // -------------------------------------------------------------
  function mew() {
    if (!audioCtx) return;
    resume();
    const t = audioCtx.currentTime;
    const o1 = audioCtx.createOscillator();
    const g1 = audioCtx.createGain();
    o1.type = "sawtooth";
    o1.frequency.setValueAtTime(520, t);
    o1.frequency.linearRampToValueAtTime(780, t + 0.06);
    o1.frequency.exponentialRampToValueAtTime(440, t + 0.2);
    g1.gain.setValueAtTime(0.001, t);
    g1.gain.linearRampToValueAtTime(0.22, t + 0.04);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    const flt = audioCtx.createBiquadFilter();
    flt.type = "bandpass";
    flt.frequency.setValueAtTime(900, t);
    flt.frequency.linearRampToValueAtTime(1400, t + 0.08);
    flt.Q.value = 4;
    noise(0.12, t, 0.03, 0.001, 2200, sfxGain);
    o1.connect(flt);
    flt.connect(g1);
    g1.connect(sfxGain);
    o1.start(t);
    o1.stop(t + 0.25);
  }

  function land() {
    if (!audioCtx) return;
    resume();
    const t = audioCtx.currentTime;
    osc("sine", 180, t, 0.13, 0.45, 0.0001, sfxGain);
    osc("sine", 95, t, 0.18, 0.32, 0.0001, sfxGain);
    noise(0.06, t, 0.28, 0.001, 400, sfxGain);
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.09);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(g);
    g.connect(sfxGain);
    o.start(t);
    o.stop(t + 0.12);
  }

  function hurt() {
    if (!audioCtx) return;
    resume();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(260, t + 0.28);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    const flt = audioCtx.createBiquadFilter();
    flt.type = "bandpass";
    flt.frequency.value = 1100;
    flt.Q.value = 3.5;
    o.connect(flt);
    flt.connect(g);
    g.connect(sfxGain);
    o.start(t);
    o.stop(t + 0.35);
    noise(0.07, t, 0.35, 0.001, 1800, sfxGain);
    osc("sine", 140, t, 0.2, 0.22, 0.0001, sfxGain);
  }

  function collectApple() {
    if (!audioCtx) return;
    resume();
    const t = audioCtx.currentTime;
    [880, 1108, 1320, 1760].forEach((f, i) => {
      osc("sine", f, t + i * 0.055, 0.22, 0.28, 0.0001, sfxGain);
      osc("triangle", f * 2, t + i * 0.055, 0.18, 0.09, 0.0001, sfxGain);
    });
    noise(0.08, t, 0.12, 0.001, 6000, sfxGain);
    osc("sine", 2640, t + 0.05, 0.35, 0.16, 0.0001, sfxGain);
  }

  function purr() {
    if (!audioCtx) return;
    resume();
    const t = audioCtx.currentTime;
    osc("sine", 660, t, 0.25, 0.14, 0.0001, sfxGain);
    osc("sine", 990, t + 0.04, 0.2, 0.1, 0.0001, sfxGain);
    osc("triangle", 1320, t + 0.08, 0.18, 0.07, 0.0001, sfxGain);
  }

  function splash() {
    if (!audioCtx) return;
    resume();
    const t = audioCtx.currentTime;
    noise(0.18, t, 0.38, 0.001, 2800, sfxGain);
    noise(0.12, t + 0.04, 0.22, 0.001, 1200, sfxGain);
    [0, 0.04, 0.09, 0.14].forEach((d) => {
      const bF = 280 + Math.random() * 180;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(bF, t + d);
      o.frequency.exponentialRampToValueAtTime(bF * 0.4, t + d + 0.07);
      g.gain.setValueAtTime(0.15, t + d);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.09);
      o.connect(g);
      g.connect(sfxGain);
      o.start(t + d);
      o.stop(t + d + 0.1);
    });
  }

  function rockThud() {
    if (!audioCtx) return;
    resume();
    const t = audioCtx.currentTime;
    osc("sine", 90, t, 0.22, 0.55, 0.0001, sfxGain);
    osc("triangle", 140, t, 0.18, 0.3, 0.0001, sfxGain);
    noise(0.15, t, 0.45, 0.001, 700, sfxGain);
    noise(0.1, t + 0.04, 0.18, 0.001, 2200, sfxGain);
  }

  let lastStep = 0;
  function footstep() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    if (now - lastStep < 0.22) return;
    lastStep = now;
    resume();
    const pitch = lastStep % 0.44 < 0.22 ? 1.0 : 0.88;
    noise(0.055, now, 0.12 * pitch, 0.001, 320 * pitch, sfxGain);
    osc("sine", 95 * pitch, now, 0.06, 0.08, 0.0001, sfxGain);
  }

  function cakeFanfare() {
    if (!audioCtx) return;
    resume();
    const t = audioCtx.currentTime;
    const scale = [523, 659, 784, 1047, 1319, 1568, 2093];
    scale.forEach((f, i) => {
      osc("sine", f, t + i * 0.07, 0.4, 0.4, 0.0001, sfxGain);
      osc("triangle", f * 1.5, t + i * 0.07, 0.35, 0.16, 0.0001, sfxGain);
      osc("sine", f * 2, t + i * 0.07, 0.25, 0.1, 0.0001, sfxGain);
    });
    const chordT = t + scale.length * 0.07 + 0.05;
    [523, 659, 784, 1047].forEach((f) =>
      osc("sine", f, chordT, 0.85, 0.35, 0.001, sfxGain),
    );
    noise(0.15, chordT, 0.22, 0.001, 8000, sfxGain);
    noise(0.12, chordT + 0.1, 0.15, 0.001, 5000, sfxGain);
    [1760, 2093, 2637].forEach((f, i) =>
      osc("sine", f, chordT + i * 0.06, 0.7, 0.08, 0.0001, sfxGain),
    );
  }

  function victoryJingle() {
    if (!audioCtx) return;
    resume();
    const t = audioCtx.currentTime;
    const mel = [
      [523, 0],
      [523, 0.15],
      [523, 0.3],
      [659, 0.45],
      [784, 0.6],
      [784, 0.75],
      [784, 0.9],
      [1047, 1.1],
    ];
    mel.forEach(([f, d]) => {
      osc("triangle", f, t + d, 0.25, 0.28, 0.0001, sfxGain);
      osc("sine", f * 2, t + d, 0.2, 0.1, 0.0001, sfxGain);
    });
    [1047, 1319, 1568, 2093].forEach((f, i) =>
      osc("sine", f, t + 1.4 + i * 0.08, 0.45, 0.18, 0.0001, sfxGain),
    );
  }

  // -------------------------------------------------------------
  //  Background music sequencer
  // -------------------------------------------------------------
  const MELODY_A = [
    [NOTE.E5, 0, 0.5, 0.32],
    [NOTE.G5, 0.5, 0.5, 0.28],
    [NOTE.A5, 1, 0.75, 0.32],
    [NOTE.G5, 1.75, 0.25, 0.22],
    [NOTE.E5, 2, 0.5, 0.3],
    [NOTE.C5, 2.5, 0.5, 0.26],
    [NOTE.D5, 3, 0.75, 0.3],
    [NOTE.C5, 3.75, 0.25, 0.2],
    [NOTE.F5, 4, 0.5, 0.32],
    [NOTE.A5, 4.5, 0.5, 0.28],
    [NOTE.C6, 5, 0.75, 0.34],
    [NOTE.A5, 5.75, 0.25, 0.22],
    [NOTE.G5, 6, 0.5, 0.3],
    [NOTE.E5, 6.5, 0.5, 0.26],
    [NOTE.C5, 7, 1.0, 0.34],
  ];
  const MELODY_B = [
    [NOTE.A5, 0, 0.5, 0.3],
    [NOTE.G5, 0.5, 0.5, 0.26],
    [NOTE.E5, 1, 0.75, 0.3],
    [NOTE.D5, 1.75, 0.25, 0.2],
    [NOTE.C5, 2, 0.5, 0.28],
    [NOTE.E5, 2.5, 0.5, 0.28],
    [NOTE.G5, 3, 0.75, 0.32],
    [NOTE.E5, 3.75, 0.25, 0.22],
    [NOTE.D5, 4, 0.5, 0.3],
    [NOTE.F5, 4.5, 0.5, 0.28],
    [NOTE.A5, 5, 0.75, 0.34],
    [NOTE.G5, 5.75, 0.25, 0.22],
    [NOTE.E5, 6, 0.5, 0.3],
    [NOTE.G5, 6.5, 0.5, 0.28],
    [NOTE.C6, 7, 1.0, 0.38],
  ];
  const BASS = [
    [NOTE.C3, 0, 1.8],
    [NOTE.C3, 2, 1.8],
    [NOTE.F3, 4, 1.8],
    [NOTE.G3, 6, 1.8],
    [NOTE.C3, 8, 1.8],
    [NOTE.Am3, 10, 1.8],
    [NOTE.F3, 12, 1.8],
    [NOTE.G3, 14, 1.8],
  ];
  const DRUM_PATTERN = [];
  for (let bar = 0; bar < 4; bar++) {
    let b = bar * 4;
    DRUM_PATTERN.push(["kick", b], ["kick", b + 2.5], ["kick", b + 3]);
    DRUM_PATTERN.push(["snare", b + 2], ["snare", b + 4 - 0.001]);
    for (let h = 0; h < 8; h++) DRUM_PATTERN.push(["hat", b + h * 0.5]);
  }

  function schedKick(t) {
    osc("sine", 160, t, 0.18, 0.58, 0.0001, musicGain);
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.08);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.72, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g);
    g.connect(musicGain);
    o.start(t);
    o.stop(t + 0.22);
  }
  function schedSnare(t) {
    noise(0.12, t, 0.28, 0.001, 3500, musicGain);
    osc("triangle", 220, t, 0.1, 0.18, 0.0001, musicGain);
  }
  function schedHat(t, accent) {
    noise(0.045, t, accent ? 0.14 : 0.07, 0.001, 9000, musicGain);
  }
  function schedMelody(notes, startT, square) {
    notes.forEach(([f, beat, dur, vol]) => {
      const tt = startT + beat * BEAT;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = square ? "square" : "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.001, tt);
      g.gain.linearRampToValueAtTime(vol * 0.85, tt + 0.02);
      g.gain.setValueAtTime(vol * 0.85, tt + dur * BEAT - 0.04);
      g.gain.linearRampToValueAtTime(0.0001, tt + dur * BEAT);
      const flt = audioCtx.createBiquadFilter();
      flt.type = "lowpass";
      flt.frequency.value = square ? 2200 : 4000;
      flt.Q.value = 0.8;
      o.connect(flt);
      flt.connect(g);
      g.connect(musicGain);
      o.start(tt);
      o.stop(tt + dur * BEAT + 0.01);
      if (!square)
        osc("sine", f * 2, tt, dur * BEAT, vol * 0.08, 0.0001, musicGain);
    });
  }
  function schedBass(startT) {
    BASS.forEach(([f, beat, dur]) => {
      const tt = startT + beat * BEAT;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "square";
      o.frequency.value = f;
      o.detune.value = -1200;
      g.gain.setValueAtTime(0.001, tt);
      g.gain.linearRampToValueAtTime(0.22, tt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + dur * BEAT);
      const flt = audioCtx.createBiquadFilter();
      flt.type = "lowpass";
      flt.frequency.value = 280;
      flt.Q.value = 1.2;
      o.connect(flt);
      flt.connect(g);
      g.connect(musicGain);
      o.start(tt);
      o.stop(tt + dur * BEAT + 0.01);
    });
  }
  function schedDrums(startT) {
    DRUM_PATTERN.forEach(([type, beat]) => {
      const tt = startT + beat * BEAT;
      if (type === "kick") schedKick(tt);
      else if (type === "snare") schedSnare(tt);
      else schedHat(tt, beat % 2 < 0.01);
    });
  }
  function schedPad(startT) {
    const chords = [
      [[NOTE.C4, NOTE.E4, NOTE.G4], 0, 4],
      [[NOTE.F3 * 2, NOTE.A4, NOTE.C5], 4, 4],
      [[NOTE.C4, NOTE.E4, NOTE.G4], 8, 4],
      [[NOTE.G3 * 2, NOTE.B4, NOTE.D5], 12, 4],
    ];
    chords.forEach(([notes, beat, dur]) => {
      const tt = startT + beat * BEAT;
      notes.forEach((f) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.001, tt);
        g.gain.linearRampToValueAtTime(0.042, tt + 0.18);
        g.gain.setValueAtTime(0.042, tt + dur * BEAT - 0.25);
        g.gain.linearRampToValueAtTime(0.0001, tt + dur * BEAT);
        o.connect(g);
        g.connect(musicGain);
        o.start(tt);
        o.stop(tt + dur * BEAT + 0.02);
      });
    });
  }
  function scheduleBGMChunk(startT) {
    const sec = loopSection % 4;
    schedDrums(startT);
    schedBass(startT);
    schedPad(startT);
    if (sec === 0 || sec === 2) {
      schedMelody(MELODY_A, startT, false);
      schedMelody(MELODY_B, startT + 8 * BEAT, false);
    } else {
      schedMelody(MELODY_A, startT, true);
      schedMelody(MELODY_B, startT + 8 * BEAT, true);
    }
    loopSection++;
  }
  function bgmSchedulerTick() {
    if (!bgmRunning) return;
    while (bgmNextChunkTime < audioCtx.currentTime + 0.2 + LOOP_DUR) {
      scheduleBGMChunk(bgmNextChunkTime);
      bgmNextChunkTime += LOOP_DUR;
    }
    bgmLoopHandle = setTimeout(bgmSchedulerTick, 200);
  }
  function startBGM() {
    if (!audioCtx || bgmRunning) return;
    resume();
    bgmRunning = true;
    bgmNextChunkTime = audioCtx.currentTime + 0.05;
    bgmSchedulerTick();
  }
  function stopBGM() {
    bgmRunning = false;
    if (bgmLoopHandle) clearTimeout(bgmLoopHandle);
  }
  function playCelebrationMusic() {
    if (!audioCtx) return;
    stopBGM();
    musicGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    musicGain.gain.linearRampToValueAtTime(0.45, audioCtx.currentTime + 0.5);
    const t0 = audioCtx.currentTime + 0.1;
    const HB = [
      [NOTE.C5, 0, 0.35],
      [NOTE.C5, 0.35, 0.12],
      [NOTE.D5, 0.47, 0.5],
      [NOTE.C5, 0.97, 0.5],
      [NOTE.F5, 1.47, 0.5],
      [NOTE.E5, 1.97, 1.0],
      [NOTE.C5, 3.1, 0.35],
      [NOTE.C5, 3.45, 0.12],
      [NOTE.D5, 3.57, 0.5],
      [NOTE.C5, 4.07, 0.5],
      [NOTE.G5, 4.57, 0.5],
      [NOTE.F5, 5.07, 1.0],
      [NOTE.C5, 6.2, 0.35],
      [NOTE.C5, 6.55, 0.12],
      [NOTE.C6, 6.67, 0.5],
      [NOTE.A5, 7.17, 0.5],
      [NOTE.F5, 7.67, 0.35],
      [NOTE.E5, 8.02, 0.35],
      [NOTE.D5, 8.37, 0.5],
      [NOTE.A5, 9.0, 0.35],
      [NOTE.A5, 9.35, 0.12],
      [NOTE.G5, 9.47, 0.5],
      [NOTE.F5, 9.97, 0.5],
      [NOTE.A5, 10.47, 0.5],
      [NOTE.F5, 10.97, 1.2],
    ];
    HB.forEach(([f, beat, dur]) => {
      const tt = t0 + beat * (BEAT * 0.95);
      [f, f * 1.5, f * 2].forEach((ff, idx) => {
        const vol = [0.38, 0.14, 0.07][idx];
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = idx === 0 ? "triangle" : "sine";
        o.frequency.value = ff;
        g.gain.setValueAtTime(0.001, tt);
        g.gain.linearRampToValueAtTime(vol, tt + 0.03);
        g.gain.setValueAtTime(vol, tt + dur * BEAT * 0.8);
        g.gain.linearRampToValueAtTime(0.0001, tt + dur * BEAT * 0.95);
        o.connect(g);
        g.connect(musicGain);
        o.start(tt);
        o.stop(tt + dur * BEAT + 0.01);
      });
    });
    for (let i = 0; i < 12; i++) {
      setTimeout(() => {
        if (audioCtx) {
          const ft = [1047, 1319, 1568, 2093, 2637][
            Math.floor(Math.random() * 5)
          ];
          osc("sine", ft, audioCtx.currentTime, 0.6, 0.12, 0.0001, musicGain);
        }
      }, i * 400);
    }
  }

  // Public API
  return {
    init,
    resume,
    startBGM,
    stopBGM,
    playCelebrationMusic,
    mew,
    land,
    hurt,
    collectApple,
    purr,
    splash,
    rockThud,
    footstep,
    cakeFanfare,
    victoryJingle,
  };
})();
