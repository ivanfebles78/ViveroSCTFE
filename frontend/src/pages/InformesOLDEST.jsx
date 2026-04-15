import React, { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import logoViverApp from "../assets/logo.png";
import {
  getDistribucionReporte,
  getMovimientosExternosReporte,
  getTrazabilidadReporte,
  getProductos,
  getMovimientos,
  getPedidos,
} from "../api/api";

const REPORTS = [
  { key: "trazabilidad", label: "Trazabilidad" },
  { key: "distribucion", label: "Distribución" },
  { key: "stock", label: "Existencias" },
  { key: "caducidad", label: "Caducidad" },
  { key: "externos", label: "Movimientos externos" },
  { key: "prestamos", label: "Préstamos" },
];

const DISTRICTS = [
  "Anaga",
  "Centro-Ifara",
  "Salud-La Salle",
  "Ofra-Costa Sur",
  "Suroeste",
];

const DISTRICT_BARRIOS = {
  Anaga: [
    "Afur",
    "Almáciga",
    "Bailadero, El",
    "Campitos, Los",
    "Catalanes",
    "Chamorga",
    "Igueste de San Andrés",
    "María Jiménez",
    "Roque Negro",
    "San Andrés",
    "Taganana",
    "Valleseco",
  ],
  "Centro-Ifara": [
    "Barrio de los Hoteles",
    "Buenos Aires",
    "Duggi",
    "Ifara",
    "La Alegría",
    "La Rambla",
    "Los Lavaderos",
    "Salamanca",
    "Villa Benítez",
    "Zona Centro",
  ],
  "Salud-La Salle": [
    "Buenos Aires",
    "Cruz del Señor",
    "El Perú",
    "La Salle",
    "Los Gladiolos",
    "Los Llanos",
    "Salud Alto",
    "Salud Bajo",
    "Tío Pino",
    "Zona Centro",
  ],
  "Ofra-Costa Sur": [
    "Acorán",
    "Añaza",
    "Barranco Grande",
    "Chimisay",
    "Cuesta Piedra",
    "El Draguillo",
    "García Escámez",
    "Juan XXIII",
    "Las Delicias",
    "Los Andenes",
    "Morenitas, Las",
    "Nuevo Obrero",
    "Ofra",
    "Santa María del Mar",
    "Somosierra",
  ],
  Suroeste: [
    "El Sobradillo",
    "La Gallega",
    "Llano del Moro",
    "Santa María del Mar",
    "Tincer",
  ],
};

function cardStyle() {
  return {
    background: "white",
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 20,
    boxShadow: "0 10px 30px rgba(2,6,23,0.06)",
  };
}

function softInputStyle() {
  return {
    padding: "12px 14px",
    borderRadius: 12,
    border: "2px solid #334155",
    background: "white",
    color: "#0f172a",
    fontWeight: 700,
    width: "100%",
    outline: "none",
    minHeight: 48,
    boxSizing: "border-box",
  };
}

function primaryBtnStyle(disabled = false) {
  return {
    padding: "12px 18px",
    minHeight: 48,
    borderRadius: 14,
    border: "1px solid rgba(6,182,212,0.25)",
    background: disabled
      ? "linear-gradient(90deg, rgba(148,163,184,0.45), rgba(148,163,184,0.35))"
      : "linear-gradient(135deg, #0ea5e9 0%, #06b6d4 40%, #10b981 100%)",
    color: "white",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 16px 36px rgba(6,182,212,0.24)",
    whiteSpace: "nowrap",
  };
}

function secondaryBtnStyle(disabled = false) {
  return {
    padding: "12px 18px",
    minHeight: 48,
    borderRadius: 14,
    border: disabled ? "2px solid #cbd5e1" : "2px solid #334155",
    background: disabled ? "#f8fafc" : "white",
    color: disabled ? "#94a3b8" : "#0f172a",
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
    opacity: disabled ? 0.75 : 1,
    boxShadow: "none",
  };
}

function thStyle() {
  return {
    textAlign: "left",
    padding: "12px 12px",
    color: "#334155",
    fontWeight: 900,
    fontSize: 13,
    borderBottom: "1px solid rgba(15,23,42,0.10)",
    whiteSpace: "nowrap",
  };
}

function tdStyle() {
  return {
    padding: "12px",
    color: "#0f172a",
    fontWeight: 700,
    verticalAlign: "top",
    borderBottom: "1px solid rgba(15,23,42,0.06)",
  };
}

function fmtFecha(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function fmtFechaSolo(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function fmtNum(value) {
  return Number(value || 0).toLocaleString("es-ES");
}

function sanitizeFileName(name) {
  return String(name || "reporte")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getProductoNombre(producto) {
  return (
    producto?.nombre_natural ||
    producto?.nombre ||
    producto?.nombre_cientifico ||
    `Producto #${producto?.id ?? "—"}`
  );
}

function getProductoCategoria(producto) {
  return String(producto?.categoria || "Sin categoría").trim() || "Sin categoría";
}

function getProductoSubcategoria(producto) {
  return String(producto?.subcategoria || "Sin subcategoría").trim() || "Sin subcategoría";
}

function getProductoStockActual(producto) {
  return safeNumber(
    producto?.stock_actual ??
      producto?.stock ??
      producto?.cantidad_disponible ??
      producto?.cantidad_actual ??
      producto?.stock_total ??
      0
  );
}

function getProductoStockMinimo(producto) {
  return safeNumber(
    producto?.stock_minimo ??
      producto?.minimo ??
      producto?.cantidad_minima ??
      producto?.stockMinimo ??
      0
  );
}

function getEstadoStock(stockActual, stockMinimo) {
  if (stockMinimo > 0 && stockActual <= stockMinimo) return "Bajo stock";
  return "Correcto";
}

function toStartOfDay(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getCaducidadEstado(fechaCaducidad) {
  const objetivo = toStartOfDay(fechaCaducidad);
  if (!objetivo) return null;

  const hoy = toStartOfDay(new Date());
  const diffMs = objetivo.getTime() - hoy.getTime();
  const diasRestantes = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diasRestantes < 0) return { estado: "Caducado", diasRestantes };
  if (diasRestantes <= 7) return { estado: "Próximo a caducar", diasRestantes };
  return { estado: "Vigente", diasRestantes };
}

function buildCaducidadKey({ producto, id, loteUuid, zona, tamano, fechaCaducidad, cantidad, estado }) {
  return [
    producto?.id ?? "sin-producto",
    id !== undefined && id !== null && String(id).trim() !== "" ? String(id) : "sin-id",
    loteUuid || "sin-lote",
    zona || "sin-zona",
    tamano || "sin-tamano",
    fechaCaducidad || "sin-fecha",
    Number(cantidad || 0),
    estado || "sin-estado",
  ].join("::");
}

function buildCaducidadItems(productos) {
  const items = [];
  const seen = new Set();

  const pushItemFactory = (producto) => ({ source, id, zona, tamano, fechaCaducidad, cantidad, loteUuid }) => {
    const cad = getCaducidadEstado(fechaCaducidad);
    if (!cad) return;

    const dedupeKey = buildCaducidadKey({
      producto,
      source,
      id,
      loteUuid,
      zona,
      tamano,
      fechaCaducidad,
      cantidad,
    });

    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    items.push({
      id: dedupeKey,
      productoId: producto?.id ?? null,
      nombre: getProductoNombre(producto),
      categoria: getProductoCategoria(producto),
      subcategoria: getProductoSubcategoria(producto),
      zona: zona || "—",
      tamano: tamano || "—",
      fechaCaducidad,
      cantidad: safeNumber(cantidad),
      loteUuid: loteUuid || "—",
      estado: cad.estado,
      diasRestantes: cad.diasRestantes,
    });
  };

  (Array.isArray(productos) ? productos : []).forEach((producto, productoIdx) => {
    const pushItem = pushItemFactory(producto);

    const alertas = Array.isArray(producto?.alertas_caducidad)
      ? producto.alertas_caducidad
      : Array.isArray(producto?.caducidad_alertas)
      ? producto.caducidad_alertas
      : [];

    const lotes = Array.isArray(producto?.lotes)
      ? producto.lotes
      : Array.isArray(producto?.batches)
      ? producto.batches
      : [];

    alertas.forEach((alerta, idx) => {
      pushItem({
        source: "alerta",
        id: alerta?.id || `alerta-${producto?.id || productoIdx}-${idx}`,
        zona: alerta?.zona || alerta?.zone || alerta?.zona_id,
        tamano: alerta?.tamano || alerta?.size,
        fechaCaducidad:
          alerta?.fecha_caducidad || alerta?.caducidad || alerta?.fecha || alerta?.expiry_date,
        cantidad: alerta?.cantidad || alerta?.cantidad_disponible || alerta?.stock || 0,
        loteUuid: alerta?.uuid_lote || alerta?.lote_uuid,
      });
    });

    lotes.forEach((lote, idx) => {
      pushItem({
        source: "lote",
        id: lote?.id || lote?.uuid_lote || lote?.uuid || `lote-${producto?.id || productoIdx}-${idx}`,
        zona: lote?.zona || lote?.zone || lote?.zona_id,
        tamano: lote?.tamano || lote?.size,
        fechaCaducidad:
          lote?.fecha_caducidad || lote?.caducidad || lote?.expiry_date || lote?.fecha,
        cantidad:
          lote?.cantidad_disponible || lote?.cantidad || lote?.stock || lote?.cantidad_actual || 0,
        loteUuid: lote?.uuid_lote || lote?.uuid,
      });
    });

    if (producto?.fecha_caducidad) {
      pushItem({
        source: "producto",
        id: `producto-${producto?.id || productoIdx}`,
        zona: producto?.zona,
        tamano: producto?.tamano,
        fechaCaducidad: producto?.fecha_caducidad,
        cantidad: producto?.cantidad_disponible || producto?.stock || 0,
        loteUuid: producto?.uuid_lote,
      });
    }
  });

  return items.sort((a, b) => {
    const order = {
      Caducado: 0,
      "Próximo a caducar": 1,
      Vigente: 2,
    };

    const oa = order[a.estado] ?? 99;
    const ob = order[b.estado] ?? 99;
    if (oa !== ob) return oa - ob;

    const da = toStartOfDay(a.fechaCaducidad)?.getTime() || 0;
    const db = toStartOfDay(b.fechaCaducidad)?.getTime() || 0;
    if (da !== db) return da - db;

    return a.nombre.localeCompare(b.nombre, "es");
  });
}

function StockBadge({ estado }) {
  const isLow = estado === "Bajo stock";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        border: isLow
          ? "1px solid rgba(220,38,38,0.18)"
          : "1px solid rgba(16,185,129,0.18)",
        color: isLow ? "#b91c1c" : "#047857",
        background: isLow ? "rgba(254,242,242,1)" : "rgba(236,253,245,1)",
        whiteSpace: "nowrap",
      }}
    >
      {estado}
    </span>
  );
}

function CaducidadBadge({ estado }) {
  const isExpired = estado === "Caducado";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        border: isExpired
          ? "1px solid rgba(220,38,38,0.18)"
          : "1px solid rgba(245,158,11,0.20)",
        color: isExpired ? "#b91c1c" : "#92400e",
        background: isExpired ? "rgba(254,242,242,1)" : "rgba(255,251,235,1)",
        whiteSpace: "nowrap",
      }}
    >
      {estado}
    </span>
  );
}


