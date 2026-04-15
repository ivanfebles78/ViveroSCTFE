import React, { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autoTable";

import {
  getDistribucionReporte,
  getMovimientosExternosReporte,
  getStockBajoReporte,
  getTrazabilidadReporte,
  getProductos,
} from "../api/api";

const REPORTS = [
  { key: "trazabilidad", label: "Trazabilidad" },
  { key: "distribucion", label: "Distribución" },
  { key: "stock", label: "Stock bajo" },
  { key: "externos", label: "Movimientos externos" },
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

function fmtNum(value) {
  return Number(value || 0).toLocaleString("es-ES");
}

async function loadImageAsDataUrl(url) {
  const res = await fetch(url);
  const blob = await res.blob();

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

async function savePdfWithDialog(doc, fileName) {
  const blob = doc.output("blob");

  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: "PDF",
          accept: { "application/pdf": [".pdf"] },
        },
      ],
    });

    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  doc.save(fileName);
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

async function addCorporateHeader(doc, title, me) {
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
    const logoDataUrl = await loadImageAsDataUrl("/logo.png");
    doc.addImage(logoDataUrl, "PNG", pageWidth - 34, 6, 18, 18);
  } catch (e) {
    // Si el logo no carga, el PDF sigue generándose sin romperse
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

async function exportReportToPdf({
  activeReport,
  me,
  trazabilidadData,
  distribucionData,
  stockData,
  externosData,
}) {
  const doc = new jsPDF("p", "mm", "a4");

  const reportTitle =
    activeReport === "trazabilidad"
      ? "Reporte de trazabilidad"
      : activeReport === "distribucion"
      ? "Reporte de distribución"
      : activeReport === "stock"
      ? "Reporte de stock bajo"
      : "Reporte de movimientos externos";

  let y = await addCorporateHeader(doc, reportTitle, me);

  const commonHeadStyles = {
    fillColor: [15, 23, 42],
    textColor: [255, 255, 255],
    fontStyle: "bold",
    halign: "left",
  };

  const commonBodyStyles = {
    fontSize: 9.5,
    cellPadding: 2.5,
    textColor: [15, 23, 42],
    overflow: "linebreak",
  };

  const commonAltStyles = {
    fillColor: [248, 250, 252],
  };

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
      styles: commonBodyStyles,
      headStyles: commonHeadStyles,
      alternateRowStyles: commonAltStyles,
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
      styles: { ...commonBodyStyles, fontSize: 8.8 },
      headStyles: commonHeadStyles,
      alternateRowStyles: commonAltStyles,
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
        styles: commonBodyStyles,
        headStyles: commonHeadStyles,
        alternateRowStyles: commonAltStyles,
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
      styles: commonBodyStyles,
      headStyles: commonHeadStyles,
      alternateRowStyles: commonAltStyles,
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
      styles: commonBodyStyles,
      headStyles: commonHeadStyles,
      alternateRowStyles: commonAltStyles,
    });
  }

  if (activeReport === "stock" && stockData) {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [["Parámetro", "Valor"]],
      body: [["Margen de proximidad (%)", fmtNum(stockData.margen_pct)]],
      styles: commonBodyStyles,
      headStyles: commonHeadStyles,
      alternateRowStyles: commonAltStyles,
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      theme: "grid",
      head: [["Producto", "Stock actual", "Mínimo"]],
      body: (stockData.bajo_minimo || []).map((row) => [
        row.producto_nombre,
        fmtNum(row.stock_actual),
        fmtNum(row.stock_minimo),
      ]),
      styles: commonBodyStyles,
      headStyles: commonHeadStyles,
      alternateRowStyles: commonAltStyles,
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      theme: "grid",
      head: [["Producto", "Stock actual", "Mínimo", "Umbral alerta"]],
      body: (stockData.proximos || []).map((row) => [
        row.producto_nombre,
        fmtNum(row.stock_actual),
        fmtNum(row.stock_minimo),
        fmtNum(row.umbral_alerta),
      ]),
      styles: commonBodyStyles,
      headStyles: commonHeadStyles,
      alternateRowStyles: commonAltStyles,
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
      styles: { ...commonBodyStyles, fontSize: 8.5 },
      headStyles: commonHeadStyles,
      alternateRowStyles: commonAltStyles,
    });
  }

  addPageFooter(doc);

  const fileName = `${sanitizeFileName(
    activeReport === "trazabilidad"
      ? "reporte_trazabilidad"
      : activeReport === "distribucion"
      ? "reporte_distribucion"
      : activeReport === "stock"
      ? "reporte_stock_bajo"
      : "reporte_movimientos_externos"
  )}_${new Date().toISOString().slice(0, 10)}.pdf`;

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

  const [uuid, setUuid] = useState("");
  const [trazabilidadData, setTrazabilidadData] = useState(null);

  const [productoSearch, setProductoSearch] = useState("");
  const [selectedProducto, setSelectedProducto] = useState(null);
  const [showProductoDropdown, setShowProductoDropdown] = useState(false);
  const [distribucionData, setDistribucionData] = useState(null);

  const [margenPct, setMargenPct] = useState(20);
  const [stockData, setStockData] = useState(null);

  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [distrito, setDistrito] = useState("");
  const [barrio, setBarrio] = useState("");
  const [direccion, setDireccion] = useState("");
  const [externosData, setExternosData] = useState([]);
  const [externosSearched, setExternosSearched] = useState(false);

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

  useEffect(() => {
    const loadProductos = async () => {
      try {
        const data = await getProductos();
        setProductos(Array.isArray(data) ? data : []);
      } catch {
        setProductos([]);
      }
    };

    loadProductos();

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

  const barriosDisponibles = useMemo(() => {
    return distrito ? DISTRICT_BARRIOS[distrito] || [] : [];
  }, [distrito]);

  const trazabilidadResumen = useMemo(() => {
    if (!trazabilidadData?.movimientos) return [];
    return trazabilidadData.movimientos;
  }, [trazabilidadData]);
  const canExportCurrentReport = useMemo(() => {
    if (activeReport === "trazabilidad") return !!trazabilidadData;
    if (activeReport === "distribucion") return !!distribucionData;
    if (activeReport === "stock") return !!stockData;
    if (activeReport === "externos") return externosSearched;
    return false;
  }, [activeReport, trazabilidadData, distribucionData, stockData, externosSearched]);

  const handleExportPdf = async () => {
    if (!canExportCurrentReport || exporting) return;
    try {
      setExporting(true);
      await exportReportToPdf({
        activeReport,
        me,
        trazabilidadData,
        distribucionData,
        stockData,
        externosData,
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
    const label = producto.nombre_natural || producto.nombre_cientifico || `Producto #${producto.id}`;
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
    setLoading(true);
    try {
      const data = await getStockBajoReporte(Number(margenPct || 20));
      setStockData(data);
      showTimedMessage("Informe de stock generado.", "success");
    } catch (e) {
      setStockData(null);
      showTimedMessage(
        e?.response?.data?.detail || e?.message || "Error generando informe de stock",
        "error"
      );
    } finally {
      setLoading(false);
    }
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
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 44, margin: 0, fontWeight: 900, color: "#0f172a" }}>Informes</h1>
          <div style={{ marginTop: 8, color: "#64748b", fontWeight: 700 }}>
            Trazabilidad, distribución en vivero, stock bajo y movimientos externos.
          </div>
        </div>

        <div
          style={{
            ...cardStyle(),
            padding: "12px 14px",
            color: "#64748b",
            fontWeight: 800,
          }}
        >
          Usuario: <span style={{ color: "#0f172a" }}>{me?.username || "—"}</span> · Rol:{" "}
          <span style={{ color: "#0f172a" }}>{role || "—"}</span>
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

      <div
        style={{
          ...cardStyle(),
          marginTop: 18,
          padding: 18,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
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
                    <div style={{ color: "#64748b", fontWeight: 800 }}>
                      No hay movimientos asociados a este UUID.
                    </div>
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
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>
                  Buscar producto
                </div>
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
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
                    Resumen
                  </div>

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
                    <div style={{ color: "#64748b", fontWeight: 800 }}>
                      No hay inventario disponible para ese producto.
                    </div>
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
                gridTemplateColumns: "220px auto",
                gap: 18,
                alignItems: "end",
              }}
            >
              <div>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>
                  Margen de proximidad (%)
                </div>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={margenPct}
                  onChange={(e) => setMargenPct(e.target.value)}
                  style={softInputStyle()}
                />
              </div>

              <button onClick={onBuscarStock} disabled={loading} style={primaryBtnStyle(loading)}>
                {loading ? "Generando..." : "Generar informe"}
              </button>
            </div>

            {stockData ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 18,
                  marginTop: 20,
                }}
              >
                <div style={{ ...cardStyle(), padding: 18 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
                    Por debajo del mínimo
                  </div>

                  {!stockData.bajo_minimo?.length ? (
                    <div style={{ color: "#64748b", fontWeight: 800 }}>
                      No hay productos por debajo del mínimo.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={thStyle()}>Producto</th>
                            <th style={thStyle()}>Stock actual</th>
                            <th style={thStyle()}>Mínimo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stockData.bajo_minimo.map((row, idx) => (
                            <tr key={idx}>
                              <td style={tdStyle()}>{row.producto_nombre}</td>
                              <td style={tdStyle()}>{fmtNum(row.stock_actual)}</td>
                              <td style={tdStyle()}>{fmtNum(row.stock_minimo)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ ...cardStyle(), padding: 18 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 10 }}>
                    Próximos al mínimo
                  </div>

                  {!stockData.proximos?.length ? (
                    <div style={{ color: "#64748b", fontWeight: 800 }}>
                      No hay productos próximos a llegar al mínimo.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={thStyle()}>Producto</th>
                            <th style={thStyle()}>Stock actual</th>
                            <th style={thStyle()}>Mínimo</th>
                            <th style={thStyle()}>Umbral alerta</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stockData.proximos.map((row, idx) => (
                            <tr key={idx}>
                              <td style={tdStyle()}>{row.producto_nombre}</td>
                              <td style={tdStyle()}>{fmtNum(row.stock_actual)}</td>
                              <td style={tdStyle()}>{fmtNum(row.stock_minimo)}</td>
                              <td style={tdStyle()}>{fmtNum(row.umbral_alerta)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState text="Genera el informe para ver productos bajo mínimo y próximos a reposición." />
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
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  style={softInputStyle()}
                />
              </div>

              <div>
                <div style={{ marginBottom: 8, fontWeight: 900, color: "#0f172a" }}>Fecha hasta</div>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  style={softInputStyle()}
                />
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
                    <option key={d} value={d}>
                      {d}
                    </option>
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
                    <option key={b} value={b}>
                      {b}
                    </option>
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
                            {row.origen_tipo || "—"} {row.zona_origen ? `· ${row.zona_origen}` : ""}{" "}
                            {row.tamano_origen ? `· ${row.tamano_origen}` : ""}
                          </td>
                          <td style={tdStyle()}>
                            {row.destino_tipo || "—"} {row.zona_destino ? `· ${row.zona_destino}` : ""}{" "}
                            {row.tamano_destino ? `· ${row.tamano_destino}` : ""}
                          </td>
                          <td style={tdStyle()}>
                            {[row.distrito_destino, row.barrio_destino, row.direccion_destino]
                              .filter(Boolean)
                              .join(" · ") || "—"}
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