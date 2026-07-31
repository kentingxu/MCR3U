/* ============================================================
   MCR3U — Interactive engine
   Vanilla JS + Canvas 2D. No dependencies.
   ============================================================ */
"use strict";

/* ---------------- Utilities ---------------- */

const $ = (id) => document.getElementById(id);

const COLORS = {
  cyan: "#22d3ee",
  violet: "#8b5cf6",
  pink: "#f472b6",
  green: "#34d399",
  amber: "#fbbf24",
  dim: "#5b6b84",
  grid: "rgba(255,255,255,0.07)",
  axis: "rgba(255,255,255,0.28)",
  text: "#94a3b8",
};

const fmt = (n, d = 2) => {
  if (!isFinite(n)) return "undefined";
  const r = Number(n.toFixed(d));
  return Object.is(r, -0) ? "0" : String(r);
};

const money = (n) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

/* ---------------- Graph: canvas coordinate system ---------------- */

class Graph {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{xmin:number,xmax:number,ymin:number,ymax:number}} view
   */
  constructor(canvas, view) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.view = view;
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.w = w;
    this.h = h;
  }

  px(x) {
    const { xmin, xmax } = this.view;
    return ((x - xmin) / (xmax - xmin)) * this.w;
  }

  py(y) {
    const { ymin, ymax } = this.view;
    return this.h - ((y - ymin) / (ymax - ymin)) * this.h;
  }

  clear() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const dpr = window.devicePixelRatio || 1;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  grid(stepX = 1, stepY = 1) {
    const { xmin, xmax, ymin, ymax } = this.view;
    const c = this.ctx;
    c.lineWidth = 1;
    c.strokeStyle = COLORS.grid;
    c.beginPath();
    for (let x = Math.ceil(xmin / stepX) * stepX; x <= xmax; x += stepX) {
      c.moveTo(this.px(x), 0);
      c.lineTo(this.px(x), this.h);
    }
    for (let y = Math.ceil(ymin / stepY) * stepY; y <= ymax; y += stepY) {
      c.moveTo(0, this.py(y));
      c.lineTo(this.w, this.py(y));
    }
    c.stroke();

    // Axes
    c.strokeStyle = COLORS.axis;
    c.lineWidth = 1.5;
    c.beginPath();
    if (ymin < 0 && ymax > 0) {
      c.moveTo(0, this.py(0));
      c.lineTo(this.w, this.py(0));
    }
    if (xmin < 0 && xmax > 0) {
      c.moveTo(this.px(0), 0);
      c.lineTo(this.px(0), this.h);
    }
    c.stroke();

    // Tick labels
    c.fillStyle = COLORS.text;
    c.font = "11px ui-monospace, Menlo, monospace";
    c.textAlign = "center";
    const labelEveryX = Math.max(stepX, Math.ceil((xmax - xmin) / 12 / stepX) * stepX);
    const labelEveryY = Math.max(stepY, Math.ceil((ymax - ymin) / 8 / stepY) * stepY);
    const axisY = ymin < 0 && ymax > 0 ? this.py(0) : this.h - 14;
    const axisX = xmin < 0 && xmax > 0 ? this.px(0) : 18;
    for (let x = Math.ceil(xmin / labelEveryX) * labelEveryX; x <= xmax; x += labelEveryX) {
      if (Math.abs(x) < 1e-9) continue;
      const lx = Math.max(20, Math.min(this.w - 20, this.px(x)));
      c.fillText(fmt(x, 4), lx, Math.min(axisY + 16, this.h - 4));
    }
    c.textAlign = "left";
    for (let y = Math.ceil(ymin / labelEveryY) * labelEveryY; y <= ymax; y += labelEveryY) {
      if (Math.abs(y) < 1e-9) continue;
      const ly = Math.max(12, Math.min(this.h - 6, this.py(y) + 4));
      c.fillText(fmt(y, 4), Math.max(axisX + 6, 4), ly);
    }
  }

  /** Plot y = fn(x); breaks the stroke across asymptotes / undefined points. */
  plot(fn, color = COLORS.cyan, width = 2.5, glow = true) {
    const { xmin, xmax, ymin, ymax } = this.view;
    const c = this.ctx;
    const span = ymax - ymin;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineJoin = "round";
    if (glow) {
      c.shadowColor = color;
      c.shadowBlur = 12;
    }
    c.beginPath();
    let pen = false;
    let prevY = null;
    for (let i = 0; i <= this.w; i++) {
      const x = xmin + (i / this.w) * (xmax - xmin);
      const y = fn(x);
      const ok = isFinite(y) && y > ymin - span * 2 && y < ymax + span * 2;
      const jumped = prevY !== null && Math.abs(y - prevY) > span * 0.6;
      if (ok && !jumped) {
        if (pen) c.lineTo(this.px(x), this.py(y));
        else c.moveTo(this.px(x), this.py(y));
        pen = true;
      } else {
        pen = false;
      }
      prevY = ok ? y : null;
    }
    c.stroke();
    c.shadowBlur = 0;
  }

  dashedLine(x1, y1, x2, y2, color = COLORS.dim) {
    const c = this.ctx;
    c.strokeStyle = color;
    c.lineWidth = 1;
    c.setLineDash([5, 5]);
    c.beginPath();
    c.moveTo(this.px(x1), this.py(y1));
    c.lineTo(this.px(x2), this.py(y2));
    c.stroke();
    c.setLineDash([]);
  }

  point(x, y, color = COLORS.pink, label = "") {
    const c = this.ctx;
    c.fillStyle = color;
    c.shadowColor = color;
    c.shadowBlur = 10;
    c.beginPath();
    c.arc(this.px(x), this.py(y), 5, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    if (label) {
      c.fillStyle = color;
      c.font = "bold 12px ui-monospace, Menlo, monospace";
      c.textAlign = "left";
      c.fillText(label, this.px(x) + 9, this.py(y) - 9);
    }
  }

  label(x, y, text, color = COLORS.text, align = "left") {
    const c = this.ctx;
    c.fillStyle = color;
    c.font = "12px ui-monospace, Menlo, monospace";
    c.textAlign = align;
    c.fillText(text, this.px(x), this.py(y));
  }
}

