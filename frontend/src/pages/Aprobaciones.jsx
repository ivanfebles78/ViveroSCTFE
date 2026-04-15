import React, { useEffect, useMemo, useState, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { getPedidos, aprobarPedido, denegarPedido } from "../api/api";

const ESTADO_FILTERS = [
  { value: "TODOS", label: "Todos" },
  { value: "RESERVA", label: "Reserva" },
  { value: "APROBADO", label: "Aprobado" },
  { value: "DENEGADO", label: "Denegado" },
  { value: "SERVIDO", label: "Servido" },
  { value: "CANCELADO", label: "Cancelado" },
  { value: "CADUCADO", label: "Caducado" },
];

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
  if (e === "DENEGADO") return { ...base, background: "rgba(239,68,68,0.10)", color: "#991b1b" };
  if (e === "SERVIDO") return { ...base, background: "rgba(59,130,246,0.10)", color: "#1e3a8a" };
  if (e === "CANCELADO") return { ...base, background: "rgba(148,163,184,0.20)", color: "#334155" };
  if (e === "CADUCADO") return { ...base, background: "rgba(100,116,139,0.18)", color: "#475569" };
  return { ...base, background: "rgba(245,158,11,0.12)", color: "#92400e" };
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
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [estadoFiltro, setEstadoFiltro] = useState("RESERVA");
  const [idFiltro, setIdFiltro] = useState("");
  const [fechaFiltro, setFechaFiltro] = useState("");
  const [solicitanteFiltro, setSolicitanteFiltro] = useState("");
  const [textoFiltro, setTextoFiltro] = useState("");

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
      const data = await getPedidos();
      setPedidos(safeArray(data));
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
    p?.solicitante_username || p?.solicitante || p?.created_by || p?.usuario || p?.username || "—";

  const pedidosFiltrados = useMemo(() => {
    const texto = textoFiltro.trim().toLowerCase();

    return pedidos
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .filter((p) => {
        const idOk = !idFiltro || String(p.id).includes(String(idFiltro).trim());
        const estadoOk = estadoFiltro === "TODOS" || estadoNormalizado(p?.estado) === estadoFiltro;
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

  const aprobar = async (id) => {
    try {
      await aprobarPedido(id, {});
      await load();
      showTimedMessage(`Pedido #${id} aprobado.`);
    } catch (e) {
      showTimedMessage(e?.response?.data?.detail || e?.message || "Error aprobando pedido");
    }
  };

  const denegar = async (id) => {
    try {
      await denegarPedido(id, {});
      await load();
      showTimedMessage(`Pedido #${id} denegado.`);
    } catch (e) {
      showTimedMessage(e?.response?.data?.detail || e?.message || "Error denegando pedido");
    }
  };

  const role = me?.rol || me?.role;
  const canApprove = role === "admin" || role === "manager";

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
                  <th style={thStyle()}>Fecha</th>
                  <th style={thStyle()}>Solicitante</th>
                  <th style={thStyle()}>Estado</th>
                  <th style={thStyle()}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pedidosFiltrados.map((p) => {
                  const estado = p.estado || "RESERVA";
                  const editable = estadoNormalizado(estado) === "RESERVA";

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
                        {fmtFechaES(p.created_at)}
                      </td>

                      <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                        {solicitanteFromPedido(p)}
                      </td>

                      <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                        <span style={badge(estado)}>{estado}</span>
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
                        {canApprove && editable ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
                          </div>
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
    </div>
  );
}