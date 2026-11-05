/* =========================================================
   增采 e1 可运行示范 · 压裂参数智能优化
   ---------------------------------------------------------
   纯前端，无依赖：
     合成"排量—砂比 → NPV / 砂堵风险"响应面
     → 高斯过程代理模型 → 风险约束下的 UCB 推荐
   对外暴露 window.EorFracOptDemo(root, ctx)
   ========================================================= */

(function () {
  'use strict';

  var L = window.EORLib;
  var D3 = window.EOR3D;
  var timer = null;

  if (!L) {
    window.EorFracOptDemo = function (root) {
      root.innerHTML = '<div class="callout warn"><span class="ci">缺失</span><span>示范依赖 eor-demo-lib.js，请检查脚本加载顺序。</span></div>';
    };
    window.EorFracOptCleanup = function () { };
    return;
  }

  var Q0 = 4, Q1 = 16;    // 排量 m3/min
  var S0 = 5, S1 = 35;    // 砂比 %

  var SC = {
    tight: { label: '致密均质', u0: 0.52, v0: 0.47, base: 0.46, amp: 0.34, riskShift: 0.00 },
    natural: { label: '天然裂缝发育', u0: 0.40, v0: 0.40, base: 0.54, amp: 0.31, riskShift: 0.55 },
    stress: { label: '高应力', u0: 0.70, v0: 0.60, base: 0.41, amp: 0.35, riskShift: -0.10 }
  };

  function npvAt(q, s, sc) {
    var u = (q - Q0) / (Q1 - Q0);
    var v = (s - S0) / (S1 - S0);
    var core = sc.amp * Math.exp(-(Math.pow((u - sc.u0) / 0.30, 2) + Math.pow((v - sc.v0) / 0.34, 2)));
    var trend = 0.10 * u + 0.07 * v - 0.04 * u * v;
    return L.clamp(sc.base + core + trend, 0, 1);
  }

  function riskAt(q, s, sc) {
    var z = (q - 12) / 2.2 + (s - 26) / 7.5 + sc.riskShift;
    return 1 / (1 + Math.exp(-z));
  }

  function trueOptimum(sc, tol) {
    var best = null, any = null;
    for (var i = 0; i <= 100; i++) {
      for (var j = 0; j <= 100; j++) {
        var q = Q0 + (Q1 - Q0) * i / 100;
        var s = S0 + (S1 - S0) * j / 100;
        var n = npvAt(q, s, sc), r = riskAt(q, s, sc);
        if (!any || n > any.npv) any = { q: q, s: s, npv: n, risk: r };
        if (r <= tol + 1e-9 && (!best || n > best.npv)) best = { q: q, s: s, npv: n, risk: r };
      }
    }
    return { best: best, any: any };
  }

  function starPath(cx, cy, r) {
    var p = [];
    for (var i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 5;
      var rr = i % 2 ? r * 0.44 : r;
      p.push((cx + Math.cos(ang) * rr).toFixed(1) + ',' + (cy + Math.sin(ang) * rr).toFixed(1));
    }
    return 'M' + p.join('L') + 'Z';
  }

  function EorFracOptDemo(root) {
    var state = { sc: 'tight', tol: 0.25, seed: 20261023, budget: 18, initial: 8 };
    var rnd, history, model, rec, predOpt, best, trues, baseline, candSet = [];

    root.innerHTML = '' +
      '<div class="demo">' +
      '<div class="demo-head">' +
      '<div><span class="kicker">INTERACTIVE · 约束优化</span>' +
      '<h3 style="margin-top:8px">排量与砂比：在风险允许的范围内找最优</h3>' +
      '<p>下面是一个合成的"排量—砂比 → NPV"响应面，每个点代表一次压裂设计。颜色是代理模型预测的 NPV，红色斜纹区是砂堵 / 套压超限的不可行区。优化器只能在可行区内推荐下一段；拖动风险上限，看最优解怎么被"挤"到边界上。</p></div>' +
      '<button class="btn primary" data-act="reset">重置 ↻</button>' +
      '</div>' +

      '<div class="demo-ctl">' +
      '<span class="small muted" style="font-family:var(--mono);font-size:9px;letter-spacing:.06em">地质场景</span>' +
      '<button class="chip on" data-sc="tight">致密均质</button>' +
      '<button class="chip" data-sc="natural">天然裂缝发育</button>' +
      '<button class="chip" data-sc="stress">高应力</button>' +
      '<span class="divider" style="width:1px;height:16px;background:var(--line-2)"></span>' +
      '<div class="ctl"><label>风险上限</label><input type="range" min="0.10" max="0.35" step="0.05" value="0.25" id="e1-tol"><span class="val" id="e1-tolv">25%</span></div>' +
      '<button class="btn sm" data-act="next">推荐下一段 →</button>' +
      '<button class="btn sm" data-act="auto">自动优化</button>' +
      '</div>' +

      '<div class="demo-grid">' +
      '<div class="track-wrap"><div class="track">' +
      '<svg id="e1-map" viewBox="0 0 460 330" role="img" aria-label="压裂参数响应面与风险约束"></svg>' +
      '<div class="readout" id="e1-readout">悬停看预测</div></div>' +
      '<div class="track-legend">' +
      '<span><i style="background:#5d666d"></i>已试方案</span>' +
      '<span><i style="background:#b26a39"></i>推荐/手动</span>' +
      '<span><i style="background:#2f7d6b"></i>下一段推荐</span>' +
      '<span><i style="background:#41699b"></i>模型最优</span>' +
      '<span><i style="background:#8e5229"></i>真实最优</span>' +
      '<span><i style="height:9px;width:11px;border-radius:2px;background:repeating-linear-gradient(45deg,#b05a51 0 1px,transparent 1px 4px);opacity:.7"></i>风险不可行</span>' +
      '</div></div>' +

      '<div class="demo-side">' +
      '<div class="metrics" id="e1-metrics"></div>' +
      '<div class="fitbox"><div class="ft"><span>最好可行方案 vs 试验段数</span><span id="e1-conv-note"></span></div>' +
      '<svg id="e1-conv" viewBox="0 0 360 140"></svg></div>' +
      '<div class="fitbox"><div class="ft"><span>风险—收益权衡</span><span>右：高风险 · 上：高收益</span></div>' +
      '<svg id="e1-pareto" viewBox="0 0 360 140"></svg></div>' +
      '<div class="verdict" id="e1-verdict"></div>' +
      '<div class="hintbox"><b>为什么不能直接找最高点：</b>NPV 最高的参数往往落在高风险区，现场根本不能施工。' +
      '<b>约束优化做了什么：</b>先学一个"参数 → NPV"的代理模型，再把砂堵 / 套压风险作为硬约束，只在可行区内推荐下一个试验点。' +
      '红圈是"无约束最优"，它通常不可施工；棕星才是"可行域里的真实最优"。</div>' +
      '</div></div>' +

      '<div class="fitbox" style="margin:0 16px 12px"><div class="ft"><span>三维场景 · 真实 NPV 地形（左键拖动旋转，双击复位）</span><span>黑点=已试方案 · 菱形=下一段推荐 · 星=可行域真实最优</span></div>' +
      '<div class="d3-scene" id="e1-d3"></div></div>' +

      '<div class="ltable-wrap"><table class="ltable" id="e1-table"></table></div>' +
      '</div>';

    var mapSvg = root.querySelector('#e1-map');
    var convSvg = root.querySelector('#e1-conv');
    var paretoSvg = root.querySelector('#e1-pareto');
    var metricsEl = root.querySelector('#e1-metrics');
    var verdictEl = root.querySelector('#e1-verdict');
    var tableEl = root.querySelector('#e1-table');
    var readout = root.querySelector('#e1-readout');
    var tolEl = root.querySelector('#e1-tol');
    var tolV = root.querySelector('#e1-tolv');
    var convNote = root.querySelector('#e1-conv-note');
    var autoBtn = root.querySelector('[data-act="auto"]');
    var chips = root.querySelectorAll('[data-sc]');

    var W = 460, H = 330, px = 54, py = 22, pw = 362, ph = 260;
    var COLS = 24, ROWS = 19;

    function cur() { return SC[state.sc]; }

    function reset() {
      if (timer) { clearInterval(timer); timer = null; }
      if (autoBtn) autoBtn.textContent = '自动优化';
      rnd = L.mulberry32(state.seed);
      history = [];
      var init = L.lhs2d(state.initial, rnd);
      init.forEach(function (p) {
        var q = Q0 + p[0] * (Q1 - Q0);
        var s = S0 + p[1] * (S1 - S0);
        addRaw(q, s, '初始');
      });
      buildBaseline();
      rebuild();
      draw();
    }

    function addRaw(q, s, src) {
      var sc = cur();
      history.push({
        q: q, s: s,
        npv: L.clamp(npvAt(q, s, sc) + L.gauss(rnd) * 0.010, 0, 1),
        risk: riskAt(q, s, sc),
        src: src
      });
    }

    function norm(p) { return [(p.q - Q0) / (Q1 - Q0), (p.s - S0) / (S1 - S0)]; }

    function buildBaseline() {
      if (!baseline) baseline = {};
      var key = state.sc + '_' + state.tol.toFixed(2);
      if (baseline[key]) return;
      var sc = cur(), reps = 30, arr = [];
      for (var n = state.initial; n <= state.budget; n++) {
        var sum = 0;
        for (var r = 0; r < reps; r++) {
          var br = L.mulberry32(7001 + r * 97 + n);
          var bestV = 0;
          for (var i = 0; i < n; i++) {
            var q = Q0 + br() * (Q1 - Q0);
            var s = S0 + br() * (S1 - S0);
            if (riskAt(q, s, sc) <= state.tol) {
              var v = npvAt(q, s, sc);
              if (v > bestV) bestV = v;
            }
          }
          sum += bestV;
        }
        arr.push({ n: n, v: sum / reps });
      }
      baseline[key] = arr;
    }

    function rebuild() {
      var sc = cur();
      var X = history.map(norm);
      var y = history.map(function (p) { return p.npv; });
      model = L.fitGP(X, y, { sigmaF: 0.20, length: 0.27, sigmaN: 0.016 });

      var cands = [], i, j;
      for (i = 1; i < COLS; i++) {
        for (j = 1; j < ROWS; j++) {
          var u = i / COLS, v = j / ROWS;
          var ok = true;
          for (var k = 0; k < X.length; k++) {
            var du = u - X[k][0], dv = v - X[k][1];
            if (du * du + dv * dv < 0.0025) { ok = false; break; }
          }
          if (!ok) continue;
          var q = Q0 + u * (Q1 - Q0), s = S0 + v * (S1 - S0);
          var pred = L.gpPredict(model, [u, v]);
          cands.push({
            u: u, v: v, q: q, s: s,
            mean: pred.mean, sd: pred.sd,
            risk: riskAt(q, s, sc)
          });
        }
      }

      candSet = cands;
      var feasible = cands.filter(function (c) { return c.risk <= state.tol; });
      var pool = feasible.length ? feasible : cands;
      rec = null; predOpt = null;
      for (i = 0; i < pool.length; i++) {
        var c = pool[i];
        if (!rec || c.mean + 1.2 * c.sd > rec.mean + 1.2 * rec.sd) rec = c;
        if (!predOpt || c.mean > predOpt.mean) predOpt = c;
      }

      var feasHist = history.filter(function (p) { return p.risk <= state.tol; });
      best = feasHist.length ? feasHist.reduce(function (a, b) { return b.npv > a.npv ? b : a; }, feasHist[0]) : null;

      trues = trueOptimum(sc, state.tol);
    }

    function addPoint(q, s, src) {
      if (history.length >= state.budget) return false;
      var du = (q - Q0) / (Q1 - Q0), dv = (s - S0) / (S1 - S0);
      var tooClose = history.some(function (p) {
        var a = (p.q - Q0) / (Q1 - Q0), b = (p.s - S0) / (S1 - S0);
        return (a - du) * (a - du) + (b - dv) * (b - dv) < 0.0009;
      });
      if (tooClose) return false;
      addRaw(q, s, src || '手动');
      rebuild();
      draw();
      return true;
    }

    /* ---------- 响应面 ---------- */
    function drawMap() {
      var sc = cur();
      var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';
      s += '<defs><pattern id="e1hatchDemo" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
        '<line x1="0" y1="0" x2="0" y2="6" stroke="#b05a51" stroke-width="1.2" opacity=".55"/></pattern></defs>';

      var cells = [], i, j;
      for (i = 0; i < COLS; i++) {
        cells.push([]);
        for (j = 0; j < ROWS; j++) {
          var u = (i + 0.5) / COLS, v = 1 - (j + 0.5) / ROWS;
          var p = L.gpPredict(model, [u, v]);
          var q = Q0 + u * (Q1 - Q0), ss = S0 + v * (S1 - S0);
          cells[i].push({ mean: p.mean, risk: riskAt(q, ss, sc) });
        }
      }

      var mn = 1e9, mx = -1e9;
      for (i = 0; i < COLS; i++) {
        for (j = 0; j < ROWS; j++) {
          if (cells[i][j].mean < mn) mn = cells[i][j].mean;
          if (cells[i][j].mean > mx) mx = cells[i][j].mean;
        }
      }
      var range = Math.max(0.08, mx - mn);

      var cw = pw / COLS, ch = ph / ROWS;
      for (i = 0; i < COLS; i++) {
        for (j = 0; j < ROWS; j++) {
          var c = cells[i][j];
          var col = L.ramp((c.mean - mn) / range, L.SEQ);
          s += '<rect x="' + (px + i * cw + 0.5).toFixed(1) + '" y="' + (py + j * ch + 0.5).toFixed(1) +
            '" width="' + (cw - 1).toFixed(1) + '" height="' + (ch - 1).toFixed(1) + '" fill="' + col + '"/>';
          if (c.risk > state.tol) {
            s += '<rect x="' + (px + i * cw + 0.5).toFixed(1) + '" y="' + (py + j * ch + 0.5).toFixed(1) +
              '" width="' + (cw - 1).toFixed(1) + '" height="' + (ch - 1).toFixed(1) + '" fill="#b05a51" opacity=".07"/>';
            s += '<rect x="' + (px + i * cw + 0.5).toFixed(1) + '" y="' + (py + j * ch + 0.5).toFixed(1) +
              '" width="' + (cw - 1).toFixed(1) + '" height="' + (ch - 1).toFixed(1) + '" fill="url(#e1hatchDemo)"/>';
          }
        }
      }

      // 刻度
      for (i = 0; i <= 4; i++) {
        var gx = px + pw * i / 4;
        s += '<text x="' + gx + '" y="' + (py + ph + 16) + '" text-anchor="middle" font-size="8.5" font-family="monospace" fill="#9ba3a9">' + (Q0 + (Q1 - Q0) * i / 4).toFixed(0) + '</text>';
      }
      for (j = 0; j <= 4; j++) {
        var gy = py + ph * j / 4;
        s += '<text x="' + (px - 7) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="8.5" font-family="monospace" fill="#9ba3a9">' + (S0 + (S1 - S0) * (1 - j / 4)).toFixed(0) + '</text>';
      }
      s += '<text x="' + (px + pw / 2) + '" y="' + (py + ph + 34) + '" text-anchor="middle" font-size="9.5" fill="#79828a">排量 / (m³/min)</text>';
      s += '<text x="14" y="' + (py + ph / 2) + '" text-anchor="middle" font-size="9.5" fill="#79828a" transform="rotate(-90 14 ' + (py + ph / 2) + ')">砂比 / %</text>';
      s += '<text x="' + px + '" y="' + (py - 7) + '" text-anchor="start" font-size="8.5" font-family="monospace" fill="#9ba3a9">预测 NPV · 风险上限 ' + Math.round(state.tol * 100) + '%</text>';

      // 真实最优 / 无约束最优
      if (trues.best) {
        var tx = px + (trues.best.q - Q0) / (Q1 - Q0) * pw;
        var ty = py + ph - (trues.best.s - S0) / (S1 - S0) * ph;
        s += '<path d="' + starPath(tx, ty, 6.5) + '" fill="none" stroke="#8e5229" stroke-width="1.5"/>';
        s += '<text x="' + (tx + 9) + '" y="' + (ty - 7) + '" font-size="8" font-family="monospace" fill="#8e5229">真实最优</text>';
      }
      if (trues.any && trues.any.risk > state.tol) {
        var ax = px + (trues.any.q - Q0) / (Q1 - Q0) * pw;
        var ay = py + ph - (trues.any.s - S0) / (S1 - S0) * ph;
        s += '<circle cx="' + ax + '" cy="' + ay + '" r="5" fill="none" stroke="#b05a51" stroke-width="1.5"/>';
        s += '<text x="' + (ax + 8) + '" y="' + (ay + 12) + '" font-size="8" font-family="monospace" fill="#b05a51">无约束最优</text>';
      }

      // 模型最优
      if (predOpt) {
        var mx = px + predOpt.u * pw, my = py + ph - predOpt.v * ph;
        s += '<circle cx="' + mx + '" cy="' + my + '" r="5" fill="none" stroke="#41699b" stroke-width="1.5"/>';
        s += '<line x1="' + (mx - 8) + '" y1="' + my + '" x2="' + (mx + 8) + '" y2="' + my + '" stroke="#41699b" stroke-width="1"/>';
        s += '<line x1="' + mx + '" y1="' + (my - 8) + '" x2="' + mx + '" y2="' + (my + 8) + '" stroke="#41699b" stroke-width="1"/>';
      }

      // 已试方案
      history.forEach(function (p, idx) {
        var cx = px + (p.q - Q0) / (Q1 - Q0) * pw;
        var cy = py + ph - (p.s - S0) / (S1 - S0) * ph;
        var col = p.src === '初始' ? '#5d666d' : p.src === '推荐' ? '#b26a39' : '#7e5a8d';
        s += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4.2" fill="' + col + '" stroke="#ffffff" stroke-width="1.2"/>';
        if (idx >= history.length - 1) {
          s += '<text x="' + (cx + 7) + '" y="' + (cy - 6) + '" font-size="8" font-family="monospace" fill="' + col + '">最新</text>';
        }
      });

      // 下一段推荐
      if (rec && history.length < state.budget) {
        var rx = px + rec.u * pw, ry = py + ph - rec.v * ph;
        s += '<path d="M' + rx + ' ' + (ry - 7) + 'L' + (rx + 7) + ' ' + ry + 'L' + rx + ' ' + (ry + 7) + 'L' + (rx - 7) + ' ' + ry + 'Z" fill="none" stroke="#2f7d6b" stroke-width="1.8"/>';
        s += '<text x="' + (rx + 10) + '" y="' + (ry + 12) + '" font-size="8.5" font-family="monospace" fill="#2f7d6b">下一段</text>';
      }

      s += '<rect id="e1-hit" x="' + px + '" y="' + py + '" width="' + pw + '" height="' + ph + '" fill="transparent" style="cursor:crosshair"/>';
      mapSvg.innerHTML = s;

      var hit = mapSvg.querySelector('#e1-hit');
      hit.addEventListener('mousemove', function (e) {
        var loc = svgPoint(mapSvg, e);
        var u = (loc.x - px) / pw, v = 1 - (loc.y - py) / ph;
        if (u < 0 || u > 1 || v < 0 || v > 1) return;
        var q = Q0 + u * (Q1 - Q0), ss = S0 + v * (S1 - S0);
        var p = L.gpPredict(model, [u, v]);
        var r = riskAt(q, ss, cur());
        readout.innerHTML = '排量 ' + q.toFixed(1) + ' · 砂比 ' + ss.toFixed(0) + '%<br>' +
          'NPV <b style="color:#2f7d6b">' + p.mean.toFixed(2) + ' ± ' + (p.sd * 1.96).toFixed(2) + '</b> · 风险 ' + Math.round(r * 100) + '%';
      });
      hit.addEventListener('mouseleave', function () { readout.textContent = '悬停看预测'; });
      hit.addEventListener('click', function (e) {
        var loc = svgPoint(mapSvg, e);
        var u = (loc.x - px) / pw, v = 1 - (loc.y - py) / ph;
        if (u < 0 || u > 1 || v < 0 || v > 1) return;
        if (timer) { clearInterval(timer); timer = null; autoBtn.textContent = '自动优化'; }
        addPoint(Q0 + u * (Q1 - Q0), S0 + v * (S1 - S0), '手动');
      });
    }

    function svgPoint(svg, e) {
      var pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }

    /* ---------- 指标 ---------- */
    function drawMetrics() {
      var gap = (best && trues.best) ? best.npv - trues.best.npv : null;
      var done = history.length >= state.budget;
      var focus = done ? predOpt : rec;
      metricsEl.innerHTML =
        '<div class="metric"><div class="l">' + (done ? '模型最优预测 NPV' : '推荐点预测 NPV') + '</div><div class="v">' + (focus.mean * 100).toFixed(0) + '<small>%</small></div></div>' +
        '<div class="metric ' + (best && best.npv >= 0.80 ? 'good' : 'warn') + '"><div class="l">已试最好 NPV</div><div class="v">' + (best ? (best.npv * 100).toFixed(0) + '<small>%</small>' : '—') + '</div></div>' +
        '<div class="metric ' + (gap != null && gap > -0.05 ? 'good' : 'warn') + '"><div class="l">与真实最优差距</div><div class="v">' + (gap != null ? (gap * 100).toFixed(0) + '<small>pp</small>' : '—') + '</div></div>' +
        '<div class="metric ' + (focus.risk <= state.tol ? 'good' : 'bad') + '"><div class="l">' + (done ? '模型最优施工风险' : '推荐点施工风险') + '</div><div class="v">' + Math.round(focus.risk * 100) + '<small>%</small></div></div>';

      var bind = rec.risk > state.tol * 0.9;
      if (history.length >= state.budget) {
        verdictEl.innerHTML = '试验段数已用完：已试最好 NPV <b>' + (best ? (best.npv * 100).toFixed(0) + '%' : '—') + '</b>，可行域内真实最优 <b>' +
          (trues.best ? (trues.best.npv * 100).toFixed(0) + '%' : '—') + '</b>。' +
          (trues.any && trues.any.risk > state.tol ? ' 无约束最优 NPV 更高（' + (trues.any.npv * 100).toFixed(0) + '%），但风险 ' + Math.round(trues.any.risk * 100) + '%，现场不可施工。' : '') +
          ' 点「重置」可以换一组初始段再看一次。';
      } else {
        verdictEl.innerHTML = '下一段推荐：排量 <b>' + rec.q.toFixed(1) + ' m³/min</b>、砂比 <b>' + rec.s.toFixed(0) +
          '%</b>，预测 NPV <b>' + (rec.mean * 100).toFixed(0) + ' ± ' + (rec.sd * 1.96 * 100).toFixed(0) +
          '%</b>，砂堵风险 <b>' + Math.round(rec.risk * 100) + '%</b>。' +
          (bind ? ' 推荐点已经贴着风险上限：再往上加排量或砂比，收益可能更高，但风险会越界。' : ' 当前风险离上限还有余量，优化器会优先探索高收益区。');
      }
    }

    /* ---------- 收敛曲线 ---------- */
    function drawConv() {
      var w = 360, h = 140, ml = 32, mr = 8, mt = 10, mb = 20;
      var n0 = state.initial, n1 = state.budget;
      function fx(n) { return ml + (n - n0) / Math.max(1, n1 - n0) * (w - ml - mr); }
      function fy(v) { return mt + (1 - v) * (h - mt - mb); }

      var s = '';
      [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
        s += '<line x1="' + ml + '" y1="' + fy(v) + '" x2="' + (w - mr) + '" y2="' + fy(v) + '" stroke="#eeeae0"/>';
        s += '<text x="' + (ml - 5) + '" y="' + (fy(v) + 3) + '" text-anchor="end" font-size="8" font-family="monospace" fill="#9ba3a9">' + Math.round(v * 100) + '</text>';
      });

      var arr = baseline[state.sc + '_' + state.tol.toFixed(2)];
      var bp = arr.map(function (d) { return fx(d.n).toFixed(1) + ',' + fy(d.v).toFixed(1); }).join(' ');
      s += '<polyline points="' + bp + '" fill="none" stroke="#b9c0c5" stroke-width="1.3" stroke-dasharray="4 3"/>';

      var bestV = 0, ap = [];
      for (var i = 0; i < history.length; i++) {
        if (history[i].risk <= state.tol && history[i].npv > bestV) bestV = history[i].npv;
        ap.push(fx(state.initial + i).toFixed(1) + ',' + fy(bestV).toFixed(1));
      }
      if (ap.length) {
        s += '<polyline points="' + ap.join(' ') + '" fill="none" stroke="#2f7d6b" stroke-width="1.7"/>';
        s += '<circle cx="' + fx(state.initial + history.length - 1) + '" cy="' + fy(bestV) + '" r="3" fill="#2f7d6b"/>';
      }
      if (trues.best) {
        s += '<line x1="' + ml + '" y1="' + fy(trues.best.npv) + '" x2="' + (w - mr) + '" y2="' + fy(trues.best.npv) + '" stroke="#8e5229" stroke-width="1" stroke-dasharray="5 4" opacity=".65"/>';
        s += '<text x="' + (w - mr) + '" y="' + (fy(trues.best.npv) - 4) + '" text-anchor="end" font-size="8" font-family="monospace" fill="#8e5229">可行最优 ' + Math.round(trues.best.npv * 100) + '%</text>';
      }

      s += '<text x="' + ml + '" y="' + (h - 4) + '" font-size="8" font-family="monospace" fill="#9ba3a9">' + n0 + ' 段</text>';
      s += '<text x="' + (w - mr) + '" y="' + (h - 4) + '" text-anchor="end" font-size="8" font-family="monospace" fill="#9ba3a9">' + n1 + ' 段</text>';
      convSvg.innerHTML = s;
      convNote.textContent = '绿实线：约束优化 · 灰虚线：随机试验';
    }

    /* ---------- 试验表 ---------- */
    function drawTable() {
      var rows = '';
      var start = Math.max(0, history.length - 6);
      for (var i = history.length - 1; i >= start; i--) {
        var p = history[i];
        var ok = p.risk <= state.tol;
        rows += '<tr><td>' + (i + 1) + '</td>' +
          '<td>' + p.q.toFixed(1) + '</td>' +
          '<td>' + p.s.toFixed(0) + '</td>' +
          '<td class="' + (p.npv >= 0.80 ? 'ok' : '') + '">' + (p.npv * 100).toFixed(0) + '</td>' +
          '<td class="' + (ok ? 'ok' : 'miss') + '">' + Math.round(p.risk * 100) + '</td>' +
          '<td class="lith">' + p.src + '</td></tr>';
      }
      tableEl.innerHTML = '<thead><tr><th>序号</th><th>排量 / (m³/min)</th><th>砂比 / %</th><th>实测 NPV / %</th><th>风险 / %</th><th>来源</th></tr></thead><tbody>' + rows + '</tbody>';
    }

    /* ---------- 风险—收益 Pareto 图 ---------- */
    function drawPareto() {
      var w = 360, h = 140, ml = 30, mr = 8, mt = 12, mb = 20;
      var pw = w - ml - mr, ph = h - mt - mb;
      function fx(r) { return ml + r * pw; }
      function fy(v) { return mt + (1 - v) * ph; }
      var s = '';

      [0, 0.5, 1].forEach(function (v) {
        s += '<line x1="' + ml + '" y1="' + fy(v) + '" x2="' + (w - mr) + '" y2="' + fy(v) + '" stroke="#eeeae0"/>';
        s += '<text x="' + (ml - 5) + '" y="' + (fy(v) + 3) + '" text-anchor="end" font-size="8" font-family="monospace" fill="#9ba3a9">' + Math.round(v * 100) + '</text>';
      });
      [0, 0.5, 1].forEach(function (v) {
        s += '<line x1="' + fx(v) + '" y1="' + mt + '" x2="' + fx(v) + '" y2="' + (mt + ph) + '" stroke="#f4f1e9"/>';
        s += '<text x="' + fx(v) + '" y="' + (h - 4) + '" text-anchor="middle" font-size="8" font-family="monospace" fill="#9ba3a9">' + Math.round(v * 100) + '%</text>';
      });

      s += '<line x1="' + fx(state.tol) + '" y1="' + mt + '" x2="' + fx(state.tol) + '" y2="' + (mt + ph) + '" stroke="#b05a51" stroke-width="1" stroke-dasharray="4 3" opacity=".7"/>';
      s += '<text x="' + (fx(state.tol) + 4) + '" y="' + (mt + 9) + '" font-size="7.5" font-family="monospace" fill="#b05a51">风险上限</text>';

      candSet.forEach(function (c) {
        var ok = c.risk <= state.tol;
        s += '<circle cx="' + fx(c.risk).toFixed(1) + '" cy="' + fy(c.mean).toFixed(1) + '" r="1.3" fill="' +
          (ok ? '#2f7d6b' : '#b05a51') + '" opacity="' + (ok ? '.17' : '.10') + '"/>';
      });

      var feas = candSet.filter(function (c) { return c.risk <= state.tol; })
        .sort(function (a, b) { return a.risk - b.risk; });
      var frontier = [], maxV = -1;
      feas.forEach(function (c) {
        if (c.mean > maxV + 1e-5) { frontier.push(c); maxV = c.mean; }
      });
      if (frontier.length) {
        var pts = frontier.map(function (c) { return fx(c.risk).toFixed(1) + ',' + fy(c.mean).toFixed(1); }).join(' ');
        s += '<polyline points="' + pts + '" fill="none" stroke="#2f7d6b" stroke-width="1.4" opacity=".7"/>';
        var last = frontier[frontier.length - 1];
        s += '<text x="' + (fx(last.risk) - 4) + '" y="' + (fy(last.mean) - 6) + '" text-anchor="end" font-size="7.5" font-family="monospace" fill="#2f7d6b">可行前沿</text>';
      }

      if (trues.best) {
        s += '<path d="' + starPath(fx(trues.best.risk), fy(trues.best.npv), 5) + '" fill="none" stroke="#8e5229" stroke-width="1.3"/>';
      }
      if (rec) {
        var rx = fx(rec.risk), ry = fy(rec.mean);
        s += '<path d="M' + rx + ' ' + (ry - 5) + 'L' + (rx + 5) + ' ' + ry + 'L' + rx + ' ' + (ry + 5) + 'L' + (rx - 5) + ' ' + ry + 'Z" fill="none" stroke="#41699b" stroke-width="1.5"/>';
      }

      s += '<text x="' + (w - mr) + '" y="' + (mt + 9) + '" text-anchor="end" font-size="7.5" fill="#79828a">风险 →</text>';
      s += '<text x="' + (ml + 2) + '" y="' + (mt + 9) + '" font-size="7.5" fill="#79828a">NPV</text>';
      paretoSvg.innerHTML = s;
    }

    function draw() { drawMap(); drawMetrics(); drawConv(); drawPareto(); draw3D(); drawTable(); }

    /* ---------- 三维场景：真实 NPV 地形 ---------- */
    var d3 = null;
    function draw3D() {
      if (!D3) return;
      var el = root.querySelector('#e1-d3');
      if (!el) return;
      if (!d3) {
        d3 = D3.create3D(el, { w: 460, h: 250, yaw: -32, elev: 30, cy: 0.58, paint: paint3D });
      } else {
        d3.repaint();
      }
    }

    function heightOf(npv) { return -0.42 + (npv - 0.30) / 0.60 * 0.95; }

    function paint3D(P, W, H) {
      var sc = cur();
      var out = [], i, j;

      for (i = 0; i <= 4; i++) {
        var t = i / 2 - 1;
        out.push(D3.line(P(t, -0.5, -1), P(t, -0.5, 1), '#eeeae0', .7));
        out.push(D3.line(P(-1, -0.5, t), P(1, -0.5, t), '#eeeae0', .7));
      }
      out.push(D3.line(P(-1, -0.5, -1), P(1, -0.5, -1), '#c9c2b0', 1));
      out.push(D3.line(P(-1, -0.5, 1), P(1, -0.5, 1), '#c9c2b0', 1));
      out.push(D3.line(P(-1, -0.5, -1), P(-1, -0.5, 1), '#c9c2b0', 1));

      var NQ = 30, NS = 22, faces = [], mn = 1e9, mx = -1e9;
      for (i = 0; i < NQ; i++) for (j = 0; j < NS; j++) {
        var qc0 = Q0 + (i + 0.5) / NQ * (Q1 - Q0), sc0 = S0 + (j + 0.5) / NS * (S1 - S0);
        var v0 = npvAt(qc0, sc0, sc);
        if (v0 < mn) mn = v0;
        if (v0 > mx) mx = v0;
      }
      for (i = 0; i < NQ; i++) for (j = 0; j < NS; j++) {
        var q0 = Q0 + i / NQ * (Q1 - Q0), s0 = S0 + j / NS * (S1 - S0);
        var q1 = Q0 + (i + 1) / NQ * (Q1 - Q0), s1 = S0 + (j + 1) / NS * (S1 - S0);
        var vv = npvAt((q0 + q1) / 2, (s0 + s1) / 2, sc);
        var rk = riskAt((q0 + q1) / 2, (s0 + s1) / 2, sc);
        var y0 = heightOf(vv);
        var c = [
          P((q0 - Q0) / (Q1 - Q0) * 2 - 1, y0, (s0 - S0) / (S1 - S0) * 2 - 1),
          P((q0 - Q0) / (Q1 - Q0) * 2 - 1, y0, (s1 - S0) / (S1 - S0) * 2 - 1),
          P((q1 - Q0) / (Q1 - Q0) * 2 - 1, y0, (s1 - S0) / (S1 - S0) * 2 - 1),
          P((q1 - Q0) / (Q1 - Q0) * 2 - 1, y0, (s0 - S0) / (S1 - S0) * 2 - 1)
        ];
        var d = (c[0].d + c[1].d + c[2].d + c[3].d) / 4;
        faces.push({ c: c, d: d, t: (vv - mn) / Math.max(1e-6, mx - mn), rk: rk });
      }
      faces.sort(function (a, b) { return a.d - b.d; }).forEach(function (f) {
        var col = L.ramp(Math.max(0.02, Math.min(1, (f.t - 0.12) / 0.72)), D3.DSURF);
        out.push(D3.poly(f.c, col, { so2: .97, sw: .6, so: 1 }));
        if (f.rk > state.tol) out.push(D3.poly(f.c, '#b05a51', { so2: .18, sw: 0, so: 1 }));
      });

      history.forEach(function (p) {
        var x = (p.q - Q0) / (Q1 - Q0) * 2 - 1, z = (p.s - S0) / (S1 - S0) * 2 - 1, y = heightOf(p.npv);
        var stem = P(x, y, z), base = P(x, -0.5, z);
        out.push(D3.line(base, stem, '#4d565b', .8));
        out.push('<circle cx="' + stem.x.toFixed(1) + '" cy="' + stem.y.toFixed(1) + '" r="3" fill="#242b2e" stroke="#ffffff" stroke-width="1.1"/>');
      });

      if (rec) {
        var rx = (rec.q - Q0) / (Q1 - Q0) * 2 - 1, rz = (rec.s - S0) / (S1 - S0) * 2 - 1;
        var rp = P(rx, heightOf(npvAt(rec.q, rec.s, sc)), rz);
        out.push('<path d="M' + rp.x.toFixed(1) + ' ' + (rp.y - 6).toFixed(1) + 'l6 6-6 6-6-6z" fill="#b26a39" stroke="#fff" stroke-width="1.2"/>');
      }
      if (trues.best) {
        var tx = (trues.best.q - Q0) / (Q1 - Q0) * 2 - 1, tz = (trues.best.s - S0) / (S1 - S0) * 2 - 1;
        var tp0 = P(tx, heightOf(trues.best.npv), tz);
        var star = [];
        for (var k = 0; k < 10; k++) {
          var ang = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 3.2 : 6.5;
          star.push((tp0.x + Math.cos(ang) * r).toFixed(1) + ',' + (tp0.y + Math.sin(ang) * r).toFixed(1));
        }
        out.push('<path d="M' + star.join('L') + 'Z" fill="#8e5229" stroke="#fff" stroke-width="1"/>');
      }

      out.push(D3.text(P(-0.45, -0.66, 1.28), '排量 →', '#79828a', 8.5));
      out.push(D3.text(P(1.3, -0.66, -0.4), '砂比 ↑', '#79828a', 8.5));
      out.push(D3.text(P(-1.02, .66, -0.88), 'NPV', '#79828a', 8.5, 'end', 600));
      out.push(D3.text(P(0.98, -0.66, 1.3), '红罩 = 风险超限', '#b26a39', 7.5, 'start'));
      return out.join('');
    }

    /* ---------- 事件 ---------- */
    root.querySelector('[data-act="next"]').addEventListener('click', function () {
      if (history.length >= state.budget) return;
      addPoint(rec.q, rec.s, '推荐');
    });

    root.querySelector('[data-act="reset"]').addEventListener('click', reset);

    root.querySelector('[data-act="auto"]').addEventListener('click', function () {
      if (timer) {
        clearInterval(timer); timer = null;
        autoBtn.textContent = '自动优化';
        return;
      }
      if (history.length >= state.budget) return;
      autoBtn.textContent = '暂停';
      timer = setInterval(function () {
        if (history.length >= state.budget) {
          clearInterval(timer); timer = null;
          autoBtn.textContent = '自动优化';
          return;
        }
        addPoint(rec.q, rec.s, '推荐');
      }, 520);
    });

    tolEl.addEventListener('input', function () {
      state.tol = +this.value;
      tolV.textContent = Math.round(state.tol * 100) + '%';
      buildBaseline();
      rebuild(); draw();
    });

    [].forEach.call(chips, function (ch) {
      ch.addEventListener('click', function () {
        state.sc = ch.getAttribute('data-sc');
        [].forEach.call(chips, function (x) { x.classList.toggle('on', x === ch); });
        reset();
      });
    });

    reset();
  }

  window.EorFracOptDemo = EorFracOptDemo;
  window.EorFracOptCleanup = function () {
    if (timer) { clearInterval(timer); timer = null; }
  };
})();
