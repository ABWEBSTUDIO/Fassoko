// ============================================
// FASSOKO CHECKOUT - SUPABASE VERSION
// ============================================

let products = [];

const cart = JSON.parse(
  localStorage.getItem("abamartCart") || "[]"
);


// ============================================
// MONEY
// ============================================

const money = n =>
  Number(n || 0).toLocaleString() + " RWF";


// ============================================
// LOAD PRODUCTS FROM SUPABASE
// ============================================

async function loadCheckoutProducts() {

  console.log("LOADING CHECKOUT PRODUCTS FROM SUPABASE...");

  if (typeof supabaseClient === "undefined") {
    console.error("supabaseClient is not defined.");
    toast("Supabase is not connected.");
    return;
  }

  const { data, error } = await supabaseClient

    .from("Products")

    .select(`
      *,
      categories(
        id,
        name,
        slug
      ),
      subcategories(
        id,
        name,
        slug
      )
    `)

    .eq("is_active", true);


  if (error) {

    console.error(
      "CHECKOUT PRODUCTS ERROR:",
      error
    );

    toast("Could not load products.");

    return;
  }


  products = (data || []).map(p => ({

    ...p,

    // Image
    image: p.image_url || p.image || "",

    // Category
    cat:
      p.categories?.name ||
      "Uncategorized",

    group:
      p.categories?.name ||
      "Uncategorized",

    category_id:
      p.category_id || null,

    // Subcategory
    subcategory:
      p.subcategories?.name ||
      "",

    subcategory_id:
      p.subcategory_id || null,

    // Stock
    stock:
      p.stock === "out" ||
      p.stock === 0 ||
      p.stock === false
        ? "out"
        : "in",

    // Numbers
    price: Number(p.price || 0),

    rating: Number(p.rating || 5),

    reviews: Number(p.reviews || 0)

  }));


  console.log(
    "CHECKOUT PRODUCTS:",
    products
  );

  console.log(
    "CHECKOUT PRODUCT COUNT:",
    products.length
  );


  renderOrder();
}


// ============================================
// FIND PRODUCT
// ============================================

function product(id) {

  return products.find(
    p => Number(p.id) === Number(id)
  );

}


// ============================================
// SUBTOTAL
// ============================================

function subtotal() {

  return cart.reduce(
    (sum, item) => {

      const p = product(item.id);

      if (!p) {
        console.warn(
          "Product not found:",
          item.id
        );

        return sum;
      }

      // Use the selected option price if available
      const itemPrice =
        Number(
          item.option_price ??
          p.price
        );

      return sum +
        itemPrice *
        Number(item.qty || 0);

    },
    0
  );

}

// ============================================
// DELIVERY FEE (based on selected area + PDF zones)
// ============================================

const NIGHT_DELIVERY_FEE = 1000;

// Returns the base delivery fee for the selected area,
// or null if no area (or an unlisted area) is selected yet.
function getAreaFee() {

  const areaEl =
    document.getElementById("area");

  if (!areaEl) {
    return null;
  }

  const selected =
    areaEl.selectedOptions[0];

  if (
    !selected ||
    selected.dataset.fee === undefined ||
    selected.dataset.fee === ""
  ) {
    return null;
  }

  return Number(selected.dataset.fee);

}

function isNightDelivery() {

  const nightEl =
    document.getElementById("nightDelivery");

  return !!(nightEl && nightEl.checked);

}

// Combines the area's base fee with the night delivery
// surcharge. Returns null if no area is selected yet.
function getDeliveryFee() {

  const areaFee =
    getAreaFee();

  if (areaFee === null) {
    return null;
  }

  return areaFee +
    (isNightDelivery() ? NIGHT_DELIVERY_FEE : 0);

}


// ============================================
// RENDER CHECKOUT ORDER
// ============================================

