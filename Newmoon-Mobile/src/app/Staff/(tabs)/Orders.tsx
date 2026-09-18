import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../../lib/api';
import { listenToStaffOrders } from '../../../../lib/websocket';
import { useAuth } from '../../../../context/authContext';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'cancelled';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_address: string;
  items: OrderItem[] | string;
  total: string | number;
  status: OrderStatus;
  branch_name?: string;
  created_at: string;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; icon: any; next?: OrderStatus[] }> = {
  pending:    { label: 'Pending',      color: '#D97706', bg: '#FEF3C7', icon: 'time-outline',      next: ['confirmed'] },
  confirmed:  { label: 'Confirmed',    color: '#EA580C', bg: '#FFF1E6', icon: 'checkmark-circle-outline', next: ['preparing'] },
  preparing:  { label: 'Preparing',    color: '#7C3AED', bg: '#EDE9FE', icon: 'flame-outline',     next: ['ready'] },
  ready:      { label: 'Ready',        color: '#16A34A', bg: '#DCFCE7', icon: 'checkmark-done-outline', next: [] },
  picked_up:  { label: 'Picked Up',    color: '#0891B2', bg: '#CFFAFE', icon: 'bicycle-outline',   next: [] },
  delivered:  { label: 'Delivered',    color: '#16A34A', bg: '#DCFCE7', icon: 'home-outline',      next: [] },
  cancelled:  { label: 'Cancelled',    color: '#DC2626', bg: '#FEE2E2', icon: 'close-circle-outline', next: [] },
};

const MANAGED_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready'];

function getNextActions(status: OrderStatus): { label: string; nextStatus: OrderStatus; color: string }[] {
  const config = STATUS_CONFIG[status];
  if (!config?.next || config.next.length === 0) return [];
  return config.next.map((ns) => ({
    label: STATUS_CONFIG[ns].label,
    nextStatus: ns,
    color: STATUS_CONFIG[ns].color,
  }));
}

const StatusPill = React.memo(({ status }: { status: OrderStatus }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <View style={{ backgroundColor: config.bg }} className="px-3 py-1 rounded-full">
      <Text style={{ color: config.color }} className="text-[10px] font-extrabold uppercase tracking-wide">
        {config.label}
      </Text>
    </View>
  );
});
StatusPill.displayName = 'StatusPill';

