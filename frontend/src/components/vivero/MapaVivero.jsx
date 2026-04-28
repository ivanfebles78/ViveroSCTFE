import React, { useState } from "react";
import "./MapaVivero.css";
import zonas from "./zonasConfig";
import { getZonaItems } from "../../api/api";
import Modal from "../Modal/Modal";

export default function MapaVivero() {
  const [zonaSeleccionada, setZonaSeleccionada] = useState(null);
  const [zonaData, setZonaData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleZonaClick = async (zona) => {
    setZonaSeleccionada(zona);
    setZonaData(null);
    setError("");
    setLoading(true);

    try {
      const data = await getZonaItems(zona.apiId || zona.nombre || zona.id);
      setZonaData(data);
    } catch (err) {
      console.error("Error cargando datos de zona", err);
      setError("No se pudo cargar el stock de esta zona.");
    } finally {
      setLoading(false);
    }
  };

  const items = Array.isArray(zonaData?.items)
    ? zonaData.items
    : Array.isArray(zonaData?.productos)
      ? zonaData.productos
      : [];

  return (
    <section className="vivero-page">
      <div className="vivero-header">
        <div>
          <h1 className="vivero-title">Mapa del vivero</h1>
          <p className="vivero-subtitle">
            Selecciona una zona para consultar el stock disponible.
          </p>
        </div>
      </div>

      <div className="vivero-map-wrapper">
        <img
          src="/mapa_vivero.png"
          alt="Plano de zonificación del vivero municipal"
          className="vivero-map-image"
          draggable="false"
        />

        <svg
          className="vivero-map-overlay"
          viewBox="0 0 1536 1024"
          preserveAspectRatio="none"
          aria-label="Zonas clicables del vivero"
        >
          {zonas.map((zona) => (
            <polygon
              key={zona.id}
              points={zona.puntos}
              className={
                zonaSeleccionada?.id === zona.id
                  ? "zona-clickable zona-clickable-active"
                  : "zona-clickable"
              }
              style={{ "--zona-color": zona.color }}
              onClick={() => handleZonaClick(zona)}
            >
              <title>{zona.nombre}</title>
            </polygon>
          ))}
        </svg>
      </div>

      {zonaSeleccionada && (
        <Modal onClose={() => setZonaSeleccionada(null)}>
          <div className="zona-modal-header">
            <div>
              <p className="zona-modal-eyebrow">Zona seleccionada</p>
              <h2>{zonaSeleccionada.nombre}</h2>
            </div>
            <button
              type="button"
              className="zona-modal-close"
              onClick={() => setZonaSeleccionada(null)}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          {loading && <p className="zona-loading">Cargando stock...</p>}
          {error && <p className="zona-error">{error}</p>}

          {!loading && !error && items.length === 0 && (
            <p className="zona-empty">No hay stock registrado en esta zona.</p>
          )}

          {!loading && !error && items.length > 0 && (
            <div className="zona-items-list">
              {items.map((item, index) => {
                const nombreCientifico = item.nombre_cientifico || item.cientifico || "Producto sin nombre";
                const nombreNatural = item.nombre_natural || item.producto || "";
                const cantidad = item.cantidad ?? item.total ?? 0;
                const tamanos = Array.isArray(item.tamanos) ? item.tamanos : [];

                return (
                  <article key={`${item.producto_id || index}-${nombreCientifico}`} className="zona-item-card">
                    <div>
                      <strong>{nombreCientifico}</strong>
                      {nombreNatural && <span>{nombreNatural}</span>}
                    </div>
                    <b>{cantidad}</b>
                    {tamanos.length > 0 && (
                      <ul>
                        {tamanos.map((t) => (
                          <li key={t.tamano}>
                            {t.tamano}: {t.cantidad}
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
