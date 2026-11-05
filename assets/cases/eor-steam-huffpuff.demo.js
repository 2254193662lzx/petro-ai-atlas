/* =========================================================
   增采 e4 可运行示范 · 蒸汽吞吐注采参数优化
   ---------------------------------------------------------
   纯前端，无依赖：
     简化周期模型（加热半径 + 焖井效率 + 剩余油）
     → 固定均匀注汽 vs 固定蒸汽预算下的逐周期分配
   对外暴露 window.EorSteamHuffpuffDemo(root, ctx)
   ========================================================= */

(function () {
  'use strict';

  var L = window.EORLib;
  var D3 = window.EOR3D;

  var timer = null;

  if (!L) {
    window.EorSteamHuffpuffDemo = function (root) {
      root.innerHTML = '<div class="callout warn"><span class="ci">缺失</span><span>示范依赖 eor-demo-lib.js，请检查脚本加载顺序。</span></div>';
    };
    window.EorSteamHuffpuffCleanup = function () { };
    return;
  }

  var CYCLES = 8;
  var O0 = 1400;          // 可动用油量尺度，控制周期之间的递减
  var PEAK = 40;          // 产油峰值系数

  /* 简化周期模型：Q 注汽量 t，soak 焖井天数 */
  function simulate(schedule) {
    var R = 1, prevQ = 0, cumOil = 0, cumSteam = 0, out = [];
    for (var i = 0; i < schedule.length; i++) {
      var Q = schedule[i].Q, soak = schedule[i].soak;
      var heat = 1 - Math.exp(-(Q + 0.1 * prevQ) / 650);
      var soakEff = 1 - Math.exp(-soak / 2.2);
      var peak = PEAK * heat * soakEff * Math.pow(Math.max(R, 0.02), 2.0);
      var D = 0.07 + 0.004 * Math.abs(soak - 5);
      var Tp = 36 - soak;
      var oil = peak * (1 - Math.exp(-D * Tp)) / D;
      if (!isFinite(oil) || oil < 0) oil = 0;
      out.push({ Q: Q, soak: soak, oil: oil, osr: oil / Q, R: R });
      R = Math.max(0.02, R - oil / O0);
      cumOil += oil;
      cumSteam += Q;
      prevQ = Q;
    }
    return { cycles: out, oil: cumOil, steam: cumSteam, osr: cumOil / Math.max(1, cumSteam), R: R };
  }

  /* 参数化搜索：Q_t = Qmax − slope·t（不低于 300 t），总注汽量不超过预算 */
  function makeSchedule(Qmax, slope, soak) {
    var arr = [];
    for (var t = 0; t < CYCLES; t++) {
      arr.push({ Q: Math.max(300, Math.round((Qmax - slope * t) / 25) * 25), soak: soak });
    }
    return arr;
  }

  function optimize(budget) {
    var best = null;
    for (var Qmax = 600; Qmax <= 1500; Qmax += 25) {
      for (var slope = 0; slope <= 110; slope += 5) {
        for (var soak = 3; soak <= 8; soak++) {
          var sched = makeSchedule(Qmax, slope, soak);
          var sum = 0;
          for (var i = 0; i < sched.length; i++) sum += sched[i].Q;
          if (sum > budget) continue;
          var r = simulate(sched);
          if (!best || r.oil > best.res.oil) {
            best = { sched: sched, res: r, Qmax: Qmax, slope: slope, soak: soak, sum: sum };
          }
        }
      }
    }
    return best;
  }

  function EorSteamHuffpuffDemo(root) {
    var state = { budget: 6400, soak: 3, showOpt: true };
    var opt, optRes, manRes;

    root.innerHTML = '' +
      '<div class="demo">' +
      '<div class="demo-head">' +
      '<div><span class="kicker">INTERACTIVE · 蒸汽预算分配</span>' +
      '<h3 style="margin-top:8px">同样 6400 t 蒸汽，8 个周期怎么分？</h3>' +
      '<p>下面用简化周期模型模拟 8 个吞吐周期：橙色是现场常见的"每个周期平均注汽"；绿色是在总蒸汽量不变的前提下，把注汽量向前期倾斜、后期逐步减汽的优化方案。拖动蒸汽预算和焖井时间，看分配方案怎么变。</p></div>' +
      '<button class="btn primary" data-act="reset">恢复默认 ↻</button>' +
      '</div>' +

      '<div class="demo-ctl">' +
      '<div class="ctl"><label>蒸汽预算</label><input type="range" min="4800" max="8000" step="200" value="6400" id="e4-budget"><span class="val" id="e4-budgetv">6400</span></div>' +
      '<div class="ctl"><label>固定方案焖井</label><input type="range" min="2" max="8" step="1" value="3" id="e4-soak"><span class="val" id="e4-soakv">3 d</span></div>' +
      '<label class="ctl tog on" id="e4-opt"><i></i>显示优化方案</label>' +
      '</div>' +

      '<div class="demo-grid">' +
      '<div class="track-wrap"><div class="track">' +
      '<svg id="e4-bars" viewBox="0 0 460 300" role="img" aria-label="逐周期产油对比"></svg>' +
      '<div class="readout" id="e4-readout">悬停柱子看数值</div></div>' +
      '<div class="track-legend">' +
      '<span><i style="background:#b26a39;opacity:.45"></i>平均分配（固定参数）</span>' +
      '<span><i style="background:#2f7d6b"></i>优化分配</span>' +
      '<span><i class="dash"></i>剩余油下降</span>' +
      '</div></div>' +

      '<div class="demo-side">' +
      '<div class="metrics" id="e4-metrics"></div>' +
      '<div class="fitbox"><div class="ft"><span>累计产油 / 周期</span><span id="e4-cum-note"></span></div>' +
      '<svg id="e4-cum" viewBox="0 0 360 130"></svg></div>' +
      '<div class="verdict" id="e4-verdict"></div>' +
      '<div class="hintbox"><b>为什么平均分配不是最优：</b>前期剩余油多、温度场未被动用，同样一吨蒸汽的回报更高；后期剩余油变少，继续按平均值注汽，蒸汽大部分用来加热已经动用的区域。' +
      '<b>优化做了什么：</b>在总蒸汽量不变的约束下，把注汽量向前期倾斜、后期逐步减汽，并把焖井时间调向热量扩散更充分的区间。' +
      '把「蒸汽预算」拉小，可以看到优化方案的递减会更陡——预算越紧，越要把蒸汽用在回报最高的周期。</div>' +
      '</div></div>' +

      '<div class="fitbox" style="margin:0 16px 12px"><div class="ft"><span>三维场景 · 逐周期产油（左键拖动旋转，双击复位）</span><span>前排=平均分配（橙）· 后排=优化分配（绿）</span></div>' +
      '<div class="d3-scene" id="e4-d3"></div></div>' +

      '<div class="ltable-wrap"><table class="ltable" id="e4-table"></table></div>' +
      '</div>';

    var barsSvg = root.querySelector('#e4-bars');
    var cumSvg = root.querySelector('#e4-cum');
    var metricsEl = root.querySelector('#e4-metrics');
    var verdictEl = root.querySelector('#e4-verdict');
    var tableEl = root.querySelector('#e4-table');
    var readout = root.querySelector('#e4-readout');
    var budgetEl = root.querySelector('#e4-budget');
    var soakEl = root.querySelector('#e4-soak');
    var budgetV = root.querySelector('#e4-budgetv');
    var soakV = root.querySelector('#e4-soakv');
    var cumNote = root.querySelector('#e4-cum-note');
    var optTog = root.querySelector('#e4-opt');

    function uniformQ() { return Math.round(state.budget / CYCLES / 25) * 25; }

    function currentManual() {
      var q = uniformQ(), s = [];
      for (var i = 0; i < CYCLES; i++) s.push({ Q: q, soak: state.soak });
      return s;
    }

    function recompute() {
      manRes = simulate(currentManual());
      if (!opt || state._budget !== state.budget) {
        opt = optimize(state.budget);
        state._budget = state.budget;
      }
      optRes = opt.res;
    }

    function drawBars() {
      var W = 460, H = 300, ml = 46, mr = 10, mt = 18, mb = 30;
      var pw = W - ml - mr, ph = H - mt - mb;
      var maxOil = 20, i;
      for (i = 0; i < CYCLES; i++) {
        maxOil = Math.max(maxOil, manRes.cycles[i].oil * 1.12);
        if (state.showOpt) maxOil = Math.max(maxOil, optRes.cycles[i].oil * 1.12);
      }
      function fy(v) { return mt + (1 - v / maxOil) * ph; }
      var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';

      [0, 50, 100, 150, 200, 250, 300, 350].forEach(function (v) {
        if (v > maxOil) return;
        s += '<line x1="' + ml + '" y1="' + fy(v) + '" x2="' + (W - mr) + '" y2="' + fy(v) + '" stroke="#eeeae0"/>';
        s += '<text x="' + (ml - 6) + '" y="' + (fy(v) + 3) + '" text-anchor="end" font-size="8" font-family="monospace" fill="#9ba3a9">' + v + '</text>';
      });

      var gw = pw / CYCLES;
      var bw = Math.min(16, gw * 0.28);
      for (i = 0; i < CYCLES; i++) {
        var cx = ml + gw * (i + 0.5);
        var m = manRes.cycles[i], o = optRes.cycles[i];
        var hm = ph * m.oil / maxOil;
        s += '<rect x="' + (cx - bw - 2) + '" y="' + (mt + ph - hm) + '" width="' + bw + '" height="' + hm + '" rx="2" fill="#b26a39" opacity=".38"/>';
        if (state.showOpt) {
          var ho = ph * o.oil / maxOil;
          s += '<rect x="' + (cx + 2) + '" y="' + (mt + ph - ho) + '" width="' + bw + '" height="' + ho + '" rx="2" fill="#2f7d6b" opacity=".82"/>';
        }
        s += '<text x="' + cx + '" y="' + (mt + ph + 16) + '" text-anchor="middle" font-size="8.5" font-family="monospace" fill="#9ba3a9">' + (i + 1) + '</text>';
      }

      s += '<line x1="' + ml + '" y1="' + (mt + ph) + '" x2="' + (W - mr) + '" y2="' + (mt + ph) + '" stroke="#c9c2b0"/>';
      s += '<text x="' + (ml + pw / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="9.5" fill="#79828a">吞吐周期</text>';
      s += '<text x="14" y="' + (mt + ph / 2) + '" text-anchor="middle" font-size="9.5" fill="#79828a" transform="rotate(-90 14 ' + (mt + ph / 2) + ')">周期产油 / t</text>';
      s += '<rect id="e4-hit" x="' + ml + '" y="' + mt + '" width="' + pw + '" height="' + ph + '" fill="transparent"/>';
      barsSvg.innerHTML = s;

      var hit = barsSvg.querySelector('#e4-hit');
      hit.addEventListener('mousemove', function (e) {
        var loc = svgPoint(barsSvg, e);
        var idx = Math.floor((loc.x - ml) / gw);
        if (idx < 0 || idx >= CYCLES) return;
        var m = manRes.cycles[idx], o = optRes.cycles[idx];
        readout.innerHTML = '周期 ' + (idx + 1) + ' · 平均 ' + m.oil.toFixed(0) + ' t / 优化 ' + o.oil.toFixed(0) + ' t<br>' +
          '优化注汽 ' + o.Q + ' t · 焖井 ' + o.soak + ' d';
      });
      hit.addEventListener('mouseleave', function () { readout.textContent = '悬停柱子看数值'; });
    }

    function drawCum() {
      var w = 360, h = 130, ml = 32, mr = 8, mt = 10, mb = 20;
      var maxV = Math.max(manRes.oil, optRes.oil) * 1.08;
      function fx(i) { return ml + i / (CYCLES - 1) * (w - ml - mr); }
      function fy(v) { return mt + (1 - v / maxV) * (h - mt - mb); }

      var s = '';
      [0, maxV * 0.5, maxV].forEach(function (v) {
        s += '<line x1="' + ml + '" y1="' + fy(v) + '" x2="' + (w - mr) + '" y2="' + fy(v) + '" stroke="#eeeae0"/>';
        s += '<text x="' + (ml - 5) + '" y="' + (fy(v) + 3) + '" text-anchor="end" font-size="8" font-family="monospace" fill="#9ba3a9">' + Math.round(v) + '</text>';
      });

      function lineOf(res, color, dash) {
        var cum = 0, pts = [];
        for (var i = 0; i < CYCLES; i++) {
          cum += res.cycles[i].oil;
          pts.push(fx(i).toFixed(1) + ',' + fy(cum).toFixed(1));
        }
        return '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="1.7"' + (dash ? ' stroke-dasharray="4 3"' : '') + '/>';
      }
      s += lineOf(manRes, '#b26a39', true);
      if (state.showOpt) s += lineOf(optRes, '#2f7d6b', false);

      s += '<text x="' + ml + '" y="' + (h - 4) + '" font-size="8" font-family="monospace" fill="#9ba3a9">1</text>';
      s += '<text x="' + (w - mr) + '" y="' + (h - 4) + '" text-anchor="end" font-size="8" font-family="monospace" fill="#9ba3a9">' + CYCLES + '</text>';
      cumSvg.innerHTML = s;
      cumNote.textContent = state.showOpt ? '橙虚线：平均 · 绿实线：优化' : '橙虚线：平均分配';
    }

    function drawMetrics() {
      var gain = (optRes.oil / Math.max(1, manRes.oil) - 1) * 100;
      if (state.showOpt) {
        metricsEl.innerHTML =
          '<div class="metric"><div class="l">累计产油 · 优化</div><div class="v">' + optRes.oil.toFixed(0) + '<small>t</small></div></div>' +
          '<div class="metric ' + (optRes.osr >= manRes.osr ? 'good' : 'warn') + '"><div class="l">累计油汽比</div><div class="v">' + optRes.osr.toFixed(3) + '<small>vs ' + manRes.osr.toFixed(3) + '</small></div></div>' +
          '<div class="metric ' + (gain >= 0 ? 'good' : 'bad') + '"><div class="l">相对平均分配增油</div><div class="v">' + (gain >= 0 ? '+' : '') + gain.toFixed(1) + '<small>%</small></div></div>' +
          '<div class="metric"><div class="l">末周期剩余油</div><div class="v">' + (optRes.R * 100).toFixed(0) + '<small>%</small></div></div>';
      } else {
        metricsEl.innerHTML =
          '<div class="metric"><div class="l">累计产油 · 平均</div><div class="v">' + manRes.oil.toFixed(0) + '<small>t</small></div></div>' +
          '<div class="metric"><div class="l">累计油汽比</div><div class="v">' + manRes.osr.toFixed(3) + '<small>平均方案</small></div></div>' +
          '<div class="metric"><div class="l">相对平均分配增油</div><div class="v">—<small>已隐藏</small></div></div>' +
          '<div class="metric"><div class="l">末周期剩余油</div><div class="v">' + (manRes.R * 100).toFixed(0) + '<small>%</small></div></div>';
      }

      var qs = opt.sched.map(function (x) { return x.Q; });
      var qmin = Math.min.apply(null, qs), qmax = Math.max.apply(null, qs);
      if (state.showOpt) {
        verdictEl.innerHTML = '总蒸汽 <b>' + state.budget + ' t</b> 不变：平均方案每周期注汽 <b>' + uniformQ() +
          ' t</b>、焖井 <b>' + state.soak + ' d</b>，累计产油 <b>' + manRes.oil.toFixed(0) + ' t</b>；优化方案从 <b>' + qmax +
          ' t</b> 逐步减到 <b>' + qmin + ' t</b>，累计产油 <b>' + optRes.oil.toFixed(0) + ' t</b>，油汽比由 <b>' + manRes.osr.toFixed(3) +
          '</b> 提到 <b>' + optRes.osr.toFixed(3) + '</b>。增油来自<b>把蒸汽前移到回报更高的周期</b>，而不是多注蒸汽。';
      } else {
        verdictEl.innerHTML = '当前只显示平均分配：总蒸汽 <b>' + state.budget + ' t</b>，每周期 <b>' + uniformQ() +
          ' t</b>、焖井 <b>' + state.soak + ' d</b>，累计产油 <b>' + manRes.oil.toFixed(0) + ' t</b>，累计油汽比 <b>' + manRes.osr.toFixed(3) +
          '</b>。打开「显示优化方案」即可对比；下方表格保留了优化方案的逐周期参考。';
      }
    }

    function drawTable() {
      var rows = '', sumQ = 0, sumOil = 0;
      for (var i = 0; i < CYCLES; i++) {
        var o = optRes.cycles[i];
        sumQ += o.Q; sumOil += o.oil;
        rows += '<tr><td>' + (i + 1) + '</td>' +
          '<td>' + o.Q + '</td>' +
          '<td>' + o.soak + '</td>' +
          '<td>' + o.oil.toFixed(0) + '</td>' +
          '<td class="' + (o.osr >= 0.20 ? 'ok' : '') + '">' + o.osr.toFixed(3) + '</td>' +
          '<td>' + (o.R * 100).toFixed(0) + '%</td></tr>';
      }
      rows += '<tr><td>合计</td><td>' + sumQ + '</td><td>—</td><td>' + sumOil.toFixed(0) + '</td><td>' + (sumOil / sumQ).toFixed(3) + '</td><td>—</td></tr>';
      tableEl.innerHTML = '<thead><tr><th>周期</th><th>注汽量 / t</th><th>焖井 / d</th><th>周期产油 / t</th><th>油汽比</th><th>周期末剩余油</th></tr></thead><tbody>' + rows + '</tbody>';
    }

    /* ---------- 三维场景：逐周期产油立体柱阵 ---------- */
    var d3 = null;
    function draw3D() {
      if (!D3) return;
      var el = root.querySelector('#e4-d3');
      if (!el) return;
      if (!d3) {
        d3 = D3.create3D(el, { w: 460, h: 250, yaw: -30, elev: 26, cy: 0.55, paint: paint3D });
      } else {
        d3.repaint();
      }
    }

    function barWx() { return 0.062; }

    function paint3D(P) {
      var out = [], i, j, faces = [];
      var H = 0.28;   /* 底板高度（相对单位立方体） */

      /* 底板网格 + 周期轴刻度 */
      for (i = 0; i <= 8; i++) {
        var t = -0.9 + i / 8 * 1.8;
        out.push(D3.line(P(t, -0.5, -0.78), P(t, -0.5, 0.78), '#f0ede4', .7));
      }
      for (j = 0; j <= 2; j++) {
        var t2 = -0.78 + j / 2 * 1.56;
        out.push(D3.line(P(-0.9, -0.5, t2), P(0.9, -0.5, t2), '#f0ede4', .7));
      }
      out.push(D3.line(P(-0.9, -0.5, -0.78), P(0.9, -0.5, -0.78), '#c9c2b0', 1));
      out.push(D3.line(P(0.9, -0.5, -0.78), P(0.9, -0.5, 0.78), '#c9c2b0', 1));
      out.push(D3.line(P(-0.9, -0.5, -0.78), P(-0.9, -0.5, 0.78), '#c9c2b0', 1));
      for (i = 1; i <= CYCLES; i++) {
        var x = -0.9 + (i - 0.5) / CYCLES * 1.8;
        out.push(D3.text(P(x, -0.62, 0.92), String(i), '#9ba3a9', 7.5));
      }
      out.push(D3.text(P(0, -0.7, 1.06), '周期 →', '#79828a', 8));
      out.push(D3.text(P(1.14, -0.5, -0.78), '平均分配', '#b26a39', 8, 'middle'));
      out.push(D3.text(P(1.14, -0.5, 0.78), '优化分配', '#235f51', 8, 'middle'));
      out.push(D3.text(P(-1.16, .45, -0.8), '周期产油 t/d', '#79828a', 7.5, 'end'));

      function maxOil() {
        var m = 20;
        for (var k = 0; k < CYCLES; k++) {
          m = Math.max(m, manRes.cycles[k].oil * 1.1);
          m = Math.max(m, optRes.cycles[k].oil * 1.1);
        }
        return m;
      }
      var mx = maxOil();
      function addBar(x, z, oil, color) {
        var h = H + oil / mx * 0.62;
        var wx = barWx();
        /* 四个侧面 + 顶面，按深度排序绘制 */
        var sideList = [
          { n: 'px', c: [P(x + wx, -0.5 + h, z - wx), P(x + wx, -0.5 + h, z + wx), P(x + wx, H, z + wx), P(x + wx, H, z - wx)], d: 0 },
          { n: 'nx', c: [P(x - wx, -0.5 + h, z - wx), P(x - wx, -0.5 + h, z + wx), P(x - wx, H, z + wx), P(x - wx, H, z - wx)], d: 0 },
          { n: 'pz', c: [P(x - wx, -0.5 + h, z + wx), P(x + wx, -0.5 + h, z + wx), P(x + wx, H, z + wx), P(x - wx, H, z + wx)], d: 0 },
          { n: 'nz', c: [P(x - wx, -0.5 + h, z - wx), P(x + wx, -0.5 + h, z - wx), P(x + wx, H, z - wx), P(x - wx, H, z - wx)], d: 0 }
        ];
        sideList.forEach(function (s) { s.d = (s.c[0].d + s.c[1].d + s.c[2].d + s.c[3].d) / 4; });
        sideList.sort(function (a, b) { return a.d - b.d; }).forEach(function (s) {
          faces.push({ pts: s.c, fill: L.ramp(0.55, D3.DSURF), color: color, d: s.d, kind: 'side' });
        });
        var top = [P(x - wx, -0.5 + h, z - wx), P(x + wx, -0.5 + h, z - wx), P(x + wx, -0.5 + h, z + wx), P(x - wx, -0.5 + h, z + wx)];
        var td = (top[0].d + top[1].d + top[2].d + top[3].d) / 4;
        faces.push({ pts: top, fill: color, d: td - 0.001, kind: 'top' });
      }

      /* 前排：平均分配（橙透明） 后排：优化分配（绿） */
      for (i = 1; i <= CYCLES; i++) {
        var x = -0.9 + (i - 0.5) / CYCLES * 1.8;
        addBar(x, -0.42, manRes.cycles[i - 1].oil, 'rgba(178,106,57,.42)');
        addBar(x, 0.42, optRes.cycles[i - 1].oil, 'rgba(47,125,107,.78)');
      }
      faces.sort(function (a, b) { return a.d - b.d; }).forEach(function (f) {
        var col = f.kind === 'top' ? f.fill : (f.color.indexOf('47,125,107') >= 0 ? 'rgba(47,125,107,.34)' : 'rgba(178,106,57,.20)');
        out.push(D3.poly(f.pts, col, { stroke: f.color, sw: .8, so: .85, so2: 1 }));
      });

      return out.join('');
    }

    function draw() { drawBars(); drawCum(); drawMetrics(); draw3D(); drawTable(); }

    function svgPoint(svg, e) {
      var pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }

    /* ---------- 事件 ---------- */
    budgetEl.addEventListener('input', function () {
      state.budget = +this.value;
      budgetV.textContent = this.value;
      recompute(); draw();
    });
    soakEl.addEventListener('input', function () {
      state.soak = +this.value;
      soakV.textContent = this.value + ' d';
      recompute(); draw();
    });
    optTog.addEventListener('click', function () {
      state.showOpt = !state.showOpt;
      optTog.classList.toggle('on', state.showOpt);
      draw();
    });
    root.querySelector('[data-act="reset"]').addEventListener('click', function () {
      state.budget = 6400; state.soak = 3; state.showOpt = true;
      budgetEl.value = 6400; soakEl.value = 3;
      budgetV.textContent = '6400'; soakV.textContent = '3 d';
      optTog.classList.add('on');
      recompute(); draw();
    });

    recompute();
    draw();
  }

  window.EorSteamHuffpuffDemo = EorSteamHuffpuffDemo;
  window.EorSteamHuffpuffCleanup = function () {
    if (timer) { clearInterval(timer); timer = null; }
  };
})();
