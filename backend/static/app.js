const API_URL = "";

let currentAssets = [];
let globalSites = [];
let globalPersons = [];
let globalAdmins = [];
let globalDepartments = [];
let currentReportResults = [];
let currentCtfResults = [];
let currentSrResults = [];
let currentAssetPage = 1;
let currentEmployeePage = 1;
let currentHistoryPage = 1;
let totalAssets = 0;

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
        localStorage.removeItem("adminSession");
        window.location.reload();
        throw new Error("Sesion expirada");
    }
    return response;
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
    document.getElementById("report_person_id").addEventListener("change", function () {
        updatePersonInfo();
        loadCheckoutReport();
    });
}

function buildAssetQuery() {
    const search = document.getElementById("searchInput").value;
    const status = document.getElementById("filterStatus").value;
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

async function loadAssets() {
    const tableBody = document.getElementById("assetsTableBody");
    const pageInfo = document.getElementById("assetsPageInfo");
    const pageInfoAux = document.getElementById("assetsPageInfoAux");
    const prevBtn = document.querySelector("#assetsSection .flex.justify-between button:first-child");
    const nextBtn = document.querySelector("#assetsSection .flex.justify-between button:last-child");
    const pageSize = parseInt(document.getElementById("assetsPageSize").value);
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
        tableBody.innerHTML = "";
        const inactiveStatuses = ["Archived","Broken","Lost","Disposed","Donate","Sold"];
        const activeAssets = currentAssets.filter(a => !inactiveStatuses.includes(a.status));
        if (activeAssets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="12" class="px-4 py-6 text-center text-gray-400 italic">No hay activos vigentes en el inventario.</td></tr>`;
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

        const siteName = sid => { const s = globalSites.find(x => x.id === sid); return s ? s.site_name : ''; };
        const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : '';
        activeAssets.forEach(asset => {
            const row = document.createElement("tr");
            row.className = "hover:bg-blue-50/50 transition-colors cursor-pointer group";
            row.onclick = () => openDetailsModal(asset.id);
            
            let badgeColor = "bg-green-100 text-green-800";
            if (asset.status === "Checkout") badgeColor = "bg-blue-100 text-blue-800";

            const assignedPerson = (asset.status === "Checkout" && asset.person_id) ? globalPersons.find(p => p.id === asset.person_id) : null;
            const assignedName = assignedPerson ? assignedPerson.full_name : '';

            let actionButton = `<button onclick="openModal('${asset.id}', '${asset.asset_tag_id}', 'checkout')" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded shadow transition-colors cursor-pointer">Check-out</button>`;
            if (asset.status === "Checkout") {
                actionButton = `<button onclick="openModal('${asset.id}', '${asset.asset_tag_id}', 'checkin')" class="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-1 px-3 rounded shadow transition-colors cursor-pointer">Check-in</button>`;
            }

            row.innerHTML = `
                <td class="px-4 py-3 font-mono font-bold text-gray-700 group-hover:text-blue-600">${asset.asset_tag_id}</td>
                <td class="px-4 py-3 text-gray-600">${asset.asset_description}</td>
                <td class="px-4 py-3 text-gray-500">${asset.brand} ${asset.model}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeColor}">
                        ${asset.status}
                    </span>
                </td>
                <td class="px-4 py-3 text-gray-600 text-xs">${assignedName}</td>
                <td class="px-4 py-3 text-center" onclick="event.stopPropagation();">${actionButton}</td>
                <td data-col="serie" class="px-4 py-3 text-gray-500 font-mono">${asset.serial_no}</td>
                <td data-col="category" class="px-4 py-3 text-gray-500">${asset.category || ''}</td>
                <td data-col="site" class="px-4 py-3 text-gray-500">${siteName(asset.site_id)}</td>
                <td data-col="phone" class="px-4 py-3 text-gray-500">${asset.numero_telefono || ''}</td>
                <td data-col="vendor" class="px-4 py-3 text-gray-500">${asset.purchased_from || ''}</td>
                <td data-col="date" class="px-4 py-3 text-gray-500">${fmtDate(asset.purchase_date)}</td>
            `;
            tableBody.appendChild(row);
        });
        applyColumnPreferences();
    } catch (e) { tableBody.innerHTML = `<tr><td colspan="12" class="px-4 py-6 text-center text-red-500 font-medium">Error de conexion con el servidor backend</td></tr>`; }
}

