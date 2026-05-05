import React, { useEffect, useMemo, useRef, useState } from "react";
import { parsePoints, pointsToString } from "./zonesStorage";

const MIN_VERTICES = 3;

export default function ZoneEditor({ zonas, onSave, onCancel }) {
  const [editedZonas, setEditedZonas] = useState(() =>
    zonas.map((z) => ({ ...z, _points: parsePoints(z.puntos) }))
  );
  const [selectedId, setSelectedId] = useState(zonas[0]?.id ?? null);
  const [drag, setDrag] = useState(null);
  const svgRef = useRef(null);

  const selectedZona = useMemo(
    () => editedZonas.find((z) => z.id === selectedId) || null,
    [editedZonas, selectedId]
  );

  const getSVGPoint = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const transformed = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: transformed.x, y: transformed.y };
  };

  const handleMouseMove = (e) => {
    if (!drag) return;
    const { x, y } = getSVGPoint(e.clientX, e.clientY);
    setEditedZonas((prev) =>
      prev.map((z) => {
        if (z.id !== drag.zonaId) return z;
        if (drag.type === "vertex") {
          const newPoints = z._points.map((p, i) =>
            i === drag.idx ? [x, y] : p
          );
          return { ...z, _points: newPoints };
        }
        if (drag.type === "zona") {
          const dx = x - drag.lastX;
          const dy = y - drag.lastY;
          return {
            ...z,
            _points: z._points.map(([px, py]) => [px + dx, py + dy]),
          };
        }
        return z;
      })
    );
    if (drag.type === "zona") {
      setDrag({ ...drag, lastX: x, lastY: y });
    }
  };

  const endDrag = () => setDrag(null);

  const startVertexDrag = (e, zonaId, idx) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setDrag({ type: "vertex", zonaId, idx });
  };

  const startZonaDrag = (e, zonaId) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const { x, y } = getSVGPoint(e.clientX, e.clientY);
    setDrag({ type: "zona", zonaId, lastX: x, lastY: y });
  };

  const deleteVertex = (e, zonaId, idx) => {
    e.preventDefault();
    e.stopPropagation();
    setEditedZonas((prev) =>
      prev.map((z) => {
        if (z.id !== zonaId) return z;
        if (z._points.length <= MIN_VERTICES) return z;
        return { ...z, _points: z._points.filter((_, i) => i !== idx) };
      })
    );
  };

  const insertVertex = (e, zonaId, edgeIdx) => {
    e.stopPropagation();
    setEditedZonas((prev) =>
      prev.map((z) => {
        if (z.id !== zonaId) return z;
        const next = (edgeIdx + 1) % z._points.length;
        const [x1, y1] = z._points[edgeIdx];
        const [x2, y2] = z._points[next];
        const mid = [(x1 + x2) / 2, (y1 + y2) / 2];
        const newPoints = [
          ...z._points.slice(0, edgeIdx + 1),
          mid,
          ...z._points.slice(edgeIdx + 1),
        ];
        return { ...z, _points: newPoints };
      })
    );
  };

  const handleSave = () => {
    const out = editedZonas.map(({ _points, ...rest }) => ({
      ...rest,
      puntos: pointsToString(_points),
    }));
    onSave(out);
  };

  const handleResetZona = () => {
    if (!selectedZona) return;
    const original = zonas.find((z) => z.id === selectedZona.id);
    if (!original) return;
    setEditedZonas((prev) =>
      prev.map((z) =>
        z.id === selectedZona.id
          ? { ...z, _points: parsePoints(original.puntos) }
          : z
      )
    );
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="zone-editor">
      <div className="zone-editor-toolbar">
        <label className="zone-editor-field">
          <span>Zona:</span>
          <select
            value={selectedId || ""}
            onChange={(e) => setSelectedId(e.target.value || null)}
          >
            <option value="">— Selecciona una zona —</option>
            {editedZonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre} ({z._points.length} pts)
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={handleResetZona}
          disabled={!selectedZona}
          className="zone-editor-btn-secondary"
          title="Restaurar puntos originales de esta zona"
        >
          Restaurar zona
        </button>

        <span className="zone-editor-help">
          Arrastra los puntos blancos · Click en un + verde para insertar punto
          · Click derecho en un punto para borrarlo · Arrastra el cuerpo para
          mover toda la zona
        </span>

        <button
          type="button"
          onClick={handleSave}
          className="zone-editor-btn-save"
        >
          Guardar y descargar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="zone-editor-btn-cancel"
        >
          Cancelar
        </button>
      </div>

      <div className="vivero-map-wrapper zone-editor-canvas">
        <img
          src="/mapa-vivero.png"
          alt="Mapa del vivero"
          className="vivero-map-image"
        />
        <svg
          ref={svgRef}
          className="vivero-map-overlay"
          viewBox="0 0 2048 1365"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          style={{ pointerEvents: "all" }}
        >
          {editedZonas.map((z) => {
            const isSelected = z.id === selectedId;
            const pointsStr = z._points
              .map(([x, y]) => `${x},${y}`)
              .join(" ");
            return (
              <g key={z.id} style={{ "--zona-color": z.color }}>
                <polygon
                  points={pointsStr}
                  className={`zona-clickable ${
                    isSelected ? "zona-editing" : "zona-dim"
                  }`}
                  onMouseDown={(e) =>
                    isSelected ? startZonaDrag(e, z.id) : undefined
                  }
                  onClick={(e) => {
                    if (!isSelected) {
                      e.stopPropagation();
                      setSelectedId(z.id);
                    }
                  }}
                >
                  <title>{z.nombre}</title>
                </polygon>
              </g>
            );
          })}

          {selectedZona &&
            selectedZona._points.map(([x, y], i) => {
              const next =
                (i + 1) % selectedZona._points.length;
              const [nx, ny] = selectedZona._points[next];
              const mx = (x + nx) / 2;
              const my = (y + ny) / 2;
              return (
                <g key={`handles-${i}`}>
                  <circle
                    cx={mx}
                    cy={my}
                    r={10}
                    className="zona-add-handle"
                    onClick={(e) => insertVertex(e, selectedZona.id, i)}
                  >
                    <title>Insertar punto aquí</title>
                  </circle>
                </g>
              );
            })}

          {selectedZona &&
            selectedZona._points.map(([x, y], i) => (
              <g key={`vertex-${i}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={14}
                  className="zona-vertex-handle"
                  onMouseDown={(e) =>
                    startVertexDrag(e, selectedZona.id, i)
                  }
                  onContextMenu={(e) =>
                    deleteVertex(e, selectedZona.id, i)
                  }
                >
                  <title>
                    Punto {i + 1} ({Math.round(x)}, {Math.round(y)}) · Arrastra
                    para mover · Click derecho para borrar
                  </title>
                </circle>
                <text
                  x={x}
                  y={y - 20}
                  className="zona-vertex-label"
                  textAnchor="middle"
                >
                  {i + 1}
                </text>
              </g>
            ))}
        </svg>
      </div>
    </div>
  );
}
