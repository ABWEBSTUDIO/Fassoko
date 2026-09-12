async function testSupabase() {
  const { data, error } = await supabaseClient
    .from("Products")
    .select("*");

  console.log("SUPABASE PRODUCTS:", data);
  console.log("SUPABASE ERROR:", error);

}

testSupabase();
let products = [];
let productsWithOptions = new Set();
let categories = [];
let subcategories = [];
let productOptions = [];
async function loadProducts() {

  console.log("LOADING PRODUCTS FROM SUPABASE...");

  const { data, error } = await supabaseClient
    .from("Products")
    .select(`
      *,
      categories(id,name,slug),
      subcategories(id,name,slug)
    `)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  console.log("RAW PRODUCTS:", data);
  console.log("RAW ERROR:", error);

  if (error) {
    console.error("FAILED TO LOAD PRODUCTS:", error);
    return;
  }

  products = (data || []).map(p => ({

    ...p,

    // Product image
    image: p.image_url || "",

    // Category information
    cat: p.categories?.name || "Uncategorized",

    group: p.categories?.name || "Uncategorized",

    category_id: p.category_id,

    // Subcategory information
    subcategory: p.subcategories?.name || "",

    subcategory_id: p.subcategory_id,

    // IMPORTANT: keep stock compatible with the existing cart code
    stock:
      p.stock === "out" ||
      p.stock === 0 ||
      p.stock === false
        ? "out"
        : "in",

    rating: Number(p.rating || 5),

    reviews: Number(p.reviews || 0)

  }));

  console.log("PRODUCTS LOADED:", products);
  await loadProductsWithOptions();

  if (typeof renderShopGrid === "function") {
    renderShopGrid();
  }

  if (typeof renderProductPage === "function") {
    renderProductPage();
  }

  // Homepage: render only after Supabase data is ready.
  if (!isShopPage) {
    const homeGrid = document.getElementById("products");

    if (homeGrid) {
      // Strictly manual: only products where you've ticked the
      // "Popular Product" checkbox in the admin panel show here.
      // No fallback to other flags or to all products — if
      // nothing is flagged yet, the section shows the empty-state
      // message, same behavior as Snacks below.
      const homepageProducts = products.filter(p => p.is_popular);
      console.log("POPULAR PRODUCTS FOUND:", homepageProducts.length, homepageProducts);
      if (homepageProducts.length) {
        startPopularProductsSlider(homepageProducts);
      } else {
        homeGrid.innerHTML = `<p class="cat-block-empty">More Popular Products arriving soon.</p>`;
      }
    }

    const snacksGrid = document.getElementById("snacksProducts");
    if (snacksGrid) {
      // Strictly manual: only products where you've ticked the
      // "Featured Snack" checkbox in the admin panel show here.
      // No fallback to category/subcategory — if nothing is
      // flagged yet, the section just shows the empty-state message.
      const snacksProducts = products.filter(p => p.featured_snack);
      console.log("SNACKS PRODUCTS FOUND:", snacksProducts.length, snacksProducts);
      if (snacksProducts.length) {
        startSnacksProductsSlider(snacksProducts);
      } else {
        snacksGrid.innerHTML = `<p class="cat-block-empty">More Snacks arriving soon.</p>`;
      }
    }

    fillCategoryBlock("catBeverages", "Beverages");
    fillCategoryBlock("catSnacks", "Snacks");
    fillCategoryBlock("catVeggies", "Fruits & Vegetables");
    fillCategoryBlock("catHousehold", "Household");
    fillCategoryBlock("catMeat", "Meat & Poultry");
    fillCategoryBlock("babyFeatureGrid", "Baby Products");
    setTimeout(() => {
  startBabyFeatureSlider();
}, 300);
  }

  update();
}

loadProducts();
loadCategories();
const STOCK_LABEL={in:"In stock",low:"Low stock",out:"Sold out"};

let cart=JSON.parse(localStorage.getItem("abamartCart")||"[]");
let wishlist=JSON.parse(localStorage.getItem("abamartWishlist")||"[]");
let activeGroup = null;
let activeSubcategory = null;

let sortMode = "popular";
let searchTerm = "";
let minPrice=null;
let maxPrice=null;
let inStockOnly=false;
let activeBrands=new Set();

const PRODUCTS_PER_PAGE=40;
let currentPage=1;
let _lastShopFilterKey=null;

const money=n=>n.toLocaleString()+" RWF";
function escapeHtml(value) {

  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char])
  );

}


function escapeHtmlAttribute(value) {

  return escapeHtml(value);

}
const searchInput=document.getElementById("search");
const searchBtn=document.getElementById("searchBtn");

function save(){
  localStorage.setItem("abamartCart",JSON.stringify(cart));
}

function update(){
  const n=cart.reduce((s,x)=>s+x.qty,0);
  document.querySelectorAll(".cart-count").forEach(el=>el.textContent=n);
  renderCartDrawer();
  if(typeof isCartPage!=="undefined" && isCartPage) renderCartPage();
}

/* ---------- wishlist ---------- */
function saveWishlist(){
  localStorage.setItem("abamartWishlist",JSON.stringify(wishlist));
}

function isWishlisted(id){
  return wishlist.includes(id);
}

function updateWishlistBadge(){
  document.querySelectorAll(".wishlist-count").forEach(el=>el.textContent=wishlist.length);
  renderWishlistDrawer();
}

function toggleWishlist(id){
  const idx=wishlist.indexOf(id);
  if(idx===-1) wishlist.push(id);
  else wishlist.splice(idx,1);
  saveWishlist();
  updateWishlistBadge();
  return wishlist.includes(id);
}

/* shared heart icon markup — Font Awesome, outline when not saved,
   solid when saved. "active" is set on the containing button/link too,
   so any extra CSS keyed off .active keeps working. */
function heartIcon(active){
  return `<i class="fa-heart ${active?"fa-solid":"fa-regular"}"></i>`;
}

/* updates a wish button's active state + swaps its Font Awesome heart
   between outline (fa-regular) and filled (fa-solid) */
function setWishIcon(btn,wished){
  btn.classList.toggle("active",wished);
  const icon=btn.querySelector(".fa-heart");
  if(icon){
    icon.classList.toggle("fa-solid",wished);
    icon.classList.toggle("fa-regular",!wished);
  }
}

function onWishBtnClick(btn,id){
  const wished=toggleWishlist(id);
  setWishIcon(btn,wished);
  btn.setAttribute("aria-label",wished?"Remove from wishlist":"Add to wishlist");
  toast(wished?"Added to wishlist ♥":"Removed from wishlist");
  if(typeof isWishlistPage!=="undefined" && isWishlistPage) renderWishlistPage();
}

function toast(t){
  const e=document.getElementById("toast");
  if(!e) return;
  e.textContent=t;
  e.classList.add("show");
  clearTimeout(toast._t);
  toast._t=setTimeout(()=>e.classList.remove("show"),1500);
}

function bumpCart(){
  const c=document.getElementById("cart");
  if(!c) return;
  c.classList.remove("bump");
  void c.offsetWidth; // restart animation
  c.classList.add("bump");
}

function add(id){
  addQty(id,1);
}

function addQty(id, qty, option = null) {

  const p = products.find(
    x => Number(x.id) === Number(id)
  );

  if (!p || qty <= 0) return;


  if (p.stock === "out") {
    toast("Sorry, this item is sold out");
    return;
  }


  const optionId =
    option?.id || null;


  // Same product + same option = increase quantity
  let x = cart.find(item =>
    Number(item.id) === Number(id) &&
    String(item.option_id || "") ===
    String(optionId || "")
  );


  if (x) {

    x.qty += qty;

  } else {

    cart.push({

      id: Number(id),

      qty: Number(qty),

      option_id: optionId,

      option_name:
        option
          ? (
              option.name ||
              option.option_name ||
              option.label ||
              ""
            )
          : "",

      // Save the selected price because
      // different options can have different prices
      option_price:
        option
          ? Number(
              option.price ??
              option.option_price ??
              p.price
            )
          : Number(p.price)

    });

  }


save();
update();
bumpCart();

openCart();

toast("Added to cart ✓");

}

function setQty(id,qty){
  const x=cart.find(x=>x.id===id);
  if(!x) return;
  if(qty<=0){
    cart=cart.filter(x=>x.id!==id);
  }else{
    x.qty=qty;
  }
  save();
  update();
}

/* ---------- side cart drawer ---------- */
function buildCartDrawer(){
  if(document.getElementById("cartDrawer")) return;
  const wrap=document.createElement("div");
  wrap.innerHTML=`
    <div id="cartOverlay" class="cart-overlay"></div>
    <aside id="cartDrawer" class="cart-drawer" aria-hidden="true">
      <div class="cart-drawer-head">
        <h3>Your Cart</h3>
        <button id="cartClose" aria-label="Close cart">✕</button>
      </div>
      <div id="cartItems" class="cart-items"></div>
      <div class="cart-drawer-foot">
        <div class="cart-subtotal"><span>Subtotal</span><b id="cartSubtotal">0 RWF</b></div>
        <a href="cart.html" class="cta-ghost cart-view-full-btn">View full cart →</a>
        <a href="checkout.html" class="cta cart-checkout-btn">Proceed to checkout →</a>
      </div>
    </aside>`;
  document.body.append(...wrap.childNodes);

  document.getElementById("cartOverlay").addEventListener("click",closeCart);
  document.getElementById("cartClose").addEventListener("click",closeCart);
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeCart()});

  document.getElementById("cartItems").addEventListener("click",e=>{
    const btn=e.target.closest("button");
    if(!btn) return;
    const id=Number(btn.dataset.id);
    const item=cart.find(x=>x.id===id);
    if(!item) return;
    if(btn.classList.contains("qty-plus")) setQty(id,item.qty+1);
    else if(btn.classList.contains("qty-minus")) setQty(id,item.qty-1);
    else if(btn.classList.contains("item-remove")) setQty(id,0);
  });
}

function openCart(){
  document.getElementById("cartDrawer")?.classList.add("open");
  document.getElementById("cartOverlay")?.classList.add("open");
  document.getElementById("cartDrawer")?.setAttribute("aria-hidden","false");
  document.body.classList.add("cart-open");
}

function closeCart(){
  document.getElementById("cartDrawer")?.classList.remove("open");
  document.getElementById("cartOverlay")?.classList.remove("open");
  document.getElementById("cartDrawer")?.setAttribute("aria-hidden","true");
  document.body.classList.remove("cart-open");
}

function renderCartDrawer(){
  const itemsEl=document.getElementById("cartItems");
  if(!itemsEl) return;

  if(cart.length===0){
    itemsEl.innerHTML=`<div class="cart-empty"><span>🛒</span><p>Your cart is empty.</p><a href="shop.html" class="cta-ghost">Start shopping</a></div>`;
    
  }else{
    itemsEl.innerHTML=cart.map(x=>{
      const p=products.find(pr=>pr.id===x.id);
      if(!p) return "";
      const visual=p.image
        ? `<img src="${p.image}" alt="${p.name}">`
        : `<div class="cart-item-emoji" style="background:${p.bg||'#edf6ef'}">${p.emoji||"🛒"}</div>`;
      return `<div class="cart-item">
        <div class="cart-item-pic">${visual}</div>
        <div class="cart-item-body">
          <b>${p.name}</b>
          <small>${money(p.price)}</small>
          <div class="qty-stepper">
            <button class="qty-minus" data-id="${p.id}" aria-label="Decrease quantity">−</button>
            <span>${x.qty}</span>
            <button class="qty-plus" data-id="${p.id}" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <button class="item-remove" data-id="${p.id}" aria-label="Remove item">✕</button>
      </div>`;
    }).join("");
  }

  const subtotal=cart.reduce((s,x)=>{
    const p=products.find(pr=>pr.id===x.id);
    return s+(p?p.price*x.qty:0);
  },0);
  const subtotalEl=document.getElementById("cartSubtotal");
  if(subtotalEl) subtotalEl.textContent=money(subtotal);
}
function renderCartDrawer() {

  const itemsEl =
    document.getElementById("cartItems");

  if (!itemsEl) return;


  if (cart.length === 0) {

    itemsEl.innerHTML = `
      <div class="cart-empty">
        <span>🛒</span>
        <p>Your cart is empty.</p>
        <a
          href="shop.html"
          class="cta-ghost"
        >
          Start shopping
        </a>
      </div>
    `;

  } else {

    itemsEl.innerHTML =
      cart.map((x, index) => {

        const p =
          products.find(
            pr =>
              Number(pr.id) === Number(x.id)
          );

        if (!p) return "";


        const price =
          Number(
            x.option_price ??
            p.price
          );


        const visual =
          p.image
            ? `
              <img
                src="${p.image}"
                alt="${p.name}"
              >
            `
            : `
              <div
                class="cart-item-emoji"
                style="background:${p.bg || "#edf6ef"}"
              >
                ${p.emoji || "🛒"}
              </div>
            `;


        return `

          <div class="cart-item">

            <div class="cart-item-pic">
              ${visual}
            </div>


            <div class="cart-item-body">

              <b>${p.name}</b>


              ${
                x.option_name
                  ? `
                    <small class="cart-option-name">
                      ${x.option_name}
                    </small>
                  `
                  : ""
              }


              <small>
                ${money(price)}
              </small>


              <div class="qty-stepper">

                <button
                  class="qty-minus"
                  data-id="${p.id}"
                  aria-label="Decrease quantity"
                >
                  −
                </button>


                <span>${x.qty}</span>


                <button
                  class="qty-plus"
                  data-id="${p.id}"
                  aria-label="Increase quantity"
                >
                  +
                </button>

              </div>

            </div>


             <button class="item-remove" data-id="${p.id}" aria-label="Remove item">✕</button>

          </div>

        `;

      }).join("");

  }


  // ==========================================
  // CALCULATE SUBTOTAL USING OPTION PRICES
  // ==========================================

  const subtotal =
    cart.reduce(
      (sum, x) => {

        const p =
          products.find(
            pr =>
              Number(pr.id) === Number(x.id)
          );


        if (!p) return sum;


        const price =
          Number(
            x.option_price ??
            p.price
          );


        return sum +
          (price * Number(x.qty));

      },
      0
    );


  const subtotalEl =
    document.getElementById("cartSubtotal");


  if (subtotalEl) {

    subtotalEl.textContent =
      money(subtotal);

  }

}

