/* 김재원 팬미팅 연습게임 - 게임 본체 */
(function () {
  'use strict';
  const FM = window.FM;
  const A = FM.audio;
  const Art = FM.art;
  const D = FM.data;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (u) => {
    u = clamp(u, 0, 1);
    return 1 - (1 - u) * (1 - u);
  };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const frac = (v) => v - Math.floor(v);

  const stage = $('#stage');
  const cv = $('#cv');
  const c = cv.getContext('2d');
  let W = 720;
  let H = 1280;
  let S = 1;
  let DPR = 1;
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let touchMode = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  FM.debug = { auto: false, sloppy: 0 };

  /* ---------- 저장 ---------- */
  const SAVE_KEY = 'kjw-fanmeeting-practice-v1';
  const save = { unlocked: 1, best: {}, offsetMs: 0, volume: 0.8, tutDone: {}, cleared: false };
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    if (raw && typeof raw === 'object') Object.assign(save, raw);
  } catch (e) {
    /* 저장소를 못 쓰면 그냥 이번 판만 */
  }
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) {
      /* 무시 */
    }
  }

  /* ---------- 화면 크기 ---------- */
  function resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    S = Math.min(vw / 720, vh / 1280);
    W = Math.round(Math.min(vw / S, 3200));
    H = Math.round(Math.min(vh / S, 1560));
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(W * S * DPR);
    cv.height = Math.round(H * S * DPR);
    stage.style.width = W * S + 'px';
    stage.style.height = H * S + 'px';
    stage.style.fontSize = S * 16 + 'px';
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();

  /* ---------- 시계 ----------
     음악(오디오 시계)에 맞춰 흐르는 곡 시간. 오디오가 안 되면 일반 시계로 돈다. */
  const clock = {
    on: false,
    paused: false,
    perfStart: 0,
    ctxStart: 0,
    frozen: 0,
    lastCtx: -1,
    useAudio: false,
    start(lead) {
      const ctx = A.ctx();
      this.useAudio = !!(ctx && ctx.state === 'running');
      this.perfStart = performance.now() + lead * 1000;
      this.ctxStart = ctx ? ctx.currentTime + lead : 0;
      this.on = true;
      this.paused = false;
      this.lastCtx = -1;
    },
    stop() {
      this.on = false;
      this.paused = false;
    },
    raw(at) {
      if (!this.on) return 0;
      if (this.paused) return this.frozen;
      const p = performance.now();
      const ctx = A.ctx();
      if (this.useAudio && ctx.state === 'running' && ctx.currentTime !== this.lastCtx) {
        this.lastCtx = ctx.currentTime;
        const diff = ctx.currentTime - this.ctxStart - (p - this.perfStart) / 1000;
        this.perfStart -= (Math.abs(diff) > 0.1 ? diff : diff * 0.06) * 1000;
      }
      return ((at == null ? p : at) - this.perfStart) / 1000;
    },
    /* 플레이어 귀에 들리는 시점 기준 곡 시간 */
    heard(at) {
      return this.raw(at) - (this.useAudio ? A.latency() : 0) - save.offsetMs / 1000;
    },
    pause() {
      if (!this.on || this.paused) return;
      this.frozen = this.raw();
      this.paused = true;
      A.suspend();
    },
    resume() {
      if (!this.on || !this.paused) return Promise.resolve();
      return A.resume().then(() => {
        const ctx = A.ctx();
        let t = this.frozen;
        if (this.useAudio && ctx && ctx.state === 'running') t = Math.max(t, ctx.currentTime - this.ctxStart);
        this.perfStart = performance.now() - t * 1000;
        this.lastCtx = -1;
        this.paused = false;
      });
    },
  };

  function evTime(e) {
    const p = performance.now();
    const ts = e && e.timeStamp;
    if (typeof ts === 'number' && ts > 0 && p - ts >= 0 && p - ts < 250) return ts;
    return p;
  }

  /* ---------- 상태 ---------- */
  let state = 'boot';
  let game = null;
  let story = null;
  let result = null;
  let modal = null;

  function setScreen(name) {
    state = name;
    $$('.screen').forEach((el) => el.classList.toggle('on', el.id === 'scr-' + name));
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
  function openModal(id) {
    modal = id;
    $$('.modal').forEach((el) => el.classList.toggle('on', el.id === id));
  }
  function closeModal() {
    modal = null;
    $$('.modal').forEach((el) => el.classList.remove('on'));
  }

  /* ================= 타이틀 ================= */

  function goTitle() {
    stopGame();
    setScreen('title');
    const next = save.cleared ? 1 : clamp(save.unlocked, 1, 3);
    $('#btn-start').textContent = save.unlocked > 1 && !save.cleared ? next + '일차 이어하기' : '시작하기';
    $('#btn-start').dataset.day = String(next);
    $$('#days .day').forEach((el) => {
      const d = Number(el.dataset.day);
      el.disabled = d > save.unlocked;
      const best = save.best[d];
      el.classList.toggle('best', best != null);
      if (best != null) el.dataset.best = best + '점';
    });
  }

  function unlockAudio() {
    A.init();
    A.setVolume(save.volume);
    // 브라우저가 소리를 안 열어줘도 게임은 시작되게
    return Promise.race([A.resume(), new Promise((r) => setTimeout(r, 600))]);
  }

  function startDay(day) {
    unlockAudio().then(() => {
      A.click();
      playStory(String(day), D.days[day].label, () => startTutorial(day));
    });
  }

  /* ================= 스토리 ================= */

  function playStory(key, label, onEnd) {
    stopGame();
    story = { key: key, label: label, lines: D.story[key], i: 0, t0: performance.now(), shown: 0, onEnd: onEnd, lastBlip: 0 };
    setScreen('story');
    showLine();
  }
  function showLine() {
    const ln = story.lines[story.i];
    story.t0 = performance.now();
    story.shown = 0;
    $('#dlg-who').textContent = ln.who || '';
    $('#dlg-text').textContent = '';
    $('#dialog').classList.toggle('narr', !ln.who);
    $('#dialog').classList.remove('ready');
  }
  function updateStory() {
    const ln = story.lines[story.i];
    const total = ln.text.length;
    const n = Math.min(total, Math.floor((performance.now() - story.t0) / 34));
    if (n !== story.shown) {
      if (n > story.shown && n - story.lastBlip >= 2 && ln.text[n - 1] !== ' ' && ln.text[n - 1] !== '\n') {
        A.blip();
        story.lastBlip = n;
      }
      story.shown = n;
      $('#dlg-text').textContent = ln.text.slice(0, n);
      if (n >= total) $('#dialog').classList.add('ready');
    }
  }
  function advanceStory() {
    if (state !== 'story' || !story) return;
    const ln = story.lines[story.i];
    if (story.shown < ln.text.length) {
      story.t0 = -1e9;
      story.lastBlip = 1e9;
      return;
    }
    A.click();
    story.i++;
    story.lastBlip = 0;
    if (story.i >= story.lines.length) endStory();
    else showLine();
  }
  function endStory() {
    const s = story;
    story = null;
    if (s && s.onEnd) s.onEnd();
  }

  /* ================= 게임 ================= */

  const TYPE_OF = { P: 'paper', T: 'troll', C: 'phone', W: 'wolf' };

  function newGame(day, mode) {
    const song = D.songs[day];
    const g = {
      day: day,
      mode: mode,
      song: song,
      beatSec: 60 / song.bpm,
      s16: 15 / song.bpm,
      notes: [],
      targets: [],
      events: [],
      evPtr: 0,
      nextStep: 0,
      tgtPtr: 0,
      firstVis: 0,
      arrK: 0,
      stats: { perfect: 0, good: 0, miss: 0, combo: 0, maxCombo: 0 },
      fx: [],
      player: { anim: 'idle', b0: -99, dur: 1, dir: 1 },
      hold: null,
      b: -1,
      lead: 4,
      endBeat: null,
      finished: false,
      flashBeat: -99,
      shakeBeat: -99,
      comboBeat: -99,
      snapDir: 1,
      tut: null,
    };
    g.win = Math.min(0.135, g.beatSec * 0.24);
    g.winP = g.win * 0.5;
    g.gw = g.win / g.beatSec;
    return g;
  }

  function addNote(g, type, cue, extra) {
    const n = {
      type: type,
      cue: cue,
      i: g.notes.length,
      hits: [],
      result: null,
      how: null,
      doneBeat: null,
      side: g.notes.length % 2 ? 1 : -1,
      seed: Math.floor(Math.random() * 90),
      bubble: pick(D.trollLines),
      born: g.b,
      leaveDelay: 0,
      leaveDur: 0.7,
      dir: 1,
    };
    if (extra) Object.assign(n, extra);
    const add = (b, kind) => {
      const T = { beat: b, kind: kind, note: n, done: false, res: null };
      n.hits.push(T);
      g.targets.push(T);
    };
    if (type === 'paper') add(cue + 1, 'click');
    else if (type === 'troll') add(cue + 1, 'swipe');
    else if (type === 'phone') {
      add(cue + 1, 'key');
      add(cue + 1.5, 'key');
    } else if (type === 'wolf') {
      add(cue + 1, 'hold');
      n.holdEnd = cue + 3;
    }
    n.end = cue + (type === 'wolf' ? 4 : 2);
    g.events.push({ beat: cue, note: n, fn: (t) => A.cue(type, t, g.beatSec, g.song) });
    if (type === 'wolf') g.events.push({ beat: cue + 1, note: n, fn: (t) => A.wolfHowl(t, g.beatSec * 2) });
    g.notes.push(n);
    return n;
  }

  function startMain(day) {
    stopGame();
    const g = newGame(day, 'main');
    let b = g.lead;
    const chart = D.charts[day].replace(/\s+/g, '');
    for (let i = 0; i < chart.length; i++) {
      const ch = chart[i];
      if (ch === '-') {
        b += 2;
        continue;
      }
      b = addNote(g, TYPE_OF[ch], b).end;
    }
    g.endBeat = b;
    g.events.push({ beat: b, fn: (t) => A.endHit(g.song, t) });
    begin(g);
  }

  function startTutorial(day) {
    stopGame();
    const g = newGame(day, 'tutorial');
    g.tut = { steps: D.days[day].learn.slice(), i: 0, ok: 0, nextCue: g.lead, done: false, doneBeat: null };
    begin(g);
    updateTutCard();
  }

  function begin(g) {
    game = g;
    setScreen('play');
    $('#tut').classList.toggle('on', g.mode === 'tutorial');
    $('#btn-skip-tut').classList.toggle('on', g.mode === 'tutorial');
    A.setMusicLevel(1, 0.01);
    unlockAudio().then(() => {
      if (game !== g) return;
      clock.start(0.3);
    });
  }

  function stopGame() {
    if (game) {
      A.howlStop();
      game = null;
    }
    if (clock.paused) A.resume();
    clock.stop();
    closeModal();
    gestures.clear();
  }

  /* --- 튜토리얼: 성공 횟수를 채울 때까지 같은 시청자가 계속 온다 --- */
  function feedTutorial(g, b) {
    const tu = g.tut;
    if (tu.done) return;
    while (tu.nextCue < b + 7) {
      const n = addNote(g, tu.steps[tu.i], tu.nextCue, { step: tu.i });
      tu.nextCue = n.end;
    }
  }
  function tutProgress(g, n, b) {
    const tu = g.tut;
    if (tu.done || n.step !== tu.i || n.result === 'miss') return;
    tu.ok++;
    n.tutCounted = true;
    if (tu.ok >= D.tutorialNeed) {
      // 아직 책상에 안 온 시청자는 돌려보낸다
      let cut = g.notes.length;
      while (cut > 0 && g.notes[cut - 1].cue > b + 0.7) cut--;
      const dropped = g.notes.slice(cut);
      g.notes.length = cut;
      g.targets = g.targets.filter((T) => dropped.indexOf(T.note) < 0);
      g.events = g.events.filter((ev, idx) => idx < g.evPtr || dropped.indexOf(ev.note) < 0);
      const lastEnd = cut > 0 ? g.notes[cut - 1].end : g.lead;
      tu.i++;
      tu.ok = 0;
      if (tu.i >= tu.steps.length) {
        tu.done = true;
        tu.doneBeat = Math.max(lastEnd, b + 1);
        addFx(g, { type: 'cap', str: '연습 끝!', x: W / 2, y: H * 0.42, size: 96, dur: 3, b0: b + 0.3 });
        addFx(g, { type: 'text', str: '이제 진짜 시작', x: W / 2, y: H * 0.42 + 110, size: 60, dur: 2.7, b0: b + 0.6, color: Art.RED });
      } else {
        tu.nextCue = Math.ceil((Math.max(lastEnd, b + 1) + 2) / 2) * 2;
        addFx(g, { type: 'cap', str: '좋아! 다음', x: W / 2, y: H * 0.42, size: 80, dur: 2, b0: b + 0.3 });
      }
    }
    updateTutCard();
  }
  function updateTutCard() {
    const g = game;
    if (!g || !g.tut) return;
    const tu = g.tut;
    const type = tu.steps[Math.min(tu.i, tu.steps.length - 1)];
    const info = D.types[type];
    $('#tut-title').innerHTML = info.name + ' → <em>' + info.action + '!</em>';
    $('#tut-how').innerHTML = info.how + ' <kbd>' + (touchMode ? info.touch : info.pc) + '</kbd>';
    let pips = '';
    for (let i = 0; i < D.tutorialNeed; i++) pips += '<i class="' + (tu.done || i < tu.ok ? 'on' : '') + '"></i>';
    $('#tut-pips').innerHTML = pips;
  }

  /* --- 소리 예약 (조금씩 앞당겨서) --- */
  function schedule() {
    const g = game;
    if (!g || !clock.on || clock.paused) return;
    const ctx = A.ctx();
    const live = !!(ctx && clock.useAudio && ctx.state === 'running');
    const horizon = clock.raw() + 0.14;
    while (g.nextStep * g.s16 < horizon) {
      const st = g.nextStep++;
      if (!live) continue;
      const t = clock.ctxStart + st * g.s16;
      if (t < ctx.currentTime - 0.05) continue;
      const beat = st / 4;
      if (g.endBeat == null || beat < g.endBeat) A.musicStep(g.song, st, t, g.s16, { noLead: g.mode === 'tutorial' });
      if (beat < g.lead && st % 4 === 0) A.count(t, beat === g.lead - 1);
    }
    while (g.evPtr < g.events.length && g.events[g.evPtr].beat * g.beatSec < horizon) {
      const ev = g.events[g.evPtr++];
      if (!live) continue;
      const t = clock.ctxStart + ev.beat * g.beatSec;
      if (t < ctx.currentTime - 0.05) continue;
      ev.fn(t);
    }
  }
  setInterval(schedule, 25);

  /* --- 판정 --- */
  function playing() {
    return state === 'play' && game && clock.on && !clock.paused && !game.finished && !modal;
  }
  function nextTarget(g) {
    for (let i = g.tgtPtr; i < g.targets.length; i++) {
      if (!g.targets[i].done) return g.targets[i];
    }
    return null;
  }
  function setAnim(g, anim, b, dur, dir) {
    g.player = { anim: anim, b0: b, dur: dur, dir: dir || 1 };
  }
  function addFx(g, f) {
    if (f.b0 == null) f.b0 = g.b;
    g.fx.push(f);
    if (g.fx.length > 80) g.fx.shift();
  }

  /* 누르기. dev = 'mouse' | 'key' | 'touch'
     종이는 마우스 클릭, 폰/늑대는 스페이스. 터치는 뭐든 탭으로 통한다. */
  function inputPress(tSec, src, dev) {
    const g = game;
    if (!playing()) return null;
    const b = tSec / g.beatSec;
    const T = nextTarget(g);
    if (!T) return null;
    const n = T.note;
    const dt = (b - T.beat) * g.beatSec;
    if (Math.abs(dt) <= g.win) {
      const q = Math.abs(dt) <= g.winP ? 'perfect' : 'good';
      const want = T.kind === 'click' ? 'mouse' : 'key';
      if (T.kind === 'swipe' || (dev !== 'touch' && dev !== want)) {
        finish(g, n, 'miss', dev === 'key' ? 'wrong-photo' : 'wrong-sign', b);
      } else if (T.kind === 'click') {
        T.done = true;
        T.res = q;
        finish(g, n, q, 'signed', b);
      } else if (T.kind === 'key') {
        T.done = true;
        T.res = q;
        snap(g, n, b);
        if (T === n.hits[1]) {
          const first = n.hits[0].res;
          if (!first || first === 'miss') finish(g, n, 'miss', 'half', b);
          else finish(g, n, first === 'perfect' && q === 'perfect' ? 'perfect' : 'good', 'photo', b);
        }
      } else {
        T.done = true;
        T.res = q;
        g.hold = { note: n, src: src, q: q, b0: b };
        A.howlStart();
      }
      return n;
    }
    if (dt < 0 && b >= n.cue - 0.02) {
      finish(g, n, 'miss', 'early', b);
      return n;
    }
    return null;
  }

  function inputRelease(tSec, src) {
    const g = game;
    if (!g || !g.hold || g.hold.src !== src) return;
    const b = tSec / g.beatSec;
    const n = g.hold.note;
    if (b < n.holdEnd - 0.4) {
      g.hold = null;
      A.howlStop();
      finish(g, n, 'miss', 'short', b);
    } else {
      completeHold(g, b);
    }
  }
  function completeHold(g, b) {
    const h = g.hold;
    g.hold = null;
    A.howlStop();
    finish(g, h.note, h.q, 'howl', b);
  }

  function inputSwipe(tSec, dir) {
    const g = game;
    if (!playing()) return;
    const b = tSec / g.beatSec;
    const T = nextTarget(g);
    const whiff = () => {
      setAnim(g, 'ban', b, 0.8, dir);
      addFx(g, { type: 'swipe', dir: dir, dur: 0.5, b0: b });
    };
    if (!T) return whiff();
    const n = T.note;
    const dt = (b - T.beat) * g.beatSec;
    const active = b >= n.cue - 0.02;
    if (Math.abs(dt) <= g.win) {
      if (T.kind === 'swipe') {
        T.done = true;
        finish(g, n, Math.abs(dt) <= g.winP ? 'perfect' : 'good', 'banned', b, { dir: dir });
      } else {
        banWrong(g, n, b, dir);
      }
      return;
    }
    if (dt < 0 && active) {
      if (T.kind === 'swipe') {
        whiff();
        finish(g, n, 'miss', 'early', b, { dir: dir });
      } else {
        banWrong(g, n, b, dir);
      }
      return;
    }
    whiff();
  }
  function banWrong(g, n, b, dir) {
    if (g.hold && g.hold.note === n) {
      g.hold = null;
      A.howlStop();
    }
    finish(g, n, 'miss', 'wrong-ban', b, { dir: dir });
  }
  /* 눌러서 이미 판정이 난 뒤에 손가락을 옆으로 밀어버린 경우 */
  function convertToBan(g, n, b, dir) {
    if (!n) return inputSwipe(b * g.beatSec, dir);
    if (g.hold && g.hold.note === n) return banWrong(g, n, b, dir);
    if (n.result == null) return banWrong(g, n, b, dir);
    if (n.result !== 'miss' && b - n.doneBeat < 0.6) {
      const st = g.stats;
      st[n.result]--;
      st.miss++;
      st.combo = 0;
      st.maxCombo = n.prevMax;
      if (n.tutCounted && g.tut && !g.tut.done && n.step === g.tut.i) {
        g.tut.ok = Math.max(0, g.tut.ok - 1);
        updateTutCard();
      }
      n.result = null;
      n.signBeat = null;
      finish(g, n, 'miss', 'wrong-ban', b, { dir: dir, noCount: true });
    }
  }

  function snap(g, n, b) {
    A.shutter();
    g.flashBeat = b;
    g.snapDir = -g.snapDir;
    setAnim(g, 'photo', b, 0.5, g.snapDir);
    addFx(g, { type: 'text', str: '찰칵!', x: W / 2 + g.snapDir * 190, y: H - 880 - Math.random() * 40, size: 62, dur: 0.9, b0: b, rot: g.snapDir * 0.12, rise: 30 });
  }

  function expire(g, T, b) {
    T.done = true;
    T.res = 'miss';
    const n = T.note;
    if (n.type === 'phone' && T === n.hits[0]) return;
    const half = n.type === 'phone' && n.hits[0].res && n.hits[0].res !== 'miss';
    finish(g, n, 'miss', half ? 'half' : 'late', b);
  }

  function finish(g, n, res, how, b, o) {
    if (n.result) return;
    o = o || {};
    n.result = res;
    n.how = how;
    n.doneBeat = b;
    n.dir = o.dir || (n.i % 2 ? -1 : 1);
    for (let i = 0; i < n.hits.length; i++) n.hits[i].done = true;
    const st = g.stats;
    if (!o.noCount) {
      n.prevMax = st.maxCombo;
      st[res]++;
      if (res === 'miss') st.combo = 0;
      else {
        st.combo++;
        st.maxCombo = Math.max(st.maxCombo, st.combo);
        g.comboBeat = b;
      }
    }
    react(g, n, b);
    if (g.tut && !o.noCount) tutProgress(g, n, b);
  }

  /* 판정 직후 연출 */
  function react(g, n, b) {
    const cx = W / 2;
    const res = n.result;
    const good = res !== 'miss';
    const perfect = res === 'perfect';
    const headY = H - HEAD_Y;
    const say = (str, dur) => addFx(g, { type: 'bubble', str: str, x: cx + 190, y: headY + 30, size: 40, dur: dur || 1.1, b0: b, dir: -1 });
    const note = (str, col) => addFx(g, { type: 'text', str: str, x: cx, y: H - 1000, size: 52, dur: 1.3, b0: b, color: col || '#444', rise: 20 });
    const hearts = (k) => {
      for (let i = 0; i < k; i++) {
        addFx(g, { type: 'heart', x: cx + (Math.random() - 0.5) * 220, y: headY + 60 + Math.random() * 80, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random(), r: 14 + Math.random() * 10, dur: 1 + Math.random() * 0.5, b0: b });
      }
    };

    switch (n.how) {
      case 'signed':
        setAnim(g, 'sign', b, 0.8);
        A.sign(perfect);
        n.signBeat = b;
        n.leaveDelay = 0.3;
        hearts(perfect ? 4 : 2);
        if (Math.random() < 0.5) say(pick(D.fanThanks));
        break;
      case 'banned':
        setAnim(g, 'ban', b, 0.8, n.dir);
        A.ban(perfect);
        g.shakeBeat = b;
        addFx(g, { type: 'swipe', dir: n.dir, dur: 0.5, b0: b });
        addFx(g, { type: 'stamp', str: perfect ? '영구밴' : '밴!', x: cx - n.dir * 40, y: H - 800, dur: 1.2, b0: b, rot: -0.18 * n.dir });
        break;
      case 'photo':
        n.leaveDelay = 0.12;
        hearts(perfect ? 3 : 1);
        addFx(g, { type: 'pola', good: true, x: cx - (W > 1200 ? 330 : 228), y: H - 730, dur: 2.2, b0: b, rot: -0.14 });
        break;
      case 'howl':
        n.leaveDelay = 0.15;
        hearts(perfect ? 3 : 1);
        addFx(g, { type: 'text', str: '아우우우~!', x: cx, y: H - 985, size: 84, dur: 1.1, b0: b, color: Art.INK, rise: 30 });
        break;
      case 'late':
      case 'early':
        A.miss();
        if (g.player.anim !== 'ban' || b - g.player.b0 > 0.3) setAnim(g, 'oops', b, 0.9);
        if (n.how === 'early') note('너무 빨랐다!');
        if (n.type === 'troll') say(pick(D.trollLaugh), 0.9);
        else if (n.type === 'wolf') say('끼잉...', 0.9);
        else say(pick(D.fanSad), 0.9);
        break;
      case 'half':
        A.miss();
        note('한 장 더 찍어야지!');
        addFx(g, { type: 'pola', good: false, x: cx - (W > 1200 ? 330 : 228), y: H - 730, dur: 1.8, b0: b, rot: -0.14 });
        break;
      case 'short':
        A.miss();
        setAnim(g, 'oops', b, 0.9);
        note('더 길게 울어야지!');
        say('끼잉...', 0.9);
        break;
      case 'wrong-ban':
        setAnim(g, 'ban', b, 0.8, n.dir);
        A.ban(false);
        A.miss();
        g.shakeBeat = b;
        addFx(g, { type: 'swipe', dir: n.dir, dur: 0.5, b0: b });
        note(n.type === 'wolf' ? '늑대인간을 밴했다...' : '앗, 시청자를 밴했다', Art.RED);
        break;
      case 'wrong-sign':
        setAnim(g, 'sign', b, 0.8);
        A.sign(false);
        A.miss();
        if (n.type === 'troll') {
          n.signBeat = b;
          n.leaveDelay = 0.3;
          note('악질한테 싸인을?!', Art.RED);
          say('개꿀ㅋ', 1);
        } else if (n.type === 'phone') {
          note('폰에 싸인을 해버렸다', Art.RED);
          say('제 폰...', 0.9);
        } else {
          note('늑대인간한테 싸인을?!', Art.RED);
          say('끼잉...', 0.9);
        }
        break;
      case 'wrong-photo':
        A.shutter();
        A.miss();
        g.flashBeat = b;
        setAnim(g, 'photo', b, 0.5, 1);
        if (n.type === 'troll') {
          note('악질이랑 사진을?!', Art.RED);
          say('인증샷ㅋ', 1);
        } else {
          note('사진 말고 싸인!', Art.RED);
          say(pick(D.fanSad), 0.9);
        }
        break;
    }

    // 판정 글자
    const label = D.judge[res];
    addFx(g, {
      type: 'text',
      str: label,
      x: cx + 232,
      y: H - 648,
      size: perfect ? 76 : 64,
      dur: 0.9,
      b0: b,
      color: perfect ? Art.RED : good ? Art.INK : '#6f6f6f',
      bold: true,
      rot: perfect ? -0.1 : 0.06,
      rise: 16,
    });

    // 콤보 야호
    if (good && g.mode === 'main') {
      const cb = g.stats.combo;
      let lv = -1;
      if (cb === 5) lv = 0;
      else if (cb === 10) lv = 1;
      else if (cb >= 20 && cb % 10 === 0) lv = 2;
      if (lv >= 0) {
        A.yaho(lv);
        addFx(g, { type: 'cap', str: ['야호', '야호오오', '야호오오오오오!!'][lv], x: cx, y: H - 338, size: [76, 72, 64][lv], dur: 2.2, b0: b + 0.1 });
      }
    }
  }

  /* --- 자동 플레이 (점검용) --- */
  function autoPlay(g, b) {
    for (let i = g.tgtPtr; i < g.targets.length; i++) {
      const T = g.targets[i];
      if (T.done || T.auto) continue;
      if (b < T.beat) break;
      T.auto = true;
      const t = T.beat * g.beatSec;
      const r = Math.random();
      if (r < FM.debug.sloppy) {
        if (r < FM.debug.sloppy * 0.4) continue;
        if (T.kind === 'swipe') {
          inputPress(t, 'auto', 'mouse');
          inputRelease(t + 0.01, 'auto');
        } else if (r < FM.debug.sloppy * 0.7) inputSwipe(t, 1);
        else {
          inputPress(t, 'auto', T.kind === 'click' ? 'key' : 'mouse');
          inputRelease(t + 0.01, 'auto');
        }
        continue;
      }
      if (T.kind === 'swipe') inputSwipe(t, i % 2 ? 1 : -1);
      else {
        inputPress(t, 'auto', T.kind === 'click' ? 'mouse' : 'key');
        if (T.kind !== 'hold') inputRelease(t + 0.01, 'auto');
      }
    }
  }

  function updatePlay(g) {
    const b = clock.heard() / g.beatSec;
    g.b = b;
    if (clock.paused) return;
    if (g.mode === 'tutorial') feedTutorial(g, b);
    schedule();
    if (FM.debug.auto) autoPlay(g, b);

    const grace = g.gw + 0.03 / g.beatSec;
    for (let i = g.tgtPtr; i < g.targets.length; i++) {
      const T = g.targets[i];
      if (T.done) {
        if (i === g.tgtPtr) g.tgtPtr++;
        continue;
      }
      if (b > T.beat + grace) expire(g, T, b);
      else break;
    }
    if (g.hold && b >= g.hold.note.holdEnd) completeHold(g, b);

    if (g.finished) return;
    if (g.mode === 'tutorial' && g.tut.done && b >= g.tut.doneBeat + 2.6) {
      g.finished = true;
      save.tutDone[g.day] = true;
      persist();
      A.setMusicLevel(0, 0.08);
      const day = g.day;
      setTimeout(() => {
        if (game === g) startMain(day);
      }, 350);
    } else if (g.mode === 'main' && b >= g.endBeat + 3) {
      g.finished = true;
      showResult(g);
    }
  }

  /* ================= 결과 ================= */

  function showResult(g) {
    const st = g.stats;
    const total = g.notes.length || 1;
    const score = Math.round(((st.perfect + st.good * 0.7) / total) * 100);
    const grade = D.grades.filter((gr) => score >= gr.min)[0];
    const pass = score >= D.passScore;
    const day = g.day;
    result = { day: day, score: score, grade: grade, pass: pass, t0: performance.now() };
    if (save.best[day] == null || score > save.best[day]) save.best[day] = score;
    if (pass) {
      if (day < 3) save.unlocked = Math.max(save.unlocked, day + 1);
      else save.cleared = true;
    }
    persist();
    stopGame();
    setScreen('result');
    $('#res-day').textContent = D.days[day].label + ' 결과';
    $('#res-score').textContent = score + '점';
    $('#res-line').textContent = grade.line;
    $('#res-perfect').textContent = st.perfect;
    $('#res-good').textContent = st.good;
    $('#res-miss').textContent = st.miss;
    $('#res-combo').textContent = st.maxCombo;
    const next = $('#btn-next');
    next.style.display = pass ? '' : 'none';
    next.textContent = day < 3 ? '다음 날로' : '엔딩 보기';
    A.fanfare(grade.id);
  }

  /* ================= 입력 ================= */

  const TAP_KEYS = ['Space', 'KeyJ', 'KeyF', 'KeyZ', 'KeyX', 'Enter'];
  const LEFT_KEYS = ['ArrowLeft', 'KeyA'];
  const RIGHT_KEYS = ['ArrowRight', 'KeyD'];
  const gestures = new Map();

  function setTouchMode(v) {
    if (touchMode === v) return;
    touchMode = v;
    updateTutCard();
  }

  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const isTap = TAP_KEYS.indexOf(e.code) >= 0;
    const isL = LEFT_KEYS.indexOf(e.code) >= 0;
    const isR = RIGHT_KEYS.indexOf(e.code) >= 0;
    if (state === 'play') {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        if (!e.repeat) togglePause();
        return;
      }
      if (modal) return;
      if (isTap || isL || isR) e.preventDefault();
      if (e.repeat) return;
      setTouchMode(false);
      const t = clock.heard(evTime(e));
      if (isTap) inputPress(t, 'k:' + e.code, 'key');
      else if (isL) inputSwipe(t, -1);
      else if (isR) inputSwipe(t, 1);
    } else if (state === 'story') {
      if (isTap || isR) {
        e.preventDefault();
        if (!e.repeat) advanceStory();
      }
    }
  });
  window.addEventListener('keyup', (e) => {
    if (state !== 'play' || modal) return;
    if (TAP_KEYS.indexOf(e.code) >= 0) {
      e.preventDefault();
      inputRelease(clock.heard(evTime(e)), 'k:' + e.code);
    }
  });

  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('button, input, .modal, .card.result, .title-box')) return;
    if (e.pointerType === 'touch') setTouchMode(true);
    if (state === 'story') {
      e.preventDefault();
      advanceStory();
      return;
    }
    if (state !== 'play' || modal || !playing()) return;
    e.preventDefault();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const g = game;
    const t = clock.heard(evTime(e));
    const dev = e.pointerType === 'mouse' ? 'mouse' : 'touch';
    const gs = { x: e.clientX, y: e.clientY, t: t, tp: performance.now(), applied: false, note: null, swiped: false, src: 'p:' + e.pointerId, dev: dev };
    gestures.set(e.pointerId, gs);
    const T = nextTarget(g);
    // 악질 앞에서는 스와이프일 수 있으니 손을 뗄 때까지 판정을 미룬다
    const defer = T && T.kind === 'swipe' && t / g.beatSec >= T.note.cue - 0.02;
    if (!defer) {
      gs.applied = true;
      gs.note = inputPress(t, gs.src, dev);
    }
  });
  window.addEventListener('pointermove', (e) => {
    const gs = gestures.get(e.pointerId);
    if (!gs || gs.swiped) return;
    const dx = e.clientX - gs.x;
    const dy = e.clientY - gs.y;
    const th = clamp(H * S * 0.04, 26, 56);
    if (Math.abs(dx) > th && Math.abs(dx) > Math.abs(dy) * 1.1) {
      gs.swiped = true;
      const g = game;
      if (!g || !playing()) return;
      const dir = dx > 0 ? 1 : -1;
      const heldMs = performance.now() - gs.tp;
      const t = heldMs > 140 ? clock.heard() - 0.04 : gs.t;
      if (gs.applied) convertToBan(g, gs.note, t / g.beatSec, dir);
      else inputSwipe(t, dir);
    }
  });
  function pointerEnd(e) {
    const gs = gestures.get(e.pointerId);
    if (!gs) return;
    gestures.delete(e.pointerId);
    if (!game) return;
    if (!gs.swiped && !gs.applied) {
      inputPress(gs.t, gs.src, gs.dev);
      inputRelease(clock.heard(), gs.src);
    } else if (gs.applied) {
      inputRelease(clock.heard(evTime(e)), gs.src);
    }
  }
  window.addEventListener('pointerup', pointerEnd);
  window.addEventListener('pointercancel', pointerEnd);
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  // 게임 중 더블탭 확대, 스크롤 방지
  stage.addEventListener(
    'touchstart',
    (e) => {
      if (state === 'play' && !(e.target.closest && e.target.closest('button, input'))) e.preventDefault();
    },
    { passive: false }
  );
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  /* 일시정지 */
  function pauseGame() {
    const g = game;
    if (state !== 'play' || !g || !clock.on || clock.paused || g.finished) return;
    if (g.hold) {
      const n = g.hold.note;
      g.hold = null;
      A.howlStop();
      finish(g, n, 'miss', 'short', g.b);
    }
    gestures.clear();
    clock.pause();
    openModal('modal-pause');
  }
  function resumeGame() {
    closeModal();
    clock.resume();
  }
  function togglePause() {
    if (modal === 'modal-pause') resumeGame();
    else if (!modal) pauseGame();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
  });
  window.addEventListener('blur', () => pauseGame());

  /* 버튼 */
  function on(id, fn) {
    $(id).addEventListener('click', (e) => {
      e.preventDefault();
      fn(e);
    });
  }
  on('#btn-start', () => startDay(Number($('#btn-start').dataset.day) || 1));
  $$('#days .day').forEach((el) => el.addEventListener('click', () => !el.disabled && startDay(Number(el.dataset.day))));
  on('#btn-skip-story', () => {
    A.click();
    endStory();
  });
  on('#btn-pause', () => {
    A.click();
    pauseGame();
  });
  on('#btn-skip-tut', () => {
    const g = game;
    if (!g || g.mode !== 'tutorial') return;
    A.click();
    save.tutDone[g.day] = true;
    persist();
    startMain(g.day);
  });
  on('#btn-resume', () => {
    A.click();
    resumeGame();
  });
  on('#btn-restart', () => {
    const g = game;
    if (!g) return;
    const day = g.day;
    const mode = g.mode;
    stopGame();
    A.resume().then(() => {
      A.click();
      if (mode === 'tutorial') startTutorial(day);
      else startMain(day);
    });
  });
  on('#btn-quit', () => {
    stopGame();
    A.resume().then(() => A.click());
    goTitle();
  });
  on('#btn-next', () => {
    if (!result) return;
    A.click();
    if (result.day < 3) startDay(result.day + 1);
    else playStory('ending', '엔딩', goTitle);
  });
  on('#btn-retry', () => {
    if (!result) return;
    A.click();
    startMain(result.day);
  });
  on('#btn-home', () => {
    A.click();
    goTitle();
  });
  on('#btn-settings', () => {
    unlockAudio().then(() => A.click());
    $('#rng-volume').value = String(Math.round(save.volume * 100));
    $('#rng-offset').value = String(save.offsetMs);
    syncSettings();
    openModal('modal-settings');
  });
  on('#btn-close-settings', () => {
    A.click();
    closeModal();
  });
  on('#btn-reset', () => {
    if (!window.confirm('진행 기록을 전부 지울까요?')) return;
    save.unlocked = 1;
    save.best = {};
    save.tutDone = {};
    save.cleared = false;
    persist();
    closeModal();
    goTitle();
  });
  function syncSettings() {
    $('#val-volume').textContent = Math.round(save.volume * 100) + '%';
    $('#val-offset').textContent = (save.offsetMs > 0 ? '+' : '') + save.offsetMs + 'ms';
  }
  $('#rng-volume').addEventListener('input', (e) => {
    save.volume = Number(e.target.value) / 100;
    A.setVolume(save.volume);
    syncSettings();
    persist();
  });
  $('#rng-volume').addEventListener('change', () => A.sign(true));
  $('#rng-offset').addEventListener('input', (e) => {
    save.offsetMs = Number(e.target.value);
    syncSettings();
    persist();
  });

  /* ================= 그리기 ================= */

  function queueAdv(g, b) {
    const ns = g.notes;
    let k = Math.min(g.arrK, ns.length);
    while (k < ns.length && ns[k].cue <= b) k++;
    while (k > 0 && ns[k - 1].cue > b) k--;
    g.arrK = k;
    let f = 0;
    const nx = ns[k];
    if (nx) {
      const u = (b - (nx.cue - 0.4)) / 0.4;
      if (u > 0) f = ease(u);
    }
    return k + f;
  }

  const FRONT = 1.18; // 책상 앞 시청자 크기
  const HEAD_Y = 566 + 300 * 1.18; // 책상 앞 시청자 머리 위 (바닥에서부터)

  /* 시청자 한 명이 지금 어디서 뭘 하고 있는지 */
  function fanView(g, n, b, adv) {
    const cx = W / 2;
    const hz = H - 1085;
    const baseY = H - 566;
    const v = { n: n, mood: 'idle', rot: 0, alpha: 1, layer: 'queue', atTable: false, signed: false, s: FRONT, x: cx, y: baseY, p: 0 };
    const leaveAt = n.result ? n.doneBeat + n.leaveDelay : Infinity;

    if (b < leaveAt) {
      const p = Math.max(0, n.i - adv + 1);
      const d = 1 / (1 + 0.45 * p);
      v.p = p;
      v.s = FRONT * d;
      v.y = hz + (baseY - hz) * d;
      v.x = cx + n.side * (170 + clamp((W - 720) / 900, 0, 1) * 80) * d * Math.min(1, p);
      v.alpha = clamp(5.4 - p, 0, 1) * clamp((b - n.born) / 0.5, 0, 1);
      v.atTable = p < 0.5 && b >= n.cue - 0.2;
      if (g.hold && g.hold.note === n) v.mood = 'howl';
      if (n.result) {
        if (n.how === 'signed' || n.how === 'photo' || n.how === 'howl') v.mood = 'happy';
        else if (n.how === 'wrong-sign' && n.type === 'troll') v.mood = 'laugh';
      }
      return v;
    }

    const u = (b - leaveAt) / n.leaveDur;
    if (u >= 1) return null;
    const dir = n.dir;
    const far = Math.min(W / 2 + 190, 720);
    if (W > 1200) v.alpha = clamp((1 - u) / 0.3, 0, 1);
    v.atTable = true;
    if (n.how === 'banned' || n.how === 'wrong-ban') {
      v.layer = 'fly';
      v.mood = 'shock';
      v.x = cx + dir * u * (far + 80);
      v.y = baseY - 560 * u + 300 * u * u;
      v.rot = dir * u * 7.5;
      v.s = FRONT * (1 - u * 0.25);
      return v;
    }
    const good = n.result !== 'miss';
    const w = u * (0.45 + 0.55 * u);
    v.x = cx + dir * w * far;
    if (good) {
      v.mood = 'happy';
      v.signed = n.type === 'paper';
      v.y = baseY - Math.abs(Math.sin(u * Math.PI * 3)) * 28;
    } else if (n.type === 'troll') {
      v.mood = 'laugh';
      v.y = baseY - Math.abs(Math.sin(u * Math.PI * 4)) * 18;
    } else {
      v.mood = 'sad';
    }
    return v;
  }

  function drawFanView(v, b, t) {
    const n = v.n;
    c.save();
    c.globalAlpha = v.alpha;
    const bob = v.layer === 'fly' ? 0 : Math.pow(1 - frac(b), 4);
    Art.fan(c, v.x, v.y, v.s, n.type, { mood: v.mood, bob: bob, t: t, atTable: v.atTable, signed: v.signed, rot: v.rot, seed: n.seed });
    c.restore();
  }

  function renderPlay(g, t) {
    const b = g.b;
    const cx = W / 2;
    const geom = Art.tableGeom(W, H);

    c.save();
    // 화면 흔들림
    if (!reduceMotion) {
      const su = (b - g.shakeBeat) / 0.4;
      if (su >= 0 && su < 1) c.translate(Math.sin(su * 40) * 9 * (1 - su), Math.cos(su * 33) * 5 * (1 - su));
    }

    Art.backdrop(c, W, H, t, { banner: g.mode === 'tutorial' ? '' : null });
    Art.sideDecor(c, W, H, t);

    // 줄 선 시청자들
    const adv = queueAdv(g, b);
    const views = [];
    while (g.firstVis < g.notes.length) {
      const n0 = g.notes[g.firstVis];
      if (n0.result && b >= n0.doneBeat + n0.leaveDelay + n0.leaveDur) g.firstVis++;
      else break;
    }
    for (let i = g.firstVis; i < g.notes.length; i++) {
      const n = g.notes[i];
      if (n.i - adv + 1 > 5.4) break;
      const v = fanView(g, n, b, adv);
      if (v) views.push(v);
    }
    for (let i = views.length - 1; i >= 0; i--) if (views[i].layer === 'queue') drawFanView(views[i], b, t);

    Art.table(c, W, H);

    // 책상 위 종이
    let front = null;
    for (let i = 0; i < views.length; i++) {
      const v = views[i];
      const n = v.n;
      if (v.layer !== 'queue' || v.p > 0.5) continue;
      const leaving = n.result && b >= n.doneBeat + n.leaveDelay;
      if (!leaving && !front) front = v;
      const needPaper = (n.type === 'paper' && b >= n.cue - 0.12 && !leaving) || (n.signBeat != null && !leaving);
      if (needPaper) {
        const k = n.type === 'paper' ? clamp((b - (n.cue - 0.12)) / 0.25, 0, 1) : 1;
        const sg = n.signBeat != null ? clamp((b - n.signBeat) / 0.28, 0.01, 1) : 0;
        Art.tablePaper(c, cx + 4, geom.y0 + 66, k, sg, n.how === 'wrong-sign' || n.result === 'good');
      }
    }

    for (let i = 0; i < views.length; i++) if (views[i].layer === 'fly') drawFanView(views[i], b, t);

    // 재원 (뒷모습)
    const pl = g.player;
    let anim = pl.anim;
    let u = (b - pl.b0) / pl.dur;
    if (g.hold) {
      anim = 'howl';
      u = (b - g.hold.b0) / 0.5;
    } else if (u >= 1) {
      anim = 'idle';
      u = 1;
    }
    const bob = Math.pow(1 - frac(b), 3) * 7;
    Art.jaewonBack(c, cx, H - 132, 1, { anim: anim, u: clamp(u, 0, 1), dir: pl.dir, bob: b < 0 ? 0 : bob, t: t });

    // 시청자 말풍선 / 타이밍 안내
    if (front) {
      const n = front.n;
      const headY = H - HEAD_Y;
      if (!n.result && b >= n.cue && b < n.cue + 0.9) {
        const k = clamp((b - n.cue) / 0.15, 0, 1);
        if (n.type === 'troll') Art.bubble(c, n.bubble, cx + 196, headY + 40, 42, { scale: k, dir: -1, seed: n.seed });
        else if (n.type === 'wolf') Art.bubble(c, '아우~?', cx + 204, headY + 30, 42, { scale: k, dir: -1, seed: n.seed });
        else if (n.type === 'phone') Art.bubble(c, '사진!', cx - 196, headY + 40, 42, { scale: k, dir: 1, seed: n.seed });
        else Art.bubble(c, '싸인!', cx + 196, headY + 40, 42, { scale: k, dir: -1, seed: n.seed });
      }
      if (g.mode === 'tutorial' && !n.result && b >= n.cue - 0.1) drawGuide(g, n, b);
    }

    // 하울링 글자
    if (g.hold) {
      const hb = b - g.hold.b0;
      const cnt = clamp(2 + Math.floor(hb / 0.25), 2, 8);
      const str = '아' + new Array(cnt).join('우') + '~';
      const size = 78 + Math.sin(t * 20) * 3;
      c.save();
      c.translate(cx, H - 985);
      c.rotate(Math.sin(t * 9) * 0.03);
      Art.text(c, str, 0, 0, size, { outline: '#fff', outlineW: 16 });
      c.restore();
    }

    drawFx(g, b, t);
    c.restore();

    // 플래시
    const fu = (b - g.flashBeat) / 0.3;
    if (fu >= 0 && fu < 1) {
      c.fillStyle = 'rgba(255,255,255,' + (reduceMotion ? 0.3 : 0.9) * (1 - fu) + ')';
      c.fillRect(0, 0, W, H);
    }

    drawLegend(g);
    drawHud(g, b);
  }

  /* 튜토리얼 타이밍 고리 */
  function drawGuide(g, n, b) {
    const x = W / 2 - 236;
    const y = H - 640;
    const info = D.types[n.type];
    c.save();
    Art.shape(c, Art.ell(x, y, 66, 66, 14), { fill: '#fff', lw: 5, seed: 900, amp: 1 });
    for (let i = 0; i < n.hits.length; i++) {
      const k = n.hits[i].beat - b;
      if (k > 0 && k <= 1) Art.ring(c, x, y, 66, k, Art.RED);
    }
    if (n.type === 'wolf' && g.hold && g.hold.note === n) {
      const k = clamp((b - (n.cue + 1)) / 2, 0, 1);
      c.strokeStyle = Art.RED;
      c.lineWidth = 12;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(x, y, 66, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
      c.stroke();
    }
    const near = n.hits.some((h) => Math.abs(h.beat - b) < 0.12);
    Art.text(c, touchMode ? info.promptTouch : info.prompt, x, y + 2, near ? 46 : 40, { bold: true, weight: 400, color: near ? Art.RED : Art.INK });
    c.restore();
  }

  function drawFx(g, b, t) {
    const keep = [];
    for (let i = 0; i < g.fx.length; i++) {
      const f = g.fx[i];
      const u = (b - f.b0) / f.dur;
      if (u >= 1) continue;
      keep.push(f);
      if (u < 0) continue;
      const pop = u < 0.12 ? 0.5 + (u / 0.12) * 0.62 : 1.12 - Math.min(0.12, (u - 0.12) * 0.8);
      const fade = u > 0.72 ? (1 - u) / 0.28 : 1;
      c.save();
      switch (f.type) {
        case 'text':
          c.globalAlpha = fade;
          Art.text(c, f.str, f.x, f.y - (f.rise || 0) * u, f.size * pop, { color: f.color, bold: f.bold, weight: f.bold ? 400 : 700, rot: f.rot, outline: '#fffdf6', outlineW: f.size * 0.26 });
          break;
        case 'cap':
          c.globalAlpha = fade;
          Art.caption(c, f.str, f.x, f.y, f.size, { scale: pop, rot: -0.03, seed: 7 });
          break;
        case 'bubble':
          c.globalAlpha = fade;
          Art.bubble(c, f.str, f.x, f.y, f.size, { scale: pop, dir: f.dir });
          break;
        case 'heart':
          c.globalAlpha = fade;
          Art.heart(c, f.x + f.vx * u * 60 + Math.sin(u * 9 + f.x) * 8, f.y - f.vy * u * 150, f.r * pop);
          break;
        case 'stamp':
          Art.stamp(c, f.x, f.y, f.str, u, f.rot);
          break;
        case 'pola':
          Art.polaroid(c, f.x, f.y, u, f.good, t, f.rot);
          break;
        case 'swipe':
          Art.swipeLines(c, W / 2, H - 700, f.dir, u);
          break;
      }
      c.restore();
    }
    g.fx = keep;
  }

  /* 조작 안내 (화면 아래 양쪽) */
  function drawLegend(g) {
    const types = D.days[g.day].types;
    const has = (k) => types.indexOf(k) >= 0;
    const wide = W > 1200 && !touchMode;
    const txt = touchMode
      ? { paper: ['싸인', '탭'], phone: ['찰칵찰칵', '탭 탭'], troll: ['밴', '스와이프'], wolf: ['아우우우', '꾹 누르기'] }
      : { paper: ['싸인', '클릭'], phone: ['찰칵찰칵', '스페이스 2번'], troll: ['밴', '누른 채 휙'], wolf: ['아우우우', '스페이스 꾹'] };
    const icon = { paper: 'click', troll: 'swipe', phone: 'space', wolf: 'hold' };
    const cw = wide ? 356 : 240;
    const ch = wide ? 108 : 100;
    const draw = (list, x0, title) => {
      if (!list.length) return;
      list.forEach((k, i) => {
        const y0 = H - 16 - (list.length - i) * (ch + 10);
        c.save();
        c.translate(x0, y0);
        Art.shape(c, [[0, 0], [cw, 2], [cw - 2, ch], [2, ch - 2]], { fill: 'rgba(255,255,255,0.92)', lw: 4, seed: 950 + i, amp: 1.2, poly: true });
        c.save();
        c.beginPath();
        c.rect(4, 4, 70, ch - 8);
        c.clip();
        Art.fan(c, 40, ch + 26, 0.3, k, { seed: 3, t: 0 });
        c.restore();
        Art.text(c, txt[k][0], 84, ch * 0.34, 34, { align: 'left', bold: true, weight: 400 });
        Art.text(c, txt[k][1], 84, ch * 0.71, 28, { align: 'left', color: Art.RED });
        if (wide) Art.icon(c, icon[k], cw - 58, ch / 2, 1);
        c.restore();
      });
      if (title) Art.caption(c, title, x0 + 62, H - 16 - list.length * (ch + 10) - 26, 32, { rot: -0.03, seed: 960 });
    };
    if (wide) {
      // 왼손 키보드, 오른손 마우스
      draw(['phone', 'wolf'].filter(has), W / 2 - 190 - cw, '키보드');
      draw(['paper', 'troll'].filter(has), W / 2 + 190, '마우스');
    } else {
      draw(['paper', 'phone'].filter(has), 12);
      draw(['troll', 'wolf'].filter(has), W - 12 - cw);
    }
  }

  function drawHud(g, b) {
    const label = D.days[g.day].label + (g.mode === 'tutorial' ? ' 연습' : '');
    c.save();
    c.font = '400 44px ' + Art.FONT_BOLD;
    const lw = c.measureText(label).width + 22;
    Art.caption(c, label, 22 + lw / 2, 58, 44, { rot: -0.03, seed: 11 });

    if (g.mode === 'main') {
      // 진행 막대
      const x0 = 22 + lw + 28;
      const x1 = W - 110;
      const y = 58;
      const k = clamp((b - g.lead) / (g.endBeat - g.lead), 0, 1);
      Art.line(c, [[x0, y], [(x0 + x1) / 2, y + 2], [x1, y]], { lw: 8, stroke: '#ddd', seed: 12, amp: 0.6 });
      if (k > 0) Art.line(c, [[x0, y], [x0 + (x1 - x0) * k, y]], { lw: 8, stroke: Art.RED, seed: 13, amp: 0.4 });
      Art.heart(c, x0 + (x1 - x0) * k, y, 13);

      const cb = g.stats.combo;
      if (cb >= 3) {
        const cu = clamp((b - g.comboBeat) / 0.25, 0, 1);
        Art.text(c, cb + ' 콤보', Math.min(W - 104, W / 2 + 520), H - 968, 54 * (1.25 - 0.25 * cu), { color: Art.INK, outline: '#fffdf6', outlineW: 12, rot: 0.07 });
      }
    }

    // 시작 카운트
    if (b >= 0 && b < g.lead) {
      const i = Math.floor(b);
      const k = frac(b);
      const words = ['하나', '둘', '셋', '넷'];
      c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      Art.caption(c, words[i] || '', W / 2, H * 0.36, 120, { scale: 1.25 - 0.25 * ease(k * 4), rot: i % 2 ? 0.04 : -0.04, seed: 20 + i });
    }
    c.restore();
  }

  /* --- 타이틀 --- */
  function renderTitle(t) {
    const cx = W / 2;
    c.fillStyle = '#fffdf6';
    c.fillRect(0, 0, W, H);
    const tall = clamp((H - 1280) / 280, 0, 1);
    const top = H * 0.06 + tall * 96;
    Art.caption(c, '김재원', cx, top + 60, 124, { rot: -0.045, seed: 31 });
    Art.caption(c, '팬미팅 연습게임', cx, top + 196, 84, { rot: 0.025, seed: 32 });

    const baseY = H - 424;
    const bounce = Math.abs(Math.sin(t * 3.2)) * 16;
    Art.fan(c, cx - 246, baseY + 92, 0.62, 'paper', { t: t, seed: 1, bob: Math.pow(1 - frac(t * 1.6), 3) });
    Art.fan(c, cx + 246, baseY + 92, 0.62, 'phone', { t: t, seed: 2, bob: Math.pow(1 - frac(t * 1.6 + 0.5), 3) });
    if (W > 1200) {
      Art.fan(c, cx - 500, baseY + 92, 0.62, 'troll', { t: t, seed: 3, bob: Math.pow(1 - frac(t * 1.6 + 0.25), 3) });
      Art.fan(c, cx + 500, baseY + 92, 0.62, 'wolf', { t: t, seed: 4, bob: Math.pow(1 - frac(t * 1.6 + 0.75), 3) });
    }
    Art.jaewon(c, cx, baseY - bounce, 0.98 + tall * 0.2, 'yaho1', t, { blink: frac(t * 0.31) > 0.94 });
    Art.text(c, '어케했누?', cx - 232, baseY - 300, 46, { rot: -0.1 });
    Art.text(c, '야호', cx + 236, baseY - 318, 52, { rot: 0.12 });
  }

  /* --- 스토리 --- */
  function renderStory(t) {
    const cx = W / 2;
    c.fillStyle = '#fffdf6';
    c.fillRect(0, 0, W, H);
    const ln = story.lines[story.i];
    c.font = '400 52px ' + Art.FONT_BOLD;
    const lw = c.measureText(story.label).width + 26;
    Art.caption(c, story.label, 24 + lw / 2, 64, 52, { rot: -0.03, seed: 41 });

    const dialogTop = H - (2 + 15.5) * 16 - 40;
    const sc = clamp((dialogTop - 150) / 520, 0.9, 1.5);
    const baseY = dialogTop - 150 * sc + 120;
    const talking = ln.who === '재원' && story.shown < ln.text.length;
    if (ln.scene) {
      renderScene(ln, t, dialogTop);
      Art.caption(c, story.label, 24 + lw / 2, 64, 52, { rot: -0.03, seed: 41 });
      return;
    }
    if (story.key === 'ending' && ln.who === '시청자들') {
      const ks = ['paper', 'troll', 'phone', 'wolf'];
      ks.forEach((k, i) => {
        const x = cx + (i - 1.5) * (W / 4.4);
        const fy = Math.max(baseY - 330 * sc, 170 + 215 * sc) + (i % 2) * 40;
        Art.fan(c, x, fy, 0.5 * sc, k, { t: t, seed: i + 1, mood: k === 'troll' ? 'idle' : 'happy', bob: Math.pow(1 - frac(t * 2 + i * 0.25), 3) });
        Art.text(c, '어케했누?', x, fy - 215 * sc - 6, 34 * sc, { rot: (i - 1.5) * 0.06 });
      });
    }
    Art.jaewon(c, cx, baseY, sc, ln.pose || 'down', t, { long: true, open: talking && frac(t * 5) > 0.5, blink: frac(t * 0.27) > 0.95 });
  }

  /* 엔딩 컷씬 장면 (몸살 난 밤, 팬카페 공지). 같은 장면이 이어지면 애니메이션도 이어진다 */
  function renderScene(ln, t, dialogTop) {
    const key = ln.scene + ':' + (ln.step || '');
    const now = performance.now();
    if (story.sceneKey !== key) {
      story.sceneKey = key;
      story.sceneT0 = now;
      story.sfx = { clicked: false, comments: 0, stamped: false };
    }
    const el = (now - story.sceneT0) / 1000;
    if (ln.scene === 'sick') {
      Art.sickBed(c, W, H, t, dialogTop);
    } else if (ln.scene === 'cafe') {
      const ev = Art.cafe(c, W, H, t, { step: ln.step, el: el, bottom: dialogTop, data: D.cafe });
      const fx = story.sfx;
      if (ev.clicked && !fx.clicked) A.click();
      if (ev.comments > fx.comments) A.blip();
      if (ev.stamped && !fx.stamped) A.ban(true);
      fx.clicked = ev.clicked;
      fx.comments = ev.comments;
      fx.stamped = ev.stamped;
    }
  }

  /* --- 결과 --- */
  function renderResult(t) {
    const cx = W / 2;
    c.fillStyle = '#fffdf6';
    c.fillRect(0, 0, W, H);
    const r = result;
    const k = clamp((performance.now() - r.t0) / 350, 0, 1);
    const gr = r.grade;
    const cardTop = H - 2 * 16 - 500;
    const baseY = Math.min(cardTop - 110, H * 0.56);
    if (gr.id === 'F') {
      Art.jaewon(c, cx - 30, baseY - 30, 1, 'lie', t, {});
      Art.text(c, gr.caption, cx - 150, baseY - 330, 78, { rot: -0.08 });
      Art.text(c, gr.caption, cx + 170, baseY - 250, 50, { rot: 0.1, color: '#666' });
    } else {
      const bounce = gr.id === 'S' ? Math.abs(Math.sin(t * 6)) * 22 : gr.id === 'A' ? Math.abs(Math.sin(t * 4)) * 14 : 0;
      Art.jaewon(c, cx, baseY - bounce, 1, gr.pose, t, { open: gr.id === 'S' });
      Art.caption(c, gr.caption, cx, Math.max(96, baseY - 540), gr.id === 'S' ? 84 : 96, { scale: 0.6 + 0.4 * ease(k), rot: -0.03, seed: 51 });
      if (gr.id === 'S') {
        for (let i = 0; i < 6; i++) {
          const a = t * 1.4 + i * 1.05;
          Art.heart(c, cx + Math.cos(a) * (W * 0.36), baseY - 240 + Math.sin(a * 1.3) * 150, 16 + (i % 3) * 5);
        }
      }
    }
  }

  /* ================= 메인 루프 ================= */
  function frame() {
    const now = performance.now();
    const t = now / 1000;
    Art.setBoil(Math.floor(t * 7));
    c.setTransform(S * DPR, 0, 0, S * DPR, 0, 0);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    try {
      if (state === 'title') renderTitle(t);
      else if (state === 'story' && story) {
        updateStory();
        if (story) renderStory(t);
      } else if (state === 'play' && game) {
        updatePlay(game);
        if (game && state === 'play') renderPlay(game, t);
      } else if (state === 'result' && result) renderResult(t);
    } catch (err) {
      if (!frame.err) {
        frame.err = true;
        console.error(err);
      }
    }
    requestAnimationFrame(frame);
  }

  /* 점검용 바로가기: ?auto=1&day=2&mode=main */
  FM.debug.start = function (day, mode) {
    A.init();
    A.setVolume(save.volume);
    if (mode === 'tutorial') startTutorial(day);
    else startMain(day);
  };
  FM.debug.state = () => ({ state: state, b: game ? game.b : null, stats: game ? game.stats : null, result: result, tut: game ? game.tut : null });
  FM.debug.peek = () => {
    const g = game;
    if (!g) return null;
    const T = nextTarget(g);
    return { b: clock.heard() / g.beatSec, beatSec: g.beatSec, next: T ? { beat: T.beat, kind: T.kind, type: T.note.type, holdEnd: T.note.holdEnd || null } : null, finished: g.finished };
  };
  FM.debug.story = (key) => playStory(key, key === 'ending' ? '엔딩' : D.days[key].label, goTitle);

  goTitle();
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('auto')) FM.debug.auto = true;
    if (q.get('sloppy')) FM.debug.sloppy = Number(q.get('sloppy'));
    if (q.get('day')) FM.debug.start(Number(q.get('day')), q.get('mode') || 'main');
    else if (q.get('story')) FM.debug.story(q.get('story'));
  } catch (e) {
    /* 무시 */
  }
  if (document.fonts && document.fonts.load) {
    document.fonts.load('400 40px Jua');
    document.fonts.load('700 40px Gaegu');
  }
  requestAnimationFrame(frame);
})();
