import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getMovimientos,
  getProductos,
  getPedidos,
  createMovimiento,
} from "../api/api";
import { loadZonasFromServer } from "../components/vivero/zonesStorage";
import { formatUsername } from "../utils/format";
import { getProductFormatoConfig, getFormatoOptions } from "../utils/formato";
import { formatCantidad } from "../utils/numero";

// Zonas especiales (no numéricas) — dedicadas a categorías concretas.
const ZONA_ALMACEN = "Almacén";
const ZONA_COMPOSTAJE = "Zona Compostaje";
const ZONAS_ESPECIALES = [ZONA_ALMACEN, ZONA_COMPOSTAJE];

// Fallback hardcoded por si la API de configuración de zonas falla.
// La lista real se carga dinámicamente desde el servidor en el componente
// principal y se pasa como prop a los hijos. Las zonas especiales siempre
// están disponibles aunque el servidor no las devuelva.
const DEFAULT_ZONAS = [
  "1", "2", "3a", "3b", "4a", "4b",
  "5", "6", "7", "8", "9a", "9b", "9c", "10a", "10b", "11", "12",
  ZONA_ALMACEN,
  ZONA_COMPOSTAJE,
];

// Orden natural: primero las zonas numéricas (por número, luego letra),
// y al final las zonas especiales (Almacén, Zona Compostaje).
// Ej: "1", "2", "3a", "3b", ..., "12", "Almacén", "Zona Compostaje".
function naturalSortZonas(zonas) {
  const parse = (id) => {
    const s = String(id).trim();
    const m = s.match(/^(\d+)([a-z]*)$/i);
    if (m) return [0, parseInt(m[1], 10), (m[2] || "").toLowerCase()];
    // Zonas no numéricas (Almacén, Zona Compostaje) van al final, alfabéticas.
    return [1, 0, s.toLowerCase()];
  };
  return [...zonas].sort((a, b) => {
    const [ga, na, la] = parse(a);
    const [gb, nb, lb] = parse(b);
    if (ga !== gb) return ga - gb;
    if (na !== nb) return na - nb;
    return la.localeCompare(lb);
  });
}

// Garantiza que las zonas especiales aparezcan siempre, aunque el servidor
// devuelva solo zonas numéricas. Mantiene el orden natural.
function ensureZonasEspeciales(zonas) {
  const set = new Set(zonas.map((z) => String(z).trim()));
  const out = [...zonas];
  for (const z of ZONAS_ESPECIALES) {
    if (!set.has(z)) out.push(z);
  }
  return naturalSortZonas(out);
}

const TAMANOS = ["Semillero", "M12", "M20", "M35"];

// Devuelve las zonas en las que un producto puede entrar/salir según su
// categoría. Reglas:
//   - Áridos / Material Vegetal → solo "Zona Compostaje".
//   - Ferretería / Fitosanitario / Fertilizante → solo "Almacén".
//   - Plantas (y cualquier otra categoría) → solo zonas numéricas.
function getZonasPermitidasParaCategoria(producto, todasLasZonas) {
  if (!producto) return safeArray(todasLasZonas);

  const normalize = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();

  const cat = normalize(producto.categoria);
  const isCompostaje = cat === "arido" || cat === "aridos" || cat === "material vegetal" || cat === "materiales vegetales";
  const isAlmacen =
    cat === "ferreteria" ||
    cat === "fitosanitario" || cat === "fitosanitarios" ||
    cat === "fertilizante" || cat === "fertilizantes";

  const zonas = safeArray(todasLasZonas);

  if (isCompostaje) {
    return zonas.filter((z) => normalize(z) === normalize(ZONA_COMPOSTAJE));
  }
  if (isAlmacen) {
    return zonas.filter((z) => normalize(z) === normalize(ZONA_ALMACEN));
  }
  // Plantas y demás: zonas numéricas (excluir las especiales).
  return zonas.filter((z) => !ZONAS_ESPECIALES.some((esp) => normalize(esp) === normalize(z)));
}

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
  // Muestra ambos nombres concatenados ("Latín — Común") cuando difieren,
  // para que el usuario pueda distinguir entre productos con el mismo nombre
  // genérico (p.ej. varias especies de "Acalifa"). Si solo hay uno, lo usa.
  const cient = (p?.nombre_cientifico || p?.producto_nombre_cientifico || "").trim();
  const natural = (p?.nombre_natural || "").trim();
  if (cient && natural && cient.toLowerCase() !== natural.toLowerCase()) {
    return `${cient} — ${natural}`;
  }
  return cient || natural || `Producto #${p?.id || p?.producto_id || "—"}`;
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

