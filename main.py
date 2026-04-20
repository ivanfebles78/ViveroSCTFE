from datetime import date, datetime, timedelta
from typing import Optional
import uuid

from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt, JWTError
from sqlalchemy import func, or_
from db import SessionLocal

from db import engine
from models import (
    Usuario,
    Producto,
    Movimiento,
    Lote,
    InventarioLote,
    MovimientoLoteDetalle,
    Pedido,
    PedidoItem,
    CaducidadConfig,
    Base,
)
from schemas import PedidoActionRequest, PedidoOut




# =============================
# APP
# =============================
app = FastAPI()
Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_origin_regex=r"https://.*\.railway\.app",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================
# CONFIG AUTH
# =============================
SECRET_KEY = "dev-secret-key-vivero"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# =============================
# DB
# =============================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =============================
# SCHEMAS AUTH
# =============================
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# =============================
# SCHEMAS PEDIDOS
# =============================
class PedidoItemCreate(BaseModel):
    producto_id: int
    tamano: str
    cantidad: int


class PedidoCreate(BaseModel):
    items: list[PedidoItemCreate]
    nota: Optional[str] = None
    distrito_destino: Optional[str] = None
    barrio_destino: Optional[str] = None
    direccion_destino: Optional[str] = None
    tipo: Optional[str] = "salida"


# =============================
# SCHEMAS MOVIMIENTOS
# =============================
class MovimientoCreate(BaseModel):
    pedido_id: Optional[int] = None
    pedido_item_id: Optional[int] = None
    uuid_lote: Optional[str] = None

    producto_id: int
    cantidad: int
    origen_tipo: str
    destino_tipo: str

    zona_origen: Optional[str] = None
    zona_destino: Optional[str] = None

    tamano_origen: Optional[str] = None
    tamano_destino: Optional[str] = None

    distrito_destino: Optional[str] = None
    barrio_destino: Optional[str] = None
    direccion_destino: Optional[str] = None
    cp_destino: Optional[str] = None

    nota: Optional[str] = None

    # 🔥 NUEVO
    observaciones: Optional[str] = None
    es_prestamo: bool = False
    es_devolucion: bool = False
    prestamo_referencia_id: Optional[int] = None
    fecha_disponibilidad: Optional[date] = None

class MovimientoOut(BaseModel):
    id: int
    pedido_id: Optional[int] = None
    pedido_item_id: Optional[int] = None
    uuid_lote: Optional[str] = None
    producto_id: int
    cantidad: int
    tipo_movimiento: str
    origen_tipo: str
    destino_tipo: str
    zona_origen: Optional[str] = None
    zona_destino: Optional[str] = None
    tamano_origen: Optional[str] = None
    tamano_destino: Optional[str] = None
    distrito_destino: Optional[str] = None
    barrio_destino: Optional[str] = None
    direccion_destino: Optional[str] = None
    cp_destino: Optional[str] = None
    created_by: Optional[str] = None
    fecha_movimiento: datetime
    fecha_caducidad: Optional[date] = None
    dias_caducidad_aplicados: Optional[int] = None
    fecha_disponibilidad: Optional[date] = None

    class Config:
        from_attributes = True


# =============================
# HELPERS AUTH
# =============================
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        if not password_hash or not str(password_hash).strip():
            return False
        return pwd_context.verify(plain_password, password_hash)
    except Exception:
        return False


