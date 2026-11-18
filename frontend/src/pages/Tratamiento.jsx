import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  getTratamientos,
  getFitosanitariosDisponibles,
  crearTratamiento,
  aplicarTratamiento,
  eliminarTratamiento,
  verFichaTratamiento,
} from "../api/api";
import { formatCantidad } from "../utils/numero";

// ---------------- helpers de estado ----------------
const ESTADO_STYLE = {
  RESERVA: { bg: "#FEF3C7", border: "#FBBF24", color: "#92400E", label: "En reserva" },
  APROBADO: { bg: "#DBEAFE", border: "#2563EB", color: "#1E40AF", label: "Aprobado" },
  DENEGADO: { bg: "#FEE2E2", border: "#DC2626", color: "#991B1B", label: "Denegado" },
  APLICADO: { bg: "#DCFCE7", border: "#16A34A", color: "#166534", label: "Aplicado" },
  CANCELADO: { bg: "#F1F5F9", border: "#94A3B8", color: "#475569", label: "Cancelado" },
};

function EstadoBadge({ estado }) {
  const st = ESTADO_STYLE[(estado || "").toUpperCase()] || ESTADO_STYLE.CANCELADO;
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 999, fontWeight: 900,
      fontSize: 12, background: st.bg, color: st.color, border: `1px solid ${st.border}`,
    }}>
      {st.label}
    </span>
  );
}

const fmtFecha = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-ES");
};

// Aplana solicitudes -> una fila por línea, arrastrando datos de la solicitud.
function flattenRows(solicitudes) {
  const rows = [];
  for (const s of solicitudes || []) {
    for (const it of s.items || []) {
      rows.push({ ...it, solicitud_id: s.id, estado: s.estado, fecha: s.created_at, motivo: s.motivo_denegacion });
    }
  }
  return rows;
}

