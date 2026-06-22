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
- Custom reports with dynamic field selection and saved presets

## Tech Stack

- Python (FastAPI) backend with SQLite database
- Static HTML/CSS/JS frontend served by FastAPI
- Tailwind CSS (CDN), no build step
- JWT authentication with per-group boolean permission flags
- Docker support

## Quick Start

### Docker (recommended)

Requirements: Docker Desktop (Windows) or Docker Engine (Linux).

```bash
docker compose up -d --build
```

Open http://localhost:3131 in your browser.

The container restarts automatically on boot if Docker Desktop is set to launch at login (enabled by default). To stop:

```bash
docker compose down
```

To view logs:

```bash
docker compose logs -f
```

### Local (without Docker)

```bash
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 3131
```

Open http://localhost:3131.

## Default Credentials

- Username: `derby_admin`
- Password: `admin123`
- Group: Administrador (all permissions)

The admin account and default groups are seeded automatically on every startup.

## Branches

- `prueba` -- active development
- `main` -- stable releases
- `WebProduction` -- PythonAnywhere deployment

## Project Structure

```
backend/
  main.py              FastAPI app entry point
  database.py          SQLAlchemy engine and session
  models.py            Database models
  schemas.py           Pydantic schemas
  auth.py              JWT authentication and hashing
  seed.py              Default data seeding
  routers/             API route modules
  static/              Frontend (HTML, CSS, JS)
  it_inventario.db     SQLite database file
Dockerfile             Docker image definition
docker-compose.yml     Docker service configuration
requirements.txt       Python packages
```

## Recovery

If this folder is lost, see `RECOVERY_PLAN.md` for step-by-step instructions to restore the application from GitHub.
