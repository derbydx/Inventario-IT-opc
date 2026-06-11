const API_URL = "http://127.0.0.1:8000";

// Variables globales para almacenamiento local
let currentAssets = [];
let globalCategories = [];
let globalSites = [];
let globalLocations = [];
let globalPersons = [];
let globalAdmins = [];
let globalDepartments = []; // <-- NUEVA: Para almacenar departamentos corporativos

document.addEventListener("DOMContentLoaded", () => {
    loadAssets();
    loadDropdownData();
    loadHistory();
    setupFormListener();
    setupMovementFormListener();
    setupCatalogFormsListeners();
    setupPersonFormListener(); // <-- NUEVA: Escucha para el alta del empleado
});

// ==========================================
// 1. CARGAR DESPLEGABLES Y ALMACENAR EN CACHÉ
// ==========================================
async function loadDropdownData() {
    // Modal Movimientos
    const personSelect = document.getElementById("modal_person_id");
    const adminSelect = document.getElementById("modal_admin_id");
    
    // Modal Registro Activos
    const assetCatSelect = document.getElementById("asset_category_id");
    const assetSiteSelect = document.getElementById("asset_site_id");
    const assetLocSelect = document.getElementById("asset_location_id");
    
    // Modal Ubicación Base
    const locSiteSelect = document.getElementById("loc_site_select");

    // NUEVOS: Desplegables del Modal de Empleados
    const personDeptSelect = document.getElementById("person_department_id");
    const personSiteSelect = document.getElementById("person_site_id");
    const personLocSelect = document.getElementById("person_location_id");

    try {
        // A. Traer Empleados
        const resPersons = await fetch(`${API_URL}/persons/`);
        if (resPersons.ok) {
            globalPersons = await resPersons.json();
            personSelect.innerHTML = '<option value="">-- Seleccione un Empleado --</option>';
            globalPersons.forEach(p => { personSelect.innerHTML += `<option value="${p.id}">${p.full_name} (${p.employee_id})</option>`; });
        }

        // B. Traer Administradores
        const resAdmins = await fetch(`${API_URL}/admins/`);
        if (resAdmins.ok) {
            globalAdmins = await resAdmins.json();
            adminSelect.innerHTML = '<option value="">-- Seleccione su Usuario --</option>';
            globalAdmins.forEach(a => { adminSelect.innerHTML += `<option value="${a.id}">${a.username} [${a.role}]</option>`; });
        }

        // C. Traer Categorías
        const resCats = await fetch(`${API_URL}/categories/`);
        if (resCats.ok) {
            globalCategories = await resCats.json();
            assetCatSelect.innerHTML = '<option value="">-- Seleccione Categoría --</option>';
            globalCategories.forEach(c => { assetCatSelect.innerHTML += `<option value="${c.id}">${c.category_name}</option>`; });
        }

        // D. Traer Sitios (Alimenta 3 selects a la vez)
        const resSites = await fetch(`${API_URL}/sites/`);
        if (resSites.ok) {
            globalSites = await resSites.json();
            assetSiteSelect.innerHTML = '<option value="">-- Seleccione Sitio --</option>';
            locSiteSelect.innerHTML = '<option value="">-- Vincular a qué Sitio? --</option>';
            personSiteSelect.innerHTML = '<option value="">-- Seleccione Sitio Base --</option>';
            globalSites.forEach(s => {
                const opt = `<option value="${s.id}">${s.site_name}</option>`;
                assetSiteSelect.innerHTML += opt;
                locSiteSelect.innerHTML += opt;
                personSiteSelect.innerHTML += opt;
            });
        }

        // E. Traer Ubicaciones (Alimenta 2 selects a la vez)
        const resLocs = await fetch(`${API_URL}/locations/`);
        if (resLocs.ok) {
            globalLocations = await resLocs.json();
            assetLocSelect.innerHTML = '<option value="">-- Seleccione Ubicación --</option>';
            personLocSelect.innerHTML = '<option value="">-- Seleccione Ubicación Base --</option>';
            globalLocations.forEach(l => { 
                const opt = `<option value="${l.id}">${l.location_name}</option>`;
                assetLocSelect.innerHTML += opt;
                personLocSelect.innerHTML += opt;
            });
        }

        // F. NUEVA: Traer Departamentos Corporativos para el Empleado
        const resDepts = await fetch(`${API_URL}/departments/`);
        if (resDepts.ok) {
            globalDepartments = await resDepts.json();
            personDeptSelect.innerHTML = '<option value="">-- Seleccione Departamento --</option>';
            globalDepartments.forEach(d => { personDeptSelect.innerHTML += `<option value="${d.id}">${d.department_name}</option>`; });
        }

    } catch (error) { console.error("Error al sincronizar catálogos:", error); }
}