/* ---------------- Widget registry (for window resize) ---------------- */

const redrawAll = [];
const onResize = (fn) => redrawAll.push(fn);

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => redrawAll.forEach((fn) => fn()), 150);
});

const bind = (ids, handler) => {
  ids.forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("input", handler);
  });
};

/* ---------------- Parent function definitions ---------------- */

const PARENTS = {
  linear: {
    label: "f(x) = x",
    fn: (x) => x,
    domain: "{x ∈ ℝ}",
    range: "{y ∈ ℝ}",
  },
  quadratic: {
    label: "f(x) = x²",
    fn: (x) => x * x,
    domain: "{x ∈ ℝ}",
    range: "{y ∈ ℝ, y ≥ 0}",
  },
  cubic: {
    label: "f(x) = x³",
    fn: (x) => x ** 3,
    domain: "{x ∈ ℝ}",
    range: "{y ∈ ℝ}",
  },
  sqrt: {
    label: "f(x) = √x",
    fn: (x) => (x < 0 ? NaN : Math.sqrt(x)),
    domain: "{x ∈ ℝ, x ≥ 0}",
    range: "{y ∈ ℝ, y ≥ 0}",
  },
  reciprocal: {
    label: "f(x) = 1/x",
    fn: (x) => (Math.abs(x) < 1e-12 ? NaN : 1 / x),
    domain: "{x ∈ ℝ, x ≠ 0}",
    range: "{y ∈ ℝ, y ≠ 0}",
  },
  abs: {
    label: "f(x) = |x|",
    fn: Math.abs,
    domain: "{x ∈ ℝ}",
    range: "{y ∈ ℝ, y ≥ 0}",
  },
};

/* ============================================================
   UNIT 1 — Parent function explorer
   ============================================================ */

