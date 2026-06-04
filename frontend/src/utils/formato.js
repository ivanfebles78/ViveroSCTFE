// Configuración por producto del control "tamaño/formato" y "cantidad" en
// formularios de movimientos y pedidos.
//
// La columna `tamano` en BD sigue siendo un String y guarda tanto los tamaños
// de maceta clásicos ("M12", "M20", "M35", "Semillero") como los nuevos
// formatos ("Líquido", "metros cúbicos", "metros", "unidades", etc.).

export const PLANTA_TAMANOS = ["Semillero", "M12", "M20", "M35"];

export const FORMATOS_FITOSANITARIO = [
  "Polvo Seco",
  "Polvo Dispersable",
  "Polvo Soluble",
  "Líquido",
  "Pasta",
  "Granulado",
];

// Productos de ferretería que se piden por metros (no por unidades).
// Match por substring case+accent-insensitive sobre nombre_cientifico o
// nombre_natural. Añade más entradas aquí si surgen nuevos casos.
const FERRETERIA_EN_METROS_NEEDLES = [
  "alambre 4.8",
  "malla de gallinero verde",
  "malla gallinero verde",
  "cinturones de 3.5",
  "cinturon de 3.5",
  "cinturones 3.5",
  "cinturon 3.5",
];

function normalize(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes
    .toLowerCase()
    .trim();
}

function categoryIs(cat, ...candidates) {
  const c = normalize(cat);
  return candidates.some((cand) => {
    const n = normalize(cand);
    if (c === n) return true;
    // tolerar singular/plural simple ("planta" ≈ "plantas")
    if (c + "s" === n) return true;
    if (c === n + "s") return true;
    return false;
  });
}

function nameMatchesAny(name, needles) {
  const n = normalize(name);
  return needles.some((needle) => n.includes(normalize(needle)));
}

/**
 * Devuelve cómo renderizar el control de formato/tamaño y cantidad para el
 * producto seleccionado.
 *
 * @returns {{
 *   kind: "tamano" | "formato_dropdown" | "formato_fijo",
 *   label: string,
 *   options?: string[],
 *   value?: string,
 *   showCantidad: boolean,
 *   cantidadLabel: string | null,
 *   observacionesRequired: boolean,
 *   observacionesHint: string | null,
 * }}
 */
export function getProductFormatoConfig(product) {
  // Sin producto seleccionado: usa defaults tipo planta para que el formulario
  // tenga estado válido inicial.
  if (!product) {
    return {
      kind: "tamano",
      label: "Tamaño",
      options: PLANTA_TAMANOS,
      showCantidad: true,
      cantidadLabel: "Cantidad",
      observacionesRequired: false,
      observacionesHint: null,
    };
  }

  const cat = product.categoria;
  const nombre =
    product.nombre_cientifico ||
    product.nombre_natural ||
    product.nombre ||
    "";

  if (categoryIs(cat, "planta")) {
    return {
      kind: "tamano",
      label: "Tamaño",
      options: PLANTA_TAMANOS,
      showCantidad: true,
      cantidadLabel: "Cantidad",
      observacionesRequired: false,
      observacionesHint: null,
    };
  }

  if (categoryIs(cat, "fitosanitario", "fertilizante")) {
    return {
      kind: "formato_dropdown",
      label: "Formato",
      options: FORMATOS_FITOSANITARIO,
      showCantidad: false,
      cantidadLabel: null,
      observacionesRequired: true,
      observacionesHint:
        "Indica aquí la cantidad exacta y el envase (ej: 5L, 500g, 2 botes de 1kg).",
    };
  }

  if (categoryIs(cat, "arido", "material vegetal")) {
    return {
      kind: "formato_fijo",
      label: "Formato",
      value: "metros cúbicos",
      showCantidad: true,
      cantidadLabel: "Cantidad (m³)",
      observacionesRequired: false,
      observacionesHint: null,
    };
  }

  if (categoryIs(cat, "ferreteria")) {
    if (nameMatchesAny(nombre, FERRETERIA_EN_METROS_NEEDLES)) {
      return {
        kind: "formato_fijo",
        label: "Formato",
        value: "metros",
        showCantidad: true,
        cantidadLabel: "Cantidad (m)",
        observacionesRequired: false,
        observacionesHint: null,
      };
    }
    return {
      kind: "formato_fijo",
      label: "Formato",
      value: "unidades",
      showCantidad: true,
      cantidadLabel: "Cantidad",
      observacionesRequired: false,
      observacionesHint: null,
    };
  }

  // Fallback (categoría desconocida): comportamiento de planta.
  return {
    kind: "tamano",
    label: "Tamaño",
    options: PLANTA_TAMANOS,
    showCantidad: true,
    cantidadLabel: "Cantidad",
    observacionesRequired: false,
    observacionesHint: null,
  };
}

/**
 * Devuelve la lista de opciones que debería aparecer en un select de
 * tamaño/formato dado el formatoConfig. Útil para combinar con el filtrado
 * por stock.
 */
export function getFormatoOptions(formatoConfig) {
  if (!formatoConfig) return PLANTA_TAMANOS;
  if (formatoConfig.kind === "tamano") return formatoConfig.options || PLANTA_TAMANOS;
  if (formatoConfig.kind === "formato_dropdown") return formatoConfig.options || [];
  if (formatoConfig.kind === "formato_fijo") return [formatoConfig.value];
  return PLANTA_TAMANOS;
}
