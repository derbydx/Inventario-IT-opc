# Plan de Correcciones: Inventario-it

Proyecto de inventario IT, produccion con multiples usuarios. Stack: FastAPI + SQLite + vanilla JS + Cloudflare Tunnel.

---

## Fase 1: Seguridad

**Objetivo**: Proteger endpoints de autenticacion y agregar defensas HTTP basicas.

### 1.1 Rate limiting en auth

**Archivos**: `backend/main.py`, `backend/requirements.txt`

**Que hacer**:
- Agregar `slowapi` a `requirements.txt`.
- En `main.py`, configurar `Limiter` con keyfunc basada en IP del cliente (`request.client.host`).
- Aplicar `@limiter.limit("10/minute")` a los endpoints `/api/login` y `/login`.
- Los demas endpoints pueden tener limite generoso (`100/minute`).

**Verificacion**:
- Hacer 11 requests rapidas a `/api/login` -> la 11ava debe retornar `429 Too Many Requests`.

### 1.2 Security headers

**Archivos**: `backend/main.py`

**Que hacer**:
- Crear middleware Starlette que agregue estos headers a toda respuesta:
  - `Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; img-src 'self' data:`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`

**Verificacion**:
- `curl -I http://localhost:8000/` debe mostrar todos los headers.

### 1.3 Sanitizar errores 500

**Archivos**: `backend/main.py`

**Que hacer**:
- Agregar handler global de excepciones (`@app.exception_handler(Exception)`) que retorne `{"detail": "Error interno del servidor"}` sin stack trace.
- Usar `traceback.format_exc()` para loggear el error internamente pero no exponerlo.

**Verificacion**:
- Forzar un error (ej. endpoint que divide por cero) -> respuesta JSON sin stack trace.

---

## Fase 2: Tests

**Objetivo**: Base de confianza para refactorizar sin romper funcionalidad existente.

**Archivos nuevos**: `backend/tests/__init__.py`, `backend/tests/conftest.py`, `backend/tests/test_auth.py`, `backend/tests/test_assets.py`, `backend/tests/test_movements.py`, `backend/tests/test_reports.py`

### 2.1 Setup de testing

**Que hacer**:
- Agregar `pytest` y `httpx` a `requirements.txt`.
- Crear `conftest.py` con:
  - Fixture de `client` usando `TestClient` de FastAPI.
  - Fixture `admin_token` que hace login y retorna cookie de sesion.
  - Fixture `test_person` que crea una persona de prueba.
  - Fixture `test_asset` que crea un asset de prueba.

### 2.2 Test de smoke

**Que hacer**:
- `test_get_root_returns_200` - GET `/` retorna 200.
- `test_static_files_served` - verificar que CSS/JS se sirven.

### 2.3 Test de autenticacion

**Que hacer**:
- `test_login_success` - POST `/api/login` con credenciales correctas retorna 200.
- `test_login_failure` - POST `/api/login` con credenciales incorrectas retorna 401.
- `test_logout` - POST `/api/logout` invalida sesion.

### 2.4 Test de CRUD activos

**Que hacer**:
- `test_list_assets_empty` - GET `/api/assets` retorna lista vacia.
- `test_create_asset` - POST `/api/assets` crea y retorna asset.
- `test_get_asset_by_id` - GET `/api/assets/{id}` retorna asset especifico.
- `test_update_asset` - PUT `/api/assets/{id}` actualiza campos.
- `test_delete_asset` - DELETE `/api/assets/{id}` elimina asset.

### 2.5 Test de movimientos

**Que hacer**:
- `test_checkout_asset` - POST `/api/movements/checkout` asigna asset a persona.
- `test_checkin_asset` - POST `/api/movements/checkin` libera asset.
- `test_checkout_to_inactive_person_blocked` - POST a checkout con persona inactiva retorna 400.

### 2.6 Test de reports (opcional, post-MVP)

**Que hacer**:
- `test_department_report` - GET `/api/reports/departments` retorna datos.
- `test_assets_by_department` - GET `/api/reports/departments/{dept}/assets` retorna assets.

---

## Fase 3: Refactor

**Objetivo**: Dividir archivos monoliticos en modulos manejables.

### 3.1 Dividir `backend/main.py`

