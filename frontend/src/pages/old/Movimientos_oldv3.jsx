import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getMovimientos,
  getProductos,
  createMovimiento,
} from "../api/api";

const ZONAS = [
  "1", "2", "3a", "3b", "3c", "4a", "4b", "4c",
  "5", "6", "7", "8", "9a", "9b", "9c", "10a", "10b", "11",
];

const TAMANOS = ["semillero", "M12", "M20", "M30"];
const ORIGENES = ["Proveedor", "Vivero", "Palmetum"];
const DESTINOS = ["Vivero", "Externo", "Baja Vivero", "Palmetum"];

const DISTRITOS = [
  "Anaga",
  "Centro-Ifara",
  "La Salud-La Salle",
  "Ofra-Costa Sur",
  "Suroeste",
];

const BARRIOS = [
  "Barrio 1",
  "Barrio 2",
  "Barrio 3",
  "Barrio 4",
  "Barrio 5",
];

const safeArray = (x) => (Array.isArray(x) ? x : []);

const fmtFechaES = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
};

const dateInputValue = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

function getMovimientoTipo(m) {
  const o = String(m?.origen_tipo || "").trim().toLowerCase();
  const d = String(m?.destino_tipo || "").trim().toLowerCase();

  if (o === "vivero" && d === "vivero") return "traslado_interno";
  if (d === "vivero") return "entrada";
  return "salida";
}

function getDestinoOptions(origenTipo) {
  if (origenTipo === "Proveedor") return ["Vivero"];
  if (origenTipo === "Palmetum") return ["Vivero"];
  if (origenTipo === "Vivero") return ["Vivero", "Externo", "Baja Vivero", "Palmetum"];
  return [];
}

function badgeTipo(tipo) {
  const t = String(tipo || "").toLowerCase();

  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid rgba(15,23,42,0.08)",
    textTransform: "capitalize",
  };

  if (t === "entrada") {
    return { ...base, background: "rgba(16,185,129,0.12)", color: "#065f46" };
  }
  if (t === "salida") {
    return { ...base, background: "rgba(239,68,68,0.10)", color: "#991b1b" };
  }
  return { ...base, background: "rgba(59,130,246,0.10)", color: "#1e3a8a" };
}

function thStyle() {
  return {
    textAlign: "left",
    padding: "12px 12px",
    color: "#334155",
    fontWeight: 900,
    fontSize: 13,
    borderBottom: "1px solid rgba(15,23,42,0.10)",
  };
}

function tdStyle() {
  return {
    padding: "14px 12px",
    verticalAlign: "top",
    color: "#0f172a",
    fontWeight: 700,
  };
}

function buildLabelOrigen(m) {
  if (m?.origen_tipo === "Vivero") {
    return `Vivero${m?.zona_origen ? ` · Zona ${m.zona_origen}` : ""}`;
  }
  return m?.origen_tipo || "—";
}

function buildLabelDestino(m) {
  if (m?.destino_tipo === "Vivero") {
    return `Vivero${m?.zona_destino ? ` · Zona ${m.zona_destino}` : ""}`;
  }

  if (m?.destino_tipo === "Externo") {
    const parts = [m?.distrito_destino, m?.barrio_destino, m?.direccion_destino].filter(Boolean);
    return parts.length ? `Externo · ${parts.join(" · ")}` : "Externo";
  }

  return m?.destino_tipo || "—";
}

