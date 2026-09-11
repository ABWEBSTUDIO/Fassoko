// ==========================================
// FASSOKO CUSTOMER ACCOUNT
// ==========================================


// ==========================================
// ELEMENT HELPER
// ==========================================

function $(id) {
  return document.getElementById(id);
}


// ==========================================
// STATE
// ==========================================

let currentUser = null;
let currentProfile = null;
let customerOrders = [];
let mobileOrderFilter = "all";
let accountProducts = [];


// ==========================================
// START ACCOUNT PAGE
// ==========================================

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    console.log(
      "LOADING CUSTOMER ACCOUNT..."
    );


    await loadAccount();


    setupLogout();


    updateCartCount();


    updateWishlistStat();

    buildAccountDrawers();
    loadAccountDrawerProducts();

  }
);


// ==========================================
// LOAD ACCOUNT
// ==========================================

// ==========================================
// LOAD ACCOUNT
// ==========================================

async function loadAccount() {

  try {

    const {
      data: {
        session
      },
      error: sessionError
    } =
      await supabaseClient
        .auth
        .getSession();


    if (sessionError) {
      throw sessionError;
    }


    // ======================================
    // USER NOT LOGGED IN
    // ======================================

    if (!session?.user) {

      $("notLoggedIn").hidden =
        false;

      return;

    }


    currentUser =
      session.user;


    console.log(
      "ACCOUNT USER:",
      currentUser
    );


    // ======================================
    // LOAD PROFILE
    // ======================================

    const {
      data: profile,
      error: profileError
    } =
      await supabaseClient
        .from("profiles")
        .select("*")
        .eq(
          "id",
          currentUser.id
        )
        .maybeSingle();


    if (profileError) {
      throw profileError;
    }


    // ======================================
    // CREATE PROFILE IF MISSING
    // ======================================

    if (!profile) {

      const fullName =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        "Customer";


      const phone =
        currentUser.user_metadata?.phone ||
        currentUser.phone ||
        null;


      const {
        data: createdProfile,
        error: createError
      } =
        await supabaseClient
          .from("profiles")
          .insert({
            id: currentUser.id,
            full_name: fullName,
            phone: phone,
            email:
              currentUser.email ||
              null
          })
          .select()
          .single();


      if (createError) {
        throw createError;
      }


      currentProfile =
        createdProfile;

    } else {

      currentProfile =
        profile;

    }


    // ======================================
    // DISPLAY PROFILE
    // ======================================

    renderProfile();


    renderJoinedDate();


    // Show account immediately
    $("accountContent").hidden =
      false;


    // Load orders
    loadOrders();


  } catch (error) {

    console.error(
      "ACCOUNT LOAD ERROR:",
      error
    );


    $("accountContent").hidden =
      false;


    $("notLoggedIn").hidden =
      false;

  }

}

// ==========================================
// RENDER PROFILE
// ==========================================

function renderProfile() {
  const savedAddress =
  [
    currentProfile?.district,
    currentProfile?.area,
    currentProfile?.address
  ]
    .filter(Boolean)
    .join(", ");


const profileAddressEl =
  $("profileAddress");


if (profileAddressEl) {

  profileAddressEl.textContent =
    savedAddress ||
    "No saved address yet";

}

  if (!currentProfile) {
    return;
  }


  const fullName =
    currentProfile.full_name ||
    "Customer";


  const firstName =
    fullName
      .trim()
      .split(/\s+/)[0];


  // Welcome

  $("welcomeName").textContent =
    firstName;


  // Avatar

  $("accountInitial").textContent =
    firstName
      .charAt(0)
      .toUpperCase();


  // Sidebar name

  if ($("sidebarName")) {

    $("sidebarName").textContent =
      fullName;

  }

  // Mobile account header
  if ($("mobileAccountName")) {
    $("mobileAccountName").textContent = fullName;
  }

  if ($("mobileAccountEmail")) {
    $("mobileAccountEmail").textContent =
      currentProfile.email ||
      currentUser.email ||
      "Not added";
  }


  // Details

  $("profileName").textContent =
    fullName;


  $("profilePhone").textContent =
    currentProfile.phone ||
    "Not added";


  $("profileEmail").textContent =
    currentProfile.email ||
    currentUser.email ||
    "Not added";


  // Edit fields

  $("editFullName").value =
    fullName;


  $("editPhone").value =
    currentProfile.phone ||
    "";

}


