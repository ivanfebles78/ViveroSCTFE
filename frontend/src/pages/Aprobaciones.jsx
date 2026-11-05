import React, { useEffect, useMemo, useState, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { getPedidos, getProductos, updatePedido, aprobarPedido, denegarPedido, reabrirPedido, decidirPedido, decidirModificacionPedido, descargarPedidoPdf } from "../api/api";
import { formatUsername } from "../utils/format";
import { formatCantidad } from "../utils/numero";

// Per-item state pill colour map.  Mirrors the global `badge()` helper
// but tuned for the smaller inline pills inside the items table.
const itemBadge = (estadoItem) => {
  const e = String(estadoItem || "RESERVA").toUpperCase();
  const base = {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 8px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 11,
    letterSpacing: ".02em",
    border: "1px solid rgba(15,23,42,0.08)",
  };
  if (e === "APROBADO") return { ...base, background: "rgba(16,185,129,0.14)", color: "#065f46", borderColor: "rgba(16,185,129,0.30)" };
  if (e === "DENEGADO") return { ...base, background: "rgba(239,68,68,0.12)",  color: "#991b1b", borderColor: "rgba(239,68,68,0.30)" };
  // RESERVA — neutral amber
  return { ...base, background: "rgba(245,158,11,0.12)", color: "#92400e", borderColor: "rgba(245,158,11,0.30)" };
};
const itemEstado = (it) => String(it?.estado_item || "RESERVA").toUpperCase();

const ESTADO_FILTERS = [
  { value: "TODOS", label: "Todos" },
  { value: "PENDIENTES", label: "Pendientes (Reserva + Parcial)" },
  { value: "RESERVA", label: "Reserva" },
  { value: "APROBADO_PARCIAL", label: "Aprobado parcial" },
  { value: "APROBADO", label: "Aprobado" },
  { value: "DENEGADO", label: "Denegado" },
  { value: "SERVIDO", label: "Servido" },
  { value: "CANCELADO", label: "Cancelado" },
  { value: "CADUCADO", label: "Caducado" },
];

// States where a manager can still take row/item-level actions because at
// least one item is still in RESERVA.  Mirrors backend DECIDABLE_STATES.
const DECIDABLE_FRONTEND = new Set(["RESERVA", "APROBADO_PARCIAL"]);

const safeArray = (x) => (Array.isArray(x) ? x : []);

// ── Disponibilidad / reglas de tamaño (espejo del backend) ──────────────
const _normTxt = (s) =>
  String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const _normTam = (s) => {
  const r = String(s || "").trim().toLowerCase();
  return r === "m30" ? "m35" : r;
};
// ¿Ese tamaño está permitido para pedidos de ese producto? (reglas de planta)
function _tamanoDisponiblePlanta(categoria, subcategoria, tamano) {
  if (!["planta", "plantas"].includes(_normTxt(categoria))) return true;
  const t = _normTam(tamano);
  if (t === "" || t === "semillero") return false;
  const s = _normTxt(subcategoria);
  if (s === "arbusto") return t === "m20" || t === "m35";
  if (s === "palmera") return t === "m20" || t === "m35";
  if (s === "arbol") return t === "m35";
  return t === "m12" || t === "m20" || t === "m35";
}
const _prodNombre = (p) =>
  p?.nombre_cientifico || p?.producto_nombre_cientifico || p?.nombre || p?.nombre_natural || `Producto #${p?.id}`;
// Disponibilidad por tamaño que da el backend (stock − reservado por pedidos vivos).
const _dispBySize = (p) => (p && (p.disponible_by_size || p.stock_by_size)) || {};

const selMini = {
  height: 42,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid rgba(15,23,42,0.18)",
  background: "#fff",
  fontWeight: 700,
  color: "#0f172a",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
  width: "100%",
};
const btnGhostMini = {
  padding: "9px 16px",
  borderRadius: 10,
  border: "1px solid rgba(15,23,42,0.18)",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 900,
  fontSize: 13,
  cursor: "pointer",
};

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

const badge = (estado) => {
  const e = estadoNormalizado(estado);
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid rgba(15,23,42,0.08)",
    minWidth: 108,
  };

  if (e === "APROBADO") return { ...base, background: "rgba(16,185,129,0.12)", color: "#065f46" };
  if (e === "APROBADO_PARCIAL") return { ...base, background: "rgba(20,184,166,0.14)", color: "#115e59", borderColor: "rgba(20,184,166,0.28)" };
  if (e === "DENEGADO") return { ...base, background: "rgba(239,68,68,0.10)", color: "#991b1b" };
  if (e === "SERVIDO") return { ...base, background: "rgba(59,130,246,0.10)", color: "#1e3a8a" };
  if (e === "CANCELADO") return { ...base, background: "rgba(148,163,184,0.20)", color: "#334155" };
  if (e === "CADUCADO") return { ...base, background: "rgba(100,116,139,0.18)", color: "#475569" };
  return { ...base, background: "rgba(245,158,11,0.12)", color: "#92400e" };
};

// Pretty label for the badge — APROBADO_PARCIAL is otherwise unreadable.
const estadoLabel = (estado) => {
  const e = estadoNormalizado(estado);
  if (e === "APROBADO_PARCIAL") return "APROBADO PARCIAL";
  return e || "—";
};

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

function filterControlStyle() {
  return {
    width: "100%",
    height: 48,
    minHeight: 48,
    maxHeight: 48,
    padding: "0 14px",
    borderRadius: 14,
    border: "2px solid #334155",
    background: "#f8fafc",
    fontWeight: 700,
    fontSize: 14,
    lineHeight: "48px",
    color: "#0f172a",
    boxSizing: "border-box",
    outline: "none",
    margin: 0,
    display: "block",
  };
}

function filterSelectStyle() {
  return {
    ...filterControlStyle(),
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    lineHeight: "normal",
    backgroundImage:
      "linear-gradient(45deg, transparent 50%, #334155 50%), linear-gradient(135deg, #334155 50%, transparent 50%)",
    backgroundPosition:
      "calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px)",
    backgroundSize: "6px 6px, 6px 6px",
    backgroundRepeat: "no-repeat",
    paddingRight: 34,
  };
}

function filterFieldStyle() {
  return {
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    alignSelf: "start",
    minWidth: 0,
  };
}

function filterLabelStyle() {
  return {
    fontSize: 12,
    fontWeight: 900,
    color: "#64748b",
    marginBottom: 6,
    lineHeight: "16px",
    minHeight: 16,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  };
}

// Colores intensos y distintos por destino, para diferenciarlos bien.
const DESTINO_COLORS = [
  { bg: "#1e3a8a", fg: "#ffffff" }, // azul
  { bg: "#065f46", fg: "#ffffff" }, // verde
  { bg: "#9a3412", fg: "#ffffff" }, // naranja oscuro
  { bg: "#6b21a8", fg: "#ffffff" }, // morado
  { bg: "#155e75", fg: "#ffffff" }, // cyan oscuro
  { bg: "#9f1239", fg: "#ffffff" }, // rojo/rosa
  { bg: "#3f6212", fg: "#ffffff" }, // oliva
  { bg: "#854d0e", fg: "#ffffff" }, // ámbar oscuro
  { bg: "#5b21b6", fg: "#ffffff" }, // violeta
  { bg: "#0f766e", fg: "#ffffff" }, // teal
];
const destinoColorAt = (i) => DESTINO_COLORS[((i % DESTINO_COLORS.length) + DESTINO_COLORS.length) % DESTINO_COLORS.length];