async function openDetailsModal(assetId) {
    let asset;
    try {
        const res = await api(`/assets/${assetId}`);
        if (res.ok) asset = await res.json();
    } catch (e) {}
    if (!asset) return;

    document.getElementById("assetSpecificHistoryWrapper").classList.add("hidden");
    document.getElementById("historyToggleIcon").innerText = "Mostrar";

    const siteObj = globalSites.find(s => s.id === asset.site_id);
    const employeeObj = globalPersons.find(p => p.id === asset.person_id);

    document.getElementById("detailsTag").innerText = `Asset Tag ID: ${asset.asset_tag_id}`;
    document.getElementById("det_description").innerText = asset.asset_description;
    document.getElementById("det_brand_model").innerText = `${asset.brand} - ${asset.model}`;
    document.getElementById("det_serial").innerText = asset.serial_no;
    
    document.getElementById("det_category").innerText = asset.category || "-";
    
    const statusElement = document.getElementById("det_status");
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

    const containerAsignado = document.getElementById("det_assigned_container");
    if (asset.status === "Checkout" && employeeObj) {
        containerAsignado.innerHTML = `
            <button onclick="openUserAssetsModal('${employeeObj.id}', '${employeeObj.full_name}')" class="w-full text-left bg-blue-50 border border-blue-200 rounded p-2 text-blue-700 font-semibold hover:bg-blue-100 transition-colors cursor-pointer block flex justify-between items-center">
                <span>${employeeObj.full_name} (${employeeObj.title || 'Personal'})</span>
                <span class="text-[10px] bg-blue-600 text-white font-bold py-0.5 px-1.5 rounded uppercase tracking-wide">Ver Asignados </span>
            </button>`;
    } else if (asset.status !== "Checkout") {
        containerAsignado.innerHTML = `<p class="text-blue-700 font-medium p-1 bg-blue-50 border border-blue-100 rounded mb-2">Status: ${asset.status}</p><button onclick="closeDetailsModal();openModal('${asset.id}','${asset.asset_tag_id}','checkout')" class="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-3 rounded shadow transition-colors cursor-pointer">Realizar Check-out</button>`;
    } else {
        containerAsignado.innerHTML = `<p class="text-green-700 font-medium p-1 bg-green-50 border border-green-100 rounded">Disponible en Almacen</p>`;
    }

    var repairBlock = document.getElementById("det_repair_block");
    if (asset.status === "Under repair" || asset.status === "GarantiaSD") {
        repairBlock.classList.remove("hidden");
        document.getElementById("det_repair_reason").innerText = asset.repair_reason || "-";
        var leftPerson = globalPersons.find(function (p) { return p.id === asset.repair_left_by_id; });
        document.getElementById("det_repair_left_by").innerText = leftPerson ? leftPerson.full_name + " (" + leftPerson.employee_id + ")" : "-";
        var tech = globalAdmins.find(function (a) { return a.id === asset.repair_technician_id; });
        document.getElementById("det_repair_technician").innerText = tech ? tech.username : "-";
    } else {
        repairBlock.classList.add("hidden");
    }

    document.getElementById("btn_delete_asset").onclick = () => triggerDeleteAsset(asset.id, asset.asset_tag_id);
    document.getElementById("btn_edit_asset").onclick = () => openEditAssetModal(asset.id);

    const historyBody = document.getElementById("assetSpecificHistoryBody");
    historyBody.innerHTML = `<tr><td colspan="4" class="px-3 py-4 text-center text-gray-400 italic">Buscando...</td></tr>`;

    try {
        const response = await api("/history/");
        if (response.ok) {
            const allHistory = await response.json();
            const specificHistory = allHistory.filter(h => h.asset_id === asset.id);
            historyBody.innerHTML = "";
            if (specificHistory.length === 0) {
                historyBody.innerHTML = `<tr><td colspan="4" class="px-3 py-3 text-center text-gray-400 italic">Sin movimientos registrados.</td></tr>`;
            } else {
                specificHistory.reverse();
                specificHistory.forEach(item => {
                    const row = document.createElement("tr");
                    const fecha = new Date(item.fecha_accion).toLocaleString('es-ES');
                    let actionClass = item.tipo_accion === "Checkout" ? "text-blue-600 font-bold" : (item.tipo_accion === "Archived" ? "text-red-600 font-bold" : "text-amber-600 font-bold");
                    row.innerHTML = `<td class="px-3 py-1.5 text-gray-400 text-[11px]">${fecha}</td><td class="px-3 py-1.5 uppercase ${actionClass}">${item.tipo_accion}</td><td class="px-3 py-1.5 text-gray-500">Admin_${item.realizado_por_id}</td><td class="px-3 py-1.5 text-gray-700 italic">${item.notas_detalle || '-'}</td>`;
                    historyBody.appendChild(row);
                });
            }
        }
    } catch (e) { console.error(e); }

    document.getElementById("detailsModal").classList.remove("hidden");
}