@app.post("/auth/login", response_model=LoginResponse)
def auth_login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.username == payload.username).first()

    if not user:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    if user.status and str(user.status).lower() != "activo":
        raise HTTPException(status_code=403, detail="Usuario inactivo")

    password_hash = getattr(user, "password_hash", None)

    if not verify_password(payload.password, password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")

    access_token = create_access_token({"sub": user.username})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "rol": user.rol,
            "status": user.status,
        },
    }


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autenticado")

    token = authorization.split(" ", 1)[1].strip()

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    user = db.query(Usuario).filter(Usuario.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    return user


def require_roles(roles: list[str]):
    allowed = {r.lower() for r in roles}

    def _dep(current_user: Usuario = Depends(get_current_user)):
        rol = (current_user.rol or "").strip().lower()
        if rol not in allowed:
            raise HTTPException(status_code=403, detail="Sin permisos")
        return current_user

    return _dep


# =============================
# HELPERS
# =============================
def _norm_str(value: Optional[str]) -> str:
    return (value or "").strip().lower()

def safeArray(x):
    return x if isinstance(x, list) else []
    
    
def _unique_preserve_order(values: list[str]) -> list[str]:
    seen = set()
    out = []
    for value in values:
        v = (value or "").strip()
        if not v or v in seen:
            continue
        seen.add(v)
        out.append(v)
    return out


def _join_uuid_lotes(values: list[str]) -> Optional[str]:
    uuids = _unique_preserve_order(values)
    return ",".join(uuids) if uuids else None


def _tipo_movimiento(origen_tipo: str, destino_tipo: str) -> str:
    origen = _norm_str(origen_tipo)
    destino = _norm_str(destino_tipo)

    if origen != "vivero" and destino == "vivero":
        return "entrada"
    if origen == "vivero" and destino == "vivero":
        return "traslado_interno"
    if origen == "vivero" and destino != "vivero":
        return "salida"
    return "movimiento"


def _tamano_aplicable_para_caducidad(payload: MovimientoCreate) -> Optional[str]:
    destino = _norm_str(payload.destino_tipo)
    if destino == "vivero":
        return (payload.tamano_destino or "").strip() or None
    return None


def _buscar_regla_caducidad(
    db: Session,
    categoria: Optional[str],
    subcategoria: Optional[str],
    tamano: Optional[str],
) -> Optional[CaducidadConfig]:
    categoria = (categoria or "").strip()
    subcategoria = (subcategoria or "").strip()
    tamano = (tamano or "").strip()

    if not categoria:
        return None

    base = db.query(CaducidadConfig).filter(CaducidadConfig.activo == True).filter(
        func.lower(CaducidadConfig.categoria) == categoria.lower()
    )

    # 1. Exact match (categoria + subcategoria + tamano) — si están todos
    if subcategoria and tamano:
        regla = (
            base
            .filter(func.lower(CaducidadConfig.subcategoria) == subcategoria.lower())
            .filter(func.lower(CaducidadConfig.tamano) == tamano.lower())
            .first()
        )
        if regla:
            return regla

    # 2. categoria + tamano, subcategoria = NULL (comodín)
    if tamano:
        regla = (
            base
            .filter(CaducidadConfig.subcategoria.is_(None))
            .filter(func.lower(CaducidadConfig.tamano) == tamano.lower())
            .first()
        )
        if regla:
            return regla

    # 3. categoria + subcategoria, tamano = NULL
    if subcategoria:
        regla = (
            base
            .filter(func.lower(CaducidadConfig.subcategoria) == subcategoria.lower())
            .filter(CaducidadConfig.tamano.is_(None))
            .first()
        )
        if regla:
            return regla

    # 4. Solo categoria (subcategoria y tamano = NULL)
    regla = (
        base
        .filter(CaducidadConfig.subcategoria.is_(None))
        .filter(CaducidadConfig.tamano.is_(None))
        .first()
    )
    return regla


def _calcular_fecha_caducidad(
    db: Session,
    producto: Producto,
    tamano: Optional[str],
    fecha_base: datetime,
) -> tuple[Optional[date], Optional[int]]:
    regla = _buscar_regla_caducidad(
        db=db,
        categoria=getattr(producto, "categoria", None),
        subcategoria=getattr(producto, "subcategoria", None),
        tamano=tamano,
    )

    if not regla or regla.dias_caducidad is None:
        return None, None

    dias = int(regla.dias_caducidad)
    fecha = (fecha_base.date() + timedelta(days=dias))
    return fecha, dias


def _get_fecha_caducidad_actual_lote(
    db: Session,
    uuid_lote: str,
    producto_id: int,
    zona: Optional[str],
    tamano: Optional[str],
) -> Optional[date]:
    if not uuid_lote:
        return None

    row = (
        db.query(Movimiento)
        .join(MovimientoLoteDetalle, MovimientoLoteDetalle.movimiento_id == Movimiento.id)
        .filter(MovimientoLoteDetalle.uuid_lote == uuid_lote)
        .filter(MovimientoLoteDetalle.producto_id == producto_id)
        .filter(MovimientoLoteDetalle.zona_destino == zona)
        .filter(MovimientoLoteDetalle.tamano_destino == tamano)
        .filter(Movimiento.fecha_caducidad.isnot(None))
        .order_by(Movimiento.fecha_movimiento.desc(), Movimiento.id.desc())
        .first()
    )

    return getattr(row, "fecha_caducidad", None) if row else None


def _disponible_filter():
    hoy = datetime.utcnow().date()
    return or_(
        InventarioLote.fecha_disponibilidad.is_(None),
        InventarioLote.fecha_disponibilidad <= hoy,
    )


def _stock_total_producto(db: Session, producto_id: int) -> int:
    rows = (
        db.query(InventarioLote)
        .filter(InventarioLote.producto_id == producto_id)
        .filter(_disponible_filter())
        .all()
    )
    return sum(int(r.cantidad_disponible or 0) for r in rows)


def _stock_en_zona_tamano(
    db: Session,
    producto_id: int,
    zona: Optional[str],
    tamano: Optional[str],
    include_no_disponibles: bool = False,
) -> int:
    q = db.query(InventarioLote).filter(InventarioLote.producto_id == producto_id)

    if zona is None:
        q = q.filter(InventarioLote.zona.is_(None))
    else:
        q = q.filter(InventarioLote.zona == zona)

    if tamano is None:
        q = q.filter(InventarioLote.tamano.is_(None))
    else:
        q = q.filter(InventarioLote.tamano == tamano)

    if not include_no_disponibles:
        q = q.filter(_disponible_filter())
    rows = q.all()
    return sum(int(r.cantidad_disponible or 0) for r in rows)


def _stock_por_tamano_producto(db: Session, producto_id: int) -> dict:
    rows = (
        db.query(InventarioLote)
        .filter(
            InventarioLote.producto_id == producto_id,
            InventarioLote.cantidad_disponible > 0,
        )
        .filter(_disponible_filter())
        .all()
    )

    out = {}
    for r in rows:
        tam = (r.tamano or "").strip()
        if not tam:
            continue
        out[tam] = out.get(tam, 0) + int(r.cantidad_disponible or 0)

    return out


def _stock_total_producto_tamano(db: Session, producto_id: int, tamano: str) -> int:
    rows = (
        db.query(InventarioLote)
        .filter(
            InventarioLote.producto_id == producto_id,
            InventarioLote.tamano == tamano,
            InventarioLote.cantidad_disponible > 0,
        )
        .filter(_disponible_filter())
        .all()
    )
    return sum(int(r.cantidad_disponible or 0) for r in rows)


def _pedido_to_dict(pedido: Pedido) -> dict:
    items = getattr(pedido, "items", []) or []

    return {
        "id": getattr(pedido, "id", None),
        "estado": getattr(pedido, "estado", None),
        "tipo": getattr(pedido, "tipo", "salida") or "salida",
        "solicitante_username": getattr(pedido, "solicitante_username", None),
        "nota": getattr(pedido, "nota", None),
        "distrito_destino": getattr(pedido, "distrito_destino", None),
        "barrio_destino": getattr(pedido, "barrio_destino", None),
        "direccion_destino": getattr(pedido, "direccion_destino", None),
        "created_at": getattr(pedido, "created_at", None),
        "aprobado_por": getattr(pedido, "aprobado_por", None),
        "aprobado_at": getattr(pedido, "aprobado_at", None),
        "denegado_por": getattr(pedido, "denegado_por", None),
        "denegado_at": getattr(pedido, "denegado_at", None),
        "motivo_denegacion": getattr(pedido, "motivo_denegacion", None),
        "served_at": getattr(pedido, "served_at", None),
        "served_by": getattr(pedido, "served_by", None),
        "items": [
            {
                "id": getattr(item, "id", None),
                "producto_id": getattr(item, "producto_id", None),
                "tamano": getattr(item, "tamano", None),
                "cantidad": getattr(item, "cantidad", 0),
                "cantidad_servida": getattr(item, "cantidad_servida", 0),
                "servicio_completo": int(getattr(item, "cantidad_servida", 0) or 0)
                >= int(getattr(item, "cantidad", 0) or 0),
                "producto_nombre_cientifico": getattr(getattr(item, "producto", None), "nombre_cientifico", None),
                "producto_nombre_natural": getattr(getattr(item, "producto", None), "nombre_natural", None),
                "producto_nombre": (
                    getattr(getattr(item, "producto", None), "nombre_cientifico", None)
                    or getattr(getattr(item, "producto", None), "nombre_natural", None)
                ),
                "movimientos_servicio": [
                    {
                        "movimiento_id": getattr(mov, "id", None),
                        "fecha_movimiento": getattr(mov, "fecha_movimiento", None),
                        "cantidad": getattr(mov, "cantidad", 0),
                        "origen_tipo": getattr(mov, "origen_tipo", None),
                        "destino_tipo": getattr(mov, "destino_tipo", None),
                        "zona_origen": getattr(mov, "zona_origen", None),
                        "tamano_origen": getattr(mov, "tamano_origen", None),
                        "zona_destino": getattr(mov, "zona_destino", None),
                        "tamano_destino": getattr(mov, "tamano_destino", None),
                        "distrito_destino": getattr(mov, "distrito_destino", None),
                        "barrio_destino": getattr(mov, "barrio_destino", None),
                        "direccion_destino": getattr(mov, "direccion_destino", None),
                        "uuid_lote": getattr(mov, "uuid_lote", None),
                        "created_by": getattr(mov, "created_by", None),
                    }
                    for mov in sorted(
                        safeArray(getattr(item, "movimientos", [])),
                        key=lambda x: getattr(x, "fecha_movimiento", datetime.min),
                        reverse=True,
                    )
                ],
            }
            for item in items
        ],
    }



# =============================
# HEALTH
# =============================
@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/ping")
def ping():
    return {"message": "pong"}


# =============================
# AUTH
# =============================


@app.get("/auth/me")
def auth_me(current_user: Usuario = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "rol": current_user.rol,
        "status": current_user.status,
    }


# =============================
# PRODUCTOS
# =============================
@app.get("/productos")
def get_productos(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_roles(["admin", "manager", "tecnico", "empresa_externa", "gestor_vivero"])),
):
    rol_user = (user.rol or "").strip().lower()
    productos_q = db.query(Producto)
    if rol_user == "empresa_externa":
        productos_q = productos_q.filter(
            or_(Producto.es_interno.is_(None), Producto.es_interno == False)
        )
    productos = productos_q.order_by(Producto.nombre_cientifico.asc()).all()

    out = []
    today = datetime.utcnow().date()
    warning_limit = today + timedelta(days=7)

    for p in productos:
        stock_total = _stock_total_producto(db, p.id)
        stock_by_size = _stock_por_tamano_producto(db, p.id)

        alertas_caducidad = []
        lotes = []
        inventarios_vivos = (
            db.query(InventarioLote)
            .filter(
                InventarioLote.producto_id == p.id,
                InventarioLote.cantidad_disponible > 0,
            )
            .all()
        )

        for inv in inventarios_vivos:
            fecha_cad = _get_fecha_caducidad_actual_lote(
                db=db,
                uuid_lote=inv.uuid_lote,
                producto_id=p.id,
                zona=inv.zona,
                tamano=inv.tamano,
            )

            if not fecha_cad:
                continue

            if fecha_cad < today:
                estado = "caducado"
            elif fecha_cad <= warning_limit:
                estado = "proximo_a_caducar"
            else:
                estado = "vigente"

            lote_info = {
                "uuid_lote": inv.uuid_lote,
                "zona": inv.zona,
                "tamano": inv.tamano,
                "cantidad_disponible": int(inv.cantidad_disponible or 0),
                "fecha_caducidad": fecha_cad.isoformat(),
                "fecha_disponibilidad": inv.fecha_disponibilidad.isoformat() if getattr(inv, "fecha_disponibilidad", None) else None,
                "estado": estado,
            }

            lotes.append(lote_info)

            if fecha_cad <= warning_limit:
                alertas_caducidad.append(lote_info)

        item = {
            "id": p.id,
            "nombre_cientifico": p.nombre_cientifico,
            "nombre_natural": p.nombre_natural,
            "nombre": p.nombre_natural or p.nombre_cientifico,
            "categoria": p.categoria,
            "subcategoria": p.subcategoria,
            "stock": stock_total,
            "stock_by_size": stock_by_size,
            "alertas_caducidad": alertas_caducidad,
            "lotes": lotes,
        }

        if rol_user != "empresa_externa":
            item["stock_minimo"] = p.stock_minimo
            item["es_interno"] = bool(getattr(p, "es_interno", False))

        out.append(item)

    return out