/* ============================================================
   CART PAGE (cart.html) — full list of everything in the cart
   ============================================================ */
function renderCartPage(){
  const itemsEl=document.getElementById("cartPageItems");
  if(!itemsEl) return;

  const summaryEl=document.getElementById("cartPageSummary");
  const emptyEl=document.getElementById("cartPageEmpty");
  const countEl=document.getElementById("cartPageCount");
  const clearBtn=document.getElementById("clearCart");

  const itemCount=cart.reduce((s,x)=>s+x.qty,0);
  if(countEl) countEl.textContent=itemCount;
  if(clearBtn) clearBtn.hidden=cart.length===0;

  if(cart.length===0){
    itemsEl.innerHTML="";
    itemsEl.hidden=true;
    if(summaryEl) summaryEl.hidden=true;
    if(emptyEl) emptyEl.hidden=false;
    return;
  }

  itemsEl.hidden=false;
  if(summaryEl) summaryEl.hidden=false;
  if(emptyEl) emptyEl.hidden=true;

  itemsEl.innerHTML=cart.map(x=>{
    const p=products.find(pr=>Number(pr.id)===Number(x.id));
    if(!p) return "";

    const price=Number(x.option_price ?? p.price);
    const lineTotal=price*Number(x.qty);

    const visual=p.image
      ? `<img src="${p.image}" alt="${p.name}">`
      : `<div class="cart-item-emoji" style="background:${p.bg||'#edf6ef'}">${p.emoji||"🛒"}</div>`;

    return `<div class="cart-page-item">
      <div class="cart-page-item-pic">${visual}</div>
      <div class="cart-page-item-body">
        <a href="product.html?id=${p.id}"><b>${p.name}</b></a>
        ${x.option_name?`<small class="cart-option-name">${x.option_name}</small>`:""}
        <small class="cart-page-item-unit">${money(price)} each</small>
      </div>
      <div class="qty-stepper">
        <button class="qty-minus" data-id="${p.id}" aria-label="Decrease quantity">−</button>
        <span>${x.qty}</span>
        <button class="qty-plus" data-id="${p.id}" aria-label="Increase quantity">+</button>
      </div>
      <div class="cart-page-item-total">${money(lineTotal)}</div>
      <button class="item-remove" data-id="${p.id}" aria-label="Remove item">✕</button>
    </div>`;
  }).join("");

  const subtotal=cart.reduce((s,x)=>{
    const p=products.find(pr=>Number(pr.id)===Number(x.id));
    if(!p) return s;
    return s+(Number(x.option_price ?? p.price)*Number(x.qty));
  },0);
  const subtotalEl=document.getElementById("cartPageSubtotal");
  if(subtotalEl) subtotalEl.textContent=money(subtotal);
}

if(document.getElementById("cartPageItems")){
  document.getElementById("cartPageItems").addEventListener("click",e=>{
    const btn=e.target.closest("button");
    if(!btn) return;
    const id=Number(btn.dataset.id);
    const item=cart.find(x=>x.id===id);
    if(!item) return;
    if(btn.classList.contains("qty-plus")) setQty(id,item.qty+1);
    else if(btn.classList.contains("qty-minus")) setQty(id,item.qty-1);
    else if(btn.classList.contains("item-remove")) setQty(id,0);
  });
}

const clearCartBtn=document.getElementById("clearCart");
if(clearCartBtn){
  clearCartBtn.addEventListener("click",()=>{
    if(cart.length===0) return;
    if(!confirm("Remove all products from your cart?")) return;
    cart=[];
    save();
    update();
    toast("Cart cleared");
  });
}

renderCartPage();

/* ---------- side wishlist drawer ---------- */
function buildWishlistDrawer(){
  if(document.getElementById("wishlistDrawer")) return;
  const wrap=document.createElement("div");
  wrap.innerHTML=`
    <div id="wishlistOverlay" class="wishlist-overlay"></div>
    <aside id="wishlistDrawer" class="wishlist-drawer" aria-hidden="true">
      <div class="wishlist-drawer-head">
        <h3>Your Wishlist</h3>
        <button id="wishlistDrawerClose" aria-label="Close wishlist">✕</button>
      </div>
      <div id="wishlistDrawerItems" class="wishlist-drawer-items"></div>
      <div class="wishlist-drawer-foot">
        <div class="wishlist-drawer-count"><span>Saved items</span><b id="wishlistDrawerCount">0</b></div>
        <a href="wishlist.html" class="cta-ghost wishlist-view-all-btn">View full wishlist →</a>
      </div>
    </aside>`;
  document.body.append(...wrap.childNodes);

  document.getElementById("wishlistOverlay").addEventListener("click",closeWishlistDrawer);
  document.getElementById("wishlistDrawerClose").addEventListener("click",closeWishlistDrawer);
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeWishlistDrawer()});

  document.getElementById("wishlistDrawerItems").addEventListener("click",e=>{
    const btn=e.target.closest("button");
    if(!btn) return;
    const id=Number(btn.dataset.id);
    if(!id) return;
    if(btn.classList.contains("wishlist-drawer-add")){
      add(id);
    }else if(btn.classList.contains("wishlist-drawer-remove")){
      toggleWishlist(id); // also updates the badge + re-renders this drawer
      if(typeof isWishlistPage!=="undefined" && isWishlistPage) renderWishlistPage();
      toast("Removed from wishlist");
    }
  });
}

function openWishlistDrawer(){
  document.getElementById("wishlistDrawer")?.classList.add("open");
  document.getElementById("wishlistOverlay")?.classList.add("open");
  document.getElementById("wishlistDrawer")?.setAttribute("aria-hidden","false");
  document.body.classList.add("wishlist-open");
}

function closeWishlistDrawer(){
  document.getElementById("wishlistDrawer")?.classList.remove("open");
  document.getElementById("wishlistOverlay")?.classList.remove("open");
  document.getElementById("wishlistDrawer")?.setAttribute("aria-hidden","true");
  document.body.classList.remove("wishlist-open");
}

function renderWishlistDrawer(){
  const itemsEl=document.getElementById("wishlistDrawerItems");
  if(!itemsEl) return;

  // de-dupe by name (the catalog has a few repeated ids/names)
  const seenNames=new Set();
  const items=[];
  wishlist.forEach(id=>{
    const p=products.find(x=>x.id===id);
    if(p && !seenNames.has(p.name)){items.push(p);seenNames.add(p.name);}
  });

  if(items.length===0){
    itemsEl.innerHTML=`<div class="wishlist-drawer-empty"><span>♡</span><p>Your wishlist is empty.</p><a href="shop.html" class="cta-ghost">Start shopping</a></div>`;
  }else{
    itemsEl.innerHTML=items.map(p=>{
      const visual=p.image
        ? `<img src="${p.image}" alt="${p.name}">`
        : `<div class="wishlist-drawer-item-emoji" style="background:${p.bg||'#edf6ef'}">${p.emoji||"🛒"}</div>`;
      return `<div class="wishlist-drawer-item">
        <div class="wishlist-drawer-item-pic">${visual}</div>
        <div class="wishlist-drawer-item-body">
          <b>${p.name}</b>
          <small>${money(p.price)}</small>
          <button class="wishlist-drawer-add" data-id="${p.id}">Add to cart</button>
        </div>
        <button class="wishlist-drawer-remove" data-id="${p.id}" aria-label="Remove from wishlist">✕</button>
      </div>`;
    }).join("");
  }

  const countEl=document.getElementById("wishlistDrawerCount");
  if(countEl) countEl.textContent=items.length;
}

/* ---------- star rating markup (shared by cards + PDP) ---------- */
function starsMarkup(rating,reviews){
  if(rating==null) return "";
  const pct=Math.max(0,Math.min(100,(rating/5)*100));
  const reviewsTxt=reviews!=null?`<small>(${reviews})</small>`:"";
  return `<div class="rating"><span class="stars-wrap"><span class="stars-base">★★★★★</span><span class="stars-fill" style="width:${pct}%">★★★★★</span></span>${reviewsTxt}</div>`;
}

/* ---------- stock badge + helpers (shared by cards + PDP) ---------- */
function stockBadgeMarkup(stock){
  if(!stock||!STOCK_LABEL[stock]) return "";
  return `<span class="stock-badge stock-${stock}">${STOCK_LABEL[stock]}</span>`;
}

/* ---------- shared product card markup ---------- */
function productCard(p){
  console.log("PRODUCT CARD DATA:", p);

  const visual=p.image
    ? `<img src="${p.image}" alt="${p.name}" loading="lazy">`
    : `<div class="pic-emoji" style="background:${p.bg||'#edf6ef'}">${p.emoji||"🛒"}</div>`;

  const wished=isWishlisted(p.id);
  const soldOut=p.stock==="out";
  
const hasOptions =
  productsWithOptions.has(
    Number(p.id)
  );
  return `<article class="card${soldOut?' sold-out':''}">
    <a class="pic" href="product.html?id=${p.id}" aria-label="View ${p.name}">
      ${visual}
      ${stockBadgeMarkup(p.stock)}
      <button class="wish-btn${wished?' active':''}" data-id="${p.id}" aria-label="${wished?'Remove from wishlist':'Add to wishlist'}" onclick="event.preventDefault();event.stopPropagation();onWishBtnClick(this,${p.id})">${heartIcon(wished)}</button>
      <button class="quick-view" aria-label="Quick view ${p.name}" onclick="event.preventDefault();event.stopPropagation();quickView(${p.id})"><i class="fa-solid fa-eye"></i></button>
    </a>

    <div class="info">
      <small>
  ${p.cat}
  ${p.subcategory ? `<span class="subcategory"> · ${p.subcategory}</span>` : ""}
</small>
      <h3><a href="product.html?id=${p.id}">${p.name}</a></h3>
      ${starsMarkup(p.rating,p.reviews)}
      <strong>${money(p.price)}</strong>
      ${
  soldOut

    ? `
      <button
        class="add"
        disabled
      >
        Sold out
      </button>
    `

    : hasOptions

      ? `
        <button
          class="add select-options-btn"
          onclick="quickView(${p.id})"
        >
          Select options
        </button>
      `

      : `
      ${
  soldOut
    ? `
      <button
        class="add"
        disabled
      >
        Sold out
      </button>
    `
    : hasOptions
      ? `
        <button
          class="add"
          onclick="quickView(${p.id})"
        >
          Select options
        </button>
      `
      : `
        <button
          class="add"
          onclick="add(${p.id})"
        >
          Add to cart
        </button>
      `
}
      `
}
    </div>
  </article>`;
}
/* ---------- page detection ---------- */
const homeGrid=document.getElementById("products");
const isShopPage=!!document.getElementById("shopSidebar");
const isWishlistPage=!!document.getElementById("wishlistGrid");
const isCartPage=!!document.getElementById("cartPageItems");

/* ---------- homepage category showcase ---------- */
function fillCategoryBlock(elId,group,count){
  const el=document.getElementById(elId);
  if(!el) return;
  const list=products.filter(p=>p.group===group).slice(0,count||4);
  el.innerHTML=list.length
    ? list.map(productCard).join("")
    : `<p class="cat-block-empty">More ${group} arriving soon.</p>`;
}

/* ---------- recently viewed (tracked on product view / quick view, shown on shop page) ---------- */
function trackRecentlyViewed(id){
  let rv=JSON.parse(localStorage.getItem("abamartRecentlyViewed")||"[]");
  rv=rv.filter(x=>x!==id);
  rv.unshift(id);
  localStorage.setItem("abamartRecentlyViewed",JSON.stringify(rv.slice(0,10)));
}

function renderRecentlyViewed(){
  const section=document.getElementById("recentlyViewedSection");
  const grid=document.getElementById("recentlyViewed");
  if(!section||!grid) return;

  const rv=JSON.parse(localStorage.getItem("abamartRecentlyViewed")||"[]");
  const seenNames=new Set();
  const items=[];
  rv.forEach(id=>{
    const p=products.find(x=>x.id===id);
    if(p && !seenNames.has(p.name)){items.push(p);seenNames.add(p.name);}
  });

  section.hidden=items.length===0;
  grid.innerHTML=items.map(productCard).join("");
}

