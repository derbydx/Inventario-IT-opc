const API_URL = "http://127.0.0.1:8000";

// Variable global para almacenar los activos en memoria local
let currentAssets = [];

document.addEventListener("DOMContentLoaded", () => {
    loadAssets();
    loadDropdownData();
    loadHistory();
    setupFormListener();
    setupMovementFormListener();
});

// ==========================================
// CARGAR DROPDOWNS DINÁMICOS
// ==========================================
async function loadDropdownData() {
    const personSelect = document.getElementById("modal_person_id");
    const adminSelect = document.getElementById("modal_admin_id");
    try {
        const resPersons = await fetch(`${API_URL}/persons/`);
        if (resPersons.ok) {
            const persons = await resPersons.json();
            personSelect.innerHTML = '<option value="">-- Seleccione un Empleado --</option>';
            persons.forEach(p => {
                personSelect.innerHTML += `<option value="${p.id}">${p.full_name} (${p.employee_id})</option>`;
            });
        }
        const resAdmins = await fetch(`${API_URL}/admins/`);
        if (resAdmins.ok) {
            const admins = await resAdmins.json();
            adminSelect.innerHTML = '<option value="">-- Seleccione su Usuario --</option>';
            admins.forEach(a => {
                adminSelect.innerHTML += `<option value="${a.id}">${a.username} [${a.role}]</option>`;
            });
        }
    } catch (error) {
        console.error("Error cargando los catálogos:", error);
    }
}

// ==========================================
// CARGAR ACTIVOS GLOBAL (CON FILA CLIQUEABLE)
// ==========================================
async function loadAssets() {
    const tableBody = document.getElementById("assetsTableBody");
    const countSpan = document.getElementById("assetCount");
    try {
        const response = await fetch(`${API_URL}/assets/`);
        if (!response.ok) throw new Error("Error en el servidor");
        
        // Guardamos los activos en la variable global
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
            // Agregamos clases visuales para que se note que es cliqueable
            row.className = "hover:bg-blue-50/50 transition-colors cursor-pointer group";
            
            // Evento: Al hacer clic en la fila, abre los detalles profundos
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
// NUEVA LOGICA: DETALLES Y HISTORIAL POR EQUIPO
// ==========================================
async function openDetailsModal(assetId) {
    // 1. Buscar el activo en nuestra memoria local
    const asset = currentAssets.find(a => a.id === parseInt(assetId));
    if (!asset) return;

    // 2. Pintar datos del activo en el modal
    document.getElementById("detailsTitle").innerText = `🔍 Hoja de Vida del Activo`;
    document.getElementById("detailsTag").innerText = `Asset Tag ID: ${asset.asset_tag_id}`;
    document.getElementById("det_description").innerText = asset.asset_description;
    document.getElementById("det_brand_model").innerText = `${asset.brand} - ${asset.model}`;
    document.getElementById("det_serial").innerText = asset.serial_no;
    document.getElementById("det_ids").innerText = `Cat: ${asset.category_id} | Site: ${asset.site_id} | Loc: ${asset.location_id}`;
    document.getElementById("det_assigned").innerText = asset.person_id ? `Empleado ID (DB): ${asset.person_id}` : "Disponible en Almacén";

    // Dar color dinámico al badge de estado dentro del modal
    const statusContainer = document.getElementById("det_status");
    let badgeColor = "bg-green-100 text-green-800";
    if (asset.status === "Checkout") badgeColor = "bg-blue-100 text-blue-800";
    if (asset.status === "Broken") badgeColor = "bg-red-100 text-red-800";
    statusContainer.innerHTML = `<span class="px-2 py-0.5 rounded-full text-xs font-semibold ${badgeColor}">${asset.status}</span>`;

    // 3. Consultar todo el historial y FILTRAR solo el de este asset_id
    const historyBody = document.getElementById("assetSpecificHistoryBody");
    historyBody.innerHTML = `<tr><td colspan="4" class="px-3 py-4 text-center text-gray-400 italic">Buscando bitácora de este equipo...</td></tr>`;

    try {
        const response = await fetch(`${API_URL}/history/`);
        if (response.ok) {
            const allHistory = await response.json();
            // Filtramos estrictamente por el id de este equipo
            const specificHistory = allHistory.filter(h => h.asset_id === asset.id);
            
            historyBody.innerHTML = "";
            if (specificHistory.length === 0) {
                historyBody.innerHTML = `<tr><td colspan="4" class="px-3 py-3 text-center text-gray-400 italic">Este equipo no registra movimientos de asignación previos.</td></tr>`;
            } else {
                // El más nuevo arriba
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
    } catch (error) {
        historyBody.innerHTML = `<tr><td colspan="4" class="px-3 py-3 text-center text-red-500">Error cargando bitácora.</td></tr>`;
    }

    // 4. Mostrar el modal quitando la clase 'hidden'
    document.getElementById("detailsModal").classList.remove("hidden");
}

function closeDetailsModal() {
    document.getElementById("detailsModal").classList.add("hidden");
}

// ==========================================
// LEER HISTORIAL GLOBAL (INFERIOR)
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
    } catch (error) {
        historyBody.innerHTML = `<tr><td colspan="6" class="px-4 py-4 text-center text-red-500">Error al cargar la bitácora.</td></tr>`;
    }
}

// ==========================================
// REGISTRO DE NUEVO ACTIVO
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
            category_id: parseInt(document.getElementById("category_id").value),
            site_id: parseInt(document.getElementById("site_id").value),
            location_id: parseInt(document.getElementById("location_id").value),
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
        } catch (error) {
            alert("Error al conectar con el servidor.");
        }
    });
}

// ==========================================
// CONTROLADOR DEL MODAL DE MOVIMIENTOS
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

// ==========================================
// PROCESAR MOVIMIENTO DE INVENTARIO
// ==========================================
function setupMovementFormListener() {
    const form = document.getElementById("movementForm");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const assetId = document.getElementById("modal_asset_id").value;
        const actionType = document.getElementById("modal_action_type").value;
        const adminId = document.getElementById("modal_admin_id").value;
        const notas = document.getElementById("modal_notas").value;

        if (!adminId) {
            alert("Debe seleccionar un administrador.");
            return;
        }

        let url = `${API_URL}/assets/${assetId}/checkin?admin_id=${adminId}`;
        if (notas) url += `&notas=${encodeURIComponent(notas)}`;

        if (actionType === "checkout") {
            const personId = document.getElementById("modal_person_id").value;
            if (!personId) {
                alert("Debe seleccionar un empleado.");
                return;
            }
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
        } catch (error) {
            alert("Error de conexión.");
        }
    });
}