# =============================
# PRODUCTOS - ES_INTERNO
# =============================
class ProductoInternoUpdate(BaseModel):
    es_interno: bool


@app.patch("/productos/{producto_id}/es-interno")
def actualizar_producto_interno(
    producto_id: int,
    payload: ProductoInternoUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["admin", "manager"])),
):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    producto.es_interno = bool(payload.es_interno)
    db.commit()
    db.refresh(producto)

    return {
        "id": producto.id,
        "nombre_cientifico": producto.nombre_cientifico,
        "es_interno": bool(producto.es_interno),
    }


# =============================
# PEDIDOS
# =============================
@app.get("/pedidos")
def get_pedidos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["admin", "manager", "tecnico", "empresa_externa", "gestor_vivero"])),
):
    pedidos = db.query(Pedido).order_by(Pedido.id.desc()).all()
    return [_pedido_to_dict(p) for p in pedidos]


@app.post("/pedidos")
def create_pedido(
    payload: PedidoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["admin", "manager", "tecnico", "empresa_externa", "gestor_vivero"])),
):
    if not payload.items or len(payload.items) == 0:
        raise HTTPException(status_code=400, detail="Debes añadir al menos una línea al pedido")

    tipo_pedido = (payload.tipo or "salida").strip().lower()
    if tipo_pedido not in ("salida", "reposicion"):
        raise HTTPException(status_code=400, detail="Tipo de pedido inválido")

    if tipo_pedido == "salida":
        if not payload.distrito_destino or not payload.barrio_destino or not payload.direccion_destino:
            raise HTTPException(status_code=400, detail="Debes indicar distrito, barrio y dirección de destino")

    for item in payload.items:
        if item.cantidad <= 0:
            raise HTTPException(status_code=400, detail="Todas las cantidades deben ser mayores que 0")

        if not item.tamano or not str(item.tamano).strip():
            raise HTTPException(status_code=400, detail="Cada línea del pedido debe incluir un tamaño")

        producto = db.query(Producto).filter(Producto.id == item.producto_id).first()
        if not producto:
            raise HTTPException(status_code=404, detail=f"Producto no encontrado: {item.producto_id}")

        if tipo_pedido == "salida":
            stock_total = _stock_total_producto_tamano(db, item.producto_id, item.tamano)

            if item.cantidad > stock_total:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Stock insuficiente para {producto.nombre_cientifico} "
                        f"en tamaño {item.tamano}. Disponible={stock_total}, solicitado={item.cantidad}"
                    ),
                )

    pedido = Pedido(
        solicitante_username=current_user.username,
        estado="RESERVA",
        tipo=tipo_pedido,
        nota=payload.nota,
        distrito_destino=payload.distrito_destino if tipo_pedido == "salida" else None,
        barrio_destino=payload.barrio_destino if tipo_pedido == "salida" else None,
        direccion_destino=payload.direccion_destino if tipo_pedido == "salida" else None,
    )
    db.add(pedido)
    db.flush()

    for item in payload.items:
        db.add(
            PedidoItem(
                pedido_id=pedido.id,
                producto_id=item.producto_id,
                tamano=item.tamano,
                cantidad=item.cantidad,
                cantidad_servida=0,
            )
        )

    db.commit()
    db.refresh(pedido)
    return _pedido_to_dict(pedido)


