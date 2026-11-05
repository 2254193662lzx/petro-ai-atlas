/* =========================================================
   增采 e5 可运行示范 · 微生物采油菌群活性预测
   ---------------------------------------------------------
   纯前端，无依赖：
     菌群生长—营养消耗简化模型（日度）
     → 周度取样 + 噪声 → 局部趋势外推预测
     → 阈值预警与补注窗口推荐
   对外暴露 window.EorMeorDemo(root, ctx)
   ========================================================= */

(function () {
  'use strict';

  var L = window.EORLib;
  var D3 = window.EOR3D;

  var timer = null;

  if (!L) {
    window.EorMeorDemo = function (root) {
      root.innerHTML = '<div class="callout warn"><span class="ci">缺失</span><span>示范依赖 eor-demo-lib.js，请检查脚本加载顺序。</span></div>';
    };
    window.EorMeorCleanup = function () { };
    return;
  }

  var START_DAY = 35, MAX_DAY = 90;
  var MU = 0.30, KCAP = 1.20, DECAY = 0.05, CONS = 0.035, HALF_N = 0.12;
  var RATE = 18;   // 活性 1.0 对应的日增油 t/d（相对尺度）

  function EorMeorDemo(root) {
    var state = { threshold: 0.55, horizon: 14, day: START_DAY, A: 0, N: 0, oil: 0 };
    var hist, obs, pulses, lastPulseDay;

    root.innerHTML = '' +
      '<div class="demo">' +
      '<div class="demo-head">' +
      '<div><span class="kicker">INTERACTIVE · 活性预测与补注</span>' +
      '<h3 style="margin-top:8px">活性掉下去之前，什么时候补营养液？</h3>' +
      '<p>绿色虚线是真实菌群活性（示范里可见），橙色点是每周一次的取样，蓝色是模型根据最近两次取样定斜率、向前外推的预测。模型看不到取样之间的变化，所以预测总会慢半拍——这正是现场要解决的问题。拖动阈值与预测窗口，看补注建议怎么变。</p></div>' +
      '<div style="text-align:right"><span class="tag" id="e5-day">第 35 天</span><br>' +
      '<button class="btn primary" data-act="reset" style="margin-top:8px">重置 ↻</button></div>' +
      '</div>' +

      '<div class="demo-ctl">' +
      '<div class="ctl"><label>活性阈值</label><input type="range" min="0.35" max="0.75" step="0.05" value="0.55" id="e5-th"><span class="val" id="e5-thv">0.55</span></div>' +
      '<div class="ctl"><label>预测窗口</label><input type="range" min="7" max="21" step="1" value="14" id="e5-hz"><span class="val" id="e5-hzv">14 d</span></div>' +
      '<button class="btn sm" data-act="step">推进 1 天</button>' +
      '<button class="btn sm" data-act="auto">自动运行</button>' +
      '<button class="btn clay sm" data-act="pulse">补注营养液</button>' +
      '</div>' +

      '<div class="demo-grid">' +
      '<div class="track-wrap"><div class="track">' +
      '<svg id="e5-chart" viewBox="0 0 460 330" role="img" aria-label="菌群活性与预测"></svg>' +
      '<div class="readout" id="e5-readout">悬停看某一天</div></div>' +
      '<div class="track-legend">' +
      '<span><i class="dash" style="border-top-color:#2f7d6b"></i>真实活性</span>' +
      '<span><i style="background:#b26a39;width:7px;height:7px;border-radius:50%"></i>周度取样</span>' +
      '<span><i style="background:#41699b"></i>模型预测</span>' +
      '<span><i class="dash" style="border-top-color:#b05a51"></i>活性阈值</span>' +
      '<span><i style="background:#41699b;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:6px solid #41699b"></i>补注</span>' +
      '</div></div>' +

      '<div class="demo-side">' +
      '<div class="metrics" id="e5-metrics"></div>' +
      '<div class="verdict" id="e5-verdict"></div>' +
      '<div class="fitbox"><div class="ft"><span>最近三次取样</span><span id="e5-trend"></span></div>' +
      '<svg id="e5-mini" viewBox="0 0 360 86"></svg></div>' +
      '<div class="hintbox"><b>为什么预测会慢半拍：</b>模型只能看到最近一次取样，活性在取样间隙已经变化；补注效果也要等下一次取样才能确认。' +
      '<b>怎么办：</b>把"最后观测日期"显式放进模型，预测区间随时间变宽；补注后先观察，不要按旧预测连续加量。' +
      '点击「补注营养液」可以看到：真实活性会立刻响应，但模型的预测要等到下一次取样才更新。</div>' +
      '</div></div>' +

      '<div class="fitbox" style="margin:0 16px 12px"><div class="ft"><span>三维场景 · 菌群活性曲面 A(天数， 营养水平)（左键拖动旋转，双击复位）</span><span>红罩=活性阈值 · 蓝柱=补注事件</span></div>' +
      '<div class="d3-scene" id="e5-d3"></div></div>' +

      '<div class="ltable-wrap"><table class="ltable" id="e5-table"></table></div>' +
      '</div>';

    var chart = root.querySelector('#e5-chart');
    var mini = root.querySelector('#e5-mini');
    var metricsEl = root.querySelector('#e5-metrics');
    var verdictEl = root.querySelector('#e5-verdict');
    var tableEl = root.querySelector('#e5-table');
    var readout = root.querySelector('#e5-readout');
    var dayEl = root.querySelector('#e5-day');
    var thEl = root.querySelector('#e5-th');
    var hzEl = root.querySelector('#e5-hz');
    var thV = root.querySelector('#e5-thv');
    var hzV = root.querySelector('#e5-hzv');
    var trendEl = root.querySelector('#e5-trend');
    var autoBtn = root.querySelector('[data-act="auto"]');

    var W = 460, H = 330, px = 48, py = 26, pw = 392, ph = 262, YMAX = 1.3;
    function X(d) { return px + d / MAX_DAY * pw; }
    function Y(a) { return py + (1 - a / YMAX) * ph; }

    function reset() {
      if (timer) { clearInterval(timer); timer = null; }
      autoBtn.textContent = '自动运行';
      state.day = 0; state.A = 0.42; state.N = 0.95; state.oil = 0;
      hist = [{ day: 0, A: state.A, N: state.N, rate: RATE * state.A, oil: 0 }];
      obs = [];
      pulses = [0];
      lastPulseDay = 0;
      addObs(0);
      for (var d = 1; d <= START_DAY; d++) stepDay(true);
      draw();
    }

    function addObs(day) {
      var h = hist[hist.length - 1];
      obs.push({
        day: day,
        A: L.clamp(h.A * (1 + L.gauss(rnd()) * 0.04), 0.01, 1.3),
        trueA: h.A,
        N: h.N,
        oil: h.oil
      });
    }

    var _rnd = null;
    function rnd() {
      if (!_rnd) _rnd = L.mulberry32(20261023);
      return _rnd;
    }

    function stepDay(quiet) {
      var growth = MU * state.A * (1 - state.A / KCAP) * (state.N / (state.N + HALF_N));
      var death = DECAY * state.A;
      state.A = L.clamp(state.A + growth - death, 0.02, KCAP);
      state.N = Math.max(0, state.N - CONS * state.A);
      var rate = RATE * state.A;
      state.oil += rate;
      state.day++;
      hist.push({ day: state.day, A: state.A, N: state.N, rate: rate, oil: state.oil });
      if (state.day % 7 === 0) addObs(state.day);
      if (!quiet) draw();
    }

    function predict() {
      var o = obs.slice(-3);
      var last = o[o.length - 1];
      var prev = o.length >= 2 ? o[o.length - 2] : null;
      var slope = 0;
      if (prev) {
        var ddays = Math.max(1, last.day - prev.day);
        slope = (Math.log(Math.max(last.A, 0.01)) - Math.log(Math.max(prev.A, 0.01))) / ddays;
      }
      slope = L.clamp(slope, -0.06, 0.06);
      var arr = [];
      for (var h = 0; h <= state.horizon; h++) {
        var a = L.clamp(last.A * Math.exp(slope * h), 0.02, 1.3);
        var sd = 0.03 + 0.010 * h;
        arr.push({ day: last.day + h, A: a, lo: L.clamp(a - 1.96 * sd, 0, 1.3), hi: L.clamp(a + 1.96 * sd, 0, 1.3) });
      }
      var cross = null;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].A < state.threshold) { cross = arr[i]; break; }
      }
      return { last: last, slope: slope, arr: arr, cross: cross, atHorizon: arr[arr.length - 1] };
    }

    function recommendation(pred) {
      if (lastPulseDay != null && state.day - lastPulseDay < 7) {
        return {
          type: 'wait',
          text: '第 ' + lastPulseDay + ' 天已补注，下一次取样在第 ' + (Math.ceil((state.day + 1) / 7) * 7) + ' 天。模型还没看到补注效果，建议先观察，不要按旧预测继续加量。'
        };
      }
      if (!pred.cross) {
        return { type: 'ok', text: '未来 ' + state.horizon + ' 天内预测不会跌破阈值，暂不补注。下一次评估建议在第 ' + (state.day + 3) + ' 天。' };
      }
      var recDay = Math.max(state.day, pred.cross.day - 2);
      if (recDay <= state.day) {
        return { type: 'now', text: '预测活性已经跌破阈值（第 ' + pred.cross.day + ' 天），建议<b>立即补注</b>，并在补注后第 7 天取样确认。' };
      }
      return {
        type: 'soon',
        text: '预测活性在第 <b>' + pred.cross.day + ' 天</b>跌破阈值 ' + state.threshold.toFixed(2) +
          '，建议在第 <b>' + recDay + ' 天</b>补注营养液。'
      };
    }

    /* ---------- 主图 ---------- */
    function drawChart() {
      var pred = predict();
      var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';

      // 网格
      [0, 0.3, 0.6, 0.9, 1.2].forEach(function (v) {
        s += '<line x1="' + px + '" y1="' + Y(v) + '" x2="' + (px + pw) + '" y2="' + Y(v) + '" stroke="#eeeae0"/>';
        s += '<text x="' + (px - 6) + '" y="' + (Y(v) + 3) + '" text-anchor="end" font-size="8" font-family="monospace" fill="#9ba3a9">' + v.toFixed(1) + '</text>';
      });
      for (var d = 0; d <= MAX_DAY; d += 10) {
        s += '<line x1="' + X(d) + '" y1="' + py + '" x2="' + X(d) + '" y2="' + (py + ph) + '" stroke="#f4f1e9"/>';
        s += '<text x="' + X(d) + '" y="' + (py + ph + 16) + '" text-anchor="middle" font-size="8" font-family="monospace" fill="#9ba3a9">' + d + '</text>';
      }
      s += '<text x="' + (px + pw / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="9.5" fill="#79828a">时间 / 天</text>';
      s += '<text x="14" y="' + (py + ph / 2) + '" text-anchor="middle" font-size="9.5" fill="#79828a" transform="rotate(-90 14 ' + (py + ph / 2) + ')">菌群活性</text>';

      // 阈值
      s += '<line x1="' + px + '" y1="' + Y(state.threshold) + '" x2="' + (px + pw) + '" y2="' + Y(state.threshold) + '" stroke="#b05a51" stroke-width="1.2" stroke-dasharray="5 4" opacity=".75"/>';
      s += '<text x="' + (px + pw) + '" y="' + (Y(state.threshold) - 5) + '" text-anchor="end" font-size="8.5" font-family="monospace" fill="#b05a51">阈值 ' + state.threshold.toFixed(2) + '</text>';

      // 预测区间
      if (pred.arr.length > 1) {
        var up = '', lo = '';
        pred.arr.forEach(function (p) {
          up += (up ? 'L' : 'M') + X(p.day).toFixed(1) + ' ' + Y(p.hi).toFixed(1) + ' ';
        });
        for (var i = pred.arr.length - 1; i >= 0; i--) {
          var p = pred.arr[i];
          lo += 'L' + X(p.day).toFixed(1) + ' ' + Y(p.lo).toFixed(1) + ' ';
        }
        s += '<path d="' + up + lo + 'Z" fill="#41699b" opacity=".10"/>';

        var pp = pred.arr.map(function (p) {
          return X(p.day).toFixed(1) + ',' + Y(p.A).toFixed(1);
        }).join(' ');
        s += '<polyline points="' + pp + '" fill="none" stroke="#41699b" stroke-width="1.7"/>';
        s += '<circle cx="' + X(pred.arr[pred.arr.length - 1].day) + '" cy="' + Y(pred.arr[pred.arr.length - 1].A) + '" r="3" fill="#41699b"/>';
      }

      // 真实活性
      var tp = hist.map(function (h) {
        return X(h.day).toFixed(1) + ',' + Y(h.A).toFixed(1);
      }).join(' ');
      s += '<polyline points="' + tp + '" fill="none" stroke="#2f7d6b" stroke-width="1.7" stroke-dasharray="5 3"/>';

      // 取样点
      obs.forEach(function (o) {
        s += '<circle cx="' + X(o.day).toFixed(1) + '" cy="' + Y(o.A).toFixed(1) + '" r="5" fill="#b26a39" stroke="#ffffff" stroke-width="1.4"/>';
      });

      // 补注标记
      pulses.forEach(function (pd) {
        var xx = X(pd);
        s += '<path d="M' + xx + ' ' + (py + 4) + 'l5 9h-10z" fill="#41699b"/>';
      });
      if (pulses.length) {
        s += '<text x="' + (X(pulses[pulses.length - 1]) + 7) + '" y="' + (py + 12) + '" font-size="8" font-family="monospace" fill="#41699b">补注</text>';
      }

      // 当前日
      s += '<line x1="' + X(state.day) + '" y1="' + py + '" x2="' + X(state.day) + '" y2="' + (py + ph) + '" stroke="#c9c2b0" stroke-width="1" stroke-dasharray="3 3"/>';
      s += '<text x="' + (X(state.day) + 5) + '" y="' + (py + ph - 6) + '" font-size="8.5" font-family="monospace" fill="#79828a">今天</text>';

      s += '<rect id="e5-hit" x="' + px + '" y="' + py + '" width="' + pw + '" height="' + ph + '" fill="transparent"/>';
      chart.innerHTML = s;

      chart.querySelector('#e5-hit').addEventListener('mousemove', function (e) {
        var loc = svgPoint(chart, e);
        var day = Math.round((loc.x - px) / pw * MAX_DAY);
        if (day < 0 || day > MAX_DAY) return;
        var h = hist[day];
        var p = pred.arr.filter(function (q) { return q.day === day; })[0];
        readout.innerHTML = '第 ' + day + ' 天' +
          (h ? ' · 真实 <b style="color:#2f7d6b">' + h.A.toFixed(2) + '</b>' : '') +
          (p ? ' · 预测 <b style="color:#41699b">' + p.A.toFixed(2) + '</b>' : '') +
          (h ? '<br>营养指数 ' + h.N.toFixed(2) : '');
      });
      chart.querySelector('#e5-hit').addEventListener('mouseleave', function () {
        readout.textContent = '悬停看某一天';
      });

      drawMini(pred);
      drawMetrics(pred);
      drawTable();
      dayEl.textContent = '第 ' + state.day + ' 天';
    }

    function drawMini(pred) {
      var w = 360, h = 86, ml = 26, mr = 8, mt = 8, mb = 14;
      var o = obs.slice(-3);
      var lo = Math.min.apply(null, o.map(function (x) { return x.A; }));
      var hi = Math.max.apply(null, o.map(function (x) { return x.A; }));
      var pad = Math.max(0.05, (hi - lo) * 0.25);
      var d0 = o[0].day, d1 = o[o.length - 1].day;
      function fx(d) { return ml + (d - d0) / Math.max(1, d1 - d0) * (w - ml - mr); }
      function fy(a) { return mt + (1 - (a - lo + pad) / (hi - lo + pad * 2)) * (h - mt - mb); }

      var s = '<line x1="' + ml + '" y1="' + (h - mb) + '" x2="' + (w - mr) + '" y2="' + (h - mb) + '" stroke="#e9e4d8"/>';
      o.forEach(function (x, i) {
        if (i > 0) {
          var p = o[i - 1];
          s += '<line x1="' + fx(p.day) + '" y1="' + fy(p.A) + '" x2="' + fx(x.day) + '" y2="' + fy(x.A) + '" stroke="#b26a39" stroke-width="1.5"/>';
        }
        s += '<circle cx="' + fx(x.day) + '" cy="' + fy(x.A) + '" r="3.4" fill="#b26a39"/>';
        s += '<text x="' + fx(x.day) + '" y="' + (h - 3) + '" text-anchor="middle" font-size="7.5" font-family="monospace" fill="#9ba3a9">' + x.day + 'd</text>';
      });
      mini.innerHTML = s;
      trendEl.textContent = o.length >= 2 ? ('斜率 ' + (pred.slope * 100).toFixed(1) + '% / 天') : '';
    }

    function drawMetrics(pred) {
      var last = pred.last;
      var atH = pred.atHorizon;
      var below = pred.cross ? Math.max(0, pred.cross.day - state.day) : null;
      var rec = recommendation(pred);

      metricsEl.innerHTML =
        '<div class="metric"><div class="l">最近观测活性</div><div class="v">' + last.A.toFixed(2) + '<small>@' + last.day + 'd</small></div></div>' +
        '<div class="metric ' + (atH.A >= state.threshold ? 'good' : 'warn') + '"><div class="l">' + state.horizon + ' 天后预测</div><div class="v">' + atH.A.toFixed(2) + '<small>±' + ((atH.hi - atH.lo) / 2).toFixed(2) + '</small></div></div>' +
        '<div class="metric ' + (below != null && below <= 7 ? 'warn' : 'good') + '"><div class="l">预计跌破阈值</div><div class="v">' + (below == null ? '&gt;' + state.horizon : below) + '<small>' + (below == null ? '天' : '天') + '</small></div></div>' +
        '<div class="metric"><div class="l">累计增油</div><div class="v">' + state.oil.toFixed(0) + '<small>t</small></div></div>';

      verdictEl.innerHTML = rec.text +
        ' <span class="small muted">模型只用到第 ' + last.day + ' 天的取样；取样日之后的真实变化它看不到。</span>';
    }

    function drawTable() {
      var rows = '';
      var start = Math.max(0, obs.length - 6);
      for (var i = obs.length - 1; i >= start; i--) {
        var o = obs[i];
        var ok = o.A >= state.threshold;
        rows += '<tr><td>' + o.day + '</td>' +
          '<td class="' + (ok ? 'ok' : 'miss') + '">' + o.A.toFixed(2) + '</td>' +
          '<td>' + o.trueA.toFixed(2) + '</td>' +
          '<td>' + o.N.toFixed(2) + '</td>' +
          '<td>' + o.oil.toFixed(0) + '</td></tr>';
      }
      tableEl.innerHTML = '<thead><tr><th>取样日 / d</th><th>观测活性</th><th>真实活性（示范可见）</th><th>营养指数</th><th>累计增油 / t</th></tr></thead><tbody>' + rows + '</tbody>';
    }

    /* ---------- 三维场景：菌群活性曲面 A(天数， 营养水平) ---------- */
    var d3 = null;
    function draw3D() {
      if (!D3) return;
      var el = root.querySelector('#e5-d3');
      if (!el) return;
      if (!d3) {
        d3 = D3.create3D(el, { w: 460, h: 250, yaw: -32, elev: 27, cy: 0.55, paint: paint3D });
      } else {
        d3.repaint();
      }
    }

    function paint3D(P) {
      var out = [], i, j;

      for (i = 0; i <= 6; i++) {
        var t = i / 3 - 1;
        out.push(D3.line(P(t, -0.6, -1), P(t, -0.6, 1), '#eeeae0', .7));
        out.push(D3.line(P(-1, -0.6, t), P(1, -0.6, t), '#eeeae0', .7));
      }
      out.push(D3.line(P(-1, -0.6, -1), P(1, -0.6, -1), '#c9c2b0', 1));
      out.push(D3.line(P(-1, -0.6, 1), P(1, -0.6, 1), '#c9c2b0', 1));
      out.push(D3.line(P(-1, -0.6, -1), P(-1, -0.6, 1), '#c9c2b0', 1));

      /* 曲面：A(t, N0)，N0 = 初始营养指数 */
      var NT = 26, NN = 10, faces = [];
      function Aof(tt, n0) {
        var A = 0.42, N = n0, growth, death;
        for (var d = 0; d < tt; d++) {
          growth = MU * A * (1 - A / KCAP) * (N / (N + HALF_N));
          death = DECAY * A;
          A = Math.max(0.02, A + growth - death);
          N = Math.max(0, N - CONS * A);
        }
        return A;
      }
      for (i = 0; i < NT; i++) for (j = 0; j < NN; j++) {
        var tA = MAX_DAY * i / (NT - 1), tB = MAX_DAY * (i + 1) / (NT - 1);
        var nA = 0.25 + 1.05 * j / (NN - 1), nB = 0.25 + 1.05 * (j + 1) / (NN - 1);
        var va = Aof((tA + tB) / 2, nA), vb2 = Aof((tA + tB) / 2, nB);
        var y0a = -0.5 + va / 1.3 * 0.95, y0b2 = -0.5 + vb2 / 1.3 * 0.95;
        var c = [
          P(tA / MAX_DAY * 2 - 1, y0a, nA / 1.05 * 2 - 1),
          P(tA / MAX_DAY * 2 - 1, y0b2, nB / 1.05 * 2 - 1),
          P(tB / MAX_DAY * 2 - 1, y0b2, nB / 1.05 * 2 - 1),
          P(tB / MAX_DAY * 2 - 1, y0a, nA / 1.05 * 2 - 1)
        ];
        var d = (c[0].d + c[1].d + c[2].d + c[3].d) / 4;
        faces.push({ c: c, d: d, va: (va + vb2) / 2 });
      }
      faces.sort(function (a, b) { return a.d - b.d; }).forEach(function (f) {
        out.push(D3.poly(f.c, L.ramp(Math.max(0.03, Math.min(1, (f.va - 0.1) / 0.9)), D3.DSURF), { so2: .97, sw: .62, so: 1 }));
      });

      /* 阈值平面（红罩，跨整个天数×营养平面） */
      var yt = -0.5 + state.threshold / 1.3 * 0.95;
      var qplane = [P(-1, yt, -1), P(-1, yt, 1), P(1, yt, 1), P(1, yt, -1)];
      out.push(D3.poly(qplane, '#b05a51', { so2: .10, sw: 0, so: 1 }));
      out.push('<path d="M' + qplane.map(function (p) { return p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join('L') +
        'Z" fill="none" stroke="#b05a51" stroke-width=".8" stroke-dasharray="4 3" opacity=".75"/>');

      /* 补注事件：蓝色竖线（当前已经历的天数） */
      pulses.forEach(function (pd) {
        if (pd > state.day) return;
        var nNow = hist[pd].N;
        var base = P(pd / MAX_DAY * 2 - 1, -0.6, Math.max(-1, Math.min(1, nNow / 1.05 * 2 - 1)));
        var top = P(pd / MAX_DAY * 2 - 1, 0.42, base.z >= 0 ? 0.3 : -0.3);
        top = P(pd / MAX_DAY * 2 - 1, 0.42, Math.max(-1, Math.min(1, nNow / 1.05 * 2 - 1)));
        out.push(D3.line(base, top, '#41699b', 1.6));
        var mk = P(pd / MAX_DAY * 2 - 1, 0.5, Math.max(-1, Math.min(1, nNow / 1.05 * 2 - 1)));
        out.push('<path d="M' + mk.x.toFixed(1) + ' ' + (mk.y - 5).toFixed(1) + 'l5 9h-10z" fill="#41699b"/>');
      });

      out.push(D3.text(P(0, -0.75, 1.25), '天数 →', '#79828a', 8));
      out.push(D3.text(P(1.3, -0.75, -0.35), '营养水平 ↑', '#79828a', 8, 'middle'));
      out.push(D3.text(P(-1.02, .72, -0.92), '菌群活性', '#79828a', 8.5, 'end', 600));
      out.push(D3.text(P(0.62, yt - 0.02, 1.02), '阈值 ' + state.threshold.toFixed(2), '#b05a51', 7.5, 'start'));
      return out.join('');
    }

    function draw() { drawChart(); draw3D(); }

    function svgPoint(svg, e) {
      var pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }

    /* ---------- 事件 ---------- */
    root.querySelector('[data-act="step"]').addEventListener('click', function () {
      if (state.day >= MAX_DAY) return;
      stepDay(false);
    });

    root.querySelector('[data-act="auto"]').addEventListener('click', function () {
      if (timer) {
        clearInterval(timer); timer = null;
        autoBtn.textContent = '自动运行';
        return;
      }
      if (state.day >= MAX_DAY) return;
      autoBtn.textContent = '暂停';
      timer = setInterval(function () {
        if (state.day >= MAX_DAY) {
          clearInterval(timer); timer = null;
          autoBtn.textContent = '自动运行';
          return;
        }
        stepDay(false);
      }, 180);
    });

    root.querySelector('[data-act="pulse"]').addEventListener('click', function () {
      state.N = Math.min(1.0, state.N + 0.7);
      pulses.push(state.day);
      lastPulseDay = state.day;
      hist[hist.length - 1].N = state.N;
      draw();
    });

    thEl.addEventListener('input', function () {
      state.threshold = +this.value;
      thV.textContent = (+this.value).toFixed(2);
      draw();
    });
    hzEl.addEventListener('input', function () {
      state.horizon = +this.value;
      hzV.textContent = this.value + ' d';
      draw();
    });

    root.querySelector('[data-act="reset"]').addEventListener('click', function () {
      _rnd = null;
      state.threshold = 0.55; state.horizon = 14;
      thEl.value = 0.55; hzEl.value = 14;
      thV.textContent = '0.55'; hzV.textContent = '14 d';
      reset();
    });

    reset();
  }

  window.EorMeorDemo = EorMeorDemo;
  window.EorMeorCleanup = function () {
    if (timer) { clearInterval(timer); timer = null; }
  };
})();
