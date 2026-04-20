"""
Genera usuarios_vivero.png para usar en presentaciones.
Requiere Pillow:  pip install Pillow
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
OUT = "usuarios_vivero.png"

# ---------- HELPERS ----------
def gradient_bg(draw):
    for y in range(H):
        r = int(15 + (30 - 15) * y / H)
        g = int(23 + (41 - 23) * y / H)
        b = int(42 + (59 - 42) * y / H)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

def rounded_rect(draw, box, radius, fill=None, outline=None, width=2):
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def font(size, bold=False):
    names = (["arialbd.ttf", "Arial Bold.ttf"] if bold
             else ["arial.ttf", "Arial.ttf"])
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            continue
    try:
        return ImageFont.truetype("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf", size)
    except OSError:
        return ImageFont.load_default()

def text_centered(draw, xy, text, fnt, fill):
    x, y = xy
    bbox = draw.textbbox((0, 0), text, font=fnt)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    draw.text((x - w // 2, y - h // 2), text, font=fnt, fill=fill)

def persona_icon(img, cx, cy, radius, color_outer, color_inner=(255, 255, 255)):
    # Círculo de fondo con borde blanco
    base = Image.new("RGBA", (radius * 2 + 10, radius * 2 + 10), (0, 0, 0, 0))
    bd = ImageDraw.Draw(base)
    bd.ellipse((5, 5, radius * 2 + 5, radius * 2 + 5), fill=color_outer, outline=(255, 255, 255), width=4)
    # Cabeza
    head_r = int(radius * 0.28)
    head_cx = radius + 5
    head_cy = int(radius * 0.78) + 5
    bd.ellipse(
        (head_cx - head_r, head_cy - head_r, head_cx + head_r, head_cy + head_r),
        fill=color_inner
    )
    # Hombros (triángulo recortado con elipse)
    body_r = int(radius * 0.95)
    body_cx = radius + 5
    body_cy = int(radius * 1.9) + 5
    bd.ellipse(
        (body_cx - body_r, body_cy - int(body_r * 0.7), body_cx + body_r, body_cy + body_r),
        fill=color_inner
    )
    # Recorte inferior para que no se salga del círculo de fondo
    mask = Image.new("L", base.size, 0)
    md = ImageDraw.Draw(mask)
    md.ellipse((5, 5, radius * 2 + 5, radius * 2 + 5), fill=255)
    out = Image.new("RGBA", base.size, (0, 0, 0, 0))
    out.paste(base, (0, 0), mask)
    img.paste(out, (cx - radius - 5, cy - radius - 5), out)

# ---------- BUILD ----------
img = Image.new("RGB", (W, H), (15, 23, 42))
draw = ImageDraw.Draw(img)
gradient_bg(draw)

# Título
text_centered(draw, (W // 2, 90),  "Usuarios del Vivero", font(58, True), (255, 255, 255))
text_centered(draw, (W // 2, 135), "Agrupados por rol en ViverApp", font(22), (148, 163, 184))
# Línea acento
draw.line([(760, 165), (1160, 165)], fill=(6, 182, 212), width=3)

# Colores por rol
COLOR_ADMIN   = (180, 83, 9)     # dorado
COLOR_MANAGER = (4, 120, 87)     # verde
COLOR_GESTOR  = (91, 33, 182)    # morado
COLOR_TECNICO = (3, 105, 161)    # azul
COLOR_EXTERNA = (157, 23, 77)    # rosa

BORDER_ADMIN   = (251, 191, 36)
BORDER_MANAGER = (52, 211, 153)
BORDER_GESTOR  = (167, 139, 250)
BORDER_TECNICO = (56, 189, 248)
BORDER_EXTERNA = (244, 114, 182)

CARD_BG = (255, 255, 255, 10)  # se pinta con fondo semitransparente

def role_card(box, titulo, subtitulo, color_titulo, border_color, usuarios, color_icon):
    x0, y0, x1, y1 = box
    # tarjeta
    rounded_rect(draw, box, 24, fill=None, outline=border_color, width=2)
    # fondo muy suave
    overlay = Image.new("RGBA", (x1 - x0, y1 - y0), (255, 255, 255, 10))
    img.paste(overlay, (x0, y0), overlay)
    # título
    cx = (x0 + x1) // 2
    text_centered(draw, (cx, y0 + 35), titulo, font(28, True), color_titulo)
    text_centered(draw, (cx, y0 + 72), subtitulo, font(14, True), tuple(min(255, c + 40) for c in color_titulo))
    # iconos
    n = len(usuarios)
    card_w = x1 - x0
    icon_r = 50
    spacing = 200
    total_w = (n - 1) * spacing
    start_x = cx - total_w // 2
    for i, nombre in enumerate(usuarios):
        ix = start_x + i * spacing
        iy = y0 + 170
        persona_icon(img, ix, iy, icon_r, color_icon)
        text_centered(draw, (ix, iy + 85), nombre, font(24, True), (255, 255, 255))
    # contador
    text_centered(
        draw, (cx, y1 - 30),
        f"{n} usuario{'s' if n != 1 else ''}",
        font(14), (148, 163, 184)
    )

# --- ROW 1 ---
role_card((120, 210, 480, 570),  "ADMIN", "Acceso total al sistema",
          BORDER_ADMIN, BORDER_ADMIN, ["ivan"], COLOR_ADMIN)

role_card((520, 210, 1200, 570), "MANAGER", "Aprueban pedidos y supervisan",
          BORDER_MANAGER, BORDER_MANAGER, ["miriam", "maria", "desi"], COLOR_MANAGER)

role_card((1240, 210, 1800, 570),"GESTOR DE VIVERO", "Coordina operativa del vivero",
          BORDER_GESTOR, BORDER_GESTOR, ["francis"], COLOR_GESTOR)

# --- ROW 2 ---
role_card((120, 620, 1040, 980), "TÉCNICO", "Registran movimientos y tareas en planta",
          BORDER_TECNICO, BORDER_TECNICO, ["elisa", "susana", "medina", "roberto"], COLOR_TECNICO)

role_card((1080, 620, 1800, 980), "EMPRESA EXTERNA", "Acceso limitado a catálogo y pedidos propios",
          BORDER_EXTERNA, BORDER_EXTERNA, ["ute"], COLOR_EXTERNA)

# Footer
text_centered(draw, (W // 2, 1040), "ViverApp  ·  10 usuarios activos  ·  5 roles", font(16, True), (100, 116, 139))

img.save(OUT, "PNG", optimize=True)
print(f"Generado: {OUT}  ({W}x{H})")