function initUnit1() {
  const g = new Graph($("u1-canvas"), { xmin: -6, xmax: 6, ymin: -6, ymax: 6 });

  function draw() {
    g.resize();
    const key = $("u1-fn").value;
    const p = PARENTS[key];
    const x0 = parseFloat($("u1-x").value);
    $("u1-x-out").textContent = fmt(x0, 1);

    g.clear();
    g.grid();
    g.dashedLine(-6, -6, 6, 6, COLORS.dim); // y = x mirror line
    g.label(5.5, 5.1, "y = x", COLORS.dim, "right");
    g.plot(p.fn, COLORS.cyan);
    drawInverse(g, p.fn);

    const y0 = p.fn(x0);
    if (isFinite(y0)) g.point(x0, y0, COLORS.cyan, `(${fmt(x0, 1)}, ${fmt(y0, 1)})`);

    $("u1-readout").innerHTML =
      `<b>${p.label}</b><br>` +
      `f(${fmt(x0, 1)}) = <span class="hl">${fmt(y0)}</span><br>` +
      `Domain: ${p.domain}<br>Range: ${p.range}`;
  }

  function drawInverse(g, fn) {
    // Reflect the parent curve in the line y = x
    const { xmin, xmax } = g.view;
    const c = g.ctx;
    c.strokeStyle = COLORS.pink;
    c.lineWidth = 1.8;
    c.setLineDash([6, 4]);
    c.beginPath();
    let pen = false;
    for (let i = 0; i <= g.w; i++) {
      const t = xmin + (i / g.w) * (xmax - xmin);
      const y = fn(t);
      if (isFinite(y) && y > g.view.ymin - 10 && y < g.view.ymax + 10) {
        // reflected point: (y, t)
        const X = g.px(y), Y = g.py(t);
        if (X >= -50 && X <= g.w + 50) {
          pen ? c.lineTo(X, Y) : c.moveTo(X, Y);
          pen = true;
          continue;
        }
      }
      pen = false;
    }
    c.stroke();
    c.setLineDash([]);
  }

  bind(["u1-fn", "u1-x"], draw);
  onResize(draw);
  draw();
}

/* ============================================================
   UNIT 2 — Transformation explorer  y = a·f(k(x−d)) + c
   ============================================================ */

function initUnit2() {
  const g = new Graph($("u2-canvas"), { xmin: -8, xmax: 8, ymin: -8, ymax: 8 });

  function draw() {
    g.resize();
    const p = PARENTS[$("u2-fn").value];
    const a = parseFloat($("u2-a").value);
    const k = parseFloat($("u2-k").value);
    const d = parseFloat($("u2-d").value);
    const c = parseFloat($("u2-c").value);
    $("u2-a-out").textContent = fmt(a, 1);
    $("u2-k-out").textContent = fmt(k, 1);
    $("u2-d-out").textContent = fmt(d, 1);
    $("u2-c-out").textContent = fmt(c, 1);

    const transformed = (x) => {
      if (Math.abs(k) < 1e-9 || Math.abs(a) < 1e-9) {
        return Math.abs(a) < 1e-9 ? c : NaN;
      }
      return a * p.fn(k * (x - d)) + c;
    };

    g.clear();
    g.grid();
    g.plot(p.fn, COLORS.dim, 1.8, false);
    g.plot(transformed, COLORS.cyan);

    const parts = [];
    if (Math.abs(a) !== 1) parts.push(`vertical stretch by ${fmt(Math.abs(a), 1)}`);
    if (a < 0) parts.push("reflection in x-axis");
    if (Math.abs(k) !== 1 && Math.abs(k) > 1e-9)
      parts.push(`horizontal ${Math.abs(k) > 1 ? "compression" : "stretch"} by ${fmt(1 / Math.abs(k), 2)}`);
    if (k < 0) parts.push("reflection in y-axis");
    if (d !== 0) parts.push(`shift ${d > 0 ? "right" : "left"} ${fmt(Math.abs(d), 1)}`);
    if (c !== 0) parts.push(`shift ${c > 0 ? "up" : "down"} ${fmt(Math.abs(c), 1)}`);

    $("u2-readout").innerHTML =
      `<b>y = ${fmt(a, 1)}·f(${fmt(k, 1)}(x − ${fmt(d, 1)})) + ${fmt(c, 1)}</b><br>` +
      (parts.length
        ? parts.map((s) => `• ${s}`).join("<br>")
        : `<span class="hl">No transformations — this is the parent.</span>`) +
      `<br>Mapping: (x, y) → (${fmt(1 / (Math.abs(k) < 1e-9 ? 1 : k), 2)}x + ${fmt(d, 1)}, ${fmt(a, 1)}y + ${fmt(c, 1)})`;
  }

  bind(["u2-fn", "u2-a", "u2-k", "u2-d", "u2-c"], draw);
  onResize(draw);
  draw();
}

/* ============================================================
   UNIT 3 — Vertex form + quadratic solver
   ============================================================ */

