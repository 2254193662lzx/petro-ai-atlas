/* =========================================================
   增采案例示范 · 共用小工具
   ---------------------------------------------------------
   只放纯数值与配色工具，不碰 DOM、不依赖任何第三方库：
     · 可复现随机数 / 高斯采样 / 线性代数
     · 二维高斯过程回归（代理模型 + 不确定性）
     · 色阶与数字格式
   由五个增采案例的 demo 共用，必须在 demo 之前加载。
   ========================================================= */

(function (global) {
  'use strict';

  /* ---------- 随机数 ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function gauss(rnd) {
    var u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function linspace(a, b, n) {
    var out = [];
    if (n <= 1) return [a];
    for (var i = 0; i < n; i++) out.push(a + (b - a) * i / (n - 1));
    return out;
  }

  /* 二维拉丁超立方：两个维度都分层，避免初始点扎堆 */
  function lhs2d(n, rnd) {
    var xs = [], ys = [], i, j, t;
    for (i = 0; i < n; i++) { xs.push(i); ys.push(i); }
    for (i = n - 1; i > 0; i--) {
      j = Math.floor(rnd() * (i + 1));
      t = xs[i]; xs[i] = xs[j]; xs[j] = t;
      j = Math.floor(rnd() * (i + 1));
      t = ys[i]; ys[i] = ys[j]; ys[j] = t;
    }
    return xs.map(function (v, k) {
      return [(v + rnd()) / n, (ys[k] + rnd()) / n];
    });
  }

  /* ---------- 线性代数 ---------- */
  function zeros(n, m) {
    var A = [];
    for (var i = 0; i < n; i++) {
      A.push([]);
      for (var j = 0; j < m; j++) A[i].push(0);
    }
    return A;
  }

  /* 高斯-约当求逆（带部分主元），n 很小（≤ 40），够用 */
  function inv(A) {
    var n = A.length, i, j, k;
    var M = zeros(n, n * 2);
    for (i = 0; i < n; i++) {
      for (j = 0; j < n; j++) M[i][j] = A[i][j];
      M[i][n + i] = 1;
    }
    for (i = 0; i < n; i++) {
      var p = i;
      for (k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
      if (Math.abs(M[p][i]) < 1e-12) M[p][i] = 1e-12;
      if (p !== i) { var tmp = M[p]; M[p] = M[i]; M[i] = tmp; }
      var d = M[i][i];
      for (j = 0; j < n * 2; j++) M[i][j] /= d;
      for (k = 0; k < n; k++) {
        if (k === i) continue;
        var f = M[k][i];
        if (!f) continue;
        for (j = 0; j < n * 2; j++) M[k][j] -= f * M[i][j];
      }
    }
    var R = zeros(n, n);
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) R[i][j] = M[i][n + j];
    return R;
  }

  function matVec(A, b) {
    var n = A.length, out = [];
    for (var i = 0; i < n; i++) {
      var s = 0;
      for (var j = 0; j < b.length; j++) s += A[i][j] * b[j];
      out.push(s);
    }
    return out;
  }

  /* ---------- 高斯过程回归 ---------- */
  function fitGP(X, y, opt) {
    opt = opt || {};
    var sigmaF = opt.sigmaF || 0.45;
    var length = opt.length || 0.30;
    var sigmaN = opt.sigmaN || 0.035;
    var n = X.length, d = X[0].length, i, j, q;
    var yMean = 0;
    for (i = 0; i < n; i++) yMean += y[i];
    yMean /= n;

    var K = zeros(n, n);
    for (i = 0; i < n; i++) {
      for (j = 0; j < n; j++) {
        var s = 0;
        for (q = 0; q < d; q++) {
          var dx = X[i][q] - X[j][q];
          s += dx * dx;
        }
        K[i][j] = sigmaF * sigmaF * Math.exp(-0.5 * s / (length * length));
      }
      K[i][i] += sigmaN * sigmaN;
    }
    var Kinv = inv(K);
    var res = y.map(function (v) { return v - yMean; });
    return {
      X: X, y: y, alpha: matVec(Kinv, res), Kinv: Kinv,
      sigmaF: sigmaF, length: length, mean: yMean
    };
  }

  function gpPredict(m, x) {
    var n = m.X.length, d = x.length, i, j, q;
    var k = [];
    for (i = 0; i < n; i++) {
      var s = 0;
      for (q = 0; q < d; q++) {
        var dx = x[q] - m.X[i][q];
        s += dx * dx;
      }
      k.push(m.sigmaF * m.sigmaF * Math.exp(-0.5 * s / (m.length * m.length)));
    }
    var mean = m.mean;
    for (i = 0; i < n; i++) mean += k[i] * m.alpha[i];
    var v = m.sigmaF * m.sigmaF;
    for (i = 0; i < n; i++) {
      for (j = 0; j < n; j++) v -= k[i] * m.Kinv[i][j] * k[j];
    }
    return { mean: mean, sd: Math.sqrt(Math.max(v, 1e-8)) };
  }

  /* 在候选集里按 UCB 选下一个点；beta 越大越偏探索 */
  function gpAcquire(m, candidates, beta) {
    var best = null, bestV = -1e9;
    for (var i = 0; i < candidates.length; i++) {
      var p = gpPredict(m, candidates[i].x);
      var v = p.mean + beta * p.sd;
      if (v > bestV) { bestV = v; best = { cand: candidates[i], mean: p.mean, sd: p.sd, ucb: v }; }
    }
    return best;
  }

  /* ---------- 颜色 ---------- */
  function hex2rgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }

  /* 连续色阶：stops = [[0,'#hex'],[0.5,'#hex'],[1,'#hex']] */
  function ramp(t, stops) {
    t = clamp(t, 0, 1);
    var i;
    for (i = 0; i < stops.length - 1; i++) {
      if (t <= stops[i + 1][0]) {
        var a = stops[i], b = stops[i + 1];
        var f = (t - a[0]) / Math.max(1e-9, b[0] - a[0]);
        var ca = hex2rgb(a[1]), cb = hex2rgb(b[1]);
        return 'rgb(' + Math.round(ca[0] + (cb[0] - ca[0]) * f) + ',' +
          Math.round(ca[1] + (cb[1] - ca[1]) * f) + ',' +
          Math.round(ca[2] + (cb[2] - ca[2]) * f) + ')';
      }
    }
    return stops[stops.length - 1][1];
  }

  var SEQ = [[0, '#fbf8ef'], [0.25, '#e6f1ec'], [0.55, '#a9cfc3'], [0.8, '#4f9a86'], [1, '#235f51']];
  var WARM = [[0, '#fdfcf9'], [0.35, '#f8ecdf'], [0.7, '#d9a273'], [1, '#a8552f']];

  /* ---------- 数字 ---------- */
  function fmt(v, d) {
    d = d == null ? 2 : d;
    return Number(v).toFixed(d);
  }
  function pct(v, d) { return (v * 100).toFixed(d == null ? 1 : d) + '%'; }

  /* 简单线性映射 */
  function scale(d0, d1, r0, r1) {
    return function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); };
  }

  global.EORLib = {
    mulberry32: mulberry32, gauss: gauss, clamp: clamp,
    linspace: linspace, lhs2d: lhs2d,
    zeros: zeros, inv: inv, matVec: matVec,
    fitGP: fitGP, gpPredict: gpPredict, gpAcquire: gpAcquire,
    hex2rgb: hex2rgb, ramp: ramp, SEQ: SEQ, WARM: WARM,
    fmt: fmt, pct: pct, scale: scale
  };
})(window);
