import Echo from 'laravel-echo';
import PusherModule from 'pusher-js/react-native';
import { getToken } from './authStorage';

const WS_HOST = '192.168.254.102';
const WS_PORT = 8080;
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
      authEndpoint: 'http://10.42.28.76:8000/broadcasting/auth',
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
