// Configuración por producto del control "tamaño/formato" y "cantidad" en
// formularios de movimientos y pedidos.
//
// La columna `tamano` en BD sigue siendo un String y guarda tanto los tamaños
// de maceta clásicos ("M12", "M20", "M35", "Semillero") como los nuevos
// formatos ("Líquido", "metros cúbicos", "metros", "unidades", etc.).

export const PLANTA_TAMANOS = ["Semillero", "M12", "M20", "M35"];

// Reglas de disponibilidad por tamaño de maceta para PLANTAS (coherentes con el
// backend _tamano_disponible_planta): semillero nunca cuenta como disponible;
// arbustos solo M20/M35; árboles y palmeras solo M35; resto de plantas
// M12/M20/M35. No aplica a productos que no sean plantas.
const _normTxt = (s) =>
  String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

export function tamanoDisponiblePlanta(producto, tamano) {
  const cat = _normTxt(producto?.categoria);
  if (cat !== "planta" && cat !== "plantas") return true;
  let t = _normTxt(tamano);
  if (t === "m30") t = "m35";
  if (t === "" || t === "semillero") return false;
  const sub = _normTxt(producto?.subcategoria);
  if (sub === "arbusto") return t === "m20" || t === "m35";
  if (sub === "arbol" || sub === "palmera") return t === "m35";
  return t === "m12" || t === "m20" || t === "m35";
}

// Días de maduración por defecto (fecha de disponibilidad futura) según el tipo
// de planta: arbustos 30, árboles/palmeras 90. Otros/no plantas: 0 (no aplica).
export function diasMaduracion(producto) {
  const cat = _normTxt(producto?.categoria);
  if (cat !== "planta" && cat !== "plantas") return 0;
  const sub = _normTxt(producto?.subcategoria);
  if (sub === "arbusto") return 30;
  if (sub === "arbol" || sub === "palmera") return 90;
  return 0;
}

const _TAM_ORDER = { semillero: 0, m12: 1, m20: 2, m35: 3 };
function _tamIdx(t) {
  let k = _normTxt(t);
  if (k === "m30") k = "m35";
  return k in _TAM_ORDER ? _TAM_ORDER[k] : -1;
}

function _hoyMasDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Fecha de disponibilidad futura POR DEFECTO (YYYY-MM-DD) o "" si no aplica.
 * Reglas:
 *   - Entrada de PRODUCCIÓN PROPIA de arbusto (+30) o árbol/palmera (+90).
 *   - Traslado con SUBIDA de tamaño hasta el tamaño "listo" del tipo:
 *       arbusto → M20 (+30 desde Semillero/M12),
 *       árbol/palmera → M35 (+90 desde Semillero/M12/M20).
 * El valor devuelto es solo un valor por defecto: el usuario puede cambiarlo o
 * borrarlo al hacer el movimiento.
 */
export function fechaDisponibilidadPorDefecto(producto, { tipo, origen, tamanoOrigen, tamanoDestino } = {}) {
  const dias = diasMaduracion(producto);
  if (!dias) return "";
  const t = _normTxt(tipo);
  const sub = _normTxt(producto?.subcategoria);
  const umbral = sub === "arbusto" ? "m20" : "m35";

  if (t === "entrada") {
    if (_normTxt(origen) !== "produccion propia") return "";
    return _hoyMasDias(dias);
  }
  if (t === "traslado" || t === "traslado_interno") {
    const destOk = _tamIdx(tamanoDestino) === _tamIdx(umbral) && _tamIdx(umbral) >= 0;
    const sube = _tamIdx(tamanoOrigen) >= 0 && _tamIdx(tamanoOrigen) < _tamIdx(umbral);
    return destOk && sube ? _hoyMasDias(dias) : "";
  }
  return "";
}

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

// Productos de Árido / Material vegetal que se cuentan por UNIDADES (sacos,
// bolsas), no por m³. P. ej. la turba embolsada ("Turba 250L", "Turba 750L").
// Match por substring case+accent-insensitive sobre el nombre. Añade más
// entradas aquí si surgen nuevos casos.
const ARIDO_MATVEG_EN_UNIDADES_NEEDLES = [
  "turba",
];

function normalize(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes
    .toLowerCase()
    .trim();
}

