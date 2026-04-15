import React, { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  getPedidos,
  getProductos,
  getMovimientos,
  createPedido,
  updatePedido,
  cancelarPedido,
} from "../api/api";

const TAMANOS = ["semillero", "M12", "M20", "M30"];
const ZONAS = [
  "1",
  "2",
  "3a",
  "3b",
  "3c",
  "4a",
  "4b",
  "4c",
  "5",
  "6",
  "7",
  "8",
  "9a",
  "9b",
  "9c",
  "10a",
  "10b",
  "11",
];
const ORIGENES = ["Proveedor", "Vivero", "Palmetum"];
const DESTINOS = ["Vivero", "Externo", "Baja Vivero", "Palmetum"];
const ESTADO_FILTERS = [
  { value: "TODOS", label: "Todos" },
  { value: "RESERVA", label: "Reserva" },
  { value: "APROBADO", label: "Aprobado" },
  { value: "SERVIDO", label: "Servido" },
  { value: "DENEGADO", label: "Denegado" },
  { value: "CANCELADO", label: "Cancelado" },
  { value: "CADUCADO", label: "Caducado" },
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

const estadoNormalizado = (estado) => String(estado || "").trim().toUpperCase();

const badge = (estado) => {
  const e = estadoNormalizado(estado);
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid rgba(15,23,42,0.08)",
    minWidth: 108,
  };

  if (e === "APROBADO") return { ...base, background: "rgba(16,185,129,0.12)", color: "#065f46" };
  if (e === "DENEGADO") return { ...base, background: "rgba(239,68,68,0.10)", color: "#991b1b" };
  if (e === "SERVIDO") return { ...base, background: "rgba(59,130,246,0.10)", color: "#1e3a8a" };
  if (e === "CANCELADO") return { ...base, background: "rgba(148,163,184,0.20)", color: "#334155" };
  if (e === "CADUCADO") return { ...base, background: "rgba(100,116,139,0.18)", color: "#475569" };
  return { ...base, background: "rgba(245,158,11,0.12)", color: "#92400e" };
};

function lineKey(productoId, tamano) {
  return `${productoId}__${tamano}`;
}

