const API_URL = "";

let currentAssets = [];
let globalSites = [];
let globalPersons = [];
let globalAdmins = [];
let globalDepartments = [];
let currentReportResults = [];
let currentCtfResults = [];
let currentSrResults = [];
let currentDeptSummary = [];
let currentDeptAssets = {};
let currentAssetPage = 1;
let currentEmployeePage = 1;
let currentHistoryPage = 1;
let totalAssets = 0;
let assetSort = { key: null, dir: null, original: [], exclude: ["Archived"] };

function getToken() {
    const session = localStorage.getItem("adminSession");
    if (!session) return null;
    return JSON.parse(session).access_token;
}

function getAdmin() {
    const session = localStorage.getItem("adminSession");
    if (!session) return null;
    return JSON.parse(session).admin;
}

async function api(url, options = {}) {
    const token = getToken();
    const headers = { ...options.headers };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }
    const response = await fetch(`${API_URL}${url}`, { ...options, headers });
    if (response.status === 401) {
        showToast("Sesion expirada, inicie sesion nuevamente", "error");
        localStorage.removeItem("adminSession");
        window.location.reload();
        throw new Error("Sesion expirada");
    }
    return response;
}

function showToast(message, type) {
    type = type || "info";
    var container = document.getElementById("toastContainer");
    if (!container) return;
    var el = document.createElement("div");
    el.className = "toast-item toast-" + type;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(function() { el.style.opacity = "0"; el.style.transition = "opacity 0.3s"; setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 300); }, 3500);
}

document.addEventListener("DOMContentLoaded", () => {
    checkSession();
    if (getToken()) {
        updateSidebarUserInfo();
        applyPermissionVisibility();
        loadAssets();
        loadDropdownData();
        loadHistory();
        loadPersons();
        loadCatalogs();
        crLoadFields();
        crLoadSavedList();
        showSection('assets');
    }
    setupFormListener();
    setupMovementFormListener();
    setupCatalogFormsListeners();
    setupPersonFormListener();
    setupEditAssetFormListener();
    setupImportFormListener();
    setupReconciliationFormListener();
    setupEditPersonFormListener();
    setupEditSiteFormListener();
    setupEditDepartmentFormListener();
    setupPasswordFormListener();
    setupUserFormListener();
    setupGroupFormListener();
    setupStatusChangeFormListener();
    initScRepairAutocompletes();
    initCrPersonAutocomplete();
    const sortHeaderRow = document.querySelector("#assetsSection thead tr");
    if (sortHeaderRow) {
        sortHeaderRow.addEventListener("click", function(e) {
            const th = e.target.closest("th[data-sort]");
            if (th) sortAssetsBy(th.getAttribute("data-sort"));
        });
    }

    document.addEventListener("click", function(e) {
        const container = document.getElementById("actionsDropdownContainer");
        if (container && !container.contains(e.target)) {
            document.getElementById("page_actions_dropdown")?.classList.add("hidden");
        }
    });

    window.addEventListener("hashchange", handleHashChange);
    if (window.location.hash) {
        handleHashChange();
    }
});

async function loadDropdownData() {
    const assetCatSelect = document.getElementById("asset_category");
    const assetSiteSelect = document.getElementById("asset_site_id");
    const personDeptSelect = document.getElementById("person_department_id");
    const personSiteSelect = document.getElementById("person_site_id");
    const editCatSelect = document.getElementById("edit_asset_category");
    const editSiteSelect = document.getElementById("edit_asset_site_id");

    try {
        const resPersons = await api("/persons/");
        if (resPersons.ok) {
            globalPersons = await resPersons.json();
        }
        const resCats = await api("/categories/distinct/");
        if (resCats.ok) {
            const cats = await resCats.json();
            const fillCatSelect = (sel, withNew) => {
                let html = '<option value="">-- Seleccione Categoria --</option>';
                cats.forEach(c => { html += `<option value="${c}">${c}</option>`; });
                if (withNew) html += '<option value="__NEW__">+ Nueva categoria...</option>';
                sel.innerHTML = html;
                sel.onchange = () => {
                    if (sel.value === "__NEW__") {
                        const name = prompt("Nombre de la nueva categoria:");
                        if (name && name.trim()) {
                            const opt = document.createElement("option");
                            opt.value = name.trim();
                            opt.text = name.trim();
                            sel.insertBefore(opt, sel.lastElementChild);
                            sel.value = name.trim();
                        } else {
                            sel.value = "";
                        }
                    }
                };
            };
            fillCatSelect(assetCatSelect, true);
            fillCatSelect(editCatSelect, true);
            const filterCat = document.getElementById("filterCategory");
            if (filterCat) {
                filterCat.innerHTML = '<option value="">Todas las categorias</option>';
                cats.forEach(c => { filterCat.innerHTML += `<option value="${c}">${c}</option>`; });
            }
            populateDeliveryCategoryCheckboxes(cats);
        }
        const resAllCats = await api("/categories/");
        if (resAllCats.ok) {
            const allCats = (await resAllCats.json()).map(function (c) { return c.name; });
            populateDeliveryCategoryCheckboxes(allCats);
        }
        const resSites = await api("/sites/");
        if (resSites.ok) {
            globalSites = await resSites.json();
            assetSiteSelect.innerHTML = '<option value="">-- Seleccione Sitio --</option>';
            editSiteSelect.innerHTML = '<option value="">-- Seleccione Sitio --</option>';
            personSiteSelect.innerHTML = '<option value="">-- Seleccione Sitio Base --</option>';
            globalSites.forEach(s => {
                const opt = `<option value="${s.id}">${s.site_name}</option>`;
                assetSiteSelect.innerHTML += opt; editSiteSelect.innerHTML += opt; personSiteSelect.innerHTML += opt;
            });
        }
        const resDepts = await api("/departments/");
        if (resDepts.ok) {
            globalDepartments = await resDepts.json();
            personDeptSelect.innerHTML = '<option value="">-- Seleccione Departamento --</option>';
            globalDepartments.forEach(d => { personDeptSelect.innerHTML += `<option value="${d.id}">${d.department_name}</option>`; });
        }
        const resAdmins = await api("/admins/");
        if (resAdmins.ok) {
            globalAdmins = await resAdmins.json();
        }
    } catch (e) { console.error(e); }
    initAutocomplete("modal_person_search", "modal_person_id", "modal_person_results");
    initAutocomplete("delivery_person_search", "delivery_person_id", "delivery_person_results");
    initAutocomplete("report_person_search", "report_person_id", "report_person_results");
    initAutocomplete("edit_repair_left_search", "edit_repair_left_by_id", "edit_repair_left_results");
    initAutocomplete("edit_repair_tech_search", "edit_repair_tech_id", "edit_repair_tech_results", globalAdmins);
    initAutocomplete("adv_person_search", "adv_person_id", "adv_person_results");
    document.getElementById("report_person_id").addEventListener("change", function () {
        updatePersonInfo();
        loadCheckoutReport();
    });
}

function buildAssetQuery() {
    const search = document.getElementById("searchInput").value;
    const tableBody = document.getElementById("assetsTableBody");
    let status = document.getElementById("filterStatus").value;
    if (!status && tableBody.dataset.statusFilter) {
        status = tableBody.dataset.statusFilter;
    }
    const category = document.getElementById("filterCategory").value;
    const pageSize = parseInt(document.getElementById("assetsPageSize").value);
    const skip = (currentAssetPage - 1) * pageSize;
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    params.set("skip", skip);
    params.set("limit", pageSize);
    return params;
}

function changePage(table, delta) {
    if (table === 'assets') {
        currentAssetPage += delta;
        if (currentAssetPage < 1) currentAssetPage = 1;
        loadAssets();
    } else if (table === 'employees') {
        currentEmployeePage += delta;
        if (currentEmployeePage < 1) currentEmployeePage = 1;
        renderEmployeesPage();
    } else if (table === 'history') {
        currentHistoryPage += delta;
        if (currentHistoryPage < 1) currentHistoryPage = 1;
        loadHistory();
    }
}

function changePageSize(table) {
    if (table === 'assets') {
        currentAssetPage = 1;
        loadAssets();
    } else if (table === 'employees') {
        currentEmployeePage = 1;
        renderEmployeesPage();
    } else if (table === 'history') {
        currentHistoryPage = 1;
        loadHistory();
    }
}

function siteName(sid) {
    const s = globalSites.find(x => x.id === sid);
    return s ? s.site_name : '';
}

function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('es-ES') : '';
}

function getAssetBadgeColor(status) {
    if (status === "Checkout") return "bg-blue-100 text-blue-800";
    if (["Broken", "Lost/Missing", "Dispose"].includes(status)) return "bg-red-100 text-red-800";
    if (status === "Under repair" || status === "GarantiaSD") return "bg-amber-100 text-amber-800";
    if (["Reserved"].includes(status)) return "bg-purple-100 text-purple-800";
    return "bg-green-100 text-green-800";
}

function buildAssetRowHTML(asset, mode) {
    const badgeColor = getAssetBadgeColor(asset.status);
    const assignedPerson = (asset.status === "Checkout" && asset.person_id) ? globalPersons.find(p => p.id === asset.person_id) : null;
    const assignedName = assignedPerson ? assignedPerson.full_name : '';
    let actionButton;
    if (mode === 'search') {
        actionButton = `<button onclick="event.stopPropagation(); openDetailsModal(${asset.id})" class="text-[11px] font-bold text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-300 px-2.5 py-1 rounded transition-all cursor-pointer">Ver</button>`;
    } else {
        if (asset.status === "Checkout") {
            actionButton = `<button onclick="openModal('${asset.id}', '${asset.asset_tag_id}', 'checkin')" class="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-1 px-3 rounded shadow transition-colors cursor-pointer">Check-in</button>`;
        } else {
            actionButton = `<button onclick="openModal('${asset.id}', '${asset.asset_tag_id}', 'checkout')" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded shadow transition-colors cursor-pointer">Check-out</button>`;
        }
    }
    return `
        <td class="px-4 py-3 font-mono font-bold text-gray-700 group-hover:text-blue-600">${asset.asset_tag_id}</td>
        <td class="px-4 py-3 text-gray-600">${asset.asset_description}</td>
        <td class="px-4 py-3 text-gray-500">${asset.brand} ${asset.model}</td>
        <td class="px-4 py-3">
            <span class="px-2 py-1 inline-flex items-center text-xs font-semibold rounded-full ${badgeColor}">
                ${asset.status}
            </span>
        </td>
        <td data-col="asignado" class="px-4 py-3 text-gray-600 text-xs">${assignedName}</td>
        <td class="px-4 py-3 text-center" onclick="event.stopPropagation();">${actionButton}</td>
        <td data-col="serie" class="px-4 py-3 text-gray-500 font-mono">${asset.serial_no}</td>
        <td data-col="category" class="px-4 py-3 text-gray-500">${asset.category || ''}</td>
        <td data-col="site" class="px-4 py-3 text-gray-500">${siteName(asset.site_id)}</td>
        <td data-col="phone" class="px-4 py-3 text-gray-500">${asset.numero_telefono || ''}</td>
        <td data-col="vendor" class="px-4 py-3 text-gray-500">${asset.purchased_from || ''}</td>
        <td data-col="date" class="px-4 py-3 text-gray-500">${fmtDate(asset.purchase_date)}</td>
    `;
}

function renderAssetTable(assets, tableBody, mode) {
    tableBody.innerHTML = "";
    if (assets.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="12" class="px-4 py-6 text-center text-gray-400 italic">No hay activos vigentes en el inventario.</td></tr>';
        return;
    }
    assets.forEach(asset => {
        const row = document.createElement("tr");
        row.className = "hover:bg-blue-50/50 transition-colors cursor-pointer group";
        row.onclick = () => openDetailsModal(asset.id);
        row.innerHTML = buildAssetRowHTML(asset, mode || 'default');
        tableBody.appendChild(row);
    });
    applyColumnPreferences();
}

function getSortValue(asset, key) {
    switch (key) {
        case "marca_modelo": return (asset.brand + " " + asset.model).toLowerCase();
        case "asignado": {
            const p = (asset.status === "Checkout" && asset.person_id) ? globalPersons.find(x => x.id === asset.person_id) : null;
            return (p ? p.full_name : '').toLowerCase();
        }
        case "site": return siteName(asset.site_id).toLowerCase();
        case "purchase_date": return asset.purchase_date ? new Date(asset.purchase_date).getTime() : 0;
        default: return (asset[key] || '').toString().toLowerCase();
    }
}

function sortAssetsBy(key) {
    const thead = document.querySelector("#assetsSection thead tr");
    if (!thead || !currentAssets.length) return;
    if (assetSort.key === key) {
        if (assetSort.dir === 'asc') {
            assetSort.dir = 'desc';
        } else {
            assetSort.key = null;
            assetSort.dir = null;
            currentAssets = [...assetSort.original];
            const tb = document.getElementById("assetsTableBody");
            const activeAssets = currentAssets.filter(a => !assetSort.exclude.includes(a.status));
            renderAssetTable(activeAssets, tb);
            thead.querySelectorAll("th").forEach(th => th.classList.remove("sort-asc", "sort-desc"));
            return;
        }
    } else {
        assetSort.key = key;
        assetSort.dir = 'asc';
    }
    const sorted = [...currentAssets].sort((a, b) => {
        const va = getSortValue(a, key);
        const vb = getSortValue(b, key);
        if (typeof va === 'number' && typeof vb === 'number') {
            return assetSort.dir === 'asc' ? va - vb : vb - va;
        }
        const cmp = String(va).localeCompare(String(vb));
        return assetSort.dir === 'asc' ? cmp : -cmp;
    });
    currentAssets = sorted;
    thead.querySelectorAll("th").forEach(th => {
        th.classList.remove("sort-asc", "sort-desc");
        if (th.getAttribute("data-sort") === key) {
            th.classList.add("sort-" + assetSort.dir);
        }
    });
    const tb = document.getElementById("assetsTableBody");
    const activeAssets = currentAssets.filter(a => !assetSort.exclude.includes(a.status));
    renderAssetTable(activeAssets, tb);
}

async function loadAssets() {
    const tableBody = document.getElementById("assetsTableBody");
    const pageInfo = document.getElementById("assetsPageInfo");
    const pageInfoAux = document.getElementById("assetsPageInfoAux");
    const prevBtn = document.querySelector("#assetsSection .flex.justify-between button:first-child");
    const nextBtn = document.querySelector("#assetsSection .flex.justify-between button:last-child");
    const pageSize = parseInt(document.getElementById("assetsPageSize").value);
    document.querySelectorAll("#assetsSection thead tr th").forEach(th => th.classList.remove("sort-asc", "sort-desc"));
    try {
        const query = buildAssetQuery();
        const countParams = new URLSearchParams(query.toString());
        countParams.delete("skip");
        countParams.delete("limit");
        const [countRes, listRes] = await Promise.all([
            api(`/assets/count/?${countParams.toString()}`),
            api(`/assets/?${query}`)
        ]);
        if (!countRes.ok || !listRes.ok) throw new Error("Error en el servidor");
        const countData = await countRes.json();
        totalAssets = countData.count;
        currentAssets = await listRes.json();
        assetSort.original = [...currentAssets];
        assetSort.key = null;
        assetSort.dir = null;
        assetSort.exclude = ["Archived","Broken","Lost","Disposed","Donate","Sold"];
        tableBody.innerHTML = "";
        const activeAssets = currentAssets.filter(a => !assetSort.exclude.includes(a.status));
        if (activeAssets.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="12" class="px-4 py-6 text-center text-gray-400 italic">No hay activos vigentes en el inventario.</td></tr>';
            pageInfo.textContent = "mostrando 0-0 de 0";
            if (prevBtn) prevBtn.disabled = true;
            if (nextBtn) nextBtn.disabled = true;
            return;
        }
        const start = (currentAssetPage - 1) * pageSize + 1;
        const end = Math.min(start + activeAssets.length - 1, totalAssets);
        pageInfo.textContent = `mostrando ${start}-${end} de ${totalAssets}`;
        if (pageInfoAux) pageInfoAux.textContent = `Pagina ${currentAssetPage}`;
        if (prevBtn) prevBtn.disabled = currentAssetPage <= 1;
        if (nextBtn) nextBtn.disabled = activeAssets.length < pageSize;
        renderAssetTable(activeAssets, tableBody);
    } catch (e) { tableBody.innerHTML = '<tr><td colspan="12" class="px-4 py-6 text-center text-red-500 font-medium">Error de conexion con el servidor backend</td></tr>'; }
}

function getHistoryBadgeClass(action) {
    const map = {
        "Checkout": "bg-blue-100 text-blue-800",
        "Check in": "bg-amber-100 text-amber-800",
        "Archived": "bg-red-100 text-red-800",
        "Dispose": "bg-red-100 text-red-800",
        "Donate": "bg-red-100 text-red-800",
        "Sold": "bg-red-100 text-red-800",
        "Under repair": "bg-amber-100 text-amber-800",
        "GarantiaSD": "bg-amber-100 text-amber-800",
        "Reserved": "bg-purple-100 text-purple-800"
    };
    return map[action] || "bg-gray-100 text-gray-800";
}

function openDetailsModal(assetId) {
    window.location.hash = "asset/" + assetId;
}

function closeDetailsModal() { document.getElementById("detailsModal").classList.add("hidden"); }

function toggleSpecificHistory() {
    const wrapper = document.getElementById("assetSpecificHistoryWrapper");
    const icon = document.getElementById("historyToggleIcon");
    if (wrapper.classList.contains("hidden")) { wrapper.classList.remove("hidden"); icon.innerText = "Ocultar"; } 
    else { wrapper.classList.add("hidden"); icon.innerText = "Mostrar"; }
}

