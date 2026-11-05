/* =========================================================
   案例 · 增采 e4 蒸汽吞吐注采参数优化
   ---------------------------------------------------------
   绑定场景：e4（增采 / 蒸汽吞吐注采参数优化）
   三块内容：专业背景 / 案例流程 / 可运行示范
   示范脚本：eor-steam-huffpuff.demo.js
   ========================================================= */

(function () {

  /* =========================================================
     一、局部插图
     ========================================================= */

  /* 一个吞吐周期的三阶段：注汽 → 焖井 → 采油 */
  function figCycle() {
    var W = 620, H = 214, x0 = 54, y0 = 44, pw = 530, ph = 128;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="蒸汽吞吐周期三阶段示意">';

    // 阶段底色
    s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + (pw * 0.34) + '" height="' + ph + '" fill="#e7eef9"/>';
    s += '<rect x="' + (x0 + pw * 0.34) + '" y="' + y0 + '" width="' + (pw * 0.11) + '" height="' + ph + '" fill="#f8ecdf"/>';
    s += '<rect x="' + (x0 + pw * 0.45) + '" y="' + y0 + '" width="' + (pw * 0.55) + '" height="' + ph + '" fill="#e6f1ec"/>';

    // 阶段标签
    s += '<text x="' + (x0 + pw * 0.17) + '" y="' + (y0 + 18) + '" text-anchor="middle" font-size="10" font-weight="600" fill="#41699b">注汽</text>';
    s += '<text x="' + (x0 + pw * 0.395) + '" y="' + (y0 + 18) + '" text-anchor="middle" font-size="10" font-weight="600" fill="#b26a39">焖井</text>';
    s += '<text x="' + (x0 + pw * 0.725) + '" y="' + (y0 + 18) + '" text-anchor="middle" font-size="10" font-weight="600" fill="#2f7d6b">采油</text>';

    // 温度曲线：注汽上升 → 焖井缓降 → 采油下降
    var temp = [
      [0, 0.18], [0.10, 0.42], [0.20, 0.70], [0.30, 0.88], [0.34, 0.90],
      [0.40, 0.84], [0.45, 0.78], [0.55, 0.58], [0.68, 0.38], [0.82, 0.24], [1.0, 0.14]
    ];
    var tp = temp.map(function (p) {
      return (x0 + p[0] * pw).toFixed(1) + ',' + (y0 + ph - p[1] * ph).toFixed(1);
    }).join(' ');
    s += '<polyline points="' + tp + '" fill="none" stroke="#b26a39" stroke-width="1.8"/>';

    // 产油曲线：焖井后起峰，指数递减
    var oil = [
      [0.45, 0.04], [0.48, 0.10], [0.52, 0.52], [0.56, 0.62], [0.62, 0.48],
      [0.70, 0.34], [0.80, 0.21], [0.90, 0.12], [1.0, 0.06]
    ];
    var op = oil.map(function (p) {
      return (x0 + p[0] * pw).toFixed(1) + ',' + (y0 + ph - p[1] * ph).toFixed(1);
    }).join(' ');
    s += '<polyline points="' + op + '" fill="none" stroke="#2f7d6b" stroke-width="1.8" stroke-dasharray="5 3"/>';

    // 轴
    s += '<line x1="' + x0 + '" y1="' + (y0 + ph) + '" x2="' + (x0 + pw) + '" y2="' + (y0 + ph) + '" stroke="#c9c2b0"/>';
    s += '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + x0 + '" y2="' + (y0 + ph) + '" stroke="#c9c2b0"/>';
    s += '<text x="' + (x0 + pw / 2) + '" y="' + (y0 + ph + 30) + '" text-anchor="middle" font-size="9.5" fill="#79828a">时间 / 天</text>';
    s += '<text x="' + (x0 - 12) + '" y="' + (y0 + ph / 2) + '" text-anchor="middle" font-size="9.5" fill="#79828a" transform="rotate(-90 ' + (x0 - 12) + ' ' + (y0 + ph / 2) + ')">温度 / 产油</text>';

    // 图例
    s += '<line x1="' + (x0 + 6) + '" y1="' + (H - 18) + '" x2="' + (x0 + 26) + '" y2="' + (H - 18) + '" stroke="#b26a39" stroke-width="1.8"/>';
    s += '<text x="' + (x0 + 31) + '" y="' + (H - 14) + '" font-size="9" fill="#5d666d">近井温度</text>';
    s += '<line x1="' + (x0 + 116) + '" y1="' + (H - 18) + '" x2="' + (x0 + 136) + '" y2="' + (H - 18) + '" stroke="#2f7d6b" stroke-width="1.8" stroke-dasharray="5 3"/>';
    s += '<text x="' + (x0 + 141) + '" y="' + (H - 14) + '" font-size="9" fill="#5d666d">产油速度</text>';

    // 参数标注
    s += '<text x="' + (x0 + 6) + '" y="' + (y0 - 8) + '" font-size="9" font-family="monospace" fill="#41699b">注汽量 Q · 干度</text>';
    s += '<text x="' + (x0 + pw * 0.36) + '" y="' + (y0 - 8) + '" font-size="9" font-family="monospace" fill="#b26a39">焖井 t</text>';
    s += '<text x="' + (x0 + pw * 0.47) + '" y="' + (y0 - 8) + '" font-size="9" font-family="monospace" fill="#2f7d6b">采液速度</text>';
    s += '</svg>';
    return s;
  }

  /* 单周期最优与全周期最优的分歧：后期继续按老参数注汽 */
  function figDivergence() {
    var W = 620, H = 196, x0 = 56, y0 = 26, pw = 500, ph = 130;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="固定注汽与优化注汽的周期分配对比">';

    // 平均分配 vs 前移后减
    var fixed = [0.72, 0.72, 0.72, 0.72, 0.72, 0.72, 0.72, 0.72];
    var opt = [1.00, 0.95, 0.90, 0.85, 0.79, 0.74, 0.69, 0.64];
    var bw = pw / 9.2;
    for (var i = 0; i < 8; i++) {
      var cx = x0 + (i + 0.5) * bw * 1.1;
      var hf = fixed[i] * ph, ho = opt[i] * ph;
      s += '<rect x="' + (cx - 11) + '" y="' + (y0 + ph - hf) + '" width="10" height="' + hf + '" rx="2" fill="#b26a39" opacity=".30"/>';
      s += '<rect x="' + (cx + 1) + '" y="' + (y0 + ph - ho) + '" width="10" height="' + ho + '" rx="2" fill="#2f7d6b" opacity=".78"/>';
      s += '<text x="' + cx + '" y="' + (y0 + ph + 16) + '" text-anchor="middle" font-size="8.5" font-family="monospace" fill="#9ba3a9">' + (i + 1) + '</text>';
    }
    // 轴
    s += '<line x1="' + x0 + '" y1="' + (y0 + ph) + '" x2="' + (x0 + pw) + '" y2="' + (y0 + ph) + '" stroke="#c9c2b0"/>';
    s += '<text x="' + (x0 + pw / 2) + '" y="' + (y0 + ph + 34) + '" text-anchor="middle" font-size="9.5" fill="#79828a">吞吐周期</text>';
    s += '<text x="' + (x0 - 10) + '" y="' + (y0 + ph / 2) + '" text-anchor="middle" font-size="9.5" fill="#79828a" transform="rotate(-90 ' + (x0 - 10) + ' ' + (y0 + ph / 2) + ')">单周期注汽量</text>';

    // 标注：优化 = 前移后减
    s += '<text x="' + (x0 + pw / 2) + '" y="' + (y0 - 8) + '" text-anchor="middle" font-size="9" fill="#5d666d">优化 = 前期多注、后期减汽</text>';
    s += '<rect x="' + (x0 + pw - 116) + '" y="' + (y0 + 3) + '" width="10" height="8" rx="2" fill="#b26a39" opacity=".30"/>';
    s += '<text x="' + (x0 + pw - 101) + '" y="' + (y0 + 10) + '" font-size="8.5" fill="#8e5229">固定方案</text>';
    s += '<rect x="' + (x0 + pw - 116) + '" y="' + (y0 + 17) + '" width="10" height="8" rx="2" fill="#2f7d6b" opacity=".78"/>';
    s += '<text x="' + (x0 + pw - 101) + '" y="' + (y0 + 24) + '" font-size="8.5" fill="#235f51">优化方案</text>';
    s += '</svg>';
    return s;
  }

  /* 为什么"单周期最优"不等于"累计最优" */
  function figTrap() {
    var W = 620, H = 170, s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="单周期与全周期目标示意">';
    var x = 8;
    var cards = [
      ['只盯本周期', '本周期油汽比最高', '#e7eef9', '#41699b', '每次都用最省汽的参数'],
      ['累计产油', '8 个周期总产油最大', '#e6f1ec', '#2f7d6b', '前期可多注，后期主动减汽'],
      ['现场约束', '锅炉、套管、出砂', '#f8ecdf', '#b26a39', '优化结果必须可执行']
    ];
    cards.forEach(function (c, i) {
      s += '<rect x="' + x + '" y="14" width="192" height="132" rx="9" fill="#fdfcf9" stroke="#e9e4d8"/>';
      s += '<rect x="' + x + '" y="14" width="192" height="4" rx="2" fill="' + c[3] + '" opacity=".55"/>';
      s += '<text x="' + (x + 14) + '" y="40" font-size="9" font-family="monospace" fill="' + c[3] + '" letter-spacing=".6">' + c[0] + '</text>';
      s += '<text x="' + (x + 14) + '" y="66" font-size="11.5" font-weight="600" fill="#242b2e">' + c[1] + '</text>';
      s += '<text x="' + (x + 14) + '" y="94" font-size="9.5" fill="#5d666d">' + c[4] + '</text>';
      s += '<text x="' + (x + 14) + '" y="124" font-size="9" fill="#9ba3a9">' + (i === 1 ? '← 本案例的优化目标' : '') + '</text>';
      x += 204;
    });
    s += '</svg>';
    return s;
  }

  /* =========================================================
     二、注册
     ========================================================= */
  Cases.register({
    id: 'eor-steam-huffpuff',
    sceneId: 'e4',
    title: '蒸汽吞吐注采参数优化',
    status: 'ready',
    version: '1.0.0',
    updated: '2026-10-23',
    methods: ['ts', 'opt'],

    tabs: {

      /* ---------- ① 专业背景 ---------- */
      background: {
        label: '专业背景',

        judge: [
          { label: '任务类型', value: '多周期序列优化', desc: '不是单周期调参，而是分配整个吞吐期的蒸汽' },
          { label: '数据门槛', value: '15—20 口井', desc: '单井 10—30 个吞吐周期' },
          { label: '收益', value: '油汽比 +7% 以上', desc: '同等蒸汽量下多产油' },
          { label: '难度', value: '中', desc: '周期样本少、跨周期耦合强', html: K.dtag('中') }
        ],

        lede: '蒸汽吞吐是稠油开发最常用的热采方式：向井内注蒸汽，焖井一段时间让热量扩散，再开井采油。一个周期通常 30—60 天，注汽量、蒸汽干度、焖井时间、采液速度共同决定这一周期能采出多少油。难的是，<b>周期之间不是独立的</b>：这一周期注多了，下一周期的剩余油、地层压力和温度场都变了。',

        sections: [
          {
            no: 1, en: 'PROBLEM', title: '当前做法与问题',
            html: '<p>现场多数井按"经验参数 + 邻井套用"运行：注汽量固定、焖井 3—5 天、采液速度按泵况调整。一个周期少则一个月，想通过现场试验比较几套参数，<b>一年也做不了几组</b>。</p>' +
              '<p>更关键的是目标错位：单周期看，少注汽、快采液往往油汽比更高；但整个吞吐期看，前期少注汽会浪费地层能量，后期剩余油变少后继续按老参数注汽，蒸汽大部分用来加热已经动用的区域，<b>油汽比越来越低</b>。人工很难同时权衡这两层。</p>' +
              K.figure(figCycle(), 1, '一个吞吐周期的三阶段。注汽量决定加热半径，焖井时间决定热量扩散与热损失，采液速度决定周期产量。**三个参数不是各自最优就能叠加出最优周期**，它们通过温度场和地层能量耦合在一起。')
          },
          {
            no: 2, en: 'INTERVENTION', title: 'AI 能做什么',
            html: '<p>把问题拆成两层：先用<b>代理模型</b>预测"给定周期参数 + 当前油藏状态"下的周期产油、峰值产液与油汽比；再用<b>序列优化</b>（动态规划、滚动优化或强化学习）在整个吞吐期上分配蒸汽预算，使累计产油或累计油汽比最大。</p>' +
              '<p>算法替换的是<b>参数试错与方案编制</b>，不是现场操作。人仍然负责约束审核：锅炉能力、套管耐温、井筒热损失、出砂与汽窜风险。模型给出的每个周期方案都要能落到可执行的注汽曲线和采液制度上。</p>' +
              K.figure(figTrap(), 2, '三个目标的区别。**只盯本周期**会把蒸汽省在错误的地方；**累计净油**才是吞吐井的经营目标；**现场约束**决定优化结果能不能执行。三者缺一，方案就会停在 PPT 上。')
          },
          {
            no: 3, en: 'DATA', title: '你需要准备什么',
            html: '<p style="margin-bottom:14px">蒸汽吞吐的数据门槛不在"传感器多"，而在<b>周期口径统一</b>。注汽量按水当量还是按蒸汽体积、干度怎么折算、焖井从哪一刻算起，这些口径不统一，跨井数据就没法合并。</p>' +
              K.checklist([
                ['周期注采数据', '注汽量、干度、注汽压力、焖井时间、产液/产油、含水', '单井 10—30 周期，至少 15 口井'],
                ['油藏与流体物性', '原油黏温曲线、有效厚度、含油饱和度、渗透率', '每口井或每区块'],
                ['温度监测', '井温、测温点、井筒热损失', '辅助判断加热半径'],
                ['井史与作业记录', '防砂、堵水、压裂、泵况', '解释异常周期'],
                ['经济参数', '蒸汽成本、油价、操作成本', '定义优化目标']
              ]) +
              '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">公开数据说明</span></p>' +
              K.refs(['稠油吞吐生产数据以油田自建为主，公开数据很少', '可参考稠油热采开发方案与周期数据规范'], null)
          },
          {
            no: 4, en: 'DIFFICULTY', title: '技术难度与参考方向',
            html: '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:2px">' +
              K.dtag('中') + '<span class="small muted">物理机理清晰、数据规整；难在周期样本少与跨周期耦合。</span></div>' +
              K.meter('中') +
              '<p>难度定在"中"：单井的周期样本通常只有 10—30 个，独立样本少；但同一个区块有几十口井，可以通过<b>跨井 pooling</b> 和迁移学习补足。另一个坑是跨周期状态变量（上一周期末的含水、压力、累计注汽）如果没进特征，模型会把周期之间的差异误当成参数效果。</p>' +
              '<p style="margin-top:18px"><span class="kicker plain" style="color:var(--ink-4)">可借鉴的通用技术</span></p>' +
              K.refs(['时序预测', '代理模型', '动态规划', '滚动优化', '跨井迁移'], '#/method/ts') +
              '<p style="margin-top:18px" class="small muted">交叉环节：<a href="#/stage/oilprod" style="color:var(--jade-d);font-weight:600">采油</a> · 与举升方式、泵况诊断联动</p>'
          }
        ]
      },

      /* ---------- ② 案例流程 ---------- */
      workflow: {
        label: '案例流程',
        title: '案例：C 区块 18 口稠油井的多周期蒸汽分配',
        lead: [
          'C 区块 18 口稠油井，平均每口井 12 个吞吐周期。现场一直用"每周期平均注汽、焖井 3 天"的固定制度，随着周期增加，油汽比从 0.22 降到 0.14。',
          '目标不是把某一周期的产量做高，而是**在不增加总蒸汽量的前提下，把 8 个周期的累计产油提高 6% 以上**，并给出每个周期的注汽量、焖井时间与采液速度。'
        ],
        stats: [
          ['井数', '18', true], ['总周期', '216', true],
          ['单周期天数', '40', true], ['目标油汽比', '+7%'],
          ['固定注汽', '800 t / 周期'], ['优化后', '975 → 625 t']
        ],
        steps: [
          {
            name: '周期口径统一', role: '工程环节',
            do: '统一注汽量（水当量）、干度、焖井起止时间与产液计量口径；把上一周期末含水、地层压力、累计注汽、累计产油作为跨周期状态特征。',
            effect: '每个周期成为一条可比较的样本',
            trap: '口径不统一，跨井数据合并后会把差异全算到"参数"头上'
          },
          {
            name: '单周期代理模型', role: '算法核心',
            do: '用梯度提升树或时序模型预测"周期参数 + 状态 → 周期产油、峰值产液、油汽比"，按井分组交叉验证，报告 MAE 与分周期误差。',
            effect: '可以在秒级内评估任意参数组合',
            trap: '按样本随机划分会让同一口井的相邻周期泄漏到验证集'
          },
          {
            name: '跨井迁移与分层', role: '算法核心',
            do: '按原油黏度、厚度、含油饱和度把井分成 2—3 类；同类井 pooling 训练，小样本井用迁移学习微调。',
            effect: '单井 10 个周期也能借到邻井信息',
            trap: '把黏温关系差异很大的井混在一起，模型会学成"平均井"'
          },
          {
            name: '多周期序列优化', role: '效果关键',
            do: '以累计产油为目标，在总蒸汽预算、锅炉能力、套管温度、单周期注汽上下限约束下，优化每个周期的注汽量与焖井时间；用滚动优化，每周期结束后按实际产量重算后续方案。',
            effect: '蒸汽从"平均分配"变成"按剩余油与回报分配"',
            trap: '只做单周期贪心，会在后期继续过度注汽'
          },
          {
            name: '现场执行与复盘', role: '闭环',
            do: '把优化方案转成注汽曲线与采液制度，执行后记录实际产油、含水与井温；每周期更新一次模型，异常周期人工复核。',
            effect: '方案随油藏状态持续修正',
            trap: '一次优化用一年，油藏进入高含水期后方案就失效了'
          }
        ],
        metrics: {
          title: '怎么算"优化对了"',
          html: '<p>单周期预测误差小，不等于累计方案好。一个模型可能把每个周期都预测得很准，但优化器如果只看单周期，仍会把蒸汽分配错。评测要同时看<b>预测层</b>和<b>决策层</b>。</p>' +
            K.figure(figDivergence(), 3, '固定方案（浅橙）与优化方案（绿色）的周期注汽量对比。**优化不是"每周期都少注"**，而是在剩余油多、回报高的前期保持较高注汽，后期主动减汽；固定方案在后期的注汽大部分变成了无效热量。') +
            K.dtable(['指标', '定义', '本例目标'], [
              ['周期产油 MAE', '预测周期产油与实际的绝对误差', '≤ 12%'],
              ['累计油汽比', '累计产油 / 累计注汽', '提升 ≥ 7%'],
              ['累计产油', '固定蒸汽预算下的 8 周期总产油', '提升 ≥ 6%'],
              ['方案可行性', '满足锅炉、套管、出砂约束的周期比例', '100%']
            ])
        },
        fails: [
          { name: '跨周期状态缺失', why: '不把上一周期末的含水、压力、累计注汽放进特征，模型会把周期之间的自然递减误判为参数效果，优化建议会越来越激进。' },
          { name: '单周期贪心', why: '每周期都选当前油汽比最高的参数，前期省下的蒸汽并没有留给后期，累计净油反而下降。必须做多周期联合优化。' },
          { name: '样本少导致的过拟合', why: '单井 10—30 个周期，特征却有十几个。要用跨井 pooling、正则化和分组交叉验证，避免模型记住单井噪声。' },
          { name: '忽略井筒热损失', why: '井深、隔热管状况不同，井底蒸汽干度差异很大。用井口注汽量代替井底热量，会把井筒条件的影响算进参数里。' },
          { name: '优化结果不可执行', why: '数学最优可能要求锅炉超负荷或套管超温。优化必须带硬约束，并由现场人员确认。' }
        ]
      },

      /* ---------- ③ 可运行示范 ---------- */
      demo: {
        label: '可运行示范',
        mount: function (root, ctx) {
          if (typeof window.EorSteamHuffpuffDemo !== 'function') {
            root.innerHTML = '<div class="callout warn"><span class="ci">缺失</span>' +
              '<span>示范脚本未加载：请确认 index.html 中 <b>assets/cases/eor-steam-huffpuff.demo.js</b> 在 shell.js 之前引入。</span></div>';
            return;
          }
          window.EorSteamHuffpuffDemo(root, ctx);
        },
        unmount: function () {
          if (window.EorSteamHuffpuffCleanup) window.EorSteamHuffpuffCleanup();
        }
      }
    }
  });

})();
