import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Linking,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api, { listenToRider } from '../../../../lib/api';
import * as Location from 'expo-location';
import { useAuth } from '../../../../context/authContext';
import ProofOfDelivery from '../ProofOfDelivery';
import MapView, { Marker } from 'react-native-maps';

type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'cancelled';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  customer_name: string;
  customer_address: string;
  customer_latitude?: number;
  customer_longitude?: number;
  items: OrderItem[] | string;
  total: string | number;
  status: OrderStatus;
  branch_name?: string;
  branch_address?: string;
  branch_latitude?: number;
  branch_longitude?: number;
  created_at: string;
  distance?: string;
  duration?: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: string; next?: OrderStatus[] }> = {
  pending:           { label: 'Pending',          color: '#F59E0B', icon: 'pending',        next: ['accepted'] },
  accepted:          { label: 'Accepted',         color: '#EA580C', icon: 'handshake',      next: ['picked_up'] },
  preparing:         { label: 'Preparing',        color: '#7C2D12', icon: 'restaurant',     next: ['ready'] },
  ready:             { label: 'Ready',            color: '#16A34A', icon: 'check-circle',   next: ['picked_up'] },
  picked_up:         { label: 'Picked Up',        color: '#F97316', icon: 'local-shipping', next: ['out_for_delivery'] },
  out_for_delivery:  { label: 'Out for Delivery', color: '#C2410C', icon: 'directions-bike', next: ['delivered'] },
  delivered:         { label: 'Delivered',        color: '#22C55E', icon: 'check-circle',   next: [] },
  cancelled:         { label: 'Cancelled',        color: '#DC2626', icon: 'cancel',         next: [] },
};

const STATUS_FLOW: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'picked_up', 'out_for_delivery', 'delivered'];

// Presentation-only action button labels (business flow untouched)
const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  accepted: 'Accept Order',
  ready: 'Ready',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Complete Delivery',
};

// Presentation-only icons per next status
const ACTION_ICONS: Partial<Record<OrderStatus, React.ComponentProps<typeof Ionicons>['name']>> = {
  accepted: 'hand-left-outline',
  ready: 'restaurant-outline',
  picked_up: 'bicycle-outline',
  out_for_delivery: 'navigate-circle-outline',
  delivered: 'checkmark-done-circle-outline',
};

function getNextActions(status: OrderStatus): { label: string; nextStatus: OrderStatus; color: string }[] {
  const config = STATUS_CONFIG[status];
  if (!config?.next || config.next.length === 0) return [];
  return config.next.map((ns) => ({
    label: STATUS_CONFIG[ns].label,
    nextStatus: ns,
    color: STATUS_CONFIG[ns].color,
  }));
}

const actionButtonLabel = (nextStatus: OrderStatus) => ACTION_LABELS[nextStatus] || STATUS_CONFIG[nextStatus].label;
const actionButtonIcon = (nextStatus: OrderStatus) => ACTION_ICONS[nextStatus] || 'arrow-forward';