function renderOrder() {

  const count =
    cart.reduce(
      (sum, item) =>
        sum + Number(item.qty || 0),
      0
    );


  const cartCount =
    document.getElementById("cartCount");

  if (cartCount) {
    cartCount.textContent = count;
  }


  const box =
    document.getElementById("orderItems");


  if (!box) {
    return;
  }


  // Empty cart
  if (!cart.length) {

    box.innerHTML = `
      <div class="empty">
        Your cart is empty.
        <a href="shop.html">
          ← Return to shop
        </a>
      </div>
    `;

    const placeButton =
      document.getElementById("placeDesktop");

    if (placeButton) {
      placeButton.disabled = true;
    }

    return;
  }


  // Products haven't loaded yet
  if (!products.length) {

    box.innerHTML = `
      <div class="empty">
        Loading your products...
      </div>
    `;

    return;
  }


  const validItems = cart.filter(
    item => product(item.id)
  );


  // Products in cart don't exist anymore
  if (!validItems.length) {

    box.innerHTML = `
      <div class="empty">
        Your cart products could not be found.
        <a href="shop.html">
          ← Return to shop
        </a>
      </div>
    `;

    const placeButton =
      document.getElementById("placeDesktop");

    if (placeButton) {
      placeButton.disabled = true;
    }

    return;
  }


  // Render products
  box.innerHTML = validItems.map(item => {

    const p = product(item.id);
    const itemPrice =
  Number(
    item.option_price ??
    p.price
  );

    const visual = p.image

      ? `
        <img
          src="${p.image}"
          alt="${p.name}"
        >
      `

      : `
        <div
          class="thumb-emoji"
          style="background:${p.bg || "#edf6ef"}"
        >
          ${p.emoji || "🛒"}
        </div>
      `;


    return `
      <div class="summary-item">

        <div class="thumb">
          ${visual}
        </div>

        <div>

          <h3>
            ${p.name}
          </h3>

         <small>
  ${item.qty} × ${money(itemPrice)}
</small>

${
  item.option_name
    ? `
      <small class="checkout-option-name">
        ${item.option_name}
      </small>
    `
    : ""
}

          <small>
            ${p.cat}
            ${p.subcategory
              ? " • " + p.subcategory
              : ""}
          </small>

        </div>

        <strong class="item-price">
        ${money(
  Number(item.qty) *
  itemPrice
)}
        </strong>

      </div>
    `;

  }).join("");


  // Totals
  const sub = subtotal();

  const delivery =
    getDeliveryFee();

  const total =
    sub + (delivery || 0);


  const subtotalEl =
    document.getElementById("subtotal");

  const deliveryEl =
    document.getElementById("delivery");

  const totalEl =
    document.getElementById("total");

  const freeNote =
    document.getElementById("freeNote");


  if (subtotalEl) {
    subtotalEl.textContent =
      money(sub);
  }


  if (deliveryEl) {

    deliveryEl.textContent =

      delivery === null
        ? "—"
        : delivery === 0
          ? "FREE"
          : money(delivery);

  }


  if (totalEl) {

    totalEl.textContent =
      money(total);

  }


  if (freeNote) {

    freeNote.textContent =

      delivery === null

        ? "Select your delivery area to see the delivery fee."

        : delivery === 0

          ? "You qualify for free delivery to this area."

          : "Delivery fee is based on your selected area" +
            (isNightDelivery()
              ? " (includes +1,000 RWF night delivery)."
              : ".");

  }


  const placeButton =
    document.getElementById("placeDesktop");

  if (placeButton) {
    placeButton.disabled = false;
  }

}


// ============================================
// PAYMENT SELECTION
// ============================================

document
  .querySelectorAll(".payment")
  .forEach(label => {

    label.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(".payment")
          .forEach(x =>
            x.classList.remove("selected")
          );


        label.classList.add("selected");


        const input =
          label.querySelector("input");

        if (input) {
          input.checked = true;
        }

      }
    );

  });


// ============================================
// MOBILE MONEY PAYMENT UI
// ============================================

function getSelectedPaymentMethod() {
  return document.querySelector('input[name="payment"]:checked')?.value || "";
}

function updateMobileMoneyInstructions() {
  const method = getSelectedPaymentMethod();
  const box = document.getElementById("mobileMoneyInstructions");
  if (!box) return;

  const isMobileMoney = method === "Mobile Money";
  box.hidden = !isMobileMoney;
}

document
  .querySelectorAll('input[name="payment"]')
  .forEach(input => {
    input.addEventListener("change", updateMobileMoneyInstructions);
  });

updateMobileMoneyInstructions();

// ============================================
// DELIVERY AREA / NIGHT DELIVERY — LIVE UPDATES
// ============================================

const areaSelectEl =
  document.getElementById("area");

if (areaSelectEl) {

  areaSelectEl.addEventListener(
    "change",
    renderOrder
  );

}

const nightDeliveryEl =
  document.getElementById("nightDelivery");

