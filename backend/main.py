from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from typing import List
import traceback, os

import models
import schemas
from database import engine, get_db
from auth import hash_password, verify_password, create_access_token, get_current_admin

# Inicializar la base de datos SQLite
models.Base.metadata.create_all(bind=engine)

# ==========================================
# SEEDER AUTOMÁTICO: CREAR PRIMER ADMIN SI NO EXISTE
# ==========================================
# ==========================================
# SEEDER AUTOMÁTICO REFORZADO (REPARA CONTRASEÑAS)
# ==========================================
def crear_admin_por_defecto():
    db = get_db().__next__()
    try:
        # Buscamos específicamente si ya existe el usuario 'derby_admin'
        admin = db.query(models.Admin).filter(models.Admin.username == "derby_admin").first()
        
        if not admin:
            print("Sembrando cuenta de administrador inicial...")
            nuevo_admin = models.Admin(
                username="derby_admin",
                email="derby@empresa.com",
                password_hash=hash_password("admin123"),
                role="Administrator"
            )
            db.add(nuevo_admin)
            db.commit()
            print("Usuario 'derby_admin' creado con exito. Contrasena: admin123")
        else:
            admin.password_hash = hash_password("admin123")
            db.commit()
            print("Usuario 'derby_admin' detectado. Contrasena restablecida en: admin123")
            
    except Exception as e:
        print(f"No se pudo verificar/crear el admin inicial: {e}")
    finally:
        db.close()

# Ejecutamos el Seeder al arrancar el backend
crear_admin_por_defecto()

app = FastAPI(
    title="IT Asset Manager API",
    description="Backend completo estilo AssetTiger",
    version="1.0.0"
)

# ==========================================
# CONFIGURACIÓN DE CORS BLINDADA
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# CAPTURADOR GLOBAL DE ERRORES
# ==========================================
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("ERROR CRITICO DETECTADO EN EL BACKEND:")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Error interno en Python/SQLite: {str(exc)}"},
    )

# ==========================================
# HEALTH CHECK
# ==========================================
@app.get("/api/health", tags=["Diagnóstico"])
def health_check():
    return {"status": "ok"}

# ==========================================
# STATIC FILES - catch-all for frontend SPA
# ==========================================
from starlette.middleware.base import BaseHTTPMiddleware

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "static")