export default function OrdersScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionOrder, setActionOrder] = useState<Order | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofOrder, setProofOrder] = useState<Order | null>(null);
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for active orders
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // GPS tracking
  useEffect(() => {
    let watchSub: { remove: () => void } | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      watchSub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 10 },
        (loc) => setRiderLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude }),
      );
    })();
    return () => watchSub?.remove();
  }, []);

  // Send location to backend
  useEffect(() => {
    if (!riderLocation) return;
    const interval = setInterval(async () => {
      try {
        const activeOrders = orders.filter((o) =>
          ['accepted', 'picked_up', 'out_for_delivery'].includes(o.status)
        );
        for (const order of activeOrders) {
          await api.post(`/rider/orders/${order.id}/location`, {
            latitude: riderLocation.lat,
            longitude: riderLocation.lng,
          }).catch(() => {});
        }
      } catch {}
    }, 15000);
    return () => clearInterval(interval);
  }, [riderLocation, orders]);

  // Fetch orders (WebSocket-driven, pull-to-refresh fallback)
  const fetchOrders = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const res = await api.get('/rider/orders?per_page=50');
      const data = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      setOrders(data);
    } catch {
      if (!isRefresh) setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    let unsubscribe: (() => void) | null = null;
    if (user?.id) {
      unsubscribe = listenToRider(user.id, () => {
        fetchOrders();
      });
    }
    return () => {
      unsubscribe?.();
    };
  }, [fetchOrders, user?.id]);

  const activeOrders = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));

  const handleStatusAction = async (order: Order, nextStatus: OrderStatus) => {
    if (nextStatus === 'delivered') {
      setProofOrder(order);
      setShowActionModal(false);
      setShowProofModal(true);
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/rider/orders/${order.id}/status`, { status: nextStatus });
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o))
      );
      setShowActionModal(false);
      setActionOrder(null);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update order status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProofSubmit = () => {
    setShowProofModal(false);
    setProofOrder(null);
    setActionOrder(null);
    fetchOrders();
  };

  const handleProofCancel = () => {
    setShowProofModal(false);
    setProofOrder(null);
  };

  const openNavigation = (lat?: number, lng?: number, label?: string) => {
    if (!lat || !lng) {
      Alert.alert('Location Unavailable', 'No location data for this order');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Navigate', `${label || 'Destination'}\n${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    });
  };

  const getProgress = (status: OrderStatus): number => {
    const idx = STATUS_FLOW.indexOf(status);
    return idx >= 0 ? (idx / (STATUS_FLOW.length - 1)) * 100 : 0;
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatCurrency = (amount: string | number) =>
    `₱${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  // --- Active summary (computed from real order data) ---
  const countByStatus = (s: OrderStatus) => orders.filter((o) => o.status === s).length;
  const summaryTiles = [
    { key: 'waiting', label: 'Waiting', count: countByStatus('pending') + countByStatus('accepted'), color: '#EA580C', icon: 'time-outline' as const },
    { key: 'preparing', label: 'Preparing', count: countByStatus('preparing'), color: '#7C2D12', icon: 'restaurant-outline' as const },
    { key: 'picked', label: 'Picked Up', count: countByStatus('picked_up'), color: '#F97316', icon: 'bicycle-outline' as const },
    { key: 'delivering', label: 'Out for Delivery', count: countByStatus('out_for_delivery'), color: '#C2410C', icon: 'navigate-circle-outline' as const },
  ].filter((t) => t.count > 0);

  const renderOrderCard = (order: Order) => {
    const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    const actions = getNextActions(order.status);
    const progress = getProgress(order.status);
    const isActive = !['delivered', 'cancelled'].includes(order.status);

    return (
      <TouchableOpacity
        key={order.id}
        className="bg-white rounded-3xl p-4 mb-4 border border-[#F5EDE0]"
        style={{
          shadowColor: '#451A03',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
        activeOpacity={0.7}
        onPress={() => {
          setActionOrder(order);
          setShowActionModal(true);
        }}
      >
        {/* Header */}
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center flex-1">
            <View className="bg-[#FFF1E6] p-2 rounded-xl mr-2.5 border border-[#FED7AA]">
              <MaterialIcons name="receipt" size={16} color="#EA580C" />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Order</Text>
              <Text className="text-[15px] font-extrabold text-[#451A03]" numberOfLines={1}>
                {order.order_number}
              </Text>
            </View>
          </View>
          <View
            className="px-2.5 py-1.5 rounded-full flex-row items-center"
            style={{ backgroundColor: config.color + '14' }}
          >
            <MaterialIcons name={(config.icon === 'checkmark-circle' ? 'check-circle' : config.icon) as any} size={12} color={config.color} style={{ marginRight: 4 }} />
            <Text className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: config.color }}>{config.label}</Text>
          </View>
        </View>

        {/* Progress bar */}
        {isActive && (
          <View className="flex-row items-center mb-3">
            <View className="h-1.5 bg-[#F5EDE0] rounded-full flex-1 overflow-hidden">
              <View
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor: config.color,
                  borderRadius: 4,
                }}
              />
            </View>
            <Text className="text-[11px] font-bold text-stone-400 ml-2">{Math.round(progress)}%</Text>
          </View>
        )}

        {/* Customer + Address */}
        <View className="bg-[#FFFBF5] rounded-2xl p-3 mb-2.5 border border-[#F5EDE0]">
          <View className="flex-row items-center mb-2">
            <View className="w-8 h-8 rounded-xl bg-[#FFF1E6] items-center justify-center mr-2.5">
              <Ionicons name="person-outline" size={16} color="#EA580C" />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Customer</Text>
              <Text className="text-[15px] font-bold text-[#451A03]">{order.customer_name}</Text>
            </View>
          </View>
          <View className="flex-row items-start">
            <View className="w-8 h-8 rounded-xl bg-[#FFF1E6] items-center justify-center mr-2.5">
              <Ionicons name="location-outline" size={16} color="#EA580C" />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Delivery Address</Text>
              <Text className="text-[13px] text-stone-600 leading-5">{order.customer_address}</Text>
            </View>
          </View>
        </View>

        {/* Branch */}
        {order.branch_name && (
          <View className="flex-row items-center mb-2.5">
            <View className="w-8 h-8 rounded-xl bg-[#FFF7ED] items-center justify-center mr-2.5 border border-[#FED7AA]">
              <Ionicons name="storefront-outline" size={15} color="#7C2D12" />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Pickup Branch</Text>
              <Text className="text-[13px] font-semibold text-[#451A03]">{order.branch_name}</Text>
              {order.branch_address && (
                <Text className="text-[11px] text-stone-500" numberOfLines={1}>{order.branch_address}</Text>
              )}
            </View>
          </View>
        )}

        {/* Items */}
        <View className="bg-[#FFF7ED] rounded-2xl p-3 mb-3 border border-[#FED7AA]">
          <View className="flex-row items-start">
            <View className="w-8 h-8 rounded-xl bg-[#FFF1E6] items-center justify-center mr-2.5">
              <Ionicons name="fast-food-outline" size={16} color="#C2410C" />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] uppercase tracking-wider text-[#B45309] font-semibold mb-1">Order Items</Text>
              {typeof order.items === 'string' ? (
                <Text className="text-[13px] text-[#451A03] font-semibold leading-5">{order.items}</Text>
              ) : Array.isArray(order.items) && order.items.length > 0 ? (
                order.items.map((i, idx) => (
                  <View key={idx} className="flex-row items-center justify-between py-0.5">
                    <View className="flex-row items-center flex-1">
                      <View className="bg-[#FED7AA] px-1.5 py-0.5 rounded-md mr-2">
                        <Text className="text-[11px] font-extrabold text-[#7C2D12]">{i.quantity}x</Text>
                      </View>
                      <Text className="text-[13px] text-[#451A03] font-semibold flex-1" numberOfLines={1}>{i.name}</Text>
                    </View>
                    <Text className="text-[12px] font-bold text-stone-500 ml-2">
                      ₱{Number(i.price * i.quantity).toLocaleString()}
                    </Text>
                  </View>
                ))
              ) : (
                <Text className="text-[13px] text-stone-500">Items</Text>
              )}
            </View>
          </View>
        </View>

        {/* Footer */}
        <View className="flex-row justify-between items-center pt-3 border-t border-[#F5EDE0]">
          <View className="flex-row items-center flex-wrap flex-1">
            <Ionicons name="time-outline" size={13} color="#78716C" style={{ marginRight: 5 }} />
            <Text className="text-[12px] text-stone-500">{formatTime(order.created_at)}</Text>
            {order.distance && (
              <>
                <Text className="text-[#E7E0D8] mx-1.5">|</Text>
                <Ionicons name="navigate-outline" size={12} color="#78716C" style={{ marginRight: 4 }} />
                <Text className="text-[12px] text-stone-500">{order.distance}</Text>
              </>
            )}
            {order.duration && (
              <>
                <Text className="text-[#E7E0D8] mx-1.5">|</Text>
                <Ionicons name="stopwatch-outline" size={12} color="#78716C" style={{ marginRight: 4 }} />
                <Text className="text-[12px] text-stone-500">{order.duration}</Text>
              </>
            )}
          </View>
          <View className="bg-[#FFF1E6] px-3 py-1.5 rounded-full border border-[#FED7AA] ml-2">
            <Text className="text-[14px] font-extrabold text-[#EA580C]">
              {formatCurrency(order.total)}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        {isActive && actions.length > 0 && (
          <View className="mt-3 pt-3 border-t border-[#F5EDE0]">
            {actions.map((action, ai) => (
              <TouchableOpacity
                key={action.nextStatus}
                className="flex-row items-center justify-center rounded-2xl px-4"
                style={{
                  backgroundColor: ai === 0 ? '#EA580C' : action.color + '14',
                  paddingVertical: ai === 0 ? 14 : 11,
                  marginBottom: actions.length > 1 ? 8 : 0,
                }}
                onPress={() => handleStatusAction(order, action.nextStatus)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={actionButtonIcon(action.nextStatus)}
                  size={ai === 0 ? 17 : 14}
                  color={ai === 0 ? '#FFFFFF' : action.color}
                  style={{ marginRight: 8 }}
                />
                <Text
                  className="font-extrabold tracking-wide"
                  style={{
                    color: ai === 0 ? '#FFFFFF' : action.color,
                    fontSize: ai === 0 ? 15 : 13,
                  }}
                >
                  {actionButtonLabel(action.nextStatus)}
                </Text>
                {ai === 0 && <Ionicons name="arrow-forward" size={16} color="#FFE4C9" style={{ marginLeft: 8 }} />}
              </TouchableOpacity>
            ))}
            <View className="flex-row gap-2 mt-2">
              {['picked_up', 'out_for_delivery'].includes(order.status) && (
                <TouchableOpacity
                  className="flex-1 py-3 rounded-2xl items-center justify-center flex-row bg-[#FFF7ED] border border-[#FED7AA]"
                  onPress={() => router.push(`/Rider/Chat?orderId=${order.id}`)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color="#D97706" style={{ marginRight: 6 }} />
                  <Text className="text-[12px] font-bold text-[#B45309]">Chat Customer</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="flex-1 py-3 rounded-2xl items-center justify-center flex-row bg-[#FFF1E6] border border-[#FED7AA]"
                onPress={() => router.push('/Rider/Maps')}
                activeOpacity={0.7}
              >
                <Ionicons name="navigate" size={16} color="#EA580C" style={{ marginRight: 6 }} />
                <Text className="text-[12px] font-bold text-[#EA580C]">View Route</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Delivered timestamp */}
        {order.status === 'delivered' && (
          <View className="flex-row items-center mt-3 pt-3 border-t border-[#F5EDE0]">
            <Ionicons name="checkmark-circle" size={15} color="#16A34A" style={{ marginRight: 6 }} />
            <Text className="text-[12px] text-stone-500 font-semibold">Delivered</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FFF7ED] items-center justify-center">
        <View
          className="w-20 h-20 rounded-3xl bg-[#FFF1E6] items-center justify-center mb-5"
          style={{
            shadowColor: '#EA580C',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.18,
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          <Ionicons name="flame" size={40} color="#EA580C" />
        </View>
        <ActivityIndicator size="large" color="#EA580C" />
        <Text className="text-[#451A03] font-extrabold mt-4 text-base">Loading delivery orders...</Text>
        <Text className="text-stone-500 text-xs mt-1 tracking-wide">NewMoon Lechon Manok &amp; Liempo</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FFF7ED]">
      {/* Premium NewMoon Header */}
      <LinearGradient
        colors={['#171717', '#241207', '#451A03']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: 8, paddingBottom: 26, paddingHorizontal: 20, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}
      >
        {/* Decorative warm glows */}
        <View className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-[#EA580C] opacity-20" />
        <View className="absolute -bottom-14 -left-12 w-40 h-40 rounded-full bg-[#F59E0B] opacity-10" />

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => router.back()}
              className="w-10 h-10 rounded-2xl bg-[#262626] items-center justify-center mr-3 border border-[#3A3A3A]"
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color="#FED7AA" />
            </TouchableOpacity>
            <View className="flex-1">
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-xl bg-[#EA580C] items-center justify-center mr-2">
                  <Ionicons name="flame" size={17} color="#FFFFFF" />
                </View>
                <Text className="text-white text-lg font-extrabold leading-5">NewMoon</Text>
              </View>
              <View className="flex-row items-center mt-0.5">
                <Ionicons name="bicycle-outline" size={12} color="#FDBA74" />
                <Text className="text-[#FED7AA] text-[10px] font-bold uppercase tracking-wider ml-1.5">
                  Rider Orders
                </Text>
              </View>
            </View>
          </View>

          <View className="items-end">
            <Animated.View
              className="flex-row items-center px-3 py-1.5 rounded-full bg-[#F59E0B]"
              style={{ opacity: pulseAnim }}
            >
              <Ionicons name="bicycle" size={14} color="#451A03" style={{ marginRight: 5 }} />
              <Text className="text-[#451A03] text-[11px] font-extrabold uppercase tracking-wider">
                {activeOrders.length} Active
              </Text>
            </Animated.View>
            <View className="flex-row items-center mt-1.5">
              <Animated.View
                className="w-2 h-2 rounded-full mr-1.5"
                style={{
                  backgroundColor: riderLocation ? '#22C55E' : '#EF4444',
                  opacity: pulseAnim,
                }}
              />
              <Text className="text-[10px] text-[#FED7AA] font-semibold">
                {riderLocation ? 'Live Location' : 'Location Off'}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Orders List */}
      <ScrollView
        className="flex-1 px-4 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchOrders(true)}
            tintColor="#EA580C"
            colors={['#EA580C']}
          />
        }
      >
        {/* Page title */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-1">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-xl bg-[#FFF1E6] items-center justify-center mr-2 border border-[#FED7AA]">
                <Ionicons name="receipt" size={16} color="#EA580C" />
              </View>
              <Text className="text-2xl font-extrabold text-[#451A03]">Delivery Orders</Text>
            </View>
            <Text className="text-[13px] text-stone-500 mt-1 ml-10">Manage your active deliveries</Text>
            <Text className="text-[11px] text-stone-400 mt-0.5 ml-10 flex-row items-center">
              <Ionicons name="radio" size={10} color="#F59E0B" /> Live Orders &middot; Orders update automatically
            </Text>
          </View>
        </View>

        {/* Active summary */}
        {activeOrders.length > 0 && (
          <View className="bg-white rounded-3xl p-4 mb-4 border border-[#F5EDE0]"
            style={{
              shadowColor: '#451A03',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
              elevation: 2,
            }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <View className="w-9 h-9 rounded-xl bg-[#EA580C] items-center justify-center mr-2.5"
                  style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 }}
                >
                  <Ionicons name="cube-outline" size={18} color="#FFFFFF" />
                </View>
                <View>
                  <Text className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Active Deliveries</Text>
                  <Text className="text-xl font-extrabold text-[#451A03]">{activeOrders.length}</Text>
                </View>
              </View>
              <View className="bg-[#FFF7ED] px-3 py-1.5 rounded-full border border-[#FED7AA]">
                <Text className="text-[11px] font-bold text-[#C2410C]">
                  {orders.filter((o) => o.status === 'delivered').length} completed today
                </Text>
              </View>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {summaryTiles.map((tile) => (
                <View key={tile.key} className="flex-row items-center bg-[#FFFBF5] px-3 py-2 rounded-2xl border border-[#F5EDE0]">
                  <Ionicons name={tile.icon} size={14} color={tile.color} style={{ marginRight: 6 }} />
                  <Text className="text-[12px] font-bold text-stone-600 mr-1.5">{tile.label}</Text>
                  <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: tile.color + '18' }}>
                    <Text className="text-[11px] font-extrabold" style={{ color: tile.color }}>{tile.count}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {activeOrders.length === 0 ? (
          <View className="items-center justify-center py-16">
            <View
              className="w-28 h-28 rounded-full bg-[#FFF1E6] border border-[#FED7AA] items-center justify-center mb-5"
              style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 4 }}
            >
              <Ionicons name="bicycle" size={52} color="#EA580C" />
              <View className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-[#F59E0B] items-center justify-center border-2 border-white">
                <Ionicons name="flame" size={18} color="#FFFFFF" />
              </View>
            </View>
            <Text className="text-[#451A03] text-lg font-extrabold mb-1">No Active Orders</Text>
            <Text className="text-stone-500 text-sm text-center px-8 mb-3">New orders will appear here automatically</Text>
            <View className="bg-[#FFF1E6] px-4 py-2 rounded-full border border-[#FED7AA] flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-[#22C55E] mr-2" />
              <Text className="text-[11px] font-bold text-[#7C2D12]">Listening live for incoming orders</Text>
            </View>
          </View>
        ) : (
          activeOrders.map(renderOrderCard)
        )}
        <View className="h-24" />
      </ScrollView>

      {/* Action Modal */}
      <Modal
        visible={showActionModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowActionModal(false); setActionOrder(null); }}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(23,23,23,0.6)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => { setShowActionModal(false); setActionOrder(null); }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={{ backgroundColor: '#FFFBF5', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingVertical: 8 }}
          >
            {actionOrder && (
              <>
                {/* Header */}
                <LinearGradient
                  colors={['#171717', '#241207', '#451A03']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
                >
                  <View className="w-12 h-1.5 bg-[#F59E0B] rounded-full self-center mb-4 opacity-70" />
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-2xl bg-[#EA580C] items-center justify-center mr-3">
                      <Ionicons name="flame" size={20} color="#FFFFFF" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[10px] uppercase tracking-wider text-[#FDBA74] font-bold">Delivery Order</Text>
                      <Text className="text-white text-lg font-extrabold leading-6">{actionOrder.order_number}</Text>
                      <Text className="text-[#FED7AA] text-[13px] font-semibold">{actionOrder.customer_name}</Text>
                    </View>
                  </View>
                </LinearGradient>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
                  {/* Current status */}
                  <View className="bg-white rounded-2xl p-4 mt-4 border border-[#F5EDE0]">
                    <View className="flex-row justify-between items-center mb-3">
                      <Text className="text-stone-400 text-[11px] uppercase tracking-wider font-semibold">Current Status</Text>
                      <View className="px-3 py-1.5 rounded-full flex-row items-center" style={{ backgroundColor: (STATUS_CONFIG[actionOrder.status]?.color || '#EA580C') + '18' }}>
                        <MaterialIcons
                          name={((STATUS_CONFIG[actionOrder.status]?.icon === 'checkmark-circle' ? 'check-circle' : STATUS_CONFIG[actionOrder.status]?.icon) || 'receipt') as any}
                          size={13}
                          color={STATUS_CONFIG[actionOrder.status]?.color || '#EA580C'}
                          style={{ marginRight: 4 }}
                        />
                        <Text className="text-[12px] font-extrabold uppercase tracking-wide" style={{ color: STATUS_CONFIG[actionOrder.status]?.color || '#EA580C' }}>
                          {STATUS_CONFIG[actionOrder.status]?.label}
                        </Text>
                      </View>
                    </View>

                    {/* Flow steps */}
                    <View className="flex-row items-start justify-between pt-1">
                      {STATUS_FLOW.filter((s) => s !== 'cancelled').map((step, idx) => {
                        const currentIdx = STATUS_FLOW.indexOf(actionOrder.status);
                        const stepIdx = STATUS_FLOW.indexOf(step);
                        const isComplete = stepIdx <= currentIdx;
                        const isCurrent = step === actionOrder.status;
                        const stepColor = STATUS_CONFIG[step]?.color || '#EA580C';
                        return (
                          <View key={step} className="items-center" style={{ flex: 1 }}>
                            <View
                              className="w-7 h-7 rounded-full items-center justify-center border"
                              style={{
                                backgroundColor: isCurrent ? '#F59E0B' : isComplete ? '#EA580C' : '#FFF7ED',
                                borderColor: isCurrent ? '#F59E0B' : isComplete ? '#EA580C' : '#FED7AA',
                              }}
                            >
                              {isComplete && !isCurrent ? (
                                <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                              ) : isCurrent ? (
                                <View className="w-2 h-2 rounded-full bg-white" />
                              ) : (
                                <View className="w-2 h-2 rounded-full bg-[#FED7AA]" />
                              )}
                            </View>
                            <Text
                              className="text-[9px] font-bold mt-1 text-center"
                              numberOfLines={1}
                              style={{ color: isCurrent ? '#C2410C' : isComplete ? '#EA580C' : '#A8A29E' }}
                            >
                              {STATUS_CONFIG[step]?.label}
                            </Text>
                            {idx < STATUS_FLOW.length - 1 && (
                              <View
                                style={{
                                  position: 'absolute',
                                  top: 13,
                                  left: '58%',
                                  right: '-58%',
                                  height: 2,
                                  borderRadius: 2,
                                  backgroundColor: idx < currentIdx || (idx === currentIdx && actionOrder.status !== 'pending') ? '#F97316' : '#F5EDE0',
                                }}
                              />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Summary row */}
                  <View className="flex-row gap-2 mt-3">
                    <View className="flex-1 bg-[#FFF1E6] rounded-2xl p-3 border border-[#FED7AA]">
                      <View className="flex-row items-center mb-1">
                        <Ionicons name="time-outline" size={13} color="#EA580C" style={{ marginRight: 5 }} />
                        <Text className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">Time</Text>
                      </View>
                      <Text className="text-[13px] font-extrabold text-[#451A03]">{formatTime(actionOrder.created_at)}</Text>
                    </View>
                    {actionOrder.distance && (
                      <View className="flex-1 bg-[#FFF1E6] rounded-2xl p-3 border border-[#FED7AA]">
                        <View className="flex-row items-center mb-1">
                          <Ionicons name="navigate-outline" size={13} color="#EA580C" style={{ marginRight: 5 }} />
                          <Text className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">Distance</Text>
                        </View>
                        <Text className="text-[13px] font-extrabold text-[#451A03]">{actionOrder.distance}</Text>
                      </View>
                    )}
                    {actionOrder.duration && (
                      <View className="flex-1 bg-[#FFF1E6] rounded-2xl p-3 border border-[#FED7AA]">
                        <View className="flex-row items-center mb-1">
                          <Ionicons name="stopwatch-outline" size={13} color="#EA580C" style={{ marginRight: 5 }} />
                          <Text className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">Est. Time</Text>
                        </View>
                        <Text className="text-[13px] font-extrabold text-[#451A03]">{actionOrder.duration}</Text>
                      </View>
                    )}
                  </View>

                  {/* Route pickups */}
                  {actionOrder.branch_name && (
                    <View className="bg-white rounded-2xl p-4 mt-3 border border-[#F5EDE0]">
                      <Text className="text-stone-400 text-[11px] uppercase tracking-wider font-semibold mb-3">Delivery Route</Text>
                      <View className="flex-row items-center">
                        <View className="w-9 h-9 rounded-xl bg-[#FFF1E6] items-center justify-center border border-[#FED7AA]">
                          <Ionicons name="storefront-outline" size={16} color="#7C2D12" />
                        </View>
                        <View className="ml-2.5 flex-1">
                          <Text className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Pickup</Text>
                          <Text className="text-[13px] font-extrabold text-[#451A03]">{actionOrder.branch_name}</Text>
                          {actionOrder.branch_address && (
                            <Text className="text-[11px] text-stone-500">{actionOrder.branch_address}</Text>
                          )}
                        </View>
                      </View>
                      <View className="flex-row items-center my-2 ml-[17px]">
                        <View className="h-5 w-0.5 bg-[#FED7AA]" />
                      </View>
                      <View className="flex-row items-center">
                        <View className="w-9 h-9 rounded-xl bg-[#EA580C] items-center justify-center">
                          <Ionicons name="person" size={16} color="#FFFFFF" />
                        </View>
                        <View className="ml-2.5 flex-1">
                          <Text className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold">Customer</Text>
                          <Text className="text-[13px] font-extrabold text-[#451A03]">{actionOrder.customer_name}</Text>
                          <Text className="text-[11px] text-stone-500">{actionOrder.customer_address}</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Map: show route from branch to customer when on delivery */}
                  {actionOrder.branch_latitude != null && actionOrder.branch_longitude != null && actionOrder.customer_latitude != null && actionOrder.customer_longitude != null && (
                    <View className="mt-3 rounded-2xl overflow-hidden border border-[#FED7AA]"
                      style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 }}
                    >
                      <View className="bg-[#FFF1E6] px-4 py-2.5 flex-row items-center justify-between">
                        <Text className="text-[11px] uppercase tracking-wider font-extrabold text-[#7C2D12]">Delivery Route</Text>
                        <Text className="text-[10px] font-bold text-stone-500">
                          {actionOrder.branch_name} &rarr; Customer
                        </Text>
                      </View>
                      <View className="h-44">
                        <MapView
                          style={{ flex: 1 }}
                          initialRegion={{
                            latitude: (actionOrder.branch_latitude + actionOrder.customer_latitude) / 2,
                            longitude: (actionOrder.branch_longitude + actionOrder.customer_longitude) / 2,
                            latitudeDelta: Math.abs(actionOrder.branch_latitude - actionOrder.customer_latitude) * 2 + 0.02,
                            longitudeDelta: Math.abs(actionOrder.branch_longitude - actionOrder.customer_longitude) * 2 + 0.02,
                          }}
                          scrollEnabled={false}
                          zoomEnabled={false}
                        >
                          <Marker
                            coordinate={{ latitude: actionOrder.branch_latitude, longitude: actionOrder.branch_longitude }}
                            title={actionOrder.branch_name || 'Branch'}
                            pinColor="#F59E0B"
                          />
                          <Marker
                            coordinate={{ latitude: actionOrder.customer_latitude, longitude: actionOrder.customer_longitude }}
                            title={actionOrder.customer_name}
                            pinColor="#EA580C"
                          />
                        </MapView>
                      </View>
                    </View>
                  )}

                  {/* Navigation */}
                  {(actionOrder.customer_latitude || actionOrder.branch_latitude) && (
                    <TouchableOpacity
                      className="bg-white rounded-2xl py-3.5 items-center flex-row justify-center mt-3 border border-[#FED7AA]"
                      onPress={() => router.push('/Rider/Maps')}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="map-outline" size={18} color="#EA580C" style={{ marginRight: 8 }} />
                      <Text className="text-[#EA580C] text-sm font-extrabold">Open Map</Text>
                    </TouchableOpacity>
                  )}

                  {/* Chat */}
                  {['picked_up', 'out_for_delivery'].includes(actionOrder.status) && (
                    <TouchableOpacity
                      className="bg-[#FFF7ED] rounded-2xl py-3.5 items-center flex-row justify-center mt-2 border border-[#FED7AA]"
                      onPress={() => {
                        setShowActionModal(false);
                        setActionOrder(null);
                        router.push(`/Rider/Chat?orderId=${actionOrder.id}`);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color="#D97706" style={{ marginRight: 8 }} />
                      <Text className="text-[#B45309] text-sm font-extrabold">Chat with Customer</Text>
                    </TouchableOpacity>
                  )}

                  {/* Actions */}
                  {getNextActions(actionOrder.status).length > 0 && (
                    <Text className="text-stone-400 text-[11px] uppercase tracking-wider font-semibold mb-2 mt-4 ml-1">
                      Update Status
                    </Text>
                  )}
                  {getNextActions(actionOrder.status).map((action, ai) => (
                    <TouchableOpacity
                      key={action.nextStatus}
                      className="flex-row items-center justify-center rounded-2xl mb-2"
                      style={{
                        backgroundColor: ai === 0 ? '#EA580C' : action.color + '14',
                        paddingVertical: ai === 0 ? 16 : 13,
                        shadowColor: ai === 0 ? '#EA580C' : 'transparent',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.25,
                        shadowRadius: 8,
                        elevation: ai === 0 ? 3 : 0,
                      }}
                      onPress={() => handleStatusAction(actionOrder!, action.nextStatus)}
                      disabled={actionLoading}
                      activeOpacity={0.85}
                    >
                      {actionLoading ? (
                        <ActivityIndicator color={ai === 0 ? '#FFFFFF' : action.color} size="small" />
                      ) : (
                        <>
                          <Ionicons
                            name={actionButtonIcon(action.nextStatus)}
                            size={ai === 0 ? 18 : 15}
                            color={ai === 0 ? '#FFFFFF' : action.color}
                            style={{ marginRight: 8 }}
                          />
                          <Text className="font-extrabold text-base tracking-wide" style={{ color: ai === 0 ? '#FFFFFF' : action.color }}>
                            {actionButtonLabel(action.nextStatus)}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ))}

                  <TouchableOpacity
                    className="py-3.5 rounded-2xl items-center mt-1 border border-[#F5EDE0] bg-white"
                    onPress={() => { setShowActionModal(false); setActionOrder(null); }}
                    activeOpacity={0.7}
                  >
                    <Text className="text-stone-400 text-sm font-bold">Close</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Proof of Delivery — always mounted, Modal handles visibility */}
      <ProofOfDelivery
        visible={showProofModal}
        orderId={proofOrder?.id ?? 0}
        orderNumber={proofOrder?.order_number ?? ''}
        customerName={proofOrder?.customer_name ?? ''}
        onSubmit={handleProofSubmit}
        onCancel={handleProofCancel}
      />
    </SafeAreaView>
  );
}