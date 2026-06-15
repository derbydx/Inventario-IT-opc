import hashlib
import secrets
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
import models

SECRET_KEY = "inventario-it-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

security = HTTPBearer()

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${pwd_hash}"

def verify_password(plain_password: str, hashed: str) -> bool:
    try:
        salt, pwd_hash = hashed.split("$")
        return hashlib.sha256((salt + plain_password).encode()).hexdigest() == pwd_hash
    except (ValueError, AttributeError):
        return False

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> models.Admin:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar el token de acceso",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        admin_id: int = payload.get("id")
        if admin_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    admin = db.query(models.Admin).filter(models.Admin.id == admin_id).first()
    if admin is None:
        raise credentials_exception
    if not admin.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Cuenta desactivada")
    return admin

def require_permission(permission: str):
    def checker(admin: models.Admin = Depends(get_current_admin)):
        if admin.group is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario sin grupo asignado")
        if not getattr(admin.group, permission, False):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Permiso denegado: {permission}")
        return admin
    return checker
