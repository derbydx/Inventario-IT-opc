from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, DateTime, Text
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
from database import Base  # Importamos la Base que creamos en database.py

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
    status = Column(String(50), default="Check in")  # Check in, Checkout, Broken, etc.
    
    # Llaves Foráneas
    person_id = Column(Integer, ForeignKey("persons.id"), nullable=True)
    category = Column(String(100), index=True)
    site_id = Column(Integer, ForeignKey("sites.id"))

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
    asset_id = Column(Integer, ForeignKey("assets.id"))
    asignado_a_id = Column(Integer, ForeignKey("persons.id"), nullable=True)  # Quién recibe
    realizado_por_id = Column(Integer, ForeignKey("admins.id"))  # Qué administrador operó