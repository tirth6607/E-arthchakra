/* =========================================================
   E-ARTHCHAKRA — HOMEPAGE (catalogue, pickup cart, checkout)
   Needs app.js first. The checkout hands everything to
   pickup.html (?from=cart), which fills in the real form.
   ========================================================= */
(() => {
    const EC = window.EC;
    const grid = document.getElementById("itemGrid");
    if (!EC || !grid) return;
    const $ = (s, el = document) => el.querySelector(s);
    const $$ = (s, el = document) => [...el.querySelectorAll(s)];
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    /* ---------- illustrations into static slots ---------- */
    $$("[data-icon]").forEach((el) => (el.innerHTML = EC.icon(el.dataset.icon)));
    const left = $('[data-art="left"]');
    if (left) left.innerHTML = ["carton", "newspaper", "bottles", "phone"].map((k) => EC.icon(k, "ia")).join("");
    const biz = $('[data-art="biz"]');
    if (biz) biz.innerHTML = ["carton", "office", "cans"].map((k) => EC.icon(k, "ia")).join("");

    /* ---------- toast ---------- */
    const toast = $("#toast");
    let tT;
    function say(msg) { toast.textContent = msg; toast.classList.add("show"); clearTimeout(tT); tT = setTimeout(() => toast.classList.remove("show"), 1800); }

    /* ---------- categories + grid ---------- */
    let cat = "all", query = "";
    const rail = $("#catRail"), note = $("#resultsNote");
    rail.innerHTML = `<button class="h-cat h-cat-all" role="tab" data-cat="all" aria-selected="true"><i>All</i><span>All items</span></button>` +
        EC.CATS.map((c) => `<button class="h-cat" role="tab" data-cat="${c.id}" aria-selected="false"><i style="background:${c.tint}">${EC.icon(c.icon)}</i><span>${c.name}</span></button>`).join("");
    rail.addEventListener("click", (e) => {
        const b = e.target.closest(".h-cat"); if (!b) return;
        cat = b.dataset.cat; query = ""; render();
    });

    function list() {
        const q = query.toLowerCase();
        return EC.ITEMS.filter((it) => (cat === "all" || it.cat === cat) &&
            (!q || (it.name + " " + it.keys + " " + EC.catById[it.cat].name).toLowerCase().includes(q)));
    }
    function control(id, qty) {
        return qty
            ? `<div class="h-step" role="group" aria-label="${esc(EC.byId[id].name)} quantity"><button type="button" data-dec="${id}" aria-label="Remove one">−</button><span>${qty}</span><button type="button" data-inc="${id}" aria-label="Add one">+</button></div>`
            : `<button type="button" class="h-add" data-inc="${id}" aria-label="Add ${esc(EC.byId[id].name)}">ADD</button>`;
    }
    function render() {
        $$(".h-cat", rail).forEach((b) => b.setAttribute("aria-selected", String(b.dataset.cat === cat && !query)));
        const items = list(), cart = EC.getCart();
        grid.innerHTML = items.map((it) => `
            <article class="h-item" data-id="${it.id}">
                <div class="h-item-art" style="background:${EC.catById[it.cat].tint}">${EC.icon(it.icon)}</div>
                ${control(it.id, cart.items[it.id] || 0)}
                <div class="h-item-body"><h3>${esc(it.name)}</h3><p>${esc(it.note)}</p><small>${EC.catById[it.cat].name}</small></div>
            </article>`).join("");
        if (query) {
            note.hidden = false;
            note.innerHTML = items.length
                ? `Showing results for “${esc(query)}” <button type="button" data-clear>Clear</button>`
                : `No item matches “${esc(query)}”. Add the closest item and describe it in the note when you book. <button type="button" data-clear>Show all</button>`;
        } else note.hidden = true;
    }
    note.addEventListener("click", (e) => { if (e.target.closest("[data-clear]")) { query = ""; cat = "all"; render(); } });

    document.addEventListener("click", (e) => {
        const inc = e.target.closest("[data-inc]"), dec = e.target.closest("[data-dec]");
        if (inc) { const id = inc.dataset.inc; const first = !EC.getCart().items[id]; EC.addItem(id, 1); if (first) say(`${EC.byId[id].name} added to your pickup`); }
        else if (dec) EC.addItem(dec.dataset.dec, -1);
    });
    $$("[data-quick]").forEach((b) => b.addEventListener("click", () => {
        const id = b.dataset.quick;
        if (!EC.getCart().items[id]) EC.addItem(id, 1);
        say(`${EC.byId[id].name} added to your pickup`);
    }));
    document.addEventListener("ec:added", (e) => say(`${EC.byId[e.detail].name} added to your pickup`));
    document.addEventListener("ec:search", (e) => {
        query = e.detail || ""; cat = "all"; render();
        document.getElementById("items").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    /* ---------- cart bar ---------- */
    const bar = $("#cartBar"), countEl = $("#cartCount");
    function syncBar() {
        const n = EC.cartCount();
        bar.hidden = n === 0;
        countEl.textContent = n === 1 ? "1 item" : `${n} items`;
    }

    /* ---------- checkout drawer ---------- */
    const drawer = $("#checkout"), bg = $("#drawerBg"), coItems = $("#coItems"), cont = $("#coContinue");
    let lastFocus = null;
    function days() {
        const out = [], d = new Date();
        for (let i = 1; i <= 6; i++) {
            const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
            const iso = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
            const wk = x.toLocaleDateString("en-IN", { weekday: "short" }), dm = x.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
            out.push({ iso, top: i === 1 ? "Tomorrow" : wk, sub: dm, label: `${i === 1 ? "Tomorrow" : wk}, ${dm}` });
        }
        return out;
    }
    $("#coDays").innerHTML = days().map((d) => `<button type="button" data-v="${d.iso}" data-label="${d.label}">${d.top}<small>${d.sub}</small></button>`).join("");

    function renderDrawer() {
        const c = EC.getCart();
        const ids = Object.keys(c.items);
        coItems.innerHTML = ids.length
            ? ids.map((id) => `<div class="h-co-row">${EC.icon(EC.byId[id].icon)}<div><b>${esc(EC.byId[id].name)}</b><small>${EC.catById[EC.byId[id].cat].name}</small></div>${control(id, c.items[id])}</div>`).join("")
            : `<div class="h-co-empty">Your pickup is empty. Add items to continue.</div>`;
        $$(".h-co-row svg", coItems).forEach((s, i) => (s.style.background = EC.catById[EC.byId[ids[i]].cat].tint));
        const pressed = { type: c.type || "home", weight: c.weight, day: c.day, slot: c.slot };
        $$("[data-group]", drawer).forEach((g) => $$("button", g).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === pressed[g.dataset.group]))));
        cont.disabled = !ids.length;
    }
    $$("[data-group]", drawer).forEach((g) => g.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-v]"); if (!b) return;
        const c = EC.getCart(), k = g.dataset.group;
        c[k] = c[k] === b.dataset.v && k !== "type" ? "" : b.dataset.v;
        if (k === "day") c.dayLabel = c.day ? b.dataset.label : "";
        EC.saveCart(c);
    }));
    function openDrawer() {
        lastFocus = document.activeElement;
        drawer.hidden = false; bg.hidden = false; document.body.style.overflow = "hidden";
        renderDrawer();
        $("#cartClose").focus();
    }
    function closeDrawer() {
        drawer.hidden = true; bg.hidden = true; document.body.style.overflow = "";
        if (lastFocus) lastFocus.focus();
    }
    $("#cartOpen").addEventListener("click", openDrawer);
    $("#cartClose").addEventListener("click", closeDrawer);
    bg.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !drawer.hidden) closeDrawer(); });
    drawer.addEventListener("keydown", (e) => {
        if (e.key !== "Tab") return;
        const f = $$("button:not([disabled]), a[href]", drawer).filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    cont.addEventListener("click", () => {
        const c = EC.getCart();
        if (!EC.cartCount(c)) return;
        c.city = EC.getCity();
        EC.saveCart(c);
        window.location.href = `pickup.html?type=${c.type === "business" ? "business" : "home"}&from=cart`;
    });

    /* ---------- video modal ---------- */
    const modal = $("#storyModal"), video = $("#storyVideo");
    $("#storyOpen").addEventListener("click", () => { modal.hidden = false; video.play().catch(() => {}); $("#storyClose").focus(); });
    const closeModal = () => { modal.hidden = true; video.pause(); $("#storyOpen").focus(); };
    $("#storyClose").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

    /* ---------- header height (mobile menu sits under it) ---------- */
    const nav = $(".app-nav");
    const setNavH = () => nav && document.documentElement.style.setProperty("--app-nav-h", nav.offsetHeight + "px");
    window.addEventListener("resize", setNavH); setNavH();

    /* ---------- wiring ---------- */
    document.addEventListener("ec:cart", () => { render(); syncBar(); if (!drawer.hidden) renderDrawer(); });
    const params = new URLSearchParams(location.search);
    if (params.get("add") && EC.byId[params.get("add")]) { if (!EC.getCart().items[params.get("add")]) EC.addItem(params.get("add")); say(`${EC.byId[params.get("add")].name} added to your pickup`); }
    if (params.get("q")) query = params.get("q");
    render(); syncBar();
    if (params.get("q") || params.get("add")) setTimeout(() => document.getElementById("items").scrollIntoView({ block: "start" }), 50);
})();
