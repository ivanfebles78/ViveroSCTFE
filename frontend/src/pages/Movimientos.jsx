import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getMovimientos,
  getProductos,
  getPedidos,
  createMovimiento,
} from "../api/api";

const ZONAS = [
  "1", "2", "3a", "3b", "3c", "4a", "4b", "4c",
  "5", "6", "7", "8", "9a", "9b", "9c", "10a", "10b", "11",
];

const TAMANOS = ["Semillero", "M12", "M20", "M35"];

const ORIGENES = [
  "Empresa Externa",
  "Otro",
  "Vivero",
  "Palmetum",
  "Empresa",
  "Organismo oficial",
  "Colegio",
];

const DESTINOS_SALIDA_VIVERO = [
  "Empresa",
  "Organismo oficial",
  "Colegio",
  "Otro",
  "Palmetum",
  "Baja Vivero",
  "Vivero",
];

const TIPOS_MOVIMIENTO = [
  { value: "entrada", label: "Entrada" },
  { value: "salida", label: "Salida" },
  { value: "traslado_interno", label: "Traslado" },
  { value: "devolucion", label: "Devolución" },
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
  "La Salud-La Salle": [
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
    "Vista Bella",
  ],
  Suroeste: [
    "Acorán",
    "Añaza",
    "Barranco Grande",
    "Cuevas Blancas",
    "El Chorrillo",
    "El Sobradillo",
    "Llano del Moro",
    "Machado",
    "Radazul",
    "Santa María del Mar",
    "Tíncer",
  ],
};

const DESTINOS_EXTERNOS = ["Empresa", "Organismo oficial", "Colegio", "Otro", "Palmetum"];

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


function normalizeTamanoForStock(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "semillero") return "Semillero";
  if (raw == "m12") return "M12";
  if (raw == "m20") return "M20";
  if (raw == "m30") return "M35";
  return String(value || "").trim();
}

function buildStockKey(productoId, zona, tamano) {
  const normalizedTamano = normalizeTamanoForStock(tamano);
  if (!productoId || !zona || !normalizedTamano) return "";
  return `${productoId}__${String(zona).toLowerCase()}__${normalizedTamano}`;
}

function getProductDisplayName(p) {
  return p?.nombre_cientifico || p?.producto_nombre_cientifico || p?.nombre || p?.nombre_natural || `Producto #${p?.id || p?.producto_id || "—"}`;
}

function isExternalDestination(value) {
  return DESTINOS_EXTERNOS.includes(String(value || "").trim());
}

function isDevolucionOrigen(value) {
  return ["Empresa", "Organismo oficial", "Colegio", "Otro"].includes(String(value || "").trim());
}

function getMovimientoTipo(m) {
  const o = String(m?.origen_tipo || "").trim().toLowerCase();
  const d = String(m?.destino_tipo || "").trim().toLowerCase();

  if (o === "vivero" && d === "vivero") return "traslado_interno";

  if (
    d === "vivero" &&
    ["empresa", "organismo oficial", "colegio", "otro"].includes(o)
  ) {
    return "devolucion";
  }

  if (d === "vivero") return "entrada";

  return "salida";
}

function getTipoDisplayLabel(tipo) {
  const t = String(tipo || "").toLowerCase();
  if (t === "traslado_interno") return "Traslado";
  if (t === "entrada") return "Entrada";
  if (t === "salida") return "Salida";
  if (t === "devolucion") return "Devolución";
  return tipo || "—";
}

function tipoTextStyle(tipo) {
  const t = String(tipo || "").toLowerCase();

  if (t === "entrada") {
    return { fontWeight: 900, color: "#065f46" };
  }
  if (t === "salida") {
    return { fontWeight: 900, color: "#991b1b" };
  }
  if (t === "devolucion") {
    return { fontWeight: 900, color: "#92400e" };
  }
  return { fontWeight: 900, color: "#1e3a8a" };
}

function prestamoTextStyle(kind) {
  if (kind === "prestamo") return { fontWeight: 900, color: "#1e3a8a" };
  if (kind === "devolucion") return { fontWeight: 900, color: "#92400e" };
  return { fontWeight: 700, color: "#64748b" };
}

function getDestinoOptions(origenTipo) {
  if (!origenTipo) return [];

  if (origenTipo === "Empresa Externa") return ["Vivero"];
  if (origenTipo === "Otro") return ["Vivero"];
  if (origenTipo === "Palmetum") return ["Vivero"];
  if (origenTipo === "Empresa") return ["Vivero"];
  if (origenTipo === "Organismo oficial") return ["Vivero"];
  if (origenTipo === "Colegio") return ["Vivero"];

  if (origenTipo === "Vivero") {
    return DESTINOS_SALIDA_VIVERO;
  }

  return [];
}

function thStyle() {
  return {
    textAlign: "left",
    padding: "12px 10px",
    color: "#334155",
    fontWeight: 900,
    fontSize: 13,
    borderBottom: "1px solid rgba(15,23,42,0.10)",
  };
}

function tdStyle() {
  return {
    padding: "12px 10px",
    verticalAlign: "top",
    color: "#0f172a",
    fontWeight: 700,
  };
}

function buildLabelOrigen(m) {
  if (m?.origen_tipo === "Vivero") {
    return `Vivero${m?.zona_origen ? ` · Zona ${m.zona_origen}` : ""}${m?.tamano_origen ? ` · ${m.tamano_origen}` : ""}`;
  }
  return m?.origen_tipo || "—";
}

function buildLabelDestino(m) {
  if (m?.destino_tipo === "Vivero") {
    return `Vivero${m?.zona_destino ? ` · Zona ${m.zona_destino}` : ""}${m?.tamano_destino ? ` · ${m.tamano_destino}` : ""}`;
  }

  if (isExternalDestination(m?.destino_tipo)) {
    const parts = [m?.distrito_destino, m?.barrio_destino, m?.direccion_destino].filter(Boolean);
    return parts.length ? `${m.destino_tipo} · ${parts.join(" · ")}` : m.destino_tipo;
  }

  return m?.destino_tipo || "—";
}

function buildStockByProductZoneSize(movimientos) {
  const map = new Map();

  const add = (productoId, zona, tamano, delta) => {
    if (!productoId || !zona || !tamano) return;
    const key = `${productoId}__${String(zona).toLowerCase()}__${tamano}`;
    map.set(key, (map.get(key) || 0) + delta);
  };

  for (const m of safeArray(movimientos)) {
    const productoId = m?.producto_id;
    const cantidad = Number(m?.cantidad || 0);
    const origenTipo = String(m?.origen_tipo || "").trim().toLowerCase();
    const destinoTipo = String(m?.destino_tipo || "").trim().toLowerCase();

    if (!productoId || !cantidad) continue;

    if (destinoTipo === "vivero" && m?.zona_destino && m?.tamano_destino) {
      add(productoId, m.zona_destino, m.tamano_destino, cantidad);
    }

    if (origenTipo === "vivero" && m?.zona_origen && m?.tamano_origen) {
      add(productoId, m.zona_origen, m.tamano_origen, -cantidad);
    }
  }

  return map;
}

function getFormErrors(form) {
  const errs = [];

  if (!form.producto_id) errs.push("Debes seleccionar un producto.");
  if (!form.cantidad || Number(form.cantidad) <= 0) errs.push("La cantidad debe ser mayor que 0.");
  if (!form.origen_tipo) errs.push("Debes seleccionar un origen.");
  if (!form.destino_tipo) errs.push("Debes seleccionar un destino.");

  if (form.origen_tipo === form.destino_tipo && form.origen_tipo !== "Vivero") {
    errs.push("No se permite mover entre el mismo origen y destino salvo traslado interno en vivero.");
  }

  if (
    ["Empresa Externa", "Otro", "Palmetum", "Empresa", "Organismo oficial", "Colegio"].includes(form.origen_tipo) &&
    form.destino_tipo !== "Vivero"
  ) {
    errs.push(`${form.origen_tipo} solo puede mover hacia Vivero.`);
  }

  if (form.origen_tipo === "Vivero" && !form.zona_origen) {
    errs.push("Debes seleccionar una zona de origen del vivero.");
  }

  if (form.origen_tipo === "Vivero" && !form.tamano_origen) {
    errs.push("Debes seleccionar un tamaño de origen.");
  }

  if (form.destino_tipo === "Vivero" && !form.zona_destino) {
    errs.push("Debes seleccionar una zona de destino del vivero.");
  }

  if (form.destino_tipo === "Vivero" && !form.tamano_destino) {
    errs.push("Debes seleccionar un tamaño de destino.");
  }

  if (isExternalDestination(form.destino_tipo)) {
    if (!form.distrito_destino) errs.push("Debes seleccionar un distrito.");
    if (!form.barrio_destino) errs.push("Debes seleccionar un barrio.");
    if (!form.direccion_destino) errs.push("Debes indicar una dirección.");
  }

  if (
    form.origen_tipo === "Vivero" &&
    form.destino_tipo === "Vivero" &&
    form.zona_origen &&
    form.zona_destino &&
    form.zona_origen === form.zona_destino &&
    form.tamano_origen === form.tamano_destino
  ) {
    errs.push("El traslado interno debe cambiar de zona o de tamaño.");
  }

  if (form.fecha_disponibilidad) {
    if (form.destino_tipo !== "Vivero" || form.tamano_destino !== "M35") {
      errs.push("La fecha de disponibilidad solo aplica a movimientos a Vivero con tamaño M35.");
    } else {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const f = new Date(`${form.fecha_disponibilidad}T00:00:00`);
      if (Number.isNaN(f.getTime()) || f <= hoy) {
        errs.push("La fecha de disponibilidad debe ser futura.");
      }
    }
  }

  return errs;
}