function getFormErrors(form) {
  const errs = [];

  if (!form.producto_id) errs.push("Debes seleccionar un producto.");
  if (!form.cantidad || Number(form.cantidad) <= 0) errs.push("La cantidad debe ser mayor que 0.");
  if (!form.origen_tipo) errs.push("Debes seleccionar un origen.");
  if (!form.destino_tipo) errs.push("Debes seleccionar un destino.");

  if (form.origen_tipo === form.destino_tipo && form.origen_tipo !== "Vivero") {
    errs.push("No se permite mover entre el mismo origen y destino salvo traslado interno en vivero.");
  }

  if (form.origen_tipo === "Proveedor" && form.destino_tipo !== "Vivero") {
    errs.push("Proveedor solo puede mover hacia Vivero.");
  }

  if (form.origen_tipo === "Palmetum" && form.destino_tipo !== "Vivero") {
    errs.push("Palmetum solo puede mover hacia Vivero.");
  }

  if (form.origen_tipo === "Vivero" && !form.zona_origen) {
    errs.push("Debes seleccionar una zona de origen del vivero.");
  }

  if (form.origen_tipo === "Vivero" && !form.tamano_origen) {
    errs.push("Debes seleccionar un tamaño de origen.");
  }

  if (form.destino_tipo === "Vivero" && !form.zona_destino) {
    errs.push("Debes seleccionar una zona de destino del vivero.");
  }

  if (form.destino_tipo === "Vivero" && !form.tamano_destino) {
    errs.push("Debes seleccionar un tamaño de destino.");
  }

  if (form.destino_tipo === "Externo") {
    if (!form.distrito_destino) errs.push("Debes seleccionar un distrito.");
    if (!form.barrio_destino) errs.push("Debes seleccionar un barrio.");
    if (!form.direccion_destino) errs.push("Debes indicar una dirección.");
  }

  if (
    form.origen_tipo === "Vivero" &&
    form.destino_tipo === "Vivero" &&
    form.zona_origen &&
    form.zona_destino &&
    form.zona_origen === form.zona_destino &&
    form.tamano_origen === form.tamano_destino
  ) {
    errs.push("El traslado interno debe cambiar de zona o de tamaño.");
  }

  return errs;
}

function FilterControl({ children, wide = false }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 14,
        padding: "10px 12px",
        boxShadow: "0 6px 18px rgba(2,6,23,0.04)",
        minWidth: 0,
        gridColumn: wide ? "span 2" : "span 1",
      }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 900,
        color: "#64748b",
        textTransform: "uppercase",
        letterSpacing: 0.4,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function inputStyle() {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(15,23,42,0.10)",
    outline: "none",
    fontWeight: 700,
    color: "#0f172a",
    background: "#fff",
    boxSizing: "border-box",
  };
}

function MessageBanner({ msg, onClose, isError }) {
  if (!msg) return null;

  return (
    <div
      style={{
        marginTop: 12,
        padding: "12px 14px",
        borderRadius: 14,
        border: isError
          ? "1px solid rgba(239,68,68,0.20)"
          : "1px solid rgba(16,185,129,0.22)",
        background: isError
          ? "rgba(239,68,68,0.08)"
          : "rgba(16,185,129,0.10)",
        color: isError ? "#991b1b" : "#065f46",
        fontWeight: 800,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span>{msg}</span>

      <button
        onClick={onClose}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 18,
          fontWeight: 900,
          color: isError ? "#991b1b" : "#065f46",
          lineHeight: 1,
        }}
        aria-label="Cerrar mensaje"
        title="Cerrar"
      >
        ×
      </button>
    </div>
  );
}

