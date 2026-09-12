// ==========================================
// FASSOKO — HOMEPAGE BEVERAGES CAROUSEL
// Same auto-sliding carousel design as the homepage
// Flash Deals section (see home-flash-deals.js), but
// shows products from the "Beverages" category instead
// of active discounts.
// Auto-slides every 2 seconds. Visible cards and
// slide step change per device:
//   Desktop (>=1024px): 6 visible, slides 3 at a time
//   Tablet  (640-1023px): 4 visible, slides 2 at a time
//   Phone   (<640px): 2 visible, slides 1 at a time
// Requires script.js (for `products` and `productCard()`)
// AND deals-common.js (for `waitForFlashDealProducts()`).
// ==========================================

(function () {

  const section = document.getElementById("homeBeveragesSection");
  const viewport = document.getElementById("homeBeveragesViewport");
  const track = document.getElementById("homeBeveragesTrack");
  const loadingEl = document.getElementById("homeBeveragesLoading");

  if (!section || !track) return;

  const SLIDE_MS = 2000;       // how often a slide happens
  const TRANSITION_MS = 600;   // how long the slide animation takes
  const GAP = 16;              // px gap between cards, matches CSS

  let baseItems = [];
  let order = [];
  let timer = null;
  let resizeTimer = null;

  function getBeverages() {
    const list = typeof products !== "undefined" ? products : [];
    return list.filter(p => p.group === "Beverages");
  }

  function getConfig() {
    const w = window.innerWidth;

    if (w >= 1024) {
      return { itemsPerView: 6, slideStep: 3 };
    }
    if (w >= 640) {
      return { itemsPerView: 4, slideStep: 2 };
    }
    return { itemsPerView: 2, slideStep: 1 };
  }

  function slideWidthPercent(cfg) {
    // Account for the gaps between visible cards so cards line up exactly.
    return `calc((100% - ${GAP * (cfg.itemsPerView - 1)}px) / ${cfg.itemsPerView})`;
  }

  function renderTrack() {
    const cfg = getConfig();

    if (!baseItems.length) return;

    // Not enough items to slide — show them all, static, no animation.
    if (baseItems.length <= cfg.itemsPerView) {
      track.style.transition = "none";
      track.style.transform = "translateX(0)";
      track.innerHTML = baseItems
        .map(p => `<div class="flash-slide" style="flex:0 0 ${slideWidthPercent(cfg)}">${productCard(p)}</div>`)
        .join("");
      return;
    }

    // Render current view + the next slideStep cards so they're
    // ready just off-screen to slide into.
    const visibleCount = cfg.itemsPerView + cfg.slideStep;
    const slice = [];
    for (let i = 0; i < visibleCount; i++) {
      slice.push(order[i % order.length]);
    }

    track.style.transition = "none";
    track.style.transform = "translateX(0)";
    track.innerHTML = slice
      .map(p => `<div class="flash-slide" style="flex:0 0 ${slideWidthPercent(cfg)}">${productCard(p)}</div>`)
      .join("");

    // Force reflow so the next transition actually animates.
    void track.offsetWidth;
  }

  function slideTick() {
    const cfg = getConfig();

    if (baseItems.length <= cfg.itemsPerView) return;

    const shiftPercent = `calc(-1 * (${slideWidthPercent(cfg)} + ${GAP}px) * ${cfg.slideStep})`;

    track.style.transition = `transform ${TRANSITION_MS}ms ease`;
    track.style.transform = `translateX(${shiftPercent})`;

    const onEnd = () => {
      track.removeEventListener("transitionend", onEnd);
      order = order.slice(cfg.slideStep).concat(order.slice(0, cfg.slideStep));
      renderTrack();
    };

    track.addEventListener("transitionend", onEnd, { once: true });
  }

  function startTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(slideTick, SLIDE_MS);
  }

  function render() {
    baseItems = getBeverages();

    if (loadingEl) loadingEl.hidden = true;

    if (!baseItems.length) {
      // No beverages available right now — hide the whole section
      // rather than show an empty carousel on the homepage.
      section.hidden = true;
      return;
    }

    section.hidden = false;
    if (viewport) viewport.hidden = false;

    order = baseItems.slice();
    renderTrack();
    startTimer();
  }

  waitForFlashDealProducts(render);

  document.addEventListener("click", e => {
    if (e.target.closest(".wishlist-drawer-items") || e.target.closest("#wishlistDrawerItems")) {
      // Wishlist state changed elsewhere — refresh heart icons without
      // disturbing the current slide position.
      renderTrack();
    }
  });

  // Re-layout on breakpoint changes (debounced) so item counts stay correct.
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!baseItems.length) return;
      order = baseItems.slice();
      renderTrack();
      startTimer();
    }, 200);
  });

})();
