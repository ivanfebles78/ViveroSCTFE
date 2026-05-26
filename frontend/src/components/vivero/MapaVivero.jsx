import React, { useEffect, useState } from "react";
import "./MapaVivero.css";
import Modal from "../common/Modal";
import useMapaDebug from "./useMapaDebug";
import { getMe, getZonaItems } from "../../api/api";
import zonasDefault from "./zonasConfig";
import ZoneEditor from "./ZoneEditor";
import { loadZonasFromServer, saveZonasToServer } from "./zonesStorage";

const DEBUG_MAPA = false;
// Cinturón de seguridad: si está en false, el editor está oculto para todos
// (incluso admins). Para deshabilitar la funcionalidad por completo, ponerlo
// a false y desplegar.
const ENABLE_ZONE_EDITOR = true;

const readUserFromStorage = () => {
  try {
    return JSON.parse(window.localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

export default function MapaVivero() {
  // zonas siempre arrancan con el fichero estático para que la primera pintura
  // sea instantánea. El useEffect de abajo refresca desde el servidor.
  const [zonas, setZonas] = useState(zonasDefault);
  const [editMode, setEditMode] = useState(false);
  const [savingZonas, setSavingZonas] = useState(false);

  const [me, setMe] = useState(() => readUserFromStorage());

  const [zonaSeleccionada, setZonaSeleccionada] = useState(null);
  const [zonaData, setZonaData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debugClick = useMapaDebug();

  // Carga inicial desde servidor (con fallback al fichero si falla).
  useEffect(() => {
    let cancelled = false;
    loadZonasFromServer().then((data) => {
      if (!cancelled) setZonas(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Verificar rol del usuario actual.
  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const userRole = (me?.rol || me?.role || "").toString().trim().toLowerCase();
  const isAdmin = userRole === "admin";
  const canEdit = ENABLE_ZONE_EDITOR && isAdmin;

  const handleZonaClick = async (zona) => {
    setZonaSeleccionada(zona);
    setZonaData(null);
    setError("");
    setLoading(true);

    try {
      const data = await getZonaItems(zona.apiId || zona.id);
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

  const handleEditorSave = async (updatedZonas) => {
    setSavingZonas(true);
    try {
      const saved = await saveZonasToServer(updatedZonas);
      setZonas(Array.isArray(saved) && saved.length > 0 ? saved : updatedZonas);
      setEditMode(false);
    } catch (err) {
      console.error("Error guardando zonas en servidor:", err);
      window.alert(
        "No se pudo guardar la configuración de zonas en el servidor. " +
          "Revisa la conexión y vuelve a intentarlo."
      );
    } finally {
      setSavingZonas(false);
    }
  };

  const items = zonaData?.items || zonaData?.productos || [];

  if (editMode && canEdit) {
    return (
      <ZoneEditor
        zonas={zonas}
        onSave={handleEditorSave}
        onCancel={() => setEditMode(false)}
        saving={savingZonas}
      />
    );
  }

  return (
    <>
      {canEdit && (
        <div className="vivero-admin-bar">
          <button
            type="button"
            className="vivero-admin-btn"
            onClick={() => setEditMode(true)}
          >
            Editar zonas
          </button>
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
          viewBox="0 0 2048 1365"
          preserveAspectRatio="xMidYMid meet"
          onClick={DEBUG_MAPA ? debugClick : undefined}
          style={DEBUG_MAPA ? { pointerEvents: "all" } : undefined}
        >
          {DEBUG_MAPA && (
            <rect x="0" y="0" width="2048" height="1365" fill="transparent" />
          )}
          {zonas.map((zona) => (
            <polygon
              key={zona.id}
              points={zona.puntos}
              className="zona-clickable"
              style={{ "--zona-color": zona.color }}
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
