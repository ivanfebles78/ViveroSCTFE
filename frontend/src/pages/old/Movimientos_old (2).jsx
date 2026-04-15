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

const TAMANOS = ["semillero", "M12", "M20", "M30"];
const ORIGENES = ["Proveedor", "Vivero", "Palmetum"];

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

function getProductDisplayName(p) {
  return p?.nombre_natural || p?.nombre_cientifico || p?.nombre || `Producto #${p?.id || "—"}`;
}

function getMovimientoTipo(m) {
  const o = String(m?.origen_tipo || "").trim().toLowerCase();
  const d = String(m?.destino_tipo || "").trim().toLowerCase();

  if (o === "vivero" && d === "vivero") return "traslado_interno";
  if (d === "vivero") return "entrada";
  return "salida";
}

function getDestinoOptions(origenTipo) {
  if (origenTipo === "Proveedor") return ["Vivero"];
  if (origenTipo === "Palmetum") return ["Vivero"];
  if (origenTipo === "Vivero") return ["Vivero", "Externo", "Baja Vivero", "Palmetum"];
  return [];
}

function badgeTipo(tipo) {
  const t = String(tipo || "").toLowerCase();

  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid rgba(15,23,42,0.08)",
    textTransform: "capitalize",
  };

  if (t === "entrada") {
    return { ...base, background: "rgba(16,185,129,0.12)", color: "#065f46" };
  }
  if (t === "salida") {
    return { ...base, background: "rgba(239,68,68,0.10)", color: "#991b1b" };
  }
  return { ...base, background: "rgba(59,130,246,0.10)", color: "#1e3a8a" };
}

function thStyle() {
  return {
    textAlign: "left",
    padding: "12px 12px",
    color: "#334155",
    fontWeight: 900,
    fontSize: 13,
    borderBottom: "1px solid rgba(15,23,42,0.10)",
  };
}

