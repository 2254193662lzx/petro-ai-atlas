/* =========================================================
   增采案例 · 共用三维投影工具（零依赖，纯 SVG）
   ---------------------------------------------------------
   create3D(container, opt) 在容器里渲染一个可拖转的三维场景：
     · 左键拖动改变方位角 yaw 与俯仰角 elev，双击复位
     · project(x, y, z) 返回屏幕坐标 { x, y, d }，d 为深度（大=近）
     · 世界坐标：x 向右，z 向屏幕内，y 向上；单位立方体 [-1,1]
   坐标变换：先绕 y 轴转 yaw，再绕 x 轴抬升 elev，最后正交投影。
   由五个增采案例的 demo 共用。
   ========================================================= */

(function (global) {
  'use strict';

  function create3D(container, opt) {
    opt = opt || {};
    var W = opt.w || 360, H = opt.h || 250;
    var yaw = opt.yaw == null ? -33 : opt.yaw;
    var elev = opt.elev == null ? 25 : opt.elev;
    var YAW0 = yaw, ELEV0 = elev;
    var cx = (opt.cx == null ? 0.5 : opt.cx) * W;
    var cy = (opt.cy == null ? 0.60 : opt.cy) * H;
    var span = Math.min(W / 2 - 16, H - 68) * (opt.scale || 1);

    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('data-yaw', yaw.toFixed(1));
    svg.style.cssText = 'width:100%;height:100%;display:block;user-select:none';
    container.innerHTML = '';
    container.appendChild(svg);

    var cosY = Math.cos(yaw * Math.PI / 180), sinY = Math.sin(yaw * Math.PI / 180);
    var cosE = Math.cos(elev * Math.PI / 180), sinE = Math.sin(elev * Math.PI / 180);

    function project(x, y, z) {
      var x1 = x * cosY + z * sinY;
      var z1 = -x * sinY + z * cosY;
      var y2 = y * cosE - z1 * sinE;
      var z2 = y * sinE + z1 * cosE;
      return { x: cx + x1 * span, y: cy - y2 * span, d: z2 };
    }

    function apply() {
      cosY = Math.cos(yaw * Math.PI / 180); sinY = Math.sin(yaw * Math.PI / 180);
      cosE = Math.cos(elev * Math.PI / 180); sinE = Math.sin(elev * Math.PI / 180);
      svg.setAttribute('data-yaw', yaw.toFixed(1));
      svg.setAttribute('data-elev', elev.toFixed(1));
    }

    var paint = opt.paint || function () { return ''; };
    var G = document.createElementNS(NS, 'g');
    svg.appendChild(G);
    function fire() {
      apply();
      G.innerHTML = paint(project, W, H) || '';
    }

    /* 拖动旋转 */
    var dragging = false, lx = 0, ly = 0, raf = 0;
    function schedule() {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0; fire();
      });
    }
    svg.style.cursor = 'grab';
    svg.addEventListener('pointerdown', function (e) {
      dragging = true; lx = e.clientX; ly = e.clientY;
      svg.style.cursor = 'grabbing';
      if (svg.setPointerCapture) { try { svg.setPointerCapture(e.pointerId); } catch (err) { } }
    });
    svg.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      yaw += (e.clientX - lx) * 0.42;
      elev = Math.min(86, Math.max(4, elev + (e.clientY - ly) * 0.30));
      lx = e.clientX; ly = e.clientY;
      schedule();
    });
    function endDrag() { dragging = false; svg.style.cursor = 'grab'; }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
    svg.addEventListener('pointerleave', function () { if (!dragging) svg.style.cursor = 'grab'; });
    svg.addEventListener('dblclick', function () {
      yaw = YAW0; elev = ELEV0; schedule();
    });

    apply();
    fire();
    return {
      svg: svg, project: project, repaint: fire,
      reset: function () { yaw = YAW0; elev = ELEV0; schedule(); },
      setPaint: function (fn) { paint = fn; fire(); },
      yaw: function () { return yaw; }, elev: function () { return elev; },
      span: span, W: W, H: H
    };
  }

  /* ---------- 便捷绘图原语 ---------- */
  function poly(pts, fill, o) {
    o = o || {};
    return '<path d="M' + pts.map(function (p) { return p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join('L') +
      'Z" fill="' + fill + '" stroke="' + (o.stroke || fill) + '" stroke-width="' + (o.sw == null ? .4 : o.sw) +
      '" stroke-opacity="' + (o.so == null ? .9 : o.so) + '"' +
      (o.so2 != null ? ' fill-opacity="' + o.so2 + '"' : '') + ' stroke-linejoin="round"/>';
  }
  function line(a, b, color, sw, dash) {
    return '<line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) +
      '" stroke="' + color + '" stroke-width="' + (sw || .8) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
  }
  function text(p, txt, color, size, anchor, weight) {
    return '<text x="' + p.x.toFixed(1) + '" y="' + p.y.toFixed(1) + '" font-size="' + (size || 8) +
      '" fill="' + color + '"' + (weight ? ' font-weight="' + weight + '"' : '') +
      ' text-anchor="' + (anchor || 'middle') + '">' + txt + '</text>';
  }

  /* 三维专用色带：比平面热力图更饱和，白底可读 */
  var DSURF = [[0, '#eef5f1'], [0.28, '#bcdccf'], [0.52, '#7fbfab'], [0.75, '#3d8a76'], [1, '#1c4f43']];
  var DRISK = [[0, '#f7ebe7'], [0.35, '#e5b6a9'], [0.7, '#c97b66'], [1, '#9d3c2c']];

  global.EOR3D = {
    create3D: create3D, poly: poly, line: line, text: text,
    DSURF: DSURF, DRISK: DRISK
  };
})(window);