function parseLineKey(key) {
  const [producto_id, tamano] = String(key).split("__");
  return { producto_id: Number(producto_id), tamano: tamano || "M12" };
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

function actionBtn(enabled) {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(15,23,42,0.10)",
    background: enabled ? "white" : "rgba(148,163,184,0.15)",
    color: enabled ? "#0f172a" : "#64748b",
    fontWeight: 900,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}

function dangerBtn(enabled) {
  return {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(239,68,68,0.25)",
    background: enabled ? "rgba(239,68,68,0.08)" : "rgba(148,163,184,0.15)",
    color: enabled ? "#991b1b" : "#64748b",
    fontWeight: 900,
    cursor: enabled ? "pointer" : "not-allowed",
  };
}

function buildStockByProductSize(movimientos) {
  const map = new Map();

  const add = (productoId, tamano, delta) => {
    if (!productoId || !tamano) return;
    const key = lineKey(productoId, tamano);
    map.set(key, (map.get(key) || 0) + delta);
  };

  for (const m of safeArray(movimientos)) {
    const productoId = m?.producto_id;
    const origenTipo = String(m?.origen_tipo || "").trim().toLowerCase();
    const destinoTipo = String(m?.destino_tipo || "").trim().toLowerCase();
    const cantidad = Number(m?.cantidad || 0);

    if (!productoId || !cantidad) continue;

    if (destinoTipo === "vivero" && m?.tamano_destino) {
      add(productoId, m.tamano_destino, cantidad);
    }

    if (origenTipo === "vivero" && m?.tamano_origen) {
      add(productoId, m.tamano_origen, -cantidad);
    }
  }

  return map;
}

function PedidoModal({
  open,
  onClose,
  productos,
  stockByProductSize,
  onSubmit,
  saving,
}) {
  const [search, setSearch] = useState("");
  const [categoriaSel, setCategoriaSel] = useState("ALL");
  const [subcategoriaSel, setSubcategoriaSel] = useState("ALL");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [qtyInput, setQtyInput] = useState({});
  const [cart, setCart] = useState({});
  const [localError, setLocalError] = useState("");
  const [origenTipo, setOrigenTipo] = useState("");
  const [destinoTipo, setDestinoTipo] = useState("");
  const [zonaOrigen, setZonaOrigen] = useState("");
  const [zonaDestino, setZonaDestino] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
      setCategoriaSel("ALL");
      setSubcategoriaSel("ALL");
      setSelectedProductId("");
      setQtyInput({});
      setCart({});
      setLocalError("");
      setOrigenTipo("");
      setDestinoTipo("");
      setZonaOrigen("");
      setZonaDestino("");
    }
  }, [open]);

  const productosConStock = useMemo(() => {
    return safeArray(productos).filter((p) =>
      TAMANOS.some((t) => (stockByProductSize.get(lineKey(p.id, t)) || 0) > 0)
    );
  }, [productos, stockByProductSize]);

  const categorias = useMemo(() => {
    const set = new Set();
    productosConStock.forEach((p) => {
      const c = String(p?.categoria || "").trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [productosConStock]);

  const subcategorias = useMemo(() => {
    const set = new Set();
    productosConStock.forEach((p) => {
      const c = String(p?.categoria || "").trim();
      const s = String(p?.subcategoria || "").trim();
      if (!s) return;
      if (categoriaSel === "ALL" || c === categoriaSel) set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [productosConStock, categoriaSel]);

  useEffect(() => {
    setSubcategoriaSel("ALL");
  }, [categoriaSel]);

  const productosDisponibles = useMemo(() => {
    const texto = search.trim().toLowerCase();

    return productosConStock
      .filter((p) => {
        const categoriaRaw = String(p?.categoria || "").trim();
        const subcategoriaRaw = String(p?.subcategoria || "").trim();
        const okCat = categoriaSel === "ALL" || categoriaRaw === categoriaSel;
        const okSub = subcategoriaSel === "ALL" || subcategoriaRaw === subcategoriaSel;
        if (!okCat || !okSub) return false;

        if (!texto) return true;

        const nombre = String(p?.nombre_cientifico || p?.nombre || "").toLowerCase();
        const categoria = categoriaRaw.toLowerCase();
        const subcategoria = subcategoriaRaw.toLowerCase();

        return nombre.includes(texto) || categoria.includes(texto) || subcategoria.includes(texto);
      })
      .sort((a, b) =>
        String(a?.nombre_cientifico || "").localeCompare(String(b?.nombre_cientifico || ""))
      );
  }, [productosConStock, search, categoriaSel, subcategoriaSel]);

  const productosVisibles = useMemo(
    () => productosDisponibles.slice(0, 10),
    [productosDisponibles]
  );

  const selectedProduct = useMemo(
    () => productosDisponibles.find((p) => String(p.id) === String(selectedProductId)) || null,
    [productosDisponibles, selectedProductId]
  );

  const selectedProductSizes = useMemo(() => {
    if (!selectedProduct) return [];
    return TAMANOS.map((tamano) => {
      const key = lineKey(selectedProduct.id, tamano);
      const disponible = Math.max(0, Number(stockByProductSize.get(key) || 0));
      const enCesta = Number(cart[key] || 0);
      return {
        tamano,
        disponible,
        enCesta,
        restante: Math.max(0, disponible - enCesta),
      };
    }).filter((x) => x.disponible > 0);
  }, [selectedProduct, stockByProductSize, cart]);

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([key, cantidad]) => {
        const parsed = parseLineKey(key);
        const prod = productos.find((p) => p.id === parsed.producto_id);
        const disponible = Math.max(0, Number(stockByProductSize.get(key) || 0));
        return {
          key,
          producto_id: parsed.producto_id,
          tamano: parsed.tamano,
          cantidad: Number(cantidad),
          nombre: prod?.nombre_cientifico || prod?.nombre || `ID ${parsed.producto_id}`,
          disponible,
        };
      })
      .filter((x) => x.cantidad > 0);
  }, [cart, productos, stockByProductSize]);

  const totalItems = cartLines.reduce((acc, x) => acc + x.cantidad, 0);

  const addToCart = (productoId, tamano) => {
    setLocalError("");
    const key = lineKey(productoId, tamano);
    const raw = qtyInput[key];
    const qty = Number(raw);

    const disponible = Math.max(0, Number(stockByProductSize.get(key) || 0));
    const yaEnCesta = Number(cart[key] || 0);
    const restante = disponible - yaEnCesta;

    if (!qty || qty <= 0) {
      setLocalError("Indica una cantidad válida mayor que 0.");
      return;
    }

    if (qty > restante) {
      setLocalError(`No puedes añadir ${qty}. Disponible restante para ${tamano}: ${restante}.`);
      return;
    }

    setCart((prev) => ({
      ...prev,
      [key]: (prev[key] || 0) + qty,
    }));

    setQtyInput((prev) => ({
      ...prev,
      [key]: "",
    }));
  };

  const updateCartLine = (key, nextQty) => {
    const qty = Number(nextQty);
    const disponible = Math.max(0, Number(stockByProductSize.get(key) || 0));

    if (!qty || qty <= 0) {
      setCart((prev) => {
        const clone = { ...prev };
        delete clone[key];
        return clone;
      });
      return;
    }

    setCart((prev) => ({
      ...prev,
      [key]: Math.min(qty, disponible),
    }));
  };

  const submitPedido = async () => {
    setLocalError("");

    const items = cartLines.map((x) => ({
      producto_id: x.producto_id,
      tamano: x.tamano,
      cantidad: x.cantidad,
    }));

    if (!items.length) {
      setLocalError("Añade al menos un producto a la cesta.");
      return;
    }

    const payload = { items };
    if (origenTipo) payload.origen_tipo = origenTipo;
    if (destinoTipo) payload.destino_tipo = destinoTipo;
    if (origenTipo === "Vivero" && zonaOrigen) payload.zona_origen = zonaOrigen;
    if (destinoTipo === "Vivero" && zonaDestino) payload.zona_destino = zonaDestino;

    await onSubmit(payload);
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(1680px, 97vw)",
          height: "min(900px, 92vh)",
          background: "white",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(2,6,23,0.35)",
          display: "grid",
          gridTemplateColumns: "0.95fr 1fr 0.85fr",
        }}
      >
        <div style={{ padding: 22, borderRight: "1px solid rgba(15,23,42,0.08)", overflow: "auto" }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Nuevo pedido</div>
          <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
            Busca y selecciona un producto con stock disponible.
          </div>

          <input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,0.12)",
              fontWeight: 700,
            }}
          />

          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <select
              value={categoriaSel}
              onChange={(e) => setCategoriaSel(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.12)",
                fontWeight: 700,
              }}
            >
              <option value="ALL">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={subcategoriaSel}
              onChange={(e) => setSubcategoriaSel(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(15,23,42,0.12)",
                fontWeight: 700,
              }}
            >
              <option value="ALL">Todas las subcategorías</option>
              {subcategorias.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: "#64748b", fontWeight: 800 }}>
            Mostrando {productosVisibles.length} de {productosDisponibles.length} disponibles
          </div>

          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflow: "auto" }}>
            {productosDisponibles.length === 0 ? (
              <div style={{ color: "#64748b", fontWeight: 700 }}>No hay productos disponibles para esa búsqueda.</div>
            ) : (
              productosVisibles.map((p) => {
                const active = String(selectedProductId) === String(p.id);
                const total = TAMANOS.reduce(
                  (acc, t) => acc + Math.max(0, Number(stockByProductSize.get(lineKey(p.id, t)) || 0)),
                  0
                );

                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProductId(String(p.id))}
                    style={{
                      textAlign: "left",
                      padding: 14,
                      borderRadius: 16,
                      border: active
                        ? "1px solid rgba(6,182,212,0.35)"
                        : "1px solid rgba(15,23,42,0.08)",
                      background: active ? "rgba(6,182,212,0.10)" : "white",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 900, color: "#0f172a" }}>
                      {p.nombre_cientifico || p.nombre || `ID ${p.id}`}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                      {(p.categoria || "—") + (p.subcategoria ? ` · ${p.subcategoria}` : "")}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#0f172a", fontWeight: 900 }}>
                      Stock total disponible: {total}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div style={{ padding: 22, borderRight: "1px solid rgba(15,23,42,0.08)", overflow: "auto" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
            {selectedProduct
              ? selectedProduct.nombre_cientifico || selectedProduct.nombre || "Producto"
              : "Selecciona un producto"}
          </div>

          {!selectedProduct ? (
            <div style={{ marginTop: 12, color: "#64748b", fontWeight: 700 }}>
              Selecciona un producto a la izquierda para ver tamaños y unidades disponibles.
            </div>
          ) : (
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 140px 140px 140px",
                  gap: 10,
                  padding: "10px 12px",
                  background: "#f8fafc",
                  borderRadius: 14,
                  border: "1px solid rgba(15,23,42,0.08)",
                  fontWeight: 900,
                  color: "#334155",
                }}
              >
                <div>Tamaño</div>
                <div style={{ textAlign: "center" }}>Disponible</div>
                <div style={{ textAlign: "center" }}>Cantidad</div>
                <div style={{ textAlign: "center" }}>Acción</div>
              </div>

              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                {selectedProductSizes.length === 0 ? (
                  <div style={{ color: "#64748b", fontWeight: 700 }}>
                    Este producto no tiene stock por tamaño disponible.
                  </div>
                ) : (
                  selectedProductSizes.map((row) => {
                    const key = lineKey(selectedProduct.id, row.tamano);
                    return (
                      <div
                        key={key}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "120px 140px 140px 140px",
                          gap: 10,
                          alignItems: "center",
                          padding: "12px",
                          borderRadius: 14,
                          border: "1px solid rgba(15,23,42,0.08)",
                          background: "rgba(248,250,252,0.60)",
                        }}
                      >
                        <div style={{ fontWeight: 900, color: "#0f172a" }}>{row.tamano}</div>

                        <div style={{ textAlign: "center", fontWeight: 900, color: "#0f172a" }}>
                          {row.restante}
                        </div>

                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <input
                            type="number"
                            min={0}
                            value={qtyInput[key] ?? ""}
                            onChange={(e) =>
                              setQtyInput((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                            placeholder="0"
                            style={{
                              width: 90,
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid rgba(15,23,42,0.12)",
                              textAlign: "center",
                              fontWeight: 900,
                            }}
                          />
                        </div>

                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <button
                            onClick={() => addToCart(selectedProduct.id, row.tamano)}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 10,
                              border: "1px solid rgba(16,185,129,0.30)",
                              background: "rgba(16,185,129,0.10)",
                              color: "#065f46",
                              fontWeight: 900,
                              cursor: "pointer",
                            }}
                          >
                            Añadir
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: 22, overflow: "auto", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(15,23,42,0.08)",
              background: "rgba(248,250,252,0.7)",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>Origen y destino</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <select
                value={origenTipo}
                onChange={(e) => setOrigenTipo(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.12)",
                  fontWeight: 700,
                }}
              >
                <option value="">Origen</option>
                {ORIGENES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>

              {origenTipo === "Vivero" ? (
                <select
                  value={zonaOrigen}
                  onChange={(e) => setZonaOrigen(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.12)",
                    fontWeight: 700,
                  }}
                >
                  <option value="">Zona origen</option>
                  {ZONAS.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              ) : null}

              <select
                value={destinoTipo}
                onChange={(e) => setDestinoTipo(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.12)",
                  fontWeight: 700,
                }}
              >
                <option value="">Destino</option>
                {DESTINOS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              {destinoTipo === "Vivero" ? (
                <select
                  value={zonaDestino}
                  onChange={(e) => setZonaDestino(e.target.value)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(15,23,42,0.12)",
                    fontWeight: 700,
                  }}
                >
                  <option value="">Zona destino</option>
                  {ZONAS.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>

          <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginTop: 14 }}>Cesta</div>
          <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
            {cartLines.length} líneas · {totalItems} unidades
          </div>

          {localError ? (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 14,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.18)",
                color: "#991b1b",
                fontWeight: 800,
              }}
            >
              {localError}
            </div>
          ) : null}

          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
            {cartLines.length === 0 ? (
              <div style={{ color: "#64748b", fontWeight: 700 }}>
                Todavía no has añadido productos al pedido.
              </div>
            ) : (
              cartLines.map((line) => (
                <div
                  key={line.key}
                  style={{
                    border: "1px solid rgba(15,23,42,0.08)",
                    borderRadius: 16,
                    padding: 12,
                    background: "rgba(248,250,252,0.65)",
                  }}
                >
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>{line.nombre}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                    Tamaño: {line.tamano} · Disponible total: {line.disponible}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="number"
                      min={0}
                      max={line.disponible}
                      value={line.cantidad}
                      onChange={(e) => updateCartLine(line.key, e.target.value)}
                      style={{
                        width: 90,
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(15,23,42,0.12)",
                        textAlign: "center",
                        fontWeight: 900,
                      }}
                    />
                    <button
                      onClick={() => updateCartLine(line.key, 0)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(239,68,68,0.20)",
                        background: "rgba(239,68,68,0.08)",
                        color: "#991b1b",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
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
              Cerrar
            </button>

            <button
              onClick={submitPedido}
              disabled={saving}
              style={{
                marginLeft: "auto",
                padding: "10px 14px",
                borderRadius: 14,
                border: "1px solid rgba(16,185,129,0.35)",
                background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              {saving ? "Creando..." : "Confirmar pedido"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PedidoDetalleCell({
  pedido,
  mapProdName,
  expanded,
  toggleExpanded,
  editingId,
  editQty,
  setEditQty,
  editSearch,
  setEditSearch,
  productosDisponiblesParaEdicion,
}) {
  const items = safeArray(pedido.items);

  if (editingId !== pedido.id) {
    const visibleItems = expanded ? items : items.slice(0, 3);
    const hiddenCount = Math.max(0, items.length - visibleItems.length);

    return (
      <div>
        {items.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleItems.map((it, idx) => {
              const pid = it.producto_id;
              const nombre =
                mapProdName.get(pid) ||
                it.nombre_cientifico ||
                it.nombre ||
                `ID ${pid}`;
              return (
                <div
                  key={`${pedido.id}-${idx}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 90px 80px",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{nombre}</div>
                  <div style={{ textAlign: "center", fontWeight: 900, color: "#334155" }}>
                    {it.tamano || "—"}
                  </div>
                  <div style={{ textAlign: "right", fontWeight: 900, color: "#0f172a" }}>
                    {it.cantidad ?? 0}
                  </div>
                </div>
              );
            })}

            {items.length > 3 ? (
              <button
                onClick={() => toggleExpanded(pedido.id)}
                style={{
                  alignSelf: "flex-start",
                  marginTop: 4,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(15,23,42,0.10)",
                  background: "white",
                  color: "#0f172a",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                {expanded ? "Ver menos" : `+ ver ${hiddenCount} más`}
              </button>
            ) : null}
          </div>
        ) : (
          <span style={{ color: "#64748b", fontWeight: 700 }}>Sin detalle</span>
        )}
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Object.entries(editQty).map(([key, cantidad]) => {
          const parsed = parseLineKey(key);
          return (
            <div
              key={`${pedido.id}-${key}`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 90px",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 800, color: "#0f172a" }}>
                {mapProdName.get(parsed.producto_id) || `ID ${parsed.producto_id}`}
              </div>
              <div style={{ textAlign: "center", fontWeight: 900, color: "#334155" }}>
                {parsed.tamano}
              </div>
              <input
                type="number"
                min={0}
                value={cantidad}
                onChange={(e) =>
                  setEditQty((prev) => ({
                    ...prev,
                    [key]: Number(e.target.value),
                  }))
                }
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(15,23,42,0.12)",
                  textAlign: "center",
                  fontWeight: 900,
                }}
              />
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <input
          type="text"
          placeholder="Buscar productos para añadir..."
          value={editSearch}
          onChange={(e) => setEditSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(15,23,42,0.12)",
            marginBottom: 10,
          }}
        />

        <div
          style={{
            maxHeight: 180,
            overflow: "auto",
            border: "1px solid rgba(15,23,42,0.08)",
            borderRadius: 12,
          }}
        >
          {productosDisponiblesParaEdicion.length === 0 ? (
            <div style={{ padding: 12, color: "#64748b", fontWeight: 700 }}>
              No hay más productos que coincidan.
            </div>
          ) : (
            productosDisponiblesParaEdicion.flatMap((prod) =>
              TAMANOS.map((tam) => {
                const key = lineKey(prod.id, tam);
                const disponible = Number(prod._stockBySize?.[tam] || 0);
                if (editQty[key] != null || disponible <= 0) return null;

                return (
                  <div
                    key={key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 90px auto",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderTop: "1px solid rgba(15,23,42,0.06)",
                    }}
                  >
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>
                      {prod.nombre_cientifico || prod.nombre}
                    </div>
                    <div style={{ textAlign: "center", fontWeight: 900, color: "#334155" }}>
                      {tam}
                    </div>
                    <div style={{ textAlign: "center", fontWeight: 900, color: "#0f172a" }}>
                      {disponible}
                    </div>
                    <button
                      onClick={() =>
                        setEditQty((prev) => ({
                          ...prev,
                          [key]: 1,
                        }))
                      }
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid rgba(16,185,129,0.30)",
                        background: "rgba(16,185,129,0.10)",
                        color: "#065f46",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Añadir
                    </button>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    </>
  );
}

export default function Pedidos() {
  const { me } = useOutletContext();

  const role = me?.rol || me?.role;
  const isReadOnly = role === "tecnico";
  const isAdmin = role === "admin";

  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingNewPedido, setSavingNewPedido] = useState(false);
  const [msg, setMsg] = useState("");

  const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
  const [idFiltro, setIdFiltro] = useState("");
  const [fechaFiltro, setFechaFiltro] = useState("");
  const [solicitanteFiltro, setSolicitanteFiltro] = useState("");
  const [textoFiltro, setTextoFiltro] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editQty, setEditQty] = useState({});
  const [editSearch, setEditSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

  const solicitanteFromPedido = (p) =>
    p?.solicitante_username || p?.solicitante || p?.created_by || p?.usuario || p?.username || "—";

  const refrescar = async () => {
    setLoading(true);
    setMsg("");
    try {
      const [prods, movs, peds] = await Promise.all([
        getProductos(),
        getMovimientos(),
        getPedidos(),
      ]);
      setProductos(safeArray(prods));
      setMovimientos(safeArray(movs));
      setPedidos(safeArray(peds));
    } catch (e) {
      setMsg(e?.response?.data?.detail || e?.message || "Error cargando pedidos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refrescar();
  }, []);

  const stockByProductSize = useMemo(() => buildStockByProductSize(movimientos), [movimientos]);

  const productosConStock = useMemo(() => {
    return productos
      .map((p) => {
        const stockBySize = {};
        TAMANOS.forEach((t) => {
          stockBySize[t] = Math.max(0, Number(stockByProductSize.get(lineKey(p.id, t)) || 0));
        });
        return { ...p, _stockBySize: stockBySize };
      })
      .filter((p) => TAMANOS.some((t) => Number(p._stockBySize[t] || 0) > 0));
  }, [productos, stockByProductSize]);

  const mapProdName = useMemo(() => {
    const m = new Map();
    for (const p of productos) {
      m.set(p.id, p.nombre_cientifico || p.nombre || p.nombre_comun || `ID ${p.id}`);
    }
    return m;
  }, [productos]);

  const handleCreatePedidoFromModal = async ({ items }) => {
    setMsg("");
    setSavingNewPedido(true);
    try {
      await createPedido({ items });
      setModalOpen(false);
      await refrescar();
      setMsg("Pedido creado correctamente.");
    } catch (e) {
      setMsg(e?.response?.data?.detail || e?.message || "Error creando pedido");
    } finally {
      setSavingNewPedido(false);
    }
  };

  const puedeEditarCancelar = (p) => {
    const estado = estadoNormalizado(p?.estado);

    if (
      estado === "APROBADO" ||
      estado === "DENEGADO" ||
      estado === "SERVIDO" ||
      estado === "CANCELADO" ||
      estado === "CADUCADO"
    ) {
      return false;
    }

    if (isReadOnly) return false;
    if (isAdmin) return estado === "RESERVA";

    const solicitante = solicitanteFromPedido(p);
    const soyYo = solicitante && me?.username && solicitante === me.username;
    return role === "proveedor" && estado === "RESERVA" && soyYo;
  };

  const onCancelar = async (p) => {
    try {
      await cancelarPedido(p.id);
      await refrescar();
      setMsg("Pedido cancelado.");
    } catch (e) {
      setMsg(e?.response?.data?.detail || e?.message || "Error cancelando pedido");
    }
  };

  const startEdit = (p) => {
    const items = safeArray(p.items);
    const map = {};
    items.forEach((it) => {
      const pid = it.producto_id;
      const tam = it.tamano || "M12";
      const cantidad = Number(it.cantidad ?? 0);
      if (pid) map[lineKey(pid, tam)] = cantidad;
    });
    setEditQty(map);
    setEditSearch("");
    setEditingId(p.id);
    setMsg("");
  };

  const stopEdit = () => {
    setEditingId(null);
    setEditQty({});
    setEditSearch("");
  };

  const onGuardarEdicion = async (pedidoId) => {
    try {
      const items = Object.entries(editQty)
        .map(([key, cantidad]) => {
          const parsed = parseLineKey(key);
          return {
            producto_id: parsed.producto_id,
            tamano: parsed.tamano,
            cantidad: Number(cantidad),
          };
        })
        .filter((x) => x.cantidad > 0 && Number.isFinite(x.producto_id) && x.tamano);

      if (!items.length) {
        setMsg("El pedido debe tener al menos 1 línea.");
        return;
      }

      await updatePedido(pedidoId, { items });
      stopEdit();
      await refrescar();
      setMsg("Pedido actualizado correctamente.");
    } catch (e) {
      setMsg(e?.response?.data?.detail || e?.message || "Error actualizando pedido");
    }
  };

  const productosDisponiblesParaEdicion = useMemo(() => {
    const texto = editSearch.trim().toLowerCase();
    return productosConStock.filter((p) => {
      const nombre = (p.nombre_cientifico || p.nombre || "").toLowerCase();
      const categoria = (p.categoria || "").toLowerCase();
      const subcategoria = (p.subcategoria || "").toLowerCase();
      return !texto || nombre.includes(texto) || categoria.includes(texto) || subcategoria.includes(texto);
    });
  }, [productosConStock, editSearch]);

  const pedidosFiltrados = useMemo(() => {
    const texto = textoFiltro.trim().toLowerCase();

    return pedidos
      .slice()
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .filter((p) => {
        const idOk = !idFiltro || String(p.id).includes(String(idFiltro).trim());
        const estadoOk = estadoFiltro === "TODOS" || estadoNormalizado(p?.estado) === estadoFiltro;
        const fechaOk = !fechaFiltro || dateInputValue(p?.created_at) === fechaFiltro;

        const solicitante = solicitanteFromPedido(p).toLowerCase();
        const solicitanteOk =
          !solicitanteFiltro || solicitante.includes(solicitanteFiltro.trim().toLowerCase());

        const detalle = safeArray(p.items)
          .map((it) => {
            const nombre =
              mapProdName.get(it.producto_id) ||
              it.nombre_cientifico ||
              it.nombre ||
              `producto ${it.producto_id}`;
            return `${nombre} ${it.tamano || ""} ${it.cantidad || ""}`.toLowerCase();
          })
          .join(" ");

        const textoOk =
          !texto ||
          String(p.id).toLowerCase().includes(texto) ||
          solicitante.includes(texto) ||
          estadoNormalizado(p?.estado).toLowerCase().includes(texto) ||
          detalle.includes(texto);

        return idOk && estadoOk && fechaOk && solicitanteOk && textoOk;
      });
  }, [pedidos, estadoFiltro, idFiltro, fechaFiltro, solicitanteFiltro, textoFiltro, mapProdName]);

  const toggleExpanded = (pedidoId) => {
    setExpandedRows((prev) => ({
      ...prev,
      [pedidoId]: !prev[pedidoId],
    }));
  };

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <h1 style={{ fontSize: 44, margin: 0, fontWeight: 900, color: "#0f172a" }}>Pedidos</h1>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!isReadOnly && (
            <button
              onClick={() => setModalOpen(true)}
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
              Nuevo pedido
            </button>
          )}
          <div style={{ fontWeight: 800, color: "#64748b" }}>
            Usuario: <span style={{ color: "#0f172a" }}>{me?.username || "—"}</span> · Rol:{" "}
            <span style={{ color: "#0f172a" }}>{role || "—"}</span>
          </div>
        </div>
      </div>

      {msg ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            border: "1px solid rgba(239,68,68,0.25)",
            background: "rgba(239,68,68,0.08)",
            color: "#991b1b",
            fontWeight: 800,
          }}
        >
          {msg}
        </div>
      ) : null}

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
          Lista de pedidos
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "140px 170px 180px 170px 1fr",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <input
            placeholder="Filtrar por ID"
            value={idFiltro}
            onChange={(e) => setIdFiltro(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "2px solid #334155",
              background: "#f8fafc",
              fontWeight: 700,
              color: "#0f172a",
            }}
          />

          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "2px solid #334155",
              background: "#f8fafc",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            {ESTADO_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={fechaFiltro}
            onChange={(e) => setFechaFiltro(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "2px solid #334155",
              background: "#f8fafc",
              fontWeight: 700,
              color: "#0f172a",
            }}
          />

          <input
            placeholder="Solicitante"
            value={solicitanteFiltro}
            onChange={(e) => setSolicitanteFiltro(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "2px solid #334155",
              background: "#f8fafc",
              fontWeight: 700,
              color: "#0f172a",
            }}
          />

          <input
            placeholder="Buscar texto en detalle, estado, ID..."
            value={textoFiltro}
            onChange={(e) => setTextoFiltro(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "2px solid #334155",
              background: "#f8fafc",
              fontWeight: 700,
              color: "#0f172a",
            }}
          />
        </div>

        {loading ? (
          <div style={{ color: "#64748b", fontWeight: 800 }}>Cargando…</div>
        ) : pedidosFiltrados.length === 0 ? (
          <div style={{ color: "#64748b", fontWeight: 800 }}>No hay pedidos para los filtros seleccionados.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 10px", minWidth: 1260 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={thStyle()}>ID</th>
                  <th style={thStyle()}>Fecha</th>
                  <th style={thStyle()}>Solicitante</th>
                  <th style={thStyle()}>Detalle</th>
                  <th style={thStyle()}>Tamaño</th>
                  <th style={thStyle()}>Cantidad</th>
                  <th style={thStyle()}>Estado</th>
                  <th style={thStyle()}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pedidosFiltrados.map((p) => {
                  const solicitante = solicitanteFromPedido(p) || "—";
                  const fecha = fmtFechaES(p.created_at);
                  const estado = p.estado || "RESERVA";
                  const canEditCancel = puedeEditarCancelar(p);
                  const items = safeArray(p.items);
                  const expanded = !!expandedRows[p.id];
                  const visibleItems = expanded ? items : items.slice(0, 3);
                  const hiddenCount = Math.max(0, items.length - visibleItems.length);

                  return (
                    <tr
                      key={p.id}
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
                        #{p.id}
                      </td>

                      <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                        {fecha}
                      </td>

                      <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                        {solicitante}
                      </td>

                      {editingId === p.id ? (
                        <td
                          colSpan={3}
                          style={{
                            ...tdStyle(),
                            minWidth: 380,
                            borderTop: "1px solid rgba(15,23,42,0.10)",
                            borderBottom: "1px solid rgba(15,23,42,0.10)",
                          }}
                        >
                          <PedidoDetalleCell
                            pedido={p}
                            mapProdName={mapProdName}
                            expanded={expanded}
                            toggleExpanded={toggleExpanded}
                            editingId={editingId}
                            editQty={editQty}
                            setEditQty={setEditQty}
                            editSearch={editSearch}
                            setEditSearch={setEditSearch}
                            productosDisponiblesParaEdicion={productosDisponiblesParaEdicion}
                          />
                        </td>
                      ) : (
                        <>
                          <td
                            style={{
                              ...tdStyle(),
                              minWidth: 320,
                              borderTop: "1px solid rgba(15,23,42,0.10)",
                              borderBottom: "1px solid rgba(15,23,42,0.10)",
                            }}
                          >
                            {visibleItems.length ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {visibleItems.map((it, idx) => {
                                  const pid = it.producto_id;
                                  const nombre =
                                    mapProdName.get(pid) ||
                                    it.nombre_cientifico ||
                                    it.nombre ||
                                    `ID ${pid}`;
                                  return (
                                    <div key={`${p.id}-prod-${idx}`} style={{ fontWeight: 800, color: "#0f172a" }}>
                                      {nombre}
                                    </div>
                                  );
                                })}
                                {items.length > 3 ? (
                                  <button
                                    onClick={() => toggleExpanded(p.id)}
                                    style={{
                                      alignSelf: "flex-start",
                                      marginTop: 2,
                                      padding: "6px 10px",
                                      borderRadius: 999,
                                      border: "1px solid rgba(15,23,42,0.10)",
                                      background: "white",
                                      color: "#0f172a",
                                      fontWeight: 900,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {expanded ? "Ver menos" : `+ ver ${hiddenCount} más`}
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <span style={{ color: "#64748b", fontWeight: 700 }}>Sin detalle</span>
                            )}
                          </td>

                          <td
                            style={{
                              ...tdStyle(),
                              borderTop: "1px solid rgba(15,23,42,0.10)",
                              borderBottom: "1px solid rgba(15,23,42,0.10)",
                            }}
                          >
                            {visibleItems.length ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {visibleItems.map((it, idx) => (
                                  <div
                                    key={`${p.id}-tam-${idx}`}
                                    style={{ fontWeight: 900, color: "#334155", textAlign: "center" }}
                                  >
                                    {it.tamano || "—"}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: "#94a3b8", fontWeight: 800 }}>—</span>
                            )}
                          </td>

                          <td
                            style={{
                              ...tdStyle(),
                              borderTop: "1px solid rgba(15,23,42,0.10)",
                              borderBottom: "1px solid rgba(15,23,42,0.10)",
                              textAlign: "right",
                            }}
                          >
                            {visibleItems.length ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {visibleItems.map((it, idx) => (
                                  <div
                                    key={`${p.id}-qty-${idx}`}
                                    style={{ fontWeight: 900, color: "#0f172a", textAlign: "right" }}
                                  >
                                    {it.cantidad ?? 0}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: "#94a3b8", fontWeight: 800 }}>—</span>
                            )}
                          </td>
                        </>
                      )}

                      <td style={{ ...tdStyle(), borderTop: "1px solid rgba(15,23,42,0.10)", borderBottom: "1px solid rgba(15,23,42,0.10)" }}>
                        <span style={badge(estado)}>{estado}</span>
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
                        {canEditCancel ? (
                          editingId !== p.id ? (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {!isReadOnly && (
                                <button onClick={() => startEdit(p)} style={actionBtn(true)}>
                                  Editar
                                </button>
                              )}
                              {!isReadOnly && (
                                <button onClick={() => onCancelar(p)} style={dangerBtn(true)}>
                                  Cancelar
                                </button>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                onClick={() => onGuardarEdicion(p.id)}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 10,
                                  border: "1px solid rgba(16,185,129,0.35)",
                                  background: "linear-gradient(90deg, #10b981 0%, #06b6d4 100%)",
                                  color: "white",
                                  fontWeight: 900,
                                  cursor: "pointer",
                                }}
                              >
                                Guardar
                              </button>

                              <button
                                onClick={stopEdit}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 10,
                                  border: "1px solid rgba(15,23,42,0.10)",
                                  background: "white",
                                  color: "#0f172a",
                                  fontWeight: 900,
                                  cursor: "pointer",
                                }}
                              >
                                Cerrar
                              </button>
                            </div>
                          )
                        ) : (
                          <span style={{ color: "#94a3b8", fontWeight: 800 }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PedidoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        productos={productosConStock}
        stockByProductSize={stockByProductSize}
        onSubmit={handleCreatePedidoFromModal}
        saving={savingNewPedido}
      />
    </div>
  );
}