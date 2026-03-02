/**
 * Vault TCG — Theme JavaScript
 * Features: AJAX cart, cart drawer, quick view, mobile nav,
 *           search overlay, gallery thumbnails, quantity controls,
 *           variant selects, sticky header, scroll animations.
 */

'use strict';

/* ========================================================================
   UTILITIES
   ======================================================================== */

const utils = {
  /** Fetch JSON from a URL */
  async fetchJSON(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      ...options
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /** Format money in cents to display string */
  formatMoney(cents) {
    const value = (cents / 100).toFixed(2);
    return '$' + value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  /** Debounce a function */
  debounce(fn, ms = 300) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  },

  /** Trap focus within an element */
  trapFocus(element) {
    const focusable = element.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const handleKeydown = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    element.addEventListener('keydown', handleKeydown);
    if (first) first.focus();
    return () => element.removeEventListener('keydown', handleKeydown);
  }
};


/* ========================================================================
   CART STATE — Single source of truth
   ======================================================================== */

const CartState = {
  _cart: null,
  _listeners: [],

  subscribe(fn) { this._listeners.push(fn); },

  notify() { this._listeners.forEach(fn => fn(this._cart)); },

  async refresh() {
    this._cart = await utils.fetchJSON('/cart.js');
    this.notify();
    return this._cart;
  },

  async add(id, quantity = 1) {
    this._cart = await utils.fetchJSON('/cart/add.js', {
      method: 'POST',
      body: JSON.stringify({ id, quantity })
    });
    return this.refresh();
  },

  async change(line, quantity) {
    this._cart = await utils.fetchJSON('/cart/change.js', {
      method: 'POST',
      body: JSON.stringify({ line, quantity })
    });
    this.notify();
    return this._cart;
  },

  async remove(line) {
    return this.change(line, 0);
  }
};


/* ========================================================================
   CART DRAWER
   ======================================================================== */

class CartDrawer {
  constructor() {
    this.drawer = document.querySelector('[data-cart-drawer]');
    if (!this.drawer) return;

    this.body = this.drawer.querySelector('[data-cart-drawer-body]');
    this.footer = this.drawer.querySelector('[data-cart-drawer-footer]');
    this.countEl = this.drawer.querySelector('[data-cart-drawer-count]');
    this.totalEl = this.drawer.querySelector('[data-cart-drawer-total]');
    this.shippingProgress = this.drawer.querySelector('[data-shipping-progress]');
    this.shippingText = this.drawer.querySelector('[data-shipping-bar] .cart-drawer__shipping-text');
    this.overlay = document.getElementById('overlay');
    this.removeFocusTrap = null;

    this.bindEvents();
    CartState.subscribe((cart) => this.render(cart));
  }

  open() {
    this.drawer.classList.add('is-active');
    this.drawer.setAttribute('aria-hidden', 'false');
    this.overlay?.classList.add('is-active');
    document.body.classList.add('no-scroll');
    this.removeFocusTrap = utils.trapFocus(this.drawer);
  }

  close() {
    this.drawer.classList.remove('is-active');
    this.drawer.setAttribute('aria-hidden', 'true');
    this.overlay?.classList.remove('is-active');
    document.body.classList.remove('no-scroll');
    if (this.removeFocusTrap) { this.removeFocusTrap(); this.removeFocusTrap = null; }
  }

  bindEvents() {
    // Toggle open
    document.querySelectorAll('[data-cart-toggle]').forEach(btn => {
      btn.addEventListener('click', () => this.open());
    });

    // Close
    this.drawer.querySelector('[data-cart-drawer-close]')?.addEventListener('click', () => this.close());
    this.overlay?.addEventListener('click', () => this.close());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });

    // Qty controls inside drawer
    this.drawer.addEventListener('click', async (e) => {
      const minusBtn = e.target.closest('[data-drawer-qty-minus]');
      const plusBtn = e.target.closest('[data-drawer-qty-plus]');
      const removeBtn = e.target.closest('[data-drawer-remove]');

      if (minusBtn) {
        const line = parseInt(minusBtn.dataset.line);
        const item = this.drawer.querySelector(`[data-line="${line}"] [data-drawer-qty-value]`);
        const qty = Math.max(0, parseInt(item?.textContent || 1) - 1);
        await CartState.change(line, qty);
      }

      if (plusBtn) {
        const line = parseInt(plusBtn.dataset.line);
        const item = this.drawer.querySelector(`[data-line="${line}"] [data-drawer-qty-value]`);
        const qty = parseInt(item?.textContent || 1) + 1;
        await CartState.change(line, qty);
      }

      if (removeBtn) {
        const line = parseInt(removeBtn.dataset.line);
        await CartState.remove(line);
      }
    });
  }

  render(cart) {
    if (!cart) return;

    // Update header cart count
    document.querySelectorAll('[data-cart-count]').forEach(el => {
      el.textContent = cart.item_count;
    });

    if (this.countEl) this.countEl.textContent = `(${cart.item_count})`;
    if (this.totalEl) this.totalEl.textContent = utils.formatMoney(cart.total_price);

    // Update shipping progress bar
    if (this.shippingProgress && window.cartFreeShippingThreshold) {
      const threshold = window.cartFreeShippingThreshold * 100;
      const remaining = Math.max(0, threshold - cart.total_price);
      const progress = Math.min(100, (cart.total_price / threshold) * 100);
      this.shippingProgress.style.width = `${progress}%`;

      if (this.shippingText) {
        if (remaining > 0) {
          this.shippingText.innerHTML = `You're <strong>${utils.formatMoney(remaining)}</strong> away from free shipping!`;
          this.shippingText.classList.remove('cart-drawer__shipping-text--success');
        } else {
          this.shippingText.innerHTML = '🎉 You\'ve unlocked free shipping!';
          this.shippingText.classList.add('cart-drawer__shipping-text--success');
        }
      }
    }

    // Re-render items
    if (this.body) {
      if (cart.item_count === 0) {
        this.body.innerHTML = `
          <div class="cart-drawer__empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="1">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            <p>Your cart is empty</p>
            <a href="/collections/all" class="btn btn--primary">Start Shopping</a>
          </div>`;
        if (this.footer) this.footer.style.display = 'none';
      } else {
        this.body.innerHTML = `<div class="cart-drawer__items">${cart.items.map((item, i) => this.renderItem(item, i + 1)).join('')}</div>`;
        if (this.footer) this.footer.style.display = '';
        if (this.totalEl) this.totalEl.textContent = utils.formatMoney(cart.total_price);
      }
    }
  }

  renderItem(item, line) {
    const image = item.image
      ? `<img src="${item.image.replace('http:', 'https:').replace(/(\.\w+)$/, '_80x80$1')}" alt="${item.title}" width="64" height="64" loading="lazy">`
      : '';
    const variant = item.variant_title && item.variant_title !== 'Default Title'
      ? `<p class="cart-drawer__item-variant">${item.variant_title}</p>` : '';

    return `
      <div class="cart-drawer__item" data-line="${line}">
        <a href="${item.url}" class="cart-drawer__item-image">${image}</a>
        <div class="cart-drawer__item-details">
          <a href="${item.url}" class="cart-drawer__item-title">${item.product_title}</a>
          ${variant}
          <div class="cart-drawer__item-bottom">
            <div class="cart-drawer__item-qty">
              <button type="button" class="qty-btn qty-btn--small" data-drawer-qty-minus data-line="${line}" aria-label="Decrease">−</button>
              <span class="cart-drawer__item-qty-value" data-drawer-qty-value>${item.quantity}</span>
              <button type="button" class="qty-btn qty-btn--small" data-drawer-qty-plus data-line="${line}" aria-label="Increase">+</button>
            </div>
            <span class="cart-drawer__item-price">${utils.formatMoney(item.final_line_price)}</span>
          </div>
        </div>
        <button class="cart-drawer__item-remove" data-drawer-remove data-line="${line}" aria-label="Remove ${item.title}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>`;
  }
}


