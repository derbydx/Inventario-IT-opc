from pydantic import BaseModel, EmailStr
from datetime import date, datetime
from typing import Optional
from enum import Enum

# ==========================================
# REGLA ESTRICTA DE ESTADOS (ENUM)
# ==========================================
class AssetStatus(str, Enum):
    CHECK_IN = "Check in"
    CHECK_OUT = "Checkout"
    BROKEN = "Broken"
    DISPOSED = "Disposed"
    DONATE = "Donate"
    LOST = "Lost"
    FOUND = "Found"

# ==========================================
# SCHEMAS DE CATÁLOGOS
# ==========================================
class SiteBase(BaseModel):
    site_name: str
    description: Optional[str] = None
    address: Optional[str] = None
    apt_suite: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None

class SiteResponse(SiteBase):
    id: int
    class Config:
        from_attributes = True

class LocationBase(BaseModel):
    location_name: str
    site_id: int

class LocationResponse(LocationBase):
    id: int
    class Config:
        from_attributes = True

class DepartmentBase(BaseModel):
    department_name: str

class DepartmentResponse(DepartmentBase):
    id: int
    class Config:
        from_attributes = True

class CategoryBase(BaseModel):
    category_name: str

class CategoryResponse(CategoryBase):
    id: int
    class Config:
        from_attributes = True

# ==========================================
# SCHEMAS DE PERSONAS Y ADMINS
# ==========================================
class PersonBase(BaseModel):
    full_name: str
    email: EmailStr  # Valida automáticamente que sea un correo real
    employee_id: str
    title: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    site_id: int
    location_id: int
    department_id: int

class PersonCreate(PersonBase):
    pass

class PersonResponse(PersonBase):
    id: int
    class Config:
        from_attributes = True

class AdminCreate(BaseModel):
    username: str
    email: EmailStr
    password: str  # Contraseña en texto plano temporal que viene del formulario
    role: Optional[str] = "Administrator"

class AdminResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    class Config:
        from_attributes = True

# ==========================================
# SCHEMA DE ACTIVOS (ASSETS)
# ==========================================
class AssetBase(BaseModel):
    asset_tag_id: str
    asset_description: str
    purchase_date: Optional[date] = None
    cost: Optional[float] = None
    purchased_from: Optional[str] = None
    brand: str
    model: str
    serial_no: str
    notas_adicionales: Optional[str] = None
    numero_telefono: Optional[str] = None
    status: str = "Check in"  # ➔ Corregido: Alineado perfectamente a 4 espacios
    category_id: int
    site_id: int
    location_id: int

class AssetCreate(AssetBase):
    pass

class AssetResponse(AssetBase):
    id: int
    person_id: Optional[int] = None  # Puede ser None si el equipo está en almacén
    class Config:
        from_attributes = True

# ==========================================
# SCHEMA DE AUDITORÍA: HISTORIAL
# ==========================================
class HistoryResponse(BaseModel):
    id: int
    fecha_accion: datetime
    tipo_accion: str
    estado_anterior: str
    estado_nuevo: str
    notas_detalle: Optional[str] = None
    asset_id: int
    asignado_a_id: Optional[int] = None
    realizado_por_id: int
    class Config:
        from_attributes = True