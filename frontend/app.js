const API_URL = "http://127.0.0.1:8000";

let currentAssets = [];
let globalSites = [];
let globalLocations = [];
let globalPersons = [];
let globalAdmins = [];
let globalDepartments = [];

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
        loadAssets();
        loadDropdownData();
        loadHistory();
    }
    setupFormListener();
    setupMovementFormListener();
    setupCatalogFormsListeners();
    setupPersonFormListener();
    setupEditAssetFormListener();
});

async function loadDropdownData() {
    const personSelect = document.getElementById("modal_person_id");
    const assetCatSelect = document.getElementById("asset_category");
    const assetSiteSelect = document.getElementById("asset_site_id");
    const assetLocSelect = document.getElementById("asset_location_id");
    const locSiteSelect = document.getElementById("loc_site_select");
    const personDeptSelect = document.getElementById("person_department_id");
    const personSiteSelect = document.getElementById("person_site_id");
    const personLocSelect = document.getElementById("person_location_id");
    const editCatSelect = document.getElementById("edit_asset_category");
    const editSiteSelect = document.getElementById("edit_asset_site_id");
    const editLocSelect = document.getElementById("edit_asset_location_id");

    try {
        const resPersons = await api("/persons/");
        if (resPersons.ok) {
            globalPersons = await resPersons.json();
            personSelect.innerHTML = '<option value="">-- Seleccione un Empleado --</option>';
            globalPersons.forEach(p => { personSelect.innerHTML += `<option value="${p.id}">${p.full_name} (${p.employee_id})</option>`; });
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
        }
        const resSites = await api("/sites/");
        if (resSites.ok) {
            globalSites = await resSites.json();
            assetSiteSelect.innerHTML = '<option value="">-- Seleccione Sitio --</option>';
            editSiteSelect.innerHTML = '<option value="">-- Seleccione Sitio --</option>';
            locSiteSelect.innerHTML = '<option value="">-- Vincular a que Sitio? --</option>';
            personSiteSelect.innerHTML = '<option value="">-- Seleccione Sitio Base --</option>';
            globalSites.forEach(s => {
                const opt = `<option value="${s.id}">${s.site_name}</option>`;
                assetSiteSelect.innerHTML += opt; editSiteSelect.innerHTML += opt; locSiteSelect.innerHTML += opt; personSiteSelect.innerHTML += opt;
            });
        }
        const resLocs = await api("/locations/");
        if (resLocs.ok) {
            globalLocations = await resLocs.json();
            const fillL = (sel) => { sel.innerHTML = '<option value="">-- Seleccione Ubicacion --</option>'; globalLocations.forEach(l => { sel.innerHTML += `<option value="${l.id}">${l.location_name}</option>`; });};
            fillL(assetLocSelect); fillL(editLocSelect); fillL(personLocSelect);
        }
        const resDepts = await api("/departments/");
        if (resDepts.ok) {
            globalDepartments = await resDepts.json();
            personDeptSelect.innerHTML = '<option value="">-- Seleccione Departamento --</option>';
            globalDepartments.forEach(d => { personDeptSelect.innerHTML += `<option value="${d.id}">${d.department_name}</option>`; });
        }
    } catch (e) { console.error(e); }
}