// ==========================================
// PROFILE EDITING
// ==========================================
// The rich edit form (name, phone, email, district,
// area, address) lives in the #editProfileModal and is
// driven by openEditProfile() / closeEditProfile() /
// saveProfile() further below. The old inline
// show/hide form has been removed in favor of that
// single modal-based flow so there's only one set of
// #editFullName / #editPhone / #editEmail /
// #editDistrict / #editArea / #editAddress fields.


// ==========================================
// SIDEBAR "JOINED" DATE
// ==========================================

function renderJoinedDate() {

  const el =
    $("sidebarJoined");


  if (!el || !currentUser?.created_at) {
    return;
  }

  const joined =
    new Date(
      currentUser.created_at
    );

  el.textContent =
    "Joined " +
    joined.toLocaleDateString(
      "en-RW",
      {
        month: "long",
        year: "numeric"
      }
    );

}


// ==========================================
// WISHLIST STAT (from localStorage wishlist)
// ==========================================

function updateWishlistStat() {

  const el =
    $("statWishlistItems");


  if (!el) {
    return;
  }


  try {

    const wishlist =
      JSON.parse(
        localStorage.getItem("wishlist") ||
        "[]"
      );

    el.textContent =
      wishlist.length;

  } catch {

    el.textContent =
      "0";

  }

}


// ==========================================
// "COMING SOON" QUICK ACTIONS
// (payment methods / notifications / settings —
//  no backend table for these yet)
// ==========================================

function showComingSoon(featureName) {

  alert(
    (featureName || "This feature") +
    " is coming soon."
  );

}


// ==========================================
// LOAD CUSTOMER ORDERS
// ==========================================

async function loadOrders() {

  try {

    if (!currentUser) {
      showNoOrders();
      return;
    }


    console.log(
      "LOADING ORDERS FOR CUSTOMER:",
      currentUser.id
    );


    const {
      data: orders,
      error
    } = await supabaseClient
      .from("orders")
      .select(`
        id,
        created_at,
        total_amount,
        status,
        payment_status,
        customer_name,
        order_items (
          id,
          product_id,
          product_name,
          quantity,
          price,
          subtotal
        )
      `)
      .eq(
        "user_id",
        currentUser.id
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );


    console.log(
      "CUSTOMER ORDERS:",
      orders
    );


    console.log(
      "CUSTOMER ORDERS ERROR:",
      error
    );


    if (error) {
      throw error;
    }


    renderOrders(
      orders || []
    );


  } catch (error) {

    console.error(
      "LOAD CUSTOMER ORDERS ERROR:",
      error
    );


    showNoOrders();

  }

}


// ==========================================
// RENDER ORDERS
// ==========================================

// ==========================================
// RENDER ORDERS
// ==========================================

function renderOrders(orders) {

  customerOrders = orders || [];

  $("ordersLoading").hidden =
    true;


  $("ordersCount").textContent =
    `${orders.length} ${
      orders.length === 1
        ? "order"
        : "orders"
    }`;


  updateOrderStats(orders);


  if (!orders.length) {

    $("noOrders").hidden =
      false;


    $("ordersList").hidden =
      true;


    return;

  }


  $("noOrders").hidden =
    true;


  const list =
    $("ordersList");


  list.innerHTML =
    orders
      .map(order => {

        const date =
          order.created_at
            ? new Date(
                order.created_at
              ).toLocaleDateString(
                "en-RW",
                {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                }
              )
            : "Unknown date";


        const total =
          Number(
            order.total_amount || 0
          );


        const status =
          String(
            order.status ||
            "pending"
          );


        const normalizedStatus =
          status
            .toLowerCase()
            .trim();


        const items =
          order.order_items || [];


        const itemCount =
          items.reduce(
            (sum, item) =>
              sum +
              Number(item.quantity || 0),
            0
          );


        // ====================================
        // ONLY PENDING ORDERS CAN BE CANCELLED
        // ====================================

        const cancelButton =
          normalizedStatus === "pending"

            ? `

              <button
                type="button"
                class="cancel-order-btn"
                data-order-id="${order.id}"
              >

                <i class="fa-solid fa-xmark"></i>

                Cancel order

              </button>

            `

            : "";


        return `

          <div
            class="order-item"
          >

            <a
              href="order-details.html?id=${encodeURIComponent(order.id)}"
              class="order-item-link"
            >

              <div class="order-main">

                <div class="order-icon">

                  <i class="fa-solid fa-box"></i>

                </div>


                <div>

                  <strong>
                    Order #${escapeHtml(order.id)}
                  </strong>


                  <small>
                    ${date}
                    •
                    ${itemCount}
                    ${
                      itemCount === 1
                        ? "item"
                        : "items"
                    }
                  </small>

                </div>

              </div>


              <div class="order-status-area">

                <span
                  class="order-status order-status-${escapeHtml(
                    normalizedStatus
                  )}"
                >
                  ${escapeHtml(status)}
                </span>


                <strong>
                  ${formatMoney(total)}
                </strong>


                <i
                  class="fa-solid fa-chevron-right order-arrow"
                ></i>

              </div>

            </a>


            ${cancelButton}

          </div>

        `;

      })
      .join("");


  list.hidden =
    false;

  if ($("accountContent")?.classList.contains("mobile-show-orders")) {
    renderMobileOrders(customerOrders);
  }


  // ========================================
  // CONNECT CANCEL BUTTONS
  // ========================================

  list
    .querySelectorAll(
      ".cancel-order-btn"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        event => {

          event.preventDefault();


          event.stopPropagation();


          cancelCustomerOrder(
            button.dataset.orderId
          );

        }
      );

    });

}


