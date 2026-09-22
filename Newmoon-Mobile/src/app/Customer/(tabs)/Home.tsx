import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
  TextInput,
  ImageBackground,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import api from '../../../../lib/api';
import { useAuthContext } from '../../../../context/authContext';
import { useCart } from '../../../../context/cartContext';
import { useAddress } from '../../../../context/addressContext';
import {
  CustomerBranch,
  getSelectedBranch,
  saveSelectedBranch,
} from '../../../../lib/customerBranchStorage';
import AddressModal from '../AddressModal';

async function fetchAllBranches(): Promise<CustomerBranch[]> {
  const branches: CustomerBranch[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await api.get('/branches', { params: { page } });
    const payload = response.data;
    const pageData = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    branches.push(...pageData);
    lastPage = payload?.last_page ?? 1;
    page += 1;
  } while (page <= lastPage);

  return branches;
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthContext();

  const [branches, setBranches] = useState<CustomerBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<CustomerBranch | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { addressModalVisible, openAddressModal, closeAddressModal, selectedAddress, setSelectedAddress } = useAddress();
  const { itemCount } = useCart();

  const displayName = user?.firstname?.trim() || user?.username || 'Customer';
  const userInitial = displayName.charAt(0).toUpperCase();

  const filteredBranches = useMemo(() => {
    if (!searchQuery.trim()) return branches;
    const query = searchQuery.toLowerCase().trim();
    return branches.filter(
      (branch) =>
        branch.name.toLowerCase().includes(query) ||
        branch.address?.toLowerCase().includes(query) ||
        branch.code?.toLowerCase().includes(query)
    );
  }, [branches, searchQuery]);

  const loadData = useCallback(async () => {
    const [branchList, savedBranch] = await Promise.all([
      fetchAllBranches(),
      getSelectedBranch(),
    ]);

    setBranches(branchList);

    const savedStillValid = savedBranch && branchList.some((branch) => branch.id === savedBranch.id);
    const nextBranch = savedStillValid ? savedBranch : branchList[0] ?? null;
    setSelectedBranch(nextBranch);
    if (nextBranch) {
      await saveSelectedBranch(nextBranch);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadData();
      } catch {
        Alert.alert('Error', 'Unable to load branches. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch {
      Alert.alert('Error', 'Unable to refresh. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await signOut();
            router.replace('/Login');
          } catch {
            Alert.alert('Error', 'Failed to logout. Please try again.');
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const openBranchMenu = (branch: CustomerBranch) => {
    router.push({
      pathname: '/Customer/BranchMenu',
      params: {
        id: String(branch.id),
        name: branch.name,
        address: branch.address ?? '',
        phone: branch.phone ?? '',
      },
    });
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
        <Text className="text-[#451A03] text-[11px] font-bold uppercase tracking-[2px] mt-1">Lechon Manok &amp; Liempo</Text>
        <ActivityIndicator size="large" color="#EA580C" />
        <Text className="text-stone-500 text-[13px] mt-4">Loading your food experience...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FFF7ED]">
      <StatusBar barStyle="dark-content" backgroundColor="#FFF7ED" />

      <ScrollView
        className="flex-1 bg-[#FFF7ED]"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#EA580C']}
            tintColor="#EA580C"
          />
        }
      >
        <View>
          {/* Light header */}
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
                  <Text className="text-[#451A03] text-[9px] font-bold uppercase tracking-[1.5px] mt-0.5">Lechon Manok &amp; Liempo</Text>
                </View>
              </View>

              <View className="flex-row items-center gap-2 ml-2">
                <TouchableOpacity
                  className="w-10 h-10 rounded-full bg-white items-center justify-center border border-[#FED7AA]"
                  style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 }}
                  onPress={() => router.push('/Customer/Profile' as unknown as any)}
                  activeOpacity={0.7}
                >
                  {user?.avatar_url ? (
                    <Image
                      key={user.avatar_url}
                      source={{ uri: user.avatar_url }}
                      className="w-full h-full rounded-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Text className="text-[#EA580C] font-extrabold text-base">{userInitial}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  className="w-10 h-10 rounded-full bg-white items-center justify-center border border-[#FED7AA]"
                  style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 }}
                  onPress={() => router.push('/Customer/Cart' as unknown as any)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="cart-outline" size={20} color="#EA580C" />
                  {itemCount > 0 && (
                    <View className="absolute -top-1 -right-1 bg-[#EA580C] rounded-full min-w-[20px] h-5 items-center justify-center px-1 border-2 border-white">
                      <Text className="text-white text-[10px] font-bold">{itemCount > 99 ? '99+' : itemCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  className="w-10 h-10 rounded-full bg-white items-center justify-center border border-[#FED7AA]"
                  style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 }}
                  onPress={handleLogout}
                  disabled={loggingOut}
                  activeOpacity={0.7}
                >
                  {loggingOut ? (
                    <ActivityIndicator size="small" color="#EA580C" />
                  ) : (
                    <Ionicons name="log-out-outline" size={19} color="#451A03" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View className="mt-5">
              <Text className="text-2xl font-extrabold text-[#171717]">Hey, {displayName}! 👋</Text>
              <Text className="text-sm text-stone-500 mt-1">What are you craving today?</Text>
            </View>

            {/* Search Bar */}
            <View
              className="bg-white rounded-2xl px-4 flex-row items-center mt-4 border border-[#FED7AA]"
              style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }}
            >
              <Ionicons name="search" size={18} color="#EA580C" />
              <TextInput
                className="flex-1 ml-2.5 text-[14px] text-[#171717] py-3"
                placeholder="Search branches..."
                placeholderTextColor="#A8A29E"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={20} color="#EA580C" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Delivery Address Card */}
          <View className="px-5 mt-3">
            <TouchableOpacity
              className="flex-row items-center bg-white px-4 py-4 rounded-2xl border border-[#FED7AA]"
              style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
              onPress={openAddressModal}
              activeOpacity={0.7}
            >
              <View className="w-10 h-10 rounded-full bg-[#FFF1E6] items-center justify-center mr-3">
                <Ionicons name="location-outline" size={19} color="#EA580C" />
              </View>
              <View className="flex-1">
                <Text className="text-stone-400 text-[10px] font-bold uppercase tracking-wider">Deliver to</Text>
                <Text className="text-[#171717] text-[13px] font-bold mt-0.5" numberOfLines={1}>
                  {selectedAddress
                    ? [selectedAddress.street, selectedAddress.barangay, selectedAddress.city, selectedAddress.province].filter(Boolean).join(', ')
                    : selectedBranch ? selectedBranch.name : 'Set delivery address'}
                </Text>
              </View>
              <View className="bg-[#FFF1E6] px-3 py-2 rounded-xl ml-2">
                <Text className="text-[#EA580C] text-[12px] font-bold">Change</Text>
              </View>
            </TouchableOpacity>
          </View>

          {branches.length === 0 ? (
            <View className="items-center px-8 pt-14 pb-10">
              <View
                className="w-24 h-24 rounded-full bg-[#FFF1E6] items-center justify-center mb-4 border border-[#FED7AA]"
                style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 4 }}
              >
                <Ionicons name="storefront-outline" size={42} color="#EA580C" />
              </View>
              <Text className="text-xl font-extrabold text-[#171717] text-center">
                No NewMoon branches yet
              </Text>
              <Text className="text-sm text-stone-500 text-center mt-2">
                Please check again later.
              </Text>
              <View className="bg-[#FFF1E6] px-3 py-1.5 rounded-full border border-[#FED7AA] mt-4">
                <Text className="text-[#EA580C] text-[10px] font-bold uppercase tracking-wider">🔥 Fresh from the grill</Text>
              </View>
            </View>
          ) : (
            <>
              {/* Featured Dish */}
              <View className="px-5 mt-6">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-1">
                    <Text className="text-xl font-extrabold text-[#171717]">Today&apos;s Special</Text>
                    <Text className="text-sm text-stone-500 mt-0.5">Fresh from the grill. Don&apos;t miss out.</Text>
                  </View>
                  <View className="bg-[#FFF1E6] px-2.5 py-1 rounded-full ml-2">
                    <Text className="text-[#EA580C] text-[11px] font-bold">🔥 Special</Text>
                  </View>
                </View>

                <View
                  className="bg-white rounded-3xl border border-[#FED7AA] overflow-hidden"
                  style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 5 }}
                >
                  <View>
                    <ImageBackground
                      source={require('../../../../assets/images/logooos.jpg')}
                      className="w-full h-48"
                      resizeMode="cover"
                    >
                      <View className="absolute top-3 left-3 bg-[#EA580C] px-3 py-1 rounded-full"
                        style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 5, elevation: 2 }}
                      >
                        <Text className="text-white text-[11px] font-extrabold">30% OFF</Text>
                      </View>
                    </ImageBackground>
                  </View>

                  <View className="p-5 bg-[#FFFBF5]">
                    <Text className="text-[#EA580C] text-[10px] font-bold uppercase tracking-[1.5px]">NewMoon Special</Text>
                    <Text className="text-[#171717] text-xl font-extrabold mt-1">Lechon Manok</Text>
                    <Text className="text-stone-500 text-sm mt-1">Freshly roasted. Juicy. Delicious.</Text>
                    <View className="flex-row items-center justify-between mt-4">
                      <View className="flex-row items-baseline">
                        <Text className="text-[#171717] text-2xl font-extrabold">₱250</Text>
                        <Text className="text-stone-400 text-sm line-through ml-2">₱300</Text>
                      </View>
                      <TouchableOpacity
                        className="bg-[#EA580C] rounded-xl px-5 py-2.5"
                        style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 }}
                        activeOpacity={0.8}
                        onPress={() => { if (selectedBranch) openBranchMenu(selectedBranch); }}
                      >
                        <Text className="text-white text-[13px] font-bold">ORDER NOW</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              {/* Branch section */}
              <View className="mt-7 px-5">
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-1 mr-2">
                    <Text className="text-xl font-extrabold text-[#171717]">Choose Your Branch</Text>
                    <Text className="text-sm text-stone-500 mt-0.5">Find a NewMoon near you.</Text>
                  </View>
                  <View className="bg-[#FFF1E6] px-2.5 py-1 rounded-full">
                    <Text className="text-[#EA580C] text-[11px] font-bold">
                      {filteredBranches.length} {filteredBranches.length === 1 ? 'branch' : 'branches'}
                    </Text>
                  </View>
                </View>

                {filteredBranches.length === 0 ? (
                  <View className="bg-white rounded-2xl p-8 items-center border border-[#FED7AA]"
                    style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
                  >
                    <View className="w-16 h-16 rounded-full bg-[#FFF1E6] items-center justify-center mb-3 border border-[#FED7AA]">
                      <Ionicons name={searchQuery.trim() ? 'search-outline' : 'storefront-outline'} size={30} color="#EA580C" />
                    </View>
                    <Text className="text-[#171717] text-base font-extrabold mt-1 text-center">
                      {searchQuery.trim() ? 'No branches found' : 'No branches available'}
                    </Text>
                    <Text className="text-stone-500 text-[13px] mt-2 text-center">
                      {searchQuery.trim() ? 'Try searching for another branch or location.' : 'Please check back later.'}
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row flex-wrap justify-between">
                    {filteredBranches.map((branch) => (
                      <TouchableOpacity
                        key={branch.id}
                        className="bg-white rounded-2xl mb-4 border border-[#FED7AA] overflow-hidden"
                        style={{ width: '48%', shadowColor: '#451A03', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
                        activeOpacity={0.8}
                        onPress={() => openBranchMenu(branch)}
                      >
                        <View className="w-full h-20 bg-[#FFF1E6] items-center justify-center">
                          <View
                            className="w-11 h-11 rounded-full bg-white items-center justify-center border border-[#FED7AA]"
                            style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 2 }}
                          >
                            <Ionicons name="storefront" size={20} color="#EA580C" />
                          </View>
                        </View>

                        <View className="p-3">
                          <Text className="text-[13px] font-bold text-[#171717]" numberOfLines={1}>
                            {branch.name}
                          </Text>
                          {branch.address && (
                            <Text className="text-[11px] text-stone-500 mt-0.5 leading-4" numberOfLines={2}>
                              {branch.address}
                            </Text>
                          )}
                          <View className="flex-row items-center justify-between mt-2">
                            {branch.phone ? (
                              <View className="flex-row items-center flex-1">
                                <Ionicons name="call-outline" size={10} color="#A8A29E" style={{ marginRight: 3 }} />
                                <Text className="text-[10px] text-stone-400" numberOfLines={1}>
                                  {branch.phone}
                                </Text>
                              </View>
                            ) : (
                              <View />
                            )}
                            <View className="bg-[#FFF1E6] w-6 h-6 rounded-full items-center justify-center ml-1 border border-[#FED7AA]">
                              <Ionicons name="chevron-forward" size={12} color="#EA580C" />
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Footer brand line */}
              <View className="items-center px-5 mt-6 mb-2">
                <View className="w-10 h-[3px] rounded-full bg-[#FED7AA] mb-4" />
                <Ionicons name="flame" size={16} color="#EA580C" />
                <Text className="text-[#451A03] text-xs font-extrabold tracking-widest mt-1">NEWMOON</Text>
                <Text className="text-stone-500 text-[10px] mt-0.5 tracking-wide">Lechon Manok &amp; Liempo</Text>
                <Text className="text-[#EA580C] text-[10px] font-bold mt-0.5">Fresh from the Grill</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Address Modal */}
      <AddressModal
        visible={addressModalVisible}
        onClose={closeAddressModal}
        onSelect={(addr) => {
          setSelectedAddress(addr);
          closeAddressModal();
        }}
        selectedAddress={selectedAddress}
      />

    </SafeAreaView>
  );
}