**Nuevos archivos**:
```
backend/
  routers/
    __init__.py        # from .assets import router as assets_router, etc.
    assets.py          # endpoints /api/assets
    persons.py         # endpoints /api/persons
    movements.py       # endpoints /api/movements
    deliveries.py      # endpoints /api/deliveries
    reports.py         # endpoints /api/reports (dashboard + reports + department)
    reconciliation.py  # endpoints /api/reconciliation
    history.py         # endpoints /api/history
    auth.py            # endpoints /login, /api/login, /api/logout
    upload.py          # endpoints /api/upload
  services/
    __init__.py
    asset_service.py   # logica de negocio de assets (CRUD, search, sort)
    person_service.py  # logica de personas
    movement_service.py # checkout/checkin logic
    reconciliation_service.py  # reconciliacion
    report_service.py  # agregaciones, dashboard stats
  models.py            # se queda igual
  schemas.py           # se queda igual
  auth.py              # se queda igual
  database.py          # se queda igual
  main.py              # solo imports y registro de routers (~50 lines)
```

**Detalle por endpoint**:
| Archivo | Endpoints |
|---------|-----------|
| `routers/auth.py` | `GET /login`, `POST /login`, `POST /api/login`, `POST /api/logout` |
| `routers/assets.py` | `GET /api/assets`, `POST /api/assets`, `GET /api/assets/{id}`, `PUT /api/assets/{id}`, `DELETE /api/assets/{id}`, `GET /api/assets/count`, `GET /api/export/assets`, `POST /api/import/assets`, `GET /api/download/template` |
| `routers/persons.py` | `GET /api/persons`, `POST /api/persons`, `PUT /api/persons/{id}`, `DELETE /api/persons/{id}`, `GET /api/persons/search` |
| `routers/movements.py` | `POST /api/movements/checkout`, `POST /api/movements/checkin` |
| `routers/deliveries.py` | `GET /api/deliveries/pending`, `POST /api/deliveries/pending`, `DELETE /api/deliveries/pending/{id}`, `POST /api/deliveries/pending/{id}/fulfill` |
| `routers/reports.py` | `GET /api/dashboard/stats`, `GET /api/dashboard/recent`, `GET /api/reports/person-checkouts/{id}`, `GET /api/reports/departments`, `GET /api/reports/departments/{dept}/assets`, `GET /api/reports/departments/{dept}/export` |
| `routers/reconciliation.py` | `POST /api/reconciliation/upload`, `GET /api/reconciliation/status`, `POST /api/reconciliation/{session_id}/clear/{asset_id}`, `POST /api/reconciliation/{session_id}/refresh` |
| `routers/history.py` | `GET /api/history` |
| `routers/upload.py` | `POST /api/upload` |

**Verificacion**: Todos los tests de Fase 2 pasan (verifica que no se rompio nada).

### 3.2 Dividir `backend/static/app.js`

**Nuevos archivos**:
```
backend/static/
  js/
    app.js          # ~300 lines: bootstrap, shared state, init
    api.js          # ~100 lines: fetch wrappers, base URL
    ui.js           # ~300 lines: modals, toasts, sidebar, helpers
    assets.js       # ~400 lines: loadAssets, renderAssetTable, buildAssetRowHTML, advancedSearch, sort
    movements.js    # ~200 lines: checkout/checkin flows, movement form
    dashboard.js    # ~200 lines: renderDashBars, updateDashboard, recent activity
    reconciliation.js # ~300 lines: loadReconciliationStatus, renderReconciliationStatus, checkin flow
    deliveries.js   # ~150 lines: loadDeliveryBoard, cancelPending, fulfill
    reports.js      # ~200 lines: loadDepartmentReport, toggleDeptAssets, exportCSV
    persons.js      # ~250 lines: renderEmployeesPage, editPerson modal
    history.js      # ~50 lines: loadHistory
```

**Nota**: `index.html` debe cargar los scripts en orden (api.js, ui.js, assets.js, etc.) usando `<script defer>`.

**Verificacion**: Navegar por todas las secciones de la app, ninguna funcionalidad rota.

### 3.3 Dividir `backend/static/index.html`

**Opciones**:
- **Opcion A (ligera)**: Agregar comentarios `<!-- SECTION: Dashboard -->`, `<!-- SECTION: Assets -->`, etc. para navegacion dentro del mismo archivo.
- **Opcion B (completa)**: Usar Jinja2 templates con `{% include %}` para renderizar secciones desde `templates/`.

Recomendacion: Opcion A por ahora (menos riesgo, misma mantenibilidad). Opcion B si se agregan mas paginas.

---

## Fase 4: Observabilidad

**Objetivo**: Poder diagnosticar errores en produccion sin leer la terminal.

### 4.1 Logging estructurado

**Archivos**: `backend/main.py` (o `backend/logging_config.py` nuevo)

