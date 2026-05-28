/* =============================================================
   Qilin Cards — Cart Drawer JS
   Exposes: window.QilinCart.open(), .close(), .add()
   ============================================================= */

window.QilinCart = (() => {
  'use strict';

  // ── State ─────────────────────────────────────────────────────
  let discountCode = '';
  try { discountCode = sessionStorage.getItem('qilin_discount') || ''; } catch (_) {}

  // Pending qty updates per line (avoids double-requests on rapid tap)
  const pendingUpdates = {};

  // ── DOM helpers ───────────────────────────────────────────────
  const el  = (id) => document.getElementById(id);
  const els = (sel) => document.querySelectorAll(sel);

  // ── Format money (Shopify uses cents) ─────────────────────────
  function money(cents) {
    const val = (cents / 100).toFixed(2);
    const parts = val.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return '$' + parts.join('.') + ' AUD';
  }

  // ── Open / Close ──────────────────────────────────────────────
  function open() {
    const overlay = el('qc-cart-overlay');
    if (!overlay) return;
    overlay.removeAttribute('aria-hidden');
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    // Focus close button for keyboard/a11y
    requestAnimationFrame(() => { el('qc-cart-close')?.focus(); });
  }

  function close() {
    const overlay = el('qc-cart-overlay');
    if (!overlay) return;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  // ── Fetch helpers ─────────────────────────────────────────────
  async function getCart() {
    const resp = await fetch('/cart.js', { headers: { 'Content-Type': 'application/json' } });
    if (!resp.ok) throw new Error('Failed to fetch cart');
    return resp.json();
  }

  async function postCart(endpoint, body) {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.description || 'Cart request failed');
    }
    return resp.json();
  }

  // ── Add to cart ───────────────────────────────────────────────
  async function add(variantId, quantity, properties) {
    if (!variantId) return;
    quantity = quantity || 1;
    properties = properties || {};

    try {
      await postCart('/cart/add.js', { id: Number(variantId), quantity, properties });
      const cart = await getCart();
      renderCart(cart);
      updateBadge(cart.item_count);
      open();
    } catch (err) {
      console.error('[QilinCart] add error:', err.message);
    }
  }

  // ── Change quantity (debounced per line) ───────────────────────
  function changeQty(line, delta) {
    const lineIndex = parseInt(line, 10);
    const itemEl = el('qc-cart-item-' + lineIndex);
    if (!itemEl) return;

    const displayEl = itemEl.querySelector('.qc-qty__display');
    if (!displayEl) return;

    const current = parseInt(displayEl.textContent, 10);
    const desired = Math.max(0, current + delta);

    // Optimistic UI update
    displayEl.textContent = desired;
    itemEl.classList.add('is-updating');

    // Update stepper button disabled states optimistically
    const decBtn = itemEl.querySelector('[data-direction="-1"]');
    const incBtn = itemEl.querySelector('[data-direction="1"]');
    if (decBtn) decBtn.disabled = desired <= 1;

    // Debounce the API call
    clearTimeout(pendingUpdates[lineIndex]);
    pendingUpdates[lineIndex] = setTimeout(async () => {
      try {
        const cart = await postCart('/cart/change.js', { line: lineIndex, quantity: desired });
        renderCart(cart);
        updateBadge(cart.item_count);
      } catch (err) {
        console.error('[QilinCart] changeQty error:', err.message);
        itemEl.classList.remove('is-updating');
      }
    }, 300);
  }

  // ── Remove item ───────────────────────────────────────────────
  async function removeItem(line) {
    const lineIndex = parseInt(line, 10);
    const itemEl = el('qc-cart-item-' + lineIndex);

    if (itemEl) {
      itemEl.classList.add('is-removing');
      await new Promise(r => setTimeout(r, 250)); // animation
    }

    try {
      const cart = await postCart('/cart/change.js', { line: lineIndex, quantity: 0 });
      renderCart(cart);
      updateBadge(cart.item_count);
    } catch (err) {
      console.error('[QilinCart] removeItem error:', err.message);
      if (itemEl) itemEl.classList.remove('is-removing');
    }
  }

  // ── Update header cart badge ───────────────────────────────────
  function updateBadge(count) {
    els('.qc-cart-badge, [data-cart-count]').forEach(node => {
      node.textContent = count;
      node.hidden = count === 0;
    });
  }

  // ── Render cart from API response ─────────────────────────────
  function renderCart(cart) {
    const itemsView  = el('qc-cart-items');
    const emptyView  = el('qc-cart-empty');
    const footer     = el('qc-cart-footer');
    const countEl    = el('qc-cart-count');
    const subtotalEl = el('qc-subtotal');
    const amountEl   = el('qc-checkout-amount');

    if (countEl)    countEl.textContent    = '(' + cart.item_count + ')';
    if (subtotalEl) subtotalEl.textContent = money(cart.total_price);
    if (amountEl)   amountEl.textContent   = money(cart.total_price);

    if (cart.item_count === 0) {
      if (itemsView) itemsView.style.display = 'none';
      if (emptyView) emptyView.style.display = '';
      if (footer)    footer.style.display    = 'none';
      return;
    }

    if (emptyView) emptyView.style.display = 'none';
    if (footer)    footer.style.display    = '';
    if (!itemsView) return;
    itemsView.style.display = '';
    itemsView.innerHTML = cart.items.map((item, i) => buildItemHTML(item, i + 1)).join('');
  }

  // ── Build item HTML from cart.js item object ──────────────────
  function buildItemHTML(item, lineIndex) {
    const props      = item.properties || {};
    const isGraded   = props._product_type === 'graded';
    const company    = (props._grading_company || '').toUpperCase();
    const grade      = props._grade || '';
    const setName    = props._set_name || '';

    const variantSuffix = (item.variant_title && item.variant_title !== 'Default Title')
      ? ' &mdash; ' + htmlEncode(item.variant_title)
      : '';

    const thumbHTML    = buildThumbHTML(item, isGraded, company, grade);
    const metaHTML     = (setName ? `<span class="badge badge--subtle">${htmlEncode(setName)}</span>` : '') +
                         `<span class="badge badge--cn">CN</span>`;
    const decDisabled  = item.quantity <= 1 ? ' disabled' : '';
    const incDisabled  = isGraded ? ' disabled' : '';

    return `<div class="qc-cart-item${isGraded ? ' qc-cart-item--graded' : ''}"
         id="qc-cart-item-${lineIndex}"
         data-line="${lineIndex}"
         data-unit-price="${item.final_price}">
      <div class="qc-cart-item__thumb${isGraded ? ' qc-cart-item__thumb--portrait' : ''}">
        ${thumbHTML}
      </div>
      <div class="qc-cart-item__details">
        <div class="qc-cart-item__meta">${metaHTML}</div>
        <a href="${htmlEncode(item.url)}" class="qc-cart-item__name">
          ${htmlEncode(item.product_title)}${variantSuffix}
        </a>
        <div class="qc-cart-item__footer">
          <div class="qc-qty qc-qty--sm" role="group" aria-label="Quantity ${htmlEncode(item.product_title)}">
            <button class="qc-qty__btn" data-line="${lineIndex}" data-direction="-1"
              aria-label="Decrease quantity"${decDisabled}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <span class="qc-qty__display" aria-live="polite">${item.quantity}</span>
            <button class="qc-qty__btn" data-line="${lineIndex}" data-direction="1"
              aria-label="Increase quantity"${incDisabled}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
          <span class="qc-cart-item__price">${money(item.final_line_price)}</span>
          <button class="qc-cart-item__remove" data-remove-line="${lineIndex}"
            aria-label="Remove ${htmlEncode(item.product_title)} from cart">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
            Remove
          </button>
        </div>
      </div>
    </div>`;
  }

  function buildThumbHTML(item, isGraded, company, grade) {
    if (item.image) {
      const src = item.image.startsWith('//') ? 'https:' + item.image : item.image;
      const h   = isGraded ? 96 : 72;
      return `<img src="${src}" alt="${htmlEncode(item.title)}" width="72" height="${h}" loading="lazy" class="qc-cart-item__img">`;
    }

    if (isGraded) {
      const lower = (company || 'PSA').toLowerCase();
      const label = company || 'PSA';
      return `<div class="qc-thumb-graded">
        <div class="qc-thumb-graded__slab badge--${lower}">
          <div class="qc-thumb-graded__header">${label}</div>
          <div class="qc-thumb-graded__card">
            <svg width="24" height="34" viewBox="0 0 24 34" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="22" height="32" rx="2" fill="oklch(25% 0.008 270)" stroke="oklch(35% 0.008 270)" stroke-width="1"/>
            </svg>
          </div>
          <div class="qc-thumb-graded__grade">
            <span class="qc-thumb-graded__grade-num">${grade || '10'}</span>
          </div>
        </div>
      </div>`;
    }

    return `<div class="qc-thumb-sealed">
      <div class="qc-thumb-sealed__box">
        <div class="qc-thumb-sealed__face"></div>
      </div>
    </div>`;
  }

  function htmlEncode(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Discount handling ─────────────────────────────────────────
  function applyStoredDiscount() {
    if (!discountCode) return;
    showDiscountChip(discountCode);
    setCheckoutDiscount(discountCode);
  }

  function showDiscountChip(code) {
    const chip    = el('qc-discount-applied');
    const codeEl  = el('qc-discount-code-label');
    const bodyEl  = el('qc-discount-body');
    const toggleEl = el('qc-discount-toggle');
    const inputEl = el('qc-discount-input');

    if (chip)    { chip.style.display = 'flex'; }
    if (codeEl)  codeEl.textContent = code;
    if (inputEl) inputEl.value = '';
    if (bodyEl)  { bodyEl.classList.remove('is-open'); bodyEl.setAttribute('aria-hidden', 'true'); }
    if (toggleEl) { toggleEl.classList.remove('is-open'); toggleEl.setAttribute('aria-expanded', 'false'); }
  }

  function removeDiscountChip() {
    const chip = el('qc-discount-applied');
    if (chip) chip.style.display = 'none';
    discountCode = '';
    try { sessionStorage.removeItem('qilin_discount'); } catch (_) {}
    setCheckoutDiscount('');
  }

  function setCheckoutDiscount(code) {
    const link = el('qc-checkout-link');
    if (!link) return;
    link.href = code
      ? '/checkout?discount=' + encodeURIComponent(code)
      : '/checkout';
  }

  // ── OOS notification form ─────────────────────────────────────
  function initOOSForms() {
    // Toggle expand/collapse for each OOS toggle button on the page
    document.querySelectorAll('[data-oos-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const formId = btn.getAttribute('data-oos-toggle');
        const formEl = document.getElementById(formId);
        if (!formEl) return;

        const isOpen = formEl.classList.toggle('is-open');
        formEl.setAttribute('aria-hidden', String(!isOpen));
        btn.setAttribute('aria-expanded', String(isOpen));

        if (isOpen) {
          const input = formEl.querySelector('input[type="email"]');
          input?.focus();
        }
      });
    });

    // Handle OOS form submits (AJAX to Shopify contact form)
    document.querySelectorAll('[data-oos-form]').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput  = form.querySelector('input[type="email"]');
        const successEl   = form.closest('[data-oos-wrapper]')?.querySelector('[data-oos-success]');
        const submitBtn   = form.querySelector('[type="submit"]');

        if (!emailInput?.value.trim()) {
          emailInput?.focus();
          return;
        }

        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

        try {
          const fd = new FormData(form);
          // Shopify contact endpoint
          await fetch('/contact', { method: 'POST', body: fd });

          form.style.display = 'none';
          if (successEl) {
            const emailDisplay = successEl.querySelector('[data-oos-email]');
            if (emailDisplay) emailDisplay.textContent = emailInput.value.trim();
            successEl.style.display = 'flex';
            successEl.setAttribute('aria-live', 'assertive');
          }
        } catch (err) {
          console.error('[QilinCart] OOS form error:', err.message);
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Notify Me'; }
        }
      });
    });
  }

  // ── Global event delegation ───────────────────────────────────
  function bindGlobalEvents() {
    // ESC closes drawer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });

    // Delegated click handler
    document.addEventListener('click', (e) => {
      const target = e.target;

      // Backdrop click
      if (target.id === 'qc-cart-backdrop') { close(); return; }

      // Close button
      if (target.closest('#qc-cart-close')) { close(); return; }

      // Qty stepper buttons — scoped to drawer items only
      const stepperBtn = target.closest('[data-direction][data-line]');
      if (stepperBtn && !stepperBtn.disabled && stepperBtn.closest('#qc-cart-items')) {
        const line = stepperBtn.dataset.line;
        const dir  = parseInt(stepperBtn.dataset.direction, 10);
        changeQty(line, dir);
        return;
      }

      // Remove button
      const removeBtn = target.closest('[data-remove-line]');
      if (removeBtn) {
        removeItem(removeBtn.dataset.removeLine);
        return;
      }

      // Discount toggle
      if (target.closest('#qc-discount-toggle')) {
        const body   = el('qc-discount-body');
        const toggle = el('qc-discount-toggle');
        if (body && toggle) {
          const isOpen = body.classList.toggle('is-open');
          toggle.classList.toggle('is-open', isOpen);
          toggle.setAttribute('aria-expanded', String(isOpen));
          body.setAttribute('aria-hidden', String(!isOpen));
          if (isOpen) el('qc-discount-input')?.focus();
        }
        return;
      }

      // Discount apply
      if (target.id === 'qc-discount-apply') {
        const inputEl  = el('qc-discount-input');
        const errorEl  = el('qc-discount-error');
        const code     = inputEl?.value.trim().toUpperCase();

        if (errorEl) errorEl.textContent = '';

        if (!code) {
          if (errorEl) errorEl.textContent = 'Please enter a code.';
          inputEl?.focus();
          return;
        }

        discountCode = code;
        try { sessionStorage.setItem('qilin_discount', code); } catch (_) {}
        showDiscountChip(code);
        setCheckoutDiscount(code);
        return;
      }

      // Discount remove
      if (target.closest('#qc-discount-remove')) {
        removeDiscountChip();
        return;
      }
    });

    // Intercept Add to Cart form submits (all forms marked data-atc-form)
    document.addEventListener('submit', (e) => {
      const form = e.target.closest('[data-atc-form]');
      if (!form) return;
      e.preventDefault();

      const variantId  = form.querySelector('[name="id"]')?.value;
      const qtyInput   = form.querySelector('[name="quantity"]');
      const quantity   = qtyInput ? parseInt(qtyInput.value, 10) : 1;

      if (!variantId) return;

      // Collect extra properties (hidden inputs named properties[...])
      const properties = {};
      form.querySelectorAll('input[name^="properties["]').forEach(input => {
        const key = input.name.replace(/^properties\[(.+)\]$/, '$1');
        properties[key] = input.value;
      });

      add(variantId, quantity, properties);
    });
  }

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    applyStoredDiscount();
    initOOSForms();
    bindGlobalEvents();
  }

  document.addEventListener('DOMContentLoaded', init);

  // Public API
  return { open, close, add };
})();