function PrestamoBadge({ estado }) {
  const isReturned = estado === "Devuelto";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        border: isReturned
          ? "1px solid rgba(16,185,129,0.18)"
          : "1px solid rgba(59,130,246,0.20)",
        color: isReturned ? "#047857" : "#1d4ed8",
        background: isReturned ? "rgba(236,253,245,1)" : "rgba(239,246,255,1)",
        whiteSpace: "nowrap",
      }}
    >
      {estado}
    </span>
  );
}

function getPedidoSolicitante(pedido) {
  return (
    pedido?.solicitante_username ||
    pedido?.solicitante ||
    pedido?.created_by ||
    pedido?.usuario ||
    pedido?.username ||
    "—"
  );
}

function getPedidoDestino(pedido) {
  return [pedido?.distrito_destino, pedido?.barrio_destino, pedido?.direccion_destino]
    .filter(Boolean)
    .join(" · ") || "—";
}

function getMovimientoEsPrestamo(m) {
  return !!m?.es_prestamo;
}

function getMovimientoEsDevolucion(m) {
  return !!m?.es_devolucion;
}

function getMovimientoProductoNombre(m) {
  return (
    m?.producto_nombre_cientifico ||
    m?.nombre_cientifico ||
    m?.producto_nombre ||
    `Producto #${m?.producto_id || "—"}`
  );
}

function buildPrestamoItems(pedidos, movimientos) {
  const movimientosArr = Array.isArray(movimientos) ? movimientos : [];
  const pedidosArr = Array.isArray(pedidos) ? pedidos : [];

  return pedidosArr
    .map((pedido) => {
      const pedidoMovs = movimientosArr.filter((m) => String(m?.pedido_id || "") === String(pedido?.id || ""));
      const prestamoMovs = pedidoMovs.filter(getMovimientoEsPrestamo);
      if (!prestamoMovs.length) return null;

      const devolucionMovs = pedidoMovs.filter(getMovimientoEsDevolucion);

      const lineas = (Array.isArray(pedido?.items) ? pedido.items : []).map((item, idx) => {
        const prestado = prestamoMovs
          .filter((m) => String(m?.producto_id || "") === String(item?.producto_id || ""))
          .reduce((sum, m) => sum + safeNumber(m?.cantidad), 0);

        const devuelto = devolucionMovs
          .filter((m) => String(m?.producto_id || "") === String(item?.producto_id || ""))
          .reduce((sum, m) => sum + safeNumber(m?.cantidad), 0);

        const cantidadPedida = safeNumber(item?.cantidad);
        const pendiente = Math.max(prestado - devuelto, 0);
        const estadoLinea = prestado > 0 && pendiente <= 0 ? "Devuelto" : "Activo";

        return {
          key: `${pedido?.id || "pedido"}-${item?.producto_id || "prod"}-${idx}`,
          producto: item?.producto_nombre_cientifico || item?.nombre_cientifico || item?.producto_nombre || `Producto #${item?.producto_id || "—"}`,
          tamano: item?.tamano || "—",
          cantidadPedida,
          prestado,
          devuelto,
          pendiente,
          estado: estadoLinea,
        };
      });

      const lineasPrestadas = lineas.filter((l) => l.prestado > 0);
      const estadoPedido = lineasPrestadas.length > 0 && lineasPrestadas.every((l) => l.pendiente <= 0)
        ? "Devuelto"
        : "Activo";

      const fechaPrestamo = prestamoMovs
        .map((m) => new Date(m?.fecha_movimiento || 0))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => a - b)[0];

      const fechaUltimaDevolucion = devolucionMovs
        .map((m) => new Date(m?.fecha_movimiento || 0))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => b - a)[0];

      const productosTexto = lineasPrestadas.map((l) => `${l.producto} · ${l.tamano} · ${l.prestado}`).join(" | ");

      return {
        id: pedido?.id,
        pedidoId: pedido?.id,
        fechaPrestamo: fechaPrestamo ? fechaPrestamo.toISOString() : pedido?.created_at || null,
        fechaUltimaDevolucion: fechaUltimaDevolucion ? fechaUltimaDevolucion.toISOString() : null,
        solicitante: getPedidoSolicitante(pedido),
        destinatario: getPedidoDestino(pedido),
        estado: estadoPedido,
        lineas: lineasPrestadas,
        productosTexto,
        totalPrestado: lineasPrestadas.reduce((sum, l) => sum + l.prestado, 0),
        totalDevuelto: lineasPrestadas.reduce((sum, l) => sum + l.devuelto, 0),
        totalPendiente: lineasPrestadas.reduce((sum, l) => sum + l.pendiente, 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const da = new Date(b?.fechaPrestamo || 0).getTime();
      const db = new Date(a?.fechaPrestamo || 0).getTime();
      return da - db;
    });
}

