import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  getProductos,
  createPedido,
  updateProductoInterno,
  createProducto,
  updateProducto,
  deleteProducto,
  importarProductos,
  getFichaProducto,
} from "../api/api";
import { formatCantidad, formatCantidadConUnidad } from "../utils/numero";
import {
  getUnidadProducto,
  getProductFormatoConfig,
  getFormatoOptions,
} from "../utils/formato";
import VerPlanta from "../components/VerPlanta";
import { usePlantsWithImage, usePlantImage } from "../utils/plantImages";

const TAMANOS = ["Semillero", "M12", "M20", "M35"];

function fmtErr(e) {
  const status = e?.response?.status;
  const data = e?.response?.data;
  if (status === 422 && Array.isArray(data?.detail)) {
    return data.detail.map((d) => `${(d.loc || []).join(".")}: ${d.msg}`).join(" | ");
  }
  return data?.detail || e?.message || "Error";
}

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

function productScientificName(producto) {
  // ESTRICTO: solo nombre_cientifico. Sin fallback a nombre_natural para que
  // la columna "Nombre científico" muestre siempre lo que dice la cabecera.
  return producto?.nombre_cientifico || "-";
}

function productCommonName(producto) {
  return producto?.nombre_natural || "-";
}

// Fila memoizada de producto: solo se re-renderiza cuando cambia su producto
// o alguna de sus props funcionales. Sin memoización, al pulsar "Pedir más"
// React re-renderiza las cientos de filas porque el padre cambia de estado.
// Con memo + handlers estables (useCallback) cada fila se queda intacta, lo
// que hace que el modal aparezca instantáneamente.
const ProductoRow = memo(function ProductoRow({
  p,
  esEmpresaExterna,
  puedeMarcarInterno,
  puedePedirMas,
  onToggleInterno,
  onPedirMas,
  onVerFicha,
}) {
  const stock = Number(p.stock ?? 0);
  const min = p.stock_minimo;
  const low =
    !esEmpresaExterna &&
    min !== null &&
    min !== undefined &&
    Number.isFinite(Number(min)) &&
    stock < Number(min);
  // Cacheamos la unidad por fila — antes se llamaba dos veces (stock y mínimo).
  const unidad = getUnidadProducto(p);

  return (
    <tr style={low ? { color: "crimson", fontWeight: 800 } : undefined}>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 900 }}>{productScientificName(p)}</span>
          <button
            type="button"
            onClick={() => onVerFicha && onVerFicha(p)}
            title="Ver ficha del producto (stock, distribución, movimientos e imagen)"
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid rgba(29,78,216,0.30)",
              background: "rgba(59,130,246,0.08)",
              color: "#1d4ed8",
              fontWeight: 900,
              fontSize: 12,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Ficha producto
          </button>
        </div>
      </td>
      <td>
        <div style={{ color: "#475569", fontWeight: 700 }}>{productCommonName(p)}</div>
      </td>
      <td>{p.categoria ?? "-"}</td>
      <td>{p.subcategoria ?? "-"}</td>
      <td style={{ textAlign: "center", fontWeight: 800 }}>
        {formatCantidadConUnidad(stock, unidad) || "0"}
      </td>
      {!esEmpresaExterna && (
        <td style={{ textAlign: "center", fontWeight: 800, color: Number(p.reservado || 0) > 0 ? "#92400e" : "#94a3b8" }}
            title="Unidades comprometidas por pedidos vivos (reserva/aprobados sin servir)">
          {Number(p.reservado || 0) > 0 ? formatCantidadConUnidad(p.reservado, unidad) : "—"}
        </td>
      )}
      {!esEmpresaExterna && (() => {
        // Disponible real = stock − reservado − semillero − stock con fecha
        // futura (y tamaños no válidos por tipo de planta). Lo calcula el backend.
        const disp = Number(p.disponible ?? 0);
        return (
          <td style={{ textAlign: "center", fontWeight: 800, color: disp > 0 ? "#065f46" : "#991b1b" }}
              title="Disponible = stock − reservado − semillero − stock con fecha de disponibilidad futura">
            {formatCantidadConUnidad(disp, unidad) || "0"}
          </td>
        );
      })()}
      {!esEmpresaExterna && (
        <td style={{ textAlign: "center" }}>
          {p.stock_minimo === null || p.stock_minimo === undefined
            ? "-"
            : formatCantidadConUnidad(p.stock_minimo, unidad)}
        </td>
      )}
      {puedeMarcarInterno && (
        <td style={{ textAlign: "center" }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              fontWeight: 700,
              color: p.es_interno ? "#92400e" : "#475569",
            }}
            title={
              p.es_interno
                ? "Interno: oculto para Empresa Externa"
                : "Visible para todos los roles"
            }
          >
            <input
              type="checkbox"
              checked={!!p.es_interno}
              onChange={() => onToggleInterno(p)}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            {p.es_interno ? "Sí" : "No"}
          </label>
        </td>
      )}
      {puedePedirMas && (
        <td style={{ textAlign: "center" }}>
          <button
            onClick={() => onPedirMas(p)}
            style={{
              padding: "6px 12px",
              borderRadius: 10,
              border: "1px solid rgba(16,185,129,0.28)",
              background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
              fontSize: 13,
            }}
            title="Añadir este producto a la cesta de reposición"
          >
            Pedir más
          </button>
        </td>
      )}
    </tr>
  );
});


