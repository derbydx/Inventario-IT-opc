# Recovery Plan

Instrucciones para restaurar Inventario IT desde cero si esta carpeta se pierde.

## Requisitos

- Git instalado
- Docker Desktop instalado
- Acceso al repositorio en GitHub

## Restaurar desde GitHub

```bash
git clone https://github.com/derbydx/Inventario-IT-opc.git
cd Inventario-IT-opc
```

Por defecto quedas en la rama `main` (estable). Para la version de desarrollo:

```bash
git checkout prueba
```

## Iniciar con Docker

```bash
docker compose up -d --build
```

Abrir http://localhost:3131.

## Recuperar la base de datos

La base de datos (`backend/it_inventario.db`) no esta en GitHub porque contiene datos reales.

Si tienes un backup del archivo `.db`:

1. Coloca `it_inventario.db` dentro de la carpeta `backend/`
2. Ejecuta `docker compose up -d --build`
3. La app usa los datos del backup inmediatamente

Si no tienes backup:

1. Inicia la app -- se crea una base de datos vacia automaticamente
2. Entra con `derby_admin` / `admin123`
3. Re-importa activos y empleados desde Excel usando la interfaz

## Como funciona el volumen

El archivo `docker-compose.yml` monta la base de datos asi:

```yaml
volumes:
  - ./backend/it_inventario.db:/app/backend/it_inventario.db
```

Esto mantiene los datos en tu PC (no dentro del contenedor). Puedes detener, borrar y recrear el contenedor sin perder informacion.

## Respaldos recomendados

- Copia `backend/it_inventario.db` a un USB, Google Drive o OneDrive periodicamente
- Usa la exportacion a Excel desde la vista de Activos como respaldo portatil
- Antes de cambios grandes, deten el contenedor con `docker compose down` y copia la base de datos

## Auto-arranque en Windows

1. Abre Docker Desktop
2. Settings > General > "Start Docker Desktop when you sign in"
3. El contenedor tiene `restart: unless-stopped` -- arranca solo cuando Docker Desktop se inicie

## Comandos utiles

```bash
docker compose logs -f        # ver logs en vivo
docker compose down           # detener el contenedor
docker compose up -d          # iniciar de nuevo
docker compose up -d --build  # reconstruir la imagen e iniciar
```
