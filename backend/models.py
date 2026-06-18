from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Date, DateTime, Text
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
from database import Base  # Importamos la Base que creamos en database.py

# ==========================================
# 0. GRUPOS Y PERMISOS DE USUARIO
# ==========================================
class Group(Base):
    __tablename__ = "groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True)
    description = Column(String(255))
    can_view = Column(Boolean, default=True)
    can_create = Column(Boolean, default=False)
    can_edit = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)
    can_checkout = Column(Boolean, default=False)
    can_import_export = Column(Boolean, default=False)
    can_manage_users = Column(Boolean, default=False)
    is_default = Column(Boolean, default=False)

# ==========================================
# 1. TABLAS DE CATÁLOGOS Base
# ==========================================
class Site(Base):
    __tablename__ = "sites"
    id = Column(Integer, primary_key=True, index=True)
    site_name = Column(String(100), unique=True, index=True)
    description = Column(String(255))
    address = Column(String(255))
    apt_suite = Column(String(50))
    city = Column(String(100))
    state = Column(String(100))
    zip_code = Column(String(20))
    country = Column(String(100))

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    department_name = Column(String(100), unique=True, index=True)

# ==========================================
# 2. DIRECTORIO DE EMPLEADOS Y ACCESOS ADMIN
# ==========================================
class Person(Base):
    __tablename__ = "persons"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), index=True)
    email = Column(String(150), unique=True, index=True)
    employee_id = Column(String(50), unique=True)
    title = Column(String(100))
    phone = Column(String(50))
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    
    # Conexiones geográficas y organizacionales
    site_id = Column(Integer, ForeignKey("sites.id"))
    department_id = Column(Integer, ForeignKey("departments.id"))

class Admin(Base):
    __tablename__ = "admins"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    email = Column(String(150), unique=True)
    password_hash = Column(String(255))  # Seguridad para la contraseña
    role = Column(String(50), default="Administrator")
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    is_active = Column(Boolean, default=True)

    group = relationship("Group")

# ==========================================
# 3. TABLA PRINCIPAL: ACTIVOS (ASSETS)
# ==========================================
class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True, index=True)
    asset_tag_id = Column(String(50), unique=True, index=True)
    asset_description = Column(String(255))
    purchase_date = Column(Date, nullable=True)
    cost = Column(Float, nullable=True)
    purchased_from = Column(String(150))
    brand = Column(String(100))
    model = Column(String(100))
    serial_no = Column(String(100), index=True)
    notas_adicionales = Column(Text)
    numero_telefono = Column(String(50))
    status = Column(String(50), default="Available")  # Check in, Checkout, Broken, etc.
    
    # Llaves Foráneas
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=True)
    ultimo_asignado_id = Column(Integer, ForeignKey("persons.id"), nullable=True)
    category = Column(String(100), index=True)
    site_id = Column(Integer, ForeignKey("sites.id"), nullable=True)

    # Campos de reparacion
    repair_reason = Column(Text, nullable=True)
    repair_left_by_id = Column(Integer, ForeignKey("persons.id"), nullable=True)
    repair_technician_id = Column(Integer, ForeignKey("admins.id"), nullable=True)

# ==========================================
# 4. TABLA DE AUDITORÍA: HISTORIAL
# ==========================================
class History(Base):
    __tablename__ = "history"
    id = Column(Integer, primary_key=True, index=True)
    fecha_accion = Column(DateTime, default=datetime.utcnow)
    tipo_accion = Column(String(100))  # Ej: "Checkout", "Check in"
    estado_anterior = Column(String(50))
    estado_nuevo = Column(String(50))
    notas_detalle = Column(Text)
    
    # Trazabilidad completa de auditoría
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)
    asignado_a_id = Column(Integer, ForeignKey("persons.id"), nullable=True)  # Quién recibe
    realizado_por_id = Column(Integer, ForeignKey("admins.id"))  # Qué administrador operó

# ==========================================
# 5. TABLA DE ENTREGAS PENDIENTES
# ==========================================
class PendingDelivery(Base):
    __tablename__ = "pending_deliveries"
    id = Column(Integer, primary_key=True, index=True)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False)
    category = Column(String(100), nullable=False)
    quantity = Column(Integer, default=1)
    fulfilled_count = Column(Integer, default=0)
    status = Column(String(20), default="Active")  # Active, Fulfilled, Cancelled
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    fulfilled_at = Column(DateTime, nullable=True)

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)

# ==========================================
# 6. CONCILIACION DE EMPLEADOS
# ==========================================
class ReconciliationSession(Base):
    __tablename__ = "reconciliation_sessions"
    id = Column(Integer, primary_key=True, index=True)
    uploaded_by_id = Column(Integer, ForeignKey("admins.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    filename = Column(String(255))
    total_db = Column(Integer)
    total_file = Column(Integer)
    matched_count = Column(Integer)
    imported_count = Column(Integer)

    uploaded_by = relationship("Admin")
    departed_assets = relationship("ReconciliationDepartedAsset", back_populates="session", cascade="all, delete-orphan")

class ReconciliationDepartedAsset(Base):
    __tablename__ = "reconciliation_departed_assets"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("reconciliation_sessions.id"), nullable=False)
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=False)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    status = Column(String(20), default="pending")
    cleared_at = Column(DateTime, nullable=True)
    cleared_by_id = Column(Integer, ForeignKey("admins.id"), nullable=True)

    session = relationship("ReconciliationSession", back_populates="departed_assets")
    person = relationship("Person")
    asset = relationship("Asset")
    cleared_by = relationship("Admin")

# ==========================================
# 7. REPORTES PERSONALIZADOS GUARDADOS
# ==========================================
class SavedReport(Base):
    __tablename__ = "saved_reports"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    fields = Column(Text, nullable=False)
    filters = Column(Text, nullable=True)
    created_by_id = Column(Integer, ForeignKey("admins.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    created_by = relationship("Admin")