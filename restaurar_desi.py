"""Restaura a desi como manager con password Test1234."""
from db import SessionLocal
from models import Usuario
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

db = SessionLocal()
existente = db.query(Usuario).filter(Usuario.username == "desi").first()

if existente:
    existente.rol = "manager"
    existente.status = "activo"
    existente.password_hash = pwd_context.hash("Test1234")
    print("Actualizado: desi  rol=manager  password=Test1234")
else:
    db.add(Usuario(
        username="desi",
        email=None,
        password_hash=pwd_context.hash("Test1234"),
        rol="manager",
        status="activo",
    ))
    print("Creado: desi  rol=manager  password=Test1234")

db.commit()
db.close()
