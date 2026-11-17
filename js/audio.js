/* 김재원 팬미팅 연습게임 - 소리 (전부 Web Audio 합성, 음원 파일 없음) */
(function () {
  'use strict';
  const FM = (window.FM = window.FM || {});
  const A = (FM.audio = {});

  let ctx = null;
  let master = null;
  let comp = null;
  let musicBus = null;
  let sfxBus = null;
  let noise = null;
  let volume = 0.8;
  const MUSIC = 0.52;

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  A.ctx = () => ctx;

  A.init = function () {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch (e) {
      try {
        ctx = new AC();
      } catch (e2) {
        ctx = null;
        return null;
      }
    }
    master = ctx.createGain();
    master.gain.value = volume;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 14;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.16;
    musicBus = ctx.createGain();
    musicBus.gain.value = MUSIC;
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.95;
    musicBus.connect(comp);
    sfxBus.connect(comp);
    comp.connect(master);
    master.connect(ctx.destination);

    const len = Math.floor(ctx.sampleRate * 1.2);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  };

  A.resume = function () {
    if (!ctx) return Promise.resolve();
    if (ctx.state === 'running') return Promise.resolve();
    try {
      return ctx.resume().catch(() => {});
    } catch (e) {
      return Promise.resolve();
    }
  };

  A.suspend = function () {
    if (!ctx || ctx.state !== 'running') return Promise.resolve();
    try {
      return ctx.suspend().catch(() => {});
    } catch (e) {
      return Promise.resolve();
    }
  };

  A.setVolume = function (v) {
    volume = clamp(v, 0, 1);
    if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
  };

  A.setMusicLevel = function (v, ramp) {
    if (!musicBus) return;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(MUSIC * v, ctx.currentTime, ramp || 0.05);
  };

  /* 스피커까지 걸리는 시간(초). 브라우저가 알려주는 만큼만 보정한다. */
  A.latency = function () {
    if (!ctx) return 0;
    const l = (ctx.baseLatency || 0) + (ctx.outputLatency || 0);
    return clamp(isFinite(l) ? l : 0, 0, 0.25);
  };

  const now = () => (ctx ? ctx.currentTime : 0);
  const at = (t) => (t == null ? now() + 0.001 : Math.max(t, now() + 0.001));

  /* ---------- 기본 악기 ---------- */

  function tone(t, freq, dur, o) {
    if (!ctx) return;
    o = o || {};
    t = at(t);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.glide || dur));
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const a = o.attack == null ? 0.005 : o.attack;
    const peak = o.gain == null ? 0.2 : o.gain;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (o.hold) g.gain.setValueAtTime(peak, t + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(o.lp, t);
      if (o.lpTo) f.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur);
      f.Q.value = o.q || 0.7;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.bus || sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function hiss(t, dur, o) {
    if (!ctx) return;
    o = o || {};
    t = at(t);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.ftype || 'highpass';
    f.frequency.setValueAtTime(o.freq || 4000, t);
    if (o.fto) f.frequency.exponentialRampToValueAtTime(o.fto, t + dur);
    f.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t + (o.attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.bus || sfxBus);
    src.start(t, Math.random() * 0.8);
    src.stop(t + dur + 0.05);
  }

  /* 목소리 비슷한 소리 (하울링용). stop()을 부를 때까지 이어진다. */
  function voice(t, f0, f1, o) {
    if (!ctx) return { stop() {} };
    o = o || {};
    t = at(t);
    const peak = o.gain || 0.2;
    const rise = o.rise || 0.28;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    [osc, osc2].forEach((os) => {
      os.frequency.setValueAtTime(f0, t);
      os.frequency.exponentialRampToValueAtTime(f1, t + rise);
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const lfoG = ctx.createGain();
    lfoG.gain.setValueAtTime(0, t);
    lfoG.gain.linearRampToValueAtTime(f1 * 0.018, t + rise + 0.25);
    lfo.connect(lfoG);
    lfoG.connect(osc.frequency);
    lfoG.connect(osc2.frequency);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(520, t + rise + 0.1);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.06);
    const g2 = ctx.createGain();
    g2.gain.value = 0.5;
    osc.connect(bp);
    bp.connect(g);
    osc2.connect(g2);
    g2.connect(lp);
    lp.connect(g);
    g.connect(o.bus || sfxBus);
    osc.start(t);
    osc2.start(t);
    lfo.start(t);
    let stopped = false;
    const stop = (when, fall) => {
      if (stopped) return;
      stopped = true;
      const s = Math.max(at(when), t + 0.05);
      const rel = fall || 0.14;
      g.gain.cancelScheduledValues(s);
      g.gain.setValueAtTime(peak, s);
      g.gain.exponentialRampToValueAtTime(0.0001, s + rel);
      [osc, osc2].forEach((os) => {
        os.frequency.cancelScheduledValues(s);
        os.frequency.setValueAtTime(f1, s);
        os.frequency.exponentialRampToValueAtTime(f1 * 0.8, s + rel);
        os.stop(s + rel + 0.05);
      });
      lfo.stop(s + rel + 0.05);
    };
    if (o.dur) stop(t + o.dur, o.fall);
    return { stop };
  }

  /* ---------- 드럼 ---------- */

  function kick(t, g) {
    tone(t, 150, 0.2, { to: 46, glide: 0.11, gain: 0.75 * (g || 1), bus: musicBus });
    hiss(t, 0.012, { freq: 2500, gain: 0.05 * (g || 1), bus: musicBus });
  }
  function snare(t, g) {
    hiss(t, 0.13, { ftype: 'bandpass', freq: 1900, q: 0.6, gain: 0.3 * (g || 1), bus: musicBus });
    tone(t, 200, 0.07, { type: 'triangle', to: 150, gain: 0.14 * (g || 1), bus: musicBus });
  }
  function hat(t, g) {
    hiss(t, 0.035, { freq: 7500, gain: 0.07 * (g || 1), bus: musicBus });
  }

  /* ---------- 배경음악 ----------
     화음 구성음만 쓰는 단순한 반주. 16분음표 한 칸씩 불린다. */

  const MOTIFS = {
    a: [[0, 1, 2], [3, 2, 1], [4, 3, 3], [8, 2, 3], [12, 1, 2]],
    b: [[0, 3, 2], [3, 2, 1], [4, 1, 3], [8, 0, 5]],
    c: [[0, 2, 2], [3, 3, 1], [4, 4, 3], [8, 3, 2], [10, 2, 2], [12, 1, 2]],
    d: [[0, 0, 2], [2, 1, 2], [4, 2, 2], [6, 3, 2], [8, 4, 5]],
  };
  const FORM = ['a', 'b', 'a', 'c', 'a', 'b', 'c', 'd'];

  function chordOf(song, bar) {
    const ch = song.prog[bar % song.prog.length];
    const root = song.key + ch[0];
    const minor = ch[1] === 'm';
    return { root, third: root + (minor ? 3 : 4), fifth: root + 7 };
  }

  A.musicStep = function (song, step, t, s16, opt) {
    if (!ctx) return;
    opt = opt || {};
    const bar = Math.floor(step / 16);
    const st = step % 16;
    const ch = chordOf(song, bar);

    // 드럼: 쿵(신호 박) - 짝(누르는 박)
    if (st % 8 === 0) kick(t);
    if (st % 8 === 4) snare(t, 0.8);
    if (st % 2 === 0) hat(t, st % 4 === 2 ? 1.25 : 0.7);
    if (song.busy && st % 16 === 14) kick(t, 0.55);
    if (song.busy && (st === 7 || st === 15) && bar % 2 === 1) hat(t, 0.9);

    // 베이스
    const bassRoot = 36 + (ch.root % 12);
    const bassNote = { 0: bassRoot, 4: bassRoot + 12, 8: 36 + (ch.fifth % 12), 12: bassRoot + 12 }[st];
    if (bassNote != null) {
      tone(t, mtof(bassNote), s16 * 2.4, { type: 'sawtooth', lp: 520, gain: 0.3, bus: musicBus });
      tone(t, mtof(bassNote), s16 * 2.4, { type: 'sine', gain: 0.22, bus: musicBus });
    }

    // 엇박 화음 (짝짝)
    if (st % 4 === 2) {
      [ch.root, ch.third, ch.fifth].forEach((n) => {
        tone(t, mtof(60 + (n % 12)), s16 * 1.1, { type: 'triangle', gain: 0.055, bus: musicBus });
      });
    }

    // 멜로디
    if (!opt.noLead) {
      let r = 72 + (ch.root % 12);
      if (r > 78) r -= 12;
      const tones = [r, r + (ch.third - ch.root), r + 7, r + 12, r + 12 + (ch.third - ch.root), r + 19];
      const motif = MOTIFS[FORM[bar % FORM.length]];
      for (let i = 0; i < motif.length; i++) {
        if (motif[i][0] === st) {
          const f = mtof(tones[motif[i][1]]);
          const dur = s16 * motif[i][2] * 0.95;
          tone(t, f, dur, { type: 'square', lp: 1700, gain: 0.05, bus: musicBus });
          tone(t, f * 2, dur * 0.6, { type: 'sine', gain: 0.018, bus: musicBus });
        }
      }
    }
  };

  A.endHit = function (song, t) {
    if (!ctx) return;
    const ch = chordOf(song, 0);
    kick(t);
    hiss(t, 0.9, { freq: 5000, gain: 0.14, bus: musicBus });
    [ch.root, ch.third, ch.fifth, ch.root + 12].forEach((n, i) => {
      tone(t, mtof(60 + (n % 12) + (i === 3 ? 12 : 0)), 0.9, { type: 'triangle', gain: 0.09, bus: musicBus });
    });
    tone(t, mtof(36 + (ch.root % 12)), 0.9, { type: 'sawtooth', lp: 500, gain: 0.3, bus: musicBus });
  };

  A.count = function (t, accent) {
    tone(t, accent ? 1568 : 1046, 0.07, { type: 'triangle', gain: 0.3 });
    hiss(t, 0.02, { freq: 3000, gain: 0.08 });
  };

  /* ---------- 시청자 등장 신호음 ----------
     종이: 띵 / 악질: 뿌- / 폰: 삐삐 / 늑대: 아우~ */

  A.cue = function (type, t, beatSec, song) {
    if (!ctx) return;
    const key = song ? song.key % 12 : 0;
    if (type === 'paper') {
      tone(t, mtof(84 + key), 0.26, { type: 'triangle', gain: 0.34 });
      tone(t, mtof(96 + key), 0.16, { type: 'sine', gain: 0.1 });
    } else if (type === 'troll') {
      tone(t, 165, 0.3, { type: 'sawtooth', to: 98, gain: 0.3, lp: 950 });
      tone(t, 168, 0.3, { type: 'square', to: 101, gain: 0.12, lp: 700, detune: 30 });
    } else if (type === 'phone') {
      for (let i = 0; i < 2; i++) {
        const tt = t + (i * beatSec) / 2;
        tone(tt, mtof(91 + key), 0.075, { type: 'square', gain: 0.21, lp: 3200 });
        tone(tt, mtof(98 + key), 0.05, { type: 'sine', gain: 0.07 });
      }
    } else if (type === 'wolf') {
      voice(t, 250, 392, { gain: 0.32, rise: beatSec * 0.55, dur: beatSec * 0.82, fall: 0.1 });
    }
  };

  /* 늑대가 같이 우는 소리 (2박) */
  A.wolfHowl = function (t, dur) {
    if (!ctx) return;
    voice(t, 300, 392, { gain: 0.2, rise: 0.22, dur: dur, fall: 0.3 });
  };

  /* ---------- 내 동작 효과음 ---------- */

  A.sign = function (good) {
    const t = now();
    hiss(t, 0.07, { ftype: 'bandpass', freq: 3600, fto: 1500, q: 1.2, gain: 0.34 });
    hiss(t + 0.065, 0.09, { ftype: 'bandpass', freq: 1800, fto: 4200, q: 1.2, gain: 0.3 });
    tone(t, mtof(88), 0.28, { type: 'sine', gain: 0.16 });
    if (good) tone(t + 0.07, mtof(95), 0.3, { type: 'sine', gain: 0.13 });
  };

  A.ban = function (good) {
    const t = now();
    hiss(t, 0.2, { ftype: 'bandpass', freq: 500, fto: 3400, q: 0.9, gain: 0.4 });
    tone(t + 0.02, 190, 0.26, { to: 42, glide: 0.16, gain: 0.7 });
    tone(t, 700, 0.16, { type: 'square', to: 140, gain: 0.13, lp: 1800 });
    if (good) tone(t + 0.1, mtof(79), 0.22, { type: 'triangle', gain: 0.14 });
  };

  A.shutter = function () {
    const t = now();
    hiss(t, 0.022, { freq: 5200, gain: 0.42 });
    hiss(t + 0.042, 0.055, { ftype: 'bandpass', freq: 2600, q: 1.4, gain: 0.36 });
    tone(t, 2300, 0.02, { type: 'square', gain: 0.05 });
    tone(t + 0.042, 1500, 0.03, { type: 'square', gain: 0.05 });
  };

  let myHowl = null;
  A.howlStart = function () {
    A.howlStop();
    myHowl = voice(now(), 392, 587, { gain: 0.3, rise: 0.22 });
  };
  A.howlStop = function () {
    if (myHowl) {
      myHowl.stop(now(), 0.16);
      myHowl = null;
    }
  };

  A.miss = function () {
    const t = now();
    tone(t, 150, 0.2, { type: 'square', to: 92, gain: 0.2, lp: 650 });
  };

  A.click = function () {
    tone(now(), 660, 0.06, { type: 'triangle', gain: 0.14 });
  };

  A.blip = function () {
    tone(now(), 480 + Math.random() * 120, 0.03, { type: 'square', gain: 0.035, lp: 1900 });
  };

  /* 콤보 야호 */
  A.yaho = function (level) {
    const t = now();
    const seq = [[76, 79], [76, 79, 84], [76, 79, 84, 88, 91]][clamp(level, 0, 2)];
    seq.forEach((n, i) => tone(t + i * 0.07, mtof(n), 0.16, { type: 'triangle', gain: 0.13 }));
  };

  A.fanfare = function (grade) {
    const t = now() + 0.05;
    if (grade === 'F') {
      [67, 63, 60, 55].forEach((n, i) => tone(t + i * 0.2, mtof(n), 0.3, { type: 'triangle', gain: 0.18 }));
      tone(t + 0.8, mtof(43), 0.7, { type: 'sawtooth', lp: 500, gain: 0.25 });
      return;
    }
    const up = grade === 'S' ? [60, 64, 67, 72, 76, 79, 84] : grade === 'A' ? [60, 64, 67, 72, 76] : [60, 64, 67, 72];
    up.forEach((n, i) => tone(t + i * 0.09, mtof(n), 0.22, { type: 'triangle', gain: 0.17 }));
    const end = t + up.length * 0.09;
    [60, 64, 67, 72].forEach((n) => tone(end, mtof(n), 0.8, { type: 'triangle', gain: 0.1 }));
    hiss(end, 0.6, { freq: 6000, gain: 0.08 });
  };
})();