async function loadImageAsDataUrl(src) {
  const res = await fetch(src);
  if (!res.ok) {
    throw new Error(`No se pudo cargar la imagen: ${src}`);
  }
  const blob = await res.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function savePdfWithDialog(doc, fileName) {
  const blob = doc.output("blob");

  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  doc.save(fileName);
}

async function addDocHeader(doc, title, me) {
  const generatedAt = new Date();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setFillColor(6, 182, 212);
  doc.rect(0, 28, pageWidth, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("ViverApp", 14, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(226, 232, 240);
  doc.text("Sistema de gestión del vivero", 14, 23);

  try {
    const logoDataUrl = await loadImageAsDataUrl(logoViverApp);
    doc.addImage(logoDataUrl, "PNG", pageWidth - 42, 1, 32, 32);
  } catch (e) {
    console.error("No se pudo cargar el logo para el PDF:", e);
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 14, 42);

  doc.setDrawColor(226, 232, 240);
  doc.line(14, 46, pageWidth - 14, 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Fecha de generación: ${generatedAt.toLocaleString("es-ES")}`, 14, 54);
  doc.text(`Usuario: ${me?.username || "—"}`, 14, 60);
  doc.text(`Rol: ${me?.rol || me?.role || "—"}`, 14, 66);

  return 74;
}

function addPageFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("ViverApp · Informe generado automáticamente", 14, pageHeight - 7);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 7, {
      align: "right",
    });
  }
}

async function exportReportToPdf({
  activeReport,
  me,
  trazabilidadData,
  distribucionData,
  stockExportData,
  caducidadExportData,
  externosData,
  prestamosExportData,
}) {
  const doc = new jsPDF("p", "mm", "a4");
  let y = await addDocHeader(
    doc,
    activeReport === "trazabilidad"
      ? "Reporte de trazabilidad"
      : activeReport === "distribucion"
      ? "Reporte de distribución"
      : activeReport === "stock"
      ? "Reporte de existencias"
      : activeReport === "caducidad"
      ? "Reporte de caducidad"
      : activeReport === "prestamos"
      ? "Reporte de préstamos"
      : "Reporte de movimientos externos",
    me
  );

  if (activeReport === "trazabilidad" && trazabilidadData) {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [["Campo", "Valor"]],
      body: [
        ["UUID", trazabilidadData.uuid_lote || "—"],
        ["Producto", trazabilidadData.producto_nombre || `Producto #${trazabilidadData.producto_id || "—"}`],
        ["Cantidad inicial", fmtNum(trazabilidadData.cantidad_inicial)],
        ["Fecha de entrada", fmtFecha(trazabilidadData.fecha_entrada)],
      ],
      styles: { fontSize: 10, cellPadding: 2.5 },
      headStyles: { fillColor: [14, 165, 233] },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      theme: "grid",
      head: [["Fecha", "Cantidad", "Origen", "Destino", "Descripción"]],
      body: (trazabilidadData.movimientos || []).map((m) => [
        fmtFecha(m.fecha_movimiento),
        fmtNum(m.cantidad),
        m.origen_tipo || "—",
        m.destino_tipo || "—",
        m.descripcion || "—",
      ]),
      styles: { fontSize: 9, cellPadding: 2.2, overflow: "linebreak" },
      headStyles: { fillColor: [16, 185, 129] },
    });

    if ((trazabilidadData.inventario_actual || []).length) {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        theme: "grid",
        head: [["Zona", "Tamaño", "Cantidad disponible"]],
        body: trazabilidadData.inventario_actual.map((inv) => [
          inv.zona || "—",
          inv.tamano || "—",
          fmtNum(inv.cantidad_disponible),
        ]),
        styles: { fontSize: 9.5, cellPadding: 2.2 },
        headStyles: { fillColor: [51, 65, 85] },
      });
    }
  }

  if (activeReport === "distribucion" && distribucionData) {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [["Campo", "Valor"]],
      body: [
        ["Producto", distribucionData.producto_nombre || `Producto #${distribucionData.producto_id || "—"}`],
        ["Stock total", fmtNum(distribucionData.stock_total)],
        ["Ubicaciones activas", fmtNum(distribucionData.distribucion?.length || 0)],
      ],
      styles: { fontSize: 10, cellPadding: 2.5 },
      headStyles: { fillColor: [14, 165, 233] },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      theme: "grid",
      head: [["Zona", "Tamaño", "Cantidad"]],
      body: (distribucionData.distribucion || []).map((row) => [
        row.zona || "—",
        row.tamano || "—",
        fmtNum(row.cantidad),
      ]),
      styles: { fontSize: 10, cellPadding: 2.3 },
      headStyles: { fillColor: [16, 185, 129] },
    });
  }

  if (activeReport === "stock" && stockExportData) {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [["Filtro", "Valor"]],
      body: [
        ["Categoría", stockExportData.filters.categoria || "Todas"],
        ["Subcategoría", stockExportData.filters.subcategoria || "Todas"],
        ["Texto", stockExportData.filters.search || "—"],
        ["Solo bajo stock", stockExportData.filters.onlyLowStock ? "Sí" : "No"],
        ["Productos visibles", fmtNum(stockExportData.totalProductos)],
        ["Categorías visibles", fmtNum(stockExportData.totalCategorias)],
      ],
      styles: { fontSize: 10, cellPadding: 2.5 },
      headStyles: { fillColor: [14, 165, 233] },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      theme: "grid",
      head: [["Categoría", "Nº productos", "Stock total"]],
      body: (stockExportData.groups || []).map((group) => [
        group.categoria,
        fmtNum(group.totalProductos),
        fmtNum(group.stockTotal),
      ]),
      styles: { fontSize: 9.5, cellPadding: 2.2 },
      headStyles: { fillColor: [16, 185, 129] },
    });

    (stockExportData.groups || []).forEach((group) => {
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 8,
        theme: "grid",
        head: [[`Detalle · ${group.categoria}`, "Subcategoría", "Stock actual", "Stock mínimo", "Estado"]],
        body: (group.items || []).map((item) => [
          item.nombre,
          item.subcategoria,
          fmtNum(item.stockActual),
          fmtNum(item.stockMinimo),
          item.estado,
        ]),
        styles: { fontSize: 9, cellPadding: 2.1, overflow: "linebreak" },
        headStyles: { fillColor: [51, 65, 85] },
      });
    });
  }

  if (activeReport === "caducidad" && caducidadExportData) {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [["Resumen", "Valor"]],
      body: [
        ["Registros visibles", fmtNum(caducidadExportData.totalItems)],
        ["Caducados", fmtNum(caducidadExportData.totalCaducados)],
        ["Próximos a caducar", fmtNum(caducidadExportData.totalProximos)],
        ["Vigentes", fmtNum(caducidadExportData.totalVigentes)],
      ],
      styles: { fontSize: 10, cellPadding: 2.5 },
      headStyles: { fillColor: [14, 165, 233] },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      theme: "grid",
      head: [["Producto", "Categoría", "Subcategoría", "Zona", "Tamaño", "Fecha caducidad", "Días", "Estado"]],
      body: (caducidadExportData.items || []).map((item) => [
        item.nombre,
        item.categoria,
        item.subcategoria,
        item.zona,
        item.tamano,
        fmtFechaSolo(item.fechaCaducidad),
        String(item.diasRestantes),
        item.estado,
      ]),
      styles: { fontSize: 8.7, cellPadding: 2.0, overflow: "linebreak" },
      headStyles: { fillColor: [245, 158, 11] },
    });
  }

  if (activeReport === "externos" && Array.isArray(externosData)) {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [["Fecha", "Producto", "Cantidad", "Origen", "Destino", "Ubicación destino", "Registrado por"]],
      body: externosData.map((row) => [
        fmtFecha(row.fecha_movimiento),
        row.producto_nombre || "—",
        fmtNum(row.cantidad),
        `${row.origen_tipo || "—"}${row.zona_origen ? ` · ${row.zona_origen}` : ""}${row.tamano_origen ? ` · ${row.tamano_origen}` : ""}`,
        `${row.destino_tipo || "—"}${row.zona_destino ? ` · ${row.zona_destino}` : ""}${row.tamano_destino ? ` · ${row.tamano_destino}` : ""}`,
        [row.distrito_destino, row.barrio_destino, row.direccion_destino].filter(Boolean).join(" · ") || "—",
        row.created_by || "—",
      ]),
      styles: { fontSize: 8.5, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [16, 185, 129] },
    });
  }


  if (activeReport === "prestamos" && prestamosExportData) {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [["Resumen", "Valor"]],
      body: [
        ["Préstamos visibles", fmtNum(prestamosExportData.totalPrestamos)],
        ["Activos", fmtNum(prestamosExportData.totalActivos)],
        ["Devueltos", fmtNum(prestamosExportData.totalDevueltos)],
      ],
      styles: { fontSize: 10, cellPadding: 2.5 },
      headStyles: { fillColor: [14, 165, 233] },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      theme: "grid",
      head: [["Pedido", "Fecha", "Solicitante", "Destino", "Elementos", "Estado", "Prestado", "Devuelto", "Pendiente"]],
      body: (prestamosExportData.items || []).map((item) => [
        `#${item.pedidoId}`,
        fmtFecha(item.fechaPrestamo),
        item.solicitante,
        item.destinatario,
        item.lineas.map((l) => `${l.producto} · ${l.tamano} · ${fmtNum(l.prestado)}`).join("\n"),
        item.estado,
        fmtNum(item.totalPrestado),
        fmtNum(item.totalDevuelto),
        fmtNum(item.totalPendiente),
      ]),
      styles: { fontSize: 8.5, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [59, 130, 246] },
    });
  }

  const fileName = `${sanitizeFileName(
    activeReport === "trazabilidad"
      ? "reporte_trazabilidad"
      : activeReport === "distribucion"
      ? "reporte_distribucion"
      : activeReport === "stock"
      ? "reporte_existencias"
      : activeReport === "caducidad"
      ? "reporte_caducidad"
      : "reporte_movimientos_externos"
  )}_${new Date().toISOString().slice(0, 10)}.pdf`;

  addPageFooter(doc);
  await savePdfWithDialog(doc, fileName);
}

