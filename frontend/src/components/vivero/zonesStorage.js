import zonasDefault from "./zonasConfig";

const STORAGE_KEY = "vivero-zonas-override";

export const parsePoints = (puntosStr) => {
  if (!puntosStr) return [];
  return puntosStr
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return [x, y];
    })
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
};

export const pointsToString = (pointsArr) =>
  pointsArr.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(" ");

export const loadZonas = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return zonasDefault;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return zonasDefault;
    return parsed;
  } catch {
    return zonasDefault;
  }
};

export const saveZonasDraft = (zonas) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(zonas));
  } catch {
    // ignore quota errors
  }
};

export const clearZonasDraft = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

export const hasZonasDraft = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
};

export const exportZonasAsJsFile = (zonas) => {
  const lines = zonas.map(
    (z) =>
      `  { id: ${JSON.stringify(z.id)}, apiId: ${JSON.stringify(
        z.apiId
      )}, nombre: ${JSON.stringify(z.nombre)}, color: ${JSON.stringify(
        z.color
      )}, puntos: ${JSON.stringify(z.puntos)} },`
  );
  const content = `const zonas = [\n${lines.join("\n")}\n];\n\nexport default zonas;\n`;

  const blob = new Blob([content], { type: "text/javascript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "zonasConfig.js";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
