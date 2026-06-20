# Recovery Plan

Instructions to restore Inventario IT from scratch if this folder is lost.

## Prerequisites

- GitHub account with access to the repository
- Git installed
- Docker Desktop installed (or Python 3.12+ if running locally)

## Step 1: Clone the repository

```bash
git clone https://github.com/derbydx/Inventario-it.git
cd Inventario-it
```

Branches available:

- `main` -- stable release
- `prueba` -- latest development

To switch to development branch:

```bash
git checkout prueba
```

## Step 2: Start the application

### Option A: Docker (recommended)

```bash
docker compose up -d --build
```

Open http://localhost:8000.

### Option B: Local

```bash
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## Step 3: Log in

- Username: `derby_admin`
- Password: `admin123`

The database is seeded with default groups and admin account on first run. If the database file is missing, it will be created automatically.

## Data Recovery

The SQLite database (`backend/it_inventario.db`) is not stored in GitHub. If lost:

1. Start the application -- a fresh empty database is created automatically
2. Log in with the default credentials above
3. Re-import assets and employees via the Excel import feature in the UI

If you have a database backup (`.db` file), place it at `backend/it_inventario.db` before starting the application.

## Backup Recommendations

- Periodically copy `backend/it_inventario.db` to a safe location (external drive, cloud storage)
- Use Excel export from the Assets view as a portable backup format
- Before major changes, stop the container and copy the database

## Container Auto-Start on Windows

1. Open Docker Desktop
2. Go to Settings > General
3. Ensure "Start Docker Desktop when you sign in" is checked
4. The container has `restart: unless-stopped` configured -- it starts automatically when Docker Desktop launches