@app.put("/pedidos/{pedido_id}")
def update_pedido(
    pedido_id: int,
    payload: PedidoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["admin", "manager", "tecnico", "empresa_externa", "gestor_vivero"])),
):
    pedido = db.query(Pedido).filter(Pedido.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    estado_normalizado = (pedido.estado or "").upper()
    if estado_normalizado != "RESERVA":
        raise HTTPException(status_code=400, detail="Solo se pueden editar pedidos en estado RESERVA")

    if not payload.items or len(payload.items) == 0:
        raise HTTPException(status_code=400, detail="Debes añadir al menos una línea al pedido")

    tipo_pedido = (getattr(pedido, "tipo", "salida") or "salida").strip().lower()

    if tipo_pedido == "salida":
        if not payload.distrito_destino or not payload.barrio_destino or not payload.direccion_destino:
            raise HTTPException(status_code=400, detail="Debes indicar distrito, barrio y dirección de destino")

    for item in payload.items:
        if item.cantidad <= 0:
            raise HTTPException(status_code=400, detail="Todas las cantidades deben ser mayores que 0")

        if not item.tamano or not str(item.tamano).strip():
            raise HTTPException(status_code=400, detail="Cada línea del pedido debe incluir un tamaño")

        producto = db.query(Producto).filter(Producto.id == item.producto_id).first()
        if not producto:
            raise HTTPException(status_code=404, detail=f"Producto no encontrado: {item.producto_id}")

        if tipo_pedido == "salida":
            stock_total = _stock_total_producto_tamano(db, item.producto_id, item.tamano)

            if item.cantidad > stock_total:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Stock insuficiente para {producto.nombre_cientifico} "
                        f"en tamaño {item.tamano}. Disponible={stock_total}, solicitado={item.cantidad}"
                    ),
                )

    pedido.nota = payload.nota
    if tipo_pedido == "salida":
        pedido.distrito_destino = payload.distrito_destino
        pedido.barrio_destino = payload.barrio_destino
        pedido.direccion_destino = payload.direccion_destino

    for existing in list(pedido.items):
        db.delete(existing)

    db.flush()

    for item in payload.items:
        db.add(
            PedidoItem(
                pedido_id=pedido.id,
                producto_id=item.producto_id,
                tamano=item.tamano,
                cantidad=item.cantidad,
                cantidad_servida=0,
            )
        )

    db.commit()
    db.refresh(pedido)
    return _pedido_to_dict(pedido)


@app.post("/pedidos/{pedido_id}/cancelar")
def cancelar_pedido_endpoint(
    pedido_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["admin", "manager", "tecnico", "empresa_externa", "gestor_vivero"])),
):
    pedido = db.query(Pedido).filter(Pedido.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    estado = (pedido.estado or "").upper()
    if estado != "RESERVA":
        raise HTTPException(status_code=400, detail="Solo se pueden cancelar pedidos en estado RESERVA")

    pedido.estado = "CANCELADO"
    db.commit()
    db.refresh(pedido)
    return _pedido_to_dict(pedido)


@app.post("/pedidos/{pedido_id}/aprobar", response_model=PedidoOut)
def aprobar_pedido(
    pedido_id: int,
    payload: PedidoActionRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["admin", "manager"])),
):
    pedido = db.query(Pedido).filter(Pedido.id == pedido_id).first()

    if not pedido:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado.",
        )

    if (pedido.estado or "").upper() != "RESERVA":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden aprobar pedidos en estado RESERVA.",
        )

    if hasattr(pedido, "approved_by"):
        pedido.approved_by = current_user.username
    if hasattr(pedido, "approved_at"):
        pedido.approved_at = datetime.utcnow()

    if hasattr(pedido, "aprobado_por"):
        pedido.aprobado_por = current_user.username
    if hasattr(pedido, "aprobado_at"):
        pedido.aprobado_at = datetime.utcnow()

    pedido.estado = "APROBADO"

    db.commit()
    db.refresh(pedido)

    return _pedido_to_dict(pedido)


@app.post("/pedidos/{pedido_id}/denegar", response_model=PedidoOut)
def denegar_pedido(
    pedido_id: int,
    payload: PedidoActionRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["admin", "manager"])),
):
    pedido = db.query(Pedido).filter(Pedido.id == pedido_id).first()

    if not pedido:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido no encontrado.",
        )

    if (pedido.estado or "").upper() != "RESERVA":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden denegar pedidos en estado RESERVA.",
        )

    pedido.estado = "DENEGADO"

    if hasattr(pedido, "denegado_por"):
        pedido.denegado_por = current_user.username
    if hasattr(pedido, "denegado_at"):
        pedido.denegado_at = datetime.utcnow()
    if hasattr(pedido, "motivo_denegacion"):
        pedido.motivo_denegacion = payload.motivo

    db.commit()
    db.refresh(pedido)

    return _pedido_to_dict(pedido)


# =============================
# LOTES DISPONIBLES POR PRODUCTO
# =============================
@app.get("/lotes/disponibles/{producto_id}")
def get_lotes_disponibles(
    producto_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["admin", "manager", "tecnico", "empresa_externa", "gestor_vivero"])),
):
    rows = (
        db.query(InventarioLote, Lote)
        .join(Lote, Lote.uuid_lote == InventarioLote.uuid_lote)
        .filter(
            InventarioLote.producto_id == producto_id,
            InventarioLote.cantidad_disponible > 0,
        )
        .filter(_disponible_filter())
        .order_by(Lote.id.asc(), InventarioLote.id.asc())
        .all()
    )

    return [
        {
            "uuid_lote": lote.uuid_lote,
            "zona": inv.zona,
            "tamano": inv.tamano,
            "cantidad_disponible": inv.cantidad_disponible,
        }
        for inv, lote in rows
    ]


