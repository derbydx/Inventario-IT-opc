# Plan: App Movil Checkout Rapido (Inventario IT)

## Stack

- **Framework:** React Native + Expo (TypeScript)
- **Routing:** Expo Router (file-based)
- **Camara/Escaneo:** expo-camera + expo-barcode-scanner
- **Estado/Sesion:** React Context + AsyncStorage (token JWT)
- **HTTP Client:** fetch nativo (misma logica que el web actual)

## Backend (cambios minimos)

Reutiliza la API FastAPI existente. Solo agregar:

```python
# 1. Lookup rapido por asset_tag_id (para resultado de escaneo)
GET /assets/by-tag/{asset_tag_id}
# Response: Asset completo o 404

# 2. Busqueda de empleados por employee_id (para escanear credencial)
GET /persons/by-employee-id/{employee_id}
# Response: Person completo o 404

# 3. QR code por asset (generar imagen PNG)
GET /assets/{id}/qrcode
# Response: imagen PNG del QR
```

El QR contiene solo el `asset_tag_id` como texto (ej: "MS0001"). La app escanea, extrae el texto, y llama a `/assets/by-tag/{tag}`.

## QR Codes: generar etiquetas fisicas

Los `asset_tag_id` ya existen (MS0001, PC0003, etc.). Hay que:
1. Generar QR codes como PNG desde esos IDs
2. Imprimirlos en etiquetas adhesivas y pegarlos en los activos

**Como generar:**

**Opcion A - Script Python (recomendado):**
```bash
pip install qrcode[pil]
python scripts/generate_qr_labels.py --output ./qr_labels/
```
Genera un PNG por activo (`MS0001.png`, `PC0003.png`, etc.) y una hoja PDF lista para imprimir.

**Opcion B - Endpoint web:**
```
GET /assets/qrcodes/print-sheet
```
Devuelve un HTML con todos los QR en grid para imprimir desde el navegador.

## Estructura de pantallas

```
app/
├── _layout.tsx              # Root: revisa si hay token → (tabs) o (auth)
├── (auth)/
│   ├── _layout.tsx          # Layout simple del login
│   └── login.tsx            # Formulario usuario/contraseña
├── (tabs)/
│   ├── _layout.tsx          # Tab navigator (4 tabs abajo)
│   ├── index.tsx            # Dashboard
│   ├── scan.tsx             # Escaner + resultado
│   ├── deliveries.tsx       # Entregas pendientes
│   └── assets.tsx           # Busqueda de activos
```

## Pantallas: especificacion

### 1. Login (`(auth)/login.tsx`)
- Input: usuario, contraseña
- Llama a `POST /auth/login`
- Guarda token en AsyncStorage
- Redirige a tabs

### 2. Dashboard (`(tabs)/index.tsx`)
- Cards con: total activos, disponibles, checkout, entregas activas
- Carga desde `GET /assets/?limit=1`, `GET /deliveries/pending`
- Boton rapido "Escanear" que navega a scan tab

### 3. Escaner + Resultado (`(tabs)/scan.tsx`)
- Estado 1: Camara activa con viewfinder
- Al detectar codigo: vibra, muestra overlay de "Procesando..."
- Estado 2: Resultado del activo
  - Foto del activo (si hay) o placeholder
  - Asset tag, descripcion, estado, marca/modelo, serie
  - Boton "Checkout" (si esta Available)
  - Boton "Check In" (si esta Checkout)
  - Boton "Ver historial"
- Estado 3: Checkout flow
  - Buscador de empleado (text input con debounce)
  - Resultados locales filtrados (usa lista global de personas)
  - O escanear credencial del empleado (si implementa `/persons/by-employee-id/`)
  - Confirmar: `POST /movement/{asset_id}` con `{asignado_a_id, tipo_accion: "Checkout", notas}`
  - Feedback: "Asignado a [empleado]" con check animation
- Estado 4: Check In flow
  - Confirmar: `POST /movement/{asset_id}` con `{tipo_accion: "Check in"}`
  - Feedback: "Devuelto a almacen"

### 4. Entregas Pendientes (`(tabs)/deliveries.tsx`)
- Lista de entregas activas desde `GET /deliveries/pending?status=Active`
- Cada item: empleado, categoria, cantidad pendiente, notas
- Boton "Cumplir" → abre camara para escanear activo de esa categoria
- Al escanear, valida que la categoria coincida
- Confirma: `POST /deliveries/pending/{id}/fulfill` con `{asset_id}`
- Feedback + actualiza lista

### 5. Busqueda de Activos (`(tabs)/assets.tsx`)
- Input de busqueda (filtra por asset_tag_id, descripcion, serie)
- Lista de resultados con scroll infinito
- Tap en un activo → muestra detalle:
  - Info completa del activo
  - Persona asignada (si tiene)
  - Historial reciente
  - Boton "Escanear otro" / "Checkout" / "Check In"

## Componentes compartidos

| Componente | Uso |
|---|---|
| `EmployeePicker` | Buscador de empleados con debounce, muestra resultados |
| `AssetCard` | Mini card con tag, descripcion, estado con color |
| `StatusBadge` | Badge de estado (Available=verde, Checkout=azul, etc.) |
| `ScanOverlay` | Overlay de camara con viewfinder animado |
| `LoadingOverlay` | Spinner fullscreen para cargas/transiciones |

## API Service (`services/api.ts`)

```typescript
// Misma logica que api() en app.js:
// - Adjunta Authorization header si hay token
// - Maneja errores HTTP
// - Retorna response para .json() o .ok

api("/assets/by-tag/MS0001")         // GET con token
api("/deliveries/pending", {          // POST con body
  method: "POST",
  body: JSON.stringify({...})
})
```

## Flujo de autenticacion

1. App abre → checkea AsyncStorage por token guardado
2. Si hay token → intenta `GET /api/health` o decodifica JWT para ver si expiro
3. Si token valido → va a `(tabs)` directo
4. Si no hay token o expiro → muestra Login

## Dependencias principales (package.json)

```json
{
  "expo": "~52.x",
  "expo-router": "~4.x",
  "expo-camera": "~16.x",
  "expo-barcode-scanner": "~14.x",
  "expo-secure-store": "~14.x",
  "@react-navigation/bottom-tabs": "^7.x",
  "react-native-safe-area-context": "~5.x",
  "react-native-screens": "~4.x",
  "react-native-qrcode-svg": "^6.x"
}
```

## Lo que NO incluye (fase 1)

- CRUD completo de activos/empleados (solo consulta y movimiento)
- Reportes y exportacion (mejor en web)
- Gestion de usuarios/grupos
- Offline completo (solo cache minimo de empleados para busqueda)
- Push notifications
- Fotos de activos (se puede agregar despues)

## Proximo paso

Inicializar el proyecto en una nueva sesion:
```bash
npx create-expo-app@latest inventario-mobile --template blank-typescript
cd inventario-mobile
npx expo install expo-router expo-camera expo-barcode-scanner expo-secure-store react-native-qrcode-svg
```