function initUnit3() {
  const g = new Graph($("u3-canvas"), { xmin: -8, xmax: 8, ymin: -8, ymax: 8 });

  function draw() {
    g.resize();
    const a = parseFloat($("u3-a").value);
    const h = parseFloat($("u3-h").value);
    const k = parseFloat($("u3-k").value);
    $("u3-a-out").textContent = fmt(a, 1);
    $("u3-h-out").textContent = fmt(h, 1);
    $("u3-k-out").textContent = fmt(k, 1);

    g.clear();
    g.grid();
    if (Math.abs(a) > 1e-9) {
      g.plot((x) => a * (x - h) ** 2 + k, COLORS.cyan);
      g.dashedLine(h, -8, h, 8, COLORS.violet);
      g.point(h, k, COLORS.pink, `vertex (${fmt(h, 1)}, ${fmt(k, 1)})`);
    }

    // zeros via quadratic formula on expanded form
    let zeros = "none (no x-intercepts)";
    if (Math.abs(a) > 1e-9) {
      const disc = -k / a;
      if (disc > 0) {
        const z1 = h - Math.sqrt(disc), z2 = h + Math.sqrt(disc);
        zeros = `x = ${fmt(z1)} and x = ${fmt(z2)}`;
        g.point(z1, 0, COLORS.green);
        g.point(z2, 0, COLORS.green);
      } else if (Math.abs(disc) < 1e-9) {
        zeros = `x = ${fmt(h)} (one zero)`;
      }
    }

    $("u3-readout").innerHTML =
      `<b>y = ${fmt(a, 1)}(x − ${fmt(h, 1)})² + ${fmt(k, 1)}</b><br>` +
      `Vertex: <span class="hl">(${fmt(h, 1)}, ${fmt(k, 1)})</span> — ${a >= 0 ? "minimum" : "maximum"}<br>` +
      `Axis of symmetry: x = ${fmt(h, 1)}<br>` +
      `Opens: ${a > 0 ? "upward" : a < 0 ? "downward" : "—"}<br>` +
      `Zeros: ${zeros}<br>y-intercept: ${fmt(a * h * h + k)}`;
  }

  bind(["u3-a", "u3-h", "u3-k"], draw);
  onResize(draw);
  draw();

  // --- Quadratic formula solver ---
  function solve() {
    const a = parseFloat($("u3-qa").value);
    const b = parseFloat($("u3-qb").value);
    const c = parseFloat($("u3-qc").value);
    const out = $("u3-solution");
    if ([a, b, c].some((v) => !isFinite(v))) {
      out.innerHTML = "Please enter numbers for a, b and c.";
      return;
    }
    if (Math.abs(a) < 1e-12) {
      if (Math.abs(b) < 1e-12) {
        out.innerHTML = Math.abs(c) < 1e-12
          ? "0 = 0 — infinitely many solutions."
          : `${fmt(c)} = 0 — no solution.`;
      } else {
        out.innerHTML = `a = 0, so this is linear: ${fmt(b)}x + ${fmt(c)} = 0<br>x = <b>${fmt(-c / b, 4)}</b>`;
      }
      return;
    }
    const D = b * b - 4 * a * c;
    let html = `<b>${fmt(a)}x² + ${fmt(b)}x + ${fmt(c)} = 0</b><br>Discriminant D = b² − 4ac = <span class="hl">${fmt(D, 4)}</span><br>`;
    if (D > 0) {
      const x1 = (-b + Math.sqrt(D)) / (2 * a);
      const x2 = (-b - Math.sqrt(D)) / (2 * a);
      html += `D &gt; 0 → two real roots:<br>x = <b>${fmt(x1, 4)}</b> &nbsp;or&nbsp; x = <b>${fmt(x2, 4)}</b>`;
    } else if (Math.abs(D) < 1e-12) {
      html += `D = 0 → one repeated root:<br>x = <b>${fmt(-b / (2 * a), 4)}</b>`;
    } else {
      html += `D &lt; 0 → <span class="hl">no real roots</span> (two complex roots).`;
    }
    out.innerHTML = html;
  }

  $("u3-solve").addEventListener("click", solve);
  solve();
}

/* ============================================================
   UNIT 4 — Exponential growth / decay simulator
   ============================================================ */