export default function StaffOrdersScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'active' | 'completed'>('active');

  const fetchOrders = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const res = await api.get('/staff/orders?per_page=50');
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
    if (user && (user.role === 'staff' || user.role === 'admin')) {
      unsubscribe = listenToStaffOrders(() => {
        fetchOrders();
      });
    }
    return () => {
      unsubscribe?.();
    };
  }, [fetchOrders, user?.role]);

  const handleStatusAction = async (order: Order, nextStatus: OrderStatus) => {
    try {
      await api.post(`/staff/orders/${order.id}/status`, { status: nextStatus });
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o))
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to update order status');
    }
  };

  const activeOrders = orders.filter((o) => MANAGED_STATUSES.includes(o.status));
  const completedOrders = orders.filter((o) => !MANAGED_STATUSES.includes(o.status));

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const renderOrderCard = (order: Order) => {
    const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
    const actions = getNextActions(order.status);
    const isActive = MANAGED_STATUSES.includes(order.status);

    return (
      <View
        key={order.id}
        className="bg-white rounded-3xl p-4 mb-3 border border-[#FED7AA]"
        style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}
      >
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center flex-1 mr-2">
            <View style={{ backgroundColor: config.bg }} className="w-10 h-10 rounded-xl items-center justify-center mr-3">
              <Ionicons name={config.icon} size={18} color={config.color} />
            </View>
            <View className="flex-1">
              <Text className="text-[#171717] text-sm font-extrabold" numberOfLines={1}>{order.order_number}</Text>
              <Text className="text-stone-500 text-[11px] mt-0.5" numberOfLines={1}>{order.branch_name || 'Delivery Order'}</Text>
            </View>
          </View>
          <StatusPill status={order.status} />
        </View>

        <View className="flex-row items-start mb-2">
          <Ionicons name="person-outline" size={15} color="#78716C" style={{ marginTop: 1 }} />
          <View className="ml-2 flex-1">
            <Text className="text-stone-400 text-[10px] font-bold uppercase">Customer</Text>
            <Text className="text-[#171717] text-sm font-bold">{order.customer_name}</Text>
          </View>
        </View>

        <View className="flex-row items-start mb-2">
          <Ionicons name="location-outline" size={15} color="#78716C" style={{ marginTop: 1 }} />
          <View className="ml-2 flex-1">
            <Text className="text-stone-400 text-[10px] font-bold uppercase">Delivery Address</Text>
            <Text className="text-stone-500 text-xs">{order.customer_address}</Text>
          </View>
        </View>

        <View className="bg-[#FFF7ED] rounded-2xl p-3 border border-[#FED7AA] mb-3">
          <View className="flex-row items-center">
            <Ionicons name="fast-food-outline" size={14} color="#EA580C" style={{ marginRight: 8 }} />
            <Text className="text-[#1C1917] text-xs font-semibold flex-1" numberOfLines={2}>
              {typeof order.items === 'string'
                ? order.items
                : Array.isArray(order.items)
                  ? order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')
                  : 'Items'}
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center pt-3 border-t border-[#F5EDE0]">
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={14} color="#A8A29E" style={{ marginRight: 6 }} />
            <Text className="text-stone-500 text-xs">{formatTime(order.created_at)}</Text>
          </View>
          <View className="bg-[#FFF1E6] px-3.5 py-1.5 rounded-full">
            <Text className="text-[#EA580C] text-sm font-extrabold">₱{Number(order.total).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</Text>
          </View>
        </View>

        {isActive && actions.length > 0 && (
          <View className="flex-row gap-2 mt-3 pt-3 border-t border-[#F5EDE0]">
            {actions.map((action) => (
              <TouchableOpacity
                key={action.nextStatus}
                style={{ backgroundColor: action.color }}
                className="flex-1 py-3 rounded-xl items-center"
                onPress={() => handleStatusAction(order, action.nextStatus)}
                activeOpacity={0.8}
              >
                <Text className="text-white text-xs font-extrabold">{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-[#FFF7ED]">
        <View
          className="w-24 h-24 rounded-full bg-[#FFF1E6] items-center justify-center mb-5 border border-[#FED7AA] overflow-hidden"
          style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 4 }}
        >
          <Image
            source={require('../../../../assets/images/logooos.jpg')}
            className="w-full h-full"
            resizeMode="cover"
          />
        </View>
        <Text className="text-[#171717] text-xl font-extrabold tracking-widest">NEWMOON</Text>
        <Text className="text-[#451A03] text-[11px] font-bold uppercase tracking-[2px] mt-1">Lechon Manok &amp; Liempo House</Text>
        <ActivityIndicator size="large" color="#EA580C" />
        <Text className="text-stone-500 text-[13px] mt-4">Loading orders...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FFF7ED]">
      <StatusBar barStyle="dark-content" backgroundColor="#FFF7ED" />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchOrders(true)}
            tintColor="#EA580C"
            colors={['#EA580C']}
            title="Pull to refresh..."
            titleColor="#A8A29E"
          />
        }
      >
        {/* ===== LIGHT HEADER ===== */}
        <View className="px-5 pt-2 pb-2">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <View className="w-12 h-12 rounded-xl bg-[#FFF1E6] items-center justify-center mr-3 overflow-hidden">
                <Image
                  source={require('../../../../assets/images/logooos.jpg')}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              </View>
              <View>
                <Text className="text-[#171717] text-base font-extrabold tracking-wide">NEWMOON</Text>
                <Text className="text-[#451A03] text-[9px] font-bold uppercase tracking-[1.5px] mt-0.5">Lechon Manok &amp; Liempo House</Text>
              </View>
            </View>

            <TouchableOpacity
              className="w-10 h-10 rounded-full bg-white items-center justify-center border border-[#FED7AA] ml-2"
              style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 }}
              onPress={() => fetchOrders(true)}
              disabled={refreshing}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={19} color="#451A03" />
            </TouchableOpacity>
          </View>

          <View className="mt-5 flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-2xl font-extrabold text-[#171717]">Orders</Text>
              <Text className="text-sm text-stone-500 mt-1">Manage incoming orders queue</Text>
            </View>
            <View className="bg-[#FFF1E6] px-2.5 py-1 rounded-full ml-2">
              <Text className="text-[#EA580C] text-[11px] font-bold">🔥 {activeOrders.length}</Text>
            </View>
          </View>

          {/* Status pills */}
          <View className="flex-row flex-wrap gap-3 mt-4">
            <View className="flex-row items-center px-4 py-2.5 rounded-full bg-white border border-[#FED7AA]">
              <View className="w-2.5 h-2.5 rounded-full mr-2 bg-[#EA580C]" />
              <Text className="text-[#EA580C] text-xs font-extrabold tracking-wider uppercase">{activeOrders.length} Active</Text>
            </View>
            <View className="flex-row items-center px-4 py-2.5 rounded-full bg-white border border-[#FED7AA]">
              <View className="w-2.5 h-2.5 rounded-full mr-2 bg-green-500" />
              <Text className="text-green-600 text-xs font-extrabold tracking-wider uppercase">{completedOrders.length} Delivered</Text>
            </View>
          </View>
        </View>

        {/* ===== ACTIVE / COMPLETED FILTER ===== */}
        <View className="px-5 mt-6">
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setSelectedTab('active')}
              className={`px-4 py-2.5 rounded-full border ${selectedTab === 'active' ? 'bg-[#EA580C] border-[#EA580C]' : 'bg-white border-[#FED7AA]'}`}
              style={selectedTab === 'active' ? { shadowColor: '#EA580C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 } : undefined}
              activeOpacity={0.8}
            >
              <Text className={selectedTab === 'active' ? 'text-white text-xs font-extrabold' : 'text-stone-500 text-xs font-bold'}>
                Active ({activeOrders.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedTab('completed')}
              className={`px-4 py-2.5 rounded-full border ${selectedTab === 'completed' ? 'bg-[#16A34A] border-[#16A34A]' : 'bg-white border-[#FED7AA]'}`}
              style={selectedTab === 'completed' ? { shadowColor: '#16A34A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 } : undefined}
              activeOpacity={0.8}
            >
              <Text className={selectedTab === 'completed' ? 'text-white text-xs font-extrabold' : 'text-stone-500 text-xs font-bold'}>
                Completed ({completedOrders.length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== ORDER LIST ===== */}
        <View className="px-5 mt-5">
          {selectedTab === 'active' && (
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1">
                <Text className="text-xl font-extrabold text-[#171717]">Active Queue</Text>
                <Text className="text-sm text-stone-500 mt-0.5">Orders waiting on your branch</Text>
              </View>
              <View className="bg-[#FFF1E6] px-2.5 py-1 rounded-full ml-2">
                <Text className="text-[#EA580C] text-[11px] font-bold">🔥 {activeOrders.length}</Text>
              </View>
            </View>
          )}
          {selectedTab === 'completed' && (
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1">
                <Text className="text-xl font-extrabold text-[#171717]">Completed</Text>
                <Text className="text-sm text-stone-500 mt-0.5">Picked up and delivered orders</Text>
              </View>
              <View className="bg-[#DCFCE7] px-2.5 py-1 rounded-full ml-2">
                <Text className="text-[#16A34A] text-[11px] font-bold">✓ {completedOrders.length}</Text>
              </View>
            </View>
          )}

          {(selectedTab === 'active' ? activeOrders : completedOrders).length === 0 ? (
            <View className="bg-white rounded-3xl p-8 border border-[#FED7AA] items-center">
              <View className="w-16 h-16 rounded-full bg-[#FFF1E6] items-center justify-center mb-3 border border-[#FED7AA]">
                <Ionicons
                  name={selectedTab === 'active' ? 'receipt-outline' : 'checkmark-done-outline'}
                  size={30}
                  color="#EA580C"
                />
              </View>
              <Text className="text-[#171717] font-extrabold text-base">
                {selectedTab === 'active' ? 'No Active Orders' : 'No Completed Orders'}
              </Text>
              <Text className="text-stone-500 text-xs mt-1 text-center">
                {selectedTab === 'active' ? 'New orders from customers will appear here' : 'Completed orders will appear here'}
              </Text>
            </View>
          ) : (
            (selectedTab === 'active' ? activeOrders : completedOrders).map(renderOrderCard)
          )}
        </View>

        {/* ===== FOOTER BRANDING ===== */}
        <View className="items-center px-5 mt-8 mb-2">
          <View className="w-10 h-[3px] rounded-full bg-[#FED7AA] mb-4" />
          <Ionicons name="flame" size={16} color="#EA580C" />
          <Text className="text-[#451A03] text-xs font-extrabold tracking-widest mt-1">NEWMOON</Text>
          <Text className="text-stone-500 text-[10px] mt-0.5 tracking-wide">Lechon Manok &amp; Liempo House</Text>
          <Text className="text-[#EA580C] text-[10px] font-bold mt-0.5">Fresh from the Grill</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}