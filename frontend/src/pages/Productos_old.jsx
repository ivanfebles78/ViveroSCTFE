import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  getProductos,
  createPedidoReposicion,
  updateProductoInterno,
  createProducto,
  updateProducto,
  deleteProducto,
  importarProductos,
} from "../api/api";

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

function GestionProductosModal({ open, productos, onClose, onChanged }) {
  const [tab, setTab] = useState("listado");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [nuevo, setNuevo] = useState({
    nombre_cientifico: "",
    nombre_natural: "",
    categoria: "",
    subcategoria: "",
    stock_minimo: 0,
    es_interno: false,
  });
  const [nuevoCategoriaSel, setNuevoCategoriaSel] = useState("");
  const [nuevoSubcategoriaSel, setNuevoSubcategoriaSel] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [file, setFile] = useState(null);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    if (!open) {
      setTab("listado");
      setSearch("");
      setEditingId(null);
      setEditForm({});
      setNuevo({
        nombre_cientifico: "",
        nombre_natural: "",
        categoria: "",
        subcategoria: "",
        stock_minimo: 0,
        es_interno: false,
      });
      setNuevoCategoriaSel("");
      setNuevoSubcategoriaSel("");
      setSaving(false);
      setMsg("");
      setErr("");
      setFile(null);
      setImportResult(null);
    }
  }, [open]);

  const showMsg = (text) => {
    setMsg(text);
    setErr("");
    setTimeout(() => setMsg(""), 3000);
  };
  const showErr = (text) => {
    setErr(text);
    setMsg("");
  };

  const productosFiltrados = useMemo(() => {
    const t = search.trim().toLowerCase();
    const base = Array.isArray(productos) ? productos : [];
    if (!t) return base;
    return base.filter((p) => {
      return (
        String(p.nombre_cientifico || "").toLowerCase().includes(t) ||
        String(p.nombre_natural || "").toLowerCase().includes(t) ||
        String(p.categoria || "").toLowerCase().includes(t) ||
        String(p.subcategoria || "").toLowerCase().includes(t)
      );
    });
  }, [productos, search]);

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditForm({
      nombre_cientifico: p.nombre_cientifico || "",
      nombre_natural: p.nombre_natural || "",
      categoria: p.categoria || "",
      subcategoria: p.subcategoria || "",
      stock_minimo: p.stock_minimo ?? 0,
      es_interno: !!p.es_interno,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await updateProducto(editingId, editForm);
      showMsg("Producto actualizado.");
      cancelEdit();
      onChanged && (await onChanged());
    } catch (e) {
      showErr(fmtErr(e));
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async (p) => {
    if (!window.confirm(`¿Eliminar el producto "${p.nombre_cientifico}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setSaving(true);
    try {
      await deleteProducto(p.id);
      showMsg("Producto eliminado.");
      onChanged && (await onChanged());
    } catch (e) {
      showErr(fmtErr(e));
    } finally {
      setSaving(false);
    }
  };

  const submitNuevo = async () => {
    if (!nuevo.nombre_cientifico.trim() || !nuevo.categoria.trim() || !nuevo.subcategoria.trim()) {
      showErr("Nombre científico, categoría y subcategoría son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      await createProducto({
        nombre_cientifico: nuevo.nombre_cientifico.trim(),
        nombre_natural: nuevo.nombre_natural.trim() || null,
        categoria: nuevo.categoria.trim(),
        subcategoria: nuevo.subcategoria.trim(),
        stock_minimo: Number(nuevo.stock_minimo) || 0,
        es_interno: !!nuevo.es_interno,
      });
      showMsg("Producto creado.");
      setNuevo({
        nombre_cientifico: "",
        nombre_natural: "",
        categoria: "",
        subcategoria: "",
        stock_minimo: 0,
        es_interno: false,
      });
      setNuevoCategoriaSel("");
      setNuevoSubcategoriaSel("");
      onChanged && (await onChanged());
    } catch (e) {
      showErr(fmtErr(e));
    } finally {
      setSaving(false);
    }
  };

  const submitImport = async () => {
    if (!file) {
      showErr("Selecciona un archivo CSV o Excel primero.");
      return;
    }
    setSaving(true);
    setImportResult(null);
    try {
      const res = await importarProductos(file);
      setImportResult(res);
      showMsg(`Importación completada: ${res.insertados} nuevos, ${res.actualizados} actualizados.`);
      onChanged && (await onChanged());
    } catch (e) {
      showErr(fmtErr(e));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const inputS = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(15,23,42,0.15)",
    fontWeight: 700,
    boxSizing: "border-box",
  };
  const tabBtnS = (active) => ({
    padding: "10px 16px",
    borderRadius: 10,
    border: active ? "1px solid rgba(6,182,212,0.35)" : "1px solid rgba(15,23,42,0.10)",
    background: active ? "linear-gradient(135deg, #0ea5e9 0%, #06b6d4 60%, #10b981 100%)" : "white",
    color: active ? "white" : "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.55)",
        zIndex: 1500,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 24,
        overflowY: "auto",
        overscrollBehavior: "contain",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 96vw)",
          background: "white",
          borderRadius: 20,
          boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
          display: "flex",
          flexDirection: "column",
          marginTop: "auto",
          marginBottom: "auto",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid rgba(15,23,42,0.08)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            gap: 16,
            position: "sticky",
            top: 0,
            background: "white",
            zIndex: 2,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Gestionar productos</div>
            <div style={{ marginTop: 4, color: "#64748b", fontWeight: 700, fontSize: 14 }}>
              Alta, baja, edición e importación masiva.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              fontWeight: 900,
              cursor: "pointer",
              background: "#f59e0b",
              color: "#111827",
              border: "2px solid #000",
            }}
          >
            Cerrar
          </button>
        </div>

        <div style={{ padding: "14px 22px", display: "flex", gap: 8, borderBottom: "1px solid rgba(15,23,42,0.05)" }}>
          <button onClick={() => setTab("listado")} style={tabBtnS(tab === "listado")}>Listado</button>
          <button onClick={() => setTab("nuevo")} style={tabBtnS(tab === "nuevo")}>Nuevo producto</button>
          <button onClick={() => setTab("importar")} style={tabBtnS(tab === "importar")}>Importar CSV/Excel</button>
        </div>

        {msg ? (
          <div style={{ margin: "12px 22px 0", padding: "10px 14px", borderRadius: 10, background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)", color: "#065f46", fontWeight: 800 }}>
            {msg}
          </div>
        ) : null}
        {err ? (
          <div style={{ margin: "12px 22px 0", padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#991b1b", fontWeight: 800 }}>
            {err}
          </div>
        ) : null}

        <div style={{ padding: 22 }}>
          {tab === "listado" && (
            <div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto..."
                style={{ ...inputS, marginBottom: 12 }}
              />

              <div style={{ overflowX: "auto", border: "1px solid rgba(15,23,42,0.08)", borderRadius: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      <th style={{ padding: 10, textAlign: "left", fontWeight: 900, fontSize: 12, color: "#334155" }}>Científico</th>
                      <th style={{ padding: 10, textAlign: "left", fontWeight: 900, fontSize: 12, color: "#334155" }}>Común</th>
                      <th style={{ padding: 10, textAlign: "left", fontWeight: 900, fontSize: 12, color: "#334155" }}>Categoría</th>
                      <th style={{ padding: 10, textAlign: "left", fontWeight: 900, fontSize: 12, color: "#334155" }}>Subcategoría</th>
                      <th style={{ padding: 10, textAlign: "center", fontWeight: 900, fontSize: 12, color: "#334155" }}>Stock min.</th>
                      <th style={{ padding: 10, textAlign: "center", fontWeight: 900, fontSize: 12, color: "#334155" }}>Interno</th>
                      <th style={{ padding: 10, textAlign: "center", fontWeight: 900, fontSize: 12, color: "#334155" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 16, textAlign: "center", color: "#64748b" }}>
                          No hay productos.
                        </td>
                      </tr>
                    ) : (
                      productosFiltrados.map((p) => {
                        const isEditing = editingId === p.id;
                        return (
                          <tr key={p.id} style={{ borderTop: "1px solid rgba(15,23,42,0.06)" }}>
                            {isEditing ? (
                              <>
                                <td style={{ padding: 6 }}>
                                  <input
                                    value={editForm.nombre_cientifico}
                                    onChange={(e) => setEditForm((f) => ({ ...f, nombre_cientifico: e.target.value }))}
                                    style={inputS}
                                  />
                                </td>
                                <td style={{ padding: 6 }}>
                                  <input
                                    value={editForm.nombre_natural || ""}
                                    onChange={(e) => setEditForm((f) => ({ ...f, nombre_natural: e.target.value }))}
                                    style={inputS}
                                  />
                                </td>
                                <td style={{ padding: 6 }}>
                                  <input
                                    value={editForm.categoria}
                                    onChange={(e) => setEditForm((f) => ({ ...f, categoria: e.target.value }))}
                                    style={inputS}
                                  />
                                </td>
                                <td style={{ padding: 6 }}>
                                  <input
                                    value={editForm.subcategoria}
                                    onChange={(e) => setEditForm((f) => ({ ...f, subcategoria: e.target.value }))}
                                    style={inputS}
                                  />
                                </td>
                                <td style={{ padding: 6 }}>
                                  <input
                                    type="number"
                                    min={0}
                                    value={editForm.stock_minimo}
                                    onChange={(e) => setEditForm((f) => ({ ...f, stock_minimo: e.target.value }))}
                                    style={{ ...inputS, textAlign: "center" }}
                                  />
                                </td>
                                <td style={{ padding: 6, textAlign: "center" }}>
                                  <input
                                    type="checkbox"
                                    checked={!!editForm.es_interno}
                                    onChange={(e) => setEditForm((f) => ({ ...f, es_interno: e.target.checked }))}
                                    style={{ width: 18, height: 18 }}
                                  />
                                </td>
                                <td style={{ padding: 6, textAlign: "center", whiteSpace: "nowrap" }}>
                                  <button onClick={saveEdit} disabled={saving} style={{ marginRight: 6, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.10)", color: "#065f46", fontWeight: 900, cursor: "pointer" }}>Guardar</button>
                                  <button onClick={cancelEdit} disabled={saving} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.10)", background: "white", fontWeight: 900, cursor: "pointer" }}>Cancelar</button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td style={{ padding: 10, fontWeight: 800 }}>{p.nombre_cientifico}</td>
                                <td style={{ padding: 10 }}>{p.nombre_natural || "—"}</td>
                                <td style={{ padding: 10 }}>{p.categoria}</td>
                                <td style={{ padding: 10 }}>{p.subcategoria}</td>
                                <td style={{ padding: 10, textAlign: "center", fontWeight: 800 }}>{p.stock_minimo ?? 0}</td>
                                <td style={{ padding: 10, textAlign: "center" }}>
                                  <span style={{ padding: "2px 8px", borderRadius: 999, background: p.es_interno ? "rgba(245,158,11,0.15)" : "rgba(148,163,184,0.15)", color: p.es_interno ? "#92400e" : "#475569", fontWeight: 900, fontSize: 12 }}>
                                    {p.es_interno ? "Sí" : "No"}
                                  </span>
                                </td>
                                <td style={{ padding: 10, textAlign: "center", whiteSpace: "nowrap" }}>
                                  <button onClick={() => startEdit(p)} disabled={saving} style={{ marginRight: 6, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(59,130,246,0.3)", background: "rgba(59,130,246,0.08)", color: "#1d4ed8", fontWeight: 900, cursor: "pointer" }}>Editar</button>
                                  <button onClick={() => removeProduct(p)} disabled={saving} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#991b1b", fontWeight: 900, cursor: "pointer" }}>Eliminar</button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "nuevo" && (() => {
            const categoriasExistentes = [
              ...new Set(
                (Array.isArray(productos) ? productos : [])
                  .map((p) => String(p?.categoria || "").trim())
                  .filter(Boolean)
              ),
            ].sort((a, b) => a.localeCompare(b, "es"));

            const subcategoriasParaCategoria = [
              ...new Set(
                (Array.isArray(productos) ? productos : [])
                  .filter((p) => !nuevoCategoriaSel || String(p?.categoria || "").trim() === nuevoCategoriaSel)
                  .map((p) => String(p?.subcategoria || "").trim())
                  .filter(Boolean)
              ),
            ].sort((a, b) => a.localeCompare(b, "es"));

            return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Nombre científico *</div>
                <input value={nuevo.nombre_cientifico} onChange={(e) => setNuevo((n) => ({ ...n, nombre_cientifico: e.target.value }))} style={inputS} placeholder="Ej: Phoenix canariensis" />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Nombre común</div>
                <input value={nuevo.nombre_natural} onChange={(e) => setNuevo((n) => ({ ...n, nombre_natural: e.target.value }))} style={inputS} placeholder="Ej: Palmera canaria" />
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Categoría *</div>
                <select
                  value={nuevoCategoriaSel}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNuevoCategoriaSel(v);
                    setNuevoSubcategoriaSel(""); // reset subcat al cambiar cat
                    setNuevo((n) => ({
                      ...n,
                      categoria: v === "__NUEVA__" ? "" : v,
                      subcategoria: "",
                    }));
                  }}
                  style={inputS}
                >
                  <option value="">Seleccionar categoría</option>
                  {categoriasExistentes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__NUEVA__">＋ Nueva categoría</option>
                </select>
                {nuevoCategoriaSel === "__NUEVA__" ? (
                  <input
                    autoFocus
                    value={nuevo.categoria}
                    onChange={(e) => setNuevo((n) => ({ ...n, categoria: e.target.value }))}
                    placeholder="Escribe el nombre de la nueva categoría"
                    style={{ ...inputS, marginTop: 6 }}
                  />
                ) : null}
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Subcategoría *</div>
                <select
                  value={nuevoSubcategoriaSel}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNuevoSubcategoriaSel(v);
                    setNuevo((n) => ({ ...n, subcategoria: v === "__NUEVA__" ? "" : v }));
                  }}
                  style={inputS}
                  disabled={!nuevoCategoriaSel}
                >
                  <option value="">
                    {nuevoCategoriaSel ? "Seleccionar subcategoría" : "Primero elige categoría"}
                  </option>
                  {subcategoriasParaCategoria.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  <option value="__NUEVA__">＋ Nueva subcategoría</option>
                </select>
                {nuevoSubcategoriaSel === "__NUEVA__" ? (
                  <input
                    autoFocus
                    value={nuevo.subcategoria}
                    onChange={(e) => setNuevo((n) => ({ ...n, subcategoria: e.target.value }))}
                    placeholder="Escribe el nombre de la nueva subcategoría"
                    style={{ ...inputS, marginTop: 6 }}
                  />
                ) : null}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>Stock mínimo</div>
                <input type="number" min={0} value={nuevo.stock_minimo} onChange={(e) => setNuevo((n) => ({ ...n, stock_minimo: e.target.value }))} style={inputS} />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(15,23,42,0.10)", background: nuevo.es_interno ? "rgba(245,158,11,0.08)" : "white", fontWeight: 800, color: "#0f172a", cursor: "pointer", marginTop: 22 }}>
                <input type="checkbox" checked={nuevo.es_interno} onChange={(e) => setNuevo((n) => ({ ...n, es_interno: e.target.checked }))} style={{ width: 18, height: 18 }} />
                Producto interno (oculto a empresa externa)
              </label>

              <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button onClick={submitNuevo} disabled={saving} style={{ padding: "12px 18px", borderRadius: 12, border: "1px solid rgba(16,185,129,0.3)", background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)", color: "white", fontWeight: 900, cursor: "pointer", opacity: saving ? 0.75 : 1 }}>
                  {saving ? "Creando..." : "Crear producto"}
                </button>
              </div>
            </div>
            );
          })()}

          {tab === "importar" && (
            <div>
              <div style={{ padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.08)", marginBottom: 14 }}>
                <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>Formato del archivo</div>
                <div style={{ color: "#475569", fontWeight: 700, fontSize: 14, lineHeight: 1.5 }}>
                  CSV o Excel (.xlsx). Columnas (no importa mayúsculas, acentos o guiones bajos):
                  <ul style={{ margin: "6px 0 0 18px" }}>
                    <li><b>nombre_cientifico</b> (obligatorio)</li>
                    <li>nombre_natural / nombre común</li>
                    <li><b>categoria</b> (obligatorio)</li>
                    <li><b>subcategoria</b> (obligatorio)</li>
                    <li>stock_minimo (opcional, entero ≥ 0)</li>
                    <li>es_interno (opcional, true / false)</li>
                  </ul>
                  <div style={{ marginTop: 6 }}>
                    Los productos existentes con el mismo nombre científico se <b>actualizan</b>. Los nuevos se insertan.
                  </div>
                </div>
              </div>

              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setImportResult(null);
                }}
                style={{ marginBottom: 12 }}
              />

              <div>
                <button onClick={submitImport} disabled={saving || !file} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid rgba(16,185,129,0.3)", background: saving || !file ? "rgba(148,163,184,0.25)" : "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)", color: "white", fontWeight: 900, cursor: saving || !file ? "not-allowed" : "pointer" }}>
                  {saving ? "Importando..." : "Importar"}
                </button>
              </div>

              {importResult ? (
                <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
                  <div style={{ fontWeight: 900, color: "#065f46", marginBottom: 6 }}>Resultado de la importación</div>
                  <div style={{ color: "#0f172a", fontWeight: 800 }}>Insertados: {importResult.insertados}</div>
                  <div style={{ color: "#0f172a", fontWeight: 800 }}>Actualizados: {importResult.actualizados}</div>
                  <div style={{ color: "#0f172a", fontWeight: 800 }}>Saltados: {importResult.saltados}</div>
                  {importResult.errores?.length > 0 ? (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 900, color: "#991b1b" }}>Errores:</div>
                      <ul style={{ margin: "4px 0 0 18px", color: "#991b1b" }}>
                        {importResult.errores.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
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
  const [gestionOpen, setGestionOpen] = useState(false);

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
  const puedeGestionar = rol === "admin" || rol === "manager";

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginTop: 0, marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Productos</h1>
        {puedeGestionar ? (
          <button
            onClick={() => setGestionOpen(true)}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid rgba(6,182,212,0.30)",
              background: "linear-gradient(135deg, #0ea5e9 0%, #06b6d4 60%, #10b981 100%)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 12px 28px rgba(6,182,212,0.18)",
            }}
          >
            Gestionar productos
          </button>
        ) : null}
      </div>

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

      <GestionProductosModal
        open={gestionOpen}
        productos={productos}
        onClose={() => setGestionOpen(false)}
        onChanged={load}
      />
    </div>
  );
}
