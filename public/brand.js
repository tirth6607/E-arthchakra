/* =========================================================
   E-ARTHCHAKRA — BRAND INTERACTIONS (v2)
   Scroll reveals, navbar state and the story-video sound toggle.
   Safe to load on any page; every block checks its elements exist.
   ========================================================= */
(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* reveal on scroll */
    const items = document.querySelectorAll(".ec-reveal");
    if (items.length) {
        if (reduce || !("IntersectionObserver" in window)) {
            items.forEach((el) => el.classList.add("is-in"));
        } else {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-in");
                        io.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
            items.forEach((el) => io.observe(el));
        }
    }

    /* navbar background once scrolled */
    const navbar = document.querySelector(".navbar");
    if (navbar) {
        const onScroll = () => navbar.classList.toggle("is-scrolled", window.scrollY > 10);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
    }

    /* story video: autoplay muted when visible, tap to hear the voice */
    const video = document.getElementById("storyVideo");
    const sound = document.getElementById("storySound");
    if (video) {
        if ("IntersectionObserver" in window && !reduce) {
            new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) video.play().catch(() => {});
                    else video.pause();
                });
            }, { threshold: 0.4 }).observe(video);
        }
        if (sound) {
            const label = () => {
                sound.innerHTML = video.muted
                    ? '<span aria-hidden="true">🔊</span> Tap for sound'
                    : '<span aria-hidden="true">🔇</span> Mute';
            };
            sound.addEventListener("click", () => {
                video.muted = !video.muted;
                if (!video.muted) { video.currentTime = 0; video.play().catch(() => {}); }
                label();
            });
            label();
        }
    }
})();
