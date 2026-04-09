/* PILA Theme JS */
(function() {
  'use strict';

  /* ── Announcement bar dismiss ── */
  const ann = document.querySelector('.announcement-bar');
  const annClose = document.querySelector('.announcement-bar__close');
  if (ann && annClose) {
    if (sessionStorage.getItem('pila-ann-hidden')) document.body.classList.add('ann-hidden');
    annClose.addEventListener('click', () => {
      document.body.classList.add('ann-hidden');
      sessionStorage.setItem('pila-ann-hidden', '1');
    });
  }

  /* ── Sticky header shadow ── */
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Mobile drawer ── */
  const drawer = document.querySelector('.mobile-drawer');
  const hamburger = document.querySelector('.hamburger');
  const drawerClose = document.querySelector('.drawer-close');
  const drawerOverlay = document.querySelector('.mobile-drawer__overlay');
  const openDrawer = () => { drawer && drawer.classList.add('open'); document.body.style.overflow = 'hidden'; };
  const closeDrawer = () => { drawer && drawer.classList.remove('open'); document.body.style.overflow = ''; };
  hamburger && hamburger.addEventListener('click', openDrawer);
  drawerClose && drawerClose.addEventListener('click', closeDrawer);
  drawerOverlay && drawerOverlay.addEventListener('click', closeDrawer);

  /* ── Mobile sticky CTA — hide on scroll down, show on scroll up ── */
  const ctaBar = document.getElementById('mobileCta');
  if (ctaBar) {
    let lastY = window.scrollY;
    window.addEventListener('scroll', () => {
      const cur = window.scrollY;
      ctaBar.classList.toggle('bar-hidden', cur > lastY && cur > 120);
      lastY = cur;
    }, { passive: true });
  }

  /* ── Product grid filter pills ── */
  document.querySelectorAll('.product-grid__filters').forEach(wrap => {
    const pills = wrap.querySelectorAll('.filter-pill');
    const grid = wrap.closest('[data-product-section]') || wrap.nextElementSibling;
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const filter = pill.dataset.filter;
        if (!grid) return;
        grid.querySelectorAll('.product-card').forEach(card => {
          const sports = (card.dataset.sports || '').split(',').map(s => s.trim());
          card.style.display = (filter === 'all' || sports.includes(filter)) ? '' : 'none';
        });
      });
    });
  });

  /* ── FAQ filter + accordion ── */
  document.querySelectorAll('.faq__wrap').forEach(wrap => {
    const pills = wrap.querySelectorAll('.filter-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const cat = pill.dataset.filter;
        wrap.querySelectorAll('.faq-item').forEach(item => {
          item.classList.toggle('hidden', cat !== 'all' && item.dataset.cat !== cat);
        });
      });
    });
  });

  /* ── Testimonials slider ── */
  document.querySelectorAll('.testimonials__wrap').forEach(wrap => {
    const track = wrap.querySelector('.testimonials__track');
    const cards = Array.from(track ? track.children : []);
    if (cards.length <= 2) return;
    let idx = 0;
    const perPage = window.innerWidth >= 768 ? 2 : 1;
    const update = () => {
      cards.forEach((c, i) => {
        c.style.display = (i >= idx && i < idx + perPage) ? '' : 'none';
      });
    };
    update();
    wrap.querySelector('.slider-btn--prev') && wrap.querySelector('.slider-btn--prev').addEventListener('click', () => {
      idx = Math.max(0, idx - perPage);
      update();
    });
    wrap.querySelector('.slider-btn--next') && wrap.querySelector('.slider-btn--next').addEventListener('click', () => {
      idx = Math.min(cards.length - perPage, idx + perPage);
      update();
    });
  });

})();