// =====================================================================
// MODAL: Solicitar tratamiento (3 columnas)
// =====================================================================
function SolicitarTratamientoModal({ onClose, onCreated, onError }) {
  const [fitos, setFitos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [seleccionado, setSeleccionado] = useState(null);
  const [cantidad, setCantidad] = useState("");
  const [lineas, setLineas] = useState([]); // { producto, cantidad, file }
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    let cancel = false;
    getFitosanitariosDisponibles()
      .then((d) => { if (!cancel) setFitos(d || []); })
      .catch((e) => { if (!cancel) onError?.(e?.response?.data?.detail || "No se pudieron cargar los fitosanitarios."); })
      .finally(() => { if (!cancel) setCargando(false); });
    return () => { cancel = true; };
  }, []);

  // Disponible restante de un fitosanitario descontando lo ya puesto en el carrito.
  const disponibleRestante = (prod) => {
    const yaEnCarrito = lineas
      .filter((l) => l.producto.id === prod.id)
      .reduce((acc, l) => acc + Number(l.cantidad || 0), 0);
    return Number(prod.disponible || 0) - yaEnCarrito;
  };

  const anadir = () => {
    setAviso("");
    if (!seleccionado) { setAviso("Selecciona un fitosanitario."); return; }
    const cant = Number(String(cantidad).replace(",", "."));
    if (!cant || cant <= 0) { setAviso("Indica una cantidad mayor que 0."); return; }
    const rest = disponibleRestante(seleccionado);
    if (cant > rest + 1e-9) { setAviso(`Solo quedan ${formatCantidad(rest)} disponibles de ${seleccionado.nombre}.`); return; }
    setLineas((prev) => [...prev, { producto: seleccionado, cantidad: cant, file: null }]);
    setSeleccionado(null);
    setCantidad("");
  };

  const quitarLinea = (idx) => setLineas((prev) => prev.filter((_, i) => i !== idx));

  const adjuntar = (idx, file) => {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, file } : l)));
  };

  const todasConFicha = lineas.length > 0 && lineas.every((l) => !!l.file);

  const enviar = async () => {
    setAviso("");
    if (lineas.length === 0) { setAviso("Añade al menos un producto."); return; }
    if (!todasConFicha) { setAviso("Cada línea debe tener su ficha adjunta."); return; }
    setEnviando(true);
    try {
      const payload = lineas.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad }));
      const files = lineas.map((l) => l.file);
      await crearTratamiento(payload, files);
      onCreated?.();
    } catch (e) {
      setAviso(e?.response?.data?.detail || e?.message || "No se pudo crear la solicitud.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.6)", backdropFilter: "blur(4px)", zIndex: 1400, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(1100px, 97vw)", maxHeight: "92vh", background: "#f1f5f9", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(2,6,23,0.45)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: "linear-gradient(100deg, #0f5132 0%, #14663f 55%, #0ea5e9 160%)" }}>
          <div style={{ color: "#fff", fontWeight: 900, fontSize: 20 }}>Solicitar tratamiento</div>
          <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 12, border: "2px solid rgba(255,255,255,0.35)", background: "#ef4444", color: "#fff", fontWeight: 900, cursor: "pointer" }}>✕ Cerrar</button>
        </div>

        <div style={{ padding: 16, display: "flex", gap: 14, flexWrap: "wrap", overflowY: "auto" }}>
          {/* IZQUIERDA: fitosanitarios disponibles */}
          <div style={{ flex: "1 1 280px", minWidth: 240, background: "#fff", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", padding: 12, maxHeight: "60vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>Fitosanitarios disponibles</div>
            {cargando ? <div style={{ color: "#64748b" }}>Cargando…</div> : fitos.length === 0 ? (
              <div style={{ color: "#94a3b8" }}>No hay fitosanitarios con stock.</div>
            ) : fitos.map((p) => {
              const rest = disponibleRestante(p);
              const activo = seleccionado?.id === p.id;
              const agotado = rest <= 0;
              return (
                <button key={p.id} type="button" disabled={agotado} onClick={() => setSeleccionado(p)}
                  style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 6, padding: "8px 10px", borderRadius: 10, cursor: agotado ? "not-allowed" : "pointer",
                    border: activo ? "2px solid #0ea5e9" : "1px solid rgba(15,23,42,0.1)", background: agotado ? "#f8fafc" : activo ? "#e0f2fe" : "#fff", opacity: agotado ? 0.55 : 1 }}>
                  <div style={{ fontWeight: 800, color: "#0f172a", fontStyle: "italic" }}>{p.nombre_cientifico}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{p.nombre_natural || ""}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: agotado ? "#991b1b" : "#047857" }}>Disponible: {formatCantidad(rest)}</div>
                </button>
              );
            })}
          </div>

          {/* CENTRO: cantidad del seleccionado */}
          <div style={{ flex: "1 1 240px", minWidth: 220, background: "#fff", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", padding: 12, alignSelf: "flex-start" }}>
            <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>Añadir al tratamiento</div>
            {!seleccionado ? (
              <div style={{ color: "#94a3b8" }}>Selecciona un fitosanitario de la izquierda.</div>
            ) : (
              <>
                <div style={{ fontWeight: 800, color: "#0f172a", fontStyle: "italic" }}>{seleccionado.nombre_cientifico}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Disponible: {formatCantidad(disponibleRestante(seleccionado))}</div>
                <label style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>Cantidad</label>
                <input type="number" min="0" step="0.001" value={cantidad} onChange={(e) => setCantidad(e.target.value)}
                  style={{ width: "100%", padding: "9px 10px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", marginTop: 4, marginBottom: 10 }} />
                <button type="button" onClick={anadir}
                  style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", background: "#0f5132", color: "#fff", fontWeight: 900, cursor: "pointer" }}>
                  + Añadir
                </button>
              </>
            )}
            {aviso ? <div style={{ marginTop: 10, color: "#991b1b", fontWeight: 700, fontSize: 13 }}>{aviso}</div> : null}
          </div>

          {/* DERECHA: carrito con ficha por línea */}
          <div style={{ flex: "1.2 1 300px", minWidth: 260, background: "#fff", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", padding: 12, maxHeight: "60vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>Tratamiento ({lineas.length})</div>
            {lineas.length === 0 ? (
              <div style={{ color: "#94a3b8" }}>Aún no has añadido productos.</div>
            ) : lineas.map((l, idx) => (
              <div key={idx} style={{ border: "1px solid rgba(15,23,42,0.1)", borderRadius: 10, padding: 10, marginBottom: 8, background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontWeight: 800, color: "#0f172a", fontStyle: "italic" }}>{l.producto.nombre_cientifico}</div>
                  <button type="button" onClick={() => quitarLinea(idx)} style={{ border: "none", background: "transparent", color: "#dc2626", fontWeight: 900, cursor: "pointer" }}>✕</button>
                </div>
                <div style={{ fontSize: 13, color: "#334155", marginBottom: 6 }}>Cantidad: <b>{formatCantidad(l.cantidad)}</b></div>
                <label style={{ display: "inline-block", padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontWeight: 800, fontSize: 12,
                  border: l.file ? "1px solid #16A34A" : "1px dashed #94A3B8", background: l.file ? "#DCFCE7" : "#fff", color: l.file ? "#166534" : "#475569" }}>
                  {l.file ? `📎 ${l.file.name}` : "📎 Adjuntar ficha (obligatoria)"}
                  <input type="file" style={{ display: "none" }} onChange={(e) => adjuntar(idx, e.target.files?.[0] || null)} />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 20px", borderTop: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
          <button type="button" onClick={onClose} style={{ padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.15)", background: "#f8fafc", fontWeight: 800, cursor: "pointer" }}>Cancelar</button>
          <button type="button" onClick={enviar} disabled={!todasConFicha || enviando}
            style={{ padding: "10px 18px", borderRadius: 12, border: "none", fontWeight: 900, cursor: (!todasConFicha || enviando) ? "not-allowed" : "pointer",
              background: (!todasConFicha || enviando) ? "#cbd5e1" : "#0f5132", color: "#fff" }}>
            {enviando ? "Enviando…" : "Enviar solicitud"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// PÁGINA
// =====================================================================
export default function Tratamiento() {
  const { me } = useOutletContext();
  const role = me?.rol || me?.role;
  const puedeSolicitar = role === "empresa_externa" || role === "admin";
  const puedeAplicar = role === "gestor_vivero" || role === "admin";
  const isAdmin = role === "admin";

  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [ok, setOk] = useState("");

  // filtros
  const [fEstado, setFEstado] = useState("");
  const [fQ, setFQ] = useState("");
  const [fSub, setFSub] = useState("");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");

  const cargar = async () => {
    setLoading(true); setError("");
    try {
      const data = await getTratamientos({ estado: fEstado, q: fQ, subcategoria: fSub, desde: fDesde, hasta: fHasta });
      setSolicitudes(data || []);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "No se pudieron cargar los tratamientos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  const rows = useMemo(() => flattenRows(solicitudes), [solicitudes]);

  const subcategorias = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => { if (r.subcategoria) set.add(r.subcategoria); });
    return [...set].sort();
  }, [rows]);

  const limpiarFiltros = () => {
    setFEstado(""); setFQ(""); setFSub(""); setFDesde(""); setFHasta("");
    setTimeout(cargar, 0);
  };

  const aplicar = async (solicitudId) => {
    if (!window.confirm(`¿Aplicar el tratamiento #${solicitudId}? Se descontará el material del stock.`)) return;
    try {
      await aplicarTratamiento(solicitudId);
      setOk(`Tratamiento #${solicitudId} aplicado: material descontado del stock.`);
      setTimeout(() => setOk(""), 5000);
      cargar();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "No se pudo aplicar el tratamiento.");
    }
  };

  const verFicha = async (itemId) => {
    try { await verFichaTratamiento(itemId); }
    catch (e) { setError(e?.response?.data?.detail || "No se pudo abrir la ficha."); }
  };

  const eliminar = async (s) => {
    const aplicado = (s.estado || "").toUpperCase() === "APLICADO";
    const aviso = aplicado
      ? `¿Eliminar el tratamiento #${s.id}? Al estar APLICADO, el material consumido volverá al stock.`
      : `¿Eliminar el tratamiento #${s.id}? Esta acción no se puede deshacer.`;
    if (!window.confirm(aviso)) return;
    try {
      await eliminarTratamiento(s.id);
      setOk(`Tratamiento #${s.id} eliminado${aplicado ? " y stock repuesto" : ""}.`);
      setTimeout(() => setOk(""), 5000);
      cargar();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "No se pudo eliminar el tratamiento.");
    }
  };

  const th = { textAlign: "left", padding: "10px 12px", fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: 0.3, borderBottom: "2px solid #e2e8f0" };
  const td = { padding: "10px 12px", fontSize: 14, borderBottom: "1px solid #eef2f7", verticalAlign: "middle" };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "#0f172a" }}>Tratamientos</h1>
          <div style={{ color: "#64748b", fontWeight: 600 }}>Solicitudes de tratamiento fitosanitario</div>
        </div>
        {puedeSolicitar ? (
          <button type="button" onClick={() => setModalOpen(true)}
            style={{ padding: "11px 18px", borderRadius: 14, border: "none", background: "linear-gradient(135deg, #06b6d4 0%, #10b981 100%)", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", boxShadow: "0 8px 18px rgba(16,185,129,0.25)" }}>
            + Solicitar tratamiento
          </button>
        ) : null}
      </div>

      {ok ? <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 12, background: "#DCFCE7", border: "1px solid #16A34A", color: "#166534", fontWeight: 800 }}>{ok}</div> : null}
      {error ? <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 12, background: "#FEE2E2", border: "1px solid #DC2626", color: "#991B1B", fontWeight: 800 }}>{error}</div> : null}

      {/* FILTROS */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14, background: "#fff", padding: 12, borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)" }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#64748b" }}>Buscar producto</label>
          <input value={fQ} onChange={(e) => setFQ(e.target.value)} placeholder="nombre científico/común"
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", minWidth: 200 }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#64748b" }}>Estado</label>
          <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)" }}>
            <option value="">Todos</option>
            <option value="RESERVA">En reserva</option>
            <option value="APROBADO">Aprobado</option>
            <option value="DENEGADO">Denegado</option>
            <option value="APLICADO">Aplicado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#64748b" }}>Subcategoría</label>
          <select value={fSub} onChange={(e) => setFSub(e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)" }}>
            <option value="">Todas</option>
            {subcategorias.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#64748b" }}>Desde</label>
          <input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)" }} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: "#64748b" }}>Hasta</label>
          <input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)" }} />
        </div>
        <button type="button" onClick={cargar} style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: "#0f172a", color: "#fff", fontWeight: 800, cursor: "pointer" }}>Filtrar</button>
        <button type="button" onClick={limpiarFiltros} style={{ padding: "9px 16px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.15)", background: "#f8fafc", fontWeight: 800, cursor: "pointer" }}>Limpiar</button>
      </div>

      {/* LISTA AGRUPADA POR TRATAMIENTO */}
      {loading ? (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", padding: 20, color: "#64748b" }}>Cargando…</div>
      ) : solicitudes.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", padding: 20, color: "#94a3b8", fontWeight: 600 }}>
          No hay tratamientos que mostrar.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {solicitudes.map((s) => {
            const est = (s.estado || "").toUpperCase();
            return (
              <div key={s.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(15,23,42,0.1)", overflow: "hidden" }}>
                {/* Cabecera del tratamiento */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid rgba(15,23,42,0.08)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 900, color: "#0f172a", fontSize: 16 }}>Tratamiento #{s.id}</span>
                    <EstadoBadge estado={s.estado} />
                    <span style={{ color: "#64748b", fontWeight: 600, fontSize: 13 }}>{fmtFecha(s.created_at)}</span>
                    <span style={{ color: "#64748b", fontWeight: 600, fontSize: 13 }}>· {s.creado_por || "—"}</span>
                    <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 12 }}>· {(s.items || []).length} producto(s)</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {puedeAplicar && est === "APROBADO" ? (
                      <button type="button" onClick={() => aplicar(s.id)}
                        style={{ padding: "7px 14px", borderRadius: 10, border: "none", background: "#16A34A", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                        Aplicar
                      </button>
                    ) : null}
                    {isAdmin ? (
                      <button type="button" onClick={() => eliminar(s)}
                        style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #DC2626", background: "#fff", color: "#991B1B", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                        🗑 Eliminar
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Motivo de denegación, si aplica */}
                {est === "DENEGADO" && s.motivo_denegacion ? (
                  <div style={{ padding: "8px 16px", background: "#FEE2E2", color: "#991B1B", fontSize: 13, fontWeight: 700 }}>
                    Motivo de denegación: {s.motivo_denegacion}
                  </div>
                ) : null}

                {/* Líneas del tratamiento */}
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Nombre común</th>
                      <th style={th}>Nombre científico</th>
                      <th style={th}>Categoría</th>
                      <th style={th}>Subcategoría</th>
                      <th style={th}>Cantidad</th>
                      <th style={th}>Ficha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(s.items || []).map((it) => (
                      <tr key={it.item_id}>
                        <td style={td}>{it.nombre_natural || "—"}</td>
                        <td style={{ ...td, fontStyle: "italic" }}>{it.nombre_cientifico || "—"}</td>
                        <td style={td}>{it.categoria || "—"}</td>
                        <td style={td}>{it.subcategoria || "—"}</td>
                        <td style={{ ...td, fontWeight: 800 }}>{formatCantidad(it.cantidad)}</td>
                        <td style={td}>
                          {it.tiene_ficha ? (
                            <button type="button" onClick={() => verFicha(it.item_id)}
                              style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #2563EB", background: "#DBEAFE", color: "#1E40AF", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                              📎 Ver ficha
                            </button>
                          ) : <span style={{ color: "#94a3b8" }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen ? (
        <SolicitarTratamientoModal
          onClose={() => setModalOpen(false)}
          onError={(msg) => setError(msg)}
          onCreated={() => {
            setModalOpen(false);
            setOk("Solicitud de tratamiento creada. El material queda reservado a la espera de aprobación.");
            setTimeout(() => setOk(""), 5000);
            cargar();
          }}
        />
      ) : null}
    </div>
  );
}