function initUnit4() {
  const g = new Graph($("u4-canvas"), { xmin: -2, xmax: 30, ymin: 0, ymax: 600 });

  function draw() {
    g.resize();
    const P = parseFloat($("u4-p").value);
    const b = parseFloat($("u4-b").value);
    const t = parseFloat($("u4-t").value);
    $("u4-p-out").textContent = fmt(P, 0);
    $("u4-b-out").textContent = fmt(b, 2);
    $("u4-t-out").textContent = fmt(t, 1);

    g.clear();
    g.grid(5, 100);
    g.dashedLine(-2, 0, 30, 0, COLORS.dim); // asymptote
    g.plot((x) => P * Math.pow(b, x), COLORS.cyan);
    const y = P * Math.pow(b, t);
    if (y <= 600) g.point(t, y, COLORS.pink, `(${fmt(t, 1)}, ${fmt(y, 1)})`);

    const ratePct = (b - 1) * 100;
    const kind = b > 1 ? `growth of ${fmt(ratePct, 1)}% per period` :
                 b < 1 ? `decay of ${fmt(-ratePct, 1)}% per period` : "constant (b = 1)";
    let timing = "";
    if (b > 1) timing = `Doubling time ≈ ${fmt(Math.log(2) / Math.log(b), 1)} periods`;
    else if (b > 0 && b < 1) timing = `Half-life ≈ ${fmt(Math.log(0.5) / Math.log(b), 1)} periods`;

    $("u4-readout").innerHTML =
      `<b>y = ${fmt(P, 0)} · (${fmt(b, 2)})ᵗ</b><br>` +
      `Type: <span class="hl">${kind}</span><br>` +
      `Value at t = ${fmt(t, 1)}: <b>${fmt(y, 1)}</b><br>` +
      timing;
  }

  bind(["u4-p", "u4-b", "u4-t"], draw);
  onResize(draw);
  draw();
}

/* ============================================================
   UNIT 5 — Triangle solver (sine / cosine law)
   ============================================================ */

