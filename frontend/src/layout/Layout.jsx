import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearStoredToken, getMe, getProductos, getZonaItems } from "../api/api";
import mapaVivero from "../assets/mapa-vivero.png";
import zonas from "../components/vivero/zonasConfig";

const MAP_WIDTH = 2048;
const MAP_HEIGHT = 1365;
const NOTIFICATIONS_STORAGE_KEY = "vivero_global_notifications_read";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/productos", label: "Productos" },
  { to: "/movimientos", label: "Movimientos" },
  { to: "/pedidos", label: "Pedidos" },
  { to: "/aprobaciones", label: "Aprobaciones" },
  { to: "/informes", label: "Informes" },
];

function getVisibleNavItems(role) {
  if (!role) return [];

  if (role === "admin") {
    return NAV_ITEMS;
  }

  if (role === "tecnico") {
    return NAV_ITEMS.filter((i) =>
      ["/dashboard", "/productos", "/movimientos", "/pedidos"].includes(i.to)
    );
  }

  if (role === "manager") {
    return NAV_ITEMS.filter((i) =>
      ["/dashboard", "/productos", "/movimientos", "/aprobaciones", "/informes"].includes(i.to)
    );
  }

  if (role === "proveedor") {
    return NAV_ITEMS.filter((i) =>
      ["/productos", "/pedidos"].includes(i.to)
    );
  }

  return [];
}

function getDefaultRouteForRole(role) {
  if (role === "admin") return "/dashboard";
  if (role === "tecnico") return "/dashboard";
  if (role === "manager") return "/dashboard";
  if (role === "proveedor") return "/productos";
  return "/dashboard";
}

function isPathAllowedForRole(pathname, role) {
  if (!role) return false;

  if (pathname === "/") return true;

  if (role === "admin") {
    return [
      "/dashboard",
      "/productos",
      "/movimientos",
      "/pedidos",
      "/aprobaciones",
      "/informes",
      "/lotes",
      "/vivero",
    ].includes(pathname);
  }

  if (role === "tecnico") {
    return [
      "/dashboard",
      "/productos",
      "/movimientos",
      "/pedidos",
      "/lotes",
      "/vivero",
    ].includes(pathname);
  }

  if (role === "manager") {
    return [
      "/dashboard",
      "/productos",
      "/movimientos",
      "/aprobaciones",
      "/informes",
      "/lotes",
      "/vivero",
    ].includes(pathname);
  }

  if (role === "proveedor") {
    return ["/productos", "/pedidos"].includes(pathname);
  }

  return false;
}

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