/* ========================================================================
   ADD TO CART — handles all add-to-cart forms
   ======================================================================== */

class AddToCart {
  constructor() {
    document.addEventListener('submit', (e) => {
      const form = e.target.closest('[data-add-to-cart-form]');
      if (!form) return;
      e.preventDefault();
      this.handleSubmit(form);
    });

    // Also handle button click (for product cards with hidden form)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-add-to-cart]');
      if (!btn) return;
      const form = btn.closest('[data-add-to-cart-form]');
      if (form) { e.preventDefault(); this.handleSubmit(form); }
    });
  }

  async handleSubmit(form) {
    const btn = form.querySelector('[data-add-to-cart]');
    const id = form.querySelector('[name="id"]')?.value;
    const quantity = parseInt(form.querySelector('[name="quantity"]')?.value || '1');

    if (!id) return;

    this.setLoading(btn, true);

    try {
      await CartState.add(id, quantity);
      this.setSuccess(btn);

      // Open cart drawer if enabled
      const drawer = document.querySelector('[data-cart-drawer]');
      if (drawer) {
        // Small delay so success state is visible
        setTimeout(() => {
          window.cartDrawer?.open();
        }, 400);
      }
    } catch (err) {
      console.error('Add to cart error:', err);
      this.setError(btn);
    } finally {
      setTimeout(() => this.setLoading(btn, false), 1200);
    }
  }

  setLoading(btn, loading) {
    if (!btn) return;
    btn.classList.toggle('is-loading', loading);
    btn.disabled = loading;
  }

  setSuccess(btn) {
    if (!btn) return;
    const textEl = btn.querySelector('[data-add-to-cart-text]');
    const original = textEl?.textContent;
    if (textEl) textEl.textContent = '✓ Added!';
    setTimeout(() => { if (textEl && original) textEl.textContent = original; }, 1500);
  }

  setError(btn) {
    if (!btn) return;
    const textEl = btn.querySelector('[data-add-to-cart-text]');
    const original = textEl?.textContent;
    if (textEl) textEl.textContent = 'Error — try again';
    setTimeout(() => { if (textEl && original) textEl.textContent = original; }, 2000);
  }
}