// ==========================================
// NO ORDERS
// ==========================================

// ==========================================
// TOP STAT CARDS (Total / Pending / Delivered)
// ==========================================

function updateOrderStats(orders) {

  const totalEl =
    $("statTotalOrders");

  const pendingEl =
    $("statPendingOrders");

  const deliveredEl =
    $("statDeliveredOrders");


  if (!totalEl && !pendingEl && !deliveredEl) {
    return;
  }


  const list =
    orders || [];


  const pendingCount =
    list.filter(
      order =>
        String(order.status || "")
          .toLowerCase()
          .trim() === "pending"
    ).length;


  const deliveredCount =
    list.filter(
      order =>
        String(order.status || "")
          .toLowerCase()
          .trim() === "delivered"
    ).length;


  if (totalEl) {
    totalEl.textContent = list.length;
  }

  if (pendingEl) {
    pendingEl.textContent = pendingCount;
  }

  if (deliveredEl) {
    deliveredEl.textContent = deliveredCount;
  }

}


function showNoOrders() {

  $("ordersLoading").hidden =
    true;


  $("ordersList").hidden =
    true;


  $("noOrders").hidden =
    false;


  $("ordersCount").textContent =
    "0 orders";

}


// ==========================================
// LOGOUT
// ==========================================

function setupLogout() {

  const logout = async () => {

    const confirmed =
      confirm(
        "Are you sure you want to logout?"
      );

    if (!confirmed) {
      return;
    }

    try {

      const {
        error
      } =
        await supabaseClient
          .auth
          .signOut();

      if (error) {
        throw error;
      }

      // Clear local website data
      localStorage.removeItem("cart");
      localStorage.removeItem("wishlist");

      location.href = "index.html";

    } catch (error) {

      console.error(
        "LOGOUT ERROR:",
        error
      );

      alert(
        "Could not logout. Please try again."
      );

    }

  };

  $("logoutBtn")?.addEventListener("click", logout);
  $("mobileLogoutBtn")?.addEventListener("click", logout);

}

// ==========================================
// PROFILE EDITING
// ==========================================

function openEditProfile() {

  if (!currentProfile) {
    return;
  }


  $("editFullName").value =
    currentProfile.full_name ||
    "";


  $("editPhone").value =
    currentProfile.phone ||
    "";


  $("editEmail").value =
    currentProfile.email ||
    currentUser?.email ||
    "";


  $("editDistrict").value =
    currentProfile.district ||
    "";


  $("editArea").value =
    currentProfile.area ||
    "";


  $("editAddress").value =
    currentProfile.address ||
    "";


  $("profileSaveMessage").textContent =
    "";


  $("editProfileModal").hidden =
    false;


  document.body.classList.add(
    "account-modal-open"
  );

}


// ==========================================
// CLOSE EDIT PROFILE
// ==========================================

function closeEditProfile() {

  $("editProfileModal").hidden =
    true;


  document.body.classList.remove(
    "account-modal-open"
  );

}


// ==========================================
// SAVE PROFILE
// ==========================================

