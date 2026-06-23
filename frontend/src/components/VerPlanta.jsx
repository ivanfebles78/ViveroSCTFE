import React, { useState } from "react";
import { usePlantImage } from "../utils/plantImages";

// Botón/icono "Ver" que solo se muestra si existe imagen para la planta.
// Al pulsarlo abre un modal con la imagen. Reutilizable en la tabla de
// productos y en el selector de producto del modal de movimientos.
//
// Props:
//   - nombreCientifico: usado para localizar la imagen (slug).
//   - nombreNatural: solo para el título del modal.
//   - variant: "icon" (🖼️) o "button" (🖼️ Ver).
//   - stopPropagation: evita disparar el onClick de la fila contenedora.
export default function VerPlanta({
  nombreCientifico,
  nombreNatural,
  variant = "icon",
  stopPropagation = true,
}) {
  const url = usePlantImage(nombreCientifico);
  const [open, setOpen] = useState(false);

  // Si no hay imagen disponible, no se renderiza nada (ni el botón).
  if (!url) return null;

  const titulo = nombreCientifico || nombreNatural || "Planta";

  const handleOpen = (e) => {
    if (stopPropagation) e.stopPropagation();
    setOpen(true);
  };
  const handleClose = (e) => {
    if (stopPropagation && e) e.stopPropagation();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title="Ver imagen de la planta"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: variant === "icon" ? "3px 7px" : "5px 10px",
          borderRadius: 8,
          border: "1px solid rgba(16,185,129,0.30)",
          background: "rgba(16,185,129,0.10)",
          color: "#065f46",
          fontWeight: 800,
          fontSize: 12,
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        🖼️{variant === "button" ? " Ver" : ""}
      </button>

      {open && (
        <div
          onClick={handleClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2,6,23,0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 1400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "min(760px, 96vw)",
              maxHeight: "92vh",
              background: "#fff",
              borderRadius: 18,
              overflow: "hidden",
              boxShadow: "0 30px 80px rgba(2,6,23,0.45)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 18px",
                borderBottom: "1px solid rgba(15,23,42,0.08)",
              }}
            >
              <div>
                <div style={{ fontWeight: 900, fontStyle: "italic", color: "#0f172a" }}>{titulo}</div>
                {nombreNatural && nombreNatural !== titulo && (
                  <div style={{ color: "#64748b", fontWeight: 700, fontSize: 13 }}>{nombreNatural}</div>
                )}
              </div>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  padding: "7px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.14)",
                  background: "#f8fafc",
                  color: "#334155",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Cerrar
              </button>
            </div>
            <div
              style={{
                padding: 16,
                background: "#0f172a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "auto",
              }}
            >
              <img
                src={url}
                alt={titulo}
                style={{ maxWidth: "100%", maxHeight: "78vh", borderRadius: 10, display: "block" }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
