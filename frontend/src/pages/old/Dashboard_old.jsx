import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe, getPedidos, getProductos, getZonaItems } from "../api/api";
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
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          y={centerBottom ? -8 : 0}
          style={{ fontWeight: 900, fontSize: 28, fill: "#0f172a" }}
        >
          {centerTop}
        </text>
        {centerBottom ? (
          <text
            y={20}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontWeight: 700, fontSize: 12, fill: "#64748b" }}
          >
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

function actionButtonStyle(enabled, variant = "default") {
  const base = {
    padding: "10px 14px",
    borderRadius: 14,
    fontWeight: 900,
    cursor: enabled ? "pointer" : "not-allowed",
    transition: "all 0.18s ease",
    border: "1px solid rgba(15,23,42,0.10)",
  };

  if (!enabled) {
    return {
      ...base,
      background: "rgba(148,163,184,0.16)",
      color: "#94a3b8",
      boxShadow: "none",
    };
  }

  if (variant === "primary") {
    return {
      ...base,
      background: "linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%)",
      color: "white",
      border: "1px solid rgba(6,182,212,0.30)",
      boxShadow: "0 12px 26px rgba(59,130,246,0.20)",
    };
  }

  return {
    ...base,
    background: "white",
    color: "#0f172a",
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

function getZoneAliases(zoneId) {
  const raw = String(zoneId || "").trim();
  const upper = raw.toUpperCase();

  return [
    raw,
    upper,
    `zona-${raw}`,
    `zona-${upper}`,
    `Zona ${upper}`,
    `ZONA ${upper}`,
  ].filter(Boolean);
}

function ZonaMapModal({ open, onClose }) {
  const [selectedZone, setSelectedZone] = useState(null);
  const [zonaData, setZonaData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zonaError, setZonaError] = useState("");

  const selectedZoneLabel =
    ZONE_POLYGONS.find((z) => z.id === selectedZone)?.label ||
    (selectedZone ? `Zona ${String(selectedZone).toUpperCase()}` : "Selecciona una zona");

  const loadZone = async (zona) => {
    setSelectedZone(zona);
    setZonaError("");
    setLoading(true);
    setZonaData(null);

    const aliases = getZoneAliases(zona);
    let emptyResponse = null;
    let lastError = null;

    try {
      for (const alias of aliases) {
        try {
          const data = await getZonaItems(alias);
          const totalProductos = Number(data?.total_productos ?? 0);
          const items = Array.isArray(data?.items) ? data.items : [];

          if (totalProductos > 0 || items.length > 0) {
            setZonaData({
              ...data,
              _resolvedZone: alias,
            });
            return;
          }

          if (!emptyResponse) {
            emptyResponse = {
              ...data,
              _resolvedZone: alias,
            };
          }
        } catch (e) {
          lastError = e;
        }
      }

      if (emptyResponse) {
        setZonaData(emptyResponse);
        setZonaError("");
      } else {
        setZonaData(null);
        setZonaError(
          lastError?.response?.data?.detail ||
            lastError?.message ||
            "No se pudo cargar el stock de la zona"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setSelectedZone(null);
      setZonaData(null);
      setZonaError("");
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(1480px, 96vw)",
          maxHeight: "92vh",
          background: "white",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
          display: "grid",
          gridTemplateColumns: "1.4fr 0.8fr",
        }}
      >
        <div style={{ padding: 20, borderRight: "1px solid rgba(15,23,42,0.08)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>Mapa del vivero</div>
              <div style={{ color: "#64748b", fontWeight: 700 }}>
                Haz clic en una zona para ver productos, cantidades y tamaños.
              </div>
            </div>

            <button onClick={onClose} style={closeButtonStyle()}>
              Cerrar
            </button>
          </div>

          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "1496 / 984",
              borderRadius: 18,
              overflow: "hidden",
              border: "1px solid rgba(15,23,42,0.06)",
              background: "#f8fafc",
            }}
          >
            <img
              src={mapaVivero}
              alt="Mapa del vivero"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />

            <svg
              viewBox="0 0 1496 984"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
              }}
            >
              {ZONE_POLYGONS.map((z) => (
                <g key={z.id}>
                  <polygon
                    points={z.points}
                    onClick={() => loadZone(z.id)}
                    style={{
                      fill:
                        selectedZone === z.id
                          ? "rgba(6,182,212,0.25)"
                          : MAP_DEBUG
                          ? "rgba(239,68,68,0.10)"
                          : "rgba(0,0,0,0)",
                      stroke:
                        selectedZone === z.id
                          ? "#06b6d4"
                          : MAP_DEBUG
                          ? "rgba(239,68,68,0.85)"
                          : "rgba(255,255,255,0)",
                      strokeWidth: 3,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  />
                  {MAP_DEBUG ? (
                    <text
                      x={Number(z.points.split(" ")[0].split(",")[0]) + 6}
                      y={Number(z.points.split(" ")[0].split(",")[1]) + 18}
                      fill="#0f172a"
                      fontSize="13"
                      fontWeight="900"
                    >
                      {z.label}
                    </text>
                  ) : null}
                </g>
              ))}
            </svg>
          </div>
        </div>

        <div style={{ padding: 20, overflow: "auto" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
            {selectedZone ? selectedZoneLabel : "Selecciona una zona"}
          </div>

          {!selectedZone ? (
            <div style={{ marginTop: 12, color: "#64748b", fontWeight: 700 }}>
              Selecciona una zona del mapa para consultar su inventario.
            </div>
          ) : loading ? (
            <div style={{ marginTop: 12, color: "#64748b", fontWeight: 700 }}>Cargando datos…</div>
          ) : zonaError ? (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 14,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.18)",
                color: "#991b1b",
                fontWeight: 800,
              }}
            >
              {zonaError}
            </div>
          ) : (
            <>
              <div style={{ marginTop: 8, color: "#64748b", fontWeight: 700 }}>
                Total de productos distintos: {zonaData?.total_productos ?? 0}
              </div>

              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {(zonaData?.items || []).length === 0 ? (
                  <div
                    style={{
                      color: "#92400e",
                      fontWeight: 800,
                      background: "rgba(245,158,11,0.10)",
                      border: "1px solid rgba(245,158,11,0.25)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    No se encontraron productos para esta zona con el identificador consultado.
                    {zonaData?._resolvedZone ? ` Consulta usada: ${zonaData._resolvedZone}` : ""}
                  </div>
                ) : (
                  zonaData.items.map((item, idx) => (
                    <div
                      key={`${item.nombre_cientifico}-${idx}`}
                      style={{
                        border: "1px solid rgba(15,23,42,0.08)",
                        borderRadius: 14,
                        padding: 12,
                        background: "rgba(248,250,252,0.65)",
                      }}
                    >
                      <div style={{ fontWeight: 900, color: "#0f172a" }}>
                        {item.nombre_cientifico || item.nombre_natural || "Producto"}
                      </div>
                      <div style={{ marginTop: 4, color: "#64748b", fontWeight: 700, fontSize: 13 }}>
                        {item.categoria || "—"} {item.subcategoria ? `· ${item.subcategoria}` : ""}
                      </div>
                      <div style={{ marginTop: 8, fontWeight: 900, color: "#0f172a" }}>
                        Cantidad total: {item.cantidad ?? 0}
                      </div>

                      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {(item.tamanos || []).length === 0 ? (
                          <span style={{ color: "#64748b", fontWeight: 700 }}>Sin detalle por tamaño</span>
                        ) : (
                          item.tamanos.map((t) => (
                            <span
                              key={`${item.nombre_cientifico}-${t.tamano}`}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "rgba(6,182,212,0.10)",
                                border: "1px solid rgba(6,182,212,0.18)",
                                color: "#0f172a",
                                fontWeight: 900,
                                fontSize: 12,
                              }}
                            >
                              {t.tamano}: {t.cantidad}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DonutSection({ categoriasChart, pedidosChart, metrics }) {
  return (
    <div
      style={{
        marginTop: 16,
        display: "grid",
        gridTemplateColumns: "1.1fr 0.9fr",
        gap: 16,
      }}
    >
      <div style={cardStyle}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 14 }}>
          Distribución por categorías
        </div>

        {categoriasChart.length === 0 ? (
          <div style={{ color: "#64748b", fontWeight: 700 }}>No hay datos para mostrar.</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "280px 1fr",
              gap: 20,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center" }}>
              <DonutChart
                data={categoriasChart}
                centerTop={String(metrics.totalProductos)}
                centerBottom="productos"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {categoriasChart.map((c) => (
                <div
                  key={c.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "16px 1fr auto",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: c.color,
                    }}
                  />
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{c.label}</div>
                  <div style={{ fontWeight: 900, color: "#334155" }}>{c.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 14 }}>
          Resumen de pedidos
        </div>

        {pedidosChart.length === 0 ? (
          <div style={{ color: "#64748b", fontWeight: 700 }}>No hay pedidos para mostrar.</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "220px 1fr",
              gap: 16,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center" }}>
              <DonutChart
                data={pedidosChart}
                size={210}
                stroke={34}
                centerTop={String(metrics.totalPedidos)}
                centerBottom="pedidos"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pedidosChart.map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "16px 1fr auto",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: item.color,
                    }}
                  />
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{item.label}</div>
                  <div style={{ fontWeight: 900, color: "#334155" }}>{item.value}</div>
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

    const reserva = peds.filter((p) => pedidoGroupLabel(p?.estado) === "RESERVA").length;
    const aprobados = peds.filter((p) => pedidoGroupLabel(p?.estado) === "APROBADO").length;
    const servidos = peds.filter((p) => pedidoGroupLabel(p?.estado) === "SERVIDO").length;
    const denegados = peds.filter((p) => pedidoGroupLabel(p?.estado) === "DENEGADO").length;
    const cancelados = peds.filter((p) => pedidoGroupLabel(p?.estado) === "CANCELADO").length;

    return {
      totalProductos,
      stockTotal,
      bajoMinimo,
      reserva,
      aprobados,
      servidos,
      denegados,
      cancelados,
      totalPedidos: peds.length,
    };
  }, [productos, pedidos]);

  const categoriasChart = useMemo(() => {
    const map = new Map();
    for (const p of productos || []) {
      const cat = p?.categoria || "Sin categoría";
      map.set(cat, (map.get(cat) || 0) + 1);
    }

    return [...map.entries()]
      .map(([label, value], idx) => ({
        label,
        value,
        color: COLORS[idx % COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [productos]);

  const pedidosChart = useMemo(() => {
    const groups = new Map();
    for (const p of pedidos || []) {
      const label = pedidoGroupLabel(p?.estado);
      groups.set(label, (groups.get(label) || 0) + 1);
    }

    return ["RESERVA", "APROBADO", "SERVIDO", "DENEGADO", "CANCELADO", "OTROS"]
      .map((label) => ({
        label,
        value: groups.get(label) || 0,
        color: pedidoGroupColor[label],
      }))
      .filter((x) => x.value > 0);
  }, [pedidos]);

  const role = me?.rol || me?.role;
  const canSeeMap = role !== "proveedor";
  const canSeeInformes = role === "admin" || role === "manager";

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <h1 style={{ fontSize: 44, margin: 0, fontWeight: 900, color: "#0f172a" }}>Dashboard</h1>

        
      </div>

      {warnings.length > 0 ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            border: "1px solid rgba(239,68,68,0.25)",
            background: "rgba(239,68,68,0.08)",
            color: "#991b1b",
            fontWeight: 800,
          }}
        >
          {warnings.map((w, idx) => (
            <div key={idx}>{w}</div>
          ))}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 16,
        }}
      >
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
          <div style={{ fontSize: 40, fontWeight: 950, color: "#0f172a" }}>
            {metrics.reserva + metrics.aprobados}
          </div>
          <div style={{ color: "#64748b", fontWeight: 700 }}>Reserva + aprobados</div>
        </div>
      </div>

      <DonutSection categoriasChart={categoriasChart} pedidosChart={pedidosChart} metrics={metrics} />

      <ZonaMapModal open={mapOpen} onClose={() => setMapOpen(false)} />
    </div>
  );
}