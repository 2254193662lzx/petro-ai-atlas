/* =========================================================
   案例 · 增采 e1 压裂参数智能优化
   ---------------------------------------------------------
   绑定场景：e1（增采 / 压裂参数智能优化）
   三块内容：专业背景 / 案例流程 / 可运行示范
   示范脚本：eor-frac-opt.demo.js
   ========================================================= */

(function () {

  /* =========================================================
     一、局部插图
     ========================================================= */

  /* 水平井分段压裂：段、簇、裂缝与关键参数 */
  function figDesign() {
    var W = 620, H = 220, yw = 132;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="水平井分段压裂示意">';

    // 储层条带
    s += '<rect x="24" y="58" width="572" height="132" rx="8" fill="#fdfcf9" stroke="#e9e4d8"/>';
    s += '<rect x="24" y="58" width="572" height="132" fill="#f5f2ea" opacity=".55"/>';
    s += '<text x="34" y="74" font-size="8.5" font-family="monospace" fill="#9ba3a9" letter-spacing=".8">储层</text>';

    // 井筒
    s += '<line x1="54" y1="' + yw + '" x2="566" y2="' + yw + '" stroke="#5d666d" stroke-width="3" stroke-linecap="round"/>';
    s += '<circle cx="54" cy="' + yw + '" r="4" fill="#5d666d"/>';
    s += '<text x="44" y="' + (yw + 20) + '" text-anchor="end" font-size="9" fill="#5d666d">水平井</text>';

    // 四段裂缝
    var xs = [132, 252, 372, 492];
    xs.forEach(function (x, i) {
      // 裂缝两翼
      s += '<path d="M' + x + ' ' + yw + ' C' + (x - 10) + ' ' + (yw - 18) + ',' + (x - 14) + ' ' + (yw - 38) + ',' + (x - 8) + ' ' + (yw - 52) + '" fill="none" stroke="#2f7d6b" stroke-width="1.6" opacity=".8"/>';
      s += '<path d="M' + x + ' ' + yw + ' C' + (x + 10) + ' ' + (yw - 18) + ',' + (x + 14) + ' ' + (yw - 38) + ',' + (x + 8) + ' ' + (yw - 52) + '" fill="none" stroke="#2f7d6b" stroke-width="1.6" opacity=".8"/>';
      s += '<path d="M' + x + ' ' + yw + ' C' + (x - 10) + ' ' + (yw + 18) + ',' + (x - 14) + ' ' + (yw + 38) + ',' + (x - 8) + ' ' + (yw + 52) + '" fill="none" stroke="#2f7d6b" stroke-width="1.6" opacity=".8"/>';
      s += '<path d="M' + x + ' ' + yw + ' C' + (x + 10) + ' ' + (yw + 18) + ',' + (x + 14) + ' ' + (yw + 38) + ',' + (x + 8) + ' ' + (yw + 52) + '" fill="none" stroke="#2f7d6b" stroke-width="1.6" opacity=".8"/>';
      // 射孔簇
      [x - 10, x, x + 10].forEach(function (cx) {
        s += '<circle cx="' + cx + '" cy="' + yw + '" r="2.6" fill="#b26a39"/>';
      });
      s += '<text x="' + x + '" y="' + (yw + 74) + '" text-anchor="middle" font-size="8.5" font-family="monospace" fill="#9ba3a9">段 ' + (i + 1) + '</text>';
    });

    // 段间距标注
    s += '<line x1="132" y1="' + (yw + 84) + '" x2="252" y2="' + (yw + 84) + '" stroke="#b26a39" stroke-width="1" stroke-dasharray="3 3"/>';
    s += '<line x1="132" y1="' + (yw + 79) + '" x2="132" y2="' + (yw + 89) + '" stroke="#b26a39" stroke-width="1"/>';
    s += '<line x1="252" y1="' + (yw + 79) + '" x2="252" y2="' + (yw + 89) + '" stroke="#b26a39" stroke-width="1"/>';
    s += '<text x="192" y="' + (yw + 99) + '" text-anchor="middle" font-size="9" fill="#b26a39">段间距 / 簇间距</text>';

    // 参数标注
    s += '<text x="24" y="38" font-size="10" font-family="monospace" fill="#41699b">排量 Q</text>';
    s += '<text x="24" y="52" font-size="9" fill="#79828a">决定缝高与携砂能力</text>';
    s += '<text x="524" y="38" font-size="10" font-family="monospace" fill="#41699b">砂比</text>';
    s += '<text x="524" y="52" font-size="9" fill="#79828a">决定导流能力与砂堵风险</text>';
    s += '</svg>';
    return s;
  }

  /* 代理模型 + 约束优化的闭环 */
  function figProxy() {
    var W = 620, H = 168, y = 34, w = 102, gap = 18, x = 8;
    var boxes = [
      ['地质与岩石力学', '应力 · 脆性 · 裂缝', '#e6f1ec', '#2f7d6b'],
      ['压裂模拟器', '裂缝扩展 · 产能', '#e7eef9', '#41699b'],
      ['代理模型', '秒级预测 + 误差', '#efe9f4', '#7e5a8d'],
      ['约束优化', '排量 · 砂比 · 段簇', '#f8ecdf', '#b26a39'],
      ['现场方案', '泵注程序', '#f1f1dd', '#767a2e']
    ];
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="压裂参数优化闭环">';
    boxes.forEach(function (b, i) {
      s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + 72 + '" rx="8" fill="' + b[2] + '" stroke="' + b[3] + '" stroke-opacity=".28"/>';
      s += '<rect x="' + x + '" y="' + y + '" width="3" height="72" rx="1.5" fill="' + b[3] + '"/>';
      s += '<text x="' + (x + 12) + '" y="' + (y + 24) + '" font-size="11" font-weight="600" fill="#242b2e">' + b[0] + '</text>';
      s += '<text x="' + (x + 12) + '" y="' + (y + 45) + '" font-size="8.5" fill="#5d666d">' + b[1] + '</text>';
      s += '<text x="' + (x + w - 10) + '" y="' + (y + 63) + '" text-anchor="end" font-size="8" font-family="monospace" fill="' + b[3] + '">0' + (i + 1) + '</text>';
      if (i < boxes.length - 1) {
        s += '<path d="M' + (x + w + 3) + ' ' + (y + 36) + 'h9m-3.5-3.4 3.6 3.4-3.6 3.4" stroke="#c9c2b0" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
      }
      x += w + gap;
    });
    s += '<path d="M' + (x - gap - w / 2) + ' ' + (y + 82) + 'v18H' + (8 + w / 2) + 'v-18" fill="none" stroke="#2f7d6b" stroke-width="1.2" stroke-dasharray="4 3"/>';
    s += '<text x="' + (W / 2) + '" y="' + (y + 118) + '" text-anchor="middle" font-size="9.5" fill="#2f7d6b">现场施工数据回流，代理模型按段更新</text>';
    s += '<rect x="8" y="' + (H - 26) + '" width="604" height="20" rx="5" fill="#f8ecdf" stroke="#b26a39" stroke-opacity=".2"/>';
    s += '<text x="20" y="' + (H - 12) + '" font-size="9" fill="#8e5229">硬约束：砂堵风险 · 套管压力 · 设备能力 · 用水量 · 成本</text>';
    s += '</svg>';
    return s;
  }

  /* 无约束最优 vs 带风险约束的最优 */
  function figRisk() {
    var W = 620, H = 222, x0 = 66, y0 = 24, pw = 420, ph = 160;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="压裂参数的风险约束示意">';
    s += '<defs><pattern id="e1hatchFig" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#b05a51" stroke-width="1" opacity=".22"/></pattern></defs>';
    s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + pw + '" height="' + ph + '" rx="6" fill="#fdfcf9" stroke="#e9e4d8"/>';

    // 响应面等高线
    [[0.28, 0.30, 0.16], [0.40, 0.40, 0.13], [0.50, 0.50, 0.10]].forEach(function (e, i) {
      s += '<ellipse cx="' + (x0 + pw * 0.44) + '" cy="' + (y0 + ph * 0.46) + '" rx="' + (pw * e[0]) + '" ry="' + (ph * e[1]) + '" fill="none" stroke="#2f7d6b" stroke-opacity="' + (0.18 + i * 0.12) + '" stroke-dasharray="4 4"/>';
    });
    s += '<text x="' + (x0 + pw * 0.36) + '" y="' + (y0 + ph * 0.42) + '" font-size="9" fill="#2f7d6b">NPV 等高线</text>';

    // 风险不可行区（右上）
    s += '<path d="M' + (x0 + pw * 0.56) + ' ' + y0 + 'H' + (x0 + pw) + 'V' + (y0 + ph * 0.88) + 'C' + (x0 + pw * 0.78) + ' ' + (y0 + ph * 0.80) + ',' + (x0 + pw * 0.68) + ' ' + (y0 + ph * 0.48) + ',' + (x0 + pw * 0.56) + ' ' + y0 + 'Z" fill="url(#e1hatchFig)" stroke="#b05a51" stroke-opacity=".35"/>';
    s += '<text x="' + (x0 + pw * 0.79) + '" y="' + (y0 + ph * 0.18) + '" text-anchor="middle" font-size="9.5" fill="#b05a51">砂堵 / 套压超限</text>';

    // 无约束最优（落在风险区）
    var ux = x0 + pw * 0.66, uy = y0 + ph * 0.22;
    s += '<circle cx="' + ux + '" cy="' + uy + '" r="4.5" fill="none" stroke="#b05a51" stroke-width="1.6"/>';
    s += '<text x="' + (ux + 8) + '" y="' + (uy - 6) + '" font-size="8.5" fill="#b05a51">无约束最优（不可施工）</text>';

    // 约束最优（边界内）
    var cx = x0 + pw * 0.49, cy = y0 + ph * 0.50;
    s += '<path d="M' + cx + ' ' + (cy - 6) + 'l6 6-6 6-6-6z" fill="#b26a39"/>';
    s += '<text x="' + (cx + 10) + '" y="' + (cy + 3) + '" font-size="8.5" fill="#b26a39">约束最优</text>';

    // 轴
    s += '<text x="' + (x0 + pw / 2) + '" y="' + (y0 + ph + 28) + '" text-anchor="middle" font-size="9.5" fill="#79828a">排量 / (m³/min)</text>';
    s += '<text x="' + (x0 - 12) + '" y="' + (y0 + ph / 2) + '" text-anchor="middle" font-size="9.5" fill="#79828a" transform="rotate(-90 ' + (x0 - 12) + ' ' + (y0 + ph / 2) + ')">砂比 / %</text>';

    // 说明
    s += '<text x="' + (x0 + pw + 18) + '" y="' + (y0 + 26) + '" font-size="9" fill="#5d666d">经济学上的</text>';
    s += '<text x="' + (x0 + pw + 18) + '" y="' + (y0 + 40) + '" font-size="9" fill="#5d666d">最优点常常</text>';
    s += '<text x="' + (x0 + pw + 18) + '" y="' + (y0 + 54) + '" font-size="9" fill="#5d666d">落在风险区里</text>';
    s += '<text x="' + (x0 + pw + 18) + '" y="' + (y0 + 82) + '" font-size="9" fill="#b26a39">优化 = 在可行域</text>';
    s += '<text x="' + (x0 + pw + 18) + '" y="' + (y0 + 96) + '" font-size="9" fill="#b26a39">内找最好的点</text>';
    s += '</svg>';
    return s;
  }

  /* =========================================================
     二、注册
     ========================================================= */
  Cases.register({
    id: 'eor-frac-opt',
    sceneId: 'e1',
    title: '压裂参数智能优化',
    status: 'ready',
    version: '1.0.0',
    updated: '2026-10-23',
    methods: ['opt'],

    tabs: {

      /* ---------- ① 专业背景 ---------- */
      background: {
        label: '专业背景',

        judge: [
          { label: '任务类型', value: '代理模型 + 约束优化', desc: '不是预测一条曲线，而是给出一套可施工参数' },
          { label: '数据门槛', value: '200—500 段', desc: '施工曲线 + 压后产能 + 地质参数' },
          { label: '收益', value: 'EUR +8—15%', desc: '同等液量下提高改造效果' },
          { label: '难度', value: '高', desc: '模拟器保真度与代理外推是上限', html: K.dtag('高') }
        ],

        lede: '压裂设计要同时决定段簇划分、排量、砂比、液体体系与加砂规模。目标是在给定地质条件下，用有限的液量和水马力，把尽可能多的储层改造出可流动的裂缝网络。参数组合是组合爆炸的，而现场往往只能按邻井经验套用一套"看起来差不多"的方案。',

        sections: [
          {
            no: 1, en: 'PROBLEM', title: '当前做法与问题',
            html: '<p>一段压裂方案至少包含 5—8 个可调参数：段间距、簇数、单簇液量、排量、砂比、加砂强度、液体体系。若每项取 4—6 个水平，组合数就是上万级。<b>压裂模拟器跑一次完整裂缝扩展 + 产能预测，可能要几分钟到几十分钟</b>，不可能在方案编制时把每个组合都算一遍。</p>' +
              '<p>现场更常见的做法是"邻井套用 + 少量微调"：同一区块的应力剖面、天然裂缝发育程度、脆性指数差异很大，邻井成功的参数换一口井可能就砂堵或压不开。压后效果又要等几个月生产数据才能确认，<b>试错成本极高</b>。</p>' +
              K.figure(figDesign(), 1, '水平井分段压裂的几何。**段间距、簇间距、排量、砂比**共同决定裂缝网络，但它们不是独立作用的：排量低携砂能力不足，砂比高又容易在近井地带砂堵。')
          },
          {
            no: 2, en: 'INTERVENTION', title: 'AI 能做什么',
            html: '<p>把优化拆成"贵模型 + 便宜代理"两层：先用压裂模拟器生成一批样本，训练一个<b>代理模型</b>（高斯过程、梯度提升或神经网络），把"几分钟一次"的模拟压缩到"毫秒级预测 + 误差估计"；再在代理模型上用<b>贝叶斯优化或进化算法</b>搜索参数组合。</p>' +
              '<p>关键是约束不能丢：砂堵概率、套管压力、泵注设备能力、用水量与成本都是硬约束。算法输出的不是"理论最优"，而是<b>在可施工范围内、风险可接受的最优解</b>；人负责地质合理性与施工可行性审核。</p>' +
              K.figure(figProxy(), 2, '代理模型把模拟器"蒸馏"成一个可快速调用的函数，优化器才可能在上万组参数里搜索。**代理模型的价值不在替代模拟器，而在让优化从不可行变成可行**；最终方案仍要回到模拟器与现场验证。')
          },
          {
            no: 3, en: 'DATA', title: '你需要准备什么',
            html: '<p style="margin-bottom:14px">压裂优化最容易被低估的是<b>标签质量</b>：压后产能受井网、生产制度、邻井干扰影响，不能简单当成"压裂效果"。数据清单里前两项决定模型能不能学，后两项决定模型能不能用。</p>' +
              K.checklist([
                ['地质与岩石力学', '最小水平主应力、应力差、脆性指数、天然裂缝密度', '每段或每簇，至少每段'],
                ['压裂施工曲线', '排量、井口/井底压力、砂比、液量、加砂量', '200—500 段，需与段簇对齐'],
                ['压后产能', '测试产量、90 天累产、EUR', '作为目标，需剔除生产制度影响'],
                ['微地震 / 示踪 / 产剖', '事件点、各簇贡献', '少量井，用于验证裂缝形态'],
                ['模拟器样本', '同一地质条件下的参数—响应样本', '数千组，用于训练代理模型']
              ]) +
              '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">公开数据说明</span></p>' +
              K.refs(['压裂施工与产能数据以油田自建为主', '可参考公开的压裂设计规范与岩石力学参数手册'], null)
          },
          {
            no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向',
            html: '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px">' +
              K.dtag('高') + '<span class="small muted">模拟器保真度决定上限，代理外推与多目标冲突是主要风险。</span></div>' +
              K.meter('高') +
              '<p>难度定在"高"：一是<b>真值昂贵</b>，压后产能要等生产数据；二是<b>模拟器本身有误差</b>，代理模型只能逼近模拟器，不能超过它；三是<b>约束很硬</b>，砂堵和套压超限不是"精度问题"，而是安全问题。建议先在一个区块、一种压裂工艺上做小范围验证，再扩展到多区块。</p>' +
              '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可借鉴的通用技术</span></p>' +
              K.refs(['代理模型', '贝叶斯优化', '约束优化', '多目标优化', '不确定性量化'], '#/method/opt') +
              '<p style="margin-top:18px" class="small muted">交叉环节：<a href="#/stage/oilprod" style="color:var(--jade-d);font-weight:600">采油</a> · 压后产能与生产制度联动</p>'
          }
        ]
      },

      /* ---------- ② 案例流程 ---------- */
      workflow: {
        label: '案例流程',
        title: '案例：D 区块 36 口井、214 段的压裂参数优化',
        lead: [
          'D 区块有 36 口水平井、214 段压裂数据，现场长期沿用"排量 12 m³/min、砂比 22%"的邻井经验。部分井砂堵，部分井压后产量明显低于同区邻井。',
          '目标是在**不增加总液量与砂量**的前提下，把单井 EUR 提高 8% 以上，同时把砂堵与套压超限的风险控制在 10% 以内。'
        ],
        stats: [
          ['井数', '36', true], ['压裂段', '214', true],
          ['可调参数', '6', true], ['目标 EUR', '+8%'],
          ['风险上限', '≤10%'], ['代理模型误差', '≤8%']
        ],
        steps: [
          {
            name: '段簇数据对齐', role: '工程环节',
            do: '把施工曲线按段切开，统一排量、砂比、液量口径；把地质与岩石力学参数按段（最好按簇）挂接；剔除压窜、停泵等异常段。',
            effect: '每一段成为一条可比较的样本',
            trap: '用井级平均参数代替段级参数，会把段间差异抹平'
          },
          {
            name: '建立压裂模拟样本', role: '工程环节',
            do: '用校准过的压裂模拟器，在设计空间内做拉丁超立方或低差异采样，生成数千组"参数 → 裂缝几何 / 产能"样本。',
            effect: '代理模型有了可学习的输入输出',
            trap: '模拟器未用本区数据校准，样本再多也只是"模拟器的偏见"'
          },
          {
            name: '训练代理模型', role: '算法核心',
            do: '用高斯过程或梯度提升树拟合参数到产能的映射，输出预测均值与不确定度；按井分组验证，避免同井段泄漏。',
            effect: '毫秒级评估任意参数组合',
            trap: '只追求 R²，忽略外推区的不确定度'
          },
          {
            name: '约束优化', role: '效果关键',
            do: '在代理模型上做贝叶斯优化 / 进化搜索，目标为 EUR 或净现值，约束为砂堵概率、套压、泵注能力、用水量；输出 Pareto 前沿而不是单一解。',
            effect: '得到可施工、风险可控的参数组合',
            trap: '把风险当成软惩罚，优化器会钻进高风险区'
          },
          {
            name: '现场验证与回流', role: '闭环',
            do: '选 3—5 段先导试验，施工后对比设计曲线与实际曲线；压后产能回流，按井更新代理模型，逐步扩大应用范围。',
            effect: '模型从"模拟器可信"走向"现场可信"',
            trap: '一次试验就全区块推广，异常段会被淹没在平均效果里'
          }
        ],
        metrics: {
          title: '怎么算"优化对了"',
          html: '<p>压裂优化有两层指标：<b>代理模型准不准</b>，以及<b>优化解在真实世界好不好</b>。前者可以用模拟器样本验证，后者只能靠现场试验。只报告第一层，容易把"拟合模拟器"误当成"优化了产量"。</p>' +
            K.figure(figRisk(), 3, '经济学上的最优点常常落在砂堵或套压超限的区域。**约束优化的本质不是找最高点，而是在可行域边界上找最好的点**。风险上限每放宽一点，NPV 可能上升，但可施工性下降。') +
            K.dtable(['指标', '定义', '本例目标'], [
              ['代理模型 R²', '模拟器样本上的拟合优度', '≥ 0.85'],
              ['代理模型 MAE', 'EUR 预测的平均绝对误差', '≤ 8%'],
              ['EUR 提升', '优化方案相对邻井经验方案的增幅', '≥ 8%'],
              ['风险合格率', '优化方案中砂堵 / 套压超限比例', '≤ 10%'],
              ['现场符合率', '先导试验实际产能达到预测的比例', '≥ 70%']
            ])
        },
        fails: [
          { name: '代理模型外推失真', why: '训练样本集中在历史参数附近，优化器却会去没样本的角落找最优。必须加不确定度惩罚、限制搜索边界，或主动补充模拟样本。' },
          { name: '模拟器本身的偏差', why: '裂缝扩展模型对天然裂缝、滤失、应力阴影的刻画不完整。代理模型再准，也只是在拟合一个可能错的模拟器。必须用现场数据校准模拟器。' },
          { name: '把风险当软约束', why: '砂堵概率 20% 和 5% 在目标函数里可能只差一点，但现场后果完全不同。风险应作为硬约束或独立的分层筛选条件。' },
          { name: '目标泄漏', why: '用压后产量当标签时，井网、生产制度、邻井干扰都会混进来。应尽量选择同层位、同生产制度的井段做对比。' },
          { name: '多目标被压成单指标', why: 'EUR、成本、用水量、施工风险不能简单加权成一个分数。应输出 Pareto 前沿，让决策者看到取舍。' }
        ]
      },

      /* ---------- ③ 可运行示范 ---------- */
      demo: {
        label: '可运行示范',
        mount: function (root, ctx) {
          if (typeof window.EorFracOptDemo !== 'function') {
            root.innerHTML = '<div class="callout warn"><span class="ci">缺失</span>' +
              '<span>示范脚本未加载：请确认 index.html 中 <b>assets/cases/eor-frac-opt.demo.js</b> 在 shell.js 之前引入。</span></div>';
            return;
          }
          window.EorFracOptDemo(root, ctx);
        },
        unmount: function () {
          if (window.EorFracOptCleanup) window.EorFracOptCleanup();
        }
      }
    }
  });

})();