**Que hacer**:
- Configurar `logging` con formato JSON: `{"time": "...", "level": "INFO", "event": "...", "path": "...", "method": "...", "status": 200}`.
- Crear middleware que loggee cada request: metodo, path, status code, duracion.
- Asignar `request_id` (UUID) por request, loggearlo en cada entrada.
- Loggear errores 500 con `exc_info=True`.
- Output a `stderr` (uvicorn captura) + archivo `logs/inventario.log` con rotacion diaria (7 dias).

**Verificacion**:
- Hacer request a la app -> ver linea JSON en terminal.
- Forzar error 500 -> ver stack trace en archivo de log.

### 4.2 Health check endpoint

**Archivos**: `backend/routers/health.py` (nuevo)

**Que hacer**:
- `GET /api/health` retorna `{"status": "ok", "db": "connected", "timestamp": "..."}`.
- Verifica conexion a DB ejecutando `SELECT 1`.
- Sin autenticacion (para monitoreo externo).

---

## Fase 5: Documentacion

**Objetivo**: Capturar decisiones de arquitectura para futuros mantenedores.

### 5.1 ADR-001: Stack tecnologico

**Archivo**: `docs/decisions/ADR-001-stack-tecnologico.md`

**Que documentar**:
- Contexto: app de inventario IT para produccion multi-usuario.
- Decision: FastAPI + SQLite + vanilla JS + Cloudflare Tunnel.
- Alternativas consideradas: Django/PostgreSQL, Flask, React.
- Consecuencias: SQLite no escala a muchos usuarios concurrentes; migracion futura a PostgreSQL posible.

### 5.2 ADR-002: Diseno de UI

**Archivo**: `docs/decisions/ADR-002-diseno-ui.md`

**Que documentar**:
- Contexto: necesidad de dashboard sin dependencias externas.
- Decision: CSS bars en vez de Chart.js; glass-morphism login; paleta amber/copper.
- Alternativas consideradas: Chart.js, Recharts, dashboard libraries.
- Consecuencias: 0 dependencias JS externas, pero charts limitados a barras horizontales.

### 5.3 ADR-003: Reconciliation design

**Archivo**: `docs/decisions/ADR-003-reconciliation.md`

**Que documentar**:
- Contexto: reconciliar empleados activos contra archivo externo.
- Decision: marcado `cleared` en vez de DELETE; `is_active` en Person; reactivacion automatica.
- Alternativas consideradas: borrado fisico, tabla separada de ausentes.
- Consecuencias: historial preservado, consultas deben filtrar `cleared=False`.

### 5.4 ADR-004: Estrategia de testing

**Archivo**: `docs/decisions/ADR-004-testing-strategy.md`

**Que documentar**:
- Contexto: 0 tests existentes, riesgo de regresion.
- Decision: pytest + httpx TestClient; tests aislados con DB en memoria; priorizar endpoints criticos.
- Alternativas consideradas: unittest, robot framework, selenium.
- Consecuencias: tests de integracion usan misma DB que produccion (SQLite), no se requiere test DB separada.

---

## Roadmap

```
Semana 1-2: Fase 1 (Seguridad)
  Dia 1-2:  Rate limiting
  Dia 3-4:  Security headers
  Dia 5:    Sanitizar errores

Semana 3-4: Fase 2 (Tests)
  Dia 1:    Setup pytest + conftest
  Dia 2:    Smoke + auth tests
  Dia 3-4:  Asset CRUD tests
  Dia 5:    Movement tests

Semana 5-8: Fase 3 (Refactor)
  Semana 5: Crear routers/ + mover endpoints uno por uno
  Semana 6: Crear services/ + mover logica de negocio
  Semana 7: Dividir app.js en modulos
  Semana 8: Dividir index.html con comentarios + ajustes finales

Semana 9:   Fase 4 (Observabilidad)
  Dia 1-2:  Logging middleware
  Dia 3:    Health check
  Dia 4-5:  Ajustes y pruebas

Semana 10:  Fase 5 (Documentacion)
  Dia 1:    ADR-001 + ADR-002
  Dia 2:    ADR-003 + ADR-004
  Dia 3:    Revision final
```

---

## Dependencias entre tareas

```
Rate limiting ──┐
Security headers ──┤
Sanitizar errores ─┤
                  ├──> Tests ──> Refactor ──> Observabilidad ──> Documentacion
                  │       │
                  └───────┘ (tests usan endpoints protegidos)
```

- Fase 1 y Fase 2 pueden ejecutarse en paralelo.
- Fase 3 requiere Fase 2 completa (tests pasando) para refactorizar con seguridad.
- Fase 4 es independiente de Fase 3, puede ejecutarse en paralelo.
- Fase 5 es la ultima, captura decisiones ya tomadas en fases anteriores.