async function saveProfile(event) {

  event.preventDefault();


  if (!currentUser) {
    return;
  }


  const saveButton =
    $("saveProfileButton");


  const message =
    $("profileSaveMessage");


  const fullName =
    $("editFullName").value.trim();


  const phone =
    $("editPhone").value.trim();


  const email =
    $("editEmail").value.trim();


  const district =
    $("editDistrict").value.trim();


  const area =
    $("editArea").value.trim();


  const address =
    $("editAddress").value.trim();


  if (!fullName) {

    message.textContent =
      "Please enter your full name.";

    message.className =
      "profile-save-message error";

    return;

  }


  try {

    saveButton.disabled =
      true;


    saveButton.innerHTML =
      `<i class="fa-solid fa-spinner fa-spin"></i>
       Saving...`;


    message.textContent =
      "";


    // ======================================
    // UPDATE PROFILE TABLE
    // ======================================

    const {
      data,
      error
    } =
      await supabaseClient
        .from("profiles")
        .update({
          full_name:
            fullName,

          phone:
            phone || null,

          email:
            email || null,

          district:
            district || null,

          area:
            area || null,

          address:
            address || null
        })
        .eq(
          "id",
          currentUser.id
        )
        .select()
        .single();


    if (error) {
      throw error;
    }


    currentProfile =
      data;


    // ======================================
    // UPDATE AUTH METADATA NAME
    // ======================================

    const {
      error: authError
    } =
      await supabaseClient
        .auth
        .updateUser({
          data: {
            full_name:
              fullName
          }
        });


    if (authError) {

      console.warn(
        "AUTH METADATA UPDATE ERROR:",
        authError
      );

    }


    // Refresh account display
    renderProfile();


    message.textContent =
      "Profile saved successfully.";

    message.className =
      "profile-save-message success";


    setTimeout(
      () => {

        closeEditProfile();

      },
      900
    );


  } catch (error) {

    console.error(
      "PROFILE SAVE ERROR:",
      error
    );


    message.textContent =
      error.message ||
      "Could not save your profile.";

    message.className =
      "profile-save-message error";

  } finally {

    saveButton.disabled =
      false;


    saveButton.innerHTML =
      `<i class="fa-solid fa-check"></i>
       Save changes`;

  }

}
// ==========================================
// PROFILE EDIT EVENTS
// ==========================================

$("editProfileButton")
  ?.addEventListener(
    "click",
    openEditProfile
  );


$("closeEditProfile")
  ?.addEventListener(
    "click",
    closeEditProfile
  );


$("cancelEditProfile")
  ?.addEventListener(
    "click",
    closeEditProfile
  );


$("editProfileBackdrop")
  ?.addEventListener(
    "click",
    closeEditProfile
  );


$("editProfileForm")
  ?.addEventListener(
    "submit",
    saveProfile
  );


// ==========================================
// SIDEBAR / QUICK ACTION LINKS
// ==========================================

// "Profile Information" and "Addresses" both edit
// the same profile record, so both open the modal.

[
  "navProfileInfo",
  "navAddresses",
  "qaAddresses"
].forEach(id => {

  $(id)?.addEventListener(
    "click",
    event => {

      event.preventDefault();

      openEditProfile();

    }
  );

});


// Not backed by a database table yet — shows a
// friendly placeholder instead of a dead link.

[
  ["navPayment", "Payment methods"],
  ["navNotifications", "Notifications"],
  ["navSettings", "Settings"],
  ["qaPayment", "Payment methods"]
].forEach(([id, label]) => {

  $(id)?.addEventListener(
    "click",
    event => {

      event.preventDefault();

      showComingSoon(label);

    }
  );

});


// ==========================================
// MOBILE ACCOUNT ACTIONS
// ==========================================

$("mobileViewProfile")?.addEventListener("click", openEditProfile);
$("mobileProfileInfo")?.addEventListener("click", openEditProfile);
$("mobileAddresses")?.addEventListener("click", openEditProfile);

[
  ["mobilePayment", "Payment methods"],
  ["mobileNotifications", "Notifications"],
  ["mobileReviews", "My Reviews"],
  ["mobileHelpCenter", "Help Center"],
  ["mobileFaqs", "FAQs"]
].forEach(([id, label]) => {

  $(id)?.addEventListener("click", event => {
    event.preventDefault();
    showComingSoon(label);
  });

});

