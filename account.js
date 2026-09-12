// ==========================================
// FASSOKO CUSTOMER ACCOUNT
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
let orderFilter = "all";

// ==========================================
// START
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  setupLogout();
  setupProfileModal();
  setupOrderFilters();
  updateCartBadge();
  await loadAccount();
});

// ==========================================
// TABS (Overview / My orders / Profile)
// ==========================================

function setupTabs() {
  const tabs = document.querySelectorAll(".acct-tab");
  const panels = document.querySelectorAll(".acct-panel");

  function activate(name) {
    tabs.forEach(tab => tab.classList.toggle("is-active", tab.dataset.tab === name));
    panels.forEach(panel => panel.classList.toggle("is-active", panel.dataset.panel === name));
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => activate(tab.dataset.tab));
  });

  // Any element with data-tab (stat pills, quick links) jumps to that tab too.
  document.querySelectorAll("[data-tab]:not(.acct-tab)").forEach(el => {
    el.addEventListener("click", event => {
      event.preventDefault();
      activate(el.dataset.tab);
    });
  });
}

// ==========================================
// LOAD ACCOUNT
// ==========================================

async function loadAccount() {
  try {
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;

    if (!session?.user) {
      $("notLoggedIn").hidden = false;
      return;
    }

    currentUser = session.user;

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      const fullName =
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        "Customer";

      const phone = currentUser.user_metadata?.phone || currentUser.phone || null;

      const { data: createdProfile, error: createError } = await supabaseClient
        .from("profiles")
        .insert({
          id: currentUser.id,
          full_name: fullName,
          phone: phone,
          email: currentUser.email || null
        })
        .select()
        .single();

      if (createError) throw createError;
      currentProfile = createdProfile;
    } else {
      currentProfile = profile;
    }

    renderProfile();
    $("accountContent").hidden = false;

    await loadOrders();

  } catch (error) {
    console.error("ACCOUNT LOAD ERROR:", error);
    $("accountContent").hidden = false;
    $("notLoggedIn").hidden = false;
  }
}

// ==========================================
// RENDER PROFILE
// ==========================================

function renderProfile() {
  if (!currentProfile) return;

  const fullName = currentProfile.full_name || "Customer";
  const firstName = fullName.trim().split(/\s+/)[0];

  const savedAddress = [currentProfile.district, currentProfile.area, currentProfile.address]
    .filter(Boolean)
    .join(", ");

  $("welcomeName").textContent = firstName;
  $("accountInitial").textContent = firstName.charAt(0).toUpperCase();

  if (currentUser?.created_at) {
    const joined = new Date(currentUser.created_at);
    $("sidebarJoined").textContent =
      "Member since " + joined.toLocaleDateString("en-RW", { month: "long", year: "numeric" });
  }

  $("profileName").textContent = fullName;
  $("profilePhone").textContent = currentProfile.phone || "Not added";
  $("profileEmail").textContent = currentProfile.email || currentUser.email || "Not added";
  $("profileAddress").textContent = savedAddress || "No saved address yet";
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

    // Flat select first — no nested order_items embed, so this never
    // depends on Supabase's relationship schema cache.
    const { data: orders, error } = await supabaseClient
      .from("orders")
      .select(`
        id,
        created_at,
        total_amount,
        status,
        payment_status,
        customer_name
      `)
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const orderList = orders || [];

    // Load order items separately, then attach them to their order in JS.
    if (orderList.length) {
      const orderIds = orderList.map(o => o.id);

      const { data: items, error: itemsError } = await supabaseClient
        .from("order_items")
        .select(`
          id,
          order_id,
          product_id,
          product_name,
          quantity,
          price,
          subtotal
        `)
        .in("order_id", orderIds);

      if (itemsError) throw itemsError;

      const itemsByOrder = {};
      (items || []).forEach(item => {
        const key = item.order_id;
        if (!itemsByOrder[key]) itemsByOrder[key] = [];
        itemsByOrder[key].push(item);
      });

      orderList.forEach(order => {
        order.order_items = itemsByOrder[order.id] || [];
      });
    }

    customerOrders = orderList;
    updateOrderStats(orderList);
    renderOrders(orderList);

  } catch (error) {
    console.error("LOAD CUSTOMER ORDERS ERROR:", error);
    showNoOrders();
  }
}

