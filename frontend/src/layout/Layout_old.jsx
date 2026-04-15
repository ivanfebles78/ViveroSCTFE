import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearStoredToken, getMe } from "../api/api";

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
  };
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [me, setMe] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

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

  const sidebarWidth = collapsed ? 96 : 290;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#eef3f5",
        display: "grid",
        gridTemplateColumns: `${sidebarWidth}px 1fr`,
        transition: "grid-template-columns 0.22s ease",
      }}
    >
      <aside
        style={{
          background: "#eef3f5",
          padding: collapsed ? "18px 12px" : "20px 18px",
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
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            marginBottom: 16,
            gap: 10,
          }}
        >
          {!collapsed && (
            <div
              style={{
                background: "white",
                borderRadius: 22,
                padding: "14px 16px",
                border: "1px solid rgba(15,23,42,0.06)",
                boxShadow: "0 10px 24px rgba(2,6,23,0.05)",
                flex: 1,
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
          )}

          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Expandir menú" : "Ocultar menú"}
            aria-label={collapsed ? "Expandir menú" : "Ocultar menú"}
            style={{
              width: 42,
              height: 42,
              minWidth: 42,
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.10)",
              background: "white",
              cursor: "pointer",
              fontSize: 18,
              fontWeight: 900,
              color: "#0f172a",
              boxShadow: "0 6px 14px rgba(2,6,23,0.05)",
            }}
          >
            {collapsed ? "➜" : "←"}
          </button>
        </div>

        {collapsed ? (
          <div
            style={{
              background: "white",
              borderRadius: 20,
              padding: "12px 8px",
              border: "1px solid rgba(15,23,42,0.06)",
              boxShadow: "0 10px 24px rgba(2,6,23,0.05)",
              marginBottom: 14,
              textAlign: "center",
            }}
          >
            <img
              src="/logo.png"
              alt="ViverApp"
              style={{ width: 40, height: 40, objectFit: "contain", marginBottom: 6 }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800 }}>Menú</div>
          </div>
        ) : (
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ color: "#64748b", fontWeight: 800, fontSize: 14 }}>Usuario</div>
                <div style={{ color: "#0f172a", fontWeight: 900, fontSize: 16 }}>
                  {me?.username || "—"}
                </div>
              </div>

              <div
                style={{
                  background: "#e0f2fe",
                  color: "#0369a1",
                  borderRadius: 999,
                  padding: "10px 12px",
                  fontWeight: 900,
                  fontSize: 14,
                  whiteSpace: "nowrap",
                }}
              >
                Rol: {me?.rol || me?.role || "—"}
              </div>
            </div>
          </div>
        )}

        <nav style={{ display: "grid", gap: 12 }}>
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={{
                  ...navBtnStyle(active),
                  justifyContent: collapsed ? "center" : "flex-start",
                  padding: collapsed ? "0 10px" : "0 18px",
                }}
                title={collapsed ? item.label : undefined}
              >
                {collapsed ? item.label.charAt(0) : item.label}
              </NavLink>
            );
          })}
        </nav>

        <div style={{ marginTop: 18 }}>
          <button
            onClick={() => {
              clearStoredToken();
              navigate("/login");
            }}
            style={{
              width: "100%",
              minHeight: 50,
              borderRadius: 18,
              border: "1px solid rgba(239,68,68,0.16)",
              background: "white",
              color: "#dc2626",
              fontWeight: 900,
              fontSize: 16,
              cursor: "pointer",
            }}
            title={collapsed ? "Salir" : undefined}
          >
            {collapsed ? "⎋" : "→| Salir"}
          </button>
        </div>

        {!collapsed && (
          <div
            style={{
              marginTop: 16,
              color: "#94a3b8",
              fontWeight: 800,
              fontSize: 14,
              lineHeight: 1.4,
            }}
          >
            Consejo: si cambias CSS/JS y no se refleja, reinicia Vite.
          </div>
        )}
      </aside>

      <main
        style={{
          padding: "28px 22px",
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        <Outlet context={{ me, isAdmin, collapsed }} />
      </main>
    </div>
  );
}