/* ========================================================================
   QUICK VIEW
   ======================================================================== */

class QuickView {
  constructor() {
    this.modal = document.querySelector('[data-quick-view-modal]');
    if (!this.modal) return;

    this.content = this.modal.querySelector('[data-quick-view-content]');
    this.removeFocusTrap = null;

    this.bindEvents();
  }

  open() {
    this.modal.classList.add('is-active');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    this.removeFocusTrap = utils.trapFocus(this.modal);
  }

  close() {
    this.modal.classList.remove('is-active');
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    if (this.removeFocusTrap) { this.removeFocusTrap(); this.removeFocusTrap = null; }
    if (this.content) {
      this.content.innerHTML = `
        <div class="quick-view__loading">
          <svg width="32" height="32" viewBox="0 0 24 24" class="spinner">
            <circle cx="12" cy="12" r="10" fill="none" stroke="var(--color-primary)" stroke-width="3" stroke-dasharray="30 60"/>
          </svg>
        </div>`;
    }
  }

  async loadProduct(url) {
    try {
      const res = await fetch(`${url}?view=quick-view`);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');

      // Try to get product section, fallback to building from product JSON
      const productSection = doc.querySelector('.product-page') || doc.querySelector('main');

      if (productSection && this.content) {
        this.content.innerHTML = '';
        this.content.appendChild(productSection.cloneNode(true));
        // Re-init gallery within modal
        initGallery(this.content);
        initQuantityControls(this.content);
      } else {
        // Fallback: fetch product JSON
        const productJSON = await utils.fetchJSON(`${url}.js`);
        this.renderFromJSON(productJSON);
      }
    } catch (err) {
      if (this.content) {
        this.content.innerHTML = `<p style="padding:24px;text-align:center">Could not load product. <a href="${url}">View product page</a></p>`;
      }
    }
  }

  renderFromJSON(product) {
    if (!this.content) return;
    const variant = product.variants[0];
    const price = utils.formatMoney(product.price);
    const comparePrice = product.compare_at_price > product.price
      ? `<span class="product-page__price-compare">${utils.formatMoney(product.compare_at_price)}</span>` : '';

    this.content.innerHTML = `
      <div class="featured-product">
        <div class="featured-product__gallery">
          <div class="featured-product__main-image">
            ${product.featured_image ? `<img src="${product.featured_image}" alt="${product.title}" style="width:100%;border-radius:12px">` : ''}
          </div>
        </div>
        <div class="featured-product__info">
          <h2 class="featured-product__title">${product.title}</h2>
          <div class="featured-product__price">
            <span class="featured-product__price-sale">${price}</span>
            ${comparePrice}
          </div>
          <form method="post" action="/cart/add" data-add-to-cart-form>
            <input type="hidden" name="id" value="${variant.id}">
            <input type="hidden" name="quantity" value="1">
            <div class="featured-product__actions">
              <div class="featured-product__quantity">
                <button type="button" class="qty-btn" data-qty-minus aria-label="Decrease">−</button>
                <input type="number" name="quantity" value="1" min="1" class="qty-input" data-qty-input aria-label="Quantity">
                <button type="button" class="qty-btn" data-qty-plus aria-label="Increase">+</button>
              </div>
              <button type="submit" class="btn btn--primary btn--large featured-product__add-btn" data-add-to-cart>
                <span data-add-to-cart-text>Add to Cart — ${price}</span>
                <span class="btn__spinner" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="30 60"/></svg>
                </span>
              </button>
            </div>
          </form>
          <div style="margin-top:16px">
            <a href="${product.url}" class="btn btn--outline">View Full Details →</a>
          </div>
        </div>
      </div>`;

    initQuantityControls(this.content);
  }

  bindEvents() {
    // Open via data-quick-view attribute
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-quick-view]');
      if (!btn) return;
      e.preventDefault();
      const url = btn.dataset.quickView;
      this.open();
      await this.loadProduct(url);
    });

    // Close
    this.modal.querySelectorAll('[data-quick-view-close]').forEach(el => {
      el.addEventListener('click', () => this.close());
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('is-active')) this.close();
    });
  }
}


/* ========================================================================
   MOBILE NAVIGATION
   ======================================================================== */

class MobileNav {
  constructor() {
    this.nav = document.querySelector('[data-mobile-nav]');
    this.overlay = document.getElementById('overlay');
    if (!this.nav) return;
    this.bindEvents();
  }

  open() {
    this.nav.classList.add('is-active');
    this.nav.setAttribute('aria-hidden', 'false');
    this.overlay?.classList.add('is-active');
    document.body.classList.add('no-scroll');
  }

  close() {
    this.nav.classList.remove('is-active');
    this.nav.setAttribute('aria-hidden', 'true');
    this.overlay?.classList.remove('is-active');
    document.body.classList.remove('no-scroll');
  }

