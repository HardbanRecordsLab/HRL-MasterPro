import axios from 'axios';

// HRL Unified Platform - Centralne URL-e dla Backendów
const MASTERPRO_API_URL = 'https://masterpro.hardbanrecordslab.online';
const ACCESS_MANAGER_URL = 'https://hrl-access.hardbanrecordslab.online';

export const apiClient = axios.create({
  baseURL: MASTERPRO_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const accessApi = axios.create({
  baseURL: ACCESS_MANAGER_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const authInterceptor = (config: any) => {
  const token = localStorage.getItem('hrl_sso_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

apiClient.interceptors.request.use(authInterceptor);
accessApi.interceptors.request.use(authInterceptor);

export default apiClient;
