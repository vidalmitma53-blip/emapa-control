(() => {
  const API_BASE_URL = String(window.EMAPA_API_BASE_URL || "").replace(/\/$/, "");
  const apiUrl = (path) => `${API_BASE_URL}${path}`;
  const api = {
    ready: false,
    user: null,
    eventSource: null,
    startLiveUpdates() {
      api.eventSource?.close();
      api.eventSource = new EventSource(apiUrl("/api/live"), { withCredentials: true });
      api.eventSource.addEventListener("inventory-updated", () => {
        api.loadBranches();
        if (api.user) api.loadLedger();
      });
    },
    async request(path, options = {}) {
      const response = await fetch(apiUrl(path), {
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options
      });
      const payload = response.status === 204 ? {} : await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.error || "No se pudo completar la solicitud.");
        error.status = response.status;
        throw error;
      }
      return payload;
    },
    async loadBranches() {
      const data = await api.request("/api/branches");
      window.emapaSetBranches(data.branches, data.updatedAt);
    },
    async loadLedger() {
      const data = await api.request("/api/inventory/movements");
      window.emapaSetMovements(data.movements.map((movement) => ({
        date: new Date(movement.occurred_at).toLocaleString("es-BO"),
        branch: movement.branch,
        product: movement.product,
        type: movement.movement_type === "entry" ? "Ingreso" : "Salida",
        lot: movement.lot_code,
        buyerName: movement.buyer_name || "",
        buyerDocument: movement.buyer_document || "",
        role: movement.username
      })));
    },
    async login(username, password) {
      const data = await api.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      api.user = data.user;
      window.emapaSessionUser = data.user;
      window.emapaSetAuthStatus(true);
      await api.loadLedger();
      await api.loadBranches();
      return data.user;
    },
    async logout() {
      try {
        await api.request("/api/auth/logout", { method: "POST", body: "{}" });
      } finally {
        api.user = null;
        window.emapaSessionUser = null;
        window.emapaSetAuthStatus(false);
      }
    },
    async recordMovement(movement) {
      const result = await api.request("/api/inventory/movements", {
        method: "POST",
        body: JSON.stringify(movement)
      });
      await api.loadBranches();
      await api.loadLedger();
      return result;
    }
  };

  window.emapaApi = api;

  document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("login-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submitButton = form.querySelector("button[type='submit']");
      const errorBox = document.getElementById("login-error");
      const formData = new FormData(form);
      submitButton.disabled = true;
      errorBox.hidden = true;
      try {
        const user = await api.login(String(formData.get("username") || "").trim(), String(formData.get("password") || ""));
        form.reset();
        document.getElementById("login-dialog").close();
        window.history.replaceState({}, "", "/admin-inventarios");
        window.emapaShowInternalPanel(user);
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
      } finally {
        submitButton.disabled = false;
      }
    });

    try {
      const [catalog] = await Promise.all([
        api.request("/api/catalog"),
        api.loadBranches()
      ]);
      window.emapaSetCatalog(catalog.products);
      api.ready = true;
      window.emapaSetBackendStatus(true);
      api.startLiveUpdates();
      const session = await api.request("/api/auth/me").catch(() => null);
      if (session?.user) {
        api.user = session.user;
        window.emapaSessionUser = session.user;
        window.emapaSetAuthStatus(true);
        api.loadLedger();
      }
      const path = window.location.pathname;
      if (path === "/login" && !api.user) {
        document.getElementById("login-dialog").showModal();
      } else if (path === "/admin-inventarios" && api.user) {
        window.emapaShowInternalPanel(api.user);
      } else if (path === "/admin-inventarios" && !api.user) {
        window.history.replaceState({}, "", "/login");
        document.getElementById("login-dialog").showModal();
      }
    } catch {
      api.ready = false;
      window.emapaSetBackendStatus(false);
      if (window.location.pathname === "/login" || window.location.pathname === "/admin-inventarios") {
        window.history.replaceState({}, "", "/");
      }
    }
  });
})();
