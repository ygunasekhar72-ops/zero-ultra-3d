// ------------------------------------------------------------
// Commerce layer: floating BUY chip → glass order card (qty,
// live subtotal) → add to cart with a nav badge + toast.
// Purely a concept demo — no real checkout anywhere.
// ------------------------------------------------------------

// ------------------------------------------------------------
// Commerce layer: floating BUY chip → glass order card (qty,
// live subtotal) → add to cart with a nav badge + toast.
// Reads window.ZU_CONFIG (name/price/checkoutUrl). With a
// checkoutUrl set, ADD TO CART routes to the real store cart;
// without it, everything stays a clearly-labeled demo.
// ------------------------------------------------------------

const cfg = window.ZU_CONFIG || {};
const PRICE = Number(cfg.price) || 2.49;
const CURRENCY = cfg.currency || '$';
const NAME = cfg.name || 'ZERO ULTRA';

export function createCommerce(sfx = {}) {
  const chip = document.getElementById('buyChip');
  const card = document.getElementById('buyCard');
  const dock = document.getElementById('buyDock');
  const qtyVal = document.getElementById('qtyVal');
  const total = document.getElementById('buyTotal');
  const add = document.getElementById('buyAdd');
  const minus = document.getElementById('qtyMinus');
  const plus = document.getElementById('qtyPlus');
  const cartTag = document.getElementById('cartTag');
  const cartCount = document.getElementById('cartCount');
  const toast = document.getElementById('toast');
  if (!chip || !card) return null;

  let qty = 1;
  let items = 0;
  let toastTimer = 0;

  const fmt = (n) => `${CURRENCY}${n.toFixed(2)}`;

  // reskin from config
  const titleEl = card.querySelector('.buy-title');
  const subEl = card.querySelector('.buy-sub');
  const chipName = chip.querySelector('.buy-name');
  const chipPrice = chip.querySelector('.buy-price');
  const chipCta = chip.querySelector('.buy-cta');
  if (titleEl) titleEl.textContent = NAME;
  if (subEl) subEl.textContent = cfg.subtitle || '500ML ALUMINUM · SINGLE CAN';
  if (chipName) chipName.textContent = `${NAME} · 500ML`;
  if (chipPrice) chipPrice.textContent = fmt(PRICE);
  const realCheckout = typeof cfg.checkoutUrl === 'string' && cfg.checkoutUrl.trim().length > 0;

  function render() {
    qtyVal.textContent = String(qty);
    total.textContent = fmt(PRICE * qty);
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function closeCard() {
    card.hidden = true;
    chip.setAttribute('aria-expanded', 'false');
    dock.classList.remove('open');
  }

  chip.addEventListener('click', () => {
    const open = !card.hidden;
    card.hidden = open;
    chip.setAttribute('aria-expanded', String(!open));
    dock.classList.toggle('open', !open);
    if (!open) { render(); minus.focus?.(); }
    sfx.tick?.();
  });

  minus.addEventListener('click', () => { qty = Math.max(1, qty - 1); render(); sfx.tick?.(); });
  plus.addEventListener('click', () => { qty = Math.min(9, qty + 1); render(); sfx.tick?.(); });

  add.addEventListener('click', () => {
    items += qty;
    cartTag.hidden = false;
    cartCount.textContent = String(items);
    sfx.pop?.();
    if (realCheckout) {
      // Shopify cart permalink: …/cart/VARIANT_ID:  + quantity
      const sep = cfg.checkoutUrl.endsWith(':') || cfg.checkoutUrl.endsWith('=') ? '' : ':';
      showToast(`OPENING ${NAME} CHECKOUT — ${fmt(PRICE * qty)}`);
      setTimeout(() => { window.location.href = `${cfg.checkoutUrl}${qty}`; }, 450);
    } else {
      showToast(`ADDED ${qty} × ${NAME} — ${fmt(PRICE * qty)} · demo checkout only`);
    }
    qty = 1;
    render();
    closeCard();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !card.hidden) {
      closeCard();
      chip.focus();
    }
  });

  return {};
}
