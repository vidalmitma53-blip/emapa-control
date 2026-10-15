const PRODUCT_NAMES = {
  "arroz-grano": "Arroz en grano",
  "arroz-seleccionado": "Arroz seleccionado",
  "harina-trigo-especial": "Harina de trigo especial",
  "harina-trigo-000": "Harina de trigo 000",
  "maiz-amarillo-duro": "Maíz amarillo duro",
  "aceite-comestible": "Aceite comestible",
  azucar: "Azúcar",
  tambaqui: "Tambaquí fresco",
  pacu: "Pacú fresco",
  tilapia: "Tilapia fresca",
  manteca: "Manteca",
  soya: "Soya"
};
const PRODUCT_UNITS = {
  "arroz-grano": "kg", "arroz-seleccionado": "kg", "harina-trigo-especial": "kg",
  "harina-trigo-000": "kg", "maiz-amarillo-duro": "kg", "aceite-comestible": "L",
  azucar: "kg", tambaqui: "kg", pacu: "kg", tilapia: "kg", manteca: "kg", soya: "kg"
};
let productCatalog = Object.entries(PRODUCT_NAMES).map(([id, name]) => ({ id, name, unit: PRODUCT_UNITS[id], category: "" }));

const locations = [
  { name: "Oficina Regional y Superemapa Central", city: "Cochabamba · Zona Central", address: "Calle Hamiraya N.º 360, entre Ecuador y Mayor Rocha", lat: -17.393500, lng: -66.156800 },
  { name: "Sucursal Zona Sur (Huanchaca)", city: "Cochabamba · Zona Sur", address: "Av. Huanchaca esquina Pedro Zeballos", lat: -17.421200, lng: -66.148500 },
  { name: "Sucursal Av. Panamericana", city: "Cochabamba · Zona Sur / sudeste", address: "Final Av. Panamericana", lat: -17.435000, lng: -66.138000 },
  { name: "Sucursal Av. Blanco Galindo (KM 8)", city: "Colcapirhua / Cercado", address: "Kilómetro 8, Avenida Blanco Galindo", lat: -17.385200, lng: -66.220100 },
  { name: "Estación del Tren Metropolitano - San Antonio", city: "Cochabamba", address: "Estación San Antonio, Av. 6 de Agosto", lat: -17.405300, lng: -66.152100 },
  { name: "Estación del Tren - Zona norte / Muyurina", city: "Cochabamba · Muyurina", address: "Zona Muyurina / Estación de transferencia", lat: -17.378900, lng: -66.142300 },
  { name: "Sucursal Quillacollo (Estación / Centro)", city: "Quillacollo", address: "Av. 6 de Agosto s/n", lat: -17.401100, lng: -66.279500 },
  { name: "Agencia Distribuidora Sipe Sipe", city: "Sipe Sipe", address: "Plaza Principal / Zona Central de Sipe Sipe", lat: -17.428000, lng: -66.365000 },
  { name: "Agencia Distribuidora Vinto", city: "Vinto", address: "Carretera Principal Cochabamba - Oruro, Vinto Centro", lat: -17.395000, lng: -66.315000 },
  { name: "Agencia Distribuidora Sacaba (Centro)", city: "Sacaba", address: "Ingreso principal a Sacaba, Av. Cochabamba", lat: -17.404200, lng: -66.039800 },
  { name: "Agencia Distribuidora Sacaba (Zona Este / El Abra)", city: "Sacaba · El Abra", address: "Zona El Abra, tramo principal de comercialización", lat: -17.391000, lng: -66.015000 },
  { name: "Agencia Punata (Valle Alto)", city: "Punata · Valle Alto", address: "Zona del Mercado Central de Punata", lat: -17.545000, lng: -65.835000 },
  { name: "Agencia Cliza (Valle Alto)", city: "Cliza · Valle Alto", address: "Cerca de la Plaza Principal de Cliza", lat: -17.581000, lng: -65.933000 },
  { name: "Agencia Tarata (Valle Alto)", city: "Tarata · Valle Alto", address: "Zona céntrica e histórica de Tarata", lat: -17.616000, lng: -66.025000 },
  { name: "Agencia Arani", city: "Arani", address: "Zona del Mercado Municipal de Arani", lat: -17.575000, lng: -65.768000 },
  { name: "Sucursal / Centro de Acopio - Monte Punku", city: "Monte Punku / Pojo", address: "Carretera Antigua Cochabamba - Santa Cruz, KM 120", lat: -17.750000, lng: -65.180000 },
  { name: "Agencia Trópico - Villa Tunari", city: "Villa Tunari · Trópico", address: "Zona del Mercado Campesino, Av. Haupt", lat: -16.979000, lng: -65.415000 },
  { name: "Agencia Trópico - Shinahota", city: "Shinahota · Trópico", address: "Zona Central / Carretera troncal del Trópico", lat: -17.005000, lng: -65.250000 },
  { name: "Agencia Trópico - Chimoré (Piscícola / Comercial)", city: "Chimoré · Trópico", address: "Zona Senda 3 / Puerto Aurora", lat: -16.953000, lng: -65.142000 },
  { name: "Agencia Trópico - Ivirgarzama (Puerto Villarroel)", city: "Ivirgarzama / Puerto Villarroel", address: "Zona Comercial Central de Ivirgarzama", lat: -17.060000, lng: -64.852000 }
];