  bindEvents() {
    document.querySelectorAll('[data-mobile-menu-toggle]').forEach(btn => {
      btn.addEventListener('click', () => this.open());
    });

    document.querySelectorAll('[data-mobile-menu-close]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    this.overlay?.addEventListener('click', () => this.close());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }
}


/* ========================================================================
   SEARCH OVERLAY
   ======================================================================== */

class SearchOverlay {
  constructor() {
    this.overlay = document.querySelector('[data-search-overlay]');
    if (!this.overlay) return;
    this.input = this.overlay.querySelector('.search-overlay__input');
    this.bindEvents();
  }

  open() {
    this.overlay.classList.add('is-active');
    this.overlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => this.input?.focus(), 100);
  }

  close() {
    this.overlay.classList.remove('is-active');
    this.overlay.setAttribute('aria-hidden', 'true');
  }

  bindEvents() {
    document.querySelectorAll('[data-search-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.overlay.classList.contains('is-active') ? this.close() : this.open();
      });
    });

    document.querySelectorAll('[data-search-close]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }
}


/* ========================================================================
   PRODUCT GALLERY — thumbnail navigation
   ======================================================================== */

function initGallery(scope = document) {
  scope.querySelectorAll('[data-product-gallery]').forEach(gallery => {
    const slides = gallery.querySelectorAll('[data-image-slide]');
    const thumbContainer = gallery.closest('.featured-product__gallery, .product-page__gallery');
    const thumbs = thumbContainer?.querySelectorAll('[data-thumb-index]');

    if (!slides.length) return;

    const goTo = (index) => {
      slides.forEach((s, i) => s.classList.toggle('is-active', i === index));
      thumbs?.forEach((t, i) => t.classList.toggle('is-active', i === index));
    };

    thumbs?.forEach(thumb => {
      thumb.addEventListener('click', () => goTo(parseInt(thumb.dataset.thumbIndex)));
    });
  });
}


/* ========================================================================
   QUANTITY CONTROLS
   ======================================================================== */

function initQuantityControls(scope = document) {
  scope.addEventListener('click', (e) => {
    const minus = e.target.closest('[data-qty-minus]');
    const plus = e.target.closest('[data-qty-plus]');

    if (minus) {
      const input = minus.closest('.featured-product__quantity, .product-page__quantity')
        ?.querySelector('[data-qty-input]');
      if (input) {
        const val = Math.max(parseInt(input.min) || 1, parseInt(input.value) - 1);
        input.value = val;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    if (plus) {
      const input = plus.closest('.featured-product__quantity, .product-page__quantity')
        ?.querySelector('[data-qty-input]');
      if (input) {
        input.value = parseInt(input.value) + 1;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });
}


/* ========================================================================
   VARIANT SELECTOR — product page
   ======================================================================== */

class VariantSelector {
  constructor() {
    document.querySelectorAll('[data-product-form]').forEach(form => {
      this.initForm(form);
    });
  }

  initForm(form) {
    const optionSelects = form.querySelectorAll('[data-option-index]');
    const variantSelect = form.querySelector('[data-variant-select]');
    const priceEl = form.closest('.product-page__info')?.querySelector('.product-page__price');
    const addBtn = form.querySelector('[data-add-to-cart-text]');

    if (!variantSelect || !optionSelects.length) return;

    const updateVariant = () => {
      const selectedOptions = Array.from(optionSelects).map(s => s.value);

      // Find matching variant option in the hidden select
      const matchingOption = Array.from(variantSelect.options).find(opt => {
        const variantData = opt.textContent;
        return selectedOptions.every(o => variantData.includes(o));
      });

      if (matchingOption) {
        variantSelect.value = matchingOption.value;
        form.querySelector('[name="id"]').value = matchingOption.value;

        // Update price display
        const price = matchingOption.dataset.price;
        if (price && priceEl) priceEl.textContent = utils.formatMoney(parseInt(price));
        if (price && addBtn) {
          const baseText = addBtn.textContent.split('—')[0].trim();
          addBtn.textContent = `${baseText} — ${utils.formatMoney(parseInt(price))}`;
        }

        // Handle availability
        const disabled = matchingOption.disabled;
        const submitBtn = form.querySelector('[data-add-to-cart]');
        if (submitBtn) {
          submitBtn.disabled = disabled;
          if (addBtn) addBtn.textContent = disabled ? 'Sold Out' : addBtn.textContent;
        }
      }
    };

    optionSelects.forEach(select => {
      select.addEventListener('change', updateVariant);
    });
  }
}


/* ========================================================================
   STICKY HEADER — add scrolled class
   ======================================================================== */

class StickyHeader {
  constructor() {
    this.header = document.querySelector('[data-header]');
    if (!this.header) return;

    this.scrollY = 0;
    this.init();
  }

  init() {
    const onScroll = utils.debounce(() => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 80) {
        this.header.classList.add('is-scrolled');
      } else {
        this.header.classList.remove('is-scrolled');
      }
      this.scrollY = currentScrollY;
    }, 50);

    window.addEventListener('scroll', onScroll, { passive: true });
  }
}


/* ========================================================================
   DROPDOWN NAV — keyboard accessible
   ======================================================================== */

class DropdownNav {
  constructor() {
    document.querySelectorAll('.site-header__nav-link--dropdown').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        // Close all others
        document.querySelectorAll('.site-header__nav-link--dropdown').forEach(b => {
          b.setAttribute('aria-expanded', 'false');
        });
        btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
        e.stopPropagation();
      });
    });

    document.addEventListener('click', () => {
      document.querySelectorAll('.site-header__nav-link--dropdown').forEach(btn => {
        btn.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.site-header__nav-link--dropdown').forEach(btn => {
          btn.setAttribute('aria-expanded', 'false');
        });
      }
    });
  }
}


