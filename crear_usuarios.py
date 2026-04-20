"""
Script para crear/actualizar usuarios en la base de datos.
Uso:
    python crear_usuarios.py
Edita USUARIOS para añadir los que necesites.
"""

from db import SessionLocal
from models import Usuario
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Edita esta lista. La contraseña se puede cambiar después en DB o por endpoint.
USUARIOS = [
    {"username": "roberto", "password": "roberto2026", "rol": "tecnico",  "email": None},
    {"username": "medina",  "password": "medina2026",  "rol": "tecnico",  "email": None},
    {"username": "desi",    "password": "desi2026",    "rol": "manager",  "email": None},
]

db = SessionLocal()
creados = 0
actualizados = 0

for u in USUARIOS:
    existente = db.query(Usuario).filter(Usuario.username == u["username"]).first()
    password_hash = pwd_context.hash(u["password"])

    if existente:
        existente.rol = u["rol"]
        existente.status = "activo"
        existente.password_hash = password_hash
        if u.get("email"):
            existente.email = u["email"]
        actualizados += 1
        print(f"Actualizado: {u['username']}  rol={u['rol']}")
    else:
        nuevo = Usuario(
            username=u["username"],
            email=u.get("email"),
            password_hash=password_hash,
            rol=u["rol"],
            status="activo",
        )
        db.add(nuevo)
        creados += 1
        print(f"Creado: {u['username']}  rol={u['rol']}  password={u['password']}")

db.commit()
db.close()

print("---")
print(f"Creados: {creados}")
print(f"Actualizados: {actualizados}")