function closeDetailsModal() { document.getElementById("detailsModal").classList.add("hidden"); }

function toggleSpecificHistory() {
    const wrapper = document.getElementById("assetSpecificHistoryWrapper");
    const icon = document.getElementById("historyToggleIcon");
    if (wrapper.classList.contains("hidden")) { wrapper.classList.remove("hidden"); icon.innerText = "Ocultar"; } 
    else { wrapper.classList.add("hidden"); icon.innerText = "Mostrar"; }
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
                row.innerHTML = '<td class="px-3 py-2 font-bold text-blue-600">' + dev.asset_tag_id + '</td><td class="px-3 py-2 text-gray-600">' + (dev.asset_description || "-") + '</td><td class="px-3 py-2 text-gray-500">' + (dev.brand || "") + " " + (dev.model || "") + '</td><td class="px-3 py-2 font-bold text-gray-400">' + (dev.serial_no || "-") + '</td>';
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
        if (response.ok) { alert(`El activo ${assetTag} ha sido restaurado exitosamente al almacen.`); closeDeletedAssetsModal(); loadAssets(); loadHistory(); }
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
                alert("Modificado con exito!");
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
        if (response.ok) { alert("Movido a la papelera correctamente."); closeDetailsModal(); loadAssets(); loadHistory(); }
    } catch (e) { alert("Error."); }
}

