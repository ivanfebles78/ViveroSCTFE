import React, { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  getPedidos,
  getProductos,
  getMovimientos,
  createPedido,
  updatePedido,
  cancelarPedido,
} from "../api/api";

const TAMANOS = ["Semillero", "M12", "M20", "M35"];

const ESTADO_FILTERS = [
  { value: "TODOS", label: "Todos" },
  { value: "RESERVA", label: "Reserva" },
  { value: "APROBADO", label: "Aprobado" },
  { value: "SERVIDO", label: "Servido" },
  { value: "DENEGADO", label: "Denegado" },
  { value: "CANCELADO", label: "Cancelado" },
  { value: "CADUCADO", label: "Caducado" },
];

const DISTRITO_BARRIOS = {
  Anaga: [
    "Almáciga",
    "Afur",
    "Casas de La Cumbre",
    "Chamorga",
    "Cueva Bermeja",
    "El Bailadero",
    "El Suculum",
    "Igueste San Andrés",
    "La Alegría",
    "Lomo de las Bodegas-La Cumbrilla",
    "Los Campitos",
    "María Jiménez",
    "Roque Negro",
    "San Andrés",
    "Taborno",
    "Taganana",
    "Valle Tahodio",
    "Valleseco",
    "Benijo",
    "El Draguillo",
    "Catalanes",
  ],
  "Centro-Ifara": [
    "Barrio Nuevo",
    "Duggi",
    "Ifara",
    "Las Acacias",
    "Las Mimosas",
    "Los Hoteles",
    "Los Lavaderos",
    "Salamanca",
    "Toscal",
    "Urbanización Anaga",
    "Uruguay",
    "Zona Centro",
    "Zona Rambla",
  ],
  "Salud-La Salle": [
    "Buenavista",
    "Chapatal",
    "Cruz del Señor",
    "Cuatro Torres",
    "Cuesta de Piedra",
    "El Cabo",
    "El Perú",
    "La Salle",
    "La Salud",
    "La Victoria",
    "Los Gladiolos",
    "Los Llanos",
    "San Sebastián",
    "Villa Ascensión",
  ],
  "Ofra-Costa Sur": [
    "Chimisay",
    "Ballester",
    "Buenos Aires",
    "Camino del Hierro",
    "César Casariego",
    "Chamberí",
    "Finca La Multa",
    "García Escámez",
    "Juan XXIII",
    "Las Cabritas",
    "Las Delicias",
    "Las Retamas",
    "Mayorazgo",
    "Miramar",
    "Moraditas",
    "Nuevo Obrero",
    "San Antonio",
    "San Pío X",
    "Santa Clara",
    "Somosierra",
    "Tío Pino",
    "Tristán",
    "Villa Benítez",
    "Vistabella",
  ],
  Suroeste: [
    "Acorán",
    "Alisios",
    "Añaza",
    "Barranco Grande",
    "El Chorrillo",
    "El Sobradillo",
    "El Tablero",
    "La Gallega",
    "Llano del Moro",
    "Santa María del Mar",
    "Tíncer",
  ],
};

const DISTRITOS = Object.keys(DISTRITO_BARRIOS);

const safeArray = (x) => (Array.isArray(x) ? x : []);

const fmtFechaES = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
};

const dateInputValue = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const estadoNormalizado = (estado) => String(estado || "").trim().toUpperCase();

// Devuelve la fecha de caducidad del pedido.
// 1) Si el pedido tiene fecha_caducidad a nivel pedido (ej. empresa_externa = 15 días), usa esa.
// 2) Si no, calcula la más próxima entre los movimientos_servicio de sus items.
const getPedidoFechaCaducidad = (pedido) => {
  if (pedido?.fecha_caducidad) {
    const d = new Date(pedido.fecha_caducidad);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const items = Array.isArray(pedido?.items) ? pedido.items : [];
  let min = null;
  for (const it of items) {
    const movs = Array.isArray(it?.movimientos_servicio) ? it.movimientos_servicio : [];
    for (const m of movs) {
      if (!m?.fecha_caducidad) continue;
      const d = new Date(m.fecha_caducidad);
      if (Number.isNaN(d.getTime())) continue;
      if (!min || d < min) min = d;
    }
  }
  return min;
};

function lineKey(productoId, tamano) {
  return `${productoId}__${tamano}`;
}

function parseLineKey(key) {
  const [producto_id, tamano] = String(key).split("__");
  return { producto_id: Number(producto_id), tamano: tamano || "M12" };
}

function clampNumber(v, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function cardStyle() {
  return {
    background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
    border: "1px solid rgba(148,163,184,0.16)",
    borderRadius: 22,
    boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
  };
}

function softInputStyle() {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(255,255,255,0.94)",
    color: "#0f172a",
    fontWeight: 700,
    outline: "none",
    boxSizing: "border-box",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
  };
}

function thStyle() {
  return {
    textAlign: "left",
    padding: "14px 12px",
    color: "#475569",
    fontWeight: 900,
    fontSize: 13,
    letterSpacing: 0.2,
    borderBottom: "1px solid rgba(15,23,42,0.08)",
    whiteSpace: "nowrap",
  };
}

function tdStyle() {
  return {
    padding: "16px 12px",
    verticalAlign: "top",
    color: "#0f172a",
    fontWeight: 700,
  };
}

function actionBtn(enabled) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.22)",
    background: enabled ? "white" : "rgba(148,163,184,0.14)",
    color: enabled ? "#0f172a" : "#94a3b8",
    fontWeight: 900,
    cursor: enabled ? "pointer" : "not-allowed",
    boxShadow: enabled ? "0 10px 24px rgba(15,23,42,0.05)" : "none",
  };
}

function dangerBtn(enabled) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.18)",
    background: enabled ? "rgba(239,68,68,0.08)" : "rgba(148,163,184,0.14)",
    color: enabled ? "#991b1b" : "#94a3b8",
    fontWeight: 900,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}

