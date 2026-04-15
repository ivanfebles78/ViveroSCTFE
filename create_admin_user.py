from sqlalchemy.orm import Session
from db import SessionLocal
from models import Usuario
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

USERNAME = "ifebtru"
PASSWORD = "Tenerife@2025"
EMAIL = "ifebtru@vivero.local"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_admin():
    db: Session = SessionLocal()

    existing = db.query(Usuario).filter(Usuario.username == USERNAME).first()

    if existing:
        print("⚠️ El usuario ya existe:", USERNAME)
        return

    admin = Usuario(
        username=USERNAME,
        email=EMAIL,
        password_hash=hash_password(PASSWORD),
        status="activo",
        rol="admin",
        failed_login_attempts=0
    )

    db.add(admin)
    db.commit()

    print("✅ Usuario administrador creado:")
    print("username:", USERNAME)
    print("password:", PASSWORD)


if __name__ == "__main__":
    create_admin()