from datetime import datetime
from typing import Optional, Literal, List
from pydantic import BaseModel, Field, EmailStr

TamanoType = Literal["semillero", "M12", "M20", "M30"]
MovimientoTipo = Literal["entrada", "salida", "traslado_interno"]
OrigenTipo = Literal["Proveedor", "Vivero", "Palmetum"]
DestinoTipo = Literal["Vivero", "Externo", "Baja Vivero", "Palmetum"]

UserStatus = Literal["activo", "inactivo", "bloqueado"]
UserRole = Literal["admin", "tecnico", "manager", "proveedor"]


class ProductoCreate(BaseModel):
    nombre_natural: Optional[str] = Field(default=None, max_length=255)
    nombre_cientifico: str = Field(min_length=1, max_length=255)
    categoria: str = Field(min_length=1, max_length=100)
    subcategoria: str = Field(min_length=1, max_length=100)
    stock_minimo: int = Field(ge=0, default=0)


class ProductoUpdate(BaseModel):
    nombre_natural: Optional[str] = Field(default=None, max_length=255)
    nombre_cientifico: Optional[str] = Field(default=None, min_length=1, max_length=255)
    categoria: Optional[str] = Field(default=None, min_length=1, max_length=100)
    subcategoria: Optional[str] = Field(default=None, min_length=1, max_length=100)
    stock_minimo: Optional[int] = Field(default=None, ge=0)


class ProductoOut(BaseModel):
    id: int
    nombre_natural: Optional[str]
    nombre_cientifico: str
    categoria: str
    subcategoria: str
    stock_minimo: int

    class Config:
        from_attributes = True


class MovimientoCreate(BaseModel):
    pedido_id: Optional[int] = None
    pedido_item_id: Optional[int] = None
    uuid_lote: Optional[str] = None
    producto_id: int

    origen_tipo: OrigenTipo
    destino_tipo: DestinoTipo

    zona_origen: Optional[str] = None
    zona_destino: Optional[str] = None

    tamano_origen: Optional[TamanoType] = None
    tamano_destino: Optional[TamanoType] = None

    cantidad: int = Field(gt=0)

    distrito_destino: Optional[str] = None
    barrio_destino: Optional[str] = None
    direccion_destino: Optional[str] = None
    cp_destino: Optional[str] = None

    nota: Optional[str] = None


class MovimientoOut(BaseModel):
    id: int
    pedido_id: Optional[int]
    pedido_item_id: Optional[int] = None
    uuid_lote: Optional[str] = None
    producto_id: int
    tipo_movimiento: str

    origen_tipo: str
    destino_tipo: str

    zona_origen: Optional[str]
    zona_destino: Optional[str]

    tamano_origen: Optional[str]
    tamano_destino: Optional[str]

    cantidad: int

    distrito_destino: Optional[str]
    barrio_destino: Optional[str]
    direccion_destino: Optional[str]
    cp_destino: Optional[str]

    fecha_movimiento: datetime
    created_by: Optional[str]

    class Config:
        from_attributes = True


class MovimientoEnriquecidoOut(MovimientoOut):
    producto_nombre_cientifico: str
    producto_categoria: str
    producto_subcategoria: str
    producto_nombre_natural: Optional[str]


class LoteOut(BaseModel):
    id: int
    uuid_lote: str
    producto_id: int
    tamano_inicial: str
    cantidad_inicial: int
    origen_tipo: str
    origen_referencia: Optional[str]
    zona_inicial: str
    fecha_entrada: datetime
    created_by: Optional[str]

    class Config:
        from_attributes = True


class InventarioLoteOut(BaseModel):
    id: int
    uuid_lote: str
    producto_id: int
    zona: str
    tamano: str
    cantidad_disponible: int

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    password: str = Field(min_length=6, max_length=200)
    status: UserStatus = "activo"
    rol: UserRole = "manager"


class UserOut(BaseModel):
    id: int
    username: str
    email: Optional[str]
    status: str
    rol: str

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    status: Optional[UserStatus] = None
    rol: Optional[UserRole] = None


class ResetPasswordIn(BaseModel):
    new_password: str = Field(min_length=6, max_length=200)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PedidoItemCreate(BaseModel):
    producto_id: int
    tamano: TamanoType
    cantidad: int = Field(gt=0)


class PedidoCreate(BaseModel):
    items: List[PedidoItemCreate]
    nota: Optional[str] = None

class PedidoActionRequest(BaseModel):
    motivo: Optional[str] = None


class PedidoItemOut(BaseModel):
    id: Optional[int] = None
    producto_id: int
    producto_nombre: Optional[str] = None
    tamano: Optional[str] = None
    cantidad: int
    cantidad_servida: int = 0

    class Config:
        from_attributes = True


class PedidoOut(BaseModel):
    id: int
    estado: str
    created_at: datetime
    solicitante_username: Optional[str] = None
    served_at: Optional[datetime] = None
    served_by: Optional[str] = None
    aprobado_por: Optional[str] = None
    aprobado_at: Optional[datetime] = None
    denegado_por: Optional[str] = None
    denegado_at: Optional[datetime] = None
    motivo_denegacion: Optional[str] = None
    distrito_destino: Optional[str] = None
    barrio_destino: Optional[str] = None
    direccion_destino: Optional[str] = None
    items: List[PedidoItemOut] = []

    class Config:
        from_attributes = True


class PedidoDecisionIn(BaseModel):
    nota: Optional[str] = None


class PedidoServirIn(BaseModel):
    origen_zona: str
    nota: Optional[str] = None


class PedidoUpdate(BaseModel):
    items: List[PedidoItemCreate]
    nota: Optional[str] = None