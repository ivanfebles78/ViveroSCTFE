from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from db import Base


# =========================
# USUARIOS
# =========================
class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=False)

    status = Column(String(20), nullable=False, default="activo")
    rol = Column(String(20), nullable=False, default="manager")

    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# =========================
# PRODUCTOS
# =========================
class Producto(Base):
    __tablename__ = "productos"

    id = Column(Integer, primary_key=True, index=True)
    nombre_natural = Column(String(255), nullable=True)
    nombre_cientifico = Column(String(255), nullable=False)

    categoria = Column(String(100), nullable=False)
    subcategoria = Column(String(100), nullable=False)

    stock_minimo = Column(Integer, default=0)
    es_interno = Column(Boolean, nullable=False, default=False)


class CaducidadConfig(Base):
    __tablename__ = "caducidad_reglas"

    id = Column(Integer, primary_key=True, index=True)
    categoria = Column(String(100), nullable=False, index=True)
    subcategoria = Column(String(100), nullable=False, index=True)
    tamano = Column(String(20), nullable=False, index=True)
    dias_caducidad = Column(Integer, nullable=True)
    activo = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


# =========================
# LOTES (UUID DE ENTRADA)
# =========================
class Lote(Base):
    __tablename__ = "lotes"

    id = Column(Integer, primary_key=True, index=True)
    uuid_lote = Column(String(50), unique=True, index=True, nullable=False)

    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)

    tamano_inicial = Column(String(20), nullable=True)
    cantidad_inicial = Column(Integer, nullable=False)

    origen_tipo = Column(String(30), nullable=True)
    origen_referencia = Column(String(255), nullable=True)

    zona_inicial = Column(String(20), nullable=True)

    fecha_entrada = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(50), nullable=True)

    producto = relationship("Producto")


# =========================
# INVENTARIO POR LOTE / ZONA / TAMAÑO
# =========================
class InventarioLote(Base):
    __tablename__ = "inventario_lote"

    id = Column(Integer, primary_key=True, index=True)

    uuid_lote = Column(String(50), index=True, nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)

    zona = Column(String(20), nullable=True)
    tamano = Column(String(20), nullable=True)

    cantidad_disponible = Column(Integer, nullable=False)
    fecha_disponibilidad = Column(Date, nullable=True)

    producto = relationship("Producto")


# =========================
# PEDIDOS
# =========================
class Pedido(Base):
    __tablename__ = "pedidos"

    id = Column(Integer, primary_key=True, index=True)
    estado = Column(String(30), nullable=False, default="RESERVA", index=True)
    tipo = Column(String(20), nullable=False, default="salida", index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    created_by = Column(String(150), nullable=True)
    solicitante_username = Column(String(150), nullable=True)
    nota = Column(Text, nullable=True)

    distrito_destino = Column(String(150), nullable=True)
    barrio_destino = Column(String(150), nullable=True)
    direccion_destino = Column(String(255), nullable=True)

    aprobado_por = Column(String(150), nullable=True)
    aprobado_at = Column(DateTime, nullable=True)

    denegado_por = Column(String(150), nullable=True)
    denegado_at = Column(DateTime, nullable=True)
    motivo_denegacion = Column(Text, nullable=True)

    served_at = Column(DateTime, nullable=True)
    served_by = Column(String(150), nullable=True)

    items = relationship(
        "PedidoItem",
        back_populates="pedido",
        cascade="all, delete-orphan",
    )

    movimientos = relationship(
        "Movimiento",
        back_populates="pedido",
    )


class PedidoItem(Base):
    __tablename__ = "pedido_items"

    id = Column(Integer, primary_key=True, index=True)
    pedido_id = Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False, index=True)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False, index=True)
    tamano = Column(String(30), nullable=True)
    cantidad = Column(Integer, nullable=False)
    cantidad_servida = Column(Integer, nullable=False, default=0)

    pedido = relationship("Pedido", back_populates="items")
    producto = relationship("Producto")

    movimientos = relationship(
        "Movimiento",
        back_populates="pedido_item",
    )

# =========================
# MOVIMIENTOS
# =========================
class Movimiento(Base):
    __tablename__ = "movimientos"

    id = Column(Integer, primary_key=True, index=True)

    pedido_id = Column(Integer, ForeignKey("pedidos.id"), nullable=True)
    pedido_item_id = Column(Integer, ForeignKey("pedido_items.id"), nullable=True)

    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)

    tipo_movimiento = Column(String(20), nullable=False)

    # UUID o lista de UUIDs asociados al movimiento.
    # Si el movimiento sólo afecta a un lote, habrá un único UUID.
    # Si afecta a varios lotes, se almacenan separados por coma.
    uuid_lote = Column(String(255), nullable=True, index=True)

    origen_tipo = Column(String(30), nullable=False)
    destino_tipo = Column(String(30), nullable=False)

    zona_origen = Column(String(20), nullable=True)
    zona_destino = Column(String(20), nullable=True)

    tamano_origen = Column(String(20), nullable=True)
    tamano_destino = Column(String(20), nullable=True)

    cantidad = Column(Integer, nullable=False)

    distrito_destino = Column(String(100), nullable=True)
    barrio_destino = Column(String(100), nullable=True)
    direccion_destino = Column(String(255), nullable=True)
    cp_destino = Column(String(20), nullable=True)

    observaciones = Column(Text, nullable=True)
    es_prestamo = Column(Boolean, default=False, nullable=False)
    es_devolucion = Column(Boolean, default=False, nullable=False)
    prestamo_referencia_id = Column(Integer, ForeignKey("movimientos.id"), nullable=True)
    devuelto = Column(Boolean, default=False, nullable=False)
    fecha_devolucion = Column(DateTime, nullable=True)

    fecha_movimiento = Column(DateTime, default=datetime.utcnow)
    fecha_caducidad = Column(Date, nullable=True)
    dias_caducidad_aplicados = Column(Integer, nullable=True)
    fecha_disponibilidad = Column(Date, nullable=True)
    created_by = Column(String(50), nullable=True)

    producto = relationship("Producto")
    detalles = relationship("MovimientoLoteDetalle", back_populates="movimiento")

    pedido = relationship("Pedido", back_populates="movimientos")
    pedido_item = relationship("PedidoItem", back_populates="movimientos")


# =========================
# DETALLE MOVIMIENTO-LOTE
# =========================
class MovimientoLoteDetalle(Base):
    __tablename__ = "movimiento_lote_detalle"

    id = Column(Integer, primary_key=True, index=True)

    movimiento_id = Column(Integer, ForeignKey("movimientos.id", ondelete="CASCADE"), nullable=False)
    uuid_lote = Column(String(50), index=True, nullable=False)
    producto_id = Column(Integer, ForeignKey("productos.id"), nullable=False)

    zona_origen = Column(String(20), nullable=True)
    zona_destino = Column(String(20), nullable=True)

    tamano_origen = Column(String(20), nullable=True)
    tamano_destino = Column(String(20), nullable=True)

    cantidad = Column(Integer, nullable=False)

    movimiento = relationship("Movimiento", back_populates="detalles")
    producto = relationship("Producto")