function FichaSection({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.3, color: "#64748b", marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}
function FichaRow({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", borderBottom: "1px solid rgba(15,23,42,0.05)" }}>
      <span style={{ color: "#64748b", fontWeight: 700 }}>{k}</span>
      <span style={{ fontWeight: 800, color: "#0f172a", textAlign: "right" }}>{v}</span>
    </div>
  );
}
function FichaMuted({ children }) {
  return <div style={{ color: "#94a3b8", fontWeight: 700, fontSize: 13 }}>{children}</div>;
}
function fichaTipoPill(tipo) {
  const t = String(tipo || "").toLowerCase();
  const base = { display: "inline-flex", padding: "2px 8px", borderRadius: 999, fontWeight: 900, fontSize: 11, textTransform: "capitalize" };
  if (t.includes("entrada")) return { ...base, background: "rgba(16,185,129,0.14)", color: "#065f46" };
  if (t.includes("salida")) return { ...base, background: "rgba(239,68,68,0.12)", color: "#991b1b" };
  if (t.includes("traslado")) return { ...base, background: "rgba(59,130,246,0.12)", color: "#1e3a8a" };
  return { ...base, background: "rgba(100,116,139,0.14)", color: "#334155" };
}

function FichaProductoModal({ producto, esEmpresaExterna = false, onClose }) {
  const p = producto;
  const imgUrl = usePlantImage(p?.nombre_cientifico);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!p) { setData(null); return; }
    let cancel = false;
    setLoading(true); setError(""); setData(null);
    getFichaProducto(p.id)
      .then((d) => { if (!cancel) setData(d); })
      .catch((e) => { if (!cancel) setError(e?.response?.data?.detail || e?.message || "No se pudo cargar la ficha."); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [p?.id]);

  if (!p) return null;

  const unidad = getUnidadProducto(p);
  const stock = Number(p.stock ?? 0);
  const reservado = Number(p.reservado ?? 0);
  const disponible = Number(p.disponible ?? 0);
  const distribucion = data?.distribucion || [];
  const movimientos = data?.movimientos || [];
  const fmtFecha = (v) => { if (!v) return "—"; const d = new Date(v); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-ES"); };
  const movOD = (m) => {
    const org = [m.zona_origen, m.tamano_origen].filter(Boolean).join(" ") || m.origen_tipo || "—";
    const dstExt = [m.distrito_destino, m.barrio_destino, m.direccion_destino].filter(Boolean).join(" · ");
    const dst = [m.zona_destino, m.tamano_destino].filter(Boolean).join(" ") || dstExt || m.destino_tipo || "—";
    return { org, dst };
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.6)", backdropFilter: "blur(4px)", zIndex: 1400, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(1000px, 96vw)", maxHeight: "92vh", background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 30px 80px rgba(2,6,23,0.4)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 20px", borderBottom: "1px solid rgba(15,23,42,0.08)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 900, fontStyle: "italic", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{productScientificName(p)}</div>
            <div style={{ color: "#64748b", fontWeight: 700 }}>{productCommonName(p)}</div>
          </div>
          <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.14)", background: "#f8fafc", color: "#334155", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" }}>Cerrar</button>
        </div>

        <div style={{ padding: 18, display: "flex", gap: 18, flexWrap: "wrap", overflowY: "auto" }}>
          {imgUrl ? (
            <div style={{ flex: "1 1 320px", minWidth: 260, alignSelf: "flex-start", background: "#0f172a", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
              <img src={imgUrl} alt={productScientificName(p)} style={{ maxWidth: "100%", maxHeight: "68vh", borderRadius: 10, display: "block" }} />
            </div>
          ) : null}

          <div style={{ flex: "2 1 360px", minWidth: 280 }}>
            <FichaSection title="Datos">
              <FichaRow k="Nombre científico" v={p.nombre_cientifico || "—"} />
              <FichaRow k="Nombre común" v={p.nombre_natural || "—"} />
              <FichaRow k="Categoría" v={p.categoria || "—"} />
              <FichaRow k="Subcategoría" v={p.subcategoria || "—"} />
            </FichaSection>

            <FichaSection title="Stock">
              <FichaRow k="Stock total" v={formatCantidadConUnidad(stock, unidad) || "0"} />
              {!esEmpresaExterna ? <FichaRow k="Reservado" v={reservado > 0 ? formatCantidadConUnidad(reservado, unidad) : "—"} /> : null}
              {!esEmpresaExterna ? <FichaRow k="Disponible" v={formatCantidadConUnidad(disponible, unidad) || "0"} /> : null}
            </FichaSection>

            {!esEmpresaExterna ? (
              <FichaSection title="Distribución">
                {loading ? <FichaMuted>Cargando…</FichaMuted> : distribucion.length === 0 ? <FichaMuted>Sin stock en ninguna zona.</FichaMuted> : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {distribucion.map((d, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)", fontWeight: 700, color: "#334155" }}>
                        <span style={{ fontWeight: 900, color: "#0f172a" }}>{formatCantidad(d.cantidad)} {unidad}</span>
                        <span>· {d.tamano || "—"}</span>
                        <span>· Zona {d.zona || "—"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </FichaSection>
            ) : null}

            {!esEmpresaExterna ? (
              <FichaSection title={`Movimientos${movimientos.length ? ` (${movimientos.length})` : ""}`}>
                {loading ? <FichaMuted>Cargando…</FichaMuted> : error ? <FichaMuted>{error}</FichaMuted> : movimientos.length === 0 ? <FichaMuted>Sin movimientos registrados.</FichaMuted> : (
                  <div style={{ display: "grid", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                    {movimientos.map((m) => {
                      const od = movOD(m);
                      return (
                        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "#fff", border: "1px solid rgba(15,23,42,0.07)", flexWrap: "wrap" }}>
                          <span style={fichaTipoPill(m.tipo_movimiento)}>{m.tipo_movimiento || "—"}</span>
                          <span style={{ fontWeight: 900, color: "#0f172a" }}>{formatCantidad(m.cantidad)}</span>
                          <span style={{ color: "#64748b", fontWeight: 700, fontSize: 12.5 }}>{od.org} → {od.dst}</span>
                          <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>{fmtFecha(m.fecha_movimiento)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </FichaSection>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PedirMasModal({ open, producto, onClose, onAddToCart, saving }) {
  // El modal "pedir más" usa la lógica de formato/cantidad por categoría
  // (la misma que en Movimientos) para que fitosanitarios pidan formato
  // (Líquido/Polvo/…) en lugar de "M12", y áridos/ferretería rellenen su
  // unidad automáticamente.
  const formatoConfig = useMemo(
    () => getProductFormatoConfig(producto),
    [producto]
  );
  const opcionesFormato = useMemo(
    () => getFormatoOptions(formatoConfig),
    [formatoConfig]
  );

  const valorPorDefectoFormato = () => {
    if (formatoConfig.kind === "formato_fijo") return formatoConfig.value;
    return ""; // que el usuario elija explícitamente
  };

  const [tamano, setTamano] = useState(valorPorDefectoFormato());
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setTamano(valorPorDefectoFormato());
      setCantidad("");
      setNota("");
      setErr("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, producto?.id]);

  if (!open || !producto) return null;

  // Etiqueta dinámica de cantidad (Líquido → "Litros"; resto fito → "Kg";
  // áridos → "Cantidad (m³)", etc.).
  const cantidadLabel =
    formatoConfig.kind === "formato_dropdown" && typeof formatoConfig.getCantidadLabel === "function"
      ? formatoConfig.getCantidadLabel(tamano)
      : formatoConfig.cantidadLabel || "Cantidad";

  const submit = async () => {
    setErr("");
    const q = Number(cantidad);
    if (!q || q <= 0) {
      setErr("La cantidad debe ser mayor que 0.");
      return;
    }
    if (!tamano && formatoConfig.kind !== "formato_fijo") {
      setErr(`Selecciona ${formatoConfig.label.toLowerCase()}.`);
      return;
    }
    const tamanoEfectivo = tamano || formatoConfig.value || "";
    try {
      await onAddToCart({
        producto_id: producto.id,
        producto_nombre: producto.nombre_cientifico || producto.nombre_natural || `Producto #${producto.id}`,
        producto_categoria: producto.categoria,
        tamano: tamanoEfectivo,
        cantidad: q,
        nota,
      });
    } catch (e) {
      setErr(fmtErr(e));
    }
  };

  return (
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
          width: "min(520px, 96vw)",
          background: "white",
          borderRadius: 22,
          padding: 24,
          boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
          Añadir a la cesta
        </div>
        <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
          Selecciona formato y cantidad. Podrás añadir más productos antes de finalizar el pedido de reposición.
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            background: "#f8fafc",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <div style={{ fontWeight: 900, color: "#0f172a" }}>
            {productScientificName(producto)}
          </div>
          <div style={{ marginTop: 4, color: "#475569", fontWeight: 800, fontSize: 13 }}>
            Nombre común: {productCommonName(producto)}
          </div>
          <div style={{ marginTop: 4, color: "#64748b", fontWeight: 700, fontSize: 13 }}>
            {(producto.categoria || "—") + " · " + (producto.subcategoria || "—")}
          </div>
          <div style={{ marginTop: 4, color: "#64748b", fontWeight: 700, fontSize: 13 }}>
            Origen: Empresa Externa · Destino: Vivero
          </div>
        </div>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {formatoConfig.kind !== "formato_fijo" ? (
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6, textTransform: "uppercase" }}>
                {formatoConfig.label}
              </div>
              <select
                value={tamano}
                onChange={(e) => setTamano(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(15,23,42,0.12)",
                  fontWeight: 700,
                }}
              >
                <option value="">{`Seleccionar ${formatoConfig.label.toLowerCase()}`}</option>
                {opcionesFormato.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div style={formatoConfig.kind === "formato_fijo" ? { gridColumn: "span 2" } : undefined}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6, textTransform: "uppercase" }}>
              {cantidadLabel}
            </div>
            <input
              type="number"
              min={formatoConfig.allowDecimals ? "0.001" : 1}
              step={formatoConfig.allowDecimals ? "0.001" : "1"}
              value={cantidad}
              onChange={(e) => setCantidad(formatoConfig.allowDecimals ? e.target.value : e.target.value.replace(/[^\d]/g, ""))}
              placeholder={formatoConfig.allowDecimals ? "0.00" : "0"}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.12)",
                fontWeight: 700,
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6, textTransform: "uppercase" }}>
            Nota (opcional)
          </div>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Motivo de la reposición..."
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.12)",
              fontWeight: 700,
              minHeight: 80,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>

        {err ? (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 10,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.20)",
              color: "#991b1b",
              fontWeight: 800,
            }}
          >
            {err}
          </div>
        ) : null}

        <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.10)",
              background: "white",
              color: "#0f172a",
              fontWeight: 900,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid rgba(16,185,129,0.28)",
              background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
              color: "white",
              fontWeight: 900,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Añadiendo..." : "🛒 Añadir a la cesta"}
          </button>
        </div>
      </div>
    </div>
  );
}


function CartModal({ open, cart, onClose, onRemove, onUpdate, onFinalizar, onAddMore, saving, errorMsg }) {
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (open) setNota("");
  }, [open]);

  if (!open) return null;

  const total = cart.reduce((sum, it) => sum + Number(it.cantidad || 0), 0);
  const lineCount = cart.length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.52)",
        backdropFilter: "blur(4px)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(720px, 96vw)",
          maxHeight: "92vh",
          background: "white",
          borderRadius: 22,
          padding: 24,
          boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
              🛒 Cesta de reposición
            </div>
            <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
              {lineCount === 0
                ? "Aún no has añadido productos a la cesta."
                : `${lineCount} ${lineCount === 1 ? "línea" : "líneas"} · ${formatCantidad(total)} unidades totales`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "6px 12px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.10)",
              background: "white",
              color: "#64748b",
              fontWeight: 800,
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
            title="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Lista de items */}
        <div style={{ overflowY: "auto", marginTop: 8, marginBottom: 12, flex: 1 }}>
          {cart.length === 0 ? (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: "#64748b",
                fontWeight: 700,
                border: "1px dashed rgba(15,23,42,0.12)",
                borderRadius: 14,
                background: "#fbfdff",
              }}
            >
              Pulsa "Pedir más" en cualquier producto del listado para empezar.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {cart.map((it, idx) => {
                const unidad = getUnidadProducto({ categoria: it.producto_categoria, nombre_cientifico: it.producto_nombre });
                const itemDecimales = getProductFormatoConfig({ categoria: it.producto_categoria, nombre_cientifico: it.producto_nombre }).allowDecimals;
                return (
                  <div
                    key={`${it.producto_id}-${it.tamano}-${idx}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 140px 90px 40px",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: "#f8fafc",
                      border: "1px solid rgba(15,23,42,0.06)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900, color: "#0f172a" }}>{it.producto_nombre}</div>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginTop: 2 }}>
                        {it.producto_categoria || "—"} · Tamaño/Formato: <strong>{it.tamano || "—"}</strong>
                      </div>
                    </div>
                    <input
                      type="number"
                      min={itemDecimales ? 0.001 : 1}
                      step={itemDecimales ? "any" : "1"}
                      value={it.cantidad}
                      onChange={(e) => onUpdate(idx, { cantidad: itemDecimales ? e.target.value : e.target.value.replace(/[^\d]/g, "") })}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(15,23,42,0.12)",
                        fontWeight: 800,
                        textAlign: "right",
                      }}
                    />
                    <div style={{ fontWeight: 800, color: "#64748b", fontSize: 13 }}>{unidad}</div>
                    <button
                      type="button"
                      onClick={() => onRemove(idx)}
                      disabled={saving}
                      title="Quitar de la cesta"
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(239,68,68,0.30)",
                        background: "rgba(239,68,68,0.10)",
                        color: "#991b1b",
                        fontWeight: 900,
                        cursor: saving ? "not-allowed" : "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Nota general del pedido */}
        {cart.length > 0 ? (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6, textTransform: "uppercase" }}>
              Nota del pedido (opcional)
            </div>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Motivo de la reposición, urgencia, observaciones..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.12)",
                fontWeight: 700,
                minHeight: 60,
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>
        ) : null}

        {/* Mensaje de error global */}
        {errorMsg ? (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 10,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.20)",
              color: "#991b1b",
              fontWeight: 800,
            }}
          >
            {errorMsg}
          </div>
        ) : null}

        {/* Botones */}
        <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onAddMore}
            disabled={saving}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid rgba(59,130,246,0.30)",
              background: "rgba(59,130,246,0.10)",
              color: "#1d4ed8",
              fontWeight: 900,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            ＋ Añadir otro producto
          </button>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.10)",
                background: "white",
                color: "#0f172a",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              Seguir comprando
            </button>
            <button
              type="button"
              onClick={() => onFinalizar(nota)}
              disabled={saving || cart.length === 0}
              style={{
                padding: "10px 18px",
                borderRadius: 12,
                border: "1px solid rgba(16,185,129,0.28)",
                background: (saving || cart.length === 0)
                  ? "rgba(16,185,129,0.30)"
                  : "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
                color: "white",
                fontWeight: 900,
                cursor: (saving || cart.length === 0) ? "not-allowed" : "pointer",
                minWidth: 180,
              }}
            >
              {saving ? "Enviando..." : "✓ Finalizar pedido"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function GestionProductosModal({ open, productos, esAdmin = false, onClose, onChanged }) {
  const [tab, setTab] = useState("listado");
  const [search, setSearch] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroSubcategoria, setFiltroSubcategoria] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [nuevo, setNuevo] = useState({
    nombre_cientifico: "",
    nombre_natural: "",
    categoria: "",
    subcategoria: "",
    stock_minimo: 0,
    es_interno: false,
    precio: "",
  });
  const [nuevoCategoriaSel, setNuevoCategoriaSel] = useState("");
  const [nuevoSubcategoriaSel, setNuevoSubcategoriaSel] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [file, setFile] = useState(null);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    if (!open) {
      setTab("listado");
      setSearch("");
      setEditingId(null);
      setEditForm({});
      setNuevo({
        nombre_cientifico: "",
        nombre_natural: "",
        categoria: "",
        subcategoria: "",
        stock_minimo: 0,
        es_interno: false,
        precio: "",
      });
      setNuevoCategoriaSel("");
      setNuevoSubcategoriaSel("");
      setSaving(false);
      setMsg("");
      setErr("");
      setFile(null);
      setImportResult(null);
    }
  }, [open]);

  const showMsg = (text) => {
    setMsg(text);
    setErr("");
    setTimeout(() => setMsg(""), 3000);
  };
  const showErr = (text) => {
    setErr(text);
    setMsg("");
  };

  // Categorías y subcategorías presentes en el catálogo (para los desplegables).
  const categoriasDisponibles = useMemo(() => {
    const set = new Set();
    for (const p of Array.isArray(productos) ? productos : []) {
      const c = String(p?.categoria || "").trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [productos]);

  const subcategoriasDisponibles = useMemo(() => {
    if (!filtroCategoria) return [];
    const set = new Set();
    for (const p of Array.isArray(productos) ? productos : []) {
      if (String(p?.categoria || "").trim() !== filtroCategoria) continue;
      const s = String(p?.subcategoria || "").trim();
      if (s) set.add(s);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [productos, filtroCategoria]);

  // Al cambiar de categoría, se limpia la subcategoría (dependen entre sí).
  useEffect(() => {
    setFiltroSubcategoria("");
  }, [filtroCategoria]);

  const productosFiltrados = useMemo(() => {
    const t = search.trim().toLowerCase();
    const base = Array.isArray(productos) ? productos : [];
    return base.filter((p) => {
      if (filtroCategoria && String(p.categoria || "").trim() !== filtroCategoria) return false;
      if (filtroSubcategoria && String(p.subcategoria || "").trim() !== filtroSubcategoria) return false;
      if (!t) return true;
      return (
        String(p.nombre_cientifico || "").toLowerCase().includes(t) ||
        String(p.nombre_natural || "").toLowerCase().includes(t) ||
        String(p.categoria || "").toLowerCase().includes(t) ||
        String(p.subcategoria || "").toLowerCase().includes(t)
      );
    });
  }, [productos, search, filtroCategoria, filtroSubcategoria]);

  // Exporta TODOS los productos del catálogo a CSV (lo abre Excel).
  const exportarProductosExcel = () => {
    const lista = Array.isArray(productos) ? productos : [];
    const esc = (v) => {
      const s = String(v ?? "");
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ["Nombre científico", "Nombre común", "Categoría", "Subcategoría", "Stock", "Reservado", "Disponible", "Stock mínimo", "Precio (€)", "Interno"];
    const lineas = lista.map((p) =>
      [
        p.nombre_cientifico || "",
        p.nombre_natural || "",
        p.categoria || "",
        p.subcategoria || "",
        p.stock ?? "",
        p.reservado ?? 0,
        p.disponible ?? 0,
        p.stock_minimo === null || p.stock_minimo === undefined ? "" : p.stock_minimo,
        p.precio === null || p.precio === undefined ? "" : Number(p.precio).toFixed(2).replace(".", ","),
        p.es_interno ? "Sí" : "No",
      ].map(esc).join(";")
    );
    const csv = [headers.map(esc).join(";"), ...lineas].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "productos_vivero.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditForm({
      nombre_cientifico: p.nombre_cientifico || "",
      nombre_natural: p.nombre_natural || "",
      categoria: p.categoria || "",
      subcategoria: p.subcategoria || "",
      stock_minimo: p.stock_minimo ?? 0,
      es_interno: !!p.es_interno,
      precio: p.precio ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const payload = {
        ...editForm,
        precio: editForm.precio === "" || editForm.precio == null ? null : Number(editForm.precio),
      };
      await updateProducto(editingId, payload);
      showMsg("Producto actualizado.");
      cancelEdit();
      onChanged && (await onChanged());
    } catch (e) {
      showErr(fmtErr(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Complementos de árbol (pack UTE): etiqueta por producto ──
  const COMPLEMENTO_SLOTS = [
    { slug: "tutores", label: "Tutores 2,4", porArbol: "3 uds" },
    { slug: "travesanos", label: "Travesaños", porArbol: "3 uds" },
    { slug: "clavos", label: "Clavos dulces", porArbol: "12 uds" },
    { slug: "cinta", label: "Cinta de entutorar", porArbol: "1 ud" },
    { slug: "hebillas", label: "Hebillas", porArbol: "3 uds" },
  ];
  const _normCat = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const ferreteriaProds = useMemo(
    () =>
      (Array.isArray(productos) ? productos : [])
        .filter((p) => _normCat(p.categoria) === "ferreteria")
        .sort((a, b) =>
          String(a.nombre_cientifico || a.nombre_natural || "").localeCompare(
            String(b.nombre_cientifico || b.nombre_natural || ""), "es"
          )
        ),
    [productos]
  );
  const prodDeSlot = (slug) =>
    (Array.isArray(productos) ? productos : []).find(
      (p) => String(p.complemento_arbol || "").toLowerCase() === slug
    ) || null;
  const [compBusy, setCompBusy] = useState(false);
  const setComplementoSlot = async (slug, nuevoId) => {
    setCompBusy(true);
    setErr("");
    try {
      const actual = prodDeSlot(slug);
      const nuevoIdNum = nuevoId ? Number(nuevoId) : null;
      // Quita la etiqueta del producto anterior (si lo había y cambia).
      if (actual && actual.id !== nuevoIdNum) {
        await updateProducto(actual.id, { complemento_arbol: "" });
      }
      // Asigna la etiqueta al nuevo producto (o deja el slot vacío).
      if (nuevoIdNum) {
        await updateProducto(nuevoIdNum, { complemento_arbol: slug });
      }
      showMsg("Complemento actualizado.");
      onChanged && (await onChanged());
    } catch (e) {
      showErr(fmtErr(e));
    } finally {
      setCompBusy(false);
    }
  };

  const removeProduct = async (p) => {
    if (!window.confirm(`¿Eliminar el producto "${p.nombre_cientifico}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setSaving(true);
    try {
      await deleteProducto(p.id);
      showMsg("Producto eliminado.");
      onChanged && (await onChanged());
    } catch (e) {
      const status = e?.response?.status;
      // Bloqueado por stock/historial (400). Si es admin, ofrecemos borrado
      // forzado que elimina el producto y TODO su historial (movimientos,
      // lotes, inventario, líneas de pedido, cambios de modificación).
      if (status === 400 && esAdmin) {
        const ok = window.confirm(
          `"${p.nombre_cientifico}" tiene stock o historial (movimientos/pedidos).\n\n` +
          `¿Eliminarlo DE TODAS FORMAS junto con TODO su historial? ` +
          `Se borrarán sus movimientos, lotes, inventario y líneas de pedido. Esta acción es IRREVERSIBLE.`
        );
        if (ok) {
          try {
            await deleteProducto(p.id, { force: true });
            showMsg("Producto y su historial eliminados.");
            onChanged && (await onChanged());
          } catch (e2) {
            showErr(fmtErr(e2));
          } finally {
            setSaving(false);
          }
          return;
        }
      }
      showErr(fmtErr(e));
    } finally {
      setSaving(false);
    }
  };

  const submitNuevo = async () => {
    if (!nuevo.nombre_cientifico.trim() || !nuevo.categoria.trim() || !nuevo.subcategoria.trim()) {
      showErr("Nombre científico, categoría y subcategoría son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      await createProducto({
        nombre_cientifico: nuevo.nombre_cientifico.trim(),
        nombre_natural: nuevo.nombre_natural.trim() || null,
        categoria: nuevo.categoria.trim(),
        subcategoria: nuevo.subcategoria.trim(),
        stock_minimo: Number(nuevo.stock_minimo) || 0,
        es_interno: !!nuevo.es_interno,
        precio: nuevo.precio === "" || nuevo.precio == null ? null : Number(nuevo.precio),
      });
      showMsg("Producto creado.");
      setNuevo({
        nombre_cientifico: "",
        nombre_natural: "",
        categoria: "",
        subcategoria: "",
        stock_minimo: 0,
        es_interno: false,
        precio: "",
      });
      setNuevoCategoriaSel("");
      setNuevoSubcategoriaSel("");
      onChanged && (await onChanged());
    } catch (e) {
      showErr(fmtErr(e));
    } finally {
      setSaving(false);
    }
  };

  const submitImport = async () => {
    if (!file) {
      showErr("Selecciona un archivo CSV o Excel primero.");
      return;
    }
    setSaving(true);
    setImportResult(null);
    try {
      const res = await importarProductos(file);
      setImportResult(res);
      showMsg(`Importación completada: ${res.insertados} nuevos, ${res.actualizados} actualizados.`);
      onChanged && (await onChanged());
    } catch (e) {
      showErr(fmtErr(e));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const inputS = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(15,23,42,0.15)",
    fontWeight: 700,
    boxSizing: "border-box",
  };
  const tabBtnS = (active) => ({
    padding: "10px 16px",
    borderRadius: 10,
    border: active ? "1px solid rgba(6,182,212,0.35)" : "1px solid rgba(15,23,42,0.10)",
    background: active ? "linear-gradient(135deg, #0ea5e9 0%, #06b6d4 60%, #10b981 100%)" : "white",
    color: active ? "white" : "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.55)",
        zIndex: 1500,
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
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 96vw)",
          background: "white",
          borderRadius: 20,
          boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
          display: "flex",
          flexDirection: "column",
          marginTop: "auto",
          marginBottom: "auto",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid rgba(15,23,42,0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            gap: 16,
            position: "sticky",
            top: 0,
            background: "white",
            zIndex: 2,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Gestionar productos</div>
            <div style={{ marginTop: 4, color: "#64748b", fontWeight: 700, fontSize: 14 }}>
              Alta, baja, edición e importación masiva.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              fontWeight: 900,
              cursor: "pointer",
              background: "#f59e0b",
              color: "#111827",
              border: "2px solid #000",
            }}
          >
            Cerrar
          </button>
        </div>

        <div style={{ padding: "14px 22px", display: "flex", gap: 8, borderBottom: "1px solid rgba(15,23,42,0.05)" }}>
          <button onClick={() => setTab("listado")} style={tabBtnS(tab === "listado")}>Listado</button>
          <button onClick={() => setTab("nuevo")} style={tabBtnS(tab === "nuevo")}>Nuevo producto</button>
          <button onClick={() => setTab("importar")} style={tabBtnS(tab === "importar")}>Importar CSV/Excel</button>
          {esAdmin ? (
            <button onClick={() => setTab("complementos")} style={tabBtnS(tab === "complementos")}>🌳 Complementos árbol</button>
          ) : null}
        </div>

        {msg ? (
          <div style={{ margin: "12px 22px 0", padding: "10px 14px", borderRadius: 10, background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)", color: "#065f46", fontWeight: 800 }}>
            {msg}
          </div>
        ) : null}
        {err ? (
          <div style={{ margin: "12px 22px 0", padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#991b1b", fontWeight: 800 }}>
            {err}
          </div>
        ) : null}

        <div style={{ padding: 22 }}>
          {tab === "listado" && (
            <div>
              <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar producto..."
                  style={{ ...inputS, flex: "1 1 220px", marginBottom: 0 }}
                />
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  style={{ ...inputS, flex: "0 1 200px", marginBottom: 0 }}
                >
                  <option value="">Todas las categorías</option>
                  {categoriasDisponibles.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={filtroSubcategoria}
                  onChange={(e) => setFiltroSubcategoria(e.target.value)}
                  disabled={!filtroCategoria || subcategoriasDisponibles.length === 0}
                  style={{ ...inputS, flex: "0 1 200px", marginBottom: 0, opacity: filtroCategoria ? 1 : 0.55 }}
                >
                  <option value="">Todas las subcategorías</option>
                  {subcategoriasDisponibles.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {(search || filtroCategoria || filtroSubcategoria) && (
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setFiltroCategoria(""); setFiltroSubcategoria(""); }}
                    style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(148,163,184,0.35)", background: "#fff", color: "#475569", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    Limpiar
                  </button>
                )}
                <button
                  type="button"
                  onClick={exportarProductosExcel}
                  disabled={!productos.length}
                  title="Exportar todos los productos a Excel"
                  style={{ marginLeft: "auto", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(16,185,129,0.35)", background: productos.length ? "rgba(16,185,129,0.10)" : "#f1f5f9", color: "#065f46", fontWeight: 800, cursor: productos.length ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
                >
                  ⬇ Exportar a Excel
                </button>
              </div>
              <div style={{ marginBottom: 10, fontSize: 13, color: "#64748b", fontWeight: 700 }}>
                {productosFiltrados.length} {productosFiltrados.length === 1 ? "producto" : "productos"}
              </div>

              <div style={{ overflowX: "auto", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", wordBreak: "break-word" }}>
                  <colgroup>
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "19%" }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ padding: 10, textAlign: "left", fontWeight: 900, fontSize: 12, color: "#334155" }}>Científico</th>
                      <th style={{ padding: 10, textAlign: "left", fontWeight: 900, fontSize: 12, color: "#334155" }}>Común</th>
                      <th style={{ padding: 10, textAlign: "left", fontWeight: 900, fontSize: 12, color: "#334155" }}>Categoría</th>
                      <th style={{ padding: 10, textAlign: "left", fontWeight: 900, fontSize: 12, color: "#334155" }}>Subcategoría</th>
                      <th style={{ padding: 10, textAlign: "center", fontWeight: 900, fontSize: 12, color: "#334155" }}>Precio (€)</th>
                      <th style={{ padding: 10, textAlign: "center", fontWeight: 900, fontSize: 12, color: "#334155" }}>Stock min.</th>
                      <th style={{ padding: 10, textAlign: "center", fontWeight: 900, fontSize: 12, color: "#334155" }}>Interno</th>
                      <th style={{ padding: 10, textAlign: "center", fontWeight: 900, fontSize: 12, color: "#334155" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: 16, textAlign: "center", color: "#64748b" }}>
                          No hay productos.
                        </td>
                      </tr>
                    ) : (
                      productosFiltrados.map((p) => {
                        const isEditing = editingId === p.id;
                        return (
                          <tr key={p.id} style={{ borderTop: "1px solid rgba(15,23,42,0.06)" }}>
                            {isEditing ? (
                              <>
                                <td style={{ padding: 6 }}>
                                  <input
                                    value={editForm.nombre_cientifico}
                                    onChange={(e) => setEditForm((f) => ({ ...f, nombre_cientifico: e.target.value }))}
                                    style={inputS}
                                  />
                                </td>
                                <td style={{ padding: 6 }}>
                                  <input
                                    value={editForm.nombre_natural || ""}
                                    onChange={(e) => setEditForm((f) => ({ ...f, nombre_natural: e.target.value }))}
                                    style={inputS}
                                  />
                                </td>
                                <td style={{ padding: 6 }}>
                                  <input
                                    value={editForm.categoria}
                                    onChange={(e) => setEditForm((f) => ({ ...f, categoria: e.target.value }))}
                                    style={inputS}
                                  />
                                </td>
                                <td style={{ padding: 6 }}>
                                  <input
                                    value={editForm.subcategoria}
                                    onChange={(e) => setEditForm((f) => ({ ...f, subcategoria: e.target.value }))}
                                    style={inputS}
                                  />
                                </td>
                                <td style={{ padding: 6 }}>
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    placeholder="—"
                                    value={editForm.precio ?? ""}
                                    onChange={(e) => setEditForm((f) => ({ ...f, precio: e.target.value }))}
                                    style={{ ...inputS, textAlign: "center" }}
                                  />
                                </td>
                                <td style={{ padding: 6 }}>
                                  <input
                                    type="number"
                                    min={0}
                                    value={editForm.stock_minimo}
                                    onChange={(e) => setEditForm((f) => ({ ...f, stock_minimo: e.target.value }))}
                                    style={{ ...inputS, textAlign: "center" }}
                                  />
                                </td>
                                <td style={{ padding: 6, textAlign: "center" }}>
                                  <input
                                    type="checkbox"
                                    checked={!!editForm.es_interno}
                                    onChange={(e) => setEditForm((f) => ({ ...f, es_interno: e.target.checked }))}
                                    style={{ width: 18, height: 18 }}
                                  />
                                </td>
                                <td style={{ padding: 6, textAlign: "center" }}>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                                    <button onClick={saveEdit} disabled={saving} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.10)", color: "#065f46", fontWeight: 900, cursor: "pointer" }}>Guardar</button>
                                    <button onClick={cancelEdit} disabled={saving} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.10)", background: "white", fontWeight: 900, cursor: "pointer" }}>Cancelar</button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td style={{ padding: 10, fontWeight: 800 }}>{p.nombre_cientifico}</td>
                                <td style={{ padding: 10 }}>{p.nombre_natural || "—"}</td>
                                <td style={{ padding: 10 }}>{p.categoria}</td>
                                <td style={{ padding: 10 }}>{p.subcategoria}</td>
                                <td style={{ padding: 10, textAlign: "center", fontWeight: 800 }}>
                                  {p.precio === null || p.precio === undefined ? "—" : `${Number(p.precio).toFixed(2).replace(".", ",")} €`}
                                </td>
                                <td style={{ padding: 10, textAlign: "center", fontWeight: 800 }}>{p.stock_minimo ?? 0}</td>
                                <td style={{ padding: 10, textAlign: "center" }}>
                                  <span style={{ padding: "2px 8px", borderRadius: 999, background: p.es_interno ? "rgba(245,158,11,0.15)" : "rgba(148,163,184,0.15)", color: p.es_interno ? "#92400e" : "#475569", fontWeight: 900, fontSize: 12 }}>
                                    {p.es_interno ? "Sí" : "No"}
                                  </span>
                                </td>
                                <td style={{ padding: 10, textAlign: "center" }}>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                                    <button onClick={() => startEdit(p)} disabled={saving} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.08)", color: "#1d4ed8", fontWeight: 900, cursor: "pointer" }}>Editar</button>
                                    <button onClick={() => removeProduct(p)} disabled={saving} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#991b1b", fontWeight: 900, cursor: "pointer" }}>Eliminar</button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "nuevo" && (() => {
            const categoriasExistentes = [
              ...new Set(
                (Array.isArray(productos) ? productos : [])
                  .map((p) => String(p?.categoria || "").trim())
                  .filter(Boolean)
              ),
            ].sort((a, b) => a.localeCompare(b, "es"));

            const subcategoriasParaCategoria = [
              ...new Set(
                (Array.isArray(productos) ? productos : [])
                  .filter((p) => !nuevoCategoriaSel || String(p?.categoria || "").trim() === nuevoCategoriaSel)
                  .map((p) => String(p?.subcategoria || "").trim())
                  .filter(Boolean)
              ),
            ].sort((a, b) => a.localeCompare(b, "es"));

            return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Nombre científico *</div>
                <input value={nuevo.nombre_cientifico} onChange={(e) => setNuevo((n) => ({ ...n, nombre_cientifico: e.target.value }))} style={inputS} placeholder="Ej: Phoenix canariensis" />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Nombre común</div>
                <input value={nuevo.nombre_natural} onChange={(e) => setNuevo((n) => ({ ...n, nombre_natural: e.target.value }))} style={inputS} placeholder="Ej: Palmera canaria" />
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Categoría *</div>
                <select
                  value={nuevoCategoriaSel}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNuevoCategoriaSel(v);
                    setNuevoSubcategoriaSel(""); // reset subcat al cambiar cat
                    setNuevo((n) => ({
                      ...n,
                      categoria: v === "__NUEVA__" ? "" : v,
                      subcategoria: "",
                    }));
                  }}
                  style={inputS}
                >
                  <option value="">Seleccionar categoría</option>
                  {categoriasExistentes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__NUEVA__">＋ Nueva categoría</option>
                </select>
                {nuevoCategoriaSel === "__NUEVA__" ? (
                  <input
                    autoFocus
                    value={nuevo.categoria}
                    onChange={(e) => setNuevo((n) => ({ ...n, categoria: e.target.value }))}
                    placeholder="Escribe el nombre de la nueva categoría"
                    style={{ ...inputS, marginTop: 6 }}
                  />
                ) : null}
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Subcategoría *</div>
                <select
                  value={nuevoSubcategoriaSel}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNuevoSubcategoriaSel(v);
                    setNuevo((n) => ({ ...n, subcategoria: v === "__NUEVA__" ? "" : v }));
                  }}
                  style={inputS}
                  disabled={!nuevoCategoriaSel}
                >
                  <option value="">
                    {nuevoCategoriaSel ? "Seleccionar subcategoría" : "Primero elige categoría"}
                  </option>
                  {subcategoriasParaCategoria.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value="__NUEVA__">＋ Nueva subcategoría</option>
                </select>
                {nuevoSubcategoriaSel === "__NUEVA__" ? (
                  <input
                    autoFocus
                    value={nuevo.subcategoria}
                    onChange={(e) => setNuevo((n) => ({ ...n, subcategoria: e.target.value }))}
                    placeholder="Escribe el nombre de la nueva subcategoría"
                    style={{ ...inputS, marginTop: 6 }}
                  />
                ) : null}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Stock mínimo</div>
                <input type="number" min={0} value={nuevo.stock_minimo} onChange={(e) => setNuevo((n) => ({ ...n, stock_minimo: e.target.value }))} style={inputS} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Precio unitario (€)</div>
                <input type="number" min={0} step="0.01" value={nuevo.precio} onChange={(e) => setNuevo((n) => ({ ...n, precio: e.target.value }))} style={inputS} placeholder="Ej: 12,50" />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.10)", background: nuevo.es_interno ? "rgba(245,158,11,0.08)" : "white", fontWeight: 800, color: "#0f172a", cursor: "pointer", marginTop: 22 }}>
                <input type="checkbox" checked={nuevo.es_interno} onChange={(e) => setNuevo((n) => ({ ...n, es_interno: e.target.checked }))} style={{ width: 18, height: 18 }} />
                Producto interno (oculto a empresa externa)
              </label>

              <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button onClick={submitNuevo} disabled={saving} style={{ padding: "12px 18px", borderRadius: 12, border: "1px solid rgba(16,185,129,0.3)", background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)", color: "white", fontWeight: 900, cursor: "pointer", opacity: saving ? 0.75 : 1 }}>
                  {saving ? "Creando..." : "Crear producto"}
                </button>
              </div>
            </div>
            );
          })()}

          {tab === "importar" && (
            <div>
              <div style={{ padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.08)", marginBottom: 14 }}>
                <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>Formato del archivo</div>
                <div style={{ color: "#475569", fontWeight: 700, fontSize: 14, lineHeight: 1.5 }}>
                  CSV o Excel (.xlsx). Columnas (no importa mayúsculas, acentos o guiones bajos):
                  <ul style={{ margin: "6px 0 0 18px" }}>
                    <li><b>nombre_cientifico</b> (obligatorio)</li>
                    <li>nombre_natural / nombre común</li>
                    <li><b>categoria</b> (obligatorio)</li>
                    <li><b>subcategoria</b> (obligatorio)</li>
                    <li>stock_minimo (opcional, entero ≥ 0)</li>
                    <li>es_interno (opcional, true / false)</li>
                  </ul>
                  <div style={{ marginTop: 6 }}>
                    Los productos existentes con el mismo nombre científico se <b>actualizan</b>. Los nuevos se insertan.
                  </div>
                </div>
              </div>

              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setImportResult(null);
                }}
                style={{ marginBottom: 12 }}
              />

              <div>
                <button onClick={submitImport} disabled={saving || !file} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(16,185,129,0.3)", background: saving || !file ? "rgba(148,163,184,0.25)" : "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)", color: "white", fontWeight: 900, cursor: saving || !file ? "not-allowed" : "pointer" }}>
                  {saving ? "Importando..." : "Importar"}
                </button>
              </div>

              {importResult ? (
                <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
                  <div style={{ fontWeight: 900, color: "#065f46", marginBottom: 6 }}>Resultado de la importación</div>
                  <div style={{ color: "#0f172a", fontWeight: 800 }}>Insertados: {importResult.insertados}</div>
                  <div style={{ color: "#0f172a", fontWeight: 800 }}>Actualizados: {importResult.actualizados}</div>
                  <div style={{ color: "#0f172a", fontWeight: 800 }}>Saltados: {importResult.saltados}</div>
                  {importResult.errores?.length > 0 ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 900, color: "#991b1b" }}>Errores:</div>
                      <ul style={{ margin: "4px 0 0 18px", color: "#991b1b" }}>
                        {importResult.errores.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {tab === "complementos" && esAdmin && (
            <div>
              <div style={{ padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.08)", marginBottom: 14 }}>
                <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>🌳 Pack de complementos de árbol (UTE)</div>
                <div style={{ color: "#475569", fontWeight: 700, fontSize: 14, lineHeight: 1.5 }}>
                  Asocia cada complemento al <b>producto concreto del catálogo</b> (así no depende del nombre).
                  Cuando la UTE añade un árbol a un pedido, se le ofrece este pack —
                  <b> solo si hay stock de todos</b>. Las cantidades son por árbol.
                </div>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {COMPLEMENTO_SLOTS.map((slot) => {
                  const actual = prodDeSlot(slot.slug);
                  // La lista incluye ferretería + (por si acaso) el producto ya asignado.
                  const opciones = [...ferreteriaProds];
                  if (actual && !opciones.some((p) => p.id === actual.id)) opciones.unshift(actual);
                  return (
                    <div key={slot.slug} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr auto", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 10, background: "white", border: "1px solid rgba(15,23,42,0.08)" }}>
                      <div>
                        <div style={{ fontWeight: 900, color: "#0f172a" }}>{slot.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{slot.porArbol} por árbol</div>
                      </div>
                      <select
                        value={actual ? String(actual.id) : ""}
                        disabled={compBusy}
                        onChange={(e) => setComplementoSlot(slot.slug, e.target.value)}
                        style={{ ...inputS, width: "100%" }}
                      >
                        <option value="">— Sin asignar —</option>
                        {opciones.map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.nombre_cientifico || p.nombre_natural || `#${p.id}`}
                          </option>
                        ))}
                      </select>
                      <span style={{ fontSize: 12, fontWeight: 800, color: actual ? "#065f46" : "#991b1b", whiteSpace: "nowrap" }}>
                        {actual ? "✓ Asignado" : "Sin asignar"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, fontSize: 12.5, color: "#64748b", fontWeight: 700 }}>
                Si algún complemento queda <b>sin asignar</b>, el pack no se ofrecerá hasta completarlo
                (mientras tanto, el sistema intenta localizarlos por nombre como respaldo).
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Productos() {
  const { me } = useOutletContext();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [categoriaSel, setCategoriaSel] = useState("ALL");
  const [subcategoriaSel, setSubcategoriaSel] = useState("ALL");
  const [soloConImagen, setSoloConImagen] = useState(false);
  const [soloConStock, setSoloConStock] = useState(false);
  const [soloReservado, setSoloReservado] = useState(false);

  const [pedirProducto, setPedirProducto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [gestionOpen, setGestionOpen] = useState(false);
  const [fichaProducto, setFichaProducto] = useState(null);

  // Cesta de reposición: vive solo en memoria (al cerrar la pestaña se pierde).
  // Cada item lleva el producto_id, el formato/tamaño concreto, la cantidad y
  // metadatos para la previsualización (nombre y categoría).
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartError, setCartError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const prods = await getProductos();
      const normProds = (prods || []).map((p) => ({
        ...p,
        stock: Number(p.stock ?? 0),
      }));
      setProductos(normProds);
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const categorias = useMemo(() => {
    const set = new Set();
    productos.forEach((p) => {
      const c = (p.categoria || "").trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [productos]);

  const subcategorias = useMemo(() => {
    const set = new Set();
    productos.forEach((p) => {
      const c = (p.categoria || "").trim();
      const s = (p.subcategoria || "").trim();
      if (!s) return;
      if (categoriaSel === "ALL" || c === categoriaSel) set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [productos, categoriaSel]);

  useEffect(() => {
    setSubcategoriaSel("ALL");
  }, [categoriaSel]);

  // Ids de productos cuya imagen existe (sondeo asíncrono con caché).
  const idsConImagen = usePlantsWithImage(productos);

  const productosFiltrados = useMemo(() => {
    const qn = norm(q);

    return productos.filter((p) => {
      const c = (p.categoria || "").trim();
      const s = (p.subcategoria || "").trim();

      const okCat = categoriaSel === "ALL" || c === categoriaSel;
      const okSub = subcategoriaSel === "ALL" || s === subcategoriaSel;
      const okImg = !soloConImagen || idsConImagen.has(p.id);
      const okStock = !soloConStock || Number(p.disponible ?? 0) > 0;
      const okReservado = !soloReservado || Number(p.reservado ?? 0) > 0;

      if (!okCat || !okSub || !okImg || !okStock || !okReservado) return false;
      if (!qn) return true;

      const hay =
        norm(p.nombre_cientifico).includes(qn) ||
        norm(p.nombre_natural).includes(qn) ||
        norm(p.nombre).includes(qn) ||
        norm(p.categoria).includes(qn) ||
        norm(p.subcategoria).includes(qn);

      return hay;
    });
  }, [productos, q, categoriaSel, subcategoriaSel, soloConImagen, soloConStock, soloReservado, idsConImagen]);

  const rol = me?.rol || me?.role;
  const esEmpresaExterna = rol === "empresa_externa";
  const puedePedirMas = rol && rol !== "empresa_externa";
  const puedeMarcarInterno = rol === "admin" || rol === "manager";
  const puedeGestionar = rol === "admin" || rol === "manager" || rol === "tecnico";

  // Memoizado para mantener la referencia estable y no romper el React.memo
  // de las filas de ProductoRow.
  const toggleEsInterno = useCallback(async (producto) => {
    const nuevoValor = !producto.es_interno;
    setProductos((prev) =>
      prev.map((p) => (p.id === producto.id ? { ...p, es_interno: nuevoValor } : p))
    );
    try {
      await updateProductoInterno(producto.id, nuevoValor);
      setMsg(`Producto ${nuevoValor ? "marcado como interno" : "hecho visible a todos"}.`);
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setProductos((prev) =>
        prev.map((p) => (p.id === producto.id ? { ...p, es_interno: !nuevoValor } : p))
      );
      setError(fmtErr(e));
    }
  }, []);

  // Handler estable para abrir el modal "Pedir más" desde cualquier fila.
  // Es importante que la referencia no cambie en cada render del padre,
  // porque las filas son memo y romperíamos la memoización si pasáramos
  // una arrow function nueva en cada render.
  const openPedirMas = useCallback((p) => {
    setPedirProducto(p);
  }, []);

  // Añadir un item a la cesta. Si ya existe el mismo producto+tamaño,
  // suma cantidades; si no, lo añade como nueva línea.
  const handleAnadirACesta = async (item) => {
    setCart((prev) => {
      const idx = prev.findIndex(
        (it) => it.producto_id === item.producto_id && it.tamano === item.tamano
      );
      if (idx >= 0) {
        const copia = [...prev];
        copia[idx] = {
          ...copia[idx],
          cantidad: Number(copia[idx].cantidad || 0) + Number(item.cantidad || 0),
        };
        return copia;
      }
      return [...prev, item];
    });
    setPedirProducto(null);
    setMsg("Producto añadido a la cesta.");
    setTimeout(() => setMsg(""), 2000);
  };

  const handleUpdateCartItem = (idx, patch) => {
    setCart((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const handleRemoveCartItem = (idx) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  // Finalizar pedido: crea un único pedido de reposición con todos los
  // items de la cesta. Si va bien, vacía la cesta y muestra confirmación.
  const handleFinalizarPedido = async (nota) => {
    if (cart.length === 0) {
      setCartError("La cesta está vacía.");
      return;
    }
    // Validación local: todas las cantidades > 0 y con formato definido
    for (const it of cart) {
      if (!it.tamano) {
        setCartError(`Falta el formato/tamaño en "${it.producto_nombre}".`);
        return;
      }
      if (!it.cantidad || Number(it.cantidad) <= 0) {
        setCartError(`La cantidad de "${it.producto_nombre}" debe ser mayor que 0.`);
        return;
      }
    }
    setCartError("");
    setSaving(true);
    try {
      await createPedido({
        tipo: "reposicion",
        nota: nota || null,
        items: cart.map((it) => ({
          producto_id: it.producto_id,
          tamano: it.tamano,
          cantidad: Number(it.cantidad),
        })),
      });
      setCart([]);
      setCartOpen(false);
      setMsg("Pedido de reposición creado. Pendiente de aprobación por el manager.");
      setTimeout(() => setMsg(""), 4000);
    } catch (e) {
      setCartError(fmtErr(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginTop: 0, marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Productos</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {puedePedirMas ? (
            <button
              onClick={() => setCartOpen(true)}
              title={cart.length === 0 ? "Cesta vacía" : "Abrir cesta de reposición"}
              style={{
                position: "relative",
                padding: "10px 16px",
                borderRadius: 12,
                border: "1px solid rgba(245,158,11,0.30)",
                background: cart.length > 0
                  ? "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)"
                  : "rgba(245,158,11,0.10)",
                color: cart.length > 0 ? "white" : "#92400e",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: cart.length > 0 ? "0 12px 28px rgba(245,158,11,0.22)" : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              🛒 Cesta
              {cart.length > 0 ? (
                <span
                  style={{
                    minWidth: 22,
                    height: 22,
                    padding: "0 6px",
                    borderRadius: 11,
                    background: "white",
                    color: "#92400e",
                    fontWeight: 900,
                    fontSize: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {cart.length}
                </span>
              ) : null}
            </button>
          ) : null}
          {puedeGestionar ? (
            <button
              onClick={() => setGestionOpen(true)}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: "1px solid rgba(6,182,212,0.30)",
                background: "linear-gradient(135deg, #0ea5e9 0%, #06b6d4 60%, #10b981 100%)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 12px 28px rgba(6,182,212,0.18)",
              }}
            >
              Gestionar productos
            </button>
          ) : null}
        </div>
      </div>

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      {loading && <p>Cargando...</p>}

      {msg && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(16,185,129,0.10)",
            border: "1px solid rgba(16,185,129,0.22)",
            color: "#065f46",
            fontWeight: 800,
          }}
        >
          {msg}
        </div>
      )}

      {!loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr 1fr auto",
            gap: 12,
            alignItems: "end",
            marginBottom: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Buscar</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre científico, nombre común, categoría, subcategoría..."
              style={{
                padding: 10,
                borderRadius: 10,
                border: "2px solid #334155",
                background: "#f8fafc",
                fontWeight: 700,
                color: "#0f172a",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Categoría</span>
            <select
              value={categoriaSel}
              onChange={(e) => setCategoriaSel(e.target.value)}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "2px solid #334155",
                background: "#f8fafc",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              <option value="ALL">Todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Subcategoría</span>
            <select
              value={subcategoriaSel}
              onChange={(e) => setSubcategoriaSel(e.target.value)}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "2px solid #334155",
                background: "#f8fafc",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              <option value="ALL">Todas</option>
              {subcategorias.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={() => {
              setQ("");
              setCategoriaSel("ALL");
              setSubcategoriaSel("ALL");
              setSoloConImagen(false);
              setSoloConStock(false);
              setSoloReservado(false);
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: "pointer",
              fontWeight: 700,
              height: 42,
            }}
          >
            Limpiar
          </button>
        </div>
      )}

      {!loading && (
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
            padding: "8px 12px",
            borderRadius: 10,
            border: soloConImagen ? "2px solid #10b981" : "1px solid #e5e7eb",
            background: soloConImagen ? "rgba(16,185,129,0.10)" : "#f8fafc",
            cursor: "pointer",
            fontWeight: 800,
            color: soloConImagen ? "#065f46" : "#334155",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={soloConImagen}
            onChange={(e) => setSoloConImagen(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#10b981" }}
          />
          🖼️ Mostrar solo productos con imagen
        </label>
      )}

      {!loading && (
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
            marginLeft: 10,
            padding: "8px 12px",
            borderRadius: 10,
            border: soloConStock ? "2px solid #10b981" : "1px solid #e5e7eb",
            background: soloConStock ? "rgba(16,185,129,0.10)" : "#f8fafc",
            cursor: "pointer",
            fontWeight: 800,
            color: soloConStock ? "#065f46" : "#334155",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={soloConStock}
            onChange={(e) => setSoloConStock(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#10b981" }}
          />
          📦 Mostrar solo productos con stock disponible
        </label>
      )}

      {!loading && (
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
            marginLeft: 10,
            padding: "8px 12px",
            borderRadius: 10,
            border: soloReservado ? "2px solid #10b981" : "1px solid #e5e7eb",
            background: soloReservado ? "rgba(16,185,129,0.10)" : "#f8fafc",
            cursor: "pointer",
            fontWeight: 800,
            color: soloReservado ? "#065f46" : "#334155",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={soloReservado}
            onChange={(e) => setSoloReservado(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#10b981" }}
          />
          🔒 Mostrar solo productos con stock reservado
        </label>
      )}

      {!loading && (
        <p style={{ color: "#6b7280", marginTop: 0 }}>
          Mostrando <b>{productosFiltrados.length}</b> de <b>{productos.length}</b> productos
        </p>
      )}

      {!loading && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }} border="1" cellPadding="8">
            <thead>
              <tr>
                <th>Nombre científico</th>
                <th>Nombre común</th>
                <th>Categoría</th>
                <th>Subcategoría</th>
                <th style={{ textAlign: "center" }}>Stock</th>
                {!esEmpresaExterna && <th style={{ textAlign: "center" }}>Reservado</th>}
                {!esEmpresaExterna && <th style={{ textAlign: "center" }}>Disponible</th>}
                {!esEmpresaExterna && <th style={{ textAlign: "center" }}>Stock mínimo</th>}
                {puedeMarcarInterno && <th style={{ textAlign: "center" }}>Interno</th>}
                {puedePedirMas && <th style={{ textAlign: "center" }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      5 + (!esEmpresaExterna ? 3 : 0) + (puedeMarcarInterno ? 1 : 0) + (puedePedirMas ? 1 : 0)
                    }
                    style={{ textAlign: "center" }}
                  >
                    No hay resultados con esos filtros.
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((p) => (
                  <ProductoRow
                    key={p.id}
                    p={p}
                    esEmpresaExterna={esEmpresaExterna}
                    puedeMarcarInterno={puedeMarcarInterno}
                    puedePedirMas={puedePedirMas}
                    onToggleInterno={toggleEsInterno}
                    onPedirMas={openPedirMas}
                    onVerFicha={setFichaProducto}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <div style={{ marginTop: 12 }}>
          <button onClick={load} style={{ padding: "8px 10px" }}>
            Refrescar
          </button>
        </div>
      )}

      <PedirMasModal
        open={!!pedirProducto}
        producto={pedirProducto}
        onClose={() => setPedirProducto(null)}
        onAddToCart={handleAnadirACesta}
        saving={saving}
      />

      <CartModal
        open={cartOpen}
        cart={cart}
        onClose={() => { setCartOpen(false); setCartError(""); }}
        onAddMore={() => { setCartOpen(false); setCartError(""); }}
        onRemove={handleRemoveCartItem}
        onUpdate={handleUpdateCartItem}
        onFinalizar={handleFinalizarPedido}
        saving={saving}
        errorMsg={cartError}
      />

      <GestionProductosModal
        open={gestionOpen}
        productos={productos}
        esAdmin={(me?.rol || me?.role) === "admin"}
        onClose={() => setGestionOpen(false)}
        onChanged={load}
      />

      <FichaProductoModal
        producto={fichaProducto}
        esEmpresaExterna={esEmpresaExterna}
        onClose={() => setFichaProducto(null)}
      />
    </div>
  );
}
