import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import api from '../../../../lib/api';

interface ChatOrder {
  id: number;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  branch: { id: number; name: string };
  rider?: { id: number; firstname: string; lastname: string; avatar_url?: string | null } | null;
}

const CHAT_STATUSES = ['picked_up', 'out_for_delivery'];

export default function ChatScreen() {
  const [orders, setOrders] = useState<ChatOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const response = await api.get('/customer/orders?per_page=50');
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      const chatOrders = data.filter((o: ChatOrder) => CHAT_STATUSES.includes(o.status));
      setOrders(chatOrders);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadOrders();
  }, [loadOrders]));

  useEffect(() => {
    const timer = setInterval(() => loadOrders(), 10000);
    return () => clearInterval(timer);
  }, [loadOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-6 pt-12 pb-6" style={{ backgroundColor: '#FBBF24' }}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-yellow-900 text-2xl font-bold">
              Messages
            </Text>
          </View>
          <TouchableOpacity
            className="bg-white/30 p-2.5 rounded-full"
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={20} color="#78350F" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center bg-gray-50">
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      ) : orders.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 bg-gray-50">
          <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
            <Ionicons name="chatbubble-outline" size={40} color="#9CA3AF" />
          </View>
          <Text className="text-gray-900 text-xl font-bold">No active chats</Text>
          <Text className="text-gray-500 text-sm text-center mt-2">
            Chat with your rider once your order is picked up
          </Text>
          <TouchableOpacity
            className="mt-6 bg-yellow-400 px-8 py-3 rounded-full"
            onPress={() => router.push('/Customer/Home')}
          >
            <Text className="text-yellow-900 font-semibold">Browse Menu</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4 pt-4 bg-gray-50"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />}
        >
          {(() => {
            const seen = new Map<number, ChatOrder>();
            orders.forEach((order) => {
              if (order.rider?.id && !seen.has(order.rider.id)) {
                seen.set(order.rider.id, order);
              }
            });
            return Array.from(seen.entries());
          })().map(([riderId, order]) => {
            const rider = order.rider!;
            const fullName = `${rider.firstname} ${rider.lastname}`.trim();
            const riderInitial = (rider.firstname?.[0] || rider.lastname?.[0] || 'R').toUpperCase();
            return (
              <TouchableOpacity
                key={riderId}
                className="bg-white rounded-2xl p-4 mb-3 border border-gray-100 shadow-sm flex-row items-center"
                activeOpacity={0.7}
                onPress={() => router.push(`/Customer/orderChat?orderId=${order.id}`)}
              >
                <View className="w-12 h-12 rounded-full bg-[#FFF1E6] items-center justify-center overflow-hidden mr-3">
                  {rider.avatar_url ? (
                    <Image key={rider.avatar_url} source={{ uri: rider.avatar_url }} className="w-full h-full" resizeMode="cover" />
                  ) : (
                    <Text className="text-[#EA580C] font-extrabold text-lg">{riderInitial}</Text>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-gray-900">{fullName}</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">Delivery Rider</Text>
                </View>
                <View className="flex-row items-center">
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#F59E0B" style={{ marginRight: 6 }} />
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            );
          })}
          <View className="h-24" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
