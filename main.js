(function () {
  'use strict';

  var docEl = document.documentElement;
  var body = document.body;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';
  var hasScrollTrigger = typeof window.ScrollTrigger !== 'undefined';

  if (hasGsap && hasScrollTrigger) {
    window.gsap.registerPlugin(window.ScrollTrigger);
  }

  var lenis = null;
  var menuController = null;
  var loaderHidden = false;

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function scrollToTarget(target) {
    if (!target) return;
    if (lenis) {
      lenis.scrollTo(target, { duration: 1.2 });
      return;
    }
    var top = target.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  /* ------------------------------ time ------------------------------ */

  function initTime() {
    var el = $('#local-time');
    if (!el) return;

    function tick() {
      try {
        el.textContent = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(new Date());
      } catch (error) {
        var now = new Date();
        el.textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      }
    }

    tick();
    window.setInterval(tick, 30000);
  }

  /* ------------------------------ header ------------------------------ */

  function initHeader() {
    var header = $('[data-header]');
    if (!header) return;

    function update() {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  /* ------------------------------ progress + rail ------------------------------ */

  function initNavigationUI() {
    var progressBar = $('#progress-bar');
    var railFill = $('#rail-fill');
    var railLinks = $$('[data-rail]');
    var sections = railLinks
      .map(function (link) {
        var id = link.getAttribute('data-rail');
        return { id: id, el: document.getElementById(id), link: link };
      })
      .filter(function (item) { return item.el; });

    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;

      if (progressBar) progressBar.style.transform = 'scaleX(' + ratio + ')';
      if (railFill) railFill.style.transform = 'scaleY(' + ratio + ')';

      if (!sections.length) return;
      var probe = window.scrollY + window.innerHeight * 0.42;
      var current = '';

      sections.forEach(function (item) {
        if (item.el.offsetTop <= probe) current = item.id;
      });

      sections.forEach(function (item) {
        item.link.classList.toggle('is-active', item.id === current);
      });
    }

    var queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        update();
        queued = false;
      });
    }

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  /* ------------------------------ smooth scroll ------------------------------ */

  function initLenis() {
    if (!hasGsap || !window.Lenis) return;

    lenis = new window.Lenis({
      duration: 1.08,
      smoothWheel: true,
      wheelMultiplier: 0.92,
      touchMultiplier: 1.4
    });

    if (hasScrollTrigger) lenis.on('scroll', window.ScrollTrigger.update);

    window.gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });
    window.gsap.ticker.lagSmoothing(0);
  }

  function initAnchors() {
    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (!link) return;
      if (link.closest('.menu') || link.closest('.skip-link')) return;

      var id = link.getAttribute('href');
      if (!id || id === '#') return;

      var target = document.querySelector(id);
      if (!target) return;

      event.preventDefault();

      if (menuController && menuController.isOpen()) {
        menuController.close(function () { scrollToTarget(target); });
      } else {
        scrollToTarget(target);
      }
    });
  }

  /* ------------------------------ split text ------------------------------ */

  function splitChars(el) {
    if (!el) return [];

    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var node;

    while ((node = walker.nextNode())) {
      if (node.textContent.trim()) nodes.push(node);
    }

    nodes.forEach(function (textNode) {
      var fragment = document.createDocumentFragment();
      var chars = Array.from(textNode.textContent);

      chars.forEach(function (character) {
        if (/\s/.test(character)) {
          fragment.appendChild(document.createTextNode(' '));
          return;
        }

        var outer = document.createElement('span');
        outer.className = 'char';
        var inner = document.createElement('span');
        inner.className = 'char-inner';
        inner.textContent = character;
        outer.appendChild(inner);
        fragment.appendChild(outer);
      });

      textNode.parentNode.replaceChild(fragment, textNode);
    });

    return $$('.char-inner', el);
  }

  var heroChars = [];

  function prepareHero() {
    var portrait = $('#portrait-frame');
    if (!portrait) return;

    if (!hasGsap) return;

    heroChars = [];
    $$('[data-split]').forEach(function (line) {
      heroChars = heroChars.concat(splitChars(line));
    });

    window.gsap.set(heroChars, { yPercent: 110 });
    window.gsap.set('[data-hero="eyebrow"]', { autoAlpha: 0, y: 18 });
    window.gsap.set('[data-hero="lede"], [data-hero="actions"]', { autoAlpha: 0, y: 26 });
    window.gsap.set('.hero-portrait', { autoAlpha: 0 });
    window.gsap.set('.hero-foot', { autoAlpha: 0 });
    window.gsap.set(portrait, { clipPath: 'inset(100% 0 0 0)' });
  }

  function playHero() {
    if (!hasGsap) return;

    var gsap = window.gsap;
    var timeline = gsap.timeline({ defaults: { ease: 'power4.out' } });

    timeline
      .to('[data-hero="eyebrow"]', { autoAlpha: 1, y: 0, duration: 0.9 }, 0)
      .to(heroChars, { yPercent: 0, duration: 1.15, stagger: 0.028 }, 0.15)
      .to('.hero-portrait', { autoAlpha: 1, duration: 0.8 }, 0.45)
      .to('#portrait-frame', { clipPath: 'inset(0% 0 0 0)', duration: 1.25, ease: 'power4.inOut' }, 0.45)
      .fromTo('#portrait-frame img', { scale: 1.2 }, { scale: 1, duration: 1.5, ease: 'power3.out' }, 0.45)
      .to('[data-hero="lede"]', { autoAlpha: 1, y: 0, duration: 0.9 }, 0.95)
      .to('[data-hero="actions"]', { autoAlpha: 1, y: 0, duration: 0.9 }, 1.05)
      .to('.hero-foot', { autoAlpha: 1, duration: 0.9 }, 1.15);
  }

  function showStatic() {
    var loader = $('#loader');
    if (loader) loader.style.display = 'none';
    body.classList.remove('is-loading');
    loaderHidden = true;
  }

  /* ------------------------------ loader ------------------------------ */

  function initLoader() {
    var loader = $('#loader');
    if (!loader) return;

    if (reduceMotion || !hasGsap) {
      showStatic();
      return;
    }

    body.classList.add('is-loading');
    var count = $('#loader-count');
    var bar = $('#loader-bar');
    var progress = { value: 0 };

    function updateProgress() {
      var rounded = Math.round(progress.value);
      if (count) count.textContent = String(rounded).padStart(2, '0');
      if (bar) bar.style.transform = 'scaleX(' + progress.value / 100 + ')';
    }

    updateProgress();

    var timeline = window.gsap.timeline();

    timeline
      .to(progress, {
        value: 100,
        duration: 1.55,
        ease: 'power2.inOut',
        onUpdate: updateProgress
      })
      .to('[data-loader-word]', { yPercent: -112, duration: 0.65, ease: 'power4.inOut' }, '+=0.08')
      .to('.loader-sub, .loader-top, .loader-bottom', { autoAlpha: 0, duration: 0.4 }, '<')
      .to(loader, {
        clipPath: 'inset(0 0 100% 0)',
        duration: 0.95,
        ease: 'power4.inOut'
      }, '-=0.28')
      .add(function () {
        loader.style.display = 'none';
        body.classList.remove('is-loading');
        loaderHidden = true;
        playHero();
        if (hasScrollTrigger) window.ScrollTrigger.refresh();
      });

    window.setTimeout(function () {
      if (loaderHidden) return;
      showStatic();
      playHero();
    }, 5000);
  }

  /* ------------------------------ field canvas ------------------------------ */

  function initField() {
    var canvas = $('#field');
    if (!canvas) return;

    var context = canvas.getContext('2d');
    if (!context) return;

    var hero = canvas.closest('.hero');
    var width = 0;
    var height = 0;
    var dpr = 1;
    var points = [];
    var mouse = { x: -999, y: -999, tx: -999, ty: -999 };
    var time = 0;
    var raf = null;
    var running = false;
    var visible = true;

    function build() {
      points = [];
      var gap = width < 700 ? 46 : 54;
      var cols = Math.ceil(width / gap) + 2;
      var rows = Math.ceil(height / gap) + 2;

      for (var row = 0; row < rows; row += 1) {
        for (var col = 0; col < cols; col += 1) {
          points.push({
            x: col * gap,
            y: row * gap,
            col: col,
            row: row
          });
        }
      }
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      if (reduceMotion) draw(true);
    }

    function draw(once) {
      if (!width || !height) return;

      time += 0.008;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;

      context.clearRect(0, 0, width, height);

      for (var i = 0; i < points.length; i += 1) {
        var point = points[i];
        var wave = Math.sin(point.col * 0.42 + time * 1.7) * Math.cos(point.row * 0.34 - time * 1.2) * 5;
        var dx = point.x - mouse.x;
        var dy = point.y - mouse.y;
        var distance = Math.sqrt(dx * dx + dy * dy);
        var force = Math.max(0, 1 - distance / 180);
        var offsetX = (dx / (distance || 1)) * force * 24;
        var offsetY = (dy / (distance || 1)) * force * 24;
        var x = point.x + wave + offsetX;
        var y = point.y + wave * 0.7 + offsetY;
        var alpha = 0.1 + force * 0.6;
        var radius = force > 0.05 ? 1.8 : (point.col % 9 === 0 && point.row % 9 === 0 ? 1.6 : 1);

        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = 'rgba(200, 242, 78, ' + alpha.toFixed(3) + ')';
        context.fill();

        if (point.col % 8 === 0 && point.row % 8 === 0) {
          context.beginPath();
          context.arc(x, y, 2.4, 0, Math.PI * 2);
          context.strokeStyle = 'rgba(238, 241, 232, 0.08)';
          context.lineWidth = 1;
          context.stroke();
        }
      }

      if (!once && running) raf = window.requestAnimationFrame(draw);
    }

    function start() {
      if (running || reduceMotion) return;
      running = true;
      raf = window.requestAnimationFrame(draw);
    }

    function stop() {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = null;
    }

    if (hero) {
      hero.addEventListener('mousemove', function (event) {
        var rect = canvas.getBoundingClientRect();
        mouse.tx = event.clientX - rect.left;
        mouse.ty = event.clientY - rect.top;
      });

      hero.addEventListener('mouseleave', function () {
        mouse.tx = -999;
        mouse.ty = -999;
      });
    }

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 180);
    });

    if ('IntersectionObserver' in window && hero) {
      var observer = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && !reduceMotion) start();
        else stop();
      }, { threshold: 0.02 });
      observer.observe(hero);
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else if (visible) start();
    });

    resize();
    if (!reduceMotion) start();
  }

  /* ------------------------------ cursor ------------------------------ */

  function initCursor() {
    if (!finePointer || reduceMotion) return;

    var cursor = $('#cursor');
    var label = $('#cursor-label');
    if (!cursor) return;

    docEl.classList.add('has-cursor');

    var currentX = window.innerWidth / 2;
    var currentY = window.innerHeight / 2;
    var targetX = currentX;
    var targetY = currentY;
    var raf = null;

    function loop() {
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;
      cursor.style.transform = 'translate3d(' + currentX + 'px, ' + currentY + 'px, 0)';
      raf = window.requestAnimationFrame(loop);
    }

    loop();

    document.addEventListener('mousemove', function (event) {
      targetX = event.clientX;
      targetY = event.clientY;
      cursor.classList.add('is-visible');
    });

    document.addEventListener('mouseleave', function () {
      cursor.classList.remove('is-visible');
    });

    function bind(el) {
      el.addEventListener('mouseenter', function () {
        var text = el.getAttribute('data-cursor');
        if (label) label.textContent = text || '';
        cursor.classList.add('is-hover');
        cursor.classList.toggle('has-label', Boolean(text));
      });
      el.addEventListener('mouseleave', function () {
        cursor.classList.remove('is-hover');
        cursor.classList.remove('has-label');
      });
    }

    $$('a, button').forEach(bind);
    $$('[data-cursor]').forEach(function (el) {
      if (el.tagName !== 'A' && el.tagName !== 'BUTTON') bind(el);
    });

    window.addEventListener('blur', function () {
      cursor.classList.remove('is-visible');
    });
  }

  /* ------------------------------ magnetic ------------------------------ */

  function initMagnetic() {
    if (!finePointer || reduceMotion || !hasGsap) return;

    $$('[data-magnetic]').forEach(function (el) {
      var strength = parseFloat(el.getAttribute('data-magnetic')) || 0.3;

      el.addEventListener('mousemove', function (event) {
        var rect = el.getBoundingClientRect();
        var x = (event.clientX - (rect.left + rect.width / 2)) * strength;
        var y = (event.clientY - (rect.top + rect.height / 2)) * strength;
        window.gsap.to(el, { x: x, y: y, duration: 0.4, ease: 'power2.out' });
      });

      el.addEventListener('mouseleave', function () {
        window.gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
      });
    });
  }

  /* ------------------------------ menu ------------------------------ */

  function initMenu() {
    var button = $('#menu-btn');
    var menu = $('#menu');
    if (!button || !menu) return;

    var words = $$('.menu-word');
    var side = $('.menu-col--side', menu);
    var isOpen = false;
    var animate = hasGsap && !reduceMotion;

    if (animate) window.gsap.set(words, { yPercent: 110 });

    function open() {
      if (isOpen) return;
      isOpen = true;
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
      button.setAttribute('aria-expanded', 'true');
      body.classList.add('menu-open');
      if (lenis) lenis.stop();

      if (animate) {
        window.gsap.to(words, {
          yPercent: 0,
          duration: 0.9,
          stagger: 0.055,
          ease: 'power4.out',
          delay: 0.12
        });
        if (side) {
          window.gsap.fromTo(side, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.7, delay: 0.3 });
        }
      }

      var first = $('.menu-link', menu);
      if (first) window.setTimeout(function () { first.focus(); }, 400);
    }

    function close(after) {
      if (!isOpen) {
        if (after) after();
        return;
      }
      isOpen = false;
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      button.setAttribute('aria-expanded', 'false');
      if (lenis) lenis.start();

      if (animate) {
        window.gsap.to(words, { yPercent: 110, duration: 0.4, ease: 'power3.in' });
        if (side) window.gsap.to(side, { autoAlpha: 0, duration: 0.25 });
      }

      window.setTimeout(function () {
        body.classList.remove('menu-open');
        if (after) after();
      }, animate ? 620 : 60);
    }

    button.addEventListener('click', function () {
      if (isOpen) close();
      else open();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen) {
        close();
        button.focus();
      }
    });

    $$('.menu-link', menu).forEach(function (link) {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        var target = document.querySelector(link.getAttribute('href'));
        close(function () { scrollToTarget(target); });
      });
    });

    menuController = { open: open, close: close, isOpen: function () { return isOpen; } };
  }

  /* ------------------------------ reveals ------------------------------ */

  function initReveals() {
    if (!hasGsap || !hasScrollTrigger) return;

    var gsap = window.gsap;

    $$('[data-reveal]').forEach(function (el) {
      gsap.from(el, {
        autoAlpha: 0,
        y: 34,
        duration: 1.05,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });

    $$('.section-top').forEach(function (el) {
      gsap.from(el, {
        autoAlpha: 0,
        y: 18,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true }
      });
    });

    ['.work-title', '.stack-title', '.trajectory-title'].forEach(function (selector) {
      $$(selector).forEach(function (el) {
        gsap.from(el, {
          clipPath: 'inset(0 0 100% 0)',
          y: 40,
          duration: 1.2,
          ease: 'power4.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        });
      });
    });

    $$('.statement-line').forEach(function (el) {
      gsap.from(el, {
        clipPath: 'inset(0 0 100% 0)',
        y: 50,
        duration: 1.2,
        ease: 'power4.out',
        scrollTrigger: { trigger: '.statement', start: 'top 82%', once: true }
      });
    });

    $$('.contact-line').forEach(function (el, index) {
      gsap.from(el, {
        clipPath: 'inset(0 0 100% 0)',
        y: 60,
        duration: 1.3,
        delay: index * 0.1,
        ease: 'power4.out',
        scrollTrigger: { trigger: '.contact-title', start: 'top 85%', once: true }
      });
    });

    $$('.cert-row').forEach(function (el) {
      gsap.from(el, {
        autoAlpha: 0,
        y: 20,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 93%', once: true }
      });
    });

    if ($('.about-media')) {
      gsap.to('.about-media img', {
        yPercent: -6,
        ease: 'none',
        scrollTrigger: {
          trigger: '.about-media',
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    }

    gsap.to('.hero-portrait', {
      yPercent: 7,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });
  }

  /* ------------------------------ projects ------------------------------ */

  function initProjects() {
    if (!hasGsap || !hasScrollTrigger) return;

    var gsap = window.gsap;

    $$('.project').forEach(function (section, index) {
      var frame = $('.visual-frame', section);
      var word = $('.project-word', section);
      var copyChildren = $$('.project-copy > *', section);

      if (frame) {
        gsap.fromTo(frame, {
          clipPath: 'inset(12% 12% 12% 12%)',
          y: 44
        }, {
          clipPath: 'inset(0% 0% 0% 0%)',
          y: 0,
          duration: 1.25,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 72%', once: true }
        });

        gsap.to(frame, {
          scale: 1.018,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: 'bottom top',
            scrub: true
          }
        });
      }

      if (word) {
        gsap.fromTo(word, {
          xPercent: index % 2 === 0 ? -7 : 7
        }, {
          xPercent: index % 2 === 0 ? 5 : -5,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true
          }
        });
      }

      if (copyChildren.length) {
        gsap.from(copyChildren, {
          autoAlpha: 0,
          y: 32,
          duration: 0.9,
          stagger: 0.075,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 58%', once: true }
        });
      }

      var score = $('.score-progress', section);
      if (score) {
        var value = parseFloat(score.getAttribute('data-score')) || 86;
        gsap.fromTo(score, { strokeDashoffset: 100 }, {
          strokeDashoffset: 100 - value,
          duration: 1.6,
          ease: 'power2.out',
          scrollTrigger: { trigger: score, start: 'top 86%', once: true }
        });
      }

      var fund = $('.fund-fill', section);
      if (fund) {
        gsap.from(fund, {
          scaleX: 0,
          duration: 1.4,
          ease: 'power3.out',
          scrollTrigger: { trigger: fund, start: 'top 88%', once: true }
        });
      }

      var bars = $$('.bars span', section);
      if (bars.length) {
        gsap.from(bars, {
          scaleY: 0,
          transformOrigin: 'bottom center',
          duration: 1,
          stagger: 0.06,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.bars', start: 'top 88%', once: true }
        });
      }

      var logs = $$('.logs p', section);
      if (logs.length) {
        gsap.from(logs, {
          autoAlpha: 0,
          x: -6,
          duration: 0.6,
          stagger: 0.1,
          delay: 0.3,
          ease: 'power2.out',
          scrollTrigger: { trigger: section, start: 'top 62%', once: true }
        });
      }

      var chips = $$('.agent-chip, .backer', section);
      if (chips.length) {
        gsap.from(chips, {
          autoAlpha: 0,
          y: 8,
          duration: 0.6,
          stagger: 0.05,
          delay: 0.4,
          scrollTrigger: { trigger: section, start: 'top 62%', once: true }
        });
      }
    });
  }

  /* ------------------------------ tilt ------------------------------ */

  function initTilt() {
    if (!finePointer || reduceMotion || !hasGsap) return;

    $$('.project-visual').forEach(function (area) {
      var mockup = $('.mockup', area);
      if (!mockup) return;

      area.addEventListener('mousemove', function (event) {
        var rect = area.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width - 0.5;
        var y = (event.clientY - rect.top) / rect.height - 0.5;
        window.gsap.to(mockup, {
          rotateY: x * 5,
          rotateX: -y * 4,
          transformPerspective: 1100,
          duration: 0.6,
          ease: 'power3.out'
        });
      });

      area.addEventListener('mouseleave', function () {
        window.gsap.to(mockup, {
          rotateX: 0,
          rotateY: 0,
          duration: 0.9,
          ease: 'power3.out'
        });
      });
    });
  }

  /* ------------------------------ copy email ------------------------------ */

  function initCopyEmail() {
    var button = $('#copy-email');
    var label = $('#copy-label');
    if (!button || !label) return;

    var email = 'shivang.c2004@gmail.com';
    var resetTimer = null;

    function reset() {
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(function () {
        label.textContent = 'Copy email';
      }, 2200);
    }

    function fallbackCopy() {
      var field = document.createElement('textarea');
      field.value = email;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      var copied = false;
      try {
        copied = document.execCommand('copy');
      } catch (error) {
        copied = false;
      }
      field.remove();
      label.textContent = copied ? 'Copied' : 'Copy failed';
      reset();
    }

    button.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(function () {
          label.textContent = 'Copied';
          reset();
        }).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
    });
  }

  /* ------------------------------ init ------------------------------ */

  function init() {
    initTime();
    initHeader();
    initNavigationUI();
    initField();
    initAnchors();
    initCopyEmail();
    initMenu();

    if (!reduceMotion && hasGsap) {
      initLenis();
      prepareHero();
      if (hasScrollTrigger) {
        initReveals();
        initProjects();
      }
      initCursor();
      initMagnetic();
      initTilt();
      initLoader();
    } else {
      showStatic();
    }

    if (hasScrollTrigger) {
      window.addEventListener('load', function () {
        window.ScrollTrigger.refresh();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