// Formato/tamaño A MOSTRAR, corrigiendo el histórico: la turba se guardó como
// "metros cúbicos" cuando iba en m³, pero se cuenta por unidades. Si el producto
// es turba (u otro de la lista de excepciones), mostramos "unidades".
export function displayFormato(nombre, tamano) {
  const t = normalize(tamano);
  if (t === "metros cubicos" && nameMatchesAny(nombre || "", ARIDO_MATVEG_EN_UNIDADES_NEEDLES)) {
    return "unidades";
  }
  return tamano;
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
      showCantidad: true,
      // La etiqueta de la cantidad depende del formato seleccionado en runtime.
      // Líquido → Litros, todos los demás → Kg.
      cantidadLabel: "Kg",
      getCantidadLabel: (formato) =>
        (formato || "").trim().toLowerCase() === "líquido" ? "Litros" : "Kg",
      allowDecimals: true,
      observacionesRequired: false,
      observacionesHint:
        "Opcional. Útil para anotar nº y tamaño de envases (ej: 2 botellas de 5L).",
    };
  }

  if (categoryIs(cat, "arido", "material vegetal")) {
    // Excepción: los que van embolsados (turba, etc.) se cuentan por unidades.
    if (nameMatchesAny(nombre, ARIDO_MATVEG_EN_UNIDADES_NEEDLES)) {
      return {
        kind: "formato_fijo",
        label: "Formato",
        value: "unidades",
        showCantidad: true,
        cantidadLabel: "Cantidad (unidades)",
        observacionesRequired: false,
        observacionesHint: null,
      };
    }
    return {
      kind: "formato_fijo",
      label: "Formato",
      value: "metros cúbicos",
      showCantidad: true,
      cantidadLabel: "Cantidad (m³)",
      // Volumen: se mide con decimales (ej. 2,5 m³).
      allowDecimals: true,
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
        // Longitud: se mide con decimales (ej. 3,5 m).
        allowDecimals: true,
        observacionesRequired: false,
        observacionesHint: null,
      };
    }
    return {
      kind: "formato_fijo",
      label: "Formato",
      value: "unidades",
      showCantidad: true,
      cantidadLabel: "Cantidad (unidades)",
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
 * Sufijo de unidad para mostrar el stock agregado de un producto en listados
 * (la tabla de productos, por ejemplo). Como el stock se agrega sin tener en
 * cuenta el formato concreto:
 *   - Plantas → "ud"
 *   - Fitosanitario / Fertilizante → "kg/lt" (puede contener ambos formatos)
 *   - Áridos / Material Vegetal → "m³"
 *   - Ferretería en metros (alambre 4.8, malla gallinero verde, cinturones
 *     3.5) → "m"; resto de ferretería → "ud"
 *
 * Espera un objeto con al menos `categoria` y, para discriminar ferretería,
 * `nombre_cientifico` o `nombre_natural`.
 */
export function getUnidadProducto(producto) {
  if (!producto) return "";
  const cat = normalize(producto.categoria);

  if (categoryIs(cat, "planta")) return "ud";

  if (categoryIs(cat, "fitosanitario", "fertilizante")) return "kg/lt";

  if (categoryIs(cat, "arido", "material vegetal")) {
    const nombre =
      producto.nombre_cientifico ||
      producto.nombre_natural ||
      producto.nombre ||
      "";
    if (nameMatchesAny(nombre, ARIDO_MATVEG_EN_UNIDADES_NEEDLES)) return "ud";
    return "m³";
  }

  if (categoryIs(cat, "ferreteria")) {
    const nombre =
      producto.nombre_cientifico ||
      producto.nombre_natural ||
      producto.nombre ||
      "";
    if (nameMatchesAny(nombre, FERRETERIA_EN_METROS_NEEDLES)) return "m";
    return "ud";
  }

  return "";
}

/**
 * Sufijo de unidad para mostrar la cantidad de un movimiento ya guardado.
 *   - Plantas → "ud"
 *   - Fitosanitario / Fertilizante → "kg" o "lt" según el formato registrado
 *     (Líquido → lt, resto → kg).
 *   - Áridos / Material Vegetal → "m³"
 *   - Ferretería → "m" si el formato registrado es "metros", "ud" si no.
 *
 * Acepta un objeto con `producto_categoria` y `tamano_origen` / `tamano_destino`
 * (es decir, un MovimientoOut tal y como llega del backend).
 */
export function getUnidadMovimiento(mov) {
  if (!mov) return "ud";
  const cat = normalize(mov.producto_categoria);
  const tamano = normalize(mov.tamano_origen || mov.tamano_destino);

  if (categoryIs(cat, "planta")) return "ud";

  if (categoryIs(cat, "fitosanitario", "fertilizante")) {
    return tamano === "liquido" ? "lt" : "kg";
  }

  if (categoryIs(cat, "arido", "material vegetal")) {
    const nombre = mov.producto_nombre_cientifico || mov.producto_nombre_natural || mov.producto_nombre || "";
    if (tamano === "unidades" || nameMatchesAny(nombre, ARIDO_MATVEG_EN_UNIDADES_NEEDLES)) return "ud";
    return "m³";
  }

  if (categoryIs(cat, "ferreteria")) {
    if (tamano === "metros") return "m";
    return "ud";
  }

  return "ud";
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
