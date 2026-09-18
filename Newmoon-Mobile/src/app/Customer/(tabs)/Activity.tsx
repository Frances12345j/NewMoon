import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../../../lib/api';

interface RecentOrder {
  id: number;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  branch: { name: string };
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#EA580C',
  preparing: '#F97316',
  ready: '#16A34A',
  picked_up: '#D97706',
  out_for_delivery: '#EA580C',
  delivered: '#16A34A',
  cancelled: '#DC2626',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready for Pickup',
  picked_up: 'Picked Up',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const STATUS_ICONS: Record<string, string> = {
  picked_up: 'bag-handle-outline',
  out_for_delivery: 'bicycle-outline',
  delivered: 'checkmark-circle',
};

export default function ActivityScreen() {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const response = await api.get('/customer/orders?per_page=20');
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      setOrders(data);
    } catch (err) {
      console.log('Failed to load recent orders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadOrders();
  }, [loadOrders]));

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FFF7ED]">
      <StatusBar barStyle="light-content" backgroundColor="#171717" />

      {/* Premium NewMoon Header */}
      <LinearGradient
        colors={['#171717', '#241207', '#451A03']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: 8, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }}
      >
        {/* Decorative warm glows */}
        <View className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-[#EA580C] opacity-20" />
        <View className="absolute -bottom-14 -left-12 w-44 h-44 rounded-full bg-[#F59E0B] opacity-10" />

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View
              className="w-9 h-9 rounded-xl bg-[#EA580C] items-center justify-center mr-2.5"
              style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 3 }}
            >
              <Ionicons name="flame" size={19} color="#FFFFFF" />
            </View>
            <View>
              <Text className="text-white text-[15px] font-extrabold leading-5 tracking-wide">NEWMOON</Text>
              <Text className="text-[#FDBA74] text-[8.5px] font-bold uppercase tracking-[1.5px] mt-0.5">Lechon Manok &amp; Liempo</Text>
            </View>
          </View>

          <TouchableOpacity
            className="w-11 h-11 bg-white rounded-full items-center justify-center border border-[#FED7AA]"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 2 }}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={20} color="#EA580C" />
          </TouchableOpacity>
        </View>

        <View className="mt-6">
          <Text className="text-[#FDE68A] text-[10px] font-extrabold uppercase tracking-[2.5px]">Latest from the grill</Text>
          <Text className="text-white text-[26px] font-extrabold mt-1">Order Activity</Text>
          <Text className="text-[#FDBA74] text-[13px] mt-1">Track your recent orders and updates.</Text>
        </View>
      </LinearGradient>

      {loading ? (
        <View className="flex-1 justify-center items-center bg-[#FFF7ED]">
          <View
            className="w-20 h-20 rounded-3xl bg-[#FFF1E6] items-center justify-center mb-5"
            style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 6 }}
          >
            <Ionicons name="flame" size={40} color="#EA580C" />
          </View>
          <ActivityIndicator size="large" color="#EA580C" />
          <Text className="text-[#451A03] font-extrabold mt-4 text-base">Loading your activity...</Text>
          <Text className="text-stone-500 text-xs mt-1 tracking-wide">NewMoon Lechon Manok &amp; Liempo</Text>
        </View>
      ) : orders.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 bg-[#FFF7ED]">
          <View
            className="w-24 h-24 rounded-full bg-[#FFF1E6] border border-[#FED7AA] items-center justify-center mb-5"
            style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 4 }}
          >
            <Ionicons name="receipt-outline" size={44} color="#EA580C" />
          </View>
          <Text className="text-[#451A03] text-2xl font-extrabold">No activity yet</Text>
          <Text className="text-stone-500 text-sm text-center mt-2 leading-5">
            Your orders and updates will appear here
          </Text>
          <TouchableOpacity
            className="mt-7 bg-[#EA580C] px-10 py-3.5 rounded-full flex-row items-center"
            style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 }}
            onPress={() => router.push('/Customer/Home')}
            activeOpacity={0.85}
          >
            <Text className="text-white font-extrabold text-[15px]">Browse Menu</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4 pt-5 bg-[#FFF7ED]"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EA580C']} tintColor="#EA580C" />}
        >
          <View className="flex-row items-center justify-between mb-3 px-1">
            <View className="flex-row items-center">
              <Text className="text-[#451A03] text-base font-extrabold">Recent Orders</Text>
              <Text className="text-[#EA580C] text-sm font-extrabold ml-1.5">({orders.length})</Text>
            </View>
            <Text className="text-stone-400 text-[11px] font-medium">Pull to refresh</Text>
          </View>

          {orders.map((order) => {
            const statusColor = STATUS_COLORS[order.status] || '#A8A29E';
            const statusIcon = STATUS_ICONS[order.status];
            return (
              <TouchableOpacity
                key={order.id}
                className="bg-white rounded-2xl p-4 mb-3 border border-[#F5EDE0]"
                style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
                activeOpacity={0.7}
                onPress={() => router.push(`/Customer/OrderDetail?id=${order.id}`)}
              >
                {/* Order number + status */}
                <View className="flex-row justify-between items-center">
                  <View className="flex-row items-center flex-1 mr-2">
                    <View className="w-7 h-7 rounded-full bg-[#FFF1E6] items-center justify-center mr-2">
                      <Ionicons name="receipt-outline" size={14} color="#EA580C" />
                    </View>
                    <Text className="text-[#171717] text-[15px] font-extrabold" numberOfLines={1}>#{order.order_number}</Text>
                  </View>
                  <View className="px-2.5 py-1 rounded-full flex-row items-center" style={{ backgroundColor: statusColor + '14' }}>
                    {statusIcon ? (
                      <Ionicons name={statusIcon as any} size={11} color={statusColor} style={{ marginRight: 4 }} />
                    ) : (
                      <View className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: statusColor }} />
                    )}
                    <Text className="text-[11px] font-bold" style={{ color: statusColor }}>
                      {STATUS_LABELS[order.status] || order.status}
                    </Text>
                  </View>
                </View>

                {/* Branch */}
                <View className="flex-row items-center mt-3">
                  <View className="w-6 h-6 rounded-full bg-[#FFF1E6] items-center justify-center mr-2">
                    <Ionicons name="storefront-outline" size={12} color="#EA580C" />
                  </View>
                  <Text className="text-[#57534E] text-[13px] font-medium flex-1" numberOfLines={1}>{order.branch.name}</Text>
                </View>

                {/* Date + total */}
                <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-[#F5EDE0]">
                  <View className="flex-row items-center flex-1 mr-2">
                    <Ionicons name="time-outline" size={13} color="#A8A29E" style={{ marginRight: 4 }} />
                    <Text className="text-[#A8A29E] text-[11px] font-medium" numberOfLines={1}>
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Text className="text-[#EA580C] text-[15px] font-extrabold mr-1.5">₱{Number(order.total).toFixed(2)}</Text>
                    <View className="w-6 h-6 rounded-full bg-[#FFF1E6] items-center justify-center">
                      <Ionicons name="chevron-forward" size={13} color="#EA580C" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}