if (nightDeliveryEl) {

  nightDeliveryEl.addEventListener(
    "change",
    renderOrder
  );

}


// ============================================
// ADMIN ORDER NOTIFICATION / FULL INVOICE
async function sendAdminOrderNotification(data) {
  try {
    const { data: notificationData, error: notificationError } = await supabaseClient.functions.invoke("send-order-notification", {
      body: {
        order_id: data.orderId, order_number: data.orderNumber,
        customer_name: data.customerName, customer_phone: data.customerPhone,
        customer_email: data.customerEmail, delivery_address: data.deliveryAddress,
        payment_method: data.paymentMethod, payment_status: data.paymentStatus,
        payment_reference: data.paymentReference || null,
        items: (data.orderItems || []).map(item => ({
          name: item.product_name, quantity: Number(item.quantity || 0),
          price: Number(item.price || 0), subtotal: Number(item.subtotal || 0)
        })),
        subtotal: Number(data.subtotal || 0), delivery: Number(data.delivery || 0),
        total: Number(data.total || 0)
      }
    });
    if (notificationError) { console.error("ADMIN NOTIFICATION ERROR:", notificationError); return false; }
    console.log("ADMIN FULL INVOICE SENT:", notificationData);
    return true;
  } catch (error) { console.error("ADMIN NOTIFICATION FAILED:", error); return false; }
}

// PLACE ORDER
// ============================================