async function renderAssetDetail(assetId) {
    let asset;
    try {
        const res = await api(`/assets/${assetId}`);
        if (res.ok) asset = await res.json();
    } catch (e) {}
    if (!asset) { showSection('assets'); return; }

    document.getElementById("page_detailsTitle").innerHTML = `Hoja de Vida del Activo <span class="text-blue-600">#${escapeHtml(asset.asset_tag_id)}</span>`;
    document.getElementById("page_detailsTag").innerText = `Asset Tag ID: ${asset.asset_tag_id}`;
    document.getElementById("page_description").innerText = asset.asset_description;
    document.getElementById("page_brand_model").innerText = `${asset.brand} - ${asset.model}`;
    document.getElementById("page_serial").innerText = asset.serial_no;
    document.getElementById("page_category").innerText = asset.category || "-";

    const statusElement = document.getElementById("page_status");
    let badgeColor = "bg-gray-100 text-gray-800";
    if (asset.status === "Available" || asset.status === "Found") {
        badgeColor = "bg-green-100 text-green-800";
    } else if (asset.status === "Checkout") {
        badgeColor = "bg-blue-100 text-blue-800";
    } else if (asset.status === "Broken" || asset.status === "Lost/Missing" || asset.status === "Dispose") {
        badgeColor = "bg-red-100 text-red-800";
    } else if (asset.status === "Under repair" || asset.status === "GarantiaSD") {
        badgeColor = "bg-amber-100 text-amber-800";
    } else if (asset.status === "Reserved") {
        badgeColor = "bg-purple-100 text-purple-800";
    }
    statusElement.innerHTML = `<span class="px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${badgeColor}">${asset.status}</span>`;

    const employeeObj = globalPersons.find(p => p.id === asset.person_id);
    const containerAsignado = document.getElementById("page_assigned_container");
    if (asset.status === "Checkout" && employeeObj) {
        const safeName = escapeHtml(employeeObj.full_name);
        const onClickName = employeeObj.full_name.replace(/'/g, "\\'");
        containerAsignado.innerHTML = `
            <button onclick="openUserAssetsModal(${employeeObj.id}, '${onClickName}')" class="w-full text-left bg-blue-50 border border-blue-200 rounded p-2 text-blue-700 font-semibold hover:bg-blue-100 transition-colors cursor-pointer block flex justify-between items-center">
                <span>${safeName} (${employeeObj.title || 'Personal'})</span>
                <span class="text-[10px] bg-blue-600 text-white font-bold py-0.5 px-1.5 rounded uppercase tracking-wide">Ver Asignados </span>
            </button>`;
    } else if (asset.status !== "Checkout") {
        containerAsignado.innerHTML = `<p class="text-blue-700 font-medium p-1 bg-blue-50 border border-blue-100 rounded">Status: ${escapeHtml(asset.status)}</p>`;
    } else {
        containerAsignado.innerHTML = `<p class="text-green-700 font-medium p-1 bg-green-50 border border-green-100 rounded">Disponible en Almacen</p>`;
    }

    var repairBlock = document.getElementById("page_repair_block");
    if (asset.status === "Under repair" || asset.status === "GarantiaSD") {
        repairBlock.classList.remove("hidden");
        document.getElementById("page_repair_reason").innerText = asset.repair_reason || "-";
        var leftPerson = globalPersons.find(function (p) { return p.id === asset.repair_left_by_id; });
        document.getElementById("page_repair_left_by").innerText = leftPerson ? leftPerson.full_name + " (" + leftPerson.employee_id + ")" : "-";
        var tech = globalAdmins.find(function (a) { return a.id === asset.repair_technician_id; });
        document.getElementById("page_repair_technician").innerText = tech ? tech.username : "-";
        var ultimoUser = globalPersons.find(function (p) { return p.id === asset.ultimo_asignado_id; });
        document.getElementById("page_ultimo_asignado").innerText = ultimoUser ? ultimoUser.full_name + " (" + ultimoUser.employee_id + ")" : "-";
    } else {
        repairBlock.classList.add("hidden");
    }

    document.getElementById("page_btn_delete_asset").onclick = () => triggerDeleteAsset(asset.id, asset.asset_tag_id);
    document.getElementById("page_btn_edit_asset").onclick = () => openEditAssetModal(asset.id);

    const historyBody = document.getElementById("page_assetSpecificHistoryBody");
    const historialBody = document.getElementById("page_assetDetailHistoryBody");
    const loadingRow = `<tr><td colspan="5" class="px-3 py-4 text-center text-gray-400 italic">Buscando...</td></tr>`;
    historyBody.innerHTML = loadingRow;
    historialBody.innerHTML = loadingRow;

    try {
        const response = await api("/history/");
        if (response.ok) {
            const allHistory = await response.json();
            const specificHistory = allHistory.filter(h => h.asset_id === asset.id);
            if (specificHistory.length === 0) {
                const empty = `<tr><td colspan="5" class="px-3 py-3 text-center text-gray-400 italic">Sin movimientos registrados.</td></tr>`;
                historyBody.innerHTML = empty;
                historialBody.innerHTML = empty;
            } else {
                specificHistory.reverse();
                let historyHtml = "";
                let historialHtml = "";
                specificHistory.forEach(item => {
                    const fecha = new Date(item.fecha_accion).toLocaleString('es-ES');
                    const badgeClass = getHistoryBadgeClass(item.tipo_accion);
                    const actionBadgeHtml = `<span class="px-2 py-1 inline-flex items-center text-xs font-semibold rounded-full ${badgeClass}">${escapeHtml(item.tipo_accion)}</span>`;

                    const person = item.asignado_a_id ? globalPersons.find(p => p.id === item.asignado_a_id) : null;
                    let personHtml;
                    if (person) {
                        const safeName = escapeHtml(person.full_name);
                        const onClickName = person.full_name.replace(/'/g, "\\'");
                        personHtml = `<span onclick="openUserAssetsModal(${person.id}, '${onClickName}')" class="text-blue-600 hover:underline font-medium cursor-pointer">${safeName}</span>`;
                    } else if (item.asignado_a_id) {
                        personHtml = `<span class="text-gray-400 italic">ID: ${item.asignado_a_id}</span>`;
                    } else {
                        personHtml = `<span class="text-gray-400 italic">Almacen</span>`;
                    }

                    const admin = globalAdmins.find(a => a.id === item.realizado_por_id);
                    const operatorName = admin ? escapeHtml(admin.username) : `Admin_${item.realizado_por_id}`;

                    let detailHtml;
                    if (item.notas_detalle) {
                        const escapedDetail = escapeHtml(item.notas_detalle);
                        const onClickDetail = item.notas_detalle.replace(/'/g, "\\'");
                        detailHtml = `<span class="cursor-pointer text-blue-600 underline decoration-dotted hover:text-blue-800" title="${escapedDetail}" onclick="showDetailModal('${onClickDetail}')">${escapedDetail}</span>`;
                    } else {
                        detailHtml = `<span class="text-gray-300 italic">-</span>`;
                    }

                    historyHtml += `<tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td class="px-4 py-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">${fecha}</td>
                        <td class="px-4 py-3">${actionBadgeHtml}</td>
                        <td class="px-4 py-3 text-sm">${personHtml}</td>
                        <td class="px-4 py-3 text-xs text-gray-600">${operatorName}</td>
                        <td class="px-4 py-3 text-xs text-gray-500 italic max-w-[200px] truncate">${detailHtml}</td>
                    </tr>`;

                    const changedFrom = item.estado_anterior ? escapeHtml(item.estado_anterior) : '-';
                    const changedTo = item.estado_nuevo ? escapeHtml(item.estado_nuevo) : '-';

                    historialHtml += `<tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td class="px-4 py-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">${fecha}</td>
                        <td class="px-4 py-3">${actionBadgeHtml}</td>
                        <td class="px-4 py-3 text-xs text-gray-700">Status</td>
                        <td class="px-4 py-3 text-xs text-gray-600">${changedFrom}</td>
                        <td class="px-4 py-3 text-xs text-gray-600">${changedTo}</td>
                        <td class="px-4 py-3 text-xs text-gray-600">${operatorName}</td>
                    </tr>`;
                });
                historyBody.innerHTML = historyHtml;
                historialBody.innerHTML = historialHtml;
            }
        }
    } catch (e) { console.error(e); }

    populateActionsDropdown(asset.status);
    showSection('assetDetail');
}

function closeAssetDetail() {
    window.location.hash = "";
    showSection('assets');
}

function handleHashChange() {
    const hash = window.location.hash.replace("#", "");
    if (hash.startsWith("asset/")) {
        const assetId = parseInt(hash.split("/")[1]);
        if (!isNaN(assetId)) {
            renderAssetDetail(assetId);
        }
    }
}

function populateActionsDropdown(currentStatus) {
    const allStatuses = ["Checkout", "Available", "Broken", "Under repair", "GarantiaSD", "Reserved", "Lost/Missing", "Found", "Dispose", "Donate", "Sold"];
    const ul = document.getElementById("page_actions_dropdown");
    ul.innerHTML = "";
    allStatuses.forEach(s => {
        const li = document.createElement("li");
        li.className = "px-3 py-2 hover:bg-gray-100 cursor-pointer";
        if (s === currentStatus) {
            li.className = "px-3 py-2 text-gray-300 italic cursor-not-allowed";
            li.textContent = s + " (actual)";
        } else {
            const assetId = parseInt(window.location.hash.replace("#asset/", ""));
            li.textContent = s;
            li.onclick = () => { document.getElementById("page_actions_dropdown").classList.add("hidden"); changeAssetStatus(assetId, s); };
        }
        ul.appendChild(li);
    });
}

function toggleActionsDropdown() {
    const dd = document.getElementById("page_actions_dropdown");
    dd.classList.toggle("hidden");
}

function switchHistoryTab(tab) {
    const eventosBtn = document.getElementById("tab_btn_eventos");
    const historialBtn = document.getElementById("tab_btn_historial");
    const eventosDiv = document.getElementById("page_history_eventos");
    const historialDiv = document.getElementById("page_history_historial");
    if (tab === "historial") {
        eventosBtn.className = "px-4 py-2 text-xs font-bold bg-gray-50 text-gray-500 hover:bg-gray-100";
        historialBtn.className = "px-4 py-2 text-xs font-bold bg-amber-500 text-white";
        eventosDiv.classList.add("hidden");
        historialDiv.classList.remove("hidden");
    } else {
        historialBtn.className = "px-4 py-2 text-xs font-bold bg-gray-50 text-gray-500 hover:bg-gray-100";
        eventosBtn.className = "px-4 py-2 text-xs font-bold bg-amber-500 text-white";
        historialDiv.classList.add("hidden");
        eventosDiv.classList.remove("hidden");
    }
}

function changeAssetStatus(assetId, newStatus) {
    if (newStatus === "Checkout") {
        const tagEl = document.getElementById("page_detailsTag");
        const tagText = tagEl ? tagEl.innerText.replace("Asset Tag ID: ", "") : "ID:" + assetId;
        openModal(assetId, tagText, "checkout");
        return;
    }
    document.getElementById("sc_asset_id").value = assetId;
    document.getElementById("sc_new_status").value = newStatus;
    document.getElementById("statusChangeModalTitle").innerText = "Cambiar a " + newStatus;
    const assetTag = document.getElementById("page_detailsTag");
    document.getElementById("sc_asset_info").innerText = "Activo: " + (assetTag ? assetTag.innerText : "ID: " + assetId);
    document.getElementById("sc_notas").value = "";
    document.getElementById("sc_error").classList.add("hidden");

    const repairFields = document.getElementById("sc_repair_fields");
    const repairStatuses = ["Under repair", "GarantiaSD"];
    if (repairStatuses.includes(newStatus)) {
        repairFields.classList.remove("hidden");
    } else {
        repairFields.classList.add("hidden");
        document.getElementById("sc_repair_reason").value = "";
        document.getElementById("sc_repair_left_by_id").value = "";
        document.getElementById("sc_repair_left_search").value = "";
        document.getElementById("sc_repair_tech_id").value = "";
        document.getElementById("sc_repair_tech_search").value = "";
    }

    document.getElementById("statusChangeModal").classList.remove("hidden");
}

function closeStatusChangeModal() {
    document.getElementById("statusChangeModal").classList.add("hidden");
    document.getElementById("statusChangeForm").reset();
    document.getElementById("sc_repair_fields").classList.add("hidden");
    document.getElementById("sc_error").classList.add("hidden");
}

function setupStatusChangeFormListener() {
    document.getElementById("statusChangeForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const assetId = document.getElementById("sc_asset_id").value;
        const newStatus = document.getElementById("sc_new_status").value;
        const notas = document.getElementById("sc_notas").value;

        const repairStatuses = ["Under repair", "GarantiaSD"];
        let body = { status: newStatus, notas: notas || null };

        if (repairStatuses.includes(newStatus)) {
            body.repair_reason = document.getElementById("sc_repair_reason").value || null;
            const leftById = document.getElementById("sc_repair_left_by_id").value;
            body.repair_left_by_id = leftById ? parseInt(leftById) : null;
            const techId = document.getElementById("sc_repair_tech_id").value;
            body.repair_technician_id = techId ? parseInt(techId) : null;
        }

        const simpleStatuses = ["Available", "Found", "Reserved"];
        let url, method, options;

        if (simpleStatuses.includes(newStatus)) {
            url = `/assets/${assetId}/checkin?nuevo_estado=${encodeURIComponent(newStatus)}`;
            if (notas) url += `&notas=${encodeURIComponent(notas)}`;
            method = "POST";
            options = { method };
        } else {
            url = `/assets/${assetId}/status`;
            method = "POST";
            options = { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } };
        }

        try {
            const res = await api(url, options);
            if (res.ok) {
                showToast("Status actualizado a " + newStatus, "success");
                closeStatusChangeModal();
                renderAssetDetail(parseInt(assetId));
            } else {
                const err = await res.json().catch(() => ({}));
                document.getElementById("sc_error").innerText = err.detail || "Error al cambiar status";
                document.getElementById("sc_error").classList.remove("hidden");
            }
        } catch (e) {
            document.getElementById("sc_error").innerText = "Error de conexion";
            document.getElementById("sc_error").classList.remove("hidden");
        }
    });
}

function initScRepairAutocompletes() {
    const leftInput = document.getElementById("sc_repair_left_search");
    const leftResults = document.getElementById("sc_repair_left_results");
    const leftHidden = document.getElementById("sc_repair_left_by_id");
    let leftTimer;

    leftInput.addEventListener("input", function() {
        clearTimeout(leftTimer);
        const q = this.value.trim().toLowerCase();
        if (q.length < 1) { leftResults.classList.add("hidden"); return; }
        leftTimer = setTimeout(() => {
            const matches = globalPersons.filter(p =>
                p.is_active !== false &&
                (p.full_name.toLowerCase().includes(q) || (p.employee_id && p.employee_id.toLowerCase().includes(q)))
            ).slice(0, 8);
            if (matches.length === 0) { leftResults.classList.add("hidden"); return; }
            leftResults.innerHTML = matches.map(p =>
                `<div class="px-3 py-2 hover:bg-amber-100 cursor-pointer text-xs" data-id="${p.id}" data-name="${p.full_name.replace(/"/g, '&quot;').replace(/'/g, "\\'")}">${p.full_name.replace(/</g, '&lt;').replace(/>/g, '&gt;')} (${p.employee_id || ''})</div>`
            ).join("");
            leftResults.querySelectorAll("div").forEach(div => {
                div.addEventListener("click", function() {
                    leftHidden.value = this.dataset.id;
                    leftInput.value = this.dataset.name;
                    leftResults.classList.add("hidden");
                });
            });
            leftResults.classList.remove("hidden");
        }, 200);
    });
    leftInput.addEventListener("blur", () => setTimeout(() => leftResults.classList.add("hidden"), 200));

    const techInput = document.getElementById("sc_repair_tech_search");
    const techResults = document.getElementById("sc_repair_tech_results");
    const techHidden = document.getElementById("sc_repair_tech_id");
    let techTimer;

    techInput.addEventListener("input", function() {
        clearTimeout(techTimer);
        const q = this.value.trim().toLowerCase();
        if (q.length < 1) { techResults.classList.add("hidden"); return; }
        techTimer = setTimeout(() => {
            const matches = globalAdmins.filter(a =>
                a.username && a.username.toLowerCase().includes(q)
            ).slice(0, 8);
            if (matches.length === 0) { techResults.classList.add("hidden"); return; }
            techResults.innerHTML = matches.map(a =>
                `<div class="px-3 py-2 hover:bg-amber-100 cursor-pointer text-xs" data-id="${a.id}" data-name="${a.username.replace(/"/g, '&quot;').replace(/'/g, "\\'")}">${a.username.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
            ).join("");
            techResults.querySelectorAll("div").forEach(div => {
                div.addEventListener("click", function() {
                    techHidden.value = this.dataset.id;
                    techInput.value = this.dataset.name;
                    techResults.classList.add("hidden");
                });
            });
            techResults.classList.remove("hidden");
        }, 200);
    });
    techInput.addEventListener("blur", () => setTimeout(() => techResults.classList.add("hidden"), 200));
}

function openUserAssetsModal(personId, personName) {
    document.getElementById("userAssetsModalSubtitle").innerText = `Empleado: ${personName}`;
    const tableBody = document.getElementById("userAssetsTableBody");
    tableBody.innerHTML = '<tr><td colspan="4" class="px-3 py-4 text-center text-gray-400 italic">Cargando...</td></tr>';
    document.getElementById("userAssetsModal").classList.remove("hidden");
    api("/reports/person-checkouts/" + personId + "?mode=current").then(res => {
        if (!res.ok) throw new Error("Error");
        return res.json();
    }).then(assignedDevices => {
        tableBody.innerHTML = "";
        if (assignedDevices.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="px-3 py-4 text-center text-gray-400 italic">No registra activos en custodia.</td></tr>';
        } else {
            assignedDevices.forEach(dev => {
                const row = document.createElement("tr");
                row.className = "cursor-pointer hover:bg-gray-50 transition-colors";
                row.onclick = () => { closeUserAssetsModal(); openDetailsModal(dev.asset_id); };
                row.innerHTML = '<td class="px-3 py-2 font-bold text-blue-600">' + escapeHtml(dev.asset_tag_id) + '</td><td class="px-3 py-2 text-gray-600">' + escapeHtml(dev.asset_description || "-") + '</td><td class="px-3 py-2 text-gray-500">' + escapeHtml(dev.brand || "") + " " + escapeHtml(dev.model || "") + '</td><td class="px-3 py-2 font-bold text-gray-400">' + escapeHtml(dev.serial_no || "-") + '</td>';
                tableBody.appendChild(row);
            });
        }
    }).catch(() => {
        tableBody.innerHTML = '<tr><td colspan="4" class="px-3 py-4 text-center text-red-400 italic">Error al cargar.</td></tr>';
    });
}
function closeUserAssetsModal() { document.getElementById("userAssetsModal").classList.add("hidden"); }

function openDeletedAssetsModal() {
    const tableBody = document.getElementById("deletedAssetsTableBody");
    tableBody.innerHTML = "";
    const deletedDevices = currentAssets.filter(a => a.status === "Archived");

    if (deletedDevices.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400 italic">Bandeja vacia. No hay equipos eliminados recientemente.</td></tr>`;
    } else {
        deletedDevices.forEach(dev => {
            const row = document.createElement("tr");
            row.className = "hover:bg-red-50/30 transition-colors";
            row.innerHTML = `
                <td class="px-4 py-3 font-bold text-red-700">${dev.asset_tag_id}</td>
                <td class="px-4 py-3 text-gray-600">${dev.asset_description}</td>
                <td class="px-4 py-3 text-gray-500">${dev.brand} ${dev.model}</td>
                <td class="px-4 py-3 font-mono text-gray-400">${dev.serial_no}</td>
                <td class="px-4 py-3 text-center">
                    <button onclick="restoreAsset('${dev.id}', '${dev.asset_tag_id}')" class="bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] uppercase py-1 px-3 rounded shadow transition-colors cursor-pointer">
                        Restaurar
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
    document.getElementById("deletedAssetsModal").classList.remove("hidden");
}
function closeDeletedAssetsModal() { document.getElementById("deletedAssetsModal").classList.add("hidden"); }

async function restoreAsset(assetId, assetTag) {
    const asset = currentAssets.find(a => a.id === parseInt(assetId));
    if (!asset) return;
    const restoredData = { ...asset, status: "Available" };
    try {
        const response = await api(`/assets/${assetId}`, { method: "PUT", body: JSON.stringify(restoredData) });
            if (response.ok) { showToast("Activo " + assetTag + " restaurado al almacen", "success"); closeDeletedAssetsModal(); loadAssets(); loadHistory(); }
    } catch (e) { alert("Error."); }
}

function toggleEditRepairFields() {
    var status = document.getElementById("edit_asset_status").value;
    var block = document.getElementById("editRepairFields");
    if (status === "Under repair" || status === "GarantiaSD") {
        block.classList.remove("hidden");
    } else {
        block.classList.add("hidden");
        document.getElementById("edit_repair_reason").value = "";
        document.getElementById("edit_repair_left_search").value = "";
        document.getElementById("edit_repair_left_by_id").value = "";
        document.getElementById("edit_repair_tech_search").value = "";
        document.getElementById("edit_repair_tech_id").value = "";
    }
    if (status === "Checkout") {
        var assetId = document.getElementById("edit_asset_id").value;
        var assetTag = document.getElementById("edit_asset_tag_id").value;
        if (assetId) {
            closeEditAssetModal();
            openModal(assetId, assetTag, 'checkout');
        }
    }
}

async function openEditAssetModal(assetId) {
    let asset;
    try {
        const res = await api(`/assets/${assetId}`);
        if (res.ok) asset = await res.json();
    } catch (e) {}
    if (!asset) return;
    document.getElementById("edit_asset_id").value = asset.id;
    document.getElementById("edit_asset_tag_id").value = asset.asset_tag_id;
    document.getElementById("edit_asset_description").value = asset.asset_description;
    document.getElementById("edit_brand").value = asset.brand;
    document.getElementById("edit_model").value = asset.model;
    document.getElementById("edit_serial_no").value = asset.serial_no;
    document.getElementById("edit_asset_category").value = asset.category || "";
    document.getElementById("edit_asset_site_id").value = asset.site_id;

    const assignedPerson = globalPersons.find(p => p.id === asset.person_id);
    const assignedContainer = document.getElementById("editAssetAssignedContainer");
    const assignedName = document.getElementById("editAssetAssignedName");
    if (asset.status === "Checkout" && assignedPerson) {
        assignedContainer.classList.remove("hidden");
        assignedName.textContent = assignedPerson.full_name + (assignedPerson.title ? " (" + assignedPerson.title + ")" : "");
    } else {
        assignedContainer.classList.add("hidden");
        assignedName.textContent = "";
    }

    document.getElementById("edit_asset_status").value = asset.status;

    var isRepair = asset.status === "Under repair" || asset.status === "GarantiaSD";
    var block = document.getElementById("editRepairFields");
    if (isRepair) {
        block.classList.remove("hidden");
        document.getElementById("edit_repair_reason").value = asset.repair_reason || "";
        var leftPerson = globalPersons.find(function (p) { return p.id === asset.repair_left_by_id; });
        if (leftPerson) {
            document.getElementById("edit_repair_left_search").value = leftPerson.full_name + " (" + leftPerson.employee_id + ")";
            document.getElementById("edit_repair_left_by_id").value = leftPerson.id;
        }
        var tech = globalAdmins.find(function (a) { return a.id === asset.repair_technician_id; });
        if (tech) {
            document.getElementById("edit_repair_tech_search").value = tech.username;
            document.getElementById("edit_repair_tech_id").value = tech.id;
        }
    } else {
        block.classList.add("hidden");
        document.getElementById("edit_repair_reason").value = "";
        document.getElementById("edit_repair_left_search").value = "";
        document.getElementById("edit_repair_left_by_id").value = "";
        document.getElementById("edit_repair_tech_search").value = "";
        document.getElementById("edit_repair_tech_id").value = "";
    }

    document.getElementById("editAssetModal").classList.remove("hidden");
}
function closeEditAssetModal() {
    document.getElementById("editAssetModal").classList.add("hidden");
    document.getElementById("editRepairFields").classList.add("hidden");
    document.getElementById("edit_repair_reason").value = "";
    document.getElementById("edit_repair_left_search").value = "";
    document.getElementById("edit_repair_left_by_id").value = "";
    document.getElementById("edit_repair_tech_search").value = "";
    document.getElementById("edit_repair_tech_id").value = "";
    document.getElementById("editAssetAssignedContainer").classList.add("hidden");
    document.getElementById("editAssetAssignedName").textContent = "";
}

function setupEditAssetFormListener() {
    const form = document.getElementById("editAssetForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const assetId = document.getElementById("edit_asset_id").value;

        var repairStatus = document.getElementById("edit_asset_status").value;
        var isRepair = repairStatus === "Under repair" || repairStatus === "GarantiaSD";
        const updatedData = {
            asset_tag_id: document.getElementById("edit_asset_tag_id").value,
            asset_description: document.getElementById("edit_asset_description").value,
            brand: document.getElementById("edit_brand").value,
            model: document.getElementById("edit_model").value,
            serial_no: document.getElementById("edit_serial_no").value,
            category: document.getElementById("edit_asset_category").value,
            site_id: parseInt(document.getElementById("edit_asset_site_id").value),
            status: repairStatus,
            repair_reason: isRepair ? document.getElementById("edit_repair_reason").value : null,
            repair_left_by_id: isRepair ? parseInt(document.getElementById("edit_repair_left_by_id").value) || null : null,
            repair_technician_id: isRepair ? parseInt(document.getElementById("edit_repair_tech_id").value) || null : null
        };

        try {
            const response = await api(`/assets/${assetId}`, {
                method: "PUT",
                body: JSON.stringify(updatedData)
            });

            if (response.ok) {
                showToast("Modificado con exito!", "success");
                closeEditAssetModal();
                closeDetailsModal();
                loadAssets();   
                loadHistory();  
            } else {
                const errData = await response.json();
                alert(`Error del servidor: ${errData.detail || "No se pudo actualizar"}`);
            }
        } catch (error) {
            console.error("Error en la peticion PUT:", error);
            alert("Error de conexion al intentar guardar los cambios.");
        }
    });
}

async function triggerDeleteAsset(assetId, assetTag) {
    const confirmacion = confirm(`Deseas dar de baja el activo ${assetTag}? Se ocultara del inventario global y se movera a la papelera.`);
    if (!confirmacion) return;
    try {
        const response = await api(`/assets/${assetId}`, { method: "DELETE" });
        if (response.ok) { showToast("Movido a la papelera", "success"); closeDetailsModal(); loadAssets(); loadHistory(); }
    } catch (e) { alert("Error."); }
}

async function loadHistory(search) {
    const historyBody = document.getElementById("historyTableBody");
    const pageSize = parseInt(document.getElementById("historyPageSize").value);
    const pageInfo = document.getElementById("historyPageInfo");
    const pageInfoAux = document.getElementById("historyPageInfoAux");
    const prevBtn = document.querySelector("#historySection .flex.justify-between button:first-child");
    const nextBtn = document.querySelector("#historySection .flex.justify-between button:last-child");
    const searchParam = search || "";
    try {
        const [countRes, listRes] = await Promise.all([
            api(`/history/count/?search=${encodeURIComponent(searchParam)}`),
            api(`/history/?search=${encodeURIComponent(searchParam)}&skip=${(currentHistoryPage - 1) * pageSize}&limit=${pageSize}`)
        ]);
        if (!countRes.ok || !listRes.ok) throw new Error("Error");
        const countData = await countRes.json();
        const historyData = await listRes.json();
        const total = countData.count;
        historyBody.innerHTML = "";
        if (historyData.length === 0) { historyBody.innerHTML = `<tr><td colspan="6" class="px-4 py-4 text-center text-gray-400 italic">Sin movimientos.</td></tr>`; pageInfo.textContent = "mostrando 0-0 de 0"; if (pageInfoAux) pageInfoAux.textContent = "Pagina 1"; if (prevBtn) prevBtn.disabled = true; if (nextBtn) nextBtn.disabled = true; return; }
        const start = (currentHistoryPage - 1) * pageSize + 1;
        const end = Math.min(start + historyData.length - 1, total);
        pageInfo.textContent = `mostrando ${start}-${end} de ${total}`;
        if (pageInfoAux) pageInfoAux.textContent = `Pagina ${currentHistoryPage}`;
        if (prevBtn) prevBtn.disabled = currentHistoryPage <= 1;
        if (nextBtn) nextBtn.disabled = historyData.length < pageSize;
        historyData.forEach(item => {
            const row = document.createElement("tr"); row.className = "hover:bg-gray-50 text-xs";
            let actionBadge = "text-blue-600 font-bold";
            if (item.tipo_accion === "Check in") actionBadge = "text-amber-600 font-bold";
            if (item.tipo_accion === "Archived") actionBadge = "text-red-600 font-bold";
            const fecha = new Date(item.fecha_accion).toLocaleString('es-ES');
            const assetObj = item.asset_id ? currentAssets.find(a => a.id === item.asset_id) : null;
            const employeeObj = globalPersons.find(p => p.id === item.asignado_a_id);
            
            const detail = (item.notas_detalle || '-');
            const detailCell = document.createElement('td');
            detailCell.className = 'px-4 py-2 text-gray-500 italic align-top break-words';
            const detailSpan = document.createElement('span');
            detailSpan.className = 'cursor-pointer text-blue-600 underline decoration-dotted hover:text-blue-800';
            detailSpan.title = detail;
            detailSpan.textContent = detail;
            detailSpan.onclick = function() { showDetailModal(detail); };
            detailCell.appendChild(detailSpan);
            const assetCell = item.asset_id ? `<td class="px-4 py-2 font-bold text-gray-700 align-top cursor-pointer hover:text-blue-600" onclick="openDetailsModal(${item.asset_id})">${assetObj ? assetObj.asset_tag_id : 'ID: ' + item.asset_id}</td>` : `<td class="px-4 py-2 text-gray-400 align-top italic">N/A</td>`;
            row.innerHTML = `<td class="px-4 py-2 text-gray-500 whitespace-nowrap align-top">${fecha}</td><td class="px-4 py-2 uppercase ${actionBadge} align-top">${item.tipo_accion}</td>${assetCell}<td class="px-4 py-2 text-gray-600 align-top">${employeeObj ? employeeObj.full_name : (item.asignado_a_id ? 'ID: ' + item.asignado_a_id : 'Almacen')}</td><td class="px-4 py-2 text-gray-600 align-top">Admin_${item.realizado_por_id}</td>`;
            row.appendChild(detailCell);
            historyBody.appendChild(row);
        });
    } catch (e) { console.error(e); }
}

function showDetailModal(text) {
    document.getElementById("detailModalBody").textContent = text;
    document.getElementById("detailModal").classList.remove("hidden");
    document.addEventListener("keydown", detailModalKeydown);
}

function closeDetailModal() {
    document.getElementById("detailModal").classList.add("hidden");
    document.removeEventListener("keydown", detailModalKeydown);
}

function detailModalKeydown(e) {
    if (e.key === "Escape") closeDetailModal();
}

async function loadPersons(search) {
    try {
        const url = search ? `/persons/?search=${encodeURIComponent(search)}` : "/persons/";
        const res = await api(url);
        if (!res.ok) throw new Error("Error");
        globalPersons = await res.json();
        renderEmployeesPage();
    } catch (e) { document.getElementById("personsTableBody").innerHTML = '<tr><td colspan="9" class="px-4 py-6 text-center text-red-500 font-medium">Error al cargar empleados</td></tr>'; }
}

function renderEmployeesPage() {
    const tableBody = document.getElementById("personsTableBody");
    const pageSize = parseInt(document.getElementById("employeesPageSize").value);
    const pageInfo = document.getElementById("employeesPageInfo");
    const pageInfoAux = document.getElementById("employeesPageInfoAux");
    const prevBtn = document.querySelector("#employeesSection .flex.justify-between button:first-child");
    const nextBtn = document.querySelector("#employeesSection .flex.justify-between button:last-child");
    const persons = globalPersons;
    tableBody.innerHTML = "";
    if (persons.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="px-4 py-6 text-center text-gray-400 italic">No hay empleados registrados.</td></tr>';
        pageInfo.textContent = "mostrando 0-0 de 0";
        if (pageInfoAux) pageInfoAux.textContent = "Pagina 1";
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        return;
    }
    const total = persons.length;
    const start = (currentEmployeePage - 1) * pageSize;
    const pageItems = persons.slice(start, start + pageSize);
    const displayStart = total > 0 ? start + 1 : 0;
    const displayEnd = Math.min(start + pageSize, total);
    pageInfo.textContent = `mostrando ${displayStart}-${displayEnd} de ${total}`;
    if (pageInfoAux) pageInfoAux.textContent = `Pagina ${currentEmployeePage}`;
    if (prevBtn) prevBtn.disabled = currentEmployeePage <= 1;
    if (nextBtn) nextBtn.disabled = displayEnd >= total;
    pageItems.forEach(p => {
        const dept = globalDepartments.find(d => d.id === p.department_id);
        const site = globalSites.find(s => s.id === p.site_id);
        const row = document.createElement("tr");
        var isActive = p.is_active !== false;
        row.className = isActive ? "hover:bg-teal-50/50 transition-colors" : "hover:bg-gray-100/50 transition-colors opacity-60";
        var statusBadge = isActive
            ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border border-green-300"><span class="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>Activo</span>'
            : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-300"><span class="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>Inactivo</span>';
            row.innerHTML = `
                <td class="px-4 py-3 font-medium text-gray-800">${p.full_name}</td>
                <td class="px-4 py-3 text-gray-500">${p.email}</td>
                <td class="px-4 py-3 text-gray-600 font-mono">${p.employee_id}</td>
                <td data-col="dept" class="px-4 py-3 text-gray-600">${dept ? dept.department_name : '-'}</td>
                <td data-col="site" class="px-4 py-3 text-gray-600">${site ? site.site_name : '-'}</td>
                <td data-col="phone" class="px-4 py-3 text-gray-500">${p.phone || '-'}</td>
                <td data-col="notes" class="px-4 py-3 text-gray-500">${p.notes || '-'}</td>
                <td data-col="status" class="px-4 py-3 text-center">${statusBadge}</td>
                <td class="px-4 py-3 text-center">
                    <button onclick="openEditPersonModal(${p.id})" class="bg-teal-100 hover:bg-teal-200 text-teal-700 font-bold text-[10px] uppercase py-1 px-2.5 rounded border border-teal-300 transition-colors cursor-pointer">Editar</button>
                </td>`;
            tableBody.appendChild(row);
        });
        applyColumnPreferences();
}
async function loadCatalogs() {
    const sitesBody = document.getElementById("sitesTableBody");
    const deptsBody = document.getElementById("departmentsTableBody");
    try {
        const resSites = await api("/sites/");
        if (resSites.ok) {
            const sites = await resSites.json();
            document.getElementById("siteCount").textContent = sites.length;
            sitesBody.innerHTML = "";
            if (sites.length === 0) {
                sitesBody.innerHTML = '<tr><td colspan="4" class="px-3 py-3 text-center text-gray-400 italic">Sin sitios registrados.</td></tr>';
            } else {
                sites.forEach(s => {
                    const row = document.createElement("tr");
                    row.className = "hover:bg-blue-50/50 transition-colors";
                    row.innerHTML = `<td class="px-3 py-2 font-medium">${s.site_name}</td><td class="px-3 py-2 text-gray-500">${s.city || '-'}</td><td class="px-3 py-2 text-gray-500">${s.country || '-'}</td><td class="px-3 py-2 text-center"><button onclick="openEditSiteModal(${s.id})" class="bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold text-[10px] uppercase py-1 px-2.5 rounded border border-blue-300 transition-colors cursor-pointer">Editar</button></td>`;
                    sitesBody.appendChild(row);
                });
            }
        }
        const resDepts = await api("/departments/");
        if (resDepts.ok) {
            const depts = await resDepts.json();
            document.getElementById("deptCount").textContent = depts.length;
            deptsBody.innerHTML = "";
            if (depts.length === 0) {
                deptsBody.innerHTML = '<tr><td colspan="2" class="px-3 py-3 text-center text-gray-400 italic">Sin departamentos registrados.</td></tr>';
            } else {
                depts.forEach(d => {
                    const row = document.createElement("tr");
                    row.className = "hover:bg-blue-50/50 transition-colors";
                    row.innerHTML = `<td class="px-3 py-2 font-medium">${d.department_name}</td><td class="px-3 py-2 text-center"><button onclick="openEditDepartmentModal(${d.id})" class="bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold text-[10px] uppercase py-1 px-2.5 rounded border border-blue-300 transition-colors cursor-pointer">Editar</button></td>`;
                    deptsBody.appendChild(row);
                });
            }
        }
        const resCats = await api("/categories/");
        if (resCats.ok) {
            const cats = await resCats.json();
            document.getElementById("catCount").textContent = cats.length;
            const catsBody = document.getElementById("categoriesTableBody");
            if (!catsBody) return;
            catsBody.innerHTML = "";
            if (cats.length === 0) {
                catsBody.innerHTML = '<tr><td colspan="2" class="px-3 py-3 text-center text-gray-400 italic">Sin categorias registradas.</td></tr>';
            } else {
                cats.forEach(c => {
                    const row = document.createElement("tr");
                    row.className = "hover:bg-blue-50/50 transition-colors";
                    row.innerHTML = '<td class="px-3 py-2 font-medium">' + c.name + '</td>' +
                        '<td class="px-3 py-2 text-center">' +
                        '<button onclick="openEditCategoryModal(' + c.id + ',\'' + c.name.replace(/'/g, "\\'") + '\')" class="bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold text-[10px] uppercase py-1 px-2.5 rounded border border-blue-300 transition-colors cursor-pointer">Editar</button>' +
                        ' <button onclick="deleteCategory(' + c.id + ',\'' + c.name.replace(/'/g, "\\'") + '\')" class="bg-red-100 hover:bg-red-200 text-red-700 font-bold text-[10px] uppercase py-1 px-2.5 rounded border border-red-300 transition-colors cursor-pointer">Eliminar</button>' +
                        '</td>';
                    catsBody.appendChild(row);
                });
            }
        }
    } catch (e) { console.error(e); }
}

async function openEditPersonModal(personId) {
    const p = globalPersons.find(p => p.id === personId);
    if (!p) return;
    document.getElementById("edit_person_id").value = p.id;
    document.getElementById("edit_person_full_name").value = p.full_name;
    document.getElementById("edit_person_employee_id").value = p.employee_id;
    document.getElementById("edit_person_title").value = p.title || "";
    document.getElementById("edit_person_email").value = p.email;
    document.getElementById("edit_person_phone").value = p.phone || "";
    document.getElementById("edit_person_notes").value = p.notes || "";
    document.getElementById("edit_person_is_active").checked = p.is_active !== false;
    const fillEditSelect = (id, items) => {
        const sel = document.getElementById(id);
        sel.innerHTML = "";
        items.forEach(item => {
            const opt = document.createElement("option");
            opt.value = item.id; opt.text = item.department_name || item.site_name;
            sel.appendChild(opt);
        });
    };
    fillEditSelect("edit_person_department_id", globalDepartments);
    fillEditSelect("edit_person_site_id", globalSites);
    document.getElementById("edit_person_department_id").value = p.department_id;
    document.getElementById("edit_person_site_id").value = p.site_id;
    document.getElementById("editPersonModal").classList.remove("hidden");
}
function closeEditPersonModal() {
    document.getElementById("editPersonModal").classList.add("hidden");
}

function setupEditPersonFormListener() {
    const form = document.getElementById("editPersonForm");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("edit_person_id").value;
        const data = {
            full_name: document.getElementById("edit_person_full_name").value,
            employee_id: document.getElementById("edit_person_employee_id").value,
            title: document.getElementById("edit_person_title").value || null,
            email: document.getElementById("edit_person_email").value,
            phone: document.getElementById("edit_person_phone").value || null,
            notes: document.getElementById("edit_person_notes").value || null,
            department_id: parseInt(document.getElementById("edit_person_department_id").value),
            site_id: parseInt(document.getElementById("edit_person_site_id").value),
            is_active: document.getElementById("edit_person_is_active").checked
        };
        try {
            const res = await api(`/persons/${id}`, { method: "PUT", body: JSON.stringify(data) });
            if (res.ok) {
                showToast("Empleado actualizado correctamente!", "success");
                closeEditPersonModal();
                await loadDropdownData();
                await loadPersons();
            } else {
                const err = await res.json().catch(() => ({ detail: "Error" }));
                alert("Error: " + (err.detail || "No se pudo actualizar"));
            }
        } catch (e) { alert("Error de conexion"); }
    });
}

async function openEditSiteModal(siteId) {
    const site = globalSites.find(s => s.id === siteId);
    if (!site) return;
    document.getElementById("edit_site_id").value = site.id;
    document.getElementById("edit_site_name_input").value = site.site_name;
    document.getElementById("edit_site_city_input").value = site.city || "";
    document.getElementById("edit_site_country_input").value = site.country || "";
    document.getElementById("editSiteModal").classList.remove("hidden");
}
function closeEditSiteModal() { document.getElementById("editSiteModal").classList.add("hidden"); }

function setupEditSiteFormListener() {
    const form = document.getElementById("form_edit_site");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("edit_site_id").value;
        const data = {
            site_name: document.getElementById("edit_site_name_input").value,
            city: document.getElementById("edit_site_city_input").value || null,
            country: document.getElementById("edit_site_country_input").value || null
        };
        try {
            const res = await api(`/sites/${id}`, { method: "PUT", body: JSON.stringify(data) });
            if (res.ok) {
                showToast("Sitio actualizado!", "success"); closeEditSiteModal();
                await loadDropdownData(); await loadCatalogs();
            } else {
                const err = await res.json().catch(()=>({detail:"Error"}));
                alert("Error: " + (err.detail || "No se pudo actualizar"));
            }
        } catch (e) { alert("Error de conexion"); }
    });
}

async function openEditDepartmentModal(deptId) {
    const dept = globalDepartments.find(d => d.id === deptId);
    if (!dept) return;
    document.getElementById("edit_dept_id").value = dept.id;
    document.getElementById("edit_dept_name_input").value = dept.department_name;
    document.getElementById("editDepartmentModal").classList.remove("hidden");
}
function closeEditDepartmentModal() { document.getElementById("editDepartmentModal").classList.add("hidden"); }

function setupEditDepartmentFormListener() {
    const form = document.getElementById("form_edit_department");
    if (!form) return;
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("edit_dept_id").value;
        const data = { department_name: document.getElementById("edit_dept_name_input").value };
        try {
            const res = await api(`/departments/${id}`, { method: "PUT", body: JSON.stringify(data) });
            if (res.ok) {
                showToast("Departamento actualizado!", "success"); closeEditDepartmentModal();
                await loadDropdownData(); await loadCatalogs();
            } else {
                const err = await res.json().catch(()=>({detail:"Error"}));
                alert("Error: " + (err.detail || "No se pudo actualizar"));
            }
        } catch (e) { alert("Error de conexion"); }
    });
}

function initAutocomplete(inputId, hiddenId, resultsId, dataSource) {
    const input = document.getElementById(inputId);
    const hidden = document.getElementById(hiddenId);
    const results = document.getElementById(resultsId);
    if (!input) return;
    var source = dataSource || globalPersons;

    input.addEventListener("input", function () {
        const query = this.value.toLowerCase().trim();
        if (query.length === 0) {
            results.classList.add("hidden");
            hidden.value = "";
            return;
        }
        var filtered = source.filter(function (p) {
            return (p.full_name && p.full_name.toLowerCase().includes(query)) ||
                   (p.employee_id && p.employee_id.toLowerCase().includes(query)) ||
                   (p.username && p.username.toLowerCase().includes(query)) ||
                   (p.email && p.email.toLowerCase().includes(query));
        });
        if (filtered.length === 0) {
            results.innerHTML = '<div class="p-2 text-gray-400 text-sm">Sin resultados</div>';
            results.classList.remove("hidden");
            return;
        }
        results.innerHTML = filtered.map(function (p) {
            var label = p.full_name || p.username;
            var sub = p.employee_id || p.username;
            return '<div class="p-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100" data-id="' + p.id + '" data-name="' + label + '" data-eid="' + sub + '">' +
                '<span class="font-medium">' + label + '</span>' +
                '<span class="text-gray-400 text-xs ml-1">(' + sub + ')</span>' +
                (p.email ? '<span class="text-gray-400 text-xs ml-2">' + p.email + '</span>' : '') +
            '</div>';
        }).join('');
        results.classList.remove("hidden");
    });

    results.addEventListener("click", function (e) {
        const item = e.target.closest("[data-id]");
        if (item) {
            input.value = item.dataset.name + " (" + item.dataset.eid + ")";
            hidden.value = item.dataset.id;
            results.classList.add("hidden");
            hidden.dispatchEvent(new Event("change"));
        }
    });
}

document.addEventListener("click", function (e) {
    document.querySelectorAll('[id$="_results"]').forEach(function (el) {
        var container = el.closest(".relative");
        if (container && !container.contains(e.target)) {
            el.classList.add("hidden");
        }
    });
});

function openModal(assetId, assetTag, actionType) {
    document.getElementById("modal_asset_id").value = assetId; document.getElementById("modal_action_type").value = actionType;
    document.getElementById("modalAssetInfo").innerText = `Activo Seleccionado: ${assetTag}`;
    const divAsignadoA = document.getElementById("div_asignado_a"); const modalTitle = document.getElementById("modalTitle"); const submitBtn = document.getElementById("modalSubmitBtn");
    if (actionType === "checkout") { modalTitle.innerText = "Registrar Asignacion (Check-out)"; submitBtn.innerText = "Asignar Equipo"; submitBtn.className = "px-4 py-2 bg-blue-600 text-white font-bold rounded text-sm cursor-pointer"; divAsignadoA.classList.remove("hidden"); document.getElementById("modal_person_search").value = ""; document.getElementById("modal_person_id").value = ""; document.getElementById("modal_person_results").classList.add("hidden"); } 
    else { modalTitle.innerText = "Registrar Devolucion (Check-in)"; submitBtn.innerText = "Recibir en Almacen"; submitBtn.className = "px-4 py-2 bg-amber-600 text-white font-bold rounded text-sm cursor-pointer"; divAsignadoA.classList.add("hidden"); }
    document.getElementById("movementModal").classList.remove("hidden");
}
function closeModal() { document.getElementById("movementModal").classList.add("hidden"); document.getElementById("movementForm").reset(); document.getElementById("modal_person_results")?.classList.add("hidden"); window.__reconciliationAfterCheckin = null; }

function setupMovementFormListener() {
    document.getElementById("movementForm").addEventListener("submit", async (e) => {
        e.preventDefault(); 
        const assetId = document.getElementById("modal_asset_id").value; 
        const actionType = document.getElementById("modal_action_type").value; 
        const notas = document.getElementById("modal_notas").value;

        let url = `/assets/${assetId}/checkin`; 
        if (notas) url += `?notas=${encodeURIComponent(notas)}`;
        
        if (actionType === "checkout") { 
            const personId = document.getElementById("modal_person_id").value; 
            url = `/assets/${assetId}/checkout?person_id=${personId}`; 
            if (notas) url += `&notas=${encodeURIComponent(notas)}`; 
        }
        
        try { 
            const response = await api(url, { method: "POST" }); 
            if (response.ok) { 
                showToast("Movimiento procesado con exito!", "success"); 
                processReconciliationAfterCheckin();
                closeModal(); 
                loadAssets(); 
                loadHistory(); 
            } 
        } catch (e) { alert("Error."); }
    });
}

function setupFormListener() {
    document.getElementById("assetForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const siteVal = document.getElementById("asset_site_id").value;
        const assetData = { asset_tag_id: document.getElementById("asset_tag_id").value, asset_description: document.getElementById("asset_description").value, brand: document.getElementById("brand").value, model: document.getElementById("model").value, serial_no: document.getElementById("serial_no").value, category: document.getElementById("asset_category").value, site_id: siteVal ? parseInt(siteVal) : null, status: "Available" };
        try { const response = await api("/assets/", { method: "POST", body: JSON.stringify(assetData) }); if (response.status === 201) { showToast("Activo registrado con exito!", "success"); closeAssetModal(); loadAssets(); } } catch (error) { alert("Error."); }
    });
}

function setupPersonFormListener() {
    document.getElementById("personForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const personData = { full_name: document.getElementById("person_full_name").value, email: document.getElementById("person_email").value, employee_id: document.getElementById("person_employee_id").value, title: document.getElementById("person_title").value || null, phone: document.getElementById("person_phone").value || null, notes: document.getElementById("person_notes").value || null, site_id: parseInt(document.getElementById("person_site_id").value), department_id: parseInt(document.getElementById("person_department_id").value) };
        try { const response = await api("/persons/", { method: "POST", body: JSON.stringify(personData) }); if (response.status === 201) { showToast("Empleado dado de alta!", "success"); closePersonModal(); loadDropdownData(); } } catch (e) { alert("Error."); }
    });
}

function setupCatalogFormsListeners() {
    document.getElementById("form_add_site").addEventListener("submit", async (e) => { 
        e.preventDefault(); 
        try {
            const data = { site_name: document.getElementById("site_name_input").value, city: document.getElementById("site_city_input").value || null, country: document.getElementById("site_country_input").value || null }; 
            const res = await api("/sites/", { method: "POST", body: JSON.stringify(data) }); 
            if (res.ok) { 
                showToast("Sitio creado!", "success"); closeSiteModal(); document.getElementById("form_add_site").reset(); 
                loadDropdownData(); 
            } else {
                const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
                alert("Error: " + (err.detail || "No se pudo crear el sitio"));
            }
        } catch (e) { alert("Error de conexion: " + e.message); }
    });
    
    document.getElementById("form_add_department").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
            const name = document.getElementById("dept_name_input").value;
            if (!name.trim()) { alert("El nombre del departamento es obligatorio"); return; }
            const res = await api("/departments/", { method: "POST", body: JSON.stringify({ department_name: name.trim() }) });
            if (res.ok) {
                showToast("Departamento creado!", "success"); closeDepartmentModal(); document.getElementById("form_add_department").reset();
                loadDropdownData();
            } else {
                const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
                alert("Error: " + (err.detail || "No se pudo crear el departamento"));
            }
        } catch (e) { alert("Error de conexion: " + e.message); }
    });

    document.getElementById("form_add_category").addEventListener("submit", async (e) => {
        e.preventDefault();
        const editId = document.getElementById("edit_cat_id").value;
        const name = document.getElementById("cat_name_input").value.trim();
        if (!name) { alert("El nombre es obligatorio"); return; }
        try {
            let res;
            if (editId) {
                res = await api("/categories/" + editId, { method: "PUT", body: JSON.stringify({ name: name }) });
            } else {
                res = await api("/categories/", { method: "POST", body: JSON.stringify({ name: name }) });
            }
            if (res.ok) {
                showToast("Categoria guardada!", "success");
                closeCategoryModal();
                loadCatalogs();
                loadDropdownData();
            } else {
                const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
                alert("Error: " + (err.detail || "No se pudo guardar"));
            }
        } catch (e) { alert("Error de conexion: " + e.message); }
    });
}

function checkSession() {
    const token = getToken();
    const overlay = document.getElementById("loginOverlay");
    
    if (token) {
        overlay.classList.add("hidden");
    } else {
        overlay.classList.remove("hidden");
    }
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById("login_username").value;
    const passwordInput = document.getElementById("login_password").value;

    try {
        const response = await fetch(`/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem("adminSession", JSON.stringify({
                access_token: data.access_token,
                admin: data.admin,
                group: data.admin.group
            }));
            document.getElementById("loginOverlay").classList.add("hidden");
            document.getElementById("loginForm").reset();
            updateSidebarUserInfo();
            applyPermissionVisibility();
            loadAssets();
            loadDropdownData();
            loadHistory();
            loadPersons();
            loadCatalogs();
        showSection('dashboard');
        } else {
            const err = await response.json();
            showToast("Acceso Denegado: " + (err.detail || "Verifique sus datos."), "error");
        }
    } catch (error) {
        showToast("Error de conexion con el modulo de autenticacion.", "error");
    }
});

function logout() {
    if (confirm("Esta seguro de que desea cerrar su sesion de administrador?")) {
        localStorage.removeItem("adminSession");
        window.location.reload();
    }
}

function getGroup() {
    const session = localStorage.getItem("adminSession");
    if (!session) return null;
    return JSON.parse(session).group || null;
}

function hasPermission(perm) {
    const group = getGroup();
    if (!group) return false;
    return group[perm] === true;
}

function updateSidebarUserInfo() {
    const admin = getAdmin();
    if (admin) {
        document.getElementById("topBarUserName").textContent = admin.username;
    }
}

function openChangePasswordModal() { document.getElementById("changePasswordModal").classList.remove("hidden"); document.getElementById("cpError").classList.add("hidden"); }
function closeChangePasswordModal() { document.getElementById("changePasswordModal").classList.add("hidden"); document.getElementById("changePasswordForm").reset(); document.getElementById("cpError").classList.add("hidden"); }

function applyPermissionVisibility() {
    document.querySelectorAll("[data-perm]").forEach(el => {
        const perm = el.getAttribute("data-perm");
        el.classList.toggle("hidden", !hasPermission(perm));
    });
}

function openAssetModal() { document.getElementById("assetModal").classList.remove("hidden"); }
function closeAssetModal() { document.getElementById("assetModal").classList.add("hidden"); document.getElementById("assetForm").reset(); }

function openPersonModal() { document.getElementById("personModal").classList.remove("hidden"); }
function closePersonModal() { document.getElementById("personModal").classList.add("hidden"); document.getElementById("personForm").reset(); }

function openSiteModal() { document.getElementById("siteModal").classList.remove("hidden"); }
function closeSiteModal() { document.getElementById("siteModal").classList.add("hidden"); document.getElementById("form_add_site").reset(); }

function openDepartmentModal() { document.getElementById("departmentModal").classList.remove("hidden"); }
function closeDepartmentModal() { document.getElementById("departmentModal").classList.add("hidden"); document.getElementById("form_add_department").reset(); }

function openCategoryModal() { document.getElementById("edit_cat_id").value = ""; document.getElementById("cat_name_input").value = ""; document.getElementById("categoryModalTitle").textContent = "Nueva Categoria"; document.getElementById("categoryModal").classList.remove("hidden"); }
function closeCategoryModal() { document.getElementById("categoryModal").classList.add("hidden"); document.getElementById("form_add_category").reset(); }

function openEditCategoryModal(id, name) { document.getElementById("edit_cat_id").value = id; document.getElementById("cat_name_input").value = name; document.getElementById("categoryModalTitle").textContent = "Editar Categoria"; document.getElementById("categoryModal").classList.remove("hidden"); }

async function deleteCategory(id, name) {
    if (!confirm('¿Eliminar la categoria "' + name + '"?')) return;
    try {
        const res = await api("/categories/" + id, { method: "DELETE" });
        if (res.ok) {             showToast("Categoria eliminada", "success"); loadCatalogs(); loadDropdownData(); }
        else { const err = await res.json().catch(()=>({detail:"Error"})); alert("Error: " + (err.detail || "No se pudo eliminar")); }
    } catch (e) { alert("Error de conexion"); }
}

function toggleCollapse(id) {
    const el = document.getElementById(id);
    const chevronId = id.replace("Submenu", "Chevron");
    const chevron = document.getElementById(chevronId);
    if (!el) return;
    const isOpening = el.classList.contains("hidden");
    if (isOpening) closeAllTopLevel(id);
    el.classList.toggle("hidden");
    if (chevron) chevron.classList.toggle("open");
}

function closeAllTopLevel(exceptId) {
    const groups = ["inventarioSubmenu","inactivosSubmenu","directorioSubmenu","adminSubmenu"];
    groups.forEach(gid => {
        if (gid === exceptId) return;
        const g = document.getElementById(gid);
        const gc = document.getElementById(gid.replace("Submenu","Chevron"));
        if (g) g.classList.add("hidden");
        if (gc) gc.classList.remove("open");
    });
}

function toggleNested(id) {
    const el = document.getElementById(id);
    const chevronId = id.replace("Submenu", "Chevron");
    const chevron = document.getElementById(chevronId);
    if (el) {
        el.classList.toggle("hidden");
        if (chevron) chevron.classList.toggle("open");
    }
}

function switchCatalogTab(tab) {
    showSection('catalogs');
    const ids = { sites: 'siteCount', categories: 'catCount', departments: 'deptCount' };
    const el = document.getElementById(ids[tab]);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function switchImportTab(tab) {
    ['import-tab-import','import-tab-export','import-tab-template'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById('import-tab-'+tab).classList.remove('hidden');
    ['import','export','template'].forEach(t => {
        const btn = document.getElementById(t+'-tab-btn');
        if (btn) {
            btn.classList.remove('bg-blue-600','text-white');
            btn.classList.add('bg-gray-100','text-gray-600');
        }
    });
    const activeBtn = document.getElementById(tab+'-tab-btn');
    if (activeBtn) {
        activeBtn.classList.remove('bg-gray-100','text-gray-600');
        activeBtn.classList.add('bg-blue-600','text-white');
    }
}

async function loadStatusReport() {
    var status = document.getElementById("sr_status").value;
    var tbody = document.getElementById("srResultsBody");
    if (!status) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-3 py-4 text-center text-gray-400 italic">Seleccione un status para generar el reporte.</td></tr>';
        document.getElementById("srCount").textContent = "0 Resultados";
        return;
    }
    tbody.innerHTML = '<tr><td colspan="7" class="px-3 py-4 text-center text-gray-400 italic">Cargando...</td></tr>';
    try {
        var res = await api("/assets/?status=" + encodeURIComponent(status) + "&limit=5000");
        if (!res.ok) throw new Error("Error");
        var assets = await res.json();
        document.getElementById("srCount").textContent = assets.length + " Resultados";
        tbody.innerHTML = "";
        if (assets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-3 py-4 text-center text-gray-400 italic">Sin activos con este status.</td></tr>';
            return;
        }
        currentSrResults = assets;
        var siteName = function (sid) { var s = globalSites.find(function (x) { return x.id === sid; }); return s ? s.site_name : ""; };
        assets.forEach(function (a) {
            var row = document.createElement("tr");
            row.className = "hover:bg-blue-50/50 transition-colors cursor-pointer";
            row.onclick = function () { openDetailsModal(a.id); };
            var badge = "bg-green-100 text-green-800";
            if (a.status === "Checkout") badge = "bg-blue-100 text-blue-800";
            else if (["Broken", "Lost/Missing", "Dispose"].includes(a.status)) badge = "bg-red-100 text-red-800";
            else if (a.status === "Under repair" || a.status === "GarantiaSD") badge = "bg-amber-100 text-amber-800";
            else if (a.status === "Reserved") badge = "bg-purple-100 text-purple-800";
            else if (a.status === "Archived") badge = "bg-gray-200 text-gray-700";
            else if (a.status === "Sold") badge = "bg-yellow-100 text-yellow-800";
            row.innerHTML =
                '<td class="px-3 py-2 font-mono font-bold text-blue-600">' + a.asset_tag_id + '</td>' +
                '<td class="px-3 py-2">' + (a.asset_description || "") + '</td>' +
                '<td class="px-3 py-2">' + (a.brand || "") + " " + (a.model || "") + '</td>' +
                '<td class="px-3 py-2 font-mono text-gray-500">' + (a.serial_no || "") + '</td>' +
                '<td class="px-3 py-2 text-gray-500">' + (a.category || "") + '</td>' +
                '<td class="px-3 py-2 text-gray-500">' + siteName(a.site_id) + '</td>' +
                '<td class="px-3 py-2"><span class="px-2 py-0.5 inline-flex text-[10px] leading-5 font-semibold rounded-full ' + badge + '">' + a.status + '</span></td>';
            tbody.appendChild(row);
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-3 py-4 text-center text-red-500 font-medium">Error de conexion</td></tr>';
    }
}

function showSection(name) {
    const panel = document.getElementById("advancedSearchPanel");
    if (panel) panel.classList.add("hidden");
    const sections = ['dashboard', 'assets', 'employees', 'catalogs', 'history', 'reports', 'checkoutTimeframe', 'statusReports', 'deptReport', 'customReports', 'deliveryBoard', 'deliveryEmployees', 'deliveryAdd', 'users', 'enReparacion', 'listadoInactivos', 'brokenAssets', 'lostAssets', 'disposedAssets', 'donateAssets', 'soldAssets', 'importExport', 'employeeReconciliation', 'assetDetail'];
    sections.forEach(s => {
        const el = document.getElementById(s + 'Section');
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(name + 'Section');
    if (target) target.classList.remove('hidden');
    if (name !== 'assetDetail') { window.location.hash = ""; }
    if (name === 'employees' && typeof loadPersons === 'function') loadPersons();
    if (name === 'catalogs' && typeof loadCatalogs === 'function') loadCatalogs();
    if (name === 'history' && typeof loadHistory === 'function') loadHistory();
    if (name === 'assets' && typeof loadAssets === 'function') loadAssets();
    if (name === 'dashboard') updateDashboard();
    if (name === 'reports') { document.getElementById("report_person_search").value = ""; document.getElementById("report_person_id").value = ""; document.getElementById("reportPersonInfo").classList.add("hidden"); document.getElementById("reportCount").textContent = "0 Resultados"; document.getElementById("reportResultsBody").innerHTML = '<tr><td colspan="10" class="px-3 py-4 text-center text-gray-400 italic">Seleccione un empleado y genere el reporte.</td></tr>'; }
    if (name === 'checkoutTimeframe') { var d = new Date(); document.getElementById("ctf_end").value = d.toISOString().split("T")[0]; d.setDate(d.getDate() - 30); document.getElementById("ctf_start").value = d.toISOString().split("T")[0]; }
    if (name === 'deliveryBoard') loadDeliveryBoard();
    if (name === 'deliveryEmployees') loadDeliveryEmployees();
    if (name === 'deliveryAdd') { document.getElementById("delivery_person_search").value = ""; document.getElementById("delivery_person_id").value = ""; document.getElementById("delivery_person_results").classList.add("hidden"); document.querySelectorAll('.delivery-cat-qty').forEach(function (q) { q.disabled = true; }); }
    if (name === 'users') { loadUsers(); loadGroups(); }
    if (name === 'brokenAssets') loadAssetsByStatus('Broken');
    if (name === 'lostAssets') loadAssetsByStatus('Lost');
    if (name === 'disposedAssets') loadAssetsByStatus('Disposed');
    if (name === 'donateAssets') loadAssetsByStatus('Donate');
    if (name === 'soldAssets') loadAssetsByStatus('Sold');
    if (name === 'listadoInactivos') loadListadoInactivos();
    if (name === 'enReparacion') loadRepairAssets();
    if (name === 'importExport') { switchImportTab('import'); }
    if (name === 'employeeReconciliation') { showReconciliationView(); }
    if (name === 'deptReport') loadDepartmentReport();
    if (name === 'customReports') { crLoadFields(); crLoadFilterDropdowns(); crLoadSavedList(); }
    document.getElementById("mainContent").scrollTo({ top: 0, behavior: "smooth" });
    // highlight active sidebar item
    document.querySelectorAll('.sidebar-item[data-section], .sidebar-sub-item[data-section], .sidebar-nested-item[data-section]').forEach(el => el.classList.remove('active'));
    const active = document.querySelector(`.sidebar-item[data-section="${name}"]`) || document.querySelector(`.sidebar-sub-item[data-section="${name}"]`) || document.querySelector(`.sidebar-nested-item[data-section="${name}"]`);
    if (active) active.classList.add('active');
}

function showAdvancedSearch() {
    const sections = ['dashboard', 'assets', 'employees', 'catalogs', 'history', 'reports', 'checkoutTimeframe', 'statusReports', 'deptReport', 'customReports', 'deliveryBoard', 'deliveryEmployees', 'deliveryAdd', 'users', 'enReparacion', 'listadoInactivos', 'brokenAssets', 'lostAssets', 'disposedAssets', 'donateAssets', 'soldAssets', 'importExport', 'employeeReconciliation'];
    sections.forEach(s => {
        const el = document.getElementById(s + 'Section');
        if (el) el.classList.add('hidden');
    });
    document.getElementById("assetsSection").classList.remove("hidden");
    document.getElementById("advancedSearchPanel").classList.remove("hidden");
    populateAdvancedSearchDropdowns();
    document.getElementById("mainContent").scrollTo({ top: 0, behavior: "smooth" });
}

function populateAdvancedSearchDropdowns() {
    const siteSel = document.getElementById("adv_site");
    const catSel = document.getElementById("adv_category");
    const deptSel = document.getElementById("adv_department");
    siteSel.innerHTML = '<option value="">Todos los Sitios</option>';
    globalSites.forEach(s => { siteSel.innerHTML += `<option value="${s.id}">${s.site_name}</option>`; });
    catSel.innerHTML = '<option value="">Todas las Categorias</option>';
    const cats = [...new Set(currentAssets.filter(a => a.category).map(a => a.category))];
    cats.forEach(c => { catSel.innerHTML += `<option value="${c}">${c}</option>`; });
    deptSel.innerHTML = '<option value="">Todos los Departamentos</option>';
    globalDepartments.forEach(d => { deptSel.innerHTML += `<option value="${d.id}">${d.department_name}</option>`; });
}

// Top bar search
function executeTopSearch() {
    const keyword = document.getElementById("topSearchInput").value.trim();
    const section = document.getElementById("topSearchSection").value;
    if (!keyword) { showToast("Escribe una palabra clave para buscar", "warning"); return; }

    const sections = ['dashboard', 'assets', 'employees', 'catalogs', 'history', 'reports', 'checkoutTimeframe', 'statusReports', 'deptReport', 'customReports', 'deliveryBoard', 'deliveryEmployees', 'deliveryAdd', 'users', 'enReparacion', 'listadoInactivos', 'brokenAssets', 'lostAssets', 'disposedAssets', 'donateAssets', 'soldAssets', 'importExport', 'employeeReconciliation'];
    sections.forEach(s => {
        const el = document.getElementById(s + 'Section');
        if (el) el.classList.add('hidden');
    });
    document.getElementById("searchResultsSection").classList.remove("hidden");
    document.querySelectorAll('.sidebar-item.active, .sidebar-sub-item.active, .sidebar-nested-item.active').forEach(el => el.classList.remove('active'));
    document.getElementById("mainContent").scrollTo({ top: 0, behavior: "smooth" });

    const title = document.getElementById("searchResultsTitle");
    const body = document.getElementById("searchResultsBody");
    title.textContent = `Resultados para "${keyword}" en ${section === "assets" ? "Activos" : "Empleados"}`;
    body.innerHTML = '<p class="text-gray-400 italic text-center py-8">Buscando...</p>';

    if (section === "assets") {
        api("/assets/?search=" + encodeURIComponent(keyword)).then(res => res.json()).then(data => {
            if (!data || !data.length) {
                body.innerHTML = '<p class="text-gray-400 italic text-center py-8">No se encontraron resultados.</p>';
                return;
            }
            let html = '<div class="text-xs text-gray-500 mb-3 font-bold">' + data.length + ' resultado(s) encontrado(s)</div>';
            html += '<div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr>';
            html += '<th class="text-left py-2 px-3">Asset Tag</th><th class="text-left py-2 px-3">Serial</th><th class="text-left py-2 px-3">Marca</th><th class="text-left py-2 px-3">Modelo</th><th class="text-left py-2 px-3">Descripcion</th><th class="text-left py-2 px-3">Status</th><th class="text-left py-2 px-3">Categoria</th><th class="text-left py-2 px-3"></th>';
            html += '</tr></thead><tbody>';
            data.forEach(a => {
                html += '<tr class="border-b border-gray-100 hover:bg-gray-50">';
                html += '<td class="py-2 px-3 font-medium">' + escapeHtml(a.asset_tag_id) + '</td>';
                html += '<td class="py-2 px-3 text-gray-600">' + escapeHtml(a.serial_no || '-') + '</td>';
                html += '<td class="py-2 px-3">' + escapeHtml(a.brand || '-') + '</td>';
                html += '<td class="py-2 px-3">' + escapeHtml(a.model || '-') + '</td>';
                html += '<td class="py-2 px-3 text-gray-600 max-w-[200px] truncate">' + escapeHtml(a.asset_description || '-') + '</td>';
                html += '<td class="py-2 px-3"><span class="badge-dot" style="background:' + (a.status === 'Checkout' ? '#3b82f6' : a.status === 'Available' ? '#10b981' : a.status === 'Under repair' || a.status === 'GarantiaSD' ? '#f59e0b' : '#6b7280') + '"></span>' + escapeHtml(a.status) + '</td>';
                html += '<td class="py-2 px-3 text-gray-600">' + escapeHtml(a.category || '-') + '</td>';
                html += '<td class="py-2 px-3"><button onclick="openDetailsModal(' + a.id + ')" class="text-blue-600 hover:text-blue-800 font-bold cursor-pointer">Ver</button></td>';
                html += '</tr>';
            });
            html += '</tbody></table></div>';
            body.innerHTML = html;
        }).catch(() => {
            body.innerHTML = '<p class="text-red-500 text-center py-8">Error al buscar.</p>';
        });
    } else {
        api("/persons/?search=" + encodeURIComponent(keyword)).then(res => res.json()).then(data => {
            if (!data || !data.length) {
                body.innerHTML = '<p class="text-gray-400 italic text-center py-8">No se encontraron resultados.</p>';
                return;
            }
            let html = '<div class="text-xs text-gray-500 mb-3 font-bold">' + data.length + ' resultado(s) encontrado(s)</div>';
            html += '<div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr>';
            html += '<th class="text-left py-2 px-3">Nombre</th><th class="text-left py-2 px-3">Email</th><th class="text-left py-2 px-3">Employee ID</th><th class="text-left py-2 px-3">Telefono</th><th class="text-left py-2 px-3"></th>';
            html += '</tr></thead><tbody>';
            data.forEach(p => {
                html += '<tr class="border-b border-gray-100 hover:bg-gray-50">';
                html += '<td class="py-2 px-3 font-medium">' + escapeHtml(p.full_name) + '</td>';
                html += '<td class="py-2 px-3 text-gray-600">' + escapeHtml(p.email || '-') + '</td>';
                html += '<td class="py-2 px-3">' + escapeHtml(p.employee_id || '-') + '</td>';
                html += '<td class="py-2 px-3">' + escapeHtml(p.phone || '-') + '</td>';
                html += '<td class="py-2 px-3"><button onclick="openEditPersonModal(' + p.id + ')" class="text-blue-600 hover:text-blue-800 font-bold cursor-pointer">Ver</button></td>';
                html += '</tr>';
            });
            html += '</tbody></table></div>';
            body.innerHTML = html;
        }).catch(() => {
            body.innerHTML = '<p class="text-red-500 text-center py-8">Error al buscar.</p>';
        });
    }
}

document.addEventListener("DOMContentLoaded", function() {
    const topInput = document.getElementById("topSearchInput");
    if (topInput) {
        topInput.addEventListener("keydown", function(e) {
            if (e.key === "Enter") executeTopSearch();
        });
    }
});

function checkAllFields(select) {
    document.querySelectorAll("#adv_field_checkboxes input[type=checkbox]").forEach(cb => { cb.checked = select; });
}

function applyQuickDateRange() {
    const val = document.getElementById("adv_quickdate").value;
    if (!val) return;
    const now = new Date();
    const fmt = d => {
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };
    let from, to;
    to = now;
    switch (val) {
        case "today": from = now; break;
        case "7days": from = new Date(now); from.setDate(from.getDate() - 7); break;
        case "30days": from = new Date(now); from.setDate(from.getDate() - 30); break;
        case "this_month": from = new Date(now.getFullYear(), now.getMonth(), 1); break;
        case "last_month": from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0); break;
        case "this_year": from = new Date(now.getFullYear(), 0, 1); break;
    }
    document.getElementById("adv_daterange").value = `${fmt(from)} - ${fmt(to)}`;
}

async function executeAdvancedSearch() {
    const params = new URLSearchParams();
    const search = document.getElementById("adv_search").value;
    const condition = document.getElementById("adv_condition").value;
    const site = document.getElementById("adv_site").value;
    const category = document.getElementById("adv_category").value;
    const department = document.getElementById("adv_department").value;
    const status = document.getElementById("adv_status").value;
    const person = document.getElementById("adv_person_id").value;
    const vendor = document.getElementById("adv_vendor").value;
    const limit = document.getElementById("adv_limit").value;
    const dateField = document.getElementById("adv_datefield").value;
    const dateRange = document.getElementById("adv_daterange").value;
    if (search) {
        params.set("search", search);
        params.set("search_condition", condition);
        document.querySelectorAll("#adv_field_checkboxes input[type=checkbox]:checked").forEach(cb => {
            params.append("search_fields", cb.value);
        });
    }
    if (site) params.set("site_id", site);
    if (category) params.set("category", category);
    if (department) params.set("department_id", department);
    if (status) params.set("status", status);
    if (person) params.set("person_id", person);
    if (vendor) params.set("purchased_from", vendor);
    params.set("limit", limit);
    if (dateField) params.set("date_field", dateField);
    if (dateRange) {
        const parts = dateRange.split(" - ");
        if (parts.length === 2) {
            const parseDate = s => { const p = s.split("/"); return `${p[2]}-${p[1]}-${p[0]}`; };
            params.set("date_from", parseDate(parts[0]));
            params.set("date_to", parseDate(parts[1]));
        }
    }
    document.querySelectorAll("#assetsSection thead tr th").forEach(th => th.classList.remove("sort-asc", "sort-desc"));
    const tableBody = document.getElementById("assetsTableBody");
    const pageInfo = document.getElementById("assetsPageInfo");
    tableBody.innerHTML = '<tr><td colspan="12" class="px-4 py-6 text-center text-gray-400 italic">Buscando...</td></tr>';
    try {
        const response = await api(`/assets/?${params.toString()}`);
        if (!response.ok) throw new Error("Error en el servidor");
        currentAssets = await response.json();
        assetSort.original = [...currentAssets];
        assetSort.key = null;
        assetSort.dir = null;
        assetSort.exclude = ["Archived"];
        currentAssetPage = 1;
        const pageInfoAux = document.getElementById("assetsPageInfoAux");
        if (pageInfoAux) pageInfoAux.textContent = "Pagina 1";
        tableBody.innerHTML = "";
        const activeAssets = currentAssets.filter(a => !assetSort.exclude.includes(a.status));
        if (activeAssets.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="12" class="px-4 py-6 text-center text-gray-400 italic">Sin resultados para esta busqueda.</td></tr>';
            pageInfo.textContent = "mostrando 0-0 de 0";
            return;
        }
        totalAssets = activeAssets.length;
        const start = 1;
        const end = activeAssets.length;
        pageInfo.textContent = `mostrando ${start}-${end} de ${totalAssets}`;
        renderAssetTable(activeAssets, tableBody, 'search');
    } catch (e) {
        tableBody.innerHTML = '<tr><td colspan="12" class="px-4 py-6 text-center text-red-500 font-medium">Error de conexion</td></tr>';
    }
}

function cancelAdvancedSearch() {
    document.getElementById("advancedSearchPanel").classList.add("hidden");
    document.getElementById("adv_search").value = "";
    document.getElementById("adv_condition").value = "contains";
    checkAllFields(true);
    document.getElementById("adv_site").value = "";
    document.getElementById("adv_category").value = "";
    document.getElementById("adv_department").value = "";
    document.getElementById("adv_status").value = "";
    document.getElementById("adv_person_search").value = "";
    document.getElementById("adv_person_id").value = "";
    document.getElementById("adv_vendor").value = "";
    document.getElementById("adv_limit").value = "250";
    document.getElementById("adv_datefield").value = "purchase_date";
    document.getElementById("adv_quickdate").value = "";
    document.getElementById("adv_daterange").value = "";
    loadAssets();
}

function renderDashBars(assets) {
    var statusLabels = {
        "Available": "Disponible", "Checkout": "Asignado",
        "Under repair": "En Reparacion", "GarantiaSD": "Garantia",
        "Archived": "Archivado", "Broken": "Danado", "Lost": "Perdido",
        "Disposed": "Desechado", "Donate": "Donado", "Sold": "Vendido"
    };
    var statusColors = {
        "Available": "#22c55e", "Checkout": "#f59e0b",
        "Under repair": "#f97316", "GarantiaSD": "#a855f7",
        "Archived": "#6b7280", "Broken": "#ef4444", "Lost": "#dc2626",
        "Disposed": "#6b7280", "Donate": "#3b82f6", "Sold": "#8b5cf6"
    };
    var statusCounts = {};
    assets.forEach(function(a) {
        var label = statusLabels[a.status] || a.status;
        statusCounts[label] = (statusCounts[label] || 0) + 1;
    });
    var sEntries = Object.entries(statusCounts).sort(function(a, b) { return b[1] - a[1]; });
    var maxStatus = sEntries.length ? sEntries[0][1] : 1;

    var statusContainer = document.getElementById("dashStatusBars");
    if (statusContainer) {
        statusContainer.innerHTML = "";
        sEntries.forEach(function(e) {
            var label = e[0], count = e[1];
            var origKey = Object.keys(statusLabels).find(function(k) { return statusLabels[k] === label; }) || label;
            var color = statusColors[origKey] || "#6b7280";
            var pct = (count / maxStatus * 100).toFixed(0);
            var row = document.createElement("div");
            row.className = "dash-bar-row";
            row.innerHTML = '<span class="dash-bar-label">' + label + '</span><div class="dash-bar-track"><div class="dash-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div><span class="dash-bar-count">' + count + '</span><span class="dash-bar-percent">' + pct + '%</span>';
            statusContainer.appendChild(row);
        });
        if (!sEntries.length) statusContainer.innerHTML = '<div class="text-gray-400 text-xs text-center py-4">Sin datos</div>';
    }

    var catCounts = {};
    assets.forEach(function(a) { if (a.category) catCounts[a.category] = (catCounts[a.category] || 0) + 1; });
    var sortedCats = Object.entries(catCounts).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10);
    var maxCat = sortedCats.length ? sortedCats[0][1] : 1;
    var palette = ["#3b82f6","#8b5cf6","#ec4899","#f97316","#22c55e","#06b6d4","#eab308","#ef4444","#14b8a6","#6366f1"];

    var catContainer = document.getElementById("dashCategoryBars");
    if (catContainer) {
        catContainer.innerHTML = "";
        sortedCats.forEach(function(e, i) {
            var label = e[0], count = e[1];
            var pct = (count / maxCat * 100).toFixed(0);
            var row = document.createElement("div");
            row.className = "dash-bar-row";
            row.innerHTML = '<span class="dash-bar-label">' + label + '</span><div class="dash-bar-track"><div class="dash-bar-fill" style="width:' + pct + '%;background:' + palette[i % palette.length] + '"></div></div><span class="dash-bar-count">' + count + '</span><span class="dash-bar-percent">' + pct + '%</span>';
            catContainer.appendChild(row);
        });
        if (!sortedCats.length) catContainer.innerHTML = '<div class="text-gray-400 text-xs text-center py-4">Sin datos</div>';
    }
}

async function updateDashboard() {
    try {
        var resAssets = await api("/assets/?limit=9999");
        var resPersons = await api("/persons/");
        var resHistory = await api("/history/");
        var resDeliveries = await api("/deliveries/pending");
        if (resAssets.ok) {
            var assets = await resAssets.json();
            var active = assets.filter(function(a) { return !["Archived","Broken","Lost","Disposed","Donate","Sold"].includes(a.status); });
            document.getElementById("dashAssetCount").textContent = active.length;
            document.getElementById("dashCheckoutCount").textContent = active.filter(function(a) { return a.status === "Checkout"; }).length;
            document.getElementById("dashCheckinCount").textContent = active.filter(function(a) { return a.status === "Available"; }).length;
            var repairCount = active.filter(function(a) { return a.status === "Under repair" || a.status === "GarantiaSD"; }).length;
            document.getElementById("dashRepairCount").textContent = repairCount;
            var cats = {};
            active.forEach(function(a) { if (a.category) cats[a.category] = (cats[a.category] || 0) + 1; });
            var catKeys = Object.keys(cats);
            document.getElementById("dashCategoryCount").textContent = catKeys.length;
            var catBody = document.getElementById("dashCategoryBody");
            catBody.innerHTML = "";
            catKeys.sort().forEach(function(c) {
                var row = document.createElement("tr");
                row.className = "border-b border-gray-100 hover:bg-gray-100 cursor-pointer";
                row.onclick = function() { goToAssetsFiltered("category", c); };
                row.innerHTML = '<td class="py-1.5 px-2 text-gray-700">' + c + '</td><td class="py-1.5 px-2 text-gray-700 text-right font-bold">' + cats[c] + '</td>';
                catBody.appendChild(row);
            });
            renderDashBars(assets);
            // stagger entrance for dashboard cards
            document.querySelectorAll('.dash-card').forEach(function(c, i) {
                c.style.animationDelay = (i * 0.05) + 's';
            });
        }
        if (resPersons.ok) {
            var persons = await resPersons.json();
            document.getElementById("dashPersonCount").textContent = persons.length;
        }
        if (resHistory.ok) {
            var history = await resHistory.json();
            var recent = history.slice(-10).reverse();
            var tbody = document.getElementById("dashRecentActivity");
            tbody.innerHTML = "";
            if (recent.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="py-3 text-center text-gray-400 italic">Sin actividad.</td></tr>';
            } else {
                recent.forEach(function(item) {
                    var row = document.createElement("tr");
                    row.className = "hover:bg-gray-50 cursor-pointer";
                    row.onclick = function() { showSection("history"); };
                    var fecha = new Date(item.fecha_accion).toLocaleString("es-ES");
                    var assetObj = item.asset_id ? (typeof currentAssets !== "undefined" ? currentAssets : []).find(function(a) { return a.id === item.asset_id; }) : null;
                    var employeeObj = (typeof globalPersons !== "undefined" ? globalPersons : []).find(function(p) { return p.id === item.asignado_a_id; });
                    var badge = "text-blue-600 font-bold";
                    if (item.tipo_accion === "Check in") badge = "text-amber-600 font-bold";
                    if (item.tipo_accion === "Archived") badge = "text-red-600 font-bold";
                    var assetDisplay = item.asset_id ? (assetObj ? assetObj.asset_tag_id : "ID: " + item.asset_id) : '<span class="text-gray-400 italic">N/A</span>';
                    row.innerHTML = '<td class="py-2 px-3 text-gray-500 whitespace-nowrap">' + fecha + '</td><td class="py-2 px-3 uppercase ' + badge + '">' + item.tipo_accion + '</td><td class="py-2 px-3 font-bold text-gray-700">' + assetDisplay + '</td><td class="py-2 px-3 text-gray-600">' + (employeeObj ? employeeObj.full_name : (item.asignado_a_id ? "ID: " + item.asignado_a_id : "Almacen")) + '</td>';
                    tbody.appendChild(row);
                });
            }
        }
        if (resDeliveries.ok) {
            var deliveries = await resDeliveries.json();
            var activePendings = deliveries.filter(function(d) { return d.status === "Active"; });
            document.getElementById("dashPendingCount").textContent = activePendings.length;
        }
    } catch (e) { console.error(e); }
}

function goToAssetsFiltered(filterKey, filterValue) {
    showSection('assets');
    currentAssetPage = 1;
    var statusSel = document.getElementById("filterStatus");
    var catSel = document.getElementById("filterCategory");
    if (filterKey === 'status' && statusSel) {
        if (filterValue.indexOf(",") !== -1) {
            statusSel.value = "";
            document.getElementById("assetsTableBody").dataset.statusFilter = filterValue;
        } else {
            statusSel.value = filterValue;
            delete document.getElementById("assetsTableBody").dataset.statusFilter;
        }
    }
    if (filterKey === 'category' && catSel) {
        catSel.value = filterValue;
    }
    loadAssets();
}

function toggleDashCategoryBreakdown() {
    document.getElementById("dashCategoryBreakdown").classList.toggle("hidden");
}

async function exportEntity(entity) {
    if (!getToken()) { alert("Debe iniciar sesion"); return; }
    const url = `/export/${entity}/`;
    try {
        const res = await api(url);
        if (!res.ok) { const e = await res.json().catch(()=>({})); alert("Error al exportar: " + (e.detail||"Error")); return; }
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const names = { assets:"activos", persons:"empleados", sites:"sitios" };
        a.download = names[entity]||entity+".xlsx";
        a.click();
        URL.revokeObjectURL(a.href);
    } catch(e) { alert("Error de conexion al exportar"); }
}

async function downloadTemplate(entity) {
    if (!getToken()) { alert("Debe iniciar sesion"); return; }
    const url = `/export/${entity}/template/`;
    try {
        const res = await api(url);
        if (!res.ok) { const e = await res.json().catch(()=>({})); alert("Error al descargar plantilla: " + (e.detail||"Error")); return; }
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const names = { assets:"plantilla_activos", persons:"plantilla_empleados", sites:"plantilla_sitios" };
        a.download = names[entity]||entity+"_template.xlsx";
        a.click();
        URL.revokeObjectURL(a.href);
    } catch(e) { alert("Error de conexion al descargar plantilla"); }
}

function setupImportFormListener() {
    document.getElementById("importForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const entity = document.getElementById("importEntity").value;
        const fileInput = document.getElementById("importFile");
        const resultDiv = document.getElementById("importResult");
        if (!entity) { alert("Seleccione el tipo de datos a importar"); return; }
        if (!fileInput.files.length) { alert("Seleccione un archivo Excel"); return; }

        const formData = new FormData();
        formData.append("file", fileInput.files[0]);

        try {
            const res = await api(`/import/${entity}/`, { method: "POST", body: formData });
            if (res.ok) {
                const data = await res.json();
                resultDiv.className = "mt-3 p-3 rounded text-xs font-bold bg-green-100 text-green-800";
                resultDiv.textContent = data.importados + " registros importados correctamente.";
                resultDiv.classList.remove("hidden");
                fileInput.value = "";
                loadDropdownData();
                loadAssets();
            } else {
                const err = await res.json().catch(()=>({detail:"Error desconocido"}));
                resultDiv.className = "mt-3 p-3 rounded text-xs font-bold bg-red-100 text-red-800";
                resultDiv.textContent = "Error: " + (err.detail || "No se pudo importar");
                resultDiv.classList.remove("hidden");
            }
        } catch(e) {
            resultDiv.className = "mt-3 p-3 rounded text-xs font-bold bg-red-100 text-red-800";
            resultDiv.textContent = "Error de conexion: " + e.message;
            resultDiv.classList.remove("hidden");
        }
    });
}

function updatePersonInfo() {
    const personId = document.getElementById("report_person_id").value;
    const info = document.getElementById("reportPersonInfo");
    if (!personId) { info.classList.add("hidden"); info.innerHTML = ""; return; }
    const p = globalPersons.find(x => x.id === parseInt(personId));
    if (!p) { info.classList.add("hidden"); return; }
    const dept = globalDepartments.find(d => d.id === p.department_id);
    const site = globalSites.find(s => s.id === p.site_id);
    info.innerHTML = `
        <span class="font-bold text-gray-800 truncate">${p.full_name}</span>
        <span class="text-gray-300 shrink-0">|</span>
        <span class="text-gray-500 shrink-0">${dept ? dept.department_name : '-'}</span>
        <span class="text-gray-300 shrink-0">|</span>
        <span class="text-gray-500 shrink-0">${site ? site.site_name : '-'}</span>
        <span class="text-gray-300 shrink-0">|</span>
        <span class="text-blue-600 truncate">${p.email || ''}</span>
        <span class="text-gray-300 shrink-0">|</span>
        <span class="text-gray-500 shrink-0">${p.phone || '-'}</span>
    `;
    info.classList.remove("hidden");
}

async function loadCheckoutReport() {
    const personId = document.getElementById("report_person_id").value;
    const mode = document.getElementById("report_mode").value;
    const tbody = document.getElementById("reportResultsBody");
    if (!personId) { tbody.innerHTML = '<tr><td colspan="10" class="px-3 py-4 text-center text-amber-600 font-medium">Seleccione un empleado primero.</td></tr>'; return; }
    tbody.innerHTML = '<tr><td colspan="10" class="px-3 py-4 text-center text-gray-400 italic">Cargando...</td></tr>';
    try {
        const res = await api(`/reports/person-checkouts/${personId}?mode=${mode}`);
        if (!res.ok) throw new Error("Error en el servidor");
        const data = await res.json();
        document.getElementById("reportCount").textContent = data.length + " Resultados";
        tbody.innerHTML = "";
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="px-3 py-4 text-center text-gray-400 italic">Sin resultados para este empleado.</td></tr>';
            return;
        }
        currentReportResults = data;
        data.forEach(item => {
            const row = document.createElement("tr");
            row.className = "hover:bg-blue-50/50 transition-colors cursor-pointer";
            row.onclick = () => openAssetModalById(item.asset_id);
            let badge = "bg-green-100 text-green-800";
            if (item.status === "Checkout") badge = "bg-blue-100 text-blue-800";
            row.innerHTML = `
                <td class="px-3 py-2 font-mono font-bold text-blue-600 hover:text-blue-800">${item.asset_tag_id}</td>
                <td class="px-3 py-2">${item.asset_description}</td>
                <td class="px-3 py-2">${item.brand} ${item.model}</td>
                <td class="px-3 py-2 font-mono">${item.serial_no}</td>
                <td class="px-3 py-2">${item.category}</td>
                <td data-col="site" class="px-3 py-2">${item.site_name}</td>
                <td data-col="assigned" class="px-3 py-2 text-gray-500 text-[10px]">${item.assigned_date ? new Date(item.assigned_date).toLocaleDateString('es-ES') : '-'}</td>
                <td data-col="returned" class="px-3 py-2 text-gray-500 text-[10px]">${item.returned_date ? new Date(item.returned_date).toLocaleDateString('es-ES') : '-'}</td>
                <td data-col="status" class="px-3 py-2"><span class="px-2 py-0.5 inline-flex text-[10px] leading-5 font-semibold rounded-full ${badge}">${item.status}</span></td>
                <td data-col="actions" class="px-3 py-2"><button onclick="event.stopPropagation(); openAssetModalById(${item.asset_id})" class="text-[10px] font-bold text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-300 px-2 py-1 rounded transition-colors cursor-pointer">Ver</button></td>`;
            tbody.appendChild(row);
        });
        applyColumnPreferences();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="10" class="px-3 py-4 text-center text-red-500 font-medium">Error de conexion con el servidor backend</td></tr>';
    }
}

async function loadCheckoutTimeframeReport() {
    const start = document.getElementById("ctf_start").value;
    const end = document.getElementById("ctf_end").value;
    const tbody = document.getElementById("ctfResultsBody");
    if (!start || !end) { tbody.innerHTML = '<tr><td colspan="9" class="px-3 py-4 text-center text-amber-600 font-medium">Seleccione fecha de inicio y fin.</td></tr>'; return; }
    tbody.innerHTML = '<tr><td colspan="9" class="px-3 py-4 text-center text-gray-400 italic">Cargando...</td></tr>';
    try {
        const res = await api("/reports/checkout-timeframe/?start=" + encodeURIComponent(start) + "&end=" + encodeURIComponent(end));
        if (!res.ok) throw new Error("Error en el servidor");
        const data = await res.json();
        document.getElementById("ctfCount").textContent = data.length + " Resultados";
        tbody.innerHTML = "";
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="px-3 py-4 text-center text-gray-400 italic">Sin resultados en este rango de fechas.</td></tr>';
            return;
        }
        currentCtfResults = data;
        data.forEach(function (item) {
            var row = document.createElement("tr");
            row.className = "hover:bg-blue-50/50 transition-colors cursor-pointer";
            row.onclick = function () { openAssetModalById(item.asset_id); };
            var badge = "bg-green-100 text-green-800";
            if (item.current_status === "Checkout") badge = "bg-blue-100 text-blue-800";
            if (item.current_status === "Broken" || item.current_status === "Lost/Missing") badge = "bg-red-100 text-red-800";
            if (item.current_status === "Under repair" || item.current_status === "GarantiaSD") badge = "bg-amber-100 text-amber-800";
            row.innerHTML =
                '<td class="px-3 py-2 font-mono font-bold text-blue-600">' + item.asset_tag_id + '</td>' +
                '<td class="px-3 py-2">' + item.asset_description + '</td>' +
                '<td class="px-3 py-2">' + item.brand + " " + item.model + '</td>' +
                '<td class="px-3 py-2 font-mono">' + item.serial_no + '</td>' +
                '<td class="px-3 py-2">' + item.category + '</td>' +
                '<td class="px-3 py-2">' + item.employee_name + ' <span class="text-gray-400 text-[10px]">(' + item.employee_id + ')</span></td>' +
                '<td class="px-3 py-2 text-gray-500">' + item.admin_name + '</td>' +
                '<td class="px-3 py-2 text-gray-500 text-[10px]">' + new Date(item.checkout_date).toLocaleDateString("es-ES", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) + '</td>' +
                '<td class="px-3 py-2"><span class="px-2 py-0.5 inline-flex text-[10px] leading-5 font-semibold rounded-full ' + badge + '">' + item.current_status + '</span></td>';
            tbody.appendChild(row);
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="9" class="px-3 py-4 text-center text-red-500 font-medium">Error de conexion con el servidor backend</td></tr>';
    }
}

async function loadDepartmentReport() {
    var tbody = document.getElementById("deptReportBody");
    tbody.innerHTML = '<tr><td colspan="4" class="px-3 py-4 text-center text-gray-400 italic">Cargando...</td></tr>';
    try {
        var res = await api("/reports/department-summary/");
        if (!res.ok) throw new Error("Error del servidor");
        var data = await res.json();
        document.getElementById("deptReportCount").textContent = data.length + " Departamentos";
        currentDeptSummary = data;
        tbody.innerHTML = "";
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-3 py-4 text-center text-gray-400 italic">No hay departamentos registrados.</td></tr>';
            return;
        }
        data.forEach(function(d) {
            var row = document.createElement("tr");
            row.className = "hover:bg-gray-50 transition-colors";
            row.id = "deptRow-" + d.dept_id;
            var assignedBadge = d.assigned_assets > 0 ? "font-bold text-blue-700" : "text-gray-500";
            row.innerHTML =
                '<td class="px-3 py-2 font-semibold text-gray-800">' + escapeHtml(d.dept_name) + '</td>' +
                '<td class="px-3 py-2">' + d.employee_count + '</td>' +
                '<td class="px-3 py-2 ' + assignedBadge + '">' + d.assigned_assets + '</td>' +
                '<td class="px-3 py-2 text-center"><button onclick="toggleDeptAssets(' + d.dept_id + ')" class="text-[11px] bg-blue-100 hover:bg-blue-200 border border-blue-300 px-2.5 py-1 rounded font-bold text-blue-700 transition-colors cursor-pointer">Detalle</button></td>';
            tbody.appendChild(row);
            // hidden detail row
            var detailRow = document.createElement("tr");
            detailRow.id = "deptDetail-" + d.dept_id;
            detailRow.className = "hidden";
            detailRow.innerHTML = '<td colspan="4" class="px-3 py-0"><div id="deptAssets-' + d.dept_id + '" class="py-2"><div class="text-center text-gray-400 italic text-xs py-3">Cargando activos...</div></div></td>';
            tbody.appendChild(detailRow);
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-3 py-4 text-center text-red-500 font-medium">Error de conexion con el servidor</td></tr>';
    }
}

async function toggleDeptAssets(deptId) {
    var detailRow = document.getElementById("deptDetail-" + deptId);
    var container = document.getElementById("deptAssets-" + deptId);
    if (!detailRow || !container) return;
    if (!detailRow.classList.contains("hidden")) {
        detailRow.classList.add("hidden");
        return;
    }
    detailRow.classList.remove("hidden");
    if (currentDeptAssets[deptId]) {
        renderDeptAssets(deptId);
        return;
    }
    try {
        var res = await api("/reports/department-assets/" + deptId);
        if (!res.ok) throw new Error("Error del servidor");
        var data = await res.json();
        currentDeptAssets[deptId] = data;
        renderDeptAssets(deptId);
    } catch (e) {
        container.innerHTML = '<div class="text-center text-red-500 text-xs py-3">Error al cargar activos</div>';
    }
}

function renderDeptAssets(deptId) {
    var container = document.getElementById("deptAssets-" + deptId);
    var data = currentDeptAssets[deptId] || [];
    if (!container) return;
    if (data.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 italic text-xs py-3">Sin activos vinculados a este departamento.</div>';
        return;
    }
    var count = data.length;
    var assigned = data.filter(function(a) { return a.status === "Checkout"; }).length;
    var html = '<div class="flex items-center justify-between mb-2 px-1"><span class="text-xs font-bold text-gray-600">Total: ' + count + ' activos | Asignados: ' + assigned + '</span><div class="flex gap-1"><button onclick="exportDeptCSV(' + deptId + ')" class="text-[11px] bg-green-100 hover:bg-green-200 border border-green-300 px-2 py-0.5 rounded font-bold text-green-800 cursor-pointer">CSV</button><button onclick="exportDeptExcel(' + deptId + ')" class="text-[11px] bg-blue-100 hover:bg-blue-200 border border-blue-300 px-2 py-0.5 rounded font-bold text-blue-700 cursor-pointer">Excel</button></div></div>';
    html += '<div class="overflow-x-auto max-h-64 overflow-y-auto"><table class="min-w-full text-xs border border-gray-200"><thead class="bg-gray-100 text-gray-500"><tr><th class="px-2 py-1 text-left font-bold uppercase">Asset Tag</th><th class="px-2 py-1 text-left font-bold uppercase">Descripcion</th><th class="px-2 py-1 text-left font-bold uppercase">Marca/Modelo</th><th class="px-2 py-1 text-left font-bold uppercase">Serie</th><th class="px-2 py-1 text-left font-bold uppercase">Categoria</th><th class="px-2 py-1 text-left font-bold uppercase">Status</th><th class="px-2 py-1 text-left font-bold uppercase">Asignado A</th></tr></thead><tbody>';
    data.forEach(function(a) {
        var badge = getAssetBadgeColor(a.status);
        html += '<tr class="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onclick="openAssetModalById(' + a.asset_id + ')"><td class="px-2 py-1 font-mono font-bold text-blue-600">' + escapeHtml(a.asset_tag_id) + '</td><td class="px-2 py-1">' + escapeHtml(a.asset_description) + '</td><td class="px-2 py-1">' + escapeHtml(a.brand) + ' ' + escapeHtml(a.model) + '</td><td class="px-2 py-1 font-mono">' + escapeHtml(a.serial_no) + '</td><td class="px-2 py-1">' + escapeHtml(a.category) + '</td><td class="px-2 py-1"><span class="px-1.5 py-0.5 inline-flex items-center text-[10px] font-semibold rounded-full ' + badge + '">' + escapeHtml(a.status) + '</span></td><td class="px-2 py-1">' + escapeHtml(a.assigned_person) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

async function exportDeptExcel(deptId) {
    if (!getToken()) { showToast("Debe iniciar sesion", "error"); return; }
    try {
        var res = await api("/export/department/" + deptId + "/");
        if (!res.ok) { showToast("Error al exportar", "error"); return; }
        var blob = await res.blob();
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        var dept = currentDeptSummary.find(function(d) { return d.dept_id === deptId; });
        var name = dept ? dept.dept_name.replace(/[^a-zA-Z0-9]/g, "_") : "departamento_" + deptId;
        a.download = "departamento_" + name + "_" + new Date().toISOString().slice(0,10) + ".xlsx";
        a.click();
        URL.revokeObjectURL(a.href);
    } catch(e) { showToast("Error de conexion al exportar", "error"); }
}

function exportDeptReportCSV() {
    if (currentDeptSummary.length === 0) { alert("No hay datos para exportar"); return; }
    var headers = ["Departamento", "Empleados", "Activos Asignados"];
    var rows = currentDeptSummary.map(function(d) {
        return [d.dept_name, d.employee_count, d.assigned_assets].map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(",");
    });
    var csv = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "resumen_departamentos_" + new Date().toISOString().slice(0,10) + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
}

function exportDeptCSV(deptId) {
    var data = currentDeptAssets[deptId];
    if (!data || data.length === 0) { alert("No hay datos para exportar"); return; }
    var deptName = "";
    var dept = currentDeptSummary.find(function(d) { return d.dept_id === deptId; });
    if (dept) deptName = dept.dept_name;
    var headers = ["AssetTag", "Descripcion", "Marca", "Modelo", "Serie", "Categoria", "Status", "AsignadoA"];
    var rows = data.map(function(a) {
        return [a.asset_tag_id, a.asset_description, a.brand, a.model, a.serial_no, a.category, a.status, a.assigned_person].map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(",");
    });
    var csv = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    var name = deptName ? deptName.replace(/[^a-zA-Z0-9]/g, "_") : "departamento_" + deptId;
    a.download = name + "_" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function openAssetModalById(assetId) {
    const existing = currentAssets.find(a => a.id === parseInt(assetId));
    if (existing) {
        openDetailsModal(assetId);
        return;
    }
    try {
        const res = await api(`/assets/${assetId}`);
        if (!res.ok) return;
        const asset = await res.json();
        currentAssets.unshift(asset);
        openDetailsModal(assetId);
    } catch (e) {
        console.error("Error cargando asset", e);
    }
}

// ===================== ENTREGAS PENDIENTES =====================



function populateDeliveryCategoryCheckboxes(cats) {
    const container = document.getElementById("delivery_category_checkboxes");
    if (!container) return;
    container.innerHTML = cats.map(c =>
        '<label class="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">' +
            '<input type="checkbox" class="delivery-cat-checkbox" value="' + c + '">' +
            '<span class="text-sm text-gray-700 flex-1">' + c + '</span>' +
            '<input type="number" class="delivery-cat-qty w-16 p-1 border border-gray-300 rounded text-xs text-center" value="1" min="1" disabled>' +
        '</label>'
    ).join('');
    container.querySelectorAll('.delivery-cat-checkbox').forEach(function (cb) {
        cb.addEventListener('change', function () {
            this.closest('label').querySelector('.delivery-cat-qty').disabled = !this.checked;
        });
    });
}

async function submitNewPending() {
    const personId = document.getElementById("delivery_person_id").value;
    const notes = document.getElementById("delivery_notes").value;
    if (!personId) { alert("Seleccione un empleado"); return; }
    const checked = document.querySelectorAll('.delivery-cat-checkbox:checked');
    if (checked.length === 0) { alert("Seleccione al menos una categoria"); return; }
    let successCount = 0;
    for (const cb of checked) {
        const category = cb.value;
        const qty = parseInt(cb.closest('label').querySelector('.delivery-cat-qty').value) || 1;
        try {
            const res = await api("/deliveries/pending", {
                method: "POST",
                body: JSON.stringify({ person_id: parseInt(personId), category, quantity: qty, notes: notes || null })
            });
            if (res.ok) successCount++;
        } catch (e) { /* continue */ }
    }
    if (successCount > 0) {
        showToast(successCount + " entrega(s) pendiente(s) agregada(s)!", "success");
        document.getElementById("deliveryForm").reset();
        document.querySelectorAll('.delivery-cat-qty').forEach(function (q) { q.disabled = true; });
        loadDeliveryBoard();
    } else {
        alert("Error al crear las entregas");
    }
}

function getCategoryIcon(cat) {
    var c = cat.toLowerCase();
    if (/laptop|portatil|notebook/i.test(c)) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6 shrink-0"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M2 17v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2"/><path d="M6 17v-1h12v1"/></svg>';
    }
    if (/monitor|pantalla|screen/i.test(c)) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6 shrink-0"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4m-4 0h8"/></svg>';
    }
    if (/mouse|raton/i.test(c)) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6 shrink-0"><rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 6v4"/></svg>';
    }
    if (/teclado|keyboard|kbd/i.test(c)) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6 shrink-0"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M10 14h.01M14 14h.01M18 14h.01"/><path d="M8 18h8"/></svg>';
    }
    if (/docking|base|hub/i.test(c)) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6 shrink-0"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10m-5-4v4"/></svg>';
    }
    if (/tablet|ipad/i.test(c)) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6 shrink-0"><rect x="4" y="2" width="16" height="20" rx="3"/><circle cx="12" cy="18" r="1"/></svg>';
    }
    if (/impresora|printer|print/i.test(c)) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6 shrink-0"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>';
    }
    if (/telefono|phone|celular|movil/i.test(c)) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6 shrink-0"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M12 18h.01"/></svg>';
    }
    if (/cargador|charger|power|adaptador/i.test(c)) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6 shrink-0"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
    }
    if (/webcam|camara|camera/i.test(c)) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6 shrink-0"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/><circle cx="8" cy="12" r="3"/></svg>';
    }
    if (/audifono|headset|auricular|headphone/i.test(c)) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6 shrink-0"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-6 h-6 shrink-0"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M12 22V12"/><path d="M3.3 7L12 12l8.7-5"/></svg>';
}

async function loadDeliveryBoard() {
    var container = document.getElementById("deliveryBoardContainer");
    container.innerHTML = '<p class="text-center text-gray-400 italic py-8">Cargando tablero...</p>';
    try {
        var res = await api("/deliveries/summary");
        if (!res.ok) throw new Error("Error");
        var data = await res.json();
        var totalItems = data.reduce(function(sum, cat) { return sum + cat.total_pending; }, 0);
        document.getElementById("deliveryBoardCount").textContent = totalItems + " Item" + (totalItems !== 1 ? 's' : '');
        container.innerHTML = "";
        if (data.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-400 italic py-8">No hay entregas pendientes activas.</p>';
            return;
        }
        var palette = [
            { bg: "bg-blue-100", border: "border-blue-300", accent: "border-l-blue-500", title: "text-blue-800", btn: "bg-blue-600 hover:bg-blue-700" },
            { bg: "bg-green-100", border: "border-green-300", accent: "border-l-green-500", title: "text-green-800", btn: "bg-green-600 hover:bg-green-700" },
            { bg: "bg-purple-100", border: "border-purple-300", accent: "border-l-purple-500", title: "text-purple-800", btn: "bg-purple-600 hover:bg-purple-700" },
            { bg: "bg-amber-100", border: "border-amber-300", accent: "border-l-amber-500", title: "text-amber-800", btn: "bg-amber-600 hover:bg-amber-700" },
            { bg: "bg-pink-100", border: "border-pink-300", accent: "border-l-pink-500", title: "text-pink-800", btn: "bg-pink-600 hover:bg-pink-700" },
            { bg: "bg-teal-100", border: "border-teal-300", accent: "border-l-teal-500", title: "text-teal-800", btn: "bg-teal-600 hover:bg-teal-700" },
            { bg: "bg-indigo-100", border: "border-indigo-300", accent: "border-l-indigo-500", title: "text-indigo-800", btn: "bg-indigo-600 hover:bg-indigo-700" },
            { bg: "bg-orange-100", border: "border-orange-300", accent: "border-l-orange-500", title: "text-orange-800", btn: "bg-orange-600 hover:bg-orange-700" },
        ];
        var wrapper = document.createElement("div");
        wrapper.className = "grid grid-cols-1 md:grid-cols-2 gap-5";
        data.forEach(function(cat, i) {
            var c = palette[i % palette.length];
            var iconSvg = getCategoryIcon(cat.category);
            var pendingCount = cat.total_pending;
            var availCount = cat.available;
            var escName = function(s) { return (s || "").replace(/'/g, "\\'"); };
            var cardHtml = '<div class="' + c.bg + ' ' + c.border + ' ' + c.accent + ' rounded-lg border shadow-md p-4">';
            cardHtml += '<div class="flex items-start gap-3 mb-3">';
            cardHtml += '<div class="text-gray-600 shrink-0 mt-0.5">' + iconSvg + '</div>';
            cardHtml += '<div class="flex-1 min-w-0">';
            cardHtml += '<div class="flex justify-between items-start gap-2">';
            cardHtml += '<h3 class="text-base font-bold ' + c.title + ' truncate">' + cat.category + '</h3>';
            cardHtml += '<span class="text-xs font-bold text-gray-600 whitespace-nowrap shrink-0 bg-white/60 px-2 py-0.5 rounded">' + pendingCount + ' pendiente' + (pendingCount !== 1 ? 's' : '') + '</span>';
            cardHtml += '</div>';
            cardHtml += '<div class="text-xs text-gray-500 mt-0.5">' + availCount + ' disponible' + (availCount !== 1 ? 's' : '') + ' en almacen</div>';
            cardHtml += '</div></div>';
            cardHtml += '<div class="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">';
            cat.employees.forEach(function(emp) {
                var safePerson = escName(emp.person_name);
                var safeCat = escName(cat.category);
                cardHtml += '<div class="bg-white rounded-lg p-3 border border-gray-200 shadow-sm border-l-2 border-l-gray-300">';
                cardHtml += '<div class="flex justify-between items-start">';
                cardHtml += '<span class="text-sm font-bold text-gray-800">' + emp.person_name + '</span>';
                cardHtml += '<span class="text-xs font-bold text-gray-500 whitespace-nowrap ml-2">' + emp.pending + ' pendiente' + (emp.pending !== 1 ? 's' : '') + '</span>';
                cardHtml += '</div>';
                if (emp.notes) {
                    cardHtml += '<div class="text-xs text-gray-400 italic mt-1.5">' + emp.notes + '</div>';
                }
                cardHtml += '<div class="flex gap-1.5 mt-2.5">';
                cardHtml += '<button onclick=\'openFulfillModal(' + emp.delivery_id + ',"' + safeCat + '","' + safePerson + '")\' class="flex-1 ' + c.btn + ' text-white text-xs font-bold py-1.5 px-3 rounded shadow-sm transition-colors cursor-pointer"' + (availCount === 0 ? ' disabled' : '') + '>Asignar</button>';
                cardHtml += '<button onclick="cancelPending(' + emp.delivery_id + ')" class="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold py-1.5 px-3 rounded border border-red-300 transition-colors cursor-pointer">Cancelar</button>';
                cardHtml += '</div></div>';
            });
            cardHtml += '</div></div>';
            var col = document.createElement("div");
            col.className = "w-full";
            col.innerHTML = cardHtml;
            wrapper.appendChild(col);
        });
        container.appendChild(wrapper);
    } catch (e) {
        container.innerHTML = '<p class="text-center text-red-500 font-medium py-8">Error de conexion con el servidor backend</p>';
    }
}

async function loadDeliveryEmployees() {
    const tbody = document.getElementById("deliveryEmployeesBody");
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400 italic">Cargando...</td></tr>';
    try {
        const res = await api("/deliveries/pending?status=Active");
        if (!res.ok) throw new Error("Error");
        const data = await res.json();
        tbody.innerHTML = "";
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400 italic">No hay entregas pendientes activas.</td></tr>';
            return;
        }
        const grouped = {};
        data.forEach(d => {
            if (!grouped[d.person_id]) grouped[d.person_id] = { person_name: d.person_name, items: [] };
            grouped[d.person_id].items.push(d);
        });
        let total = 0;
        Object.values(grouped).forEach(g => {
            const pendingCount = g.items.reduce((sum, i) => sum + (i.quantity - i.fulfilled_count), 0);
            const cats = [...new Set(g.items.map(i => i.category))].join(", ");
            total += pendingCount;
            const row = document.createElement("tr");
            row.className = "hover:bg-blue-50/50 transition-colors";
            row.innerHTML = `
                <td class="px-4 py-3 font-medium text-gray-800">${g.person_name}</td>
                <td class="px-4 py-3 font-mono text-gray-500">${g.items[0].person_id}</td>
                <td class="px-4 py-3 text-gray-600">${pendingCount}</td>
                <td class="px-4 py-3 text-gray-500">${cats}</td>
                <td class="px-4 py-3 text-center">
                    <button onclick="showSection('deliveryBoard')" class="bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold text-[10px] uppercase py-1 px-2.5 rounded border border-blue-300 transition-colors cursor-pointer">Ver en Tablero</button>
                </td>`;
            tbody.appendChild(row);
        });
        document.getElementById("deliveryTotalPending").textContent = total;
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-red-500 font-medium">Error de conexion</td></tr>';
    }
}

async function openFulfillModal(deliveryId, category, personName) {
    document.getElementById("fulfillDeliveryId").value = deliveryId;
    document.getElementById("fulfillInfo").textContent = `Asignar ${category} a ${personName}`;
    const tbody = document.getElementById("fulfillAssetsBody");
    tbody.innerHTML = '<tr><td colspan="4" class="px-3 py-4 text-center text-gray-400 italic">Cargando activos disponibles...</td></tr>';
    document.getElementById("fulfillModal").classList.remove("hidden");
    try {
        const res = await api("/deliveries/available-assets");
        if (!res.ok) throw new Error("Error");
        const assets = await res.json();
        const filtered = assets.filter(a => a.category === category);
        tbody.innerHTML = "";
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-3 py-4 text-center text-amber-600 font-medium">No hay activos disponibles de esta categoria.</td></tr>';
            return;
        }
        filtered.forEach(a => {
            const row = document.createElement("tr");
            row.className = "hover:bg-blue-50/50 transition-colors";
            row.innerHTML = `
                <td class="px-3 py-2"><input type="radio" name="fulfill_asset" value="${a.id}" class="cursor-pointer"></td>
                <td class="px-3 py-2 font-mono font-bold">${a.asset_tag_id}</td>
                <td class="px-3 py-2 text-gray-600">${a.asset_description}</td>
                <td class="px-3 py-2 text-gray-500">${a.brand} ${a.model}</td>
                <td class="px-3 py-2 font-mono text-gray-400">${a.serial_no}</td>`;
            tbody.appendChild(row);
        });
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-3 py-4 text-center text-red-500 font-medium">Error de conexion</td></tr>';
    }
}

function closeFulfillModal() {
    document.getElementById("fulfillModal").classList.add("hidden");
}

async function submitFulfill() {
    const deliveryId = document.getElementById("fulfillDeliveryId").value;
    const selected = document.querySelector('input[name="fulfill_asset"]:checked');
    if (!selected) { alert("Seleccione un activo para asignar"); return; }
    const assetId = parseInt(selected.value);
    try {
        const res = await api(`/deliveries/pending/${deliveryId}/fulfill`, {
            method: "POST",
            body: JSON.stringify({ asset_id: assetId })
        });
        if (res.ok) {
            const data = await res.json();
            showToast("Activo " + data.asset_tag + " asignado! (" + data.fulfilled_count + "/" + data.total + ")", "success");
            closeFulfillModal();
            loadDeliveryBoard();
        } else {
            const err = await res.json().catch(()=>({detail:"Error"}));
            alert("Error: " + (err.detail || "No se pudo asignar"));
        }
    } catch (e) { alert("Error de conexion"); }
}

async function cancelPending(deliveryId) {
    if (!confirm("Cancelar esta entrega pendiente?")) return;
    try {
        const res = await api(`/deliveries/pending/${deliveryId}`, { method: "DELETE" });
        if (res.ok) {
            showToast("Entrega cancelada", "success");
            loadDeliveryBoard();
            loadDeliveryEmployees();
        } else {
            const err = await res.json().catch(()=>({detail:"Error"}));
            alert("Error: " + (err.detail || "No se pudo cancelar"));
        }
    } catch (e) { alert("Error de conexion"); }
}

// ===================== COLUMN TOGGLE + CSV EXPORT =====================

function toggleColumnPanel(section) {
    const panel = document.getElementById(`colPanel_${section}`);
    if (!panel) return;
    const allPanels = document.querySelectorAll('[id^="colPanel_"]');
    allPanels.forEach(p => { if (p.id !== panel.id) p.classList.add("hidden"); });
    panel.classList.toggle("hidden");
}

document.addEventListener("click", function(e) {
    if (!e.target.closest('[id^="colPanel_"]') && !e.target.closest('button[onclick*="toggleColumnPanel"]')) {
        document.querySelectorAll('[id^="colPanel_"]').forEach(p => p.classList.add("hidden"));
    }
});

function toggleColumn(section, colName) {
    const key = `col_${section}_${colName}`;
    const cb = document.querySelector(`#colPanel_${section} input[data-col="${colName}"]`);
    const visible = cb ? cb.checked : true;
    localStorage.setItem(key, visible ? "1" : "0");
    document.querySelectorAll(`[data-col="${colName}"]`).forEach(el => el.classList.toggle("hidden", !visible));
}

function applyColumnPreferences() {
    document.querySelectorAll('[id^="colPanel_"]').forEach(panel => {
        const section = panel.id.replace("colPanel_", "");
        panel.querySelectorAll("input[data-col]").forEach(cb => {
            const col = cb.dataset.col;
            const key = `col_${section}_${col}`;
            const saved = localStorage.getItem(key);
            if (saved === "0") {
                cb.checked = false;
                document.querySelectorAll(`[data-col="${col}"]`).forEach(el => el.classList.add("hidden"));
            }
        });
    });
}

function csvEscape(val) {
    if (val == null) return "";
    const s = String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function exportVisibleCSV(section) {
    let rows = [];
    let headers = [];
    let data = [];

    if (section === "assets") {
        data = currentAssets.filter(a => a.status !== "Archived");
        const colMap = [
            { key: "asset_tag_id", label: "Asset Tag" },
            { key: "asset_description", label: "Descripcion" },
            { key: "brand", label: "Marca" },
            { key: "serial_no", label: "Serie", col: "serie" },
            { key: "category", label: "Categoria", col: "category" },
            { key: "site_name", label: "Sitio", col: "site", fn: a => { const s = globalSites.find(x => x.id === a.site_id); return s ? s.site_name : ''; } },
            { key: "status", label: "Estado" },
            { key: "numero_telefono", label: "Telefono", col: "phone" },
            { key: "purchased_from", label: "Vendor", col: "vendor" },
            { key: "purchase_date", label: "Fecha Compra", col: "date", fn: a => a.purchase_date ? new Date(a.purchase_date).toLocaleDateString('es-ES') : '' }
        ];
        headers = colMap.filter(c => !c.col || localStorage.getItem(`col_assets_${c.col}`) !== "0").map(c => c.label);
        rows = data.map(a => colMap.filter(c => !c.col || localStorage.getItem(`col_assets_${c.col}`) !== "0").map(c => csvEscape(c.fn ? c.fn(a) : a[c.key])));
    } else if (section === "employees") {
        data = globalPersons;
        const colMap = [
            { key: "full_name", label: "Nombre" },
            { key: "email", label: "Email" },
            { key: "employee_id", label: "Employee ID" },
            { key: "dept", label: "Departamento", col: "dept", fn: p => { const d = globalDepartments.find(x => x.id === p.department_id); return d ? d.department_name : ''; } },
            { key: "site", label: "Sitio", col: "site", fn: p => { const s = globalSites.find(x => x.id === p.site_id); return s ? s.site_name : ''; } },
            { key: "phone", label: "Telefono", col: "phone" },
            { key: "notes", label: "Notas", col: "notes" },
            { key: "is_active", label: "Estado", col: "status", fn: p => p.is_active !== false ? "Activo" : "Inactivo" }
        ];
        headers = colMap.filter(c => !c.col || localStorage.getItem(`col_employees_${c.col}`) !== "0").map(c => c.label);
        rows = data.map(p => colMap.filter(c => !c.col || localStorage.getItem(`col_employees_${c.col}`) !== "0").map(c => csvEscape(c.fn ? c.fn(p) : p[c.key])));
    } else if (section === "reports") {
        data = currentReportResults;
        const colMap = [
            { key: "asset_tag_id", label: "Asset Tag" },
            { key: "asset_description", label: "Descripcion" },
            { key: "brand", label: "Marca" },
            { key: "serial_no", label: "Serie" },
            { key: "category", label: "Categoria" },
            { key: "site_name", label: "Sitio", col: "site" },
            { key: "assigned_date", label: "Asignado", col: "assigned", fn: r => r.assigned_date ? new Date(r.assigned_date).toLocaleDateString('es-ES') : '' },
            { key: "returned_date", label: "Devuelto", col: "returned", fn: r => r.returned_date ? new Date(r.returned_date).toLocaleDateString('es-ES') : '' },
            { key: "status", label: "Status", col: "status" }
        ];
        headers = colMap.filter(c => !c.col || localStorage.getItem(`col_reports_${c.col}`) !== "0").map(c => c.label);
        rows = data.map(r => colMap.filter(c => !c.col || localStorage.getItem(`col_reports_${c.col}`) !== "0").map(c => csvEscape(c.fn ? c.fn(r) : r[c.key])));
    } else if (section === "ctf") {
        data = currentCtfResults;
        const colMap = [
            { key: "asset_tag_id", label: "Asset Tag" },
            { key: "asset_description", label: "Descripcion" },
            { key: "brand", label: "Marca", fn: r => r.brand + " " + r.model },
            { key: "serial_no", label: "Serie" },
            { key: "category", label: "Categoria" },
            { key: "employee_name", label: "Empleado", fn: r => r.employee_name + " (" + r.employee_id + ")" },
            { key: "admin_name", label: "Admin" },
            { key: "checkout_date", label: "Fecha Checkout", fn: r => new Date(r.checkout_date).toLocaleDateString("es-ES") },
            { key: "current_status", label: "Status Actual" }
        ];
        headers = colMap.map(c => c.label);
        rows = data.map(r => colMap.map(c => csvEscape(c.fn ? c.fn(r) : r[c.key])));
    } else if (section === "sr") {
        data = currentSrResults;
        const siteName = function (sid) { var s = globalSites.find(function (x) { return x.id === sid; }); return s ? s.site_name : ""; };
        const colMap = [
            { key: "asset_tag_id", label: "Asset Tag" },
            { key: "asset_description", label: "Descripcion" },
            { key: "brand_model", label: "Marca/Modelo", fn: function (a) { return a.brand + " " + a.model; } },
            { key: "serial_no", label: "Serie" },
            { key: "category", label: "Categoria" },
            { key: "site", label: "Sitio", fn: function (a) { return siteName(a.site_id); } },
            { key: "status", label: "Status" }
        ];
        headers = colMap.map(function (c) { return c.label; });
        rows = data.map(function (r) { return colMap.map(function (c) { return csvEscape(c.fn ? c.fn(r) : r[c.key]); }); });
    }

    if (rows.length === 0) { alert("No hay datos para exportar"); return; }
    const csv = "\uFEFF" + headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const names = { assets: "activos", employees: "empleados", reports: "reporte_checkout", ctf: "checkout_por_fecha", sr: "status_report" };
    a.download = `${names[section] || section}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
}

// --- CHANGE PASSWORD ---
function setupPasswordFormListener() {
    document.getElementById("changePasswordForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const errEl = document.getElementById("cpError");
        const current = document.getElementById("cp_current_password").value;
        const newPass = document.getElementById("cp_new_password").value;
        const confirm = document.getElementById("cp_confirm_password").value;
        if (newPass !== confirm) {
            errEl.textContent = "Las contrasenas no coinciden";
            errEl.classList.remove("hidden");
            return;
        }
        errEl.classList.add("hidden");
        try {
            const res = await api("/auth/change-password", {
                method: "POST",
                body: JSON.stringify({ current_password: current, new_password: newPass })
            });
            if (res.ok) {
                alert("Contrasena cambiada exitosamente");
                closeChangePasswordModal();
            } else {
                const err = await res.json().catch(() => ({ detail: "Error" }));
                errEl.textContent = err.detail || "Error al cambiar contrasena";
                errEl.classList.remove("hidden");
            }
        } catch (e) {
            errEl.textContent = "Error de conexion";
            errEl.classList.remove("hidden");
        }
    });
}

// --- USERS ---
async function loadUsers() {
    const tbody = document.getElementById("usersTableBody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400 italic">Cargando...</td></tr>';
    try {
        const res = await api("/users/");
        if (!res.ok) { tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-red-500">Error al cargar usuarios</td></tr>'; return; }
        const users = await res.json();
        const canManage = hasPermission("can_manage_users");
        tbody.innerHTML = users.map(u => `
            <tr>
                <td class="px-4 py-3 font-medium">${u.username}</td>
                <td class="px-4 py-3">${u.email || '-'}</td>
                <td class="px-4 py-3">${u.group ? u.group.name : '-'}</td>
                <td class="px-4 py-3">${u.is_active ? '<span class="text-green-600 font-bold">Si</span>' : '<span class="text-red-500 font-bold">No</span>'}</td>
                <td class="px-4 py-3 text-center">${canManage ? `<button onclick="editUser(${u.id})" class="text-blue-600 hover:underline text-xs font-bold mr-2 cursor-pointer">Editar</button>` : '-'}</td>
            </tr>
        `).join("");
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-red-500">Error de conexion</td></tr>'; }
}

function openUserModal(data) {
    document.getElementById("userForm").reset();
    document.getElementById("userFormError").classList.add("hidden");
    document.getElementById("userModalTitle").textContent = data ? "Editar Usuario" : "Nuevo Usuario";
    document.getElementById("user_id").value = data ? data.id : "";
    document.getElementById("user_username").value = data ? data.username : "";
    document.getElementById("user_username").readOnly = !!data;
    document.getElementById("user_email").value = data ? data.email : "";
    document.getElementById("user_email").readOnly = !!data;
    document.getElementById("user_password").required = !data;
    document.getElementById("user_password").placeholder = data ? "Dejar vacio para no cambiar" : "";
    document.getElementById("userPasswordLabel").textContent = data ? "(opcional)" : "*";
    document.getElementById("user_is_active").checked = data ? data.is_active : true;
    document.getElementById("userModal").classList.remove("hidden");
    loadGroupSelect(data ? data.group_id : null);
}
function closeUserModal() { document.getElementById("userModal").classList.add("hidden"); document.getElementById("userForm").reset(); document.getElementById("userFormError").classList.add("hidden"); }

async function editUser(id) {
    try {
        const res = await api(`/users/`);
        if (!res.ok) return;
        const users = await res.json();
        const u = users.find(x => x.id === id);
        if (u) openUserModal(u);
    } catch (e) {}
}

async function loadGroupSelect(selectedId) {
    const sel = document.getElementById("user_group_id");
    sel.innerHTML = '<option value="">Cargando...</option>';
    try {
        const res = await api("/groups/");
        if (!res.ok) return;
        const groups = await res.json();
        sel.innerHTML = groups.map(g => `<option value="${g.id}" ${g.id === selectedId ? 'selected' : ''}>${g.name}</option>`).join("");
    } catch (e) { sel.innerHTML = '<option value="">Error</option>'; }
}

function setupUserFormListener() {
    document.getElementById("userForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const errEl = document.getElementById("userFormError");
        errEl.classList.add("hidden");
        const id = document.getElementById("user_id").value;
        const body = {
            username: document.getElementById("user_username").value,
            email: document.getElementById("user_email").value,
            group_id: parseInt(document.getElementById("user_group_id").value),
            is_active: document.getElementById("user_is_active").checked
        };
        const password = document.getElementById("user_password").value;
        if (password) body.password = password;
        try {
            const url = id ? `/users/${id}` : "/users/";
            const method = id ? "PUT" : "POST";
            const res = await api(url, { method, body: JSON.stringify(body) });
            if (res.ok) {
                closeUserModal();
                loadUsers();
            } else {
                const err = await res.json().catch(() => ({ detail: "Error" }));
                errEl.textContent = err.detail || "Error al guardar usuario";
                errEl.classList.remove("hidden");
            }
        } catch (e) {
            errEl.textContent = "Error de conexion";
            errEl.classList.remove("hidden");
        }
    });
}

// --- GROUPS ---
async function loadGroups() {
    const tbody = document.getElementById("groupsTableBody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" class="px-4 py-6 text-center text-gray-400 italic">Cargando...</td></tr>';
    try {
        const res = await api("/groups/");
        if (!res.ok) { tbody.innerHTML = '<tr><td colspan="3" class="px-4 py-6 text-center text-red-500">Error</td></tr>'; return; }
        const groups = await res.json();
        const canManage = hasPermission("can_manage_users");
        tbody.innerHTML = groups.map(g => {
            const perms = [];
            if (g.can_view) perms.push("Ver");
            if (g.can_create) perms.push("Crear");
            if (g.can_edit) perms.push("Editar");
            if (g.can_delete) perms.push("Eliminar");
            if (g.can_checkout) perms.push("Checkout");
            if (g.can_import_export) perms.push("Imp/Exp");
            if (g.can_manage_users) perms.push("Usuarios");
            return `<tr>
                <td class="px-4 py-3 font-medium">${g.name}</td>
                <td class="px-4 py-3 text-xs text-gray-500">${perms.join(", ")}</td>
                <td class="px-4 py-3 text-center">${canManage ? `<button onclick="editGroup(${g.id})" class="text-blue-600 hover:underline text-xs font-bold mr-2 cursor-pointer">Editar</button><button onclick="deleteGroup(${g.id})" class="text-red-600 hover:underline text-xs font-bold cursor-pointer">Eliminar</button>` : '-'}</td>
            </tr>`;
        }).join("");
    } catch (e) { tbody.innerHTML = '<tr><td colspan="3" class="px-4 py-6 text-center text-red-500">Error de conexion</td></tr>'; }
}

function openGroupModal(data) {
    document.getElementById("groupForm").reset();
    document.getElementById("groupFormError").classList.add("hidden");
    document.getElementById("groupModalTitle").textContent = data ? "Editar Grupo" : "Nuevo Grupo";
    document.getElementById("group_id").value = data ? data.id : "";
    document.getElementById("group_name").value = data ? data.name : "";
    document.getElementById("group_name").readOnly = !!data;
    document.getElementById("perm_can_view").checked = data ? data.can_view : true;
    document.getElementById("perm_can_create").checked = data ? data.can_create : false;
    document.getElementById("perm_can_edit").checked = data ? data.can_edit : false;
    document.getElementById("perm_can_delete").checked = data ? data.can_delete : false;
    document.getElementById("perm_can_checkout").checked = data ? data.can_checkout : false;
    document.getElementById("perm_can_import_export").checked = data ? data.can_import_export : false;
    document.getElementById("perm_can_manage_users").checked = data ? data.can_manage_users : false;
    document.getElementById("groupModal").classList.remove("hidden");
}
function closeGroupModal() { document.getElementById("groupModal").classList.add("hidden"); document.getElementById("groupForm").reset(); document.getElementById("groupFormError").classList.add("hidden"); }

async function editGroup(id) {
    try {
        const res = await api(`/groups/`);
        if (!res.ok) return;
        const groups = await res.json();
        const g = groups.find(x => x.id === id);
        if (g) openGroupModal(g);
    } catch (e) {}
}

async function deleteGroup(id) {
    if (!confirm("Eliminar este grupo? Los usuarios asignados quedaran sin grupo.")) return;
    try {
        const res = await api(`/groups/${id}`, { method: "DELETE" });
        if (res.ok) { loadGroups(); } else { const err = await res.json().catch(() => ({ detail: "Error" })); alert(err.detail || "Error"); }
    } catch (e) { alert("Error de conexion"); }
}

function setupGroupFormListener() {
    document.getElementById("groupForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const errEl = document.getElementById("groupFormError");
        errEl.classList.add("hidden");
        const id = document.getElementById("group_id").value;
        const body = {
            name: document.getElementById("group_name").value,
            can_view: document.getElementById("perm_can_view").checked,
            can_create: document.getElementById("perm_can_create").checked,
            can_edit: document.getElementById("perm_can_edit").checked,
            can_delete: document.getElementById("perm_can_delete").checked,
            can_checkout: document.getElementById("perm_can_checkout").checked,
            can_import_export: document.getElementById("perm_can_import_export").checked,
            can_manage_users: document.getElementById("perm_can_manage_users").checked
        };
        try {
            const url = id ? `/groups/${id}` : "/groups/";
            const method = id ? "PUT" : "POST";
            const res = await api(url, { method, body: JSON.stringify(body) });
            if (res.ok) {
                closeGroupModal();
                loadGroups();
            } else {
                const err = await res.json().catch(() => ({ detail: "Error" }));
                errEl.textContent = err.detail || "Error al guardar grupo";
                errEl.classList.remove("hidden");
            }
        } catch (e) {
            errEl.textContent = "Error de conexion";
            errEl.classList.remove("hidden");
        }
    });
}

// --- INACTIVE ASSETS BY STATUS ---
const statusSections = {
    Broken: "brokenAssetsBody",
    Lost: "lostAssetsBody",
    Disposed: "disposedAssetsBody",
    Donate: "donateAssetsBody",
    Sold: "soldAssetsBody"
};

async function loadAssetsByStatus(status) {
    const tbody = document.getElementById(statusSections[status]);
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400 italic">Cargando...</td></tr>';
    try {
        const res = await api(`/assets/?status=${status}&limit=1000`);
        if (!res.ok) { tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-red-500">Error al cargar</td></tr>'; return; }
        const assets = await res.json();
        if (assets.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400 italic">No hay equipos con estado "${status}".</td></tr>`;
            return;
        }
        tbody.innerHTML = assets.map(a => `
            <tr class="hover:bg-red-50/30 transition-colors cursor-pointer" onclick="openDetailsModal(${a.id})">
                <td class="px-4 py-3 font-bold text-red-700">${a.asset_tag_id}</td>
                <td class="px-4 py-3 text-gray-600">${a.asset_description}</td>
                <td class="px-4 py-3 text-gray-500">${a.brand} ${a.model}</td>
                <td class="px-4 py-3 font-mono text-gray-400">${a.serial_no}</td>
                <td class="px-4 py-3 text-center" onclick="event.stopPropagation();">
                    <button onclick="restoreOneAsset(${a.id},'${a.asset_tag_id}')" class="bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] uppercase py-1 px-3 rounded shadow transition-colors cursor-pointer">Restaurar</button>
                </td>
            </tr>
        `).join("");
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-red-500">Error de conexion</td></tr>'; }
}

async function loadRepairAssets() {
    const tbody = document.getElementById("enReparacionBody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-6 text-center text-gray-400 italic">Cargando...</td></tr>';
    try {
        const statuses = ["Under repair", "GarantiaSD"];
        const results = await Promise.all(statuses.map(s => api(`/assets/?status=${encodeURIComponent(s)}&limit=1000`).then(r => r.ok ? r.json() : [])));
        const all = results.flat().sort((a, b) => a.asset_tag_id.localeCompare(b.asset_tag_id));
        if (all.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-6 text-center text-gray-400 italic">No hay equipos en reparacion.</td></tr>';
            return;
        }
        tbody.innerHTML = all.map(a => {
            var leftPerson = globalPersons.find(function (p) { return p.id === a.repair_left_by_id; });
            var tech = globalAdmins.find(function (ad) { return ad.id === a.repair_technician_id; });
            var badgeColor = a.status === "GarantiaSD" ? "bg-amber-100 text-amber-800" : "bg-orange-100 text-orange-800";
            return '<tr class="hover:bg-amber-50/30 transition-colors cursor-pointer" onclick="openDetailsModal(' + a.id + ')">' +
                '<td class="px-4 py-3 font-bold text-amber-700">' + a.asset_tag_id + '</td>' +
                '<td class="px-4 py-3 text-gray-600">' + (a.asset_description || '') + '</td>' +
                '<td class="px-4 py-3 text-gray-500">' + (a.brand || '') + ' ' + (a.model || '') + '</td>' +
                '<td class="px-4 py-3 font-mono text-gray-400">' + (a.serial_no || '') + '</td>' +
                '<td class="px-4 py-3"><span class="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ' + badgeColor + '">' + a.status + '</span></td>' +
                '<td class="px-4 py-3 text-gray-600 max-w-[200px] truncate">' + (a.repair_reason || '-') + '</td>' +
                '<td class="px-4 py-3 text-gray-600">' + (leftPerson ? leftPerson.full_name : '-') + '</td>' +
                '<td class="px-4 py-3 text-gray-600">' + (tech ? tech.username : '-') + '</td>' +
            '</tr>';
        }).join("");
    } catch (e) { tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-6 text-center text-red-500">Error de conexion</td></tr>'; }
}

async function loadListadoInactivos() {
    const tbody = document.getElementById("listadoInactivosBody");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-gray-400 italic">Cargando...</td></tr>';
    try {
        const statuses = ["Broken","Lost","Disposed","Donate","Sold"];
        const results = await Promise.all(statuses.map(s => api(`/assets/?status=${s}&limit=1000`).then(r => r.ok ? r.json() : [])));
        const all = results.flat().sort((a, b) => a.asset_tag_id.localeCompare(b.asset_tag_id));
        if (all.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-gray-400 italic">No hay equipos inactivos.</td></tr>';
            return;
        }
        tbody.innerHTML = all.map(a => {
            let badgeColor = "bg-red-100 text-red-800";
            if (a.status === "Donate") badgeColor = "bg-pink-100 text-pink-800";
            if (a.status === "Sold") badgeColor = "bg-yellow-100 text-yellow-800";
            if (a.status === "Disposed") badgeColor = "bg-gray-200 text-gray-700";
            return `<tr class="hover:bg-blue-50/30 transition-colors cursor-pointer" onclick="openDetailsModal(${a.id})">
                <td class="px-4 py-3 font-bold text-blue-700">${a.asset_tag_id}</td>
                <td class="px-4 py-3 text-gray-600">${a.asset_description}</td>
                <td class="px-4 py-3 text-gray-500">${a.brand} ${a.model}</td>
                <td class="px-4 py-3"><span class="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeColor}">${a.status}</span></td>
                <td class="px-4 py-3 font-mono text-gray-400">${a.serial_no}</td>
                <td class="px-4 py-3 text-center" onclick="event.stopPropagation();">
                    <button onclick="restoreOneAsset(${a.id},'${a.asset_tag_id}')" class="bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] uppercase py-1 px-3 rounded shadow transition-colors cursor-pointer">Restaurar</button>
                </td>
            </tr>`;
        }).join("");
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-red-500">Error de conexion</td></tr>'; }
}

async function restoreOneAsset(assetId, assetTag) {
    if (!confirm(`Restaurar ${assetTag} a "Available"?`)) return;
    try {
        const res = await api(`/assets/${assetId}`, { method: "PUT", body: JSON.stringify({ status: "Available" }) });
        if (res.ok) { 
            alert(`${assetTag} restaurado a Check in.`);
            loadAssets();
            reloadVisibleInactive();
        } else {
            const err = await res.json().catch(() => ({ detail: "Error" }));
            alert("Error: " + (err.detail || "No se pudo restaurar"));
        }
    } catch (e) { alert("Error de conexion"); }
}

async function reloadVisibleInactive() {
    Object.keys(statusSections).forEach(s => { const el = document.getElementById(s.toLowerCase() + 'AssetsSection'); if (el && !el.classList.contains('hidden')) loadAssetsByStatus(s); });
    const listadoEl = document.getElementById("listadoInactivosSection");
    if (listadoEl && !listadoEl.classList.contains('hidden')) loadListadoInactivos();
}

async function restoreAllByStatus(status) {
    const statuses = status ? [status] : ["Broken","Lost","Disposed","Donate","Sold"];
    const label = status || "INACTIVOS";
    if (!confirm(`Restaurar TODOS los equipos "${label}" a Check in?`)) return;
    try {
        let totalOk = 0, totalFail = 0;
        for (const st of statuses) {
            const res = await api(`/assets/?status=${st}&limit=1000`);
            if (!res.ok) continue;
            const assets = await res.json();
            for (const a of assets) {
                try {
                    const r = await api(`/assets/${a.id}`, { method: "PUT", body: JSON.stringify({ status: "Available" }) });
                    if (r.ok) totalOk++; else totalFail++;
                } catch (e) { totalFail++; }
            }
        }
        alert(`${totalOk} equipo(s) restaurado(s). ${totalFail} fallaron.`);
        loadAssets();
        reloadVisibleInactive();
    } catch (e) { alert("Error de conexion"); }
}

// ===== CONCILIACION DE EMPLEADOS =====
function showReconciliationView() {
    document.getElementById("reconciliationForm").classList.add("hidden");
    document.getElementById("reconciliationError").classList.add("hidden");
    document.getElementById("reconciliationFile").value = "";
    loadReconciliationStatus();
}

function loadReconciliationStatus() {
    const includeCleared = document.getElementById("recIncludeCleared").checked;
    const url = "/employees/reconciliation/status/" + (includeCleared ? "?include_cleared=true" : "");
    api(url).then(res => {
        if (!res.ok) return;
        res.json().then(data => renderReconciliationStatus(data));
    }).catch(() => {});
}

function renderReconciliationStatus(data) {
    document.getElementById("recTotalSessions").textContent = data.total_sessions;
    document.getElementById("recTotalPending").textContent = data.total_pending;
    document.getElementById("recTotalCleared").textContent = data.total_cleared;

    const container = document.getElementById("recSessionList");
    container.innerHTML = "";
    if (data.sessions.length === 0) {
        container.innerHTML = '<div class="text-xs text-gray-400 italic py-6 text-center">No hay sesiones de conciliacion. Haz clic en "+ Nueva Conciliacion" para comenzar.</div>';
        return;
    }
    data.sessions.forEach((session, idx) => {
        const sessionId = session.session_id;
        const dateStr = session.uploaded_at ? new Date(session.uploaded_at).toLocaleDateString("es-DO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
        const pendingCount = session.pending_count;
        const clearedCount = session.cleared_count || 0;
        const hasPending = pendingCount > 0;

        const card = document.createElement("div");
        card.className = "border border-gray-200 rounded-lg overflow-hidden bg-white rec-session-card";
        card.style.animationDelay = (idx * 0.06) + "s";

        const header = document.createElement("button");
        header.className = "w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-gray-50/80 transition-colors relative";
        header.style.borderLeft = "4px solid " + (hasPending ? "#d97706" : "#22c55e");
        header.setAttribute("onclick", "toggleSessionAssetList(" + sessionId + ")");

        var badgeHtml = hasPending
            ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>' + pendingCount + ' pendiente(s)</span>'
            : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200"><span class="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>Completado</span>';

        header.innerHTML = `
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-8 h-8 rounded-lg ${hasPending ? 'bg-amber-50' : 'bg-green-50'} flex items-center justify-center shrink-0">
                    <svg class="w-4 h-4 ${hasPending ? 'text-amber-500' : 'text-green-500'}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>
                </div>
                <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-bold text-sm text-gray-800" style="font-family:'Sora',sans-serif">Sesion del ${dateStr}</span>
                        <span class="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">${session.filename}</span>
                    </div>
                    <div class="text-[11px] text-gray-500 mt-0.5">
                        <span class="font-medium text-gray-600">${session.uploaded_by}</span>
                        <span class="mx-1">&middot;</span>
                        ${session.matched_count} coincidencias
                        ${session.imported_count > 0 ? '<span class="mx-1">&middot;</span><span class="text-teal-600 font-medium">' + session.imported_count + ' importados</span>' : ''}
                        <span class="mx-1">&middot;</span>
                        <span class="text-gray-400">BD: ${session.total_db} / Archivo: ${session.total_file}</span>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                ${badgeHtml}
                <svg id="sessionToggleIcon-${sessionId}" class="w-3 h-3 text-gray-400 transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/></svg>
            </div>
        `;
        card.appendChild(header);

        const body = document.createElement("div");
        body.id = "sessionAssets-" + sessionId;
        body.className = "rec-session-body";
        body.style.maxHeight = "0px";

        if (session.departed.length === 0) {
            body.innerHTML = '<div class="px-4 py-4 text-xs text-gray-400 italic border-t border-gray-100">Sin empleados ausentes con activos en esta sesion.</div>';
        } else {
            const wrapper = document.createElement("div");
            wrapper.className = "border-t border-gray-100";
            session.departed.forEach((item) => {
                const p = item.person;
                const assets = item.assets;
                var clearedCount_p = 0;
                assets.forEach(function(aa) { if (aa.reconciliation_status === "cleared") clearedCount_p++; });
                var pendingCount_p = assets.length - clearedCount_p;
                var pct = assets.length > 0 ? Math.round((clearedCount_p / assets.length) * 100) : 100;

                const personBlock = document.createElement("div");
                personBlock.className = "px-4 py-3 border-b border-gray-50 last:border-b-0";

                const personHeader = document.createElement("div");
                personHeader.className = "flex items-center justify-between flex-wrap gap-2";
                personHeader.innerHTML = `
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-full ${pendingCount_p > 0 ? 'bg-amber-50' : 'bg-green-50'} flex items-center justify-center">
                            <svg class="w-3.5 h-3.5 ${pendingCount_p > 0 ? 'text-amber-500' : 'text-green-500'}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>
                        </div>
                        <div>
                            <span class="font-bold text-xs text-gray-800">${escapeHtml(p.full_name)}</span>
                            <span class="text-[10px] text-gray-400 ml-1">${p.employee_id}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] text-gray-500 font-medium">${clearedCount_p}/${assets.length}</span>
                        ${pendingCount_p === 0
                            ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200"><span class="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>Completado</span>'
                            : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>' + pendingCount_p + ' pendiente</span>'}
                    </div>
                `;
                personBlock.appendChild(personHeader);

                // Progress bar
                if (assets.length > 0) {
                    var barContainer = document.createElement("div");
                    barContainer.className = "mt-2 mb-2";
                    barContainer.innerHTML = '<div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden"><div class="h-full rounded-full transition-all duration-500 ' + (pct === 100 ? 'bg-green-400' : 'bg-amber-400') + '" style="width:' + pct + '%"></div></div>';
                    personBlock.appendChild(barContainer);
                }

                if (pendingCount_p > 0) {
                    var table = document.createElement("table");
                    table.className = "min-w-full divide-y divide-gray-100 text-xs mt-1";
                    var thead = document.createElement("thead");
                    thead.className = "bg-gray-50/80 text-gray-500";
                    thead.innerHTML = '<tr><th class="px-3 py-1.5 text-left font-bold uppercase text-[10px]">Tag</th><th class="px-3 py-1.5 text-left font-bold uppercase text-[10px]">Descripcion</th><th class="px-3 py-1.5 text-left font-bold uppercase text-[10px]">Modelo</th><th class="px-3 py-1.5 text-left font-bold uppercase text-[10px]">Serie</th><th class="px-3 py-1.5 text-center font-bold uppercase text-[10px]">Status</th><th class="px-3 py-1.5 text-center font-bold uppercase text-[10px]">Accion</th></tr>';
                    table.appendChild(thead);
                    var tbody = document.createElement("tbody");
                    tbody.className = "bg-white divide-y divide-gray-50 text-gray-700";
                    assets.forEach(function(a) {
                        if (a.reconciliation_status === "cleared") return;
                        var statusColor = a.status === "Checkout" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-green-50 text-green-700 border-green-200";
                        var tr = document.createElement("tr");
                        tr.className = "hover:bg-gray-50/50 transition-colors";
                        tr.innerHTML = '<td class="px-3 py-1.5 font-mono font-bold text-gray-800">' + escapeHtml(a.asset_tag_id) + '</td><td class="px-3 py-1.5 text-gray-600">' + escapeHtml(a.asset_description || '-') + '</td><td class="px-3 py-1.5 text-gray-500">' + escapeHtml(a.model || '-') + '</td><td class="px-3 py-1.5 font-mono text-gray-500">' + escapeHtml(a.serial_no || '-') + '</td><td class="px-3 py-1.5 text-center"><span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ' + statusColor + ' border"><span class="w-1.5 h-1.5 rounded-full ' + (a.status === "Checkout" ? 'bg-amber-500' : 'bg-green-500') + ' inline-block"></span>' + a.status + '</span></td><td class="px-3 py-1.5 text-center"><button onclick="reconciliationCheckin(' + a.id + ',' + a.departed_asset_id + ",'" + a.asset_tag_id + "')" + '" class="px-2 py-1 bg-teal-100 hover:bg-teal-200 text-teal-700 rounded text-[10px] font-bold border border-teal-200 transition-colors cursor-pointer">Checkin</button></td>';
                        tbody.appendChild(tr);
                    });
                    table.appendChild(tbody);
                    personBlock.appendChild(table);
                }
                wrapper.appendChild(personBlock);
            });
            body.appendChild(wrapper);
        }
        card.appendChild(body);
        container.appendChild(card);
    });
}

function toggleReconciliationForm() {
    const form = document.getElementById("reconciliationForm");
    form.classList.toggle("hidden");
    if (!form.classList.contains("hidden")) {
        document.getElementById("reconciliationFile").value = "";
        document.getElementById("reconciliationError").classList.add("hidden");
    }
}

function cancelReconciliationUpload() {
    document.getElementById("reconciliationForm").classList.add("hidden");
}

function setupReconciliationFormListener() {
    document.getElementById("reconciliationUploadForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById("reconciliationFile");
        const errorDiv = document.getElementById("reconciliationError");
        errorDiv.classList.add("hidden");
        if (!fileInput.files.length) { alert("Seleccione un archivo Excel"); return; }

        const formData = new FormData();
        formData.append("file", fileInput.files[0]);

        try {
            const res = await api("/employees/reconcile/", { method: "POST", body: formData });
            if (!res.ok) {
                const err = await res.json().catch(()=>({detail:"Error desconocido"}));
                errorDiv.textContent = "Error: " + (err.detail || "No se pudo procesar");
                errorDiv.classList.remove("hidden");
                return;
            }
            document.getElementById("reconciliationForm").classList.add("hidden");
            loadReconciliationStatus();
        } catch (e) {
            errorDiv.textContent = "Error de conexion: " + e.message;
            errorDiv.classList.remove("hidden");
        }
    });
}

function reconciliationCheckin(assetId, departedAssetId, assetTag) {
    window.__reconciliationAfterCheckin = { assetId: assetId, departedAssetId: departedAssetId };
    openModal(assetId, assetTag, "checkin");
}

function processReconciliationAfterCheckin() {
    if (!window.__reconciliationAfterCheckin) return;
    const { assetId, departedAssetId } = window.__reconciliationAfterCheckin;
    window.__reconciliationAfterCheckin = null;

    api("/employees/reconciliation/" + departedAssetId + "/clear/", { method: "POST" }).then(res => {
        if (res.ok) loadReconciliationStatus();
    }).catch(() => {});
}

function toggleSessionAssetList(sessionId) {
    const body = document.getElementById("sessionAssets-" + sessionId);
    const icon = document.getElementById("sessionToggleIcon-" + sessionId);
    if (!body) return;
    if (body.style.maxHeight === "0px" || !body.style.maxHeight || body.style.maxHeight === "") {
        body.style.maxHeight = body.scrollHeight + "px";
        if (icon) icon.style.transform = "rotate(90deg)";
    } else {
        body.style.maxHeight = "0px";
        if (icon) icon.style.transform = "";
    }
}

// ==========================================
// REPORTE PERSONALIZADO
// ==========================================
let crSelectedFields = [];
let crSavedReportId = null;
let crLastResult = { headers: [], keys: [], data: [] };

function crLoadFields() {
    api("/api/custom-reports/fields/").then(r => r.ok ? r.json() : []).then(groups => {
        const container = document.getElementById("crFieldGroups");
        if (!container) return;
        container.innerHTML = "";
        groups.forEach(g => {
            const groupDiv = document.createElement("div");
            groupDiv.className = "border border-gray-100 rounded p-1.5";
            const title = document.createElement("div");
            title.className = "text-[10px] font-bold text-gray-500 uppercase mb-1 px-1";
            title.textContent = g.group;
            groupDiv.appendChild(title);
            g.fields.forEach(f => {
                const label = document.createElement("label");
                label.className = "flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-700 hover:text-gray-900 px-1 py-0.5 rounded hover:bg-gray-50";
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.className = "cr-field-cb";
                cb.value = f.key;
                cb.checked = crSelectedFields.includes(f.key);
                cb.onchange = () => crToggleField(f.key);
                label.appendChild(cb);
                label.appendChild(document.createTextNode(f.label));
                groupDiv.appendChild(label);
            });
            container.appendChild(groupDiv);
        });
    });
}

function crToggleField(key) {
    const idx = crSelectedFields.indexOf(key);
    if (idx >= 0) {
        crSelectedFields.splice(idx, 1);
    } else {
        crSelectedFields.push(key);
    }
}

function crGetFilterValues() {
    return {
        status: document.getElementById("cr_status").value || null,
        category: document.getElementById("cr_category").value || null,
        site_id: document.getElementById("cr_site").value ? parseInt(document.getElementById("cr_site").value) : null,
        department_id: document.getElementById("cr_dept").value ? parseInt(document.getElementById("cr_dept").value) : null,
        date_from: document.getElementById("cr_date_from").value || null,
        date_to: document.getElementById("cr_date_to").value || null,
        date_field: document.getElementById("cr_date_field").value,
        text_search: document.getElementById("cr_text_search").value || null,
        cost_min: document.getElementById("cr_cost_min").value ? parseFloat(document.getElementById("cr_cost_min").value) : null,
        cost_max: document.getElementById("cr_cost_max").value ? parseFloat(document.getElementById("cr_cost_max").value) : null,
        person_id: document.getElementById("cr_person_id").value ? parseInt(document.getElementById("cr_person_id").value) : null,
    };
}

async function crRunReport() {
    if (crSelectedFields.length === 0) {
        showToast("Seleccione al menos un campo para el reporte.", "error");
        return;
    }
    const filters = crGetFilterValues();
    const body = { fields: crSelectedFields, ...filters };
    const res = await api("/api/custom-reports/run/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    if (!res.ok) { showToast("Error al generar reporte", "error"); return; }
    const data = await res.json();
    crLastResult = data;
    document.getElementById("crCount").textContent = data.count + " Resultados";
    const thead = document.getElementById("crResultsHead");
    const tbody = document.getElementById("crResultsBody");
    thead.innerHTML = data.headers.map(h => `<th class="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase whitespace-nowrap">${h}</th>`).join("");
    if (data.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="' + data.headers.length + '" class="px-3 py-6 text-center text-gray-400 italic">No se encontraron resultados.</td></tr>';
    } else {
        tbody.innerHTML = data.data.map(row => {
            const cells = data.keys.map(k => {
                let val = row[k];
                if (val === null || val === undefined) return '<td class="px-3 py-2 text-gray-400">-</td>';
                const s = String(val);
                if (s.length > 100) return '<td class="px-3 py-2 text-gray-700 max-w-xs truncate" title="' + escapeHtml(s) + '">' + escapeHtml(s.substring(0, 100)) + '...</td>';
                return '<td class="px-3 py-2 text-gray-700">' + escapeHtml(s) + '</td>';
            }).join("");
            return "<tr class='hover:bg-gray-50/50'>" + cells + "</tr>";
        }).join("");
    }
}

function crClearFilters() {
    document.getElementById("cr_status").value = "";
    document.getElementById("cr_category").value = "";
    document.getElementById("cr_site").value = "";
    document.getElementById("cr_dept").value = "";
    document.getElementById("cr_text_search").value = "";
    document.getElementById("cr_cost_min").value = "";
    document.getElementById("cr_cost_max").value = "";
    document.getElementById("cr_date_from").value = "";
    document.getElementById("cr_date_to").value = "";
    document.getElementById("cr_date_field").value = "purchase_date";
    document.getElementById("cr_person_search").value = "";
    document.getElementById("cr_person_id").value = "";
}

function crExportCSV() {
    if (crSelectedFields.length === 0) { showToast("Genere un reporte primero.", "error"); return; }
    const filters = crGetFilterValues();
    const params = new URLSearchParams();
    params.set("fields", crSelectedFields.join(","));
    Object.entries(filters).forEach(([k, v]) => { if (v !== null && v !== "") params.set(k, v); });
    const token = getToken();
    fetch("/api/custom-reports/export-csv/?" + params.toString(), {
        headers: token ? { "Authorization": "Bearer " + token } : {}
    }).then(r => {
        if (!r.ok) { showToast("Error al exportar", "error"); return; }
        return r.blob();
    }).then(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "reporte_personalizado.csv";
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    });
}

function crSaveDialog() {
    if (crSelectedFields.length === 0) { showToast("Seleccione campos para guardar.", "error"); return; }
    const name = prompt("Nombre del reporte:", crSavedReportId ? "Reporte " + crSavedReportId : "");
    if (!name) return;
    const filters = JSON.stringify(crGetFilterValues());
    const method = crSavedReportId ? "PUT" : "POST";
    const url = crSavedReportId ? "/api/custom-reports/saved/" + crSavedReportId : "/api/custom-reports/saved/";
    const body = crSavedReportId
        ? JSON.stringify({ name, fields: crSelectedFields, filters })
        : JSON.stringify({ name, fields: crSelectedFields, filters });
    api(url, { method, headers: { "Content-Type": "application/json" }, body }).then(r => {
        if (!r.ok) { showToast("Error al guardar", "error"); return; }
        showToast("Reporte guardado.", "success");
        crLoadSavedList();
    });
}

function crDeleteSaved() {
    const sel = document.getElementById("crSavedReports");
    const id = parseInt(sel.value);
    if (!id) { showToast("Seleccione un reporte guardado.", "error"); return; }
    if (!confirm("Eliminar este reporte guardado?")) return;
    api("/api/custom-reports/saved/" + id, { method: "DELETE" }).then(r => {
        if (!r.ok) { showToast("Error al eliminar", "error"); return; }
        showToast("Reporte eliminado.", "success");
        crSavedReportId = null;
        crLoadSavedList();
    });
}

async function crLoadSavedList() {
    const res = await api("/api/custom-reports/saved/");
    if (!res.ok) return;
    const reports = await res.json();
    const sel = document.getElementById("crSavedReports");
    sel.innerHTML = '<option value="">-- Seleccione --</option>';
    reports.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = r.name;
        sel.appendChild(opt);
    });
}

function crLoadFilterDropdowns() {
    const catSel = document.getElementById("cr_category");
    const siteSel = document.getElementById("cr_site");
    const deptSel = document.getElementById("cr_dept");
    if (catSel && catSel.options.length <= 1) {
        catSel.innerHTML = '<option value="">-- Todas --</option>';
        const cats = [...new Set(currentAssets.filter(a => a.category).map(a => a.category))];
        cats.sort().forEach(c => { catSel.innerHTML += `<option value="${c}">${c}</option>`; });
    }
    if (siteSel && siteSel.options.length <= 1) {
        siteSel.innerHTML = '<option value="">-- Todos --</option>';
        globalSites.forEach(s => { siteSel.innerHTML += `<option value="${s.id}">${s.site_name}</option>`; });
    }
    if (deptSel && deptSel.options.length <= 1) {
        deptSel.innerHTML = '<option value="">-- Todos --</option>';
        globalDepartments.forEach(d => { deptSel.innerHTML += `<option value="${d.id}">${d.department_name}</option>`; });
    }
}

function initCrPersonAutocomplete() {
    const input = document.getElementById("cr_person_search");
    const hidden = document.getElementById("cr_person_id");
    const results = document.getElementById("cr_person_results");
    if (!input) return;
    let timeout = null;
    input.addEventListener("input", function() {
        clearTimeout(timeout);
        const q = this.value.trim();
        if (q.length < 2) { results.classList.add("hidden"); results.innerHTML = ""; hidden.value = ""; return; }
        timeout = setTimeout(() => {
            const filtered = globalPersons.filter(p =>
                p.full_name.toLowerCase().includes(q.toLowerCase()) ||
                (p.email && p.email.toLowerCase().includes(q.toLowerCase())) ||
                (p.employee_id && p.employee_id.toLowerCase().includes(q.toLowerCase()))
            ).slice(0, 10);
            if (filtered.length === 0) { results.classList.add("hidden"); results.innerHTML = ""; return; }
            results.innerHTML = filtered.map(p =>
                `<div class="px-3 py-2 hover:bg-blue-50 cursor-pointer text-xs border-b border-gray-100 last:border-0" onclick="crSelectPerson(${p.id},'${escapeHtml(p.full_name)}')">${escapeHtml(p.full_name)} <span class="text-gray-400">(${escapeHtml(p.email)})</span></div>`
            ).join("");
            results.classList.remove("hidden");
        }, 200);
    });
    input.addEventListener("blur", function() { setTimeout(() => results.classList.add("hidden"), 200); });
    input.addEventListener("focus", function() { if (results.innerHTML) results.classList.remove("hidden"); });
}

function crSelectPerson(id, name) {
    document.getElementById("cr_person_id").value = id;
    document.getElementById("cr_person_search").value = name;
    document.getElementById("cr_person_results").classList.add("hidden");
}

function crLoadSaved() {
    const sel = document.getElementById("crSavedReports");
    const id = parseInt(sel.value);
    if (!id) { crSavedReportId = null; return; }
    crSavedReportId = id;
    api("/api/custom-reports/saved/").then(r => r.ok ? r.json() : []).then(reports => {
        const r = reports.find(x => x.id === id);
        if (!r) return;
        const fields = JSON.parse(r.fields);
        crSelectedFields = fields;
        crRunReport();
        crLoadFields();
        if (r.filters) {
            try {
                const f = JSON.parse(r.filters);
                document.getElementById("cr_status").value = f.status || "";
                document.getElementById("cr_category").value = f.category || "";
                document.getElementById("cr_site").value = f.site_id || "";
                document.getElementById("cr_dept").value = f.department_id || "";
                document.getElementById("cr_text_search").value = f.text_search || "";
                document.getElementById("cr_cost_min").value = f.cost_min || "";
                document.getElementById("cr_cost_max").value = f.cost_max || "";
                document.getElementById("cr_date_from").value = f.date_from || "";
                document.getElementById("cr_date_to").value = f.date_to || "";
                document.getElementById("cr_date_field").value = f.date_field || "purchase_date";
                if (f.person_id) {
                    document.getElementById("cr_person_id").value = f.person_id;
                }
            } catch (e) {}
        }
    });
}

async function refreshReconciliation() {
    const res = await api("/employees/reconciliation/refresh/", { method: "POST" });
    if (res.ok) {
        const data = await res.json();
        alert(data.reactivated + " registro(s) reactivado(s) por reasignacion.");
        loadReconciliationStatus();
    }
}
