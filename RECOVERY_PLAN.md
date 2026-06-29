# Recovery Plan

Instrucciones para restaurar Inventario IT desde cero, migrar a otra PC, o acceder remotamente.

Contenido:
- [Escenario 1: Acceder desde otra PC (sin mover la app)](#escenario-1-acceder-desde-otra-pc-sin-mover-la-app)
- [Escenario 2: Migrar la app a otra PC](#escenario-2-migrar-la-app-a-otra-pc)
- [Escenario 3: Disaster recovery (PC muerta, empezar de cero)](#escenario-3-disaster-recovery-pc-muerta-empezar-de-cero)
- [Backup recomendado](#backup-recomendado)
- [Referencia: Comandos utiles](#referencia-comandos-utiles)
- [Workflow con worktrees (desarrollo + produccion)](#workflow-con-worktrees-desarrollo--produccion)
- [Referencia: Estructura del proyecto](#referencia-estructura-del-proyecto)

---

## Escenario 1: Acceder desde otra PC (sin mover la app)

La app corre en la PC servidor. Quieres entrar desde otra PC en la misma red o desde internet.

### Por red local (LAN)

1. Busca la IP local de la PC servidor:
   - Abre `cmd` o PowerShell en la PC servidor y ejecuta `ipconfig`
   - Busca la direccion IPv4 (ej: `192.168.1.100`)
2. Desde la otra PC, abre el navegador en:
   ```
   http://192.168.1.100:3131
   ```
3. La PC servidor debe estar encendida con Docker corriendo y el contenedor activo

### Por internet (Cloudflare Tunnel)

Para acceder desde fuera de tu red (ej: desde el trabajo o datos moviles):

1. En la **PC servidor**, abre una terminal y ejecuta:
   ```bash
   cloudflared tunnel --url http://localhost:3131
   ```
2. Aparece una URL como `https://XXXXX.trycloudflare.com`. Abrela desde cualquier dispositivo.
3. Esa terminal debe quedarse abierta. Si la cierras, el tunel se corta.
4. Para mas comodidad, usa el archivo `tunnel.bat` incluido en el proyecto (doble clic y se abre solo).

Si `cloudflared` no esta instalado, descargalo desde:
https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

---

## Escenario 2: Migrar la app a otra PC

Quieres mover la app a otra computadora permanentemente.

### Paso 1: Respaldar archivos necesarios desde la PC actual

Copia estos archivos a un USB, Google Drive, o OneDrive:

| Archivo | Por que es necesario |
|---|---|
| `backend/it_inventario.db` | TODOS los datos de la app (activos, empleados, movimientos, usuarios) |
| `backend/static/` | Personalizaciones visuales (CSS, JS, HTML modificados) |
| (opcional) `tunnel.bat` | Script para tunel Cloudflare |

### Paso 2: En la PC nueva

1. Instala Git: https://git-scm.com/download/win
2. Instala Docker Desktop: https://www.docker.com/products/docker-desktop/
3. Abre PowerShell o CMD y clona el repositorio:
   ```bash
   git clone https://github.com/derbydx/Inventario-IT-opc.git
   cd Inventario-IT-opc
   ```
4. Si usabas la rama `prueba` (desarrollo), cambiate a ella:
   ```bash
   git checkout prueba
   ```
5. Restaura los archivos respaldados:
   - Coloca `it_inventario.db` en `backend/` (reemplaza el existente)
   - Copia el contenido de `static/` en `backend/static/` (reemplaza)
 6. Inicia la app:
    ```bash
    docker compose up -d --build
    # o usa el helper:
    ./serve.ps1 -Rebuild
    ```
 7. Abre http://localhost:3131 en el navegador

### Nota sobre el volumen static

El `docker-compose.yml` monta `./backend/static` como volumen. Esto significa que los cambios en HTML, CSS y JS se reflejan inmediatamente sin reconstruir la imagen Docker. En la PC nueva, si no copiaste `backend/static/`, la app usara los archivos del repositorio (ultima version commiteada).

---

## Escenario 3: Disaster recovery (PC muerta, empezar de cero)

La PC servidor se daño o perdiste acceso. Tienes dos opciones segun si tienes o no un backup de la base de datos.

### Requisitos previos

Cualquier opcion requiere instalar esto en la PC nueva:

- Git: https://git-scm.com/download/win
- Una de estas opciones para correr la app:
  - **Opcion A (recomendada)**: Docker Desktop - https://www.docker.com/products/docker-desktop/
  - **Opcion B (alternativa)**: Python 3.10+ - https://www.python.org/downloads/

### Opcion A: Con Docker (recomendada)

```bash
git clone https://github.com/derbydx/Inventario-IT-opc.git
cd Inventario-IT-opc
git checkout prueba
```

#### Si tienes backup de la base de datos

```bash
# Coloca it_inventario.db en backend/ (sobreescribe el archivo existente)
docker compose up -d --build
```

#### Si NO tienes backup

```bash
docker compose up -d --build
```

La app se inicia con una base de datos vacia. Usa estas credenciales:

- **Usuario**: `derby_admin`
- **Password**: `admin123`

Luego re-importa activos y empleados desde Excel usando la interfaz web.

### Opcion B: Con Python directo (sin Docker)

Usa esta opcion si la PC nueva no soporta Docker o prefieres algo mas liviano.

```bash
git clone https://github.com/derbydx/Inventario-IT-opc.git
cd Inventario-IT-opc
git checkout prueba
```

#### Setup automatico (recomendado)

```powershell
.\setup.ps1
```

Esto crea el entorno virtual, instala dependencias, verifica la base de datos e inicia el servidor.

#### Setup manual paso a paso

```bash
# Crear entorno virtual
python -m venv .venv

# Activar (PowerShell)
.venv\Scripts\Activate.ps1

# Activar (CMD)
.venv\Scripts\activate.bat

# Instalar dependencias
pip install -r requirements.txt

# Ir al backend e iniciar servidor
cd backend
uvicorn main:app --host 0.0.0.0 --port 3131 --reload
```

Abrir http://localhost:3131.

**Default credentials**: `derby_admin` / `admin123`

### Verificar que funciona

```bash
# Ver estado del contenedor (Docker)
docker ps

# Ver logs (ningun error)
docker compose logs -f

# Probar que responde el API
curl http://localhost:3131/health
```

---

## Backup recomendado

### Que respaldar

| Archivo | Frecuencia | Donde guardarlo |
|---|---|---|
| `backend/it_inventario.db` | Diaria o semanal | USB, Google Drive, OneDrive, NAS |
| `backend/static/` | Solo cuando edites HTML/CSS/JS | Mismo repositorio en GitHub |
| Exportacion Excel de activos | Mensual | Misma ubicacion que el .db |

### Como respaldar la base de datos

Opción manual (detener contenedor, copiar, reiniciar):

```bash
docker compose down
copy backend\it_inventario.db D:\backups\it_inventario_2025-01-01.db
docker compose up -d
```

Opción simple (sin detener el contenedor, la base de datos SQLite soporta copia en caliente):

```bash
copy backend\it_inventario.db D:\backups\
```

### Que NO esta en GitHub

El archivo `.gitignore` excluye `*.db`. Esto significa que la base de datos con tus datos reales NUNCA se sube al repositorio. El unico backup de tus datos eres tu. Respaldala periodicamente.

---

## Workflow con worktrees (desarrollo + produccion)

El proyecto usa dos ramas con worktrees para mantener separados desarrollo y produccion.

### Estructura

```
Documents/OpenCode/
  Inventario-it/          ← worktree de prueba (rama prueba)
    - docker-compose.test.yml  → 3132, DB test separada
    - serve.ps1               → script unificado
    - backend/it_inventario_test.db

  inventario-main/        ← worktree de main (rama main)
    - docker-compose.yml       → 3131
    - backend/it_inventario.db
```

### Flujo diario

```powershell
# Desarrollo (en Inventario-it)
cd Inventario-it
./serve.ps1 -Test          # corre en http://localhost:3132
# ...editas backend/static/ y se ve al instante...

# Produccion (en inventario-main)
cd ../inventario-main
./serve.ps1                # corre en http://localhost:3131

# Detener
./serve.ps1 -Stop

# Reconstruir imagen
./serve.ps1 -Rebuild
```

### Como pasar cambios de desarrollo a produccion

```powershell
cd ../inventario-main
git pull origin main       # asegurar main actualizado
git pull origin prueba     # traer cambios de prueba
git merge prueba           # mergear prueba en main
git push origin main       # subir
./serve.ps1 -Rebuild       # reconstruir contenedor de produccion
```

### Migrar a PC nueva con worktrees

```bash
git clone https://github.com/derbydx/Inventario-IT-opc.git
cd Inventario-IT-opc
git checkout main
git worktree add ../inventario-prueba prueba
```

Luego colocar `it_inventario.db` en ambos `backend/` y copiar el contenido de `static/`.

---

## Referencia: Comandos utiles

```bash
# Docker
docker compose up -d           # iniciar contenedor en background
docker compose up -d --build   # reconstruir imagen e iniciar
docker compose down            # detener contenedor
docker compose logs -f         # ver logs en vivo
docker ps                      # ver contenedores activos

# Python (sin Docker)
.\start_server.ps1             # iniciar servidor con Python directo
.\setup.ps1                    # setup completo + iniciar servidor

# Cloudflare Tunnel (acceso remoto)
tunnel.bat                     # iniciar tunel (doble clic)
cloudflared tunnel --url http://localhost:3131  # desde terminal
```

### Default credentials

- **Usuario**: `derby_admin`
- **Password**: `admin123`

### Puertos

| Servicio | Puerto |
|---|---|---|
| App web (produccion) | 3131 |
| App web (desarrollo/prueba) | 3132 |
| API interna | 8000 (dentro del contenedor Docker) |

---

## Referencia: Estructura del proyecto

```
Inventario-IT-opc/
├── backend/
│   ├── main.py              # API principal (FastAPI)
│   ├── database.py           # Conexion a SQLite
│   ├── models.py             # Modelos SQLAlchemy
│   ├── schemas.py            # Schemas Pydantic
│   ├── auth.py               # Autenticacion JWT
│   ├── routers/              # Routers organizados
│   ├── static/               # Frontend (HTML, CSS, JS)
│   │   ├── index.html
│   │   ├── app.js
│   │   └── styles.css
│   └── it_inventario.db      # Base de datos SQLite (NO en GitHub)
├── docker-compose.yml        # Produccion (3131)
├── docker-compose.test.yml   # Desarrollo/prueba (3132, DB separada)
├── Dockerfile
├── requirements.txt
├── serve.ps1                 # Script helper: prod, test, stop, rebuild
├── start_server.ps1          # Iniciar con Python directo
├── setup.ps1                 # Setup completo (venv + dependencias + servidor)
├── tunnel.bat                # Cloudflare Tunnel (acceso remoto)
└── wsgi.py                   # Entry point para WSGI
```