function MovimientoModal({
  open,
  onClose,
  productos,
  onSubmit,
  saving,
}) {
  const [form, setForm] = useState({
    producto_id: "",
    cantidad: "",
    origen_tipo: "",
    destino_tipo: "",
    zona_origen: "",
    zona_destino: "",
    tamano_origen: "",
    tamano_destino: "",
    distrito_destino: "",
    barrio_destino: "",
    direccion_destino: "",
    cp_destino: "",
    nota: "",
  });

  const [errors, setErrors] = useState([]);

  useEffect(() => {
    if (!open) {
      setForm({
        producto_id: "",
        cantidad: "",
        origen_tipo: "",
        destino_tipo: "",
        zona_origen: "",
        zona_destino: "",
        tamano_origen: "",
        tamano_destino: "",
        distrito_destino: "",
        barrio_destino: "",
        direccion_destino: "",
        cp_destino: "",
        nota: "",
      });
      setErrors([]);
    }
  }, [open]);

  useEffect(() => {
    const allowed = getDestinoOptions(form.origen_tipo);
    if (form.origen_tipo && !allowed.includes(form.destino_tipo)) {
      setForm((prev) => ({
        ...prev,
        destino_tipo: allowed[0] || "",
        zona_destino: "",
        tamano_destino: "",
        distrito_destino: "",
        barrio_destino: "",
        direccion_destino: "",
        cp_destino: "",
      }));
    }
  }, [form.origen_tipo, form.destino_tipo]);

  const allowedDestinos = getDestinoOptions(form.origen_tipo);

  const selectedProducto = productos.find((p) => String(p.id) === String(form.producto_id));

  const tipoPreview = useMemo(() => {
    return getMovimientoTipo(form);
  }, [form]);

  const submit = async () => {
    const foundErrors = getFormErrors(form);
    setErrors(foundErrors);
    if (foundErrors.length > 0) return;

    await onSubmit({
      producto_id: Number(form.producto_id),
      cantidad: Number(form.cantidad),
      origen_tipo: form.origen_tipo,
      destino_tipo: form.destino_tipo,
      zona_origen: form.origen_tipo === "Vivero" ? form.zona_origen || null : null,
      zona_destino: form.destino_tipo === "Vivero" ? form.zona_destino || null : null,
      tamano_origen: form.origen_tipo === "Vivero" ? form.tamano_origen || null : null,
      tamano_destino: form.destino_tipo === "Vivero" ? form.tamano_destino || null : null,
      distrito_destino: form.destino_tipo === "Externo" ? form.distrito_destino || null : null,
      barrio_destino: form.destino_tipo === "Externo" ? form.barrio_destino || null : null,
      direccion_destino: form.destino_tipo === "Externo" ? form.direccion_destino || null : null,
      cp_destino: form.destino_tipo === "Externo" ? form.cp_destino || null : null,
      nota: form.nota || null,
    });
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.52)",
        backdropFilter: "blur(4px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(1180px, 96vw)",
          height: "min(92vh, 900px)",
          background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
          border: "1px solid rgba(255,255,255,0.4)",
          display: "grid",
          gridTemplateColumns: "1.15fr 0.85fr",
        }}
      >
        <div
          style={{
            padding: 24,
            borderRight: "1px solid rgba(15,23,42,0.08)",
            overflow: "auto",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>Nuevo movimiento</div>
              <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
                Registra entradas, salidas o traslados internos con la lógica del vivero.
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                border: "1px solid rgba(15,23,42,0.10)",
                background: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Cerrar
            </button>
          </div>

          {errors.length > 0 ? (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 16,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.18)",
                color: "#991b1b",
                fontWeight: 800,
              }}
            >
              {errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          ) : null}

          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            <div>
              <FieldLabel>Producto</FieldLabel>
              <select
                value={form.producto_id}
                onChange={(e) => setForm((prev) => ({ ...prev, producto_id: e.target.value }))}
                style={inputStyle()}
              >
                <option value="">Seleccionar producto</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre_cientifico || p.nombre || `Producto #${p.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>Cantidad</FieldLabel>
              <input
                type="number"
                min={1}
                value={form.cantidad}
                onChange={(e) => setForm((prev) => ({ ...prev, cantidad: e.target.value }))}
                style={inputStyle()}
                placeholder="0"
              />
            </div>

            <div>
              <FieldLabel>Origen</FieldLabel>
              <select
                value={form.origen_tipo}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    origen_tipo: e.target.value,
                    zona_origen: "",
                    tamano_origen: "",
                  }))
                }
                style={inputStyle()}
              >
                <option value="">Seleccionar origen</option>
                {ORIGENES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>Destino</FieldLabel>
              <select
                value={form.destino_tipo}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    destino_tipo: e.target.value,
                    zona_destino: "",
                    tamano_destino: "",
                    distrito_destino: "",
                    barrio_destino: "",
                    direccion_destino: "",
                    cp_destino: "",
                  }))
                }
                style={inputStyle()}
                disabled={!form.origen_tipo}
              >
                <option value="">Seleccionar destino</option>
                {allowedDestinos.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {form.origen_tipo === "Vivero" ? (
              <>
                <div>
                  <FieldLabel>Zona origen</FieldLabel>
                  <select
                    value={form.zona_origen}
                    onChange={(e) => setForm((prev) => ({ ...prev, zona_origen: e.target.value }))}
                    style={inputStyle()}
                  >
                    <option value="">Seleccionar zona</option>
                    {ZONAS.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel>Tamaño origen</FieldLabel>
                  <select
                    value={form.tamano_origen}
                    onChange={(e) => setForm((prev) => ({ ...prev, tamano_origen: e.target.value }))}
                    style={inputStyle()}
                  >
                    <option value="">Seleccionar tamaño</option>
                    {TAMANOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}

            {form.destino_tipo === "Vivero" ? (
              <>
                <div>
                  <FieldLabel>Zona destino</FieldLabel>
                  <select
                    value={form.zona_destino}
                    onChange={(e) => setForm((prev) => ({ ...prev, zona_destino: e.target.value }))}
                    style={inputStyle()}
                  >
                    <option value="">Seleccionar zona</option>
                    {ZONAS.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel>Tamaño destino</FieldLabel>
                  <select
                    value={form.tamano_destino}
                    onChange={(e) => setForm((prev) => ({ ...prev, tamano_destino: e.target.value }))}
                    style={inputStyle()}
                  >
                    <option value="">Seleccionar tamaño</option>
                    {TAMANOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}

            {form.destino_tipo === "Externo" ? (
              <>
                <div>
                  <FieldLabel>Distrito</FieldLabel>
                  <select
                    value={form.distrito_destino}
                    onChange={(e) => setForm((prev) => ({ ...prev, distrito_destino: e.target.value }))}
                    style={inputStyle()}
                  >
                    <option value="">Seleccionar distrito</option>
                    {DISTRITOS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <FieldLabel>Barrio</FieldLabel>
                  <select
                    value={form.barrio_destino}
                    onChange={(e) => setForm((prev) => ({ ...prev, barrio_destino: e.target.value }))}
                    style={inputStyle()}
                  >
                    <option value="">Seleccionar barrio</option>
                    {BARRIOS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <FieldLabel>Dirección</FieldLabel>
                  <input
                    value={form.direccion_destino}
                    onChange={(e) => setForm((prev) => ({ ...prev, direccion_destino: e.target.value }))}
                    style={inputStyle()}
                    placeholder="Calle, número..."
                  />
                </div>

                <div>
                  <FieldLabel>CP</FieldLabel>
                  <input
                    value={form.cp_destino}
                    onChange={(e) => setForm((prev) => ({ ...prev, cp_destino: e.target.value }))}
                    style={inputStyle()}
                    placeholder="Código postal"
                  />
                </div>
              </>
            ) : null}

            <div style={{ gridColumn: "1 / -1" }}>
              <FieldLabel>Nota (opcional)</FieldLabel>
              <textarea
                value={form.nota}
                onChange={(e) => setForm((prev) => ({ ...prev, nota: e.target.value }))}
                style={{
                  ...inputStyle(),
                  minHeight: 90,
                  resize: "vertical",
                }}
                placeholder="Comentario del movimiento"
              />
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            background: "rgba(248,250,252,0.65)",
          }}
        >
          <div style={{ padding: 24, overflow: "auto", flex: 1 }}>
            <div
              style={{
                padding: 18,
                borderRadius: 20,
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                color: "white",
                boxShadow: "0 18px 40px rgba(2,6,23,0.18)",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.75, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Resumen del movimiento
              </div>

              <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900 }}>
                {tipoPreview === "entrada"
                  ? "Entrada"
                  : tipoPreview === "salida"
                  ? "Salida"
                  : "Traslado interno"}
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Producto</div>
                  <div style={{ fontWeight: 800 }}>
                    {selectedProducto?.nombre_cientifico || selectedProducto?.nombre || "—"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Origen</div>
                  <div style={{ fontWeight: 800 }}>
                    {form.origen_tipo
                      ? form.origen_tipo === "Vivero"
                        ? `Vivero · Zona ${form.zona_origen || "—"} · ${form.tamano_origen || "—"}`
                        : form.origen_tipo
                      : "—"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Destino</div>
                  <div style={{ fontWeight: 800 }}>
                    {form.destino_tipo
                      ? form.destino_tipo === "Vivero"
                        ? `Vivero · Zona ${form.zona_destino || "—"} · ${form.tamano_destino || "—"}`
                        : form.destino_tipo === "Externo"
                        ? `Externo · ${form.distrito_destino || "—"} · ${form.barrio_destino || "—"}`
                        : form.destino_tipo
                      : "—"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Cantidad</div>
                  <div style={{ fontWeight: 800 }}>{form.cantidad || "—"}</div>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 18,
                background: "rgba(255,255,255,0.8)",
                border: "1px solid rgba(15,23,42,0.08)",
              }}
            >
              <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>Reglas activas</div>

              <div style={{ color: "#64748b", fontWeight: 700, display: "grid", gap: 8 }}>
                <div>• Proveedor solo puede mover a Vivero.</div>
                <div>• Palmetum solo puede mover a Vivero.</div>
                <div>• Si el origen es Vivero, zona y tamaño de origen son obligatorios.</div>
                <div>• Si el destino es Vivero, zona y tamaño de destino son obligatorios.</div>
                <div>• Si el destino es Externo, distrito, barrio y dirección son obligatorios.</div>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: 16,
              borderTop: "1px solid rgba(15,23,42,0.08)",
              background: "white",
              display: "flex",
              gap: 10,
              alignItems: "center",
              justifyContent: "space-between",
              position: "sticky",
              bottom: 0,
            }}
          >
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                padding: "10px 14px",
                borderRadius: 14,
                border: "1px solid rgba(15,23,42,0.10)",
                background: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>

            <button
              onClick={submit}
              disabled={saving}
              style={{
                padding: "12px 18px",
                borderRadius: 14,
                border: "1px solid rgba(16,185,129,0.35)",
                background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
                minWidth: 220,
              }}
            >
              {saving ? "Guardando movimiento..." : "Guardar movimiento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Movimientos() {
  const [movimientos, setMovimientos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");

  const msgTimerRef = useRef(null);

  const [filtroProducto, setFiltroProducto] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroZona, setFiltroZona] = useState("");
  const [filtroOrigen, setFiltroOrigen] = useState("");
  const [filtroDestino, setFiltroDestino] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");

  const clearMsgTimer = () => {
    if (msgTimerRef.current) {
      clearTimeout(msgTimerRef.current);
      msgTimerRef.current = null;
    }
  };

  const showTimedMessage = (text, type = "success") => {
    clearMsgTimer();
    setMsg(text);
    setMsgType(type);

    msgTimerRef.current = setTimeout(() => {
      setMsg("");
    }, 3000);
  };

  const clearFilters = () => {
    setFiltroProducto("");
    setFiltroTipo("");
    setFiltroZona("");
    setFiltroOrigen("");
    setFiltroDestino("");
    setFiltroFecha("");
  };

  useEffect(() => {
    load();

    return () => {
      clearMsgTimer();
    };
  }, []);

  const load = async () => {
    setLoading(true);
    clearMsgTimer();
    setMsg("");

    try {
      const [movs, prods] = await Promise.all([getMovimientos(), getProductos()]);
      setMovimientos(safeArray(movs));
      setProductos(safeArray(prods));
    } catch (e) {
      showTimedMessage(
        e?.response?.data?.detail || e?.message || "Error cargando movimientos",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const movimientosEnriquecidos = useMemo(() => {
    return safeArray(movimientos).map((m) => ({
      ...m,
      _tipo: m.tipo_movimiento || getMovimientoTipo(m),
      _origenLabel: buildLabelOrigen(m),
      _destinoLabel: buildLabelDestino(m),
    }));
  }, [movimientos]);

  const origenOptions = useMemo(() => {
    return [...new Set(movimientosEnriquecidos.map((m) => m.origen_tipo).filter(Boolean))];
  }, [movimientosEnriquecidos]);

  const destinoOptions = useMemo(() => {
    return [...new Set(movimientosEnriquecidos.map((m) => m.destino_tipo).filter(Boolean))];
  }, [movimientosEnriquecidos]);

  const zonaOptions = useMemo(() => {
    const zones = new Set();
    movimientosEnriquecidos.forEach((m) => {
      if (m.zona_origen) zones.add(m.zona_origen);
      if (m.zona_destino) zones.add(m.zona_destino);
    });
    return [...zones].sort();
  }, [movimientosEnriquecidos]);

  const movimientosFiltrados = useMemo(() => {
    return movimientosEnriquecidos
      .slice()
      .sort((a, b) => new Date(b.fecha_movimiento || 0) - new Date(a.fecha_movimiento || 0))
      .filter((m) => {
        const productoOk =
          !filtroProducto ||
          String(m.producto_nombre_cientifico || "")
            .toLowerCase()
            .includes(filtroProducto.toLowerCase());

        const tipoOk = !filtroTipo || String(m._tipo) === filtroTipo;

        const zonaOk =
          !filtroZona ||
          String(m.zona_origen || "") === filtroZona ||
          String(m.zona_destino || "") === filtroZona;

        const origenOk = !filtroOrigen || String(m.origen_tipo || "") === filtroOrigen;
        const destinoOk = !filtroDestino || String(m.destino_tipo || "") === filtroDestino;

        const fechaOk =
          !filtroFecha || dateInputValue(m.fecha_movimiento) === filtroFecha;

        return productoOk && tipoOk && zonaOk && origenOk && destinoOk && fechaOk;
      });
  }, [
    movimientosEnriquecidos,
    filtroProducto,
    filtroTipo,
    filtroZona,
    filtroOrigen,
    filtroDestino,
    filtroFecha,
  ]);

  const onCreate = async (payload) => {
    setSaving(true);

    try {
      await createMovimiento(payload);
      setShowModal(false);
      await load();
      showTimedMessage("Movimiento registrado correctamente.", "success");
    } catch (e) {
      showTimedMessage(
        e?.response?.data?.detail || e?.message || "Error registrando movimiento",
        "error"
      );
      throw e;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: "100%", minWidth: 0, overflowX: "hidden", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <h1 style={{ fontSize: 44, margin: 0, fontWeight: 900, color: "#0f172a" }}>Movimientos</h1>

        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: "10px 14px",
            borderRadius: 14,
            border: "1px solid rgba(16,185,129,0.35)",
            background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Nuevo movimiento
        </button>
      </div>

      <MessageBanner
        msg={msg}
        isError={msgType === "error"}
        onClose={() => {
          clearMsgTimer();
          setMsg("");
        }}
      />

      <div
        style={{
          marginTop: 16,
          background: "linear-gradient(180deg, #f8fbff 0%, #eef6ff 100%)",
          border: "1px solid rgba(15,23,42,0.06)",
          borderRadius: 20,
          boxShadow: "0 10px 30px rgba(2,6,23,0.06)",
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
            Filtros de búsqueda
          </div>

          <button
            onClick={clearFilters}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.10)",
              background: "white",
              color: "#0f172a",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(2,6,23,0.04)",
            }}
          >
            Limpiar filtros
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <FilterControl wide>
            <FieldLabel>Producto</FieldLabel>
            <input
              placeholder="Buscar por nombre científico..."
              value={filtroProducto}
              onChange={(e) => setFiltroProducto(e.target.value)}
              style={inputStyle()}
            />
          </FilterControl>

          <FilterControl>
            <FieldLabel>Tipo</FieldLabel>
            <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={inputStyle()}>
              <option value="">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="traslado_interno">Traslado interno</option>
            </select>
          </FilterControl>

          <FilterControl>
            <FieldLabel>Zona</FieldLabel>
            <select value={filtroZona} onChange={(e) => setFiltroZona(e.target.value)} style={inputStyle()}>
              <option value="">Todas</option>
              {zonaOptions.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </FilterControl>

          <FilterControl>
            <FieldLabel>Origen</FieldLabel>
            <select value={filtroOrigen} onChange={(e) => setFiltroOrigen(e.target.value)} style={inputStyle()}>
              <option value="">Todos</option>
              {origenOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </FilterControl>

          <FilterControl>
            <FieldLabel>Destino</FieldLabel>
            <select value={filtroDestino} onChange={(e) => setFiltroDestino(e.target.value)} style={inputStyle()}>
              <option value="">Todos</option>
              {destinoOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </FilterControl>

          <FilterControl>
            <FieldLabel>Fecha</FieldLabel>
            <input
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              style={inputStyle()}
            />
          </FilterControl>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          color: "#64748b",
          fontWeight: 800,
          fontSize: 14,
        }}
      >
        Mostrando <b>{movimientosFiltrados.length}</b> de <b>{movimientosEnriquecidos.length}</b> movimientos
      </div>

      <div
        style={{
          marginTop: 16,
          background: "white",
          border: "1px solid rgba(15,23,42,0.06)",
          borderRadius: 18,
          boxShadow: "0 10px 30px rgba(2,6,23,0.06)",
          padding: 16,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 14 }}>
          Historial de movimientos
        </div>

        {loading ? (
          <div style={{ color: "#64748b", fontWeight: 800 }}>Cargando…</div>
        ) : movimientosFiltrados.length === 0 ? (
          <div style={{ color: "#64748b", fontWeight: 800 }}>No hay movimientos para los filtros seleccionados.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", minWidth: 1180 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={thStyle()}>ID</th>
                  <th style={thStyle()}>Producto</th>
                  <th style={thStyle()}>Tipo</th>
                  <th style={thStyle()}>Origen</th>
                  <th style={thStyle()}>Destino</th>
                  <th style={thStyle()}>Tamaño</th>
                  <th style={thStyle()}>Cantidad</th>
                  <th style={thStyle()}>Fecha</th>
                </tr>
              </thead>

              <tbody>
                {movimientosFiltrados.map((m) => (
                  <tr
                    key={m.id}
                    style={{
                      background: "white",
                      boxShadow: "0 6px 18px rgba(2,6,23,0.05)",
                    }}
                  >
                    <td
                      style={{
                        ...tdStyle(),
                        borderTop: "1px solid rgba(15,23,42,0.10)",
                        borderBottom: "1px solid rgba(15,23,42,0.10)",
                        borderLeft: "1px solid rgba(15,23,42,0.10)",
                        borderTopLeftRadius: 14,
                        borderBottomLeftRadius: 14,
                      }}
                    >
                      #{m.id}
                    </td>

                    <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                      <div style={{ fontWeight: 900, color: "#0f172a" }}>
                        {m.producto_nombre_cientifico || "—"}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                        {m.producto_categoria || "—"} {m.producto_subcategoria ? `· ${m.producto_subcategoria}` : ""}
                      </div>
                    </td>

                    <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                      <span style={badgeTipo(m._tipo)}>{m._tipo}</span>
                    </td>

                    <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                      {m._origenLabel}
                    </td>

                    <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                      {m._destinoLabel}
                    </td>

                    <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                      {m.tamano_origen || m.tamano_destino || "—"}
                    </td>

                    <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                      {m.cantidad}
                    </td>

                    <td
                      style={{
                        ...tdStyle(),
                        borderTop: "1px solid rgba(15,23,42,0.10)",
                        borderBottom: "1px solid rgba(15,23,42,0.10)",
                        borderRight: "1px solid rgba(15,23,42,0.10)",
                        borderTopRightRadius: 14,
                        borderBottomRightRadius: 14,
                      }}
                    >
                      {fmtFechaES(m.fecha_movimiento)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MovimientoModal
        open={showModal}
        onClose={() => setShowModal(false)}
        productos={productos}
        onSubmit={onCreate}
        saving={saving}
      />
    </div>
  );
}