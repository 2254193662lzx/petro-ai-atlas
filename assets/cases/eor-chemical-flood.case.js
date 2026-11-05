/* =========================================================
   案例 · 增采 e3 化学驱配方智能筛选
   ---------------------------------------------------------
   绑定场景：e3（增采 / 化学驱配方智能筛选）
   三块内容：专业背景 / 案例流程 / 可运行示范
   示范脚本：eor-chemical-flood.demo.js
   ========================================================= */

(function () {

  /* =========================================================
     一、局部插图
     ========================================================= */

  /* 配方空间：已有实验集中在左下角，右上角是未探索区 */
  function figSpace() {
    var W = 620, H = 236, x0 = 74, y0 = 26, pw = 430, ph = 160;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="化学驱配方空间与实验覆盖示意">';
    s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + pw + '" height="' + ph + '" rx="6" fill="#fdfcf9" stroke="#e9e4d8"/>';

    // 网格
    for (var i = 0; i <= 4; i++) {
      var gx = x0 + pw * i / 4;
      s += '<line x1="' + gx + '" y1="' + y0 + '" x2="' + gx + '" y2="' + (y0 + ph) + '" stroke="#efece1"/>';
    }
    for (var j = 0; j <= 4; j++) {
      var gy = y0 + ph * j / 4;
      s += '<line x1="' + x0 + '" y1="' + gy + '" x2="' + (x0 + pw) + '" y2="' + gy + '" stroke="#efece1"/>';
    }

    // 未探索区
    s += '<ellipse cx="' + (x0 + pw * 0.72) + '" cy="' + (y0 + ph * 0.34) + '" rx="96" ry="52" fill="#f8ecdf" opacity=".55" stroke="#b26a39" stroke-dasharray="4 4" stroke-opacity=".55"/>';
    s += '<text x="' + (x0 + pw * 0.72) + '" y="' + (y0 + ph * 0.34 - 60) + '" text-anchor="middle" font-size="10" fill="#b26a39">未探索区 · 可能才是最优</text>';

    // 已做实验：左下角扎堆
    var pts = [
      [0.10, 0.12], [0.14, 0.18], [0.17, 0.10], [0.20, 0.20], [0.12, 0.26],
      [0.24, 0.14], [0.27, 0.22], [0.19, 0.28], [0.31, 0.17]
    ];
    pts.forEach(function (p) {
      var cx = x0 + p[0] * pw, cy = y0 + (1 - p[1]) * ph;
      s += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4" fill="#2f7d6b" opacity=".8"/>';
    });
    s += '<text x="' + (x0 + 12) + '" y="' + (y0 + ph - 12) + '" font-size="9.5" fill="#5d666d">已有 86 组实验 · 大多集中在低浓度区</text>';

    // 轴
    s += '<text x="' + (x0 + pw / 2) + '" y="' + (y0 + ph + 26) + '" text-anchor="middle" font-size="10" fill="#79828a">聚合物浓度 / wt%</text>';
    s += '<text x="' + (x0 - 10) + '" y="' + (y0 + ph / 2) + '" text-anchor="middle" font-size="10" fill="#79828a" transform="rotate(-90 ' + (x0 - 10) + ' ' + (y0 + ph / 2) + ')">表面活性剂浓度 / wt%</text>';
    s += '<text x="' + x0 + '" y="' + (y0 + ph + 48) + '" font-size="9" fill="#9ba3a9" font-family="monospace">0.05</text>';
    s += '<text x="' + (x0 + pw) + '" y="' + (y0 + ph + 48) + '" text-anchor="end" font-size="9" fill="#9ba3a9" font-family="monospace">0.35</text>';

    // 成本标注
    s += '<rect x="' + (x0 + pw + 22) + '" y="' + (y0 + 18) + '" width="88" height="66" rx="7" fill="#f8ecdf" stroke="#b26a39" stroke-opacity=".2"/>';
    s += '<text x="' + (x0 + pw + 66) + '" y="' + (y0 + 38) + '" text-anchor="middle" font-size="9" fill="#8e5229" font-family="monospace">单组实验</text>';
    s += '<text x="' + (x0 + pw + 66) + '" y="' + (y0 + 56) + '" text-anchor="middle" font-size="15" fill="#8e5229" font-family="monospace">3 周</text>';
    s += '<text x="' + (x0 + pw + 66) + '" y="' + (y0 + 72) + '" text-anchor="middle" font-size="9" fill="#8e5229">2—5 万元</text>';
    s += '</svg>';
    return s;
  }

  /* 主动学习闭环：模型 → 采集函数 → 推荐实验 → 结果回流 */
  function figLoop() {
    var W = 620, H = 148, y = 34, w = 104, gap = 18, x = 8;
    var boxes = [
      ['历史实验', '配方 + 性能', '#e6f1ec', '#2f7d6b'],
      ['代理模型', '均值 + 不确定度', '#e7eef9', '#41699b'],
      ['采集函数', 'EI / UCB', '#efe9f4', '#7e5a8d'],
      ['推荐下一组', '实验设计', '#f8ecdf', '#b26a39'],
      ['实验验证', '结果回流', '#f1f1dd', '#767a2e']
    ];
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="主动学习闭环">';
    boxes.forEach(function (b, i) {
      s += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="74" rx="8" fill="' + b[2] + '" stroke="' + b[3] + '" stroke-opacity=".28"/>';
      s += '<rect x="' + x + '" y="' + y + '" width="3" height="74" rx="1.5" fill="' + b[3] + '"/>';
      s += '<text x="' + (x + 13) + '" y="' + (y + 24) + '" font-size="11.5" font-weight="600" fill="#242b2e">' + b[0] + '</text>';
      s += '<text x="' + (x + 13) + '" y="' + (y + 46) + '" font-size="9" fill="#5d666d">' + b[1] + '</text>';
      s += '<text x="' + (x + w - 11) + '" y="' + (y + 64) + '" text-anchor="end" font-size="8.5" font-family="monospace" fill="' + b[3] + '">0' + (i + 1) + '</text>';
      if (i < boxes.length - 1) {
        s += '<path d="M' + (x + w + 3) + ' ' + (y + 37) + 'h9m-3.5-3.4 3.6 3.4-3.6 3.4" stroke="#c9c2b0" stroke-width="1.2" fill="none" stroke-linecap="round"/>';
      }
      x += w + gap;
    });
    // 回流箭头
    s += '<path d="M' + (x - gap - w / 2) + ' ' + (y + 84) + 'v20H' + (8 + w / 2) + 'v-20" fill="none" stroke="#2f7d6b" stroke-width="1.2" stroke-dasharray="4 3"/>';
    s += '<path d="M' + (8 + w / 2 - 3.5) + ' ' + (y + 78) + 'l3.5 6 3.5-6" fill="none" stroke="#2f7d6b" stroke-width="1.2"/>';
    s += '<text x="' + (W / 2) + '" y="' + (y + 122) + '" text-anchor="middle" font-size="9.5" fill="#2f7d6b">每做完 3—5 组实验就重训一次：模型越用越准</text>';
    s += '</svg>';
    return s;
  }

  /* top-k 命中示意：模型排序前 10%，有多少真的在前 10% */
  function figTopk() {
    var W = 620, H = 172, s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="top-k 命中示意">';
    var xs = [8, 214, 420];
    var titles = ['按模型预测排序', '按实测性能排序', 'top-10% 命中'];
    xs.forEach(function (x, i) {
      s += '<rect x="' + x + '" y="12" width="192" height="146" rx="9" fill="#fdfcf9" stroke="#e9e4d8"/>';
      s += '<text x="' + (x + 12) + '" y="31" font-size="9.5" font-family="monospace" fill="#5d666d" letter-spacing=".6">' + titles[i] + '</text>';
    });

    function dotRow(x, y, order, good) {
      var out = '';
      for (var i = 0; i < 10; i++) {
        var isGood = good.indexOf(i) >= 0;
        out += '<rect x="' + (x + 12 + i * 17) + '" y="' + (y + 10) + '" width="12" height="30" rx="3" fill="' + (isGood ? '#2f7d6b' : '#e9e4d8') + '" opacity="' + (isGood ? '.85' : '1') + '"/>';
      }
      order.forEach(function (v, i) {
        out += '<text x="' + (x + 18 + i * 17) + '" y="' + (y + 58) + '" text-anchor="middle" font-size="7.5" font-family="monospace" fill="#9ba3a9">' + v + '</text>';
      });
      return out;
    }

    // 模型排序：前 10% 里 7 个真好、3 个误报
    s += dotRow(xs[0], 40, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [0, 1, 2, 3, 4, 5, 6]);
    s += '<text x="' + (xs[0] + 12) + '" y="118" font-size="9.5" fill="#2f7d6b">命中 7 / 10</text>';
    s += '<text x="' + (xs[0] + 12) + '" y="136" font-size="9" fill="#9ba3a9">精确率 0.70</text>';

    // 实测排序
    s += dotRow(xs[1], 40, [3, 1, 8, 2, 5, 9, 4, 7, 10, 6], [0, 1, 2, 3, 4, 5, 6]);
    s += '<text x="' + (xs[1] + 12) + '" y="118" font-size="9.5" fill="#5d666d">真实最优就在前 7 位</text>';
    s += '<text x="' + (xs[1] + 12) + '" y="136" font-size="9" fill="#9ba3a9">这是评测的"标准答案"</text>';

    // 命中
    s += '<text x="' + (xs[2] + 96) + '" y="76" text-anchor="middle" font-size="26" font-family="monospace" fill="#2f7d6b">7/10</text>';
    s += '<text x="' + (xs[2] + 96) + '" y="98" text-anchor="middle" font-size="9.5" fill="#5d666d">模型的 top-10% 命中率</text>';
    s += '<text x="' + (xs[2] + 12) + '" y="126" font-size="9" fill="#b26a39">R² 高不代表 top-k 选得准</text>';
    s += '<text x="' + (xs[2] + 12) + '" y="142" font-size="9" fill="#9ba3a9">配方筛选只看头部排序</text>';
    s += '</svg>';
    return s;
  }

  /* =========================================================
     二、注册
     ========================================================= */
  Cases.register({
    id: 'eor-chemical-flood',
    sceneId: 'e3',
    title: '化学驱配方智能筛选',
    status: 'ready',
    version: '1.0.0',
    updated: '2026-10-23',
    methods: ['opt'],

    tabs: {

      /* ---------- ① 专业背景 ---------- */
      background: {
        label: '专业背景',

        judge: [
          { label: '任务类型', value: '小样本回归 + 主动学习', desc: '不是一次算完，而是决定下一次做什么实验' },
          { label: '数据门槛', value: '100—500 组', desc: '配方—性能实验，需统一实验条件' },
          { label: '收益', value: '实验 −40%', desc: '同等效果下少做 3—4 成实验' },
          { label: '难度', value: '中', desc: '小样本、批次效应、外推风险', html: K.dtag('中') }
        ],

        lede: '化学驱（聚合物驱、表面活性剂驱、ASP 等）靠改变流度比与界面张力把残余油驱出来。配方由聚合物类型与浓度、表面活性剂类型与浓度、碱、段塞尺寸等共同决定，而每一组岩心驱替实验都要 2—6 周。配方空间大、实验昂贵，靠经验挑几个点做实验，很容易整片最优区都没被覆盖。',

        sections: [
          {
            no: 1, en: 'PROBLEM', title: '当前做法与问题',
            html: '<p>一个区块的候选配方通常有几十到上百组：聚合物浓度、表面活性剂浓度、碱浓度、段塞大小，每一项都要在岩心上验证。单组实验 2—6 周、成本数万元，<b>全因子实验在时间与经费上都不可能</b>。</p>' +
              '<p>现场常见的做法是参考邻块或文献配方，再做少量验证。问题是不同区块的原油黏度、温度、矿化度、岩石润湿性都不同，<b>邻块配方直接套用经常失效</b>；而实验条件不统一（岩心批次、老化时间、注入速度），又会让历史数据难以合并。</p>' +
              K.figure(figSpace(), 1, '已有实验往往集中在"容易做、看起来有希望"的低浓度区，真正的最优区可能从没被采过样。**配方筛选的核心不是把已知区域拟合得更准，而是决定下一个实验点放在哪。**')
          },
          {
            no: 2, en: 'INTERVENTION', title: 'AI 能做什么',
            html: '<p>把配方筛选建模成<b>小样本贝叶斯优化</b>：用历史实验训练一个代理模型（高斯过程最常用），同时给出"预测性能"和"预测不确定度"；再用采集函数在候选配方库里挑出<b>信息量最大或最可能超过当前最优</b>的那一组，交给实验室验证。</p>' +
              '<p>算法替换的是<b>实验设计</b>这一步，不是实验本身。人仍然负责实验执行、机理审核和安全边界；模型输出的也不是一句"最优配方"，而是三样东西：<b>当前最优候选、它有多不确定、下一组该做什么</b>。</p>' +
              K.figure(figLoop(), 2, '主动学习闭环。关键在"回流"：每完成 3—5 组实验就重训一次。**不做回流的模型，等于用三年前的配方经验指导今天的实验。**')
          },
          {
            no: 3, en: 'DATA', title: '你需要准备什么',
            html: '<p style="margin-bottom:14px">立项前先对着这张清单打勾。化学驱的数据不在多，而在<b>实验条件可追溯</b>：同一组配方在不同岩心、不同温度下做的结果，不能简单混在一起。</p>' +
              K.checklist([
                ['配方—性能实验', '聚合物/表面活性剂类型、浓度、碱、段塞，界面张力、驱油效率、黏度保留率', '100—500 组，需记录实验条件'],
                ['岩心与流体物性', '渗透率、孔隙度、原油黏度、温度、矿化度', '每组实验都要有'],
                ['实验批次与操作员', '岩心批次、老化时间、注入速度', '用于估计批次效应'],
                ['矿场试验数据', '增油量、含水变化、注入压力', '少量真值，用于外部验证'],
                ['候选配方库', '可采购、可配制的配方组合', '主动学习的搜索空间']
              ]) +
              '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">公开数据说明</span></p>' +
              K.refs(['化学驱配方数据以油田自建为主，公开数据集很少', '可参考油田化学实验数据规范统一字段'], null)
          },
          {
            no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向',
            html: '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px">' +
              K.dtag('中') + '<span class="small muted">数据规整、目标明确；难在小样本、批次效应与外推风险。</span></div>' +
              K.meter('中') +
              '<p>难度定在"中"而不是"低"，主要因为三件事：<b>样本少</b>（通常几百组以内）、<b>实验条件不一</b>（批次效应会伪装成配方效果）、<b>外推危险</b>（模型在没见过的浓度区间会给出看似自信的错误预测）。建议先做数据规范化与一个可解释基线，再上高斯过程与主动学习。</p>' +
              '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可借鉴的通用技术</span></p>' +
              K.refs(['高斯过程回归', '主动学习', '贝叶斯优化', '实验设计', '批次效应校正'], '#/method/opt') +
              '<p style="margin-top:18px" class="small muted">交叉环节：<a href="#/stage/oilprod" style="color:var(--jade-d);font-weight:600">采油</a> · 矿场试验阶段与注采调配联动</p>'
          }
        ]
      },

      /* ---------- ② 案例流程 ---------- */
      workflow: {
        label: '案例流程',
        title: '案例：B 区块 86 组历史实验 + 30 组新实验的配方筛选',
        lead: [
          'B 区块已积累 86 组化学驱配方实验，目标是在**新增 30 组实验内**找到驱油效率提升 ≥ 18 个百分点的配方，并把实验数量比网格筛选减少 40%。',
          '这个案例的重点不是"训练一个回归模型"，而是把实验预算花在刀刃上：先规范数据，再建立代理模型，最后用采集函数决定下一组实验。'
        ],
        stats: [
          ['历史实验', '86', true], ['新增预算', '30', true],
          ['配方变量', '5', true], ['目标增油', '≥18 个百分点'],
          ['单组周期', '3 周'], ['预计节省', '约 40%']
        ],
        steps: [
          {
            name: '数据规范化与批次校正', role: '工程环节',
            do: '统一浓度单位与实验口径；把岩心批次、温度、矿化度作为协变量；用同一批次内的对照实验估计批次偏移，必要时先做批次校正。',
            effect: '历史数据第一次可以放在同一张表里比较',
            trap: '把不同岩心、不同温度的结果直接混在一起，模型会学到"批次"而不是"配方"'
          },
          {
            name: '建立可解释基线', role: '算法基线',
            do: '先用线性回归或梯度提升树做基线，按**批次**或**时间**划分训练/验证集，报告 R²、RMSE 与 top-10% 命中率。',
            effect: '知道收益到底来自数据清洗还是模型',
            trap: '随机划分样本会让同批次数据泄漏，指标虚高'
          },
          {
            name: '训练代理模型', role: '算法核心',
            do: '用高斯过程或集成模型拟合"配方 + 储层条件 → 驱油效率"，同时输出预测均值与不确定度；多目标时分别建模界面张力、黏度保留率与增油幅度。',
            effect: '每个候选配方都有"预测值 + 可信区间"',
            trap: '只输出一个点预测，无法判断该探索还是该利用'
          },
          {
            name: '主动学习推荐下一组', role: '算法核心',
            do: '在可采购的候选配方库上计算采集函数（EI / UCB），并加约束：溶解度、黏度上限、成本、现场可配制性。输出 1—3 组推荐配方。',
            effect: '实验预算优先花在最能减少不确定性的位置',
            trap: '采集函数只追不确定度，会推荐明显不可行的配方'
          },
          {
            name: '实验验证与闭环', role: '闭环',
            do: '实验室按推荐顺序做实验，结果回流；每 3—5 组重训一次。达到预算或找到稳定优于基线的配方后，进入岩心放大与矿场试验。',
            effect: '模型随实验推进逐步收敛到真实最优区',
            trap: '不做回流，模型很快脱离最新的实验条件'
          }
        ],
        metrics: {
          title: '怎么算"筛对了"',
          html: '<p>配方筛选是<b>排序问题</b>，不是逐点回归问题。R² = 0.8 只能说明整体趋势拟合得不错，不能说明模型推荐的前 10% 配方真的更好。真正要看的是 <b>top-k 命中率</b>：模型排序的前 k 个配方里，有多少落在实测排序的前 k 个。</p>' +
            K.figure(figTopk(), 3, '同一个模型，整体 R² 可以很高，但 top-10% 只命中 7 个。配方筛选只关心头部，所以**评测必须按 top-k 做，而不是只看 RMSE**。') +
            K.dtable(['指标', '定义', '本例目标'], [
              ['R²', '整体拟合优度，只作参考', '≥ 0.75'],
              ['top-10% 命中率', '模型前 10% 中落入实测前 10% 的比例', '≥ 0.70'],
              ['实验节省率', '达到同等最优值所用实验数相对网格筛选的降幅', '≥ 40%'],
              ['推荐可行性', '推荐配方中可采购、可配制的比例', '100%']
            ])
        },
        fails: [
          { name: '批次效应伪装成配方效果', why: '不同岩心批次、老化时间带来的系统偏差，会被模型当成配方差异。必须记录批次并做校正，验证集要按批次划分。' },
          { name: '外推过远', why: '高斯过程在远离历史数据的区域会回到先验均值，但不确定度也很大。若采集函数只追不确定度，会推荐大量不可行配方。应加可行性约束与专家筛选。' },
          { name: '目标泄漏', why: '用矿场增油数据反推配方时，注采制度、井网、储层非均质性都会混进来。配方实验应尽量在相同实验条件下对比。' },
          { name: '多目标冲突', why: '界面张力低不代表驱油效率高，聚合物浓度高也不代表黏度保留率好。多目标要分别建模，再用 Pareto 前沿筛选，不能压成一个分数。' },
          { name: '实验噪声被当成信号', why: '单组实验的重复误差可能有几个百分点。主动学习若把噪声当成真实差异，会反复追同一个"假最优"。建议每组关键配方做 2—3 次重复。' }
        ]
      },

      /* ---------- ③ 可运行示范 ---------- */
      demo: {
        label: '可运行示范',
        mount: function (root, ctx) {
          if (typeof window.EorChemicalFloodDemo !== 'function') {
            root.innerHTML = '<div class="callout warn"><span class="ci">缺失</span>' +
              '<span>示范脚本未加载：请确认 index.html 中 <b>assets/cases/eor-chemical-flood.demo.js</b> 在 shell.js 之前引入。</span></div>';
            return;
          }
          window.EorChemicalFloodDemo(root, ctx);
        },
        unmount: function () {
          if (window.EorChemicalFloodCleanup) window.EorChemicalFloodCleanup();
        }
      }
    }
  });

})();
