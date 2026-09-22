import axios from 'axios';

function resolveApiBase() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor;

  if (isCapacitor) {
    // Di native app (Android/iOS via Capacitor), relative URL '/api' tidak akan bekerja.
    // Kita harus selalu menggunakan URL absolut.
    if (fromEnv) {
      return fromEnv;
    }
    // Default fallback jika env kosong di emulator Android (localhost komputer = 10.0.2.2)
    return 'http://10.0.2.2:4000/api';
  }

  // Jika di browser (dev mode atau production):
  // Bila diakses dari device lain di LAN (misal: HP via https://192.168.x.x:5173),
  // memanggil http://localhost:4000/api akan gagal total karena:
  // 1. Mixed Content (HTTPS memanggil HTTP diblokir browser HP)
  // 2. 'localhost' di browser HP mengarah ke HP itu sendiri, bukan ke PC!
  // Maka untuk semua akses LAN (bukan localhost/127.0.0.1), gunakan path relatif '/api'
  // yang otomatis diproxy oleh Vite ke backend komputer di http://localhost:4000
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return '/api';
    }
  }

  if (import.meta.env.PROD) {
    if (fromEnv && !fromEnv.includes('localhost')) {
      return fromEnv;
    }
    return '/api';
  }

  // Developer mode on localhost: gunakan /api (via Vite proxy) atau env
  return fromEnv || '/api';
}

const API_BASE = resolveApiBase();

const api = axios.create({
  baseURL: API_BASE
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    // eslint-disable-next-line no-param-reassign
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses - token expired or invalid
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Log error to console for debugging
    if (error.response) {
      console.error(`[API Error] Status: ${error.response.status}`, error.response.data);
    }

    // Handle auth errors globally (auto logout if 401 Unauthorized)
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      const isPublicRoute = currentPath === '/login' || currentPath === '/';
      
      // Only clear token and redirect if we're in a protected route
      // Don't interfere with public routes trying to access data
      if (!isPublicRoute) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      // For public routes, just let the error pass through
      // The component can handle 401 gracefully
    }
    return Promise.reject(error);
  }
);

export default api;

