from db import SessionLocal
from models import Usuario
from passlib.context import CryptContext
from sqlalchemy.exc import IntegrityError

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

db = SessionLocal()

username = "proveedor1"
email = "proveedor1@vivero.local"
password = "Tenerife@2025"

try:
    user = db.query(Usuario).filter(Usuario.username == username).first()

    if user:
        user.email = user.email or email
        user.password_hash = pwd_context.hash(password)
        user.rol = "proveedor"
        user.status = "activo"
        user.failed_login_attempts = 0
        user.locked_until = None
        db.commit()
        print("Proveedor actualizado:", username)
    else:
        new_user = Usuario(
            username=username,
            email=email,
            password_hash=pwd_context.hash(password),
            rol="proveedor",
            status="activo",
            failed_login_attempts=0,
            locked_until=None,
        )
        db.add(new_user)
        db.commit()
        print("Proveedor creado:", username)

except IntegrityError as e:
    db.rollback()
    print("ERROR de integridad (email/username duplicado).", e)

finally:
    db.close()