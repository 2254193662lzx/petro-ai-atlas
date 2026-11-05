/* =========================================================
   案例 · 增采 e5 微生物采油菌群活性预测
   ---------------------------------------------------------
   绑定场景：e5（增采 / 微生物采油菌群活性预测）
   三块内容：专业背景 / 案例流程 / 可运行示范
   示范脚本：eor-meor.demo.js
   ========================================================= */

(function () {

  /* =========================================================
     一、局部插图
     ========================================================= */

  /* 微生物驱机理：注营养液 → 菌群代谢 → 改善流动 → 增油 */
  function figMech() {
    var W = 620, H = 208;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="微生物驱机理示意">';

    // 储层
    s += '<rect x="30" y="52" width="560" height="126" rx="9" fill="#f5f2ea" stroke="#e9e4d8"/>';
    s += '<text x="40" y="68" font-size="8.5" font-family="monospace" fill="#9ba3a9" letter-spacing=".8">油藏孔隙</text>';

    // 注入井 / 生产井
    s += '<line x1="82" y1="24" x2="82" y2="166" stroke="#41699b" stroke-width="4" stroke-linecap="round"/>';
    s += '<line x1="538" y1="24" x2="538" y2="166" stroke="#b26a39" stroke-width="4" stroke-linecap="round"/>';
    s += '<text x="82" y="18" text-anchor="middle" font-size="9" fill="#41699b">注入井</text>';
    s += '<text x="538" y="18" text-anchor="middle" font-size="9" fill="#b26a39">生产井</text>';

    // 营养液箭头
    s += '<path d="M92 82 L150 82" stroke="#41699b" stroke-width="1.5" stroke-dasharray="4 3"/>';
    s += '<path d="M150 82 l-6-3.5v7z" fill="#41699b"/>';
    s += '<text x="100" y="76" font-size="8.5" fill="#41699b">营养液</text>';

    // 菌群与代谢产物
    var bugs = [[178, 100], [218, 126], [262, 94], [306, 120], [350, 98], [394, 124], [438, 100]];
    bugs.forEach(function (b) {
      s += '<circle cx="' + b[0] + '" cy="' + b[1] + '" r="5" fill="#2f7d6b" opacity=".75"/>';
      s += '<circle cx="' + (b[0] - 2) + '" cy="' + (b[1] - 2) + '" r="1.4" fill="#ffffff" opacity=".7"/>';
    });
    s += '<text x="308" y="150" text-anchor="middle" font-size="9" fill="#2f7d6b">菌群代谢：生物表面活性剂 · 气体 · 有机酸</text>';

    // 油滴
    [[196, 74], [242, 146], [286, 78], [330, 146], [374, 76], [418, 146], [462, 82], [496, 126]].forEach(function (o) {
      s += '<ellipse cx="' + o[0] + '" cy="' + o[1] + '" rx="6" ry="3.5" fill="#b26a39" opacity=".35"/>';
    });

    // 增油箭头
    s += '<path d="M486 82 L528 82" stroke="#b26a39" stroke-width="1.5"/>';
    s += '<path d="M528 82 l-6-3.5v7z" fill="#b26a39"/>';
    s += '<text x="506" y="76" text-anchor="middle" font-size="8.5" fill="#b26a39">增油</text>';

    // 三个要点
    s += '<text x="30" y="196" font-size="9" fill="#5d666d">① 菌群活性受营养、温度、盐度控制</text>';
    s += '<text x="236" y="196" font-size="9" fill="#5d666d">② 效果通过代谢产物间接体现</text>';
    s += '<text x="452" y="196" font-size="9" fill="#5d666d">③ 见效慢、取样周期长</text>';
    s += '</svg>';
    return s;
  }

  /* 日度生产 vs 周度取样：补注效果的确认延迟 */
  function figDelay() {
    var W = 620, H = 188, x0 = 64, pw = 520, y1 = 54, y2 = 104, y3 = 148;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="微生物取样与补注延迟示意">';

    s += '<text x="24" y="' + (y1 - 12) + '" font-size="9" fill="#79828a">日度生产</text>';
    s += '<text x="24" y="' + (y2 - 12) + '" font-size="9" fill="#79828a">周度取样</text>';
    s += '<text x="24" y="' + (y3 - 12) + '" font-size="9" fill="#79828a">补注决策</text>';

    // 时间轴
    s += '<line x1="' + x0 + '" y1="' + y3 + '" x2="' + (x0 + pw) + '" y2="' + y3 + '" stroke="#c9c2b0"/>';
    for (var d = 0; d <= 42; d += 7) {
      var x = x0 + d / 42 * pw;
      s += '<line x1="' + x + '" y1="' + (y3 - 4) + '" x2="' + x + '" y2="' + (y3 + 4) + '" stroke="#c9c2b0"/>';
      s += '<text x="' + x + '" y="' + (y3 + 18) + '" text-anchor="middle" font-size="8" font-family="monospace" fill="#9ba3a9">' + d + 'd</text>';
    }

    // 日度生产折线
    var pts = [];
    for (var i = 0; i <= 42; i++) {
      var xx = x0 + i / 42 * pw;
      var yy = y1 + 22 - 14 * Math.sin(i / 42 * Math.PI * 1.4) - (i % 3) * 0.5;
      pts.push(xx.toFixed(1) + ',' + yy.toFixed(1));
    }
    s += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="#b26a39" stroke-width="1.4" opacity=".75"/>';

    // 周度取样点
    for (d = 0; d <= 42; d += 7) {
      x = x0 + d / 42 * pw;
      s += '<circle cx="' + x + '" cy="' + y2 + '" r="4" fill="#2f7d6b" opacity=".8"/>';
    }

    // 补注 → 确认延迟
    var xp = x0, xc = x0 + 14 / 42 * pw;
    s += '<line x1="' + xp + '" y1="' + (y2 + 18) + '" x2="' + xp + '" y2="' + (y3 - 6) + '" stroke="#41699b" stroke-width="1.2"/>';
    s += '<text x="' + (xp + 4) + '" y="' + (y3 - 10) + '" font-size="8.5" fill="#41699b">补注</text>';
    s += '<line x1="' + xc + '" y1="' + (y2 + 18) + '" x2="' + xc + '" y2="' + (y3 - 6) + '" stroke="#b26a39" stroke-width="1.2" stroke-dasharray="3 3"/>';
    s += '<text x="' + (xc + 4) + '" y="' + (y3 - 10) + '" font-size="8.5" fill="#b26a39">才看到效果</text>';

    s += '<rect x="' + xp + '" y="' + (y2 + 8) + '" width="' + (xc - xp) + '" height="10" fill="#f8ecdf" opacity=".7"/>';
    s += '<text x="' + ((xp + xc) / 2) + '" y="' + (y2 + 4) + '" text-anchor="middle" font-size="8.5" fill="#8e5229">决策盲区：取样与见效都滞后</text>';
    s += '</svg>';
    return s;
  }

  /* 机理模型 + 数据模型：小样本下的混合建模 */
  function figHybrid() {
    var W = 620, H = 168, y = 36;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="机理与数据混合建模">';

    function box(x, w, title, sub, bg, fg) {
      var out = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="74" rx="8" fill="' + bg + '" stroke="' + fg + '" stroke-opacity=".28"/>';
      out += '<rect x="' + x + '" y="' + y + '" width="3" height="74" rx="1.5" fill="' + fg + '"/>';
      out += '<text x="' + (x + 12) + '" y="' + (y + 25) + '" font-size="11" font-weight="600" fill="#242b2e">' + title + '</text>';
      out += '<text x="' + (x + 12) + '" y="' + (y + 47) + '" font-size="8.5" fill="#5d666d">' + sub + '</text>';
      return out;
    }

    s += box(8, 156, '机理模型', '菌群生长 · 营养消耗', '#e6f1ec', '#2f7d6b');
    s += box(182, 156, '时序数据', '活性 · 产量 · 含水', '#e7eef9', '#41699b');
    s += box(356, 118, '融合模型', '状态估计', '#efe9f4', '#7e5a8d');
    s += box(492, 120, '决策输出', '补注时机', '#f8ecdf', '#b26a39');

    s += '<path d="M166 73h10m-3.5-3.4 3.6 3.4-3.6 3.4" stroke="#c9c2b0" stroke-width="1.2" fill="none"/>';
    s += '<path d="M340 73h10m-3.5-3.4 3.6 3.4-3.6 3.4" stroke="#c9c2b0" stroke-width="1.2" fill="none"/>';
    s += '<path d="M476 73h10m-3.5-3.4 3.6 3.4-3.6 3.4" stroke="#c9c2b0" stroke-width="1.2" fill="none"/>';

    s += '<path d="M430 112v18H86v-18" fill="none" stroke="#2f7d6b" stroke-width="1.2" stroke-dasharray="4 3"/>';
    s += '<text x="258" y="146" text-anchor="middle" font-size="9" fill="#2f7d6b">新取样回流，更新状态与参数</text>';
    s += '</svg>';
    return s;
  }

  /* =========================================================
     二、注册
     ========================================================= */
  Cases.register({
    id: 'eor-meor',
    sceneId: 'e5',
    title: '微生物采油菌群活性预测',
    status: 'ready',
    version: '1.0.0',
    updated: '2026-10-23',
    methods: ['ts'],

    tabs: {

      /* ---------- ① 专业背景 ---------- */
      background: {
        label: '专业背景',

        judge: [
          { label: '任务类型', value: '小样本时序预测', desc: '预测活性衰减，决定何时补注营养' },
          { label: '数据门槛', value: '30—60 周取样', desc: '周度生化指标 + 日度生产数据' },
          { label: '收益', value: '补注提前 3—7 天', desc: '减少营养浪费与活性断档' },
          { label: '难度', value: '高', desc: '机理不清、样本少、反馈滞后', html: K.dtag('高') }
        ],

        lede: '微生物采油（MEOR）向油藏注入功能菌群与营养液，靠菌群代谢产生的生物表面活性剂、气体和有机酸改善原油流动。它成本低、环境友好，但有一个天然难题：<b>菌群活性看不见、摸不着，只能靠定期取样培养</b>；等到检测结果出来，活性可能已经掉下去了。',

        sections: [
          {
            no: 1, en: 'PROBLEM', title: '当前做法与问题',
            html: '<p>现场通常按固定周期补注营养液：每周或每两周取一次样，测菌浓、代谢产物、pH 与界面张力；培养与化验还要 3—7 天。等结果回来，再决定下一次补注。<b>从"活性下降"到"决定补注"往往已经过去一周以上</b>。</p>' +
              '<p>补注少了，菌群活性断档，增油效果消失；补注多了，营养液被杂菌消耗或随水窜走，既浪费又可能引起地层堵塞。菌群演替、营养竞争、温度与盐度变化让"什么时候补"很难靠经验判断，而矿场试验的成本又很高。</p>' +
              K.figure(figMech(), 1, '微生物驱的链条：营养液 → 菌群代谢 → 改善原油流动 → 增油。**菌群活性是中间状态，不是直接测量量**；现场能看到的是产量、含水与少量取样指标。')
          },
          {
            no: 2, en: 'INTERVENTION', title: 'AI 能做什么',
            html: '<p>把问题建模成<b>小样本时序预测 + 软测量</b>：用日度注入、产量、含水与周度生化指标，估计当前菌群活性，预测未来 1—3 周会不会跌破阈值；再结合营养消耗与补注历史，推荐下一次补注的时间与剂量。</p>' +
              '<p>由于样本少、机理复杂，纯数据模型容易过拟合。<b>机理—数据混合建模</b>更合适：用菌群生长—营养消耗的简化机理约束趋势，用数据模型校正参数与个体差异。输出的是"建议补注窗口"，不是自动执行指令；现场仍需结合取样与井况确认。</p>' +
              K.figure(figHybrid(), 2, '混合建模的骨架。机理模型负责"趋势不会离谱"，数据模型负责"贴合这口井"。**小样本场景下，先验知识不是可选项，而是防止模型在噪声里乱跑的缰绳。**')
          },
          {
            no: 3, en: 'DATA', title: '你需要准备什么',
            html: '<p style="margin-bottom:14px">这类项目最贵的数据不是产量，而是<b>带时间戳的生化取样</b>。取样频率、培养方法、检测批次必须一致，否则不同批次之间的差异会被误当成菌群演替。</p>' +
              K.checklist([
                ['微生物与生化指标', '菌浓、代谢产物、pH、界面张力、盐度', '每周或每两周，30—60 个时间点'],
                ['注入数据', '营养液配方、注入量、注入时间', '日度，精确到天'],
                ['生产数据', '产油、产液、含水、井口压力', '日度'],
                ['温度与地层条件', '井温、层温、矿化度', '周度或按层'],
                ['矿场试验记录', '增油量、见效时间、作业措施', '少量井，用于外部验证']
              ]) +
              '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">公开数据说明</span></p>' +
              K.refs(['微生物驱矿场数据以油田自建为主，公开数据很少', '可参考微生物采油实验方法与生化指标规范'], null)
          },
          {
            no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向',
            html: '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px">' +
              K.dtag('高') + '<span class="small muted">机理不清、样本极少、反馈滞后，是典型的小样本强耦合问题。</span></div>' +
              K.meter('高') +
              '<p>难度定在"高"：一是<b>标签少</b>，一口井一年只有几十个取样点；二是<b>反馈滞后</b>，补注效果要等 1—2 周才体现在产量与活性上；三是<b>机理耦合</b>，菌群、营养、温度、盐度相互影响，纯相关模型很容易学到伪关系。建议先用机理模型做趋势基线，再用少量本地数据校正。</p>' +
              '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可借鉴的通用技术</span></p>' +
              K.refs(['时序预测', '软测量', '小样本学习', '机理—数据混合建模', '状态空间模型'], '#/method/ts') +
              '<p style="margin-top:18px" class="small muted">交叉环节：<a href="#/stage/oilprod" style="color:var(--jade-d);font-weight:600">采油</a> · 与注水调配、产量预测联动</p>'
          }
        ]
      },

      /* ---------- ② 案例流程 ---------- */
      workflow: {
        label: '案例流程',
        title: '案例：E 区块 6 口井的菌群活性监测与补注',
        lead: [
          'E 区块 6 口微生物驱试验井，每口井有 40—60 周的生化取样与日度生产数据。现场按"每两周补注一次"的固定制度运行，部分井出现活性断档，部分井营养液明显过量。',
          '目标是把"活性跌破阈值"的预警提前 **5 天以上**，在不增加总营养液用量的前提下，减少活性断档时间，并给出每口井的补注窗口。'
        ],
        stats: [
          ['试验井', '6', true], ['取样周数', '40—60', true],
          ['取样间隔', '7 d', true], ['预警提前量', '≥5 d'],
          ['补注制度', '固定 14 d'], ['目标', '减少断档']
        ],
        steps: [
          {
            name: '时间轴对齐', role: '工程环节',
            do: '把日度注入/生产数据与周度取样对齐到同一时间轴；标记补注事件、停井、作业等干扰；统一菌浓与代谢产物的检测口径。',
            effect: '每条样本都有可追溯的注入与生产背景',
            trap: '取样日期与检测日期混用，会把滞后算错'
          },
          {
            name: '机理基线', role: '算法基线',
            do: '用简化菌群生长—营养消耗模型拟合每口井的活性趋势，估计生长速率、衰减速率与营养半饱和常数。',
            effect: '得到一个不会"乱跑"的趋势基线',
            trap: '机理参数全部用文献值，不按本区温度与盐度校正'
          },
          {
            name: '数据模型校正', role: '算法核心',
            do: '在机理基线上用时序模型（状态空间、高斯过程或梯度提升）学习残差，吸收井间差异与未建模因素；按井分组交叉验证。',
            effect: '趋势合理，又能贴合单井',
            trap: '直接上黑箱模型，小样本下会把噪声当规律'
          },
          {
            name: '活性预测与预警', role: '算法核心',
            do: '滚动预测未来 1—3 周活性，给出置信区间；当预测跌破阈值时，提前发出补注预警，并估计营养液需求量。',
            effect: '把"事后补救"变成"提前安排"',
            trap: '只报一个点预测，现场无法判断预警的可信度'
          },
          {
            name: '补注执行与复盘', role: '闭环',
            do: '按预警窗口安排补注，记录实际用量与下一次取样结果；每口井每 2—4 周更新一次模型参数。',
            effect: '补注从固定制度变成按需触发',
            trap: '补注后不等新样本就继续按旧预测调整，容易过量'
          }
        ],
        metrics: {
          title: '怎么算"预测对了"',
          html: '<p>活性预测误差小，不等于补注时机对。一个模型可以准确预测"活性在下降"，但预警发得太晚，现场来不及安排；或者发得太早，导致营养液过量。评测要同时看<b>预测精度</b>与<b>决策收益</b>。</p>' +
            K.figure(figDelay(), 3, '日度生产数据很密，但菌群活性只能周度取样，补注效果还要再等 1—2 周。**决策盲区来自"取样延迟 + 见效延迟"的叠加**，这也是预测模型最该压缩的部分。') +
            K.dtable(['指标', '定义', '本例目标'], [
              ['活性预测 MAE', '未来 7 天活性预测的平均绝对误差', '≤ 0.08'],
              ['预警提前量', '跌破阈值前发出预警的天数', '≥ 5 d'],
              ['断档时间', '活性低于阈值且未补注的天数', '下降 50%'],
              ['营养液用量', '单位增油的营养液消耗', '不增加'],
              ['误报率', '预警后实际未跌破的比例', '≤ 20%']
            ])
        },
        fails: [
          { name: '取样延迟被忽略', why: '模型用的是"取样日"的活性，但决策发生在"今天"。若不把最后观测日期显式建模，预警会系统性滞后。' },
          { name: '营养过量', why: '模型只追"别让活性掉下去"，会倾向于多补。营养液过量会促进杂菌、增加成本，甚至堵塞地层。目标里必须带用量约束。' },
          { name: '井间迁移失败', why: '不同井的温度、盐度、菌群初始组成差异大。直接把 A 井的模型套到 B 井，预测会系统性偏移。需要按井校正或分层建模。' },
          { name: '机理漂移', why: '长期注入后菌群演替、地层环境变化，历史机理参数会失效。模型必须滚动更新，不能一次标定用一年。' },
          { name: '标签噪声', why: '菌浓与代谢产物的检测误差可能有 10%—20%。把单次取样当真值，会让模型追噪声。应使用多次取样的平滑值或测量误差模型。' }
        ]
      },

      /* ---------- ③ 可运行示范 ---------- */
      demo: {
        label: '可运行示范',
        mount: function (root, ctx) {
          if (typeof window.EorMeorDemo !== 'function') {
            root.innerHTML = '<div class="callout warn"><span class="ci">缺失</span>' +
              '<span>示范脚本未加载：请确认 index.html 中 <b>assets/cases/eor-meor.demo.js</b> 在 shell.js 之前引入。</span></div>';
            return;
          }
          window.EorMeorDemo(root, ctx);
        },
        unmount: function () {
          if (window.EorMeorCleanup) window.EorMeorCleanup();
        }
      }
    }
  });

})();
