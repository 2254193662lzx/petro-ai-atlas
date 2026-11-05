/* =========================================================
   增采 e3 可运行示范 · 化学驱配方智能筛选
   ---------------------------------------------------------
   纯前端，无依赖：
     合成"配方 → 增油幅度"响应面 → 高斯过程代理模型
     → UCB 采集函数推荐下一组实验 → 与随机实验对比
   对外暴露 window.EorChemicalFloodDemo(root, ctx)
   ========================================================= */

(function () {
  'use strict';

  var L = window.EORLib;
  var D3 = window.EOR3D;

  var timer = null;

  if (!L) {
    window.EorChemicalFloodDemo = function (root) {
      root.innerHTML = '<div class="callout warn"><span class="ci">缺失</span><span>示范依赖 eor-demo-lib.js，请检查脚本加载顺序。</span></div>';
    };
    window.EorChemicalFloodCleanup = function () { };
    return;
  }

  var YMAX = 25;
  var X0 = 0.05, X1 = 0.35;   // 聚合物浓度 wt%
  var S0 = 0.05, S1 = 0.80;   // 表面活性剂浓度 wt%

  /* 合成响应面：单位是"增油幅度 / 百分点" */
  function trueResponse(x, y) {
    var u = (x - X0) / (X1 - X0);
    var v = (y - S0) / (S1 - S0);
    var core = 13.0 * Math.exp(-(((u - 0.64) * (u - 0.64)) / 0.045 + ((v - 0.56) * (v - 0.56)) / 0.05));
    var trend = 2.6 * u + 1.6 * v - 1.1 * u * v;
    var tooViscous = -2.4 * Math.exp(-((u - 0.95) * (u - 0.95)) / 0.012);
    return L.clamp(4.0 + core + trend + tooViscous, 0, YMAX);
  }

  function trueOptimum() {
    var best = { x: X0, y: S0, v: -1 };
    for (var i = 0; i <= 80; i++) {
      for (var j = 0; j <= 80; j++) {
        var x = X0 + (X1 - X0) * i / 80;
        var y = S0 + (S1 - S0) * j / 80;
        var v = trueResponse(x, y);
        if (v > best.v) best = { x: x, y: y, v: v };
      }
    }
    return best;
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

  function EorChemicalFloodDemo(root) {
    var TRUE = trueOptimum();
    var state = { budget: 14, initial: 6, showSd: false, seed: 20261023 };
    var rnd, history, model, rec, predOpt, baseline, best;

    root.innerHTML = '' +
      '<div class="demo">' +
      '<div class="demo-head">' +
      '<div><span class="kicker">INTERACTIVE · 主动学习</span>' +
      '<h3 style="margin-top:8px">下一组化学驱配方，应该做哪个实验？</h3>' +
      '<p>下面是一个合成的"配方—增油幅度"响应面。初始只做了 6 组实验，用高斯过程拟合后，由 UCB 采集函数决定下一组实验放在哪。你可以点热力图自己加实验，也可以让它自动推荐。</p></div>' +
      '<button class="btn primary" data-act="reset">重置实验 ↻</button>' +
      '</div>' +

      '<div class="demo-ctl">' +
      '<div class="ctl"><label>实验预算</label><input type="range" min="8" max="24" step="1" value="14" id="e3-budget"><span class="val" id="e3-budget-v">14</span></div>' +
      '<label class="ctl tog" id="e3-sd"><i></i>显示模型不确定度</label>' +
      '<button class="btn sm" data-act="next">推荐下一组 →</button>' +
      '<button class="btn sm" data-act="auto">自动做完</button>' +
      '<span class="small muted" id="e3-tip">也可以直接点左侧热力图做一次实验</span>' +
      '</div>' +

      '<div class="demo-grid">' +
      '<div class="track-wrap"><div class="track">' +
      '<svg id="e3-map" viewBox="0 0 460 340" role="img" aria-label="配方响应面与实验点"></svg>' +
      '<div class="readout" id="e3-readout">点图加一次实验</div></div>' +
      '<div class="track-legend">' +
      '<span><i style="background:#5d666d"></i>初始实验</span>' +
      '<span><i style="background:#b26a39"></i>推荐/手动实验</span>' +
      '<span><i style="background:#2f7d6b"></i>下一组推荐</span>' +
      '<span><i style="background:#41699b"></i>模型最优</span>' +
      '<span><i style="background:#8e5229"></i>真实最优（示范已知）</span>' +
      '</div></div>' +

      '<div class="demo-side">' +
      '<div class="metrics" id="e3-metrics"></div>' +
      '<div class="fitbox"><div class="ft"><span>当前最优 vs 实验次数</span><span id="e3-conv-note"></span></div>' +
      '<svg id="e3-conv" viewBox="0 0 360 140"></svg></div>' +
      '<div class="verdict" id="e3-verdict"></div>' +
      '<div class="hintbox"><b>为什么要主动学习：</b>配方空间很大，实验很贵。随机做 14 组实验，大概率只覆盖低浓度区；主动学习会把点放到"预测不错且还没把握"的位置，用更少的实验逼近真实最优。' +
      '注意热力图上的<b>模型最优</b>与<b>下一组推荐</b>不是一回事：前者是当前拟合的最高点，后者是信息量最大的点。</div>' +
      '</div></div>' +

      '<div class="fitbox" style="margin:0 16px 12px"><div class="ft"><span>三维场景 · 增油幅度响应面（左键拖动旋转，双击复位）</span><span>黑点=已完成实验（含短柱）· 菱形=下一组推荐</span></div>' +
      '<div class="d3-scene" id="e3-d3"></div></div>' +

      '<div class="ltable-wrap"><table class="ltable" id="e3-table"></table></div>' +
      '</div>';

    var mapSvg = root.querySelector('#e3-map');
    var convSvg = root.querySelector('#e3-conv');
    var metricsEl = root.querySelector('#e3-metrics');
    var verdictEl = root.querySelector('#e3-verdict');
    var tableEl = root.querySelector('#e3-table');
    var readout = root.querySelector('#e3-readout');
    var budgetEl = root.querySelector('#e3-budget');
    var budgetV = root.querySelector('#e3-budget-v');
    var convNote = root.querySelector('#e3-conv-note');
    var autoBtn = root.querySelector('[data-act="auto"]');

    var W = 460, H = 340, px = 56, py = 22, pw = 356, ph = 268;
    var COLS = 24, ROWS = 19;

    /* ---------- 状态 ---------- */
    function reset() {
      if (timer) { clearInterval(timer); timer = null; }
      if (autoBtn) autoBtn.textContent = '自动做完';
      rnd = L.mulberry32(state.seed);
      history = [];
      var init = L.lhs2d(state.initial, rnd);
      init.forEach(function (p) {
        var x = X0 + p[0] * (X1 - X0);
        var y = S0 + p[1] * (S1 - S0);
        history.push({ x: x, y: y, obs: L.clamp(trueResponse(x, y) + L.gauss(rnd) * 0.35, 0, YMAX), src: '初始' });
      });
      buildBaseline();
      rebuild();
      draw();
    }

    function buildBaseline() {
      var reps = 40;
      baseline = [];
      for (var n = state.initial; n <= state.budget; n++) {
        var sum = 0;
        for (var r = 0; r < reps; r++) {
          var br = L.mulberry32(9001 + r * 131 + n);
          var bestV = 0;
          for (var i = 0; i < n; i++) {
            var x = X0 + br() * (X1 - X0);
            var y = S0 + br() * (S1 - S0);
            var v = trueResponse(x, y);
            if (v > bestV) bestV = v;
          }
          sum += bestV;
        }
        baseline.push({ n: n, v: sum / reps });
      }
    }

    function norm(p) { return [(p.x - X0) / (X1 - X0), (p.y - S0) / (S1 - S0)]; }

    function rebuild() {
      var X = history.map(norm);
      var y = history.map(function (p) { return p.obs / YMAX; });
      model = L.fitGP(X, y, { sigmaF: 0.24, length: 0.27, sigmaN: 0.018 });

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
          var pred = L.gpPredict(model, [u, v]);
          cands.push({ u: u, v: v, x: X0 + u * (X1 - X0), y: S0 + v * (S1 - S0), mean: pred.mean * YMAX, sd: pred.sd * YMAX });
        }
      }
      rec = null;
      predOpt = null;
      for (i = 0; i < cands.length; i++) {
        var c = cands[i];
        if (!rec || c.mean + 1.35 * c.sd > rec.mean + 1.35 * rec.sd) rec = c;
        if (!predOpt || c.mean > predOpt.mean) predOpt = c;
      }
      best = history.reduce(function (a, b) { return b.obs > a.obs ? b : a; }, history[0]);
    }

    function addPoint(x, y, src) {
      if (history.length >= state.budget) return false;
      var tooClose = history.some(function (p) {
        var du = (p.x - x) / (X1 - X0), dv = (p.y - y) / (S1 - S0);
        return du * du + dv * dv < 0.0009;
      });
      if (tooClose) return false;
      history.push({ x: x, y: y, obs: L.clamp(trueResponse(x, y) + L.gauss(rnd) * 0.35, 0, YMAX), src: src || '手动' });
      rebuild();
      draw();
      return true;
    }

    /* ---------- 热力图 ---------- */
    function drawMap() {
      var s = '';
      s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';

      var maxSd = 0.001, i, j;
      var cells = [];
      for (i = 0; i < COLS; i++) {
        cells.push([]);
        for (j = 0; j < ROWS; j++) {
          var u = (i + 0.5) / COLS, v = 1 - (j + 0.5) / ROWS;
          var p = L.gpPredict(model, [u, v]);
          var mean = p.mean * YMAX, sd = p.sd * YMAX;
          cells[i].push({ mean: mean, sd: sd });
          if (sd > maxSd) maxSd = sd;
        }
      }

      var mn = 1e9, mx = -1e9;
      for (i = 0; i < COLS; i++) {
        for (j = 0; j < ROWS; j++) {
          if (cells[i][j].mean < mn) mn = cells[i][j].mean;
          if (cells[i][j].mean > mx) mx = cells[i][j].mean;
        }
      }
      var range = Math.max(3, mx - mn);

      var cw = pw / COLS, ch = ph / ROWS;
      for (i = 0; i < COLS; i++) {
        for (j = 0; j < ROWS; j++) {
          var c = cells[i][j];
          var col = state.showSd
            ? L.ramp(c.sd / maxSd, L.WARM)
            : L.ramp((c.mean - mn) / range, L.SEQ);
          s += '<rect x="' + (px + i * cw + 0.5).toFixed(1) + '" y="' + (py + j * ch + 0.5).toFixed(1) +
            '" width="' + (cw - 1).toFixed(1) + '" height="' + (ch - 1).toFixed(1) + '" fill="' + col + '"/>';
        }
      }

      // 网格与刻度
      for (i = 0; i <= 4; i++) {
        var gx = px + pw * i / 4;
        s += '<line x1="' + gx + '" y1="' + py + '" x2="' + gx + '" y2="' + (py + ph) + '" stroke="#ffffff" stroke-opacity=".35"/>';
        var xv = X0 + (X1 - X0) * i / 4;
        s += '<text x="' + gx + '" y="' + (py + ph + 16) + '" text-anchor="middle" font-size="8.5" font-family="monospace" fill="#9ba3a9">' + xv.toFixed(2) + '</text>';
      }
      for (j = 0; j <= 4; j++) {
        var gy = py + ph * j / 4;
        s += '<line x1="' + px + '" y1="' + gy + '" x2="' + (px + pw) + '" y2="' + gy + '" stroke="#ffffff" stroke-opacity=".35"/>';
        var sv = S0 + (S1 - S0) * (1 - j / 4);
        s += '<text x="' + (px - 7) + '" y="' + (gy + 3) + '" text-anchor="end" font-size="8.5" font-family="monospace" fill="#9ba3a9">' + sv.toFixed(2) + '</text>';
      }
      s += '<text x="' + (px + pw / 2) + '" y="' + (py + ph + 34) + '" text-anchor="middle" font-size="9.5" fill="#79828a">聚合物浓度 / wt%</text>';
      s += '<text x="14" y="' + (py + ph / 2) + '" text-anchor="middle" font-size="9.5" fill="#79828a" transform="rotate(-90 14 ' + (py + ph / 2) + ')">表面活性剂浓度 / wt%</text>';
      s += '<text x="' + (px + pw) + '" y="' + (py + ph + 16) + '" text-anchor="end" font-size="8.5" font-family="monospace" fill="#9ba3a9">' + (state.showSd ? '不确定度' : '预测增油 / pp') + '</text>';

      // 真实最优
      var tx = px + (TRUE.x - X0) / (X1 - X0) * pw;
      var ty = py + ph - (TRUE.y - S0) / (S1 - S0) * ph;
      s += '<path d="' + starPath(tx, ty, 6.5) + '" fill="none" stroke="#8e5229" stroke-width="1.4"/>';
      s += '<text x="' + (tx + 10) + '" y="' + (ty - 7) + '" font-size="8.5" font-family="monospace" fill="#8e5229">真实最优</text>';

      // 模型最优
      if (predOpt) {
        var mx = px + predOpt.u * pw, my = py + ph - predOpt.v * ph;
        s += '<circle cx="' + mx + '" cy="' + my + '" r="5" fill="none" stroke="#41699b" stroke-width="1.5"/>';
        s += '<line x1="' + (mx - 8) + '" y1="' + my + '" x2="' + (mx + 8) + '" y2="' + my + '" stroke="#41699b" stroke-width="1"/>';
        s += '<line x1="' + mx + '" y1="' + (my - 8) + '" x2="' + mx + '" y2="' + (my + 8) + '" stroke="#41699b" stroke-width="1"/>';
      }

      // 实验点
      history.forEach(function (p, idx) {
        var cx = px + (p.x - X0) / (X1 - X0) * pw;
        var cy = py + ph - (p.y - S0) / (S1 - S0) * ph;
        var col = p.src === '初始' ? '#5d666d' : p.src === '推荐' ? '#b26a39' : '#7e5a8d';
        s += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4.2" fill="' + col + '" stroke="#ffffff" stroke-width="1.2"/>';
        if (idx >= history.length - 1) {
          s += '<text x="' + (cx + 7) + '" y="' + (cy - 6) + '" font-size="8" font-family="monospace" fill="' + col + '">最新</text>';
        }
      });

      // 下一组推荐
      if (rec && history.length < state.budget) {
        var rx = px + rec.u * pw, ry = py + ph - rec.v * ph;
        s += '<path d="M' + rx + ' ' + (ry - 7) + 'L' + (rx + 7) + ' ' + ry + 'L' + rx + ' ' + (ry + 7) + 'L' + (rx - 7) + ' ' + ry + 'Z" fill="none" stroke="#2f7d6b" stroke-width="1.8"/>';
        s += '<text x="' + (rx + 10) + '" y="' + (ry + 12) + '" font-size="8.5" font-family="monospace" fill="#2f7d6b">下一点</text>';
      }

      s += '<rect id="e3-hit" x="' + px + '" y="' + py + '" width="' + pw + '" height="' + ph + '" fill="transparent" style="cursor:crosshair"/>';
      mapSvg.innerHTML = s;

      var hit = mapSvg.querySelector('#e3-hit');
      hit.addEventListener('mousemove', function (e) {
        var loc = svgPoint(mapSvg, e);
        var u = (loc.x - px) / pw, v = 1 - (loc.y - py) / ph;
        if (u < 0 || u > 1 || v < 0 || v > 1) return;
        var x = X0 + u * (X1 - X0), y = S0 + v * (S1 - S0);
        var p = L.gpPredict(model, [u, v]);
        readout.innerHTML = '聚合物 ' + x.toFixed(3) + ' wt% · 表活 ' + y.toFixed(2) + ' wt%<br>' +
          '预测 <b style="color:#2f7d6b">' + (p.mean * YMAX).toFixed(1) + ' ± ' + (p.sd * YMAX * 1.96).toFixed(1) + '</b> pp';
      });
      hit.addEventListener('mouseleave', function () { readout.textContent = '点图加一次实验'; });
      hit.addEventListener('click', function (e) {
        var loc = svgPoint(mapSvg, e);
        var u = (loc.x - px) / pw, v = 1 - (loc.y - py) / ph;
        if (u < 0 || u > 1 || v < 0 || v > 1) return;
        if (timer) { clearInterval(timer); timer = null; autoBtn.textContent = '自动做完'; }
        addPoint(X0 + u * (X1 - X0), S0 + v * (S1 - S0), '手动');
      });
    }

    function svgPoint(svg, e) {
      var pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }

    /* ---------- 指标 ---------- */
    function drawMetrics() {
      var gap = best.obs - TRUE.v;
      var done = history.length >= state.budget;
      var focus = done ? predOpt : rec;
      var sd = focus ? focus.sd : 0;
      metricsEl.innerHTML =
        '<div class="metric"><div class="l">实验数</div><div class="v">' + history.length + '<small>/' + state.budget + '</small></div></div>' +
        '<div class="metric ' + (best.obs >= 17 ? 'good' : 'warn') + '"><div class="l">当前最优增油</div><div class="v">' + best.obs.toFixed(1) + '<small>pp</small></div></div>' +
        '<div class="metric ' + (gap > -1.2 ? 'good' : 'warn') + '"><div class="l">与真实最优差距</div><div class="v">' + gap.toFixed(1) + '<small>pp</small></div></div>' +
        '<div class="metric"><div class="l">' + (done ? '模型最优不确定度' : '推荐点不确定度') + '</div><div class="v">±' + (sd * 1.96).toFixed(1) + '<small>pp</small></div></div>';

      if (history.length >= state.budget) {
        verdictEl.innerHTML = '实验预算已用完：当前最优 <b>' + best.obs.toFixed(1) + ' pp</b>，真实最优 <b>' + TRUE.v.toFixed(1) +
          ' pp</b>。<b>随机实验</b>在同样 14 组下的平均最好成绩约 <b>' + baseline[baseline.length - 1].v.toFixed(1) +
          ' pp</b>——这就是主动学习省下来的部分。点「重置实验」可以换一组初始点再看一次。';
      } else {
        verdictEl.innerHTML = '下一组推荐：聚合物 <b>' + rec.x.toFixed(3) + ' wt%</b> + 表面活性剂 <b>' + rec.y.toFixed(2) +
          ' wt%</b>，预测增油 <b>' + rec.mean.toFixed(1) + ' ± ' + (rec.sd * 1.96).toFixed(1) +
          ' pp</b>。当前模型认为最优点在聚合物 <b>' + predOpt.x.toFixed(3) + '</b>、表活 <b>' + predOpt.y.toFixed(2) +
          '</b>，但采样点还不够密，所以先做一次推荐实验来降低不确定度。';
      }
    }

    /* ---------- 收敛曲线 ---------- */
    function drawConv() {
      var w = 360, h = 140, ml = 30, mr = 8, mt = 10, mb = 20;
      var n0 = state.initial, n1 = state.budget;
      var ymax = 22;
      function fx(n) { return ml + (n - n0) / Math.max(1, n1 - n0) * (w - ml - mr); }
      function fy(v) { return mt + (1 - v / ymax) * (h - mt - mb); }

      var s = '';
      [0, 5, 10, 15, 20].forEach(function (v) {
        s += '<line x1="' + ml + '" y1="' + fy(v) + '" x2="' + (w - mr) + '" y2="' + fy(v) + '" stroke="#eeeae0"/>';
        s += '<text x="' + (ml - 5) + '" y="' + (fy(v) + 3) + '" text-anchor="end" font-size="8" font-family="monospace" fill="#9ba3a9">' + v + '</text>';
      });

      // 随机基线
      var bp = baseline.map(function (d) { return fx(d.n).toFixed(1) + ',' + fy(d.v).toFixed(1); }).join(' ');
      s += '<polyline points="' + bp + '" fill="none" stroke="#b9c0c5" stroke-width="1.3" stroke-dasharray="4 3"/>';

      // 主动学习：历史最优
      var bestSoFar = 0, ap = [];
      for (var i = 0; i < history.length; i++) {
        if (history[i].obs > bestSoFar) bestSoFar = history[i].obs;
        ap.push(fx(state.initial + i).toFixed(1) + ',' + fy(bestSoFar).toFixed(1));
      }
      if (ap.length) {
        s += '<polyline points="' + ap.join(' ') + '" fill="none" stroke="#2f7d6b" stroke-width="1.7"/>';
        var lastN = state.initial + history.length - 1;
        s += '<circle cx="' + fx(lastN) + '" cy="' + fy(bestSoFar) + '" r="3" fill="#2f7d6b"/>';
      }

      // 真实最优水平
      s += '<line x1="' + ml + '" y1="' + fy(TRUE.v) + '" x2="' + (w - mr) + '" y2="' + fy(TRUE.v) + '" stroke="#8e5229" stroke-width="1" stroke-dasharray="5 4" opacity=".65"/>';
      s += '<text x="' + (w - mr) + '" y="' + (fy(TRUE.v) - 4) + '" text-anchor="end" font-size="8" font-family="monospace" fill="#8e5229">真实最优 ' + TRUE.v.toFixed(1) + '</text>';

      s += '<text x="' + ml + '" y="' + (h - 4) + '" font-size="8" font-family="monospace" fill="#9ba3a9">' + n0 + ' 组</text>';
      s += '<text x="' + (w - mr) + '" y="' + (h - 4) + '" text-anchor="end" font-size="8" font-family="monospace" fill="#9ba3a9">' + n1 + ' 组</text>';
      convSvg.innerHTML = s;
      convNote.textContent = '绿实线：主动学习 · 灰虚线：随机实验平均';
    }

    /* ---------- 实验表 ---------- */
    function drawTable() {
      var rows = '';
      var start = Math.max(0, history.length - 6);
      for (var i = history.length - 1; i >= start; i--) {
        var p = history[i];
        rows += '<tr><td>' + (i + 1) + '</td>' +
          '<td>' + p.x.toFixed(3) + '</td>' +
          '<td>' + p.y.toFixed(2) + '</td>' +
          '<td class="' + (p.obs >= 17 ? 'ok' : '') + '">' + p.obs.toFixed(1) + '</td>' +
          '<td class="lith">' + p.src + '</td></tr>';
      }
      tableEl.innerHTML = '<thead><tr><th>序号</th><th>聚合物 / wt%</th><th>表活 / wt%</th><th>实测增油 / pp</th><th>来源</th></tr></thead><tbody>' + rows + '</tbody>';
    }

    /* ---------- 三维场景：增油幅度响应面 ---------- */
    var d3 = null;
    function draw3D() {
      if (!D3) return;
      var el = root.querySelector('#e3-d3');
      if (!el) return;
      if (!d3) {
        d3 = D3.create3D(el, { w: 460, h: 250, yaw: -32, elev: 28, cy: 0.56, paint: paint3D });
      } else {
        d3.repaint();
      }
    }

    function paint3D(P) {
      var out = [], i, j;
      for (i = 0; i <= 4; i++) {
        var t = i / 2 - 1;
        out.push(D3.line(P(t, -0.5, -1), P(t, -0.5, 1), '#eeeae0', .7));
        out.push(D3.line(P(-1, -0.5, t), P(1, -0.5, t), '#eeeae0', .7));
      }
      out.push(D3.line(P(-1, -0.5, -1), P(1, -0.5, -1), '#c9c2b0', 1));
      out.push(D3.line(P(-1, -0.5, 1), P(1, -0.5, 1), '#c9c2b0', 1));
      out.push(D3.line(P(-1, -0.5, -1), P(-1, -0.5, 1), '#c9c2b0', 1));

      var NQ = 26, NS = 22, faces = [], mn = 1e9, mx = -1e9;
      for (i = 0; i < NQ; i++) for (j = 0; j < NS; j++) {
        var u0 = -1 + (i + 0.5) / NQ * 2, v0 = -1 + (j + 0.5) / NS * 2;
        var r0 = trueResponse(X0 + (u0 + 1) / 2 * (X1 - X0), S0 + (v0 + 1) / 2 * (S1 - S0));
        if (r0 < mn) mn = r0;
        if (r0 > mx) mx = r0;
      }
      for (i = 0; i < NQ; i++) for (j = 0; j < NS; j++) {
        var uA = -1 + i / NQ * 2, vA = -1 + j / NS * 2;
        var uB = -1 + (i + 1) / NQ * 2, vB = -1 + (j + 1) / NS * 2;
        var qA = X0 + (uA + 1) / 2 * (X1 - X0), sA = S0 + (vA + 1) / 2 * (S1 - S0);
        var qB = X0 + (uB + 1) / 2 * (X1 - X0), sB = S0 + (vB + 1) / 2 * (S1 - S0);
        var v1 = trueResponse((qA + qB) / 2, (sA + sB) / 2);
        var y0 = -0.42 + (v1 - 4) / 16 * 0.95;
        var c = [P(uA, y0, vA), P(uA, y0, vB), P(uB, y0, vB), P(uB, y0, vA)];
        var d = (c[0].d + c[1].d + c[2].d + c[3].d) / 4;
        faces.push({ c: c, d: d, t: (v1 - mn) / Math.max(1e-6, mx - mn) });
      }
      faces.sort(function (a, b) { return a.d - b.d; }).forEach(function (f) {
        out.push(D3.poly(f.c, L.ramp(Math.max(0.02, Math.min(1, (f.t - 0.1) / 0.75)), D3.DSURF), { so2: .97, sw: .6, so: 1 }));
      });

      /* 已完成实验：短虚线柱 + 顶部黑点 */
      history.forEach(function (p) {
        var x = (p.x - X0) / (X1 - X0) * 2 - 1, z = (p.y - S0) / (S1 - S0) * 2 - 1;
        var y0 = Math.min(0.7, -0.42 + (trueResponse(p.x, p.y) - 4) / 16 * 0.95);
        out.push(D3.line(P(x, -0.5, z), P(x, y0, z), '#242b2e', 1, '3 2'));
        var top = P(x, y0 + 0.02, z);
        out.push('<circle cx="' + top.x.toFixed(1) + '" cy="' + top.y.toFixed(1) + '" r="3" fill="#242b2e" stroke="#fff" stroke-width="1.1"/>');
      });

      /* 下一组推荐（菱形） */
      if (rec) {
        var rx = (rec.x - X0) / (X1 - X0) * 2 - 1, rz = (rec.y - S0) / (S1 - S0) * 2 - 1;
        var rp = P(rx, Math.min(0.75, -0.42 + (rec.mean - 4) / 16 * 0.95), rz);
        out.push('<path d="M' + rp.x.toFixed(1) + ' ' + (rp.y - 6).toFixed(1) + 'l6 6-6 6-6-6z" fill="#b26a39" stroke="#fff" stroke-width="1.2"/>');
      }
      /* 真实最优（星形） */
      var tp0 = P((TRUE.x - X0) / (X1 - X0) * 2 - 1, Math.min(0.78, -0.42 + (TRUE.v - 4) / 16 * 0.95), (TRUE.y - S0) / (S1 - S0) * 2 - 1);
      var star = [];
      for (i = 0; i < 10; i++) {
        var ang = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.2 : 6.5;
        star.push((tp0.x + Math.cos(ang) * r).toFixed(1) + ',' + (tp0.y + Math.sin(ang) * r).toFixed(1));
      }
      out.push('<path d="M' + star.join('L') + 'Z" fill="#8e5229" stroke="#fff" stroke-width="1"/>');

      out.push(D3.text(P(-0.45, -0.66, 1.3), '聚合物 →', '#79828a', 8.5));
      out.push(D3.text(P(1.32, -0.66, -0.4), '表活 ↑', '#79828a', 8.5));
      out.push(D3.text(P(-1.02, .66, -0.92), '增油 pp', '#79828a', 8.5, 'end', 600));
      return out.join('');
    }

    function draw() { drawMap(); drawMetrics(); drawConv(); draw3D(); drawTable(); }

    /* ---------- 事件 ---------- */
    root.querySelector('[data-act="next"]').addEventListener('click', function () {
      if (history.length >= state.budget) return;
      addPoint(rec.x, rec.y, '推荐');
    });

    root.querySelector('[data-act="reset"]').addEventListener('click', reset);

    root.querySelector('[data-act="auto"]').addEventListener('click', function () {
      if (timer) {
        clearInterval(timer); timer = null;
        autoBtn.textContent = '自动做完';
        return;
      }
      if (history.length >= state.budget) return;
      autoBtn.textContent = '暂停';
      timer = setInterval(function () {
        if (history.length >= state.budget) {
          clearInterval(timer); timer = null;
          autoBtn.textContent = '自动做完';
          return;
        }
        addPoint(rec.x, rec.y, '推荐');
      }, 520);
    });

    budgetEl.addEventListener('input', function () {
      state.budget = +this.value;
      budgetV.textContent = this.value;
      if (history.length > state.budget) reset();
      else { buildBaseline(); draw(); }
    });

    var sdTog = root.querySelector('#e3-sd');
    sdTog.addEventListener('click', function () {
      state.showSd = !state.showSd;
      sdTog.classList.toggle('on', state.showSd);
      drawMap();
    });

    reset();
  }

  window.EorChemicalFloodDemo = EorChemicalFloodDemo;
  window.EorChemicalFloodCleanup = function () {
    if (timer) { clearInterval(timer); timer = null; }
  };
})();
