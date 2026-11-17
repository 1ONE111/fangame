/* 김재원 팬미팅 연습게임 - 그림 (캔버스에 손그림 느낌으로 직접 그림) */
(function () {
  'use strict';
  const FM = (window.FM = window.FM || {});
  const Art = (FM.art = {});

  const INK = '#161616';
  const RED = '#e60012';
  const WHITE = '#ffffff';
  Art.INK = INK;
  Art.RED = RED;
  Art.FONT_HAND = '"Gaegu", "Jua", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  Art.FONT_BOLD = '"Jua", "Gaegu", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';

  /* ---------- 손떨림 선 ---------- */
  let boil = 0;
  Art.setBoil = function (n) {
    boil = n;
  };
  function hash(n) {
    const x = Math.sin(n * 127.1 + boil * 269.5 + 11.3) * 43758.5453;
    return x - Math.floor(x);
  }
  function jit(seed, amp) {
    return (hash(seed) - 0.5) * 2 * amp;
  }
  function wob(pts, seed, amp) {
    if (!amp) return pts;
    const out = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) {
      out[i] = [pts[i][0] + jit(seed + i * 2.13, amp), pts[i][1] + jit(seed + i * 2.13 + 0.77, amp)];
    }
    return out;
  }
  function trace(c, pts, closed) {
    const n = pts.length;
    if (n < 2) return;
    if (closed) {
      const p0 = pts[n - 1];
      const p1 = pts[0];
      c.moveTo((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);
      for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
      c.closePath();
    } else {
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      }
      c.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
  }
  function tracePoly(c, pts) {
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
  }
  /* 채워진 도형 */
  function shape(c, pts, o) {
    o = o || {};
    const P = wob(pts, o.seed || 1, o.amp == null ? 1.5 : o.amp);
    c.beginPath();
    if (o.poly) tracePoly(c, P);
    else trace(c, P, o.closed !== false);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    if (o.fill) {
      c.fillStyle = o.fill;
      c.fill();
    }
    if (o.stroke !== null) {
      c.strokeStyle = o.stroke || INK;
      c.lineWidth = o.lw || 5;
      c.stroke();
    }
    return P;
  }
  function line(c, pts, o) {
    o = o || {};
    const P = wob(pts, o.seed || 1, o.amp == null ? 1.2 : o.amp);
    c.beginPath();
    trace(c, P, false);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = o.stroke || INK;
    c.lineWidth = o.lw || 5;
    c.stroke();
  }
  /* 테두리 있는 대롱 (팔, 다리) */
  function tube(c, pts, w, o) {
    o = o || {};
    const lw = o.lw || 5;
    const P = wob(pts, o.seed || 1, o.amp == null ? 1.4 : o.amp);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    trace(c, P, false);
    c.strokeStyle = o.stroke || INK;
    c.lineWidth = w + lw * 2;
    c.stroke();
    c.beginPath();
    trace(c, P, false);
    c.strokeStyle = o.fill || WHITE;
    c.lineWidth = w;
    c.stroke();
  }
  /* 몸통과 이어지는 대롱: 몸통 안쪽으로는 테두리를 그리지 않는다 */
  function limb(c, bodyP, pts, w, o) {
    o = o || {};
    const lw = o.lw || 5;
    const P = wob(pts, o.seed || 1, o.amp == null ? 1.4 : o.amp);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.save();
    c.beginPath();
    c.rect(-4000, -4000, 8000, 8000);
    trace(c, bodyP, true);
    c.clip('evenodd');
    c.beginPath();
    trace(c, P, false);
    c.strokeStyle = o.stroke || INK;
    c.lineWidth = w + lw * 2;
    c.stroke();
    c.restore();
    c.beginPath();
    trace(c, P, false);
    c.strokeStyle = o.fill || WHITE;
    c.lineWidth = w;
    c.stroke();
  }
  function ell(cx, cy, rx, ry, n, pow) {
    n = n || 12;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      let x = Math.cos(a);
      let y = Math.sin(a);
      if (pow) {
        x = Math.sign(x) * Math.pow(Math.abs(x), pow);
        y = Math.sign(y) * Math.pow(Math.abs(y), pow);
      }
      pts.push([cx + x * rx, cy + y * ry]);
    }
    return pts;
  }
  function dot(c, x, y, r, col) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = col || INK;
    c.fill();
  }
  Art.shape = shape;
  Art.line = line;
  Art.tube = tube;
  Art.ell = ell;
  Art.dot = dot;

  /* ---------- 글자 ---------- */
  Art.text = function (c, str, x, y, size, o) {
    o = o || {};
    c.save();
    c.translate(x, y);
    if (o.rot) c.rotate(o.rot);
    c.font = (o.weight || 700) + ' ' + size + 'px ' + (o.bold ? Art.FONT_BOLD : Art.FONT_HAND);
    c.textAlign = o.align || 'center';
    c.textBaseline = o.base || 'middle';
    if (o.outline) {
      c.lineJoin = 'round';
      c.strokeStyle = o.outline;
      c.lineWidth = o.outlineW || size * 0.22;
      c.strokeText(str, 0, 0);
    }
    c.fillStyle = o.color || INK;
    c.fillText(str, 0, 0);
    c.restore();
  };

  /* 검은 상자 자막 ("야호" 스타일) */
  Art.caption = function (c, str, x, y, size, o) {
    o = o || {};
    c.save();
    c.translate(x, y);
    if (o.rot) c.rotate(o.rot);
    if (o.scale) c.scale(o.scale, o.scale);
    c.font = '400 ' + size + 'px ' + Art.FONT_BOLD;
    const w = c.measureText(str).width + size * 0.5;
    const h = size * 1.28;
    const sd = o.seed || 3;
    shape(
      c,
      [
        [-w / 2, -h / 2],
        [0, -h / 2 - 2],
        [w / 2, -h / 2],
        [w / 2 + 3, 0],
        [w / 2, h / 2],
        [0, h / 2 + 2],
        [-w / 2, h / 2],
        [-w / 2 - 3, 0],
      ],
      { fill: o.bg || '#0c0c0c', stroke: null, seed: sd, amp: 2.2, poly: true }
    );
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = o.color || '#fff';
    c.fillText(str, 0, size * 0.06);
    c.restore();
    return w;
  };

  /* 말풍선 */
  Art.bubble = function (c, str, x, y, size, o) {
    o = o || {};
    c.save();
    c.translate(x, y);
    if (o.scale != null) c.scale(o.scale, o.scale);
    c.font = '700 ' + size + 'px ' + Art.FONT_HAND;
    const w = Math.max(c.measureText(str).width + size * 0.9, size * 2);
    const h = size * 1.5;
    const pts = ell(0, 0, w / 2, h / 2, 12, 0.72);
    shape(c, pts, { fill: '#fff', lw: 4, seed: o.seed || 5, amp: 1.6 });
    const dir = o.dir || -1;
    shape(
      c,
      [
        [dir * w * 0.12, h * 0.38],
        [dir * w * 0.3, h * 0.82],
        [dir * w * 0.3, h * 0.36],
      ],
      { fill: '#fff', lw: 4, seed: 9, amp: 1, poly: true }
    );
    c.fillStyle = '#fff';
    c.fillRect(dir * w * 0.12 - 4, h * 0.2, 24 * (dir > 0 ? 1 : 1), 12);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = o.color || INK;
    c.fillText(str, 0, size * 0.04);
    c.restore();
  };

  /* 빨간 입술 - 왼쪽 볼록은 넓고 납작, 오른쪽 볼록은 둥글고 높다. 가운데는 깊게 V자로 파인다.
     (x, y) = 입술 가로 가운데, 윗입술과 아랫입술이 만나는 선. w = 입술 폭의 절반 */
  function lips(c, x, y, w, open, seed) {
    const P = (nx, ny) => [x + nx * w, y + ny * w];
    const gap = open ? w * 0.3 : 0;
    // 벌릴 때 아랫입술은 입꼬리는 그대로, 가운데만 내려간다
    const drop = (nx) => gap * Math.max(0, 1 - nx * nx);
    const D = (nx, ny) => P(nx, ny + drop(nx) / w);
    const notch = P(0.19, -0.29);
    const R = P(0.96, 0);
    // 윗입술 아래 선 (= 다물었을 때 입술 사이 선)
    const midTop = [P(0.4, 0.01 + gap * 0.08 / w), P(-0.4, 0.01 + gap * 0.1 / w)];
    // 아랫입술 위 선
    const midBot = [D(0.4, 0.01), D(-0.4, 0.01)];
    const upper = [
      P(-0.86, 0.01),
      P(-0.99, -0.02),
      P(-0.99, -0.3),
      P(-0.88, -0.57),
      P(-0.66, -0.69),
      P(-0.3, -0.7),
      P(0, -0.68),
      P(0.08, -0.6),
      notch,
      notch,
      P(0.25, -0.6),
      P(0.38, -0.76),
      P(0.64, -0.84),
      P(0.86, -0.74),
      P(0.99, -0.48),
      P(1, -0.18),
      R,
      R,
    ].concat(midTop);
    const lower = [
      D(-0.82, 0.01),
      D(-0.82, 0.01),
      D(-0.73, 0.19),
      D(-0.58, 0.36),
      D(-0.3, 0.47),
      D(0.3, 0.47),
      D(0.7, 0.4),
      D(0.9, 0.24),
      D(0.97, 0.04),
      D(0.97, 0.04),
    ].concat(midBot);
    if (open) {
      shape(c, [P(-0.9, 0.01), P(-0.9, 0.01)].concat(midTop.slice().reverse(), [R, R], midBot), {
        fill: '#fff',
        lw: 2.5,
        seed: seed + 3,
        amp: 0.4,
      });
    }
    shape(c, lower, { fill: RED, lw: 2.8, seed: seed + 1, amp: 0.5 });
    shape(c, upper, { fill: RED, lw: 2.8, seed: seed + 2, amp: 0.5 });
  }

  /* 머리 윤곽 - 옆으로 넓은 덩어리. 위는 판판하게 넓고, 아래는 왼쪽으로 살짝 쏠려 좁아진다.
     (cx, cy) = 머리 가운데. mirror = 뒷모습이면 좌우 뒤집기 */
  const HEAD = [
    [0.02, -1], [0.4, -0.96], [0.65, -0.865], [0.805, -0.75], [0.925, -0.53], [0.986, -0.3],
    [1, -0.05], [0.97, 0.15], [0.94, 0.27], [0.83, 0.483], [0.644, 0.708], [0.405, 0.933],
    [-0.06, 1], [-0.35, 0.933], [-0.62, 0.82], [-0.795, 0.708], [-0.91, 0.596], [-0.976, 0.37],
    [-1, 0.034], [-0.976, -0.3], [-0.91, -0.53], [-0.79, -0.75], [-0.635, -0.865], [-0.38, -0.96],
  ];
  function headPts(cx, cy, hw, hh, mirror) {
    const m = mirror ? -1 : 1;
    return HEAD.map((p) => [cx + p[0] * hw * m, cy + p[1] * hh]);
  }

  /* ---------- 김재원 캐릭터 (정면) ----------
     (x, y) = 몸통 아래 가운데. pose: down | yaho1 | yaho2 | yaho3 | think | shrug | lie | vsign */
  Art.jaewon = function (c, x, y, s, pose, t, o) {
    o = o || {};
    t = t || 0;
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    if (pose === 'lie') {
      c.translate(40, -70);
      c.rotate(-1.25);
    }
    const sd = 100;
    const bottom = o.long ? 420 : 0;
    // 머리: 옆으로 넓은 덩어리. 몸통 위에 얹는다
    const HX = 0;
    const HY = -232;
    const HW = 112;
    const HH = 95;
    const body = wob(
      [
        [-50, bottom],
        [-52, -80],
        [-56, -128],
        [-50, -160],
        [-28, -178],
        [0, -182],
        [28, -178],
        [50, -160],
        [56, -128],
        [52, -80],
        [50, bottom],
        [0, bottom + 6],
      ],
      sd,
      1.6
    );

    // 다리
    if (!o.long) {
      const lk = pose === 'lie' ? 14 : 0;
      tube(c, [[-24, -14], [-27, 40], [-30 - lk, 82]], 30, { seed: sd + 40 });
      tube(c, [[24, -14], [27, 40], [30 + lk * 2, 82 - lk]], 30, { seed: sd + 44 });
    }

    c.beginPath();
    trace(c, body, true);
    c.fillStyle = WHITE;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 5;
    c.lineJoin = 'round';
    c.stroke();
    if (!o.long) {
      // 다리와 몸통 이음새 지우기
      c.fillStyle = WHITE;
      c.fillRect(-38, -12, 28, 16);
      c.fillRect(10, -12, 28, 16);
    }

    // 팔 (머리가 넓어서 위로 드는 팔은 머리 바깥으로 돌려 올린다)
    const AW = 24;
    const sw = Math.sin(t * 7);
    const sw2 = Math.sin(t * 7 + 1.7);
    const arm = (pts, seed, amp) => limb(c, body, pts, AW, { seed: seed, amp: amp });
    if (pose === 'yaho1') {
      arm([[-50, -140], [-112, -152], [-142, -222], [-146 + sw * 4, -330], [-140 + sw * 9, -440]], sd + 10);
      arm([[50, -140], [112, -152], [142, -222], [146 + sw2 * 4, -330], [140 + sw2 * 9, -440]], sd + 14);
    } else if (pose === 'yaho2') {
      const wv = (i, ph) => Math.sin(t * 9 + i * 1.3 + ph) * 16;
      arm([[-50, -140], [-112, -152], [-152 + wv(0, 0), -224], [-132 + wv(1, 0), -300], [-158 + wv(2, 0), -370], [-136 + wv(3, 0), -440]], sd + 10);
      arm([[50, -140], [112, -152], [152 + wv(0, 2), -224], [132 + wv(1, 2), -300], [158 + wv(2, 2), -370], [136 + wv(3, 2), -440]], sd + 14);
    } else if (pose === 'yaho3') {
      for (let k = 0; k < 3; k++) {
        const ph = k * 2.1;
        const sp = 46 * k;
        const wv = (i) => Math.sin(t * 13 + i * 1.5 + ph) * (20 + k * 6);
        const L = [[-50, -140], [-118 - sp * 0.5 + wv(0), -160 - k * 4], [-156 - sp + wv(1), -240], [-138 - sp * 0.9 + wv(2), -325], [-160 - sp * 1.1 + wv(3), -412 + k * 22]];
        const Rr = [[50, -140], [118 + sp * 0.5 + wv(4), -160 - k * 4], [156 + sp + wv(5), -240], [138 + sp * 0.9 + wv(6), -325], [160 + sp * 1.1 + wv(7), -412 + k * 22]];
        arm(L, sd + 10 + k * 7, 4);
        arm(Rr, sd + 14 + k * 7, 4);
        // 털 같은 떨림선
        [L, Rr].forEach((pts, si) => {
          for (let i = 1; i < pts.length; i++) {
            const p = pts[i];
            const q = pts[i - 1];
            for (let m = 0; m < 3; m++) {
              const u = (m + 0.5) / 3;
              const px = q[0] + (p[0] - q[0]) * u;
              const py = q[1] + (p[1] - q[1]) * u;
              const side = si === 0 ? -1 : 1;
              line(c, [[px + side * 14, py], [px + side * (24 + jit(sd + i * 9 + m + k * 31, 5)), py - 6]], { lw: 2.5, seed: sd + 60 + i * 5 + m + k * 13, amp: 2 });
            }
          }
        });
      }
    } else if (pose === 'think') {
      arm([[-50, -140], [-118, -160], [-146, -226], [-122 + sw * 3, -290 + sw * 4]], sd + 10);
      arm([[50, -140], [66, -92], [62, -44]], sd + 14);
    } else if (pose === 'shrug') {
      const up = sw * 4;
      arm([[-50, -140], [-110, -126], [-136, -178 + up]], sd + 10);
      arm([[50, -140], [110, -126], [136, -178 + up]], sd + 14);
      [-1, 1].forEach((sgn) => {
        for (let f = -1; f <= 1; f++) {
          line(c, [[sgn * 136 + f * 8, -190 + up], [sgn * 136 + f * 15, -208 + up]], { lw: 4, seed: sd + 70 + f + sgn * 3, amp: 0.8 });
        }
      });
    } else if (pose === 'vsign') {
      arm([[-50, -140], [-114, -158], [-148, -224]], sd + 10);
      line(c, [[-152, -234], [-164, -266]], { lw: 5, seed: sd + 71 });
      line(c, [[-144, -234], [-136, -268]], { lw: 5, seed: sd + 72 });
      arm([[50, -140], [66, -92], [62, -44]], sd + 14);
    } else if (pose === 'lie') {
      tube(c, [[-50, -136], [-20, -108], [26, -114]], AW, { seed: sd + 10 });
      arm([[50, -136], [70, -95], [64, -50]], sd + 14);
    } else {
      arm([[-50, -138], [-66, -92], [-62, -44]], sd + 10);
      arm([[50, -138], [66, -92], [62, -44]], sd + 14);
    }

    // 머리
    shape(c, headPts(HX, HY, HW, HH), { fill: WHITE, lw: 5, seed: sd + 50, amp: 1.2 });

    // 얼굴: 길고 가는 눈썹(안쪽 끝만 살짝 꺾임), 콕 찍은 작은 눈, 아래쪽 큰 빨간 입술.
    // 전부 왼쪽으로 조금 치우쳐 있다
    const F = (px, py) => [HX + px, HY + py];
    line(c, [F(-95, -25), F(-40, -23), F(-19, -21), F(-12, -17)], { lw: 3.2, seed: sd + 20, amp: 0.5 });
    line(c, [F(94, -22), F(32, -21), F(24, -19), F(21, -13)], { lw: 3.2, seed: sd + 23, amp: 0.5 });
    if (o.blink) {
      line(c, [F(-55, -4), F(-46, -4)], { lw: 3.2, seed: sd + 21, amp: 0.3 });
      line(c, [F(28, 0), F(37, 0)], { lw: 3.2, seed: sd + 22, amp: 0.3 });
    } else {
      line(c, [F(-49, -9), F(-51, -1)], { lw: 3.6, seed: sd + 21, amp: 0.3 });
      line(c, [F(33, -5), F(32, 3)], { lw: 3.6, seed: sd + 22, amp: 0.3 });
    }
    const open = pose === 'shrug' || o.open;
    lips(c, HX - 9, HY + (open ? 57 : 65), 41, open, sd + 30);
    c.restore();
  };

  /* ---------- 김재원 (뒷모습, 게임 화면) ----------
     (x, y) = 의자 앉는 면 가운데.
     st: { anim, u(0..1), dir, bob, held } */
  Art.jaewonBack = function (c, x, y, s, st) {
    st = st || {};
    const anim = st.anim || 'idle';
    const u = st.u == null ? 1 : st.u;
    const bob = st.bob || 0;
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    const sd = 300;

    // 의자
    line(c, [[-46, 6], [-58, 92]], { lw: 5, seed: sd + 1 });
    line(c, [[46, 6], [58, 92]], { lw: 5, seed: sd + 2 });
    line(c, [[-52, 58], [52, 58]], { lw: 4, seed: sd + 3 });
    // 다리
    tube(c, [[-28, -6], [-34, 44], [-38, 86]], 26, { seed: sd + 5 });
    tube(c, [[28, -6], [34, 44], [38, 86]], 26, { seed: sd + 6 });
    shape(c, ell(0, 4, 78, 15, 10), { fill: '#fff', seed: sd + 7, amp: 1.2 });

    // 팔 (책상 쪽으로 뻗음 = 화면 위쪽)
    let hy = bob * 0.4;
    let L = [[-46, -122 + hy], [-112, -236], [-138, -366]];
    let Rr = [[46, -122 + hy], [112, -236], [138, -366]];
    let headDx = 0;
    let headDy = -bob;
    let headRot = 0;
    let headSq = 1;
    let extra = null;

    if (anim === 'sign') {
      const k = Math.min(1, u * 5);
      const sc = u < 0.8 ? 1 : 0;
      const hx = 30 + Math.sin(u * 34) * 26 * sc;
      const hyy = -410 + Math.cos(u * 27) * 7 * sc;
      Rr = [[46, -122], [118 - 20 * k, -250], [138 + (hx - 138) * k, -366 + (hyy + 366) * k]];
      extra = 'pen';
      headDx = 4 * k;
      headRot = 0.03 * k;
    } else if (anim === 'ban') {
      const d = st.dir || 1;
      const k = Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5);
      const back = u > 0.6 ? (u - 0.6) / 0.4 : 0;
      const hx = (-d * 90 + d * 330 * k) * (1 - back) + d * 138 * back;
      const hyy = (-455 - Math.sin(k * Math.PI) * 30) * (1 - back) + -366 * back;
      const armPts = [[d * 46, -122], [d * 60 + hx * 0.45, -270], [hx, hyy]];
      if (d > 0) Rr = armPts;
      else L = armPts;
      headRot = d * 0.12 * (1 - back);
      headDx = d * 10 * (1 - back);
      extra = 'swipe';
    } else if (anim === 'photo') {
      const k = Math.min(1, u * 6);
      const out = u > 0.75 ? (u - 0.75) / 0.25 : 0;
      const m = k * (1 - out);
      L = [[-46, -122], [-128 - 18 * m, -236 - 18 * m], [-138 - 24 * m, -366 + 92 * m]];
      Rr = [[46, -122], [128 + 18 * m, -236 - 18 * m], [138 + 24 * m, -366 + 92 * m]];
      headRot = (st.dir || 1) * 0.1 * m;
      headDy -= 10 * m;
      extra = m > 0.5 ? 'v' : null;
    } else if (anim === 'howl') {
      const k = Math.min(1, u * 8);
      const w1 = Math.sin(st.t * 16) * 12;
      const w2 = Math.sin(st.t * 16 + 2) * 12;
      L = [[-46, -122], [-140, -250 - 40 * k], [-150 + w1, -366 - 110 * k]];
      Rr = [[46, -122], [140, -250 - 40 * k], [150 + w2, -366 - 110 * k]];
      headDy -= 30 * k + Math.sin(st.t * 30) * 2;
      headSq = 1 + 0.07 * k;
    } else if (anim === 'oops') {
      const k = Math.sin(Math.min(1, u) * Math.PI);
      headDy += 12 * k;
      headRot = -0.08 * k;
      extra = k > 0.2 ? 'sweat' : null;
    }

    tube(c, L, 26, { seed: sd + 10 });
    tube(c, Rr, 26, { seed: sd + 14 });

    if (extra === 'pen') {
      const h = Rr[2];
      line(c, [[h[0] - 4, h[1] - 10], [h[0] - 16, h[1] - 44]], { lw: 7, seed: sd + 80, amp: 0.5 });
      line(c, [[h[0] - 4, h[1] - 10], [h[0] - 16, h[1] - 44]], { lw: 3, stroke: '#fff', seed: sd + 80, amp: 0.5 });
    }
    if (extra === 'v') {
      [L[2], Rr[2]].forEach((h, i) => {
        const sg = i === 0 ? -1 : 1;
        line(c, [[h[0] - 5, h[1] - 12], [h[0] - 15 * 1, h[1] - 44]], { lw: 6, seed: sd + 82 + i });
        line(c, [[h[0] + 5, h[1] - 12], [h[0] + 15, h[1] - 44]], { lw: 6, seed: sd + 84 + i });
        if (sg) dot(c, h[0], h[1] - 6, 4);
      });
    }

    // 몸통
    shape(
      c,
      [
        [-64, 2],
        [-70, -40],
        [-54, -84],
        [-50, -134],
        [0, -140],
        [50, -134],
        [54, -84],
        [70, -40],
        [64, 2],
        [0, 8],
      ],
      { fill: '#fff', seed: sd + 20 }
    );

    // 머리 (뒤통수)
    c.save();
    c.translate(headDx, -222 + headDy);
    c.rotate(headRot);
    c.scale(1 / Math.sqrt(headSq), headSq);
    shape(c, headPts(0, 0, 112, 96, true), { fill: '#fff', seed: sd + 30, amp: 1.6 });
    c.restore();

    if (extra === 'sweat') {
      shape(c, [[122, -300], [132, -276], [122, -266], [112, -276]], { fill: '#bfe6ff', lw: 3, seed: sd + 90, amp: 0.6 });
    }
    c.restore();
  };

  /* 휘두르는 손 잔상 */
  Art.swipeLines = function (c, x, y, dir, u) {
    c.save();
    c.globalAlpha = Math.max(0, 1 - u) * 0.9;
    for (let i = 0; i < 4; i++) {
      const yy = y - 30 + i * 22;
      const x0 = x - dir * 170 + dir * u * 260;
      line(c, [[x0, yy], [x0 + dir * (150 - i * 18), yy - 8 + i * 4]], { lw: 5, seed: 500 + i, amp: 2 });
    }
    c.restore();
  };

  /* ---------- 시청자 ----------
     (x, y) = 발. type: paper | troll | phone | wolf
     st: { mood, bob, t, atTable, signed, rot, seed, bubble } */
  const FAN_FILL = { paper: '#ffffff', troll: '#c9adf7', phone: '#ffffff', wolf: '#b7afa6' };
  Art.FAN_ACCENT = { paper: '#ffd84d', troll: '#8b5cf6', phone: '#38b6ff', wolf: '#8a8178' };

  Art.fan = function (c, x, y, s, type, st) {
    st = st || {};
    const mood = st.mood || 'idle';
    const t = st.t || 0;
    const bob = st.bob || 0;
    const sd = 700 + (st.seed || 0) * 13;
    const fill = FAN_FILL[type] || '#fff';
    c.save();
    c.translate(x, y);
    if (st.rot) {
      c.translate(0, -150 * s);
      c.rotate(st.rot);
      c.translate(0, 150 * s);
    }
    c.scale(s, s);
    const squash = 1 - bob * 0.04;
    c.scale(1 + bob * 0.03, squash);
    const lw = Math.max(4.5, Math.min(9, 4.5 / Math.sqrt(s)));

    const howl = mood === 'howl';
    const happy = mood === 'happy';
    const sad = mood === 'sad';

    // 꼬리 (늑대)
    if (type === 'wolf') {
      const wag = happy ? Math.sin(t * 22) * 16 : Math.sin(t * 5) * 5;
      shape(
        c,
        [
          [34, -52],
          [78, -70 + wag * 0.3],
          [112 + wag, -128],
          [100 + wag, -150],
          [84 + wag * 0.6, -112],
          [60, -92],
          [36, -84],
        ],
        { fill: fill, lw: lw, seed: sd + 1, amp: 2.4, poly: true }
      );
    }

    // 다리
    tube(c, [[-20, -30], [-22, -4]], 22, { fill: fill, lw: lw, seed: sd + 3 });
    tube(c, [[20, -30], [22, -4]], 22, { fill: fill, lw: lw, seed: sd + 4 });

    // 몸통
    let bodyPts = [
      [-44, -22],
      [-48, -92],
      [-45, -166],
      [0, -172],
      [45, -166],
      [48, -92],
      [44, -22],
      [0, -16],
    ];
    if (type === 'wolf') {
      // 털 삐죽삐죽
      const fur = [];
      const base = [
        [-44, -22],
        [-50, -60],
        [-48, -100],
        [-50, -135],
        [-45, -166],
        [45, -166],
        [50, -135],
        [48, -100],
        [50, -60],
        [44, -22],
        [0, -16],
      ];
      for (let i = 0; i < base.length; i++) {
        const p = base[i];
        const q = base[(i + 1) % base.length];
        fur.push(p);
        const mx = (p[0] + q[0]) / 2;
        const my = (p[1] + q[1]) / 2;
        const out = mx < -20 ? -9 : mx > 20 ? 9 : 0;
        fur.push([mx + out, my + (out === 0 ? 0 : 6)]);
      }
      shape(c, fur, { fill: fill, lw: lw, seed: sd + 5, amp: 1.2, poly: true });
    } else {
      shape(c, bodyPts, { fill: fill, lw: lw, seed: sd + 5 });
    }

    // 팔 + 소품
    const AW = 18;
    const armO = (seed) => ({ fill: fill, lw: lw, seed: sd + seed });
    const headY = howl ? -236 : -232;
    let prop = null;

    if (type === 'paper') {
      if (st.atTable && !st.signed) {
        tube(c, [[-40, -146], [-52, -104], [-34, -66]], AW, armO(10));
        tube(c, [[40, -146], [52, -104], [34, -66]], AW, armO(12));
      } else {
        const up = st.signed ? Math.sin(t * 18) * 6 : 0;
        tube(c, [[-40, -146], [-70, -230], [-56, -306 + up]], AW, armO(10));
        tube(c, [[40, -146], [70, -230], [56, -306 + up]], AW, armO(12));
        prop = function () {
          c.save();
          c.translate(0, -352 + up);
          c.rotate(st.signed ? Math.sin(t * 18) * 0.06 : -0.03);
          shape(c, [[-62, -46], [60, -50], [64, 44], [-60, 48]], { fill: '#fff', lw: lw, seed: sd + 20, amp: 1.4, poly: true });
          if (st.signed) {
            line(c, [[-40, 6], [-22, -22], [-10, 16], [6, -18], [20, 12], [40, -8]], { lw: 5, stroke: RED, seed: sd + 22, amp: 1.5 });
          } else {
            line(c, [[-40, -20], [38, -24]], { lw: 3, stroke: '#9aa', seed: sd + 22 });
            line(c, [[-40, 0], [20, -3]], { lw: 3, stroke: '#9aa', seed: sd + 23 });
            Art.text(c, '싸인', 0, 22, 30, { color: Art.FAN_ACCENT.paper, outline: INK, outlineW: 5, bold: true, weight: 400 });
          }
          c.restore();
        };
      }
    } else if (type === 'phone') {
      const up = happy ? Math.sin(t * 18) * 5 : 0;
      tube(c, [[40, -146], [84, -214], [76, -288 + up]], AW, armO(12));
      tube(c, [[-40, -146], [-66, -104], [-60, -62]], AW, armO(10));
      prop = function () {
        c.save();
        c.translate(80, -322 + up);
        c.rotate(0.12);
        shape(c, [[-27, -44], [27, -44], [27, 44], [-27, 44]], { fill: '#1b1b1b', lw: lw, seed: sd + 20, amp: 1 });
        dot(c, -10, -26, 8, '#fff');
        dot(c, -10, -26, 4, Art.FAN_ACCENT.phone);
        dot(c, 10, -26, 5, '#fff');
        c.restore();
      };
    } else if (type === 'troll') {
      const shake = Math.sin(t * 20) * 5;
      if (mood === 'laugh' || happy) {
        tube(c, [[-40, -146], [-74, -120], [-66, -84]], AW, armO(10));
        tube(c, [[40, -146], [74, -120], [66, -84]], AW, armO(12));
      } else {
        tube(c, [[-40, -146], [-84, -206], [-74 + shake, -272]], AW, armO(10));
        tube(c, [[40, -146], [70, -112], [52, -84]], AW, armO(12));
        prop = function () {
          shape(c, ell(-74 + shake, -284, 17, 16, 8), { fill: fill, lw: lw, seed: sd + 20, amp: 1 });
        };
      }
    } else if (type === 'wolf') {
      if (howl) {
        tube(c, [[-40, -146], [-88, -200], [-96 + Math.sin(t * 16) * 8, -270]], AW, armO(10));
        tube(c, [[40, -146], [88, -200], [96 + Math.sin(t * 16 + 2) * 8, -270]], AW, armO(12));
      } else {
        tube(c, [[-40, -146], [-64, -106], [-58, -66]], AW, armO(10));
        tube(c, [[40, -146], [64, -106], [58, -66]], AW, armO(12));
      }
    }

    // 머리
    c.save();
    c.translate(0, headY);
    if (howl) c.rotate(-0.3);
    if (sad) c.rotate(0.08);
    if (type === 'troll') {
      // 뿔
      shape(c, [[-52, -44], [-64, -86], [-28, -58]], { fill: '#3a2a55', lw: lw, seed: sd + 30, amp: 1, poly: true });
      shape(c, [[52, -44], [64, -86], [28, -58]], { fill: '#3a2a55', lw: lw, seed: sd + 31, amp: 1, poly: true });
    }
    if (type === 'wolf') {
      shape(c, [[-64, -30], [-66, -96], [-22, -58]], { fill: fill, lw: lw, seed: sd + 30, amp: 1, poly: true });
      shape(c, [[64, -30], [66, -96], [22, -58]], { fill: fill, lw: lw, seed: sd + 31, amp: 1, poly: true });
      shape(c, [[-54, -46], [-58, -78], [-36, -58]], { fill: '#f7b6c2', stroke: null, seed: sd + 32, amp: 0.5, poly: true });
      shape(c, [[54, -46], [58, -78], [36, -58]], { fill: '#f7b6c2', stroke: null, seed: sd + 33, amp: 0.5, poly: true });
    }
    if (type === 'wolf') {
      const hp = ell(0, 0, 74, 64, 18, 0.85).map((p, i) => (i % 2 ? [p[0] * 1.09, p[1] * 1.09] : p));
      shape(c, hp, { fill: fill, lw: lw, seed: sd + 35, amp: 1.2, poly: true });
    } else {
      shape(c, ell(0, 0, 74, 64, 12, 0.82), { fill: fill, lw: lw, seed: sd + 35 });
    }
    drawFace(c, type, mood, t, sd, lw);
    c.restore();

    if (prop) prop();
    c.restore();
  };

  function drawFace(c, type, mood, t, sd, lw) {
    const happy = mood === 'happy';
    const sad = mood === 'sad';
    const shock = mood === 'shock';
    const el = Math.min(lw, 6);
    if (type === 'wolf') {
      // 주둥이
      const howl = mood === 'howl';
      if (howl) {
        line(c, [[-34, -8], [-18, -18]], { lw: el, seed: sd + 40 });
        line(c, [[34, -8], [18, -18]], { lw: el, seed: sd + 41 });
      } else if (happy) {
        line(c, [[-36, -12], [-26, -22], [-16, -12]], { lw: el, seed: sd + 40 });
        line(c, [[16, -12], [26, -22], [36, -12]], { lw: el, seed: sd + 41 });
      } else if (sad) {
        line(c, [[-36, -18], [-18, -10]], { lw: el, seed: sd + 40 });
        line(c, [[36, -18], [18, -10]], { lw: el, seed: sd + 41 });
      } else {
        shape(c, ell(-26, -14, 10, 12, 8), { fill: '#ffd400', lw: 3, seed: sd + 40, amp: 0.5 });
        shape(c, ell(26, -14, 10, 12, 8), { fill: '#ffd400', lw: 3, seed: sd + 41, amp: 0.5 });
        dot(c, -26, -14, 4);
        dot(c, 26, -14, 4);
      }
      shape(c, ell(0, 22, 34, 26, 10), { fill: '#efe9e2', lw: el * 0.8, seed: sd + 43, amp: 1 });
      shape(c, ell(0, 6, 12, 8, 8), { fill: INK, stroke: null, seed: sd + 44, amp: 0.5 });
      if (howl) {
        shape(c, ell(0, 30, 13, 15, 8), { fill: '#7a1f2b', lw: 3, seed: sd + 45, amp: 0.6 });
      } else if (sad) {
        line(c, [[-12, 34], [0, 28], [12, 34]], { lw: 4, seed: sd + 45 });
      } else {
        line(c, [[-16, 26], [0, 34], [16, 26]], { lw: 4, seed: sd + 45 });
        shape(c, [[-12, 29], [-8, 40], [-4, 32]], { fill: '#fff', lw: 2.5, seed: sd + 46, amp: 0.3, poly: true });
        shape(c, [[12, 29], [8, 40], [4, 32]], { fill: '#fff', lw: 2.5, seed: sd + 47, amp: 0.3, poly: true });
      }
      if (sad) {
        shape(c, [[-30, 0], [-24, 16], [-30, 22], [-36, 16]], { fill: '#bfe6ff', lw: 2.5, seed: sd + 48, amp: 0.4 });
      }
      return;
    }
    if (type === 'troll') {
      const laugh = mood === 'laugh' || happy;
      if (shock) {
        line(c, [[-36, -16], [-16, -2]], { lw: el, seed: sd + 40 });
        line(c, [[-16, -16], [-36, -2]], { lw: el, seed: sd + 41 });
        line(c, [[36, -16], [16, -2]], { lw: el, seed: sd + 42 });
        line(c, [[16, -16], [36, -2]], { lw: el, seed: sd + 43 });
        shape(c, ell(0, 28, 14, 16, 8), { fill: '#3a2a55', lw: 3, seed: sd + 44, amp: 0.6 });
        return;
      }
      // 눈썹
      line(c, [[-44, -30], [-12, -14]], { lw: el + 1, seed: sd + 40 });
      line(c, [[44, -30], [12, -14]], { lw: el + 1, seed: sd + 41 });
      if (laugh) {
        line(c, [[-38, -6], [-24, 0], [-38, 6]], { lw: el, seed: sd + 42 });
        line(c, [[38, -6], [24, 0], [38, 6]], { lw: el, seed: sd + 43 });
      } else {
        dot(c, -26, -2, 6, RED);
        dot(c, 26, -2, 6, RED);
      }
      // 이빨 드러낸 입
      const mw = laugh ? 40 : 34;
      const mh = laugh ? 24 : 12;
      const my = 30 + (laugh ? Math.abs(Math.sin(t * 20)) * 5 : 0);
      shape(c, [[-mw, my - mh / 2], [mw, my - mh / 2], [mw - 6, my + mh / 2], [-mw + 6, my + mh / 2]], { fill: '#fff', lw: 3.5, seed: sd + 44, amp: 0.8, poly: true });
      const teeth = [];
      for (let i = 0; i <= 6; i++) teeth.push([-mw + 6 + ((mw * 2 - 12) / 6) * i, my + (i % 2 ? mh * 0.3 : -mh * 0.3)]);
      c.beginPath();
      teeth.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
      c.strokeStyle = INK;
      c.lineWidth = 3;
      c.stroke();
      return;
    }
    // 평범한 시청자 (종이, 폰)
    if (shock) {
      shape(c, ell(-26, -6, 9, 11, 8), { fill: '#fff', lw: 3.5, seed: sd + 40, amp: 0.5 });
      shape(c, ell(26, -6, 9, 11, 8), { fill: '#fff', lw: 3.5, seed: sd + 41, amp: 0.5 });
      shape(c, ell(0, 28, 11, 14, 8), { fill: '#fff', lw: 3.5, seed: sd + 42, amp: 0.5 });
      return;
    }
    if (happy) {
      line(c, [[-36, -2], [-26, -12], [-16, -2]], { lw: el, seed: sd + 40 });
      line(c, [[16, -2], [26, -12], [36, -2]], { lw: el, seed: sd + 41 });
      shape(c, [[-18, 18], [18, 18], [10, 38], [-10, 38]], { fill: '#ff8fa3', lw: 3.5, seed: sd + 42, amp: 0.8 });
    } else if (sad) {
      line(c, [[-36, -10], [-18, -4]], { lw: el, seed: sd + 40 });
      line(c, [[36, -10], [18, -4]], { lw: el, seed: sd + 41 });
      line(c, [[-14, 32], [0, 24], [14, 32]], { lw: el, seed: sd + 42 });
      shape(c, [[-28, 4], [-22, 20], [-28, 26], [-34, 20]], { fill: '#bfe6ff', lw: 2.5, seed: sd + 43, amp: 0.4 });
    } else {
      dot(c, -26, -6, 6.5);
      dot(c, 26, -6, 6.5);
      if (type === 'phone') {
        shape(c, ell(0, 24, 10, 9, 8), { fill: '#ff8fa3', lw: 3.5, seed: sd + 42, amp: 0.5 });
      } else {
        line(c, [[-14, 20], [0, 30], [14, 20]], { lw: el, seed: sd + 42 });
      }
    }
    // 볼터치
    c.globalAlpha *= 0.55;
    dot(c, -46, 14, 10, '#ffb3c1');
    dot(c, 46, 14, 10, '#ffb3c1');
    c.globalAlpha /= 0.55;
  }

  /* ---------- 무대 ---------- */

  /* 책상 치수 */
  Art.tableGeom = function (W, H) {
    const cx = W / 2;
    const hw1 = Math.min(W / 2 - 16, 540);
    return { cx: cx, y0: H - 600, y1: H - 468, hw0: hw1 - Math.max(72, hw1 * 0.17), hw1: hw1 };
  };

  Art.backdrop = function (c, W, H, t, o) {
    o = o || {};
    const cx = W / 2;
    c.fillStyle = '#fffdf6';
    c.fillRect(0, 0, W, H);
    const hz = H - 1085;
    const g = Art.tableGeom(W, H);

    // 뒷벽 현수막
    const by = Math.max(132, hz - 120);
    line(c, [[-10, by - 34], [cx - 250, by - 10]], { lw: 3, seed: 21 });
    line(c, [[W + 10, by - 34], [cx + 250, by - 10]], { lw: 3, seed: 22 });
    shape(c, [[cx - 250, by - 36], [cx + 250, by - 40], [cx + 254, by + 44], [cx - 252, by + 48]], { fill: '#fff', lw: 5, seed: 23, amp: 2, poly: true });
    Art.text(c, o.banner || '김재원 팬미팅 (연습)', cx, by + 6, 44, { bold: true, weight: 400 });
    // 깃발
    const n = Math.ceil(W / 90);
    for (let i = 0; i < n; i++) {
      const fx = (i + 0.5) * (W / n);
      const fy = by + 74 + Math.sin(i * 1.7) * 6;
      const col = ['#ffd84d', '#ff8fa3', '#8ed1fc', '#b9f18d'][i % 4];
      shape(c, [[fx - 22, fy], [fx + 22, fy], [fx, fy + 38]], { fill: col, lw: 3.5, seed: 30 + i, amp: 1.2, poly: true });
    }
    line(c, [[-10, by + 70], [W * 0.5, by + 78], [W + 10, by + 70]], { lw: 3, seed: 29 });

    // 바닥 (줄 서는 길)
    c.fillStyle = '#fff1ef';
    c.beginPath();
    c.moveTo(cx - 46, hz + 60);
    c.lineTo(cx + 46, hz + 60);
    c.lineTo(cx + g.hw0 + 30, g.y0 + 6);
    c.lineTo(cx - g.hw0 - 30, g.y0 + 6);
    c.closePath();
    c.fill();
    line(c, [[cx - 46, hz + 60], [cx - g.hw0 - 30, g.y0 + 6]], { lw: 4, seed: 41, amp: 2 });
    line(c, [[cx + 46, hz + 60], [cx + g.hw0 + 30, g.y0 + 6]], { lw: 4, seed: 42, amp: 2 });
    line(c, [[-10, hz + 60], [cx - 46, hz + 60]], { lw: 3, seed: 43, amp: 1.5 });
    line(c, [[cx + 46, hz + 60], [W + 10, hz + 60]], { lw: 3, seed: 44, amp: 1.5 });
  };

  /* 넓은 화면 양옆 장식: 입간판, 풍선 */
  Art.sideDecor = function (c, W, H, t) {
    const g = Art.tableGeom(W, H);
    const room = W / 2 - g.hw1;
    if (room < 330) return;
    const off = g.hw1 + Math.min(room * 0.55, 330);
    // 왼쪽: 입간판
    const x = g.cx - off;
    const top = H - 930;
    const bot = H - 548;
    line(c, [[x - 70, bot - 10], [x - 96, bot + 44]], { lw: 5, seed: 1101 });
    line(c, [[x + 70, bot - 10], [x + 96, bot + 44]], { lw: 5, seed: 1102 });
    shape(c, [[x - 104, top], [x + 104, top - 4], [x + 106, bot], [x - 102, bot + 4]], { fill: '#fff', lw: 5, seed: 1103, amp: 1.6, poly: true });
    c.save();
    c.beginPath();
    c.rect(x - 98, top + 6, 196, bot - top - 10);
    c.clip();
    Art.jaewon(c, x, bot + 40, 0.6, 'yaho1', t, { long: true });
    c.restore();
    Art.caption(c, '야호', x, top + 50, 54, { rot: -0.04, seed: 1104 });
    // 오른쪽: 풍선
    const bx = g.cx + off;
    const by = H - 560;
    const cols = ['#ffd84d', '#ff8fa3', '#8ed1fc'];
    const pos = [[-62, -330], [4, -400], [66, -318]];
    for (let i = 0; i < 3; i++) {
      const sway = Math.sin(t * 1.3 + i * 1.9) * 9;
      const px = bx + pos[i][0] + sway;
      const py = by + pos[i][1] + Math.cos(t * 1.1 + i) * 5;
      line(c, [[bx, by], [bx + pos[i][0] * 0.5 + sway * 0.4, by + pos[i][1] * 0.5], [px, py + 52]], { lw: 3, seed: 1110 + i, amp: 1 });
      shape(c, ell(px, py, 44, 54, 12), { fill: cols[i], lw: 4.5, seed: 1114 + i, amp: 1.4 });
      shape(c, [[px - 7, py + 52], [px + 7, py + 52], [px, py + 64]], { fill: cols[i], lw: 3.5, seed: 1118 + i, amp: 0.6, poly: true });
      line(c, [[px - 20, py - 26], [px - 26, py - 8]], { lw: 4, stroke: '#fff', seed: 1122 + i, amp: 0.5 });
    }
    shape(c, [[bx - 24, by - 6], [bx + 24, by - 6], [bx + 30, by + 26], [bx - 30, by + 26]], { fill: '#eee', lw: 4.5, seed: 1126, amp: 1, poly: true });
  };

  Art.table = function (c, W, H) {
    const g = Art.tableGeom(W, H);
    const cx = g.cx;
    // 다리
    line(c, [[cx - g.hw1 + 14, g.y1 + 20], [cx - g.hw1 + 6, g.y1 + 170]], { lw: 6, seed: 51 });
    line(c, [[cx + g.hw1 - 14, g.y1 + 20], [cx + g.hw1 - 6, g.y1 + 170]], { lw: 6, seed: 52 });
    // 앞판
    shape(c, [[cx - g.hw1, g.y1], [cx + g.hw1, g.y1], [cx + g.hw1 - 4, g.y1 + 34], [cx - g.hw1 + 4, g.y1 + 34]], { fill: '#f3efe6', lw: 5, seed: 53, amp: 1.5, poly: true });
    // 윗판
    shape(c, [[cx - g.hw0, g.y0], [cx + g.hw0, g.y0], [cx + g.hw1, g.y1], [cx - g.hw1, g.y1]], { fill: '#fff', lw: 5, seed: 54, amp: 1.5, poly: true });
  };

  /* 책상 위 종이. sign: 0..1 (싸인 진행), bad: 삐뚤빼뚤 */
  Art.tablePaper = function (c, x, y, k, sign, bad) {
    c.save();
    c.translate(x, y + (1 - k) * -60);
    c.globalAlpha *= Math.min(1, k * 1.5);
    shape(c, [[-56, -36], [52, -38], [66, 36], [-70, 38]], { fill: '#fff', lw: 4.5, seed: 61, amp: 1.2, poly: true });
    line(c, [[-40, -20], [36, -22]], { lw: 2.5, stroke: '#9aa', seed: 62 });
    if (sign > 0) {
      const full = bad
        ? [[-44, 6], [-30, 20], [-12, -4], [0, 24], [10, 2], [30, 22], [46, 8]]
        : [[-44, 14], [-30, -10], [-22, 18], [-6, -12], [4, 16], [18, -8], [30, 12], [48, -2]];
      const n = Math.max(2, Math.ceil(full.length * Math.min(1, sign)));
      line(c, full.slice(0, n), { lw: 5, stroke: bad ? '#777' : RED, seed: 63, amp: bad ? 3 : 1 });
    }
    c.restore();
  };

  /* 하트 */
  Art.heart = function (c, x, y, r, col) {
    c.save();
    c.translate(x, y);
    c.beginPath();
    c.moveTo(0, r * 0.9);
    c.bezierCurveTo(-r * 1.5, -r * 0.2, -r * 0.7, -r * 1.2, 0, -r * 0.4);
    c.bezierCurveTo(r * 0.7, -r * 1.2, r * 1.5, -r * 0.2, 0, r * 0.9);
    c.fillStyle = col || RED;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.stroke();
    c.restore();
  };

  /* 밴 도장 */
  Art.stamp = function (c, x, y, str, k, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot || -0.2);
    const sc = k < 0.25 ? 2.2 - (k / 0.25) * 1.2 : 1;
    c.scale(sc, sc);
    c.globalAlpha *= k < 0.75 ? 1 : Math.max(0, 1 - (k - 0.75) / 0.25);
    c.font = '400 92px ' + Art.FONT_BOLD;
    const w = c.measureText(str).width + 56;
    shape(c, [[-w / 2, -64], [w / 2, -64], [w / 2, 64], [-w / 2, 64]], { fill: 'rgba(255,255,255,0.85)', stroke: RED, lw: 10, seed: 71, amp: 2, poly: true });
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = RED;
    c.fillText(str, 0, 6);
    c.restore();
  };

  /* 폴라로이드 (같이 찍은 사진) */
  Art.polaroid = function (c, x, y, k, good, t, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot || -0.12);
    const sc = k < 0.15 ? k / 0.15 : 1;
    c.scale(sc, sc);
    c.globalAlpha *= k < 0.8 ? 1 : Math.max(0, 1 - (k - 0.8) / 0.2);
    shape(c, [[-84, -100], [84, -100], [84, 110], [-84, 110]], { fill: '#fff', lw: 4.5, seed: 81, amp: 1.2, poly: true });
    c.save();
    c.beginPath();
    c.rect(-70, -86, 140, 140);
    c.clip();
    c.fillStyle = good ? '#dff3ff' : '#ddd';
    c.fillRect(-70, -86, 140, 140);
    if (good) {
      Art.jaewon(c, -22, 150, 0.56, 'vsign', t, { long: true });
      Art.fan(c, 44, 96, 0.46, 'paper', { mood: 'happy', t: t, seed: 4, atTable: true });
    } else {
      for (let i = 0; i < 6; i++) {
        line(c, [[-70, -70 + i * 26], [-20, -50 + i * 22], [70, -76 + i * 28]], { lw: 12, stroke: i % 2 ? '#bbb' : '#eee', seed: 85 + i, amp: 8 });
      }
    }
    c.restore();
    c.strokeStyle = INK;
    c.lineWidth = 3;
    c.strokeRect(-70, -86, 140, 140);
    Art.text(c, good ? '찰칵!' : '흔들림', 0, 82, 30, {});
    c.restore();
  };

  /* 조작 아이콘: click | swipe | space | hold */
  Art.icon = function (c, kind, x, y, s) {
    c.save();
    c.translate(x, y);
    c.scale(s || 1, s || 1);
    if (kind === 'click' || kind === 'swipe') {
      const body = ell(0, 0, 18, 27, 12, 0.8);
      shape(c, body, { fill: '#fff', lw: 3.5, seed: 801, amp: 0.5 });
      if (kind === 'click') {
        c.save();
        c.beginPath();
        c.rect(-24, -34, 24, 29);
        c.clip();
        shape(c, body, { fill: RED, lw: 3.5, seed: 801, amp: 0.5 });
        c.restore();
      }
      line(c, [[0, -27], [0, -5]], { lw: 3, seed: 802, amp: 0.3 });
      line(c, [[-17, -5], [17, -5]], { lw: 3, seed: 803, amp: 0.3 });
      if (kind === 'swipe') {
        [-1, 1].forEach((d) => {
          line(c, [[d * 27, 0], [d * 44, 0]], { lw: 4, stroke: RED, seed: 805 + d, amp: 0.4 });
          line(c, [[d * 37, -8], [d * 46, 0], [d * 37, 8]], { lw: 4, stroke: RED, seed: 808 + d, amp: 0.3 });
        });
      }
    } else {
      const hold = kind === 'hold';
      const dy = hold ? 6 : 0;
      shape(c, [[-42, -12 + dy], [42, -12 + dy], [42, 14 + dy], [-42, 14 + dy]], { fill: hold ? RED : '#fff', lw: 3.5, seed: 811, amp: 0.8, poly: true });
      if (hold) {
        line(c, [[0, -34], [0, -16]], { lw: 4, stroke: RED, seed: 812, amp: 0.3 });
        line(c, [[-8, -24], [0, -15], [8, -24]], { lw: 4, stroke: RED, seed: 813, amp: 0.3 });
      } else {
        line(c, [[-12, -30], [-12, -19]], { lw: 4, stroke: RED, seed: 812, amp: 0.3 });
        line(c, [[12, -30], [12, -19]], { lw: 4, stroke: RED, seed: 813, amp: 0.3 });
      }
    }
    c.restore();
  };

  /* 타이밍 고리 (튜토리얼) */
  Art.ring = function (c, x, y, r, k, col) {
    c.save();
    c.lineWidth = 6;
    c.strokeStyle = INK;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.stroke();
    if (k > 0) {
      c.globalAlpha *= Math.min(1, 1.4 - k * 0.4);
      c.strokeStyle = col || RED;
      c.lineWidth = 7;
      c.beginPath();
      c.arc(x, y, r * (1 + k * 1.6), 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  };
})();
