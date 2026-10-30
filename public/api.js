/* =========================================================
   E-ARTHCHAKRA — API CLIENT
   Replaces the old localStorage "database".
   Load this BEFORE any page script that needs data.
   ========================================================= */

const EcoAPI = (() => {

    let requestsCache = [];

    async function call(path, options = {}) {
        const response = await fetch("/api" + path, {
            method: options.method || "GET",
            credentials: "same-origin",
            keepalive: !!options.keepalive,
            headers: options.body ? { "Content-Type": "application/json" } : undefined,
            body: options.body ? JSON.stringify(options.body) : undefined
        });

        let data = {};
        try { data = await response.json(); } catch (e) { /* empty body */ }

        if (response.status === 401 && !path.startsWith("/auth/")) {
            // Session expired: clear the UI hint and go to login.
            localStorage.removeItem("earthchakra_user");
            const page = window.location.pathname;
            window.location.href = page.includes("admin") ? "admin-login.html"
                : page.includes("partner") ? "partner-login.html" : "login.html";
            throw new Error("Please sign in.");
        }

        if (!response.ok) {
            throw new Error(data.error || "Request failed (" + response.status + ")");
        }
        return data;
    }

    /* ---------- auth ---------- */

    function rememberUser(user) {
        // UI hint only (name/role for the header and page guards).
        // Real security is enforced by the server cookie.
        localStorage.setItem("earthchakra_user", JSON.stringify(user));
    }

    async function login(email, password, role) {
        const { user } = await call("/auth/login", { method: "POST", body: { email, password, role } });
        rememberUser(user);
        return user;
    }

    async function register(fields) {
        const { user } = await call("/auth/register", { method: "POST", body: fields });
        rememberUser(user);
        return user;
    }

    async function registerPartner(fields) {
        const { user } = await call("/auth/register-partner", { method: "POST", body: fields });
        rememberUser(user);
        return user;
    }

    // Fresh copy of the signed-in user (e.g. a partner's approval status may have changed).
    async function refreshUser() {
        const { user } = await call("/auth/me");
        rememberUser(user);
        return user;
    }

    function logout() {
        // keepalive so the request survives the page redirect that follows
        call("/auth/logout", { method: "POST", keepalive: true }).catch(() => {});
        localStorage.removeItem("earthchakra_user");
    }

    /* ---------- pickups ---------- */

    async function loadRequests() {
        const { pickups } = await call("/pickups");
        // Mutate in place so pages holding a reference to the array stay in sync.
        requestsCache.length = 0;
        requestsCache.push(...pickups);
        return requestsCache;
    }

    function getRequests() {
        return requestsCache;
    }

    async function createPickup(payload) {
        const { pickup } = await call("/pickups", { method: "POST", body: payload });
        return pickup;
    }

    // Send only the fields the backend lets this role change.
    async function saveRequest(request) {
        try {
            const body = {
                status: request.status,
                partner: request.partner || "",
                scheduledDate: request.scheduledDate || "",
                scheduledTime: request.scheduledTime || ""
            };
            const user = JSON.parse(localStorage.getItem("earthchakra_user") || "null");
            const payload = user && user.role === "partner" ? { status: body.status } : body;
            const { pickup } = await call("/pickups/" + encodeURIComponent(request.id), {
                method: "PATCH",
                body: payload
            });
            Object.assign(request, pickup);
        } catch (error) {
            alert(error.message);
            await loadRequests();
        }
    }

    // Partner accepts an open (unassigned) request.
    async function acceptRequest(id) {
        const { pickup } = await call("/pickups/" + encodeURIComponent(id), {
            method: "PATCH",
            body: { accept: true }
        });
        const cached = requestsCache.find((r) => r.id === pickup.id);
        if (cached) Object.assign(cached, pickup);
        return pickup;
    }

    /* ---------- partners (admin) ---------- */

    async function listPartners() {
        const { partners } = await call("/partners");
        return partners;
    }

    async function setPartnerStatus(id, partnerStatus) {
        const { partner } = await call("/partners?id=" + encodeURIComponent(id), {
            method: "PATCH",
            body: { partnerStatus }
        });
        return partner;
    }

    /* ---------- enquiries ---------- */

    function sendEnquiry(payload) {
        return call("/enquiries", { method: "POST", body: payload });
    }

    return {
        call, login, register, registerPartner, refreshUser, logout,
        loadRequests, getRequests, createPickup, saveRequest, acceptRequest,
        listPartners, setPartnerStatus, sendEnquiry
    };

})();