document
  .getElementById("checkoutForm")
  .addEventListener(
    "submit",
    async e => {

      e.preventDefault();


      if (!cart.length) {

        toast(
          "Your cart is empty"
        );

        return;
      }


      // Make sure products are loaded
      if (!products.length) {

        toast(
          "Products are still loading. Please wait."
        );

        return;
      }


      const required = [
        "name",
        "phone",
        "district",
        "area",
        "address"
      ];


      for (const id of required) {

        const el =
          document.getElementById(id);

        if (!el || !el.value.trim()) {

          if (el) {
            el.focus();
          }

          toast(
            "Please complete all required fields"
          );

          return;
        }

      }


      const paymentEl =
        document.querySelector(
          'input[name="payment"]:checked'
        );


      if (!paymentEl) {

        toast(
          "Please select a payment method"
        );

        return;
      }


      // Check every cart item
      for (const item of cart) {

        const p =
          product(item.id);

        if (!p) {

          console.error(
            "Missing product:",
            item.id
          );

          toast(
            "One of your products could not be found."
          );

          return;
        }

      }


      const sub =
        subtotal();


      const delivery =
        getDeliveryFee();


      if (delivery === null) {

        toast(
          "Please select your delivery area"
        );

        const areaEl =
          document.getElementById("area");

        if (areaEl) {
          areaEl.focus();
        }

        return;
      }


      const total =
        sub + delivery;


      const orderNumber =
        "BZ" +
        Date.now()
          .toString()
          .slice(-8);


      const customerName =
        document
          .getElementById("name")
          .value
          .trim();


      const customerPhone =
        document
          .getElementById("phone")
          .value
          .trim();


      const customerEmail =
        document
          .getElementById("email")
          .value
          .trim();


      const district =
        document
          .getElementById("district")
          .value;


      const area =
        document
          .getElementById("area")
          .value
          .trim();


      const address =
        document
          .getElementById("address")
          .value
          .trim();


      const notes =
        document
          .getElementById("notes")
          .value
          .trim();

      const submitButton =
        document
          .getElementById("placeDesktop");


      if (submitButton) {
        submitButton.disabled = true;
      }


      try {
// ====================================
// GET LOGGED-IN CUSTOMER
// ====================================

const {
  data: {
    session
  },
  error: sessionError
} = await supabaseClient
  .auth
  .getSession();

if (sessionError) {
  throw sessionError;
}

if (!session?.user) {

  toast(
    "Please log in before placing an order."
  );

  location.href = "login.html";

  return;
}

const loggedInUser = session.user;

console.log(
  "ORDER CUSTOMER:",
  loggedInUser.id
);
        // ====================================
        // CREATE ORDER
        // ====================================

        const {
          data: createdOrder,
          error: orderError
        } = await supabaseClient

          .from("orders")

          .insert({
  // Connect this order to
  // the logged-in Supabase customer
  user_id:
    loggedInUser.id,
            customer_name:
              customerName,

            customer_phone:
              customerPhone,

            customer_email:
              customerEmail,

            delivery_address: [
              district,
              area,
              address
            ]
              .filter(Boolean)
              .join(", "),

            total_amount:
              total,

            status:
              "pending",

            payment_status:
              "unpaid",

            notes: [

              "Order number: " +
                orderNumber,

              "Payment method: " +
                paymentEl.value,

              // Machine-readable marker used by the admin
              // to prevent accidental stock restoration/double deduction.
              "Stock deducted: yes",

              notes

            ]
              .filter(Boolean)
              .join(" | ")

          })

          .select("id")

          .single();


        if (orderError) {
          throw orderError;
        }


        // ====================================
        // CREATE ORDER ITEMS
        // ====================================

const orderItems =
  cart.map(item => {

    const p =
      product(item.id);

    const itemPrice =
      Number(
        item.option_price ??
        p.price
      );

    return {

      order_id:
        createdOrder.id,

      product_id:
        p.id,

      product_name:
        p.name,

      quantity:
        Number(item.qty),

      price:
        itemPrice,

      subtotal:
        itemPrice *
        Number(item.qty)

    };

  });


        const {
          error: itemsError
        } = await supabaseClient

          .from("order_items")

          .insert(orderItems);


        if (itemsError) {

          // Remove incomplete order
          await supabaseClient

            .from("orders")

            .delete()

            .eq(
              "id",
              createdOrder.id
            );

          throw itemsError;
        }

// ====================================
// REDUCE PRODUCT STOCK SECURELY
// ====================================
// Stock is deducted immediately for every order, regardless of
// the payment method chosen. Mobile Money verification is handled
// separately by Fassoko later — it no longer blocks stock deduction.

for (const item of cart) {

  const quantityBought = Number(item.qty || 0);

  if (quantityBought <= 0) {
    console.error("INVALID QUANTITY:", item);
    continue;
  }

  const { error: stockError } = await supabaseClient
    .rpc("reduce_product_stock", {
      p_product_id: Number(item.id),
      p_quantity: quantityBought
    });

  if (stockError) {
    console.error("FAILED TO REDUCE STOCK:", stockError);
    throw stockError;
  }
}

// ====================================
// SEND EMAIL, SMS AND FULL INVOICE TO ADMIN
// Every order is notified immediately, regardless of payment method.
// Mobile Money verification is handled separately by Fassoko later.
await sendAdminOrderNotification({
  orderId: createdOrder.id, orderNumber, customerName, customerPhone,
  customerEmail,
  deliveryAddress: [district, area, address].filter(Boolean).join(", "),
  paymentMethod: paymentEl.value, paymentStatus: "unpaid", paymentReference: null,
  orderItems, subtotal: sub, delivery, total
});

// SAVE LAST ORDER
        // ====================================

        const order = {

          id:
            createdOrder.id,

          orderNumber:
            orderNumber,

          customer: {

            name:
              customerName,

            phone:
              customerPhone,

            email:
              customerEmail,

            district:
              district,

            area:
              area,

            address:
              address,

            notes:
              notes

          },

          payment:
            paymentEl.value,

          paymentReference: null,

          items:
            cart,

          subtotal:
            sub,

          delivery:
            delivery,

          total:
            total,

          createdAt:
            new Date().toISOString()

        };


        localStorage.setItem(
          "abamartLastOrder",
          JSON.stringify(order)
        );


        // ====================================
        // CLEAR CART
        // ====================================

        localStorage.removeItem(
          "abamartCart"
        );


        // ====================================
        // SUCCESS
        // ====================================

        const orderNumberEl =
          document.getElementById(
            "orderNumber"
          );


        if (orderNumberEl) {

          orderNumberEl.textContent =
            "Order #" +
            orderNumber;

        }


        const successModal =
          document.getElementById(
            "successModal"
          );


        if (successModal) {

          const successTitle =
            successModal.querySelector("h2");

          const successText =
            successModal.querySelector("p");

          // Every order — whatever payment method was chosen — gets the
          // same "Order placed!" confirmation. Mobile Money verification
          // is handled separately by Fassoko later, not on this screen.
          if (successTitle) successTitle.textContent = "Order placed!";
          if (successText) successText.textContent = "Thank you for shopping with Fassoko. Your order has been received.";

          successModal.classList.add("open");

        }


      } catch (error) {

        console.error(
          "SUPABASE ORDER ERROR:",
          error
        );


        toast(
          "Could not place order. Please try again."
        );


        if (submitButton) {
          submitButton.disabled = false;
        }

      }

    }
  );