/* ========================================================================
   COLLECTION SORT
   ======================================================================== */

class CollectionSort {
  constructor() {
    const select = document.querySelector('[data-sort-select]');
    if (!select) return;

    select.addEventListener('change', () => {
      const url = new URL(window.location.href);
      url.searchParams.set('sort_by', select.value);
      window.location.href = url.toString();
    });
  }
}


/* ========================================================================
   CART PAGE — live quantity update
   ======================================================================== */

class CartPage {
  constructor() {
    const form = document.querySelector('[data-cart-form]');
    if (!form) return;

    // Qty buttons on cart page
    form.addEventListener('click', async (e) => {
      const minus = e.target.closest('[data-qty-minus]');
      const plus = e.target.closest('[data-qty-plus]');
      const removeLink = e.target.closest('[data-cart-remove]');

      if (minus) {
        const row = minus.closest('.cart-item');
        const input = row?.querySelector('[data-qty-input]');
        if (input) {
          const line = parseInt(input.dataset.line);
          const qty = Math.max(0, parseInt(input.value) - 1);
          input.value = qty;
          await CartState.change(line, qty);
          if (qty === 0) row?.remove();
          this.updateSubtotal();
        }
      }

      if (plus) {
        const row = plus.closest('.cart-item');
        const input = row?.querySelector('[data-qty-input]');
        if (input) {
          const line = parseInt(input.dataset.line);
          const qty = parseInt(input.value) + 1;
          input.value = qty;
          await CartState.change(line, qty);
          this.updateSubtotal();
        }
      }

      if (removeLink) {
        e.preventDefault();
        const row = removeLink.closest('.cart-item');
        const line = parseInt(removeLink.dataset.cartRemove) ||
                     parseInt(row?.querySelector('[data-qty-input]')?.dataset.line);
        if (line) {
          await CartState.remove(line);
          row?.remove();
          this.updateSubtotal();
        }
      }
    });
  }

  async updateSubtotal() {
    const cart = await CartState.refresh();
    document.querySelectorAll('.cart-page__subtotal span:last-child').forEach(el => {
      el.textContent = utils.formatMoney(cart.total_price);
    });
    // Update checkout button
    document.querySelectorAll('[name="checkout"]').forEach(btn => {
      btn.textContent = `Checkout — ${utils.formatMoney(cart.total_price)}`;
    });
  }
}


/* ========================================================================
   FAQ ACCORDION — smooth open/close
   ======================================================================== */

class FAQ {
  constructor() {
    document.querySelectorAll('.faq-item').forEach(item => {
      item.addEventListener('toggle', () => {
        // Close others if only-one-open behavior desired
        // (Commented out — keeping multiple-open behavior for UX)
        // if (item.open) {
        //   document.querySelectorAll('.faq-item[open]').forEach(other => {
        //     if (other !== item) other.removeAttribute('open');
        //   });
        // }
      });
    });
  }
}


/* ========================================================================
   SCROLL ANIMATIONS — intersection observer
   ======================================================================== */

class ScrollAnimations {
  constructor() {
    if (!('IntersectionObserver' in window)) return;

    const animatables = document.querySelectorAll(
      '.product-card, .testimonial-card, .blog-card, .about-value, .faq-item, .section-header'
    );

    animatables.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    animatables.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 4) * 0.07}s`;
      observer.observe(el);
    });
  }
}


/* ========================================================================
   ANNOUNCEMENT BAR — auto-cycle if multiple (future-proof)
   ======================================================================== */

class AnnouncementBar {
  constructor() {
    // Placeholder for multi-message rotation if needed
  }
}


/* ========================================================================
   NOTIFICATION TOAST
   ======================================================================== */

class Toast {
  constructor() {
    this.container = this.createContainer();
  }

  createContainer() {
    const div = document.createElement('div');
    div.id = 'toast-container';
    div.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 9999;
      display: flex; flex-direction: column; gap: 8px; pointer-events: none;
    `;
    document.body.appendChild(div);
    return div;
  }

  show(message, type = 'success') {
    const toast = document.createElement('div');
    const colors = {
      success: 'var(--color-primary)',
      error: '#EF4444',
      info: 'var(--color-secondary)'
    };

    toast.style.cssText = `
      background: var(--color-bg-card);
      border-left: 3px solid ${colors[type] || colors.success};
      color: var(--color-text);
      padding: 12px 18px;
      border-radius: 8px;
      font-size: 0.9rem;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      pointer-events: all;
      opacity: 0;
      transform: translateX(20px);
      transition: all 0.3s ease;
      max-width: 320px;
    `;
    toast.textContent = message;

    this.container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}