function initUnit5() {
  const canvas = $("u5-canvas");
  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;

  const MODES = {
    sas: { labels: ["side b", "side c", "angle A (°)"], values: [7, 9, 52] },
    sss: { labels: ["side a", "side b", "side c"], values: [8, 7, 9] },
    asa: { labels: ["angle A (°)", "side b", "angle C (°)"], values: [50, 9, 60] },
  };

  function applyMode() {
    const m = MODES[$("u5-mode").value];
    ["u5-l1", "u5-l2", "u5-l3"].forEach((id, i) => ($(id).textContent = m.labels[i]));
    ["u5-i1", "u5-i2", "u5-i3"].forEach((id, i) => ($(id).value = m.values[i]));
    solve();
  }

  /** Returns {a,b,c,A,B,C} (angles in degrees) or null. */
  function solveTriangle() {
    const mode = $("u5-mode").value;
    const v = ["u5-i1", "u5-i2", "u5-i3"].map((id) => parseFloat($(id).value));
    if (v.some((x) => !isFinite(x) || x <= 0)) return null;

    let a, b, c, A, B, C;
    if (mode === "sas") {
      [b, c, A] = v;
      if (A >= 180) return null;
      a = Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(A * D2R)); // cosine law
      B = Math.asin(Math.min(1, (b * Math.sin(A * D2R)) / a)) * R2D; // sine law
      C = 180 - A - B;
    } else if (mode === "sss") {
      [a, b, c] = v;
      if (a + b <= c || a + c <= b || b + c <= a) return null; // triangle inequality
      A = Math.acos((b * b + c * c - a * a) / (2 * b * c)) * R2D; // cosine law
      B = Math.acos((a * a + c * c - b * b) / (2 * a * c)) * R2D;
      C = 180 - A - B;
    } else {
      [A, b, C] = v;
      B = 180 - A - C;
      if (B <= 0) return null;
      a = (b * Math.sin(A * D2R)) / Math.sin(B * D2R); // sine law
      c = (b * Math.sin(C * D2R)) / Math.sin(B * D2R);
    }
    return { a, b, c, A, B, C };
  }

  function drawTriangle(t) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Geometry: A at origin, B at (c, 0), C from side b and angle A
    const Ax = 0, Ay = 0;
    const Bx = t.c, By = 0;
    const Cx = t.b * Math.cos(t.A * D2R);
    const Cy = t.b * Math.sin(t.A * D2R);

    const maxX = Math.max(Bx, Cx, 1e-9), maxY = Math.max(Cy, 1e-9);
    const scale = Math.min((W * 0.6) / maxX, (H * 0.6) / maxY);
    const ox = W / 2 - ((Math.min(Ax, Bx, Cx) + maxX) / 2) * scale;
    const oy = H / 2 + (maxY / 2) * scale;
    const P = (x, y) => [ox + x * scale, oy - y * scale];

    const [pA, pB, pC] = [P(Ax, Ay), P(Bx, By), P(Cx, Cy)];

    // Triangle fill + stroke
    const grad = ctx.createLinearGradient(pA[0], pA[1], pC[0], pC[1]);
    grad.addColorStop(0, "rgba(34,211,238,0.18)");
    grad.addColorStop(1, "rgba(139,92,246,0.18)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(...pA); ctx.lineTo(...pB); ctx.lineTo(...pC); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    ctx.font = "bold 14px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";

    // Side labels (a opposite A, etc.)
    ctx.fillStyle = COLORS.amber;
    let m = mid(pB, pC); ctx.fillText(`a = ${fmt(t.a, 2)}`, m[0] + 34, m[1]);
    m = mid(pA, pC); ctx.fillText(`b = ${fmt(t.b, 2)}`, m[0] - 38, m[1]);
    m = mid(pA, pB); ctx.fillText(`c = ${fmt(t.c, 2)}`, m[0], m[1] + 22);

    // Vertex labels
    ctx.fillStyle = COLORS.pink;
    ctx.fillText(`A = ${fmt(t.A, 1)}°`, pA[0] - 6, pA[1] + 24);
    ctx.fillText(`B = ${fmt(t.B, 1)}°`, pB[0] + 6, pB[1] + 24);
    ctx.fillText(`C = ${fmt(t.C, 1)}°`, pC[0], pC[1] - 14);

    // Vertex dots
    [pA, pB, pC].forEach((p) => {
      ctx.fillStyle = COLORS.pink;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function solve() {
    const t = solveTriangle();
    const out = $("u5-readout");
    if (!t) {
      out.innerHTML = `<span class="hl">No valid triangle.</span><br>Check: positive values, angles &lt; 180°, and the triangle inequality (longest side &lt; sum of other two).`;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const used = $("u5-mode").value === "asa" ? "Sine Law" : "Cosine Law + Sine Law";
    out.innerHTML =
      `<b>Solved with: ${used}</b><br>` +
      `a = <b>${fmt(t.a, 3)}</b> · b = <b>${fmt(t.b, 3)}</b> · c = <b>${fmt(t.c, 3)}</b><br>` +
      `A = <span class="hl">${fmt(t.A, 2)}°</span> · B = <span class="hl">${fmt(t.B, 2)}°</span> · C = <span class="hl">${fmt(t.C, 2)}°</span><br>` +
      `Check: A + B + C = ${fmt(t.A + t.B + t.C, 1)}°`;
    drawTriangle(t);
  }

  $("u5-mode").addEventListener("change", applyMode);
  $("u5-solve").addEventListener("click", solve);
  onResize(solve);
  applyMode();
}

/* ============================================================
   UNIT 6 — Sinusoidal grapher + unit circle
   ============================================================ */

function initUnit6() {
  // --- Sinusoidal grapher (x in degrees) ---
  const g = new Graph($("u6-canvas"), { xmin: -380, xmax: 740, ymin: -5, ymax: 5 });
  const D2R = Math.PI / 180;

  function draw() {
    g.resize();
    const a = parseFloat($("u6-a").value);
    const k = parseFloat($("u6-k").value);
    const d = parseFloat($("u6-d").value);
    const c = parseFloat($("u6-c").value);
    $("u6-a-out").textContent = fmt(a, 1);
    $("u6-k-out").textContent = fmt(k, 2);
    $("u6-d-out").textContent = fmt(d, 0);
    $("u6-c-out").textContent = fmt(c, 1);

    g.clear();
    g.grid(90, 1);
    g.dashedLine(-380, c, 740, c, COLORS.violet); // axis y = c
    g.plot((x) => Math.sin(x * D2R), COLORS.dim, 1.8, false);
    g.plot((x) => a * Math.sin(k * (x - d) * D2R) + c, COLORS.cyan);

    const period = 360 / k;
    const max = c + Math.abs(a), min = c - Math.abs(a);
    g.point(d, c, COLORS.pink, `start of cycle (${fmt(d, 0)}°, ${fmt(c, 1)})`);

    $("u6-readout").innerHTML =
      `<b>y = ${fmt(a, 1)}·sin(${fmt(k, 2)}(x − ${fmt(d, 0)}°)) + ${fmt(c, 1)}</b><br>` +
      `Amplitude: <span class="hl">${fmt(Math.abs(a), 1)}</span><br>` +
      `Period: 360°/${fmt(k, 2)} = <b>${fmt(period, 1)}°</b><br>` +
      `Phase shift: ${fmt(d, 0)}° ${d > 0 ? "right" : d < 0 ? "left" : "(none)"}<br>` +
      `Axis: y = ${fmt(c, 1)}<br>` +
      `Max: ${fmt(max, 1)} · Min: ${fmt(min, 1)}<br>` +
      `Range: {y ∈ ℝ, ${fmt(min, 1)} ≤ y ≤ ${fmt(max, 1)}}`;
  }

  bind(["u6-a", "u6-k", "u6-d", "u6-c"], draw);
  onResize(draw);
  draw();

  // --- Unit circle ---
  const canvas = $("u6-circle");

  function drawCircle() {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const deg = parseFloat($("u6-angle").value);
    $("u6-angle-out").textContent = `${fmt(deg, 0)}°`;
    const rad = deg * D2R;

    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const px = cx + cos * R, py = cy - sin * R;

    // Grid axes
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(W, cy);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
    ctx.stroke();

    // Circle
    ctx.strokeStyle = COLORS.violet;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.violet;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // cos projection (x) and sin projection (y)
    ctx.lineWidth = 3;
    ctx.strokeStyle = COLORS.amber;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, cy); ctx.stroke(); // cos
    ctx.strokeStyle = COLORS.pink;
    ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(px, py); ctx.stroke(); // sin
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.dim;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(cx, py); ctx.stroke();
    ctx.setLineDash([]);

    // Radius (hypotenuse)
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
    ctx.shadowBlur = 0;

    // Point on circle
    ctx.fillStyle = COLORS.cyan;
    ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();

    // Angle arc
    ctx.strokeStyle = COLORS.green;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, -rad, rad > 0); ctx.stroke();

    const quad = deg === 0 || deg === 360 ? "positive x-axis" :
      deg === 90 ? "positive y-axis" : deg === 180 ? "negative x-axis" :
      deg === 270 ? "negative y-axis" :
      deg < 90 ? "Quadrant I" : deg < 180 ? "Quadrant II" :
      deg < 270 ? "Quadrant III" : "Quadrant IV";
    const tan = Math.abs(cos) < 1e-10 ? "undefined" : fmt(sin / cos, 4);

    $("u6-circle-readout").innerHTML =
      `Point: (cos θ, sin θ) = <b>(${fmt(cos, 4)}, ${fmt(sin, 4)})</b><br>` +
      `sin ${fmt(deg, 0)}° = <span class="hl">${fmt(sin, 4)}</span><br>` +
      `cos ${fmt(deg, 0)}° = <span style="color:${COLORS.amber}">${fmt(cos, 4)}</span><br>` +
      `tan ${fmt(deg, 0)}° = ${tan}<br>` +
      `Location: ${quad} · ${fmt(rad, 4)} rad`;
  }

  bind(["u6-angle"], drawCircle);
  onResize(drawCircle);
  drawCircle();
}

/* ============================================================
   UNIT 7 — Sequence explorer + compound interest
   ============================================================ */

function initUnit7() {
  const canvas = $("u7-canvas");

  function terms(type, a1, step, n) {
    const arr = [];
    for (let i = 1; i <= n; i++) {
      arr.push(type === "arith" ? a1 + (i - 1) * step : a1 * Math.pow(step, i - 1));
    }
    return arr;
  }

  function draw() {
    const type = $("u7-type").value;
    const a1 = parseFloat($("u7-a1").value);
    const step = parseFloat($("u7-step").value);
    const n = parseInt($("u7-n").value, 10);
    $("u7-a1-out").textContent = fmt(a1, 0);
    $("u7-step-out").textContent = fmt(step, 1);
    $("u7-n-out").textContent = n;
    $("u7-step-name").textContent =
      type === "arith" ? "Common difference d" : "Common ratio r";

    const t = terms(type, a1, step, n);
    const tn = t[n - 1];
    const Sn = type === "arith"
      ? (n / 2) * (2 * a1 + (n - 1) * step)
      : Math.abs(step - 1) < 1e-9 ? a1 * n : (a1 * (Math.pow(step, n) - 1)) / (step - 1);

    // Bar chart
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const max = Math.max(...t.map(Math.abs), 1e-9);
    const padL = 46, padB = 34, padT = 20, padR = 16;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const min = Math.min(...t, 0);
    const range = Math.max(...t, 0) - min || 1;
    const y0 = padT + (Math.max(...t, 0) / range) * plotH;

    // Baseline
    ctx.strokeStyle = COLORS.axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padL, y0); ctx.lineTo(W - padR, y0); ctx.stroke();

    const bw = plotW / n;
    t.forEach((v, i) => {
      const x = padL + i * bw + bw * 0.15;
      const h = (Math.abs(v) / range) * plotH;
      const y = v >= 0 ? y0 - h : y0;
      const hot = i === n - 1;
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      if (hot) {
        grad.addColorStop(0, COLORS.pink);
        grad.addColorStop(1, "rgba(244,114,182,0.25)");
      } else {
        grad.addColorStop(0, COLORS.cyan);
        grad.addColorStop(1, "rgba(34,211,238,0.15)");
      }
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, bw * 0.7, h);
      if (hot) {
        ctx.shadowColor = COLORS.pink;
        ctx.shadowBlur = 16;
        ctx.strokeStyle = COLORS.pink;
        ctx.strokeRect(x, y, bw * 0.7, h);
        ctx.shadowBlur = 0;
        ctx.fillStyle = COLORS.pink;
        ctx.font = "bold 12px ui-monospace, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.fillText(`t${n} = ${fmt(tn, 2)}`, x + bw * 0.35, Math.max(y - 8, 12));
      }
    });

    // Term indices
    ctx.fillStyle = COLORS.text;
    ctx.font = "10px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < n; i++) {
      ctx.fillText(String(i + 1), padL + i * bw + bw / 2, H - padB + 16);
    }
    ctx.fillText("n", W - padR, H - padB + 16);

    const formula = type === "arith"
      ? `tₙ = ${fmt(a1, 0)} + (n − 1)(${fmt(step, 1)})`
      : `tₙ = ${fmt(a1, 0)} · (${fmt(step, 1)})ⁿ⁻¹`;

    $("u7-readout").innerHTML =
      `<b>${formula}</b><br>` +
      `First terms: ${t.slice(0, 5).map((v) => fmt(v, 1)).join(", ")}, …<br>` +
      `t${n} = <span class="hl">${fmt(tn, 4)}</span><br>` +
      `S${n} (sum of first ${n} terms) = <b>${fmt(Sn, 4)}</b>`;
  }

  bind(["u7-type", "u7-a1", "u7-step", "u7-n"], draw);
  onResize(draw);
  draw();

  // --- Compound interest ---
  function calc() {
    const P = parseFloat($("u7-p").value);
    const annual = parseFloat($("u7-rate").value);
    const years = parseFloat($("u7-years").value);
    const m = parseFloat($("u7-comp").value);
    const out = $("u7-fv");
    if ([P, annual, years].some((v) => !isFinite(v) || v < 0)) {
      out.innerHTML = "Please enter non-negative numbers.";
      return;
    }
    const i = annual / 100 / m;
    const n = m * years;
    const A = P * Math.pow(1 + i, n);
    const freq = { 1: "annually", 2: "semi-annually", 4: "quarterly", 12: "monthly" }[m];
    out.innerHTML =
      `i = ${fmt(annual, 2)}% ÷ ${m} = <b>${fmt(i * 100, 4)}% per period</b> · n = ${m} × ${fmt(years, 1)} = <b>${fmt(n, 0)} periods</b><br>` +
      `A = ${money(P)}(1 + ${fmt(i, 6)})^${fmt(n, 0)} compounded ${freq}<br>` +
      `Future value: <span class="hl">${money(A)}</span><br>` +
      `Interest earned: ${money(A - P)}`;
  }

  $("u7-calc").addEventListener("click", calc);
  calc();
}

/* ============================================================
   Navigation — mobile toggle + scroll-spy
   ============================================================ */

function initNav() {
  const sidebar = $("sidebar");
  const overlay = $("overlay");
  const toggle = $("nav-toggle");

  const close = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("show");
  };
  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("show");
  });
  overlay.addEventListener("click", close);
  document.querySelectorAll(".nav a").forEach((a) =>
    a.addEventListener("click", close)
  );
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  // Scroll-spy
  const links = [...document.querySelectorAll(".nav a")];
  const sections = links
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          links.forEach((a) =>
            a.classList.toggle(
              "active",
              a.getAttribute("href") === `#${entry.target.id}`
            )
          );
        }
      });
    },
    { rootMargin: "-30% 0px -60% 0px" }
  );
  sections.forEach((s) => spy.observe(s));
}

/* ---------------- Boot ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  initUnit1();
  initUnit2();
  initUnit3();
  initUnit4();
  initUnit5();
  initUnit6();
  initUnit7();
  initNav();
});