function notificationButtonStyle(hasUnread) {
  return {
    position: "relative",
    width: 62,
    height: 62,
    borderRadius: 20,
    border: hasUnread
      ? "1px solid rgba(239,68,68,0.18)"
      : "1px solid rgba(15,23,42,0.08)",
    background: hasUnread
      ? "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(254,242,242,0.98) 100%)"
      : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: hasUnread
      ? "0 16px 34px rgba(239,68,68,0.14)"
      : "0 12px 28px rgba(2,6,23,0.07)",
    transition: "transform 0.18s ease, box-shadow 0.22s ease, border-color 0.22s ease",
    animation: hasUnread ? "bellFloat 2.6s ease-in-out infinite" : "none",
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

function getProductName(producto) {
  return (
    producto?.nombre_cientifico ||
    producto?.nombre ||
    producto?.nombre_natural ||
    `Producto #${producto?.id ?? "—"}`
  );
}

function getReadNotificationsFromStorage() {
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveReadNotificationsToStorage(ids) {
  try {
    window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // noop
  }
}

function buildLowStockNotifications(productos) {
  const zeroStockProducts = [];
  const lowStockProducts = [];

  for (const producto of productos || []) {
    const stock = Number(producto?.stock ?? producto?.stock_real ?? 0);
    const min = Number(producto?.stock_minimo ?? 0);

    if (stock <= 0) {
      zeroStockProducts.push(getProductName(producto));
      continue;
    }

    if (Number.isFinite(min) && min > 0 && stock <= min) {
      lowStockProducts.push(`${getProductName(producto)} (${stock}/${min})`);
    }
  }

  if (!zeroStockProducts.length && !lowStockProducts.length) return [];

  const detailParts = [];
  if (zeroStockProducts.length) {
    detailParts.push(
      `Agotados: ${zeroStockProducts.slice(0, 5).join(", ")}${
        zeroStockProducts.length > 5 ? ` y ${zeroStockProducts.length - 5} más` : ""
      }.`
    );
  }
  if (lowStockProducts.length) {
    detailParts.push(
      `Próximos a agotarse: ${lowStockProducts.slice(0, 5).join(", ")}${
        lowStockProducts.length > 5 ? ` y ${lowStockProducts.length - 5} más` : ""
      }.`
    );
  }

  return [
    {
      id: `stock-alert-${zeroStockProducts.length}-${lowStockProducts.length}`,
      type: "stock",
      severity: zeroStockProducts.length ? "high" : "medium",
      title: "Hay productos con stock agotado o próximo a agotarse",
      description: detailParts.join(" "),
    },
  ];
}

function buildCaducidadNotifications(productos) {
  const notifications = [];

  for (const producto of productos || []) {
    const productName = getProductName(producto);

    const explicitAlerts = Array.isArray(producto?.alertas_caducidad)
      ? producto.alertas_caducidad
      : Array.isArray(producto?.caducidad_alertas)
      ? producto.caducidad_alertas
      : [];

    explicitAlerts.forEach((alert, idx) => {
      const zona = alert?.zona || alert?.zone || alert?.zona_id || "—";
      const tamano = alert?.tamano || alert?.size || "—";
      const fecha = alert?.fecha_caducidad || alert?.caducidad || alert?.fecha || "próximamente";
      notifications.push({
        id: `cad-alert-explicit-${producto?.id ?? productName}-${idx}-${zona}-${tamano}-${fecha}`,
        type: "caducidad",
        severity: "medium",
        title: `Producto ${productName}, Tamaño ${tamano} en la Zona ${zona} está próximo a caducar`,
        description: `Fecha estimada de caducidad: ${fecha}.`,
      });
    });

    const lotes = Array.isArray(producto?.lotes)
      ? producto.lotes
      : Array.isArray(producto?.batches)
      ? producto.batches
      : [];

    lotes.forEach((lote, idx) => {
      const nearExpiry =
        lote?.proximo_a_caducar === true ||
        lote?.near_expiry === true ||
        lote?.estado === "PROXIMO_A_CADUCAR" ||
        lote?.status === "NEAR_EXPIRY";

      if (!nearExpiry) return;

      const zona = lote?.zona || lote?.zone || lote?.zona_id || "—";
      const tamano = lote?.tamano || lote?.size || "—";
      const fecha = lote?.fecha_caducidad || lote?.caducidad || lote?.expiry_date || "próximamente";

      notifications.push({
        id: `cad-alert-lote-${producto?.id ?? productName}-${idx}-${zona}-${tamano}-${fecha}`,
        type: "caducidad",
        severity: "medium",
        title: `Producto ${productName}, Tamaño ${tamano} en la Zona ${zona} está próximo a caducar`,
        description: `Fecha estimada de caducidad: ${fecha}.`,
      });
    });
  }

  return notifications;
}

function AlertBellIcon({ hasUnread }) {
  const color = hasUnread ? "#dc2626" : "#0f172a";

  return (
    <svg width="31" height="31" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.25 20C9.58 20.93 10.47 21.6 11.5 21.6C12.53 21.6 13.42 20.93 13.75 20M5.9 16.85C5.38 16.85 5.12 16.85 4.97 16.76C4.84 16.67 4.74 16.54 4.69 16.39C4.64 16.22 4.72 15.97 4.9 15.48C5.22 14.61 5.79 13.84 6.52 13.27L6.75 13.09V10.5C6.75 7.74 8.87 5.45 11.56 5.21C14.59 4.94 17.15 7.33 17.15 10.3V13.09L17.38 13.27C18.11 13.84 18.68 14.61 19 15.48C19.18 15.97 19.26 16.22 19.21 16.39C19.16 16.54 19.06 16.67 18.93 16.76C18.78 16.85 18.52 16.85 18 16.85H5.9Z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 4.7C9.46 3.72 10.35 3 11.4 3C12.45 3 13.34 3.72 13.6 4.7"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function NotificationModal({ open, onClose, notifications, onMarkAsRead }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.55)",
        zIndex: 2100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(780px, 96vw)",
          maxHeight: "88vh",
          background: "white",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "20px 22px",
            borderBottom: "1px solid rgba(15,23,42,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>Alertas y notificaciones</div>
            <div style={{ color: "#64748b", fontWeight: 700 }}>
              Pendientes de leer: {notifications.length}
            </div>
          </div>

          <button onClick={onClose} style={closeButtonStyle()}>
            Cerrar
          </button>
        </div>

        <div style={{ padding: 22, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {notifications.length === 0 ? (
            <div
              style={{
                borderRadius: 18,
                border: "1px solid rgba(16,185,129,0.16)",
                background: "rgba(16,185,129,0.08)",
                padding: 18,
                color: "#065f46",
                fontWeight: 800,
              }}
            >
              No hay notificaciones pendientes de leer.
            </div>
          ) : (
            notifications.map((notification) => {
              const isHigh = notification.severity === "high";
              return (
                <div
                  key={notification.id}
                  style={{
                    border: isHigh
                      ? "1px solid rgba(239,68,68,0.18)"
                      : "1px solid rgba(245,158,11,0.18)",
                    background: isHigh ? "rgba(254,242,242,0.78)" : "rgba(255,251,235,0.85)",
                    borderRadius: 18,
                    padding: 16,
                    boxShadow: "0 10px 24px rgba(2,6,23,0.05)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 14 }}>
                    <div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 900,
                          color: isHigh ? "#991b1b" : "#92400e",
                        }}
                      >
                        {notification.title}
                      </div>
                      <div style={{ marginTop: 8, color: "#334155", fontWeight: 700, lineHeight: 1.45 }}>
                        {notification.description}
                      </div>
                    </div>

                    <button
                      onClick={() => onMarkAsRead(notification.id)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(15,23,42,0.10)",
                        background: "white",
                        color: "#0f172a",
                        fontWeight: 900,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Marcar como leído
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
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
  const [productos, setProductos] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState(() =>
    getReadNotificationsFromStorage()
  );

  useEffect(() => {
    const loadMe = async () => {
      try {
        const data = await getMe();
        setMe(data);
        try {
          window.localStorage.setItem("user", JSON.stringify(data));
        } catch {
          // noop
        }
      } catch {
        clearStoredToken();
        navigate("/login");
      }
    };

    loadMe();
  }, [navigate]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await getProductos();
        setProductos(Array.isArray(data) ? data : []);
      } catch {
        setProductos([]);
      }
    };

    loadProducts();
  }, [location.pathname]);

  useEffect(() => {
    saveReadNotificationsToStorage(readNotificationIds);
  }, [readNotificationIds]);

  const allNotifications = useMemo(() => {
    const lowStockNotifications = buildLowStockNotifications(productos);
    const caducidadNotifications = buildCaducidadNotifications(productos);
    return [...lowStockNotifications, ...caducidadNotifications];
  }, [productos]);

  const unreadNotifications = useMemo(() => {
    const readSet = new Set(readNotificationIds);
    return allNotifications.filter((notification) => !readSet.has(notification.id));
  }, [allNotifications, readNotificationIds]);

  const markNotificationAsRead = (notificationId) => {
    setReadNotificationIds((prev) =>
      prev.includes(notificationId) ? prev : [...prev, notificationId]
    );
  };

  const userRole = me?.rol || me?.role || "";
  const isAdmin = userRole === "admin";
  const sidebarWidth = 220;
  const hasUnreadNotifications = unreadNotifications.length > 0;

  useEffect(() => {
    if (!userRole) return;

    if (!isPathAllowedForRole(location.pathname, userRole)) {
      navigate(getDefaultRouteForRole(userRole), { replace: true });
    }
  }, [location.pathname, userRole, navigate]);

  if (!me) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#eef3f5",
          color: "#334155",
          fontWeight: 800,
          fontSize: 18,
        }}
      >
        Cargando…
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes badgePulse {
          0% {
            transform: scale(1);
            box-shadow: 0 10px 22px rgba(220,38,38,0.28);
          }
          50% {
            transform: scale(1.08);
            box-shadow: 0 14px 28px rgba(220,38,38,0.42);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 10px 22px rgba(220,38,38,0.28);
          }
        }

        @keyframes bellRing {
          0%, 100% {
            transform: rotate(0deg);
          }
          6% {
            transform: rotate(10deg);
          }
          12% {
            transform: rotate(-8deg);
          }
          18% {
            transform: rotate(6deg);
          }
          24% {
            transform: rotate(-4deg);
          }
          30% {
            transform: rotate(0deg);
          }
        }

        @keyframes bellFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-1px);
          }
        }
      `}</style>

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
                <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
                  ViverApp
                </div>
                <div style={{ fontSize: 14, color: "#64748b", fontWeight: 700 }}>
                  Gestión del vivero
                </div>
              </div>
            </div>
          </div>

          <nav style={{ display: "grid", gap: 12 }}>
            {getVisibleNavItems(userRole).map((item) => {
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

            {(userRole === "admin" || userRole === "tecnico" || userRole === "manager") && (
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                style={navBtnStyle(false)}
                aria-label="Mapa del vivero"
              >
                Mapa del vivero
              </button>
            )}
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
            <button
              onClick={() => setNotificationsOpen(true)}
              style={notificationButtonStyle(hasUnreadNotifications)}
              title="Alertas y notificaciones"
              aria-label="Abrir alertas y notificaciones"
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px) scale(1.02)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0) scale(1)";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: hasUnreadNotifications ? "bellRing 3.2s ease-in-out infinite" : "none",
                  transformOrigin: "top center",
                }}
              >
                <AlertBellIcon hasUnread={hasUnreadNotifications} />
              </div>

              {hasUnreadNotifications ? (
                <span
                  style={{
                    position: "absolute",
                    top: -7,
                    right: -7,
                    minWidth: 26,
                    height: 26,
                    padding: "0 7px",
                    borderRadius: 999,
                    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                    color: "white",
                    fontWeight: 900,
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "3px solid white",
                    boxSizing: "border-box",
                    boxShadow: "0 8px 18px rgba(220,38,38,0.24)",
                    animation: "badgePulse 1.8s ease-in-out infinite",
                  }}
                >
                  {unreadNotifications.length}
                </span>
              ) : null}
            </button>

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
              <span style={{ color: "#0f172a" }}>{userRole || "—"}</span>
            </div>

            <button
              onClick={() => {
                clearStoredToken();
                try {
                  window.localStorage.removeItem("user");
                } catch {
                  // noop
                }
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
      <NotificationModal
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={unreadNotifications}
        onMarkAsRead={markNotificationAsRead}
      />
    </>
  );
}