import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { getProductos, createPedidoReposicion, updateProductoInterno } from "../api/api";

const TAMANOS = ["Semillero", "M12", "M20", "M35"];

function fmtErr(e) {
  const status = e?.response?.status;
  const data = e?.response?.data;
  if (status === 422 && Array.isArray(data?.detail)) {
    return data.detail.map((d) => `${(d.loc || []).join(".")}: ${d.msg}`).join(" | ");
  }
  return data?.detail || e?.message || "Error";
}

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

function PedirMasModal({ open, producto, onClose, onSubmit, saving }) {
  const [tamano, setTamano] = useState("M12");
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setTamano("M12");
      setCantidad(1);
      setNota("");
      setErr("");
    }
  }, [open, producto?.id]);

  if (!open || !producto) return null;

  const submit = async () => {
    setErr("");
    const q = Number(cantidad);
    if (!q || q <= 0) {
      setErr("La cantidad debe ser mayor que 0.");
      return;
    }
    if (!tamano) {
      setErr("Selecciona un tamaño.");
      return;
    }
    try {
      await onSubmit({
        producto_id: producto.id,
        tamano,
        cantidad: q,
        nota,
      });
    } catch (e) {
      setErr(fmtErr(e));
    }
  };

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
          width: "min(520px, 96vw)",
          background: "white",
          borderRadius: 22,
          padding: 24,
          boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
          Pedir más producto
        </div>
        <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
          Se generará un pedido interno de reposición que deberá aprobar un responsable (manager o admin).
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            background: "#f8fafc",
            border: "1px solid rgba(15,23,42,0.08)",
          }}
        >
          <div style={{ fontWeight: 900, color: "#0f172a" }}>
            {producto.nombre_cientifico || producto.nombre_natural || `Producto #${producto.id}`}
          </div>
          <div style={{ marginTop: 4, color: "#64748b", fontWeight: 700, fontSize: 13 }}>
            {(producto.categoria || "—") + " · " + (producto.subcategoria || "—")}
          </div>
          <div style={{ marginTop: 4, color: "#64748b", fontWeight: 700, fontSize: 13 }}>
            Origen: Empresa Externa · Destino: Vivero
          </div>
        </div>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6, textTransform: "uppercase" }}>
              Tamaño
            </div>
            <select
              value={tamano}
              onChange={(e) => setTamano(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.12)",
                fontWeight: 700,
              }}
            >
              {TAMANOS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6, textTransform: "uppercase" }}>
              Cantidad
            </div>
            <input
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.12)",
                fontWeight: 700,
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", marginBottom: 6, textTransform: "uppercase" }}>
            Nota (opcional)
          </div>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Motivo de la reposición..."
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.12)",
              fontWeight: 700,
              minHeight: 80,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>

        {err ? (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 10,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.20)",
              color: "#991b1b",
              fontWeight: 800,
            }}
          >
            {err}
          </div>
        ) : null}

        <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid rgba(15,23,42,0.10)",
              background: "white",
              color: "#0f172a",
              fontWeight: 900,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid rgba(16,185,129,0.28)",
              background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
              color: "white",
              fontWeight: 900,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Enviando..." : "Crear pedido de reposición"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Productos() {
  const { me } = useOutletContext();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [categoriaSel, setCategoriaSel] = useState("ALL");
  const [subcategoriaSel, setSubcategoriaSel] = useState("ALL");

  const [pedirProducto, setPedirProducto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const prods = await getProductos();
      const normProds = (prods || []).map((p) => ({
        ...p,
        stock: Number(p.stock ?? 0),
      }));
      setProductos(normProds);
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const categorias = useMemo(() => {
    const set = new Set();
    productos.forEach((p) => {
      const c = (p.categoria || "").trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [productos]);

  const subcategorias = useMemo(() => {
    const set = new Set();
    productos.forEach((p) => {
      const c = (p.categoria || "").trim();
      const s = (p.subcategoria || "").trim();
      if (!s) return;
      if (categoriaSel === "ALL" || c === categoriaSel) set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [productos, categoriaSel]);

  useEffect(() => {
    setSubcategoriaSel("ALL");
  }, [categoriaSel]);

  const productosFiltrados = useMemo(() => {
    const qn = norm(q);

    return productos.filter((p) => {
      const c = (p.categoria || "").trim();
      const s = (p.subcategoria || "").trim();

      const okCat = categoriaSel === "ALL" || c === categoriaSel;
      const okSub = subcategoriaSel === "ALL" || s === subcategoriaSel;

      if (!okCat || !okSub) return false;
      if (!qn) return true;

      const hay =
        norm(p.nombre_cientifico).includes(qn) ||
        norm(p.nombre_natural).includes(qn) ||
        norm(p.nombre).includes(qn) ||
        norm(p.categoria).includes(qn) ||
        norm(p.subcategoria).includes(qn);

      return hay;
    });
  }, [productos, q, categoriaSel, subcategoriaSel]);

  const rol = me?.rol || me?.role;
  const esEmpresaExterna = rol === "empresa_externa";
  const puedePedirMas = rol && rol !== "empresa_externa";
  const puedeMarcarInterno = rol === "admin" || rol === "manager";

  const toggleEsInterno = async (producto) => {
    const nuevoValor = !producto.es_interno;
    setProductos((prev) =>
      prev.map((p) => (p.id === producto.id ? { ...p, es_interno: nuevoValor } : p))
    );
    try {
      await updateProductoInterno(producto.id, nuevoValor);
      setMsg(`Producto ${nuevoValor ? "marcado como interno" : "hecho visible a todos"}.`);
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setProductos((prev) =>
        prev.map((p) => (p.id === producto.id ? { ...p, es_interno: !nuevoValor } : p))
      );
      setError(fmtErr(e));
    }
  };

  const handleCrearReposicion = async ({ producto_id, tamano, cantidad, nota }) => {
    setSaving(true);
    try {
      await createPedidoReposicion({ producto_id, tamano, cantidad, nota });
      setPedirProducto(null);
      setMsg("Pedido de reposición creado. Pendiente de aprobación.");
      setTimeout(() => setMsg(""), 3500);
    } catch (e) {
      throw e;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Productos</h1>

      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}
      {loading && <p>Cargando...</p>}

      {msg && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(16,185,129,0.10)",
            border: "1px solid rgba(16,185,129,0.22)",
            color: "#065f46",
            fontWeight: 800,
          }}
        >
          {msg}
        </div>
      )}

      {!loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr 1fr auto",
            gap: 12,
            alignItems: "end",
            marginBottom: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Buscar</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre científico, categoría, subcategoría..."
              style={{
                padding: 10,
                borderRadius: 10,
                border: "2px solid #334155",
                background: "#f8fafc",
                fontWeight: 700,
                color: "#0f172a",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Categoría</span>
            <select
              value={categoriaSel}
              onChange={(e) => setCategoriaSel(e.target.value)}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "2px solid #334155",
                background: "#f8fafc",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              <option value="ALL">Todas</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>Subcategoría</span>
            <select
              value={subcategoriaSel}
              onChange={(e) => setSubcategoriaSel(e.target.value)}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "2px solid #334155",
                background: "#f8fafc",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              <option value="ALL">Todas</option>
              {subcategorias.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={() => {
              setQ("");
              setCategoriaSel("ALL");
              setSubcategoriaSel("ALL");
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: "pointer",
              fontWeight: 700,
              height: 42,
            }}
          >
            Limpiar
          </button>
        </div>
      )}

      {!loading && (
        <p style={{ color: "#6b7280", marginTop: 0 }}>
          Mostrando <b>{productosFiltrados.length}</b> de <b>{productos.length}</b> productos
        </p>
      )}

      {!loading && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }} border="1" cellPadding="8">
            <thead>
              <tr>
                <th>Nombre científico</th>
                <th>Categoría</th>
                <th>Subcategoría</th>
                <th style={{ textAlign: "center" }}>Stock</th>
                {!esEmpresaExterna && <th style={{ textAlign: "center" }}>Stock mínimo</th>}
                {puedeMarcarInterno && <th style={{ textAlign: "center" }}>Interno</th>}
                {puedePedirMas && <th style={{ textAlign: "center" }}>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      esEmpresaExterna
                        ? 4
                        : 4 + (puedeMarcarInterno ? 1 : 0) + (puedePedirMas ? 1 : 0) + 1
                    }
                    style={{ textAlign: "center" }}
                  >
                    No hay resultados con esos filtros.
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((p) => {
                  const stock = Number(p.stock ?? 0);
                  const min = p.stock_minimo;

                  const low =
                    !esEmpresaExterna &&
                    min !== null &&
                    min !== undefined &&
                    Number.isFinite(Number(min)) &&
                    stock < Number(min);

                  return (
                    <tr key={p.id} style={low ? { color: "crimson", fontWeight: 800 } : undefined}>
                      <td>{p.nombre_cientifico ?? p.nombre ?? p.nombre_natural ?? "-"}</td>
                      <td>{p.categoria ?? "-"}</td>
                      <td>{p.subcategoria ?? "-"}</td>
                      <td style={{ textAlign: "center", fontWeight: 800 }}>{stock}</td>
                      {!esEmpresaExterna && (
                        <td style={{ textAlign: "center" }}>{p.stock_minimo ?? "-"}</td>
                      )}
                      {puedeMarcarInterno && (
                        <td style={{ textAlign: "center" }}>
                          <label
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              cursor: "pointer",
                              fontWeight: 700,
                              color: p.es_interno ? "#92400e" : "#475569",
                            }}
                            title={
                              p.es_interno
                                ? "Interno: oculto para Empresa Externa"
                                : "Visible para todos los roles"
                            }
                          >
                            <input
                              type="checkbox"
                              checked={!!p.es_interno}
                              onChange={() => toggleEsInterno(p)}
                              style={{ width: 16, height: 16, cursor: "pointer" }}
                            />
                            {p.es_interno ? "Sí" : "No"}
                          </label>
                        </td>
                      )}
                      {puedePedirMas && (
                        <td style={{ textAlign: "center" }}>
                          <button
                            onClick={() => setPedirProducto(p)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 10,
                              border: "1px solid rgba(16,185,129,0.28)",
                              background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
                              color: "white",
                              fontWeight: 900,
                              cursor: "pointer",
                              fontSize: 13,
                            }}
                            title="Crear pedido de reposición desde Empresa Externa"
                          >
                            Pedir más
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && (
        <div style={{ marginTop: 12 }}>
          <button onClick={load} style={{ padding: "8px 10px" }}>
            Refrescar
          </button>
        </div>
      )}

      <PedirMasModal
        open={!!pedirProducto}
        producto={pedirProducto}
        onClose={() => setPedirProducto(null)}
        onSubmit={handleCrearReposicion}
        saving={saving}
      />
    </div>
  );
}
