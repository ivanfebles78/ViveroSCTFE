"""
Generador de PDF para pedidos aprobados (módulo de impresión).

Diseño minimalista con cabecera del ayuntamiento, datos del solicitante,
fechas de cada operación (creación, aprobación, servido), detalle de items
y dirección de entrega. Genera el PDF en memoria y lo devuelve como bytes,
listo para servir desde FastAPI con `Response(content=..., media_type=...)`.
"""
from __future__ import annotations

from datetime import datetime
from io import BytesIO
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)


# Dirección del vivero (fija por ahora; cuando exista un segundo vivero,
# convertirla en una columna del pedido).
DIRECCION_VIVERO = "Calle José Fonspertius, 1 · Barrio La Salud · 38008 Santa Cruz de Tenerife"

# Paleta corporativa coherente con la UI
COLOR_PRIMARIO = colors.HexColor("#065F46")  # verde
COLOR_SECUNDARIO = colors.HexColor("#0F172A")  # casi negro
COLOR_GRIS = colors.HexColor("#64748B")
COLOR_GRIS_FONDO = colors.HexColor("#F1F5F9")
COLOR_BORDE = colors.HexColor("#CBD5E1")


def _fmt_fecha(value) -> str:
    """Formato 'dd/mm/aaaa HH:MM' para datetimes; '—' si vacío."""
    if not value:
        return "—"
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y %H:%M")
    return str(value)


def _fmt_cantidad(value) -> str:
    if value is None:
        return "0"
    try:
        f = float(value)
        if f == int(f):
            return str(int(f))
        s = f"{f:.2f}".rstrip("0").rstrip(".")
        return s
    except (TypeError, ValueError):
        return str(value)


def _unidad_para_categoria(categoria: Optional[str], tamano: Optional[str]) -> str:
    """Calcula el sufijo de unidad alineado con `formato.js` del frontend."""
    cat = (categoria or "").strip().lower()
    t = (tamano or "").strip().lower()

    if cat in ("planta", "plantas"):
        return "ud"
    if cat in ("fitosanitario", "fitosanitarios", "fertilizante", "fertilizantes"):
        return "lt" if "liquido" in t or "líquido" in t else "kg"
    if cat in ("arido", "aridos", "árido", "áridos", "material vegetal", "materiales vegetales"):
        return "m³"
    if cat == "ferreteria" or cat == "ferretería":
        return "m" if t == "metros" else "ud"
    return "ud"