# =============================
# CREAR MOVIMIENTO
# =============================
@app.post("/movimientos", response_model=MovimientoOut)
def crear_movimiento(
    payload: MovimientoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_roles(["admin", "manager", "tecnico", "gestor_vivero"])),
):
    if payload.cantidad <= 0:
        raise HTTPException(status_code=400, detail="La cantidad debe ser mayor que 0")

    producto = db.query(Producto).filter(Producto.id == payload.producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    origen = _norm_str(payload.origen_tipo)
    destino = _norm_str(payload.destino_tipo)
    tipo = _tipo_movimiento(payload.origen_tipo, payload.destino_tipo)

    pedido = None
    pedido_item = None

    if payload.pedido_id is not None:
        pedido = db.query(Pedido).filter(Pedido.id == payload.pedido_id).first()
        if not pedido:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")

        if (pedido.estado or "").upper() != "APROBADO":
            raise HTTPException(
                status_code=400,
                detail="Solo se puede asociar el movimiento a pedidos en estado APROBADO",
            )

        if payload.pedido_item_id is None:
            raise HTTPException(
                status_code=400,
                detail="Debes indicar la línea del pedido (pedido_item_id).",
            )

        pedido_item = (
            db.query(PedidoItem)
            .filter(
                PedidoItem.id == payload.pedido_item_id,
                PedidoItem.pedido_id == pedido.id,
            )
            .first()
        )

        if not pedido_item:
            raise HTTPException(status_code=404, detail="Línea de pedido no encontrada")

        if int(pedido_item.producto_id) != int(payload.producto_id):
            raise HTTPException(
                status_code=400,
                detail="El producto del movimiento no coincide con la línea del pedido",
            )

        pedido_tipo = (getattr(pedido, "tipo", "salida") or "salida").strip().lower()
        tamano_comparar = (
            payload.tamano_destino if pedido_tipo == "reposicion" else payload.tamano_origen
        )
        if (pedido_item.tamano or "") != (tamano_comparar or ""):
            raise HTTPException(
                status_code=400,
                detail="El tamaño del movimiento no coincide con el tamaño de la línea del pedido",
            )

        pendiente = int(pedido_item.cantidad or 0) - int(pedido_item.cantidad_servida or 0)
        if payload.cantidad > pendiente:
            raise HTTPException(
                status_code=400,
                detail=f"La cantidad supera la pendiente de servir de la línea del pedido. Pendiente={pendiente}",
            )

    es_traslado_interno = origen == "vivero" and destino == "vivero"

    if origen == "vivero":
        disponible = _stock_en_zona_tamano(
            db,
            payload.producto_id,
            payload.zona_origen,
            payload.tamano_origen,
            include_no_disponibles=es_traslado_interno,
        )
        if payload.cantidad > disponible:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente en zona/tamaño. Disponible={disponible}, solicitado={payload.cantidad}",
            )

    fecha_base_movimiento = datetime.utcnow()
    tamano_aplicable_caducidad = _tamano_aplicable_para_caducidad(payload)
    fecha_caducidad, dias_caducidad_aplicados = _calcular_fecha_caducidad(
        db=db,
        producto=producto,
        tamano=tamano_aplicable_caducidad,
        fecha_base=fecha_base_movimiento,
    )

    fecha_disp = payload.fecha_disponibilidad
    if fecha_disp is not None:
        if destino != "vivero":
            raise HTTPException(status_code=400, detail="La fecha de disponibilidad solo aplica a movimientos con destino Vivero")
        if (payload.tamano_destino or "").strip().upper() != "M35":
            raise HTTPException(status_code=400, detail="La fecha de disponibilidad solo aplica al tamaño M35")
        hoy = fecha_base_movimiento.date()
        if fecha_disp <= hoy:
            raise HTTPException(status_code=400, detail="La fecha de disponibilidad debe ser futura")
        if fecha_caducidad is not None and fecha_disp > fecha_caducidad:
            raise HTTPException(status_code=400, detail="La fecha de disponibilidad no puede ser posterior a la fecha de caducidad")

    movimiento = Movimiento(
        pedido_id=payload.pedido_id,
        pedido_item_id=payload.pedido_item_id,
        uuid_lote=payload.uuid_lote.strip() if payload.uuid_lote else None,
        producto_id=payload.producto_id,
        tipo_movimiento=tipo,
        origen_tipo=payload.origen_tipo,
        destino_tipo=payload.destino_tipo,
        zona_origen=payload.zona_origen,
        zona_destino=payload.zona_destino,
        tamano_origen=payload.tamano_origen,
        tamano_destino=payload.tamano_destino,
        cantidad=payload.cantidad,
        distrito_destino=payload.distrito_destino,
        barrio_destino=payload.barrio_destino,
        direccion_destino=payload.direccion_destino,
        cp_destino=payload.cp_destino,

        # 🔥 NUEVO
        observaciones=payload.observaciones or payload.nota,
        es_prestamo=payload.es_prestamo,
        es_devolucion=payload.es_devolucion,
        prestamo_referencia_id=payload.prestamo_referencia_id,

        fecha_movimiento=fecha_base_movimiento,
        fecha_caducidad=fecha_caducidad,
        dias_caducidad_aplicados=dias_caducidad_aplicados,
        fecha_disponibilidad=fecha_disp,
        created_by=user.username,
    )

    db.add(movimiento)
    db.flush()

    uuids_asociados = []

    if origen != "vivero" and destino == "vivero":
        nuevo_uuid = str(uuid.uuid4())
        uuids_asociados.append(nuevo_uuid)

        lote = Lote(
            uuid_lote=nuevo_uuid,
            producto_id=payload.producto_id,
            cantidad_inicial=payload.cantidad,
            tamano_inicial=payload.tamano_destino,
            origen_tipo=payload.origen_tipo,
            origen_referencia=None,
            zona_inicial=payload.zona_destino,
            created_by=user.username,
        )
        db.add(lote)

        inventario = InventarioLote(
            uuid_lote=nuevo_uuid,
            producto_id=payload.producto_id,
            zona=payload.zona_destino,
            tamano=payload.tamano_destino,
            cantidad_disponible=payload.cantidad,
            fecha_disponibilidad=fecha_disp,
        )
        db.add(inventario)

        detalle = MovimientoLoteDetalle(
            movimiento_id=movimiento.id,
            uuid_lote=nuevo_uuid,
            producto_id=payload.producto_id,
            zona_origen=None,
            zona_destino=payload.zona_destino,
            tamano_origen=None,
            tamano_destino=payload.tamano_destino,
            cantidad=payload.cantidad,
        )
        db.add(detalle)

    elif origen == "vivero":
        restante = payload.cantidad

        inventarios_q = (
            db.query(InventarioLote)
            .filter(
                InventarioLote.producto_id == payload.producto_id,
                InventarioLote.zona == payload.zona_origen,
                InventarioLote.tamano == payload.tamano_origen,
                InventarioLote.cantidad_disponible > 0,
            )
        )
        if not es_traslado_interno:
            inventarios_q = inventarios_q.filter(_disponible_filter())
        inventarios = inventarios_q.order_by(InventarioLote.id.asc()).all()

        if payload.uuid_lote:
            inventarios = [inv for inv in inventarios if (inv.uuid_lote or "").strip() == payload.uuid_lote.strip()]
            if not inventarios:
                raise HTTPException(
                    status_code=400,
                    detail="No hay stock disponible para ese UUID en la zona y tamaño seleccionados",
                )

        if not inventarios:
            raise HTTPException(status_code=400, detail="No hay stock disponible en esa zona y tamaño")

        for inv in inventarios:
            if restante <= 0:
                break

            usar = min(int(inv.cantidad_disponible or 0), restante)
            if usar <= 0:
                continue

            inv.cantidad_disponible -= usar
            uuids_asociados.append(inv.uuid_lote)

            if destino == "vivero":
                destino_inv = (
                    db.query(InventarioLote)
                    .filter(
                        InventarioLote.uuid_lote == inv.uuid_lote,
                        InventarioLote.producto_id == payload.producto_id,
                        InventarioLote.zona == payload.zona_destino,
                        InventarioLote.tamano == payload.tamano_destino,
                    )
                    .first()
                )

                fecha_disp_efectiva = fecha_disp if fecha_disp is not None else getattr(inv, "fecha_disponibilidad", None)

                if destino_inv:
                    destino_inv.cantidad_disponible += usar
                    if fecha_disp_efectiva is not None:
                        destino_inv.fecha_disponibilidad = fecha_disp_efectiva
                else:
                    db.add(
                        InventarioLote(
                            uuid_lote=inv.uuid_lote,
                            producto_id=payload.producto_id,
                            zona=payload.zona_destino,
                            tamano=payload.tamano_destino,
                            cantidad_disponible=usar,
                            fecha_disponibilidad=fecha_disp_efectiva,
                        )
                    )

            db.add(
                MovimientoLoteDetalle(
                    movimiento_id=movimiento.id,
                    uuid_lote=inv.uuid_lote,
                    producto_id=payload.producto_id,
                    zona_origen=payload.zona_origen,
                    zona_destino=payload.zona_destino,
                    tamano_origen=payload.tamano_origen,
                    tamano_destino=payload.tamano_destino,
                    cantidad=usar,
                )
            )

            restante -= usar

        if restante > 0:
            raise HTTPException(status_code=400, detail="Stock insuficiente para completar el movimiento")

    movimiento.uuid_lote = _join_uuid_lotes(uuids_asociados) or movimiento.uuid_lote

    pedido_tipo = (getattr(pedido, "tipo", "salida") or "salida").strip().lower() if pedido else "salida"
    es_servicio_pedido = (
        pedido
        and pedido_item
        and (
            (pedido_tipo == "salida" and origen == "vivero" and destino != "vivero")
            or (pedido_tipo == "reposicion" and origen != "vivero" and destino == "vivero")
        )
    )

    if es_servicio_pedido:
        pedido_item.cantidad_servida = int(pedido_item.cantidad_servida or 0) + int(payload.cantidad)

        if int(pedido_item.cantidad_servida or 0) > int(pedido_item.cantidad or 0):
            raise HTTPException(
                status_code=400,
                detail="La cantidad servida supera la cantidad pedida en la línea seleccionada",
            )

        todas_servidas = all(
            int(it.cantidad_servida or 0) >= int(it.cantidad or 0)
            for it in pedido.items
        )

        if todas_servidas:
            pedido.estado = "SERVIDO"
            pedido.served_at = datetime.utcnow()
            pedido.served_by = user.username

    db.commit()
    db.refresh(movimiento)
    return movimiento