function tdStyle() {
  return {
    padding: "14px 12px",
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

  if (m?.destino_tipo === "Externo") {
    const parts = [m?.distrito_destino, m?.barrio_destino, m?.direccion_destino].filter(Boolean);
    return parts.length ? `Externo · ${parts.join(" · ")}` : "Externo";
  }

  return m?.destino_tipo || "—";
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

  if (form.origen_tipo === "Proveedor" && form.destino_tipo !== "Vivero") {
    errs.push("Proveedor solo puede mover hacia Vivero.");
  }

  if (form.origen_tipo === "Palmetum" && form.destino_tipo !== "Vivero") {
    errs.push("Palmetum solo puede mover hacia Vivero.");
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

  if (form.destino_tipo === "Externo") {
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

          <button
            onClick={onClose}
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,0.10)",
              background: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </div>

        <div style={{ padding: "0 22px 14px" }}>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por ID, solicitante, producto, dirección..."
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
                    Destino: {[p.distrito_destino, p.barrio_destino, p.direccion_destino].filter(Boolean).join(" · ") || "—"}
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
	nota: "",
});

  const [errors, setErrors] = useState([]);
  const [showPedidoModal, setShowPedidoModal] = useState(false);
  const [selectedPedidoLineKey, setSelectedPedidoLineKey] = useState("");

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
        nota: "",
      });
      setErrors([]);
      setSelectedPedidoLineKey("");
      setShowPedidoModal(false);
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
      }));
    }
  }, [form.origen_tipo, form.destino_tipo]);

  const allowedDestinos = getDestinoOptions(form.origen_tipo);

  const selectedPedido = useMemo(() => {
    return safeArray(pedidosAprobados).find((p) => String(p.id) === String(form.pedido_id)) || null;
  }, [pedidosAprobados, form.pedido_id]);

  const pedidoLineas = safeArray(selectedPedido?.items).map((it, idx) => ({
    ...it,
    _key: `${selectedPedido?.id || "pedido"}-${it?.producto_id || "prod"}-${it?.tamano || "tam"}-${idx}`,
  }));

  const selectedProducto = productos.find((p) => String(p.id) === String(form.producto_id));

  const barriosDisponibles = useMemo(() => {
    return form.distrito_destino ? DISTRITO_BARRIOS[form.distrito_destino] || [] : [];
  }, [form.distrito_destino]);

  const tipoPreview = useMemo(() => {
    return getMovimientoTipo(form);
  }, [form]);

  const handleSeleccionPedido = (pedido) => {
    setForm((prev) => ({
      ...prev,
      pedido_id: String(pedido.id),
      pedido_item_id: "",
      origen_tipo: "Vivero",
      destino_tipo: "Externo",
      distrito_destino: pedido.distrito_destino || "",
      barrio_destino: pedido.barrio_destino || "",
      direccion_destino: pedido.direccion_destino || "",
      cp_destino: "",
      nota: prev.nota || `Movimiento asociado al pedido #${pedido.id}`,
    }));
    setSelectedPedidoLineKey("");
    setShowPedidoModal(false);
  };

  const usarLineaPedido = (linea) => {
    setSelectedPedidoLineKey(linea._key);
    setForm((prev) => ({
      ...prev,
      pedido_item_id: String(linea.id || ""),
      producto_id: String(linea.producto_id),
      cantidad: String(
        Math.max(
          0,
          Number(linea.cantidad || 0) - Number(linea.cantidad_servida || 0)
        ) || Number(linea.cantidad || 0)
      ),
      origen_tipo: "Vivero",
      destino_tipo: "Externo",
      tamano_origen: linea.tamano || "",
      zona_origen: prev.zona_origen || "",
      zona_destino: "",
      tamano_destino: "",
      distrito_destino: selectedPedido?.distrito_destino || prev.distrito_destino || "",
      barrio_destino: selectedPedido?.barrio_destino || prev.barrio_destino || "",
      direccion_destino: selectedPedido?.direccion_destino || prev.direccion_destino || "",
      nota: prev.nota || `Movimiento asociado al pedido #${selectedPedido?.id || ""}`,
    }));
    setErrors([]);
  };

  const submit = async () => {
    const foundErrors = getFormErrors(form);
    setErrors(foundErrors);
    if (foundErrors.length > 0) return;

    await onSubmit({
      pedido_id: form.pedido_id ? Number(form.pedido_id) : null,
      pedido_item_id: form.pedido_item_id ? Number(form.pedido_item_id) : null,
      producto_id: Number(form.producto_id),
      cantidad: Number(form.cantidad),
      origen_tipo: form.origen_tipo,
      destino_tipo: form.destino_tipo,
      zona_origen: form.origen_tipo === "Vivero" ? form.zona_origen || null : null,
      zona_destino: form.destino_tipo === "Vivero" ? form.zona_destino || null : null,
      tamano_origen: form.origen_tipo === "Vivero" ? form.tamano_origen || null : null,
      tamano_destino: form.destino_tipo === "Vivero" ? form.tamano_destino || null : null,
      distrito_destino: form.destino_tipo === "Externo" ? form.distrito_destino || null : null,
      barrio_destino: form.destino_tipo === "Externo" ? form.barrio_destino || null : null,
      direccion_destino: form.destino_tipo === "Externo" ? form.direccion_destino || null : null,
      cp_destino: form.destino_tipo === "Externo" ? form.cp_destino || null : null,
      nota: form.nota || null,
    });
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
                  Registra entradas, salidas o traslados internos con la lógica del vivero.
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(15,23,42,0.10)",
                  background: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
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
                    Selecciona un pedido aprobado para precargar destino y líneas del pedido.
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
                  </div>
                  <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
                    Destino: {[selectedPedido.distrito_destino, selectedPedido.barrio_destino, selectedPedido.direccion_destino].filter(Boolean).join(" · ") || "—"}
                  </div>

                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {pedidoLineas.map((linea) => {
                      const active = selectedPedidoLineKey === linea._key;
                      return (
                        <div
                          key={linea._key}
                          style={{
                            padding: 12,
                            borderRadius: 14,
                            border: active
                              ? "1px solid rgba(6,182,212,0.30)"
                              : "1px solid rgba(15,23,42,0.08)",
                            background: active ? "rgba(6,182,212,0.08)" : "white",
                            display: "flex",
                            gap: 12,
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 900, color: "#0f172a" }}>
                              {linea.producto_nombre || `Producto #${linea.producto_id}`}
                            </div>
                            <div style={{ marginTop: 4, color: "#64748b", fontWeight: 700 }}>
                              Tamaño: {linea.tamano || "—"} · Cantidad pedida: {linea.cantidad || 0}
                              {" · "}
                              Pendiente: {Math.max(0, Number(linea.cantidad || 0) - Number(linea.cantidad_servida || 0))}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => usarLineaPedido(linea)}
                            disabled={Math.max(0, Number(linea.cantidad || 0) - Number(linea.cantidad_servida || 0)) <= 0}
                            style={{
                              padding: "9px 12px",
                              borderRadius: 12,
                              border: "1px solid rgba(16,185,129,0.20)",
                              background:
                                Math.max(0, Number(linea.cantidad || 0) - Number(linea.cantidad_servida || 0)) <= 0
                                  ? "rgba(148,163,184,0.14)"
                                  : "rgba(16,185,129,0.10)",
                              color:
                                Math.max(0, Number(linea.cantidad || 0) - Number(linea.cantidad_servida || 0)) <= 0
                                  ? "#94a3b8"
                                  : "#065f46",
                              fontWeight: 900,
                              cursor:
                                Math.max(0, Number(linea.cantidad || 0) - Number(linea.cantidad_servida || 0)) <= 0
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            {Math.max(0, Number(linea.cantidad || 0) - Number(linea.cantidad_servida || 0)) <= 0
                              ? "Línea servida"
                              : "Usar esta línea"}
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

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                  Cantidad
                </div>
                <input
                  type="number"
                  min={1}
                  value={form.cantidad}
                  onChange={(e) => setForm((prev) => ({ ...prev, cantidad: e.target.value }))}
                  style={inputStyle()}
                  placeholder="0"
                />
              </div>

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
                      zona_origen: "",
                      tamano_origen: "",
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

              {form.origen_tipo === "Vivero" ? (
                <>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                      Zona origen
                    </div>
                    <select
                      value={form.zona_origen}
                      onChange={(e) => setForm((prev) => ({ ...prev, zona_origen: e.target.value }))}
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
                      Tamaño origen
                    </div>
                    <select
                      value={form.tamano_origen}
                      onChange={(e) => setForm((prev) => ({ ...prev, tamano_origen: e.target.value }))}
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

              {form.destino_tipo === "Externo" ? (
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

              <div style={{ gridColumn: "span 2" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
                  Nota
                </div>
                <textarea
                  value={form.nota}
                  onChange={(e) => setForm((prev) => ({ ...prev, nota: e.target.value }))}
                  style={{
                    ...inputStyle(),
                    minHeight: 100,
                    resize: "vertical",
                  }}
                  placeholder="Observaciones del movimiento"
                />
              </div>
            </div>
          </div>

          <div
            style={{
              background: "linear-gradient(180deg, #0f172a 0%, #111827 100%)",
              color: "white",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: 24, overflow: "auto" }}>
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
                    <div style={{ fontWeight: 800 }}>{tipoPreview || "—"}</div>
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
                        : form.destino_tipo === "Externo"
                        ? `Externo · ${form.distrito_destino || "—"} · ${form.barrio_destino || "—"} · ${form.direccion_destino || "—"}`
                        : form.destino_tipo || "—"}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Cantidad</div>
                    <div style={{ fontWeight: 800 }}>{form.cantidad || "—"}</div>
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
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Reglas activas</div>
                <div style={{ color: "rgba(255,255,255,0.8)", fontWeight: 700, display: "grid", gap: 8 }}>
                  <div>• Puedes cargar un movimiento desde un pedido aprobado.</div>
                  <div>• Al seleccionar una línea del pedido se precargan producto, cantidad y tamaño.</div>
                  <div>• Si el destino es Externo, distrito, barrio y dirección son obligatorios.</div>
                  <div>• Si no hay stock disponible en la zona/tamaño elegidos, se mostrará un error al guardar.</div>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderTop: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
                display: "flex",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
                position: "sticky",
                bottom: 0,
              }}
            >
              <button
                onClick={onClose}
                disabled={saving}
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>

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
                  cursor: "pointer",
                  minWidth: 220,
                }}
              >
                {saving ? "Guardando movimiento..." : "Guardar movimiento"}
              </button>
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
    </>
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
  const [filtroOrigen, setFiltroOrigen] = useState("");
  const [filtroDestino, setFiltroDestino] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");

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
      const tipoTxt = filtroTipo.trim().toLowerCase();
      const zonaTxt = filtroZona.trim().toLowerCase();
      const origenTxt = filtroOrigen.trim().toLowerCase();
      const destinoTxt = filtroDestino.trim().toLowerCase();

      const productoMatch =
        !productoTxt ||
        `${m?.producto_nombre_cientifico || ""} ${m?.producto_nombre_natural || ""} ${m?.producto_id || ""}`
          .toLowerCase()
          .includes(productoTxt);

      const tipoMatch = !tipoTxt || String(m?.tipo_movimiento || "").toLowerCase().includes(tipoTxt);

      const zonaMatch =
        !zonaTxt ||
        `${m?.zona_origen || ""} ${m?.zona_destino || ""}`.toLowerCase().includes(zonaTxt);

      const origenMatch = !origenTxt || String(m?.origen_tipo || "").toLowerCase().includes(origenTxt);
      const destinoMatch = !destinoTxt || String(m?.destino_tipo || "").toLowerCase().includes(destinoTxt);
      const fechaMatch = !filtroFecha || dateInputValue(m?.fecha_movimiento) === filtroFecha;

      return productoMatch && tipoMatch && zonaMatch && origenMatch && destinoMatch && fechaMatch;
    });
  }, [movimientos, filtroProducto, filtroTipo, filtroZona, filtroOrigen, filtroDestino, filtroFecha]);

  const handleCreateMovimiento = async (payload) => {
    setSaving(true);
    try {
      await createMovimiento(payload);
      setShowModal(false);
      await load();
      showTimedMessage("Movimiento guardado correctamente.", "success");
    } catch (e) {
      showTimedMessage(
        e?.response?.data?.detail || e?.message || "Error guardando movimiento",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 44, margin: 0, fontWeight: 900, color: "#0f172a" }}>Movimientos</h1>
          <div style={{ marginTop: 8, color: "#64748b", fontWeight: 700 }}>
            Registra y consulta entradas, salidas y traslados del vivero.
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
            gridTemplateColumns: "repeat(6, minmax(0, 1fr)) auto",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>Producto</div>
            <input
              value={filtroProducto}
              onChange={(e) => setFiltroProducto(e.target.value)}
              placeholder="Buscar producto"
              style={inputStyle()}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>Tipo</div>
            <input
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              placeholder="entrada/salida"
              style={inputStyle()}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>Zona</div>
            <input
              value={filtroZona}
              onChange={(e) => setFiltroZona(e.target.value)}
              placeholder="Zona origen/destino"
              style={inputStyle()}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>Origen</div>
            <input
              value={filtroOrigen}
              onChange={(e) => setFiltroOrigen(e.target.value)}
              placeholder="Proveedor/Vivero..."
              style={inputStyle()}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6 }}>Destino</div>
            <input
              value={filtroDestino}
              onChange={(e) => setFiltroDestino(e.target.value)}
              placeholder="Vivero/Externo..."
              style={inputStyle()}
            />
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
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", minWidth: 1200 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={thStyle()}>Fecha</th>
                  <th style={thStyle()}>Tipo</th>
                  <th style={thStyle()}>Producto</th>
                  <th style={thStyle()}>Cantidad</th>
                  <th style={thStyle()}>Origen</th>
                  <th style={thStyle()}>Destino</th>
                  <th style={thStyle()}>Pedido</th>
                </tr>
              </thead>
              <tbody>
                {movimientosFiltrados.map((m) => (
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

                    <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                      <span style={badgeTipo(m.tipo_movimiento)}>{m.tipo_movimiento}</span>
                    </td>

                    <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                      {m.producto_nombre_natural || m.producto_nombre_cientifico || `Producto #${m.producto_id}`}
                    </td>

                    <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                      {m.cantidad}
                    </td>

                    <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                      {buildLabelOrigen(m)}
                    </td>

                    <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                      {buildLabelDestino(m)}
                    </td>

                    <td
                      style={{
                        ...tdStyle(),
                        borderTop: "1px solid rgba(15,23,42,0.10)",
                        borderBottom: "1px solid rgba(15,23,42,0.10)",
                        borderRight: "1px solid rgba(15,23,42,0.10)",
                        borderTopRightRadius: 14,
                        borderBottomRightRadius: 14,
                      }}
                    >
                      {m.pedido_id ? `#${m.pedido_id}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MovimientoModal
        open={showModal}
        onClose={() => setShowModal(false)}
        productos={productos}
        pedidosAprobados={pedidosAprobados}
        onSubmit={handleCreateMovimiento}
        saving={saving}
      />
    </div>
  );
}