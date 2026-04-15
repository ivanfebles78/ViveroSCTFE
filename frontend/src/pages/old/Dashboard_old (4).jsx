import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe, getPedidos, getProductos } from "../api/api";
import mapaVivero from "../assets/mapa-vivero.png";

const MAP_DEBUG = false;

const cardStyle = {
  background: "white",
  border: "1px solid rgba(15,23,42,0.06)",
  borderRadius: 18,
  boxShadow: "0 10px 30px rgba(2,6,23,0.06)",
  padding: 16,
};

const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#64748b", "#8b5cf6", "#06b6d4", "#84cc16"];

const pedidoGroupColor = {
  RESERVA: "#f59e0b",
  APROBADO: "#10b981",
  SERVIDO: "#3b82f6",
  DENEGADO: "#ef4444",
  CANCELADO: "#64748b",
  OTROS: "#8b5cf6",
};

const caducidadColor = {
  bien: "#10b981",
  proximo: "#f59e0b",
  caducado: "#ef4444",
};

const ZONE_POLYGONS = [
  { id: "1", label: "Zona 1", points: "210,115 435,120 475,250 255,255" },
  { id: "3c", label: "Zona 3C", points: "500,122 620,122 620,205 515,205" },
  { id: "3b", label: "Zona 3B", points: "625,122 745,122 745,205 625,205" },
  { id: "3a", label: "Zona 3A", points: "750,122 900,122 900,205 750,205" },
  { id: "11", label: "Zona 11", points: "235,360 420,345 448,455 260,470" },
  { id: "9c", label: "Zona 9C", points: "740,372 812,356 835,442 756,450" },
  { id: "9b", label: "Zona 9B", points: "822,343 900,330 922,414 845,425" },
  { id: "9a", label: "Zona 9A", points: "912,315 1040,305 1052,420 930,425" },
  { id: "4a", label: "Zona 4A", points: "1065,308 1188,308 1198,423 1072,423" },
  { id: "4b", label: "Zona 4B", points: "1065,430 1188,430 1198,548 1072,548" },
  { id: "4c", label: "Zona 4C", points: "1065,556 1188,556 1198,670 1072,670" },
  { id: "2", label: "Zona 2", points: "730,528 1055,528 1055,607 730,607" },
  { id: "5", label: "Zona 5", points: "165,640 276,620 300,676 182,696" },
  { id: "10b", label: "Zona 10B", points: "300,600 385,585 405,668 320,685" },
  { id: "6", label: "Zona 6", points: "302,686 360,700 338,742 286,725" },
  { id: "10a", label: "Zona 10A", points: "418,590 480,590 480,810 420,810" },
  { id: "7", label: "Zona 7", points: "170,810 490,810 490,885 170,885" },
  { id: "8", label: "Zona 8", points: "690,780 1205,780 1205,860 690,860" },
];

function DonutChart({ data, size = 240, stroke = 42, centerTop = "0", centerBottom = "" }) {
  const total = data.reduce((acc, x) => acc + x.value, 0);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`translate(${size / 2}, ${size / 2})`}>
        <circle r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        {data.map((item) => {
          const fraction = total ? item.value / total : 0;
          const dash = fraction * circumference;
          const circle = (
            <circle
              key={item.label}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90)"
            />
          );
          offset += dash;
          return circle;
        })}
        <text textAnchor="middle" dominantBaseline="middle" y={centerBottom ? -8 : 0} style={{ fontWeight: 900, fontSize: 28, fill: "#0f172a" }}>
          {centerTop}
        </text>
        {centerBottom ? (
          <text y={20} textAnchor="middle" dominantBaseline="middle" style={{ fontWeight: 700, fontSize: 12, fill: "#64748b" }}>
            {centerBottom}
          </text>
        ) : null}
      </g>
    </svg>
  );
}

function getErrorMessage(reason) {
  return reason?.response?.data?.detail || reason?.message || "Error cargando datos";
}

function estadoNormalizado(value) {
  return String(value || "").trim().toUpperCase();
}