function primaryBtn(disabled) {
  return {
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(6,182,212,0.25)",
    background: disabled
      ? "linear-gradient(90deg, rgba(148,163,184,0.45), rgba(148,163,184,0.35))"
      : "linear-gradient(135deg, #0ea5e9 0%, #06b6d4 40%, #10b981 100%)",
    color: "white",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 16px 36px rgba(6,182,212,0.24)",
  };
}

function badge(estado) {
  const e = estadoNormalizado(estado);
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 12px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid rgba(15,23,42,0.08)",
    minWidth: 108,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
  };

  if (e === "APROBADO") return { ...base, background: "rgba(16,185,129,0.12)", color: "#065f46" };
  if (e === "DENEGADO") return { ...base, background: "rgba(239,68,68,0.10)", color: "#991b1b" };
  if (e === "SERVIDO") return { ...base, background: "rgba(59,130,246,0.10)", color: "#1e3a8a" };
  if (e === "CANCELADO") return { ...base, background: "rgba(148,163,184,0.18)", color: "#334155" };
  if (e === "CADUCADO") return { ...base, background: "rgba(100,116,139,0.16)", color: "#475569" };
  return { ...base, background: "rgba(245,158,11,0.12)", color: "#92400e" };
}

function buildStockByProductSize(movimientos) {
  const map = new Map();

  const add = (productoId, tamano, delta) => {
    if (!productoId || !tamano) return;
    const key = lineKey(productoId, tamano);
    map.set(key, (map.get(key) || 0) + delta);
  };

  for (const m of safeArray(movimientos)) {
    const productoId = m?.producto_id;
    const origenTipo = String(m?.origen_tipo || "").trim().toLowerCase();
    const destinoTipo = String(m?.destino_tipo || "").trim().toLowerCase();
    const cantidad = Number(m?.cantidad || 0);

    if (!productoId || !cantidad) continue;

    if (destinoTipo === "vivero" && m?.tamano_destino) {
      add(productoId, m.tamano_destino, cantidad);
    }

    if (origenTipo === "vivero" && m?.tamano_origen) {
      add(productoId, m.tamano_origen, -cantidad);
    }
  }

  return map;
}

function MessageBanner({ msg, msgType, onClose }) {
  if (!msg) return null;
  const isError = msgType === "error";

  return (
    <div
      style={{
        ...cardStyle(),
        marginTop: 14,
        padding: "14px 16px",
        border: isError
          ? "1px solid rgba(239,68,68,0.18)"
          : "1px solid rgba(16,185,129,0.18)",
        background: isError
          ? "linear-gradient(180deg, rgba(254,242,242,0.98), rgba(255,255,255,0.98))"
          : "linear-gradient(180deg, rgba(236,253,245,0.98), rgba(255,255,255,0.98))",
        color: isError ? "#991b1b" : "#065f46",
        fontWeight: 800,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span>{msg}</span>

      <button
        onClick={onClose}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 18,
          fontWeight: 900,
          color: isError ? "#991b1b" : "#065f46",
          lineHeight: 1,
        }}
        title="Cerrar"
        aria-label="Cerrar mensaje"
      >
        ×
      </button>
    </div>
  );
}

function DestinoResumen({ distrito, barrio, direccion }) {
  const parts = [distrito, barrio, direccion].filter(Boolean);
  if (!parts.length) return "—";
  return parts.join(" · ");
}

function getProductDisplayName(p) {
  return p?.nombre_cientifico || p?.producto_nombre_cientifico || p?.nombre || p?.nombre_natural || `Producto #${p?.id}`;
}

function getScientificProductDisplayName(p) {
  return (
    p?.nombre_cientifico ||
    p?.producto_nombre_cientifico ||
    p?.nombre_cientifico_producto ||
    p?.nombre ||
    p?.producto_nombre ||
    p?.nombre_natural ||
    p?.producto_nombre_natural ||
    `Producto #${p?.id || p?.producto_id || "—"}`
  );
}

function ModalStat({ label, value, tone = "default" }) {
  const tones = {
    default: {
      background: "rgba(255,255,255,0.76)",
      color: "#0f172a",
      border: "1px solid rgba(148,163,184,0.15)",
    },
    success: {
      background: "rgba(16,185,129,0.10)",
      color: "#065f46",
      border: "1px solid rgba(16,185,129,0.15)",
    },
    warn: {
      background: "rgba(245,158,11,0.10)",
      color: "#92400e",
      border: "1px solid rgba(245,158,11,0.15)",
    },
  };

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 16,
        ...tones[tone],
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 22, fontWeight: 900, color: tones[tone].color }}>{value}</div>
    </div>
  );
}

/* ===========================
   NUEVO PEDIDO
   =========================== */

