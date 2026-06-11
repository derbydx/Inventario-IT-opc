const API_URL = "http://127.0.0.1:8000";

document.addEventListener("DOMContentLoaded", () => {
    loadAssets();
    loadDropdownData(); // <-- NUEVA: Carga los nombres al iniciar
    setupFormListener();
    setupMovementFormListener();
});

// ==========================================
// NUEVA FUNCIÓN: CARGAR NOMBRES EN LOS SELECTS
// ==========================================
async function loadDropdownData() {
    const personSelect = document.getElementById("modal_person_id");
    const adminSelect = document.getElementById("modal_admin_id");

    try {
        // 1. Traer y llenar Empleados
        const resPersons = await fetch(`${API_URL}/persons/`);
        if (resPersons.ok) {
            const persons = await resPersons.json();
            personSelect.innerHTML = '<option value="">-- Seleccione un Empleado --</option>';
            persons.forEach(p => {
                personSelect.innerHTML += `<option value="${p.id}">${p.full_name} (${p.employee_id})</option>`;
            });
        }

        // 2. Traer y llenar Administradores
        const resAdmins = await fetch(`${API_URL}/admins/`);
        if (resAdmins.ok) {
            const admins = await resAdmins.json();
            adminSelect.innerHTML = '<option value="">-- Seleccione su Usuario --</option>';
            admins.forEach(a => {
                adminSelect.innerHTML += `<option value="${a.id}">${a.username} [${a.role}]</option>`;
            });
        }

    } catch (error) {
        console.error("Error cargando los catálogos de nombres:", error);
    }
}

// ==========================================
// CARGAR ACTIVOS CON BOTONES DE ACCIÓN
// ==========================================
async function loadAssets() {
    const tableBody = document.getElementById("assetsTableBody");
    const countSpan = document.getElementById("assetCount");

    try {
        const response = await fetch(`${API_URL}/assets/`);
        if (!response.ok) throw new Error("Error en el servidor");

        const assets = await response.json();
        tableBody.innerHTML = "";

        if (assets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400 italic">No hay activos registrados.</td></tr>`;
            countSpan.innerText = "0 Equipos";
            return;
        }

        countSpan.innerText = `${assets.length} ${assets.length === 1 ? 'Equipo' : 'Equipos'}`;

        assets.forEach(asset => {
            const row = document.createElement("tr");
            row.className = "hover:bg-gray-50 transition-colors";
            
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
                <td class="px-4 py-3 font-mono font-bold text-gray-700">${asset.asset_tag_id}</td>
                <td class="px-4 py-3 text-gray-600">${asset.asset_description}</td>
                <td class="px-4 py-3 text-gray-500">${asset.brand} ${asset.model}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeColor}">
                        ${asset.status}
                    </span>
                </td>
                <td class="px-4 py-3 text-center">${actionButton}</td>
            `;
            tableBody.appendChild(row);
        });

    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-red-500 font-medium">⚠️ Error de conexión con el Backend</td></tr>`;
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
// LOGICA CONTROLADORA DEL MODAL
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
// ENVÍO DEL MOVIMIENTO AL BACKEND
// ==========================================
function setupMovementFormListener() {
    const form = document.getElementById("movementForm");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const assetId = document.getElementById("modal_asset_id").value;
        const actionType = document.getElementById("modal_action_type").value;
        const adminId = document.getElementById("modal_admin_id").value;
        const  notas = document.getElementById("modal_notas").value;

        if (!adminId) {
            alert("Debe seleccionar un administrador para procesar la acción.");
            return;
        }

        let url = `${API_URL}/assets/${assetId}/checkin?admin_id=${adminId}`;
        if (notas) url += `&notas=${encodeURIComponent(notas)}`;

        if (actionType === "checkout") {
            const personId = document.getElementById("modal_person_id").value;
            if (!personId) {
                alert("Debe seleccionar un empleado para la asignación.");
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
            } else {
                const err = await response.json();
                alert(`Error: ${err.detail || "No se pudo procesar"}`);
            }
        } catch (error) {
            alert("Error de conexión con el servidor.");
        }
    });
}