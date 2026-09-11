// ==========================================
// FASSOKO — FLASH DEALS (shared helpers)
// Used by both flash-deals.html (full page) and
// index.html (homepage preview section).
// Depends on globals defined in script.js:
// products, productsWithOptions, money, escapeHtml,
// isWishlisted, heartIcon, onWishBtnClick, quickView,
// add, stockBadgeMarkup, starsMarkup
//
// A deal's expiry is driven by the product's own
// discount_ends_at field (set in the admin product
// form). Leave it blank for a discount with no expiry.
// ==========================================

function getFlashDeals() {
  const list = typeof products !== "undefined" ? products : [];
  const now = Date.now();

  return list.filter(p => {
    const price = Number(p.price);
    const deal = Number(p.discount_price);
    if (!(deal > 0 && price > 0 && deal < price)) return false;

    if (p.discount_ends_at) {
      const end = new Date(p.discount_ends_at).getTime();
      if (!isNaN(end) && end <= now) return false; // this deal has expired
    }

    return true;
  });
}

function flashDealPercentOff(p) {
  const price = Number(p.price);
  const deal = Number(p.discount_price);
  return Math.round((1 - deal / price) * 100);
}

// Short "Ends in ..." label for an individual product card.
// Returns "" when the deal has no expiry set.
function formatDealTimeLeft(endIso) {
  if (!endIso) return "";

  const end = new Date(endIso).getTime();
  if (isNaN(end)) return "";

  let diff = end - Date.now();
  if (diff <= 0) return "";

  const days = Math.floor(diff / 86400000);
  diff -= days * 86400000;
  const hours = Math.floor(diff / 3600000);
  diff -= hours * 3600000;
  const minutes = Math.floor(diff / 60000);

  if (days > 0) return `Ends in ${days}d ${hours}h`;
  if (hours > 0) return `Ends in ${hours}h ${minutes}m`;
  return `Ends in ${minutes}m`;
}

// Earliest discount_ends_at among currently-active deals.
// Returns null if there isn't one (no deals, or none with an expiry).
function getNextFlashDealEnd() {
  const now = Date.now();

  const times = getFlashDeals()
    .map(p => (p.discount_ends_at ? new Date(p.discount_ends_at).getTime() : null))
    .filter(t => t !== null && !isNaN(t) && t > now);

  if (!times.length) return null;

  return new Date(Math.min(...times));
}

function flashDealCard(p) {
  const price = Number(p.price);
  const dealPrice = Number(p.discount_price);
  const off = flashDealPercentOff(p);
  const timeLeft = formatDealTimeLeft(p.discount_ends_at);

  const visual = p.image
    ? `<img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy">`
    : `<div class="pic-emoji" style="background:${p.bg || '#edf6ef'}">${p.emoji || "🛒"}</div>`;

  const wished = isWishlisted(p.id);
  const soldOut = p.stock === "out";
  const hasOptions = productsWithOptions.has(Number(p.id));

  const actionBtn = soldOut
    ? `<button class="add" disabled>Sold out</button>`
    : hasOptions
      ? `<button class="add select-options-btn" onclick="quickView(${p.id})">Select options</button>`
      : `<button class="add" onclick="add(${p.id})">Add to cart</button>`;

  return `<article class="card deal-card${soldOut ? ' sold-out' : ''}">
    <a class="pic" href="product.html?id=${p.id}" aria-label="View ${escapeHtml(p.name)}">
      ${visual}
      <span class="deal-badge">-${off}%</span>
      ${stockBadgeMarkup(p.stock)}
      <button class="wish-btn${wished ? ' active' : ''}" data-id="${p.id}" aria-label="${wished ? 'Remove from wishlist' : 'Add to wishlist'}" onclick="event.preventDefault();event.stopPropagation();onWishBtnClick(this,${p.id})">${heartIcon(wished)}</button>
      <button class="quick-view" aria-label="Quick view ${escapeHtml(p.name)}" onclick="event.preventDefault();event.stopPropagation();quickView(${p.id})"><i class="fa-solid fa-eye"></i></button>
    </a>

    <div class="info">
      <small>${escapeHtml(p.cat || '')}</small>
      <h3><a href="product.html?id=${p.id}">${escapeHtml(p.name)}</a></h3>
      ${starsMarkup(p.rating, p.reviews)}
      <div class="deal-price-row">
        <strong>${money(dealPrice)}</strong>
        <del class="deal-old-price">${money(price)}</del>
      </div>
      ${timeLeft ? `<p class="deal-off-note"><i class="fa-regular fa-clock"></i> ${timeLeft}</p>` : ""}
      ${actionBtn}
    </div>
  </article>`;
}

// Waits for script.js to finish loading products from Supabase
// before running the callback. Gives up after ~20s.
function waitForFlashDealProducts(cb, attempts) {
  attempts = attempts || 0;

  if (typeof products !== "undefined" && products.length > 0) {
    cb();
    return;
  }

  if (attempts > 100) {
    cb();
    return;
  }

  setTimeout(() => waitForFlashDealProducts(cb, attempts + 1), 200);
}

// Ticks a countdown to the soonest upcoming discount_ends_at across
// currently active deals. If no active deal has an expiry set, the
// numeric block is hidden and a "no expiry" note is shown instead.
function tickFlashDealsCountdown(hoursId, minutesId, secondsId, numbersWrapId, noExpiryId) {
  const end = getNextFlashDealEnd();

  const numbersWrap = numbersWrapId ? document.getElementById(numbersWrapId) : null;
  const noExpiryEl = noExpiryId ? document.getElementById(noExpiryId) : null;

  if (!end) {
    if (numbersWrap) numbersWrap.hidden = true;
    if (noExpiryEl) noExpiryEl.hidden = false;
    return;
  }

  if (numbersWrap) numbersWrap.hidden = false;
  if (noExpiryEl) noExpiryEl.hidden = true;

  const now = new Date();
  let diff = Math.max(0, end - now);

  const hours = Math.floor(diff / 3600000);
  diff -= hours * 3600000;

  const minutes = Math.floor(diff / 60000);
  diff -= minutes * 60000;

  const seconds = Math.floor(diff / 1000);

  const pad = n => String(n).padStart(2, "0");

  const h = document.getElementById(hoursId);
  const m = document.getElementById(minutesId);
  const s = document.getElementById(secondsId);

  if (h) h.textContent = pad(hours);
  if (m) m.textContent = pad(minutes);
  if (s) s.textContent = pad(seconds);
}
