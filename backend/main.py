from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
import traceback

import models
import schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

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
# CAPTURADOR GLOBAL DE ERRORES (ANTI-CORS FALSE)
# ==========================================
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Imprime el error real detallado en la terminal de VS Code
    print("❌ ERROR CRÍTICO DETECTADO EN EL BACKEND:")
    traceback.print_exc()
    
    # Devuelve el error al frontend con la cabecera CORS forzada para poder leerlo
    return JSONResponse(
        status_code=500,
        content={"detail": f"Error interno en Python/SQLite: {str(exc)}"},
        headers={"Access-Control-Allow-Origin": "*"}
    )

@app.get("/", tags=["Diagnóstico"])
def read_root():
    return {"status": "API de Gestión de Inventario Operando Correctamente"}

# ==========================================
# 1. ENDPOINTS: SITIOS (SITES)
# ==========================================
@app.post("/sites/", response_model=schemas.SiteResponse, status_code=status.HTTP_201_CREATED, tags=["Sitios y Ubicaciones"])
def create_site(site: schemas.SiteBase, db: Session = Depends(get_db)):
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
def create_location(location: schemas.LocationBase, db: Session = Depends(get_db)):
    # Validar que el sitio exista antes de meterle una ubicación
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
def create_department(dept: schemas.DepartmentBase, db: Session = Depends(get_db)):
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
def create_category(category: schemas.CategoryBase, db: Session = Depends(get_db)):
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
def create_admin(admin: schemas.AdminCreate, db: Session = Depends(get_db)):
    db_admin = db.query(models.Admin).filter((models.Admin.username == admin.username) | (models.Admin.email == admin.email)).first()
    if db_admin:
        raise HTTPException(status_code=400, detail="El nombre de usuario o email ya están registrados")
    
    # Por ahora guardamos el texto plano. En fases posteriores implementaremos hashing real de seguridad.
    nuevo_admin = models.Admin(
        username=admin.username,
        email=admin.email,
        password_hash=admin.password,
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
def create_person(person: schemas.PersonCreate, db: Session = Depends(get_db)):
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
def create_asset(asset: schemas.AssetCreate, db: Session = Depends(get_db)):
    db_asset = db.query(models.Asset).filter(models.Asset.asset_tag_id == asset.asset_tag_id).first()
    if db_asset:
        raise HTTPException(status_code=400, detail="El Asset Tag ID ya está registrado")
    
    nuevo_activo = models.Asset(**asset.model_dump())
    db.add(nuevo_activo)
    db.commit()
    db.refresh(nuevo_activo)
    return nuevo_activo

@app.get("/assets/", response_model=List[schemas.AssetResponse], tags=["Gestión de Activos"])
def list_assets(db: Session = Depends(get_db)):
    return db.query(models.Asset).all()

    # ==========================================
# 8. ACCIONES DE INVENTARIO: CHECKOUT Y CHECKIN
# ==========================================

@app.post("/assets/{asset_id}/checkout", tags=["Acciones de Inventario"])
def asset_checkout(asset_id: int, person_id: int, admin_id: int, notas: str = None, db: Session = Depends(get_db)):
    # 1. Verificar que el activo exista
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    
    # 2. Verificar que no esté ya prestado
    if asset.status == "Checkout":
        raise HTTPException(status_code=400, detail="El activo ya se encuentra asignado (Checkout)")
        
    # 3. Verificar que el empleado y el admin existan
    person = db.query(models.Person).filter(models.Person.id == person_id).first()
    admin = db.query(models.Admin).filter(models.Admin.id == admin_id).first()
    if not person or not admin:
        raise HTTPException(status_code=404, detail="Empleado o Administrador no encontrado")

    # 4. Guardamos el estado anterior para la auditoría
    estado_anterior = asset.status

    # 5. Actualizamos el activo
    asset.status = "Checkout"
    asset.person_id = person_id
    
    # 6. CREAMOS EL REGISTRO EN EL HISTORIAL (Auditoría)
    registro_historial = models.History(
        asset_id=asset.id,
        asignado_a_id=person_id,
        realizado_por_id=admin_id,
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
def asset_checkin(asset_id: int, admin_id: int, nuevo_estado: str = "Check in", notas: str = None, db: Session = Depends(get_db)):
    # 1. Verificar que el activo exista
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    
    # 2. Verificar que el admin exista
    admin = db.query(models.Admin).filter(models.Admin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")

    estado_anterior = asset.status
    persona_que_devuelve = asset.person_id

    # 3. Actualizamos el activo (Vuelve al almacén o cambia a Broken, Lost, etc.)
    asset.status = nuevo_estado
    asset.person_id = None # Se libera de la persona
    
    # 4. CREAMOS EL REGISTRO EN EL HISTORIAL
    registro_historial = models.History(
        asset_id=asset.id,
        asignado_a_id=persona_que_devuelve,
        realizado_por_id=admin_id,
        tipo_accion="Check in",
        estado_anterior=estado_anterior,
        estado_nuevo=nuevo_estado,
        notas_detalle=notas or f"Equipo recibido en almacén con estado: {nuevo_estado}"
    )
    
    db.add(registro_historial)
    db.commit()
    db.refresh(asset)
    return {"message": f"Asset {asset.asset_tag_id} recibido exitosamente", "asset_status": asset.status}

# Endpoint rápido para revisar el historial completo de auditoría
@app.get("/history/", response_model=List[schemas.HistoryResponse], tags=["Acciones de Inventario"])
def view_history(db: Session = Depends(get_db)):
    return db.query(models.History).all()

# ==========================================
# 9. EDICIÓN Y ELIMINACIÓN DE ACTIVOS
# ==========================================

@app.put("/assets/{asset_id}", response_model=schemas.AssetResponse, tags=["Gestión de Activos"])
def update_asset(asset_id: int, asset_update: schemas.AssetCreate, db: Session = Depends(get_db)):
    db_asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not db_asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    
    # Sobrescribir los valores con los nuevos datos del formulario
    for key, value in asset_update.model_dump().items():
        setattr(db_asset, key, value)
        
    db.commit()
    db.refresh(db_asset)
    return db_asset

@app.delete("/assets/{asset_id}", tags=["Gestión de Activos"])
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    db_asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not db_asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado")
    
    # Soft Delete: Guardamos estados para la auditoría antes de archivar
    estado_anterior = db_asset.status
    persona_que_tenia = db_asset.person_id

    # Modificamos el activo para mandarlo a la papelera
    db_asset.status = "Archived"
    db_asset.person_id = None # Se libera del empleado al darse de baja
    
    # BUSQUEDA DINÁMICA DEL ADMIN: Evita caídas por llaves foráneas fijas
    primer_admin = db.query(models.Admin).first()
    admin_id_registro = primer_admin.id if primer_admin else None

    # Dejamos constancia histórica del borrado lógico
    registro_historial = models.History(
        asset_id=db_asset.id,
        asignado_a_id=persona_que_tenia,
        realizado_por_id=admin_id_registro,
        tipo_accion="Archived",
        estado_anterior=estado_anterior,
        estado_nuevo="Archived",
        notas_detalle="Activo enviado a Eliminados Recientemente (Baja de Inventario)"
    )
    
    db.add(registro_historial)
    db.commit()
    return {"message": "Activo movido a eliminados recientemente"}