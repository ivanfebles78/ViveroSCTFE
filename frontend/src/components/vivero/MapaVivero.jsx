import React, { useEffect, useState } from "react";
import "./MapaVivero.css";
import Modal from "../common/Modal";
import useMapaDebug from "./useMapaDebug";
import { getMe, getZonaItems } from "../../api/api";
import ZoneEditor from "./ZoneEditor";
import {
  loadZonas,
  saveZonasDraft,
  clearZonasDraft,
  hasZonasDraft,
  exportZonasAsJsFile,
} from "./zonesStorage";

const DEBUG_MAPA = false;

const readUserFromStorage = () => {
  try {
    return JSON.parse(window.localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

export default function MapaVivero() {
  const [zonas, setZonas] = useState(() => loadZonas());
  const [draftActive, setDraftActive] = useState(() => hasZonasDraft());
  const [editMode, setEditMode] = useState(false);

  const [me, setMe] = useState(() => readUserFromStorage());

  const [zonaSeleccionada, setZonaSeleccionada] = useState(null);
  const [zonaData, setZonaData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debugClick = useMapaDebug();

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {
        // si /auth/me falla, dejamos lo que haya en localStorage
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const userRole = (me?.rol || me?.role || "").toString().trim().toLowerCase();
  const isAdmin = userRole === "admin";

  const handleZonaClick = async (zona) => {
    setZonaSeleccionada(zona);
    setZonaData(null);
    setError("");
    setLoading(true);

    try {
      const data = await getZonaItems(zona.id);
      setZonaData(data);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la información de esta zona.");
    } finally {
      setLoading(false);
    }
  };

  const cerrarModal = () => {
    setZonaSeleccionada(null);
    setZonaData(null);
    setError("");
    setLoading(false);
  };

  const handleEditorSave = (updatedZonas) => {
    saveZonasDraft(updatedZonas);
    exportZonasAsJsFile(updatedZonas);
    setZonas(updatedZonas);
    setDraftActive(true);
    setEditMode(false);
  };

  const handleClearDraft = () => {
    if (
      !window.confirm(
        "¿Descartar los cambios locales y volver a las zonas del fichero zonasConfig.js?"
      )
    ) {
      return;
    }
    clearZonasDraft();
    setZonas(loadZonas());
    setDraftActive(false);
  };

  const items = zonaData?.items || zonaData?.productos || [];

  if (editMode) {
    return (
      <ZoneEditor
        zonas={zonas}
        onSave={handleEditorSave}
        onCancel={() => setEditMode(false)}
      />
    );
  }

  return (
    <>
      {(isAdmin || draftActive) && (
        <div className="vivero-admin-bar">
          {isAdmin && (
            <button
              type="button"
              className="vivero-admin-btn"
              onClick={() => setEditMode(true)}
            >
              Editar zonas
            </button>
          )}
          {draftActive && (
            <>
              <span className="vivero-admin-badge">
                Mostrando borrador local
              </span>
              {isAdmin && (
                <button
                  type="button"
                  className="vivero-admin-btn-secondary"
                  onClick={handleClearDraft}
                >
                  Limpiar borrador
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="vivero-map-wrapper">
        <img
          src="/mapa-vivero.png"
          alt="Mapa del vivero"
          className="vivero-map-image"
        />

        <svg
          className="vivero-map-overlay"
          viewBox="0 0 1536 1024"
          preserveAspectRatio="xMidYMid meet"
          onClick={DEBUG_MAPA ? debugClick : undefined}
          style={DEBUG_MAPA ? { pointerEvents: "all" } : undefined}
        >
          {DEBUG_MAPA && (
            <rect x="0" y="0" width="1536" height="1024" fill="transparent" />
          )}
          {zonas.map((zona) => (
            <polygon
              key={zona.id}
              points={zona.puntos}
              className="zona-clickable"
              onClick={() => handleZonaClick(zona)}
            >
              <title>{zona.nombre}</title>
            </polygon>
          ))}
        </svg>

        {zonaSeleccionada && (
          <Modal onClose={cerrarModal}>
            <h2>{zonaSeleccionada.nombre}</h2>

            {loading && <p>Cargando información...</p>}

            {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

            {!loading && !error && items.length === 0 && (
              <p>No hay stock registrado en esta zona.</p>
            )}

            {!loading &&
              !error &&
              items.map((item, index) => (
                <div key={index} className="zona-item">
                  <strong>
                    {item.nombre_cientifico ||
                      item.cientifico ||
                      item.producto ||
                      "Producto"}
                  </strong>
                  <br />
                  Cantidad: {item.cantidad || item.total || 0}
                  {item.tamano && (
                    <>
                      <br />
                      Tamaño: {item.tamano}
                    </>
                  )}
                </div>
              ))}

            <button onClick={cerrarModal}>Cerrar</button>
          </Modal>
        )}
      </div>
    </>
  );
}