# =============================
# LISTAR MOVIMIENTOS
# =============================
@app.get("/movimientos")
def listar_movimientos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["admin", "tecnico", "manager", "empresa_externa", "gestor_vivero"])),
):
    rows = (
        db.query(Movimiento, Producto)
        .join(Producto, Producto.id == Movimiento.producto_id)
        .order_by(Movimiento.id.desc())
        .all()
    )

    out = []
    for mov, prod in rows:
        out.append(
            {
                "id": mov.id,
                "pedido_id": getattr(mov, "pedido_id", None),
                "pedido_item_id": getattr(mov, "pedido_item_id", None),
                "producto_id": mov.producto_id,
                "tipo_movimiento": mov.tipo_movimiento,
                "producto_nombre_cientifico": prod.nombre_cientifico,
                "producto_nombre_natural": prod.nombre_natural,
                "producto_categoria": prod.categoria,
                "producto_subcategoria": prod.subcategoria,
                "cantidad": mov.cantidad,
                "origen_tipo": mov.origen_tipo,
                "destino_tipo": mov.destino_tipo,
                "zona_origen": mov.zona_origen,
                "zona_destino": mov.zona_destino,
                "tamano_origen": mov.tamano_origen,
                "tamano_destino": mov.tamano_destino,
                "fecha_movimiento": mov.fecha_movimiento,
                "fecha_caducidad": getattr(mov, "fecha_caducidad", None),
                "dias_caducidad_aplicados": getattr(mov, "dias_caducidad_aplicados", None),
                "distrito_destino": mov.distrito_destino,
                "barrio_destino": mov.barrio_destino,
                "direccion_destino": mov.direccion_destino,
                "cp_destino": mov.cp_destino,
                "observaciones": mov.observaciones,
                "es_prestamo": mov.es_prestamo,
                "es_devolucion": mov.es_devolucion,
                "created_by": getattr(mov, "created_by", None),
                "uuid_lote": getattr(mov, "uuid_lote", None),
                "observaciones": getattr(mov, "observaciones", None),
                "es_prestamo": getattr(mov, "es_prestamo", False),
                "es_devolucion": getattr(mov, "es_devolucion", False),
                "prestamo_referencia_id": getattr(mov, "prestamo_referencia_id", None),
                "devuelto": getattr(mov, "devuelto", False),
                "fecha_devolucion": getattr(mov, "fecha_devolucion", None),
            }
        )
    return out


# =============================
# TRAZABILIDAD POR UUID
# =============================
@app.get("/lotes/{uuid_lote}")
def get_lote(
    uuid_lote: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["admin", "tecnico", "manager", "empresa_externa", "gestor_vivero"])),
):
    lote = db.query(Lote).filter(Lote.uuid_lote == uuid_lote).first()

    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")

    detalles = (
        db.query(MovimientoLoteDetalle, Movimiento)
        .join(Movimiento, Movimiento.id == MovimientoLoteDetalle.movimiento_id)
        .filter(MovimientoLoteDetalle.uuid_lote == uuid_lote)
        .order_by(Movimiento.fecha_movimiento.asc(), Movimiento.id.asc())
        .all()
    )

    inventario_actual = (
        db.query(InventarioLote)
        .filter(
            InventarioLote.uuid_lote == uuid_lote,
            InventarioLote.cantidad_disponible > 0,
        )
        .all()
    )

    return {
        "uuid_lote": lote.uuid_lote,
        "producto_id": lote.producto_id,
        "cantidad_inicial": lote.cantidad_inicial,
        "fecha_entrada": lote.fecha_entrada,
        "movimientos": [
            {
                "movimiento_id": mov.id,
                "cantidad": det.cantidad,
                "origen_tipo": mov.origen_tipo,
                "destino_tipo": mov.destino_tipo,
                "zona_origen": det.zona_origen,
                "zona_destino": det.zona_destino,
                "tamano_origen": det.tamano_origen,
                "tamano_destino": det.tamano_destino,
                "fecha_movimiento": mov.fecha_movimiento,
                "fecha_caducidad": getattr(mov, "fecha_caducidad", None),
            }
            for det, mov in detalles
        ],
        "inventario_actual": [
            {
                "zona": inv.zona,
                "tamano": inv.tamano,
                "cantidad_disponible": inv.cantidad_disponible,
            }
            for inv in inventario_actual
        ],
    }
    
    
 # =============================