const initialBranches = locations.map((location, index) => ({
  ...location,
  id: `cbba-${String(index + 1).padStart(2, "0")}`,
  stocks: Object.fromEntries(productCatalog.map((product, productIndex) => [
    product.id,
    (index + productIndex) % 7 === 0 ? 0 : 60 + index * 13 + productIndex * 17
  ]))
}));

let branches = structuredClone(initialBranches);
let movements = [];
let map;
let markerLayer;
let activeBranchId = null;
const numberFormat = new Intl.NumberFormat("es-BO");

function formatQuantity(value) {
  return `${numberFormat.format(value)} kg`;
}

function formatProductQuantity(value, productId) {
  return `${numberFormat.format(value)} ${PRODUCT_UNITS[productId] || "un."}`;
}

function populateProductControls() {
  const filter = document.getElementById("product-filter");
  const movementProduct = document.getElementById("movement-product");
  const selectedFilter = filter.value || "all";
  const selectedProduct = movementProduct.value;
  filter.replaceChildren(new Option("Todos los productos", "all"));
  productCatalog.forEach((product) => filter.add(new Option(product.name, product.id)));
  movementProduct.replaceChildren();
  productCatalog.forEach((product) => movementProduct.add(new Option(`${product.name} (${product.unit})`, product.id)));
  filter.value = productCatalog.some((product) => product.id === selectedFilter) ? selectedFilter : "all";
  movementProduct.value = productCatalog.some((product) => product.id === selectedProduct) ? selectedProduct : (productCatalog[0]?.id || "");
}

function getVisibleBranches() {
  const query = document.getElementById("branch-search").value.trim().toLocaleLowerCase("es");
  const product = document.getElementById("product-filter").value;
  return branches.filter((branch) => {
    const matchesSearch = `${branch.name} ${branch.city} ${branch.address}`.toLocaleLowerCase("es").includes(query);
    const quantity = branch.stocks[product];
    const matchesProduct = product === "all" || quantity == null || quantity > 0;
    return matchesSearch && matchesProduct;
  });
}