class SPAStaticFiles(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if response.status_code == 404 and request.method in ("GET", "HEAD"):
            file_path = os.path.join(FRONTEND_DIR, request.url.path.lstrip("/"))
            if os.path.isfile(file_path):
                return FileResponse(file_path)
            index_path = os.path.join(FRONTEND_DIR, "index.html")
            if os.path.isfile(index_path):
                return FileResponse(index_path)
        return response

app.add_middleware(SPAStaticFiles)

# ==========================================
# 1. ENDPOINTS: SITIOS (SITES)
# ==========================================
@app.post("/sites/", response_model=schemas.SiteResponse, status_code=status.HTTP_201_CREATED, tags=["Sitios y Ubicaciones"])
def create_site(site: schemas.SiteBase, db: Session = Depends(get_db), admin: models.Admin = Depends(get_current_admin)):
    db_site = db.query(models.Site).filter(models.Site.site_name == site.site_name).first()
    if db_site:
        raise HTTPException(status_code=400, detail="El sitio ya existe")
    nuevo_sitio = models.Site(**site.model_dump())
    db.add(nuevo_sitio)
    db.commit()
    db.refresh(nuevo_sitio)
    return nuevo_sitio

@app.get("/sites/", response_model=List[schemas.SiteResponse], tags=["Sitios y Ubicaciones"])
def list_sites(db: Session = Depends(get_db)):
    return db.query(models.Site).all()

# ==========================================
# 2. ENDPOINTS: UBICACIONES (LOCATIONS)
# ==========================================
@app.post("/locations/", response_model=schemas.LocationResponse, status_code=status.HTTP_201_CREATED, tags=["Sitios y Ubicaciones"])
def create_location(location: schemas.LocationBase, db: Session = Depends(get_db), admin: models.Admin = Depends(get_current_admin)):
    db_site = db.query(models.Site).filter(models.Site.id == location.site_id).first()
    if not db_site:
        raise HTTPException(status_code=404, detail="El Sitio especificado (site_id) no existe")
    nueva_ubicacion = models.Location(**location.model_dump())
    db.add(nueva_ubicacion)
    db.commit()
    db.refresh(nueva_ubicacion)
    return nueva_ubicacion

@app.get("/locations/", response_model=List[schemas.LocationResponse], tags=["Sitios y Ubicaciones"])
def list_locations(db: Session = Depends(get_db)):
    return db.query(models.Location).all()

# ==========================================
# 3. ENDPOINTS: DEPARTAMENTOS
# ==========================================
@app.post("/departments/", response_model=schemas.DepartmentResponse, status_code=status.HTTP_201_CREATED, tags=["Catálogos"])
def create_department(dept: schemas.DepartmentBase, db: Session = Depends(get_db), admin: models.Admin = Depends(get_current_admin)):
    db_dept = db.query(models.Department).filter(models.Department.department_name == dept.department_name).first()
    if db_dept:
        raise HTTPException(status_code=400, detail="El departamento ya existe")
    nuevo_depto = models.Department(**dept.model_dump())
    db.add(nuevo_depto)
    db.commit()
    db.refresh(nuevo_depto)
    return nuevo_depto

@app.get("/departments/", response_model=List[schemas.DepartmentResponse], tags=["Catálogos"])
def list_departments(db: Session = Depends(get_db)):
    return db.query(models.Department).all()

# ==========================================
# 4. ENDPOINTS: CATEGORÍAS
# ==========================================
@app.post("/categories/", response_model=schemas.CategoryResponse, status_code=status.HTTP_201_CREATED, tags=["Catálogos"])
def create_category(category: schemas.CategoryBase, db: Session = Depends(get_db), admin: models.Admin = Depends(get_current_admin)):
    db_category = db.query(models.Category).filter(models.Category.category_name == category.category_name).first()
    if db_category:
        raise HTTPException(status_code=400, detail="La categoría ya existe")
    nueva_categoria = models.Category(category_name=category.category_name)
    db.add(nueva_categoria)
    db.commit()
    db.refresh(nueva_categoria)
    return nueva_categoria

@app.get("/categories/", response_model=List[schemas.CategoryResponse], tags=["Catálogos"])
def list_categories(db: Session = Depends(get_db)):
    return db.query(models.Category).all()

# ==========================================
# 5. ENDPOINTS: ADMINISTRADORES (ADMINS)
# ==========================================
@app.post("/admins/", response_model=schemas.AdminResponse, status_code=status.HTTP_201_CREATED, tags=["Seguridad y Administradores"])
def create_admin(admin: schemas.AdminCreate, db: Session = Depends(get_db), current_admin: models.Admin = Depends(get_current_admin)):
    db_admin = db.query(models.Admin).filter((models.Admin.username == admin.username) | (models.Admin.email == admin.email)).first()
    if db_admin:
        raise HTTPException(status_code=400, detail="El nombre de usuario o email ya están registrados")
    
    nuevo_admin = models.Admin(
        username=admin.username,
        email=admin.email,
        password_hash=hash_password(admin.password),
        role=admin.role
    )
    db.add(nuevo_admin)
    db.commit()
    db.refresh(nuevo_admin)
    return nuevo_admin

@app.get("/admins/", response_model=List[schemas.AdminResponse], tags=["Seguridad y Administradores"])
def list_admins(db: Session = Depends(get_db)):
    return db.query(models.Admin).all()

# ==========================================
# 6. ENDPOINTS: EMPLEADOS / PERSONAS (PERSONS)
# ==========================================
@app.post("/persons/", response_model=schemas.PersonResponse, status_code=status.HTTP_201_CREATED, tags=["Directorio de Personal"])
def create_person(person: schemas.PersonCreate, db: Session = Depends(get_db), admin: models.Admin = Depends(get_current_admin)):
    db_person = db.query(models.Person).filter((models.Person.email == person.email) | (models.Person.employee_id == person.employee_id)).first()
    if db_person:
        raise HTTPException(status_code=400, detail="El Employee ID o Correo ya existen en el directorio")
    
    nueva_persona = models.Person(**person.model_dump())
    db.add(nueva_persona)
    db.commit()
    db.refresh(nueva_persona)
    return nueva_persona

@app.get("/persons/", response_model=List[schemas.PersonResponse], tags=["Directorio de Personal"])
def list_persons(db: Session = Depends(get_db)):
    return db.query(models.Person).all()

# ==========================================
# 7. ENDPOINTS: ACTIVOS (ASSETS)
# ==========================================
@app.post("/assets/", response_model=schemas.AssetResponse, status_code=status.HTTP_201_CREATED, tags=["Gestión de Activos"])
def create_asset(asset: schemas.AssetCreate, db: Session = Depends(get_db), admin: models.Admin = Depends(get_current_admin)):
    db_asset = db.query(models.Asset).filter(models.Asset.asset_tag_id == asset.asset_tag_id).first()
    if db_asset:
        raise HTTPException(status_code=400, detail="El Asset Tag ID ya está registrado")
    
    nuevo_activo = models.Asset(**asset.model_dump())
    db.add(nuevo_activo)
    db.commit()
    db.refresh(nuevo_activo)
    return nuevo_activo

@app.get("/assets/", response_model=List[schemas.AssetResponse], tags=["Gestión de Activos"])
def list_assets(
    search: str = None,
    status: str = None,
    category_id: int = None,
    site_id: int = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.Asset)
    if search:
        like = f"%{search}%"
        query = query.filter(
            models.Asset.asset_tag_id.like(like) |
            models.Asset.asset_description.like(like) |
            models.Asset.brand.like(like) |
            models.Asset.model.like(like) |
            models.Asset.serial_no.like(like)
        )
    if status:
        query = query.filter(models.Asset.status == status)
    if category_id:
        query = query.filter(models.Asset.category_id == category_id)
    if site_id:
        query = query.filter(models.Asset.site_id == site_id)
    return query.offset(skip).limit(limit).all()

# ==========================================
# 8. ACCIONES DE INVENTARIO: CHECKOUT Y CHECKIN
# ==========================================
@app.post("/assets/{asset_id}/checkout", tags=["Acciones de Inventario"])
def asset_checkout(asset_id: int, person_id: int, notas: str = None, db: Session = Depends(get_db), current_admin: models.Admin = Depends(get_current_admin)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    
    if asset.status == "Checkout":
        raise HTTPException(status_code=400, detail="El activo ya se encuentra asignado (Checkout)")
        
    person = db.query(models.Person).filter(models.Person.id == person_id).first()
    if not person:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")

    estado_anterior = asset.status
    asset.status = "Checkout"
    asset.person_id = person_id
    
    registro_historial = models.History(
        asset_id=asset.id,
        asignado_a_id=person_id,
        realizado_por_id=current_admin.id,
        tipo_accion="Checkout",
        estado_anterior=estado_anterior,
        estado_nuevo="Checkout",
        notas_detalle=notas or f"Equipo asignado a {person.full_name}"
    )
    
    db.add(registro_historial)
    db.commit()
    db.refresh(asset)
    return {"message": f"Asset {asset.asset_tag_id} asignado exitosamente", "asset_status": asset.status}

@app.post("/assets/{asset_id}/checkin", tags=["Acciones de Inventario"])
def asset_checkin(asset_id: int, nuevo_estado: str = "Check in", notas: str = None, db: Session = Depends(get_db), current_admin: models.Admin = Depends(get_current_admin)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")

    estado_anterior = asset.status
    persona_que_devuelve = asset.person_id

    asset.status = nuevo_estado
    asset.person_id = None 
    
    registro_historial = models.History(
        asset_id=asset.id,
        asignado_a_id=persona_que_devuelve,
        realizado_por_id=current_admin.id,
        tipo_accion="Check in",
        estado_anterior=estado_anterior,
        estado_nuevo=nuevo_estado,
        notas_detalle=notas or f"Equipo recibido en almacén con estado: {nuevo_estado}"
    )
    
    db.add(registro_historial)
    db.commit()
    db.refresh(asset)
    return {"message": f"Asset {asset.asset_tag_id} recibido exitosamente", "asset_status": asset.status}

@app.get("/history/", response_model=List[schemas.HistoryResponse], tags=["Acciones de Inventario"])
def view_history(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db)
):
    return db.query(models.History).order_by(models.History.id.desc()).offset(skip).limit(limit).all()

# ==========================================
# 9. EDICIÓN Y ELIMINACIÓN (SOFT DELETE)
# ==========================================
@app.put("/assets/{asset_id}", response_model=schemas.AssetResponse, tags=["Gestión de Activos"])
def update_asset(asset_id: int, asset_update: schemas.AssetCreate, db: Session = Depends(get_db), current_admin: models.Admin = Depends(get_current_admin)):
    db_asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not db_asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    
    etiquetas = {
        "asset_tag_id": "Asset Tag",
        "asset_description": "Descripción",
        "brand": "Marca",
        "model": "Modelo",
        "serial_no": "Número de Serie",
        "category_id": "ID de Categoría",
        "site_id": "ID de Sitio",
        "location_id": "ID de Ubicación",
        "notas_adicionales": "Notas",
        "numero_telefono": "Teléfono"
    }
    
    lista_cambios = []
    datos_nuevos = asset_update.model_dump()
    
    for campo, nuevo_valor in datos_nuevos.items():
        viejo_valor = getattr(db_asset, campo, None)
        if viejo_valor != nuevo_valor:
            nombre_limpio = etiquetas.get(campo, campo)
            lista_cambios.append(f"{nombre_limpio} cambiado de '{viejo_valor}' a '{nuevo_valor}'")
            
    for key, value in datos_nuevos.items():
        setattr(db_asset, key, value)

    if lista_cambios:
        nota_auditoria = "Edicion de propiedades: " + " | ".join(lista_cambios)
    else:
        nota_auditoria = "Formulario de edicion guardado sin cambios en los valores."
    
    registro_historial = models.History(
        asset_id=db_asset.id,
        asignado_a_id=db_asset.person_id,
        realizado_por_id=current_admin.id,
        tipo_accion="Modified",
        estado_anterior=db_asset.status,
        estado_nuevo=db_asset.status,
        notas_detalle=nota_auditoria
    )
    
    db.add(registro_historial)
    db.commit()
    db.refresh(db_asset)
    return db_asset

@app.delete("/assets/{asset_id}", tags=["Gestión de Activos"])
def delete_asset(asset_id: int, db: Session = Depends(get_db), current_admin: models.Admin = Depends(get_current_admin)):
    db_asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not db_asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    
    estado_anterior = db_asset.status
    persona_que_tenia = db_asset.person_id

    db_asset.status = "Archived"
    db_asset.person_id = None 

    registro_historial = models.History(
        asset_id=db_asset.id,
        asignado_a_id=persona_que_tenia,
        realizado_por_id=current_admin.id,
        tipo_accion="Archived",
        estado_anterior=estado_anterior,
        estado_nuevo="Archived",
        notas_detalle="Activo enviado a Eliminados Recientemente (Baja de Inventario)"
    )
    
    db.add(registro_historial)
    db.commit()
    return {"message": "Activo movido a eliminados recientemente"}

# ==========================================
# 10. ENDPOINT DE AUTENTICACIÓN (LOGIN CON JWT)
# ==========================================
@app.post("/auth/login", response_model=schemas.TokenResponse, tags=["Autenticación"])
def login_admin(credentials: schemas.LoginRequest, db: Session = Depends(get_db)):
    admin = db.query(models.Admin).filter(models.Admin.username == credentials.username).first()

    if not admin or not verify_password(credentials.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    token = create_access_token({"id": admin.id, "username": admin.username})
    return schemas.TokenResponse(
        access_token=token,
        admin=schemas.AdminResponse(
            id=admin.id, username=admin.username, email=admin.email, role=admin.role
        )
    )