/* ---------- shop page: filter + sort + render ---------- */
function renderShopGrid(){

  const grid = document.getElementById("products");

  if(!grid || !isShopPage) return;


  // Start with all products
  let list = products.slice();


  // ==========================================
  // FILTER BY CATEGORY
  // ==========================================

  if(activeGroup){

    list = list.filter(
      p => p.group === activeGroup
    );

  }


  // ==========================================
  // FILTER BY SUBCATEGORY
  // ==========================================

  if(activeSubcategory){

    list = list.filter(
      p => p.subcategory === activeSubcategory
    );

  }


  // ==========================================
  // SEARCH
  // ==========================================

  if(searchTerm){

    const q =
      searchTerm.toLowerCase();

    list = list.filter(p =>

      (
        p.name + " " +
        p.cat + " " +
        p.group + " " +
        (p.subcategory || "")
      )
      .toLowerCase()
      .includes(q)

    );

  }


  // ==========================================
  // PRICE FILTER
  // ==========================================

  if(minPrice != null){

    list = list.filter(
      p => Number(p.price) >= minPrice
    );

  }


  if(maxPrice != null){

    list = list.filter(
      p => Number(p.price) <= maxPrice
    );

  }


  // ==========================================
  // STOCK FILTER
  // ==========================================

  if(inStockOnly){

    list = list.filter(
      p => p.stock !== "out"
    );

  }


  // ==========================================
  // BRAND FILTER
  // ==========================================

  if(activeBrands.size > 0){

    list = list.filter(
      p => activeBrands.has(p.brand)
    );

  }


  // ==========================================
  // SORT
  // ==========================================

  if(sortMode === "price-asc"){

    list.sort(
      (a,b) =>
        Number(a.price) -
        Number(b.price)
    );

  }

  else if(sortMode === "price-desc"){

    list.sort(
      (a,b) =>
        Number(b.price) -
        Number(a.price)
    );

  }

  else if(sortMode === "name"){

    list.sort(
      (a,b) =>
        a.name.localeCompare(b.name)
    );

  }

  else if(sortMode === "newest"){

    list.sort(
      (a,b) =>
        Number(b.id) -
        Number(a.id)
    );

  }

  else {

    list.sort(
      (a,b) =>
        Number(b.reviews || 0) -
        Number(a.reviews || 0)
    );

  }


  // ==========================================
  // PAGINATE — 40 products per page, reset to
  // page 1 whenever the active filters/search/
  // sort change (but not on a plain page click)
  // ==========================================

  const filterKey = JSON.stringify({
    activeGroup, activeSubcategory, searchTerm,
    minPrice, maxPrice, inStockOnly,
    brands: [...activeBrands].sort(),
    sortMode
  });

  if(filterKey !== _lastShopFilterKey){
    currentPage = 1;
    _lastShopFilterKey = filterKey;
  }

  const totalPages = Math.max(1, Math.ceil(list.length / PRODUCTS_PER_PAGE));
  if(currentPage > totalPages) currentPage = totalPages;
  if(currentPage < 1) currentPage = 1;

  const pageList = list.slice(
    (currentPage - 1) * PRODUCTS_PER_PAGE,
    currentPage * PRODUCTS_PER_PAGE
  );


  // ==========================================
  // DISPLAY PRODUCTS
  // ==========================================

  grid.innerHTML =
    pageList.map(productCard).join("");

  renderShopPagination(currentPage, totalPages);


  // ==========================================
  // RESULT COUNT
  // ==========================================

  const countEl =
    document.getElementById("resultCount");

  if(countEl){

    countEl.textContent =
      list.length;

  }


  // ==========================================
  // ACTIVE FILTER LABEL
  // ==========================================

  const labelEl =
    document.getElementById("activeFilterLabel");


  if(labelEl){

    const parts = [];


    if(activeGroup){

      parts.push(
        `Category: "${activeGroup}"`
      );

    }


    if(activeSubcategory){

      parts.push(
        `Subcategory: "${activeSubcategory}"`
      );

    }


    if(searchTerm){

      parts.push(
        `Search: "${searchTerm}"`
      );

    }


    if(minPrice != null || maxPrice != null){

      parts.push(
        "Price range"
      );

    }


    if(inStockOnly){

      parts.push(
        "In stock only"
      );

    }


    labelEl.textContent =
      parts.join(" · ");

  }


  // ==========================================
  // EMPTY STATE
  // ==========================================

  const emptyEl =
    document.getElementById("emptyState");


  if(emptyEl){

    emptyEl.hidden =
      list.length > 0;


    if(searchTerm){

      emptyEl.textContent =
        `No products found for "${searchTerm}".`;

    }

    else if(activeSubcategory){

      emptyEl.textContent =
        `No products found in "${activeSubcategory}" yet.`;

    }

    else if(activeGroup){

      emptyEl.textContent =
        `No products found in "${activeGroup}" yet.`;

    }

    else {

      emptyEl.textContent =
        "No products match these filters yet.";

    }

  }


  // ==========================================
  // SHOW / HIDE CLEAR BUTTON
  // ==========================================

  const hasActiveFilters =
    activeGroup ||
    activeSubcategory ||
    searchTerm ||
    minPrice != null ||
    maxPrice != null ||
    inStockOnly ||
    activeBrands.size > 0;


  const clearBtn =
    document.getElementById("clearFilter");


  if(clearBtn){

    clearBtn.hidden =
      !hasActiveFilters;

  }

}

/* ============================================================
   SHOP PAGE PAGINATION — numbered pages, 40 products each
   ============================================================ */
function buildPaginationItems(current, total){
  if(total <= 1) return [];

  const pages = new Set([1, total]);
  for(let i = current - 1; i <= current + 1; i++){
    if(i >= 1 && i <= total) pages.add(i);
  }
  if(total >= 3){
    pages.add(total - 1);
    pages.add(total - 2 >= 1 ? total - 2 : total - 1);
  }

  const sorted = [...pages].filter(p => p >= 1 && p <= total).sort((a,b)=>a-b);

  const items = [];
  let prev = 0;
  sorted.forEach(p => {
    if(prev){
      if(p - prev === 2){
        items.push({type:"page", num: prev + 1});
      } else if(p - prev > 2){
        items.push({type:"dots"});
      }
    }
    items.push({type:"page", num:p});
    prev = p;
  });
  return items;
}

function renderShopPagination(current, total){
  const nav = document.getElementById("shopPagination");
  if(!nav) return;

  if(total <= 1){
    nav.innerHTML = "";
    nav.hidden = true;
    return;
  }
  nav.hidden = false;

  const items = buildPaginationItems(current, total);

  let html = "";

  if(current > 1){
    html += `<button class="page-btn page-arrow" data-page="${current-1}" aria-label="Previous page"><i class="fa-solid fa-chevron-left"></i></button>`;
  }

  items.forEach(item => {
    if(item.type === "dots"){
      html += `<span class="page-dots">…</span>`;
    } else {
      html += `<button class="page-btn${item.num===current?" active":""}" data-page="${item.num}" aria-label="Page ${item.num}"${item.num===current?' aria-current="page"':""}>${item.num}</button>`;
    }
  });

  if(current < total){
    html += `<button class="page-btn page-arrow" data-page="${current+1}" aria-label="Next page"><i class="fa-solid fa-chevron-right"></i></button>`;
  }

  nav.innerHTML = html;
}

function setActiveGroup(
  group,
  subcategory = null,
  updateUrl = true
){

  activeGroup =
    group || null;


  activeSubcategory =
    subcategory || null;


  // Highlight category in sidebar
  document
    .querySelectorAll(".cat-toggle")
    .forEach(btn => {

      btn.classList.toggle(
        "active-filter",
        btn.dataset.filter === activeGroup
      );

    });


  // ==========================================
  // UPDATE URL
  // ==========================================

  if(updateUrl){

    const params =
      new URLSearchParams();


    if(activeGroup){

      params.set(
        "cat",
        activeGroup
      );

    }


    if(activeSubcategory){

      params.set(
        "sub",
        activeSubcategory
      );

    }


    const query =
      params.toString();


    history.pushState(
      {},
      "",
      query
        ? `shop.html?${query}`
        : "shop.html"
    );

  }


  renderShopGrid();

}
/* =========================================================
   DYNAMIC SHOP CATEGORY SIDEBAR EVENTS
   ========================================================= */

document.addEventListener(
  "click",
  event => {

    const toggle =
      event.target.closest(
        "#shopCategoryList .cat-toggle"
      );


    if (toggle) {

      const panel =
        toggle.nextElementSibling;


      const isOpen =
        toggle.getAttribute(
          "aria-expanded"
        ) === "true";


      document
        .querySelectorAll(
          "#shopCategoryList .cat-toggle"
        )
        .forEach(other => {

          if (other !== toggle) {

            other.setAttribute(
              "aria-expanded",
              "false"
            );

            other.classList.remove(
              "open"
            );

            const otherPanel =
              other.nextElementSibling;

            if (otherPanel) {

              otherPanel.style.maxHeight =
                null;

            }

          }

        });


      toggle.setAttribute(
        "aria-expanded",
        isOpen
          ? "false"
          : "true"
      );


      toggle.classList.toggle(
        "open",
        !isOpen
      );


      if (panel) {

        panel.style.maxHeight =
          !isOpen
            ? panel.scrollHeight +
              "px"
            : null;

      }


      setActiveGroup(
        toggle.dataset.filter,
        null
      );


      return;
    }


    const link =
      event.target.closest(
        "#shopCategoryList .cat-panel a"
      );


    if (!link) {
      return;
    }


    event.preventDefault();


    const group =
      link.dataset.filter ||
      null;


    const subcategory =
      link.dataset.subcategory ||
      null;


    setActiveGroup(
      group,
      subcategory
    );


    document
      .getElementById(
        "products"
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

  }
);
function applyShopCategoryFromUrl() {

  if (!isShopPage) {
    return;
  }


  const params =
    new URLSearchParams(
      location.search
    );


  const category =
    params.get("cat");


  const subcategory =
    params.get("sub");


  if (!category) {
    return;
  }


  const toggle =
    Array.from(
      document.querySelectorAll(
        "#shopCategoryList .cat-toggle"
      )
    ).find(
      button =>
        button.dataset.filter ===
        category
    );


  if (toggle) {

    const panel =
      toggle.nextElementSibling;


    toggle.setAttribute(
      "aria-expanded",
      "true"
    );


    toggle.classList.add(
      "open"
    );


    if (panel) {

      panel.style.maxHeight =
        panel.scrollHeight +
        "px";

    }

  }


  activeGroup =
    category || null;


  activeSubcategory =
    subcategory || null;


  renderShopGrid();

}
if(isShopPage){
  /* accordion */
  const toggles=document.querySelectorAll(".cat-toggle");
  toggles.forEach(btn=>{
    const panel=btn.nextElementSibling;
    btn.addEventListener("click",()=>{
      const willOpen=btn.getAttribute("aria-expanded")!=="true";
      toggles.forEach(other=>{
        if(other!==btn){
          other.setAttribute("aria-expanded","false");
          other.classList.remove("open");
          other.nextElementSibling.style.maxHeight=null;
        }
      });
      btn.setAttribute("aria-expanded",willOpen?"true":"false");
      btn.classList.toggle("open",willOpen);
      panel.style.maxHeight=willOpen?panel.scrollHeight+"px":null;
      setActiveGroup(btn.dataset.filter);
    });
  });
  // open the category requested via ?cat= (from the header dropdown), else the first one
// ==========================================
// READ CATEGORY / SUBCATEGORY FROM URL
// ==========================================

const urlParams =
  new URLSearchParams(location.search);


const urlGroup =
  urlParams.get("cat");


const urlSubcategory =
  urlParams.get("sub");


// Find the matching sidebar category
const selectedToggle =
  Array.from(toggles).find(
    btn =>
      btn.dataset.filter === urlGroup
  );


// If a category was selected
if(selectedToggle){

  selectedToggle.setAttribute(
    "aria-expanded",
    "true"
  );


  selectedToggle.classList.add(
    "open"
  );


  selectedToggle.classList.add(
    "active-filter"
  );


  const panel =
    selectedToggle.nextElementSibling;


  if(panel){

    panel.style.maxHeight =
      panel.scrollHeight + "px";

  }

}


// Set filters from URL
activeGroup =
  urlGroup || null;


activeSubcategory =
  urlSubcategory || null;
  // pre-fill from ?search= (e.g. arriving from the homepage search bar)
  const urlSearch=new URLSearchParams(location.search).get("search");
  if(urlSearch){
    searchTerm=urlSearch;
    if(searchInput) searchInput.value=urlSearch;
  }

  /* subcategory links */
  document.querySelectorAll(".cat-panel a, .sidebar-promo a").forEach(a=>{
    a.addEventListener("click",e=>{
      const group=a.dataset.filter;
      if(group){
        e.preventDefault();
        setActiveGroup(group);
        document.getElementById("products")?.scrollIntoView({behavior:"smooth",block:"start"});
      }
    });
  });

  /* clear filter */
  const clearBtn=document.getElementById("clearFilter");
  if(clearBtn){
    clearBtn.addEventListener("click",()=>{
      document.querySelectorAll(".cat-toggle").forEach(b=>b.classList.remove("active-filter"));
      searchTerm="";
      if(searchInput) searchInput.value="";
      minPrice=null;
      maxPrice=null;
      inStockOnly=false;
      activeBrands.clear();
      const minEl=document.getElementById("minPrice");
      const maxEl=document.getElementById("maxPrice");
      if(minEl) minEl.value="";
      if(maxEl) maxEl.value="";
      const stockEl=document.getElementById("inStockOnly");
      if(stockEl) stockEl.checked=false;
      document.querySelectorAll(".brand-list input[type=checkbox]").forEach(cb=>cb.checked=false);
      const url=new URL(location.href);
      url.searchParams.delete("search");
      history.replaceState(null,"",url);
      setActiveGroup(null);
    });
  }

  /* sort */
  const sortSelect=document.getElementById("sort");
  if(sortSelect){
    sortSelect.addEventListener("change",()=>{
      sortMode=sortSelect.value;
      renderShopGrid();
    });
  }

  /* price range */
  const minPriceEl=document.getElementById("minPrice");
  const maxPriceEl=document.getElementById("maxPrice");
  function applyPriceRange(){
    const minVal=minPriceEl&&minPriceEl.value!==""?Number(minPriceEl.value):null;
    const maxVal=maxPriceEl&&maxPriceEl.value!==""?Number(maxPriceEl.value):null;
    minPrice=minVal!=null&&!isNaN(minVal)?minVal:null;
    maxPrice=maxVal!=null&&!isNaN(maxVal)?maxVal:null;
    renderShopGrid();
  }
  if(minPriceEl) minPriceEl.addEventListener("change",applyPriceRange);
  if(maxPriceEl) maxPriceEl.addEventListener("change",applyPriceRange);

  /* in stock only */
  const inStockEl=document.getElementById("inStockOnly");
  if(inStockEl){
    inStockEl.addEventListener("change",()=>{
      inStockOnly=inStockEl.checked;
      renderShopGrid();
    });
  }

  /* brand list — built from the distinct brands in the catalog */
  const brandListEl=document.getElementById("brandList");
  if(brandListEl){
    const brands=[...new Set(products.map(p=>p.brand).filter(Boolean))].sort();
    brandListEl.innerHTML=brands.map(b=>
      `<label class="filter-checkbox"><input type="checkbox" value="${b}"><span>${b}</span></label>`
    ).join("");
    brandListEl.addEventListener("change",e=>{
      const cb=e.target.closest("input[type=checkbox]");
      if(!cb) return;
      cb.checked?activeBrands.add(cb.value):activeBrands.delete(cb.value);
      renderShopGrid();
    });
  }

  /* pagination */
  const paginationEl=document.getElementById("shopPagination");
  if(paginationEl){
    paginationEl.addEventListener("click",e=>{
      const btn=e.target.closest(".page-btn");
      if(!btn) return;
      const page=Number(btn.dataset.page);
      if(!page || page===currentPage) return;
      currentPage=page;
      renderShopGrid();
      document.getElementById("products")?.scrollIntoView({behavior:"smooth",block:"start"});
    });
  }

  renderShopGrid();
  renderRecentlyViewed();
}

/* ---------- header mega-menu (shared by index.html + shop.html) ---------- */
/* ==========================================
   HEADER CATEGORY MENU
   Works with dynamically loaded categories
========================================== */

document.addEventListener("click", e => {

  const link = e.target.closest(
    "#categoriesMenu [data-filter]"
  );

  // Not a category link
  if (!link) return;


  // ==========================================
  // HOMEPAGE
  // Let the normal link work.
  // Do NOT prevent it.
  // ==========================================

  if (!isShopPage) {

    return;

  }


  // ==========================================
  // SHOP PAGE
  // Filter products without reloading
  // ==========================================

  e.preventDefault();


  const group =
    link.dataset.filter || null;


  const subcategory =
    link.dataset.subcategory || null;


  if (
    typeof setActiveGroup === "function"
  ) {

    setActiveGroup(
      group,
      subcategory
    );

  }


  document
    .getElementById("products")
    ?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

});

document.querySelectorAll(".sale-grid .add, .spotlight .add").forEach(b=>{
  b.addEventListener("click",()=>add(Number(b.dataset.id)));
});

buildCartDrawer();
const cartBtn=document.getElementById("cart");
if(cartBtn) cartBtn.onclick=()=>openCart();
const cartTabBtn=document.getElementById("cartTab");
if(cartTabBtn) cartTabBtn.onclick=()=>openCart();

buildWishlistDrawer();
document.querySelectorAll(".wishlist-link").forEach(link=>{
  link.addEventListener("click",e=>{
    e.preventDefault();
    openWishlistDrawer();
  });
});

/* ============================================================
   MOBILE CATEGORY MENU — built from the existing header
   category list, so it always matches (no duplicated markup)
   ============================================================ */
function buildMenuDrawer(){
  if(document.getElementById("menuDrawer")) return;
  const catsWrap=document.querySelector(".categories .cats");
  if(!catsWrap) return;

  const wrap=document.createElement("div");
  wrap.innerHTML=`
    <div id="menuOverlay" class="menu-overlay"></div>
    <aside id="menuDrawer" class="menu-drawer" aria-hidden="true">
      <div class="menu-drawer-head">
        <h3>Categories</h3>
        <button id="menuClose" aria-label="Close menu">✕</button>
      </div>
      <div id="menuList" class="menu-list"></div>
    </aside>`;
  document.body.append(...wrap.childNodes);

  const list=document.getElementById("menuList");
  const allLink=catsWrap.querySelector("a.all");
  if(allLink){
    list.insertAdjacentHTML("beforeend",
      `<a class="menu-all" href="${allLink.getAttribute("href")}" data-filter="">${allLink.textContent.trim()}</a>`);
  }

  catsWrap.querySelectorAll(".cat-drop").forEach(drop=>{
    const top=drop.querySelector(":scope > a");
    if(!top) return;
    const label=top.childNodes[0]?top.childNodes[0].textContent.trim():top.textContent.trim();
const subs = [...drop.querySelectorAll(".mega a")]
  .map(a => `
    <li>
      <a
        href="${a.getAttribute("href")}"
        data-filter="${a.dataset.filter || ""}"
        data-subcategory="${a.dataset.subcategory || ""}"
      >
        ${a.textContent.trim()}
      </a>
    </li>
  `)
  .join("");
    list.insertAdjacentHTML("beforeend",`
      <div class="menu-group">
        <button class="menu-toggle-cat" data-filter="${top.dataset.filter||''}">
          <span>${label}</span>
          <svg class="chev" viewBox="0 0 24 24" width="11" height="11"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="menu-sub"><ul>${subs}</ul></div>
      </div>`);
  });

  list.querySelectorAll(".menu-toggle-cat").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const panel=btn.nextElementSibling;
      const willOpen=!btn.classList.contains("open");
      list.querySelectorAll(".menu-toggle-cat").forEach(b=>{
        b.classList.remove("open");
        b.nextElementSibling.style.maxHeight=null;
      });
      if(willOpen){
        btn.classList.add("open");
        panel.style.maxHeight=panel.scrollHeight+"px";
      }
    });
  });

