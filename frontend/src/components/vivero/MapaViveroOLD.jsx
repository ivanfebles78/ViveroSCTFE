import React, { useState } from "react";
import "./MapaVivero.css";
import { getZonaItems } from "../../api/api";

export default function MapaVivero() {
  const [zonaData, setZonaData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleZonaClick = async (zonaId) => {
    setLoading(true);
    const data = await getZonaItems(zonaId);
    setZonaData(data);
    setLoading(false);
  };

  return (
    <div className="mapa-container">
      <img src="/mapa_vivero.png" alt="Mapa vivero" className="mapa-img" />

      {/* EJEMPLO ZONA */}
      <div
        className="zona-click"
        style={{ top: "20%", left: "10%" }}
        onClick={() => handleZonaClick("1")}
      >
        Zona 1
      </div>

      {zonaData && (
        <div className="zona-modal">
          <h3>Zona {zonaData.zona}</h3>

          {loading ? (
            <p>Cargando...</p>
          ) : zonaData.productos.length === 0 ? (
            <p>No hay stock en esta zona</p>
          ) : (
            zonaData.productos.map((p, i) => (
              <div key={i} className="zona-item">
                <b>{p.producto}</b> ({p.cientifico}) - {p.total}
              </div>
            ))
          )}

          <button onClick={() => setZonaData(null)}>Cerrar</button>
        </div>
      )}
    </div>
  );
}