// ==========================================
// 2. CARGAR INVENTARIO GLOBAL
// ==========================================
async function loadAssets() {
    const tableBody = document.getElementById("assetsTableBody");
    const countSpan = document.getElementById("assetCount");
    try {
        const response = await fetch(`${API_URL}/assets/`);
        if (!response.ok) throw new Error("Error en el servidor");
        
        currentAssets = await response.json();
        tableBody.innerHTML = "";
        
        if (currentAssets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400 italic">No hay activos registrados.</td></tr>`;
            countSpan.innerText = "0 Equipos";
            return;
        }

        countSpan.innerText = `${currentAssets.length} ${currentAssets.length === 1 ? 'Equipo' : 'Equipos'}`;

        currentAssets.forEach(asset => {
            const row = document.createElement("tr");
            row.className = "hover:bg-blue-50/50 transition-colors cursor-pointer group";
            row.onclick = () => openDetailsModal(asset.id);
            
            let badgeColor = "bg-green-100 text-green-800";
            if (asset.status === "Checkout") badgeColor = "bg-blue-100 text-blue-800";
            if (asset.status === "Broken") badgeColor = "bg-red-100 text-red-800";

            let actionButton = "";
            if (asset.status === "Check in") {
                actionButton = `<button onclick="openModal('${asset.id}', '${asset.asset_tag_id}', 'checkout')" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1 px-3 rounded shadow transition-colors cursor-pointer">Check-out</button>`;
            } else if (asset.status === "Checkout") {
                actionButton = `<button onclick="openModal('${asset.id}', '${asset.asset_tag_id}', 'checkin')" class="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-1 px-3 rounded shadow transition-colors cursor-pointer">Check-in</button>`;
            } else {
                actionButton = `<span class="text-xs text-gray-400 italic">No disponible</span>`;
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
    } catch (error) { tableBody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-red-500 font-medium">⚠️ Error de conexión</td></tr>`; }
}

// ==========================================
// 3. DETALLES DE ACTIVO (NOMBRES EXTRACTED DESDE CACHÉ)
// ==========================================
async function openDetailsModal(assetId) {
    const asset = currentAssets.find(a => a.id === parseInt(assetId));
    if (!asset) return;

    const categoryObj = globalCategories.find(c => c.id === asset.category_id);
    const siteObj = globalSites.find(s => s.id === asset.site_id);
    const locationObj = globalLocations.find(l => l.id === asset.location_id);
    const employeeObj = globalPersons.find(p => p.id === asset.person_id);

    document.getElementById("detailsTag").innerText = `Asset Tag ID: ${asset.asset_tag_id}`;
    document.getElementById("det_description").innerText = asset.asset_description;
    document.getElementById("det_brand_model").innerText = `${asset.brand} - ${asset.model}`;
    document.getElementById("det_serial").innerText = asset.serial_no;
    
    document.getElementById("det_category_name").innerText = categoryObj ? categoryObj.category_name : `ID: ${asset.category_id}`;
    document.getElementById("det_location_path").innerText = `${siteObj ? siteObj.site_name : 'Site'} ➔ ${locationObj ? locationObj.location_name : 'Ubicación'}`;
    document.getElementById("det_assigned").innerText = employeeObj ? `👤 ${employeeObj.full_name} [${employeeObj.title || 'Personal'}] - ID: ${employeeObj.employee_id}` : "🟢 Disponible en Almacén (Check in)";

    const statusContainer = document.getElementById("det_status");
    let badgeColor = "bg-green-100 text-green-800";
    if (asset.status === "Checkout") badgeColor = "bg-blue-100 text-blue-800";
    if (asset.status === "Broken") badgeColor = "bg-red-100 text-red-800";
    statusContainer.innerHTML = `<span class="px-2 py-0.5 rounded-full text-xs font-semibold ${badgeColor}">${asset.status}</span>`;

    const historyBody = document.getElementById("assetSpecificHistoryBody");
    historyBody.innerHTML = `<tr><td colspan="4" class="px-3 py-4 text-center text-gray-400 italic">Buscando bitácora de este equipo...</td></tr>`;

    try {
        const response = await fetch(`${API_URL}/history/`);
        if (response.ok) {
            const allHistory = await response.json();
            const specificHistory = allHistory.filter(h => h.asset_id === asset.id);
            historyBody.innerHTML = "";
            if (specificHistory.length === 0) {
                historyBody.innerHTML = `<tr><td colspan="4" class="px-3 py-3 text-center text-gray-400 italic">Este equipo no registra movimientos.</td></tr>`;
            } else {
                specificHistory.reverse();
                specificHistory.forEach(item => {
                    const row = document.createElement("tr");
                    const fecha = new Date(item.fecha_accion).toLocaleString('es-ES');
                    let actionClass = item.tipo_accion === "Checkout" ? "text-blue-600 font-bold" : "text-amber-600 font-bold";
                    const adminObj = globalAdmins.find(a => a.id === item.realizado_por_id);

                    row.innerHTML = `
                        <td class="px-3 py-1.5 text-gray-400 text-[11px]">${fecha}</td>
                        <td class="px-3 py-1.5 uppercase ${actionClass}">${item.tipo_accion}</td>
                        <td class="px-3 py-1.5 text-gray-500">${adminObj ? adminObj.username : 'Admin ID: ' + item.realizado_por_id}</td>
                        <td class="px-3 py-1.5 text-gray-700 italic">${item.notas_detalle || '-'}</td>
                    `;
                    historyBody.appendChild(row);
                });
            }
        }
    } catch (error) { historyBody.innerHTML = `<tr><td colspan="4" class="px-3 py-3 text-center text-red-500">Error.</td></tr>`; }

    document.getElementById("detailsModal").classList.remove("hidden");
}
function closeDetailsModal() { document.getElementById("detailsModal").classList.add("hidden"); }

// ==========================================
// 4. LEER HISTORIAL DE AUDITORÍA GLOBAL
// ==========================================
async function loadHistory() {
    const historyBody = document.getElementById("historyTableBody");
    try {
        const response = await fetch(`${API_URL}/history/`);
        if (!response.ok) throw new Error("No se pudo obtener el historial");
        const historyData = await response.json();
        historyBody.innerHTML = "";
        if (historyData.length === 0) {
            historyBody.innerHTML = `<tr><td colspan="6" class="px-4 py-4 text-center text-gray-400 italic">Sin movimientos registrados.</td></tr>`;
            return;
        }
        historyData.reverse();
        historyData.forEach(item => {
            const row = document.createElement("tr");
            row.className = "hover:bg-gray-50 text-xs";
            let actionBadge = "text-blue-600 font-bold";
            if (item.tipo_accion === "Check in") actionBadge = "text-amber-600 font-bold";
            const fechaFormateada = new Date(item.fecha_accion).toLocaleString('es-ES');
            
            const assetObj = currentAssets.find(a => a.id === item.asset_id);
            const employeeObj = globalPersons.find(p => p.id === item.asignado_a_id);
            const adminObj = globalAdmins.find(a => a.id === item.realizado_por_id);

            row.innerHTML = `
                <td class="px-4 py-2 text-gray-500 whitespace-nowrap">${fechaFormateada}</td>
                <td class="px-4 py-2 uppercase ${actionBadge}">${item.tipo_accion}</td>
                <td class="px-4 py-2 font-bold text-gray-700">${assetObj ? assetObj.asset_tag_id : 'ID: ' + item.asset_id}</td>
                <td class="px-4 py-2 text-gray-600">${employeeObj ? employeeObj.full_name : (item.asignado_a_id ? 'ID: ' + item.asignado_a_id : 'Almacén')}</td>
                <td class="px-4 py-2 text-gray-600">${adminObj ? adminObj.username : 'ID: ' + item.realizado_por_id}</td>
                <td class="px-4 py-2 text-gray-500 italic max-w-xs truncate" title="${item.notas_detalle || ''}">${item.notas_detalle || '-'}</td>
            `;
            historyBody.appendChild(row);
        });
    } catch (error) { console.error(error); }
}

// ==========================================
// 5. CONTROLADORES APERTURA/CIERRE DE MODALES
// ==========================================
function openAssetModal() { document.getElementById("assetModal").classList.remove("hidden"); }
function closeAssetModal() { document.getElementById("assetModal").classList.add("hidden"); document.getElementById("assetForm").reset(); }

// NUEVOS: Controladores para el Modal de Empleados
function openPersonModal() { document.getElementById("personModal").classList.remove("hidden"); }
function closePersonModal() { document.getElementById("personModal").classList.add("hidden"); document.getElementById("personForm").reset(); }

function openCategoryModal() { document.getElementById("categoryModal").classList.remove("hidden"); }
function closeCategoryModal() { document.getElementById("categoryModal").classList.add("hidden"); }

function openSiteModal() { document.getElementById("siteModal").classList.remove("hidden"); }
function closeSiteModal() { document.getElementById("siteModal").classList.add("hidden"); }

function openLocationModal() { document.getElementById("locationModal").classList.remove("hidden"); }
function closeLocationModal() { document.getElementById("locationModal").classList.add("hidden"); }

function openModal(assetId, assetTag, actionType) {
    document.getElementById("modal_asset_id").value = assetId;
    document.getElementById("modal_action_type").value = actionType;
    document.getElementById("modalAssetInfo").innerText = `Activo Seleccionado: ${assetTag}`;
    const divAsignadoA = document.getElementById("div_asignado_a");
    const modalTitle = document.getElementById("modalTitle");
    const submitBtn = document.getElementById("modalSubmitBtn");

    if (actionType === "checkout") {
        modalTitle.innerText = "📤 Registrar Asignación (Check-out)";
        submitBtn.innerText = "Asignar Equipo";
        submitBtn.className = "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-sm transition-colors cursor-pointer";
        divAsignadoA.classList.remove("hidden");
    } else {
        modalTitle.innerText = "📥 Registrar Devolución (Check-in)";
        submitBtn.innerText = "Recibir en Almacén";
        submitBtn.className = "px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-sm transition-colors cursor-pointer";
        divAsignadoA.classList.add("hidden");
    }
    document.getElementById("movementModal").classList.remove("hidden");
}
function closeModal() { document.getElementById("movementModal").classList.add("hidden"); document.getElementById("movementForm").reset(); }

// ==========================================
// 6. EVENTOS DE ENVÍO DE FORMULARIOS (POST)
// ==========================================
function setupFormListener() {
    document.getElementById("assetForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const assetData = {
            asset_tag_id: document.getElementById("asset_tag_id").value,
            asset_description: document.getElementById("asset_description").value,
            brand: document.getElementById("brand").value,
            model: document.getElementById("model").value,
            serial_no: document.getElementById("serial_no").value,
            category_id: parseInt(document.getElementById("asset_category_id").value),
            site_id: parseInt(document.getElementById("asset_site_id").value),
            location_id: parseInt(document.getElementById("asset_location_id").value),
            status: "Check in"
        };
        try {
            const response = await fetch(`${API_URL}/assets/`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(assetData)
            });
            if (response.status === 201) {
                alert("¡Activo registrado con éxito! 🎉");
                closeAssetModal();
                loadAssets();
            } else { const err = await response.json(); alert(`Error: ${err.detail}`); }
        } catch (error) { alert("Error de conexión."); }
    });
}

function setupMovementFormListener() {
    const form = document.getElementById("movementForm");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const assetId = document.getElementById("modal_asset_id").value;
        const actionType = document.getElementById("modal_action_type").value;
        const adminId = document.getElementById("modal_admin_id").value;
        const notas = document.getElementById("modal_notas").value;

        let url = `${API_URL}/assets/${assetId}/checkin?admin_id=${adminId}`;
        if (notas) url += `&notas=${encodeURIComponent(notas)}`;

        if (actionType === "checkout") {
            const personId = document.getElementById("modal_person_id").value;
            url = `${API_URL}/assets/${assetId}/checkout?person_id=${personId}&admin_id=${adminId}`;
            if (notas) url += `&notas=${encodeURIComponent(notas)}`;
        }

        try {
            const response = await fetch(url, { method: "POST" });
            if (response.ok) {
                alert(`Movimiento procesado con éxito 🚀`);
                closeModal();
                loadAssets();
                loadHistory();
            } else { const err = await response.json(); alert(`Error: ${err.detail}`); }
        } catch (error) { alert("Error."); }
    });
}

