# Inventario IT

Asset management system with multi-user access, role-based permissions, secure login, asset status management, delivery board, category management, repair tracking, and per-status reporting.

## Features

- Asset inventory with advanced search and pagination
- Multi-user system with group-based permissions (Administrador, Nivel 2, Tecnico, Almacen, Solo Lectura)
- Employee directory with department and site management
- Delivery board for pending equipment assignments
- Repair tracking with technician assignment and reason logging
- Import/export via Excel (.xlsx) with templates
- CSV export for filtered views
- Status reports and checkout history
- Dashboard with category breakdown and recent activity

## Tech Stack

- Python (FastAPI) backend with SQLite database
- Static HTML/CSS/JS frontend served by FastAPI
- Tailwind CSS (CDN), no build step
- JWT authentication with per-group boolean permission flags
- Docker support

## Quick Start

### Local

```bash
python -m venv venv
source venv/bin/activate  # Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Open http://localhost:8000 in your browser.

### Docker

```bash
docker compose up -d
```

Open http://localhost:8000.

## Default Credentials

- Username: `derby_admin`
- Password: `admin123`
- Group: Administrador (all permissions)

The admin account and default groups are seeded automatically on every startup.

## Deployment

PythonAnywhere Free plan is supported via the `WebProduction` branch with a `deploy_pa.py` scheduled task.

## Branches

- `prueba` -- active development
- `main` -- stable releases
- `WebProduction` -- PythonAnywhere deployment
