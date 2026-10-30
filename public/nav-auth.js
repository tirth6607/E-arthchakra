/* =========================================================
   E-ARTHCHAKRA — NAVBAR LOGIN / REGISTER
   Adds Login + Register (or Dashboard + Logout when signed in)
   to the top-right of the public pages and the mobile menu.
   ========================================================= */

(() => {

    let user = null;
    try { user = JSON.parse(localStorage.getItem("earthchakra_user") || "null"); } catch (e) { /* ignore */ }
    const loggedIn = !!(user && user.loggedIn);

    const dashboardUrl = !loggedIn ? "login.html"
        : user.role === "admin" ? "admin.html"
        : user.role === "partner" ? "partner.html"
        : "dashboard.html";

    function logout(event) {
        event.preventDefault();
        fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", keepalive: true })
            .catch(() => {})
            .finally(() => {
                localStorage.removeItem("earthchakra_user");
                window.location.href = "index.html";
            });
    }

    function link(text, href, className) {
        const a = document.createElement("a");
        a.textContent = text;
        a.href = href;
        a.className = className;
        return a;
    }

    /* ---------- desktop (top right) ---------- */

    function desktopLinks() {
        const items = [];
        if (loggedIn) {
            if (user.role === "customer") items.push(link("Report Waste", "report.html", "nav-auth-link"));
            items.push(link("Dashboard", dashboardUrl, "nav-auth-link"));
            const out = link("Logout", "#", "nav-auth-link nav-auth-logout");
            out.addEventListener("click", logout);
            items.push(out);
        } else {
            items.push(link("Report Waste", "report.html", "nav-auth-link"));
            items.push(link("Login", "login.html", "nav-auth-link"));
            items.push(link("Register", "register.html", "nav-auth-register"));
        }
        return items;
    }

    const actions = document.querySelector(".nav-actions");
    const pricingCta = document.querySelector("header.navbar > .nav-cta");

    if (actions) {
        // Login / Register sit to the left of "Get Started"
        actions.prepend(...desktopLinks());
        actions.classList.add("nav-actions-auth");
    } else if (pricingCta) {
        // pricing.html has no .nav-actions wrapper: build one
        const group = document.createElement("div");
        group.className = "nav-actions-auth";
        pricingCta.before(group);
        group.append(...desktopLinks(), pricingCta);
    }

    /* ---------- mobile menu ---------- */

    const mobileMenu = document.querySelector(".mobile-menu");

    if (mobileMenu) {
        const cta = mobileMenu.querySelector(".mobile-cta");
        const items = [];

        if (loggedIn) {
            items.push(link("Dashboard", dashboardUrl, ""));
            const out = link("Logout", "#", "");
            out.addEventListener("click", logout);
            items.push(out);
        } else {
            items.push(link("Login", "login.html", ""));
            items.push(link("Register", "register.html", ""));
        }

        items.forEach((item) => cta ? mobileMenu.insertBefore(item, cta) : mobileMenu.appendChild(item));
    }

})();