function pedidoGroupLabel(value) {
  const e = estadoNormalizado(value);
  if (e === "RESERVA" || e === "PENDIENTE") return "RESERVA";
  if (e === "APROBADO") return "APROBADO";
  if (e === "SERVIDO") return "SERVIDO";
  if (e === "DENEGADO") return "DENEGADO";
  if (e === "CANCELADO" || e === "CADUCADO") return "CANCELADO";
  return "OTROS";
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

function toStartOfDay(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getCaducidadEstado(fechaCaducidad) {
  const objetivo = toStartOfDay(fechaCaducidad);
  if (!objetivo) return { estado: "Bien", diasRestantes: null };

  const hoy = toStartOfDay(new Date());
  const diffMs = objetivo.getTime() - hoy.getTime();
  const diasRestantes = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diasRestantes < 0) return { estado: "Caducado", diasRestantes };
  if (diasRestantes <= 7) return { estado: "Próximo a caducar", diasRestantes };
  return { estado: "Bien", diasRestantes };
}

function buildCaducidadItems(productos) {
  const items = [];
  const seen = new Set();

  const pushItemFactory = (producto) => ({ id, zona, tamano, fechaCaducidad, cantidad, loteUuid }) => {
    const cad = getCaducidadEstado(fechaCaducidad);
    const dedupeKey = String(
      id || [producto?.id ?? "", zona || "", tamano || "", fechaCaducidad || "sin-fecha", loteUuid || "sin-lote", cantidad || 0].join("::")
    );
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    items.push({
      id: dedupeKey,
      productoId: producto?.id ?? null,
      nombre: producto?.nombre_natural || producto?.nombre || producto?.nombre_cientifico || `Producto #${producto?.id ?? "—"}`,
      categoria: String(producto?.categoria || "Sin categoría").trim() || "Sin categoría",
      subcategoria: String(producto?.subcategoria || "Sin subcategoría").trim() || "Sin subcategoría",
      zona: zona || "—",
      tamano: tamano || "—",
      fechaCaducidad: fechaCaducidad || null,
      cantidad: Number(cantidad || 0),
      loteUuid: loteUuid || "—",
      estado: cad.estado,
      diasRestantes: cad.diasRestantes,
    });
  };

  (Array.isArray(productos) ? productos : []).forEach((producto, productoIdx) => {
    const pushItem = pushItemFactory(producto);
    let insertedSomething = false;

    const alertas = Array.isArray(producto?.alertas_caducidad)
      ? producto.alertas_caducidad
      : Array.isArray(producto?.caducidad_alertas)
      ? producto.caducidad_alertas
      : [];

    alertas.forEach((alerta, idx) => {
      pushItem({
        id: alerta?.id || `alerta-${producto?.id || productoIdx}-${idx}`,
        zona: alerta?.zona || alerta?.zone || alerta?.zona_id,
        tamano: alerta?.tamano || alerta?.size,
        fechaCaducidad: alerta?.fecha_caducidad || alerta?.caducidad || alerta?.fecha || alerta?.expiry_date,
        cantidad: alerta?.cantidad || alerta?.cantidad_disponible || alerta?.stock || 0,
        loteUuid: alerta?.uuid_lote || alerta?.lote_uuid,
      });
      insertedSomething = true;
    });

    const lotes = Array.isArray(producto?.lotes)
      ? producto.lotes
      : Array.isArray(producto?.batches)
      ? producto.batches
      : [];

    lotes.forEach((lote, idx) => {
      pushItem({
        id: lote?.id || lote?.uuid_lote || lote?.uuid || `lote-${producto?.id || productoIdx}-${idx}`,
        zona: lote?.zona || lote?.zone || lote?.zona_id,
        tamano: lote?.tamano || lote?.size,
        fechaCaducidad: lote?.fecha_caducidad || lote?.caducidad || lote?.expiry_date || lote?.fecha,
        cantidad: lote?.cantidad_disponible || lote?.cantidad || lote?.stock || lote?.cantidad_actual || 0,
        loteUuid: lote?.uuid_lote || lote?.uuid,
      });
      insertedSomething = true;
    });

    if (producto?.fecha_caducidad) {
      pushItem({
        id: `producto-${producto?.id || productoIdx}`,
        zona: producto?.zona,
        tamano: producto?.tamano,
        fechaCaducidad: producto?.fecha_caducidad,
        cantidad: producto?.cantidad_disponible || producto?.stock || 0,
        loteUuid: producto?.uuid_lote,
      });
      insertedSomething = true;
    }

    if (!insertedSomething) {
      pushItem({
        id: `producto-fallback-${producto?.id || productoIdx}`,
        zona: producto?.zona,
        tamano: producto?.tamano,
        fechaCaducidad: null,
        cantidad: producto?.cantidad_disponible || producto?.stock || 0,
        loteUuid: producto?.uuid_lote,
      });
    }
  });

  return items;
}

function ZonaMapModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(2,6,23,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "min(1480px, 96vw)", maxHeight: "92vh", background: "white", borderRadius: 24, overflow: "hidden", boxShadow: "0 30px 80px rgba(2,6,23,0.35)", display: "grid", gridTemplateColumns: "1fr" }}>
        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div><div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>Mapa del vivero</div></div>
            <button onClick={onClose} style={closeButtonStyle()}>Cerrar</button>
          </div>
          <div style={{ position: "relative", width: "100%", aspectRatio: "1496 / 984", borderRadius: 18, overflow: "hidden", border: "1px solid rgba(15,23,42,0.06)", background: "#f8fafc" }}>
            <img src={mapaVivero} alt="Mapa del vivero" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
            <svg viewBox="0 0 1496 984" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              {ZONE_POLYGONS.map((z) => (
                <g key={z.id}>
                  <polygon points={z.points} style={{ fill: MAP_DEBUG ? "rgba(239,68,68,0.10)" : "rgba(0,0,0,0)", stroke: MAP_DEBUG ? "rgba(239,68,68,0.85)" : "rgba(255,255,255,0)", strokeWidth: 3 }} />
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function DonutSection({ categoriasChart, pedidosChart, caducidadChart, metrics }) {
  return (
    <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div style={cardStyle}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 14 }}>Distribución por categorías</div>
        {categoriasChart.length === 0 ? <div style={{ color: "#64748b", fontWeight: 700 }}>No hay datos para mostrar.</div> : (
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, alignItems: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <DonutChart data={categoriasChart} centerTop={String(metrics.totalProductos)} centerBottom="productos" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {categoriasChart.map((c) => (
                <div key={c.label} style={{ display: "grid", gridTemplateColumns: "16px 1fr auto", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 14, height: 14, borderRadius: 999, background: c.color }} />
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{c.label}</div>
                  <div style={{ fontWeight: 900, color: "#334155" }}>{c.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 14 }}>Resumen de pedidos</div>
        {pedidosChart.length === 0 ? <div style={{ color: "#64748b", fontWeight: 700 }}>No hay pedidos para mostrar.</div> : (
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, alignItems: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <DonutChart data={pedidosChart} size={210} stroke={34} centerTop={String(metrics.totalPedidos)} centerBottom="pedidos" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pedidosChart.map((item) => (
                <div key={item.label} style={{ display: "grid", gridTemplateColumns: "16px 1fr auto", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 14, height: 14, borderRadius: 999, background: item.color }} />
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{item.label}</div>
                  <div style={{ fontWeight: 900, color: "#334155" }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ ...cardStyle, gridColumn: "1 / span 2" }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 14 }}>Estado de caducidad</div>
        {caducidadChart.total === 0 ? <div style={{ color: "#64748b", fontWeight: 700 }}>No hay datos de caducidad disponibles para mostrar.</div> : (
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, alignItems: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <DonutChart data={caducidadChart.data} centerTop={String(caducidadChart.total)} centerBottom="registros" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {caducidadChart.data.map((item) => (
                <div key={item.label} style={{ display: "grid", gridTemplateColumns: "16px 1fr auto auto", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 14, height: 14, borderRadius: 999, background: item.color }} />
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{item.label}</div>
                  <div style={{ fontWeight: 900, color: "#334155" }}>{item.value}</div>
                  <div style={{ fontWeight: 900, color: "#64748b" }}>{item.percent}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [productos, setProductos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const results = await Promise.allSettled([getMe(), getProductos(), getPedidos()]);
      const nextWarnings = [];
      const [meRes, productosRes, pedidosRes] = results;

      if (meRes.status === "fulfilled") setMe(meRes.value);
      else nextWarnings.push(`Usuario: ${getErrorMessage(meRes.reason)}`);

      if (productosRes.status === "fulfilled") setProductos(Array.isArray(productosRes.value) ? productosRes.value : []);
      else {
        nextWarnings.push(`Productos: ${getErrorMessage(productosRes.reason)}`);
        setProductos([]);
      }

      if (pedidosRes.status === "fulfilled") setPedidos(Array.isArray(pedidosRes.value) ? pedidosRes.value : []);
      else {
        nextWarnings.push(`Pedidos: ${getErrorMessage(pedidosRes.reason)}`);
        setPedidos([]);
      }

      setWarnings(nextWarnings);
    })();
  }, []);

  const caducidadItems = useMemo(() => buildCaducidadItems(productos), [productos]);

  const metrics = useMemo(() => {
    const prods = productos || [];
    const peds = pedidos || [];
    const totalProductos = prods.length;
    const stockTotal = prods.reduce((acc, p) => acc + Number(p?.stock ?? p?.stock_real ?? 0), 0);
    const bajoMinimo = prods.filter((p) => {
      const stock = Number(p?.stock ?? p?.stock_real ?? 0);
      const min = Number(p?.stock_minimo ?? 0);
      return Number.isFinite(min) && min > 0 && stock < min;
    }).length;

    return {
      totalProductos,
      stockTotal,
      bajoMinimo,
      reserva: peds.filter((p) => pedidoGroupLabel(p?.estado) === "RESERVA").length,
      aprobados: peds.filter((p) => pedidoGroupLabel(p?.estado) === "APROBADO").length,
      servidos: peds.filter((p) => pedidoGroupLabel(p?.estado) === "SERVIDO").length,
      denegados: peds.filter((p) => pedidoGroupLabel(p?.estado) === "DENEGADO").length,
      cancelados: peds.filter((p) => pedidoGroupLabel(p?.estado) === "CANCELADO").length,
      totalPedidos: peds.length,
    };
  }, [productos, pedidos]);

  const categoriasChart = useMemo(() => {
    const map = new Map();
    for (const p of productos || []) {
      const cat = p?.categoria || "Sin categoría";
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return [...map.entries()].map(([label, value], idx) => ({
      label,
      value,
      color: COLORS[idx % COLORS.length],
    })).sort((a, b) => b.value - a.value);
  }, [productos]);

  const pedidosChart = useMemo(() => {
    const groups = new Map();
    for (const p of pedidos || []) {
      const label = pedidoGroupLabel(p?.estado);
      groups.set(label, (groups.get(label) || 0) + 1);
    }
    return ["RESERVA", "APROBADO", "SERVIDO", "DENEGADO", "CANCELADO", "OTROS"]
      .map((label) => ({ label, value: groups.get(label) || 0, color: pedidoGroupColor[label] }))
      .filter((x) => x.value > 0);
  }, [pedidos]);

  const caducidadChart = useMemo(() => {
    const bien = caducidadItems.filter((item) => item.estado === "Bien").length;
    const proximo = caducidadItems.filter((item) => item.estado === "Próximo a caducar").length;
    const caducado = caducidadItems.filter((item) => item.estado === "Caducado").length;
    const total = bien + proximo + caducado;

    const buildPercent = (value) => {
      if (!total) return "0,0";
      return ((value / total) * 100).toFixed(1).replace(".", ",");
    };

    return {
      bien,
      proximo,
      caducado,
      total,
      data: [
        { label: "Bien de fecha", value: bien, color: caducidadColor.bien, percent: buildPercent(bien) },
        { label: "Próximos a caducar", value: proximo, color: caducidadColor.proximo, percent: buildPercent(proximo) },
        { label: "Caducados", value: caducado, color: caducidadColor.caducado, percent: buildPercent(caducado) },
      ].filter((item) => item.value > 0),
    };
  }, [caducidadItems]);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <h1 style={{ fontSize: 44, margin: 0, fontWeight: 900, color: "#0f172a" }}>Dashboard</h1>
      </div>

      {warnings.length > 0 ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.08)", color: "#991b1b", fontWeight: 800 }}>
          {warnings.map((w, idx) => <div key={idx}>{w}</div>)}
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontWeight: 900 }}>Productos</div>
          <div style={{ fontSize: 40, fontWeight: 950, color: "#0f172a" }}>{metrics.totalProductos}</div>
          <div style={{ color: "#64748b", fontWeight: 700 }}>Total en catálogo</div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontWeight: 900 }}>Stock total</div>
          <div style={{ fontSize: 40, fontWeight: 950, color: "#0f172a" }}>{metrics.stockTotal}</div>
          <div style={{ color: "#64748b", fontWeight: 700 }}>Suma de stock real</div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontWeight: 900 }}>Bajo mínimo</div>
          <div style={{ fontSize: 40, fontWeight: 950, color: "#0f172a" }}>{metrics.bajoMinimo}</div>
          <div style={{ color: "#64748b", fontWeight: 700 }}>Productos por reponer</div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontWeight: 900 }}>Pedidos activos</div>
          <div style={{ fontSize: 40, fontWeight: 950, color: "#0f172a" }}>{metrics.reserva + metrics.aprobados}</div>
          <div style={{ color: "#64748b", fontWeight: 700 }}>Reserva + aprobados</div>
        </div>
      </div>

      <DonutSection categoriasChart={categoriasChart} pedidosChart={pedidosChart} caducidadChart={caducidadChart} metrics={metrics} />
      <ZonaMapModal open={mapOpen} onClose={() => setMapOpen(false)} />
    </div>
  );
}
