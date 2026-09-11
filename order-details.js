// ==========================================
// FASSOKO ORDER DETAILS
// ==========================================

let currentUser = null;


function $(id) {
  return document.getElementById(id);
}


document.addEventListener(
  "DOMContentLoaded",
  async () => {

    updateCartCount();

    await loadOrderDetails();

  }
);


// ==========================================
// LOAD ORDER
// ==========================================

async function loadOrderDetails() {

  try {

    const params =
      new URLSearchParams(
        window.location.search
      );


    const orderId =
      params.get("id");


    if (!orderId) {

      showOrderError();

      return;

    }


    // Get logged-in customer

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


    if (!session?.user) {

      location.href = "login.html";

      return;

    }


    currentUser =
      session.user;


    console.log(
      "LOADING ORDER:",
      orderId
    );


    // ======================================
    // LOAD ONLY THIS CUSTOMER'S ORDER
    // ======================================

// ======================================
// LOAD THE ORDER FIRST
// ======================================

const {
  data: order,
  error: orderError
} =
  await supabaseClient
    .from("orders")
    .select("*")
    .eq(
      "id",
      orderId
    )
    .eq(
      "user_id",
      currentUser.id
    )
    .maybeSingle();


console.log(
  "ORDER RESULT:",
  order
);


console.log(
  "ORDER ERROR:",
  orderError
);


if (orderError) {
  throw orderError;
}


if (!order) {

  showOrderError();

  return;

}


// ======================================
// LOAD ORDER ITEMS SEPARATELY
// ======================================

const {
  data: items,
  error: itemsError
} =
  await supabaseClient
    .from("order_items")
    .select("*")
    .eq(
      "order_id",
      order.id
    );


console.log(
  "ORDER ITEMS:",
  items
);


console.log(
  "ORDER ITEMS ERROR:",
  itemsError
);


if (itemsError) {
  throw itemsError;
}


// Attach items to the order

order.order_items =
  items || [];


console.log(
  "COMPLETE ORDER DETAILS:",
  order
);

    console.log(
      "ORDER DETAILS:",
      order
    );


    renderOrderDetails(
      order
    );


  } catch (error) {

  console.error(
    "ORDER DETAILS ERROR:",
    error
  );


  $("orderDetailsLoading").hidden =
    true;


  $("orderDetailsError").hidden =
    false;


  const errorText =
    $("orderDetailsError")
      .querySelector("p");


  if (errorText) {

    errorText.textContent =
      "There was a problem loading this order. Please try again.";

  }

}

}


// ==========================================
// RENDER ORDER
// ==========================================

function renderOrderDetails(order) {

    currentOrder = order;

    $("orderDetailsLoading").hidden =
    true;


  $("detailOrderNumber").textContent =
    `Order #${order.id}`;


  $("detailOrderDate").textContent =
    order.created_at
      ? `Placed on ${new Date(
          order.created_at
        ).toLocaleDateString(
          "en-RW",
          {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
          }
        )}`
      : "";


  const status =
    order.status ||
    "Pending";

const normalizedStatus =
  String(status)
    .toLowerCase()
    .trim();


const cancelArea =
  $("detailCancelArea");


if (cancelArea) {

  cancelArea.hidden =
    normalizedStatus !== "pending";

}

  $("detailOrderStatus").textContent =
    status;


  $("detailOrderStatus").className =
    `detail-status status-${String(status)
      .toLowerCase()
      .replace(/\s+/g, "-")}`;


  $("detailPaymentStatus").textContent =
    order.payment_status ||
    "Unpaid";


  $("detailAddress").textContent =
    order.delivery_address ||
    "No delivery address";


  $("detailTotal").textContent =
    formatMoney(
      order.total_amount
    );


  // ======================================
  // PRODUCTS
  // ======================================

  const items =
    order.order_items || [];


  $("orderProductsList").innerHTML =
    items.length
      ? items.map(item => {

          const quantity =
            Number(
              item.quantity || 0
            );


          const price =
            Number(
              item.price || 0
            );


          const subtotal =
            Number(
              item.subtotal ||
              price * quantity
            );


          const optionName =
            item.option_name
              ? `<small class="ordered-option">
                   Option: ${escapeHtml(
                     item.option_name
                   )}
                 </small>`
              : "";


          return `

            <div class="order-product-row">

              <div class="order-product-image">

                <i class="fa-solid fa-bag-shopping"></i>

              </div>


              <div class="order-product-info">

                <strong>
                  ${escapeHtml(
                    item.product_name ||
                    "Product"
                  )}
                </strong>

                ${optionName}


                <small>
                  ${quantity}
                  ×
                  ${formatMoney(price)}
                </small>

              </div>


              <strong class="order-product-total">

                ${formatMoney(subtotal)}

              </strong>

            </div>

          `;

        }).join("")
      : `
          <div class="no-order-products">
            No products found for this order.
          </div>
        `;


  // ======================================
  // NOTES
  // ======================================

  if (
    order.notes &&
    String(order.notes).trim()
  ) {

    $("detailNotesCard").hidden =
      false;


    $("detailNotes").textContent =
      order.notes;

  }


  // Show page

  $("orderDetailsContent").hidden =
    false;

}


// ==========================================
// ERROR
// ==========================================

function showOrderError() {

  $("orderDetailsLoading").hidden =
    true;


  $("orderDetailsContent").hidden =
    true;


  $("orderDetailsError").hidden =
    false;

}


// ==========================================
// CART COUNT
// ==========================================

function updateCartCount() {

  const count =
    $("cartCount");


  if (!count) {
    return;
  }


  try {

    const cart =
      JSON.parse(
        localStorage.getItem("cart") ||
        "[]"
      );


    count.textContent =
      cart.reduce(
        (sum, item) =>
          sum +
          Number(item.qty || 1),
        0
      );

  } catch {

    count.textContent =
      "0";

  }

}


// ==========================================
// MONEY
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

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}