function MessageBanner({ msg, msgType, onClose }) {
  if (!msg) return null;
  const isError = msgType === "error";

  return (
    <div
      style={{
        ...cardStyle(),
        marginTop: 14,
        padding: "14px 16px",
        border: isError
          ? "1px solid rgba(239,68,68,0.18)"
          : "1px solid rgba(16,185,129,0.18)",
        background: isError
          ? "linear-gradient(180deg, rgba(254,242,242,0.98), rgba(255,255,255,0.98))"
          : "linear-gradient(180deg, rgba(236,253,245,0.98), rgba(255,255,255,0.98))",
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
        title="Cerrar"
        aria-label="Cerrar mensaje"
      >
        ×
      </button>
    </div>
  );
}

function EmptyState({ text = "No hay datos para mostrar." }) {
  return (
    <div
      style={{
        ...cardStyle(),
        padding: 20,
        marginTop: 20,
        color: "#64748b",
        fontWeight: 800,
      }}
    >
      {text}
    </div>
  );
}

export default function Informes() {
  const { me } = useOutletContext();

  const role = me?.rol || me?.role;
  const canAccess = role === "admin" || role === "manager";

  const [activeReport, setActiveReport] = useState("trazabilidad");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("success");
  const msgTimerRef = useRef(null);

  const [productos, setProductos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [pedidos, setPedidos] = useState([]);

  const [uuid, setUuid] = useState("");
  const [trazabilidadData, setTrazabilidadData] = useState(null);

  const [productoSearch, setProductoSearch] = useState("");
  const [selectedProducto, setSelectedProducto] = useState(null);
  const [showProductoDropdown, setShowProductoDropdown] = useState(false);
  const [distribucionData, setDistribucionData] = useState(null);

  const [stockSearch, setStockSearch] = useState("");
  const [stockCategoriaFilter, setStockCategoriaFilter] = useState("");
  const [stockSubcategoriaFilter, setStockSubcategoriaFilter] = useState("");
  const [stockOnlyLow, setStockOnlyLow] = useState(false);

  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [distrito, setDistrito] = useState("");
  const [barrio, setBarrio] = useState("");
  const [direccion, setDireccion] = useState("");
  const [externosData, setExternosData] = useState([]);
  const [externosSearched, setExternosSearched] = useState(false);

  const [prestamoProductoFilter, setPrestamoProductoFilter] = useState("");
  const [prestamoSolicitanteFilter, setPrestamoSolicitanteFilter] = useState("");
  const [prestamoEstadoFilter, setPrestamoEstadoFilter] = useState("");
  const [prestamoFechaDesde, setPrestamoFechaDesde] = useState("");
  const [prestamoFechaHasta, setPrestamoFechaHasta] = useState("");

  const productoSearchRef = useRef(null);

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

  const loadProductos = async (showSuccessMessage = false) => {
    setLoading(true);
    try {
      const [dataProductos, dataMovimientos, dataPedidos] = await Promise.all([
        getProductos(),
        getMovimientos(),
        getPedidos(),
      ]);
      setProductos(Array.isArray(dataProductos) ? dataProductos : []);
      setMovimientos(Array.isArray(dataMovimientos) ? dataMovimientos : []);
      setPedidos(Array.isArray(dataPedidos) ? dataPedidos : []);
      if (showSuccessMessage) {
        showTimedMessage("Informe actualizado.", "success");
      }
    } catch (e) {
      setProductos([]);
      setMovimientos([]);
      setPedidos([]);
      showTimedMessage(
        e?.response?.data?.detail || e?.message || "Error cargando los productos",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductos(false);
    return () => clearMsgTimer();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (productoSearchRef.current && !productoSearchRef.current.contains(event.target)) {
        setShowProductoDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProductos = useMemo(() => {
    const term = productoSearch.trim().toLowerCase();
    if (!term) return productos.slice(0, 12);

    return productos
      .filter((p) => {
        const natural = String(p.nombre_natural || "").toLowerCase();
        const cientifico = String(p.nombre_cientifico || "").toLowerCase();
        const categoria = String(p.categoria || "").toLowerCase();
        const subcategoria = String(p.subcategoria || "").toLowerCase();

        return (
          natural.includes(term) ||
          cientifico.includes(term) ||
          categoria.includes(term) ||
          subcategoria.includes(term)
        );
      })
      .slice(0, 20);
  }, [productos, productoSearch]);

  const normalizedStockItems = useMemo(() => {
    return (productos || []).map((p) => {
      const nombre = getProductoNombre(p);
      const categoria = getProductoCategoria(p);
      const subcategoria = getProductoSubcategoria(p);
      const stockActual = getProductoStockActual(p);
      const stockMinimo = getProductoStockMinimo(p);
      const estado = getEstadoStock(stockActual, stockMinimo);

      return {
        id: p.id ?? `${nombre}-${categoria}-${subcategoria}`,
        nombre,
        categoria,
        subcategoria,
        stockActual,
        stockMinimo,
        estado,
      };
    });
  }, [productos]);

  const stockCategoriasDisponibles = useMemo(() => {
    return [...new Set(normalizedStockItems.map((p) => p.categoria))].sort((a, b) =>
      a.localeCompare(b, "es")
    );
  }, [normalizedStockItems]);

  const stockSubcategoriasDisponibles = useMemo(() => {
    const filteredByCategory = stockCategoriaFilter
      ? normalizedStockItems.filter((p) => p.categoria === stockCategoriaFilter)
      : normalizedStockItems;

    return [...new Set(filteredByCategory.map((p) => p.subcategoria))].sort((a, b) =>
      a.localeCompare(b, "es")
    );
  }, [normalizedStockItems, stockCategoriaFilter]);

  const stockFilteredItems = useMemo(() => {
    const term = stockSearch.trim().toLowerCase();

    return normalizedStockItems.filter((item) => {
      const matchesCategory = !stockCategoriaFilter || item.categoria === stockCategoriaFilter;
      const matchesSubcategory =
        !stockSubcategoriaFilter || item.subcategoria === stockSubcategoriaFilter;
      const matchesLowStock = !stockOnlyLow || item.estado === "Bajo stock";
      const matchesSearch =
        !term ||
        item.nombre.toLowerCase().includes(term) ||
        item.categoria.toLowerCase().includes(term) ||
        item.subcategoria.toLowerCase().includes(term);

      return matchesCategory && matchesSubcategory && matchesLowStock && matchesSearch;
    });
  }, [
    normalizedStockItems,
    stockSearch,
    stockCategoriaFilter,
    stockSubcategoriaFilter,
    stockOnlyLow,
  ]);

  const stockGroupedByCategory = useMemo(() => {
    const map = new Map();

    stockFilteredItems.forEach((item) => {
      if (!map.has(item.categoria)) {
        map.set(item.categoria, {
          categoria: item.categoria,
          totalProductos: 0,
          stockTotal: 0,
          bajoStock: 0,
          items: [],
        });
      }

      const group = map.get(item.categoria);
      group.totalProductos += 1;
      group.stockTotal += item.stockActual;
      if (item.estado === "Bajo stock") group.bajoStock += 1;
      group.items.push(item);
    });

    return [...map.values()]
      .map((group) => ({
        ...group,
        items: [...group.items].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      }))
      .sort((a, b) => a.categoria.localeCompare(b.categoria, "es"));
  }, [stockFilteredItems]);

  const stockSummary = useMemo(() => {
    return {
      totalCategorias: stockGroupedByCategory.length,
      totalProductos: stockFilteredItems.length,
      totalStock: stockFilteredItems.reduce((sum, item) => sum + item.stockActual, 0),
      totalBajoStock: stockFilteredItems.filter((item) => item.estado === "Bajo stock").length,
    };
  }, [stockFilteredItems, stockGroupedByCategory]);

  const stockExportData = useMemo(() => {
    return {
      filters: {
        categoria: stockCategoriaFilter,
        subcategoria: stockSubcategoriaFilter,
        search: stockSearch,
        onlyLowStock: stockOnlyLow,
      },
      totalCategorias: stockSummary.totalCategorias,
      totalProductos: stockSummary.totalProductos,
      groups: stockGroupedByCategory,
    };
  }, [
    stockCategoriaFilter,
    stockSubcategoriaFilter,
    stockSearch,
    stockOnlyLow,
    stockSummary,
    stockGroupedByCategory,
  ]);

  const caducidadItems = useMemo(() => buildCaducidadItems(productos), [productos]);

  const caducidadSummary = useMemo(() => {
    return {
      totalItems: caducidadItems.length,
      totalCaducados: caducidadItems.filter((item) => item.estado === "Caducado").length,
      totalProximos: caducidadItems.filter((item) => item.estado === "Próximo a caducar").length,
      totalVigentes: caducidadItems.filter((item) => item.estado === "Vigente").length,
    };
  }, [caducidadItems]);

  const caducidadExportData = useMemo(() => {
    return {
      items: caducidadItems,
      totalItems: caducidadSummary.totalItems,
      totalCaducados: caducidadSummary.totalCaducados,
      totalProximos: caducidadSummary.totalProximos,
      totalVigentes: caducidadSummary.totalVigentes,
    };
  }, [caducidadItems, caducidadSummary]);

  const barriosDisponibles = useMemo(() => {
    return distrito ? DISTRICT_BARRIOS[distrito] || [] : [];
  }, [distrito]);

  const trazabilidadResumen = useMemo(() => {
    if (!trazabilidadData?.movimientos) return [];
    return trazabilidadData.movimientos;
  }, [trazabilidadData]);


  const prestamosItems = useMemo(() => {
    const items = buildPrestamoItems(pedidos, movimientos);
    const productoTerm = prestamoProductoFilter.trim().toLowerCase();
    const solicitanteTerm = prestamoSolicitanteFilter.trim().toLowerCase();
    const fechaDesdeObj = prestamoFechaDesde ? new Date(`${prestamoFechaDesde}T00:00:00`) : null;
    const fechaHastaObj = prestamoFechaHasta ? new Date(`${prestamoFechaHasta}T23:59:59`) : null;

    return items.filter((item) => {
      const productoMatch =
        !productoTerm ||
        item.lineas.some((l) => l.producto.toLowerCase().includes(productoTerm));

      const solicitanteMatch =
        !solicitanteTerm ||
        item.solicitante.toLowerCase().includes(solicitanteTerm) ||
        item.destinatario.toLowerCase().includes(solicitanteTerm);

      const estadoMatch = !prestamoEstadoFilter || item.estado === prestamoEstadoFilter;

      const fechaItem = item.fechaPrestamo ? new Date(item.fechaPrestamo) : null;
      const fechaDesdeMatch = !fechaDesdeObj || (fechaItem && fechaItem >= fechaDesdeObj);
      const fechaHastaMatch = !fechaHastaObj || (fechaItem && fechaItem <= fechaHastaObj);

      return productoMatch && solicitanteMatch && estadoMatch && fechaDesdeMatch && fechaHastaMatch;
    });
  }, [
    pedidos,
    movimientos,
    prestamoProductoFilter,
    prestamoSolicitanteFilter,
    prestamoEstadoFilter,
    prestamoFechaDesde,
    prestamoFechaHasta,
  ]);

  const prestamosSummary = useMemo(() => {
    return {
      totalPrestamos: prestamosItems.length,
      totalActivos: prestamosItems.filter((item) => item.estado === "Activo").length,
      totalDevueltos: prestamosItems.filter((item) => item.estado === "Devuelto").length,
    };
  }, [prestamosItems]);

  const prestamosExportData = useMemo(() => {
    return {
      items: prestamosItems,
      totalPrestamos: prestamosSummary.totalPrestamos,
      totalActivos: prestamosSummary.totalActivos,
      totalDevueltos: prestamosSummary.totalDevueltos,
    };
  }, [prestamosItems, prestamosSummary]);

  const onActualizarPrestamos = async () => {
    await loadProductos(true);
  };

  const onLimpiarPrestamos = () => {
    setPrestamoProductoFilter("");
    setPrestamoSolicitanteFilter("");
    setPrestamoEstadoFilter("");
    setPrestamoFechaDesde("");
    setPrestamoFechaHasta("");
  };

  const canExportCurrentReport = useMemo(() => {
    if (activeReport === "trazabilidad") return !!trazabilidadData;
    if (activeReport === "distribucion") return !!distribucionData;
    if (activeReport === "stock") return stockFilteredItems.length > 0;
    if (activeReport === "caducidad") return caducidadItems.length > 0;
    if (activeReport === "externos") return externosSearched;
    if (activeReport === "prestamos") return prestamosItems.length > 0;
    return false;
  }, [
    activeReport,
    trazabilidadData,
    distribucionData,
    stockFilteredItems,
    caducidadItems,
    externosSearched,
    prestamosItems,
  ]);

  const handleExportPdf = async () => {
    if (!canExportCurrentReport || exporting) return;
    try {
      setExporting(true);
      await exportReportToPdf({
        activeReport,
        me,
        trazabilidadData,
        distribucionData,
        stockExportData,
        caducidadExportData,
        externosData,
        prestamosExportData,
      });
      showTimedMessage("PDF exportado correctamente.", "success");
    } catch (e) {
      if (e?.name !== "AbortError") {
        showTimedMessage(e?.message || "No se pudo exportar el PDF.", "error");
      }
    } finally {
      setExporting(false);
    }
  };

  const onBuscarTrazabilidad = async () => {
    if (!uuid.trim()) {
      showTimedMessage("Debes introducir un UUID.", "error");
      return;
    }

    setLoading(true);
    try {
      const data = await getTrazabilidadReporte(uuid.trim());
      setTrazabilidadData(data);
      showTimedMessage("Informe de trazabilidad generado.", "success");
    } catch (e) {
      setTrazabilidadData(null);
      showTimedMessage(
        e?.response?.data?.detail || e?.message || "Error generando trazabilidad",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const onSelectProducto = (producto) => {
    const label =
      producto.nombre_natural ||
      producto.nombre_cientifico ||
      `Producto #${producto.id}`;
    setSelectedProducto(producto);
    setProductoSearch(label);
    setShowProductoDropdown(false);
  };

  const onBuscarDistribucion = async () => {
    const searchValue = (
      selectedProducto?.nombre_natural ||
      selectedProducto?.nombre_cientifico ||
      productoSearch ||
      ""
    ).trim();

    if (!searchValue) {
      showTimedMessage("Debes indicar el nombre del producto.", "error");
      return;
    }

    setLoading(true);
    try {
      const data = await getDistribucionReporte(searchValue);
      setDistribucionData(data);
      showTimedMessage("Informe de distribución generado.", "success");
    } catch (e) {
      setDistribucionData(null);
      showTimedMessage(
        e?.response?.data?.detail || e?.message || "Error generando distribución",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const onNuevaBusquedaDistribucion = () => {
    setProductoSearch("");
    setSelectedProducto(null);
    setShowProductoDropdown(false);
    setDistribucionData(null);
  };

  const onBuscarStock = async () => {
    await loadProductos(true);
  };

  const onBuscarCaducidad = async () => {
    await loadProductos(true);
  };

  const onLimpiarFiltrosStock = () => {
    setStockSearch("");
    setStockCategoriaFilter("");
    setStockSubcategoriaFilter("");
    setStockOnlyLow(false);
  };

  const onBuscarExternos = async () => {
    setLoading(true);
    try {
      const data = await getMovimientosExternosReporte({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        distrito: distrito || undefined,
        barrio: barrio || undefined,
        direccion: direccion || undefined,
      });
      setExternosData(Array.isArray(data) ? data : []);
      setExternosSearched(true);
      showTimedMessage("Informe de movimientos externos generado.", "success");
    } catch (e) {
      setExternosData([]);
      setExternosSearched(false);
      showTimedMessage(
        e?.response?.data?.detail || e?.message || "Error generando movimientos externos",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const onNuevaBusquedaExternos = () => {
    setFechaDesde("");
    setFechaHasta("");
    setDistrito("");
    setBarrio("");
    setDireccion("");
    setExternosData([]);
    setExternosSearched(false);
  };

  if (!canAccess) {
    return (
      <div style={{ width: "100%" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
          <h1 style={{ fontSize: 44, margin: 0, fontWeight: 900, color: "#0f172a" }}>Informes</h1>
        </div>

        <div
          style={{
            ...cardStyle(),
            marginTop: 18,
            padding: 18,
            color: "#991b1b",
            fontWeight: 900,
            border: "1px solid rgba(239,68,68,0.18)",
            background: "linear-gradient(180deg, rgba(254,242,242,0.98), rgba(255,255,255,0.98))",
          }}
        >
          No tienes permisos para acceder a esta página.
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 44, margin: 0, fontWeight: 900, color: "#0f172a" }}>Informes</h1>
          <div style={{ marginTop: 8, color: "#64748b", fontWeight: 700 }}>
            Trazabilidad, distribución en vivero, existencias, caducidad, movimientos externos y préstamos.
          </div>
        </div>
      </div>

      <MessageBanner
        msg={msg}
        msgType={msgType}
        onClose={() => {
          clearMsgTimer();
          setMsg("");
        }}
      />

      <div style={{ ...cardStyle(), marginTop: 18, padding: 18 }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {REPORTS.map((r) => {
              const active = activeReport === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => setActiveReport(r.key)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 14,
                    border: active
                      ? "1px solid rgba(6,182,212,0.25)"
                      : "1px solid rgba(15,23,42,0.10)",
                    background: active
                      ? "linear-gradient(135deg, #0ea5e9 0%, #06b6d4 40%, #10b981 100%)"
                      : "white",
                    color: active ? "white" : "#0f172a",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleExportPdf}
            disabled={!canExportCurrentReport || exporting}
            style={secondaryBtnStyle(!canExportCurrentReport || exporting)}
            title={canExportCurrentReport ? "Exportar informe a PDF" : "Genera primero un informe"}
          >
            {exporting ? "Exportando..." : "Exportar a PDF"}
          </button>
        </div>

        {activeReport === "trazabilidad" && (
          <>
            <div
              style={{
                marginTop: 22,
                display: "grid",
                gridTemplateColumns: "minmax(320px, 1fr) auto",
                gap: 18,
                alignItems: "end",
              }}
            >
              <div>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>UUID del lote</div>
                <input
                  value={uuid}
                  onChange={(e) => setUuid(e.target.value)}
                  placeholder="Introduce el UUID"
                  style={softInputStyle()}
                />
              </div>

              <button onClick={onBuscarTrazabilidad} disabled={loading} style={primaryBtnStyle(loading)}>
                {loading ? "Generando..." : "Generar informe"}
              </button>
            </div>

            {trazabilidadData ? (
              <>
                <div style={{ ...cardStyle(), marginTop: 20, padding: 18 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
                    Resumen del lote
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, minmax(160px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>UUID</div>
                      <div style={{ fontWeight: 800 }}>{trazabilidadData.uuid_lote || "—"}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Producto</div>
                      <div style={{ fontWeight: 800 }}>
                        {trazabilidadData.producto_nombre || `Producto #${trazabilidadData.producto_id || "—"}`}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Cantidad inicial</div>
                      <div style={{ fontWeight: 800 }}>{fmtNum(trazabilidadData.cantidad_inicial)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Fecha de entrada</div>
                      <div style={{ fontWeight: 800 }}>{fmtFecha(trazabilidadData.fecha_entrada)}</div>
                    </div>
                  </div>
                </div>

                <div style={{ ...cardStyle(), marginTop: 20, padding: 18 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
                    Línea temporal
                  </div>

                  {!trazabilidadResumen.length ? (
                    <div style={{ color: "#64748b", fontWeight: 800 }}>No hay movimientos asociados a este UUID.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      {trazabilidadResumen.map((m, idx) => (
                        <div
                          key={`${m.movimiento_id || idx}-${idx}`}
                          style={{
                            padding: 14,
                            borderRadius: 16,
                            border: "1px solid rgba(15,23,42,0.08)",
                            background: "#fafcff",
                          }}
                        >
                          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>
                            {fmtFecha(m.fecha_movimiento)}
                          </div>
                          <div style={{ marginTop: 6, fontWeight: 800, color: "#0f172a" }}>
                            {m.descripcion || "Movimiento registrado"}
                          </div>
                          <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
                            Cantidad: {fmtNum(m.cantidad)} · Origen: {m.origen_tipo || "—"} · Destino: {m.destino_tipo || "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ ...cardStyle(), marginTop: 20, padding: 18 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
                    Inventario actual del lote
                  </div>

                  {!trazabilidadData.inventario_actual?.length ? (
                    <div style={{ color: "#64748b", fontWeight: 800 }}>
                      El lote no tiene inventario disponible actualmente.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={thStyle()}>Zona</th>
                            <th style={thStyle()}>Tamaño</th>
                            <th style={thStyle()}>Cantidad disponible</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trazabilidadData.inventario_actual.map((inv, idx) => (
                            <tr key={idx}>
                              <td style={tdStyle()}>{inv.zona || "—"}</td>
                              <td style={tdStyle()}>{inv.tamano || "—"}</td>
                              <td style={tdStyle()}>{fmtNum(inv.cantidad_disponible)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <EmptyState text="Introduce un UUID para generar el informe de trazabilidad." />
            )}
          </>
        )}

        {activeReport === "distribucion" && (
          <>
            <div
              style={{
                marginTop: 22,
                display: "grid",
                gridTemplateColumns: "minmax(360px, 1fr) auto auto",
                gap: 18,
                alignItems: "end",
              }}
            >
              <div ref={productoSearchRef} style={{ position: "relative", minWidth: 0 }}>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Buscar producto</div>
                <input
                  value={productoSearch}
                  onChange={(e) => {
                    setProductoSearch(e.target.value);
                    setSelectedProducto(null);
                    setShowProductoDropdown(true);
                  }}
                  onFocus={() => setShowProductoDropdown(true)}
                  placeholder="Escribe nombre natural, científico, categoría o subcategoría"
                  style={softInputStyle()}
                />

                {showProductoDropdown && filteredProductos.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 10px)",
                      left: 0,
                      right: 0,
                      zIndex: 20,
                      maxHeight: 280,
                      overflowY: "auto",
                      background: "white",
                      border: "2px solid #334155",
                      borderRadius: 14,
                      boxShadow: "0 18px 40px rgba(2,6,23,0.12)",
                    }}
                  >
                    {filteredProductos.map((p) => {
                      const label = p.nombre_natural || p.nombre_cientifico || `Producto #${p.id}`;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => onSelectProducto(p)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "12px 14px",
                            border: "none",
                            borderBottom: "1px solid rgba(15,23,42,0.06)",
                            background: "white",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ fontWeight: 900, color: "#0f172a" }}>{label}</div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                            {p.nombre_cientifico || "—"} · {p.categoria || "—"} · {p.subcategoria || "—"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button onClick={onBuscarDistribucion} disabled={loading} style={primaryBtnStyle(loading)}>
                {loading ? "Generando..." : "Generar informe"}
              </button>

              <button onClick={onNuevaBusquedaDistribucion} style={secondaryBtnStyle()}>
                Nueva búsqueda
              </button>
            </div>

            {distribucionData ? (
              <>
                <div style={{ ...cardStyle(), marginTop: 20, padding: 18 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>Resumen</div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(160px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Producto</div>
                      <div style={{ fontWeight: 800 }}>
                        {distribucionData.producto_nombre || `Producto #${distribucionData.producto_id || "—"}`}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Stock total</div>
                      <div style={{ fontWeight: 800 }}>{fmtNum(distribucionData.stock_total)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Ubicaciones activas</div>
                      <div style={{ fontWeight: 800 }}>{fmtNum(distribucionData.distribucion?.length || 0)}</div>
                    </div>
                  </div>
                </div>

                <div style={{ ...cardStyle(), marginTop: 20, padding: 18 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
                    Distribución dentro del vivero
                  </div>

                  {!distribucionData.distribucion?.length ? (
                    <div style={{ color: "#64748b", fontWeight: 800 }}>No hay inventario disponible para ese producto.</div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={thStyle()}>Zona</th>
                            <th style={thStyle()}>Tamaño</th>
                            <th style={thStyle()}>Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {distribucionData.distribucion.map((row, idx) => (
                            <tr key={idx}>
                              <td style={tdStyle()}>{row.zona || "—"}</td>
                              <td style={tdStyle()}>{row.tamano || "—"}</td>
                              <td style={tdStyle()}>{fmtNum(row.cantidad)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <EmptyState text="Escribe y selecciona un producto para ver su distribución dentro del vivero." />
            )}
          </>
        )}

        {activeReport === "stock" && (
          <>
            <div
              style={{
                marginTop: 22,
                display: "grid",
                gridTemplateColumns: "minmax(260px, 1.2fr) minmax(220px, 1fr) minmax(220px, 1fr) auto auto",
                gap: 18,
                alignItems: "end",
              }}
            >
              <div>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Buscar</div>
                <input
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                  placeholder="Producto, categoría o subcategoría"
                  style={softInputStyle()}
                />
              </div>

              <div>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Categoría</div>
                <select
                  value={stockCategoriaFilter}
                  onChange={(e) => {
                    setStockCategoriaFilter(e.target.value);
                    setStockSubcategoriaFilter("");
                  }}
                  style={softInputStyle()}
                >
                  <option value="">Todas</option>
                  {stockCategoriasDisponibles.map((categoria) => (
                    <option key={categoria} value={categoria}>{categoria}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Subcategoría</div>
                <select
                  value={stockSubcategoriaFilter}
                  onChange={(e) => setStockSubcategoriaFilter(e.target.value)}
                  style={softInputStyle()}
                >
                  <option value="">Todas</option>
                  {stockSubcategoriasDisponibles.map((subcategoria) => (
                    <option key={subcategoria} value={subcategoria}>{subcategoria}</option>
                  ))}
                </select>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minHeight: 48,
                  padding: "0 4px",
                  fontWeight: 900,
                  color: "#0f172a",
                  whiteSpace: "nowrap",
                }}
              >
                <input
                  type="checkbox"
                  checked={stockOnlyLow}
                  onChange={(e) => setStockOnlyLow(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                Productos con bajo stock
              </label>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button onClick={onBuscarStock} disabled={loading} style={primaryBtnStyle(loading)}>
                  {loading ? "Actualizando..." : "Actualizar"}
                </button>

                <button onClick={onLimpiarFiltrosStock} style={secondaryBtnStyle()}>
                  Limpiar filtros
                </button>
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
                gap: 16,
              }}
            >
              <div style={{ ...cardStyle(), padding: 18 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Categorías visibles</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", marginTop: 6 }}>
                  {fmtNum(stockSummary.totalCategorias)}
                </div>
              </div>
              <div style={{ ...cardStyle(), padding: 18 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Productos visibles</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", marginTop: 6 }}>
                  {fmtNum(stockSummary.totalProductos)}
                </div>
              </div>
              <div style={{ ...cardStyle(), padding: 18 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Stock total visible</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", marginTop: 6 }}>
                  {fmtNum(stockSummary.totalStock)}
                </div>
              </div>
              <div style={{ ...cardStyle(), padding: 18 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Bajo stock</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#b91c1c", marginTop: 6 }}>
                  {fmtNum(stockSummary.totalBajoStock)}
                </div>
              </div>
            </div>

            {stockGroupedByCategory.length === 0 ? (
              <EmptyState text="No hay productos que coincidan con los filtros seleccionados." />
            ) : (
              <div style={{ display: "grid", gap: 18, marginTop: 20 }}>
                {stockGroupedByCategory.map((group) => (
                  <div key={group.categoria} style={{ ...cardStyle(), padding: 18 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        flexWrap: "wrap",
                        marginBottom: 14,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{group.categoria}</div>
                        <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
                          {fmtNum(group.totalProductos)} productos · Stock total: {fmtNum(group.stockTotal)} · Bajo stock: {fmtNum(group.bajoStock)}
                        </div>
                      </div>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={thStyle()}>Producto</th>
                            <th style={thStyle()}>Subcategoría</th>
                            <th style={thStyle()}>Stock actual</th>
                            <th style={thStyle()}>Stock mínimo</th>
                            <th style={thStyle()}>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map((item) => (
                            <tr key={item.id}>
                              <td style={tdStyle()}>{item.nombre}</td>
                              <td style={tdStyle()}>{item.subcategoria}</td>
                              <td style={tdStyle()}>{fmtNum(item.stockActual)}</td>
                              <td style={tdStyle()}>{fmtNum(item.stockMinimo)}</td>
                              <td style={tdStyle()}><StockBadge estado={item.estado} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeReport === "caducidad" && (
          <>
            <div
              style={{
                marginTop: 22,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button onClick={onBuscarCaducidad} disabled={loading} style={primaryBtnStyle(loading)}>
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
            </div>

            <div
              style={{
                marginTop: 20,
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(200px, 1fr))",
                gap: 16,
              }}
            >
              <div style={{ ...cardStyle(), padding: 18 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Total registros</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", marginTop: 6 }}>
                  {fmtNum(caducidadSummary.totalItems)}
                </div>
              </div>
              <div style={{ ...cardStyle(), padding: 18 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Caducados</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#b91c1c", marginTop: 6 }}>
                  {fmtNum(caducidadSummary.totalCaducados)}
                </div>
              </div>
              <div style={{ ...cardStyle(), padding: 18 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Próximos a caducar</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#92400e", marginTop: 6 }}>
                  {fmtNum(caducidadSummary.totalProximos)}
                </div>
              </div>
              <div style={{ ...cardStyle(), padding: 18 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Vigentes</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#047857", marginTop: 6 }}>
                  {fmtNum(caducidadSummary.totalVigentes)}
                </div>
              </div>
            </div>

            {caducidadItems.length === 0 ? (
              <EmptyState text="No hay productos con fecha de caducidad para mostrar." />
            ) : (
              <div style={{ ...cardStyle(), marginTop: 20, padding: 18 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
Productos con fecha de caducidad
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thStyle()}>Producto</th>
                        <th style={thStyle()}>Categoría</th>
                        <th style={thStyle()}>Subcategoría</th>
                        <th style={thStyle()}>Zona</th>
                        <th style={thStyle()}>Tamaño</th>
                        <th style={thStyle()}>Cantidad</th>
                        <th style={thStyle()}>Fecha caducidad</th>
                        <th style={thStyle()}>Días</th>
                        <th style={thStyle()}>Estado</th>
                        <th style={thStyle()}>UUID lote</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caducidadItems.map((item) => (
                        <tr key={item.id}>
                          <td style={tdStyle()}>{item.nombre}</td>
                          <td style={tdStyle()}>{item.categoria}</td>
                          <td style={tdStyle()}>{item.subcategoria}</td>
                          <td style={tdStyle()}>{item.zona}</td>
                          <td style={tdStyle()}>{item.tamano}</td>
                          <td style={tdStyle()}>{fmtNum(item.cantidad)}</td>
                          <td style={tdStyle()}>{fmtFechaSolo(item.fechaCaducidad)}</td>
                          <td style={tdStyle()}>{item.diasRestantes}</td>
                          <td style={tdStyle()}><CaducidadBadge estado={item.estado} /></td>
                          <td style={tdStyle()}>{item.loteUuid}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}


        {activeReport === "prestamos" && (
          <>
            <div
              style={{
                marginTop: 22,
                display: "grid",
                gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1fr) minmax(180px, 180px) minmax(180px, 1fr) minmax(180px, 1fr) auto auto",
                gap: 18,
                alignItems: "end",
              }}
            >
              <div>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Producto</div>
                <input
                  value={prestamoProductoFilter}
                  onChange={(e) => setPrestamoProductoFilter(e.target.value)}
                  placeholder="Buscar por producto"
                  style={softInputStyle()}
                />
              </div>

              <div>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Solicitante / destino</div>
                <input
                  value={prestamoSolicitanteFilter}
                  onChange={(e) => setPrestamoSolicitanteFilter(e.target.value)}
                  placeholder="Solicitante o destinatario"
                  style={softInputStyle()}
                />
              </div>

              <div>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Estado</div>
                <select
                  value={prestamoEstadoFilter}
                  onChange={(e) => setPrestamoEstadoFilter(e.target.value)}
                  style={softInputStyle()}
                >
                  <option value="">Todos</option>
                  <option value="Activo">Activo</option>
                  <option value="Devuelto">Devuelto</option>
                </select>
              </div>

              <div>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Fecha desde</div>
                <input
                  type="date"
                  value={prestamoFechaDesde}
                  onChange={(e) => setPrestamoFechaDesde(e.target.value)}
                  style={softInputStyle()}
                />
              </div>

              <div>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Fecha hasta</div>
                <input
                  type="date"
                  value={prestamoFechaHasta}
                  onChange={(e) => setPrestamoFechaHasta(e.target.value)}
                  style={softInputStyle()}
                />
              </div>

              <button onClick={onActualizarPrestamos} disabled={loading} style={primaryBtnStyle(loading)}>
                {loading ? "Actualizando..." : "Actualizar"}
              </button>

              <button onClick={onLimpiarPrestamos} style={secondaryBtnStyle()}>
                Limpiar filtros
              </button>
            </div>

            <div
              style={{
                marginTop: 20,
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(200px, 1fr))",
                gap: 16,
              }}
            >
              <div style={{ ...cardStyle(), padding: 18 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Préstamos visibles</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", marginTop: 6 }}>
                  {fmtNum(prestamosSummary.totalPrestamos)}
                </div>
              </div>
              <div style={{ ...cardStyle(), padding: 18 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Activos</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#1d4ed8", marginTop: 6 }}>
                  {fmtNum(prestamosSummary.totalActivos)}
                </div>
              </div>
              <div style={{ ...cardStyle(), padding: 18 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 900 }}>Devueltos</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#047857", marginTop: 6 }}>
                  {fmtNum(prestamosSummary.totalDevueltos)}
                </div>
              </div>
            </div>

            {prestamosItems.length === 0 ? (
              <EmptyState text="No hay préstamos que coincidan con los filtros seleccionados." />
            ) : (
              <div style={{ ...cardStyle(), marginTop: 20, padding: 18 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
                  Préstamos
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thStyle()}>Pedido</th>
                        <th style={thStyle()}>Fecha</th>
                        <th style={thStyle()}>Solicitante</th>
                        <th style={thStyle()}>Destino</th>
                        <th style={thStyle()}>Elementos</th>
                        <th style={thStyle()}>Prestado</th>
                        <th style={thStyle()}>Devuelto</th>
                        <th style={thStyle()}>Pendiente</th>
                        <th style={thStyle()}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prestamosItems.map((item) => (
                        <tr key={item.id}>
                          <td style={tdStyle()}>#{item.pedidoId}</td>
                          <td style={tdStyle()}>{fmtFecha(item.fechaPrestamo)}</td>
                          <td style={tdStyle()}>{item.solicitante}</td>
                          <td style={tdStyle()}>{item.destinatario}</td>
                          <td style={tdStyle()}>
                            <div style={{ display: "grid", gap: 8 }}>
                              {item.lineas.map((linea) => (
                                <div key={linea.key}>
                                  <div style={{ fontWeight: 900, color: "#0f172a" }}>
                                    {linea.producto}
                                  </div>
                                  <div style={{ color: "#64748b", fontWeight: 700, marginTop: 2 }}>
                                    Tamaño: {linea.tamano} · Pedido: {fmtNum(linea.cantidadPedida)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td style={tdStyle()}>{fmtNum(item.totalPrestado)}</td>
                          <td style={tdStyle()}>{fmtNum(item.totalDevuelto)}</td>
                          <td style={tdStyle()}>{fmtNum(item.totalPendiente)}</td>
                          <td style={tdStyle()}><PrestamoBadge estado={item.estado} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {activeReport === "externos" && (
          <>
            <div
              style={{
                marginTop: 22,
                display: "grid",
                gridTemplateColumns: "repeat(6, minmax(170px, 1fr))",
                gap: 22,
                rowGap: 20,
                alignItems: "end",
              }}
            >
              <div>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Fecha desde</div>
                <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} style={softInputStyle()} />
              </div>

              <div>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Fecha hasta</div>
                <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} style={softInputStyle()} />
              </div>

              <div>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Distrito</div>
                <select
                  value={distrito}
                  onChange={(e) => {
                    setDistrito(e.target.value);
                    setBarrio("");
                  }}
                  style={softInputStyle()}
                >
                  <option value="">Todos</option>
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Barrio</div>
                <select
                  value={barrio}
                  onChange={(e) => setBarrio(e.target.value)}
                  style={softInputStyle()}
                  disabled={!distrito}
                >
                  <option value="">{distrito ? "Todos" : "Selecciona distrito"}</option>
                  {barriosDisponibles.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Dirección</div>
                <input
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Déjalo en blanco o escribe dirección"
                  style={softInputStyle()}
                />
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button onClick={onBuscarExternos} disabled={loading} style={primaryBtnStyle(loading)}>
                  {loading ? "Generando..." : "Buscar"}
                </button>
                <button onClick={onNuevaBusquedaExternos} style={secondaryBtnStyle()}>
                  Nueva búsqueda
                </button>
              </div>
            </div>

            {externosSearched && externosData.length === 0 ? (
              <EmptyState text="No se encontraron coincidencias." />
            ) : !externosSearched ? (
              <EmptyState text="Define los filtros y genera el informe de movimientos externos." />
            ) : (
              <div style={{ ...cardStyle(), marginTop: 20, padding: 18 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
                  Movimientos externos
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thStyle()}>Fecha</th>
                        <th style={thStyle()}>Producto</th>
                        <th style={thStyle()}>Cantidad</th>
                        <th style={thStyle()}>Origen</th>
                        <th style={thStyle()}>Destino</th>
                        <th style={thStyle()}>Ubicación destino</th>
                        <th style={thStyle()}>Registrado por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {externosData.map((row, idx) => (
                        <tr key={idx}>
                          <td style={tdStyle()}>{fmtFecha(row.fecha_movimiento)}</td>
                          <td style={tdStyle()}>{row.producto_nombre}</td>
                          <td style={tdStyle()}>{fmtNum(row.cantidad)}</td>
                          <td style={tdStyle()}>
                            {row.origen_tipo || "—"} {row.zona_origen ? `· ${row.zona_origen}` : ""} {row.tamano_origen ? `· ${row.tamano_origen}` : ""}
                          </td>
                          <td style={tdStyle()}>
                            {row.destino_tipo || "—"} {row.zona_destino ? `· ${row.zona_destino}` : ""} {row.tamano_destino ? `· ${row.tamano_destino}` : ""}
                          </td>
                          <td style={tdStyle()}>
                            {[row.distrito_destino, row.barrio_destino, row.direccion_destino].filter(Boolean).join(" · ") || "—"}
                          </td>
                          <td style={tdStyle()}>{row.created_by || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