// ============================================
// DONE BUTTON
// ============================================

const doneButton =
  document.getElementById("done");


if (doneButton) {

  doneButton.onclick = () => {

    location.href =
      "shop.html";

  };

}


// ============================================
// TOAST
// ============================================

function toast(message) {

  const el =
    document.getElementById("toast");

  if (!el) {
    return;
  }


  el.textContent =
    message;


  el.classList.add(
    "show"
  );


  setTimeout(
    () =>
      el.classList.remove(
        "show"
      ),
    1800
  );

}

// ============================================
// AUTO-FILL CHECKOUT FROM CUSTOMER PROFILE
// ============================================

async function loadCustomerCheckoutProfile() {

  // Stop safely if Supabase is unavailable
  if (typeof supabaseClient === "undefined") {
    console.warn(
      "CHECKOUT PROFILE: Supabase is not connected."
    );

    return;
  }


  try {

    // ========================================
    // GET CURRENT LOGGED-IN USER
    // ========================================

    const {
      data: {
        user
      },
      error: userError
    } = await supabaseClient
      .auth
      .getUser();


    if (userError) {
      throw userError;
    }


    // Customer is not logged in
    // Leave checkout fields empty
    if (!user) {

      console.log(
        "CHECKOUT PROFILE: No customer logged in."
      );

      return;
    }


    console.log(
      "CHECKOUT PROFILE USER:",
      user
    );


    // ========================================
    // LOAD CUSTOMER PROFILE
    // ========================================

    const {
      data: profile,
      error: profileError
    } = await supabaseClient
      .from("profiles")
      .select(`
        full_name,
        phone,
        email,
        district,
        area,
        address
      `)
      .eq(
        "id",
        user.id
      )
      .maybeSingle();


    if (profileError) {
      throw profileError;
    }


    console.log(
      "CHECKOUT PROFILE:",
      profile
    );


    // ========================================
    // GET CHECKOUT FIELDS
    // ========================================

    const nameEl =
      document.getElementById("name");


    const phoneEl =
      document.getElementById("phone");


    const emailEl =
      document.getElementById("email");


    const districtEl =
      document.getElementById("district");


    const areaEl =
      document.getElementById("area");


    const addressEl =
      document.getElementById("address");


    // ========================================
    // AUTO-FILL ONLY EMPTY FIELDS
    //
    // This means we will NOT overwrite
    // anything the customer already typed.
    // ========================================

    if (
      nameEl &&
      !nameEl.value.trim()
    ) {

      nameEl.value =
        profile?.full_name ||
        user.user_metadata?.full_name ||
        "";

    }


    if (
      phoneEl &&
      !phoneEl.value.trim()
    ) {

      phoneEl.value =
        profile?.phone ||
        user.phone ||
        user.user_metadata?.phone ||
        "";

    }


    if (
      emailEl &&
      !emailEl.value.trim()
    ) {

      emailEl.value =
        profile?.email ||
        user.email ||
        "";

    }


    if (
      districtEl &&
      !districtEl.value
    ) {

      districtEl.value =
        profile?.district ||
        "";

    }


    if (
      areaEl &&
      !areaEl.value.trim() &&
      profile?.area
    ) {

      // areaEl is now a <select> of delivery zones —
      // only apply the saved value if it matches one
      // of the listed areas (by value or option text).
      const match =
        Array.from(areaEl.options).find(
          opt =>
            opt.value.toLowerCase() ===
              profile.area.toLowerCase() ||
            opt.textContent.trim().toLowerCase() ===
              profile.area.toLowerCase()
        );

      if (match) {
        areaEl.value = match.value;
      }

    }


    if (
      addressEl &&
      !addressEl.value.trim()
    ) {

      addressEl.value =
        profile?.address ||
        "";

    }


    console.log(
      "CHECKOUT PROFILE AUTO-FILL COMPLETE"
    );

    // Recalculate totals in case the saved
    // delivery area was just auto-filled in.
    renderOrder();


  } catch (error) {

    // Do not stop checkout if profile loading fails
    console.error(
      "CHECKOUT PROFILE LOAD ERROR:",
      error
    );

  }

}
// ============================================
// START CHECKOUT
// ============================================

// Load products
loadCheckoutProducts();


// Load saved customer information
loadCustomerCheckoutProfile();