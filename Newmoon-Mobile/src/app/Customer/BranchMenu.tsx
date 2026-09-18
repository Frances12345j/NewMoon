import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import api from '../../../lib/api';
import { useCart } from '../../../context/cartContext';

type ProductStock = {
  branch_id: number | string;
  quantity: number;
};

type MenuProduct = {
  id: number;
  name: string;
  price: number | string;
  description?: string | null;
  image?: string | null;
  product_stocks?: ProductStock[];
  stocks?: ProductStock[];
};

function formatPrice(value: number | string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '₱0.00';
  return `₱${amount.toFixed(2)}`;
}

async function fetchAllProducts(): Promise<MenuProduct[]> {
  const products: MenuProduct[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await api.get('/products', { params: { page } });
    const payload = response.data;
    const pageData = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    products.push(...pageData);
    lastPage = payload?.last_page ?? 1;
    page += 1;
  } while (page <= lastPage);

  return products;
}

function getBranchStock(product: MenuProduct, branchId: number): ProductStock | undefined {
  const stocks = product.product_stocks ?? product.stocks ?? [];
  return stocks.find((stock) => String(stock.branch_id) === String(branchId));
}

export default function BranchMenuScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    name?: string;
    address?: string;
    phone?: string;
  }>();

  const branchId = Number(params.id);
  const branchName = params.name ?? 'Branch';
  const branchAddress = params.address;
  const branchPhone = params.phone;

  const { addItem, items: cartItems, subtotal, itemCount, removeItem, updateQuantity } = useCart();

  const [products, setProducts] = useState<MenuProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cartVisible, setCartVisible] = useState(false);

  const branchProducts = useMemo(() => {
    return products.filter((product) => {
      const stock = getBranchStock(product, branchId);
      return stock && Number(stock.quantity) > 0;
    });
  }, [products, branchId]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return branchProducts;
    const query = searchQuery.toLowerCase().trim();
    return branchProducts.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
    );
  }, [branchProducts, searchQuery]);

  const loadData = useCallback(async () => {
    const productList = await fetchAllProducts();
    setProducts(productList);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadData();
      } catch {
        Alert.alert('Error', 'Unable to load menu. Please try again.');
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

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text className="text-gray-500 text-base mt-4">Loading menu...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1 bg-gray-50"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#f49110']}
            tintColor="#F59E0B"
          />
        }
      >
        {/* Header */}
        <View className="bg-[#fbbf24] pt-8 pb-6 px-6 rounded-b-3xl">
          <View className="flex-row items-center mb-4">
            <TouchableOpacity
              className="w-10 h-10 rounded-full bg-white items-center justify-center"
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color="#78350F" />
            </TouchableOpacity>
            <View className="flex-1 ml-3">
              <Text className="text-yellow-900/80 text-xs font-medium tracking-wider uppercase">
                Menu Items
              </Text>
              <Text className="text-yellow-900 text-2xl font-bold mt-0.5" numberOfLines={1}>
                {branchName}
              </Text>
            </View>
          </View>

          {/* Branch info */}
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-white/30 items-center justify-center mr-3">
              <Ionicons name="storefront-outline" size={20} color="#78350F" />
            </View>
            <View className="flex-1">
              {branchAddress ? (
                <Text className="text-yellow-900/80 text-xs" numberOfLines={2}>
                  {branchAddress}
                </Text>
              ) : null}
              {branchPhone ? (
                <Text className="text-yellow-900/60 text-xs mt-0.5">{branchPhone}</Text>
              ) : null}
            </View>
          </View>

          {/* Search Bar */}
          <View className="bg-white rounded-xl px-4 py-1 flex-row items-center mt-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
            <Ionicons name="search-outline" size={22} color="#6B7280" />
            <TextInput
              className="flex-1 ml-2 text-base text-gray-800 py-3"
              placeholder="Search in this branch..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Menu Items - Grid Style */}
        <View className="mt-6 px-6">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-800">Menu</Text>
            <Text className="text-gray-400 text-sm">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'}
            </Text>
          </View>

          {filteredProducts.length === 0 ? (
            <View className="bg-white rounded-xl p-8 items-center border border-gray-100" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}>
              <Ionicons name="restaurant-outline" size={48} color="#9CA3AF" />
              <Text className="text-gray-800 text-base font-medium mt-3 text-center">
                {searchQuery.trim() ? 'No items match your search' : 'No items available in this branch'}
              </Text>
              {searchQuery.trim() && (
                <Text className="text-gray-500 text-sm text-center mt-1">
                  Try adjusting your search terms
                </Text>
              )}
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between">
              {filteredProducts.map((item, index) => {
                const stock = getBranchStock(item, branchId);
                const quantity = stock ? Number(stock.quantity) : 0;
                const isBestSeller = index < 2;

                const addToCart = () => {
                  if (quantity <= 0) return;
                  addItem(
                    item.id,
                    item.name,
                    Number(item.price),
                    branchId,
                    branchName,
                    item.image
                  );
                  setCartVisible(true);
                };

                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={quantity > 0 ? 0.7 : 1}
                    onPress={addToCart}
                    disabled={quantity <= 0}
                    className="bg-white rounded-xl mb-4 border border-gray-100 overflow-hidden"
                    style={{ width: '48%', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
                  >
                    {isBestSeller && (
                      <View className="bg-red-500 px-3 py-0.5 self-start rounded-br-lg">
                        <Text className="text-white text-[10px] font-bold tracking-wider">
                          BEST SELLER
                        </Text>
                      </View>
                    )}

                    <View className="p-3">
                      {item.image ? (
                        <Image
                          source={{ uri: `${(api.defaults?.baseURL ?? '').replace('/api', '')}/storage/${item.image}` }}
                          className="w-full h-28 rounded-lg"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="w-full h-28 bg-gray-100 rounded-lg items-center justify-center">
                          <Ionicons name="restaurant-outline" size={32} color="#9CA3AF" />
                        </View>
                      )}

                      <Text className="text-sm font-bold text-gray-800 mt-2" numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.description && (
                        <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                          {item.description}
                        </Text>
                      )}

                      <View className="flex-row items-center justify-between mt-2">
                        <Text className="text-base font-bold text-yellow-600">
                          {formatPrice(item.price)}
                        </Text>

                        <TouchableOpacity
                          className={`w-7 h-7 rounded-full items-center justify-center ${
                            quantity > 0 ? 'bg-yellow-400' : 'bg-gray-200'
                          }`}
                          disabled={quantity <= 0}
                          onPress={addToCart}
                        >
                          <Ionicons
                            name="add"
                            size={18}
                            color={quantity > 0 ? "#78350F" : "#9CA3AF"}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Cart Bottom Sheet Popup */}
      <Modal
        visible={cartVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCartVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
          onPress={() => setCartVisible(false)}
        >
          <Pressable
            style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingBottom: 34 }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' }} />
            </View>

            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="cart-outline" size={22} color="#78350F" />
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#78350F', marginLeft: 8 }}>Your Cart</Text>
              </View>
              <View style={{ backgroundColor: '#FEF3C7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#92400E' }}>
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </Text>
              </View>
            </View>

            {cartItems.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 }}>
                <Ionicons name="cart-outline" size={48} color="#D1D5DB" />
                <Text style={{ fontSize: 15, color: '#9CA3AF', marginTop: 8 }}>Your cart is empty</Text>
              </View>
            ) : (
              <>
                {/* Cart Items */}
                <ScrollView
                  style={{ paddingHorizontal: 20 }}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                >
                  {cartItems.map((item) => (
                    <View
                      key={item.productId}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: '#FFFBEB',
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: '#FDE68A',
                      }}
                    >
                      {/* Item image or placeholder */}
                      {item.image ? (
                        <Image
                          source={{ uri: `${(api.defaults?.baseURL ?? '').replace('/api', '')}/storage/${item.image}` }}
                          style={{ width: 48, height: 48, borderRadius: 10 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="restaurant-outline" size={22} color="#9CA3AF" />
                        </View>
                      )}

                      {/* Name + Price */}
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }} numberOfLines={1}>{item.name}</Text>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#D97706', marginTop: 2 }}>{formatPrice(item.price)}</Text>
                      </View>

                      {/* Qty controls */}
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity
                          onPress={() => updateQuantity(item.productId, item.quantity - 1)}
                          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Ionicons name="remove" size={16} color="#6B7280" />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1F2937', marginHorizontal: 10, minWidth: 20, textAlign: 'center' }}>
                          {item.quantity}
                        </Text>
                        <TouchableOpacity
                          onPress={() => updateQuantity(item.productId, item.quantity + 1)}
                          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#FBBF24', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Ionicons name="add" size={16} color="#78350F" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>

                {/* Subtotal + View Cart */}
                <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 14, color: '#6B7280' }}>Subtotal</Text>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#78350F' }}>{formatPrice(subtotal)}</Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      setCartVisible(false);
                      router.push('/Customer/Cart');
                    }}
                    style={{ backgroundColor: '#F59E0B', borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="cart-outline" size={18} color="#78350F" />
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#78350F', marginLeft: 8 }}>View Cart</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Floating Cart */}
      {!cartVisible && itemCount > 0 && (
        <View className="absolute left-4 right-4" style={{ bottom: 20 }}>
          <TouchableOpacity
            onPress={() => setCartVisible(true)}
            className="bg-[#78350F] rounded-2xl px-4 py-3 flex-row items-center justify-between"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}
            activeOpacity={0.9}
          >
            <View className="flex-row items-center flex-1">
              <View className="w-10 h-10 rounded-full bg-[#F59E0B] items-center justify-center mr-3">
                <Ionicons name="cart" size={18} color="#78350F" />
              </View>
              <View className="flex-1">
                <Text className="text-white text-sm font-bold">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </Text>
                <Text className="text-yellow-300 text-xs font-medium mt-0.5">
                  Subtotal: {formatPrice(subtotal)}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center">
              <Text className="text-yellow-300 text-sm font-bold mr-1">View Cart</Text>
              <Ionicons name="arrow-forward" size={18} color="#FCD34D" />
            </View>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