function getFormErrors(form, formatoConfig = null) {
  const errs = [];

  if (!form.producto_id) errs.push("Debes seleccionar un producto.");
  // Cantidad: solo se exige si el formato lo muestra (no en fitosanitarios/fertilizantes).
  if (formatoConfig?.showCantidad !== false) {
    if (!form.cantidad || Number(form.cantidad) <= 0) errs.push("La cantidad debe ser mayor que 0.");
  }
  if (!form.origen_tipo) errs.push("Debes seleccionar un origen.");
  if (!form.destino_tipo) errs.push("Debes seleccionar un destino.");

  // Para fitosanitarios/fertilizantes, observaciones es obligatorio.
  if (formatoConfig?.observacionesRequired && !(form.observaciones || "").trim()) {
    errs.push("Para fitosanitarios y fertilizantes debes indicar la cantidad y el envase en observaciones.");
  }

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

// Contenedor visual de cada bloque del formulario (Origen/Destino, Producto,
// Detalles del producto). Agrupa visualmente los campos relacionados.
function sectionStyle() {
  return {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(15,23,42,0.08)",
  };
}

function sectionTitleStyle() {
  return {
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "1px solid rgba(15,23,42,0.06)",
  };
}

function fieldLabelStyle() {
  return {
    fontSize: 12,
    fontWeight: 900,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 6,
  };
}

function gridTwoCols() {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
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
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 24,
        overflowY: "auto",
        overscrollBehavior: "contain",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(980px, 95vw)",
          background: "white",
          borderRadius: 24,
          boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
          border: "1px solid rgba(15,23,42,0.10)",
          display: "flex",
          flexDirection: "column",
          marginTop: "auto",
          marginBottom: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "20px 22px 10px",
            display: "flex",
            alignItems: "start",
            justifyContent: "space-between",
            gap: 16,
            position: "sticky",
            top: 0,
            background: "white",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            zIndex: 2,
            borderBottom: "1px solid rgba(15,23,42,0.05)",
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

        <div style={{ padding: "14px 22px", position: "sticky", top: 96, background: "white", zIndex: 1 }}>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por ID, solicitante, nombre científico, dirección..."
            style={inputStyle()}
          />
        </div>

        <div style={{ padding: "0 22px 22px" }}>
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
                          Tamaño: {it.tamano || "—"} · Cantidad: {formatCantidad(it.cantidad) || "0"}
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
  zonas = DEFAULT_ZONAS,
}) {
  // Alias local para mantener legibilidad del código existente que usaba ZONAS.
  const ZONAS = zonas;
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
  // Texto de búsqueda libre para filtrar el desplegable de productos.
  const [productoSearch, setProductoSearch] = useState("");
  // Filtros de categoría/subcategoría para acotar la lista de productos.
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroSubcategoria, setFiltroSubcategoria] = useState("");

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
      setProductoSearch("");
      setFiltroCategoria("");
      setFiltroSubcategoria("");
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

  // Cantidades de cada pedido_item_id que ya están en el lote local (aún sin enviar)
  const cantidadesEnLote = useMemo(() => {
    const m = new Map();
    for (const p of batchPayloads) {
      if (!p?.pedido_item_id) continue;
      const k = Number(p.pedido_item_id);
      m.set(k, (m.get(k) || 0) + Number(p.cantidad || 0));
    }
    return m;
  }, [batchPayloads]);

  const pedidoLineas = useMemo(() => {
    return safeArray(selectedPedido?.items).map((it, idx) => {
      const byItemKey = it?.id ? `item__${it.id}` : null;
      const fallbackKey = `pedido__${selectedPedido?.id || ""}__prod__${it?.producto_id || ""}__tam__${it?.tamano || ""}`;

      const cantidadMovidaBackend =
        (byItemKey ? Number(movimientosPreviosPorPedido.get(byItemKey) || 0) : 0) ||
        Number(movimientosPreviosPorPedido.get(fallbackKey) || 0);

      const cantidadEnLoteLocal = it?.id ? Number(cantidadesEnLote.get(Number(it.id)) || 0) : 0;
      const cantidadMovida = cantidadMovidaBackend + cantidadEnLoteLocal;
      const yaUsadaBackend = cantidadMovidaBackend > 0;
      const yaEnLoteLocal = cantidadEnLoteLocal > 0;

      return {
        ...it,
        _key: `${selectedPedido?.id || "pedido"}-${it?.producto_id || "prod"}-${it?.tamano || "tam"}-${idx}`,
        _cantidad_movida: cantidadMovida,
        _cantidad_en_lote: cantidadEnLoteLocal,
        _disabled: yaUsadaBackend || yaEnLoteLocal,
        _razon_bloqueo: yaEnLoteLocal ? "ya_en_lote" : yaUsadaBackend ? "ya_servida" : null,
      };
    });
  }, [selectedPedido, movimientosPreviosPorPedido, cantidadesEnLote]);

  const selectedProducto = productos.find((p) => String(p.id) === String(form.producto_id));

  // Configuración de control de tamaño/formato/cantidad según la categoría del
  // producto seleccionado. Centraliza la lógica de:
  //   - Plantas → "Tamaño" (Semillero/M12/M20/M35)
  //   - Fitosanitarios/Fertilizantes → "Formato" (Polvo/Líquido/...) sin cantidad
  //   - Áridos/Material Vegetal → "Formato" fijo "metros cúbicos"
  //   - Ferretería (alambre/malla/cinturones) → "Formato" fijo "metros"
  //   - Ferretería resto → "Formato" fijo "unidades"
  const formatoConfig = useMemo(
    () => getProductFormatoConfig(selectedProducto),
    [selectedProducto]
  );

  // Para formato_fijo: cuando el usuario elige un producto que tiene formato
  // fijo, autocompleta tamano_origen y tamano_destino al valor fijado.
  // Para formato_dropdown: si el formato actual no es válido (p.ej. cambió de
  // un producto Plantas a uno Fitosanitarios), lo resetea.
  useEffect(() => {
    if (!selectedProducto) return;

    if (formatoConfig.kind === "formato_fijo") {
      setForm((prev) => ({
        ...prev,
        tamano_origen: formatoConfig.value,
        tamano_destino: formatoConfig.value,
      }));
      return;
    }

    // Para tamano (plantas) y formato_dropdown (fito/fert): si el valor actual
    // no está entre las opciones válidas, resetea ambos.
    const valid = new Set(formatoConfig.options || []);
    setForm((prev) => {
      const t_origen = valid.has(prev.tamano_origen) ? prev.tamano_origen : "";
      const t_destino = valid.has(prev.tamano_destino) ? prev.tamano_destino : "";
      if (t_origen === prev.tamano_origen && t_destino === prev.tamano_destino) {
        return prev;
      }
      return { ...prev, tamano_origen: t_origen, tamano_destino: t_destino };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProducto?.id, formatoConfig.kind, formatoConfig.value]);

  // Si la subcategoría seleccionada no pertenece a la categoría actual, resetea.
  useEffect(() => {
    if (!filtroCategoria) {
      if (filtroSubcategoria !== "") setFiltroSubcategoria("");
      return;
    }
    const valid = new Set(
      safeArray(productos)
        .filter((p) => String(p?.categoria || "").trim() === filtroCategoria)
        .map((p) => String(p?.subcategoria || "").trim())
        .filter(Boolean)
    );
    if (filtroSubcategoria && !valid.has(filtroSubcategoria)) {
      setFiltroSubcategoria("");
    }
  }, [filtroCategoria, productos, filtroSubcategoria]);

  // Categorías únicas disponibles (extraídas de la lista de productos).
  const categoriasDisponibles = useMemo(() => {
    const set = new Set();
    for (const p of safeArray(productos)) {
      const c = String(p?.categoria || "").trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [productos]);

  // Subcategorías para la categoría seleccionada (vacía si no hay categoría).
  const subcategoriasDisponibles = useMemo(() => {
    if (!filtroCategoria) return [];
    const set = new Set();
    for (const p of safeArray(productos)) {
      if (String(p?.categoria || "").trim() !== filtroCategoria) continue;
      const s = String(p?.subcategoria || "").trim();
      if (s) set.add(s);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [productos, filtroCategoria]);

  // Set de IDs de producto con stock disponible cuando origen=Vivero.
  // null = no se aplica filtro por stock (origen externo o sin elegir aún).
  // Si hay zona/tamaño origen elegidos, restringe la búsqueda a esa combinación.
  const productosConStockOrigen = useMemo(() => {
    if (form.origen_tipo !== "Vivero") return null;
    const set = new Set();
    const zonaFiltro = form.zona_origen ? String(form.zona_origen).toLowerCase() : null;
    const tamanoFiltro = form.tamano_origen ? normalizeTamanoForStock(form.tamano_origen) : null;
    for (const [key, qty] of stockByProductZoneSize.entries()) {
      if (Number(qty) <= 0) continue;
      const parts = key.split("__");
      if (parts.length < 3) continue;
      const [productoIdStr, zonaLower, tamano] = parts;
      if (zonaFiltro && zonaLower !== zonaFiltro) continue;
      if (tamanoFiltro && tamano !== tamanoFiltro) continue;
      set.add(Number(productoIdStr));
    }
    return set;
  }, [form.origen_tipo, form.zona_origen, form.tamano_origen, stockByProductZoneSize]);

  // Lista de productos filtrada por stock (si origen=Vivero), categoría,
  // subcategoría y texto de búsqueda. Siempre incluye el producto actualmente
  // seleccionado aunque no encaje con los filtros, para que el <select> no
  // parezca vacío al elegir y filtrar.
  const filteredProductos = useMemo(() => {
    const needle = productoSearch.trim().toLowerCase();
    return safeArray(productos).filter((p) => {
      if (String(p.id) === String(form.producto_id)) return true;
      // Si origen=Vivero, solo productos con stock real.
      if (productosConStockOrigen && !productosConStockOrigen.has(Number(p.id))) {
        return false;
      }
      if (filtroCategoria && String(p?.categoria || "").trim() !== filtroCategoria) {
        return false;
      }
      if (filtroSubcategoria && String(p?.subcategoria || "").trim() !== filtroSubcategoria) {
        return false;
      }
      if (!needle) return true;
      const display = String(getProductDisplayName(p) || "").toLowerCase();
      const natural = String(p.nombre_natural || "").toLowerCase();
      const cientifico = String(p.nombre_cientifico || "").toLowerCase();
      return (
        display.includes(needle) ||
        natural.includes(needle) ||
        cientifico.includes(needle)
      );
    });
  }, [productos, productoSearch, form.producto_id, filtroCategoria, filtroSubcategoria, productosConStockOrigen]);

  // Zonas permitidas por la categoría del producto seleccionado (sin tener en
  // cuenta stock). Se usa tanto para origen como para destino.
  const zonasPermitidasPorCategoria = useMemo(() => {
    return getZonasPermitidasParaCategoria(selectedProducto, ZONAS);
  }, [selectedProducto, ZONAS]);

  const availableOriginZones = useMemo(() => {
    if (form.origen_tipo !== "Vivero" || !form.producto_id) return zonasPermitidasPorCategoria;

    // Opciones de formato/tamaño válidas para este producto (según su categoría).
    const formatoOptions = getFormatoOptions(formatoConfig);

    return zonasPermitidasPorCategoria.filter((zona) => {
      if (form.tamano_origen) {
        const key = buildStockKey(form.producto_id, zona, form.tamano_origen);
        return Number(stockByProductZoneSize.get(key) || 0) > 0;
      }

      return formatoOptions.some((tamano) => {
        const key = buildStockKey(form.producto_id, zona, tamano);
        return Number(stockByProductZoneSize.get(key) || 0) > 0;
      });
    });
  }, [form.origen_tipo, form.producto_id, form.tamano_origen, stockByProductZoneSize, formatoConfig, zonasPermitidasPorCategoria]);

  const availableOriginSizes = useMemo(() => {
    // Opciones según el producto (plantas: TAMANOS clásicos; fito/fert: formatos;
    // áridos/ferretería: el valor fijo único).
    const formatoOptions = getFormatoOptions(formatoConfig);

    if (form.origen_tipo !== "Vivero" || !form.producto_id) return formatoOptions;

    // Si hay zona seleccionada, filtra tamaños con stock en esa zona concreta.
    // Si no, muestra tamaños con stock en CUALQUIER zona permitida por la categoría.
    return formatoOptions.filter((tamano) => {
      if (form.zona_origen) {
        const key = buildStockKey(form.producto_id, form.zona_origen, tamano);
        return Number(stockByProductZoneSize.get(key) || 0) > 0;
      }
      return zonasPermitidasPorCategoria.some(
        (z) => Number(stockByProductZoneSize.get(buildStockKey(form.producto_id, z, tamano)) || 0) > 0
      );
    });
  }, [form.origen_tipo, form.producto_id, form.zona_origen, stockByProductZoneSize, formatoConfig, zonasPermitidasPorCategoria]);

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

  // Para productos con zona forzada (Áridos/Material Vegetal → Compostaje,
  // Ferretería/Fitosanitario/Fertilizante → Almacén), preselecciona
  // automáticamente la única zona válida.
  //   - destino_tipo=Vivero → siempre asigna (no depende de stock).
  //   - origen_tipo=Vivero → solo si la zona aparece en availableOriginZones
  //     (es decir, hay stock); si no, el otro efecto la habría limpiado al
  //     instante y crearíamos un bucle visual.
  useEffect(() => {
    if (!selectedProducto) return;
    if (zonasPermitidasPorCategoria.length !== 1) return;
    const zonaUnica = zonasPermitidasPorCategoria[0];
    setForm((prev) => {
      const next = { ...prev };
      let changed = false;
      if (
        prev.origen_tipo === "Vivero" &&
        prev.zona_origen !== zonaUnica &&
        availableOriginZones.includes(zonaUnica)
      ) {
        next.zona_origen = zonaUnica;
        changed = true;
      }
      if (prev.destino_tipo === "Vivero" && prev.zona_destino !== zonaUnica) {
        next.zona_destino = zonaUnica;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [selectedProducto, zonasPermitidasPorCategoria, form.origen_tipo, form.destino_tipo, availableOriginZones]);

  // Si origen=Vivero y el producto actualmente seleccionado ya no tiene stock
  // (porque el usuario cambió origen→Vivero, o cambió zona/tamaño origen y
  // ahora no hay stock con esa combinación), lo resetea junto con los filtros
  // dependientes para que el usuario vuelva a elegir uno con stock.
  useEffect(() => {
    if (!form.producto_id) return;
    if (!productosConStockOrigen) return; // origen no es Vivero, no aplica
    if (productosConStockOrigen.has(Number(form.producto_id))) return; // sigue teniendo stock
    setForm((prev) => ({
      ...prev,
      producto_id: "",
      tamano_origen: prev.origen_tipo === "Vivero" ? "" : prev.tamano_origen,
      zona_origen: prev.origen_tipo === "Vivero" ? "" : prev.zona_origen,
      tamano_destino: prev.destino_tipo === "Vivero" ? "" : prev.tamano_destino,
      zona_destino: prev.destino_tipo === "Vivero" ? "" : prev.zona_destino,
    }));
  }, [form.producto_id, productosConStockOrigen]);

  // Si la zona destino actual ya no está permitida para la categoría del
  // producto (p.ej. el usuario eligió zona "5" y luego cambió a Áridos),
  // la resetea.
  useEffect(() => {
    if (
      form.destino_tipo === "Vivero" &&
      form.zona_destino &&
      selectedProducto &&
      !zonasPermitidasPorCategoria.includes(form.zona_destino)
    ) {
      setForm((prev) => ({ ...prev, zona_destino: "" }));
    }
  }, [form.destino_tipo, form.zona_destino, selectedProducto, zonasPermitidasPorCategoria]);

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

  // Mapa { zona: cantidadDisponible } para el producto y tamaño seleccionados.
  // Solo considera zonas permitidas por la categoría del producto.
  const distribucionDisponible = useMemo(() => {
    if (!distribucionActiva) return {};
    const out = {};
    for (const z of zonasPermitidasPorCategoria) {
      const key = buildStockKey(form.producto_id, z, form.tamano_origen);
      const qty = Number(stockByProductZoneSize.get(key) || 0);
      if (qty > 0) out[z] = qty;
    }
    return out;
  }, [distribucionActiva, form.producto_id, form.tamano_origen, stockByProductZoneSize, zonasPermitidasPorCategoria]);

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
    const foundErrors = getFormErrors(form, formatoConfig);
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
      // Cantidad: parseFloat para soportar decimales (fitosanitarios/fertilizantes
      // en litros o kilos pueden ser 0.5, 2.5, etc.).
      const cantidadFinal = formatoConfig.showCantidad
        ? parseFloat(form.cantidad)
        : 1;
      payloads = [
        {
          ...basePayload,
          zona_origen: form.origen_tipo === "Vivero" ? form.zona_origen || null : null,
          cantidad: cantidadFinal,
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
                              Tamaño: {linea.tamano || "—"} · Cantidad: {formatCantidad(linea.cantidad) || "0"}
                              {disabled
                                ? linea._razon_bloqueo === "ya_en_lote"
                                  ? ` · En el lote (${linea._cantidad_en_lote})`
                                  : ` · Ya movida: ${linea._cantidad_movida}`
                                : ""}
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
                            {disabled
                              ? linea._razon_bloqueo === "ya_en_lote"
                                ? "En lote"
                                : "Ya usada"
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

            {/* === SECCIÓN 1: ORIGEN / DESTINO ============================== */}
            <div style={sectionStyle()}>
              <div style={sectionTitleStyle()}>Origen y destino</div>

              {/* Fila compacta: Origen, Zona origen (si aplica), Destino, Zona
                  destino (si aplica). El número de columnas se ajusta para que
                  los 2-4 selects quepan en una sola línea. */}
              {(() => {
                const showZonaOrigen = form.origen_tipo === "Vivero" && !distribucionActiva;
                const showZonaDestino = form.destino_tipo === "Vivero";
                const cols = 2 + (showZonaOrigen ? 1 : 0) + (showZonaDestino ? 1 : 0);

                // Al cambiar origen o destino se resetea el producto, los
                // filtros (categoría/subcategoría/búsqueda), la cantidad y la
                // distribución multi-zona, para que el usuario empiece desde
                // cero la elección de producto bajo las nuevas reglas.
                const resetSeleccionProducto = () => {
                  setFiltroCategoria("");
                  setFiltroSubcategoria("");
                  setProductoSearch("");
                  setDistribucion({});
                };

                return (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={fieldLabelStyle()}>Origen</div>
                      <select
                        value={form.origen_tipo}
                        onChange={(e) => {
                          resetSeleccionProducto();
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
                            producto_id: "",
                            pedido_item_id: "",
                            cantidad: "",
                          }));
                        }}
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

                    {showZonaOrigen ? (
                      <div>
                        <div style={fieldLabelStyle()}>Zona origen</div>
                        <select
                          value={form.zona_origen}
                          onChange={(e) => setForm((prev) => ({ ...prev, zona_origen: e.target.value }))}
                          style={inputStyle()}
                          disabled={!form.producto_id || availableOriginZones.length === 0}
                        >
                          <option value="">
                            {!form.producto_id
                              ? "Primero producto"
                              : availableOriginZones.length === 0
                              ? "Sin stock"
                              : "Seleccionar"}
                          </option>
                          {availableOriginZones.map((z) => (
                            <option key={z} value={z}>
                              {z}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    <div>
                      <div style={fieldLabelStyle()}>Destino</div>
                      <select
                        value={form.destino_tipo}
                        onChange={(e) => {
                          resetSeleccionProducto();
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
                            producto_id: "",
                            pedido_item_id: "",
                            cantidad: "",
                          }));
                        }}
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

                    {showZonaDestino ? (
                      <div>
                        <div style={fieldLabelStyle()}>Zona destino</div>
                        <select
                          value={form.zona_destino}
                          onChange={(e) => setForm((prev) => ({ ...prev, zona_destino: e.target.value }))}
                          style={inputStyle()}
                          disabled={!form.producto_id || zonasPermitidasPorCategoria.length === 0}
                        >
                          <option value="">
                            {!form.producto_id
                              ? "Primero producto"
                              : zonasPermitidasPorCategoria.length === 0
                              ? "Sin zonas"
                              : "Seleccionar"}
                          </option>
                          {zonasPermitidasPorCategoria.map((z) => (
                            <option key={z} value={z}>
                              {z}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                );
              })()}

              {/* Bloque secundario (2 columnas): picker multi-zona, distrito/barrio/dirección,
                  fecha M35 y checkbox de préstamo. Solo aparece cuando hay algún campo
                  que mostrar. */}
              <div style={{ ...gridTwoCols(), marginTop: 14 }}>
                {/* PICKER multi-zona: solo cuando origen=Vivero + producto + tamaño */}
                {distribucionActiva ? (
                  <div style={{ gridColumn: "span 2" }}>
                    <div style={fieldLabelStyle()}>
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
                                gridTemplateColumns: "140px 1fr 110px",
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

                {/* Distrito / Barrio / Dirección (destino externo) */}
                {isExternalDestination(form.destino_tipo) ? (
                  <>
                    <div>
                      <div style={fieldLabelStyle()}>Distrito</div>
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
                      <div style={fieldLabelStyle()}>Barrio</div>
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
                      <div style={fieldLabelStyle()}>Dirección</div>
                      <input
                        value={form.direccion_destino}
                        onChange={(e) => setForm((prev) => ({ ...prev, direccion_destino: e.target.value }))}
                        style={inputStyle()}
                        placeholder="Introduce la dirección"
                      />
                    </div>
                  </>
                ) : null}

                {/* Fecha disponibilidad (M35 en vivero) */}
                {form.destino_tipo === "Vivero" && form.tamano_destino === "M35" ? (
                  <div style={{ gridColumn: "span 2" }}>
                    <div style={fieldLabelStyle()}>
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

                {/* Préstamo checkbox */}
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
              </div>
            </div>

            {/* === SECCIÓN 2: PRODUCTO ====================================== */}
            <div style={sectionStyle()}>
              <div style={sectionTitleStyle()}>Producto</div>

              {/* Categoría + Subcategoría + Buscador, todos en la misma línea */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1.4fr",
                  gap: 12,
                }}
              >
                <div>
                  <div style={fieldLabelStyle()}>Categoría</div>
                  <select
                    value={filtroCategoria}
                    onChange={(e) => setFiltroCategoria(e.target.value)}
                    style={inputStyle()}
                  >
                    <option value="">Todas</option>
                    {categoriasDisponibles.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={fieldLabelStyle()}>Subcategoría</div>
                  <select
                    value={filtroSubcategoria}
                    onChange={(e) => setFiltroSubcategoria(e.target.value)}
                    style={inputStyle()}
                    disabled={!filtroCategoria || subcategoriasDisponibles.length === 0}
                  >
                    <option value="">
                      {!filtroCategoria
                        ? "Elige primero una categoría"
                        : subcategoriasDisponibles.length === 0
                        ? "Sin subcategorías"
                        : "Todas"}
                    </option>
                    {subcategoriasDisponibles.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={fieldLabelStyle()}>Buscar producto</div>
                  <input
                    type="search"
                    placeholder="🔍  Nombre científico o natural..."
                    value={productoSearch}
                    onChange={(e) => setProductoSearch(e.target.value)}
                    style={inputStyle()}
                  />
                </div>
              </div>

              {/* Select de producto (en línea aparte, ocupando todo el ancho) */}
              <div style={{ marginTop: 12 }}>
                <select
                  value={form.producto_id}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setForm((prev) => ({ ...prev, producto_id: newId }));
                    if (newId) {
                      // Auto-rellenar categoría/subcategoría con las del producto
                      // elegido, para que el usuario vea reflejada su elección en
                      // los filtros de arriba aunque no los hubiese tocado.
                      const prod = safeArray(productos).find(
                        (p) => String(p.id) === String(newId)
                      );
                      const cat = String(prod?.categoria || "").trim();
                      const sub = String(prod?.subcategoria || "").trim();
                      if (cat) setFiltroCategoria(cat);
                      if (sub) setFiltroSubcategoria(sub);
                      // Limpiar la búsqueda libre para que el select se colapse.
                      setProductoSearch("");
                    }
                  }}
                  style={inputStyle()}
                  size={
                    // Una vez hay producto seleccionado, colapsa siempre el select.
                    // Si no hay selección pero el usuario está filtrando (texto
                    // libre, categoría o subcategoría), expándelo para facilitar
                    // la búsqueda visual.
                    !form.producto_id &&
                    (productoSearch.trim() || filtroCategoria || filtroSubcategoria)
                      ? Math.min(Math.max(filteredProductos.length + 1, 4), 10)
                      : 1
                  }
                  disabled={!form.origen_tipo || !form.destino_tipo}
                >
                  <option value="">
                    {!form.origen_tipo || !form.destino_tipo
                      ? "Primero elige origen y destino"
                      : form.origen_tipo === "Vivero" && filteredProductos.length === 0
                      ? "No hay productos con stock disponible"
                      : "Seleccionar producto"}
                  </option>
                  {filteredProductos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {getProductDisplayName(p)}
                    </option>
                  ))}
                </select>
                {!form.origen_tipo || !form.destino_tipo ? (
                  <div style={{ fontSize: 12, color: "#92400e", marginTop: 4, fontWeight: 700 }}>
                    💡 Elige primero el origen y el destino del movimiento.
                  </div>
                ) : (productoSearch.trim() || filtroCategoria || filtroSubcategoria) ? (
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontWeight: 700 }}>
                    {filteredProductos.length === 0
                      ? form.origen_tipo === "Vivero"
                        ? "Ningún producto con stock coincide con los filtros."
                        : "Ningún producto coincide con los filtros."
                      : `${filteredProductos.length} ${filteredProductos.length === 1 ? "producto coincide" : "productos coinciden"}.`}
                  </div>
                ) : null}
              </div>
            </div>

            {/* === SECCIÓN 3: DETALLES DEL PRODUCTO ========================= */}
            {form.producto_id ? (() => {
              // Valor unificado del formato/tamaño: lo que entra al vivero sale
              // con el mismo formato, así que sólo necesitamos un campo. Damos
              // preferencia a tamano_origen cuando origen=Vivero (es el que
              // condiciona el stock); en entradas externas usamos tamano_destino.
              const formatoUnificado = form.tamano_origen || form.tamano_destino || "";

              // Opciones del select unificado:
              //   - Si origen=Vivero (salida/traslado) → solo tamaños con stock.
              //   - Sino (entrada al vivero desde externo) → opciones completas.
              const opcionesFormato =
                form.origen_tipo === "Vivero"
                  ? availableOriginSizes
                  : getFormatoOptions(formatoConfig);

              // Etiqueta de cantidad: para fitosanitarios/fertilizantes depende
              // del formato elegido (Líquido → Litros, resto → Kg); para el
              // resto es estática (Cantidad, Cantidad (m³), Cantidad (m),
              // Cantidad (unidades)…).
              const cantidadLabel =
                formatoConfig.kind === "formato_dropdown" &&
                typeof formatoConfig.getCantidadLabel === "function"
                  ? formatoConfig.getCantidadLabel(formatoUnificado)
                  : formatoConfig.cantidadLabel || "Cantidad";

              const cambiarFormato = (valor) => {
                setForm((prev) => ({
                  ...prev,
                  tamano_origen: valor,
                  tamano_destino: valor,
                  zona_origen: "",
                }));
              };

              const mostrarFormato = formatoConfig.kind !== "formato_fijo";

              return (
                <div style={sectionStyle()}>
                  <div style={sectionTitleStyle()}>Detalles del producto</div>

                  {/* Formato + Cantidad en la misma fila (2 columnas).
                      Si no hay campo Formato (formato_fijo), la cantidad ocupa
                      todo el ancho. */}
                  <div style={gridTwoCols()}>
                    {mostrarFormato ? (
                      <div>
                        <div style={fieldLabelStyle()}>{formatoConfig.label}</div>
                        <select
                          value={formatoUnificado}
                          onChange={(e) => cambiarFormato(e.target.value)}
                          style={inputStyle()}
                          disabled={opcionesFormato.length === 0}
                        >
                          <option value="">
                            {opcionesFormato.length === 0
                              ? `No hay ${formatoConfig.label.toLowerCase()}s disponibles`
                              : `Seleccionar ${formatoConfig.label.toLowerCase()}`}
                          </option>
                          {opcionesFormato.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    {formatoConfig.showCantidad ? (
                      <div style={mostrarFormato ? undefined : { gridColumn: "span 2" }}>
                        <div style={fieldLabelStyle()}>
                          {cantidadLabel}
                          {distribucionActiva ? " (calculada)" : ""}
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
                            min={formatoConfig.allowDecimals ? "0.001" : 1}
                            step={formatoConfig.allowDecimals ? "0.001" : "1"}
                            value={form.cantidad}
                            onChange={(e) => setForm((prev) => ({ ...prev, cantidad: e.target.value }))}
                            style={inputStyle()}
                            placeholder={formatoConfig.allowDecimals ? "0.00" : "0"}
                          />
                        )}
                      </div>
                    ) : null}

                    {/* Observaciones */}
                    <div style={{ gridColumn: "span 2" }}>
                      <div style={fieldLabelStyle()}>
                        Observaciones {formatoConfig.observacionesRequired && <span style={{ color: "#dc2626" }}>*</span>}
                      </div>
                      <textarea
                        value={form.observaciones}
                        onChange={(e) => setForm((prev) => ({ ...prev, observaciones: e.target.value }))}
                        style={{
                          ...inputStyle(),
                          minHeight: 100,
                          resize: "vertical",
                          ...(formatoConfig.observacionesRequired && !form.observaciones?.trim()
                            ? { borderColor: "#dc2626", background: "#fef2f2" }
                            : {}),
                        }}
                        placeholder={
                          formatoConfig.observacionesHint ||
                          "Información adicional del movimiento"
                        }
                      />
                      {formatoConfig.observacionesHint && (
                        <div style={{ marginTop: 6, fontSize: 12, color: "#92400e", fontWeight: 700 }}>
                          💡 {formatoConfig.observacionesHint}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })() : null}
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
                    <div style={{ fontWeight: 800 }}>{form.cantidad ? formatCantidad(form.cantidad) : "—"}</div>
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
                    Total unidades: {formatCantidad(batchPayloads.reduce((s, p) => s + Number(p.cantidad || 0), 0))}
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
                          {formatCantidad(p.cantidad)} ud {p.zona_origen ? `· zona ${p.zona_origen}` : ""}
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
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 24,
        overflowY: "auto",
        overscrollBehavior: "contain",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(980px, 95vw)",
          background: "white",
          borderRadius: 24,
          boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
          border: "1px solid rgba(15,23,42,0.10)",
          display: "flex",
          flexDirection: "column",
          marginTop: "auto",
          marginBottom: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "20px 22px 10px",
            display: "flex",
            alignItems: "start",
            justifyContent: "space-between",
            gap: 16,
            position: "sticky",
            top: 0,
            background: "white",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            zIndex: 2,
            borderBottom: "1px solid rgba(15,23,42,0.05)",
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

        <div style={{ padding: "14px 22px", position: "sticky", top: 96, background: "white", zIndex: 1 }}>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por ID, producto, destino, dirección..."
            style={inputStyle()}
          />
        </div>

        <div style={{ padding: "0 22px 22px" }}>
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
  const [detalleMovimiento, setDetalleMovimiento] = useState(null);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");

  // Lista de zonas reales del vivero, cargada dinámicamente desde el servidor
  // (donde el editor del mapa las persiste). Si la carga falla, se usa el
  // fallback estático DEFAULT_ZONAS. Siempre ordenadas de forma natural
  // (1, 2, 3a, 3b, ..., 10a, 10b, 11, 12) independientemente del orden con
  // que vengan del servidor.
  const [zonasDisponibles, setZonasDisponibles] = useState(() =>
    ensureZonasEspeciales(DEFAULT_ZONAS)
  );

  useEffect(() => {
    let cancelled = false;
    loadZonasFromServer()
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          const ids = data
            .map((z) => z.apiId || z.id)
            .filter(Boolean)
            // Acepta "zona-3a", "zona3a", "ZONA-3A", "3a" y los normaliza a "3a".
            .map((id) => String(id).trim().toLowerCase().replace(/^zona[-_]?/i, ""));
          const seen = new Set();
          const unique = ids.filter((id) => {
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          if (unique.length > 0) {
            // ensureZonasEspeciales añade Almacén y Zona Compostaje si no
            // vienen del servidor, garantizando que estén siempre disponibles.
            setZonasDisponibles(ensureZonasEspeciales(unique));
          }
        }
      })
      .catch(() => {
        // Mantén el fallback estático (ya ordenado, con zonas especiales).
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
              {zonasDisponibles.map((zona) => (
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
                  <th style={{ ...thStyle(), width: "110px" }}>Usuario</th>
                  <th style={{ ...thStyle(), width: "110px" }}>UUID lote</th>
                  <th style={{ ...thStyle(), width: "75px" }}>Pedido</th>
                  <th style={{ ...thStyle(), width: "80px" }}>Detalles</th>
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
                        {formatCantidad(m.cantidad)}
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
                          minWidth: 110,
                          maxWidth: 110,
                          width: 110,
                        }}
                      >
                        <div
                          title={formatUsername(m.created_by) || "—"}
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: "#1e3a8a",
                            fontWeight: 800,
                          }}
                        >
                          {formatUsername(m.created_by) || "—"}
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
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span style={{ fontWeight: 900, color: "#1e3a8a" }}>
                          {m.pedido_id ? `#${m.pedido_id}` : "—"}
                        </span>
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
                        <button
                          type="button"
                          onClick={() => setDetalleMovimiento(m)}
                          title="Ver todos los detalles del movimiento"
                          style={{
                            border: "1px solid rgba(15,23,42,0.10)",
                            background: "#0f5132",
                            color: "#ffffff",
                            borderRadius: 10,
                            padding: "6px 10px",
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          Ver
                        </button>
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
        zonas={zonasDisponibles}
      />

      <MovimientoDetalleModal
        movimiento={detalleMovimiento}
        onClose={() => setDetalleMovimiento(null)}
      />
    </div>
  );
}

// =========================================================================
// MOVIMIENTO DETALLE MODAL
// =========================================================================
function MovimientoDetalleModal({ movimiento, onClose }) {
  if (!movimiento) return null;

  const m = movimiento;
  const tipo = m.tipo_movimiento || "—";
  const fmt = (d) => (d ? new Date(d).toLocaleString("es-ES") : "—");
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-ES") : "—");

  const Row = ({ label, value, mono = false }) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid rgba(15,23,42,0.06)",
      }}
    >
      <div style={{ color: "#64748b", fontWeight: 700, fontSize: 13 }}>{label}</div>
      <div
        style={{
          color: "#0f172a",
          fontWeight: 700,
          fontSize: 14,
          fontFamily: mono
            ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
            : "inherit",
          wordBreak: "break-word",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );

  const direccion = [m.direccion_destino, m.barrio_destino, m.distrito_destino, m.cp_destino]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.55)",
        zIndex: 2500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(680px, 96vw)",
          maxHeight: "90vh",
          overflow: "auto",
          background: "white",
          borderRadius: 20,
          padding: 24,
          boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
              Detalle del movimiento #{m.id}
            </div>
            <div style={{ color: "#64748b", fontWeight: 700, marginTop: 4 }}>
              Registrado por <strong style={{ color: "#1e3a8a" }}>{formatUsername(m.created_by) || "—"}</strong>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 0,
              background: "#0f5132",
              color: "#fff",
              padding: "8px 16px",
              borderRadius: 10,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </div>

        <div>
          <Row label="Fecha movimiento" value={fmt(m.fecha_movimiento)} />
          <Row label="Tipo" value={tipo} />
          <Row label="Producto" value={m.producto_nombre_cientifico || m.nombre_cientifico || `Producto #${m.producto_id}`} />
          <Row label="Cantidad" value={formatCantidad(m.cantidad)} />

          <Row label="Origen" value={`${m.origen_tipo || "—"}${m.zona_origen ? " · Zona " + m.zona_origen : ""}${m.tamano_origen ? " · " + m.tamano_origen : ""}`} />
          <Row label="Destino" value={`${m.destino_tipo || "—"}${m.zona_destino ? " · Zona " + m.zona_destino : ""}${m.tamano_destino ? " · " + m.tamano_destino : ""}`} />

          {direccion && <Row label="Dirección destino" value={direccion} />}

          <Row label="Préstamo" value={m.es_prestamo ? "Sí" : m.es_devolucion ? "Devolución" : "No"} />

          <Row label="UUID lote" value={m.uuid_lote} mono />
          <Row label="Pedido asociado" value={m.pedido_id ? `#${m.pedido_id}` : "—"} />

          <Row label="Fecha caducidad" value={fmtDate(m.fecha_caducidad)} />
          <Row label="Días caducidad aplicados" value={m.dias_caducidad_aplicados ?? "—"} />
          <Row label="Fecha disponibilidad" value={fmtDate(m.fecha_disponibilidad)} />

          <Row label="Observaciones" value={m.observaciones || m.nota || "—"} />
        </div>
      </div>
    </div>
  );
}