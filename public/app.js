/* =========================================================
   E-ARTHCHAKRA — APP SHELL (every public page)
   - item catalogue + illustrations (used by search and the homepage)
   - city picker (remembered), header search with suggestions
   - pickup cart storage, and pre-filling pickup.html from the cart
   ========================================================= */
(() => {
    const store = {
        get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
        del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
    };

    /* ---------- illustrations (80×80) ---------- */
    const I = {
        newspaper: '<rect x="13" y="22" width="52" height="42" rx="4" fill="#e6dfcd"/><rect x="17" y="16" width="52" height="42" rx="4" fill="#fbf8f0" stroke="#ddd4bf" stroke-width="1.5"/><rect x="22" y="22" width="42" height="6" rx="2" fill="#24332b"/><rect x="22" y="32" width="18" height="15" rx="2" fill="#75c88c"/><rect x="44" y="32" width="20" height="3" rx="1.5" fill="#a5b0aa"/><rect x="44" y="38" width="20" height="3" rx="1.5" fill="#a5b0aa"/><rect x="44" y="44" width="14" height="3" rx="1.5" fill="#a5b0aa"/><rect x="22" y="51" width="42" height="3" rx="1.5" fill="#c4ccc7"/>',
        books: '<rect x="14" y="50" width="52" height="11" rx="3" fill="#2d8a4d"/><rect x="18" y="52.5" width="40" height="2" rx="1" fill="#a6e0b7"/><rect x="18" y="38" width="46" height="11" rx="3" fill="#f0c36a" transform="rotate(-4 41 43)"/><rect x="21" y="40.5" width="34" height="2" rx="1" fill="#fff6dc" transform="rotate(-4 41 43)"/><rect x="16" y="25" width="48" height="12" rx="3" fill="#18532f" transform="rotate(3 40 31)"/><rect x="20" y="28" width="36" height="2" rx="1" fill="#75c88c" transform="rotate(3 40 31)"/>',
        office: '<rect x="20" y="14" width="38" height="50" rx="3" fill="#e9eeeb" transform="rotate(-8 39 39)"/><rect x="24" y="16" width="38" height="50" rx="3" fill="#fff" stroke="#d6ddd9" stroke-width="1.5"/><rect x="30" y="24" width="20" height="3" rx="1.5" fill="#2d8a4d"/><rect x="30" y="32" width="26" height="2.5" rx="1.2" fill="#b5bfba"/><rect x="30" y="38" width="26" height="2.5" rx="1.2" fill="#b5bfba"/><rect x="30" y="44" width="22" height="2.5" rx="1.2" fill="#b5bfba"/><rect x="30" y="50" width="24" height="2.5" rx="1.2" fill="#b5bfba"/>',
        carton: '<path d="M14 30 L40 20 L66 30 L40 40 Z" fill="#e2b47c"/><path d="M14 30 L40 40 L40 66 L14 56 Z" fill="#c98f52"/><path d="M66 30 L40 40 L40 66 L66 56 Z" fill="#b57b40"/><path d="M27 25 L53 35 L53 41 L27 31 Z" fill="#f1d9b0" opacity=".9"/><path d="M46 48 L59 43 L59 51 L46 56 Z" fill="#f7ead2"/><path d="M19 46 l6 2.3 M19 50 l6 2.3" stroke="#8f5e2c" stroke-width="1.6" stroke-linecap="round"/>',
        bottles: '<path d="M29 18 h8 v6 c0 3 6 6 6 12 v24 a4 4 0 0 1 -4 4 h-12 a4 4 0 0 1 -4 -4 v-24 c0 -6 6 -9 6 -12 z" fill="#a9e2d9" stroke="#6fbfb2" stroke-width="1.5"/><rect x="28" y="13" width="10" height="6" rx="1.5" fill="#2d8a4d"/><rect x="23" y="40" width="20" height="10" fill="#2d8a4d" opacity=".85"/><path d="M49 26 h6 v5 c0 2 5 5 5 10 v19 a3 3 0 0 1 -3 3 h-10 a3 3 0 0 1 -3 -3 v-19 c0 -5 5 -8 5 -10 z" fill="#cdeee8" stroke="#8ccfc4" stroke-width="1.5"/><rect x="48" y="22" width="8" height="5" rx="1.2" fill="#75c88c"/>',
        containers: '<path d="M16 34 h48 l-5 28 a4 4 0 0 1 -4 3 h-30 a4 4 0 0 1 -4 -3 z" fill="#d7efe9" stroke="#8ccfc4" stroke-width="1.5"/><rect x="13" y="26" width="54" height="9" rx="3" fill="#2d8a4d"/><rect x="30" y="21" width="20" height="6" rx="2" fill="#18532f"/><path d="M24 44 h32" stroke="#8ccfc4" stroke-width="1.5" stroke-dasharray="3 3"/><path d="M37 50 l3 -4 l3 4 h-2 v4 h-2 v-4 z" fill="#2d8a4d"/>',
        iron: '<rect x="10" y="44" width="60" height="7" rx="3.5" fill="#6d7a75" transform="rotate(-12 40 47)"/><rect x="12" y="34" width="58" height="7" rx="3.5" fill="#8a9792" transform="rotate(-12 40 37)"/><rect x="14" y="54" width="54" height="7" rx="3.5" fill="#55615c" transform="rotate(-12 40 57)"/><circle cx="66" cy="27" r="3.5" fill="#3b4642"/><circle cx="68" cy="45" r="3.5" fill="#3b4642"/><path d="M20 24 h22 v4 h-8 v14 h8 v4 h-22 v-4 h8 v-14 h-8 z" fill="#b06b3a" opacity=".85"/>',
        cans: '<rect x="18" y="22" width="22" height="40" rx="5" fill="#d9e1de"/><rect x="18" y="31" width="22" height="18" fill="#2d8a4d"/><ellipse cx="29" cy="23" rx="11" ry="3.5" fill="#eef2f0" stroke="#b6c1bd"/><rect x="40" y="28" width="22" height="34" rx="5" fill="#c7d1cd"/><rect x="40" y="36" width="22" height="14" fill="#75c88c"/><ellipse cx="51" cy="29" rx="11" ry="3.5" fill="#e6ece9" stroke="#aab6b1"/><path d="M24 39 h10" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>',
        copper: '<ellipse cx="40" cy="42" rx="25" ry="20" fill="none" stroke="#c87941" stroke-width="6"/><ellipse cx="40" cy="42" rx="16" ry="12" fill="none" stroke="#dd9157" stroke-width="5"/><ellipse cx="40" cy="42" rx="7.5" ry="5" fill="none" stroke="#b96a33" stroke-width="4"/><path d="M63 34 c6 -6 8 -14 4 -20" fill="none" stroke="#c87941" stroke-width="4" stroke-linecap="round"/>',
        utensils: '<path d="M16 34 h48 v18 a12 12 0 0 1 -12 12 h-24 a12 12 0 0 1 -12 -12 z" fill="#c9d3cf"/><path d="M16 34 h48 v6 h-48 z" fill="#e3e9e6"/><rect x="12" y="30" width="56" height="6" rx="3" fill="#aab6b1"/><path d="M12 40 h-4 M68 40 h4" stroke="#7f8c87" stroke-width="4" stroke-linecap="round"/><path d="M26 46 c4 8 22 8 28 0" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/><ellipse cx="40" cy="22" rx="12" ry="3" fill="#aab6b1"/><rect x="37" y="16" width="6" height="6" rx="2" fill="#7f8c87"/>',
        phone: '<rect x="20" y="12" width="26" height="48" rx="5" fill="#24332b"/><rect x="23" y="17" width="20" height="36" rx="2" fill="#75c88c"/><circle cx="33" cy="56" r="1.8" fill="#6d7a75"/><path d="M33 35 l-4 4 h3 v5 h2 v-5 h3 z" fill="#18532f"/><path d="M46 52 c10 0 6 14 16 14 h4" fill="none" stroke="#24332b" stroke-width="3" stroke-linecap="round"/><rect x="60" y="61" width="10" height="9" rx="2" fill="#e8eeeb" stroke="#24332b" stroke-width="2"/>',
        laptop: '<path d="M18 18 h44 a3 3 0 0 1 3 3 v29 h-50 v-29 a3 3 0 0 1 3 -3 z" fill="#24332b"/><rect x="19" y="22" width="42" height="25" rx="1.5" fill="#cfeedd"/><rect x="24" y="27" width="16" height="3" rx="1.5" fill="#2d8a4d"/><rect x="24" y="33" width="28" height="2.5" rx="1.2" fill="#8fd6a2"/><rect x="24" y="38" width="22" height="2.5" rx="1.2" fill="#8fd6a2"/><path d="M8 52 h64 l-4 7 h-56 z" fill="#aab6b1"/><rect x="33" y="52" width="14" height="2.5" rx="1.2" fill="#7f8c87"/>',
        tv: '<rect x="10" y="16" width="60" height="38" rx="4" fill="#24332b"/><rect x="14" y="20" width="52" height="30" rx="2" fill="#3c5a49"/><path d="M14 44 l14 -12 l10 8 l8 -6 l20 16 v0 h-52 z" fill="#75c88c" opacity=".75"/><circle cx="54" cy="28" r="4" fill="#cfeedd"/><path d="M34 54 h12 l3 8 h-18 z" fill="#55615c"/><rect x="26" y="62" width="28" height="3" rx="1.5" fill="#3b4642"/>',
        ac: '<rect x="8" y="22" width="64" height="26" rx="6" fill="#f3f6f5" stroke="#b6c1bd" stroke-width="1.5"/><rect x="8" y="40" width="64" height="8" rx="3" fill="#e1e8e5"/><path d="M14 44 h52" stroke="#aab6b1" stroke-width="1.5"/><circle cx="62" cy="30" r="2" fill="#2d8a4d"/><rect x="14" y="28" width="16" height="3" rx="1.5" fill="#cbd4d0"/><path d="M22 54 c0 4 -3 5 -3 9 M40 54 c0 4 -3 5 -3 9 M58 54 c0 4 -3 5 -3 9" fill="none" stroke="#8fd6a2" stroke-width="2.5" stroke-linecap="round"/>',
        fridge: '<rect x="22" y="8" width="36" height="64" rx="5" fill="#f3f6f5" stroke="#b6c1bd" stroke-width="1.5"/><path d="M22 32 h36" stroke="#b6c1bd" stroke-width="1.5"/><rect x="26" y="14" width="3" height="12" rx="1.5" fill="#7f8c87"/><rect x="26" y="38" width="3" height="16" rx="1.5" fill="#7f8c87"/><rect x="44" y="12" width="10" height="5" rx="1.5" fill="#75c88c"/><rect x="26" y="72" width="6" height="3" rx="1" fill="#55615c"/><rect x="48" y="72" width="6" height="3" rx="1" fill="#55615c"/>',
        washer: '<rect x="14" y="10" width="52" height="60" rx="6" fill="#f3f6f5" stroke="#b6c1bd" stroke-width="1.5"/><rect x="14" y="10" width="52" height="12" rx="6" fill="#e1e8e5"/><circle cx="22" cy="16" r="2" fill="#2d8a4d"/><rect x="40" y="14" width="20" height="4" rx="2" fill="#cbd4d0"/><circle cx="40" cy="45" r="17" fill="#cbd4d0"/><circle cx="40" cy="45" r="12.5" fill="#a9e2d9"/><path d="M30 47 c4 -4 8 4 12 0 s7 -3 9 -1" fill="none" stroke="#6fbfb2" stroke-width="2.5" stroke-linecap="round"/>',
        /* service tiles */
        home: '<path d="M14 40 L40 18 L66 40" fill="none" stroke="#18532f" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 36 v30 h40 v-30 L40 20 z" fill="#ffffff"/><rect x="34" y="48" width="12" height="18" rx="2" fill="#2d8a4d"/><rect x="24" y="42" width="8" height="8" rx="1.5" fill="#a6e0b7"/><rect x="48" y="42" width="8" height="8" rx="1.5" fill="#a6e0b7"/><path d="M56 52 c-3 0 -5 3 -5 7 v6 h12 v-6 c0 -4 -2 -7 -5 -7 z" fill="#c98f52"/><path d="M55 52 l2 -3 l2 3" fill="none" stroke="#8f5e2c" stroke-width="1.5"/>',
        business: '<rect x="16" y="14" width="30" height="52" rx="3" fill="#ffffff"/><g fill="#a6e0b7"><rect x="21" y="20" width="7" height="6" rx="1"/><rect x="34" y="20" width="7" height="6" rx="1"/><rect x="21" y="31" width="7" height="6" rx="1"/><rect x="34" y="31" width="7" height="6" rx="1"/><rect x="21" y="42" width="7" height="6" rx="1"/><rect x="34" y="42" width="7" height="6" rx="1"/></g><rect x="27" y="54" width="8" height="12" rx="1" fill="#2d8a4d"/><path d="M48 50 L58 46 L68 50 L58 54 Z" fill="#e2b47c"/><path d="M48 50 L58 54 L58 66 L48 62 Z" fill="#c98f52"/><path d="M68 50 L58 54 L58 66 L68 62 Z" fill="#b57b40"/>',
        report: '<path d="M10 66 L30 30 h20 L70 66 z" fill="#ffffff" opacity=".9"/><path d="M40 34 v6 M40 46 v7 M40 59 v7" stroke="#2d8a4d" stroke-width="3" stroke-linecap="round"/><path d="M52 40 c-7 -8 -14 -12 -14 -21 a14 14 0 0 1 28 0 c0 9 -7 13 -14 21 z" fill="#18532f"/><circle cx="52" cy="19" r="5" fill="#a6e0b7"/><path d="M20 58 l7 -3 l3 5 l-8 2 z" fill="#c98f52"/>',
    };
    const icon = (k, cls = "") => `<svg class="${cls}" viewBox="0 0 80 80" aria-hidden="true">${I[k] || ""}</svg>`;

    const CATS = [
        { id: "paper", name: "Paper", value: "Paper", icon: "newspaper", tint: "#fbf3e2" },
        { id: "cardboard", name: "Cardboard", value: "Cardboard", icon: "carton", tint: "#f8ecdc" },
        { id: "plastic", name: "Plastic", value: "Plastic", icon: "bottles", tint: "#e3f5f2" },
        { id: "metal", name: "Metal", value: "Metal", icon: "utensils", tint: "#eef1f0" },
        { id: "ewaste", name: "E-waste", value: "E-waste", icon: "phone", tint: "#e7f4ea" },
    ];
    const ITEMS = [
        { id: "newspaper", name: "Newspapers", cat: "paper", note: "Old newspapers & magazines", keys: "raddi akhbar magazine paper" },
        { id: "carton", name: "Cartons & boxes", cat: "cardboard", note: "Delivery, gift & mithai boxes", keys: "box packaging dabba gift cardboard" },
        { id: "bottles", name: "Plastic bottles", cat: "plastic", note: "PET bottles & jars", keys: "pet bottle plastic" },
        { id: "ac", name: "Air conditioner", cat: "ewaste", note: "Split & window AC", keys: "ac aircon air conditioner" },
        { id: "fridge", name: "Refrigerator", cat: "ewaste", note: "Single & double door", keys: "fridge refrigerator" },
        { id: "iron", name: "Iron & steel", cat: "metal", note: "Rods, pipes, old furniture", keys: "loha lohe pipe rod iron steel" },
        { id: "laptop", name: "Laptops & computers", cat: "ewaste", note: "Laptops, CPUs, keyboards", keys: "computer pc cpu laptop" },
        { id: "phone", name: "Phones & chargers", cat: "ewaste", note: "Mobiles, cables, earphones", keys: "mobile charger cable phone" },
        { id: "books", name: "Books & notebooks", cat: "paper", note: "Old textbooks & copies", keys: "kitab copy notebook books" },
        { id: "office", name: "Office paper", cat: "paper", note: "Printouts & files", keys: "a4 printout file office paper" },
        { id: "containers", name: "Plastic containers", cat: "plastic", note: "Tubs, buckets, packaging", keys: "dabba bucket tub container plastic" },
        { id: "cans", name: "Aluminium & cans", cat: "metal", note: "Cans & foil trays", keys: "aluminum aluminium can tin" },
        { id: "copper", name: "Copper & brass", cat: "metal", note: "Wires, taps, vessels", keys: "tamba pital wire copper brass" },
        { id: "utensils", name: "Steel utensils", cat: "metal", note: "Old pots & vessels", keys: "bartan vessel pot utensils steel" },
        { id: "tv", name: "TV & monitors", cat: "ewaste", note: "LED, LCD & old CRT", keys: "television screen monitor tv" },
        { id: "washer", name: "Washing machine", cat: "ewaste", note: "Top & front load", keys: "washing machine washer" },
    ];
    ITEMS.forEach((it) => (it.icon = it.id));
    const CITIES = ["Ahmedabad", "Gandhinagar", "Mumbai"];
    const byId = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
    const catById = Object.fromEntries(CATS.map((c) => [c.id, c]));

    /* ---------- city ---------- */
    function getCity() { const c = store.get("ec_city", "Ahmedabad"); return CITIES.includes(c) ? c : "Ahmedabad"; }
    function setCity(c) {
        if (!CITIES.includes(c)) return;
        store.set("ec_city", c);
        document.querySelectorAll("[data-city-label]").forEach((el) => (el.textContent = c));
        document.querySelectorAll("[data-city-select]").forEach((el) => (el.value = c));
        document.dispatchEvent(new CustomEvent("ec:city", { detail: c }));
    }

    /* ---------- cart ---------- */
    const emptyCart = () => ({ items: {}, type: "home", weight: "", day: "", dayLabel: "", slot: "" });
    function getCart() { return Object.assign(emptyCart(), store.get("ec_cart", {})); }
    function saveCart(c) { store.set("ec_cart", c); document.dispatchEvent(new CustomEvent("ec:cart", { detail: c })); }
    function addItem(id, n = 1) {
        if (!byId[id]) return;
        const c = getCart();
        c.items[id] = Math.max(0, (c.items[id] || 0) + n);
        if (!c.items[id]) delete c.items[id];
        saveCart(c);
    }
    const cartCount = (c = getCart()) => Object.values(c.items).reduce((s, n) => s + n, 0);

    window.EC = { icon, CATS, ITEMS, CITIES, byId, catById, getCity, setCity, getCart, saveCart, addItem, cartCount, store };

    /* ---------- city picker(s) ---------- */
    function initCityPickers() {
        document.querySelectorAll("[data-loc]").forEach((wrap) => {
            const btn = wrap.querySelector("[data-loc-btn]"), menu = wrap.querySelector("[data-loc-menu]");
            if (!btn || !menu) return;
            const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const open = menu.hidden;
                document.querySelectorAll("[data-loc-menu]").forEach((m) => (m.hidden = true));
                menu.hidden = !open; btn.setAttribute("aria-expanded", String(open));
                if (open) menu.querySelector("[data-city]")?.focus();
            });
            menu.querySelectorAll("[data-city]").forEach((o) => {
                o.tabIndex = 0;
                const pick = () => { setCity(o.dataset.city); close(); btn.focus(); };
                o.addEventListener("click", pick);
                o.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } if (e.key === "Escape") { close(); btn.focus(); } });
            });
            document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) close(); });
        });
        document.querySelectorAll("[data-city-select]").forEach((sel) => sel.addEventListener("change", () => setCity(sel.value)));
        document.querySelectorAll("[data-set-city]").forEach((a) => a.addEventListener("click", () => setCity(a.dataset.setCity)));
        setCity(getCity());
    }

    /* ---------- search with suggestions ---------- */
    const onHome = !!document.getElementById("itemGrid");
    function match(q) {
        q = q.trim().toLowerCase();
        if (!q) return [];
        return ITEMS.filter((it) => (it.name + " " + it.keys + " " + catById[it.cat].name).toLowerCase().includes(q)).slice(0, 6);
    }
    function initSearch() {
        document.querySelectorAll("[data-search-form]").forEach((form) => {
            const input = form.querySelector("[data-search]"), box = form.querySelector("[data-suggest]");
            if (!input || !box) return;
            let active = -1;
            const render = () => {
                const res = match(input.value);
                active = -1;
                if (!input.value.trim()) { box.hidden = true; return; }
                box.innerHTML = res.length
                    ? res.map((it, i) => `<button type="button" class="app-sug" data-i="${i}" data-id="${it.id}">${icon(it.icon)}<span><b>${it.name}</b><small>${catById[it.cat].name} · ${it.note}</small></span><em>Add</em></button>`).join("")
                    : `<div class="app-sug-empty">No match for “${input.value.replace(/[<>&"]/g, "")}”. You can describe it in the note when you book.</div>`;
                box.hidden = false;
            };
            const choose = (id) => {
                box.hidden = true; input.value = "";
                if (onHome) { addItem(id); document.dispatchEvent(new CustomEvent("ec:added", { detail: id })); }
                else window.location.href = "index.html?add=" + encodeURIComponent(id) + "#items";
            };
            input.addEventListener("input", render);
            input.addEventListener("focus", render);
            input.addEventListener("keydown", (e) => {
                const opts = [...box.querySelectorAll(".app-sug")];
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    if (!opts.length) return;
                    e.preventDefault();
                    active = (active + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length;
                    opts.forEach((o, i) => o.classList.toggle("is-active", i === active));
                } else if (e.key === "Escape") box.hidden = true;
                else if (e.key === "Enter" && active >= 0 && opts[active]) { e.preventDefault(); choose(opts[active].dataset.id); }
            });
            box.addEventListener("click", (e) => { const b = e.target.closest(".app-sug"); if (b) choose(b.dataset.id); });
            document.addEventListener("click", (e) => { if (!form.contains(e.target)) box.hidden = true; });
            form.addEventListener("submit", (e) => {
                const q = input.value.trim();
                if (onHome) { e.preventDefault(); box.hidden = true; document.dispatchEvent(new CustomEvent("ec:search", { detail: q })); }
                else if (!q) { e.preventDefault(); window.location.href = "index.html#items"; }
            });
        });
    }

    /* ---------- pickup.html: fill the form from the cart ---------- */
    function prefillPickup() {
        const form = document.getElementById("pickupForm");
        if (!form) return;
        const city = form.querySelector("#city");
        const params = new URLSearchParams(location.search);
        const cart = getCart();
        const n = cartCount(cart);
        const setSel = (sel, v) => { if (sel && v && [...sel.options].some((o) => o.value === v)) sel.value = v; };
        if (city && !city.value) setSel(city, getCity());
        if (params.get("from") !== "cart" || !n) return;

        const radio = document.getElementById(cart.type === "business" ? "typeBusiness" : "typeHome");
        if (radio && !radio.checked) { radio.checked = true; radio.dispatchEvent(new Event("change", { bubbles: true })); }
        setSel(city, cart.city || getCity());
        const cats = new Set(Object.keys(cart.items).map((id) => catById[byId[id].cat].value));
        form.querySelectorAll('input[name="waste"]').forEach((cb) => { if (cats.has(cb.value)) cb.checked = true; });
        setSel(form.querySelector("#quantity"), cart.weight);
        const list = Object.entries(cart.items).map(([id, q]) => `${byId[id].name} ×${q}`).join(", ");
        const when = [cart.dayLabel, cart.slot].filter(Boolean).join(", ");
        const msg = form.querySelector("#message");
        if (msg && !msg.value) msg.value = `Items: ${list}.` + (when ? `\nPreferred time: ${when}.` : "");
        const box = document.createElement("div");
        box.className = "app-cartnote";
        box.innerHTML = `<b>Your pickup</b><span>${list}${when ? " · " + when : ""}</span><a href="index.html#items">Edit</a>`;
        form.prepend(box);
        const ok = document.getElementById("formSuccess");
        if (ok && "MutationObserver" in window) {
            new MutationObserver(() => { if (ok.classList.contains("show")) store.del("ec_cart"); }).observe(ok, { attributes: true, attributeFilter: ["class"] });
        }
    }

    initCityPickers();
    initSearch();
    prefillPickup();
    document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
