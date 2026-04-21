"""Crea (o actualiza) a alberto como admin con password Test1234."""
from db import SessionLocal
from models import Usuario
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

db = SessionLocal()
existente = db.query(Usuario).filter(Usuario.username == "alberto").first()

if existente:
    existente.rol = "admin"
    existente.status = "activo"
    existente.password_hash = pwd_context.hash("Test1234")
    print("Actualizado: alberto  rol=admin  password=Test1234")
else:
    db.add(Usuario(
        username="alberto",
        email=None,
        password_hash=pwd_context.hash("Test1234"),
        rol="admin",
        status="activo",
    ))
    print("Creado: alberto  rol=admin  password=Test1234")

db.commit()
db.close()
