import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import Echo from 'laravel-echo';
import PusherModule from 'pusher-js/react-native';
import { getToken, deleteToken } from './authStorage';
import { deleteUser } from './userStorage';

/* ================================================================== */
/* Central backend configuration                                       */
/*                                                                    */
/* The REST API and the WebSocket (Laravel Reverb) server run on the  */
/* SAME host but on DIFFERENT ports. Both derive from the single       */
/* BACKEND_IP below.                                                   */
/*                                                                    */
/* To change the backend, edit ONLY `BACKEND_IP` in this file.         */
/* ================================================================== */

export const BACKEND_IP = '192.168.254.105';

export const API_PORT = 8000;
export const WEBSOCKET_PORT = 8080;

export const BACKEND_ORIGIN = `http://${BACKEND_IP}:${API_PORT}`;

export const API_BASE_URL = `${BACKEND_ORIGIN}/api`;

export const BROADCAST_AUTH_URL = `${BACKEND_ORIGIN}/broadcasting/auth`;

export const WEBSOCKET_HOST = BACKEND_IP;

export const STORAGE_URL = `${BACKEND_ORIGIN}/storage`;

/* ------------------------------------------------------------------ */
/* REST API (Axios)                                                    */
/* ------------------------------------------------------------------ */

let onAuthError: (() => void) | null = null;

export const setOnAuthError = (cb: (() => void) | null) => {
  onAuthError = cb;
};

const api = axios.create({
  baseURL: API_BASE_URL,
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

/* ------------------------------------------------------------------ */
/* WebSocket (Laravel Reverb via Pusher + Laravel Echo)                */
/* ------------------------------------------------------------------ */

const WS_HOST = WEBSOCKET_HOST;
const WS_PORT = WEBSOCKET_PORT;
const REVERB_KEY = 'newmoon-app-key';

const Pusher = (PusherModule as any).Pusher ?? PusherModule;

let echo: Echo<any> | null = null;

export const getEcho = async (): Promise<Echo<any> | null> => {
  echo = new Echo({
    broadcaster: 'pusher',
    client: new Pusher(REVERB_KEY, {
      cluster: 'mt1',
      wsHost: WS_HOST,
      wsPort: WS_PORT,
      wssPort: WS_PORT,
      forceTLS: false,
      enabledTransports: ['ws', 'wss'],
      authEndpoint: BROADCAST_AUTH_URL,
      auth: {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
          Accept: 'application/json',
        },
      },
    }),
    disableStats: true,
  });

  return echo;
};

/**
 * Connect to a private channel for an order.
 * Returns a cleanup function. Does nothing if echo initialization fails.
 */
export const listenToOrder = (
  orderId: number | string,
  event: string,
  callback: (data: any) => void
): (() => void) => {
  let channel: any = null;
  let cancelled = false;

  const init = async () => {
    const instance = echo || (await getEcho());
    if (!instance || cancelled) return;
    channel = instance.private(`order.${orderId}`);
    channel.listen(event, (data: any) => callback(data));
  };

  init();

  return () => {
    cancelled = true;
    if (channel) {
      channel.stopListening(event);
      channel.disconnect?.();
    }
  };
};

/**
 * Connect to the staff orders channel.
 * Returns a cleanup function.
 */
export const listenToStaffOrders = (callback: (data: any) => void): (() => void) => {
  let channel: any = null;
  let cancelled = false;

  const init = async () => {
    const instance = echo || (await getEcho());
    if (!instance || cancelled) return;
    channel = instance.private('staff.orders');
    channel.listen('.OrderStatusUpdated', (data: any) => callback(data));
    channel.listen('.NewOrderCreated', (data: any) => callback(data));
  };

  init();

  return () => {
    cancelled = true;
    if (channel) {
      channel.stopListening('.OrderStatusUpdated');
      channel.stopListening('.NewOrderCreated');
      channel.disconnect?.();
    }
  };
};

/**
 * Connect to the rider channel.
 * Returns a cleanup function.
 */
export const listenToRider = (
  riderId: number | string,
  callback: (data: any) => void
): (() => void) => {
  let channel: any = null;
  let cancelled = false;

  const init = async () => {
    const instance = echo || (await getEcho());
    if (!instance || cancelled) return;
    channel = instance.private(`rider.${riderId}`);
    channel.listen('.OrderStatusUpdated', (data: any) => callback(data));
    channel.listen('.NewOrderCreated', (data: any) => callback(data));
    channel.listen('.RiderAssigned', (data: any) => callback(data));
  };

  init();

  return () => {
    cancelled = true;
    if (channel) {
      channel.stopListening('.OrderStatusUpdated');
      channel.stopListening('.NewOrderCreated');
      channel.stopListening('.RiderAssigned');
      channel.disconnect?.();
    }
  };
};

export const disconnectEcho = () => {
  if (echo) {
    echo.disconnect();
    echo = null;
  }
};

export default api;