async function loadAssets() {
    const tableBody = document.getElementById("assetsTableBody");
    const countSpan = document.getElementById("assetCount");
    try {
        const response = await api("/assets/");
        if (!response.ok) throw new Error("Error en el servidor");
        
        currentAssets = await response.json();
        tableBody.innerHTML = "";
        
        const activeAssets = currentAssets.filter(a => a.status !== "Archived");
        
        if (activeAssets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400 italic">No hay activos vigentes en el inventario.</td></tr>`;
            countSpan.innerText = "0 Equipos";
            return;
        }

        countSpan.innerText = `${activeAssets.length} ${activeAssets.length === 1 ? 'Equipo' : 'Equipos'}`;

        activeAssets.forEach(asset => {
            const row = document.createElement("tr");
            row.className = "hover:bg-blue-50/50 transition-colors cursor-pointer group";
            row.onclick = () => openDetailsModal(asset.id);
            
            let badgeColor = "bg-green-100 text-green-800";
            if (asset.status === "Checkout") badgeColor = "bg-blue-100 text-blue-800";
            if (asset.status === "Broken") badgeColor = "bg-red-100 text-red-800";

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
                <td class="px-4 py-3 text-center" onclick="event.stopPropagation();">${actionButton}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (e) { tableBody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-red-500 font-medium">Error de conexion con el servidor backend</td></tr>`; }
}

async function openDetailsModal(assetId) {
    const asset = currentAssets.find(a => a.id === parseInt(assetId));
    if (!asset) return;

    document.getElementById("assetSpecificHistoryWrapper").classList.add("hidden");
    document.getElementById("historyToggleIcon").innerText = "Mostrar";

    const siteObj = globalSites.find(s => s.id === asset.site_id);
    const locationObj = globalLocations.find(l => l.id === asset.location_id);
    const employeeObj = globalPersons.find(p => p.id === asset.person_id);

    document.getElementById("detailsTag").innerText = `Asset Tag ID: ${asset.asset_tag_id}`;
    document.getElementById("det_description").innerText = asset.asset_description;
    document.getElementById("det_brand_model").innerText = `${asset.brand} - ${asset.model}`;
    document.getElementById("det_serial").innerText = asset.serial_no;
    
    document.getElementById("det_category").innerText = asset.category || "-";
    document.getElementById("det_location_path").innerText = `${siteObj ? siteObj.site_name : 'Site'} ${locationObj ? locationObj.location_name : 'Ubicacion'}`;

    const statusElement = document.getElementById("det_status");
    let badgeColor = "bg-gray-100 text-gray-800"; 

    if (asset.status === "Check in" || asset.status === "Available" || asset.status === "Found") {
        badgeColor = "bg-green-100 text-green-800";
    } else if (asset.status === "Checkout") {
        badgeColor = "bg-blue-100 text-blue-800"; 
    } else if (asset.status === "Broken" || asset.status === "Lost/Missing" || asset.status === "Dispose") {
        badgeColor = "bg-red-100 text-red-800"; 
    } else if (asset.status === "Under repair") {
        badgeColor = "bg-amber-100 text-amber-800"; 
    } else if (asset.status === "Reserved" || asset.status === "Lease") {
        badgeColor = "bg-purple-100 text-purple-800";
    }

    statusElement.innerHTML = `<span class="px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${badgeColor}">${asset.status}</span>`;

    const containerAsignado = document.getElementById("det_assigned_container");
    if (employeeObj) {
        containerAsignado.innerHTML = `
            <button onclick="openUserAssetsModal('${employeeObj.id}', '${employeeObj.full_name}')" class="w-full text-left bg-blue-50 border border-blue-200 rounded p-2 text-blue-700 font-semibold hover:bg-blue-100 transition-colors cursor-pointer block flex justify-between items-center">
                <span>${employeeObj.full_name} (${employeeObj.title || 'Personal'})</span>
                <span class="text-[10px] bg-blue-600 text-white font-bold py-0.5 px-1.5 rounded uppercase tracking-wide">Ver Asignados </span>
            </button>`;
    } else {
        containerAsignado.innerHTML = `<p class="text-green-700 font-medium p-1 bg-green-50 border border-green-100 rounded">Disponible en Almacen</p>`;
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
    tableBody.innerHTML = "";
    const assignedDevices = currentAssets.filter(a => a.person_id === parseInt(personId));

    if (assignedDevices.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="px-3 py-4 text-center text-gray-400 italic">No registra activos en custodia.</td></tr>`;
    } else {
        assignedDevices.forEach(dev => {
            const row = document.createElement("tr");
            row.innerHTML = `<td class="px-3 py-2 font-bold text-blue-600">${dev.asset_tag_id}</td><td class="px-3 py-2 text-gray-600">${dev.asset_description}</td><td class="px-3 py-2 text-gray-500">${dev.brand} ${dev.model}</td><td class="px-3 py-2 font-bold text-gray-400">${dev.serial_no}</td>`;
            tableBody.appendChild(row);
        });
    }
    document.getElementById("userAssetsModal").classList.remove("hidden");
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
    const restoredData = { ...asset, status: "Check in" };
    try {
        const response = await api(`/assets/${assetId}`, { method: "PUT", body: JSON.stringify(restoredData) });
        if (response.ok) { alert(`El activo ${assetTag} ha sido restaurado exitosamente al almacen.`); closeDeletedAssetsModal(); loadAssets(); loadHistory(); }
    } catch (e) { alert("Error."); }
}

function openEditAssetModal(assetId) {
    const asset = currentAssets.find(a => a.id === parseInt(assetId));
    if (!asset) return;
    document.getElementById("edit_asset_id").value = asset.id;
    document.getElementById("edit_asset_tag_id").value = asset.asset_tag_id;
    document.getElementById("edit_asset_description").value = asset.asset_description;
    document.getElementById("edit_brand").value = asset.brand;
    document.getElementById("edit_model").value = asset.model;
    document.getElementById("edit_serial_no").value = asset.serial_no;
    document.getElementById("edit_asset_category").value = asset.category || "";
    document.getElementById("edit_asset_site_id").value = asset.site_id;
    document.getElementById("edit_asset_location_id").value = asset.location_id;
    
    document.getElementById("edit_asset_status").value = asset.status;

    document.getElementById("editAssetModal").classList.remove("hidden");
}
function closeEditAssetModal() { document.getElementById("editAssetModal").classList.add("hidden"); }

function setupEditAssetFormListener() {
    const form = document.getElementById("editAssetForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const assetId = document.getElementById("edit_asset_id").value;

        const updatedData = {
            asset_tag_id: document.getElementById("edit_asset_tag_id").value,
            asset_description: document.getElementById("edit_asset_description").value,
            brand: document.getElementById("edit_brand").value,
            model: document.getElementById("edit_model").value,
            serial_no: document.getElementById("edit_serial_no").value,
            category: document.getElementById("edit_asset_category").value,
            site_id: parseInt(document.getElementById("edit_asset_site_id").value),
            location_id: parseInt(document.getElementById("edit_asset_location_id").value),
            status: document.getElementById("edit_asset_status").value 
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
    try {
        const response = await api("/history/");
        if (!response.ok) throw new Error("Error");
        const historyData = await response.json();
        historyBody.innerHTML = "";
        if (historyData.length === 0) { historyBody.innerHTML = `<tr><td colspan="6" class="px-4 py-4 text-center text-gray-400 italic">Sin movimientos.</td></tr>`; return; }
        historyData.reverse();
        historyData.forEach(item => {
            const row = document.createElement("tr"); row.className = "hover:bg-gray-50 text-xs";
            let actionBadge = "text-blue-600 font-bold";
            if (item.tipo_accion === "Check in") actionBadge = "text-amber-600 font-bold";
            if (item.tipo_accion === "Archived") actionBadge = "text-red-600 font-bold";
            const fecha = new Date(item.fecha_accion).toLocaleString('es-ES');
            const assetObj = currentAssets.find(a => a.id === item.asset_id);
            const employeeObj = globalPersons.find(p => p.id === item.asignado_a_id);
            
            row.innerHTML = `<td class="px-4 py-2 text-gray-500 whitespace-nowrap">${fecha}</td><td class="px-4 py-2 uppercase ${actionBadge}">${item.tipo_accion}</td><td class="px-4 py-2 font-bold text-gray-700">${assetObj ? assetObj.asset_tag_id : 'ID: ' + item.asset_id}</td><td class="px-4 py-2 text-gray-600">${employeeObj ? employeeObj.full_name : (item.asignado_a_id ? 'ID: ' + item.asignado_a_id : 'Almacen')}</td><td class="px-4 py-2 text-gray-600">Admin_${item.realizado_por_id}</td><td class="px-4 py-2 text-gray-500 italic max-w-xs truncate">${item.notas_detalle || '-'}</td>`;
            historyBody.appendChild(row);
        });
    } catch (e) { console.error(e); }
}

function openModal(assetId, assetTag, actionType) {
    document.getElementById("modal_asset_id").value = assetId; document.getElementById("modal_action_type").value = actionType;
    document.getElementById("modalAssetInfo").innerText = `Activo Seleccionado: ${assetTag}`;
    const divAsignadoA = document.getElementById("div_asignado_a"); const modalTitle = document.getElementById("modalTitle"); const submitBtn = document.getElementById("modalSubmitBtn");
    if (actionType === "checkout") { modalTitle.innerText = "Registrar Asignacion (Check-out)"; submitBtn.innerText = "Asignar Equipo"; submitBtn.className = "px-4 py-2 bg-blue-600 text-white font-bold rounded text-sm cursor-pointer"; divAsignadoA.classList.remove("hidden"); } 
    else { modalTitle.innerText = "Registrar Devolucion (Check-in)"; submitBtn.innerText = "Recibir en Almacen"; submitBtn.className = "px-4 py-2 bg-amber-600 text-white font-bold rounded text-sm cursor-pointer"; divAsignadoA.classList.add("hidden"); }
    document.getElementById("movementModal").classList.remove("hidden");
}
function closeModal() { document.getElementById("movementModal").classList.add("hidden"); document.getElementById("movementForm").reset(); }

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
        const assetData = { asset_tag_id: document.getElementById("asset_tag_id").value, asset_description: document.getElementById("asset_description").value, brand: document.getElementById("brand").value, model: document.getElementById("model").value, serial_no: document.getElementById("serial_no").value, category: document.getElementById("asset_category").value, site_id: parseInt(document.getElementById("asset_site_id").value), location_id: parseInt(document.getElementById("asset_location_id").value), status: "Check in" };
        try { const response = await api("/assets/", { method: "POST", body: JSON.stringify(assetData) }); if (response.status === 201) { alert("Activo registrado con exito!"); closeAssetModal(); loadAssets(); } } catch (error) { alert("Error."); }
    });
}

function setupPersonFormListener() {
    document.getElementById("personForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const personData = { full_name: document.getElementById("person_full_name").value, email: document.getElementById("person_email").value, employee_id: document.getElementById("person_employee_id").value, title: document.getElementById("person_title").value || null, phone: document.getElementById("person_phone").value || null, notes: document.getElementById("person_notes").value || null, site_id: parseInt(document.getElementById("person_site_id").value), location_id: parseInt(document.getElementById("person_location_id").value), department_id: parseInt(document.getElementById("person_department_id").value) };
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
    
    document.getElementById("form_add_location").addEventListener("submit", async (e) => { 
        e.preventDefault(); 
        try {
            const data = { location_name: document.getElementById("loc_name_input").value, site_id: parseInt(document.getElementById("loc_site_select").value) }; 
            const res = await api("/locations/", { method: "POST", body: JSON.stringify(data) }); 
            if (res.ok) { 
                alert("Ubicacion creada!"); closeLocationModal(); document.getElementById("form_add_location").reset(); 
                loadDropdownData(); 
            } else {
                const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
                alert("Error: " + (err.detail || "No se pudo crear la ubicacion"));
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
        const response = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem("adminSession", JSON.stringify({
                access_token: data.access_token,
                admin: data.admin
            }));
            alert(`Autenticacion exitosa! Bienvenido ${data.admin.username}`);
            document.getElementById("loginOverlay").classList.add("hidden");
            document.getElementById("loginForm").reset();
            loadAssets();
            loadDropdownData();
            loadHistory();
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

function openAssetModal() { document.getElementById("assetModal").classList.remove("hidden"); }
function closeAssetModal() { document.getElementById("assetModal").classList.add("hidden"); document.getElementById("assetForm").reset(); }

function openPersonModal() { document.getElementById("personModal").classList.remove("hidden"); }
function closePersonModal() { document.getElementById("personModal").classList.add("hidden"); document.getElementById("personForm").reset(); }


function openSiteModal() { document.getElementById("siteModal").classList.remove("hidden"); }
function closeSiteModal() { document.getElementById("siteModal").classList.add("hidden"); document.getElementById("form_add_site").reset(); }

function openLocationModal() { document.getElementById("locationModal").classList.remove("hidden"); }
function closeLocationModal() { document.getElementById("locationModal").classList.add("hidden"); document.getElementById("form_add_location").reset(); }

function openDepartmentModal() { document.getElementById("departmentModal").classList.remove("hidden"); }
function closeDepartmentModal() { document.getElementById("departmentModal").classList.add("hidden"); document.getElementById("form_add_department").reset(); }