function PedidoModal({
  open,
  onClose,
  productos,
  stockByProductSize,
  onSubmit,
  saving,
}) {
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [qtyInput, setQtyInput] = useState({});
  const [cart, setCart] = useState({});
  const [localError, setLocalError] = useState("");
  const [distritoDestino, setDistritoDestino] = useState("");
  const [barrioDestino, setBarrioDestino] = useState("");
  const [direccionDestino, setDireccionDestino] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedProductId("");
      setQtyInput({});
      setCart({});
      setLocalError("");
      setDistritoDestino("");
      setBarrioDestino("");
      setDireccionDestino("");
    }
  }, [open]);

  useEffect(() => {
    setBarrioDestino("");
  }, [distritoDestino]);

  const barriosDisponibles = useMemo(
    () => (distritoDestino ? DISTRITO_BARRIOS[distritoDestino] || [] : []),
    [distritoDestino]
  );

  const productosDisponibles = useMemo(() => {
    const texto = search.trim().toLowerCase();

    return safeArray(productos)
      .filter((p) => {
        const tieneStock = TAMANOS.some((t) => (stockByProductSize.get(lineKey(p.id, t)) || 0) > 0);
        if (!tieneStock) return false;
        if (!texto) return true;

        const nombreCientifico = String(p?.nombre_cientifico || p?.producto_nombre_cientifico || "").toLowerCase();
        const categoria = String(p?.categoria || "").toLowerCase();
        const subcategoria = String(p?.subcategoria || "").toLowerCase();

        return (
          nombreCientifico.includes(texto) ||
          categoria.includes(texto) ||
          subcategoria.includes(texto)
        );
      })
      .sort((a, b) =>
        String(getScientificProductDisplayName(a)).localeCompare(String(getScientificProductDisplayName(b)))
      );
  }, [productos, stockByProductSize, search]);

  const selectedProduct = useMemo(
    () => productosDisponibles.find((p) => String(p.id) === String(selectedProductId)) || null,
    [productosDisponibles, selectedProductId]
  );

  const selectedProductSizes = useMemo(() => {
    if (!selectedProduct) return [];
    return TAMANOS.map((tamano) => {
      const key = lineKey(selectedProduct.id, tamano);
      const disponible = Math.max(0, Number(stockByProductSize.get(key) || 0));
      const enCesta = Number(cart[key] || 0);
      const restante = Math.max(0, disponible - enCesta);

      return {
        tamano,
        disponible,
        restante,
        enCesta,
      };
    }).filter((x) => x.disponible > 0);
  }, [selectedProduct, stockByProductSize, cart]);

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([key, cantidad]) => {
        const parsed = parseLineKey(key);
        const prod = productos.find((p) => p.id === parsed.producto_id);
        const disponible = Math.max(0, Number(stockByProductSize.get(key) || 0));
        return {
          key,
          producto_id: parsed.producto_id,
          tamano: parsed.tamano,
          cantidad: Number(cantidad),
          nombre: getScientificProductDisplayName(prod),
          disponible,
        };
      })
      .filter((x) => x.cantidad > 0);
  }, [cart, productos, stockByProductSize]);

  const totalItems = cartLines.reduce((acc, x) => acc + x.cantidad, 0);

  const cartIsValid = useMemo(() => {
    if (!cartLines.length) return false;
    return cartLines.every((line) => line.cantidad > 0 && line.cantidad <= line.disponible);
  }, [cartLines]);

  const destinationIsValid =
    !!distritoDestino && !!barrioDestino && !!String(direccionDestino || "").trim();

  const canSubmit = !saving && cartIsValid && destinationIsValid;

  const addToCart = (productoId, tamano) => {
    setLocalError("");
    const key = lineKey(productoId, tamano);
    const qty = Number(qtyInput[key]);
    const disponible = Math.max(0, Number(stockByProductSize.get(key) || 0));
    const yaEnCesta = Number(cart[key] || 0);
    const restante = disponible - yaEnCesta;

    if (!qty || qty <= 0) {
      setLocalError("Indica una cantidad válida mayor que 0.");
      return;
    }

    if (qty > restante) {
      setLocalError(`No puedes añadir ${qty}. Disponible restante para ${tamano}: ${restante}.`);
      return;
    }

    setCart((prev) => ({
      ...prev,
      [key]: (prev[key] || 0) + qty,
    }));

    setQtyInput((prev) => ({
      ...prev,
      [key]: "",
    }));
  };

  const updateCartLine = (key, nextQty) => {
    const disponible = Math.max(0, Number(stockByProductSize.get(key) || 0));
    const qty = clampNumber(nextQty, 0, disponible);

    if (qty <= 0) {
      setCart((prev) => {
        const clone = { ...prev };
        delete clone[key];
        return clone;
      });
      return;
    }

    setCart((prev) => ({
      ...prev,
      [key]: qty,
    }));
  };

  const submitPedido = async () => {
    setLocalError("");

    if (!cartLines.length) {
      setLocalError("Añade al menos un producto a la cesta.");
      return;
    }

    if (!destinationIsValid) {
      setLocalError("Debes indicar distrito, barrio y dirección de destino.");
      return;
    }

    if (!cartIsValid) {
      setLocalError("Hay líneas con cantidad superior al stock disponible.");
      return;
    }

    await onSubmit({
      items: cartLines.map((x) => ({
        producto_id: x.producto_id,
        tamano: x.tamano,
        cantidad: x.cantidad,
      })),
      distrito_destino: distritoDestino,
      barrio_destino: barrioDestino,
      direccion_destino: direccionDestino.trim(),
    });
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background:
          "radial-gradient(circle at top left, rgba(14,165,233,0.18), transparent 30%), radial-gradient(circle at top right, rgba(16,185,129,0.16), transparent 30%), rgba(2,6,23,0.62)",
        backdropFilter: "blur(8px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 22,
      }}
    >
      <div
        style={{
          width: "min(1760px, 98vw)",
          height: "min(930px, 94vh)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
          borderRadius: 28,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.35)",
          boxShadow: "0 40px 120px rgba(2,6,23,0.40)",
          display: "grid",
          gridTemplateColumns: "0.95fr 1.02fr 1fr",
        }}
      >
        <div
          style={{
            padding: 24,
            borderRight: "1px solid rgba(15,23,42,0.07)",
            overflowY: "auto",
            overflowX: "hidden",
            minWidth: 0,
            background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,252,0.98))",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 30, fontWeight: 900, color: "#0f172a" }}>Nuevo pedido</div>
              <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
                Selecciona productos con stock disponible y confirma el destino final.
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.18)",
                background: "white",
                fontWeight: 900,
                fontSize: 18,
                cursor: "pointer",
                color: "#0f172a",
              }}
              title="Cerrar"
            >
              ×
            </button>
          </div>

          <div style={{ marginTop: 18, position: "relative" }}>
            <input
              placeholder="Buscar por nombre científico, categoría o subcategoría..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={softInputStyle()}
            />
          </div>

          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <ModalStat label="Productos con stock" value={productosDisponibles.length} />
            <ModalStat label="Líneas en cesta" value={cartLines.length} tone={cartLines.length ? "success" : "default"} />
          </div>

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {productosDisponibles.length === 0 ? (
              <div style={{ color: "#64748b", fontWeight: 700 }}>
                No hay productos disponibles para esa búsqueda.
              </div>
            ) : (
              productosDisponibles.map((p) => {
                const active = String(selectedProductId) === String(p.id);
                const total = TAMANOS.reduce(
                  (acc, t) => acc + Math.max(0, Number(stockByProductSize.get(lineKey(p.id, t)) || 0)),
                  0
                );

                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProductId(String(p.id))}
                    style={{
                      ...cardStyle(),
                      textAlign: "left",
                      padding: 16,
                      cursor: "pointer",
                      border: active
                        ? "1px solid rgba(6,182,212,0.34)"
                        : "1px solid rgba(148,163,184,0.14)",
                      background: active
                        ? "linear-gradient(180deg, rgba(240,249,255,0.98), rgba(236,253,245,0.98))"
                        : "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98))",
                      boxShadow: active
                        ? "0 22px 40px rgba(6,182,212,0.12)"
                        : "0 12px 28px rgba(15,23,42,0.05)",
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>
                      {getScientificProductDisplayName(p)}
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: "#64748b",
                        fontWeight: 800,
                        letterSpacing: 0.2,
                        textTransform: "uppercase",
                      }}
                    >
                      {(p.categoria || "—") + (p.subcategoria ? ` · ${p.subcategoria}` : "")}
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 10px",
                        borderRadius: 999,
                        background: "rgba(15,23,42,0.04)",
                        color: "#0f172a",
                        fontWeight: 900,
                        fontSize: 13,
                      }}
                    >
                      Stock total disponible: {total}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div
          style={{
            padding: 24,
            borderRight: "1px solid rgba(15,23,42,0.07)",
            overflowY: "auto",
            overflowX: "hidden",
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
            {selectedProduct ? getScientificProductDisplayName(selectedProduct) : "Selecciona un producto"}
          </div>

          <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
            {selectedProduct
              ? "Añade solo lo que realmente esté disponible. El sistema valida stock en tiempo real."
              : "Cuando elijas un producto, aquí verás los tamaños y las unidades disponibles."}
          </div>

          {!selectedProduct ? (
            <div
              style={{
                ...cardStyle(),
                marginTop: 22,
                padding: 22,
                color: "#64748b",
                fontWeight: 700,
                minHeight: 220,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              Elige un producto del panel izquierdo para continuar.
            </div>
          ) : (
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.1fr 0.8fr 0.9fr auto",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 16,
                  background: "rgba(248,250,252,0.95)",
                  border: "1px solid rgba(15,23,42,0.08)",
                  color: "#475569",
                  fontWeight: 900,
                  fontSize: 13,
                  textTransform: "uppercase",
                  letterSpacing: 0.3,
                }}
              >
                <div>Tamaño</div>
                <div style={{ textAlign: "center" }}>Disponible</div>
                <div style={{ textAlign: "center" }}>Añadir</div>
                <div style={{ textAlign: "center" }}>Acción</div>
              </div>

              {selectedProductSizes.length === 0 ? (
                <div style={{ color: "#64748b", fontWeight: 700 }}>
                  Este producto no tiene stock por tamaño disponible.
                </div>
              ) : (
                selectedProductSizes.map((row) => {
                  const key = lineKey(selectedProduct.id, row.tamano);
                  const disabled = row.restante <= 0;
                  return (
                    <div
                      key={key}
                      style={{
                        ...cardStyle(),
                        padding: 14,
                        display: "grid",
                        gridTemplateColumns: "1.1fr 0.8fr 0.9fr auto",
                        gap: 12,
                        alignItems: "center",
                        minWidth: 0,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 18 }}>{row.tamano}</div>
                        <div style={{ marginTop: 4, color: "#64748b", fontWeight: 700, fontSize: 12 }}>
                          En cesta: {row.enCesta} · Restante tras pedido: {row.restante}
                        </div>
                      </div>

                      <div
                        style={{
                          justifySelf: "center",
                          padding: "8px 12px",
                          borderRadius: 999,
                          background: row.restante > 0 ? "rgba(16,185,129,0.10)" : "rgba(148,163,184,0.12)",
                          color: row.restante > 0 ? "#065f46" : "#64748b",
                          fontWeight: 900,
                          minWidth: 70,
                          textAlign: "center",
                        }}
                      >
                        {row.restante}
                      </div>

                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <input
                          type="number"
                          min={0}
                          max={row.restante}
                          value={qtyInput[key] ?? ""}
                          onChange={(e) =>
                            setQtyInput((prev) => ({
                              ...prev,
                              [key]: clampNumber(e.target.value, 0, row.restante),
                            }))
                          }
                          placeholder="0"
                          style={{
                            width: 104,
                            padding: "10px 12px",
                            borderRadius: 12,
                            border: "1px solid rgba(15,23,42,0.12)",
                            textAlign: "center",
                            fontWeight: 900,
                            color: "#0f172a",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <button
                          onClick={() => addToCart(selectedProduct.id, row.tamano)}
                          disabled={disabled}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 12,
                            border: "1px solid rgba(16,185,129,0.18)",
                            background: disabled
                              ? "rgba(148,163,184,0.14)"
                              : "linear-gradient(135deg, rgba(14,165,233,0.12), rgba(16,185,129,0.14))",
                            color: disabled ? "#94a3b8" : "#065f46",
                            fontWeight: 900,
                            cursor: disabled ? "not-allowed" : "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Añadir
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div
          style={{
            padding: 24,
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(240,249,255,0.65) 100%)",
          }}
        >
          <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Resumen y destino</div>
          <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
            Revisa la cesta y define el destino exacto del pedido.
          </div>

          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <ModalStat label="Líneas" value={cartLines.length} />
            <ModalStat label="Unidades" value={totalItems} tone={totalItems ? "success" : "default"} />
            <ModalStat label="Estado" value={canSubmit ? "Listo" : "Pendiente"} tone={canSubmit ? "success" : "warn"} />
          </div>

          <div style={{ ...cardStyle(), marginTop: 16, padding: 18 }}>
            <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 12, fontSize: 17 }}>
              Destino del pedido
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6, textTransform: "uppercase" }}>
                  Distrito
                </div>
                <select
                  value={distritoDestino}
                  onChange={(e) => setDistritoDestino(e.target.value)}
                  style={softInputStyle()}
                >
                  <option value="">Seleccionar distrito</option>
                  {DISTRITOS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6, textTransform: "uppercase" }}>
                  Barrio
                </div>
                <select
                  value={barrioDestino}
                  onChange={(e) => setBarrioDestino(e.target.value)}
                  disabled={!distritoDestino}
                  style={{
                    ...softInputStyle(),
                    opacity: distritoDestino ? 1 : 0.66,
                  }}
                >
                  <option value="">
                    {distritoDestino ? "Seleccionar barrio" : "Primero selecciona un distrito"}
                  </option>
                  {barriosDisponibles.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6, textTransform: "uppercase" }}>
                  Dirección
                </div>
                <input
                  value={direccionDestino}
                  onChange={(e) => setDireccionDestino(e.target.value)}
                  placeholder="Escribe la dirección de destino"
                  style={softInputStyle()}
                />
              </div>
            </div>
          </div>

          {localError ? (
            <div
              style={{
                ...cardStyle(),
                marginTop: 14,
                padding: 14,
                background: "linear-gradient(180deg, rgba(254,242,242,0.96), rgba(255,255,255,0.98))",
                border: "1px solid rgba(239,68,68,0.16)",
                color: "#991b1b",
                fontWeight: 800,
              }}
            >
              {localError}
            </div>
          ) : null}

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
            {cartLines.length === 0 ? (
              <div
                style={{
                  ...cardStyle(),
                  padding: 18,
                  color: "#64748b",
                  fontWeight: 700,
                }}
              >
                Todavía no has añadido productos al pedido.
              </div>
            ) : (
              cartLines.map((line) => {
                const remainingAfterThisLine = Math.max(0, line.disponible - line.cantidad);
                const invalid = line.cantidad > line.disponible;

                return (
                  <div
                    key={line.key}
                    style={{
                      ...cardStyle(),
                      padding: 14,
                      border: invalid
                        ? "1px solid rgba(239,68,68,0.22)"
                        : "1px solid rgba(148,163,184,0.14)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 17 }}>{line.nombre}</div>
                        <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                          Tamaño: {line.tamano} · Stock real: {line.disponible} · Restante: {remainingAfterThisLine}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: invalid ? "rgba(239,68,68,0.10)" : "rgba(16,185,129,0.10)",
                          color: invalid ? "#991b1b" : "#065f46",
                          fontWeight: 900,
                          fontSize: 12,
                        }}
                      >
                        {invalid ? "Sin stock suficiente" : "Válido"}
                      </div>
                    </div>

                    <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="number"
                        min={0}
                        max={line.disponible}
                        value={line.cantidad}
                        onChange={(e) => updateCartLine(line.key, e.target.value)}
                        style={{
                          width: 96,
                          padding: "9px 10px",
                          borderRadius: 10,
                          border: "1px solid rgba(15,23,42,0.12)",
                          textAlign: "center",
                          fontWeight: 900,
                          color: "#0f172a",
                        }}
                      />

                      <button
                        onClick={() => updateCartLine(line.key, 0)}
                        style={{
                          padding: "9px 12px",
                          borderRadius: 10,
                          border: "1px solid rgba(239,68,68,0.18)",
                          background: "rgba(239,68,68,0.08)",
                          color: "#991b1b",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={actionBtn(!saving)}
            >
              Cerrar
            </button>

            <button
              onClick={submitPedido}
              disabled={!canSubmit}
              style={{
                ...primaryBtn(!canSubmit),
                marginLeft: "auto",
              }}
            >
              {saving ? "Creando..." : "Confirmar pedido"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================
   LISTA DE PEDIDOS
   ========================================= */

function PedidoDetalleCellOld({
  pedido,
  mapProdName,
  expanded,
  toggleExpanded,
  editingId,
  editQty,
  setEditQty,
  editSearch,
  setEditSearch,
  productosDisponiblesParaEdicion,
}) {
  const items = editingId === pedido.id
    ? Object.entries(editQty).map(([key, cantidad]) => {
        const parsed = parseLineKey(key);
        return {
          producto_id: parsed.producto_id,
          tamano: parsed.tamano,
          cantidad: Number(cantidad),
        };
      })
    : safeArray(pedido.items);

  if (editingId !== pedido.id) {
    const visibleItems = expanded ? items : items.slice(0, 3);
    const hiddenCount = Math.max(0, items.length - visibleItems.length);

    return (
      <div>
        {items.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleItems.map((it, idx) => {
              const pid = it.producto_id;
              const nombre =
                it.producto_nombre_cientifico ||
                it.nombre_cientifico ||
                mapProdName.get(pid) ||
                it.producto_nombre_natural ||
                it.nombre_natural ||
                it.nombre ||
                `ID ${pid}`;

              return (
                <div
                  key={`${pedido.id}-${idx}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 90px 80px",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{nombre}</div>
                  <div style={{ textAlign: "center", fontWeight: 900, color: "#334155" }}>
                    {it.tamano || "—"}
                  </div>
                  <div style={{ textAlign: "right", fontWeight: 900, color: "#0f172a" }}>
                    {it.cantidad ?? 0}
                  </div>
                </div>
              );
            })}

            {items.length > 3 ? (
              <button
                onClick={() => toggleExpanded(pedido.id)}
                style={{
                  alignSelf: "flex-start",
                  marginTop: 4,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(15,23,42,0.10)",
                  background: "white",
                  color: "#0f172a",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {expanded ? "Ver menos" : `+ ver ${hiddenCount} más`}
              </button>
            ) : null}
          </div>
        ) : (
          <span style={{ color: "#64748b", fontWeight: 700 }}>Sin detalle</span>
        )}
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Object.entries(editQty).map(([key, cantidad]) => {
          const parsed = parseLineKey(key);
          return (
            <div
              key={`${pedido.id}-${key}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 90px",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 800, color: "#0f172a" }}>
                {mapProdName.get(parsed.producto_id) || `ID ${parsed.producto_id}`}
              </div>
              <div style={{ textAlign: "center", fontWeight: 900, color: "#334155" }}>
                {parsed.tamano}
              </div>
              <input
                type="number"
                min={0}
                value={cantidad}
                onChange={(e) =>
                  setEditQty((prev) => ({
                    ...prev,
                    [key]: Number(e.target.value),
                  }))
                }
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.12)",
                  textAlign: "center",
                  fontWeight: 900,
                }}
              />
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <input
          type="text"
          placeholder="Buscar productos para añadir por nombre científico..."
          value={editSearch}
          onChange={(e) => setEditSearch(e.target.value)}
          style={softInputStyle()}
        />

        <div
          style={{
            marginTop: 10,
            maxHeight: 180,
            overflow: "auto",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 12,
          }}
        >
          {productosDisponiblesParaEdicion.length === 0 ? (
            <div style={{ padding: 12, color: "#64748b", fontWeight: 700 }}>
              No hay más productos que coincidan.
            </div>
          ) : (
            productosDisponiblesParaEdicion.flatMap((prod) =>
              TAMANOS.map((tam) => {
                const key = lineKey(prod.id, tam);
                const disponible = Number(prod._stockBySize?.[tam] || 0);
                if (editQty[key] != null || disponible <= 0) return null;

                return (
                  <div
                    key={key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 90px auto",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderTop: "1px solid rgba(15,23,42,0.06)",
                    }}
                  >
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>
                      {getScientificProductDisplayName(prod)}
                    </div>
                    <div style={{ textAlign: "center", fontWeight: 900, color: "#334155" }}>
                      {tam}
                    </div>
                    <div style={{ textAlign: "center", fontWeight: 900, color: "#0f172a" }}>
                      {disponible}
                    </div>
                    <button
                      onClick={() =>
                        setEditQty((prev) => ({
                          ...prev,
                          [key]: 1,
                        }))
                      }
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(16,185,129,0.25)",
                        background: "rgba(16,185,129,0.10)",
                        color: "#065f46",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Añadir
                    </button>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    </>
  );
}

export default function Pedidos() {
  const { me } = useOutletContext();

  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingNewPedido, setSavingNewPedido] = useState(false);

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");
  const msgTimerRef = useRef(null);

  const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
  const [idFiltro, setIdFiltro] = useState("");
  const [fechaFiltro, setFechaFiltro] = useState("");
  const [solicitanteFiltro, setSolicitanteFiltro] = useState("");
  const [textoFiltro, setTextoFiltro] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editQty, setEditQty] = useState({});
  const [editSearch, setEditSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

  const role = me?.rol || me?.role;
  const isReadOnly = role === "tecnico" || role === "gestor_vivero";
  const isAdmin = role === "admin";

  const clearMsgTimer = () => {
    if (msgTimerRef.current) {
      clearTimeout(msgTimerRef.current);
      msgTimerRef.current = null;
    }
  };

  const showTimedMessage = (text, type = "success") => {
    clearMsgTimer();
    setMsg(text);
    setMsgType(type);
    msgTimerRef.current = setTimeout(() => {
      setMsg("");
    }, 3000);
  };

  useEffect(() => {
    refrescar();
    return () => clearMsgTimer();
  }, []);

  const solicitanteFromPedido = (p) =>
    p?.solicitante_username || p?.solicitante || p?.created_by || p?.usuario || p?.username || "—";

  const refrescar = async () => {
    setLoading(true);
    clearMsgTimer();
    setMsg("");

    try {
      const [prods, movs, peds] = await Promise.all([
        getProductos(),
        getMovimientos(),
        getPedidos(),
      ]);

      setProductos(safeArray(prods));
      setMovimientos(safeArray(movs));
      setPedidos(safeArray(peds));
    } catch (e) {
      showTimedMessage(
        e?.response?.data?.detail || e?.message || "Error cargando pedidos",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const stockByProductSize = useMemo(
    () => buildStockByProductSize(movimientos),
    [productos, movimientos]
  );

  const productosConStock = useMemo(() => {
    return productos
      .map((p) => {
        const stockBySize = {};
        TAMANOS.forEach((t) => {
          stockBySize[t] = Math.max(0, Number(stockByProductSize.get(lineKey(p.id, t)) || 0));
        });
        return { ...p, _stockBySize: stockBySize };
      })
      .filter((p) => TAMANOS.some((t) => Number(p._stockBySize[t] || 0) > 0));
  }, [productos, stockByProductSize]);

  const mapProdName = useMemo(() => {
    const m = new Map();
    for (const p of productos) {
      m.set(p.id, getScientificProductDisplayName(p));
    }
    return m;
  }, [productos]);

  const handleCreatePedidoFromModal = async (payload) => {
    setSavingNewPedido(true);

    try {
      await createPedido(payload);
      setModalOpen(false);
      await refrescar();
      showTimedMessage("Pedido creado correctamente.", "success");
    } catch (e) {
      showTimedMessage(
        e?.response?.data?.detail || e?.message || "Error creando pedido",
        "error"
      );
    } finally {
      setSavingNewPedido(false);
    }
  };

  const puedeEditarCancelar = (p) => {
    const estado = estadoNormalizado(p?.estado);

    if (
      estado === "APROBADO" ||
      estado === "DENEGADO" ||
      estado === "SERVIDO" ||
      estado === "CANCELADO" ||
      estado === "CADUCADO"
    ) {
      return false;
    }

    if (isReadOnly) return false;
    if (isAdmin) return estado === "RESERVA";

    const solicitante = solicitanteFromPedido(p);
    const soyYo = solicitante && me?.username && solicitante === me.username;
    return role === "empresa_externa" && estado === "RESERVA" && soyYo;
  };

  const onCancelar = async (p) => {
    try {
      await cancelarPedido(p.id);
      await refrescar();
      showTimedMessage("Pedido cancelado.", "success");
    } catch (e) {
      showTimedMessage(
        e?.response?.data?.detail || e?.message || "Error cancelando pedido",
        "error"
      );
    }
  };

  const startEdit = (p) => {
    const items = safeArray(p.items);
    const map = {};
    items.forEach((it) => {
      const pid = it.producto_id;
      const tam = it.tamano || "M12";
      const cantidad = Number(it.cantidad ?? 0);
      if (pid) map[lineKey(pid, tam)] = cantidad;
    });
    setEditQty(map);
    setEditSearch("");
    setEditingId(p.id);
    setMsg("");
  };

  const stopEdit = () => {
    setEditingId(null);
    setEditQty({});
    setEditSearch("");
  };

  const onGuardarEdicion = async (pedidoId) => {
    try {
      const pedidoOriginal = pedidos.find((p) => p.id === pedidoId);

      const items = Object.entries(editQty)
        .map(([key, cantidad]) => {
          const parsed = parseLineKey(key);
          return {
            producto_id: parsed.producto_id,
            tamano: parsed.tamano,
            cantidad: Number(cantidad),
          };
        })
        .filter((x) => x.cantidad > 0 && Number.isFinite(x.producto_id) && x.tamano);

      await updatePedido(pedidoId, {
        items,
        distrito_destino: pedidoOriginal?.distrito_destino || null,
        barrio_destino: pedidoOriginal?.barrio_destino || null,
        direccion_destino: pedidoOriginal?.direccion_destino || null,
      });

      stopEdit();
      await refrescar();
      showTimedMessage("Pedido actualizado correctamente.", "success");
    } catch (e) {
      showTimedMessage(
        e?.response?.data?.detail || e?.message || "Error actualizando pedido",
        "error"
      );
    }
  };

  const productosDisponiblesParaEdicion = useMemo(() => {
    const texto = editSearch.trim().toLowerCase();
    return productosConStock.filter((p) => {
      const nombreCientifico = String(p?.nombre_cientifico || p?.producto_nombre_cientifico || "").toLowerCase();
      const categoria = String(p?.categoria || "").toLowerCase();
      const subcategoria = String(p?.subcategoria || "").toLowerCase();
      return !texto || nombreCientifico.includes(texto) || categoria.includes(texto) || subcategoria.includes(texto);
    });
  }, [productosConStock, editSearch]);

  const pedidosFiltrados = useMemo(() => {
    const texto = textoFiltro.trim().toLowerCase();
    const esEmpresaExterna = role === "empresa_externa";

    return pedidos
      .slice()
      .filter((p) => {
        if (!esEmpresaExterna) return true;
        // Defensa en frontend: oculta reposición y pedidos que no son suyos
        const tipo = String(p?.tipo || "salida").toLowerCase();
        if (tipo === "reposicion") return false;
        const solicitante = solicitanteFromPedido(p);
        return me?.username && solicitante === me.username;
      })
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .filter((p) => {
        const idOk = !idFiltro || String(p.id).includes(String(idFiltro).trim());
        const estadoOk = estadoFiltro === "TODOS" || estadoNormalizado(p?.estado) === estadoFiltro;
        const fechaOk = !fechaFiltro || dateInputValue(p?.created_at) === fechaFiltro;

        const solicitante = solicitanteFromPedido(p).toLowerCase();
        const solicitanteOk =
          !solicitanteFiltro || solicitante.includes(solicitanteFiltro.trim().toLowerCase());

        const detalle = safeArray(p.items)
          .map((it) => {
            const nombre =
              it.producto_nombre_cientifico ||
              it.nombre_cientifico ||
              mapProdName.get(it.producto_id) ||
              it.producto_nombre_natural ||
              it.nombre_natural ||
              it.nombre ||
              `producto ${it.producto_id}`;
            return `${nombre} ${it.tamano || ""} ${it.cantidad || ""}`.toLowerCase();
          })
          .join(" ");

        const destinoTxt = `${p?.distrito_destino || ""} ${p?.barrio_destino || ""} ${p?.direccion_destino || ""}`.toLowerCase();

        const textoOk =
          !texto ||
          String(p.id).toLowerCase().includes(texto) ||
          solicitante.includes(texto) ||
          estadoNormalizado(p?.estado).toLowerCase().includes(texto) ||
          detalle.includes(texto) ||
          destinoTxt.includes(texto);

        return idOk && estadoOk && fechaOk && solicitanteOk && textoOk;
      });
  }, [pedidos, estadoFiltro, idFiltro, fechaFiltro, solicitanteFiltro, textoFiltro, mapProdName]);

  const toggleExpanded = (pedidoId) => {
    setExpandedRows((prev) => ({
      ...prev,
      [pedidoId]: !prev[pedidoId],
    }));
  };

  const clearFilters = () => {
    setEstadoFiltro("TODOS");
    setIdFiltro("");
    setFechaFiltro("");
    setSolicitanteFiltro("");
    setTextoFiltro("");
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 44, margin: 0, fontWeight: 900, color: "#0f172a" }}>Pedidos</h1>
          <div style={{ marginTop: 8, color: "#64748b", fontWeight: 700 }}>
            Crea y gestiona pedidos con control de stock y destino final.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {!isReadOnly && (
            <button
              onClick={() => setModalOpen(true)}
              style={primaryBtn(false)}
            >
              Nuevo pedido
            </button>
          )}

          <div style={{ fontWeight: 800, color: "#64748b" }}>
            Usuario: <span style={{ color: "#0f172a" }}>{me?.username || "—"}</span> · Rol:{" "}
            <span style={{ color: "#0f172a" }}>{role || "—"}</span>
          </div>
        </div>
      </div>

      <MessageBanner
        msg={msg}
        msgType={msgType}
        onClose={() => {
          clearMsgTimer();
          setMsg("");
        }}
      />

      <div
        style={{
          ...cardStyle(),
          marginTop: 16,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 14 }}>
          Lista de pedidos
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "140px 170px 180px 170px 1fr auto",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <input
            placeholder="Filtrar por ID"
            value={idFiltro}
            onChange={(e) => setIdFiltro(e.target.value)}
            style={softInputStyle()}
          />

          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            style={softInputStyle()}
          >
            {ESTADO_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={fechaFiltro}
            onChange={(e) => setFechaFiltro(e.target.value)}
            style={softInputStyle()}
          />

          <input
            placeholder="Solicitante"
            value={solicitanteFiltro}
            onChange={(e) => setSolicitanteFiltro(e.target.value)}
            style={softInputStyle()}
          />

          <input
            placeholder="Buscar en detalle o destino..."
            value={textoFiltro}
            onChange={(e) => setTextoFiltro(e.target.value)}
            style={softInputStyle()}
          />

          <button onClick={clearFilters} style={actionBtn(true)}>
            Limpiar
          </button>
        </div>

        {loading ? (
          <div style={{ color: "#64748b", fontWeight: 800 }}>Cargando…</div>
        ) : pedidosFiltrados.length === 0 ? (
          <div style={{ color: "#64748b", fontWeight: 800 }}>No hay pedidos para los filtros seleccionados.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", minWidth: 1180 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={thStyle()}>ID</th>
                  <th style={thStyle()}>Tipo</th>
                  <th style={thStyle()}>Pedido</th>
                  <th style={thStyle()}>Caduca</th>
                  <th style={thStyle()}>Solicitante</th>
                  <th style={thStyle()}>Destino</th>
                  <th style={thStyle()}>Detalle</th>
                  <th style={thStyle()}>Estado</th>
                  <th style={thStyle()}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pedidosFiltrados.map((p) => {
                  const estado = p.estado || "RESERVA";
                  const canEditCancel = puedeEditarCancelar(p);
                  const expanded = !!expandedRows[p.id];

                  return (
                    <tr
                      key={p.id}
                      style={{
                        background: "white",
                        boxShadow: "0 6px 18px rgba(2,6,23,0.05)",
                      }}
                    >
                      <td
                        style={{
                          ...tdStyle(),
                          borderTop: "1px solid rgba(15,23,42,0.10)",
                          borderBottom: "1px solid rgba(15,23,42,0.10)",
                          borderLeft: "1px solid rgba(15,23,42,0.10)",
                          borderTopLeftRadius: 14,
                          borderBottomLeftRadius: 14,
                          whiteSpace: "nowrap",
                        }}
                      >
                        #{p.id}
                      </td>

                      <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 900,
                            background: (p.tipo === "reposicion") ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.10)",
                            color: (p.tipo === "reposicion") ? "#92400e" : "#1e3a8a",
                            border: "1px solid rgba(15,23,42,0.08)",
                          }}
                        >
                          {p.tipo === "reposicion" ? "Reposición" : "Salida"}
                        </span>
                      </td>

                      <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                        {fmtFechaES(p.created_at)}
                      </td>

                      <td
                        style={{
                          ...tdStyle(),
                          borderTop: "1px solid rgba(15,23,42,0.10)",
                          borderBottom: "1px solid rgba(15,23,42,0.10)",
                          color: "#b91c1c",
                          fontWeight: 900,
                        }}
                      >
                        {(() => {
                          const fc = getPedidoFechaCaducidad(p);
                          return fc ? fmtFechaES(fc) : <span style={{ color: "#94a3b8", fontWeight: 700 }}>—</span>;
                        })()}
                      </td>

                      <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                        {solicitanteFromPedido(p)}
                      </td>

                      <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)", minWidth: 240 }}>
                        {p?.tipo === "reposicion" ? (
                          <span style={{ fontWeight: 900, color: "#065f46" }}>Vivero</span>
                        ) : (
                          <DestinoResumen
                            distrito={p?.distrito_destino}
                            barrio={p?.barrio_destino}
                            direccion={p?.direccion_destino}
                          />
                        )}
                      </td>

                      <td
                        style={{
                          ...tdStyle(),
                          borderTop: "1px solid rgba(15,23,42,0.10)",
                          borderBottom: "1px solid rgba(15,23,42,0.10)",
                          minWidth: 380,
                        }}
                      >
                        <PedidoDetalleCellOld
                          pedido={p}
                          mapProdName={mapProdName}
                          expanded={expanded}
                          toggleExpanded={toggleExpanded}
                          editingId={editingId}
                          editQty={editQty}
                          setEditQty={setEditQty}
                          editSearch={editSearch}
                          setEditSearch={setEditSearch}
                          productosDisponiblesParaEdicion={productosDisponiblesParaEdicion}
                        />
                      </td>

                      <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)", whiteSpace: "nowrap" }}>
                        {(() => {
                          const e = estadoNormalizado(estado);
                          let color = "#92400e"; // reserva/default ámbar
                          if (e === "APROBADO") color = "#065f46";
                          else if (e === "DENEGADO") color = "#991b1b";
                          else if (e === "SERVIDO") color = "#1e3a8a";
                          else if (e === "CANCELADO") color = "#334155";
                          else if (e === "CADUCADO") color = "#475569";
                          return <span style={{ fontWeight: 900, color, fontSize: 13 }}>{estado}</span>;
                        })()}
                      </td>

                      <td
                        style={{
                          ...tdStyle(),
                          borderTop: "1px solid rgba(15,23,42,0.10)",
                          borderBottom: "1px solid rgba(15,23,42,0.10)",
                          borderRight: "1px solid rgba(15,23,42,0.10)",
                          borderTopRightRadius: 14,
                          borderBottomRightRadius: 14,
                          minWidth: 220,
                        }}
                      >
                        {canEditCancel ? (
                          editingId !== p.id ? (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {!isReadOnly && (
                                <button onClick={() => startEdit(p)} style={actionBtn(true)}>
                                  Editar
                                </button>
                              )}
                              {!isReadOnly && (
                                <button onClick={() => onCancelar(p)} style={dangerBtn(true)}>
                                  Cancelar
                                </button>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                onClick={() => onGuardarEdicion(p.id)}
                                style={primaryBtn(false)}
                              >
                                Guardar
                              </button>

                              <button onClick={stopEdit} style={actionBtn(true)}>
                                Cerrar
                              </button>
                            </div>
                          )
                        ) : (
                          <span style={{ color: "#94a3b8", fontWeight: 800 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PedidoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        productos={productos}
        stockByProductSize={stockByProductSize}
        onSubmit={handleCreatePedidoFromModal}
        saving={savingNewPedido}
      />
    </div>
  );
}