function renderBranches() {
  const branchList = document.getElementById("branch-list");
  const visibleBranches = getVisibleBranches();
  const product = document.getElementById("product-filter").value;
  document.getElementById("branch-count").textContent = String(visibleBranches.length).padStart(2, "0");
  document.getElementById("panel-count").textContent = String(visibleBranches.length).padStart(2, "0");

  if (visibleBranches.length === 0) {
    branchList.innerHTML = '<p class="empty-list">No encontramos sucursales para esa búsqueda.</p>';
  } else {
    branchList.innerHTML = visibleBranches.map((branch, index) => {
      const stockValues = Object.values(branch.stocks);
      const isNoData = stockValues.length > 0 && stockValues.every((quantity) => quantity == null);
      const isPartial = !isNoData && stockValues.some((quantity) => quantity == null);
      const isLimited = !isNoData && stockValues.filter((quantity) => quantity > 0).length <= 2;
      const stockEntries = product === "all"
        ? Object.entries(branch.stocks)
        : [[product, branch.stocks[product]]];
      const stockMarkup = stockEntries.length
        ? stockEntries.map(([key, quantity]) => `<span class="stock-chip${quantity == null ? " no-data" : ""}">${PRODUCT_NAMES[key] || key} <b>${quantity == null ? "Sin registro" : quantity > 0 ? formatProductQuantity(quantity, key) : "Agotado"}</b></span>`).join("")
        : '<span class="stock-chip">Sin disponibilidad referencial</span>';
      return `<button class="branch-item${isLimited ? " limited" : ""}${isNoData ? " no-data" : ""}${isPartial ? " partial" : ""}${activeBranchId === branch.id ? " selected" : ""}" type="button" data-branch-id="${branch.id}" aria-label="Ver ${branch.name} en el mapa">
        <span class="branch-number">${String(index + 1).padStart(2, "0")}</span>
        <span class="branch-copy"><span class="branch-title-row"><span class="branch-title">${branch.name}</span><span class="stock-state">${isNoData ? "Sin registro" : isPartial ? "Parcial" : isLimited ? "Limitada" : "Disponible"}</span></span><span class="branch-city">${branch.city}</span><span class="branch-address">${branch.address}</span><span class="branch-stock">${stockMarkup}</span></span>
      </button>`;
    }).join("");
  }

  branchList.querySelectorAll("[data-branch-id]").forEach((button) => {
    button.addEventListener("click", () => focusBranch(button.dataset.branchId));
  });
  renderMarkers(visibleBranches, product);
}

function renderMarkers(visibleBranches, product) {
  if (!map || !markerLayer) return;
  markerLayer.clearLayers();
  visibleBranches.forEach((branch, index) => {
    const stockValues = Object.values(branch.stocks);
    const isNoData = stockValues.length > 0 && stockValues.every((quantity) => quantity == null);
    const isLimited = !isNoData && stockValues.filter((quantity) => quantity > 0).length <= 2;
    const markerIcon = L.divIcon({
      className: "branch-map-marker",
      html: `<span style="display:grid;place-items:center;width:31px;height:37px;border:2px solid white;border-radius:50% 50% 50% 4px;background:${isNoData ? "#8b8c69" : isLimited ? "#d4982b" : "#24794e"};color:white;font:700 10px 'Segoe UI',Arial,sans-serif;box-shadow:0 2px 8px #153d2855;transform:rotate(-45deg)"><span style="transform:rotate(45deg)">${String(index + 1).padStart(2, "0")}</span></span>`,
      iconSize: [31, 37],
      iconAnchor: [15, 34],
      popupAnchor: [0, -31]
    });
    const shownStocks = product === "all" ? Object.entries(branch.stocks) : [[product, branch.stocks[product]]];
    const stockDescription = shownStocks.map(([key, quantity]) => `<p>${PRODUCT_NAMES[key] || key}: <strong>${quantity == null ? "Sin registro" : quantity > 0 ? formatProductQuantity(quantity, key) : "Agotado"}</strong></p>`).join("");
    L.marker([branch.lat, branch.lng], { icon: markerIcon })
      .bindPopup(`<div class="branch-popup"><h4>${branch.name}</h4><p>${branch.address}</p><p>${branch.city}</p><p>Coordenadas: ${branch.lat.toFixed(6)}, ${branch.lng.toFixed(6)}</p>${stockDescription}<small>${window.emapaBackendOnline ? "Stock reportado por el sistema institucional" : "Existencias ilustrativas, no oficiales"}</small></div>`)
      .addTo(markerLayer)
      .on("click", () => {
        activeBranchId = branch.id;
        document.querySelectorAll(".branch-item").forEach((item) => item.classList.toggle("selected", item.dataset.branchId === branch.id));
      });
  });
}