list.querySelectorAll("a[data-filter]").forEach(a => {

  a.addEventListener("click", e => {

    closeMenu();


    // On homepage, allow the normal URL navigation
    if (!isShopPage) return;


    e.preventDefault();


    const group =
      a.dataset.filter || null;


    const subcategory =
      a.dataset.subcategory || null;


    // SHOP → show everything
    if (!group) {

      document
        .getElementById("clearFilter")
        ?.click();

      return;

    }


    // Filter using category + subcategory
    if (typeof setActiveGroup === "function") {

      setActiveGroup(
        group,
        subcategory
      );

    }


    document
      .getElementById("products")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

  });

});

  document.getElementById("menuOverlay").addEventListener("click",closeMenu);
  document.getElementById("menuClose").addEventListener("click",closeMenu);
}

function openMenu(){
  buildMenuDrawer();
  document.getElementById("menuDrawer")?.classList.add("open");
  document.getElementById("menuOverlay")?.classList.add("open");
  document.getElementById("menuDrawer")?.setAttribute("aria-hidden","false");
  document.body.classList.add("menu-open");
}
function closeMenu(){
  document.getElementById("menuDrawer")?.classList.remove("open");
  document.getElementById("menuOverlay")?.classList.remove("open");
  document.getElementById("menuDrawer")?.setAttribute("aria-hidden","true");
  document.body.classList.remove("menu-open");
}
const menuToggleBtn=document.getElementById("menuToggle");
if(menuToggleBtn) menuToggleBtn.onclick=openMenu;

/* ============================================================
   QUICK VIEW — modal preview from the eye icon button on product cards
   ============================================================ */
