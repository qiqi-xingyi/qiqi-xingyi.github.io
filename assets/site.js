/* =========================================================
   Site interactions: theme toggle, scroll-reveal, active nav.
   All progressive: nothing here is required to read the page.
   ========================================================= */
(function () {
  'use strict';
  var root = document.documentElement;

  /* ---- Dark / light toggle (remembers choice, else follows system) ---- */
  function currentTheme() {
    var explicit = root.getAttribute('data-theme');
    if (explicit) return explicit;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';
  }
  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  /* ---- Language toggle (static page copy + publication labels) ---- */
  var I18N = {
    en: {
      'meta.title': 'Yuqi Zhang | Quantum Computational Biology',
      'meta.description': 'Yuqi Zhang — PhD student in Quantum Computational Biology at Kent State University and Cleveland Clinic.',
      'nav.about': 'About',
      'nav.research': 'Research',
      'nav.publications': 'Publications',
      'nav.contact': 'Contact',
      'profile.role': 'PhD Student in Quantum Computational Biology',
      'profile.kent': 'Kent State University',
      'profile.clinic': 'Cleveland Clinic',
      'profile.joint': '· Joint PhD',
      'profile.advisor': 'Advisor',
      'profile.coAdvisor': 'Co-Advisor',
      'profile.chipQuantum': 'Quantum Computing',
      'profile.chipDrug': 'Drug Discovery',
      'profile.chipHpc': 'Quantum-HPC Systems',
      'about.title': 'About',
      'about.lede': 'I build quantum computing workflows for biological structure and drug discovery problems.',
      'about.p1': 'I am a PhD student in <strong>Quantum Computational Biology</strong>, working at the intersection of quantum computing and the life sciences. My research bridges quantum algorithms and real-world drug discovery.',
      'about.p2': 'I am jointly affiliated with <strong>Kent State University</strong> (advised by Dr. Qiang Guan) and the <strong>Cleveland Clinic</strong> (co-advised by Dr. Feixiong Cheng). Previously, I was selected for the <strong>2023 Quantum Talents Climbing Program</strong> at SZIQA, mentored by Dr. Juan Yao.',
      'research.title': 'Research Focus',
      'research.intro': 'My work follows a practical path: encode biological problems, execute them on quantum hardware, integrate the results with HPC systems, and evaluate them in drug discovery settings.',
      'research.card1.title': 'Hardware-Executed Quantum Biocomputing',
      'research.card1.body': 'Run biological structure workflows on real quantum processors, with molecular representations and physical constraints kept in the loop.',
      'research.card2.title': 'Quantum Bioinformatics',
      'research.card2.body': 'Represent sequence, structure, conformational states, and interaction patterns in quantum-aware computational models.',
      'research.card3.title': 'Quantum-HPC Co-design',
      'research.card3.body': 'Connect quantum execution, HPC, optimization, post-processing, and data pipelines into scalable scientific systems.',
      'research.card4.title': 'Quantum Drug Discovery',
      'research.card4.body': 'Apply quantum methods to molecular modeling, protein conformations, binding pockets, docking, and ligand response.',
      'pubs.title': 'Selected Publications',
      'pubs.overview': 'Auto-synced from Google Scholar — selected first-author work shown below.',
      'pubs.tag.journal': 'Journal',
      'pubs.tag.conference': 'Conference',
      'pubs.tag.underReview': 'Under Review',
      'pubs.tag.preprint': 'Preprint',
      'ack.title': 'Acknowledgements',
      'ack.p1': 'I am deeply grateful to my advisor <strong>Dr. Qiang Guan</strong>, my co-advisor <strong>Dr. Feixiong Cheng</strong>, and mentors <strong>Dr. Juan Yao</strong> (SZIQA), <strong>Dr. Zhaofeng Su</strong> (USTC), <strong>Dr. Sanjiang Li</strong> (UTS), and <strong>Dr. Yuan Feng</strong> (THU).',
      'ack.p2': 'Special thanks to the 419 Lab team (Hang Yu, Yiyan Cheng, Rongqi Lu, Zhuoqing Xiao, Yongzhi Li, Yao Xiao) and my friend <strong>Haojie Zhang</strong> for guiding me into the quantum world.',
      'contact.title': 'Contact',
      'contact.email': 'Email',
      'contact.lab': 'Lab',
      'contact.github': 'GitHub',
      'contact.orcid': 'ORCID',
      'footer.built': 'Built with GitHub Pages.'
    },
    zh: {
      'meta.title': '张钰奇 | 量子计算生物学',
      'meta.description': '张钰奇 — Kent State University 与 Cleveland Clinic 量子计算生物学博士生。',
      'nav.about': '关于',
      'nav.research': '研究',
      'nav.publications': '论文',
      'nav.contact': '联系',
      'profile.role': '量子计算生物学博士生',
      'profile.kent': '肯特州立大学',
      'profile.clinic': '克利夫兰医学中心',
      'profile.joint': '· 联合培养博士',
      'profile.advisor': '导师',
      'profile.coAdvisor': '联合导师',
      'profile.chipQuantum': '量子计算',
      'profile.chipDrug': '药物发现',
      'profile.chipHpc': '量子-HPC 系统',
      'about.title': '关于',
      'about.lede': '我构建面向生物结构与药物发现问题的量子计算工作流。',
      'about.p1': '我是一名<strong>量子计算生物学</strong>博士生，研究方向位于量子计算与生命科学的交叉领域。我的工作连接量子算法与面向真实药物发现问题的计算流程。',
      'about.p2': '我联合隶属于<strong>肯特州立大学</strong>（导师 Dr. Qiang Guan）与<strong>克利夫兰医学中心</strong>（联合导师 Dr. Feixiong Cheng）。此前，我入选深圳国际量子院 <strong>2023 量子英才攀登计划</strong>，由 Dr. Juan Yao 指导。',
      'research.title': '研究方向',
      'research.intro': '我的研究路径围绕实际应用展开：编码生物问题，在量子硬件上执行，与 HPC 系统集成，并在药物发现任务中评估结果。',
      'research.card1.title': '硬件执行的量子生物计算',
      'research.card1.body': '在真实量子处理器上运行生物结构工作流，并将分子表示与物理约束纳入流程。',
      'research.card2.title': '量子生物信息学',
      'research.card2.body': '用量子感知的计算模型表示序列、结构、构象状态和分子相互作用模式。',
      'research.card3.title': '量子-HPC 协同设计',
      'research.card3.body': '连接量子执行、HPC、优化、后处理和数据流水线，形成可扩展的科学系统。',
      'research.card4.title': '量子药物发现',
      'research.card4.body': '将量子方法用于分子建模、蛋白构象、结合口袋、对接和配体响应预测。',
      'pubs.title': '代表性论文',
      'pubs.overview': '由 Google Scholar 自动同步；下方展示部分第一作者工作。',
      'pubs.tag.journal': '期刊',
      'pubs.tag.conference': '会议',
      'pubs.tag.underReview': '审稿中',
      'pubs.tag.preprint': '预印本',
      'ack.title': '致谢',
      'ack.p1': '衷心感谢我的导师 <strong>Dr. Qiang Guan</strong>、联合导师 <strong>Dr. Feixiong Cheng</strong>，以及 <strong>Dr. Juan Yao</strong>（深圳国际量子院）、<strong>Dr. Zhaofeng Su</strong>（USTC）、<strong>Dr. Sanjiang Li</strong>（UTS）和 <strong>Dr. Yuan Feng</strong>（THU）等前辈的指导。',
      'ack.p2': '特别感谢 419 Lab 团队（Hang Yu、Yiyan Cheng、Rongqi Lu、Zhuoqing Xiao、Yongzhi Li、Yao Xiao）以及朋友 <strong>Haojie Zhang</strong>，感谢他们引导我走进量子世界。',
      'contact.title': '联系',
      'contact.email': '邮箱',
      'contact.lab': '实验室',
      'contact.github': 'GitHub',
      'contact.orcid': 'ORCID',
      'footer.built': '由 GitHub Pages 构建。'
    }
  };

  function storedLang() {
    try { return localStorage.getItem('lang'); } catch (e) { return null; }
  }

  function currentLang() {
    var lang = root.getAttribute('data-lang') || storedLang() || 'en';
    return lang === 'zh' ? 'zh' : 'en';
  }

  function t(lang, key) {
    return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || '';
  }

  function updateLanguageButton(lang) {
    var langToggle = document.getElementById('lang-toggle');
    var label = document.getElementById('lang-toggle-label');
    if (!langToggle || !label) return;
    var toChinese = lang !== 'zh';
    label.textContent = toChinese ? '中文' : 'EN';
    langToggle.setAttribute('aria-label', toChinese ? 'Switch to Chinese' : 'Switch to English');
    langToggle.setAttribute('title', toChinese ? 'Switch to Chinese' : 'Switch to English');
  }

  function applyLang(lang, options) {
    lang = lang === 'zh' ? 'zh' : 'en';
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
    document.title = t(lang, 'meta.title');
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', t(lang, 'meta.description'));

    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (el) {
      var value = t(lang, el.getAttribute('data-i18n'));
      if (value) el.textContent = value;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-html]'), function (el) {
      var value = t(lang, el.getAttribute('data-i18n-html'));
      if (value) el.innerHTML = value;
    });
    updateLanguageButton(lang);
    try { localStorage.setItem('lang', lang); } catch (e) {}
    if (!options || !options.silent) {
      window.dispatchEvent(new CustomEvent('site:langchange', { detail: { lang: lang } }));
    }
  }

  var langToggle = document.getElementById('lang-toggle');
  if (langToggle) {
    langToggle.addEventListener('click', function () {
      applyLang(currentLang() === 'zh' ? 'en' : 'zh');
    });
  }
  applyLang(currentLang(), { silent: true });

  /* ---- Scroll progress bar ---- */
  var progress = document.getElementById('scroll-progress');
  if (progress) {
    var pTick = false;
    function updateProgress() {
      pTick = false;
      var de = document.documentElement;
      var max = de.scrollHeight - de.clientHeight;
      progress.style.width = (max > 0 ? (de.scrollTop / max) * 100 : 0) + '%';
    }
    window.addEventListener('scroll', function () {
      if (!pTick) { pTick = true; requestAnimationFrame(updateProgress); }
    }, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });
    updateProgress();
  }

  /* ---- Scroll-reveal (skipped entirely if IntersectionObserver missing,
          so content never gets stuck hidden) ---- */
  if ('IntersectionObserver' in window) {
    var reveals = document.querySelectorAll(
      '.card, .pub-item, .section-intro, .ack-text, .contact-list'
    );
    if (reveals.length) {
      Array.prototype.forEach.call(reveals, function (el) { el.classList.add('reveal'); });
      var revealIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('is-visible');
            revealIO.unobserve(en.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      Array.prototype.forEach.call(reveals, function (el) { revealIO.observe(el); });
    }
  }

  /* ---- 3D tilt + diagonal gloss reacting to the cursor on the cards ---- */
  if (!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    Array.prototype.forEach.call(document.querySelectorAll('.card'), function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width;
        var py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', ((px - 0.5) * 10).toFixed(2) + 'deg');
        card.style.setProperty('--rx', ((0.5 - py) * 10).toFixed(2) + 'deg');
        card.style.setProperty('--gloss', (px * 100).toFixed(1) + '%');
      });
      card.addEventListener('mouseleave', function () {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ---- Active nav highlight: the last section whose top has passed the
          header line. Reliable at the very top and bottom of the page. ---- */
  (function () {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
    var byId = {}, sections = [];
    links.forEach(function (a) {
      var sec = document.getElementById(a.getAttribute('href').slice(1));
      if (sec) { byId[sec.id] = a; sections.push(sec); }
    });
    if (!sections.length) return;
    var ticking = false;
    function update() {
      ticking = false;
      var current = sections[0];
      sections.forEach(function (sec) {
        if (sec.getBoundingClientRect().top <= 90) current = sec;
      });
      // Near the bottom the last short section can't reach the top line,
      // so pin the final section once the page is scrolled to the end.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = sections[sections.length - 1];
      }
      links.forEach(function (a) { a.classList.remove('active'); });
      if (byId[current.id]) byId[current.id].classList.add('active');
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  })();
})();
