/* =========================================================
   增采 e2 可运行示范 · 压裂裂缝形态预测
   ---------------------------------------------------------
   纯前端，无依赖：
     合成微地震事件云（已知真实裂缝）
     → 协方差 / 主成分几何反演
     → 扣除定位误差 + 施工体积约束
     → 几何参数与不确定范围
   对外暴露 window.EorFracGeometryDemo(root, ctx)
   ========================================================= */

(function () {
  'use strict';

  var L = window.EORLib;
  var D3 = window.EOR3D;

  var timer = null;

  if (!L) {
    window.EorFracGeometryDemo = function (root) {
      root.innerHTML = '<div class="callout warn"><span class="ci">缺失</span><span>示范依赖 eor-demo-lib.js，请检查脚本加载顺序。</span></div>';
    };
    window.EorFracGeometryCleanup = function () { };
    return;
  }

  var A_TRUE = 180;     // 真实半长 m
  var B_TRUE = 45;      // 真实半宽 m
  var THETA_TRUE = 25;  // 真实方位角（度）
  var H_TRUE = 40;      // 真实高度 m
  var Z0 = 2500;        // 中心深度 m
  var LOC_Z = 3;        // 深度定位误差 m
  var PROPPANT = 120000; // 加砂量 kg
  var V_SRV = Math.PI * A_TRUE * B_TRUE * H_TRUE; // 经验改造体积

  function gauss2(rnd) { return L.gauss(rnd); }

  function generate(seed, n, loc) {
    var rnd = L.mulberry32(seed);
    var th = THETA_TRUE * Math.PI / 180, co = Math.cos(th), si = Math.sin(th);
    var ev = [];
    for (var i = 0; i < n; i++) {
      var u = gauss2(rnd) * A_TRUE / 2;
      var v = gauss2(rnd) * B_TRUE / 2;
      var x = u * co - v * si + gauss2(rnd) * loc;
      var y = u * si + v * co + gauss2(rnd) * loc;
      var z = Z0 + (v / (B_TRUE / 2)) * 10 + gauss2(rnd) * LOC_Z;
      ev.push({ x: x, y: y, z: z });
    }
    return ev;
  }

  function estimate(ev, loc, useVol) {
    var n = ev.length;
    var mx = 0, my = 0, mz = 0, i;
    for (i = 0; i < n; i++) { mx += ev[i].x; my += ev[i].y; mz += ev[i].z; }
    mx /= n; my /= n; mz /= n;

    var cxx = 0, cxy = 0, cyy = 0, vzz = 0;
    for (i = 0; i < n; i++) {
      var dx = ev[i].x - mx, dy = ev[i].y - my, dz = ev[i].z - mz;
      cxx += dx * dx; cxy += dx * dy; cyy += dy * dy; vzz += dz * dz;
    }
    var den = Math.max(1, n - 1);
    cxx /= den; cxy /= den; cyy /= den; vzz /= den;

    var tr = cxx + cyy, det = cxx * cyy - cxy * cxy;
    var disc = Math.sqrt(Math.max(tr * tr / 4 - det, 0));
    var l1 = tr / 2 + disc, l2 = tr / 2 - disc;

    var theta = 0.5 * Math.atan2(2 * cxy, cxx - cyy) * 180 / Math.PI;
    theta = ((theta % 180) + 180) % 180;

    var aEv = 2 * Math.sqrt(Math.max(l1 - loc * loc, 25));
    var bEv = 2 * Math.sqrt(Math.max(l2 - loc * loc, 9));
    var h = 4 * Math.sqrt(Math.max(vzz - LOC_Z * LOC_Z, 4));

    /* 软体积约束：体积只能把 a、b 一起缩放，不能单独定住某一个；
       事件越少，约束权重越大；用幂次缩放避免过度修正。 */
    var scale = 1;
    if (useVol) {
      var target = Math.sqrt(V_SRV / (Math.PI * Math.max(aEv, 1) * Math.max(bEv, 1) * Math.max(h, 1)));
      var alpha = 0.5 * (1 - n / (n + 80));
      scale = Math.pow(Math.max(target, 0.5), alpha);
    }
    var a = aEv * scale;
    var b = bEv * scale;

    var azErr = Math.abs(theta - THETA_TRUE);
    if (azErr > 90) azErr = 180 - azErr;

    return {
      n: n, cx: mx, cy: my, cz: mz,
      a: a, b: b, aEvent: aEv, bEvent: bEv, h: h, scale: scale,
      theta: theta, azErr: azErr,
      cond: PROPPANT / (2 * a * h),
      aErr: Math.abs(a - A_TRUE) / A_TRUE,
      bErr: Math.abs(b - B_TRUE) / B_TRUE,
      hErr: Math.abs(h - H_TRUE) / H_TRUE
    };
  }

  function EorFracGeometryDemo(root) {
    var state = { n: 80, loc: 4, useVol: true, seed: 20261023 };
    var events, est;

    root.innerHTML = '' +
      '<div class="demo">' +
      '<div class="demo-head">' +
      '<div><span class="kicker">INTERACTIVE · 多源反演</span>' +
      '<h3 style="margin-top:8px">从微地震点云，反推看不见的裂缝</h3>' +
      '<p>蓝色点是微地震事件（颜色越深表示越深）。棕色虚线是真实裂缝（示范里已知），绿色实线是反演结果，绿色虚线圈是不确定范围。改变事件数与定位误差，看反演怎么被噪声带偏；打开体积约束，看施工数据怎么把解拉回来。</p></div>' +
      '<button class="btn primary" data-act="regen">重新生成事件 ↻</button>' +
      '</div>' +

      '<div class="demo-ctl">' +
      '<div class="ctl"><label>事件数</label><input type="range" min="20" max="300" step="10" value="80" id="e2-n"><span class="val" id="e2-nv">80</span></div>' +
      '<div class="ctl"><label>定位误差</label><input type="range" min="1" max="12" step="1" value="4" id="e2-loc"><span class="val" id="e2-locv">±4 m</span></div>' +
      '<label class="ctl tog on" id="e2-vol"><i></i>用施工体积约束</label>' +
      '</div>' +

      '<div class="demo-grid">' +
      '<div class="track-wrap"><div class="track">' +
      '<svg id="e2-map" viewBox="0 0 460 340" role="img" aria-label="微地震事件与裂缝反演"></svg>' +
      '<div class="readout" id="e2-readout">悬停看点位</div></div>' +
      '<div class="track-legend">' +
      '<span><i style="background:#41699b;width:7px;height:7px;border-radius:50%"></i>微地震事件（按深度）</span>' +
      '<span><i style="width:34px;height:7px;border-radius:2px;background:linear-gradient(90deg,#41699b,#7e5a8d,#b26a39)"></i>浅 → 深</span>' +
      '<span><i style="background:#2f7d6b"></i>反演裂缝</span>' +
      '<span><i class="dash" style="border-top-color:#8e5229"></i>真实裂缝</span>' +
      '<span><i class="dash" style="border-top-color:#2f7d6b"></i>不确定范围</span>' +
      '</div></div>' +

      '<div class="demo-side">' +
      '<div class="metrics" id="e2-metrics"></div>' +
      '<div class="fitbox"><div class="ft"><span>施工曲线（第二类证据）</span><span>液量 18,000 m³ · 加砂 120 t</span></div>' +
      '<svg id="e2-curve" viewBox="0 0 360 112"></svg></div>' +
      '<div class="verdict" id="e2-verdict"></div>' +
      '<div class="hintbox"><b>为什么必须带不确定性：</b>事件少时，点云协方差本身就不稳；定位误差还会把云撑大，直接算会把裂缝尺寸高估。' +
      '<b>体积约束做了什么：</b>施工曲线给出注入液量与砂量，换算成经验改造体积，在事件少时把宽度拉回合理范围。' +
      '真实裂缝在示范里可见，现场只能在少数井用示踪与产剖做验证。</div>' +
      '</div></div>' +

      '<div class="fitbox" style="margin:0 16px 12px"><div class="ft"><span>三维场景 · 微地震点云与裂缝圆盘（左键拖动旋转，双击复位）</span><span>棕虚线=真实裂缝 · 绿实线=反演裂缝</span></div>' +
      '<div class="d3-scene" id="e2-d3"></div></div>' +

      '<div class="ltable-wrap"><table class="ltable" id="e2-table"></table></div>' +
      '</div>';

    var mapSvg = root.querySelector('#e2-map');
    var curveSvg = root.querySelector('#e2-curve');
    var metricsEl = root.querySelector('#e2-metrics');
    var verdictEl = root.querySelector('#e2-verdict');
    var tableEl = root.querySelector('#e2-table');
    var readout = root.querySelector('#e2-readout');
    var nEl = root.querySelector('#e2-n');
    var locEl = root.querySelector('#e2-loc');
    var nV = root.querySelector('#e2-nv');
    var locV = root.querySelector('#e2-locv');
    var volTog = root.querySelector('#e2-vol');

    var W = 460, H = 340, px = 46, py = 22, pw = 396, ph = 282;
    var SCALE = Math.min(pw / 680, ph / 500);
    function X(x) { return px + pw / 2 + x * SCALE; }
    function Y(y) { return py + ph / 2 - y * SCALE; }

    function recompute(regen) {
      if (regen) events = generate(state.seed, state.n, state.loc);
      est = estimate(events, state.loc, state.useVol);
    }

    function drawMap() {
      var s = '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#ffffff"/>';

      // 网格与刻度
      for (var gx = -300; gx <= 300; gx += 100) {
        s += '<line x1="' + X(gx) + '" y1="' + py + '" x2="' + X(gx) + '" y2="' + (py + ph) + '" stroke="#f4f1e9"/>';
        if (gx % 150 === 0 || gx === 0) {
          s += '<text x="' + X(gx) + '" y="' + (py + ph + 16) + '" text-anchor="middle" font-size="8" font-family="monospace" fill="#9ba3a9">' + gx + '</text>';
        }
      }
      for (var gy = -200; gy <= 200; gy += 100) {
        s += '<line x1="' + px + '" y1="' + Y(gy) + '" x2="' + (px + pw) + '" y2="' + Y(gy) + '" stroke="#f4f1e9"/>';
        s += '<text x="' + (px - 6) + '" y="' + (Y(gy) + 3) + '" text-anchor="end" font-size="8" font-family="monospace" fill="#9ba3a9">' + gy + '</text>';
      }
      s += '<text x="' + (px + pw / 2) + '" y="' + (py + ph + 34) + '" text-anchor="middle" font-size="9.5" fill="#79828a">东 / m</text>';
      s += '<text x="14" y="' + (py + ph / 2) + '" text-anchor="middle" font-size="9.5" fill="#79828a" transform="rotate(-90 14 ' + (py + ph / 2) + ')">北 / m</text>';

      // 真实裂缝
      var tcx = X(0), tcy = Y(0);
      s += '<ellipse cx="' + tcx + '" cy="' + tcy + '" rx="' + (A_TRUE * SCALE) + '" ry="' + (B_TRUE * SCALE) + '" transform="rotate(-' + THETA_TRUE + ' ' + tcx + ' ' + tcy + ')" fill="none" stroke="#8e5229" stroke-width="1.5" stroke-dasharray="6 4"/>';
      s += '<text x="' + (tcx + A_TRUE * SCALE * 0.55) + '" y="' + (tcy - A_TRUE * SCALE * 0.32) + '" font-size="8.5" font-family="monospace" fill="#8e5229">真实裂缝</text>';

      // 不确定范围
      var aOut = est.a * (1 + 1.2 / Math.sqrt(est.n));
      var bOut = est.b * (1 + 2.0 / Math.sqrt(est.n));
      var ecx = X(est.cx), ecy = Y(est.cy);
      s += '<ellipse cx="' + ecx + '" cy="' + ecy + '" rx="' + (aOut * SCALE) + '" ry="' + (bOut * SCALE) + '" transform="rotate(-' + est.theta + ' ' + ecx + ' ' + ecy + ')" fill="#2f7d6b" opacity=".07" stroke="#2f7d6b" stroke-width="1" stroke-dasharray="3 3"/>';

      // 反演裂缝
      s += '<ellipse cx="' + ecx + '" cy="' + ecy + '" rx="' + (est.a * SCALE) + '" ry="' + (est.b * SCALE) + '" transform="rotate(-' + est.theta + ' ' + ecx + ' ' + ecy + ')" fill="#2f7d6b" fill-opacity=".10" stroke="#2f7d6b" stroke-width="1.6"/>';

      // 主轴
      var th = est.theta * Math.PI / 180;
      var ax = Math.cos(th) * est.a * SCALE, ay = -Math.sin(th) * est.a * SCALE;
      s += '<line x1="' + (ecx - ax) + '" y1="' + (ecy - ay) + '" x2="' + (ecx + ax) + '" y2="' + (ecy + ay) + '" stroke="#2f7d6b" stroke-width="1" opacity=".6" stroke-dasharray="2 3"/>';
      s += '<line x1="' + (ecx + ay * est.b / est.a) + '" y1="' + (ecy - ax * est.b / est.a) + '" x2="' + (ecx - ay * est.b / est.a) + '" y2="' + (ecy + ax * est.b / est.a) + '" stroke="#2f7d6b" stroke-width="1" opacity=".35"/>';
      s += '<circle cx="' + ecx + '" cy="' + ecy + '" r="2.6" fill="#2f7d6b"/>';

      // 事件点（按深度着色）
      var zmin = 1e9, zmax = -1e9;
      events.forEach(function (e) {
        if (e.z < zmin) zmin = e.z;
        if (e.z > zmax) zmax = e.z;
      });
      var zr = Math.max(1, zmax - zmin);
      events.forEach(function (e) {
        var col = L.ramp((e.z - zmin) / zr, [[0, '#41699b'], [0.5, '#7e5a8d'], [1, '#b26a39']]);
        s += '<circle cx="' + X(e.x).toFixed(1) + '" cy="' + Y(e.y).toFixed(1) + '" r="2" fill="' + col + '" opacity=".62"/>';
      });

      s += '<text x="' + px + '" y="' + (py - 7) + '" text-anchor="start" font-size="8" font-family="monospace" fill="#9ba3a9">' + est.n + ' 个事件 · 定位 ±' + state.loc + ' m</text>';
      s += '<rect id="e2-hit" x="' + px + '" y="' + py + '" width="' + pw + '" height="' + ph + '" fill="transparent"/>';
      mapSvg.innerHTML = s;

      var hit = mapSvg.querySelector('#e2-hit');
      hit.addEventListener('mousemove', function (e) {
        var loc = svgPoint(mapSvg, e);
        var best = null, bd = 1e9;
        events.forEach(function (ev) {
          var dx = X(ev.x) - loc.x, dy = Y(ev.y) - loc.y;
          var d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = ev; }
        });
        if (best && bd < 64) {
          readout.innerHTML = '事件 · x ' + best.x.toFixed(0) + ' m · y ' + best.y.toFixed(0) +
            ' m<br>深度 ' + best.z.toFixed(0) + ' m';
        } else {
          readout.textContent = '悬停看点位';
        }
      });
      hit.addEventListener('mouseleave', function () { readout.textContent = '悬停看点位'; });
    }

    function drawCurve() {
      var w = 360, h = 112, ml = 28, mr = 10, mt = 8, mb = 18;
      var pw2 = w - ml - mr, ph2 = h - mt - mb;
      var s = '';
      // 加砂段底色
      s += '<rect x="' + (ml + pw2 * 20 / 90) + '" y="' + mt + '" width="' + (pw2 * 55 / 90) + '" height="' + ph2 + '" fill="#f8ecdf" opacity=".7"/>';
      s += '<text x="' + (ml + pw2 * 47 / 90) + '" y="' + (mt + 10) + '" text-anchor="middle" font-size="8" fill="#b26a39">加砂段</text>';

      // 排量
      var rp = [], pp = [];
      for (var t = 0; t <= 90; t++) {
        var rate = t < 8 ? 4 + t * 0.9 : (t < 78 ? 11 + 0.8 * Math.sin(t / 6) : Math.max(0, 11 - (t - 78) * 0.7));
        var press = 48 + rate * 0.9 + (t > 20 && t < 75 ? 6 + 2 * Math.sin(t / 4) : 0) + (t > 82 ? (t - 82) * 0.8 : 0);
        var xx = ml + t / 90 * pw2;
        rp.push(xx.toFixed(1) + ',' + (mt + ph2 - rate / 14 * ph2).toFixed(1));
        pp.push(xx.toFixed(1) + ',' + (mt + ph2 - (press - 35) / 55 * ph2).toFixed(1));
      }
      s += '<polyline points="' + rp.join(' ') + '" fill="none" stroke="#41699b" stroke-width="1.4"/>';
      s += '<polyline points="' + pp.join(' ') + '" fill="none" stroke="#b26a39" stroke-width="1.4" opacity=".8"/>';

      s += '<line x1="' + ml + '" y1="' + (mt + ph2) + '" x2="' + (w - mr) + '" y2="' + (mt + ph2) + '" stroke="#c9c2b0"/>';
      s += '<text x="' + ml + '" y="' + (h - 4) + '" font-size="7.5" font-family="monospace" fill="#9ba3a9">0</text>';
      s += '<text x="' + (w - mr) + '" y="' + (h - 4) + '" text-anchor="end" font-size="7.5" font-family="monospace" fill="#9ba3a9">90 min</text>';
      s += '<text x="' + (w - mr) + '" y="' + (mt + 9) + '" text-anchor="end" font-size="7.5" font-family="monospace" fill="#41699b">排量</text>';
      s += '<text x="' + (w - mr) + '" y="' + (mt + 20) + '" text-anchor="end" font-size="7.5" font-family="monospace" fill="#b26a39">压力</text>';
      curveSvg.innerHTML = s;
    }

    function drawMetrics() {
      metricsEl.innerHTML =
        '<div class="metric ' + (est.aErr <= 0.15 ? 'good' : 'warn') + '"><div class="l">半长 / 误差</div><div class="v">' + est.a.toFixed(0) + '<small>m · ' + Math.round(est.aErr * 100) + '%</small></div></div>' +
        '<div class="metric ' + (est.bErr <= 0.25 ? 'good' : 'warn') + '"><div class="l">半宽 / 误差</div><div class="v">' + est.b.toFixed(0) + '<small>m · ' + Math.round(est.bErr * 100) + '%</small></div></div>' +
        '<div class="metric ' + (est.azErr <= 10 ? 'good' : 'warn') + '"><div class="l">方位误差</div><div class="v">' + est.azErr.toFixed(0) + '<small>°</small></div></div>' +
        '<div class="metric ' + (est.hErr <= 0.25 ? 'good' : 'warn') + '"><div class="l">高度 / 误差</div><div class="v">' + est.h.toFixed(0) + '<small>m · ' + Math.round(est.hErr * 100) + '%</small></div></div>';

      var notes = [];
      if (est.n < 50) {
        if (state.useVol) {
          notes.push('事件只有 <b>' + est.n + ' 个</b>，宽度估计方差大；软体积约束把半宽从事件估计的 <b>' + est.bEvent.toFixed(0) + ' m</b> 校正到 <b>' + est.b.toFixed(0) + ' m</b>。');
        } else {
          notes.push('事件只有 <b>' + est.n + ' 个</b>，宽度估计方差大；当前未启用体积约束，半宽完全由事件云决定。');
        }
      }
      if (state.loc >= 8) notes.push('定位误差 <b>±' + state.loc + ' m</b> 已经接近半宽的 1/5；虽然扣除了误差方差，长度和宽度仍可能偏高。');
      if (est.azErr > 10) notes.push('事件云不够拉长，方位估计偏差 <b>' + est.azErr.toFixed(0) + '°</b>；建议结合施工曲线或邻段方位做约束。');
      if (!notes.length) notes.push('事件数与定位精度都足够，反演结果接近真值；但现场仍需用示踪或产剖做外部验证。');
      notes.push('真值只在示范里可见：真实半长 <b>' + A_TRUE + ' m</b>、半宽 <b>' + B_TRUE + ' m</b>、方位 <b>' + THETA_TRUE + '°</b>、高度 <b>' + H_TRUE + ' m</b>。');
      verdictEl.innerHTML = notes.join(' ');
    }

    function drawTable() {
      var rows = [
        ['半长 / m', est.a.toFixed(0), A_TRUE, Math.round(est.aErr * 100) + '%', est.aErr <= 0.15],
        ['半宽 / m', est.b.toFixed(0), B_TRUE, Math.round(est.bErr * 100) + '%', est.bErr <= 0.25],
        ['方位 / °', est.theta.toFixed(0), THETA_TRUE, est.azErr.toFixed(0) + '°', est.azErr <= 10],
        ['高度 / m', est.h.toFixed(0), H_TRUE, Math.round(est.hErr * 100) + '%', est.hErr <= 0.25],
        ['导流强度 / (kg/m²)', est.cond.toFixed(1), (PROPPANT / (2 * A_TRUE * H_TRUE)).toFixed(1), '—', true]
      ];
      var html = '';
      rows.forEach(function (r) {
        html += '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td class="' + (r[4] ? 'ok' : 'miss') + '">' + r[3] + '</td></tr>';
      });
      tableEl.innerHTML = '<thead><tr><th>参数</th><th>反演值</th><th>真值（示范）</th><th>误差</th></tr></thead><tbody>' + html + '</tbody>';
    }

    /* ---------- 三维场景：微地震点云 + 裂缝圆盘 ---------- */
    var d3 = null;
    function draw3D() {
      if (!D3) return;
      var el = root.querySelector('#e2-d3');
      if (!el) return;
      if (!d3) {
        d3 = D3.create3D(el, { w: 460, h: 250, yaw: -30, elev: 22, cy: 0.52, paint: paint3D });
      } else {
        d3.repaint();
      }
    }

    var ZMID3 = null, ZR3 = null;
    function zRange() {
      if (ZR3 != null) return;
      var zmin = 1e9, zmax = -1e9, i;
      for (i = 0; i < events.length; i++) {
        if (events[i].z < zmin) zmin = events[i].z;
        if (events[i].z > zmax) zmax = events[i].z;
      }
      ZMID3 = (zmin + zmax) / 2;
      ZR3 = Math.max(30, (zmax - zmin) / 2);
    }

    function ellipsePts(cx, cy, a, b, thetaDeg, zLevel, P) {
      var th = thetaDeg * Math.PI / 180, pts = [];
      for (var i = 0; i <= 64; i++) {
        var a2 = i / 64 * Math.PI * 2;
        var lx = Math.cos(a2) * a, ly = Math.sin(a2) * b;
        var ex = cx + lx * Math.cos(th) - ly * Math.sin(th);
        var ey = cy + lx * Math.sin(th) + ly * Math.cos(th);
        pts.push(P(Math.max(-1, Math.min(1, ex / 330)), Math.max(-0.62, Math.min(0.78, -(zLevel - ZMID3) / (ZR3 * 2.2))), Math.max(-1, Math.min(1, ey / 230))));
      }
      return pts;
    }

    function ellipseLinks(cx, cy, a, b, thetaDeg, zLo, zHi, P, color, out) {
      var th = thetaDeg * Math.PI / 180;
      for (var i = 0; i <= 64; i += 8) {
        var a2 = i / 64 * Math.PI * 2;
        var lx = Math.cos(a2) * a, ly = Math.sin(a2) * b;
        var ex = cx + lx * Math.cos(th) - ly * Math.sin(th);
        var ey = cy + lx * Math.sin(th) + ly * Math.cos(th);
        out.push(D3.line(
          P(Math.max(-1, Math.min(1, ex / 330)), Math.max(-0.62, Math.min(0.78, -(zLo - ZMID3) / (ZR3 * 2.2))), Math.max(-1, Math.min(1, ey / 230))),
          P(Math.max(-1, Math.min(1, ex / 330)), Math.max(-0.62, Math.min(0.78, -(zHi - ZMID3) / (ZR3 * 2.2))), Math.max(-1, Math.min(1, ey / 230))),
          color, .5, '2 3'));
      }
    }

    function paint3D(P) {
      zRange();
      var out = [], i;

      for (i = 0; i <= 6; i++) {
        var t = i / 3 - 1;
        out.push(D3.line(P(t, -0.62, -1), P(t, -0.62, 1), '#f0ede4', .7));
        out.push(D3.line(P(-1, -0.62, t), P(1, -0.62, t), '#f0ede4', .7));
      }
      out.push(D3.line(P(-1, -0.62, -1), P(1, -0.62, -1), '#c9c2b0', 1));
      out.push(D3.line(P(-1, -0.62, 1), P(1, -0.62, 1), '#c9c2b0', 1));
      out.push(D3.line(P(-1, -0.62, -1), P(-1, -0.62, 1), '#c9c2b0', 1));

      /* 真实裂缝（棕虚线圆盘） */
      var tp1 = ellipsePts(0, 0, A_TRUE, B_TRUE, THETA_TRUE, Z0 - H_TRUE / 2, P);
      var tp2 = ellipsePts(0, 0, A_TRUE, B_TRUE, THETA_TRUE, Z0 + H_TRUE / 2, P);
      ellipseLinks(0, 0, A_TRUE, B_TRUE, THETA_TRUE, Z0 - H_TRUE / 2, Z0 + H_TRUE / 2, P, '#8e5229', out);
      [tp1, tp2].forEach(function (pts) {
        out.push('<path d="M' + pts.map(function (p) { return p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join('L') +
          'Z" fill="rgba(142,82,41,.06)" stroke="#8e5229" stroke-width="1.2" stroke-dasharray="5 4"/>');
      });

      /* 反演裂缝（绿实线圆盘） */
      var ep1 = ellipsePts(est.cx, est.cy, est.a, est.b, est.theta, est.cz - est.h / 2, P);
      var ep2 = ellipsePts(est.cx, est.cy, est.a, est.b, est.theta, est.cz + est.h / 2, P);
      ellipseLinks(est.cx, est.cy, est.a, est.b, est.theta, est.cz - est.h / 2, est.cz + est.h / 2, P, '#2f7d6b', out);
      [ep1, ep2].forEach(function (pts) {
        out.push('<path d="M' + pts.map(function (p) { return p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join('L') +
          'Z" fill="rgba(47,125,107,.07)" stroke="#2f7d6b" stroke-width="1.4"/>');
      });

      /* 事件点（按深度上色，由深到浅排序绘制） */
      var pts3 = events.map(function (e) {
        var p = P(Math.max(-1, Math.min(1, e.x / 330)), Math.max(-0.62, Math.min(0.78, -(e.z - ZMID3) / (ZR3 * 2.2))), Math.max(-1, Math.min(1, e.y / 230)));
        var tt = 1 - (e.z - (ZMID3 - ZR3)) / Math.max(1e-6, ZR3 * 2);
        var col = L.ramp(Math.max(0, Math.min(1, tt)), [[0, '#41699b'], [0.5, '#7e5a8d'], [1, '#b26a39']]);
        return { p: p, col: col, d: p.d };
      });
      pts3.sort(function (a, b) { return a.d - b.d; });
      pts3.forEach(function (q) {
        out.push('<circle cx="' + q.p.x.toFixed(1) + '" cy="' + q.p.y.toFixed(1) + '" r="2.1" fill="' + q.col + '" opacity=".72"/>');
      });

      out.push(D3.text(P(0, -0.8, 1.3), '北 ←', '#79828a', 8));
      out.push(D3.text(P(1.32, -0.8, 0), '东 →', '#79828a', 8));
      out.push(D3.text(P(-1.05, .8, -0.95), '深度：浅↑ 深↓', '#79828a', 7.5, 'end'));
      return out.join('');
    }

    function draw() { drawMap(); drawCurve(); drawMetrics(); draw3D(); drawTable(); }

    function svgPoint(svg, e) {
      var pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    }

    /* ---------- 事件 ---------- */
    nEl.addEventListener('input', function () {
      state.n = +this.value;
      nV.textContent = this.value;
      recompute(true); draw();
    });
    locEl.addEventListener('input', function () {
      state.loc = +this.value;
      locV.textContent = '±' + this.value + ' m';
      recompute(true); draw();
    });
    volTog.addEventListener('click', function () {
      state.useVol = !state.useVol;
      volTog.classList.toggle('on', state.useVol);
      recompute(false); draw();
    });
    root.querySelector('[data-act="regen"]').addEventListener('click', function () {
      state.seed = Math.floor(Math.random() * 1e9);
      recompute(true); draw();
    });

    events = generate(state.seed, state.n, state.loc);
    recompute(false);
    draw();
  }

  window.EorFracGeometryDemo = EorFracGeometryDemo;
  window.EorFracGeometryCleanup = function () {
    if (timer) { clearInterval(timer); timer = null; }
  };
})();
