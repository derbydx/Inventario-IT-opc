# Analisis de Seguridad - Inventario-it

Fecha del analisis: 30 de junio de 2026

---

## Criticos

### 1. SECRET_KEY hardcodeado

**Archivo:** `backend/auth.py:11`
**Riesgo:** La clave JWT esta en el codigo fuente como `"inventario-it-secret-key-change-in-production"`. Cualquiera con acceso al repo puede firmar tokens JWT validos.

### 2. Path traversal en SPAStaticFiles

**Archivo:** `backend/main.py:178`
**Riesgo:** El middleware que sirve archivos estaticos permite leer cualquier archivo del sistema con peticiones como `GET /../it_inventario.db`. Esto expone la base de datos SQLite completa, incluyendo passwords hasheados y datos sensibles.

### 3. Endpoint `/admins/` sin autenticacion

**Archivo:** `backend/main.py:301-303`
**Riesgo:** Cualquiera puede listar todos los usuarios admin del sistema incluyendo username, email y rol.

### 4. `/api/custom-reports/run/` sin autenticacion

**Archivo:** `backend/routers/custom_reports.py:179-228`
**Riesgo:** Permite ejecutar consultas a la base de datos sin autenticacion. Exfiltracion masiva de datos.

### 5. GET endpoints principales sin auth

**Archivos:** `backend/main.py:204-254, 301-336, 368-527, 635-663, 1158-1302`
**Riesgo:** Los siguientes endpoints no requieren autenticacion:
- GET `/sites/`, `/departments/`, `/categories/`, `/categories/distinct/`
- GET `/admins/`
- GET `/persons/`
- GET `/assets/`, `/assets/{id}`, `/assets/count/`
- GET `/history/`, `/history/count/`
- GET `/reports/person-checkouts/{person_id}`, `/reports/checkout-timeframe/`, `/reports/department-summary/`, `/reports/department-assets/{dept_id}`
- GET `/deliveries/available-assets`, `/deliveries/pending`, `/deliveries/summary`
- GET `/export/assets/template/`, `/export/persons/template/`, `/export/sites/template/`
- GET `/api/custom-reports/fields/`, `/api/custom-reports/run/`, `/api/custom-reports/export-csv/`

Cualquier persona sin autenticar puede leer el inventario completo, datos personales de empleados, historial y reportes.

---

## Altos

### 6. Password hashing debil

**Archivo:** `backend/auth.py:17-27`
**Detalle:** Usa SHA-256 con salt en vez de bcrypt/argon2. SHA-256 es un algoritmo rapido sin key stretching, permitiendo brute-force a billions de intentos por segundo.

### 7. CORS mal configurado

**Archivo:** `backend/main.py:142-143`
**Detalle:** `allow_origins=["*"]` combinado con `allow_credentials=True`. Esto es invalido segun el estandar CORS y expone la API a cualquier origen.

### 8. Sin rate limiting en login

**Archivo:** `backend/main.py:1462`
**Detalle:** El endpoint `/auth/login` no tiene rate limiting. Un atacante puede brute-forcear credenciales sin restriccion.

### 9. Sin revocacion de tokens JWT

**Archivo:** `backend/auth.py:29-33`
**Detalle:** Un token JWT robado vale por 8 horas completas. No hay mecanismo para revocar tokens al cambiar password o cerrar sesion.

### 10. Base de datos expuesta en el directorio raiz

**Archivo:** `backend/it_inventario.db`
**Detalle:** El archivo SQLite esta en el mismo directorio que el codigo. Combinado con el path traversal (#2), es descargable directamente.

---

## Medios

### 11. Sin variables de entorno para secrets

**Archivo:** `backend/auth.py:11`
**Detalle:** No se usa `os.getenv()` ni archivo `.env`. Todos los secrets estan hardcodeados.

### 12. Documentacion OpenAPI publica

**Detalle:** FastAPI expone `/docs` y `/openapi.json` sin autenticacion, revelando la superficie completa de la API.

### 13. Sin limite de tamano en subida de archivos

**Archivo:** `backend/main.py:830, 849, 892, 1097`
**Detalle:** Los endpoints de importacion no tienen limite de tamano. Un atacante puede subir archivos Excel enormes para DoS.

---

## Bajos

### 14. Type mismatch en schema

**Archivo:** `backend/schemas.py:174`
**Detalle:** `category: str = None` deberia ser `Optional[str] = None`.

### 15. Sin validacion de longitud en strings

**Archivo:** `backend/schemas.py` (todos los schemas)
**Detalle:** No hay `StringConstraints(min_length=..., max_length=...)` en ningun campo string.

### 16. Comparacion de passwords sin tiempo constante

**Archivo:** `backend/auth.py:25`
**Detalle:** La verificacion de password no usa comparacion en tiempo constante. Riesgo teorico de timing attack.

### 17. Token de 8 horas sin refresh

**Archivo:** `backend/auth.py:13`
**Detalle:** El token expira en 480 minutos y no hay mecanismo de refresh token.

### 18. Mensajes de error detallados en 500

**Archivo:** `backend/main.py:157`
**Detalle:** Las respuestas 500 incluyen `str(exc)` que puede filtrar informacion interna.

---

## Prioridad de correccion sugerida

1.  Poner autenticacion en todos los GET endpoints de lectura
2.  Mover SECRET_KEY a variable de entorno
3.  Arreglar path traversal en SPAStaticFiles
4.  Reemplazar SHA-256 por bcrypt/argon2
5.  Agregar rate limiting en login
6.  Configurar CORS correctamente
7.  Agregar limite de tamano en uploads
