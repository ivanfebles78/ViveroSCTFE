import React, { useMemo, useState } from "react";

const cardStyle = {
  background: "white",
  border: "1px solid rgba(15,23,42,0.06)",
  borderRadius: 18,
  boxShadow: "0 10px 30px rgba(2,6,23,0.06)",
  padding: 18,
};

const badgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(59,130,246,0.10)",
  color: "#1d4ed8",
  fontWeight: 800,
  fontSize: 12,
};

export default function Informes() {
  const [uuidInputs, setUuidInputs] = useState({
    trazabilidad: "",
  });
  const [trazabilidadRows, setTrazabilidadRows] = useState([]);
  const [trazabilidadError, setTrazabilidadError] = useState("");

  const handleGenerate = (key) => {
    if (key !== "trazabilidad") {
      return;
    }

    const raw = uuidInputs.trazabilidad.trim();
    if (!raw) {
      setTrazabilidadError("Debes indicar un UUID.");
      setTrazabilidadRows([]);
      return;
    }

    if (raw !== "111aqk303") {
      setTrazabilidadError("No hay movimientos asociados a ese UUID.");
      setTrazabilidadRows([]);
      return;
    }

    setTrazabilidadError("");
    setTrazabilidadRows([
      {
        fecha: "2024-01-10",
        producto: "Producto Z",
        tamano: "Semillero",
        detalle: "Entrada · Vivero Zona 1",
        cantidad: 100,
        uuid: raw,
      },
      {
        fecha: "2024-02-05",
        producto: "Producto Z",
        tamano: "K",
        detalle: "Traslado · Zona 1 → Zona 5",
        cantidad: 100,
        uuid: raw,
      },
      {
        fecha: "2024-03-12",
        producto: "Producto Z",
        tamano: "K",
        detalle: "Salida · Salud-La Salle · Calle Rosaura 5 · 38001",
        cantidad: 60,
        uuid: raw,
      },
    ]);
  };

  const trazabilidadTable = useMemo(() => {
    if (trazabilidadRows.length === 0) return null;
    return (
      <div style={{ marginTop: 14, overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <thead style={{ background: "#f8fafc" }}>
            <tr>
              <th style={{ padding: "10px 12px", textAlign: "left" }}>Fecha</th>
              <th style={{ padding: "10px 12px", textAlign: "left" }}>Producto</th>
              <th style={{ padding: "10px 12px", textAlign: "left" }}>Tamaño</th>
              <th style={{ padding: "10px 12px", textAlign: "left" }}>Detalle</th>
              <th style={{ padding: "10px 12px", textAlign: "right" }}>Cantidad</th>
              <th style={{ padding: "10px 12px", textAlign: "left" }}>UUID</th>
            </tr>
          </thead>
          <tbody>
            {trazabilidadRows.map((row, idx) => (
              <tr key={`${row.uuid}-${idx}`} style={{ borderTop: "1px solid rgba(15,23,42,0.08)" }}>
                <td style={{ padding: "10px 12px" }}>{row.fecha}</td>
                <td style={{ padding: "10px 12px", fontWeight: 800 }}>{row.producto}</td>
                <td style={{ padding: "10px 12px" }}>{row.tamano}</td>
                <td style={{ padding: "10px 12px" }}>{row.detalle}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800 }}>
                  {row.cantidad}
                </td>
                <td style={{ padding: "10px 12px" }}>{row.uuid}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [trazabilidadRows]);

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <h1 style={{ fontSize: 44, margin: 0, fontWeight: 900, color: "#0f172a" }}>
          Informes
        </h1>
        <div style={{ fontWeight: 800, color: "#64748b" }}>
          Consulta y genera reportes clave del vivero.
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        <div style={cardStyle}>
          <div style={badgeStyle}>Trazabilidad</div>
          <div style={{ marginTop: 10, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
            Seguimiento por UUID
          </div>
          <label style={{ display: "grid", gap: 6, marginTop: 12, fontWeight: 800, color: "#334155" }}>
            UUID
            <input
              value={uuidInputs.trazabilidad}
              onChange={(e) =>
                setUuidInputs((prev) => ({ ...prev, trazabilidad: e.target.value }))
              }
              placeholder="Ej. 111aqk303"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "2px solid #334155",
                background: "#f8fafc",
                fontWeight: 700,
                color: "#0f172a",
              }}
            />
          </label>
          <button
            onClick={() => handleGenerate("trazabilidad")}
            style={{
              marginTop: 10,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(16,185,129,0.35)",
              background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Generar informe
          </button>
          {trazabilidadError ? (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 10,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.18)",
                color: "#991b1b",
                fontWeight: 800,
              }}
            >
              {trazabilidadError}
            </div>
          ) : null}
          {trazabilidadTable}
        </div>

        <div style={cardStyle}>
          <div style={badgeStyle}>Distribución</div>
          <div style={{ marginTop: 10, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
            Distribución por zonas
          </div>
          <div style={{ marginTop: 8, color: "#64748b", fontWeight: 700, lineHeight: 1.5 }}>
            Busca un producto y consulta cómo se distribuye (nombre, categoría, subcategoría,
            cantidad y tamaño) por zonas del vivero.
          </div>
        </div>

        <div style={cardStyle}>
          <div style={badgeStyle}>Inventario</div>
          <div style={{ marginTop: 10, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
            Stock bajo o sin stock
          </div>
          <div style={{ marginTop: 8, color: "#64748b", fontWeight: 700, lineHeight: 1.5 }}>
            Reporte de productos sin stock o con stock bajo para planificar reposiciones.
          </div>
        </div>

        <div style={cardStyle}>
          <div style={badgeStyle}>Movimientos externos</div>
          <div style={{ marginTop: 10, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
            Movimientos por dirección
          </div>
          <div style={{ marginTop: 8, color: "#64748b", fontWeight: 700, lineHeight: 1.5 }}>
            Selecciona distrito, barrio, calle y rango de fechas para ver movimientos asociados a
            esa dirección.
          </div>
        </div>
      </div>
    </div>
  );
}
