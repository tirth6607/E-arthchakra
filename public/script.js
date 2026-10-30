/* =========================================================
   E-ARTHCHAKRA — MAIN JAVASCRIPT
   ========================================================= */


/* =========================================================
   1. MOBILE MENU
   ========================================================= */

const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileMenu = document.getElementById("mobileMenu");

if (mobileMenuBtn && mobileMenu) {

    mobileMenuBtn.addEventListener("click", () => {

        mobileMenu.classList.toggle("open");

        if (mobileMenu.classList.contains("open")) {
            mobileMenuBtn.textContent = "✕";
        } else {
            mobileMenuBtn.textContent = "☰";
        }

    });

}


/* =========================================================
   2. CLOSE MOBILE MENU AFTER CLICKING A LINK
   ========================================================= */

const mobileLinks = document.querySelectorAll(".mobile-menu a");

mobileLinks.forEach((link) => {

    link.addEventListener("click", () => {

        if (mobileMenu) {
            mobileMenu.classList.remove("open");
        }

        if (mobileMenuBtn) {
            mobileMenuBtn.textContent = "☰";
        }

    });

});


/* =========================================================
   3. NAVBAR SCROLL EFFECT
   ========================================================= */

const navbar = document.querySelector(".navbar");

window.addEventListener("scroll", () => {

    if (!navbar) return;

    if (window.scrollY > 20) {

        navbar.style.boxShadow =
            "0 5px 25px rgba(13, 43, 27, 0.06)";

    } else {

        navbar.style.boxShadow = "none";

    }

});


/* =========================================================
   4. SCROLL REVEAL ANIMATION
   ========================================================= */

const revealElements = document.querySelectorAll(
    ".problem-card, .service-card, .step-card, .waste-card, .why-item"
);

const revealObserver = new IntersectionObserver(
    (entries) => {

        entries.forEach((entry) => {

            if (entry.isIntersecting) {

                entry.target.style.opacity = "1";
                entry.target.style.transform = "translateY(0)";

                revealObserver.unobserve(entry.target);

            }

        });

    },
    {
        threshold: 0.12
    }
);


revealElements.forEach((element) => {

    element.style.opacity = "0";
    element.style.transform = "translateY(25px)";
    element.style.transition =
        "opacity 0.6s ease, transform 0.6s ease";

    revealObserver.observe(element);

});


/* =========================================================
   5. DASHBOARD NUMBER COUNTER
   ========================================================= */

function animateNumber(element, target, duration = 1200) {

    let start = 0;

    const startTime = performance.now();

    function update(currentTime) {

        const elapsed = currentTime - startTime;

        const progress = Math.min(elapsed / duration, 1);

        const easedProgress =
            1 - Math.pow(1 - progress, 3);

        const currentValue =
            Math.floor(target * easedProgress);

        element.textContent =
            currentValue.toLocaleString();

        if (progress < 1) {

            requestAnimationFrame(update);

        } else {

            element.textContent =
                target.toLocaleString();

        }

    }

    requestAnimationFrame(update);

}


/* =========================================================
   6. START COUNTERS WHEN DASHBOARD IS VISIBLE
   ========================================================= */

const dashboardStats = document.querySelector(
    ".hero-dashboard"
);

let countersStarted = false;

if (dashboardStats) {

    const counterObserver = new IntersectionObserver(
        (entries) => {

            if (
                entries[0].isIntersecting &&
                !countersStarted
            ) {

                countersStarted = true;

                const statNumbers =
                    document.querySelectorAll(
                        ".stat-card strong"
                    );

                if (statNumbers.length >= 4) {

                    animateNumber(
                        statNumbers[0],
                        4820
                    );

                    animateNumber(
                        statNumbers[1],
                        4120
                    );

                    animateNumber(
                        statNumbers[2],
                        85
                    );

                    animateNumber(
                        statNumbers[3],
                        186
                    );

                }

            }

        },
        {
            threshold: 0.3
        }
    );

    counterObserver.observe(dashboardStats);

}


/* =========================================================
   7. BUTTON RIPPLE EFFECT
   ========================================================= */

const buttons = document.querySelectorAll(".btn");

buttons.forEach((button) => {

    button.addEventListener("click", function (event) {

        const ripple = document.createElement("span");

        ripple.classList.add("button-ripple");

        const rect =
            button.getBoundingClientRect();

        ripple.style.left =
            `${event.clientX - rect.left}px`;

        ripple.style.top =
            `${event.clientY - rect.top}px`;

        button.appendChild(ripple);

        setTimeout(() => {

            ripple.remove();

        }, 600);

    });

});


/* =========================================================
   8. PREVENT EMPTY HASH JUMP
   ========================================================= */

document.querySelectorAll('a[href="#"]').forEach((link) => {

    link.addEventListener("click", (event) => {

        event.preventDefault();

    });

});


/* =========================================================
   9. CURRENT YEAR
   ========================================================= */

const yearElements =
    document.querySelectorAll(".current-year");

yearElements.forEach((element) => {

    element.textContent =
        new Date().getFullYear();

});


/* =========================================================
   10. CONSOLE MESSAGE
   ========================================================= */

console.log(
    "%cE-arthchakra",
    "font-size: 24px; font-weight: bold; color: #18532f;"
);

console.log(
    "Business waste management, simplified."
);