function focusBranch(branchId) {
  const branch = branches.find((item) => item.id === branchId);
  if (!branch || !map) return;
  activeBranchId = branchId;
  map.flyTo([branch.lat, branch.lng], 13, { duration: 0.6 });
  renderBranches();
  markerLayer.eachLayer((marker) => {
    const point = marker.getLatLng();
    if (point.lat === branch.lat && point.lng === branch.lng) marker.openPopup();
  });
}

function fillBranchSelect() {
  const select = document.getElementById("movement-branch");
  select.innerHTML = branches.map((branch) => `<option value="${branch.id}">${branch.name}</option>`).join("");
}

window.emapaSetCatalog = (products) => {
  if (!Array.isArray(products) || products.length === 0) return;
  productCatalog = products;
  products.forEach((product) => {
    PRODUCT_NAMES[product.id] = product.name;
    PRODUCT_UNITS[product.id] = product.unit;
  });
  populateProductControls();
  renderBranches();
};

window.emapaSetBranches = (newBranches, updatedAt) => {
  if (!Array.isArray(newBranches)) return;
  branches = newBranches;
  fillBranchSelect();
  renderBranches();
  if (updatedAt) {
    const date = new Date(updatedAt);
    document.getElementById("updated-at").textContent = `ACTUALIZADO ${Number.isNaN(date.getTime()) ? "AHORA" : date.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}`;
  }
};

window.emapaSetMovements = (newMovements) => {
  if (!Array.isArray(newMovements)) return;
  movements = newMovements;
  renderLedger();
};

window.emapaSetBackendStatus = (online) => {
  window.emapaBackendOnline = online;
  document.getElementById("data-mode").textContent = online ? "Sistema conectado" : "Modo demo";
  document.getElementById("data-mode-caption").textContent = online ? "ACTUALIZACIÓN EN TIEMPO REAL" : "SIN CONEXIÓN AL BACKEND";
  const badge = document.querySelector(".live-badge");
  if (badge?.childNodes[1]) badge.childNodes[1].textContent = online ? " SISTEMA EN LÍNEA " : " VISTA DEMOSTRATIVA ";
  if (online) renderBranches();
  document.querySelector("#internal-link .demo-tag").textContent = online ? "LOGIN" : "DEMO";
  document.querySelector(".demo-ribbon").lastChild.textContent = online
    ? " SISTEMA CONECTADO · Las existencias provienen del inventario registrado"
    : " PROTOTIPO · información ilustrativa, no corresponde a existencias oficiales";
  if (online) {
    document.querySelector(".security-notice strong").textContent = "Área protegida para personal autorizado.";
    document.querySelector(".security-notice p").textContent = "Los permisos se verifican en el servidor. Cada entrada y salida genera una línea de auditoría vinculada al usuario y al lote.";
  }
};

window.emapaSetAuthStatus = (authenticated) => {
  document.getElementById("logout-button").hidden = !authenticated;
  document.getElementById("signed-in-user").hidden = !authenticated;
  if (authenticated && window.emapaSessionUser) {
    const user = window.emapaSessionUser;
    document.getElementById("signed-in-user").textContent = `${user.username} · ${user.roleName}`;
    document.getElementById("role-select").value = user.role;
    document.getElementById("role-select").disabled = true;
    document.querySelector(".role-row label").textContent = "Tu rol institucional";
    document.getElementById("clear-log").hidden = true;
    document.querySelector(".form-footnote").textContent = "Guardado en inventario y bitácora del servidor";
    document.querySelector(".security-notice strong").textContent = "Área protegida para personal autorizado.";
    document.querySelector(".security-notice p").textContent = "La autorización se valida en el servidor; movimientos quedan registrados con usuario, lote, fecha y variación de stock.";
    document.querySelector(".card-heading .demo-tag").hidden = true;
    document.querySelector(".ledger-footer span:first-child").innerHTML = '<i class="status-dot"></i> Kardex persistido en la base de datos';
    document.querySelector(".ledger-footer span:last-child").textContent = "Registro de auditoría asociado al usuario autenticado";
    document.querySelector("thead th:last-child").textContent = "Usuario";
  } else {
    document.getElementById("role-select").disabled = false;
    document.querySelector(".role-row label").textContent = "Rol de demostración";
    document.getElementById("clear-log").hidden = false;
    document.querySelector(".form-footnote").textContent = "Registro temporal local · sin persistencia";
    document.querySelector(".card-heading .demo-tag").hidden = false;
    document.querySelector(".ledger-footer span:first-child").innerHTML = '<i class="status-dot"></i> Datos en memoria del navegador';
    document.querySelector(".ledger-footer span:last-child").textContent = "El kardex oficial requiere almacenamiento seguro";
    document.querySelector("thead th:last-child").textContent = "Usuario demo";
  }
  updateRolePermissions();
};

