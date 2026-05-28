(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────
  var DEBOUNCE_MS = 350;
  var timers  = {};
  var pending = {};

  // ── Money formatter ───────────────────────────────────────
  function money(cents) {
    var val = (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return '$' + val;
  }

  // ── Discount — sessionStorage ─────────────────────────────
  function getDiscount() {
    try { return sessionStorage.getItem('qilin_discount') || ''; } catch (e) { return ''; }
  }
  function saveDiscount(code) {
    try {
      if (code) sessionStorage.setItem('qilin_discount', code);
      else sessionStorage.removeItem('qilin_discount');
    } catch (e) {}
  }

  function setCheckoutUrl(code) {
    var btn = document.getElementById('qc-checkout-btn');
    if (!btn) return;
    btn.href = code ? '/checkout?discount=' + encodeURIComponent(code) : '/checkout';
  }

  function showChip(code) {
    var chip   = document.getElementById('qc-cp-discount-chip');
    var codeEl = document.getElementById('qc-cp-chip-code');
    if (!chip || !codeEl) return;
    codeEl.textContent = code;
    chip.classList.add('is-visible');
    var body   = document.getElementById('qc-cp-discount-body');
    var toggle = document.getElementById('qc-cp-discount-toggle');
    if (body)   { body.classList.remove('is-open'); body.setAttribute('aria-hidden', 'true'); }
    if (toggle) { toggle.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
  }

  function hideChip() {
    var chip  = document.getElementById('qc-cp-discount-chip');
    var input = document.getElementById('qc-cp-discount-input');
    if (chip)  chip.classList.remove('is-visible');
    if (input) input.value = '';
    saveDiscount('');
    setCheckoutUrl('');
  }

  function initDiscount() {
    var code = getDiscount();
    if (code) { showChip(code); setCheckoutUrl(code); }
  }

  // ── AJAX ──────────────────────────────────────────────────
  function postCart(body, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/cart/change.js');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { cb(null, JSON.parse(xhr.responseText)); } catch (e) { cb(e); }
      } else {
        cb(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.onerror = function () { cb(new Error('Network error')); };
    xhr.send(JSON.stringify(body));
  }

  // ── Update page prices after qty change ───────────────────
  function refreshTotals(cart) {
    // Per-line totals + qty displays (scoped to cart page rows)
    (cart.items || []).forEach(function (item, i) {
      var line = i + 1;
      var totalEl = document.querySelector('#qc-cart-rows [data-line-total="' + line + '"]');
      var qtyEl   = document.querySelector('#qc-cart-rows [data-qty="' + line + '"]');
      var decBtn  = document.querySelector('#qc-cart-rows [data-line="' + line + '"][data-direction="-1"]');
      if (totalEl) totalEl.textContent = money(item.line_price);
      if (qtyEl)   qtyEl.textContent   = String(item.quantity);
      if (decBtn)  decBtn.disabled      = item.quantity <= 1;
      // Keep unit price in sync for optimistic updates
      var row = document.getElementById('qc-row-' + line);
      if (row) row.dataset.unitPrice = String(item.price);
    });

    // Summary totals
    var fmt        = money(cart.total_price);
    var subtotalEl = document.getElementById('qc-cart-subtotal');
    var totalEl    = document.getElementById('qc-cart-total');
    var amountEl   = document.getElementById('qc-cp-checkout-amount');
    var subhead    = document.getElementById('qc-cart-subhead');
    if (subtotalEl) subtotalEl.textContent = fmt;
    if (totalEl)    totalEl.textContent    = fmt;
    if (amountEl)   amountEl.textContent   = fmt;
    if (subhead) {
      var c = cart.item_count;
      subhead.textContent = c + ' item' + (c !== 1 ? 's' : '');
    }
  }

  // ── Qty change (debounced AJAX) ───────────────────────────
  function changeQty(line, newQty) {
    var row       = document.getElementById('qc-row-' + line);
    var unitPrice = row ? (parseInt(row.dataset.unitPrice, 10) || 0) : 0;

    // Optimistic update (scoped to cart page rows)
    var qtyEl  = document.querySelector('#qc-cart-rows [data-qty="' + line + '"]');
    var totEl  = document.querySelector('#qc-cart-rows [data-line-total="' + line + '"]');
    var decBtn = document.querySelector('#qc-cart-rows [data-line="' + line + '"][data-direction="-1"]');
    if (qtyEl)  qtyEl.textContent  = String(newQty);
    if (totEl)  totEl.textContent  = money(unitPrice * newQty);
    if (decBtn) decBtn.disabled     = newQty <= 1;

    if (row) row.classList.add('is-updating');

    if (timers[line]) clearTimeout(timers[line]);
    pending[line] = newQty;

    timers[line] = setTimeout(function () {
      var qty = pending[line];
      delete pending[line];
      delete timers[line];

      postCart({ line: line, quantity: qty }, function (err, cart) {
        if (row) row.classList.remove('is-updating');
        if (err) { location.reload(); return; }
        refreshTotals(cart);
      });
    }, DEBOUNCE_MS);
  }

  // ── Remove item ───────────────────────────────────────────
  function removeItem(line) {
    var row = document.getElementById('qc-row-' + line);
    if (!row) return;
    row.classList.add('is-removing');
    // Wait for animation, then POST removal + reload
    setTimeout(function () {
      postCart({ line: line, quantity: 0 }, function () {
        location.reload();
      });
    }, 270);
  }

  // ── Event delegation ──────────────────────────────────────
  document.addEventListener('click', function (e) {

    // Qty stepper buttons — scoped to cart page rows only
    var stepBtn = e.target.closest('[data-line][data-direction]');
    if (stepBtn && !stepBtn.disabled && stepBtn.closest('#qc-cart-rows')) {
      var line = parseInt(stepBtn.dataset.line, 10);
      var dir  = parseInt(stepBtn.dataset.direction, 10);
      var row  = document.getElementById('qc-row-' + line);
      if (!row || row.dataset.isGraded === 'true') return;
      var qtyEl = document.querySelector('#qc-cart-rows [data-qty="' + line + '"]');
      var cur   = qtyEl ? parseInt(qtyEl.textContent, 10) : 1;
      var next  = Math.max(1, cur + dir);
      if (next !== cur) changeQty(line, next);
      return;
    }

    // Remove button — scoped to cart page rows only
    var removeBtn = e.target.closest('[data-action="remove"][data-line]');
    if (removeBtn && removeBtn.closest('#qc-cart-rows')) {
      removeItem(parseInt(removeBtn.dataset.line, 10));
      return;
    }

    // Discount toggle
    if (e.target.closest('#qc-cp-discount-toggle')) {
      var toggle = document.getElementById('qc-cp-discount-toggle');
      var body   = document.getElementById('qc-cp-discount-body');
      if (!body || !toggle) return;
      var open   = body.classList.toggle('is-open');
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      body.setAttribute('aria-hidden', String(!open));
      if (open) {
        var inp = document.getElementById('qc-cp-discount-input');
        if (inp) inp.focus();
      }
      return;
    }

    // Discount apply
    if (e.target.id === 'qc-cp-discount-apply') {
      var code = (document.getElementById('qc-cp-discount-input').value || '').trim().toUpperCase();
      if (!code) return;
      saveDiscount(code);
      showChip(code);
      setCheckoutUrl(code);
      return;
    }

    // Chip remove
    if (e.target.closest('#qc-cp-chip-remove')) {
      hideChip();
    }
  });

  // Discount input: apply on Enter
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'qc-cp-discount-input') {
      var applyBtn = document.getElementById('qc-cp-discount-apply');
      if (applyBtn) applyBtn.click();
    }
  });

  // ── Init ─────────────────────────────────────────────────
  initDiscount();

})();
