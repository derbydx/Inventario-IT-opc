from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# 1. Definimos el nombre del archivo local de la base de datos SQLite
SQLALCHEMY_DATABASE_URL = "sqlite:///./it_inventario.db"

# 2. Creamos el motor de conexión (Engine)
# 'check_same_thread': False es obligatorio solo para SQLite en FastAPI
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# 3. Creamos una fábrica de sesiones (SessionLocal)
# Cada vez que la API necesite consultar algo, usará una sesión generada aquí
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Creamos la clase Base heredable
# De esta clase van a heredar todos los modelos (tablas) que programemos después
Base = declarative_base()

# 5. Función auxiliar (Dependencia) para abrir y cerrar la BD automáticamente
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()