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

# Per-item state colours.  Same logic as the UI badges — green for
# APROBADO, ámbar for RESERVA (pendiente), rojo for DENEGADO.
COLOR_APROBADO_BG = colors.HexColor("#DCFCE7")   # green-100
COLOR_APROBADO_FG = colors.HexColor("#065F46")   # green-800
COLOR_RESERVA_BG  = colors.HexColor("#FEF3C7")   # amber-100
COLOR_RESERVA_FG  = colors.HexColor("#92400E")   # amber-800
COLOR_DENEGADO_BG = colors.HexColor("#FEE2E2")   # red-100
COLOR_DENEGADO_FG = colors.HexColor("#991B1B")   # red-800


def _item_estado_label(estado_item: Optional[str]) -> tuple[str, "colors.Color", "colors.Color"]:
    """Map a per-item state to (label, background, foreground) for the PDF
    cell.  Legacy data without `estado_item` is treated as Aprobado, because
    the pedido must already be APROBADO/SERVIDO to be reaching the PDF
    endpoint at all.
    """
    e = (str(estado_item or "APROBADO").strip().upper())
    if e == "APROBADO":
        return ("Aprobado", COLOR_APROBADO_BG, COLOR_APROBADO_FG)
    if e == "DENEGADO":
        return ("Denegado", COLOR_DENEGADO_BG, COLOR_DENEGADO_FG)
    # RESERVA y cualquier otro estado intermedio → pendiente
    return ("Pendiente", COLOR_RESERVA_BG, COLOR_RESERVA_FG)


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
        # Pre-compute per-item state for the table + summary.
        item_states = []
        n_aprobado = n_reserva = n_denegado = 0
        for item in items:
            label, bg, fg = _item_estado_label(getattr(item, "estado_item", None))
            item_states.append((label, bg, fg))
            if label == "Aprobado":
                n_aprobado += 1
            elif label == "Denegado":
                n_denegado += 1
            else:
                n_reserva += 1

        # Show a small summary line above the table when the pedido isn't
        # fully aprobado — useful for partial approvals so the proveedor
        # knows at a glance how many lines apply to them vs which are
        # still pending or denied.
        if n_reserva or n_denegado:
            resumen_parts = []
            if n_aprobado: resumen_parts.append(f"<b><font color='#065F46'>{n_aprobado} aprobado{'s' if n_aprobado != 1 else ''}</font></b>")
            if n_reserva:  resumen_parts.append(f"<b><font color='#92400E'>{n_reserva} pendiente{'s' if n_reserva != 1 else ''}</font></b>")
            if n_denegado: resumen_parts.append(f"<b><font color='#991B1B'>{n_denegado} denegado{'s' if n_denegado != 1 else ''}</font></b>")
            resumen = " · ".join(resumen_parts)
            story.append(Paragraph(
                f"Este pedido tiene aprobación parcial: {resumen}.",
                style_body,
            ))
            story.append(Spacer(1, 4))

        data = [["#", "Producto", "Tamaño / Formato", "Cantidad", "Servida", "Estado"]]
        # Track which body rows are which state so we can paint per-row
        # backgrounds on the STATUS cell.
        per_row_styles = []
        for idx, item in enumerate(items, start=1):
            prod = getattr(item, "producto", None)
            nombre = getattr(prod, "nombre_cientifico", None) or getattr(prod, "nombre_natural", None) or f"#{getattr(item, 'producto_id', '?')}"
            categoria = getattr(prod, "categoria", None)
            tamano = getattr(item, "tamano", None) or "—"
            unidad = _unidad_para_categoria(categoria, tamano)
            cantidad = f"{_fmt_cantidad(item.cantidad)} {unidad}"
            servida = f"{_fmt_cantidad(item.cantidad_servida)} {unidad}"

            label, bg, fg = item_states[idx - 1]
            data.append([str(idx), nombre, str(tamano), cantidad, servida, label])
            per_row_styles.append((idx, bg, fg, label == "Denegado"))

        # New column layout: 175 mm total = 10 + 56 + 30 + 26 + 26 + 27
        t_items = Table(data, colWidths=[10 * mm, 56 * mm, 30 * mm, 26 * mm, 26 * mm, 27 * mm])
        base_style = [
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARIO),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9.5),
            ("FONTSIZE", (0, 1), (-1, -1), 9),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (3, 0), (4, -1), "RIGHT"),
            ("ALIGN", (5, 0), (5, -1), "CENTER"),
            ("FONTNAME", (5, 1), (5, -1), "Helvetica-Bold"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_GRIS_FONDO]),
            ("GRID", (0, 0), (-1, -1), 0.4, COLOR_BORDE),
        ]
        # Paint the Estado cell with the state colour for every row.  For
        # DENEGADO rows additionally grey-out the whole row's text so it
        # reads as "no aplica" at a glance.
        for row_idx, bg, fg, is_denegado in per_row_styles:
            base_style.append(("BACKGROUND", (5, row_idx), (5, row_idx), bg))
            base_style.append(("TEXTCOLOR", (5, row_idx), (5, row_idx), fg))
            if is_denegado:
                base_style.append(("TEXTCOLOR", (0, row_idx), (4, row_idx), COLOR_GRIS))
        t_items.setStyle(TableStyle(base_style))
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
