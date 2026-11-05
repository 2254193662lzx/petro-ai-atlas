/* =========================================================
   案例 · 增采 e2 压裂裂缝形态预测
   ---------------------------------------------------------
   绑定场景：e2（增采 / 压裂裂缝形态预测）
   三块内容：专业背景 / 案例流程 / 可运行示范
   示范脚本：eor-frac-geometry.demo.js
   ========================================================= */

(function () {

  /* =========================================================
     一、局部插图
     ========================================================= */

  /* 同一片微地震事件，可以对应不同的裂缝几何 */
  function figIllPosed() {
    var W = 620, H = 196, s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="裂缝反演的多解性">';
    var panels = [
      ['解释 A：长而窄', 0.18],
      ['解释 B：短而宽', 0.30],
      ['解释 C：两翼不对称', 0.24]
    ];
    panels.forEach(function (p, i) {
      var x = 8 + i * 204, y = 12, w = 192, h = 158;
      s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="9" fill="#fdfcf9" stroke="#e9e4d8"/>';
      s += '<text x="' + (x + 12) + '" y="' + (y + 20) + '" font-size="9.5" font-family="monospace" fill="#5d666d">' + p[0] + '</text>';

      // 事件云
      var rnd = (i + 1) * 17;
      function r() { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; }
      for (var k = 0; k < 34; k++) {
        var ex = x + 96 + (r() - 0.5) * 118 + (r() - 0.5) * 20;
        var ey = y + 84 + (r() - 0.5) * 54;
        s += '<circle cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="1.7" fill="#41699b" opacity=".55"/>';
      }

      // 两种解释
      s += '<ellipse cx="' + (x + 96) + '" cy="' + (y + 84) + '" rx="' + (70 * p[1] * 5) + '" ry="' + (14 + i * 4) + '" fill="none" stroke="#2f7d6b" stroke-width="1.4"/>';
      s += '<ellipse cx="' + (x + 96) + '" cy="' + (y + 84) + '" rx="' + (44 + i * 8) + '" ry="' + (22 - i * 4) + '" fill="none" stroke="#b26a39" stroke-width="1.4" stroke-dasharray="4 3"/>';
      s += '<text x="' + (x + 12) + '" y="' + (y + h - 10) + '" font-size="8.5" fill="#9ba3a9">两种几何都能解释事件分布</text>';
    });
    s += '</svg>';
    return s;
  }

  /* 多源数据融合反演 */
  function figFusion() {
    var W = 620, H = 156, s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="多源数据融合反演">';
    var inputs = [
      ['微地震事件', '时间 · 位置 · 震级', '#e7eef9', '#41699b'],
      ['施工曲线', '压力 · 排量 · 砂量', '#f8ecdf', '#b26a39'],
      ['地质与应力', '天然裂缝 · 应力差', '#e6f1ec', '#2f7d6b'],
      ['示踪 / 产剖', '各段贡献', '#efe9f4', '#7e5a8d']
    ];
    inputs.forEach(function (b, i) {
      var x = 8, y = 10 + i * 34;
      s += '<rect x="' + x + '" y="' + y + '" width="152" height="28" rx="6" fill="' + b[2] + '" stroke="' + b[3] + '" stroke-opacity=".28"/>';
      s += '<text x="' + (x + 10) + '" y="' + (y + 12) + '" font-size="9.5" font-weight="600" fill="#242b2e">' + b[0] + '</text>';
      s += '<text x="' + (x + 10) + '" y="' + (y + 23) + '" font-size="8" fill="#5d666d">' + b[1] + '</text>';
      s += '<path d="M160 ' + (y + 14) + 'h24m-4-4 4 4-4 4" stroke="#c9c2b0" stroke-width="1.1" fill="none"/>';
    });

    s += '<rect x="190" y="38" width="156" height="82" rx="8" fill="#fdfcf9" stroke="#41699b" stroke-opacity=".35"/>';
    s += '<text x="268" y="64" text-anchor="middle" font-size="11" font-weight="600" fill="#242b2e">多源反演</text>';
    s += '<text x="268" y="82" text-anchor="middle" font-size="8.5" fill="#5d666d">点云 + 曲线 + 先验</text>';
    s += '<text x="268" y="98" text-anchor="middle" font-size="8.5" fill="#5d666d">正则化 · 贝叶斯</text>';
    s += '<path d="M346 79h26m-4-4 4 4-4 4" stroke="#c9c2b0" stroke-width="1.1" fill="none"/>';

    s += '<rect x="376" y="26" width="236" height="106" rx="8" fill="#e6f1ec" stroke="#2f7d6b" stroke-opacity=".3"/>';
    s += '<text x="394" y="50" font-size="10" font-weight="600" fill="#235f51">输出：几何 + 不确定性</text>';
    s += '<text x="394" y="70" font-size="9" fill="#5d666d">半长 · 半宽 · 方位 · 高度</text>';
    s += '<text x="394" y="88" font-size="9" fill="#5d666d">导流能力 · 各段贡献</text>';
    s += '<text x="394" y="106" font-size="9" fill="#b26a39">每条结论都带置信区间</text>';
    s += '</svg>';
    return s;
  }

  /* 事件越多，估计的不确定性越小 */
  function figUncertainty() {
    var W = 620, H = 190, s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="事件数量与反演不确定性">';
    [[8, 22, '20 个事件：区间很宽'], [318, 120, '200 个事件：区间收窄']].forEach(function (panel, pi) {
      var x = panel[0], y = 10, w = 294, h = 164;
      s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="9" fill="#fdfcf9" stroke="#e9e4d8"/>';
      s += '<text x="' + (x + 12) + '" y="' + (y + 20) + '" font-size="9.5" font-family="monospace" fill="#5d666d">' + panel[2] + '</text>';
      var n = panel[1];
      var rnd = 100 + pi * 7;
      function r() { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; }
      for (var k = 0; k < n; k++) {
        var ex = x + w / 2 + (r() - 0.5) * 170 + (r() - 0.5) * 20;
        var ey = y + h / 2 + 10 + (r() - 0.5) * 72;
        s += '<circle cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="1.5" fill="#41699b" opacity=".45"/>';
      }
      s += '<ellipse cx="' + (x + w / 2) + '" cy="' + (y + h / 2 + 10) + '" rx="86" ry="18" fill="none" stroke="#8e5229" stroke-width="1.3" stroke-dasharray="5 4"/>';
      s += '<ellipse cx="' + (x + w / 2) + '" cy="' + (y + h / 2 + 10) + '" rx="' + (pi ? 94 : 122) + '" ry="' + (pi ? 28 : 64) + '" fill="#2f7d6b" opacity=".08" stroke="#2f7d6b" stroke-width="1.2" stroke-dasharray="3 3"/>';
      s += '<text x="' + (x + 12) + '" y="' + (y + h - 10) + '" font-size="8.5" fill="#9ba3a9">虚线：真实裂缝 · 浅绿：反演不确定范围</text>';
    });
    s += '</svg>';
    return s;
  }

  /* =========================================================
     二、注册
     ========================================================= */
  Cases.register({
    id: 'eor-frac-geometry',
    sceneId: 'e2',
    title: '压裂裂缝形态预测',
    status: 'ready',
    version: '1.0.0',
    updated: '2026-10-23',
    methods: ['cv', 'opt'],

    tabs: {

      /* ---------- ① 专业背景 ---------- */
      background: {
        label: '专业背景',

        judge: [
          { label: '任务类型', value: '多源反演 + 不确定性量化', desc: '从间接观测估计看不见的裂缝几何' },
          { label: '数据门槛', value: '数百—数千事件', desc: '微地震 + 施工曲线 + 地质模型' },
          { label: '收益', value: '解释工时 −60%', desc: '裂缝参数从"经验描述"变成可量化' },
          { label: '难度', value: '高', desc: '强不适定，多个解都能解释同一组观测', html: K.dtag('高') }
        ],

        lede: '压裂裂缝的几何（半长、半宽、方位、高度）与导流能力决定改造效果，也决定下一口井的井距、段间距和射孔位置。问题是<b>裂缝埋在地下几千米，几乎不可直接观测</b>：现场只能通过微地震事件、施工曲线、示踪剂与产剖间接推断。',

        sections: [
          {
            no: 1, en: 'PROBLEM', title: '当前做法与问题',
            html: '<p>微地震监测是目前最常用的裂缝成像手段，但事件点云本身并不等于裂缝：<b>同一个事件云，可以对应长而窄、短而宽、两翼不对称等多种几何</b>。解释员通常按经验圈一个"改造体积"，不同人圈出来的结果能差 30% 以上。</p>' +
              '<p>施工曲线能提供另一个约束：注入液量、砂量、压力响应与滤失特征。但施工曲线反演同样多解：压力高可能是裂缝延伸受阻，也可能是滤失大或液体黏度高。<b>单一数据源都不足以定住裂缝几何</b>，而微地震监测成本高，未必每口井都做。</p>' +
              K.figure(figIllPosed(), 1, '同一片微地震事件，可以被三种不同的裂缝几何解释。**这不是算法不够好，而是问题本身不适定**：观测维度低于未知量维度，必须引入额外约束与先验。')
          },
          {
            no: 2, en: 'INTERVENTION', title: 'AI 能做什么',
            html: '<p>把问题建模成<b>多源贝叶斯反演</b>：以微地震事件点云为主证据，用施工曲线（液量、砂量、压力）提供体积与裂缝开度的约束，用地质模型与邻井资料提供先验；输出不是一个"确定答案"，而是<b>几何参数的后验分布 + 不确定范围</b>。</p>' +
              '<p>算法替换的是<b>人工圈定与经验解释</b>，不是监测本身。人仍然负责事件筛选（剔除诱发缝、噪声）、地质合理性判断，以及结合示踪与产剖做最终验证。输出必须带置信区间，否则现场无法判断"这个长度能不能用来定井距"。</p>' +
              '<p>实际落地时，可以用点云网络、3D CNN 或图神经网络学习事件云的空间模式；本示范刻意使用可解释的协方差基线，便于看清反演逻辑、定位误差与体积约束各自起什么作用。</p>' +
              K.figure(figFusion(), 2, '四类证据进入同一个反演框架。**微地震给"哪里发生了破裂"，施工曲线给"注入了多少体积"，地质给"什么形态才合理"**；三者缺一，解就会漂。')
          },
          {
            no: 3, en: 'DATA', title: '你需要准备什么',
            html: '<p style="margin-bottom:14px">裂缝反演的数据门槛不在"量大"，而在<b>事件质量与对齐</b>。事件定位误差、深度分辨率、段簇归属，任何一项没处理好，反演结果都会系统性偏移。</p>' +
              K.checklist([
                ['微地震事件', '时间、x/y/z、震级、信噪比', '数百—数千事件 / 井'],
                ['施工曲线', '排量、井口/井底压力、砂比、液量、加砂量', '按段，分钟级'],
                ['地质与应力模型', '天然裂缝密度、应力差、脆性', '按段或按簇'],
                ['示踪与产剖', '各段/各簇贡献', '少量井，用于验证'],
                ['事件处理参数', '定位算法、速度模型、滤波阈值', '用于估计定位误差']
              ]) +
              '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">公开数据说明</span></p>' +
              K.refs(['微地震与压裂施工数据以油田自建为主，公开数据很少', '可参考诱发地震监测与裂缝反演的公开方法论文'], null)
          },
          {
            no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向',
            html: '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px">' +
              K.dtag('高') + '<span class="small muted">真值几乎不可观测，误差来源多，且多解性强。</span></div>' +
              K.meter('高') +
              '<p>难度定在"高"：一是<b>真值缺失</b>，没有一口井能直接看到完整裂缝；二是<b>定位误差</b>会把事件云撑大，长度与宽度被系统性高估；三是<b>深度分辨率差</b>，裂缝高度往往最不确定；四是<b>多解性</b>，必须有正则化与先验才能得到稳定解。建议先用"事件云 + 体积约束"做一个可解释基线，再上贝叶斯或深度反演。</p>' +
              '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可借鉴的通用技术</span></p>' +
              K.refs(['点云分析', '多源反演', '不适定问题正则化', '贝叶斯反演', '不确定性量化'], '#/method/cv') +
              '<p style="margin-top:18px" class="small muted">交叉环节：<a href="#/stage/geophys" style="color:var(--jade-d);font-weight:600">物探</a> · 微地震处理与速度模型</p>'
          }
        ]
      },

      /* ---------- ② 案例流程 ---------- */
      workflow: {
        label: '案例流程',
        title: '案例：F 区块 12 段压裂的裂缝形态反演',
        lead: [
          'F 区块一口水平井 12 段压裂，每段都有微地震监测与施工曲线。解释组原本按事件外包络人工圈定改造体积，单段要 1—2 小时，且不同解释员结果差异明显。',
          '目标是把单段解释时间压到 **30 分钟以内**，并给出半长、半宽、方位、高度的**区间估计**；用示踪与产剖做外部验证，而不是追求一个"看起来精确"的点值。'
        ],
        stats: [
          ['压裂段', '12', true], ['事件数', '1,800', true],
          ['单段解释', '1.5 h → 0.5 h', true], ['目标误差', '长度 ≤15%'],
          ['真值验证', '示踪 / 产剖'], ['输出', '区间估计']
        ],
        steps: [
          {
            name: '事件清洗与归属', role: '工程环节',
            do: '剔除诱发缝、噪声与远场事件；按时间窗与段簇归属把事件分到对应压裂段；统一坐标系与深度基准。',
            effect: '每个段有一片"干净"的事件云',
            trap: '把邻段事件算进来，会把裂缝长度系统性拉长'
          },
          {
            name: '定位误差估计', role: '工程环节',
            do: '用射孔校准、重复定位或速度模型扰动估计 x/y/z 定位误差；把误差作为反演噪声项，而不是忽略。',
            effect: '知道事件云里有多少是"真实展布"、多少是"定位噪声"',
            trap: '用未校准的速度模型，深度误差可能比裂缝高度还大'
          },
          {
            name: '几何初估', role: '算法基线',
            do: '对事件云做协方差分析与主成分分解，估计中心、方位、半长、半宽；扣除定位噪声方差，避免把误差当成裂缝尺寸。',
            effect: '得到一个可解释、可复现的几何基线',
            trap: '不做误差扣除，长度与宽度会随定位精度变差而虚高'
          },
          {
            name: '多源约束反演', role: '算法核心',
            do: '用施工曲线的液量、砂量与压力响应约束裂缝体积与开度；用地质先验约束方位与高度；用贝叶斯或正则化反演融合多源证据。',
            effect: '事件少或误差大时，解仍能被拉回合理范围',
            trap: '把不同量纲的证据硬加权，等于拍脑袋'
          },
          {
            name: '验证与不确定性输出', role: '闭环',
            do: '用示踪剂、产剖与邻井干扰验证；输出几何参数的区间估计与敏感性分析，而不是单一数值；把结果回流到下一段设计。',
            effect: '现场知道"这个长度有多可信"',
            trap: '只给点估计，决策者会误以为误差为零'
          }
        ],
        metrics: {
          title: '怎么算"反演对了"',
          html: '<p>裂缝反演没有直接真值，不能用普通回归的 R² 来评价。更合理的做法是：在少量有示踪/产剖验证的段上比对，同时检查<b>不确定性区间是否覆盖真值</b>。一个"点估计很准但区间极窄"的模型，比"区间合理覆盖"的模型更危险。</p>' +
            K.figure(figUncertainty(), 3, '事件越多，反演的不确定范围越窄。**事件少时不要假装精确**：宽区间本身就是有价值的信息，它告诉现场"这段结论只能用于定性判断"。') +
            K.dtable(['指标', '定义', '本例目标'], [
              ['半长误差', '反演半长与验证值的相对误差', '≤ 15%'],
              ['半宽误差', '反演半宽与验证值的相对误差', '≤ 25%'],
              ['方位误差', '反演方位与验证值的夹角', '≤ 10°'],
              ['区间覆盖率', '90% 置信区间覆盖验证值的比例', '≥ 85%'],
              ['单段解释时间', '从事件到输出几何的时间', '≤ 30 min']
            ])
        },
        fails: [
          { name: '定位误差被当成裂缝尺寸', why: '事件定位误差会把点云撑大，直接做协方差分析会高估长度和宽度。必须扣除定位噪声方差，或用误差模型联合估计。' },
          { name: '深度分辨率不足', why: '微地震深度误差往往大于裂缝高度，导致高度估计不可靠。应结合施工曲线、温度测井或邻井资料做约束。' },
          { name: '多解性', why: '长而窄与短而宽可以解释同一片事件云。没有体积约束或地质先验，反演会停在任意一个局部解。' },
          { name: '段簇归属错误', why: '邻段事件混入会把长度拉长、方位带偏。必须按时间窗与泵注程序严格分段。' },
          { name: '只给点估计', why: '现场会拿一个数去定井距。没有区间，就无法判断这个数该不该信。输出必须带不确定性与敏感性分析。' }
        ]
      },

      /* ---------- ③ 可运行示范 ---------- */
      demo: {
        label: '可运行示范',
        mount: function (root, ctx) {
          if (typeof window.EorFracGeometryDemo !== 'function') {
            root.innerHTML = '<div class="callout warn"><span class="ci">缺失</span>' +
              '<span>示范脚本未加载：请确认 index.html 中 <b>assets/cases/eor-frac-geometry.demo.js</b> 在 shell.js 之前引入。</span></div>';
            return;
          }
          window.EorFracGeometryDemo(root, ctx);
        },
        unmount: function () {
          if (window.EorFracGeometryCleanup) window.EorFracGeometryCleanup();
        }
      }
    }
  });

})();
