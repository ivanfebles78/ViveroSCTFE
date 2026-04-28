import React, { useState } from "react";
import "./MapaVivero.css";
import Modal from "../common/Modal";
import zonas from "./zonasConfig";
import useMapaDebug from "./useMapaDebug";
import { getZonaItems } from "../../api/api";

const DEBUG_MAPA = true;

export default function MapaVivero() {
  const [zonaSeleccionada, setZonaSeleccionada] = useState(null);
  const [zonaData, setZonaData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debugClick = useMapaDebug();

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

  const items = zonaData?.items || zonaData?.productos || [];

  return (
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
  );
}