// NUEVA FUNCIÓN: INTERCEPTOR PARA EL FORMULARIO DE ALTA DE EMPLEADOS
function setupPersonFormListener() {
    document.getElementById("personForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const personData = {
            full_name: document.getElementById("person_full_name").value,
            email: document.getElementById("person_email").value,
            employee_id: document.getElementById("person_employee_id").value,
            title: document.getElementById("person_title").value || null,
            phone: document.getElementById("person_phone").value || null,
            notes: document.getElementById("person_notes").value || null,
            site_id: parseInt(document.getElementById("person_site_id").value),
            location_id: parseInt(document.getElementById("person_location_id").value),
            department_id: parseInt(document.getElementById("person_department_id").value)
        };

        try {
            const response = await fetch(`${API_URL}/persons/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(personData)
            });

            if (response.status === 201) {
                alert("¡Empleado dado de alta exitosamente! 👤🎉");
                closePersonModal();
                loadDropdownData(); // Refresca las listas para incluir al nuevo empleado de inmediato
            } else {
                const err = await response.json();
                alert(`Error: ${err.detail || "Campos duplicados o inconsistentes."}`);
            }
        } catch (error) { alert("Error de conexión con el servidor."); }
    });
}

// ESCUCHA DE FORMULARIOS DE CATÁLOGOS BASE
function setupCatalogFormsListeners() {
    // Categorías
    document.getElementById("form_add_category").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("cat_name_input").value;
        const res = await fetch(`${API_URL}/categories/`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_name: name })
        });
        if (res.ok) { alert("Categoría agregada con éxito!"); closeCategoryModal(); document.getElementById("form_add_category").reset(); loadDropdownData(); }
    });

    // Sitios
    document.getElementById("form_add_site").addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = {
            site_name: document.getElementById("site_name_input").value,
            city: document.getElementById("site_city_input").value || null,
            country: document.getElementById("site_country_input").value || null
        };
        const res = await fetch(`${API_URL}/sites/`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        if (res.ok) { alert("Sitio agregado con éxito!"); closeSiteModal(); document.getElementById("form_add_site").reset(); loadDropdownData(); }
    });

    // Ubicaciones
    document.getElementById("form_add_location").addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = {
            location_name: document.getElementById("loc_name_input").value,
            site_id: parseInt(document.getElementById("loc_site_select").value)
        };
        const res = await fetch(`${API_URL}/locations/`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        if (res.ok) { alert("Ubicación agregada con éxito!"); closeLocationModal(); document.getElementById("form_add_location").reset(); loadDropdownData(); }
    });
}