/* ========================================================================
   IMAGE LAZY LOADING — native + polyfill fallback
   ======================================================================== */

function initLazyImages() {
  if ('loading' in HTMLImageElement.prototype) return; // native lazy loading supported
  // Fallback for older browsers
  const images = document.querySelectorAll('img[loading="lazy"]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src || img.src;
        observer.unobserve(img);
      }
    });
  });
  images.forEach(img => observer.observe(img));
}


/* ========================================================================
   PLACEHOLDER IMAGES — handle broken images
   ======================================================================== */

function initImageErrorHandling() {
  document.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', function () {
      this.style.background = 'var(--color-bg-elevated)';
      this.style.opacity = '0.3';
    });
  });
}


/* ========================================================================
   NOTIFICATION FOR SOLD OUT — "Notify Me" button
   ======================================================================== */

class NotifyMe {
  constructor() {
    document.querySelectorAll('[data-notify-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        const form = document.createElement('form');
        form.innerHTML = `
          <div style="margin-top:16px;display:flex;gap:8px">
            <input type="email" placeholder="Your email" class="form-input" style="flex:1" required>
            <button type="submit" class="btn btn--primary btn--small">Notify Me</button>
          </div>`;
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          form.innerHTML = '<p style="color:var(--color-accent);margin-top:12px">✓ We\'ll notify you when this is back in stock!</p>';
        });
        btn.closest('.product-page__notify')?.appendChild(form);
        btn.style.display = 'none';
      });
    });
  }
}


/* ========================================================================
   TAB SWITCHER — tabbed collections section
   ======================================================================== */

class TabSwitcher {
  constructor() {
    document.querySelectorAll('[data-tabs]').forEach(container => {
      this.initContainer(container);
    });
  }

  initContainer(container) {
    const buttons = container.querySelectorAll('[data-tab-btn]');
    const panels = container.querySelectorAll('[data-tab-panel]');

    if (!buttons.length || !panels.length) return;

    const activate = (targetTab) => {
      buttons.forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.tabBtn === targetTab);
        btn.setAttribute('aria-selected', btn.dataset.tabBtn === targetTab ? 'true' : 'false');
      });
      panels.forEach(panel => {
        const isActive = panel.dataset.tabPanel === targetTab;
        panel.classList.toggle('is-active', isActive);
        panel.hidden = !isActive;
      });
    };

    buttons.forEach(btn => {
      btn.addEventListener('click', () => activate(btn.dataset.tabBtn));
    });

    // Keyboard: left/right arrows within tabs
    const nav = container.querySelector('[data-tabs-nav]');
    nav?.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const btns = [...buttons];
      const idx = btns.indexOf(document.activeElement);
      if (idx === -1) return;
      const next = e.key === 'ArrowRight' ? (idx + 1) % btns.length : (idx - 1 + btns.length) % btns.length;
      btns[next].focus();
      activate(btns[next].dataset.tabBtn);
    });

    // Activate first tab on load
    const firstBtn = buttons[0];
    if (firstBtn) activate(firstBtn.dataset.tabBtn);
  }
}


/* ========================================================================
   STICKY MOBILE ATC — product page sticky buy bar (mobile)
   ======================================================================== */

