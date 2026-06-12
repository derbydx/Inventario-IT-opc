const API_URL = "http://127.0.0.1:8000";

let currentAssets = [];
let globalSites = [];
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
    const personDeptSelect = document.getElementById("person_department_id");
    const personSiteSelect = document.getElementById("person_site_id");
    const editCatSelect = document.getElementById("edit_asset_category");
    const editSiteSelect = document.getElementById("edit_asset_site_id");

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
    const employeeObj = globalPersons.find(p => p.id === asset.person_id);

    document.getElementById("detailsTag").innerText = `Asset Tag ID: ${asset.asset_tag_id}`;
    document.getElementById("det_description").innerText = asset.asset_description;
    document.getElementById("det_brand_model").innerText = `${asset.brand} - ${asset.model}`;
    document.getElementById("det_serial").innerText = asset.serial_no;
    
    document.getElementById("det_category").innerText = asset.category || "-";
    
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
        const assetData = { asset_tag_id: document.getElementById("asset_tag_id").value, asset_description: document.getElementById("asset_description").value, brand: document.getElementById("brand").value, model: document.getElementById("model").value, serial_no: document.getElementById("serial_no").value, category: document.getElementById("asset_category").value, site_id: parseInt(document.getElementById("asset_site_id").value), status: "Check in" };
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

function openDepartmentModal() { document.getElementById("departmentModal").classList.remove("hidden"); }
function closeDepartmentModal() { document.getElementById("departmentModal").classList.add("hidden"); document.getElementById("form_add_department").reset(); }

// ===================== ENTREGAS PENDIENTES =====================

async function submitNewPending() {
    const personId = document.getElementById("delivery_person_id").value;
    const category = document.getElementById("delivery_category").value;
    const quantity = parseInt(document.getElementById("delivery_quantity").value) || 1;
    const notes = document.getElementById("delivery_notes").value;
    if (!personId) { alert("Seleccione un empleado"); return; }
    if (!category) { alert("Seleccione una categoria"); return; }
    try {
        const res = await api("/deliveries/pending", {
            method: "POST",
            body: JSON.stringify({ person_id: parseInt(personId), category, quantity, notes: notes || null })
        });
        if (res.ok) {
            alert("Entrega pendiente agregada correctamente!");
            document.getElementById("deliveryForm").reset();
        } else {
            const err = await res.json().catch(()=>({detail:"Error"}));
            alert("Error: " + (err.detail || "No se pudo crear"));
        }
    } catch (e) { alert("Error de conexion"); }
}

async function loadDeliveryBoard() {
    const container = document.getElementById("deliveryBoardContainer");
    container.innerHTML = '<p class="text-center text-gray-400 italic py-8">Cargando tablero...</p>';
    try {
        const res = await api("/deliveries/summary");
        if (!res.ok) throw new Error("Error");
        const data = await res.json();
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
        Object.values(grouped).forEach(g => {
            const pendingCount = g.items.reduce((sum, i) => sum + (i.quantity - i.fulfilled_count), 0);
            const cats = [...new Set(g.items.map(i => i.category))].join(", ");
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
        const el = document.getElementById("deliveryTotalPending");
        if (el) el.textContent = data.reduce((s, d) => s + (d.quantity - d.fulfilled_count), 0);
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