// ==========================================
// ORDER STATS (total / pending / delivered)
// ==========================================

function updateOrderStats(orders) {
  const list = orders || [];
  const statusCount = status =>
    list.filter(o => String(o.status || "").toLowerCase().trim() === status).length;

  if ($("statTotalOrders")) $("statTotalOrders").textContent = list.length;
  if ($("statPendingOrders")) $("statPendingOrders").textContent = statusCount("pending");
  if ($("statDeliveredOrders")) $("statDeliveredOrders").textContent = statusCount("delivered");
}

// ==========================================
// ORDER FILTERS (All / Pending / Processing / Shipped / Delivered)
// ==========================================

function setupOrderFilters() {
  $("orderFilters")?.addEventListener("click", event => {
    const button = event.target.closest(".order-filter");
    if (!button) return;

    orderFilter = button.dataset.status || "all";

    document.querySelectorAll(".order-filter").forEach(item => {
      item.classList.toggle("is-active", item === button);
    });

    renderOrders(customerOrders);
  });
}

function filteredOrders(orders) {
  if (orderFilter === "all") return orders;
  return orders.filter(order => String(order.status || "pending").toLowerCase().trim() === orderFilter);
}

// ==========================================
// RENDER ORDERS
// ==========================================

function renderOrders(orders) {
  const source = orders || [];

  $("ordersLoading").hidden = true;
  $("ordersCount").textContent = `${source.length} ${source.length === 1 ? "order" : "orders"}`;

  const visible = filteredOrders(source);
  const list = $("ordersList");

  if (!visible.length) {
    list.hidden = true;
    list.innerHTML = "";
    $("noOrders").hidden = false;
    return;
  }

  $("noOrders").hidden = true;
  list.hidden = false;

  list.innerHTML = visible.map(order => {
    const date = order.created_at
      ? new Date(order.created_at).toLocaleDateString("en-RW", { day: "numeric", month: "short", year: "numeric" })
      : "Unknown date";

    const total = Number(order.total_amount || 0);
    const status = String(order.status || "pending");
    const normalizedStatus = status.toLowerCase().trim();

    const itemCount = (order.order_items || []).reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );

    const cancelButton = normalizedStatus === "pending"
      ? `<button type="button" class="cancel-order-btn" data-order-id="${escapeHtml(order.id)}">
           <i class="fa-solid fa-xmark"></i> Cancel order
         </button>`
      : "";

    return `
      <div class="order-item">
        <a href="order-details.html?id=${encodeURIComponent(order.id)}" class="order-item-link">
          <div class="order-main">
            <div class="order-icon"><i class="fa-solid fa-box"></i></div>
            <div>
              <strong>Order #${escapeHtml(order.id)}</strong>
              <small>${date} &middot; ${itemCount} ${itemCount === 1 ? "item" : "items"}</small>
            </div>
          </div>
          <div class="order-status-area">
            <span class="order-status order-status-${escapeHtml(normalizedStatus)}">${escapeHtml(status)}</span>
            <strong>${formatMoney(total)}</strong>
            <i class="fa-solid fa-chevron-right order-arrow"></i>
          </div>
        </a>
        ${cancelButton}
      </div>
    `;
  }).join("");

  list.querySelectorAll(".cancel-order-btn").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      cancelCustomerOrder(button.dataset.orderId);
    });
  });
}

function showNoOrders() {
  $("ordersLoading").hidden = true;
  $("ordersList").hidden = true;
  $("noOrders").hidden = false;
  $("ordersCount").textContent = "0 orders";
}

// ==========================================
// CANCEL ORDER
// ==========================================

async function cancelCustomerOrder(orderId) {
  const confirmed = confirm("Cancel this order?\n\nThis can only be done while the order is still pending.");
  if (!confirmed) return;

  try {
    const { error } = await supabaseClient.rpc("cancel_my_order", {
      p_order_id: Number(orderId)
    });

    if (error) throw error;

    await loadOrders();
    alert("Your order has been cancelled successfully.");

  } catch (error) {
    console.error("CANCEL ORDER ERROR:", error);
    alert(error.message || "Could not cancel this order.");
  }
}