function openMobileOrders() {
  const content = $("accountContent");
  const orders = $("myOrders");
  if (!content || !orders) return;

  content.classList.add("mobile-show-orders");
  renderMobileOrders(customerOrders);

  requestAnimationFrame(() => {
    orders.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

$("mobileOrders")?.addEventListener("click", openMobileOrders);
$("mobileBottomOrders")?.addEventListener("click", openMobileOrders);

$("mobileOrdersBack")?.addEventListener("click", () => {
  $("accountContent")?.classList.remove("mobile-show-orders");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("mobileOrderFilters")?.addEventListener("click", event => {
  const button = event.target.closest(".mobile-order-filter");
  if (!button) return;
  mobileOrderFilter = button.dataset.status || "all";
  document.querySelectorAll(".mobile-order-filter").forEach(item => {
    item.classList.toggle("active", item === button);
  });
  renderMobileOrders(customerOrders);
});


// ==========================================
// CART COUNT
// ==========================================

function readSiteCart() {
  try { return JSON.parse(localStorage.getItem("buyzoo24Cart") || "[]"); }
  catch { return []; }
}

function readSiteWishlist() {
  try { return JSON.parse(localStorage.getItem("buyzoo24Wishlist") || "[]"); }
  catch { return []; }
}

function updateCartCount() {
  const cart = readSiteCart();
  const total = cart.reduce((sum, item) => sum + Number(item.qty || 1), 0);
  if ($("cartCount")) $("cartCount").textContent = total;
  if ($("mobileBottomCartCount")) $("mobileBottomCartCount").textContent = total;
  updateWishlistCount();
}

function updateWishlistCount() {
  const count = [...new Set(readSiteWishlist().map(Number))].length;
  if ($("statWishlistItems")) $("statWishlistItems").textContent = count;
  if ($("mobileBottomWishlistCount")) $("mobileBottomWishlistCount").textContent = count;
}


// ==========================================
// MOBILE ORDER RENDERER
// ==========================================

function renderMobileOrders(orders) {
  const list = $("ordersList");
  const empty = $("noOrders");
  const loading = $("ordersLoading");
  if (!list) return;

  const source = Array.isArray(orders) ? orders : [];
  const filtered = mobileOrderFilter === "all"
    ? source
    : source.filter(order => String(order.status || "pending").toLowerCase().trim() === mobileOrderFilter);

  if (loading) loading.hidden = true;

  if (!filtered.length) {
    list.innerHTML = "";
    list.hidden = true;
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;

  list.innerHTML = filtered.map(order => {
    const date = order.created_at
      ? new Date(order.created_at).toLocaleDateString("en-RW", {day:"numeric", month:"short", year:"numeric"})
      : "Unknown date";
    const total = Number(order.total_amount || 0);
    const status = String(order.status || "pending");
    const normalized = status.toLowerCase().trim();
    const itemCount = (order.order_items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const cancel = normalized === "pending"
      ? `<button type="button" class="cancel-order-btn mobile-cancel-order" data-order-id="${escapeHtml(order.id)}"><i class="fa-solid fa-xmark"></i> Cancel order</button>`
      : "";

    return `<article class="mobile-order-card">
      <a href="order-details.html?id=${encodeURIComponent(order.id)}" class="mobile-order-card-main">
        <div class="mobile-order-top">
          <div><strong>#${escapeHtml(order.id)}</strong><small>${date}</small></div>
          <span class="mobile-order-status mobile-order-status-${escapeHtml(normalized)}">${escapeHtml(status.charAt(0).toUpperCase()+status.slice(1))}</span>
        </div>
        <div class="mobile-order-middle"><span>${itemCount} ${itemCount === 1 ? "item" : "items"}</span><strong>${formatMoney(total)}</strong></div>
        <div class="mobile-order-details-link"><span>View Details</span><i class="fa-solid fa-chevron-right"></i></div>
      </a>
      ${cancel}
    </article>`;
  }).join("");

  list.hidden = false;
  list.querySelectorAll(".cancel-order-btn").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      cancelCustomerOrder(button.dataset.orderId);
    });
  });
}

// ==========================================
// MOBILE CART + WISHLIST DRAWERS
// ==========================================

async function loadAccountDrawerProducts() {
  try {
    const { data, error } = await supabaseClient.from("Products").select("*");
    if (error) throw error;
    accountProducts = (data || []).map(p => ({...p, id:Number(p.id), price:Number(p.price || 0), image:p.image_url || ""}));
    renderAccountCartDrawer();
    renderAccountWishlistDrawer();
  } catch (error) {
    console.error("ACCOUNT DRAWER PRODUCTS ERROR:", error);
  }
}

function buildAccountDrawers() {
  if ($("accountCartDrawer")) return;

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div id="accountCartOverlay" class="cart-overlay"></div>
    <aside id="accountCartDrawer" class="cart-drawer" aria-hidden="true">
      <div class="cart-drawer-head"><h3>Your Cart</h3><button type="button" id="accountCartClose">✕</button></div>
      <div id="accountCartItems" class="cart-items"></div>
      <div class="cart-drawer-foot"><div class="cart-subtotal"><span>Subtotal</span><b id="accountCartSubtotal">0 RWF</b></div><a href="checkout.html" class="cta cart-checkout-btn">Proceed to checkout →</a></div>
    </aside>
    <div id="accountWishlistOverlay" class="wishlist-overlay"></div>
    <aside id="accountWishlistDrawer" class="wishlist-drawer" aria-hidden="true">
      <div class="wishlist-drawer-head"><h3>Your Wishlist</h3><button type="button" id="accountWishlistClose">✕</button></div>
      <div id="accountWishlistItems" class="wishlist-drawer-items"></div>
      <div class="wishlist-drawer-foot"><div class="wishlist-drawer-count"><span>Saved items</span><b id="accountWishlistCount">0</b></div><a href="wishlist.html" class="cta-ghost wishlist-view-all-btn">View full wishlist →</a></div>
    </aside>`;
  document.body.append(...wrap.childNodes);

  $("accountCartOverlay").addEventListener("click", closeAccountCart);
  $("accountCartClose").addEventListener("click", closeAccountCart);
  $("accountWishlistOverlay").addEventListener("click", closeAccountWishlist);
  $("accountWishlistClose").addEventListener("click", closeAccountWishlist);
  $("mobileBottomCart")?.addEventListener("click", openAccountCart);
  $("mobileBottomWishlist")?.addEventListener("click", openAccountWishlist);

  $("accountCartItems").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const id = Number(button.dataset.id);
    const cart = readSiteCart();
    const item = cart.find(x => Number(x.id) === id);
    if (!item) return;
    if (button.classList.contains("qty-plus")) item.qty = Number(item.qty || 1) + 1;
    if (button.classList.contains("qty-minus")) item.qty = Number(item.qty || 1) - 1;
    if (button.classList.contains("item-remove")) item.qty = 0;
    localStorage.setItem("buyzoo24Cart", JSON.stringify(cart.filter(x => Number(x.qty || 0) > 0)));
    updateCartCount();
    renderAccountCartDrawer();
  });

  $("accountWishlistItems").addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const id = Number(button.dataset.id);
    if (!id) return;
    if (button.classList.contains("wishlist-drawer-add")) {
      const cart = readSiteCart();
      const item = cart.find(x => Number(x.id) === id);
      if (item) item.qty = Number(item.qty || 1) + 1;
      else cart.push({id, qty:1});
      localStorage.setItem("buyzoo24Cart", JSON.stringify(cart));
      updateCartCount();
    } else if (button.classList.contains("wishlist-drawer-remove")) {
      const next = readSiteWishlist().map(Number).filter(x => x !== id);
      localStorage.setItem("buyzoo24Wishlist", JSON.stringify(next));
      updateWishlistCount();
    }
    renderAccountWishlistDrawer();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") { closeAccountCart(); closeAccountWishlist(); }
  });
}

function openAccountCart() {
  closeAccountWishlist();
  renderAccountCartDrawer();
  $("accountCartDrawer")?.classList.add("open");
  $("accountCartOverlay")?.classList.add("open");
  $("accountCartDrawer")?.setAttribute("aria-hidden", "false");
}

function closeAccountCart() {
  $("accountCartDrawer")?.classList.remove("open");
  $("accountCartOverlay")?.classList.remove("open");
  $("accountCartDrawer")?.setAttribute("aria-hidden", "true");
}

function openAccountWishlist() {
  closeAccountCart();
  renderAccountWishlistDrawer();
  $("accountWishlistDrawer")?.classList.add("open");
  $("accountWishlistOverlay")?.classList.add("open");
  $("accountWishlistDrawer")?.setAttribute("aria-hidden", "false");
}

function closeAccountWishlist() {
  $("accountWishlistDrawer")?.classList.remove("open");
  $("accountWishlistOverlay")?.classList.remove("open");
  $("accountWishlistDrawer")?.setAttribute("aria-hidden", "true");
}

function accountProductVisual(product) {
  return product?.image
    ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name || "Product")}">`
    : `<div style="font-size:24px">${product?.emoji || "🛒"}</div>`;
}

function renderAccountCartDrawer() {
  const itemsEl = $("accountCartItems");
  if (!itemsEl) return;
  const cart = readSiteCart();
  const valid = cart.filter(item => accountProducts.some(p => Number(p.id) === Number(item.id)));
  if (!valid.length) {
    itemsEl.innerHTML = `<div class="cart-empty"><span>🛒</span><p>Your cart is empty.</p><a href="shop.html" class="cta-ghost">Start shopping</a></div>`;
  } else {
    itemsEl.innerHTML = valid.map(item => {
      const p = accountProducts.find(x => Number(x.id) === Number(item.id));
      return `<div class="cart-item"><div class="cart-item-pic">${accountProductVisual(p)}</div><div class="cart-item-body"><b>${escapeHtml(p.name)}</b><small>${formatMoney(p.price)}</small><div class="qty-stepper"><button type="button" class="qty-minus" data-id="${p.id}">−</button><span>${Number(item.qty || 1)}</span><button type="button" class="qty-plus" data-id="${p.id}">+</button></div></div><button type="button" class="item-remove" data-id="${p.id}">✕</button></div>`;
    }).join("");
  }
  const subtotal = valid.reduce((sum,item) => {
    const p = accountProducts.find(x => Number(x.id) === Number(item.id));
    return sum + (p ? p.price * Number(item.qty || 1) : 0);
  },0);
  if ($("accountCartSubtotal")) $("accountCartSubtotal").textContent = formatMoney(subtotal);
}

function renderAccountWishlistDrawer() {
  const itemsEl = $("accountWishlistItems");
  if (!itemsEl) return;
  const ids = [...new Set(readSiteWishlist().map(Number))];
  const items = ids.map(id => accountProducts.find(p => Number(p.id) === id)).filter(Boolean);
  if (!items.length) {
    itemsEl.innerHTML = `<div class="wishlist-drawer-empty"><span>♡</span><p>Your wishlist is empty.</p><a href="shop.html" class="cta-ghost">Start shopping</a></div>`;
  } else {
    itemsEl.innerHTML = items.map(p => `<div class="wishlist-drawer-item"><div class="wishlist-drawer-item-pic">${accountProductVisual(p)}</div><div class="wishlist-drawer-item-body"><b>${escapeHtml(p.name)}</b><small>${formatMoney(p.price)}</small><button type="button" class="wishlist-drawer-add" data-id="${p.id}">Add to cart</button></div><button type="button" class="wishlist-drawer-remove" data-id="${p.id}">✕</button></div>`).join("");
  }
  if ($("accountWishlistCount")) $("accountWishlistCount").textContent = items.length;
}


// ==========================================
// FORMAT MONEY
// ==========================================

function formatMoney(amount) {

  return new Intl.NumberFormat(
    "en-RW",
    {
      style: "currency",
      currency: "RWF",
      maximumFractionDigits: 0
    }
  ).format(
    Number(amount || 0)
  );

}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHtml(value) {

  return String(
    value ?? ""
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
// ==========================================
// CANCEL CUSTOMER ORDER
// ==========================================

async function cancelCustomerOrder(orderId) {

  const confirmed =
    confirm(
      "Cancel this order?\n\n" +
      "This can only be done while the order is still pending."
    );


  if (!confirmed) {
    return;
  }


  try {

    console.log(
      "CANCELLING ORDER:",
      orderId
    );


    const {
      data,
      error
    } =
      await supabaseClient
        .rpc(
          "cancel_my_order",
          {
            p_order_id:
              Number(orderId)
          }
        );


    console.log(
      "CANCEL ORDER RESULT:",
      data
    );


    if (error) {
      throw error;
    }


    // ======================================
    // RELOAD CUSTOMER ORDERS
    // ======================================

    await loadOrders();


    // Optional message

    alert(
      "Your order has been cancelled successfully."
    );


  } catch (error) {

    console.error(
      "CUSTOMER CANCEL ORDER ERROR:",
      error
    );


    alert(
      error.message ||
      "Could not cancel this order."
    );

  }

}