class StickyMobileATC {
  constructor() {
    this.bar = document.querySelector('[data-sticky-atc]');
    if (!this.bar) return;

    // Use the main product form's ATC button as trigger
    const mainForm = document.querySelector('[data-product-form]');
    const mainATC = mainForm?.querySelector('[data-add-to-cart]');
    if (!mainATC) return;

    // Sync product title + price into sticky bar
    const titleEl = document.querySelector('.product-page__title, .featured-product__title');
    const priceEl = document.querySelector('.product-page__price, .featured-product__price-sale');
    const stickyTitle = this.bar.querySelector('[data-sticky-atc-title]');
    const stickyPrice = this.bar.querySelector('[data-sticky-atc-price]');

    if (stickyTitle && titleEl) stickyTitle.textContent = titleEl.textContent;
    if (stickyPrice && priceEl) stickyPrice.textContent = priceEl.textContent;

    // Observe main ATC button; show bar when button is scrolled out of view
    const observer = new IntersectionObserver(
      ([entry]) => {
        this.bar.classList.toggle('is-visible', !entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '-80px 0px 0px 0px' }
    );
    observer.observe(mainATC);

    // Wire up sticky bar's own ATC button to submit the main form
    const stickyBtn = this.bar.querySelector('[data-sticky-atc-btn]');
    stickyBtn?.addEventListener('click', () => {
      mainForm?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  }
}


/* ========================================================================
   RECENTLY VIEWED — localStorage tracking + on-page rendering
   ======================================================================== */

class RecentlyViewed {
  constructor() {
    this.key = 'vault_tcg_recently_viewed';
    this.maxItems = 8;
    this.grid = document.querySelector('[data-recently-viewed-grid]');
    this.section = document.querySelector('[data-recently-viewed-section]');

    // Track current product page
    const productHandle = document.querySelector('[data-product-handle]')?.dataset.productHandle;
    if (productHandle) this.track(productHandle);

    // Render grid on any page that has the recently-viewed section
    if (this.grid) this.render();
  }

  getViewed() {
    try {
      return JSON.parse(localStorage.getItem(this.key) || '[]');
    } catch {
      return [];
    }
  }

  track(handle) {
    const viewed = this.getViewed().filter(h => h !== handle);
    viewed.unshift(handle);
    localStorage.setItem(this.key, JSON.stringify(viewed.slice(0, this.maxItems)));
  }

  async render() {
    const viewed = this.getViewed();
    if (!viewed.length) {
      if (this.section) this.section.hidden = true;
      return;
    }

    const results = await Promise.allSettled(
      viewed.map(handle => fetch(`/products/${handle}.js`).then(r => r.json()))
    );

    const products = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (!products.length) {
      if (this.section) this.section.hidden = true;
      return;
    }

    if (this.section) this.section.hidden = false;
    this.grid.innerHTML = products.map(p => this.renderCard(p)).join('');
    // Trigger scroll animations for the new cards
    document.querySelectorAll('[data-recently-viewed-grid] .product-card').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
    });
  }

  renderCard(product) {
    const price = utils.formatMoney(product.price);
    const comparePrice = product.compare_at_price > product.price
      ? utils.formatMoney(product.compare_at_price) : null;

    const imgSrc = product.featured_image
      ? product.featured_image.replace('http:', 'https:').replace(/(\.\w+)(\?.*)?$/, '_400x440$1')
      : null;

    const imgHtml = imgSrc
      ? `<img src="${imgSrc}" alt="${product.title}" loading="lazy" width="200" height="220">`
      : `<div class="product-card__img-placeholder"><svg viewBox="0 0 240 340" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%"><defs><linearGradient id="rv-grad-${product.id}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#7C3AED"/><stop offset="100%" style="stop-color:#06B6D4"/></linearGradient></defs><rect width="240" height="340" fill="url(#rv-grad-${product.id})"/><rect x="8" y="8" width="224" height="324" rx="10" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/><text x="120" y="185" text-anchor="middle" font-family="sans-serif" font-size="12" fill="rgba(255,255,255,0.7)">SEALED PACK</text></svg></div>`;

    const variant = product.variants?.[0];
    const variantId = variant?.id;
    const availableForSale = variant?.available !== false;

    return `
      <div class="product-card">
        <a href="${product.url}" class="product-card__img-wrap" tabindex="-1">
          ${imgHtml}
        </a>
        <div class="product-card__info">
          <a href="${product.url}" class="product-card__title">${product.title}</a>
          <div class="product-card__price-row">
            <span class="product-card__price${comparePrice ? ' product-card__price--sale' : ''}">${price}</span>
            ${comparePrice ? `<span class="product-card__compare">${comparePrice}</span>` : ''}
          </div>
          ${variantId && availableForSale ? `
          <form method="post" action="/cart/add" data-add-to-cart-form class="product-card__quick-add">
            <input type="hidden" name="id" value="${variantId}">
            <input type="hidden" name="quantity" value="1">
            <button type="submit" class="btn btn--primary btn--small product-card__atc" data-add-to-cart>
              <span data-add-to-cart-text>Quick Add</span>
            </button>
          </form>` : `<p class="product-card__sold-out">Sold Out</p>`}
        </div>
      </div>`;
  }
}


/* ========================================================================
   BRAND TICKER — pause on hover
   ======================================================================== */

class BrandTicker {
  constructor() {
    document.querySelectorAll('[data-brand-ticker]').forEach(ticker => {
      const track = ticker.querySelector('[data-ticker-track]');
      if (!track) return;

      ticker.addEventListener('mouseenter', () => {
        track.style.animationPlayState = 'paused';
      });
      ticker.addEventListener('mouseleave', () => {
        track.style.animationPlayState = 'running';
      });

      // Pause on focus for keyboard users
      ticker.addEventListener('focusin', () => {
        track.style.animationPlayState = 'paused';
      });
      ticker.addEventListener('focusout', () => {
        track.style.animationPlayState = 'running';
      });
    });
  }
}


/* ========================================================================
   PROMO COUNTDOWN — optional countdown timers on promo banners
   ======================================================================== */

class PromoCountdown {
  constructor() {
    document.querySelectorAll('[data-countdown]').forEach(el => {
      const end = new Date(el.dataset.countdown);
      if (isNaN(end)) return;

      const update = () => {
        const now = new Date();
        const diff = end - now;
        if (diff <= 0) { el.textContent = 'Deal ended'; return; }

        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent = `${h}h ${m}m ${s}s`;
      };

      update();
      setInterval(update, 1000);
    });
  }
}


/* ========================================================================
   PRODUCT TABS — Description / Box Contents / Reviews
   ======================================================================== */

class ProductTabs {
  constructor() {
    document.querySelectorAll('[data-product-tabs]').forEach(el => this.init(el));
    // Handle "Jump to reviews" link from rating row
    document.querySelectorAll('[data-tab-jump]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.dataset.tabJump;
        const tabsEl = document.querySelector('[data-product-tabs]');
        if (!tabsEl) return;
        this.switchTab(tabsEl, target);
        tabsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  init(el) {
    const btns = el.querySelectorAll('[data-tab-target]');
    const panels = el.querySelectorAll('[data-tab-panel]');

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(el, btn.dataset.tabTarget);
      });
    });
  }

  switchTab(el, target) {
    const btns = el.querySelectorAll('[data-tab-target]');
    const panels = el.querySelectorAll('[data-tab-panel]');
    btns.forEach(b => {
      const active = b.dataset.tabTarget === target;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach(p => {
      p.classList.toggle('is-active', p.dataset.tabPanel === target);
    });
  }
}

/* ========================================================================
   WISHLIST TOGGLE — localStorage-based heart button
   ======================================================================== */

class WishlistToggle {
  constructor() {
    this.storageKey = 'vault_tcg_wishlist';

    document.querySelectorAll('[data-wishlist-btn]').forEach(btn => {
      const handle = document.querySelector('[data-product-handle]')?.dataset.productHandle;
      if (!handle) return;

      // Set initial state
      const list = this.getList();
      if (list.includes(handle)) btn.classList.add('is-active');

      btn.addEventListener('click', () => {
        const saved = this.toggle(handle);
        btn.classList.toggle('is-active', saved);

        if (window.toast) {
          window.toast.show(saved ? '❤️ Saved to wishlist' : 'Removed from wishlist');
        }
      });
    });
  }

  getList() {
    try { return JSON.parse(localStorage.getItem(this.storageKey)) || []; }
    catch { return []; }
  }

  toggle(handle) {
    let list = this.getList();
    const idx = list.indexOf(handle);
    if (idx > -1) { list.splice(idx, 1); }
    else { list.push(handle); }
    try { localStorage.setItem(this.storageKey, JSON.stringify(list)); } catch {}
    return idx === -1;
  }
}

/* ========================================================================
   GALLERY — Arrow nav + thumbnail switching (upgraded)
   ======================================================================== */

function initGalleryControls() {
  const gallery = document.querySelector('[data-product-gallery]');
  if (!gallery) return;

  const slides = gallery.querySelectorAll('[data-image-slide]');
  const thumbs = document.querySelectorAll('[data-thumb-index]');
  const counter = gallery.querySelector('[data-image-current]');
  if (!slides.length) return;

  let current = 0;

  const goTo = (idx) => {
    slides[current]?.classList.remove('is-active');
    thumbs[current]?.classList.remove('is-active');
    current = (idx + slides.length) % slides.length;
    slides[current]?.classList.add('is-active');
    thumbs[current]?.classList.add('is-active');
    if (counter) counter.textContent = current + 1;
  };

  gallery.querySelector('[data-gallery-prev]')?.addEventListener('click', () => goTo(current - 1));
  gallery.querySelector('[data-gallery-next]')?.addEventListener('click', () => goTo(current + 1));
  thumbs.forEach(t => t.addEventListener('click', () => goTo(parseInt(t.dataset.thumbIndex))));
}

/* ========================================================================
   INIT — Run everything on DOMContentLoaded
   ======================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Core UI
  const cartDrawer = new CartDrawer();
  window.cartDrawer = cartDrawer; // expose for add-to-cart

  new AddToCart();
  new QuickView();
  new MobileNav();
  new SearchOverlay();
  new DropdownNav();
  new StickyHeader();
  new VariantSelector();
  new CollectionSort();
  new CartPage();
  new FAQ();
  new NotifyMe();

  // v2 CRO components
  new TabSwitcher();
  new StickyMobileATC();
  new RecentlyViewed();
  new BrandTicker();
  new PromoCountdown();

  // Product page v3 components
  new ProductTabs();
  new WishlistToggle();
  initGalleryControls();

  // Animations & polish
  new ScrollAnimations();
  new AnnouncementBar();
  initQuantityControls();
  initLazyImages();
  initImageErrorHandling();

  // Global toast
  window.toast = new Toast();

  // CartState initialization
  CartState.refresh().catch(() => {});

  // Free shipping threshold from settings
  const thresholdMeta = document.querySelector('meta[name="free-shipping-threshold"]');
  if (thresholdMeta) {
    window.cartFreeShippingThreshold = parseFloat(thresholdMeta.content);
  }
});