# REPORTES - HELPERS
# =============================
def _fmt_ubicacion_externa(distrito, barrio, direccion):
    parts = [distrito, barrio, direccion]
    parts = [p for p in parts if p]
    return " · ".join(parts) if parts else "ubicación externa no especificada"


def _producto_display(prod: Producto | None, producto_id: int | None = None) -> str:
    if prod:
        return prod.nombre_cientifico or prod.nombre_natural or f"Producto #{prod.id}"
    if producto_id:
        return f"Producto #{producto_id}"
    return "Producto"


# =============================
# REPORTES - TRAZABILIDAD
# =============================
@app.get("/reportes/trazabilidad/{uuid_lote}")
def reporte_trazabilidad(
    uuid_lote: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["admin", "manager"])),
):
    lote = (
        db.query(Lote)
        .join(Producto, Producto.id == Lote.producto_id)
        .filter(Lote.uuid_lote == uuid_lote)
        .first()
    )

    if not lote:
        raise HTTPException(status_code=404, detail="UUID no encontrado")

    producto = db.query(Producto).filter(Producto.id == lote.producto_id).first()

    detalles = (
        db.query(MovimientoLoteDetalle, Movimiento)
        .join(Movimiento, Movimiento.id == MovimientoLoteDetalle.movimiento_id)
        .filter(MovimientoLoteDetalle.uuid_lote == uuid_lote)
        .order_by(Movimiento.fecha_movimiento.asc(), Movimiento.id.asc())
        .all()
    )

    inventario_actual = (
        db.query(InventarioLote)
        .filter(
            InventarioLote.uuid_lote == uuid_lote,
            InventarioLote.cantidad_disponible > 0,
        )
        .order_by(InventarioLote.zona.asc(), InventarioLote.tamano.asc())
        .all()
    )

    movimientos_out = []

    for det, mov in detalles:
        origen = (mov.origen_tipo or "").strip().lower()
        destino = (mov.destino_tipo or "").strip().lower()
        cantidad = int(det.cantidad or 0)
        nombre_producto = _producto_display(producto, lote.producto_id)

        if origen != "vivero" and destino == "vivero":
            descripcion = (
                f"El {mov.fecha_movimiento.strftime('%d/%m/%Y')} entraron {cantidad} unidades de "
                f"{nombre_producto}, tamaño {det.tamano_destino or '—'}, en la zona {det.zona_destino or '—'}."
            )
        elif origen == "vivero" and destino == "vivero":
            descripcion = (
                f"El {mov.fecha_movimiento.strftime('%d/%m/%Y')}, {cantidad} unidades de "
                f"{nombre_producto} pasaron de la zona {det.zona_origen or '—'} "
                f"({det.tamano_origen or '—'}) a la zona {det.zona_destino or '—'} "
                f"({det.tamano_destino or '—'})."
            )
        elif origen == "vivero" and destino != "vivero":
            ubicacion = _fmt_ubicacion_externa(
                mov.distrito_destino,
                mov.barrio_destino,
                mov.direccion_destino,
            )
            descripcion = (
                f"El {mov.fecha_movimiento.strftime('%d/%m/%Y')}, {cantidad} unidades de "
                f"{nombre_producto} salieron del vivero hacia {ubicacion}, "
                f"registrado por {mov.created_by or '—'}."
            )
        else:
            descripcion = (
                f"El {mov.fecha_movimiento.strftime('%d/%m/%Y')} se registró un movimiento de "
                f"{cantidad} unidades de {nombre_producto}."
            )

        movimientos_out.append(
            {
                "movimiento_id": mov.id,
                "fecha_movimiento": mov.fecha_movimiento,
                "fecha_caducidad": getattr(mov, "fecha_caducidad", None),
                "cantidad": cantidad,
                "origen_tipo": mov.origen_tipo,
                "destino_tipo": mov.destino_tipo,
                "zona_origen": det.zona_origen,
                "zona_destino": det.zona_destino,
                "tamano_origen": det.tamano_origen,
                "tamano_destino": det.tamano_destino,
                "distrito_destino": mov.distrito_destino,
                "barrio_destino": mov.barrio_destino,
                "direccion_destino": mov.direccion_destino,
                "created_by": mov.created_by,
                "descripcion": descripcion,
            }
        )

    return {
        "uuid_lote": lote.uuid_lote,
        "producto_id": lote.producto_id,
        "producto_nombre": _producto_display(producto, lote.producto_id),
        "cantidad_inicial": lote.cantidad_inicial,
        "fecha_entrada": lote.fecha_entrada,
        "movimientos": movimientos_out,
        "inventario_actual": [
            {
                "zona": inv.zona,
                "tamano": inv.tamano,
                "cantidad_disponible": inv.cantidad_disponible,
            }
            for inv in inventario_actual
        ],
    }


# =============================
# REPORTES - DISTRIBUCION
# =============================
@app.get("/reportes/distribucion")
def reporte_distribucion(
    producto: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["admin", "manager"])),
):
    producto = (producto or "").strip()
    if not producto:
        raise HTTPException(status_code=400, detail="Debes indicar el nombre del producto")

    prod = (
        db.query(Producto)
        .filter(
            or_(
                Producto.nombre_cientifico.ilike(f"%{producto}%"),
                Producto.nombre_natural.ilike(f"%{producto}%"),
            )
        )
        .order_by(Producto.nombre_cientifico.asc())
        .first()
    )

    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    rows = (
        db.query(
            InventarioLote.zona,
            InventarioLote.tamano,
            func.sum(InventarioLote.cantidad_disponible).label("cantidad"),
        )
        .filter(
            InventarioLote.producto_id == prod.id,
            InventarioLote.cantidad_disponible > 0,
        )
        .group_by(InventarioLote.zona, InventarioLote.tamano)
        .order_by(InventarioLote.zona.asc(), InventarioLote.tamano.asc())
        .all()
    )

    distribucion = [
        {
            "zona": zona,
            "tamano": tamano,
            "cantidad": int(cantidad or 0),
        }
        for zona, tamano, cantidad in rows
    ]

    stock_total = sum(int(r["cantidad"]) for r in distribucion)

    return {
        "producto_id": prod.id,
        "producto_nombre": _producto_display(prod, prod.id),
        "stock_total": stock_total,
        "distribucion": distribucion,
    }


