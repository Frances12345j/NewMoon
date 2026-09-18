import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '../../../../lib/api';

export default function EarningsScreen() {
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [deliveryCount, setDeliveryCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/rider/orders?per_page=100');
        const orders = res.data?.data ?? [];
        const delivered = orders.filter((o: any) => o.status === 'delivered');
        setDeliveryCount(delivered.length);
        setTotalEarnings(delivered.reduce((sum: number, o: any) => sum + (o.total || 0), 0));
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-[#FFF7ED]">
      {/* Premium NewMoon Header */}
      <View className="px-5 pt-4 pb-4 bg-[#FFF7ED]">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-11 h-11 rounded-2xl bg-white items-center justify-center border border-[#F5EDE0]"
            activeOpacity={0.7}
            style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
          >
            <Ionicons name="arrow-back" size={20} color="#451A03" />
          </TouchableOpacity>

          <View className="ml-4 flex-1">
            <Text className="text-2xl font-extrabold text-[#451A03]">Earnings</Text>
            <Text className="text-[12px] text-stone-500 mt-0.5">Track your delivery earnings</Text>
          </View>

          <View className="w-11 h-11 rounded-2xl bg-[#FFF1E6] items-center justify-center border border-[#FED7AA]">
            <Ionicons name="flame" size={20} color="#EA580C" />
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-[#FFF7ED]"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 32 }}
      >
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <View
              className="w-20 h-20 rounded-3xl bg-[#FFF1E6] items-center justify-center mb-5"
              style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 6 }}
            >
              <Ionicons name="wallet-outline" size={38} color="#EA580C" />
            </View>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text className="text-[#451A03] font-extrabold mt-4 text-base">Loading earnings...</Text>
            <Text className="text-stone-500 text-xs mt-1 tracking-wide">NewMoon Lechon Manok &amp; Liempo</Text>
          </View>
        ) : (
          <>
            {/* Main Earnings Card */}
            <View
              className="bg-[#171717] rounded-3xl p-6 overflow-hidden w-full"
              style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6 }}
            >
              {/* Decorative warm glows + grill accent */}
              <View className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-[#EA580C] opacity-25" />
              <View className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-[#F59E0B] opacity-15" />
              <View className="absolute top-6 left-6 w-24 h-0.5 bg-[#F97316] opacity-60 rounded-full" />

              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View
                    className="w-11 h-11 rounded-2xl bg-[#EA580C] items-center justify-center"
                    style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 }}
                  >
                    <Ionicons name="wallet-outline" size={22} color="#FFFFFF" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-[#FDE68A] text-[10px] font-extrabold uppercase tracking-wider">Delivery Earnings</Text>
                    <Text className="text-[#FDBA74] text-[9px] font-bold uppercase tracking-wider mt-0.5">NewMoon Lechon Manok &amp; Liempo</Text>
                  </View>
                </View>
                <View className="flex-row items-center bg-white/10 px-2.5 py-1.5 rounded-full">
                  <Ionicons name="flame" size={11} color="#F59E0B" style={{ marginRight: 4 }} />
                  <Text className="text-[#FDE68A] text-[9px] font-bold uppercase tracking-wider">Rider</Text>
                </View>
              </View>

              <View className="flex-row items-end mt-7">
                <Text className="text-[#FDE68A] text-2xl font-extrabold mr-1 mb-1">₱</Text>
                <Text className="text-white text-4xl font-extrabold tracking-tight">{totalEarnings.toLocaleString()}</Text>
              </View>
              <Text className="text-[#FED7AA] text-xs font-semibold mt-1">Total Earnings</Text>

              {deliveryCount === 0 && (
                <View className="mt-3 self-start bg-white/10 px-3 py-1.5 rounded-full">
                  <Text className="text-[#FDBA74] text-[10px] font-bold">No completed deliveries yet</Text>
                </View>
              )}

              <View className="h-px bg-white/15 my-5" />

              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text className="text-white text-2xl font-extrabold">{deliveryCount}</Text>
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="checkmark-circle" size={11} color="#22C55E" style={{ marginRight: 4 }} />
                    <Text className="text-[#FDBA74] text-[10px] font-bold uppercase tracking-wider">Deliveries</Text>
                  </View>
                </View>
                <View className="w-px bg-white/15 h-10 mx-4" />
                <View className="flex-1">
                  <Text className="text-white text-2xl font-extrabold">{deliveryCount}</Text>
                  <View className="flex-row items-center mt-1">
                    <Ionicons name="receipt-outline" size={11} color="#F59E0B" style={{ marginRight: 4 }} />
                    <Text className="text-[#FDBA74] text-[10px] font-bold uppercase tracking-wider">Total Orders</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Statistics Cards */}
            <View className="flex-row gap-3 mt-4">
              <View
                className="flex-1 bg-white rounded-2xl p-4 border border-[#F5EDE0]"
                style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
              >
                <View className="w-9 h-9 rounded-xl bg-[#FFF1E6] items-center justify-center mb-2.5">
                  <Ionicons name="bicycle" size={16} color="#EA580C" />
                </View>
                <Text className="text-[#171717] text-xl font-extrabold">{deliveryCount}</Text>
                <Text className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mt-0.5">Deliveries</Text>
              </View>
              <View
                className="flex-1 bg-white rounded-2xl p-4 border border-[#F5EDE0]"
                style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
              >
                <View className="w-9 h-9 rounded-xl bg-[#FFF7ED] items-center justify-center mb-2.5 border border-[#FED7AA]">
                  <Ionicons name="receipt-outline" size={16} color="#7C2D12" />
                </View>
                <Text className="text-[#171717] text-xl font-extrabold">{deliveryCount}</Text>
                <Text className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mt-0.5">Total Orders</Text>
              </View>
            </View>

            {/* Motivational */}
            <View className="flex-row items-center bg-[#FFF1E6] rounded-2xl px-4 py-3 mt-4 border border-[#FED7AA]">
              <View className="w-9 h-9 rounded-xl bg-[#EA580C] items-center justify-center mr-2.5">
                <Ionicons name="flame" size={17} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="text-[#451A03] text-[13px] font-extrabold">Great work, Rider!</Text>
                <Text className="text-stone-500 text-[11px] mt-0.5">Keep delivering great service.</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}