// ==========================================
// FASSOKO — FLASH DEALS PAGE (full page)
// Requires script.js AND deals-common.js to be
// loaded first.
// ==========================================

(function () {

  const grid = document.getElementById("dealsGrid");
  const loadingEl = document.getElementById("dealsLoading");
  const emptyEl = document.getElementById("dealsEmpty");
  const countEl = document.getElementById("dealCount");
  const subLabelEl = document.getElementById("dealSubLabel");
  const sortSelect = document.getElementById("dealSort");

  if (!grid) return;

  let sortMode = "discount";

  function sortDeals(list) {
    const arr = list.slice();

    if (sortMode === "price-asc") {
      arr.sort((a, b) => Number(a.discount_price) - Number(b.discount_price));
    } else if (sortMode === "price-desc") {
      arr.sort((a, b) => Number(b.discount_price) - Number(a.discount_price));
    } else if (sortMode === "name") {
      arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else {
      // "discount" — biggest percentage off first
      arr.sort((a, b) => flashDealPercentOff(b) - flashDealPercentOff(a));
    }

    return arr;
  }

  function render() {
    const deals = getFlashDeals();
    const list = sortDeals(deals);

    loadingEl.hidden = true;

    if (!list.length) {
      grid.hidden = true;
      emptyEl.hidden = false;
      countEl.textContent = "0";
      subLabelEl.textContent = "";
      return;
    }

    emptyEl.hidden = true;
    grid.hidden = false;
    grid.innerHTML = list.map(flashDealCard).join("");

    countEl.textContent = list.length;

    const maxOff = Math.max(...list.map(flashDealPercentOff));
    subLabelEl.textContent = `· up to ${maxOff}% off`;
  }

  sortSelect && sortSelect.addEventListener("change", () => {
    sortMode = sortSelect.value;
    render();
  });

  waitForFlashDealProducts(render);

  // Re-render if the wishlist changes elsewhere (e.g. drawer),
  // so heart icons on this grid stay in sync.
  document.addEventListener("click", e => {
    if (e.target.closest(".wishlist-drawer-items") || e.target.closest("#wishlistDrawerItems")) {
      setTimeout(render, 50);
    }
  });

  // ==========================================
  // COUNTDOWN — resets at local midnight, since
  // today's deals refresh daily.
  // ==========================================
  tickFlashDealsCountdown("cdHours", "cdMinutes", "cdSeconds", "cdNumbers", "cdNoExpiry");
  setInterval(() => tickFlashDealsCountdown("cdHours", "cdMinutes", "cdSeconds", "cdNumbers", "cdNoExpiry"), 1000);

})();
