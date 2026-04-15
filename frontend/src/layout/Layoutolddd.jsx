import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearStoredToken, getMe, getZonaItems } from "../api/api";
import mapaVivero from "../assets/mapa-vivero.png";
import zonas from "../components/vivero/zonasConfig";

const MAP_WIDTH = 2048;
const MAP_HEIGHT = 1365;

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/productos", label: "Productos" },
  { to: "/movimientos", label: "Movimientos" },
  { to: "/pedidos", label: "Pedidos" },
  { to: "/aprobaciones", label: "Aprobaciones" },
  { to: "/informes", label: "Informes" },
];

function navBtnStyle(active) {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    width: "100%",
    minHeight: 50,
    padding: "0 18px",
    borderRadius: 18,
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 16,
    border: active ? "1px solid rgba(6,182,212,0.28)" : "1px solid rgba(15,23,42,0.06)",
    background: active
      ? "linear-gradient(135deg, #06b6d4 0%, #10b981 100%)"
      : "white",
    color: active ? "white" : "#0f172a",
    boxShadow: active ? "0 12px 30px rgba(6,182,212,0.18)" : "none",
    transition: "all 0.2s ease",
    boxSizing: "border-box",
    cursor: "pointer",
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

function topLogoutButtonStyle() {
  return {
    padding: "10px 16px",
    borderRadius: 14,
    border: "2px solid #000000",
    background: "#ef4444",
    color: "white",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(0,0,0,0.14)",
    transition: "all 0.18s ease",
  };
}

function getZoneAliases(zone) {
  const idRaw = String(zone?.id || "").trim();
  const idUpper = idRaw.toUpperCase();

  const nombreRaw = String(zone?.nombre || "").trim();
  const nombreUpper = nombreRaw.toUpperCase();

  const nombreSinZona = nombreRaw.replace(/^zona\s*/i, "").trim();
  const nombreSinZonaUpper = nombreSinZona.toUpperCase();

  const aliases = [
    idRaw,
    idUpper,
    `zona-${idRaw}`,
    `zona-${idUpper}`,
    `Zona ${idUpper}`,
    `ZONA ${idUpper}`,

    nombreRaw,
    nombreUpper,
    nombreSinZona,
    nombreSinZonaUpper,
    `Zona ${nombreSinZonaUpper}`,
    `ZONA ${nombreSinZonaUpper}`,
  ].filter(Boolean);

  return [...new Set(aliases)];
}

function ZonaMapModal({ open, onClose }) {
  const [selectedZone, setSelectedZone] = useState(null);
  const [zonaData, setZonaData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zonaError, setZonaError] = useState("");

  const zonePolygons = useMemo(
    () => (Array.isArray(zonas) ? zonas.filter((z) => !z.disabled) : []),
    []
  );

  const selectedZoneLabel =
    zonePolygons.find((z) => String(z.id) === String(selectedZone))?.nombre ||
    (selectedZone ? `Zona ${String(selectedZone).toUpperCase()}` : "Selecciona una zona");

  const loadZone = async (zone) => {
    const zoneId = zone?.id;
    setSelectedZone(zoneId);
    setZonaError("");
    setLoading(true);
    setZonaData(null);

    const aliases = getZoneAliases(zone);
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
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(1600px, 96vw)",
          maxHeight: "92vh",
          background: "white",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
          display: "grid",
          gridTemplateColumns: "1.45fr 0.8fr",
        }}
      >
        <div style={{ padding: 20, borderRight: "1px solid rgba(15,23,42,0.08)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
              gap: 14,
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
              aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}`,
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
              viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
              preserveAspectRatio="xMidYMid meet"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
              }}
            >
              {zonePolygons.map((z) => (
                <g key={z.id}>
                  <polygon
                    points={z.puntos}
                    onClick={() => loadZone(z)}
                    style={{
                      fill: selectedZone === z.id ? "rgba(6,182,212,0.25)" : "rgba(0,0,0,0)",
                      stroke: selectedZone === z.id ? "#06b6d4" : "rgba(255,255,255,0)",
                      strokeWidth: 4,
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  />
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
                border: "1px solid rgba(239,68,68,0.25)",
                background: "rgba(239,68,68,0.08)",
                color: "#991b1b",
                fontWeight: 800,
              }}
            >
              {zonaError}
            </div>
          ) : !zonaData?.items?.length ? (
            <div
              style={{
                marginTop: 12,
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
            <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
              {zonaData.items.map((item, idx) => (
                <div
                  key={`${item.producto_id || item.nombre_cientifico || "item"}-${idx}`}
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "rgba(248,250,252,0.72)",
                  }}
                >
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>
                    {item.nombre_cientifico || item.nombre_natural || "Producto"}
                  </div>

                  <div style={{ marginTop: 4, color: "#64748b", fontWeight: 700 }}>
                    {item.nombre_natural || "—"}
                    {item.categoria ? ` · ${item.categoria}` : ""}
                    {item.subcategoria ? ` · ${item.subcategoria}` : ""}
                  </div>

                  <div style={{ marginTop: 8, fontWeight: 900, color: "#0f172a" }}>
                    Cantidad total: {item.cantidad ?? 0}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {(item.tamanos || []).length === 0 ? (
                      <span style={{ color: "#64748b", fontWeight: 700 }}>Sin detalle por tamaño</span>
                    ) : (
                      item.tamanos.map((t, tIdx) => (
                        <span
                          key={`${item.producto_id || item.nombre_cientifico || "item"}-${t.tamano || tIdx}`}
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [me, setMe] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    const loadMe = async () => {
      try {
        const data = await getMe();
        setMe(data);
      } catch {
        clearStoredToken();
        navigate("/login");
      }
    };

    loadMe();
  }, [navigate]);

  const isAdmin = useMemo(() => {
    const rol = me?.rol || me?.role;
    return rol === "admin";
  }, [me]);

  const sidebarWidth = 220;
  const userRole = me?.rol || me?.role || "—";

  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          width: "100vw",
          maxWidth: "100vw",
          overflowX: "hidden",
          background: "#eef3f5",
          display: "grid",
          gridTemplateColumns: `${sidebarWidth}px minmax(0, 1fr)`,
        }}
      >
        <aside
          style={{
            background: "#eef3f5",
            width: sidebarWidth,
            minWidth: sidebarWidth,
            maxWidth: sidebarWidth,
            padding: "20px 18px",
            borderRight: "1px solid rgba(15,23,42,0.06)",
            position: "sticky",
            top: 0,
            height: "100vh",
            boxSizing: "border-box",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 22,
              padding: "14px 16px",
              border: "1px solid rgba(15,23,42,0.06)",
              boxShadow: "0 10px 24px rgba(2,6,23,0.05)",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src="/logo.png"
                alt="ViverApp"
                style={{ width: 38, height: 38, objectFit: "contain" }}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>ViverApp</div>
                <div style={{ fontSize: 14, color: "#64748b", fontWeight: 700 }}>
                  Gestión del vivero
                </div>
              </div>
            </div>
          </div>

          <nav style={{ display: "grid", gap: 12 }}>
            {NAV_ITEMS.map((item) => {
              const active = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  style={{
                    ...navBtnStyle(active),
                    justifyContent: "flex-start",
                    padding: "0 18px",
                  }}
                >
                  {item.label}
                </NavLink>
              );
            })}

            <button
              type="button"
              onClick={() => setMapOpen(true)}
              style={navBtnStyle(false)}
              aria-label="Mapa del vivero"
            >
              Mapa del vivero
            </button>
          </nav>
        </aside>

        <main
          style={{
            padding: "20px 22px 28px 22px",
            minWidth: 0,
            width: "100%",
            maxWidth: "100%",
            overflowX: "hidden",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 14,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                color: "#64748b",
                background: "rgba(255,255,255,0.8)",
                border: "1px solid rgba(15,23,42,0.06)",
                borderRadius: 14,
                padding: "10px 14px",
                boxShadow: "0 8px 18px rgba(2,6,23,0.04)",
              }}
            >
              Usuario: <span style={{ color: "#0f172a" }}>{me?.username || "—"}</span> · Rol:{" "}
              <span style={{ color: "#0f172a" }}>{userRole}</span>
            </div>

            <button
              onClick={() => {
                clearStoredToken();
                navigate("/login");
              }}
              style={topLogoutButtonStyle()}
            >
              Salir
            </button>
          </div>

          <Outlet context={{ me, isAdmin, collapsed: false }} />
        </main>
      </div>

      <ZonaMapModal open={mapOpen} onClose={() => setMapOpen(false)} />
    </>
  );
}