populateProductControls();

function updateRolePermissions() {
  const role = document.getElementById("role-select").value;
  const canRegister = role !== "auditor";
  document.querySelectorAll("#movement-form input, #movement-form select, #register-movement").forEach((control) => {
    control.disabled = !canRegister;
  });
  document.getElementById("role-hint").textContent = role === "auditor"
    ? "Permiso de prueba: consulta de la bitácora, sin registrar movimientos."
    : role === "supervisor"
      ? "Permiso de prueba: registrar ingresos y salidas; revisar la bitácora."
      : "Permiso de prueba: registrar ingresos y salidas.";
}

function renderLedger() {
  const body = document.getElementById("ledger-body");
  const emptyMessage = document.getElementById("empty-ledger");
  emptyMessage.hidden = movements.length > 0;
  body.replaceChildren();
  movements.forEach((movement) => {
    const row = document.createElement("tr");
    const cells = [movement.date, `${movement.branch} · ${movement.product}`, movement.type, movement.lot, movement.role];
    cells.forEach((value, index) => {
      const cell = document.createElement("td");
      if (index === 2) {
        const pill = document.createElement("span");
        pill.className = `movement-pill${movement.type === "Salida" ? " salida" : ""}`;
        pill.textContent = movement.type;
        cell.append(pill);
      } else {
        cell.textContent = value;
      }
      row.append(cell);
    });
    body.prepend(row);
  });
}

async function registerMovement(event) {
  event.preventDefault();
  const sessionUser = window.emapaSessionUser;
  if ((sessionUser && sessionUser.role === "auditor") || (!sessionUser && document.getElementById("role-select").value === "auditor")) return;
  const branch = branches.find((item) => item.id === document.getElementById("movement-branch").value);
  const product = document.getElementById("movement-product").value;
  const type = document.getElementById("movement-type").value;
  const quantity = Number(document.getElementById("movement-quantity").value);
  const lot = document.getElementById("movement-lot").value.trim();
  if (!branch || !Number.isFinite(quantity) || quantity <= 0 || !lot) return;

  if (sessionUser && window.emapaApi?.ready) {
    const submitButton = document.getElementById("register-movement");
    submitButton.disabled = true;
    try {
      await window.emapaApi.recordMovement({
        branchId: branch.id,
        productId: product,
        movementType: type === "ingreso" ? "entry" : "exit",
        quantity,
        lotCode: lot
      });
      document.getElementById("movement-form").reset();
    } catch (error) {
      window.alert(error.message);
      if (error.status === 401) {
        window.emapaSessionUser = null;
        window.emapaSetAuthStatus(false);
        document.getElementById("login-dialog").showModal();
      }
    } finally {
      submitButton.disabled = false;
    }
    return;
  }

  if (type === "salida" && quantity > branch.stocks[product]) {
    window.alert(`Stock demostrativo insuficiente. Disponible: ${formatProductQuantity(branch.stocks[product], product)}.`);
    return;
  }
  branch.stocks[product] += type === "ingreso" ? quantity : -quantity;
  movements.push({
    date: new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short" }).format(new Date()),
    branch: branch.name,
    product: PRODUCT_NAMES[product],
    type: type === "ingreso" ? "Ingreso" : "Salida",
    lot,
    role: document.getElementById("role-select").value
  });
  renderBranches();
  renderLedger();
  document.getElementById("movement-quantity").value = "";
  document.getElementById("movement-lot").value = "";
}

