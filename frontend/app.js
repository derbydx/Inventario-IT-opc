const API_URL = "http://127.0.0.1:8000";
let currentAssets = [];

document.addEventListener("DOMContentLoaded", () => {
    loadAssets();
    loadDropdownData();
    loadHistory();
    setupFormListener();
    setupMovementFormListener();
    setupCatalogFormsListeners(); // <-- NUEVA: Activa la escucha de los 4 catálogos
});

// ==========================================
// 1. CARGAR MÁGICAMENTE TODOS LOS DESPLEGABLES
// ==========================================
async function loadDropdownData() {
    // Selects del Modal de Movimientos
    const personSelect = document.getElementById("modal_person_id");
    const adminSelect = document.getElementById("modal_admin_id");
    
    // Selects del Formulario de Registro de Activos
    const assetCatSelect = document.getElementById("asset_category_id");
    const assetSiteSelect = document.getElementById("asset_site_id");
    const assetLocSelect = document.getElementById("asset_location_id");
    
    // Select del sub-formulario de ubicaciones
    const locSiteSelect = document.getElementById("loc_site_select");

    try {
        // A. Cargar Personas (Empleados)
        const resPersons = await fetch(`${API_URL}/persons/`);
        if (resPersons.ok) {
            const persons = await resPersons.json();
            personSelect.innerHTML = '<option value="">-- Seleccione un Empleado --</option>';
            persons.forEach(p => { personSelect.innerHTML += `<option value="${p.id}">${p.full_name} (${p.employee_id})</option>`; });
        }

        // B. Cargar Administradores
        const resAdmins = await fetch(`${API_URL}/admins/`);
        if (resAdmins.ok) {
            const admins = await resAdmins.json();
            adminSelect.innerHTML = '<option value="">-- Seleccione su Usuario --</option>';
            admins.forEach(a => { adminSelect.innerHTML += `<option value="${a.id}">${a.username} [${a.role}]</option>`; });
        }

        // C. Cargar Categorías
        const resCats = await fetch(`${API_URL}/categories/`);
        if (resCats.ok) {
            const cats = await resCats.json();
            assetCatSelect.innerHTML = '<option value="">-- Seleccione Categoría --</option>';
            cats.forEach(c => { assetCatSelect.innerHTML += `<option value="${c.id}">${c.category_name}</option>`; });
        }

        // D. Cargar Sitios (Sincroniza dos selects a la vez)
        const resSites = await fetch(`${API_URL}/sites/`);
        if (resSites.ok) {
            const sites = await resSites.json();
            assetSiteSelect.innerHTML = '<option value="">-- Seleccione Sitio --</option>';
            locSiteSelect.innerHTML = '<option value="">-- Vincular a qué Sitio? --</option>';
            sites.forEach(s => {
                const opt = `<option value="${s.id}">${s.site_name} (${s.city || ''})</option>`;
                assetSiteSelect.innerHTML += opt;
                locSiteSelect.innerHTML += opt;
            });
        }

        // E. Cargar Ubicaciones
        const resLocs = await fetch(`${API_URL}/locations/`);
        if (resLocs.ok) {
            const locs = await resLocs.json();
            assetLocSelect.innerHTML = '<option value="">-- Seleccione Ubicación --</option>';
            locs.forEach(l => { assetLocSelect.innerHTML += `<option value="${l.id}">${l.location_name}</option>`; });
        }

    } catch (error) {
        console.error("Error al sincronizar listas de nombres:", error);
    }
}

// ==========================================
// 2. CARGAR ACTIVOS GLOBAL (CON FILA CLIQUEABLE)
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
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-red-500 font-medium">⚠️ Error de conexión con el Backend</td></tr>`;
    }
}

