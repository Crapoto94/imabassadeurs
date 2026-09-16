import axios from 'axios';

// URL du backend injectée au build (Vite). Vide = même origine : en production Docker,
// Nginx proxifie /api et /uploads vers le service backend (aucun CORS, aucun « localhost »).
export const API_URL = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export function errMsg(error: unknown, fallback = 'Une erreur est survenue'): string {
  const e = error as any;
  return e?.response?.data?.error || e?.message || fallback;
}
