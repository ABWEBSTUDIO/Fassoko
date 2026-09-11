// ==========================================
// FASSOKO — SHARE YOUR EXPERIENCE
// Lets a logged-in customer submit a testimonial.
// It lands in Supabase with is_approved = false until
// an admin approves it from the admin panel.
// ==========================================

(function () {

  const loadingEl = document.getElementById("testimonyLoading");
  const loggedOutEl = document.getElementById("testimonyLoggedOut");
  const formEl = document.getElementById("testimonyForm");
  const successEl = document.getElementById("testimonySuccess");
  const nameEl = document.getElementById("testimonyName");
  const starPicker = document.getElementById("testimonyStarPicker");
  const ratingInput = document.getElementById("testimonyRating");
  const locationInput = document.getElementById("testimonyLocation");
  const messageInput = document.getElementById("testimonyMessage");
  const submitBtn = document.getElementById("testimonySubmitBtn");

  if (!formEl) return;

  let currentUser = null;
  let currentName = "Customer";

  function setStars(value) {
    ratingInput.value = value;
    starPicker.querySelectorAll(".testimony-star").forEach(btn => {
      btn.classList.toggle("active", Number(btn.dataset.value) <= value);
    });
  }

  starPicker.querySelectorAll(".testimony-star").forEach(btn => {
    btn.addEventListener("click", () => setStars(Number(btn.dataset.value)));
  });

  setStars(5);

  async function init() {
    try {
      const {
        data: { session },
        error: sessionError
      } = await supabaseClient.auth.getSession();

      if (sessionError) throw sessionError;

      loadingEl.hidden = true;

      if (!session?.user) {
        loggedOutEl.hidden = false;
        return;
      }

      currentUser = session.user;

      // Look up display name the same way account.js does.
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("full_name")
        .eq("id", currentUser.id)
        .maybeSingle();

      currentName =
        profile?.full_name ||
        currentUser.user_metadata?.full_name ||
        currentUser.user_metadata?.name ||
        (currentUser.email ? currentUser.email.split("@")[0] : "Customer");

      nameEl.textContent = currentName;
      formEl.hidden = false;

    } catch (error) {
      console.error("TESTIMONY INIT ERROR:", error);
      loadingEl.hidden = true;
      loggedOutEl.hidden = false;
    }
  }

  formEl.addEventListener("submit", async e => {
    e.preventDefault();

    if (!currentUser) return;

    const message = messageInput.value.trim();
    if (!message) return;

    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "SUBMITTING...";

    try {
      const { error } = await supabaseClient
        .from("testimonials")
        .insert({
          user_id: currentUser.id,
          name: currentName,
          location: locationInput.value.trim() || null,
          rating: Number(ratingInput.value) || 5,
          message: message,
          is_approved: false
        });

      if (error) throw error;

      formEl.hidden = true;
      successEl.hidden = false;

    } catch (error) {
      console.error("TESTIMONY SUBMIT ERROR:", error);
      if (typeof toast === "function") {
        toast(error.message || "Could not submit your review.", false);
      } else {
        alert(error.message || "Could not submit your review.");
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  init();

})();
