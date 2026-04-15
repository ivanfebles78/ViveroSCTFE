import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL;
const TOKEN_KEY = "token";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// ---------------- TOKEN ----------------

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);

export const setStoredToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
};

export const clearStoredToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

// ---------------- INTERCEPTOR ----------------

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------------- AUTH ----------------

export const login = async (payloadOrUsername, maybePassword) => {
  const payload =
    typeof payloadOrUsername === "string"
      ? {
          username: payloadOrUsername,
          password: maybePassword || "",
        }
      : {
          username: payloadOrUsername?.username || "",
          password: payloadOrUsername?.password || "",
        };

  const { data } = await api.post("/auth/login", payload, {
    headers: { "Content-Type": "application/json" },
  });

  if (data?.access_token) {
    setStoredToken(data.access_token);
  }

  return data;
};

export const authLogin = login;

export const getMe = async () => {
  const { data } = await api.get("/auth/me");
  return data;
};

// ---------------- PRODUCTOS ----------------

export const getProductos = async () => {
  const { data } = await api.get("/productos");
  return data;
};

// ---------------- MOVIMIENTOS ----------------

export const getMovimientos = async () => {
  const { data } = await api.get("/movimientos");
  return data;
};

export const createMovimiento = async (payload) => {
  const normalizedPayload = {
    ...payload,

    // 🔥 CLAVE PARA UUID (no rompe nada existente)
    uuid_lote: payload?.uuid_lote || null,
  };

  const { data } = await api.post("/movimientos", normalizedPayload);
  return data;
};

// ---------------- ZONAS ----------------

export const getZonaItems = async (zonaId) => {
  try {
    const res = await fetch(`${API_URL}/endpoint`);
    if (!res.ok) throw new Error("Error cargando zona");
    return await res.json();
  } catch (err) {
    console.error("Error getZonaItems:", err);
    return null;
  }
};

// ---------------- PEDIDOS ----------------

export const getPedidos = async () => {
  const { data } = await api.get("/pedidos");
  return data;
};

export const createPedido = async (payload) => {
  const { data } = await api.post("/pedidos", payload);
  return data;
};

export const updatePedido = async (id, payload) => {
  const { data } = await api.put(`/pedidos/${id}`, payload);
  return data;
};

export const cancelarPedido = async (id) => {
  const { data } = await api.post(`/pedidos/${id}/cancelar`);
  return data;
};

export const aprobarPedido = async (id, payload = {}) => {
  const { data } = await api.post(`/pedidos/${id}/aprobar`, payload);
  return data;
};

export const denegarPedido = async (id, payload = {}) => {
  const { data } = await api.post(`/pedidos/${id}/denegar`, payload);
  return data;
};

// ---------------- LOTES / TRAZABILIDAD ----------------

export const getLote = async (uuid) => {
  const { data } = await api.get(`/lotes/${uuid}`);
  return data;
};

export const getTrazabilidadReporte = async (uuid) => {
  const { data } = await api.get(
    `/reportes/trazabilidad/${encodeURIComponent(uuid)}`
  );
  return data;
};

export const getDistribucionReporte = async (producto) => {
  const { data } = await api.get("/reportes/distribucion", {
    params: { producto },
  });
  return data;
};

export const getStockBajoReporte = async (margenPct = 20) => {
  const { data } = await api.get("/reportes/stock-bajo", {
    params: { margen_pct: margenPct },
  });
  return data;
};

export const getMovimientosExternosReporte = async (params = {}) => {
  const { data } = await api.get("/reportes/movimientos-externos", {
    params,
  });
  return data;
};

// =========================
// ZONAS (MAPA VIVERO)
// =========================

export const getPrestamosActivos = async () => {
  const { data } = await api.get("/prestamos-activos");
  return data;
};

export default api;