async function loadHistory() {
    const historyBody = document.getElementById("historyTableBody");
    const pageSize = parseInt(document.getElementById("historyPageSize").value);
    const pageInfo = document.getElementById("historyPageInfo");
    const pageInfoAux = document.getElementById("historyPageInfoAux");
    const prevBtn = document.querySelector("#historySection .flex.justify-between button:first-child");
    const nextBtn = document.querySelector("#historySection .flex.justify-between button:last-child");
    try {
        const [countRes, listRes] = await Promise.all([
            api("/history/count/"),
            api(`/history/?skip=${(currentHistoryPage - 1) * pageSize}&limit=${pageSize}`)
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
            const assetObj = currentAssets.find(a => a.id === item.asset_id);
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
            row.innerHTML = `<td class="px-4 py-2 text-gray-500 whitespace-nowrap align-top">${fecha}</td><td class="px-4 py-2 uppercase ${actionBadge} align-top">${item.tipo_accion}</td><td class="px-4 py-2 font-bold text-gray-700 align-top cursor-pointer hover:text-blue-600" onclick="openDetailsModal(${item.asset_id})">${assetObj ? assetObj.asset_tag_id : 'ID: ' + item.asset_id}</td><td class="px-4 py-2 text-gray-600 align-top">${employeeObj ? employeeObj.full_name : (item.asignado_a_id ? 'ID: ' + item.asignado_a_id : 'Almacen')}</td><td class="px-4 py-2 text-gray-600 align-top">Admin_${item.realizado_por_id}</td>`;
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

async function loadPersons() {
    try {
        const res = await api("/persons/");
        if (!res.ok) throw new Error("Error");
        globalPersons = await res.json();
        renderEmployeesPage();
    } catch (e) { document.getElementById("personsTableBody").innerHTML = '<tr><td colspan="8" class="px-4 py-6 text-center text-red-500 font-medium">Error al cargar empleados</td></tr>'; }
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
        tableBody.innerHTML = '<tr><td colspan="8" class="px-4 py-6 text-center text-gray-400 italic">No hay empleados registrados.</td></tr>';
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
        row.className = "hover:bg-teal-50/50 transition-colors";
            row.innerHTML = `
                <td class="px-4 py-3 font-medium text-gray-800">${p.full_name}</td>
                <td class="px-4 py-3 text-gray-500">${p.email}</td>
                <td class="px-4 py-3 text-gray-600 font-mono">${p.employee_id}</td>
                <td data-col="dept" class="px-4 py-3 text-gray-600">${dept ? dept.department_name : '-'}</td>
                <td data-col="site" class="px-4 py-3 text-gray-600">${site ? site.site_name : '-'}</td>
                <td data-col="phone" class="px-4 py-3 text-gray-500">${p.phone || '-'}</td>
                <td data-col="notes" class="px-4 py-3 text-gray-500">${p.notes || '-'}</td>
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
            site_id: parseInt(document.getElementById("edit_person_site_id").value)
        };
        try {
            const res = await api(`/persons/${id}`, { method: "PUT", body: JSON.stringify(data) });
            if (res.ok) {
                alert("Empleado actualizado correctamente!");
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
                alert("Sitio actualizado!"); closeEditSiteModal();
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
                alert("Departamento actualizado!"); closeEditDepartmentModal();
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
                alert("Movimiento procesado con exito!"); 
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
        try { const response = await api("/assets/", { method: "POST", body: JSON.stringify(assetData) }); if (response.status === 201) { alert("Activo registrado con exito!"); closeAssetModal(); loadAssets(); } } catch (error) { alert("Error."); }
    });
}

function setupPersonFormListener() {
    document.getElementById("personForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const personData = { full_name: document.getElementById("person_full_name").value, email: document.getElementById("person_email").value, employee_id: document.getElementById("person_employee_id").value, title: document.getElementById("person_title").value || null, phone: document.getElementById("person_phone").value || null, notes: document.getElementById("person_notes").value || null, site_id: parseInt(document.getElementById("person_site_id").value), department_id: parseInt(document.getElementById("person_department_id").value) };
        try { const response = await api("/persons/", { method: "POST", body: JSON.stringify(personData) }); if (response.status === 201) { alert("Empleado dado de alta!"); closePersonModal(); loadDropdownData(); } } catch (e) { alert("Error."); }
    });
}

function setupCatalogFormsListeners() {
    document.getElementById("form_add_site").addEventListener("submit", async (e) => { 
        e.preventDefault(); 
        try {
            const data = { site_name: document.getElementById("site_name_input").value, city: document.getElementById("site_city_input").value || null, country: document.getElementById("site_country_input").value || null }; 
            const res = await api("/sites/", { method: "POST", body: JSON.stringify(data) }); 
            if (res.ok) { 
                alert("Sitio creado!"); closeSiteModal(); document.getElementById("form_add_site").reset(); 
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
                alert("Departamento creado!"); closeDepartmentModal(); document.getElementById("form_add_department").reset();
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
                alert(editId ? "Categoria actualizada!" : "Categoria creada!");
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
            showSection('assets');
        } else {
            const err = await response.json();
            alert(`Acceso Denegado: ${err.detail || "Verifique sus datos."}`);
        }
    } catch (error) {
        alert("Error de conexion con el modulo de autenticacion.");
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
    const group = getGroup();
    if (admin) {
        document.getElementById("sidebarUserName").textContent = admin.username;
    }
    if (group) {
        document.getElementById("sidebarUserGroup").textContent = group.name;
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
        if (res.ok) { alert("Categoria eliminada"); loadCatalogs(); loadDropdownData(); }
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
    const sections = ['dashboard', 'assets', 'employees', 'catalogs', 'history', 'reports', 'checkoutTimeframe', 'statusReports', 'deliveryBoard', 'deliveryEmployees', 'deliveryAdd', 'users', 'enReparacion', 'listadoInactivos', 'brokenAssets', 'lostAssets', 'disposedAssets', 'donateAssets', 'soldAssets', 'importExport', 'employeeReconciliation'];
    sections.forEach(s => {
        const el = document.getElementById(s + 'Section');
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(name + 'Section');
    if (target) target.classList.remove('hidden');
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
    document.getElementById("mainContent").scrollTo({ top: 0, behavior: "smooth" });
    // highlight active sidebar item
    document.querySelectorAll('.sidebar-item[data-section], .sidebar-sub-item[data-section], .sidebar-nested-item[data-section]').forEach(el => el.classList.remove('active'));
    const active = document.querySelector(`.sidebar-item[data-section="${name}"]`) || document.querySelector(`.sidebar-sub-item[data-section="${name}"]`) || document.querySelector(`.sidebar-nested-item[data-section="${name}"]`);
    if (active) active.classList.add('active');
}

function showAdvancedSearch() {
    const sections = ['dashboard', 'assets', 'employees', 'catalogs', 'history', 'reports', 'checkoutTimeframe', 'statusReports', 'deliveryBoard', 'deliveryEmployees', 'deliveryAdd', 'users', 'enReparacion', 'listadoInactivos', 'brokenAssets', 'lostAssets', 'disposedAssets', 'donateAssets', 'soldAssets', 'importExport', 'employeeReconciliation'];
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
    const personSel = document.getElementById("adv_person");
    siteSel.innerHTML = '<option value="">Todos los Sitios</option>';
    globalSites.forEach(s => { siteSel.innerHTML += `<option value="${s.id}">${s.site_name}</option>`; });
    catSel.innerHTML = '<option value="">Todas las Categorias</option>';
    const cats = [...new Set(currentAssets.filter(a => a.category).map(a => a.category))];
    cats.forEach(c => { catSel.innerHTML += `<option value="${c}">${c}</option>`; });
    deptSel.innerHTML = '<option value="">Todos los Departamentos</option>';
    globalDepartments.forEach(d => { deptSel.innerHTML += `<option value="${d.id}">${d.department_name}</option>`; });
    personSel.innerHTML = '<option value="">Cualquier Persona</option>';
    globalPersons.forEach(p => { personSel.innerHTML += `<option value="${p.id}">${p.full_name} (${p.employee_id})</option>`; });
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
    const field = document.getElementById("adv_field").value;
    const site = document.getElementById("adv_site").value;
    const category = document.getElementById("adv_category").value;
    const department = document.getElementById("adv_department").value;
    const status = document.getElementById("adv_status").value;
    const person = document.getElementById("adv_person").value;
    const vendor = document.getElementById("adv_vendor").value;
    const limit = document.getElementById("adv_limit").value;
    const dateField = document.getElementById("adv_datefield").value;
    const dateRange = document.getElementById("adv_daterange").value;
    if (search) { params.set("search", search); params.set("search_condition", condition); params.set("search_field", field); }
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
    const tableBody = document.getElementById("assetsTableBody");
    const pageInfo = document.getElementById("assetsPageInfo");
    tableBody.innerHTML = '<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400 italic">Buscando...</td></tr>';
    try {
        const response = await api(`/assets/?${params.toString()}`);
        if (!response.ok) throw new Error("Error en el servidor");
        currentAssets = await response.json();
        currentAssetPage = 1;
        const pageInfoAux = document.getElementById("assetsPageInfoAux");
        if (pageInfoAux) pageInfoAux.textContent = "Pagina 1";
        tableBody.innerHTML = "";
        const activeAssets = currentAssets.filter(a => a.status !== "Archived");
        if (activeAssets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400 italic">Sin resultados para esta busqueda.</td></tr>`;
            pageInfo.textContent = "mostrando 0-0 de 0";
            return;
        }
        totalAssets = activeAssets.length;
        const start = 1;
        const end = activeAssets.length;
        pageInfo.textContent = `mostrando ${start}-${end} de ${totalAssets}`;
        const siteName = sid => { const s = globalSites.find(x => x.id === sid); return s ? s.site_name : ''; };
        const fmtDate = d => d ? new Date(d).toLocaleDateString('es-ES') : '';
        activeAssets.forEach(asset => {
            const row = document.createElement("tr");
            row.className = "hover:bg-blue-50/50 transition-colors cursor-pointer group";
            row.onclick = () => openDetailsModal(asset.id);
            let badgeColor = "bg-green-100 text-green-800";
            if (asset.status === "Checkout") { badgeColor = "bg-blue-100 text-blue-800"; }
            else if (["Broken", "Lost/Missing", "Dispose"].includes(asset.status)) { badgeColor = "bg-red-100 text-red-800"; }
            else if (asset.status === "Under repair" || asset.status === "GarantiaSD") { badgeColor = "bg-amber-100 text-amber-800"; }
            else if (["Reserved"].includes(asset.status)) { badgeColor = "bg-purple-100 text-purple-800"; }
            row.innerHTML = `
                <td class="px-4 py-3 font-mono font-bold text-blue-600">${asset.asset_tag_id}</td>
                <td class="px-4 py-3">${asset.asset_description}</td>
                <td class="px-4 py-3">${asset.brand} - ${asset.model}</td>
                <td class="px-4 py-3"><span class="px-2 py-1 inline-flex text-[11px] leading-5 font-semibold rounded-full ${badgeColor}">${asset.status}</span></td>
                <td class="px-4 py-3 text-center">
                    <button onclick="event.stopPropagation(); openDetailsModal(${asset.id})" class="text-[11px] font-bold text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-300 px-2.5 py-1 rounded transition-all cursor-pointer">Ver</button>
                </td>
                <td data-col="serie" class="px-4 py-3 text-gray-500 font-mono">${asset.serial_no}</td>
                <td data-col="category" class="px-4 py-3 text-gray-500">${asset.category || ''}</td>
                <td data-col="site" class="px-4 py-3 text-gray-500">${siteName(asset.site_id)}</td>
                <td data-col="phone" class="px-4 py-3 text-gray-500">${asset.numero_telefono || ''}</td>
                <td data-col="vendor" class="px-4 py-3 text-gray-500">${asset.purchased_from || ''}</td>
                <td data-col="date" class="px-4 py-3 text-gray-500">${fmtDate(asset.purchase_date)}</td>`;
            tableBody.appendChild(row);
        });
        applyColumnPreferences();
    } catch (e) {
        tableBody.innerHTML = '<tr><td colspan="11" class="px-4 py-6 text-center text-red-500 font-medium">Error de conexion</td></tr>';
    }
}

function cancelAdvancedSearch() {
    document.getElementById("advancedSearchPanel").classList.add("hidden");
    document.getElementById("adv_search").value = "";
    document.getElementById("adv_condition").value = "contains";
    document.getElementById("adv_field").value = "asset_tag_id";
    document.getElementById("adv_site").value = "";
    document.getElementById("adv_category").value = "";
    document.getElementById("adv_department").value = "";
    document.getElementById("adv_status").value = "";
    document.getElementById("adv_person").value = "";
    document.getElementById("adv_vendor").value = "";
    document.getElementById("adv_limit").value = "250";
    document.getElementById("adv_datefield").value = "purchase_date";
    document.getElementById("adv_quickdate").value = "";
    document.getElementById("adv_daterange").value = "";
    loadAssets();
}

async function updateDashboard() {
    try {
        const resAssets = await api("/assets/?limit=9999");
        const resPersons = await api("/persons/");
        const resHistory = await api("/history/");
        const resDeliveries = await api("/deliveries/pending");
        if (resAssets.ok) {
            const assets = await resAssets.json();
            const active = assets.filter(a => !["Archived","Broken","Lost","Disposed","Donate","Sold"].includes(a.status));
            document.getElementById("dashAssetCount").textContent = active.length;
            document.getElementById("dashCheckoutCount").textContent = active.filter(a => a.status === "Checkout").length;
            document.getElementById("dashCheckinCount").textContent = active.filter(a => a.status === "Available").length;
            const cats = {};
            active.forEach(a => { if (a.category) { cats[a.category] = (cats[a.category] || 0) + 1; } });
            const catKeys = Object.keys(cats);
            document.getElementById("dashCategoryCount").textContent = catKeys.length;
            const catBody = document.getElementById("dashCategoryBody");
            catBody.innerHTML = "";
            catKeys.sort().forEach(c => {
                const row = document.createElement("tr");
                row.className = "border-b border-gray-100 hover:bg-gray-100 cursor-pointer";
                row.onclick = () => goToAssetsFiltered("category", c);
                row.innerHTML = `<td class="py-1.5 px-2 text-gray-700">${c}</td><td class="py-1.5 px-2 text-gray-700 text-right font-bold">${cats[c]}</td>`;
                catBody.appendChild(row);
            });
        }
        if (resPersons.ok) {
            const persons = await resPersons.json();
            document.getElementById("dashPersonCount").textContent = persons.length;
        }
        if (resHistory.ok) {
            const history = await resHistory.json();
            const recent = history.slice(-5).reverse();
            const tbody = document.getElementById("dashRecentActivity");
            tbody.innerHTML = "";
            if (recent.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="py-3 text-center text-gray-400 italic">Sin actividad.</td></tr>';
            } else {
                recent.forEach(item => {
                    const row = document.createElement("tr");
                    row.className = "hover:bg-gray-50 cursor-pointer";
                    row.onclick = () => { showSection("history"); };
                    const fecha = new Date(item.fecha_accion).toLocaleString('es-ES');
                    const assetObj = (typeof currentAssets !== 'undefined' ? currentAssets : []).find(a => a.id === item.asset_id);
                    const employeeObj = (typeof globalPersons !== 'undefined' ? globalPersons : []).find(p => p.id === item.asignado_a_id);
                    let badge = "text-blue-600 font-bold";
                    if (item.tipo_accion === "Check in") badge = "text-amber-600 font-bold";
                    if (item.tipo_accion === "Archived") badge = "text-red-600 font-bold";
                    row.innerHTML = `<td class="py-2 px-3 text-gray-500 whitespace-nowrap">${fecha}</td><td class="py-2 px-3 uppercase ${badge}">${item.tipo_accion}</td><td class="py-2 px-3 font-bold text-gray-700">${assetObj ? assetObj.asset_tag_id : 'ID: ' + item.asset_id}</td><td class="py-2 px-3 text-gray-600">${employeeObj ? employeeObj.full_name : (item.asignado_a_id ? 'ID: ' + item.asignado_a_id : 'Almacen')}</td>`;
                    tbody.appendChild(row);
                });
            }
        }
        if (resDeliveries.ok) {
            const deliveries = await resDeliveries.json();
            const activePendings = deliveries.filter(d => d.status === "Active");
            document.getElementById("dashPendingCount").textContent = activePendings.length;
        }
    } catch (e) { console.error(e); }
}

function goToAssetsFiltered(filterKey, filterValue) {
    showSection('assets');
    currentAssetPage = 1;
    const statusSel = document.getElementById("filterStatus");
    const catSel = document.getElementById("filterCategory");
    if (filterKey === 'status' && statusSel) {
        statusSel.value = filterValue;
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
        alert(successCount + " entrega(s) pendiente(s) agregada(s) correctamente!");
        document.getElementById("deliveryForm").reset();
        document.querySelectorAll('.delivery-cat-qty').forEach(function (q) { q.disabled = true; });
        loadDeliveryBoard();
    } else {
        alert("Error al crear las entregas");
    }
}

async function loadDeliveryBoard() {
    const container = document.getElementById("deliveryBoardContainer");
    container.innerHTML = '<p class="text-center text-gray-400 italic py-8">Cargando tablero...</p>';
    try {
        const res = await api("/deliveries/summary");
        if (!res.ok) throw new Error("Error");
        const data = await res.json();
        const totalItems = data.reduce((sum, cat) => sum + cat.total_pending, 0);
        document.getElementById("deliveryBoardCount").textContent = totalItems + " Items";
        container.innerHTML = "";
        if (data.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-400 italic py-8">No hay entregas pendientes activas.</p>';
            return;
        }
        const wrapper = document.createElement("div");
        wrapper.className = "flex gap-4 overflow-x-auto pb-4";
        data.forEach(cat => {
            const col = document.createElement("div");
            col.className = "min-w-[280px] max-w-[300px] flex-shrink-0";
            const pendingCount = cat.total_pending;
            const availCount = cat.available;
            col.innerHTML = `
                <div class="bg-gray-50 rounded-lg border border-gray-200 p-3">
                    <div class="flex justify-between items-center mb-2">
                        <h3 class="text-sm font-bold text-gray-700">${cat.category}</h3>
                        <span class="text-xs font-bold text-gray-500">${pendingCount} pendiente${pendingCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="text-xs text-gray-400 mb-2">${availCount} disponible${availCount !== 1 ? 's' : ''} en almacen</div>
                    <div class="space-y-2 max-h-[400px] overflow-y-auto">`;
            cat.employees.forEach(emp => {
                col.innerHTML += `
                        <div class="bg-white rounded p-2 border border-gray-200 shadow-sm">
                            <div class="font-bold text-xs text-gray-700">${emp.person_name}</div>
                            <div class="text-[10px] text-gray-400">${emp.pending} pendiente${emp.pending !== 1 ? 's' : ''}</div>
                            ${emp.notes ? `<div class="text-[10px] text-gray-400 italic mt-1">${emp.notes}</div>` : ''}
                            <button onclick="openFulfillModal(${emp.delivery_id}, '${cat.category}', '${emp.person_name}')" class="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold py-1 px-2 rounded transition-colors cursor-pointer" ${availCount === 0 ? 'disabled' : ''}>Asignar</button>
                        </div>`;
            });
            col.innerHTML += `</div></div>`;
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
            alert(`Activo ${data.asset_tag} asignado exitosamente! (${data.fulfilled_count}/${data.total})`);
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
            alert("Entrega cancelada");
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
            { key: "notes", label: "Notas", col: "notes" }
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
        container.innerHTML = '<p class="text-xs text-gray-400 italic py-4 text-center">No hay sesiones de conciliacion. Haz clic en "+ Nueva Conciliacion" para comenzar.</p>';
        return;
    }
    data.sessions.forEach((session) => {
        const sessionId = session.session_id;
        const dateStr = session.uploaded_at ? new Date(session.uploaded_at).toLocaleDateString("es-DO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
        const pendingCount = session.pending_count;
        const hasPending = pendingCount > 0;

        const card = document.createElement("div");
        card.className = "border border-gray-200 rounded overflow-hidden";

        const header = document.createElement("button");
        header.className = "w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left cursor-pointer";
        header.setAttribute("onclick", "toggleSessionAssetList(" + sessionId + ")");
        header.innerHTML = `
            <div class="flex items-center gap-3 min-w-0">
                <svg class="w-4 h-4 shrink-0 ${hasPending ? 'text-amber-400' : 'text-green-400'}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"/></svg>
                <div class="min-w-0">
                    <span class="font-bold text-sm text-gray-800">Sesion del ${dateStr}</span>
                    <span class="text-xs text-gray-400 ml-2">${session.filename}</span>
                    <div class="text-[11px] text-gray-500">Subido por: ${session.uploaded_by} &middot; ${session.matched_count} coincidencias &middot; ${session.imported_count} importados</div>
                </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <span class="text-[10px] font-bold ${hasPending ? 'text-amber-600 bg-amber-50' : 'text-green-700 bg-green-100'} px-2 py-0.5 rounded-full">${pendingCount} pendiente(s)</span>
                <svg id="sessionToggleIcon-${sessionId}" class="w-3 h-3 text-gray-400 transition-transform" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/></svg>
            </div>
        `;
        card.appendChild(header);

        const body = document.createElement("div");
        body.id = "sessionAssets-" + sessionId;
        body.className = "hidden";

        if (session.departed.length === 0) {
            body.innerHTML = '<div class="px-4 py-3 text-xs text-gray-400 italic border-t border-gray-200">Sin empleados ausentes con activos en esta sesion.</div>';
        } else {
            const wrapper = document.createElement("div");
            wrapper.className = "border-t border-gray-200 divide-y divide-gray-100";
            session.departed.forEach((item) => {
                const p = item.person;
                const assets = item.assets;
                const pIsComplete = assets.length === 0;
                const personBlock = document.createElement("div");
                personBlock.className = "px-4 py-2";

                const personHeader = document.createElement("div");
                personHeader.className = "flex items-center justify-between py-1";
                personHeader.innerHTML = `
                    <div class="flex items-center gap-2">
                        <svg class="w-3.5 h-3.5 ${pIsComplete ? 'text-green-400' : 'text-red-400'}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg>
                        <span class="font-bold text-xs text-gray-800">${p.full_name}</span>
                        <span class="text-[10px] text-gray-400">${p.employee_id}</span>
                    </div>
                    ${pIsComplete ? '<span class="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Completado</span>' : '<span class="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">' + assets.length + ' activo(s)</span>'}
                `;
                personBlock.appendChild(personHeader);

                if (!pIsComplete) {
                    const table = document.createElement("table");
                    table.className = "min-w-full divide-y divide-gray-200 text-xs mt-2";
                    table.innerHTML = `
                        <thead class="bg-gray-100 text-gray-500">
                            <tr>
                                <th class="px-3 py-1.5 text-left font-bold uppercase text-[10px]">Tag</th>
                                <th class="px-3 py-1.5 text-left font-bold uppercase text-[10px]">Descripcion</th>
                                <th class="px-3 py-1.5 text-left font-bold uppercase text-[10px]">Modelo</th>
                                <th class="px-3 py-1.5 text-left font-bold uppercase text-[10px]">Serie</th>
                                <th class="px-3 py-1.5 text-left font-bold uppercase text-[10px]">Estado</th>
                                <th class="px-3 py-1.5 text-center font-bold uppercase text-[10px]">Acciones</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200 text-gray-700"></tbody>
                    `;
                    const tbody = table.querySelector("tbody");
                    assets.forEach((a) => {
                        const tr = document.createElement("tr");
                        tr.innerHTML = `
                            <td class="px-3 py-1.5 font-mono font-bold">${a.asset_tag_id}</td>
                            <td class="px-3 py-1.5">${a.asset_description || '-'}</td>
                            <td class="px-3 py-1.5">${a.model || '-'}</td>
                            <td class="px-3 py-1.5 font-mono">${a.serial_no || '-'}</td>
                            <td class="px-3 py-1.5"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${a.status === 'Checkout' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}">${a.status}</span></td>
                            <td class="px-3 py-1.5 text-center">
                                <div class="flex items-center justify-center gap-1">
                                    <button onclick="reconciliationCheckin(${a.id}, ${a.departed_asset_id}, '${a.asset_tag_id}')" class="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-[10px] font-bold cursor-pointer">Checkin</button>
                                    <button onclick="openDetailsModal(${a.id})" class="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-[10px] font-bold cursor-pointer">Detalle</button>
                                </div>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
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
    body.classList.toggle("hidden");
    if (icon) icon.style.transform = body.classList.contains("hidden") ? "" : "rotate(90deg)";
}

async function refreshReconciliation() {
    const res = await api("/employees/reconciliation/refresh/", { method: "POST" });
    if (res.ok) {
        const data = await res.json();
        alert(data.reactivated + " registro(s) reactivado(s) por reasignacion.");
        loadReconciliationStatus();
    }
}
