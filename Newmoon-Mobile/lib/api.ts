import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { getToken, deleteToken } from './authStorage';
import { deleteUser } from './userStorage';

let onAuthError: (() => void) | null = null;

export const setOnAuthError = (cb: (() => void) | null) => {
  onAuthError = cb;
};

const api = axios.create({
  baseURL: 'http://192.168.254.102:8000/api',
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      await deleteToken();
      await deleteUser();
      if (onAuthError) onAuthError();
    }
    return Promise.reject(error);
  }
);

export default api;
