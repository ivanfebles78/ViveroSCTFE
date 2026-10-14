import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { adminConexiones } from "../api/api";

// Formatea un ISO (UTC naive del backend) a fecha+hora local es-ES.
function fmtFechaHora(iso) {
  if (!iso) return "—";
  let s = String(iso);
  // Si no trae zona horaria, es UTC del backend → lo marcamos como UTC.
  if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s += "Z";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function fmtDuracion(seg) {
  if (seg === null || seg === undefined) return "—";
  const s = Math.max(0, Math.floor(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${ss}s`;
  return `${ss}s`;
}

const ESTADO = {
  activa: { label: "Activa", bg: "rgba(16,185,129,0.14)", fg: "#065f46" },
  inactiva: { label: "Inactiva", bg: "rgba(245,158,11,0.16)", fg: "#92400e" },
  cerrada: { label: "Cerrada", bg: "rgba(100,116,139,0.16)", fg: "#334155" },
};

const PAGE_SIZE = 50;

export default function Conexiones() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async (off) => {
    setLoading(true);
    setError("");
    try {
      const data = await adminConexiones({ limit: PAGE_SIZE, offset: off });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total || 0));
      setOffset(Number(data?.offset || 0));
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "No se pudo cargar el informe de conexiones (¿tienes permisos de administrador?)."
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar(0);
  }, [cargar]);

  const pagina = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button onClick={() => navigate("/admin/usuarios")} style={btnGhost}>← Usuarios</button>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#10231a" }}>
          Informe de conexiones
        </h1>
        <button onClick={() => cargar(offset)} style={{ ...btnGhost, marginLeft: "auto" }}>
          ↻ Actualizar
        </button>
      </div>
      <p style={{ color: "#64748b", fontWeight: 600, marginTop: 6 }}>
        Cada inicio de sesión en la aplicación, con su hora de entrada y de desconexión.
        La desconexión es exacta si el usuario pulsó «Salir», o estimada por su última
        actividad si cerró la pestaña. Solo visible para administradores.
      </p>

      {error && (
        <div style={errorBox}>{error}</div>
      )}

      <div style={card}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#0f5132", color: "#fff" }}>
                <th style={th}>Usuario</th>
                <th style={th}>Rol</th>
                <th style={th}>Conexión (entrada)</th>
                <th style={th}>Desconexión</th>
                <th style={th}>Duración</th>
                <th style={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={tdEmpty}>Cargando…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} style={tdEmpty}>Sin conexiones registradas.</td></tr>
              ) : (
                items.map((c) => {
                  const est = ESTADO[c.estado] || ESTADO.cerrada;
                  const desc = c.estado === "activa"
                    ? "— (en curso)"
                    : `${fmtFechaHora(c.desconexion)}${c.estado === "inactiva" ? " (aprox.)" : ""}`;
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid rgba(15,23,42,0.06)" }}>
                      <td style={{ ...td, fontWeight: 800, color: "#0f172a" }}>{c.username}</td>
                      <td style={td}>{c.rol || "—"}</td>
                      <td style={td}>{fmtFechaHora(c.login_at)}</td>
                      <td style={td}>{desc}</td>
                      <td style={td}>{fmtDuracion(c.duracion_segundos)}</td>
                      <td style={td}>
                        <span style={{ fontWeight: 900, padding: "2px 10px", borderRadius: 999, background: est.bg, color: est.fg }}>
                          {est.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
        <span style={{ color: "#64748b", fontWeight: 700, fontSize: 13 }}>
          {total} conexión{total === 1 ? "" : "es"} · página {pagina}/{totalPaginas}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={() => cargar(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset <= 0 || loading}
            style={pageBtn(offset <= 0 || loading)}
          >
            ← Anteriores
          </button>
          <button
            onClick={() => cargar(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total || loading}
            style={pageBtn(offset + PAGE_SIZE >= total || loading)}
          >
            Siguientes →
          </button>
        </div>
      </div>
    </div>
  );
}

const card = {
  marginTop: 14,
  background: "#fff",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 14,
  overflow: "hidden",
  boxShadow: "0 10px 30px rgba(2,6,23,0.06)",
};
const th = { textAlign: "left", padding: "10px 12px", fontWeight: 800, fontSize: 12, whiteSpace: "nowrap" };
const td = { padding: "9px 12px", color: "#334155", whiteSpace: "nowrap" };
const tdEmpty = { padding: "22px 12px", textAlign: "center", color: "#64748b", fontWeight: 700 };
const btnGhost = {
  padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.14)",
  background: "#fff", color: "#0f172a", fontWeight: 800, fontSize: 13, cursor: "pointer",
};
const errorBox = {
  marginTop: 12, padding: "10px 14px", borderRadius: 10,
  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
  color: "#991b1b", fontWeight: 700, fontSize: 14,
};
function pageBtn(disabled) {
  return {
    padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.14)",
    background: disabled ? "rgba(148,163,184,0.1)" : "#fff",
    color: disabled ? "#94a3b8" : "#0f172a",
    fontWeight: 800, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer",
  };
}