// ==========================================
// LOGOUT
// ==========================================

function setupLogout() {
  $("logoutBtn")?.addEventListener("click", async () => {
    const confirmed = confirm("Are you sure you want to logout?");
    if (!confirmed) return;

    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;

      localStorage.removeItem("abamartCart");
      localStorage.removeItem("abamartWishlist");

      location.href = "index.html";
    } catch (error) {
      console.error("LOGOUT ERROR:", error);
      alert("Could not logout. Please try again.");
    }
  });
}

// ==========================================
// PROFILE EDIT MODAL
// ==========================================

function setupProfileModal() {
  $("editProfileButton")?.addEventListener("click", openEditProfile);
  $("closeEditProfile")?.addEventListener("click", closeEditProfile);
  $("cancelEditProfile")?.addEventListener("click", closeEditProfile);
  $("editProfileBackdrop")?.addEventListener("click", closeEditProfile);
  $("editProfileForm")?.addEventListener("submit", saveProfile);
}

function openEditProfile() {
  if (!currentProfile) return;

  $("editFullName").value = currentProfile.full_name || "";
  $("editPhone").value = currentProfile.phone || "";
  $("editEmail").value = currentProfile.email || currentUser?.email || "";
  $("editDistrict").value = currentProfile.district || "";
  $("editArea").value = currentProfile.area || "";
  $("editAddress").value = currentProfile.address || "";

  $("profileSaveMessage").textContent = "";
  $("profileSaveMessage").className = "profile-save-message";

  $("editProfileModal").hidden = false;
  document.body.classList.add("acct-modal-open");
}

function closeEditProfile() {
  $("editProfileModal").hidden = true;
  document.body.classList.remove("acct-modal-open");
}

async function saveProfile(event) {
  event.preventDefault();
  if (!currentUser) return;

  const saveButton = $("saveProfileButton");
  const message = $("profileSaveMessage");

  const fullName = $("editFullName").value.trim();
  const phone = $("editPhone").value.trim();
  const email = $("editEmail").value.trim();
  const district = $("editDistrict").value.trim();
  const area = $("editArea").value.trim();
  const address = $("editAddress").value.trim();

  if (!fullName) {
    message.textContent = "Please enter your full name.";
    message.className = "profile-save-message error";
    return;
  }

  try {
    saveButton.disabled = true;
    saveButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;
    message.textContent = "";

    const { data, error } = await supabaseClient
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone || null,
        email: email || null,
        district: district || null,
        area: area || null,
        address: address || null
      })
      .eq("id", currentUser.id)
      .select()
      .single();

    if (error) throw error;

    currentProfile = data;

    const { error: authError } = await supabaseClient.auth.updateUser({
      data: { full_name: fullName }
    });

    if (authError) console.warn("AUTH METADATA UPDATE ERROR:", authError);

    renderProfile();

    message.textContent = "Profile saved successfully.";
    message.className = "profile-save-message success";

    setTimeout(closeEditProfile, 900);

  } catch (error) {
    console.error("PROFILE SAVE ERROR:", error);
    message.textContent = error.message || "Could not save your profile.";
    message.className = "profile-save-message error";
  } finally {
    saveButton.disabled = false;
    saveButton.innerHTML = `<i class="fa-solid fa-check"></i> Save changes`;
  }
}

// ==========================================
// CART BADGE (header)
// ==========================================

function readSiteCart() {
  try { return JSON.parse(localStorage.getItem("abamartCart") || "[]"); }
  catch { return []; }
}

function readSiteWishlist() {
  try { return JSON.parse(localStorage.getItem("abamartWishlist") || "[]"); }
  catch { return []; }
}

function updateCartBadge() {
  const cart = readSiteCart();
  const total = cart.reduce((sum, item) => sum + Number(item.qty || 1), 0);
  if ($("cartCount")) $("cartCount").textContent = total;

  const wishlistCount = [...new Set(readSiteWishlist().map(Number))].length;
  if ($("statWishlistItems")) $("statWishlistItems").textContent = wishlistCount;
}

// ==========================================
// HELPERS
// ==========================================

function formatMoney(amount) {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0
  }).format(Number(amount || 0));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