// ==========================================
// 3. DETALLES Y HISTORIAL POR EQUIPO (DRILL-DOWN)
// ==========================================
async function openDetailsModal(assetId) {
    const asset = currentAssets.find(a => a.id === parseInt(assetId));
    if (!asset) return;

    document.getElementById("detailsTitle").innerText = `🔍 Hoja de Vida del Activo`;
    document.getElementById("detailsTag").innerText = `Asset Tag ID: ${asset.asset_tag_id}`;
    document.getElementById("det_description").innerText = asset.asset_description;
    document.getElementById("det_brand_model").innerText = `${asset.brand} - ${asset.model}`;
    document.getElementById("det_serial").innerText = asset.serial_no;
    document.getElementById("det_ids").innerText = `Cat ID: ${asset.category_id} | Site ID: ${asset.site_id} | Loc ID: ${asset.location_id}`;
    document.getElementById("det_assigned").innerText = asset.person_id ? `Empleado ID (DB): ${asset.person_id}` : "Disponible en Almacén";

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
                historyBody.innerHTML = `<tr><td colspan="4" class="px-3 py-3 text-center text-gray-400 italic">Este equipo no registra movimientos previos.</td></tr>`;
            } else {
                specificHistory.reverse();
                specificHistory.forEach(item => {
                    const row = document.createElement("tr");
                    const fecha = new Date(item.fecha_accion).toLocaleString('es-ES');
                    let actionClass = item.tipo_accion === "Checkout" ? "text-blue-600 font-bold" : "text-amber-600 font-bold";
                    row.innerHTML = `
                        <td class="px-3 py-1.5 text-gray-400 text-[11px]">${fecha}</td>
                        <td class="px-3 py-1.5 uppercase ${actionClass}">${item.tipo_accion}</td>
                        <td class="px-3 py-1.5 text-gray-500">Admin ID: ${item.realizado_por_id}</td>
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
// 4. LEER HISTORIAL GLOBAL (INFERIOR)
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
            row.innerHTML = `
                <td class="px-4 py-2 text-gray-500 whitespace-nowrap">${fechaFormateada}</td>
                <td class="px-4 py-2 uppercase ${actionBadge}">${item.tipo_accion}</td>
                <td class="px-4 py-2 font-bold text-gray-700">ID: ${item.asset_id}</td>
                <td class="px-4 py-2 text-gray-600">${item.asignado_a_id ? `Persona ID: ${item.asignado_a_id}` : 'N/A (Almacén)'}</td>
                <td class="px-4 py-2 text-gray-600">Admin ID: ${item.realizado_por_id}</td>
                <td class="px-4 py-2 text-gray-500 italic max-w-xs truncate" title="${item.notas_detalle || ''}">${item.notas_detalle || '-'}</td>
            `;
            historyBody.appendChild(row);
        });
    } catch (error) { historyBody.innerHTML = `<tr><td colspan="6" class="px-4 py-4 text-center text-red-500">Error.</td></tr>`; }
}

// ==========================================
// 5. FORMULARIO: GUARDAR NUEVO ACTIVO
// ==========================================
function setupFormListener() {
    const form = document.getElementById("assetForm");
    form.addEventListener("submit", async (e) => {
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
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(assetData)
            });
            if (response.status === 201) {
                alert("¡Activo registrado con éxito! 🎉");
                form.reset();
                loadAssets();
            } else {
                const errorData = await response.json();
                alert(`Error: ${errorData.detail}`);
            }
        } catch (error) { alert("Error al conectar con el servidor."); }
    });
}

// ==========================================
// CONTROLADORES MODAL DE MOVIMIENTOS
// ==========================================
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
        document.getElementById("modal_person_id").required = true;
    } else {
        modalTitle.innerText = "📥 Registrar Devolución (Check-in)";
        submitBtn.innerText = "Recibir en Almacén";
        submitBtn.className = "px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-sm transition-colors cursor-pointer";
        divAsignadoA.classList.add("hidden");
        document.getElementById("modal_person_id").required = false;
    }
    document.getElementById("movementModal").classList.remove("hidden");
}
function closeModal() {
    document.getElementById("movementModal").classList.add("hidden");
    document.getElementById("movementForm").reset();
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
            } else {
                const err = await response.json();
                alert(`Error: ${err.detail || "No se pudo procesar"}`);
            }
        } catch (error) { alert("Error de conexión."); }
    });
}

// ==========================================
// CONTROLADORES NUEVOS: MODAL DE CATÁLOGOS BASE
// ==========================================
function openCatalogsModal() { document.getElementById("catalogsModal").classList.remove("hidden"); }
// Al cerrar refresca los desplegables por seguridad
function closeCatalogsModal() { document.getElementById("catalogsModal").classList.add("hidden"); loadDropdownData(); }

// ESCUCHA Y PROCESAMIENTO DE LOS 4 NUEVOS FORMULARIOS DE CATÁLOGO
function setupCatalogFormsListeners() {
    // A. Formulario Categorías
    document.getElementById("form_add_category").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("cat_name_input").value;
        const res = await fetch(`${API_URL}/categories/`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_name: name })
        });
        if (res.ok) { alert("Categoría agregada con éxito!"); document.getElementById("form_add_category").reset(); loadDropdownData(); }
        else { alert("Error al agregar la categoría."); }
    });

    // B. Formulario Departamentos
    document.getElementById("form_add_department").addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("dept_name_input").value;
        const res = await fetch(`${API_URL}/departments/`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ department_name: name })
        });
        if (res.ok) { alert("Departamento agregado con éxito!"); document.getElementById("form_add_department").reset(); loadDropdownData(); }
        else { alert("Error al agregar el departamento."); }
    });

    // C. Formulario Sitios
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
        if (res.ok) { alert("Sitio agregado con éxito!"); document.getElementById("form_add_site").reset(); loadDropdownData(); }
        else { alert("Error al agregar el sitio."); }
    });

    // D. Formulario Ubicaciones
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
        if (res.ok) { alert("Ubicación agregada con éxito!"); document.getElementById("form_add_location").reset(); loadDropdownData(); }
        else { alert("Error al agregar la ubicación."); }
    });
}