function inputStyle() {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    outline: "none",
    fontWeight: 700,
    color: "#0f172a",
    background: "#fff",
    boxSizing: "border-box",
  };
}

function closeButtonStyle() {
  return {
    padding: "10px 16px",
    borderRadius: 14,
    fontWeight: 900,
    cursor: "pointer",
    transition: "all 0.18s ease",
    background: "#f59e0b",
    color: "#111827",
    border: "2px solid #000000",
    boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
  };
}

function cancelButtonStyle(disabled = false) {
  return {
    padding: "10px 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: disabled ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
    color: "white",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
  };
}

function MessageBanner({ msg, onClose, isError }) {
  if (!msg) return null;

  return (
    <div
      style={{
        marginTop: 12,
        padding: "12px 14px",
        borderRadius: 14,
        border: isError
          ? "1px solid rgba(239,68,68,0.20)"
          : "1px solid rgba(16,185,129,0.22)",
        background: isError
          ? "rgba(239,68,68,0.08)"
          : "rgba(16,185,129,0.10)",
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
        aria-label="Cerrar mensaje"
        title="Cerrar"
      >
        ×
      </button>
    </div>
  );
}

function PedidoSelectorModal({ open, pedidos, onClose, onSelect }) {
  const [texto, setTexto] = useState("");

  const pedidosFiltrados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return safeArray(pedidos)
      .filter((p) => String(p?.estado || "").toUpperCase() === "APROBADO")
      .filter((p) => {
        if (!t) return true;
        const base = [
          p?.id,
          p?.solicitante_username,
          p?.distrito_destino,
          p?.barrio_destino,
          p?.direccion_destino,
          ...(safeArray(p?.items).map((it) => `${it?.producto_nombre || ""} ${it?.tamano || ""} ${it?.cantidad || ""}`)),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return base.includes(t);
      });
  }, [pedidos, texto]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.45)",
        backdropFilter: "blur(3px)",
        zIndex: 1300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(980px, 95vw)",
          maxHeight: "88vh",
          overflow: "hidden",
          background: "white",
          borderRadius: 24,
          boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
          border: "1px solid rgba(15,23,42,0.10)",
          display: "grid",
          gridTemplateRows: "auto auto 1fr",
        }}
      >
        <div
          style={{
            padding: "20px 22px 10px",
            display: "flex",
            alignItems: "start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>
              Pedidos aprobados
            </div>
            <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
              Selecciona un pedido aprobado para cargar sus productos y su destino.
            </div>
          </div>

          <button onClick={onClose} style={closeButtonStyle()}>
            Cerrar
          </button>
        </div>

        <div style={{ padding: "0 22px 14px" }}>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por ID, solicitante, nombre científico, dirección..."
            style={inputStyle()}
          />
        </div>

        <div style={{ padding: "0 22px 22px", overflow: "auto" }}>
          {pedidosFiltrados.length === 0 ? (
            <div
              style={{
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 16,
                padding: 18,
                color: "#64748b",
                fontWeight: 800,
              }}
            >
              No hay pedidos aprobados que coincidan con la búsqueda.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {pedidosFiltrados.map((p) => (
                <div
                  key={p.id}
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 18,
                    padding: 16,
                    background: "#fbfdff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
                        Pedido #{p.id}
                      </div>
                      <div style={{ marginTop: 4, color: "#64748b", fontWeight: 700 }}>
                        {fmtFechaES(p.created_at)} · Solicitante: {p.solicitante_username || "—"}
                      </div>
                    </div>

                    <button
                      onClick={() => onSelect(p)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 14,
                        border: "1px solid rgba(16,185,129,0.35)",
                        background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
                        color: "white",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Usar pedido
                    </button>
                  </div>

                  <div style={{ marginTop: 10, color: "#475569", fontWeight: 700 }}>
                    Tipo: <span style={{ color: p.tipo === "reposicion" ? "#92400e" : "#1e3a8a", fontWeight: 900 }}>
                      {p.tipo === "reposicion" ? "Reposición" : "Salida"}
                    </span>
                  </div>
                  <div style={{ marginTop: 6, color: "#475569", fontWeight: 700 }}>
                    Destino: {p.tipo === "reposicion"
                      ? "Vivero"
                      : ([p.distrito_destino, p.barrio_destino, p.direccion_destino].filter(Boolean).join(" · ") || "—")}
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                    {safeArray(p.items).map((it, idx) => (
                      <div
                        key={`${p.id}-${idx}`}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "white",
                          border: "1px solid rgba(15,23,42,0.06)",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ fontWeight: 800, color: "#0f172a" }}>
                          {it.producto_nombre || `Producto #${it.producto_id}`}
                        </div>
                        <div style={{ color: "#64748b", fontWeight: 800 }}>
                          Tamaño: {it.tamano || "—"} · Cantidad: {it.cantidad || 0}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MovimientoModal({
  open,
  onClose,
  productos,
  movimientos,
  pedidosAprobados,
  onSubmit,
  saving,
}) {
  const [form, setForm] = useState({
    pedido_id: "",
    pedido_item_id: "",
    producto_id: "",
    cantidad: "",
    origen_tipo: "",
    destino_tipo: "",
    zona_origen: "",
    zona_destino: "",
    tamano_origen: "",
    tamano_destino: "",
    distrito_destino: "",
    barrio_destino: "",
    direccion_destino: "",
    cp_destino: "",
    observaciones: "",
    prestamo: false,
    fecha_disponibilidad: "",
    prestamo_referencia_id: null,
  });

  const [errors, setErrors] = useState([]);
  const [showPedidoModal, setShowPedidoModal] = useState(false);
  const [selectedPedidoLineKey, setSelectedPedidoLineKey] = useState("");
  const [showPrestamoModal, setShowPrestamoModal] = useState(false);
  // Distribución origen por zona { zona: cantidad } — se usa cuando origen=Vivero
  const [distribucion, setDistribucion] = useState({});
  // Lote de payloads acumulados (para procesar varias líneas de un pedido en un solo submit)
  const [batchPayloads, setBatchPayloads] = useState([]);

  useEffect(() => {
    if (!open) {
      setForm({
        pedido_id: "",
        pedido_item_id: "",
        producto_id: "",
        cantidad: "",
        origen_tipo: "",
        destino_tipo: "",
        zona_origen: "",
        zona_destino: "",
        tamano_origen: "",
        tamano_destino: "",
        distrito_destino: "",
        barrio_destino: "",
        direccion_destino: "",
        cp_destino: "",
        observaciones: "",
        prestamo: false,
        fecha_disponibilidad: "",
        prestamo_referencia_id: null,
      });
      setErrors([]);
      setSelectedPedidoLineKey("");
      setShowPedidoModal(false);
      setShowPrestamoModal(false);
      setDistribucion({});
      setBatchPayloads([]);
    }
  }, [open]);

  useEffect(() => {
    const allowed = getDestinoOptions(form.origen_tipo);
    if (form.origen_tipo && !allowed.includes(form.destino_tipo)) {
      setForm((prev) => ({
        ...prev,
        destino_tipo: allowed[0] || "",
        zona_destino: "",
        tamano_destino: "",
        distrito_destino: "",
        barrio_destino: "",
        direccion_destino: "",
        cp_destino: "",
        prestamo: false,
      }));
    }
  }, [form.origen_tipo, form.destino_tipo]);

  const allowedDestinos = getDestinoOptions(form.origen_tipo);

  const selectedPedido = useMemo(() => {
    return safeArray(pedidosAprobados).find((p) => String(p.id) === String(form.pedido_id)) || null;
  }, [pedidosAprobados, form.pedido_id]);

  const stockByProductZoneSize = useMemo(() => {
    return buildStockByProductZoneSize(movimientos);
  }, [movimientos]);

  const barriosDisponibles = useMemo(() => {
    return form.distrito_destino ? DISTRITO_BARRIOS[form.distrito_destino] || [] : [];
  }, [form.distrito_destino]);

  const movimientosPreviosPorPedido = useMemo(() => {
    const map = new Map();

    for (const mov of safeArray(movimientos)) {
      const pedidoId = mov?.pedido_id;
      const productoId = mov?.producto_id;
      const tamano = mov?.tamano_origen || mov?.tamano_destino || "";
      const pedidoItemId = mov?.pedido_item_id;

      if (!pedidoId || !productoId) continue;

      if (pedidoItemId) {
        const keyByItem = `item__${pedidoItemId}`;
        map.set(keyByItem, (map.get(keyByItem) || 0) + Number(mov?.cantidad || 0));
      }

      const keyFallback = `pedido__${pedidoId}__prod__${productoId}__tam__${tamano}`;
      map.set(keyFallback, (map.get(keyFallback) || 0) + Number(mov?.cantidad || 0));
    }

    return map;
  }, [movimientos]);

  const pedidoLineas = useMemo(() => {
    return safeArray(selectedPedido?.items).map((it, idx) => {
      const byItemKey = it?.id ? `item__${it.id}` : null;
      const fallbackKey = `pedido__${selectedPedido?.id || ""}__prod__${it?.producto_id || ""}__tam__${it?.tamano || ""}`;

      const cantidadMovida =
        (byItemKey ? Number(movimientosPreviosPorPedido.get(byItemKey) || 0) : 0) ||
        Number(movimientosPreviosPorPedido.get(fallbackKey) || 0);

      const yaUsada = cantidadMovida > 0;

      return {
        ...it,
        _key: `${selectedPedido?.id || "pedido"}-${it?.producto_id || "prod"}-${it?.tamano || "tam"}-${idx}`,
        _cantidad_movida: cantidadMovida,
        _disabled: yaUsada,
      };
    });
  }, [selectedPedido, movimientosPreviosPorPedido]);

  const selectedProducto = productos.find((p) => String(p.id) === String(form.producto_id));

  const availableOriginZones = useMemo(() => {
    if (form.origen_tipo !== "Vivero" || !form.producto_id) return ZONAS;

    return ZONAS.filter((zona) => {
      if (form.tamano_origen) {
        const key = buildStockKey(form.producto_id, zona, form.tamano_origen);
        return Number(stockByProductZoneSize.get(key) || 0) > 0;
      }

      return TAMANOS.some((tamano) => {
        const key = buildStockKey(form.producto_id, zona, tamano);
        return Number(stockByProductZoneSize.get(key) || 0) > 0;
      });
    });
  }, [form.origen_tipo, form.producto_id, form.tamano_origen, stockByProductZoneSize]);

  const availableOriginSizes = useMemo(() => {
    if (form.origen_tipo !== "Vivero" || !form.producto_id) return TAMANOS;

    // Si hay zona seleccionada, filtra tamaños con stock en esa zona concreta.
    // Si no, muestra tamaños con stock en CUALQUIER zona (para el picker multi-zona).
    return TAMANOS.filter((tamano) => {
      if (form.zona_origen) {
        const key = buildStockKey(form.producto_id, form.zona_origen, tamano);
        return Number(stockByProductZoneSize.get(key) || 0) > 0;
      }
      return ZONAS.some((z) => Number(stockByProductZoneSize.get(buildStockKey(form.producto_id, z, tamano)) || 0) > 0);
    });
  }, [form.origen_tipo, form.producto_id, form.zona_origen, stockByProductZoneSize]);

  useEffect(() => {
    if (
      form.origen_tipo === "Vivero" &&
      form.zona_origen &&
      !availableOriginZones.includes(form.zona_origen)
    ) {
      setForm((prev) => ({
        ...prev,
        zona_origen: "",
        tamano_origen: "",
      }));
    }
  }, [form.origen_tipo, form.zona_origen, availableOriginZones]);

  useEffect(() => {
    if (
      form.origen_tipo === "Vivero" &&
      form.tamano_origen &&
      !availableOriginSizes.includes(form.tamano_origen)
    ) {
      setForm((prev) => ({
        ...prev,
        tamano_origen: "",
      }));
    }
  }, [form.origen_tipo, form.tamano_origen, availableOriginSizes]);

  const esDevolucion = useMemo(() => {
    return form.destino_tipo === "Vivero" && isDevolucionOrigen(form.origen_tipo);
  }, [form.origen_tipo, form.destino_tipo]);

  // Activa el picker por zonas cuando origen=Vivero + producto + tamaño elegidos
  const distribucionActiva =
    form.origen_tipo === "Vivero" && !!form.producto_id && !!form.tamano_origen;

  // Mapa { zona: cantidadDisponible } para el producto y tamaño seleccionados
  const distribucionDisponible = useMemo(() => {
    if (!distribucionActiva) return {};
    const out = {};
    for (const z of ZONAS) {
      const key = buildStockKey(form.producto_id, z, form.tamano_origen);
      const qty = Number(stockByProductZoneSize.get(key) || 0);
      if (qty > 0) out[z] = qty;
    }
    return out;
  }, [distribucionActiva, form.producto_id, form.tamano_origen, stockByProductZoneSize]);

  const totalDistribucion = useMemo(
    () => Object.values(distribucion).reduce((a, b) => a + Number(b || 0), 0),
    [distribucion]
  );

  // Reset distribución cuando cambia producto, tamaño o se sale de modo Vivero
  useEffect(() => {
    setDistribucion({});
  }, [form.producto_id, form.tamano_origen, form.origen_tipo]);

  const tipoPreview = useMemo(() => {
    return getMovimientoTipo(form);
  }, [form]);

  const prestamosActivos = useMemo(() => {
    const arr = safeArray(movimientos);
    const devolucionesPorRef = new Map();
    for (const m of arr) {
      if (m?.es_devolucion && m?.prestamo_referencia_id) {
        const k = Number(m.prestamo_referencia_id);
        devolucionesPorRef.set(k, (devolucionesPorRef.get(k) || 0) + Number(m.cantidad || 0));
      }
    }

    return arr
      .filter((m) => !!m?.es_prestamo)
      .map((m) => {
        const devuelto = Number(devolucionesPorRef.get(Number(m.id)) || 0);
        const prestado = Number(m.cantidad || 0);
        const pendiente = Math.max(prestado - devuelto, 0);
        return {
          ...m,
          _prestado: prestado,
          _devuelto: devuelto,
          _pendiente: pendiente,
        };
      })
      .filter((m) => m._pendiente > 0)
      .sort((a, b) => new Date(b.fecha_movimiento || 0) - new Date(a.fecha_movimiento || 0));
  }, [movimientos]);

  const handleSeleccionPrestamo = (prestamo) => {
    const origenSugerido = prestamo?.destino_tipo || "Empresa";
    const tamanoOriginal = prestamo?.tamano_origen || prestamo?.tamano_destino || "";
    const destinoInfo = [
      prestamo?.distrito_destino,
      prestamo?.barrio_destino,
      prestamo?.direccion_destino,
    ]
      .filter(Boolean)
      .join(" · ");

    const notaBase = `Devolución del préstamo #${prestamo.id}${
      destinoInfo ? ` (${destinoInfo})` : ""
    }`;

    setForm((prev) => ({
      ...prev,
      pedido_id: prestamo?.pedido_id ? String(prestamo.pedido_id) : "",
      pedido_item_id: "",
      producto_id: String(prestamo.producto_id),
      cantidad: String(prestamo._pendiente),
      origen_tipo: origenSugerido,
      destino_tipo: "Vivero",
      zona_origen: "",
      tamano_origen: "",
      zona_destino: "",
      tamano_destino: tamanoOriginal,
      distrito_destino: "",
      barrio_destino: "",
      direccion_destino: "",
      cp_destino: "",
      observaciones: prev.observaciones || notaBase,
      prestamo: false,
      fecha_disponibilidad: "",
      prestamo_referencia_id: prestamo.id,
    }));
    setErrors([]);
    setShowPrestamoModal(false);
  };

  const handleSeleccionPedido = (pedido) => {
    const esReposicion = (pedido?.tipo || "salida") === "reposicion";
    const destinoSugerido = esReposicion
      ? "Vivero"
      : (DESTINOS_EXTERNOS.includes("Empresa") ? "Empresa" : "Otro");
    const origenSugerido = esReposicion ? "Empresa Externa" : "Vivero";

    setForm((prev) => ({
      ...prev,
      pedido_id: String(pedido.id),
      pedido_item_id: "",
      producto_id: "",
      cantidad: "",
      origen_tipo: origenSugerido,
      destino_tipo: destinoSugerido,
      zona_origen: "",
      zona_destino: "",
      tamano_origen: "",
      tamano_destino: "",
      distrito_destino: esReposicion ? "" : (pedido.distrito_destino || ""),
      barrio_destino: esReposicion ? "" : (pedido.barrio_destino || ""),
      direccion_destino: esReposicion ? "" : (pedido.direccion_destino || ""),
      cp_destino: "",
      observaciones: prev.observaciones || `Movimiento asociado al pedido #${pedido.id}`,
      prestamo: false,
    }));
    setSelectedPedidoLineKey("");
    setShowPedidoModal(false);
  };

  const usarLineaPedido = (linea) => {
    if (linea._disabled) return;

    const esReposicion = (selectedPedido?.tipo || "salida") === "reposicion";

    if (esReposicion) {
      setSelectedPedidoLineKey(linea._key);
      setForm((prev) => ({
        ...prev,
        pedido_item_id: String(linea.id || ""),
        producto_id: String(linea.producto_id),
        cantidad: String(linea.cantidad || ""),
        origen_tipo: "Empresa Externa",
        destino_tipo: "Vivero",
        tamano_origen: "",
        zona_origen: "",
        tamano_destino: linea.tamano || "",
        zona_destino: prev.zona_destino || "",
        distrito_destino: "",
        barrio_destino: "",
        direccion_destino: "",
        observaciones: prev.observaciones || `Movimiento asociado al pedido #${selectedPedido?.id || ""}`,
        prestamo: false,
      }));
      setErrors([]);
      return;
    }

    const destinoSugerido =
      DESTINOS_EXTERNOS.includes(form.destino_tipo) ? form.destino_tipo : "Empresa";

    setSelectedPedidoLineKey(linea._key);
    setForm((prev) => ({
      ...prev,
      pedido_item_id: String(linea.id || ""),
      producto_id: String(linea.producto_id),
      cantidad: String(linea.cantidad || ""),
      origen_tipo: "Vivero",
      destino_tipo: destinoSugerido,
      tamano_origen: linea.tamano || "",
      zona_origen: prev.zona_origen || "",
      zona_destino: "",
      tamano_destino: "",
      distrito_destino: selectedPedido?.distrito_destino || prev.distrito_destino || "",
      barrio_destino: selectedPedido?.barrio_destino || prev.barrio_destino || "",
      direccion_destino: selectedPedido?.direccion_destino || prev.direccion_destino || "",
      observaciones: prev.observaciones || `Movimiento asociado al pedido #${selectedPedido?.id || ""}`,
      prestamo: prev.prestamo || false,
    }));
    setErrors([]);
  };

  // Devuelve { ok, payloads, errors } sin mutar estado
  const buildCurrentPayloads = () => {
    const foundErrors = getFormErrors(form);
    let filtered = foundErrors;

    if (distribucionActiva) {
      filtered = filtered.filter(
        (e) =>
          !e.toLowerCase().includes("zona de origen") &&
          !e.toLowerCase().includes("cantidad debe ser mayor")
      );
      const zonasElegidas = Object.entries(distribucion).filter(([, q]) => Number(q) > 0);
      if (zonasElegidas.length === 0) {
        filtered.push("Indica al menos una zona con cantidad > 0 en la distribución.");
      }
      for (const [z, q] of zonasElegidas) {
        const disp = Number(distribucionDisponible[z] || 0);
        if (Number(q) > disp) {
          filtered.push(`Zona ${z}: solicitado ${q} supera el disponible (${disp}).`);
        }
      }
    }

    if (filtered.length > 0) {
      return { ok: false, payloads: [], errors: filtered };
    }

    const basePayload = {
      pedido_id: form.pedido_id ? Number(form.pedido_id) : null,
      pedido_item_id: form.pedido_item_id ? Number(form.pedido_item_id) : null,
      producto_id: Number(form.producto_id),
      origen_tipo: form.origen_tipo,
      destino_tipo: form.destino_tipo,
      tamano_origen: form.origen_tipo === "Vivero" ? form.tamano_origen || null : null,
      tamano_destino: form.destino_tipo === "Vivero" ? form.tamano_destino || null : null,
      zona_destino: form.destino_tipo === "Vivero" ? form.zona_destino || null : null,
      distrito_destino: isExternalDestination(form.destino_tipo) ? form.distrito_destino || null : null,
      barrio_destino: isExternalDestination(form.destino_tipo) ? form.barrio_destino || null : null,
      direccion_destino: isExternalDestination(form.destino_tipo) ? form.direccion_destino || null : null,
      cp_destino: isExternalDestination(form.destino_tipo) ? form.cp_destino || null : null,
      observaciones: form.observaciones || null,
      nota: form.observaciones || null,
      es_prestamo: form.origen_tipo === "Vivero" && isExternalDestination(form.destino_tipo) ? !!form.prestamo : false,
      es_devolucion: esDevolucion,
      prestamo_referencia_id: esDevolucion && form.prestamo_referencia_id ? Number(form.prestamo_referencia_id) : null,
      fecha_disponibilidad:
        form.destino_tipo === "Vivero" && form.tamano_destino === "M35" && form.fecha_disponibilidad
          ? form.fecha_disponibilidad
          : null,
    };

    let payloads;
    if (distribucionActiva) {
      payloads = Object.entries(distribucion)
        .filter(([, q]) => Number(q) > 0)
        .map(([zona, q]) => ({
          ...basePayload,
          zona_origen: zona,
          cantidad: Number(q),
        }));
    } else {
      payloads = [
        {
          ...basePayload,
          zona_origen: form.origen_tipo === "Vivero" ? form.zona_origen || null : null,
          cantidad: Number(form.cantidad),
        },
      ];
    }

    return { ok: true, payloads, errors: [] };
  };

  // Devuelve true si el formulario parece "vacío" (el usuario no ha configurado línea actual)
  const formTieneLineaActual = () => {
    if (!form.producto_id) return false;
    if (distribucionActiva) {
      return Object.values(distribucion).some((q) => Number(q) > 0);
    }
    return Number(form.cantidad) > 0;
  };

  // Añade la línea actual al lote y resetea campos de línea (mantiene pedido_id y destino)
  const addCurrentToBatch = () => {
    const result = buildCurrentPayloads();
    setErrors(result.errors);
    if (!result.ok) return;

    setBatchPayloads((prev) => [...prev, ...result.payloads]);

    // Reset de campos de línea, conservando contexto del pedido y destino general
    setForm((prev) => ({
      ...prev,
      pedido_item_id: "",
      producto_id: "",
      cantidad: "",
      tamano_origen: "",
      tamano_destino: prev.destino_tipo === "Vivero" ? "" : prev.tamano_destino,
      zona_origen: "",
      zona_destino: prev.destino_tipo === "Vivero" ? "" : prev.zona_destino,
      fecha_disponibilidad: "",
    }));
    setDistribucion({});
    setSelectedPedidoLineKey("");
  };

  const removeBatchItem = (idx) => {
    setBatchPayloads((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearBatch = () => {
    setBatchPayloads([]);
  };

  const submit = async () => {
    const currentIsFilled = formTieneLineaActual();

    // Si ni el lote tiene nada ni la línea actual está rellena → error
    if (!currentIsFilled && batchPayloads.length === 0) {
      setErrors(["No hay líneas que guardar. Rellena la línea actual o añade al lote."]);
      return;
    }

    let allPayloads = [...batchPayloads];

    if (currentIsFilled) {
      const result = buildCurrentPayloads();
      setErrors(result.errors);
      if (!result.ok) return;
      allPayloads = [...allPayloads, ...result.payloads];
    } else {
      setErrors([]);
    }

    await onSubmit(allPayloads);
  };

  if (!open) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,6,23,0.52)",
          backdropFilter: "blur(4px)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "min(1280px, 96vw)",
            height: "min(92vh, 920px)",
            background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
            border: "1px solid rgba(255,255,255,0.4)",
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
          }}
        >
          <div
            style={{
              padding: 24,
              borderRight: "1px solid rgba(15,23,42,0.08)",
              overflow: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>Nuevo movimiento</div>
                <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
                  Registra entradas, salidas, préstamos, devoluciones o traslados internos.
                </div>
              </div>

              <button onClick={onClose} style={closeButtonStyle()}>
                Cerrar
              </button>
            </div>

            {errors.length > 0 ? (
              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 16,
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.18)",
                  color: "#991b1b",
                  fontWeight: 800,
                }}
              >
                {errors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            ) : null}

            <div
              style={{
                marginTop: 18,
                padding: 16,
                borderRadius: 18,
                background: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(15,23,42,0.08)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 18 }}>Pedido aprobado</div>
                  <div style={{ marginTop: 4, color: "#64748b", fontWeight: 700 }}>
                    Selecciona un pedido aprobado para precargar producto y destino.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPedidoModal(true)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 14,
                    border: "1px solid rgba(59,130,246,0.20)",
                    background: "rgba(59,130,246,0.08)",
                    color: "#1d4ed8",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Ver pedidos aprobados
                </button>
              </div>

              {selectedPedido ? (
                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 14,
                    background: "#f8fbff",
                    border: "1px solid rgba(15,23,42,0.08)",
                  }}
                >
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>
                    Pedido #{selectedPedido.id}
                    <span style={{ marginLeft: 10, fontSize: 12, color: selectedPedido.tipo === "reposicion" ? "#92400e" : "#1e3a8a" }}>
                      ({selectedPedido.tipo === "reposicion" ? "Reposición" : "Salida"})
                    </span>
                  </div>
                  <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
                    Destino: {selectedPedido.tipo === "reposicion"
                      ? "Vivero"
                      : ([selectedPedido.distrito_destino, selectedPedido.barrio_destino, selectedPedido.direccion_destino].filter(Boolean).join(" · ") || "—")}
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {pedidoLineas.map((linea) => {
                      const active = selectedPedidoLineKey === linea._key;
                      const disabled = !!linea._disabled;

                      return (
                        <div
                          key={linea._key}
                          style={{
                            padding: 12,
                            borderRadius: 14,
                            border: disabled
                              ? "1px solid rgba(148,163,184,0.18)"
                              : active
                              ? "1px solid rgba(6,182,212,0.30)"
                              : "1px solid rgba(15,23,42,0.08)",
                            background: disabled
                              ? "rgba(148,163,184,0.08)"
                              : active
                              ? "rgba(6,182,212,0.08)"
                              : "white",
                            display: "flex",
                            gap: 12,
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            opacity: disabled ? 0.65 : 1,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 900, color: "#0f172a" }}>
                              {linea.producto_nombre || `Producto #${linea.producto_id}`}
                            </div>
                            <div style={{ marginTop: 4, color: "#64748b", fontWeight: 700 }}>
                              Tamaño: {linea.tamano || "—"} · Cantidad: {linea.cantidad || 0}
                              {disabled ? ` · Ya movida: ${linea._cantidad_movida}` : ""}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => usarLineaPedido(linea)}
                            disabled={disabled}
                            style={{
                              padding: "9px 12px",
                              borderRadius: 12,
                              border: disabled
                                ? "1px solid rgba(148,163,184,0.18)"
                                : "1px solid rgba(16,185,129,0.20)",
                              background: disabled
                                ? "rgba(148,163,184,0.16)"
                                : "rgba(16,185,129,0.10)",
                              color: disabled ? "#64748b" : "#065f46",
                              fontWeight: 900,
                              cursor: disabled ? "not-allowed" : "pointer",
                            }}
                          >
                            {disabled ? "Ya usada" : "Usar esta línea"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 14, color: "#64748b", fontWeight: 800 }}>
                  Aún no has seleccionado ningún pedido.
                </div>
              )}
            </div>

            {prestamosActivos.length > 0 ? (
              <div
                style={{
                  marginTop: 14,
                  padding: 16,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.92)",
                  border: "1px solid rgba(245,158,11,0.30)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 18 }}>
                      Préstamos activos ({prestamosActivos.length})
                    </div>
                    <div style={{ marginTop: 4, color: "#64748b", fontWeight: 700 }}>
                      Hay préstamos pendientes de devolución. Puedes seleccionar uno para crear el movimiento de devolución.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPrestamoModal(true)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 14,
                      border: "1px solid rgba(245,158,11,0.35)",
                      background: "rgba(245,158,11,0.10)",
                      color: "#92400e",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Ver préstamos activos
                  </button>
                </div>

                {form.prestamo_referencia_id ? (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 12,
                      borderRadius: 14,
                      background: "#fffbeb",
                      border: "1px solid rgba(245,158,11,0.25)",
                      color: "#92400e",
                      fontWeight: 800,
                    }}
                  >
                    Devolución asociada al préstamo #{form.prestamo_referencia_id}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div
              style={{
                marginTop: 18,
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                  Origen
                </div>
                <select
                  value={form.origen_tipo}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      origen_tipo: e.target.value,
                      destino_tipo: "",
                      zona_origen: "",
                      tamano_origen: "",
                      zona_destino: "",
                      tamano_destino: "",
                      distrito_destino: "",
                      barrio_destino: "",
                      direccion_destino: "",
                      cp_destino: "",
                      prestamo: false,
                    }))
                  }
                  style={inputStyle()}
                >
                  <option value="">Seleccionar origen</option>
                  {ORIGENES.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                  Destino
                </div>
                <select
                  value={form.destino_tipo}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      destino_tipo: e.target.value,
                      zona_destino: "",
                      tamano_destino: "",
                      distrito_destino: "",
                      barrio_destino: "",
                      direccion_destino: "",
                      cp_destino: "",
                      prestamo: false,
                    }))
                  }
                  style={inputStyle()}
                  disabled={!form.origen_tipo}
                >
                  <option value="">Seleccionar destino</option>
                  {allowedDestinos.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                  Producto
                </div>
                <select
                  value={form.producto_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, producto_id: e.target.value }))}
                  style={inputStyle()}
                >
                  <option value="">Seleccionar producto</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getProductDisplayName(p)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cantidad: input libre cuando NO hay picker; total calculado cuando SÍ */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                  Cantidad {distribucionActiva ? "(calculada)" : ""}
                </div>
                {distribucionActiva ? (
                  <div
                    style={{
                      ...inputStyle(),
                      background: "#f1f5f9",
                      color: "#0f172a",
                      fontWeight: 900,
                    }}
                  >
                    {totalDistribucion} {totalDistribucion === 1 ? "unidad" : "unidades"}
                  </div>
                ) : (
                  <input
                    type="number"
                    min={1}
                    value={form.cantidad}
                    onChange={(e) => setForm((prev) => ({ ...prev, cantidad: e.target.value }))}
                    style={inputStyle()}
                    placeholder="0"
                  />
                )}
              </div>

              {form.origen_tipo === "Vivero" ? (
                <>
                  {/* Tamaño origen siempre visible */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                      Tamaño origen
                    </div>
                    <select
                      value={form.tamano_origen}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, tamano_origen: e.target.value, zona_origen: "" }))
                      }
                      style={inputStyle()}
                      disabled={!form.producto_id || availableOriginSizes.length === 0}
                    >
                      <option value="">
                        {!form.producto_id
                          ? "Primero selecciona un producto"
                          : availableOriginSizes.length === 0
                          ? "No hay tamaños disponibles"
                          : "Seleccionar tamaño"}
                      </option>
                      {availableOriginSizes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Zona origen SOLO se muestra si no está el picker */}
                  {!distribucionActiva ? (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                        Zona origen
                      </div>
                      <select
                        value={form.zona_origen}
                        onChange={(e) => setForm((prev) => ({ ...prev, zona_origen: e.target.value }))}
                        style={inputStyle()}
                        disabled={!form.producto_id || availableOriginZones.length === 0}
                      >
                        <option value="">
                          {!form.producto_id
                            ? "Primero selecciona un producto"
                            : availableOriginZones.length === 0
                            ? "No hay zonas con stock para este producto"
                            : "Seleccionar zona"}
                        </option>
                        {availableOriginZones.map((z) => (
                          <option key={z} value={z}>
                            {z}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </>
              ) : null}

              {/* PICKER multi-zona: solo cuando origen=Vivero + producto + tamaño */}
              {distribucionActiva ? (
                <div style={{ gridColumn: "span 2" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                    Distribución en el vivero — {form.tamano_origen}
                  </div>
                  <div
                    style={{
                      border: "1px solid rgba(15,23,42,0.10)",
                      borderRadius: 14,
                      background: "#fbfdff",
                      padding: 12,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    {Object.keys(distribucionDisponible).length === 0 ? (
                      <div style={{ color: "#64748b", fontWeight: 700 }}>
                        No hay stock de este producto en tamaño {form.tamano_origen}.
                      </div>
                    ) : (
                      Object.entries(distribucionDisponible).map(([zona, disp]) => {
                        const valor = distribucion[zona] ?? "";
                        const invalid = Number(valor) > disp;
                        return (
                          <div
                            key={zona}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "100px 1fr 110px",
                              gap: 10,
                              alignItems: "center",
                              padding: "8px 10px",
                              borderRadius: 10,
                              background: "white",
                              border: invalid
                                ? "1px solid rgba(239,68,68,0.30)"
                                : "1px solid rgba(15,23,42,0.06)",
                            }}
                          >
                            <div style={{ fontWeight: 900, color: "#0f172a" }}>Zona {zona}</div>
                            <div style={{ color: "#334155", fontWeight: 700 }}>
                              Disponible: <span style={{ color: "#0f172a", fontWeight: 900 }}>{disp}</span>
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={disp}
                              value={valor}
                              onChange={(e) => {
                                const v = e.target.value;
                                setDistribucion((prev) => {
                                  const nx = { ...prev };
                                  if (v === "" || Number(v) <= 0) delete nx[zona];
                                  else nx[zona] = Math.min(Number(v), disp);
                                  return nx;
                                });
                              }}
                              placeholder="0"
                              style={{
                                padding: "8px 10px",
                                borderRadius: 10,
                                border: "1px solid rgba(15,23,42,0.12)",
                                fontWeight: 900,
                                textAlign: "center",
                                color: "#0f172a",
                              }}
                            />
                          </div>
                        );
                      })
                    )}
                    <div
                      style={{
                        marginTop: 4,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 4px",
                        borderTop: "1px dashed rgba(15,23,42,0.10)",
                      }}
                    >
                      <span style={{ color: "#64748b", fontWeight: 700 }}>
                        {Object.keys(distribucion).filter((k) => Number(distribucion[k]) > 0).length} zona(s) seleccionada(s)
                      </span>
                      <span style={{ color: "#0f172a", fontWeight: 900 }}>Total: {totalDistribucion}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 6, color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                    Si eliges varias zonas, se creará un movimiento por cada una.
                  </div>
                </div>
              ) : null}

              {form.destino_tipo === "Vivero" ? (
                <>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                      Zona destino
                    </div>
                    <select
                      value={form.zona_destino}
                      onChange={(e) => setForm((prev) => ({ ...prev, zona_destino: e.target.value }))}
                      style={inputStyle()}
                    >
                      <option value="">Seleccionar zona</option>
                      {ZONAS.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                      Tamaño destino
                    </div>
                    <select
                      value={form.tamano_destino}
                      onChange={(e) => setForm((prev) => ({ ...prev, tamano_destino: e.target.value }))}
                      style={inputStyle()}
                    >
                      <option value="">Seleccionar tamaño</option>
                      {TAMANOS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : null}

              {isExternalDestination(form.destino_tipo) ? (
                <>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                      Distrito
                    </div>
                    <select
                      value={form.distrito_destino}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          distrito_destino: e.target.value,
                          barrio_destino: "",
                        }))
                      }
                      style={inputStyle()}
                    >
                      <option value="">Seleccionar distrito</option>
                      {Object.keys(DISTRITO_BARRIOS).map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                      Barrio
                    </div>
                    <select
                      value={form.barrio_destino}
                      onChange={(e) => setForm((prev) => ({ ...prev, barrio_destino: e.target.value }))}
                      style={inputStyle()}
                    >
                      <option value="">Seleccionar barrio</option>
                      {barriosDisponibles.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ gridColumn: "span 2" }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                      Dirección
                    </div>
                    <input
                      value={form.direccion_destino}
                      onChange={(e) => setForm((prev) => ({ ...prev, direccion_destino: e.target.value }))}
                      style={inputStyle()}
                      placeholder="Introduce la dirección"
                    />
                  </div>
                </>
              ) : null}

              {form.destino_tipo === "Vivero" && form.tamano_destino === "M35" ? (
                <div style={{ gridColumn: "span 2" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                    Fecha de disponibilidad (opcional, tamaño M35)
                  </div>
                  <input
                    type="date"
                    value={form.fecha_disponibilidad}
                    onChange={(e) => setForm((prev) => ({ ...prev, fecha_disponibilidad: e.target.value }))}
                    style={inputStyle()}
                  />
                  <div style={{ marginTop: 6, color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                    Si se indica, el producto no estará disponible para movimientos hasta superar esta fecha. Debe ser futura y no posterior a la fecha de caducidad.
                  </div>
                </div>
              ) : null}

              {form.origen_tipo === "Vivero" && isExternalDestination(form.destino_tipo) ? (
                <div style={{ gridColumn: "span 2" }}>
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1px solid rgba(59,130,246,0.18)",
                      background: "rgba(59,130,246,0.08)",
                      fontWeight: 800,
                      color: "#1e3a8a",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!form.prestamo}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          prestamo: e.target.checked,
                        }))
                      }
                      style={{
                        width: 18,
                        height: 18,
                        margin: 0,
                        flexShrink: 0,
                        cursor: "pointer",
                        accentColor: "#1d4ed8",
                      }}
                    />
                    <span style={{ lineHeight: 1, paddingTop: 1 }}>Marcar como préstamo</span>
                  </label>
                </div>
              ) : null}

              <div style={{ gridColumn: "span 2" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                  Observaciones
                </div>
                <textarea
                  value={form.observaciones}
                  onChange={(e) => setForm((prev) => ({ ...prev, observaciones: e.target.value }))}
                  style={{
                    ...inputStyle(),
                    minHeight: 100,
                    resize: "vertical",
                  }}
                  placeholder="Información adicional del movimiento"
                />
              </div>
            </div>
          </div>

          <div
            style={{
              background: "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
              color: "white",
              display: "grid",
              gridTemplateRows: "1fr auto",
              minHeight: 0,
            }}
          >
            <div
              style={{
                padding: 24,
                overflow: "auto",
                paddingBottom: 28,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 900 }}>Vista previa</div>
              <div style={{ marginTop: 6, color: "rgba(255,255,255,0.75)", fontWeight: 700 }}>
                Revisa la información antes de guardar el movimiento.
              </div>

              <div
                style={{
                  marginTop: 18,
                  padding: 18,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Pedido</div>
                    <div style={{ fontWeight: 800 }}>
                      {form.pedido_id ? `#${form.pedido_id}` : "Sin pedido asociado"}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Tipo</div>
                    <div style={tipoTextStyle(tipoPreview)}>{getTipoDisplayLabel(tipoPreview)}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Producto</div>
                    <div style={{ fontWeight: 800 }}>
                      {selectedProducto ? getProductDisplayName(selectedProducto) : "—"}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Origen</div>
                    <div style={{ fontWeight: 800 }}>
                      {form.origen_tipo === "Vivero"
                        ? `Vivero · Zona ${form.zona_origen || "—"} · ${form.tamano_origen || "—"}`
                        : form.origen_tipo || "—"}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Destino</div>
                    <div style={{ fontWeight: 800 }}>
                      {form.destino_tipo === "Vivero"
                        ? `Vivero · Zona ${form.zona_destino || "—"} · ${form.tamano_destino || "—"}`
                        : isExternalDestination(form.destino_tipo)
                        ? `${form.destino_tipo} · ${form.distrito_destino || "—"} · ${form.barrio_destino || "—"} · ${form.direccion_destino || "—"}`
                        : form.destino_tipo || "—"}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Cantidad</div>
                    <div style={{ fontWeight: 800 }}>{form.cantidad || "—"}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Préstamo</div>
                    <div style={prestamoTextStyle(form.prestamo ? "prestamo" : esDevolucion ? "devolucion" : "none")}>
                      {form.prestamo ? "Préstamo" : esDevolucion ? "Devolución" : "—"}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Observaciones</div>
                    <div style={{ fontWeight: 800 }}>{form.observaciones || "—"}</div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  marginBottom: 12,
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Reglas activas</div>
                <div style={{ color: "rgba(255,255,255,0.8)", fontWeight: 700, display: "grid", gap: 8 }}>
                  <div>• Puedes cargar un movimiento desde un pedido aprobado.</div>
                  <div>• Al seleccionar una línea del pedido se precargan producto, cantidad y tamaño.</div>
                  <div>• Si una línea ya fue usada en un movimiento anterior, aparece bloqueada para evitar duplicados.</div>
                  <div>• Empresa Externa, Otro, Empresa, Organismo oficial, Colegio y Palmetum solo pueden entrar al vivero.</div>
                  <div>• Si el origen es Vivero y el destino es externo, puedes marcarlo como préstamo.</div>
                  <div>• Si el destino es Vivero y el origen es Empresa, Organismo oficial, Colegio u Otro, se registra como devolución.</div>
                </div>
              </div>
            </div>

            {batchPayloads.length > 0 ? (
              <div
                style={{
                  padding: "14px 18px",
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(245,158,11,0.08)",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900, color: "white" }}>
                    Lote: {batchPayloads.length} línea{batchPayloads.length === 1 ? "" : "s"} ·{" "}
                    Total unidades: {batchPayloads.reduce((s, p) => s + Number(p.cantidad || 0), 0)}
                  </div>
                  <button
                    onClick={clearBatch}
                    disabled={saving}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(239,68,68,0.35)",
                      background: "rgba(239,68,68,0.15)",
                      color: "#fecaca",
                      fontWeight: 900,
                      cursor: saving ? "not-allowed" : "pointer",
                      fontSize: 12,
                    }}
                  >
                    Vaciar lote
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 150, overflowY: "auto" }}>
                  {batchPayloads.map((p, idx) => {
                    const prod = productos.find((x) => String(x.id) === String(p.producto_id));
                    const nombre = prod ? getProductDisplayName(prod) : `#${p.producto_id}`;
                    return (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                          padding: "6px 10px",
                          borderRadius: 10,
                          background: "rgba(255,255,255,0.06)",
                          color: "white",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {idx + 1}. {nombre} · {p.tamano_origen || p.tamano_destino || "—"} ·{" "}
                          {p.cantidad} ud {p.zona_origen ? `· zona ${p.zona_origen}` : ""}
                        </span>
                        <button
                          onClick={() => removeBatchItem(idx)}
                          disabled={saving}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#fecaca",
                            fontWeight: 900,
                            cursor: saving ? "not-allowed" : "pointer",
                            fontSize: 14,
                          }}
                          title="Quitar del lote"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div
              style={{
                padding: "16px 18px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                display: "flex",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={onClose}
                disabled={saving}
                style={cancelButtonStyle(saving)}
              >
                Cancelar
              </button>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {form.pedido_id ? (
                  <button
                    onClick={addCurrentToBatch}
                    disabled={saving || !formTieneLineaActual()}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 14,
                      border: "1px solid rgba(245,158,11,0.35)",
                      background: (saving || !formTieneLineaActual())
                        ? "rgba(245,158,11,0.20)"
                        : "linear-gradient(90deg, #f59e0b 0%, #f97316 100%)",
                      color: "white",
                      fontWeight: 900,
                      cursor: (saving || !formTieneLineaActual()) ? "not-allowed" : "pointer",
                      minWidth: 200,
                      opacity: (saving || !formTieneLineaActual()) ? 0.65 : 1,
                    }}
                    title="Añadir esta línea al lote y procesar otra línea del pedido"
                  >
                    + Añadir otra línea
                  </button>
                ) : null}

                <button
                  onClick={submit}
                  disabled={saving}
                  style={{
                    padding: "12px 18px",
                    borderRadius: 14,
                    border: "1px solid rgba(16,185,129,0.35)",
                    background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
                    color: "white",
                    fontWeight: 900,
                    cursor: saving ? "not-allowed" : "pointer",
                    minWidth: 220,
                    opacity: saving ? 0.8 : 1,
                  }}
                >
                  {saving
                    ? "Guardando movimiento..."
                    : batchPayloads.length > 0
                    ? `Guardar ${batchPayloads.length + (formTieneLineaActual() ? 1 : 0)} movimiento(s)`
                    : "Guardar movimiento"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PedidoSelectorModal
        open={showPedidoModal}
        pedidos={pedidosAprobados}
        onClose={() => setShowPedidoModal(false)}
        onSelect={handleSeleccionPedido}
      />

      <PrestamoSelectorModal
        open={showPrestamoModal}
        prestamos={prestamosActivos}
        productos={productos}
        onClose={() => setShowPrestamoModal(false)}
        onSelect={handleSeleccionPrestamo}
      />
    </>
  );
}

function PrestamoSelectorModal({ open, prestamos, productos, onClose, onSelect }) {
  const [texto, setTexto] = useState("");

  const prestamosFiltrados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return safeArray(prestamos).filter((p) => {
      if (!t) return true;
      const prod = productos.find((x) => String(x.id) === String(p.producto_id));
      const base = [
        p?.id,
        p?.destino_tipo,
        p?.distrito_destino,
        p?.barrio_destino,
        p?.direccion_destino,
        p?.producto_nombre_cientifico,
        getProductDisplayName(prod),
        p?.created_by,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return base.includes(t);
    });
  }, [prestamos, productos, texto]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.45)",
        backdropFilter: "blur(3px)",
        zIndex: 1300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(980px, 95vw)",
          maxHeight: "88vh",
          overflow: "hidden",
          background: "white",
          borderRadius: 24,
          boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
          border: "1px solid rgba(15,23,42,0.10)",
          display: "grid",
          gridTemplateRows: "auto auto 1fr",
        }}
      >
        <div
          style={{
            padding: "20px 22px 10px",
            display: "flex",
            alignItems: "start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>
              Préstamos activos
            </div>
            <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
              Selecciona un préstamo pendiente para registrar la devolución. Se rellenará el formulario automáticamente.
            </div>
          </div>

          <button onClick={onClose} style={closeButtonStyle()}>
            Cerrar
          </button>
        </div>

        <div style={{ padding: "0 22px 14px" }}>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por ID, producto, destino, dirección..."
            style={inputStyle()}
          />
        </div>

        <div style={{ padding: "0 22px 22px", overflow: "auto" }}>
          {prestamosFiltrados.length === 0 ? (
            <div
              style={{
                border: "1px solid rgba(15,23,42,0.08)",
                borderRadius: 16,
                padding: 18,
                color: "#64748b",
                fontWeight: 800,
              }}
            >
              No hay préstamos activos que coincidan con la búsqueda.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {prestamosFiltrados.map((p) => {
                const prod = productos.find((x) => String(x.id) === String(p.producto_id));
                const destinoTxt =
                  [p.distrito_destino, p.barrio_destino, p.direccion_destino].filter(Boolean).join(" · ") ||
                  p.destino_tipo ||
                  "—";
                const tamano = p.tamano_origen || p.tamano_destino || "—";

                return (
                  <div
                    key={p.id}
                    style={{
                      border: "1px solid rgba(245,158,11,0.28)",
                      borderRadius: 18,
                      padding: 16,
                      background: "#fffbeb",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
                          Préstamo #{p.id} · {p.producto_nombre_cientifico || getProductDisplayName(prod)}
                        </div>
                        <div style={{ marginTop: 4, color: "#64748b", fontWeight: 700 }}>
                          {fmtFechaES(p.fecha_movimiento)} · Destinatario: {p.destino_tipo || "—"}
                        </div>
                      </div>

                      <button
                        onClick={() => onSelect(p)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 14,
                          border: "1px solid rgba(245,158,11,0.35)",
                          background: "linear-gradient(90deg, #f59e0b 0%, #f97316 100%)",
                          color: "white",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        Usar para devolución
                      </button>
                    </div>

                    <div style={{ marginTop: 10, color: "#475569", fontWeight: 700 }}>
                      Destino del préstamo: {destinoTxt}
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: 10,
                      }}
                    >
                      <div style={{ padding: "8px 10px", borderRadius: 10, background: "white", border: "1px solid rgba(15,23,42,0.06)" }}>
                        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Tamaño</div>
                        <div style={{ fontWeight: 900, color: "#0f172a" }}>{tamano}</div>
                      </div>
                      <div style={{ padding: "8px 10px", borderRadius: 10, background: "white", border: "1px solid rgba(15,23,42,0.06)" }}>
                        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Prestado</div>
                        <div style={{ fontWeight: 900, color: "#0f172a" }}>{p._prestado}</div>
                      </div>
                      <div style={{ padding: "8px 10px", borderRadius: 10, background: "white", border: "1px solid rgba(16,185,129,0.18)" }}>
                        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Devuelto</div>
                        <div style={{ fontWeight: 900, color: "#065f46" }}>{p._devuelto}</div>
                      </div>
                      <div style={{ padding: "8px 10px", borderRadius: 10, background: "white", border: "1px solid rgba(245,158,11,0.25)" }}>
                        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Pendiente</div>
                        <div style={{ fontWeight: 900, color: "#92400e" }}>{p._pendiente}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Movimientos() {
  const [movimientos, setMovimientos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");

  const msgTimerRef = useRef(null);

  const [filtroProducto, setFiltroProducto] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroZona, setFiltroZona] = useState("");
  const [filtroUuid, setFiltroUuid] = useState("");
  const [filtroOrigen, setFiltroOrigen] = useState("");
  const [filtroDestino, setFiltroDestino] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [copiedUuid, setCopiedUuid] = useState("");

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

  const clearFilters = () => {
    setFiltroProducto("");
    setFiltroTipo("");
    setFiltroZona("");
    setFiltroUuid("");
    setFiltroOrigen("");
    setFiltroDestino("");
    setFiltroFecha("");
  };

  useEffect(() => {
    load();

    return () => {
      clearMsgTimer();
    };
  }, []);

  const load = async () => {
    setLoading(true);
    clearMsgTimer();
    setMsg("");

    try {
      const [movs, prods, peds] = await Promise.all([
        getMovimientos(),
        getProductos(),
        getPedidos(),
      ]);

      setMovimientos(safeArray(movs));
      setProductos(safeArray(prods));
      setPedidos(safeArray(peds));
    } catch (e) {
      showTimedMessage(
        e?.response?.data?.detail || e?.message || "Error cargando movimientos",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const pedidosAprobados = useMemo(() => {
    return safeArray(pedidos).filter((p) => String(p?.estado || "").toUpperCase() === "APROBADO");
  }, [pedidos]);

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      const productoTxt = filtroProducto.trim().toLowerCase();
      const uuidTxt = filtroUuid.trim().toLowerCase();
      const tipoReal = String(m?.tipo_movimiento || getMovimientoTipo(m) || "").toLowerCase();
      const origenReal = String(m?.origen_tipo || "").toLowerCase();
      const destinoReal = String(m?.destino_tipo || "").toLowerCase();
      const zonasMovimiento = [m?.zona_origen, m?.zona_destino].filter(Boolean).map((z) => String(z).toLowerCase());

      const productoMatch =
        !productoTxt ||
        `${m?.producto_nombre_cientifico || ""} ${m?.producto_nombre_natural || ""} ${m?.producto_id || ""}`
          .toLowerCase()
          .includes(productoTxt);

      const tipoMatch = !filtroTipo || tipoReal === String(filtroTipo).toLowerCase();
      const zonaMatch = !filtroZona || zonasMovimiento.includes(String(filtroZona).toLowerCase());
      const uuidMatch = !uuidTxt || String(m?.uuid_lote || "").toLowerCase().includes(uuidTxt);
      const origenMatch = !filtroOrigen || origenReal === String(filtroOrigen).toLowerCase();
      const destinoMatch = !filtroDestino || destinoReal === String(filtroDestino).toLowerCase();
      const fechaMatch = !filtroFecha || dateInputValue(m?.fecha_movimiento) === filtroFecha;

      return productoMatch && tipoMatch && zonaMatch && uuidMatch && origenMatch && destinoMatch && fechaMatch;
    });
  }, [movimientos, filtroProducto, filtroTipo, filtroZona, filtroUuid, filtroOrigen, filtroDestino, filtroFecha]);

  const handleCreateMovimiento = async (payloadOrList) => {
    const payloads = Array.isArray(payloadOrList) ? payloadOrList : [payloadOrList];
    if (!payloads.length) return;

    setSaving(true);
    let creados = 0;
    let errorMsg = "";
    try {
      for (const p of payloads) {
        try {
          await createMovimiento(p);
          creados += 1;
        } catch (e) {
          errorMsg = e?.response?.data?.detail || e?.message || "Error guardando movimiento";
          break; // detenemos en el primer fallo
        }
      }
      if (errorMsg) {
        await load();
        showTimedMessage(
          `Guardados ${creados}/${payloads.length}. ${errorMsg}`,
          "error"
        );
      } else {
        setShowModal(false);
        await load();
        showTimedMessage(
          payloads.length > 1
            ? `${payloads.length} movimientos guardados correctamente.`
            : "Movimiento guardado correctamente.",
          "success"
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const copyUuid = async (uuid) => {
    const value = String(uuid || "").trim();
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopiedUuid(value);
      showTimedMessage(`UUID copiado: ${value}`, "success");

      window.setTimeout(() => {
        setCopiedUuid((prev) => (prev === value ? "" : prev));
      }, 1800);
    } catch (e) {
      showTimedMessage("No se pudo copiar el UUID.", "error");
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 44, margin: 0, fontWeight: 900, color: "#0f172a" }}>Movimientos</h1>
          <div style={{ marginTop: 8, color: "#64748b", fontWeight: 700 }}>
            Registra y consulta entradas, salidas, préstamos, devoluciones y traslados del vivero.
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: "12px 18px",
            borderRadius: 16,
            border: "1px solid rgba(16,185,129,0.28)",
            background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: "0 16px 36px rgba(6,182,212,0.18)",
          }}
        >
          Nuevo movimiento
        </button>
      </div>

      <MessageBanner
        msg={msg}
        onClose={() => {
          clearMsgTimer();
          setMsg("");
        }}
        isError={msgType === "error"}
      />

      <div
        style={{
          marginTop: 16,
          background: "white",
          border: "1px solid rgba(15,23,42,0.06)",
          borderRadius: 18,
          boxShadow: "0 10px 30px rgba(2,6,23,0.06)",
          padding: 16,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr)) auto",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>Producto</div>
            <input
              value={filtroProducto}
              onChange={(e) => setFiltroProducto(e.target.value)}
              placeholder="Buscar nombre científico"
              style={inputStyle()}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>Tipo</div>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              style={inputStyle()}
            >
              <option value="">Todos</option>
              {TIPOS_MOVIMIENTO.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>Zona</div>
            <select
              value={filtroZona}
              onChange={(e) => setFiltroZona(e.target.value)}
              style={inputStyle()}
            >
              <option value="">Todas</option>
              {ZONAS.map((zona) => (
                <option key={zona} value={zona}>
                  {zona}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>UUID</div>
            <input
              value={filtroUuid}
              onChange={(e) => setFiltroUuid(e.target.value)}
              placeholder="Buscar UUID"
              style={inputStyle()}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>Origen</div>
            <select
              value={filtroOrigen}
              onChange={(e) => setFiltroOrigen(e.target.value)}
              style={inputStyle()}
            >
              <option value="">Todos</option>
              {ORIGENES.map((origen) => (
                <option key={origen} value={origen}>
                  {origen}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>Destino</div>
            <select
              value={filtroDestino}
              onChange={(e) => setFiltroDestino(e.target.value)}
              style={inputStyle()}
            >
              <option value="">Todos</option>
              {[...new Set(["Vivero", ...DESTINOS_SALIDA_VIVERO])].map((destino) => (
                <option key={destino} value={destino}>
                  {destino}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>Fecha</div>
            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              style={inputStyle()}
            />
          </div>

          <button
            onClick={clearFilters}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.10)",
              background: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Limpiar
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          background: "white",
          border: "1px solid rgba(15,23,42,0.06)",
          borderRadius: 18,
          boxShadow: "0 10px 30px rgba(2,6,23,0.06)",
          padding: 16,
        }}
      >
        {loading ? (
          <div style={{ color: "#64748b", fontWeight: 800 }}>Cargando movimientos…</div>
        ) : movimientosFiltrados.length === 0 ? (
          <div style={{ color: "#64748b", fontWeight: 800 }}>No hay movimientos para los filtros actuales.</div>
        ) : (
          <div>
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: "0 10px",
                tableLayout: "fixed",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ ...thStyle(), width: "95px" }}>Fecha</th>
                  <th style={{ ...thStyle(), width: "90px" }}>Tipo</th>
                  <th style={{ ...thStyle(), width: "145px" }}>Nombre científico</th>
                  <th style={{ ...thStyle(), width: "70px" }}>Cant.</th>
                  <th style={{ ...thStyle(), width: "135px" }}>Origen</th>
                  <th style={{ ...thStyle(), width: "145px" }}>Destino</th>
                  <th style={{ ...thStyle(), width: "95px" }}>Préstamo</th>
                  <th style={{ ...thStyle(), width: "120px" }}>Observaciones</th>
                  <th style={{ ...thStyle(), width: "110px" }}>UUID lote</th>
                  <th style={{ ...thStyle(), width: "75px" }}>Pedido</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.map((m) => {
                  const tipo = m.tipo_movimiento || getMovimientoTipo(m);
                  const esPrestamo = !!m.es_prestamo;
                  const esDevolucionMov = !!m.es_devolucion || getMovimientoTipo(m) === "devolucion";

                  return (
                    <tr
                      key={m.id}
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
                        }}
                      >
                        {fmtFechaES(m.fecha_movimiento)}
                      </td>

                      <td
                        style={{
                          ...tdStyle(),
                          borderTop: "1px solid rgba(15,23,42,0.10)",
                          borderBottom: "1px solid rgba(15,23,42,0.10)",
                        }}
                      >
                        <span style={tipoTextStyle(tipo)}>{getTipoDisplayLabel(tipo)}</span>
                      </td>

                      <td
                        style={{
                          ...tdStyle(),
                          borderTop: "1px solid rgba(15,23,42,0.10)",
                          borderBottom: "1px solid rgba(15,23,42,0.10)",
                          maxWidth: 145,
                        }}
                      >
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={m.producto_nombre_cientifico || m.nombre_cientifico || `Producto #${m.producto_id}`}
                        >
                          {m.producto_nombre_cientifico || m.nombre_cientifico || `Producto #${m.producto_id}`}
                        </div>
                      </td>

                      <td
                        style={{
                          ...tdStyle(),
                          borderTop: "1px solid rgba(15,23,42,0.10)",
                          borderBottom: "1px solid rgba(15,23,42,0.10)",
                        }}
                      >
                        {m.cantidad}
                      </td>

                      <td
                        style={{
                          ...tdStyle(),
                          borderTop: "1px solid rgba(15,23,42,0.10)",
                          borderBottom: "1px solid rgba(15,23,42,0.10)",
                          maxWidth: 135,
                        }}
                      >
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={buildLabelOrigen(m)}
                        >
                          {buildLabelOrigen(m)}
                        </div>
                      </td>

                      <td
                        style={{
                          ...tdStyle(),
                          borderTop: "1px solid rgba(15,23,42,0.10)",
                          borderBottom: "1px solid rgba(15,23,42,0.10)",
                          maxWidth: 145,
                        }}
                      >
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={buildLabelDestino(m)}
                        >
                          {buildLabelDestino(m)}
                        </div>
                      </td>

                      <td
                        style={{
                          ...tdStyle(),
                          borderTop: "1px solid rgba(15,23,42,0.10)",
                          borderBottom: "1px solid rgba(15,23,42,0.10)",
                        }}
                      >
                        <span style={prestamoTextStyle(esPrestamo ? "prestamo" : esDevolucionMov ? "devolucion" : "none")}>
                          {esPrestamo ? "Préstamo" : esDevolucionMov ? "Devolución" : "—"}
                        </span>
                      </td>

                      <td
                        style={{
                          ...tdStyle(),
                          borderTop: "1px solid rgba(15,23,42,0.10)",
                          borderBottom: "1px solid rgba(15,23,42,0.10)",
                          minWidth: 120,
                          maxWidth: 120,
                          width: 120,
                        }}
                      >
                        <div
                          title={m.observaciones || m.nota || "—"}
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: "#475569",
                            fontWeight: 700,
                          }}
                        >
                          {m.observaciones || m.nota || "—"}
                        </div>
                      </td>

                      <td
                        style={{
                          ...tdStyle(),
                          borderTop: "1px solid rgba(15,23,42,0.10)",
                          borderBottom: "1px solid rgba(15,23,42,0.10)",
                          maxWidth: 110,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            minWidth: 0,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => copyUuid(m.uuid_lote)}
                            title={m.uuid_lote ? `Copiar UUID: ${m.uuid_lote}` : "Sin UUID"}
                            disabled={!m.uuid_lote}
                            style={{
                              border: "1px solid rgba(15,23,42,0.10)",
                              background: copiedUuid === m.uuid_lote ? "rgba(16,185,129,0.10)" : "white",
                              color: copiedUuid === m.uuid_lote ? "#065f46" : "#334155",
                              borderRadius: 10,
                              padding: "6px 8px",
                              fontSize: 12,
                              fontWeight: 900,
                              cursor: m.uuid_lote ? "pointer" : "not-allowed",
                              flexShrink: 0,
                              opacity: m.uuid_lote ? 1 : 0.5,
                            }}
                          >
                            {copiedUuid === m.uuid_lote ? "Copiado" : "Copiar"}
                          </button>

                          <div
                            onClick={() => copyUuid(m.uuid_lote)}
                            title={m.uuid_lote ? `Click para copiar: ${m.uuid_lote}` : "—"}
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontFamily:
                                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
                              fontSize: 12,
                              cursor: m.uuid_lote ? "pointer" : "default",
                              color: m.uuid_lote ? "#0f172a" : "#94a3b8",
                              fontWeight: copiedUuid === m.uuid_lote ? 900 : 700,
                              minWidth: 0,
                            }}
                          >
                            {m.uuid_lote || "—"}
                          </div>
                        </div>
                      </td>

                      <td
                        style={{
                          ...tdStyle(),
                          borderTop: "1px solid rgba(15,23,42,0.10)",
                          borderBottom: "1px solid rgba(15,23,42,0.10)",
                          borderRight: "1px solid rgba(15,23,42,0.10)",
                          borderTopRightRadius: 14,
                          borderBottomRightRadius: 14,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span style={{ fontWeight: 900, color: "#1e3a8a" }}>
                          {m.pedido_id ? `#${m.pedido_id}` : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MovimientoModal
        open={showModal}
        onClose={() => setShowModal(false)}
        productos={productos}
        movimientos={movimientos}
        pedidosAprobados={pedidosAprobados}
        onSubmit={handleCreateMovimiento}
        saving={saving}
      />
    </div>
  );
}