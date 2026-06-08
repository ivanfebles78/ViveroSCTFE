// Utilidades de zonas del vivero.
//
// El servidor puede guardar el identificador de una zona con cualquier
// variante de casing/tildes/separadores (p. ej. "almacen", "Almacen",
// "Almacén", "zona-almacen"). Estas funciones centralizan la normalización
// para comparaciones y la transformación a un nombre legible para la UI.

// Normaliza un id/nombre de zona para comparaciones tolerantes:
// lowercase, sin tildes, sin guiones/espacios y sin el prefijo "zona".
// Equivalente al `_normalize_zona_id` del backend.
export function normalizeZonaCompare(s) {
  return (s || "")
    .toString()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\-\s]/g, "")
    .replace(/^zona/i, "")
    .trim();
}

// Nombre corto para usar dentro de selects/dropdowns.
//   "almacen" / "Almacen" / "Almacén" → "Almacén"
//   "compostaje" / "zonacompostaje" / "Zona Compostaje" → "Zona Compostaje"
//   "1" / "3a" / "10b" → tal cual (el dropdown ya tiene el contexto "Zona").
export function getZonaDisplayName(zonaId) {
  if (zonaId === null || zonaId === undefined || zonaId === "") return "";
  const n = normalizeZonaCompare(zonaId);
  if (n === "almacen") return "Almacén";
  if (n === "compostaje") return "Zona Compostaje";
  return String(zonaId);
}

// Etiqueta completa para usar en frases largas tipo "Vivero · Zona X · …".
// Las zonas numéricas reciben el prefijo "Zona"; las especiales devuelven
// su nombre completo tal cual (porque ya tienen un nombre propio).
export function getZonaLabel(zonaId) {
  if (zonaId === null || zonaId === undefined || zonaId === "") return "";
  const n = normalizeZonaCompare(zonaId);
  if (n === "almacen") return "Almacén";
  if (n === "compostaje") return "Zona Compostaje";
  return `Zona ${zonaId}`;
}
