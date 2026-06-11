from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import engine, get_db

# ==========================================
# CREACIÓN AUTOMÁTICA DE TABLAS
# ==========================================
# Al arrancar el código, SQLAlchemy revisa 'models.py' y crea 
# el archivo 'it_inventario.db' con las 8 tablas si no existen.
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="IT Asset Manager API",
    description="Backend estilo AssetTiger para auditoría y control de activos de TI",
    version="1.0.0"
)

# ==========================================
# CONFIGURACIÓN DE SEGURIDAD (CORS)
# ==========================================
# Ponemos "*" para permitir que tu frontend local (sin importar el puerto)
# pueda hablar con el backend sin bloqueos del navegador.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ruta de diagnóstico
@app.get("/", tags=["Diagnóstico"])
def read_root():
    return {"status": "API de Gestión de Inventario Operando Correctamente"}


# ==========================================
# ENDPOINTS: CATEGORÍAS
# ==========================================
@app.post("/categories/", response_model=schemas.CategoryResponse, status_code=status.HTTP_201_CREATED, tags=["Catálogos"])
def create_category(category: schemas.CategoryBase, db: Session = Depends(get_db)):
    # Verificar si ya existe una categoría con ese nombre
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
# ENDPOINTS: ACTIVOS (ASSETS)
# ==========================================
@app.post("/assets/", response_model=schemas.AssetResponse, status_code=status.HTTP_201_CREATED, tags=["Activos"])
def create_asset(asset: schemas.AssetCreate, db: Session = Depends(get_db)):
    # Verificar que el Asset Tag sea único
    db_asset = db.query(models.Asset).filter(models.Asset.asset_tag_id == asset.asset_tag_id).first()
    if db_asset:
        raise HTTPException(status_code=400, detail="El Asset Tag ID ya está registrado")
    
    # Convertimos el esquema de Pydantic a un diccionario e insertamos en la BD
    nuevo_activo = models.Asset(**asset.model_dump())
    db.add(nuevo_activo)
    db.commit()
    db.refresh(nuevo_activo)
    return nuevo_activo

@app.get("/assets/", response_model=List[schemas.AssetResponse], tags=["Activos"])
def list_assets(db: Session = Depends(get_db)):
    return db.query(models.Asset).all()