function showInternalPanel(sessionUser = null) {
  document.getElementById("gestion").hidden = false;
  document.getElementById("mapa").hidden = true;
  document.getElementById("como-funciona").hidden = true;
  document.querySelector(".hero").hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.getElementById("internal-link").classList.add("active");
  if (sessionUser) {
    window.emapaSessionUser = sessionUser;
    window.emapaSetAuthStatus(true);
    if (window.emapaApi?.ready) window.emapaApi.loadLedger();
  } else {
    window.emapaSessionUser = null;
    window.emapaSetAuthStatus(false);
    document.getElementById("role-select").focus({ preventScroll: true });
  }
  requestAnimationFrame(() => map?.invalidateSize());
}

window.emapaShowInternalPanel = showInternalPanel;

async function handleInternalNavigation() {
  if (!window.emapaApi?.ready) {
    showInternalPanel();
    return;
  }
  try {
    const session = await window.emapaApi.request("/api/auth/me");
    if (!session.user) {
      window.history.pushState({}, "", "/login");
      document.getElementById("login-dialog").showModal();
      return;
    }
    window.emapaSessionUser = session.user;
    window.history.pushState({}, "", "/admin-inventarios");
    showInternalPanel(session.user);
  } catch {
    window.history.pushState({}, "", "/login");
    const dialog = document.getElementById("login-dialog");
    if (!dialog.open) dialog.showModal();
  }
}

function showPublicPage() {
  document.getElementById("gestion").hidden = true;
  document.getElementById("mapa").hidden = false;
  document.getElementById("como-funciona").hidden = false;
  document.querySelector(".hero").hidden = false;
  document.getElementById("internal-link").classList.remove("active");
  if (window.location.pathname === "/admin-inventarios" || window.location.pathname === "/login") {
    window.history.pushState({}, "", "/");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
  requestAnimationFrame(() => map?.invalidateSize());
}

function initializeMap() {
  const mapElement = document.getElementById("map");
  if (typeof L === "undefined") {
    mapElement.innerHTML = '<div class="empty-list">No se pudo cargar el mapa. Revisa la conexión a internet para ver la cartografía.</div>';
    return;
  }
  map = L.map(mapElement, { scrollWheelZoom: false, zoomControl: true });
  const locationBounds = L.latLngBounds(initialBranches.map((branch) => [branch.lat, branch.lng]));
  map.fitBounds(locationBounds, { padding: [24, 24], maxZoom: 9 });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  renderBranches();
}

document.addEventListener("DOMContentLoaded", () => {
  initializeMap();
  fillBranchSelect();
  renderLedger();
  updateRolePermissions();

  document.getElementById("branch-search").addEventListener("input", renderBranches);
  document.getElementById("product-filter").addEventListener("change", renderBranches);
  document.getElementById("locate-button").addEventListener("click", () => {
    if (!map) return;
    map.fitBounds(L.latLngBounds(initialBranches.map((branch) => [branch.lat, branch.lng])), { padding: [24, 24], maxZoom: 9, animate: true });
  });
  document.getElementById("internal-link").addEventListener("click", handleInternalNavigation);
  document.getElementById("back-public").addEventListener("click", showPublicPage);
  document.getElementById("movement-form").addEventListener("submit", registerMovement);
  document.getElementById("role-select").addEventListener("change", updateRolePermissions);
  document.getElementById("login-close").addEventListener("click", () => {
    document.getElementById("login-dialog").close();
    if (window.location.pathname === "/login") window.history.replaceState({}, "", "/");
  });
  document.getElementById("login-dialog").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
  document.getElementById("logout-button").addEventListener("click", async () => {
    await window.emapaApi?.logout();
    showPublicPage();
  });
  document.getElementById("clear-log").addEventListener("click", () => {
    branches = structuredClone(initialBranches);
    movements = [];
    activeBranchId = null;
    renderBranches();
    renderLedger();
  });

  const menuToggle = document.getElementById("menu-toggle");
  const mainNav = document.getElementById("main-nav");
  menuToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
  });
  mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  }));
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.getElementById("branch-search").focus();
    }
    if (event.key === "Escape" && mainNav.classList.contains("open")) {
      mainNav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
});