def generar_pdf_pedido(pedido) -> bytes:
    """
    Construye el PDF del pedido y devuelve los bytes.

    `pedido` es la instancia ORM de Pedido (con .items cargados). Accede a
    atributos directamente; no asume ningún serializer intermedio para
    poder mostrar campos que no salen al JSON de la API.
    """
    buf = BytesIO()

    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Pedido #{getattr(pedido, 'id', '?')}",
        author="ViverApp",
    )

    styles = getSampleStyleSheet()
    style_title = ParagraphStyle(
        "TitulosViverApp",
        parent=styles["Title"],
        fontSize=20,
        textColor=COLOR_PRIMARIO,
        spaceAfter=4,
        alignment=0,  # left
    )
    style_subtitle = ParagraphStyle(
        "SubtitleViverApp",
        parent=styles["Normal"],
        fontSize=10,
        textColor=COLOR_GRIS,
        spaceAfter=12,
    )
    style_h2 = ParagraphStyle(
        "H2ViverApp",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=COLOR_SECUNDARIO,
        spaceBefore=10,
        spaceAfter=4,
    )
    style_body = ParagraphStyle(
        "BodyViverApp",
        parent=styles["Normal"],
        fontSize=10,
        textColor=COLOR_SECUNDARIO,
        leading=14,
    )
    style_small = ParagraphStyle(
        "SmallViverApp",
        parent=styles["Normal"],
        fontSize=8.5,
        textColor=COLOR_GRIS,
    )

    story = []

    # ===== Cabecera =====
    story.append(Paragraph(
        f"Pedido #{getattr(pedido, 'id', '—')} · "
        f"{(getattr(pedido, 'tipo', '') or 'salida').capitalize()}",
        style_title,
    ))
    story.append(Paragraph(
        "Ayuntamiento de Santa Cruz de Tenerife · ViverApp",
        style_subtitle,
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=COLOR_BORDE))
    story.append(Spacer(1, 10))

    # ===== Bloque: información general =====
    info_general = [
        ["Estado", str(getattr(pedido, "estado", "") or "—")],
        ["Tipo", str(getattr(pedido, "tipo", "") or "—").capitalize()],
        ["Solicitante", str(getattr(pedido, "solicitante_username", "") or getattr(pedido, "created_by", "") or "—")],
        ["Aprobado por", str(getattr(pedido, "aprobado_por", "") or "—")],
        ["Servido por", str(getattr(pedido, "served_by", "") or "—")],
    ]
    t_info = Table(info_general, colWidths=[45 * mm, 130 * mm])
    t_info.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), COLOR_GRIS_FONDO),
        ("TEXTCOLOR", (0, 0), (0, -1), COLOR_GRIS),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.4, COLOR_BORDE),
    ]))
    story.append(t_info)
    story.append(Spacer(1, 12))

    # ===== Bloque: cronología =====
    story.append(Paragraph("Cronología", style_h2))
    cronologia = [
        ["Creado", _fmt_fecha(getattr(pedido, "created_at", None))],
        ["Aprobado", _fmt_fecha(getattr(pedido, "aprobado_at", None))],
        ["Denegado", _fmt_fecha(getattr(pedido, "denegado_at", None))],
        ["Servido", _fmt_fecha(getattr(pedido, "served_at", None))],
        ["Caducidad", _fmt_fecha(getattr(pedido, "fecha_caducidad", None))],
    ]
    t_crono = Table(cronologia, colWidths=[45 * mm, 130 * mm])
    t_crono.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), COLOR_GRIS_FONDO),
        ("TEXTCOLOR", (0, 0), (0, -1), COLOR_GRIS),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.4, COLOR_BORDE),
    ]))
    story.append(t_crono)
    story.append(Spacer(1, 12))

    # ===== Bloque: destino =====
    story.append(Paragraph("Destino de entrega", style_h2))
    tipo = (getattr(pedido, "tipo", "") or "salida").strip().lower()
    if tipo == "reposicion":
        destino_texto = DIRECCION_VIVERO
    else:
        partes = [
            getattr(pedido, "distrito_destino", "") or "",
            getattr(pedido, "barrio_destino", "") or "",
            getattr(pedido, "direccion_destino", "") or "",
        ]
        destino_texto = " · ".join(p for p in partes if p) or "—"
    story.append(Paragraph(destino_texto, style_body))
    story.append(Spacer(1, 12))

    # ===== Bloque: items =====
    story.append(Paragraph("Detalle del pedido", style_h2))
    items = getattr(pedido, "items", []) or []
    if not items:
        story.append(Paragraph("Sin líneas en el pedido.", style_body))
    else:
        data = [["#", "Producto", "Tamaño / Formato", "Cantidad", "Servida"]]
        for idx, item in enumerate(items, start=1):
            prod = getattr(item, "producto", None)
            nombre = getattr(prod, "nombre_cientifico", None) or getattr(prod, "nombre_natural", None) or f"#{getattr(item, 'producto_id', '?')}"
            categoria = getattr(prod, "categoria", None)
            tamano = getattr(item, "tamano", None) or "—"
            unidad = _unidad_para_categoria(categoria, tamano)
            cantidad = f"{_fmt_cantidad(item.cantidad)} {unidad}"
            servida = f"{_fmt_cantidad(item.cantidad_servida)} {unidad}"
            data.append([str(idx), nombre, str(tamano), cantidad, servida])
        t_items = Table(data, colWidths=[10 * mm, 70 * mm, 35 * mm, 30 * mm, 30 * mm])
        t_items.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARIO),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9.5),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (3, 0), (4, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_GRIS_FONDO]),
            ("GRID", (0, 0), (-1, -1), 0.4, COLOR_BORDE),
        ]))
        story.append(t_items)
    story.append(Spacer(1, 12))

    # ===== Bloque: nota =====
    nota = getattr(pedido, "nota", None)
    if nota:
        story.append(Paragraph("Notas del solicitante", style_h2))
        story.append(Paragraph(str(nota), style_body))
        story.append(Spacer(1, 10))

    if (getattr(pedido, "motivo_denegacion", None) or "").strip():
        story.append(Paragraph("Motivo de denegación", style_h2))
        story.append(Paragraph(str(pedido.motivo_denegacion), style_body))
        story.append(Spacer(1, 10))

    # ===== Pie =====
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=0.5, color=COLOR_BORDE))
    story.append(Paragraph(
        f"Documento generado por ViverApp · "
        f"{datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC",
        style_small,
    ))

    doc.build(story)
    return buf.getvalue()
