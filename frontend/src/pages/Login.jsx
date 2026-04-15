import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/api";

import logo from "../assets/ViverApp_logo.png";
import viveroImg from "../assets/viveroMunicipal.png";
import "./Login.css";

function formatError(err) {
  const detail = err?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        if (typeof d === "string") return d;
        if (d?.msg) return d.msg;
        return JSON.stringify(d);
      })
      .join(" | ");
  }

  if (detail && typeof detail === "object") {
    return detail.msg || JSON.stringify(detail);
  }

  return detail || err?.message || "No se pudo iniciar sesión";
}

function EyeOpenIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1.5 12C3.4 8.2 7.1 6 12 6s8.6 2.2 10.5 6c-1.9 3.8-5.6 6-10.5 6S3.4 15.8 1.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 3L21 21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10.9 10.9C10.57 11.23 10.38 11.68 10.38 12.17C10.38 13.18 11.19 14 12.2 14C12.69 14 13.14 13.81 13.47 13.48"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.8 6.8C4.7 8 3 9.73 1.9 12C3.8 15.8 7.4 18 12 18C13.9 18 15.64 17.63 17.18 16.95"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.6 5.2C10.38 5.07 11.17 5 12 5C16.6 5 20.2 7.2 22.1 11C21.46 12.29 20.6 13.42 19.56 14.36"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const [username, setUsername] = useState("ifebtru");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [progress, setProgress] = useState(0);

  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const splashIntervalRef = useRef(null);
  const navTimeoutRef = useRef(null);

  const clearTimers = () => {
    if (splashIntervalRef.current) {
      clearInterval(splashIntervalRef.current);
      splashIntervalRef.current = null;
    }
    if (navTimeoutRef.current) {
      clearTimeout(navTimeoutRef.current);
      navTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimers();
    };
  }, []);

  const heroConfig = useMemo(() => {
    const { width, height } = viewport;

    const isShort = height <= 760;
    const isNarrow = width <= 1200;
    const isTablet = width <= 992;
    const isMobile = width <= 768;

    let titleSize = "clamp(2.2rem, 4.2vw, 4.8rem)";
    let subtitleSize = "clamp(1rem, 1.45vw, 1.5rem)";
    let bottom = "56px";
    let left = "48px";
    let maxWidth = "760px";
    let gap = "14px";

    if (isNarrow) {
      titleSize = "clamp(2rem, 3.7vw, 4rem)";
      subtitleSize = "clamp(0.98rem, 1.3vw, 1.3rem)";
      bottom = "42px";
      left = "36px";
      maxWidth = "640px";
      gap = "12px";
    }

    if (isTablet) {
      titleSize = "clamp(1.8rem, 3.6vw, 3rem)";
      subtitleSize = "clamp(0.95rem, 1.6vw, 1.15rem)";
      bottom = "32px";
      left = "28px";
      maxWidth = "520px";
      gap = "10px";
    }

    if (isMobile) {
      titleSize = "clamp(1.55rem, 6vw, 2.2rem)";
      subtitleSize = "clamp(0.92rem, 3vw, 1.05rem)";
      bottom = "24px";
      left = "20px";
      maxWidth = "calc(100% - 40px)";
      gap = "8px";
    }

    if (isShort && !isMobile) {
      bottom = "24px";
      gap = "8px";
      titleSize = isTablet
        ? "clamp(1.65rem, 3.2vw, 2.5rem)"
        : "clamp(1.9rem, 3.4vw, 3.3rem)";
      subtitleSize = isTablet
        ? "clamp(0.9rem, 1.35vw, 1.05rem)"
        : "clamp(0.95rem, 1.2vw, 1.2rem)";
    }

    return {
      titleSize,
      subtitleSize,
      bottom,
      left,
      maxWidth,
      gap,
    };
  }, [viewport]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      clearTimers();
      setLoading(true);
      setShowSplash(true);
      setProgress(10);

      splashIntervalRef.current = setInterval(() => {
        setProgress((p) => (p < 90 ? p + 8 : p));
      }, 120);

      await login(username, password);

      clearTimers();
      setProgress(100);

      navTimeoutRef.current = setTimeout(() => navigate("/dashboard"), 500);
    } catch (err) {
      clearTimers();
      setShowSplash(false);
      setLoading(false);
      setProgress(0);
      setError(formatError(err));
    }
  };

  return (
    <>
      {showSplash && (
        <div className="splash">
          <div className="splashBox">
            <img src={logo} alt="logo" className="splashLogo" />
            <div className="splashText">Iniciando sesión...</div>

            <div className="progressBar">
              <div
                className="progressFill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="layout">
        <div className="leftPanel">
          <div className="loginCard">
            <div className="loginHeader">
              <img src={logo} alt="logo" className="loginLogo" />
              <div className="loginSubtitle">Sistema de gestión del vivero</div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Usuario</label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>

              <div className="field">
                <label>Contraseña</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      paddingRight: "48px",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    style={{
                      position: "absolute",
                      top: "50%",
                      right: "12px",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      color: "#64748b",
                      cursor: "pointer",
                      padding: 0,
                      lineHeight: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "color 0.18s ease, transform 0.18s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#06b6d4";
                      e.currentTarget.style.transform = "translateY(-50%) scale(1.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#64748b";
                      e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                    }}
                  >
                    {showPassword ? <EyeOpenIcon /> : <EyeOffIcon />}
                  </button>
                </div>
              </div>

              {error && <div className="error">{error}</div>}

              <button className="loginBtn" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>
          </div>
        </div>

        <div
          className="rightPanel"
          style={{
            position: "relative",
            overflow: "hidden",
          }}
        >
          <img src={viveroImg} alt="Vivero Municipal" className="heroImage" />
          <div className="imageOverlay" />

          <div
            style={{
              position: "absolute",
              left: heroConfig.left,
              right: "24px",
              bottom: heroConfig.bottom,
              zIndex: 3,
              maxWidth: heroConfig.maxWidth,
              display: "flex",
              flexDirection: "column",
              gap: heroConfig.gap,
              pointerEvents: "none",
            }}
          >
            <h1
              style={{
                margin: 0,
                color: "#ffffff",
                fontSize: heroConfig.titleSize,
                lineHeight: 1.05,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                textShadow: "0 3px 18px rgba(0,0,0,0.45)",
                wordBreak: "break-word",
              }}
            >
              Control integral del vivero
            </h1>

            <p
              style={{
                margin: 0,
                color: "rgba(255,255,255,0.96)",
                fontSize: heroConfig.subtitleSize,
                lineHeight: 1.35,
                fontWeight: 500,
                textShadow: "0 2px 12px rgba(0,0,0,0.38)",
                maxWidth: "100%",
                wordBreak: "break-word",
              }}
            >
              Gestiona inventario, movimientos, pedidos y trazabilidad desde un
              único sistema profesional
            </p>
          </div>
        </div>
      </div>
    </>
  );
}