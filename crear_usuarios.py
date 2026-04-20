"""
Script para dejar SOLO los usuarios objetivo en la base de datos,
todos con la misma contraseña hasheada (Test1234 por defecto).

Uso:
    python crear_usuarios.py
"""

from db import SessionLocal
from models import Usuario
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Contraseña común para todos (se hashea con bcrypt).
PASSWORD_GLOBAL = "Test1234"

# Usuarios que DEBEN existir. Cualquier otro se elimina si BORRAR_OTROS=True.
USUARIOS = [
    {"username": "ivan",    "rol": "admin"},
    {"username": "ute",     "rol": "empresa_externa"},
    {"username": "miriam",  "rol": "manager"},
    {"username": "maria",   "rol": "manager"},
    {"username": "francis", "rol": "gestor_vivero"},
    {"username": "elisa",   "rol": "tecnico"},
    {"username": "susana",  "rol": "tecnico"},
    {"username": "medina",  "rol": "tecnico"},
    {"username": "roberto", "rol": "tecnico"},
]

# ⚠️ Si True, ELIMINA cualquier usuario que no esté en USUARIOS.
BORRAR_OTROS = True

db = SessionLocal()
creados = 0
actualizados = 0
eliminados = 0

usernames_objetivo = {u["username"] for u in USUARIOS}

for u in USUARIOS:
    existente = db.query(Usuario).filter(Usuario.username == u["username"]).first()
    password_hash = pwd_context.hash(PASSWORD_GLOBAL)

    if existente:
        existente.rol = u["rol"]
        existente.status = "activo"
        existente.password_hash = password_hash
        actualizados += 1
        print(f"Actualizado: {u['username']:<10} rol={u['rol']}")
    else:
        nuevo = Usuario(
            username=u["username"],
            email=None,
            password_hash=password_hash,
            rol=u["rol"],
            status="activo",
        )
        db.add(nuevo)
        creados += 1
        print(f"Creado:      {u['username']:<10} rol={u['rol']}")

if BORRAR_OTROS:
    otros = db.query(Usuario).filter(~Usuario.username.in_(usernames_objetivo)).all()
    for o in otros:
        print(f"Borrado:     {o.username:<10} rol={o.rol}")
        db.delete(o)
        eliminados += 1

db.commit()
db.close()

print("---")
print(f"Creados:     {creados}")
print(f"Actualizados:{actualizados}")
print(f"Eliminados:  {eliminados}")
print(f"Password común: {PASSWORD_GLOBAL}")
