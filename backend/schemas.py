from pydantic import BaseModel, EmailStr
from datetime import date, datetime
from typing import Optional
from enum import Enum

# ==========================================
# REGLA ESTRICTA DE ESTADOS COMPLETOS (ENUM)
# ==========================================
class AssetStatus(str, Enum):
    AVAILABLE = "Available"
    BROKEN = "Broken"
    CHECK_OUT = "Checkout"
    DISPOSE = "Dispose"
    DONATE = "Donate"
    GARANTIASD = "GarantiaSD"
    LOST_MISSING = "Lost/Missing"
    FOUND = "Found"
    RESERVED = "Reserved"
    SOLD = "Sold"
    UNDER_REPAIR = "Under repair"
    ARCHIVED = "Archived"

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

class DepartmentBase(BaseModel):
    department_name: str

class DepartmentResponse(DepartmentBase):
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
    department_id: int

class PersonCreate(PersonBase):
    pass

class PersonUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    employee_id: Optional[str] = None
    title: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    site_id: Optional[int] = None
    department_id: Optional[int] = None

class PersonResponse(PersonBase):
    id: int
    class Config:
        from_attributes = True

class GroupResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    can_view: bool = True
    can_create: bool = False
    can_edit: bool = False
    can_delete: bool = False
    can_checkout: bool = False
    can_import_export: bool = False
    can_manage_users: bool = False
    is_default: bool = False
    class Config:
        from_attributes = True

class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    can_view: bool = True
    can_create: bool = False
    can_edit: bool = False
    can_delete: bool = False
    can_checkout: bool = False
    can_import_export: bool = False
    can_manage_users: bool = False

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    can_view: Optional[bool] = None
    can_create: Optional[bool] = None
    can_edit: Optional[bool] = None
    can_delete: Optional[bool] = None
    can_checkout: Optional[bool] = None
    can_import_export: Optional[bool] = None
    can_manage_users: Optional[bool] = None

class AdminCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: Optional[str] = "User"
    group_id: Optional[int] = None
    is_active: bool = True

class AdminUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    group_id: Optional[int] = None
    is_active: Optional[bool] = None

class AdminResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    group_id: Optional[int] = None
    is_active: bool = True
    group: Optional[GroupResponse] = None
    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin: AdminResponse

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

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
    status: str = "Available"
    category: str = None
    site_id: Optional[int] = None

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
    notas_detalle: Optional[str] = None  # Mapeado con tu base de datos
    asset_id: int
    asignado_a_id: Optional[int] = None
    realizado_por_id: int
    class Config:
        from_attributes = True

# ==========================================
# SCHEMAS DE REPORTES
# ==========================================
class PersonCheckoutReportItem(BaseModel):
    asset_id: int
    asset_tag_id: str
    asset_description: str
    brand: str
    model: str
    serial_no: str
    category: str
    site_name: str
    assigned_date: Optional[str] = None
    returned_date: Optional[str] = None
    status: str

# ==========================================
# SCHEMAS DE ENTREGAS PENDIENTES
# ==========================================
class PendingDeliveryCreate(BaseModel):
    person_id: int
    category: str
    quantity: int = 1
    notes: Optional[str] = None

class PendingDeliveryResponse(BaseModel):
    id: int
    person_id: int
    person_name: str = ""
    category: str
    quantity: int
    fulfilled_count: int
    status: str
    notes: Optional[str] = None
    created_at: datetime
    fulfilled_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class PendingFulfillRequest(BaseModel):
    asset_id: int

class AvailableAssetItem(BaseModel):
    id: int
    asset_tag_id: str
    asset_description: str
    brand: str
    model: str
    serial_no: str
    category: str

class CategoryCreate(BaseModel):
    name: str

class CategoryResponse(BaseModel):
    id: int
    name: str
    class Config:
        from_attributes = True