# =============================
# REPORTES - STOCK BAJO
# =============================
@app.get("/reportes/stock-bajo")
def reporte_stock_bajo(
    margen_pct: int = 20,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["admin", "manager"])),
):
    productos = db.query(Producto).order_by(Producto.nombre_cientifico.asc()).all()

    stock_rows = (
        db.query(
            InventarioLote.producto_id,
            func.sum(InventarioLote.cantidad_disponible).label("stock_total"),
        )
        .filter(InventarioLote.cantidad_disponible > 0)
        .group_by(InventarioLote.producto_id)
        .all()
    )

    stock_map = {producto_id: int(stock_total or 0) for producto_id, stock_total in stock_rows}

    bajo_minimo = []
    proximos = []

    for p in productos:
        stock_actual = int(stock_map.get(p.id, 0))
        stock_minimo = int(p.stock_minimo or 0)

        if stock_minimo <= 0:
            continue

        umbral_alerta = int(round(stock_minimo * (1 + (max(1, margen_pct) / 100))))

        row = {
            "producto_id": p.id,
            "producto_nombre": _producto_display(p, p.id),
            "stock_actual": stock_actual,
            "stock_minimo": stock_minimo,
            "umbral_alerta": umbral_alerta,
        }

        if stock_actual < stock_minimo:
            bajo_minimo.append(row)
        elif stock_actual <= umbral_alerta:
            proximos.append(row)

    bajo_minimo.sort(key=lambda x: (x["stock_actual"] - x["stock_minimo"], x["producto_nombre"]))
    proximos.sort(key=lambda x: (x["stock_actual"] - x["stock_minimo"], x["producto_nombre"]))

    return {
        "margen_pct": margen_pct,
        "bajo_minimo": bajo_minimo,
        "proximos": proximos,
    }


# =============================
# REPORTES - MOVIMIENTOS EXTERNOS
# =============================
@app.get("/reportes/movimientos-externos")
def reporte_movimientos_externos(
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    distrito: str | None = None,
    barrio: str | None = None,
    direccion: str | None = None,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_roles(["admin", "manager"])),
):
    q = (
        db.query(Movimiento, Producto)
        .join(Producto, Producto.id == Movimiento.producto_id)
        .filter(func.lower(Movimiento.origen_tipo) == "vivero")
        .filter(
            or_(
                func.lower(Movimiento.destino_tipo) != "vivero",
                Movimiento.distrito_destino.isnot(None),
                Movimiento.barrio_destino.isnot(None),
                Movimiento.direccion_destino.isnot(None),
            )
        )
    )

    if fecha_desde:
        try:
            dt_desde = datetime.strptime(fecha_desde, "%Y-%m-%d")
            q = q.filter(Movimiento.fecha_movimiento >= dt_desde)
        except ValueError:
            raise HTTPException(status_code=400, detail="fecha_desde inválida")

    if fecha_hasta:
        try:
            dt_hasta = datetime.strptime(fecha_hasta, "%Y-%m-%d")
            dt_hasta = dt_hasta.replace(hour=23, minute=59, second=59)
            q = q.filter(Movimiento.fecha_movimiento <= dt_hasta)
        except ValueError:
            raise HTTPException(status_code=400, detail="fecha_hasta inválida")

    if distrito:
        q = q.filter(Movimiento.distrito_destino.ilike(f"%{distrito.strip()}%"))

    if barrio:
        q = q.filter(Movimiento.barrio_destino.ilike(f"%{barrio.strip()}%"))

    if direccion:
        q = q.filter(Movimiento.direccion_destino.ilike(f"%{direccion.strip()}%"))

    rows = q.order_by(Movimiento.fecha_movimiento.desc(), Movimiento.id.desc()).all()

    return [
        {
            "movimiento_id": mov.id,
            "fecha_movimiento": mov.fecha_movimiento,
            "producto_id": mov.producto_id,
            "producto_nombre": _producto_display(prod, mov.producto_id),
            "cantidad": mov.cantidad,
            "origen_tipo": mov.origen_tipo,
            "destino_tipo": mov.destino_tipo,
            "zona_origen": mov.zona_origen,
            "zona_destino": mov.zona_destino,
            "tamano_origen": mov.tamano_origen,
            "tamano_destino": mov.tamano_destino,
            "distrito_destino": mov.distrito_destino,
            "barrio_destino": mov.barrio_destino,
            "direccion_destino": mov.direccion_destino,
            "created_by": mov.created_by,
        }
        for mov, prod in rows
    ]
    
    
# =========================
# INVENTARIO POR ZONA
# =========================
def _normalize_zona_id(value: str | None) -> str:
    raw = (value or "").strip().lower()
    raw = raw.replace("_", "").replace("-", "").replace(" ", "")
    if raw.startswith("zonazona"):
        raw = raw[len("zonazona"):]
    if raw.startswith("zona"):
        raw = raw[len("zona"):]
    return raw


@app.get("/zonas/{zona_id}/items")
def get_zona_items(zona_id: str, db: Session = Depends(get_db)):
    zona_norm = _normalize_zona_id(zona_id)

    q = (
        db.query(InventarioLote, Producto)
        .join(Producto, Producto.id == InventarioLote.producto_id)
        .filter(InventarioLote.cantidad_disponible > 0)
    )

    if zona_norm:
        q = q.filter(
            or_(
                func.lower(InventarioLote.zona) == zona_norm,
                InventarioLote.zona.ilike(f"%{zona_norm}%"),
            )
        )

    inventarios = q.all()

    productos: dict[int, dict] = {}

    for inv, prod in inventarios:
        inv_zona_norm = _normalize_zona_id(getattr(inv, "zona", None))
        if inv_zona_norm != zona_norm:
            continue

        producto_id = getattr(inv, "producto_id", None)
        if producto_id is None:
            continue

        if producto_id not in productos:
            productos[producto_id] = {
                "producto_id": producto_id,
                "nombre_cientifico": getattr(prod, "nombre_cientifico", None),
                "nombre_natural": getattr(prod, "nombre_natural", None),
                "categoria": getattr(prod, "categoria", None),
                "subcategoria": getattr(prod, "subcategoria", None),
                "cantidad": 0,
                "tamanos_map": {},
            }

        cantidad = int(getattr(inv, "cantidad_disponible", 0) or 0)
        tamano = (getattr(inv, "tamano", None) or "N/A").strip() or "N/A"

        productos[producto_id]["cantidad"] += cantidad
        productos[producto_id]["tamanos_map"][tamano] = (
            productos[producto_id]["tamanos_map"].get(tamano, 0) + cantidad
        )

    items = []
    for item in productos.values():
        tamanos = [
            {"tamano": tamano, "cantidad": cantidad}
            for tamano, cantidad in sorted(item["tamanos_map"].items(), key=lambda x: x[0])
        ]
        items.append(
            {
                "producto_id": item["producto_id"],
                "nombre_cientifico": item["nombre_cientifico"],
                "nombre_natural": item["nombre_natural"],
                "categoria": item["categoria"],
                "subcategoria": item["subcategoria"],
                "cantidad": item["cantidad"],
                "tamanos": tamanos,
            }
        )

    items.sort(key=lambda x: (x.get("nombre_cientifico") or x.get("nombre_natural") or "").lower())

    return {
        "zona": zona_id,
        "zona_normalizada": zona_norm,
        "total_productos": len(items),
        "items": items,
    }
