// ==========================================
// FASSOKO - CUSTOMER AUTHENTICATION
// ==========================================

// Your Supabase project details
const SUPABASE_URL = "https://rcflcepyzzgrbbpwgmac.supabase.co";

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZmxjZXB5enpncmJicHdnbWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwMTAyOTAsImV4cCI6MjEwMjU4NjI5MH0.201Cz1aPcsiDoFBqwE0vwf5VsP7-WuMHawW925NJoPo";


// Create Supabase client
const client = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


// ==========================================
// PAGE ELEMENTS
// ==========================================

const tabs = document.querySelectorAll(".tab");
const forms = document.querySelectorAll(".form");


// ==========================================
// LOGIN / REGISTER TABS
// ==========================================

function mode(m) {

  tabs.forEach(t => {

    t.classList.toggle(
      "active",
      t.dataset.mode === m
    );

  });


  forms.forEach(f => {

    f.classList.toggle(
      "active",
      f.id === (
        m === "login"
          ? "loginForm"
          : "registerForm"
      )
    );

  });

}


tabs.forEach(t => {

  t.onclick = () => {

    mode(
      t.dataset.mode
    );

  };

});


document
  .querySelectorAll("[data-switch]")
  .forEach(b => {

    b.onclick = () => {

      mode(
        b.dataset.switch
      );

    };

  });


// ==========================================
// SHOW / HIDE PASSWORD
// ==========================================

document
  .querySelectorAll(".password button")
  .forEach(b => {

    b.onclick = () => {

      const input = document.getElementById(
        b.dataset.target
      );


      input.type =
        input.type === "password"
          ? "text"
          : "password";


      b.textContent =
        input.type === "password"
          ? "Show"
          : "Hide";

    };

  });


// ==========================================
// TOAST MESSAGE
// ==========================================

function toast(text, success = true) {

  const x =
    document.getElementById("toast");


  x.textContent = text;


  x.style.background =
    success
      ? "#0b6d35"
      : "#c62828";


  x.classList.add("show");


  setTimeout(() => {

    x.classList.remove("show");

  }, 3500);

}


// ==========================================
// CREATE CUSTOMER ACCOUNT
// ==========================================

document
  .getElementById("registerForm")
  .addEventListener(
    "submit",
    async e => {

      e.preventDefault();


      const name =
        document
          .getElementById("name")
          .value
          .trim();


      const phone =
        document
          .getElementById("phone")
          .value
          .trim();


      const email =
        document
          .getElementById("email")
          .value
          .trim()
          .toLowerCase();


      const password =
        document
          .getElementById("password")
          .value;


      const confirm =
        document
          .getElementById("confirm")
          .value;


      // Validate passwords
      if (password !== confirm) {

        toast(
          "Passwords do not match.",
          false
        );

        return;

      }


      if (password.length < 6) {

        toast(
          "Password must be at least 6 characters.",
          false
        );

        return;

      }


      const submitButton =
        e.target.querySelector(
          'button[type="submit"]'
        );


      const originalText =
        submitButton.textContent;


      submitButton.disabled = true;

      submitButton.textContent =
        "CREATING ACCOUNT...";


      try {

        // Create Supabase Auth user
        const {
          data,
          error
        } = await client.auth.signUp({

          email: email,

          password: password,

          options: {

            data: {

              full_name: name,

              phone: phone

            }

          }

        });


        if (error) {

          throw error;

        }


        console.log(
          "CUSTOMER CREATED:",
          data.user
        );


        // If email confirmation is enabled
        if (
          data.user &&
          !data.session
        ) {

          toast(
            "Account created! Check your email to confirm your account."
          );

          mode("login");

          return;

        }


        toast(
          "Account created successfully!"
        );


        // Go to homepage
        setTimeout(() => {

          window.location.href =
            "index.html";

        }, 1000);


      } catch (err) {

        console.error(
          "SIGNUP ERROR:",
          err
        );


        toast(
          err.message ||
          "Could not create account.",
          false
        );


      } finally {

        submitButton.disabled =
          false;


        submitButton.textContent =
          originalText;

      }

    }
  );


// ==========================================
// CUSTOMER LOGIN
// ==========================================

document
  .getElementById("loginForm")
  .addEventListener(
    "submit",
    async e => {

      e.preventDefault();


      const contact =
        document
          .getElementById("loginContact")
          .value
          .trim();


      const password =
        document
          .getElementById("loginPassword")
          .value;


      // This version uses email login
      if (
        !contact.includes("@")
      ) {

        toast(
          "Please enter your email address.",
          false
        );

        return;

      }


      const submitButton =
        e.target.querySelector(
          'button[type="submit"]'
        );


      const originalText =
        submitButton.textContent;


      submitButton.disabled = true;

      submitButton.textContent =
        "LOGGING IN...";


      try {

        const {
          data,
          error
        } = await client.auth.signInWithPassword({

          email: contact.toLowerCase(),

          password: password

        });


        if (error) {

          throw error;

        }


        console.log(
          "LOGIN SUCCESS:",
          data.user
        );


        toast(
          "Welcome back!"
        );


        // Go back to homepage
        setTimeout(() => {

          window.location.href =
            "index.html";

        }, 700);


      } catch (err) {

        console.error(
          "LOGIN ERROR:",
          err
        );


        toast(
          err.message ||
          "Login failed.",
          false
        );


      } finally {

        submitButton.disabled =
          false;


        submitButton.textContent =
          originalText;

      }

    }
  );


// ==========================================
// CHECK IF ALREADY LOGGED IN
// ==========================================

async function checkAuth() {

  const {
    data: {
      user
    }
  } = await client.auth.getUser();


  if (user) {

    console.log(
      "CUSTOMER ALREADY LOGGED IN:",
      user
    );

  }

}


checkAuth();