function DetallePedidoModal({ pedido, productos = [], onClose, canApprove = false, canReopen = false, onPedidoUpdated, onMessage }) {
  // Pending decisions: { [item.id]: "aprobar" | "denegar" }.  Lives only
  // in the modal — nothing hits the DB until the manager presses
  // "Confirmar decisiones".  Closing the modal discards them.
  const [pendingDecisions, setPendingDecisions] = useState({});
  const [motivo, setMotivo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Destinos colapsados (por texto de destino) para poder plegar/desplegar.
  const [colapsados, setColapsados] = useState({});
  const toggleColapsado = (dst) => setColapsados((p) => ({ ...p, [dst]: !p[dst] }));
  // Decisiones sobre los cambios de una solicitud de modificación pendiente.
  const [modDecisions, setModDecisions] = useState({}); // { [cambio.id]: "aprobar" | "denegar" }
  const [modSubmitting, setModSubmitting] = useState(false);

  // ── Edición del pedido (solo manager/admin sobre pedidos de salida en RESERVA) ──
  const [editing, setEditing] = useState(false);
  // Copia de trabajo de las líneas mientras se edita.
  const [editLines, setEditLines] = useState([]); // [{key, producto_id, tamano, nombre, cantidad, destino, matriculas}]
  const [savingEdit, setSavingEdit] = useState(false);
  const [reabriendo, setReabriendo] = useState(false);
  // Panel "Añadir producto".
  const [addOpen, setAddOpen] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addCat, setAddCat] = useState("");
  const [addSub, setAddSub] = useState("");
  const [addProductId, setAddProductId] = useState("");
  const [addTam, setAddTam] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addDestIdx, setAddDestIdx] = useState(0);

  // Disponibilidad por (producto, tamaño) que da el backend.
  const dispMap = useMemo(() => {
    const m = new Map();
    for (const p of safeArray(productos)) {
      const d = _dispBySize(p);
      for (const [t, q] of Object.entries(d)) m.set(`${Number(p.id)}|${_normTam(t)}`, Math.max(0, Number(q || 0)));
    }
    return m;
  }, [productos]);

  // Suma original de este pedido por (producto, tamaño) — para devolver su propia
  // reserva al "pool" disponible al editar.
  const origSumByKey = useMemo(() => {
    const m = new Map();
    for (const it of safeArray(pedido?.items)) {
      const k = `${Number(it.producto_id)}|${_normTam(it.tamano)}`;
      m.set(k, (m.get(k) || 0) + Number(it.cantidad || 0));
    }
    return m;
  }, [pedido]);

  // Productos con stock (al menos un tamaño permitido y con disponibilidad > 0),
  // para el buscador de "Añadir producto".
  const productosConStock = useMemo(() => {
    return safeArray(productos)
      .map((p) => {
        const d = _dispBySize(p);
        const sizes = Object.entries(d)
          .filter(([t, q]) => Number(q || 0) > 0 && _tamanoDisponiblePlanta(p.categoria, p.subcategoria, t))
          .map(([t]) => t);
        return { ...p, _sizes: sizes };
      })
      .filter((p) => p._sizes.length > 0);
  }, [productos]);

  // Reset local state whenever a different pedido is opened.
  useEffect(() => {
    setPendingDecisions({});
    setMotivo("");
    setModDecisions({});
    setEditing(false);
    setEditLines([]);
    setAddOpen(false);
  }, [pedido?.id]);

  if (!pedido) return null;

  const fmtFecha = (v) => {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(d);
  };

  const items = safeArray(pedido.items);
  const hasApproved = items.some((it) => {
    const st = itemEstado(it);
    return st === "APROBADO" || st === "SERVIDO";
  });
  // Show the PDF button in any decided state — APROBADO, APROBADO_PARCIAL,
  // SERVIDO and DENEGADO.  Even fully-denied pedidos have audit value
  // (motivo de denegación + line detail).  Blocked only for pristine
  // RESERVA / pedidos with no decision recorded yet.
  const estadoNormPedido = String(pedido.estado || "RESERVA").toUpperCase();
  const canShowPdf =
    estadoNormPedido === "APROBADO" ||
    estadoNormPedido === "APROBADO_PARCIAL" ||
    estadoNormPedido === "SERVIDO" ||
    estadoNormPedido === "DENEGADO" ||
    hasApproved;

  // Items still in RESERVA — these are the ones the manager must decide on.
  const reservaItems     = items.filter((it) => itemEstado(it) === "RESERVA");
  const pendingCount     = reservaItems.length;
  const decidedLocalCount = reservaItems.filter((it) => pendingDecisions[it.id]).length;
  const allDecided       = pendingCount > 0 && decidedLocalCount === pendingCount;
  const anyDenied        = reservaItems.some((it) => pendingDecisions[it.id] === "denegar");

  const setDecision = (itemId, decision) => {
    setPendingDecisions((prev) => ({ ...prev, [itemId]: decision }));
  };

  const submitDecisions = async () => {
    if (!allDecided || submitting) return;
    const approved_item_ids = [];
    const denied_item_ids   = [];
    for (const it of reservaItems) {
      if (pendingDecisions[it.id] === "aprobar") approved_item_ids.push(it.id);
      else if (pendingDecisions[it.id] === "denegar") denied_item_ids.push(it.id);
    }
    setSubmitting(true);
    try {
      const updated = await decidirPedido(pedido.id, {
        approved_item_ids,
        denied_item_ids,
        motivo_denegacion: denied_item_ids.length ? (motivo.trim() || null) : null,
      });
      if (onPedidoUpdated) onPedidoUpdated(updated);
      if (onMessage) {
        const parts = [];
        if (approved_item_ids.length) parts.push(`${approved_item_ids.length} aprobado(s)`);
        if (denied_item_ids.length)   parts.push(`${denied_item_ids.length} denegado(s)`);
        // Surface any email-delivery warnings returned by the backend
        // (e.g. solicitante / técnico / proveedor without email).
        const warns = Array.isArray(updated?.email_warnings) ? updated.email_warnings : [];
        const base = `Pedido #${pedido.id}: ${parts.join(" · ")}.`;
        onMessage(warns.length ? `${base} Aviso: ${warns.join(" · ")}` : base);
      }
      setPendingDecisions({});
      setMotivo("");
    } catch (e) {
      if (onMessage) {
        onMessage(e?.response?.data?.detail || e?.message || "Error aplicando las decisiones");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Solicitud de modificación pendiente (si la hay) ──
  const mod = pedido.modificacion_pendiente || null;
  const modCambios = safeArray(mod?.cambios);
  const modAllDecided = modCambios.length > 0 && modCambios.every((c) => modDecisions[c.id]);
  const setModDecision = (cid, d) => setModDecisions((p) => ({ ...p, [cid]: d }));
  const modLabel = (c) => {
    const nombre = c.producto_nombre_cientifico || c.producto_nombre_natural || `Producto #${c.producto_id}`;
    const tam = c.tamano ? ` · ${c.tamano}` : "";
    if (c.tipo === "add") return { txt: `Añadir: ${nombre}${tam} · ${formatCantidad(c.cantidad_propuesta)} uds`, color: "#065f46" };
    if (c.tipo === "remove") return { txt: `Quitar: ${nombre}${tam} (tenía ${formatCantidad(c.cantidad_actual)})`, color: "#991b1b" };
    const dir = Number(c.cantidad_propuesta) >= Number(c.cantidad_actual) ? "▲" : "▼";
    return { txt: `${dir} ${nombre}${tam}: ${formatCantidad(c.cantidad_actual)} → ${formatCantidad(c.cantidad_propuesta)} uds`, color: "#1e3a8a" };
  };
  const submitModDecisions = async () => {
    if (!mod || !modAllDecided || modSubmitting) return;
    const approved_item_ids = [];
    const denied_item_ids = [];
    for (const c of modCambios) {
      if (modDecisions[c.id] === "aprobar") approved_item_ids.push(c.id);
      else if (modDecisions[c.id] === "denegar") denied_item_ids.push(c.id);
    }
    setModSubmitting(true);
    try {
      const updated = await decidirModificacionPedido(mod.id, { approved_item_ids, denied_item_ids });
      if (onPedidoUpdated) onPedidoUpdated(updated);
      if (onMessage) onMessage(`Modificación del pedido #${pedido.id} resuelta: ${approved_item_ids.length} aprobado(s) · ${denied_item_ids.length} denegado(s).`);
      setModDecisions({});
    } catch (e) {
      if (onMessage) onMessage(e?.response?.data?.detail || e?.message || "Error decidiendo la modificación");
    } finally {
      setModSubmitting(false);
    }
  };

  const downloadPdf = async () => {
    try {
      await descargarPedidoPdf(pedido.id);
    } catch (e) {
      if (onMessage) {
        onMessage(e?.response?.data?.detail || e?.message || "Error descargando el PDF");
      }
    }
  };
  const solicitante =
    formatUsername(
      pedido?.solicitante_username || pedido?.solicitante || pedido?.created_by || pedido?.usuario || ""
    ) || "—";

  const destinoDeItem = (it) =>
    [it?.distrito_destino, it?.barrio_destino, it?.direccion_destino].filter(Boolean).join(" · ");

  const destino =
    pedido?.tipo === "reposicion"
      ? "Vivero"
      : [pedido?.distrito_destino, pedido?.barrio_destino, pedido?.direccion_destino]
          .filter(Boolean)
          .join(" · ") || "—";

  // ¿El pedido reparte material en varios destinos distintos?
  const destinosUnicos = Array.from(
    new Set(items.map(destinoDeItem).filter(Boolean))
  );
  const variosDestinos = pedido?.tipo !== "reposicion" && destinosUnicos.length > 1;

  // Agrupa las líneas por destino (en orden de aparición) para mostrarlas
  // agrupadas visualmente, manteniendo la decisión por línea.
  const gruposDestino = (() => {
    const order = [];
    const map = new Map();
    for (const it of items) {
      const dst = destinoDeItem(it) || destino;
      if (!map.has(dst)) {
        map.set(dst, []);
        order.push(dst);
      }
      map.get(dst).push(it);
    }
    return order.map((dst) => ({ destino: dst, items: map.get(dst) }));
  })();

  // ── Edición: solo pedidos de SALIDA en estado RESERVA y con permiso ──
  const tipoPedido = (pedido?.tipo || "salida").toString().trim().toLowerCase();
  const editable =
    canApprove && estadoNormPedido === "RESERVA" && tipoPedido === "salida" && !mod;

  // Reapertura (solo admin): devuelve a RESERVA un pedido denegado/cancelado/
  // caducado sin material servido, para poder revisarlo y aprobarlo de nuevo.
  const algoServido = items.some((it) => Number(it.cantidad_servida || 0) > 0);
  const reabrible =
    canReopen && ["DENEGADO", "CANCELADO", "CADUCADO"].includes(estadoNormPedido) && !algoServido;
  const reabrir = async () => {
    if (reabriendo) return;
    if (!window.confirm(
      `¿Reabrir el pedido #${pedido.id}?\n\n` +
      "Volverá a estado RESERVA (pendiente) para poder revisarlo y aprobarlo de nuevo."
    )) return;
    setReabriendo(true);
    try {
      const updated = await reabrirPedido(pedido.id);
      if (onPedidoUpdated) onPedidoUpdated(updated);
      if (onMessage) onMessage(`Pedido #${pedido.id} reabierto: vuelve a estar pendiente de decisión.`);
    } catch (e) {
      if (onMessage) onMessage(e?.response?.data?.detail || e?.message || "No se pudo reabrir el pedido.");
    } finally {
      setReabriendo(false);
    }
  };

  // Lista de destinos del pedido (para asignar los productos añadidos).
  const destinosList = (() => {
    const seen = new Map();
    for (const it of items) {
      const label = destinoDeItem(it);
      const key = label || "__main__";
      if (!seen.has(key)) {
        seen.set(key, {
          label: label || destino,
          distrito: it.distrito_destino ?? pedido.distrito_destino ?? null,
          barrio: it.barrio_destino ?? pedido.barrio_destino ?? null,
          direccion: it.direccion_destino ?? pedido.direccion_destino ?? null,
        });
      }
    }
    if (seen.size === 0) {
      seen.set("__main__", {
        label: destino,
        distrito: pedido.distrito_destino ?? null,
        barrio: pedido.barrio_destino ?? null,
        direccion: pedido.direccion_destino ?? null,
      });
    }
    return Array.from(seen.values());
  })();

  const poolFor = (pid, tam) => {
    const k = `${Number(pid)}|${_normTam(tam)}`;
    return (dispMap.get(k) || 0) + (origSumByKey.get(k) || 0);
  };
  const editUsedByKey = (pid, tam, exceptIdx = -1) => {
    const k = `${Number(pid)}|${_normTam(tam)}`;
    let s = 0;
    editLines.forEach((l, i) => {
      if (i !== exceptIdx && `${Number(l.producto_id)}|${_normTam(l.tamano)}` === k) s += Number(l.cantidad || 0);
    });
    return s;
  };
  const maxForLine = (idx) => {
    const l = editLines[idx];
    if (!l) return 0;
    return Math.max(0, poolFor(l.producto_id, l.tamano) - editUsedByKey(l.producto_id, l.tamano, idx));
  };

  const startEdit = () => {
    setEditLines(
      safeArray(pedido.items).map((it, i) => ({
        key: String(it.id ?? `k${i}`),
        producto_id: Number(it.producto_id),
        tamano: it.tamano,
        nombre:
          it.producto_nombre_cientifico || it.producto_nombre || it.producto_nombre_natural || `Producto #${it.producto_id}`,
        cantidad: Number(it.cantidad || 0),
        destino: {
          distrito: it.distrito_destino ?? null,
          barrio: it.barrio_destino ?? null,
          direccion: it.direccion_destino ?? null,
        },
        matriculas: Array.isArray(it.matriculas) ? it.matriculas.slice() : null,
      }))
    );
    setEditing(true);
    setAddOpen(false);
  };
  const cancelEdit = () => {
    setEditing(false);
    setEditLines([]);
    setAddOpen(false);
  };
  const setLineQty = (idx, val) => {
    const max = maxForLine(idx);
    let n = Math.floor(Number(val) || 0);
    if (n < 1) n = 1;
    if (max > 0 && n > max) n = max;
    setEditLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? { ...l, cantidad: n, matriculas: Array.isArray(l.matriculas) ? l.matriculas.slice(0, n) : l.matriculas }
          : l
      )
    );
  };
  const removeLine = (idx) => setEditLines((prev) => prev.filter((_, i) => i !== idx));

  // Buscador de "Añadir producto".
  const addCats = Array.from(new Set(productosConStock.map((p) => String(p.categoria || "").trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, "es")
  );
  const addSubs = Array.from(
    new Set(
      productosConStock
        .filter((p) => !addCat || String(p.categoria || "").trim() === addCat)
        .map((p) => String(p.subcategoria || "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "es"));
  const addFiltered = productosConStock
    .filter((p) => {
      if (addCat && String(p.categoria || "").trim() !== addCat) return false;
      if (addSub && String(p.subcategoria || "").trim() !== addSub) return false;
      const txt = addSearch.trim().toLowerCase();
      if (!txt) return true;
      return [p.nombre_cientifico, p.nombre_natural, p.nombre, p.categoria, p.subcategoria]
        .map((x) => String(x || "").toLowerCase())
        .some((x) => x.includes(txt));
    })
    .sort((a, b) => String(_prodNombre(a)).localeCompare(String(_prodNombre(b)), "es"));
  const addProductObj = productosConStock.find((p) => String(p.id) === String(addProductId)) || null;
  const addSizes = addProductObj ? addProductObj._sizes : [];
  const addDisp = addProductObj && addTam ? Math.max(0, poolFor(addProductObj.id, addTam) - editUsedByKey(addProductObj.id, addTam)) : 0;

  const confirmAdd = () => {
    if (!addProductObj || !addTam) return;
    const n = Math.floor(Number(addQty) || 0);
    if (n < 1) {
      if (onMessage) onMessage("Indica una cantidad válida.");
      return;
    }
    if (n > addDisp) {
      if (onMessage) onMessage(`Solo hay ${addDisp} disponibles de ${_prodNombre(addProductObj)} (${addTam}).`);
      return;
    }
    const dest = destinosList[addDestIdx] || destinosList[0];
    setEditLines((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        producto_id: Number(addProductObj.id),
        tamano: addTam,
        nombre: _prodNombre(addProductObj),
        cantidad: n,
        destino: { distrito: dest?.distrito ?? null, barrio: dest?.barrio ?? null, direccion: dest?.direccion ?? null },
        matriculas: null,
      },
    ]);
    // Reset del formulario de añadir (mantiene cat/subcat para añadir varios).
    setAddProductId("");
    setAddTam("");
    setAddQty("1");
    setAddOpen(false);
  };

  const saveEdit = async () => {
    if (savingEdit) return;
    if (editLines.length === 0) {
      if (onMessage) onMessage("El pedido debe tener al menos una línea.");
      return;
    }
    const payload = {
      nota: pedido.nota ?? null,
      distrito_destino: pedido.distrito_destino ?? null,
      barrio_destino: pedido.barrio_destino ?? null,
      direccion_destino: pedido.direccion_destino ?? null,
      items: editLines.map((l) => {
        const item = {
          producto_id: Number(l.producto_id),
          tamano: l.tamano,
          cantidad: Number(l.cantidad),
          distrito_destino: l.destino?.distrito ?? null,
          barrio_destino: l.destino?.barrio ?? null,
          direccion_destino: l.destino?.direccion ?? null,
        };
        if (Array.isArray(l.matriculas) && l.matriculas.some((m) => m)) {
          item.matriculas = l.matriculas.slice(0, Math.floor(Number(l.cantidad) || 0)).map((m) => String(m || ""));
        }
        return item;
      }),
    };
    setSavingEdit(true);
    try {
      const updated = await updatePedido(pedido.id, payload);
      if (onPedidoUpdated) onPedidoUpdated(updated);
      if (onMessage) onMessage(`Pedido #${pedido.id} actualizado.`);
      setEditing(false);
      setEditLines([]);
      setAddOpen(false);
    } catch (e) {
      if (onMessage) onMessage(e?.response?.data?.detail || e?.message || "No se pudo guardar el pedido.");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.55)",
        zIndex: 1400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(880px, 96vw)",
          maxHeight: "90vh",
          overflow: "hidden",
          background: "white",
          borderRadius: 24,
          boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
        }}
      >
        <div style={{ padding: "20px 22px", borderBottom: "1px solid rgba(15,23,42,0.08)", display: "flex", justifyContent: "space-between", alignItems: "start", gap: 14 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>
              Detalle del pedido #{pedido.id}
            </div>
            <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
              <span
                style={{
                  display: "inline-flex",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                  background: pedido.tipo === "reposicion" ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.10)",
                  color: pedido.tipo === "reposicion" ? "#92400e" : "#1e3a8a",
                  border: "1px solid rgba(15,23,42,0.08)",
                  marginRight: 8,
                }}
              >
                {pedido.tipo === "reposicion" ? "Reposición" : "Salida"}
              </span>
              <span style={badge(pedido.estado)}>{estadoLabel(pedido.estado)}</span>
              {pedido.bloqueado ? (
                <span title="Materiales bloqueados: reserva con caducidad de 1 año" style={{ display: "inline-flex", marginLeft: 8, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 900, background: "rgba(180,83,9,0.12)", color: "#92400e", border: "1px solid rgba(180,83,9,0.30)" }}>
                  🔒 Bloqueado
                </span>
              ) : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {reabrible ? (
              <button
                onClick={reabrir}
                disabled={reabriendo}
                title="Reabrir el pedido: vuelve a RESERVA para poder revisarlo y aprobarlo (solo admin)"
                style={{
                  padding: "10px 16px",
                  borderRadius: 14,
                  fontWeight: 900,
                  cursor: reabriendo ? "wait" : "pointer",
                  background: "#0f766e",
                  color: "#fff",
                  border: "2px solid #0b5a54",
                  boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
                }}
              >
                {reabriendo ? "Reabriendo…" : "↩ Reabrir pedido"}
              </button>
            ) : null}
            <button
              onClick={onClose}
              style={{
                padding: "10px 16px",
                borderRadius: 14,
                fontWeight: 900,
                cursor: "pointer",
                background: "#f59e0b",
                color: "#111827",
                border: "2px solid #000",
                boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
              }}
            >
              Cerrar
            </button>
          </div>
        </div>

        <div style={{ padding: "16px 22px", overflow: "auto" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div style={{ padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)" }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, textTransform: "uppercase" }}>Fecha creación</div>
              <div style={{ marginTop: 4, fontWeight: 900, color: "#0f172a" }}>{fmtFecha(pedido.created_at)}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)" }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, textTransform: "uppercase" }}>Solicitante</div>
              <div style={{ marginTop: 4, fontWeight: 900, color: "#0f172a" }}>{solicitante}</div>
            </div>
            <div style={{ gridColumn: "span 2", padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)" }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900, textTransform: "uppercase" }}>Destino</div>
              <div style={{ marginTop: 4, fontWeight: 900, color: "#0f172a" }}>
                {variosDestinos ? `${destinosUnicos.length} destinos (productos agrupados abajo)` : destino}
              </div>
            </div>
            {pedido.nota ? (
              <div style={{ gridColumn: "span 2", padding: 12, borderRadius: 12, background: "#fffbeb", border: "1px solid rgba(245,158,11,0.25)" }}>
                <div style={{ fontSize: 12, color: "#92400e", fontWeight: 900, textTransform: "uppercase" }}>Nota</div>
                <div style={{ marginTop: 4, fontWeight: 700, color: "#0f172a" }}>{pedido.nota}</div>
              </div>
            ) : null}
          </div>

          {mod && (
            <div style={{ marginBottom: 14, padding: 14, borderRadius: 14, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.30)" }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#5b21b6" }}>✎ Solicitud de modificación pendiente</div>
              <div style={{ fontSize: 12.5, color: "#6d28d9", fontWeight: 700, marginTop: 2 }}>
                Pedida por {formatUsername(mod.created_by) || "—"}. El pedido está congelado hasta que se decida.
              </div>
              {mod.nota ? (
                <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 9, background: "#fff", border: "1px solid rgba(139,92,246,0.2)", fontWeight: 700, color: "#0f172a", fontSize: 13 }}>“{mod.nota}”</div>
              ) : null}
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {modCambios.map((c) => {
                  const lab = modLabel(c);
                  const dec = modDecisions[c.id];
                  return (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: "#fff", border: "1px solid rgba(15,23,42,0.08)" }}>
                      <div style={{ flex: 1, minWidth: 0, fontWeight: 800, color: lab.color, fontSize: 13 }}>{lab.txt}</div>
                      {canApprove ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => setModDecision(c.id, "aprobar")} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(16,185,129,0.4)", background: dec === "aprobar" ? "#10b981" : "#ecfdf5", color: dec === "aprobar" ? "#fff" : "#065f46", fontWeight: 900, cursor: "pointer", fontSize: 12 }}>Aprobar</button>
                          <button onClick={() => setModDecision(c.id, "denegar")} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(239,68,68,0.4)", background: dec === "denegar" ? "#ef4444" : "#fef2f2", color: dec === "denegar" ? "#fff" : "#991b1b", fontWeight: 900, cursor: "pointer", fontSize: 12 }}>Denegar</button>
                        </div>
                      ) : (
                        <span style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b", fontWeight: 700 }}>{c.estado}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {canApprove && (
                <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={submitModDecisions} disabled={!modAllDecided || modSubmitting} style={{ padding: "10px 18px", borderRadius: 11, border: "none", background: (modAllDecided && !modSubmitting) ? "linear-gradient(90deg,#8b5cf6,#6366f1)" : "#cbd5e1", color: "#fff", fontWeight: 900, cursor: (modAllDecided && !modSubmitting) ? "pointer" : "not-allowed" }}>
                    {modSubmitting ? "Aplicando…" : "Aplicar decisión de la modificación"}
                  </button>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
              Productos del pedido ({editing ? editLines.length : items.length})
            </div>
            {editable && !editing ? (
              <button
                type="button"
                onClick={startEdit}
                style={{ padding: "8px 14px", borderRadius: 12, border: "1px solid #1d4ed8", background: "#eff6ff", color: "#1d4ed8", fontWeight: 900, cursor: "pointer", fontSize: 13 }}
                title="Editar cantidades o añadir productos antes de aprobar (solo pedidos en reserva)"
              >
                ✏️ Editar pedido
              </button>
            ) : null}
          </div>

          {editing ? (
            <div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={thStyle()}>Producto</th>
                      <th style={thStyle()}>Tamaño</th>
                      {variosDestinos ? <th style={thStyle()}>Destino</th> : null}
                      <th style={thStyle()}>Cantidad</th>
                      <th style={thStyle()}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editLines.map((l, idx) => {
                      const max = maxForLine(idx);
                      const dstLabel = [l.destino?.distrito, l.destino?.barrio, l.destino?.direccion].filter(Boolean).join(" · ");
                      return (
                        <tr key={l.key} style={{ borderTop: "1px solid rgba(15,23,42,0.06)" }}>
                          <td style={tdStyle()}>{l.nombre}</td>
                          <td style={tdStyle()}>{l.tamano || "—"}</td>
                          {variosDestinos ? <td style={{ ...tdStyle(), fontSize: 12, color: "#1e3a8a" }}>{dstLabel || "—"}</td> : null}
                          <td style={tdStyle()}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input
                                type="number"
                                min={1}
                                max={max || undefined}
                                value={l.cantidad}
                                onChange={(e) => setLineQty(idx, e.target.value)}
                                style={{ width: 90, padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.18)", fontWeight: 900, textAlign: "center", color: "#0f172a" }}
                              />
                              <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b", whiteSpace: "nowrap" }}>máx {max}</span>
                            </div>
                          </td>
                          <td style={tdStyle()}>
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#991b1b", fontWeight: 900, cursor: "pointer", fontSize: 12 }}
                            >
                              Quitar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {editLines.length === 0 ? (
                      <tr>
                        <td colSpan={variosDestinos ? 5 : 4} style={{ ...tdStyle(), color: "#991b1b" }}>
                          El pedido no puede quedarse sin líneas. Añade al menos un producto.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 12 }}>
                {!addOpen ? (
                  <button
                    type="button"
                    onClick={() => { setAddOpen(true); setAddProductId(""); setAddTam(""); setAddQty("1"); }}
                    style={{ padding: "10px 16px", borderRadius: 12, border: "1px dashed rgba(16,185,129,0.5)", background: "rgba(16,185,129,0.06)", color: "#065f46", fontWeight: 900, cursor: "pointer", fontSize: 13 }}
                  >
                    + Añadir producto
                  </button>
                ) : (
                  <div style={{ padding: 14, borderRadius: 14, border: "1px solid rgba(15,23,42,0.12)", background: "#f8fafc" }}>
                    <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>Añadir producto (solo con stock)</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <select value={addCat} onChange={(e) => { setAddCat(e.target.value); setAddSub(""); setAddProductId(""); setAddTam(""); }} style={selMini}>
                        <option value="">Todas las categorías</option>
                        {addCats.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select value={addSub} onChange={(e) => { setAddSub(e.target.value); setAddProductId(""); setAddTam(""); }} style={selMini}>
                        <option value="">Todas las subcategorías</option>
                        {addSubs.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <input value={addSearch} onChange={(e) => setAddSearch(e.target.value)} placeholder="Buscar producto…" style={{ ...selMini, marginTop: 10 }} />
                    <select value={addProductId} onChange={(e) => { setAddProductId(e.target.value); setAddTam(""); }} style={{ ...selMini, marginTop: 10 }}>
                      <option value="">— Elige un producto ({addFiltered.length}) —</option>
                      {addFiltered.slice(0, 300).map((p) => <option key={p.id} value={p.id}>{_prodNombre(p)}</option>)}
                    </select>
                    {addProductObj ? (
                      <div style={{ display: "grid", gridTemplateColumns: variosDestinos ? "1fr 1fr 1fr" : "1fr 1fr", gap: 10, marginTop: 10 }}>
                        <select value={addTam} onChange={(e) => setAddTam(e.target.value)} style={selMini}>
                          <option value="">Tamaño…</option>
                          {addSizes.map((t) => {
                            const d = Math.max(0, poolFor(addProductObj.id, t) - editUsedByKey(addProductObj.id, t));
                            return <option key={t} value={t} disabled={d <= 0}>{t} ({d} disp.)</option>;
                          })}
                        </select>
                        <input type="number" min={1} max={addDisp || undefined} value={addQty} onChange={(e) => setAddQty(e.target.value)} placeholder="Cantidad" style={selMini} />
                        {variosDestinos ? (
                          <select value={addDestIdx} onChange={(e) => setAddDestIdx(Number(e.target.value))} style={selMini}>
                            {destinosList.map((d, i) => <option key={i} value={i}>{d.label}</option>)}
                          </select>
                        ) : null}
                      </div>
                    ) : null}
                    {addProductObj && addTam ? (
                      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 800, color: addDisp > 0 ? "#64748b" : "#991b1b" }}>
                        Disponibles: {addDisp}
                      </div>
                    ) : null}
                    <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                      <button type="button" onClick={() => setAddOpen(false)} style={btnGhostMini}>Cancelar</button>
                      <button
                        type="button"
                        onClick={confirmAdd}
                        disabled={!addProductObj || !addTam || addDisp <= 0}
                        style={{ ...btnGhostMini, border: "none", background: (!addProductObj || !addTam || addDisp <= 0) ? "#cbd5e1" : "#0f766e", color: "#fff", cursor: (!addProductObj || !addTam || addDisp <= 0) ? "not-allowed" : "pointer" }}
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : items.length === 0 ? (
            <div style={{ color: "#64748b", fontWeight: 700 }}>Este pedido no tiene líneas.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={thStyle()}>Producto</th>
                    <th style={thStyle()}>Tamaño</th>
                    <th style={thStyle()}>Cantidad</th>
                    <th style={thStyle()}>Servido</th>
                    <th style={thStyle()}>Pendiente</th>
                    <th style={thStyle()}>Estado</th>
                    {canApprove ? <th style={thStyle()}>Acción</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {gruposDestino.map((grupo, gIdx) => {
                  const col = destinoColorAt(gIdx);
                  const colapsado = !!colapsados[grupo.destino];
                  return (
                  <React.Fragment key={grupo.destino}>
                    <tr>
                      <td
                        colSpan={canApprove ? 7 : 6}
                        onClick={() => toggleColapsado(grupo.destino)}
                        style={{ background: col.bg, color: col.fg, padding: "10px 12px", fontWeight: 900, fontSize: 13, cursor: "pointer", borderTop: "3px solid rgba(0,0,0,0.12)" }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11 }}>{colapsado ? "▶" : "▼"}</span>
                          📍 {grupo.destino}
                          <span style={{ opacity: 0.85, fontWeight: 700 }}>({grupo.items.length})</span>
                        </span>
                      </td>
                    </tr>
                    {!colapsado && grupo.items.map((it, idx) => {
                    const cantidad = Number(it.cantidad || 0);
                    const servida = Number(it.cantidad_servida || 0);
                    const pendiente = Math.max(cantidad - servida, 0);
                    const estIt = itemEstado(it);
                    const isReserva = estIt === "RESERVA";
                    const rowMuted = !isReserva
                      ? { background: estIt === "DENEGADO" ? "rgba(239,68,68,0.04)" : "rgba(16,185,129,0.04)", opacity: estIt === "DENEGADO" ? 0.7 : 1 }
                      : null;
                    const productoLabel =
                      it.producto_nombre_cientifico ||
                      it.producto_nombre ||
                      it.producto_nombre_natural ||
                      `Producto #${it.producto_id}`;
                    return (
                      <tr key={it.id || `${grupo.destino}-${idx}`} style={{ borderTop: "1px solid rgba(15,23,42,0.06)", ...rowMuted }}>
                        <td style={{ ...tdStyle(), textDecoration: estIt === "DENEGADO" ? "line-through" : "none" }}>
                          {productoLabel}
                          {/* IDs/matrículas por unidad (árboles/palmeras UTE).
                              Solo lectura: las consulta el manager al aprobar. */}
                          {Array.isArray(it.matriculas) && it.matriculas.some((m) => m) ? (
                            <div style={{ marginTop: 3, fontSize: 11, fontWeight: 800, color: "#334155", textDecoration: "none" }}>
                              🏷️ IDs:{" "}
                              <span style={{ fontWeight: 700, color: "#0f172a" }}>
                                {it.matriculas.filter((m) => m).join(", ")}
                              </span>
                            </div>
                          ) : null}
                        </td>
                        <td style={tdStyle()}>{it.tamano || "—"}</td>
                        <td style={{ ...tdStyle(), fontWeight: 900 }}>{formatCantidad(cantidad) || "0"}</td>
                        <td style={{ ...tdStyle(), color: "#065f46", fontWeight: 900 }}>{formatCantidad(servida) || "0"}</td>
                        <td style={{ ...tdStyle(), color: pendiente > 0 ? "#92400e" : "#64748b", fontWeight: 900 }}>
                          {formatCantidad(pendiente) || "0"}
                        </td>
                        <td style={tdStyle()}>
                          <span style={itemBadge(estIt)}>
                            {estIt === "APROBADO" ? "✓ Aprobado" : estIt === "DENEGADO" ? "✗ Denegado" : "⏳ Pendiente"}
                          </span>
                        </td>
                        {canApprove ? (
                          <td style={tdStyle()}>
                            {isReserva ? (
                              (() => {
                                // Toggle pair: clicking a button marks the
                                // pending decision locally; no API call yet.
                                // The selected option is highlighted.
                                const decision = pendingDecisions[it.id]; // undefined | "aprobar" | "denegar"
                                const baseBtn = {
                                  padding: "6px 10px",
                                  borderRadius: 8,
                                  fontWeight: 900,
                                  fontSize: 12,
                                  cursor: submitting ? "wait" : "pointer",
                                  transition: "background .15s, border-color .15s, box-shadow .15s",
                                };
                                const aprobarStyle = {
                                  ...baseBtn,
                                  border: decision === "aprobar"
                                    ? "1px solid #10b981"
                                    : "1px solid rgba(16,185,129,0.30)",
                                  background: decision === "aprobar"
                                    ? "rgba(16,185,129,0.25)"
                                    : "rgba(16,185,129,0.08)",
                                  color: "#065f46",
                                  boxShadow: decision === "aprobar"
                                    ? "0 0 0 2px rgba(16,185,129,0.18)"
                                    : "none",
                                };
                                const denegarStyle = {
                                  ...baseBtn,
                                  border: decision === "denegar"
                                    ? "1px solid #ef4444"
                                    : "1px solid rgba(239,68,68,0.25)",
                                  background: decision === "denegar"
                                    ? "rgba(239,68,68,0.20)"
                                    : "rgba(239,68,68,0.06)",
                                  color: "#991b1b",
                                  boxShadow: decision === "denegar"
                                    ? "0 0 0 2px rgba(239,68,68,0.18)"
                                    : "none",
                                };
                                return (
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button
                                      type="button"
                                      disabled={submitting}
                                      onClick={() => setDecision(it.id, "aprobar")}
                                      style={aprobarStyle}
                                      title="Marcar este item como aprobado (no se aplica hasta confirmar)"
                                    >
                                      {decision === "aprobar" ? "✓ Aprobar" : "Aprobar"}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={submitting}
                                      onClick={() => setDecision(it.id, "denegar")}
                                      style={denegarStyle}
                                      title="Marcar este item como denegado (no se aplica hasta confirmar)"
                                    >
                                      {decision === "denegar" ? "✗ Denegar" : "Denegar"}
                                    </button>
                                  </div>
                                );
                              })()
                            ) : (
                              <span style={{ color: "#64748b", fontSize: 12, fontStyle: "italic" }}>—</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                    })}
                  </React.Fragment>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer: two distinct modes.
            (a) There are still RESERVA items AND the user can approve →
                show the batch-decision UI: motivo input + Confirmar.
            (b) Otherwise → show the PDF download (when applicable). */}
        {editing ? (
          <div
            style={{
              padding: "14px 22px",
              borderTop: "1px solid rgba(15,23,42,0.08)",
              background: "#f8fafc",
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: "#64748b", fontWeight: 700 }}>
              Edita cantidades (tope = stock disponible) o añade productos. Al guardar, el pedido vuelve a quedar en reserva para decidirlo.
            </span>
            <button type="button" onClick={cancelEdit} disabled={savingEdit} style={btnGhostMini}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={savingEdit || editLines.length === 0}
              style={{
                padding: "10px 18px",
                borderRadius: 12,
                border: "none",
                background: savingEdit || editLines.length === 0 ? "rgba(148,163,184,0.5)" : "#0f766e",
                color: "#fff",
                fontWeight: 900,
                fontSize: 13,
                cursor: savingEdit || editLines.length === 0 ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {savingEdit ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        ) : canApprove && pendingCount > 0 ? (
          <div
            style={{
              padding: "14px 22px",
              borderTop: "1px solid rgba(15,23,42,0.08)",
              background: "#f8fafc",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: allDecided ? "#065f46" : "#92400e",
                fontWeight: 800,
              }}
            >
              {allDecided
                ? `Listo: ${decidedLocalCount} de ${pendingCount} items decididos. Pulsa "Confirmar decisiones" para aplicar.`
                : `Decide TODOS los items antes de confirmar (${decidedLocalCount}/${pendingCount} hechos). No se puede dejar nada pendiente.`}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {anyDenied ? (
                <input
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  disabled={submitting}
                  placeholder="Motivo de denegación (opcional)"
                  style={{
                    flex: 1,
                    minWidth: 220,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.12)",
                    background: "white",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                />
              ) : (
                <span style={{ flex: 1 }} />
              )}

              <button
                type="button"
                disabled={!allDecided || submitting}
                onClick={submitDecisions}
                style={{
                  padding: "10px 18px",
                  borderRadius: 12,
                  border: "1px solid " + (allDecided ? "#0f766e" : "rgba(15,23,42,0.12)"),
                  background: allDecided ? "#0f766e" : "rgba(148,163,184,0.30)",
                  color: allDecided ? "white" : "#64748b",
                  fontWeight: 900,
                  cursor: !allDecided || submitting ? "not-allowed" : "pointer",
                  fontSize: 13,
                  letterSpacing: ".02em",
                  whiteSpace: "nowrap",
                }}
              >
                {submitting ? "Aplicando…" : "Confirmar decisiones"}
              </button>

              {canShowPdf ? (
                <button
                  type="button"
                  onClick={downloadPdf}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 12,
                    border: "1px solid rgba(59,130,246,0.30)",
                    background: "rgba(59,130,246,0.08)",
                    color: "#1d4ed8",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  PDF
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "14px 22px",
              borderTop: "1px solid rgba(15,23,42,0.08)",
              background: "#f8fafc",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
              {estadoNormPedido === "DENEGADO"
                ? "Pedido denegado. El PDF contiene el detalle y motivo de denegación."
                : hasApproved
                ? "Hay items aprobados disponibles en el PDF."
                : "Sin decisión registrada todavía."}
            </div>
            {canShowPdf ? (
              <button
                type="button"
                onClick={downloadPdf}
                style={{
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: "1px solid rgba(59,130,246,0.30)",
                  background: "rgba(59,130,246,0.08)",
                  color: "#1d4ed8",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Descargar PDF
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBanner({ msg, onClose }) {
  if (!msg) return null;

  return (
    <div
      style={{
        marginTop: 12,
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid rgba(16,185,129,0.25)",
        background: "rgba(16,185,129,0.08)",
        color: "#065f46",
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
          color: "#065f46",
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

export default function Aprobaciones() {
  const { me } = useOutletContext();
  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Por defecto se muestran TODOS los pedidos, para que tras aprobar/denegar el
  // pedido decidido siga visible en la lista (no desaparezca del filtro).
  const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
  const [idFiltro, setIdFiltro] = useState("");
  const [fechaFiltro, setFechaFiltro] = useState("");
  const [solicitanteFiltro, setSolicitanteFiltro] = useState("");
  const [textoFiltro, setTextoFiltro] = useState("");
  const [detallePedido, setDetallePedido] = useState(null);

  const msgTimerRef = useRef(null);

  const clearMsgTimer = () => {
    if (msgTimerRef.current) {
      clearTimeout(msgTimerRef.current);
      msgTimerRef.current = null;
    }
  };

  const closeMessage = () => {
    clearMsgTimer();
    setMsg("");
  };

  const showTimedMessage = (text) => {
    clearMsgTimer();
    setMsg(text);

    msgTimerRef.current = setTimeout(() => {
      setMsg("");
      msgTimerRef.current = null;
    }, 3000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [peds, prods] = await Promise.all([getPedidos(), getProductos().catch(() => [])]);
      setPedidos(safeArray(peds));
      setProductos(safeArray(prods));
    } catch (e) {
      showTimedMessage(e?.response?.data?.detail || e?.message || "Error cargando aprobaciones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    return () => {
      clearMsgTimer();
    };
  }, []);

  const solicitanteFromPedido = (p) =>
    formatUsername(
      p?.solicitante_username || p?.solicitante || p?.created_by || p?.usuario || p?.username || ""
    ) || "—";

  const pedidosFiltrados = useMemo(() => {
    const texto = textoFiltro.trim().toLowerCase();

    return pedidos
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .filter((p) => {
        const idOk = !idFiltro || String(p.id).includes(String(idFiltro).trim());
        const estadoNorm = estadoNormalizado(p?.estado);
        const estadoOk =
          estadoFiltro === "TODOS"
            ? true
            : estadoFiltro === "PENDIENTES"
            ? (DECIDABLE_FRONTEND.has(estadoNorm) || !!p.modificacion_pendiente)
            : estadoNorm === estadoFiltro;
        const fechaOk = !fechaFiltro || dateInputValue(p?.created_at) === fechaFiltro;

        const solicitante = solicitanteFromPedido(p).toLowerCase();
        const solicitanteOk =
          !solicitanteFiltro || solicitante.includes(solicitanteFiltro.trim().toLowerCase());

        const detalle = safeArray(p.items)
          .map((it) => `${it.producto_id} ${it.tamano || ""} ${it.cantidad || ""}`.toLowerCase())
          .join(" ");

        const textoOk =
          !texto ||
          String(p.id).toLowerCase().includes(texto) ||
          solicitante.includes(texto) ||
          estadoNormalizado(p?.estado).toLowerCase().includes(texto) ||
          detalle.includes(texto);

        return idOk && estadoOk && fechaOk && solicitanteOk && textoOk;
      });
  }, [pedidos, estadoFiltro, idFiltro, fechaFiltro, solicitanteFiltro, textoFiltro]);

  // Helper to format the post-action message with optional email warnings
  // returned by the backend (e.g. solicitante without email registered).
  const messageWithWarnings = (base, updated) => {
    const warns = Array.isArray(updated?.email_warnings) ? updated.email_warnings : [];
    return warns.length ? `${base} Aviso: ${warns.join(" · ")}` : base;
  };

  const aprobar = async (id) => {
    try {
      const updated = await aprobarPedido(id, {});
      await load();
      showTimedMessage(messageWithWarnings(`Pedido #${id} aprobado.`, updated));
    } catch (e) {
      showTimedMessage(e?.response?.data?.detail || e?.message || "Error aprobando pedido");
    }
  };

  const denegar = async (id) => {
    try {
      const updated = await denegarPedido(id, {});
      await load();
      showTimedMessage(messageWithWarnings(`Pedido #${id} denegado.`, updated));
    } catch (e) {
      showTimedMessage(e?.response?.data?.detail || e?.message || "Error denegando pedido");
    }
  };

  const role = me?.rol || me?.role;
  const canApprove = role === "admin" || role === "manager";
  const esAdmin = role === "admin";

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 44, margin: 0, fontWeight: 900, color: "#0f172a" }}>Aprobaciones</h1>
        <div style={{ fontWeight: 800, color: "#64748b" }}>
          Usuario: <span style={{ color: "#0f172a" }}>{me?.username || "—"}</span> · Rol:{" "}
          <span style={{ color: "#0f172a" }}>{role || "—"}</span>
        </div>
      </div>

      <MessageBanner msg={msg} onClose={closeMessage} />

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
        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 14 }}>
          Lista de aprobaciones
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(140px, 160px) minmax(190px, 220px) minmax(170px, 190px) minmax(180px, 220px) minmax(260px, 1fr)",
            gap: 14,
            marginBottom: 18,
            alignItems: "start",
          }}
        >
          <div style={filterFieldStyle()}>
            <div style={filterLabelStyle()}>ID</div>
            <input
              placeholder="Filtrar por ID"
              value={idFiltro}
              onChange={(e) => setIdFiltro(e.target.value)}
              style={filterControlStyle()}
            />
          </div>

          <div style={filterFieldStyle()}>
            <div style={filterLabelStyle()}>Tipo de reserva</div>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              style={filterSelectStyle()}
            >
              {ESTADO_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div style={filterFieldStyle()}>
            <div style={filterLabelStyle()}>Fecha</div>
            <input
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
              style={filterControlStyle()}
            />
          </div>

          <div style={filterFieldStyle()}>
            <div style={filterLabelStyle()}>Solicitante</div>
            <input
              placeholder="Solicitante"
              value={solicitanteFiltro}
              onChange={(e) => setSolicitanteFiltro(e.target.value)}
              style={filterControlStyle()}
            />
          </div>

          <div style={filterFieldStyle()}>
            <div style={filterLabelStyle()}>Texto</div>
            <input
              placeholder="Buscar texto en detalle, estado, ID..."
              value={textoFiltro}
              onChange={(e) => setTextoFiltro(e.target.value)}
              style={filterControlStyle()}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ color: "#64748b", fontWeight: 800 }}>Cargando…</div>
        ) : pedidosFiltrados.length === 0 ? (
          <div style={{ color: "#64748b", fontWeight: 800 }}>No hay pedidos para los filtros seleccionados.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", minWidth: 980 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={thStyle()}>ID</th>
                  <th style={thStyle()}>Tipo</th>
                  <th style={thStyle()}>Fecha</th>
                  <th style={thStyle()}>Solicitante</th>
                  <th style={thStyle()}>Estado</th>
                  <th style={thStyle()}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pedidosFiltrados.map((p) => {
                  const estado = p.estado || "RESERVA";
                  // Row-level Aprobar / Denegar shortcuts only show when:
                  //   1) pedido is in RESERVA (no decision taken yet — once
                  //      ANY decision exists, state is final), AND
                  //   2) the pedido has exactly ONE item.  Multi-item pedidos
                  //      must be decided through the detail modal so the
                  //      manager can pick per-item which lines to approve and
                  //      which to deny.  Otherwise the row-level shortcut
                  //      would force "approve all" or "deny all" and the
                  //      partial-approval workflow becomes inaccessible.
                  const itemCount = safeArray(p?.items).length;
                  const editable =
                    estadoNormalizado(estado) === "RESERVA" && itemCount === 1;

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

                      <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                        {solicitanteFromPedido(p)}
                      </td>

                      <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={badge(estado)}>{estadoLabel(estado)}</span>
                          {p.bloqueado ? (
                            <span title="Materiales bloqueados: reserva con caducidad de 1 año" style={{ fontSize: 16 }}>🔒</span>
                          ) : null}
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
                        }}
                      >
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {canApprove && editable ? (
                            <>
                              <button
                                onClick={() => aprobar(p.id)}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 10,
                                  border: "1px solid rgba(16,185,129,0.35)",
                                  background: "rgba(16,185,129,0.10)",
                                  color: "#065f46",
                                  fontWeight: 900,
                                  cursor: "pointer",
                                }}
                              >
                                Aprobar
                              </button>

                              <button
                                onClick={() => denegar(p.id)}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 10,
                                  border: "1px solid rgba(239,68,68,0.25)",
                                  background: "rgba(239,68,68,0.08)",
                                  color: "#991b1b",
                                  fontWeight: 900,
                                  cursor: "pointer",
                                }}
                              >
                                Denegar
                              </button>
                            </>
                          ) : null}

                          <button
                            onClick={() => setDetallePedido(p)}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid rgba(59,130,246,0.30)",
                              background: "rgba(59,130,246,0.08)",
                              color: "#1d4ed8",
                              fontWeight: 900,
                              cursor: "pointer",
                            }}
                            title="Ver detalle del pedido"
                          >
                            Detalle pedido
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DetallePedidoModal
        pedido={detallePedido}
        productos={productos}
        onClose={() => setDetallePedido(null)}
        canApprove={canApprove}
        canReopen={esAdmin}
        onPedidoUpdated={(updated) => {
          // Keep the modal in sync with the freshly-returned pedido and
          // refresh the parent list so the table reflects the new state.
          setDetallePedido(updated);
          load();
        }}
        onMessage={(text) => showTimedMessage(text)}
      />
    </div>
  );
}