function buildQuickViewModal(){
  if(document.getElementById("quickViewModal")) return;
  const wrap=document.createElement("div");
  wrap.innerHTML=`
    <div class="qv-modal" id="quickViewModal">
      <div class="qv-box">
        <button class="qv-close" id="qvClose" aria-label="Close quick view">✕</button>
        <div class="qv-media" id="qvMedia"></div>
        <div class="qv-body">
          <small id="qvCat"></small>
          <h2 id="qvName"></h2>
          <strong id="qvPrice"></strong>
          <div class="qv-qty">
            <button id="qvMinus" aria-label="Decrease quantity">−</button>
            <span id="qvQty">1</span>
            <button id="qvPlus" aria-label="Increase quantity">+</button>
          </div>
          <div class="qv-actions">
            <button id="qvAdd" class="cta qv-add">Add to cart</button>
            <button id="qvWish" class="qv-wish" aria-label="Add to wishlist">${heartIcon(false)}</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.append(...wrap.childNodes);

  document.getElementById("qvClose").addEventListener("click",closeQuickView);
  document.getElementById("quickViewModal").addEventListener("click",e=>{
    if(e.target.id==="quickViewModal") closeQuickView();
  });
  document.getElementById("qvMinus").addEventListener("click",()=>{
    qvQty=Math.max(1,qvQty-1);
    document.getElementById("qvQty").textContent=qvQty;
  });
  document.getElementById("qvPlus").addEventListener("click",()=>{
    qvQty++;
    document.getElementById("qvQty").textContent=qvQty;
  });
document.getElementById("qvAdd").addEventListener("click", () => {

  if (qvId != null) {

    addQty(
      qvId,
      qvQty,
      qvSelectedOption
    );

  }

  closeQuickView();

});
  document.getElementById("qvWish").addEventListener("click",()=>{
    if(qvId==null) return;
    onWishBtnClick(document.getElementById("qvWish"),qvId);
  });
}

let qvId = null;
let qvQty = 1;
let qvSelectedOption = null;


async function quickView(id) {

  buildQuickViewModal();


  const p = products.find(
    x => Number(x.id) === Number(id)
  );


  if (!p) return;


  qvId = Number(id);
  qvQty = 1;
  qvSelectedOption = null;


  trackRecentlyViewed(id);


  // ==========================================
  // SHOW PRODUCT IMAGE
  // ==========================================

  document.getElementById("qvMedia").innerHTML =
    p.image
      ? `<img src="${p.image}" alt="${p.name}">`
      : `
        <div
          class="qv-emoji"
          style="background:${p.bg || "#edf6ef"}"
        >
          ${p.emoji || "🛒"}
        </div>
      `;


  document.getElementById("qvCat").textContent =
    p.cat || "";


  document.getElementById("qvName").textContent =
    p.name;


  document.getElementById("qvQty").textContent =
    qvQty;


  // ==========================================
  // LOAD PRODUCT OPTIONS
  // ==========================================

  const options =
    await loadProductOptions(p.id);


  console.log(
    "QUICK VIEW OPTIONS:",
    p.name,
    options
  );


  // Select first option automatically
  if (options.length > 0) {

    qvSelectedOption =
      options[0];

  }


  // ==========================================
  // SHOW OPTIONS
  // ==========================================

  let optionsBox =
    document.getElementById("qvOptions");


  if (!optionsBox) {

    const priceEl =
      document.getElementById("qvPrice");


    priceEl.insertAdjacentHTML(
      "afterend",
      `
        <div
          class="qv-options"
          id="qvOptions"
        ></div>
      `
    );


    optionsBox =
      document.getElementById("qvOptions");

  }


  if (options.length > 0) {

    optionsBox.innerHTML = `

      <div class="qv-options-title">
        Choose quantity:
      </div>


      <div class="qv-options-list">

        ${options.map((option, index) => `

          <button
            type="button"
            class="qv-option ${
              index === 0
                ? "selected"
                : ""
            }"
            data-option-index="${index}"
          >
            ${
              option.name ||
              option.option_name ||
              option.label ||
              "Option"
            }
          </button>

        `).join("")}

      </div>

    `;


    // Option click
    optionsBox
      .querySelectorAll(".qv-option")
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            const index =
              Number(
                button.dataset.optionIndex
              );


            qvSelectedOption =
              options[index];


            // Remove old selected button
            optionsBox
              .querySelectorAll(".qv-option")
              .forEach(btn =>
                btn.classList.remove("selected")
              );


            // Mark new selection
            button.classList.add("selected");


            // Change displayed price
            const optionPrice =
              Number(
                qvSelectedOption.price ??
                qvSelectedOption.option_price ??
                p.price
              );


            document.getElementById(
              "qvPrice"
            ).textContent =
              money(optionPrice);

          }
        );

      });

  } else {

    // Product has no options
    optionsBox.innerHTML = "";

  }


  // ==========================================
  // SET INITIAL PRICE
  // ==========================================

  const initialPrice =
    qvSelectedOption
      ? Number(
          qvSelectedOption.price ??
          qvSelectedOption.option_price ??
          p.price
        )
      : Number(p.price);


  document.getElementById(
    "qvPrice"
  ).textContent =
    money(initialPrice);


  // ==========================================
  // WISHLIST
  // ==========================================

  const wishBtn =
    document.getElementById("qvWish");


  setWishIcon(
    wishBtn,
    isWishlisted(id)
  );


  wishBtn.setAttribute(
    "aria-label",
    isWishlisted(id)
      ? "Remove from wishlist"
      : "Add to wishlist"
  );


  // ==========================================
  // OPEN MODAL
  // ==========================================

  document
    .getElementById("quickViewModal")
    .classList.add("open");


  document.body.classList.add("qv-open");

}


// Called from inline onclick in productCard()
window.quickView = quickView;
function closeQuickView(){
  document.getElementById("quickViewModal")?.classList.remove("open");
  document.body.classList.remove("qv-open");
}
window.quickView=quickView; // called from inline onclick in productCard()

/* ============================================================
   PRODUCT DETAIL PAGE (product.html?id=..)
   ============================================================ */
function productDescription(p){
  return p.Description || p.description || "No description available for this product.";
}

function renderRelatedProducts(current){
  const grid=document.getElementById("relatedGrid");
  if(!grid) return;
  const seen=new Set([current.id]);
  let related=products.filter(x=>x.group===current.group && !seen.has(x.id));
  // de-dupe (the catalog has a few repeated ids/names)
  const unique=[];
  const usedNames=new Set();
  related.forEach(x=>{
    if(!usedNames.has(x.name)){unique.push(x);usedNames.add(x.name);}
  });
  if(unique.length===0){
    products.forEach(x=>{
      if(!seen.has(x.id) && !usedNames.has(x.name)){unique.push(x);usedNames.add(x.name);}
    });
  }
  grid.innerHTML=unique.slice(0,4).map(productCard).join("");
}
async function loadProductsWithOptions() {

  const { data, error } = await supabaseClient
    .from("product_options")
    .select("product_id");

  if (error) {
    console.error(
      "FAILED TO LOAD PRODUCTS WITH OPTIONS:",
      error
    );

    return;
  }

  productsWithOptions = new Set(
    (data || []).map(
      item => Number(item.product_id)
    )
  );

  console.log(
    "PRODUCTS WITH OPTIONS:",
    [...productsWithOptions]
  );
}
async function loadProductOptions(productId) {
  const { data, error } = await supabaseClient
    .from("product_options")
    .select("*")
    .eq("product_id", Number(productId))
    .order("display_order", { ascending: true });

  if (error) {
    console.error("FAILED TO LOAD PRODUCT OPTIONS:", error);
    return [];
  }

  return data || [];
}
async function loadProductsWithOptions() {

  const {
    data,
    error
  } = await supabaseClient
    .from("product_options")
    .select("product_id");


  if (error) {

    console.error(
      "FAILED TO LOAD PRODUCT OPTIONS:",
      error
    );

    return;

  }


  productsWithOptions =
    new Set(
      (data || [])
        .map(
          item => Number(item.product_id)
        )
    );


  console.log(
    "PRODUCTS WITH OPTIONS:",
    [...productsWithOptions]
  );

}
const productOptionsCache = {};


async function hasProductOptions(productId) {

  if (
    productOptionsCache[productId] !== undefined
  ) {
    return productOptionsCache[productId];
  }


  const options =
    await loadProductOptions(productId);


  productOptionsCache[productId] =
    options.length > 0;


  return productOptionsCache[productId];

}
// ==========================================
// LOAD CATEGORIES AND SUBCATEGORIES
// ==========================================

async function loadCategories() {

  console.log(
    "LOADING CATEGORIES FROM SUPABASE..."
  );


  const {
    data: categoriesData,
    error: categoriesError
  } =
    await supabaseClient
      .from("categories")
      .select("*")
      .order("display_order", {
        ascending: true
      })
      .order("name", {
        ascending: true
      });


  if (categoriesError) {

    console.error(
      "FAILED TO LOAD CATEGORIES:",
      categoriesError
    );

    return;

  }


  const {
    data: subcategoriesData,
    error: subcategoriesError
  } =
    await supabaseClient
      .from("subcategories")
      .select("*")
      .order("name", {
        ascending: true
      });


  if (subcategoriesError) {

    console.error(
      "FAILED TO LOAD SUBCATEGORIES:",
      subcategoriesError
    );

    return;

  }


  categories =
    categoriesData || [];

  subcategories =
    subcategoriesData || [];


  console.log(
    "CATEGORIES LOADED:",
    categories
  );

  console.log(
    "SUBCATEGORIES LOADED:",
    subcategories
  );


  /*
   * Header menu.
   */
  renderCategoriesMenu();


  /*
   * Shop sidebar.
   */
  renderShopCategorySidebar();

}

/* =========================================================
   SHOP SIDEBAR — REAL SUPABASE CATEGORIES
   ========================================================= */

function renderShopCategorySidebar() {

  const list =
    document.getElementById(
      "shopCategoryList"
    );


  if (!list) {
    return;
  }


  if (!categories.length) {

    list.innerHTML = `
      <div class="shop-category-empty">
        No categories available.
      </div>
    `;

    return;
  }


  const icons = [
    "🛒",
    "🥤",
    "🥦",
    "🥣",
    "🥩",
    "🍪",
    "🧹",
    "🛀",
    "🍼",
    "🏠",
    "✨"
  ];


  list.innerHTML =
    categories.map(
      (category, index) => {

        const categorySubs =
          subcategories.filter(
            sub =>
              Number(
                sub.category_id
              ) ===
              Number(
                category.id
              )
          );


        const icon =
          icons[
            index %
            icons.length
          ];


        const categoryName =
          String(
            category.name || ""
          );


        const categoryUrl =
          `shop.html?cat=${
            encodeURIComponent(
              categoryName
            )
          }`;


        const subHtml =
          categorySubs.length
            ? `
              <div
                class="cat-panel"
              >
                <ul>
                  ${
                    categorySubs
                      .map(sub => {

                        const subName =
                          String(
                            sub.name || ""
                          );


                        return `
                          <li>
                            <a
                              href="shop.html?cat=${encodeURIComponent(categoryName)}&sub=${encodeURIComponent(subName)}"
                              data-filter="${escapeHtmlAttribute(categoryName)}"
                              data-subcategory="${escapeHtmlAttribute(subName)}"
                            >
                              ${escapeHtml(subName)}
                            </a>
                          </li>
                        `;

                      })
                      .join("")
                  }
                </ul>
              </div>
            `
            : "";


        return `
          <div
            class="cat-group"
          >

            <button
              type="button"
              class="cat-toggle"
              data-filter="${escapeHtmlAttribute(categoryName)}"
              aria-expanded="false"
            >

              <span
                class="cat-name"
              >
                <i>${icon}</i>
                ${escapeHtml(categoryName)}
              </span>

              ${
                categorySubs.length
                  ? `
                    <svg
                      class="chev"
                      viewBox="0 0 24 24"
                      width="13"
                      height="13"
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.4"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  `
                  : ""
              }

            </button>

            ${subHtml}

          </div>
        `;

      }
    ).join("");

}

// ==========================================
// DISPLAY CATEGORIES IN HEADER
// ==========================================

function renderCategoriesMenu() {

  const menu =
    document.getElementById("categoriesMenu");


  // Stop if this page doesn't have the menu
  if (!menu) return;


  // Keep the SHOP link
  menu.innerHTML = `
    <a class="all" href="shop.html">
      SHOP →
    </a>
  `;


  categories.forEach(category => {

    // Get subcategories belonging to this category
    const categorySubs =
      subcategories.filter(
        sub =>
          Number(sub.category_id) ===
          Number(category.id)
      );


    // Create category link
    const categoryUrl =
      `shop.html?cat=${encodeURIComponent(category.name)}`;


    // If there are no subcategories
    if (categorySubs.length === 0) {

      menu.insertAdjacentHTML(
        "beforeend",

        `
        <div class="cat-drop">
          <a
            href="${categoryUrl}"
            data-filter="${category.name}"
          >
            ${category.name}
          </a>
        </div>
        `
      );

      return;
    }


    // Create subcategory links
    const subcategoriesHTML =
      categorySubs.map(sub => {

        const subUrl =
          `shop.html?cat=${encodeURIComponent(category.name)}&sub=${encodeURIComponent(sub.name)}`;


        return `
          <li>
            <a
              href="${subUrl}"
              data-filter="${category.name}"
              data-subcategory="${sub.name}"
            >
              ${sub.name}
            </a>
          </li>
        `;

      }).join("");


    // Create category dropdown
    menu.insertAdjacentHTML(
      "beforeend",

      `
      <div class="cat-drop">

        <a
          href="${categoryUrl}"
          data-filter="${category.name}"
        >
          ${category.name}

          <svg
            class="chev"
            viewBox="0 0 24 24"
            width="9"
            height="9"
          >
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              stroke-width="2.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>

        </a>


        <div class="mega">
          <ul>
            ${subcategoriesHTML}
          </ul>
        </div>

      </div>
      `
    );

  });

}
async function renderProductPage(){

  const el = document.getElementById("pdpContent");

  if(!el) return;


  const id = Number(
    new URLSearchParams(location.search).get("id")
  );


  const p = products.find(
    x => Number(x.id) === id
  );


  if(!p){

    el.innerHTML = `
      <div class="pdp-empty">
        <h2>Product not found</h2>
        <p>
          The product you're looking for doesn't exist
          or may have been removed.
        </p>
        <a class="cta" href="shop.html">
          ← Back to shop
        </a>
      </div>
    `;

    document.getElementById(
      "relatedSection"
    )?.remove();

    return;
  }


  trackRecentlyViewed(p.id);


  document.title =
    `${p.name} | Buyzoo24`;


  const crumbCat =
    document.getElementById("crumbCat");

  if(crumbCat){
    crumbCat.textContent = p.name;
  }


  // ==========================================
  // LOAD PRODUCT OPTIONS FROM SUPABASE
  // ==========================================

  const options =
    await loadProductOptions(p.id);


  console.log(
    "PRODUCT OPTIONS FOR",
    p.name,
    options
  );


  // First option is selected automatically
  let selectedOption =
    options.length > 0
      ? options[0]
      : null;


  const visual = p.image
    ? `<img src="${p.image}" alt="${p.name}">`
    : `
      <div
        class="pdp-emoji"
        style="background:${p.bg || '#edf6ef'}"
      >
        ${p.emoji || "🛒"}
      </div>
    `;


  const wished =
    isWishlisted(p.id);


  // ==========================================
  // CREATE OPTIONS HTML
  // ==========================================

  const optionsHTML =
    options.length > 0
      ? `
        <div class="pdp-options">

          <div class="pdp-options-title">
            Choose quantity:
          </div>

          <div id="pdpOptionsList">

            ${options.map((option, index) => `

              <button
                type="button"
                class="pdp-option ${index === 0 ? "selected" : ""}"
                data-option-id="${option.id}"
                data-option-index="${index}"
              >
                ${option.name || option.option_name || option.label || "Option"}
              </button>

            `).join("")}

          </div>

        </div>
      `
      : "";


  // ==========================================
  // USE OPTION PRICE OR NORMAL PRODUCT PRICE
  // ==========================================

  const firstPrice =
    selectedOption
      ? Number(
          selectedOption.price ??
          selectedOption.option_price ??
          p.price
        )
      : Number(p.price);


  el.innerHTML = `

    <div class="pdp-gallery">
      <div class="pdp-main-image">
        ${visual}
      </div>
    </div>


    <div class="pdp-info">

      <small class="pdp-cat">
        ${p.cat || ""}
      </small>


      <h1>${p.name}</h1>


      ${starsMarkup(
        p.rating,
        p.reviews
      )}


      <div
        class="pdp-price"
        id="pdpPrice"
      >
        ${money(firstPrice)}
      </div>


      <p class="pdp-desc">
        ${productDescription(p)}
      </p>


      ${optionsHTML}


      <div class="pdp-meta">

        <div>
          <span>Category</span>
          <b>${p.group || p.cat || ""}</b>
        </div>

        <div>
          <span>Availability</span>
          <b>
            ${p.stock ?? 0} available
          </b>
        </div>

        <div>
          <span>Delivery</span>
          <b>Fast delivery in Kigali</b>
        </div>

      </div>


      <div class="pdp-qty">

        <button
          id="pdpMinus"
          aria-label="Decrease quantity"
        >
          −
        </button>

        <span id="pdpQty">1</span>

        <button
          id="pdpPlus"
          aria-label="Increase quantity"
        >
          +
        </button>

      </div>


      <div class="pdp-actions">

        <button
          class="cta"
          id="pdpAdd"
          type="button"
        >
          Add to cart
        </button>


        <button
          class="cta-ghost"
          id="pdpBuyNow"
          type="button"
        >
          Buy now
        </button>


        <button
          class="pdp-wish${wished ? " active" : ""}"
          id="pdpWish"
          type="button"
          aria-label="${
            wished
              ? "Remove from wishlist"
              : "Add to wishlist"
          }"
        >
          ${heartIcon(wished)}
        </button>

      </div>


      <div class="pdp-badges">
        <span>🚚 Fast delivery</span>
        <span>🔒 Secure checkout</span>
        <span>↩ Easy returns</span>
      </div>

    </div>
  `;


  // ==========================================
  // SELECT PRODUCT OPTION
  // ==========================================

  const optionButtons =
    el.querySelectorAll(".pdp-option");


  optionButtons.forEach(button => {

    button.addEventListener("click", () => {

      const index =
        Number(
          button.dataset.optionIndex
        );


      selectedOption =
        options[index];


      // Remove selected state
      optionButtons.forEach(btn =>
        btn.classList.remove("selected")
      );


      // Add selected state
      button.classList.add("selected");


      // Update displayed price
      const optionPrice =
        Number(
          selectedOption.price ??
          selectedOption.option_price ??
          p.price
        );


      document.getElementById(
        "pdpPrice"
      ).textContent =
        money(optionPrice);


      console.log(
        "SELECTED PRODUCT OPTION:",
        selectedOption
      );

    });

  });


  // ==========================================
  // QUANTITY CONTROLS
  // ==========================================

  let qty = 1;


  document.getElementById(
    "pdpMinus"
  ).addEventListener("click", () => {

    qty = Math.max(1, qty - 1);

    document.getElementById(
      "pdpQty"
    ).textContent = qty;

  });


  document.getElementById(
    "pdpPlus"
  ).addEventListener("click", () => {

    qty++;

    document.getElementById(
      "pdpQty"
    ).textContent = qty;

  });


  // ==========================================
  // ADD TO CART
  // ==========================================

document.getElementById("pdpAdd").addEventListener("click", () => {

  addQty(
    p.id,
    qty,
    selectedOption
  );

  openCart();

});

}
renderProductPage();

/* ============================================================
   WISHLIST PAGE (wishlist.html) — lists every saved product
   ============================================================ */
function renderWishlistPage(){
  const grid=document.getElementById("wishlistGrid");
  if(!grid) return;

  // de-dupe by name (the catalog has a few repeated ids/names)
  const seenNames=new Set();
  const items=[];
  wishlist.forEach(id=>{
    const p=products.find(x=>x.id===id);
    if(p && !seenNames.has(p.name)){items.push(p);seenNames.add(p.name);}
  });

  const countEl=document.getElementById("wishlistResultCount");
  if(countEl) countEl.textContent=items.length;

  const clearBtn=document.getElementById("clearWishlist");
  if(clearBtn) clearBtn.hidden=items.length===0;

  const emptyEl=document.getElementById("wishlistEmpty");
  if(emptyEl) emptyEl.hidden=items.length>0;

  grid.hidden=items.length===0;
  grid.innerHTML=items.map(productCard).join("");
}

const clearWishlistBtn=document.getElementById("clearWishlist");
if(clearWishlistBtn){
  clearWishlistBtn.addEventListener("click",()=>{
    if(wishlist.length===0) return;
    if(!confirm("Remove all products from your wishlist?")) return;
    wishlist=[];
    saveWishlist();
    updateWishlistBadge();
    renderWishlistPage();
    toast("Wishlist cleared");
  });
}
renderWishlistPage();

function runSearch(){
  if(!searchInput) return;
  const q=searchInput.value.trim();
  if(isShopPage){
    // already on the shop page: filter the grid in place, no reload
    searchTerm=q;
    const url=new URL(location.href);
    q?url.searchParams.set("search",q):url.searchParams.delete("search");
    history.replaceState(null,"",url);
    renderShopGrid();
  }else{
    // on any other page: send the shopper to the shop with the search applied
    location.href="shop.html"+(q?("?search="+encodeURIComponent(q)):"");
  }
}

/* ---------- live search suggestions dropdown (every page with a search bar) ---------- */
const searchBox=searchInput?searchInput.closest(".search"):null;
let searchSuggestEl=null;

function buildSearchSuggest(){
  if(!searchBox||searchSuggestEl) return;
  searchSuggestEl=document.createElement("div");
  searchSuggestEl.id="searchSuggest";
  searchSuggestEl.className="search-suggest";
  searchBox.appendChild(searchSuggestEl);

  document.addEventListener("click",e=>{
    if(!searchBox.contains(e.target)) closeSearchSuggest();
  });
  searchInput.addEventListener("keydown",e=>{if(e.key==="Escape")closeSearchSuggest()});
}

function openSearchSuggest(){searchSuggestEl?.classList.add("open");}
function closeSearchSuggest(){searchSuggestEl?.classList.remove("open");}

const SEARCH_SUGGEST_MIN_CHARS=3;


function renderSearchSuggest(query) {

  if (!searchSuggestEl) return;

  const q = query.trim().toLowerCase();


  // Only start searching after 3 characters
  if (q.length < 3) {
    closeSearchSuggest();
    searchSuggestEl.innerHTML = "";
    return;
  }


  const seenNames = new Set();


  const matches = products.filter(p => {

    const name = (p.name || "").trim();

    if (!name) return false;


    // Prevent duplicate products
    if (seenNames.has(name.toLowerCase())) {
      return false;
    }


    const productName =
      name.toLowerCase();

    const category =
      (p.cat || "").toLowerCase();

    const subcategory =
      (p.group || "").toLowerCase();


    const hit =
      productName.includes(q) ||
      category.includes(q) ||
      subcategory.includes(q);


    if (hit) {
      seenNames.add(name.toLowerCase());
    }


    return hit;

  }).slice(0, 6);


  console.log(
    "SEARCH:",
    q,
    "MATCHES:",
    matches
  );


  const list = matches.map(p => {

    const visual = p.image
      ? `<img src="${p.image}" alt="${p.name}">`
      : `
        <div
          class="search-suggest-emoji"
          style="background:${p.bg || "#edf6ef"}"
        >
          ${p.emoji || "🛒"}
        </div>
      `;


    return `
      <div
        class="search-suggest-item"
        data-id="${p.id}"
        role="button"
        tabindex="0"
      >

        <div class="search-suggest-pic">
          ${visual}
        </div>

        <div class="search-suggest-body">
          <b>${p.name}</b>
          <small>${p.cat || ""}</small>
        </div>

        <span class="search-suggest-price">
          ${money(p.price)}
        </span>

      </div>
    `;

  }).join("");


  searchSuggestEl.innerHTML = `

    <div class="search-suggest-list">

      ${
        matches.length
          ? list
          : `
            <div class="search-suggest-empty">
              No products found for "${query.trim()}"
            </div>
          `
      }

    </div>

    <div class="search-suggest-viewall">
      View all results for "${query.trim()}" →
    </div>

  `;


  // Click product → open product page
  searchSuggestEl
    .querySelectorAll(".search-suggest-item")
    .forEach(item => {

      item.addEventListener("click", () => {

        location.href =
          "product.html?id=" +
          item.dataset.id;

      });

    });


  // View all → go to shop with search
  const viewAll =
    searchSuggestEl.querySelector(
      ".search-suggest-viewall"
    );


  if (viewAll) {

    viewAll.addEventListener("click", () => {

      location.href =
        "shop.html?search=" +
        encodeURIComponent(
          query.trim()
        );

    });

  }


  openSearchSuggest();

}

// ==========================================
// CUSTOMER ACCOUNT IN HEADER
// ==========================================






// ==========================================
// SEARCH EVENTS
// ==========================================

if (searchBtn && searchInput) {

  buildSearchSuggest();


  // Search button
  searchBtn.onclick = () => {

    const value =
      searchInput.value.trim();


    if (!value) return;


    location.href =
      "shop.html?search=" +
      encodeURIComponent(value);

  };


  // Typing in search box
  searchInput.addEventListener("input", () => {

    const value =
      searchInput.value.trim();


    console.log(
      "SEARCH INPUT:",
      value,
      "PRODUCT COUNT:",
      products.length
    );


    if (value.length >= 3) {

      renderSearchSuggest(value);

    } else {

      closeSearchSuggest();

      if (searchSuggestEl) {
        searchSuggestEl.innerHTML = "";
      }

    }


    // On shop page, continue filtering products
    if (isShopPage) {

      searchTerm = value;

      renderShopGrid();

    }

  });


  // Press Enter
  searchInput.addEventListener("keydown", e => {

    if (e.key === "Enter") {

      e.preventDefault();

      const value =
        searchInput.value.trim();


      if (value) {

        location.href =
          "shop.html?search=" +
          encodeURIComponent(value);

      }

    }

  });


  // Focus with existing text
  searchInput.addEventListener("focus", () => {

    const value =
      searchInput.value.trim();

    if (value.length >= 3) {
      renderSearchSuggest(value);
    }

  });

}
const newsletterForm=document.getElementById("newsletter");
if(newsletterForm){
  newsletterForm.addEventListener("submit",e=>{
    e.preventDefault();
    e.target.reset();
    toast("Subscribed successfully ✓");
  });
}

update();
updateWishlistBadge();

/* ---------- scroll-reveal for .reveal sections ---------- */
if("IntersectionObserver" in window){
  const io=new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  },{threshold:0.12,rootMargin:"0px 0px -40px 0px"});
  document.querySelectorAll(".reveal").forEach(el=>io.observe(el));
}else{
  document.querySelectorAll(".reveal").forEach(el=>el.classList.add("in"));
}

/* ─── Loading Screen ────────────────────────────────── */
(function () {
  const loader = document.getElementById('loader');
  const bar = document.getElementById('loader-bar');
  if(!loader || !bar) return;

  document.body.classList.add('loading');

  let progress = 0;

  const interval = setInterval(() => {
    const step = progress < 70 ? 1.8 : progress < 90 ? 0.8 : 1.5;
    progress = Math.min(progress + step, 100);
    bar.style.width = progress + '%';

    if (progress >= 100) {
      clearInterval(interval);
      setTimeout(() => {
        loader.classList.add('hidden');
        document.body.classList.remove('loading');
      }, 200);
    }
  }, 30);

  setTimeout(() => {
    loader.classList.add('hidden');
    document.body.classList.remove('loading');
  }, 800);
})();
// ==========================================
// UPDATE HEADER CUSTOMER ACCOUNT
// ==========================================

// ==========================================
// UPDATE CUSTOMER NAME IN HEADER
// ==========================================

async function updateHeaderAccount() {

  const desktopAccountLink =
    document.getElementById("headerAccount");

  const desktopAccountName =
    document.getElementById("headerAccountName");

  const mobileAccountLink =
    document.getElementById("accountLink");

  const mobileAccountName =
    document.getElementById("accountName");

  const adminDashboardLink =
    document.getElementById("adminDashboardLink");


  function setAccountUI(name, href) {

    if (desktopAccountName) {
      desktopAccountName.textContent =
        name;
    }

    if (desktopAccountLink) {
      desktopAccountLink.href =
        href;
    }

    if (mobileAccountName) {
      mobileAccountName.textContent =
        name;
    }

    if (mobileAccountLink) {
      mobileAccountLink.href =
        href;
    }

  }


  function setAdminDashboardUI(
    visible,
    fromAdmin = false
  ) {

    if (!adminDashboardLink) {
      return;
    }

    adminDashboardLink.hidden =
      !visible;

    if (visible && fromAdmin) {

      adminDashboardLink.innerHTML = `
        <i class="fa-solid fa-arrow-left"></i>
        <span>Back to Admin Dashboard</span>
      `;

    } else if (visible) {

      adminDashboardLink.innerHTML = `
        <i class="fa-solid fa-gauge-high"></i>
        <span>Admin Dashboard</span>
      `;

    }

  }


  try {

    if (
      typeof supabaseClient ===
      "undefined"
    ) {

      setAccountUI(
        "Account",
        "login.html"
      );

      setAdminDashboardUI(false);

      return;
    }


    const {
      data: { session },
      error: sessionError
    } =
      await supabaseClient.auth
        .getSession();


    if (sessionError) {
      throw sessionError;
    }


    if (
      !session ||
      !session.user
    ) {

      setAccountUI(
        "Account",
        "login.html"
      );

      setAdminDashboardUI(false);

      return;
    }


    const user =
      session.user;


    console.log(
      "HEADER LOGGED IN USER:",
      user.id
    );


    /*
     * Get the customer's profile AND
     * admin role in the same query.
     */
    const {
      data: profile,
      error: profileError
    } =
      await supabaseClient
        .from("profiles")
        .select(`
          full_name,
          is_admin,
          admin_role
        `)
        .eq("id", user.id)
        .maybeSingle();


    if (profileError) {

      console.error(
        "HEADER PROFILE ERROR:",
        profileError
      );

    }


    const fullName =
      profile?.full_name?.trim() ||
      user.user_metadata?.full_name?.trim() ||
      user.user_metadata?.name?.trim() ||
      user.email?.split("@")[0] ||
      "My Account";


    const firstName =
      fullName.split(/\s+/)[0] ||
      "My Account";


    /*
     * Determine whether this account
     * is allowed to access admin.
     */
    const authorizedAdmin =
      profile?.is_admin === true ||
      [
        "super_admin",
        "product_manager",
        "order_manager",
        "marketing_manager"
      ].includes(
        profile?.admin_role
      );


    /*
     * Check whether the current page
     * came from the admin panel.
     */
    const fromAdmin =
      new URLSearchParams(
        window.location.search
      ).get("fromAdmin") === "1";


    setAccountUI(
      firstName,
      "account.html"
    );


    setAdminDashboardUI(
      authorizedAdmin,
      fromAdmin
    );


    console.log(
      "HEADER NAME DISPLAYED:",
      firstName
    );


    console.log(
      "AUTHORIZED ADMIN:",
      authorizedAdmin
    );


  } catch (error) {

    console.error(
      "HEADER ACCOUNT ERROR:",
      error
    );


    setAccountUI(
      "Account",
      "login.html"
    );


    setAdminDashboardUI(false);

  }

}
// ==========================================
// RUN WHEN PAGE LOADS
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {

  /*
   * Load categories and subcategories FIRST.
   * This must happen for both logged-out
   * and logged-in customers.
   */
  await loadCategories();

  /*
   * Then initialize the customer account UI.
   */
  await updateHeaderAccount();

  /*
   * Customer notifications.
   */
  await loadCustomerNotifications();

  subscribeToCustomerNotifications();

});


// ==========================================
// UPDATE NAME AFTER LOGIN OR LOGOUT
// ==========================================

if (
  typeof supabaseClient !== "undefined" &&
  supabaseClient.auth
) {

  supabaseClient.auth.onAuthStateChange(() => {

    updateHeaderAccount();

  });

}
document.addEventListener("DOMContentLoaded", async () => {

  /*
   * Load categories and subcategories FIRST.
   * This must happen for both logged-out
   * and logged-in customers.
   */
  await loadCategories();

  /*
   * Then initialize the customer account UI.
   */
  await updateHeaderAccount();

  /*
   * Customer notifications.
   */
  await loadCustomerNotifications();

  subscribeToCustomerNotifications();

});
// ==========================================
// CUSTOMER NOTIFICATIONS
// ==========================================

let customerNotificationChannel = null;


async function loadCustomerNotifications() {

  if (typeof supabaseClient === "undefined") {
    return;
  }

  try {

    const {
      data: { user }
    } = await supabaseClient.auth.getUser();


    if (!user) {
      return;
    }


    const {
      data,
      error
    } = await supabaseClient
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order(
        "created_at",
        { ascending: false }
      )
      .limit(30);


    if (error) {
      throw error;
    }


    renderCustomerNotifications(data || []);


  } catch (error) {

    console.error(
      "CUSTOMER NOTIFICATIONS ERROR:",
      error
    );

  }

}


function renderCustomerNotifications(items) {

  const badge =
    document.getElementById(
      "customerNotificationBadge"
    );


  const unread =
    items.filter(
      item => !item.is_read
    ).length;


  if (badge) {

    badge.textContent =
      unread > 99 ? "99+" : unread;

    badge.hidden =
      unread === 0;

  }


  const list =
    document.getElementById(
      "customerNotificationList"
    );


  if (!list) {
    return;
  }


  if (!items.length) {

    list.innerHTML =
      `<div class="customer-notification-empty">
        No notifications yet
      </div>`;

    return;

  }


  list.innerHTML =
    items.map(item => `

      <button
        type="button"
        class="customer-notification-item ${
          item.is_read ? "" : "unread"
        }"
      >

        <strong>
          ${item.title}
        </strong>

        <span>
          ${item.message}
        </span>

        <small>
          ${new Date(
            item.created_at
          ).toLocaleString()}
        </small>

      </button>

    `).join("");

}


async function subscribeToCustomerNotifications() {

  if (
    typeof supabaseClient === "undefined" ||
    customerNotificationChannel
  ) {
    return;
  }


  const {
    data: { user }
  } = await supabaseClient
    .auth
    .getUser();


  if (!user) {
    return;
  }


  customerNotificationChannel =
    supabaseClient
      .channel(
        "customer-notifications-" +
        user.id
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter:
            "user_id=eq." + user.id
        },
        payload => {

          console.log(
            "NEW CUSTOMER NOTIFICATION:",
            payload.new
          );


          loadCustomerNotifications();

        }
      )
      .subscribe();

}

/* HOMEPAGE POPULAR PRODUCTS AUTO SLIDER
   PC: 6 visible, move 3 / 2 sec
   Tablet: 3 visible, move 2 / 2 sec
   Mobile: 2 visible, move 1 / 2 sec */
let popularProductsData=[];
let popularProductsStart=0;
let popularProductsTimer=null;

function getPopularProductsSettings(){
  if(window.innerWidth<=650)return{visible:2,move:1};
  if(window.innerWidth<=950)return{visible:3,move:2};
  return{visible:6,move:3};
}

function renderPopularProductsWindow(){
  const grid=document.getElementById("products");
  if(!grid||!popularProductsData.length)return;
  const {visible}=getPopularProductsSettings();
  const count=popularProductsData.length;
  const visibleProducts=[];
  for(let i=0;i<visible;i++){
    visibleProducts.push(popularProductsData[(popularProductsStart+i)%count]);
  }
  grid.innerHTML=visibleProducts.map(productCard).join("");
}

function slidePopularProducts(){
  if(!popularProductsData.length)return;
  const grid=document.getElementById("products");
  if(!grid)return;
  const {move}=getPopularProductsSettings();

  grid.style.transform="translateX(-45px)";
  grid.style.opacity="0";

  setTimeout(()=>{
    popularProductsStart=(popularProductsStart+move)%popularProductsData.length;
    renderPopularProductsWindow();
    grid.style.transition="none";
    grid.style.transform="translateX(45px)";

    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        grid.style.transition="transform .55s ease,opacity .55s ease";
        grid.style.transform="translateX(0)";
        grid.style.opacity="1";
      });
    });
  },320);
}

function startPopularProductsSlider(items){
  popularProductsData=Array.isArray(items)?items:[];
  popularProductsStart=0;
  clearInterval(popularProductsTimer);
  renderPopularProductsWindow();
  if(popularProductsData.length>getPopularProductsSettings().visible){
    popularProductsTimer=setInterval(slidePopularProducts,3000);
  }
}

let popularProductsResizeTimer;
window.addEventListener("resize",()=>{
  clearTimeout(popularProductsResizeTimer);
  popularProductsResizeTimer=setTimeout(()=>{
    if(!popularProductsData.length)return;
    renderPopularProductsWindow();
    clearInterval(popularProductsTimer);
    if(popularProductsData.length>getPopularProductsSettings().visible){
      popularProductsTimer=setInterval(slidePopularProducts,3000);
    }
  },200);
});

// ==========================================
// SNACKS SLIDER — identical behavior/design to
// the Popular Products slider above, kept as its
// own copy (own data/id) so neither can affect
// or break the other.
// ==========================================
let snacksProductsData=[];
let snacksProductsStart=0;
let snacksProductsTimer=null;

function renderSnacksProductsWindow(){
  const grid=document.getElementById("snacksProducts");
  if(!grid||!snacksProductsData.length)return;
  const {visible}=getPopularProductsSettings();
  const count=snacksProductsData.length;
  const visibleProducts=[];
  for(let i=0;i<visible;i++){
    visibleProducts.push(snacksProductsData[(snacksProductsStart+i)%count]);
  }
  grid.innerHTML=visibleProducts.map(productCard).join("");
}

function slideSnacksProducts(){
  if(!snacksProductsData.length)return;
  const grid=document.getElementById("snacksProducts");
  if(!grid)return;
  const {move}=getPopularProductsSettings();

  grid.style.transform="translateX(-45px)";
  grid.style.opacity="0";

  setTimeout(()=>{
    snacksProductsStart=(snacksProductsStart+move)%snacksProductsData.length;
    renderSnacksProductsWindow();
    grid.style.transition="none";
    grid.style.transform="translateX(45px)";

    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        grid.style.transition="transform .55s ease,opacity .55s ease";
        grid.style.transform="translateX(0)";
        grid.style.opacity="1";
      });
    });
  },320);
}

function startSnacksProductsSlider(items){
  snacksProductsData=Array.isArray(items)?items:[];
  snacksProductsStart=0;
  clearInterval(snacksProductsTimer);
  renderSnacksProductsWindow();
  if(snacksProductsData.length>getPopularProductsSettings().visible){
    snacksProductsTimer=setInterval(slideSnacksProducts,3000);
  }
}

let snacksProductsResizeTimer;
window.addEventListener("resize",()=>{
  clearTimeout(snacksProductsResizeTimer);
  snacksProductsResizeTimer=setTimeout(()=>{
    if(!snacksProductsData.length)return;
    renderSnacksProductsWindow();
    clearInterval(snacksProductsTimer);
    if(snacksProductsData.length>getPopularProductsSettings().visible){
      snacksProductsTimer=setInterval(slideSnacksProducts,3000);
    }
  },200);
});

// ==========================================
// BABY FEATURE AUTO SLIDER
// ==========================================

let babyFeatureSlideIndex = 0;
let babyFeatureSliderTimer = null;


function startBabyFeatureSlider() {

  const grid =
    document.getElementById("babyFeatureGrid");

  if (!grid) {
    return;
  }


  // Wait until products are loaded
const products =
  grid.querySelectorAll(".card");

  if (products.length <= 1) {
    return;
  }


  // Stop an old slider if this function runs again
  if (babyFeatureSliderTimer) {

    clearInterval(babyFeatureSliderTimer);

  }


  babyFeatureSlideIndex = 0;


  function getVisibleProducts() {

    // PC = 2
    if (window.innerWidth > 900) {
      return 2;
    }

    // Tablet = 1
    if (window.innerWidth > 600) {
      return 1;
    }

    // Mobile = 1
    return 1;
  }


  function slideBabyProducts() {

    const visibleProducts =
      getVisibleProducts();


  const allProducts =
  grid.querySelectorAll(".card");

    const totalProducts =
      allProducts.length;


    if (totalProducts <= visibleProducts) {

      grid.style.transform =
        "translateX(0px)";

      babyFeatureSlideIndex = 0;

      return;
    }


    const firstProduct =
      allProducts[0];


    const productWidth =
      firstProduct.offsetWidth;


    const gap = 12;


    // Move one product at a time
    babyFeatureSlideIndex++;


    const maxIndex =
      totalProducts - visibleProducts;


    // Return to first product
    if (babyFeatureSlideIndex > maxIndex) {

      babyFeatureSlideIndex = 0;

    }


    const moveAmount =
      babyFeatureSlideIndex *
      (productWidth + gap);


    grid.style.transform =
      `translateX(-${moveAmount}px)`;

  }


  // Slide every 2 seconds
  babyFeatureSliderTimer =
    setInterval(
      slideBabyProducts,
      2000
    );

}
/* =========================================================
   FASSOKO — NEW ARRIVALS SYSTEM
========================================================= */

let newArrivalsProducts = [];

let newArrivalsRealtimeChannel = null;


/* =========================================================
   START NEW ARRIVALS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    initNewArrivals();

});


/* =========================================================
   INITIALIZE
========================================================= */

async function initNewArrivals() {

    const track = document.getElementById("newArrivalsTrack");

    if (!track) {

        console.log("NEW ARRIVALS: Section not found.");

        return;

    }


    console.log("NEW ARRIVALS: Starting...");


    setupNewArrivalsNavigation();


    await loadNewArrivals();


    setupNewArrivalsRealtime();

}


/* =========================================================
   LOAD PRODUCTS FROM SUPABASE
========================================================= */

async function loadNewArrivals() {

    const loading = document.getElementById(
        "newArrivalsLoading"
    );

    const empty = document.getElementById(
        "newArrivalsEmpty"
    );

    const track = document.getElementById(
        "newArrivalsTrack"
    );


    if (!track) return;


    try {

        loading.style.display = "flex";

        empty.style.display = "none";


        /* --------------------------------------------
           CHECK SUPABASE
        --------------------------------------------- */
if (
    typeof supabaseClient === "undefined" ||
    !supabaseClient
) {
    throw new Error(
        "Supabase client is not available."
    );
}


        console.log(
            "NEW ARRIVALS: Loading products..."
        );


        /* --------------------------------------------
           LOAD PRODUCTS
        --------------------------------------------- */

        const { data, error } = await supabaseClient
    .from("Products")
    .select(`
        *,
        categories(id,name,slug),
        subcategories(id,name,slug)
    `)
    .eq("is_active", true)
    .eq("is_new_arrival", true)
    .order("display_order", {
        ascending: true
    })
    .limit(16);


        if (error) {

            throw error;

        }


        console.log(
            "NEW ARRIVALS PRODUCTS:",
            data
        );


      newArrivalsProducts = (data || []).map(p => ({

    ...p,

    image: p.image_url || "",

    cat:
        p.categories?.name ||
        "Uncategorized",

    group:
        p.categories?.name ||
        "Uncategorized",

    category_id: p.category_id,

    subcategory:
        p.subcategories?.name ||
        "",

    subcategory_id:
        p.subcategory_id,

    stock:
        p.stock === "out" ||
        p.stock === 0 ||
        p.stock === false
            ? "out"
            : "in",

    rating:
        Number(p.rating || 5),

    reviews:
        Number(p.reviews || 0)

}));


        loading.style.display = "none";


        /* --------------------------------------------
           EMPTY
        --------------------------------------------- */

        if (

            newArrivalsProducts.length === 0

        ) {

            empty.style.display = "block";

            track.innerHTML = "";

            return;

        }


        /* --------------------------------------------
           RENDER
        --------------------------------------------- */

        renderNewArrivals();


    }

    catch (error) {

        console.error(

            "NEW ARRIVALS ERROR:",

            error

        );


        loading.style.display = "none";


        track.innerHTML = `

            <div class="new-arrivals-empty">

                <div class="new-arrivals-empty-icon">

                    ⚠️

                </div>

                <h3>

                    Unable to load new arrivals

                </h3>

                <p>

                    Please try again later.

                </p>

            </div>

        `;

    }

}


function renderNewArrivals() {

    const track =
        document.getElementById(
            "newArrivalsTrack"
        );


    if (!track) return;


    /* =====================================================
       STOP OLD SLIDER
    ===================================================== */

    stopNewArrivalsAutoplay();


    /* =====================================================
       RESET POSITION
    ===================================================== */

    track.scrollLeft = 0;


    /* =====================================================
       RENDER PRODUCTS
    ===================================================== */

track.innerHTML = newArrivalsProducts
    .map(product => {

        /*
        USE THE SAME PRODUCT CARD DESIGN
        USED EVERYWHERE ELSE ON THE WEBSITE

        IMPORTANT: the shared productCard() markup is wrapped
        in a ".new-arrival-card" container so the slider CSS
        (card width) and slider JS (card width detection,
        prev/next, autoplay, progress dots) can actually find
        and size the cards. Without this wrapper the cards
        rendered as plain ".card" elements with no slide
        sizing, which is why the slider never moved before.
        */

        if (typeof productCard === "function") {

            return `<div class="new-arrival-card" data-product-id="${product.id}">${productCard(product)}</div>`;

        }

        /*
        FALLBACK ONLY IF productCard DOES NOT EXIST
        */

        return createNewArrivalCard(product);

    })
    .join("");
    /* =====================================================
       EVENTS
    ===================================================== */

    bindNewArrivalEvents();


    /* =====================================================
       PROGRESS
    ===================================================== */

    updateNewArrivalsProgress();


    /* =====================================================
       START AUTOMATIC SLIDER
    ===================================================== */

    setTimeout(

        () => {

            startNewArrivalsAutoplay();

        },

        300

    );

}


/* =========================================================
   CREATE PRODUCT CARD
========================================================= */

function createNewArrivalCard(product) {

    const image = getNewArrivalImage(product);


    const name =

        escapeNewArrivalHTML(

            product.name ||

            product.product_name ||

            "Unnamed Product"

        );


    const category =

        escapeNewArrivalHTML(

            product.category ||

            product.cat ||

            "Fassoko"

        );


    const price =

        Number(

            product.price ||

            product.sale_price ||

            0

        );


    const oldPrice =

        Number(

            product.old_price ||

            product.original_price ||

            0

        );


    const productId =

        product.id;


    const formattedPrice =

        formatNewArrivalMoney(

            price

        );


    const formattedOldPrice =

        oldPrice > price

            ? `

                <span

                    class="new-arrival-old-price"

                >

                    ${formatNewArrivalMoney(oldPrice)}

                </span>

            `

            : "";


    return `

        <article

            class="new-arrival-card"

            data-product-id="${productId}"

        >


            <!-- IMAGE -->

            <div

                class="new-arrival-image"

            >


                <!-- NEW BADGE -->

                <span

                    class="new-arrival-badge"

                >

                    NEW

                </span>


                <!-- WISHLIST -->

                <button

                    type="button"

                    class="new-arrival-wishlist"

                    data-wishlist-product="${productId}"

                    aria-label="Add to wishlist"

                >

                    ♡

                </button>


                <!-- PRODUCT IMAGE -->

                <img

                    src="${image}"

                    alt="${name}"

                    loading="lazy"

                >


                <!-- ACTIONS -->

                <div

                    class="new-arrival-actions"

                >


                    <button

                        type="button"

                        class="new-arrival-quick-view"

                        data-quick-view="${productId}"

                    >

                        Quick View

                    </button>


                    <button

                        type="button"

                        class="new-arrival-add-cart"

                        data-add-cart="${productId}"

                    >

                        Add to Cart

                    </button>


                </div>


            </div>


            <!-- PRODUCT INFORMATION -->

            <div

                class="new-arrival-info"

            >


                <span

                    class="new-arrival-category"

                >

                    ${category}

                </span>


                <div

                    class="new-arrival-name"

                    title="${name}"

                >

                    ${name}

                </div>


                <div

                    class="new-arrival-price-row"

                >

                    <span

                        class="new-arrival-price"

                    >

                        ${formattedPrice}

                    </span>


                    ${formattedOldPrice}


                </div>


            </div>


        </article>

    `;

}


/* =========================================================
   GET IMAGE
========================================================= */

function getNewArrivalImage(product) {

    const image =

        product.image ||

        product.image_url ||

        product.main_image ||

        product.thumbnail ||

        "";


    if (

        !image

    ) {

        return "images/placeholder.png";

    }


    return image;

}


/* =========================================================
   EVENTS
========================================================= */

function bindNewArrivalEvents() {


    /* --------------------------------------------
       WISHLIST
    --------------------------------------------- */

    document

        .querySelectorAll(

            "[data-wishlist-product]"

        )

        .forEach(

            button => {

                button.onclick =

                    async function (

                        event

                    ) {

                        event.stopPropagation();


                        const productId =

                            this.dataset

                                .wishlistProduct;


                        const product =

                            findNewArrivalProduct(

                                productId

                            );


                        if (!product) return;


                        await handleNewArrivalWishlist(

                            product,

                            this

                        );

                    };

            }

        );


    /* --------------------------------------------
       QUICK VIEW
    --------------------------------------------- */

    document

        .querySelectorAll(

            "[data-quick-view]"

        )

        .forEach(

            button => {

                button.onclick =

                    function (

                        event

                    ) {

                        event.stopPropagation();


                        const productId =

                            this.dataset

                                .quickView;


                        openNewArrivalQuickView(

                            productId

                        );

                    };

            }

        );


    /* --------------------------------------------
       ADD TO CART
    --------------------------------------------- */

    document

        .querySelectorAll(

            "[data-add-cart]"

        )

        .forEach(

            button => {

                button.onclick =

                    function (

                        event

                    ) {

                        event.stopPropagation();


                        const productId =

                            this.dataset

                                .addCart;


                        addNewArrivalToCart(

                            productId,

                            this

                        );

                    };

            }

        );


    /* --------------------------------------------
       PRODUCT CLICK
    --------------------------------------------- */

    document

        .querySelectorAll(

            ".new-arrival-card"

        )

        .forEach(

            card => {

                /*
                When the shared productCard() design is used,
                the card already contains its own <a> links
                (image + title) and its own wired-up buttons
                (wishlist / quick view / add to cart). Adding
                a whole-card click handler on top of that would
                fire an extra navigation on every click inside
                the card, including "Add to cart", so skip it
                for cards that already have a link.
                */

                if (card.querySelector("a")) return;


                card.onclick =

                    function () {

                        const id =

                            this.dataset

                                .productId;


                        window.location.href =

                            `product.html?id=${encodeURIComponent(id)}`;

                    };

            }

        );

}


/* =========================================================
   FIND PRODUCT
========================================================= */

function findNewArrivalProduct(productId) {

    return newArrivalsProducts.find(

        product =>

            String(product.id) ===

            String(productId)

    );

}


/* =========================================================
   WISHLIST
========================================================= */

async function handleNewArrivalWishlist(

    product,

    button

) {


    /* --------------------------------------------
       USE EXISTING WEBSITE FUNCTION
    --------------------------------------------- */

    if (

        typeof toggleWishlist ===

        "function"

    ) {

        await toggleWishlist(

            product.id

        );


        button.classList.toggle(

            "active"

        );


        button.innerHTML =

            button.classList.contains(

                "active"

            )

                ? "♥"

                : "♡";


        return;

    }


    /* --------------------------------------------
       FALLBACK
    --------------------------------------------- */

    console.warn(

        "Wishlist function not found."

    );


    button.classList.toggle(

        "active"

    );


    button.innerHTML =

        button.classList.contains(

            "active"

        )

            ? "♥"

            : "♡";

}


/* =========================================================
   ADD TO CART
========================================================= */

function addNewArrivalToCart(

    productId,

    button

) {

    const product =

        findNewArrivalProduct(

            productId

        );


    if (!product) return;


    /* --------------------------------------------
       EXISTING addToCart FUNCTION
    --------------------------------------------- */

    if (

        typeof addToCart ===

        "function"

    ) {

        try {


            /*
             IMPORTANT:

             We try product ID first because
             your current Fassoko system may
             already use IDs.
            */

            addToCart(

                productId

            );


        }

        catch (

            error

        ) {

            console.log(

                "Trying product object...",

                error

            );


            addToCart(

                product

            );

        }


        showNewArrivalAddedState(

            button

        );


        return;

    }


    console.warn(

        "addToCart function does not exist."

    );

}


/* =========================================================
   BUTTON SUCCESS STATE
========================================================= */

function showNewArrivalAddedState(

    button

) {

    const originalText =

        button.textContent;


    button.textContent =

        "Added ✓";


    button.disabled = true;


    setTimeout(

        () => {

            button.textContent =

                originalText;


            button.disabled = false;

        },

        1500

    );

}


/* =========================================================
   QUICK VIEW
========================================================= */

function openNewArrivalQuickView(

    productId

) {


    const product =

        findNewArrivalProduct(

            productId

        );


    if (!product) return;


    /*
     --------------------------------------------

     USE EXISTING QUICK VIEW FUNCTION IF IT EXISTS

     --------------------------------------------
    */

    if (

        typeof openQuickView ===

        "function"

    ) {

        openQuickView(

            productId

        );

        return;

    }


    /*
     --------------------------------------------

     USE EXISTING MODAL FUNCTION IF IT EXISTS

     --------------------------------------------
    */

    if (

        typeof showQuickView ===

        "function"

    ) {

        showQuickView(

            product

        );

        return;

    }


    /*
     --------------------------------------------

     FALLBACK

     Open product page.

     --------------------------------------------
    */

    window.location.href =

        `product.html?id=${encodeURIComponent(productId)}`;

}


/* =========================================================
   SLIDER NAVIGATION
========================================================= */

/* =========================================================
   NEW ARRIVALS NAVIGATION
========================================================= */

function setupNewArrivalsNavigation() {

    const track =
        document.getElementById("newArrivalsTrack");

    const previous =
        document.querySelector(".new-arrivals-prev");

    const next =
        document.querySelector(".new-arrivals-next");


    if (!track) return;


    /* =====================================================
       PREVIOUS BUTTON
    ===================================================== */

    previous?.addEventListener("click", () => {

        stopNewArrivalsAutoplay();

        moveNewArrivals("previous");

        restartNewArrivalsAutoplay();

    });


    /* =====================================================
       NEXT BUTTON
    ===================================================== */

    next?.addEventListener("click", () => {

        stopNewArrivalsAutoplay();

        moveNewArrivals("next");

        restartNewArrivalsAutoplay();

    });


    /* =====================================================
       UPDATE PROGRESS
    ===================================================== */

    track.addEventListener("scroll", () => {

        updateNewArrivalsProgress();

    });


    /* =====================================================
       PAUSE WHEN USER TOUCHES SLIDER
    ===================================================== */

    track.addEventListener("mouseenter", () => {

        stopNewArrivalsAutoplay();

    });


    track.addEventListener("mouseleave", () => {

        restartNewArrivalsAutoplay();

    });


    track.addEventListener("touchstart", () => {

        stopNewArrivalsAutoplay();

    }, {
        passive: true
    });


    track.addEventListener("touchend", () => {

        restartNewArrivalsAutoplay();

    }, {
        passive: true
    });

}

/* =========================================================
   NEW ARRIVALS AUTO SLIDER
========================================================= */

let newArrivalsSliderInterval = null;


/* =========================================================
   GET RESPONSIVE SLIDER SETTINGS
========================================================= */

function getNewArrivalsSliderSettings() {

    const width = window.innerWidth;


    /* MOBILE */

    if (width <= 700) {

        return {

            visible: 2,

            slide: 1

        };

    }


    /* TABLET */

    if (width <= 1024) {

        return {

            visible: 4,

            slide: 2

        };

    }


    /* DESKTOP */

    return {

        visible: 6,

        slide: 3

    };

}


/* =========================================================
   GET CARD WIDTH
========================================================= */

function getNewArrivalCardWidth() {

    const track =
        document.getElementById("newArrivalsTrack");


    const card =
        track?.querySelector(".new-arrival-card");


    if (!track || !card) {

        return 0;

    }


    const styles =
        window.getComputedStyle(track);


    const gap =
        parseFloat(styles.gap) || 20;


    return {

        width: card.offsetWidth,

        gap: gap

    };

}


/* =========================================================
   MOVE SLIDER
========================================================= */

function moveNewArrivals(direction = "next") {

    const track =
        document.getElementById("newArrivalsTrack");


    if (!track) return;


    const cards =
        track.querySelectorAll(".new-arrival-card");


    if (!cards.length) return;


    const settings =
        getNewArrivalsSliderSettings();


    const cardData =
        getNewArrivalCardWidth();


    if (!cardData) return;


    const amount =

        (
            cardData.width +
            cardData.gap
        )

        *

        settings.slide;


    const maxScroll =

        track.scrollWidth -

        track.clientWidth;


    /* =====================================================
       NEXT
    ===================================================== */

    if (direction === "next") {


        /*
         If we reach the end,
         go back to beginning.
        */

        if (

            track.scrollLeft +

            amount >=

            maxScroll - 10

        ) {

            track.scrollTo({

                left: 0,

                behavior: "smooth"

            });

        }

        else {

            track.scrollBy({

                left: amount,

                behavior: "smooth"

            });

        }


    }


    /* =====================================================
       PREVIOUS
    ===================================================== */

    else {


        if (

            track.scrollLeft <= 10

        ) {

            track.scrollTo({

                left: maxScroll,

                behavior: "smooth"

            });

        }

        else {

            track.scrollBy({

                left: -amount,

                behavior: "smooth"

            });

        }

    }

}


/* =========================================================
   START AUTO SLIDER
========================================================= */

function startNewArrivalsAutoplay() {

    stopNewArrivalsAutoplay();


    newArrivalsSliderInterval =

        setInterval(

            () => {

                moveNewArrivals("next");

            },

            2000

        );

}


/* =========================================================
   STOP AUTO SLIDER
========================================================= */

function stopNewArrivalsAutoplay() {

    if (

        newArrivalsSliderInterval

    ) {

        clearInterval(

            newArrivalsSliderInterval

        );


        newArrivalsSliderInterval = null;

    }

}


/* =========================================================
   RESTART AUTO SLIDER
========================================================= */

function restartNewArrivalsAutoplay() {

    stopNewArrivalsAutoplay();


    startNewArrivalsAutoplay();

}
/* =========================================================
   SCROLL AMOUNT
========================================================= */

function getNewArrivalScrollAmount() {

    const settings =
        getNewArrivalsSliderSettings();


    const cardData =
        getNewArrivalCardWidth();


    if (!cardData) {

        return 400;

    }


    return (

        cardData.width +

        cardData.gap

    )

    *

    settings.slide;

}


/* =========================================================
   PROGRESS DOTS
========================================================= */

/* =========================================================
   UPDATE NEW ARRIVALS PROGRESS
========================================================= */

function updateNewArrivalsProgress() {

    const track =
        document.getElementById(
            "newArrivalsTrack"
        );


    const progress =
        document.getElementById(
            "newArrivalsProgress"
        );


    if (

        !track ||

        !progress

    ) return;


    const cards =
        track.querySelectorAll(
            ".new-arrival-card"
        );


    if (

        cards.length === 0

    ) {

        progress.innerHTML = "";

        return;

    }


    const settings =
        getNewArrivalsSliderSettings();


    /*
     Number of products moved
     per slider movement
    */

    const pages =

        Math.ceil(

            cards.length /

            settings.slide

        );


    const maxScroll =

        track.scrollWidth -

        track.clientWidth;


    let percentage =

        maxScroll > 0

            ?

            track.scrollLeft /

            maxScroll

            :

            0;


    let activePage =

        Math.round(

            percentage *

            (

                pages - 1

            )

        );


    activePage =

        Math.max(

            0,

            Math.min(

                activePage,

                pages - 1

            )

        );


    progress.innerHTML =

        Array.from(

            {

                length: pages

            }

        )

        .map(

            (

                _,

                index

            ) =>

                `

                <span

                    class="new-arrivals-progress-dot

                    ${

                        index === activePage

                            ?

                            "active"

                            :

                            ""

                    }"

                ></span>

                `

        )

        .join("");

}


/* =========================================================
   REALTIME
========================================================= */

function setupNewArrivalsRealtime() {


    /*
     Prevent multiple subscriptions
    */

    if (

        newArrivalsRealtimeChannel

    ) {

        return;

    }


  if (
    typeof supabaseClient ===
    "undefined" ||
    !supabaseClient
) {
    console.warn(
        "NEW ARRIVALS REALTIME: Supabase client unavailable."
    );

    return;
}


    try {


       newArrivalsRealtimeChannel =

    supabaseClient

        .channel(

                    "fassoko-new-arrivals"

                )

                .on(

                    "postgres_changes",

                    {

                        event: "*",

                        schema: "public",

                        table: "products"

                    },

                    () => {

                        console.log(

                            "NEW ARRIVALS: Product changed. Refreshing..."

                        );


                        loadNewArrivals();

                    }

                )

                .subscribe();


    }

    catch (

        error

    ) {

        console.warn(

            "NEW ARRIVALS REALTIME ERROR:",

            error

        );

    }

}


/* =========================================================
   MONEY
========================================================= */

function formatNewArrivalMoney(

    amount

) {

    const number =

        Number(amount) ||

        0;


    /*
     If your existing money() function exists,
     use it.
    */

    if (

        typeof money ===

        "function"

    ) {

        return money(

            number

        );

    }


    return (

        number.toLocaleString()

        +

        " RWF"

    );

}


/* =========================================================
   SECURITY / HTML ESCAPE
========================================================= */

function escapeNewArrivalHTML(

    value

) {

    return String(

        value ||

        ""

    )

        .replace(

            /&/g,

            "&amp;"

        )

        .replace(

            /</g,

            "&lt;"

        )

        .replace(

            />/g,

            "&gt;"

        )

        .replace(

            /"/g,

            "&quot;"

        )

        .replace(

            /'/g,

            "&#039;"

        );

}
/* =========================================================
   RESPONSIVE SLIDER RESET
========================================================= */

let newArrivalsResizeTimer;


window.addEventListener(

    "resize",

    () => {


        clearTimeout(

            newArrivalsResizeTimer

        );


        newArrivalsResizeTimer =

            setTimeout(

                () => {


                    const track =

                        document.getElementById(

                            "newArrivalsTrack"

                        );


                    if (

                        track

                    ) {

                        track.scrollLeft = 0;

                    }


                    updateNewArrivalsProgress();


                    restartNewArrivalsAutoplay();


                },

                300

            );

    }

);