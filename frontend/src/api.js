import axios from 'axios';

function resolveApiBase() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;

  // Jika ini mode dev, atau env var dikosongkan, lebih aman gunakan path relatif '/api'
  // Di dev mode (lokal), Vite proxy sudah diatur untuk merutekan '/api' ke backend localhost:4000
  // Di production (Vercel), vercel.json juga merutekan '/api' ke backend
  if (import.meta.env.PROD) {
    if (fromEnv && !fromEnv.includes('localhost')) {
      return fromEnv;
    }
    // Jika tidak ada env var, ATAU env var lupa diganti dari localhost saat deploy, 
    // paksa kembali ke relatif url.
    return '/api';
  }

  // Developer mode
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

