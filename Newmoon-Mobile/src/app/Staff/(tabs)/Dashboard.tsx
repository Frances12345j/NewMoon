import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
    Modal,
    Pressable,
    Image,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../../lib/api';
import { useAuth } from '../../../../context/authContext';
import { isAuthError, isNetworkError } from '../../../../lib/network';
import { getCachedProducts } from '../../../../lib/dataCache';
import { getUser as getStoredUserFromStorage } from '../../../../lib/userStorage';
import { resolveStaffBranch } from '../../../../lib/staffContext';
import { getResolvedBranchId } from '../../../../lib/branchCache';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type StockStatus = 'Low Stock' | 'In Stock' | 'Out of Stock';

type StockItem = {
  id: string;
  name: string;
  category: string;
  type: string;
  quantity: number;
  price: number;
  minStock: number;
  status: StockStatus;
  product_stocks?: { id: string; branch_id: string | number; quantity: number; minimum_stock: number; received: boolean; branch?: { id: string; name?: string } }[];
  icon?: string;
  description?: string;
  popular?: boolean;
  received?: boolean;
  branchStock?: { id: string; branch_id: string | number; quantity: number; minimum_stock: number; received: boolean };
};

const formatLocalDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateTime = (value: any) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const idsEqual = (a: any, b: any) => String(a ?? '') === String(b ?? '');

const getSaleDate = (sale: any) => {
  const rawDate = sale?.sale_date || sale?.created_at || '';
  if (typeof rawDate !== 'string') return '';
  const match = rawDate.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
};

const sumSalesTotal = (sales: any[] = []) => {
  if (!Array.isArray(sales)) return 0;
  return sales.reduce((sum, sale) => sum + Number(sale?.total || 0), 0);
};

const formatStockQty = (qty: number): { whole: string; hasHalf: boolean } => {
  const n = Math.round(Number(qty) * 2) / 2;
  const whole = Math.floor(n);
  const hasHalf = Math.abs(n - whole - 0.5) < 0.001;
  return { whole: String(whole), hasHalf };
};

const getStoredUser = async () => {
  const stored = await getStoredUserFromStorage();
  if (stored?.firstname || stored?.username) return stored;
  try {
    const response = await api.get('me');
    return response.data || stored || null;
  } catch (error) {
    if (!isAuthError(error) && !isNetworkError(error)) {
      console.error('Unable to load dashboard user:', error);
    }
    return stored || null;
  }
};

const loadCachedStockForBranch = async (branchId: string | number | null): Promise<StockItem[]> => {
  const cached = await getCachedProducts<any>();
  if (!cached) return [];
  const productsData = Array.isArray(cached) ? cached : cached?.data ?? [];
  return productsData
    .map((item: any) => {
      const branchStock = (item.product_stocks || []).find((s: any) => idsEqual(s.branch_id, branchId));
      const quantity = Number(branchStock?.quantity ?? 0) || 0;
      const minStock = Number(branchStock?.minimum_stock ?? 0) || 0;
      const lowStockThreshold = Math.max(minStock, 15);
      const status: StockStatus = quantity <= 0 ? 'Out of Stock' : quantity <= lowStockThreshold ? 'Low Stock' : 'In Stock';
      return {
        id: String(item.id),
        name: item.name,
        category: item.category || 'Product',
        type: 'Regular',
        quantity,
        price: Number(item.price || 0),
        minStock,
        status,
        branchStock,
        product_stocks: item.product_stocks,
      };
    })
    .filter((row: StockItem) => {
      if (!branchId) return true;
      return row.branchStock != null;
    });
};

// ===== Reusable Components =====

const QuickStatCard = React.memo(({ title, subtitle, value, icon, color, bgColor }: { title: string; subtitle: string; value: string | number; icon: IoniconName; color: string; bgColor: string }) => (
  <View
    className="flex-1 bg-white rounded-3xl p-4 border border-[#FED7AA]"
    style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }}
  >
    <View style={{ backgroundColor: bgColor }} className="w-11 h-11 rounded-2xl items-center justify-center mb-3">
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text className="text-[#171717] text-2xl font-extrabold" numberOfLines={1}>{value}</Text>
    <Text className="text-[#171717] text-sm font-bold mt-0.5">{title}</Text>
    <Text className="text-stone-400 text-[10px] font-bold tracking-wide uppercase">{subtitle}</Text>
  </View>
));

const SaleRow = React.memo(({ sale }: { sale: any }) => {
  const cash = Number(sale?.cash_collected || 0);
  const change = Number(sale?.change_given ?? sale?.changeGiven ?? 0);
  const total = Number(sale?.total || 0);
  const invoice = sale?.invoice_number || `INV-${sale?.id || '-'}`;
  const hasSenior = Boolean(sale?.senior_discount);
  const discountAmount = Number(sale?.discount_amount || 0);
  const customer = sale?.customer_name || '-';

  return (
    <View
      className="bg-white rounded-3xl p-4 mb-3 border border-[#FED7AA]"
      style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}
    >
      <View className="flex-row justify-between items-start">
        <View className="flex-1 pr-3">
          <Text className="text-[#171717] text-sm font-extrabold">{invoice}</Text>
          <Text className="text-stone-500 text-xs mt-1">
            {formatDateTime(sale?.created_at || sale?.sale_date)}
          </Text>
          <Text className="text-stone-500 text-xs">Customer: {customer}</Text>
        </View>
        <View className="items-end">
          <Text className="text-[#EA580C] text-lg font-extrabold">
            ₱{total.toLocaleString()}
          </Text>
          {hasSenior && (
            <Text className="text-[#16A34A] text-[11px] font-bold mt-0.5">
              Senior: -₱{discountAmount.toLocaleString()}
            </Text>
          )}
        </View>
      </View>

      <View className="flex-row justify-between mt-3 pt-3 border-t border-[#F5EDE0]">
        <View className="items-center flex-1">
          <Text className="text-stone-400 text-[10px] font-bold uppercase">Cash</Text>
          <Text className="text-[#171717] text-sm font-bold mt-0.5">₱{cash.toLocaleString()}</Text>
        </View>
        <View className="items-center flex-1">
          <Text className="text-stone-400 text-[10px] font-bold uppercase">Change</Text>
          <Text className="text-[#171717] text-sm font-bold mt-0.5">₱{change.toLocaleString()}</Text>
        </View>
        <View className="items-center flex-1">
          <Text className="text-stone-400 text-[10px] font-bold uppercase">Payment</Text>
          <Text className="text-[#EA580C] text-sm font-extrabold mt-0.5">
            {String(sale?.payment_method || 'cash').toUpperCase()}
          </Text>
        </View>
      </View>
    </View>
  );
});

const StockRow = React.memo(({ item }: { item: StockItem }) => {
  const isLow = item.status === 'Low Stock';
  const isOut = item.status === 'Out of Stock';
  const { whole, hasHalf } = formatStockQty(item.quantity);
  const statusColors = {
    bg: isOut ? '#FEE2E2' : isLow ? '#FEF3C7' : '#DCFCE7',
    text: isOut ? '#DC2626' : isLow ? '#F59E0B' : '#16A34A',
  };

  return (
    <View
      className="bg-white rounded-3xl p-4 mb-3 border border-[#FED7AA]"
      style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}
    >
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center flex-1 mr-2">
          <View style={{ backgroundColor: statusColors.bg }} className="w-10 h-10 rounded-xl items-center justify-center mr-3">
            <Ionicons name={isOut ? 'alert-circle' : isLow ? 'warning-outline' : 'checkmark-circle'} size={18} color={statusColors.text} />
          </View>
          <View className="flex-1">
            <Text className="text-[#171717] text-sm font-extrabold" numberOfLines={2}>
              {item.name}
            </Text>
            <Text className="text-stone-500 text-[11px] mt-0.5" numberOfLines={1}>
              {item.category} • {item.type}
            </Text>
          </View>
        </View>
        <View style={{ backgroundColor: statusColors.bg }} className="px-3 py-1 rounded-full">
          <Text style={{ color: statusColors.text }} className="text-[10px] font-extrabold uppercase tracking-wide">
            {item.status}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between pt-3 border-t border-[#F5EDE0]">
        <View className="items-center flex-1">
          <Text className="text-stone-400 text-[10px] font-bold uppercase mb-1">Quantity</Text>
          <Text className="text-[#171717] text-lg font-extrabold">{hasHalf ? `${whole}.5` : whole}</Text>
          {hasHalf && (
            <View className="bg-[#FEF3C7] px-2 py-0.5 rounded-full mt-1">
              <Text className="text-[#F59E0B] text-[10px] font-bold">{whole} ½ stock</Text>
            </View>
          )}
        </View>
        <View className="items-center flex-1">
          <Text className="text-stone-400 text-[10px] font-bold uppercase mb-1">Price</Text>
          <Text className="text-[#EA580C] text-base font-extrabold">₱{item.price}</Text>
        </View>
        <View className="items-center flex-1">
          <Text className="text-stone-400 text-[10px] font-bold uppercase mb-1">Min. Stock</Text>
          <Text className="text-[#171717] text-base font-extrabold">{item.minStock}</Text>
        </View>
      </View>
    </View>
  );
});

// ===== Main Dashboard Component =====

const DashboardScreen = () => {
  const router = useRouter();
  const { user: authUser, signOut } = useAuth();

  const [stockData, setStockData] = useState<StockItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [branchResolved, setBranchResolved] = useState<boolean | null>(null);
  const [branchRetryCount, setBranchRetryCount] = useState(0);
  const [grossSales, setGrossSales] = useState(0);
  const [todaySales, setTodaySales] = useState(0);
  const [todaySalesList, setTodaySalesList] = useState<any[]>([]);
  const [salesTodayModalVisible, setSalesTodayModalVisible] = useState(false);
  const [salesTodayPage, setSalesTodayPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  const [user, setUser] = useState<any>(null);
  const [quotaProductsSold, setQuotaProductsSold] = useState(0);
  const [monthlyProductsSold, setMonthlyProductsSold] = useState(0);
  const [quotaIncentive, setQuotaIncentive] = useState(0);
  const [productTarget, setProductTarget] = useState(40);
  const [monthlyTarget, setMonthlyTarget] = useState(0);

  const SALES_TODAY_PAGE_SIZE = 4;

  const handleLogout = useCallback(() => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try { await api.post('logout'); } catch {}
          await signOut();
          router.replace('/Login');
        },
      },
    ]);
  }, [router, signOut]);

  const loadDashboardData = useCallback(async () => {
    try {
      const today = formatLocalDate();
      const now = new Date();
      const monthStart = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
      const monthEnd = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      const nextMonthStart = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 1));

      const { branchId } = await resolveStaffBranch();
      setBranchResolved(Boolean(branchId));
      if (branchId) setBranchRetryCount(0);
      const branchParams = branchId ? { branch_id: branchId } : {};

      const [productsRes, summaryRes, monthlySalesRes] = await Promise.all([
        api.get('products'),
        api.get('sales', { params: { ...branchParams, date: today, per_page: 100 } }),
        api.get('sales', { params: { ...branchParams, start_date: monthStart, end_date: nextMonthStart, per_page: 100 } }),
      ]);

      const productsData = Array.isArray(productsRes?.data) ? productsRes.data : (productsRes?.data?.data || []);

      if (!branchId) {
        // Cannot compute per-branch stock without a branch — never zero-out the dashboards.
        // Fall back to the last-known cached stock (best-effort) instead.
        try {
          const cachedBranchId = await getResolvedBranchId();
          const cachedStock = await loadCachedStockForBranch(branchId ?? cachedBranchId);
          if (cachedStock.some((row) => Number(row.quantity) > 0)) {
            setStockData(cachedStock);
          }
        } catch {}
      } else {
        const mappedStock: StockItem[] = productsData
          .map((item: any) => {
            const branchStock = (item.product_stocks || []).find((s: any) => idsEqual(s.branch_id, branchId));
            const quantity = Number(branchStock?.quantity ?? 0) || 0;
            const minStock = Number(branchStock?.minimum_stock ?? 0) || 0;
            const lowStockThreshold = Math.max(minStock, 15);
            const status: StockStatus = quantity <= 0 ? 'Out of Stock' : quantity <= lowStockThreshold ? 'Low Stock' : 'In Stock';
            return {
              id: String(item.id),
              name: item.name,
              category: item.category || 'Product',
              type: 'Regular',
              quantity,
              price: Number(item.price || 0),
              minStock,
              status,
              branchStock,
              product_stocks: item.product_stocks,
            };
          })
          .filter((row: StockItem) => row.branchStock != null);

        setStockData(mappedStock);
      }

      const summaryData = Array.isArray(summaryRes?.data) ? summaryRes.data : (summaryRes?.data?.data || []);
      setTodaySalesList(summaryData);
      setTodaySales(sumSalesTotal(summaryData));
      setSalesTodayPage(1);

      const monthlyData = Array.isArray(monthlySalesRes?.data) ? monthlySalesRes.data : (monthlySalesRes?.data?.data || []);
      const monthSalesTotal = sumSalesTotal(
        monthlyData.filter((sale: any) => {
          const saleDate = getSaleDate(sale);
          return saleDate >= monthStart && saleDate <= monthEnd;
        })
      );
      setGrossSales(monthSalesTotal);

      const storedUser = await getStoredUserFromStorage();
      try {
        const incentivesRes = await api.get('sales/product-incentives', {
          params: { month: now.getMonth() + 1, year: now.getFullYear() },
        });
        const incentivesData = incentivesRes?.data || {};
        const userIncentive = Object.values(incentivesData).find(
          (entry: any) => entry?.user_id === storedUser?.id
        ) as any;
        setQuotaProductsSold(userIncentive?.daily_products_sold ?? 0);
        setMonthlyProductsSold(userIncentive?.total_products_sold ?? 0);
        setQuotaIncentive(userIncentive?.incentive_amount ?? 0);
      } catch {
        setQuotaProductsSold(0);
        setQuotaIncentive(0);
      }

      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      try {
        const targetRes = await api.get('sales-targets', { params: { month: currentMonth } });
        const allTargets = targetRes?.data?.data || [];
        const matchedTarget = allTargets.find((t: any) => idsEqual(t.branch_id, branchId)) || allTargets[0];
        if (matchedTarget) {
          const monthly = Number(matchedTarget.target_products) || 0;
          setMonthlyTarget(monthly);
          setProductTarget(40);
        }
      } catch {
        setMonthlyTarget(0);
      }
    } catch (error: any) {
      if (isAuthError(error)) {
        try { await api.post('logout'); } catch {}
        await signOut();
        router.replace('/Login');
        return;
      }
      let cachedStock: StockItem[] = [];
      try {
        const { branchId } = await resolveStaffBranch();
        cachedStock = await loadCachedStockForBranch(branchId);
      } catch {}
      setStockData((prev) => (prev.length === 0 ? cachedStock : prev));
    } finally {
      setLoading(false);
    }
  }, [signOut, router]);

  const loadUserData = useCallback(async () => {
    const userData = await getStoredUser();
    setUser(userData);
  }, []);

  useEffect(() => {
    loadDashboardData();
    loadUserData();
  }, [loadDashboardData, loadUserData]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  useEffect(() => {
    if (branchResolved !== false || branchRetryCount >= 5) return;
    const timer = setTimeout(() => {
      setBranchRetryCount((count) => count + 1);
      loadDashboardData();
    }, 6000);
    return () => clearTimeout(timer);
  }, [branchResolved, branchRetryCount, loadDashboardData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  }, [loadDashboardData]);

  const totalStock = useMemo(() => stockData.reduce((sum, item) => sum + Number(item.quantity), 0), [stockData]);
  const lowStockCount = useMemo(() => stockData.filter(item => item.status === 'Low Stock').length, [stockData]);
  const totalValue = useMemo(() => stockData.reduce((sum, item) => sum + (item.quantity * item.price), 0), [stockData]);

  const alertsList = useMemo(
    () => stockData.filter(item => item.status === 'Low Stock' || item.status === 'Out of Stock'),
    [stockData]
  );

  const filteredStock = useMemo(() => {
    if (filterCategory === 'LOW') return stockData.filter(i => i.status === 'Low Stock');
    if (filterCategory === 'OUT') return stockData.filter(i => i.status === 'Out of Stock');
    return stockData;
  }, [stockData, filterCategory]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(todaySalesList.length / SALES_TODAY_PAGE_SIZE)),
    [todaySalesList.length]
  );

  const pagedSales = useMemo(() => {
    const start = (salesTodayPage - 1) * SALES_TODAY_PAGE_SIZE;
    return todaySalesList.slice(start, start + SALES_TODAY_PAGE_SIZE);
  }, [todaySalesList, salesTodayPage]);

  const displayName =
    authUser?.firstname?.trim() ||
    user?.firstname?.trim() ||
    authUser?.username ||
    user?.username ||
    'Staff';
  const outOfStockCount = stockData.filter((i) => i.status === 'Out of Stock').length;

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
        <Text className="text-stone-500 text-[13px] mt-4">Loading your staff dashboard...</Text>
      </View>
    );
  }

  const { whole: totalWhole, hasHalf: totalHasHalf } = formatStockQty(totalStock);
  const quotaProgress = Math.min((quotaProductsSold / productTarget) * 100, 100);
  const monthlyProgress = monthlyTarget > 0 ? Math.min((monthlyProductsSold / monthlyTarget) * 100, 100) : 0;

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
            onRefresh={onRefresh}
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

            <View className="flex-row items-center gap-2 ml-2">
              <TouchableOpacity
                className="w-10 h-10 rounded-full bg-white items-center justify-center border border-[#FED7AA]"
                style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 }}
                onPress={onRefresh}
                disabled={refreshing}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={19} color="#451A03" />
              </TouchableOpacity>
              <TouchableOpacity
                className="w-10 h-10 rounded-full bg-white items-center justify-center border border-[#FED7AA]"
                style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 }}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Ionicons name="log-out-outline" size={19} color="#451A03" />
              </TouchableOpacity>
            </View>
          </View>

          <View className="mt-5">
            <Text className="text-2xl font-extrabold text-[#171717]">Hey, {displayName}! 👋</Text>
            <Text className="text-sm text-stone-500 mt-1">Ready to run today's sales?</Text>
          </View>

          {/* Status pills */}
          <View className="flex-row flex-wrap gap-3 mt-4">
            <View className="flex-row items-center px-4 py-2.5 rounded-full bg-white border border-[#FED7AA]">
              <View className={`w-2.5 h-2.5 rounded-full mr-2 ${lowStockCount > 0 ? 'bg-[#F59E0B]' : 'bg-green-500'}`} />
              <Text className={`text-xs font-extrabold tracking-wider uppercase ${lowStockCount > 0 ? 'text-[#D97706]' : 'text-green-600'}`}>
                {lowStockCount > 0 ? `${lowStockCount} Low` : 'Stock OK'}
              </Text>
            </View>

            <TouchableOpacity
              className="flex-row items-center px-4 py-2.5 rounded-full bg-[#EA580C]"
              style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 }}
              onPress={() => { setSalesTodayPage(1); setSalesTodayModalVisible(true); }}
              activeOpacity={0.85}
            >
              <Ionicons name="receipt-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text className="text-white text-xs font-extrabold tracking-wider uppercase">{todaySalesList.length} Sales</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== TODAY'S SALES HERO ===== */}
        <View className="px-5 mt-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1">
              <Text className="text-xl font-extrabold text-[#171717]">Today&apos;s Sales</Text>
              <Text className="text-sm text-stone-500 mt-0.5">Keep the register moving.</Text>
            </View>
            <View className="bg-[#FFF1E6] px-2.5 py-1 rounded-full ml-2">
              <Text className="text-[#EA580C] text-[11px] font-bold">🔥 {todaySalesList.length}</Text>
            </View>
          </View>

          <TouchableOpacity
            className="bg-white rounded-3xl p-5 border border-[#FED7AA]"
            style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 }}
            onPress={() => { setSalesTodayPage(1); setSalesTodayModalVisible(true); }}
            activeOpacity={0.85}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons name="flame" size={16} color="#EA580C" />
                <Text className="text-[#EA580C] text-[10px] font-extrabold uppercase tracking-wider ml-1.5">Gross Today</Text>
              </View>
              <Text className="text-stone-500 text-[11px] font-semibold">{todaySalesList.length} sale(s)</Text>
            </View>

            <Text className="text-[#EA580C] text-4xl font-extrabold mt-2">₱{todaySales.toLocaleString()}</Text>

            <View className="mt-4 pt-4 border-t border-[#F5EDE0]">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-stone-500 text-[11px] font-semibold">This Month</Text>
                <Text className="text-[#171717] text-sm font-extrabold">₱{grossSales.toLocaleString()}</Text>
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="text-stone-500 text-[11px] font-semibold">Monthly Target</Text>
                <Text className="text-[#171717] text-sm font-extrabold">
                  {monthlyTarget > 0 ? `${monthlyTarget.toLocaleString()} pcs` : 'Not set'}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center justify-center mt-4 pt-4 border-t border-[#F5EDE0]">
              <Text className="text-[#F97316] text-xs font-extrabold">View Sales</Text>
              <Ionicons name="arrow-forward" size={14} color="#F97316" style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ===== BRANCH UNRESOLVED WARNING ===== */}
        {branchResolved === false && (
          <View className="mx-5 mt-5 px-4 py-3 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] flex-row items-center">
            <Ionicons name="alert-circle-outline" size={20} color="#D97706" />
            <View className="ml-3 flex-1">
              <Text className="text-[#92400E] text-[13px] font-bold">Branch not resolved</Text>
              <Text className="text-[#B45309] text-[11px] mt-0.5 leading-tight">
                Stock may show 0. Make sure you are on the shop Wi-Fi and connected to the server, then pull to refresh.
              </Text>
            </View>
          </View>
        )}

        {/* ===== QUICK STATS - 2x2 Grid ===== */}
        <View className="px-5 mt-6">
          <Text className="text-xl font-extrabold text-[#171717]">Quick Stats</Text>
          <Text className="text-sm text-stone-500 mt-0.5">Your branch at a glance</Text>

          <View className="flex-row gap-3 mt-4">
            <QuickStatCard
              title="Total Stock"
              subtitle="Units"
              value={totalHasHalf ? `${totalWhole}.5` : totalWhole}
              icon="cube-outline"
              color="#EA580C"
              bgColor="#FFF1E6"
            />
            <QuickStatCard
              title="Total Items"
              subtitle="Products"
              value={stockData.length}
              icon="restaurant-outline"
              color="#F59E0B"
              bgColor="#FEF3C7"
            />
          </View>

          <View className="flex-row gap-3 mt-3">
            <QuickStatCard
              title="Low Stock"
              subtitle="Alerts"
              value={lowStockCount}
              icon="warning-outline"
              color="#F59E0B"
              bgColor="#FEF3C7"
            />
            <QuickStatCard
              title="Inventory Value"
              subtitle="Total ₱"
              value={`₱${totalValue.toLocaleString()}`}
              icon="wallet-outline"
              color="#EA580C"
              bgColor="#FFF1E6"
            />
          </View>
        </View>

        {/* ===== PRODUCT QUOTA / INCENTIVE ===== */}
        <View className="px-5 mt-6">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-1">
              <Text className="text-xl font-extrabold text-[#171717]">Product Quota</Text>
              <Text className="text-sm text-stone-500 mt-0.5">₱100 per {productTarget} products</Text>
            </View>
            <View className="bg-[#FFF1E6] px-2.5 py-1 rounded-full ml-2">
              <Text className="text-[#EA580C] text-[11px] font-bold">🔥 {quotaProgress}%</Text>
            </View>
          </View>

          <View
            className="bg-white rounded-3xl p-5 border border-[#FED7AA]"
            style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="w-9 h-9 rounded-xl bg-[#FFF1E6] items-center justify-center mr-2.5">
                  <Ionicons name="trophy-outline" size={18} color="#EA580C" />
                </View>
                <Text className="text-[#EA580C] text-[10px] font-extrabold uppercase tracking-wider">Daily Goal</Text>
              </View>
              <Text className="text-stone-500 text-[11px] font-semibold">{quotaProductsSold} / {productTarget} sold</Text>
            </View>

            <View className="mt-4">
              <View className="h-2.5 rounded-full bg-[#FFF1E6] overflow-hidden">
                <View className="h-full rounded-full" style={{ backgroundColor: quotaProductsSold >= productTarget ? '#16A34A' : '#F97316', width: `${quotaProgress}%` }} />
              </View>
              <View className="flex-row justify-between items-center mt-2">
                <Text className="text-stone-500 text-[11px] font-semibold">{quotaProgress}% of daily quota</Text>
                <Text className="text-[#EA580C] text-[11px] font-extrabold">
                  {quotaProductsSold >= productTarget
                    ? 'Target hit! 🔥'
                    : `${productTarget - quotaProductsSold} to go`}
                </Text>
              </View>
            </View>

            <View className="mt-4 pt-4 border-t border-[#F5EDE0] flex-row items-center">
              <View className="w-11 h-11 rounded-2xl bg-[#FFF1E6] items-center justify-center mr-3">
                <Ionicons name="cash-outline" size={20} color={quotaIncentive > 0 ? '#EA580C' : '#A8A29E'} />
              </View>
              <View className="flex-1">
                <Text className="text-stone-500 text-[11px] font-semibold">Monthly Incentive Bonus</Text>
                <Text className={quotaIncentive > 0 ? 'text-[#EA580C] text-2xl font-extrabold' : 'text-[#A8A29E] text-2xl font-extrabold'}>
                  ₱{quotaIncentive.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ===== MONTHLY SALES TARGET ===== */}
        {monthlyTarget > 0 && (
          <View className="px-5 mt-6">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1">
                <Text className="text-xl font-extrabold text-[#171717]">Monthly Target</Text>
                <Text className="text-sm text-stone-500 mt-0.5">Track your monthly progress</Text>
              </View>
              <View className="bg-[#FFF1E6] px-2.5 py-1 rounded-full ml-2">
                <Text className="text-[#EA580C] text-[11px] font-bold">🔥 {Math.round(monthlyProgress)}%</Text>
              </View>
            </View>

            <View
              className="bg-white rounded-3xl p-5 border border-[#FED7AA]"
              style={{ shadowColor: '#451A03', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="w-9 h-9 rounded-xl bg-[#FEF3C7] items-center justify-center mr-2.5">
                    <Ionicons name="trending-up-outline" size={18} color="#F59E0B" />
                  </View>
                  <Text className="text-[#F59E0B] text-[10px] font-extrabold uppercase tracking-wider">Products Sold</Text>
                </View>
                <Text className="text-[#171717] text-sm font-extrabold">{monthlyProductsSold} / {monthlyTarget} pcs</Text>
              </View>

              <View className="mt-4">
                <View className="h-2.5 rounded-full bg-[#FFF1E6] overflow-hidden">
                  <View className="h-full rounded-full" style={{ backgroundColor: monthlyProgress >= 100 ? '#16A34A' : '#F97316', width: `${monthlyProgress}%` }} />
                </View>
                <Text className="text-stone-500 text-[11px] font-semibold mt-2">{Math.round(monthlyProgress)}% completed</Text>
              </View>
            </View>
          </View>
        )}

        {/* ===== INVENTORY OVERVIEW ===== */}
        <View className="px-5 mt-6">
          <Text className="text-xl font-extrabold text-[#171717]">Inventory Overview</Text>
          <Text className="text-sm text-stone-500 mt-0.5">Manage and monitor today&apos;s stock</Text>

          <View className="flex-row gap-3 mt-4">
            <View className="flex-1 bg-white rounded-3xl p-4 border border-[#FED7AA]">
              <Text className="text-stone-400 text-[10px] font-bold uppercase">Total Stock</Text>
              <Text className="text-[#171717] text-2xl font-extrabold mt-1">{totalWhole}</Text>
              <Text className="text-stone-500 text-[11px] font-semibold mt-0.5">{totalHasHalf ? '½ units extra' : 'units'}</Text>
            </View>
            <View className="flex-1 bg-white rounded-3xl p-4 border border-[#FED7AA]">
              <Text className="text-stone-400 text-[10px] font-bold uppercase">Low Stock</Text>
              <Text className={lowStockCount > 0 ? 'text-[#F59E0B] text-2xl font-extrabold mt-1' : 'text-[#171717] text-2xl font-extrabold mt-1'}>{lowStockCount}</Text>
              <Text className="text-stone-500 text-[11px] font-semibold mt-0.5">{lowStockCount > 0 ? 'needs restock' : 'all good'}</Text>
            </View>
            <View className="flex-1 bg-white rounded-3xl p-4 border border-[#FED7AA]">
              <Text className="text-stone-400 text-[10px] font-bold uppercase">Products</Text>
              <Text className="text-[#171717] text-2xl font-extrabold mt-1">{stockData.length}</Text>
              <Text className="text-stone-500 text-[11px] font-semibold mt-0.5">menu items</Text>
            </View>
          </View>
        </View>

        {/* ===== TOTAL INVENTORY VALUE ===== */}
        <View className="px-5 mt-4">
          <View
            className="bg-white rounded-3xl p-5 border border-[#FED7AA] flex-row items-center"
            style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 }}
          >
            <View
              className="w-14 h-14 rounded-2xl bg-[#EA580C] items-center justify-center mr-4"
              style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 }}
            >
              <Ionicons name="wallet-outline" size={26} color="#FFFFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-stone-400 text-[10px] font-bold uppercase tracking-wider">Total Inventory Value</Text>
              <Text className="text-[#EA580C] text-3xl font-extrabold mt-0.5">₱{totalValue.toLocaleString()}</Text>
              <Text className="text-stone-500 text-xs mt-0.5">Across all branch products</Text>
            </View>
          </View>
        </View>

        {/* ===== STOCK LEVELS ===== */}
        <View className="px-5 mt-6">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1 mr-2">
              <Text className="text-xl font-extrabold text-[#171717]">Stock Levels</Text>
              <Text className="text-sm text-stone-500 mt-0.5">{filteredStock.length} items</Text>
            </View>
          </View>

          {/* Category Filter - Horizontally Scrollable */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => setFilterCategory('ALL')}
              className={`px-4 py-2 rounded-full border ${filterCategory === 'ALL' ? 'bg-[#EA580C] border-[#EA580C]' : 'bg-white border-[#FED7AA]'}`}
              activeOpacity={0.8}
            >
              <Text className={filterCategory === 'ALL' ? 'text-white text-xs font-extrabold' : 'text-stone-500 text-xs font-bold'}>
                All ({stockData.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilterCategory('LOW')}
              className={`px-4 py-2 rounded-full border ${filterCategory === 'LOW' ? 'bg-[#F59E0B] border-[#F59E0B]' : 'bg-white border-[#FED7AA]'}`}
              activeOpacity={0.8}
            >
              <Text className={filterCategory === 'LOW' ? 'text-white text-xs font-extrabold' : 'text-stone-500 text-xs font-bold'}>
                Low Stock ({lowStockCount})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilterCategory('OUT')}
              className={`px-4 py-2 rounded-full border ${filterCategory === 'OUT' ? 'bg-[#DC2626] border-[#DC2626]' : 'bg-white border-[#FED7AA]'}`}
              activeOpacity={0.8}
            >
              <Text className={filterCategory === 'OUT' ? 'text-white text-xs font-extrabold' : 'text-stone-500 text-xs font-bold'}>
                Out of Stock ({outOfStockCount})
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {filteredStock.map((item) => (
            <StockRow key={item.id} item={item} />
          ))}

          {filteredStock.length === 0 && (
            <View className="bg-white rounded-3xl p-8 border border-[#FED7AA] items-center">
              <View className="w-16 h-16 rounded-full bg-[#FFF1E6] items-center justify-center mb-3 border border-[#FED7AA]">
                <Ionicons name="cube-outline" size={30} color="#EA580C" />
              </View>
              <Text className="text-[#171717] font-extrabold text-base">No Stock Items</Text>
              <Text className="text-stone-500 text-xs mt-1 text-center">No products match the current filter</Text>
            </View>
          )}
        </View>

        {/* ===== STOCK ALERTS ===== */}
        {alertsList.length > 0 && (
          <View className="px-5 mt-6">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1 mr-2">
                <Text className="text-xl font-extrabold text-[#171717]">Stock Alerts</Text>
                <Text className="text-sm text-stone-500 mt-0.5">Needs restocking now</Text>
              </View>
              <View className="bg-[#FEE2E2] px-2.5 py-1 rounded-full ml-2">
                <Text className="text-[#DC2626] text-[11px] font-bold">{alertsList.length}</Text>
              </View>
            </View>

            {alertsList.map((item) => {
              const isOut = item.status === 'Out of Stock';
              return (
                <View
                  key={`alert-${item.id}`}
                  className={`rounded-3xl p-4 mb-3 border ${isOut ? 'bg-[#FEF2F2] border-[#FECACA]' : 'bg-[#FFFBEB] border-[#FDE68A]'}`}
                >
                  <View className="flex-row items-center mb-2">
                    <View style={{ backgroundColor: isOut ? '#FEE2E2' : '#FEF3C7' }} className="w-9 h-9 rounded-xl items-center justify-center mr-2.5">
                      <Ionicons name={isOut ? 'alert-circle' : 'warning-outline'} size={17} color={isOut ? '#DC2626' : '#F59E0B'} />
                    </View>
                    <Text className={isOut ? 'text-[#DC2626] text-sm font-extrabold' : 'text-[#D97706] text-sm font-extrabold'}>
                      {isOut ? 'Out of Stock' : 'Low Stock'}
                    </Text>
                  </View>
                  <Text className="text-[#171717] text-sm font-bold">{item.name}</Text>
                  <Text className="text-stone-500 text-xs mt-1">
                    {isOut
                      ? 'No stock remaining. Restock immediately.'
                      : `Only ${item.quantity} remaining (Min: ${item.minStock})`}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ===== FOOTER BRANDING ===== */}
        <View className="items-center px-5 mt-8 mb-2">
          <View className="w-10 h-[3px] rounded-full bg-[#FED7AA] mb-4" />
          <Ionicons name="flame" size={16} color="#EA580C" />
          <Text className="text-[#451A03] text-xs font-extrabold tracking-widest mt-1">NEWMOON</Text>
          <Text className="text-stone-500 text-[10px] mt-0.5 tracking-wide">Lechon Manok &amp; Liempo House</Text>
          <Text className="text-[#EA580C] text-[10px] font-bold mt-0.5">Fresh from the Grill</Text>
        </View>
      </ScrollView>

      {/* ===== SALES TODAY MODAL ===== */}
      <Modal
        visible={salesTodayModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSalesTodayModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setSalesTodayModalVisible(false)} />
          <View className="bg-white border-t border-[#FED7AA]" style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '90%' }}>
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-5">
              <View className="flex-row items-center">
                <View className="w-11 h-11 rounded-2xl bg-[#FFF1E6] items-center justify-center mr-3">
                  <Ionicons name="receipt-outline" size={20} color="#EA580C" />
                </View>
                <View>
                  <Text className="text-[#171717] font-extrabold text-lg">Sales Today</Text>
                  <Text className="text-stone-500 text-xs">{todaySalesList.length} total checkout(s)</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setSalesTodayModalVisible(false)}
                className="w-9 h-9 rounded-full bg-[#FFF7ED] items-center justify-center border border-[#FED7AA]"
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color="#78716C" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              {todaySalesList.length === 0 ? (
                <View className="p-10 items-center">
                  <View className="w-16 h-16 rounded-full bg-[#FFF1E6] items-center justify-center mb-3 border border-[#FED7AA]">
                    <Ionicons name="receipt-outline" size={30} color="#EA580C" />
                  </View>
                  <Text className="text-[#171717] font-extrabold text-base">No Sales Today</Text>
                  <Text className="text-stone-500 text-xs mt-1 text-center">Transactions via POS will appear here</Text>
                </View>
              ) : (
                <>
                  {/* Daily Total */}
                  <View className="bg-[#FFF7ED] rounded-3xl p-4 mb-4 border border-[#FED7AA]">
                    <View className="flex-row justify-between items-center">
                      <View>
                        <Text className="text-stone-400 text-[10px] font-bold uppercase tracking-wider">Daily Gross Total</Text>
                        <Text className="text-[#EA580C] text-3xl font-extrabold mt-1">₱{todaySales.toLocaleString()}</Text>
                      </View>
                      <View className="bg-[#FFF1E6] px-3 py-1.5 rounded-full">
                        <Text className="text-[#EA580C] text-[11px] font-bold">{formatLocalDate()}</Text>
                      </View>
                    </View>
                  </View>

                  {pagedSales.map((item) => (
                    <SaleRow key={item?.id || item?.invoice_number} sale={item} />
                  ))}
                </>
              )}
            </ScrollView>

            {/* Pagination */}
            {todaySalesList.length > SALES_TODAY_PAGE_SIZE && (
              <View className="flex-row justify-between items-center pt-4 border-t border-[#F5EDE0] mt-4">
                <TouchableOpacity
                  onPress={() => setSalesTodayPage((p) => Math.max(1, p - 1))}
                  disabled={salesTodayPage <= 1}
                  className="flex-row items-center px-4 py-2.5 rounded-full bg-[#FFF7ED] border border-[#FED7AA]"
                  style={{ opacity: salesTodayPage <= 1 ? 0.5 : 1 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={18} color="#EA580C" />
                  <Text className="text-[#EA580C] font-bold text-xs ml-1.5">Prev</Text>
                </TouchableOpacity>

                <Text className="text-stone-500 text-sm font-bold">
                  Page {salesTodayPage} of {totalPages}
                </Text>

                <TouchableOpacity
                  onPress={() => setSalesTodayPage((p) => Math.min(totalPages, p + 1))}
                  disabled={salesTodayPage >= totalPages}
                  className="flex-row items-center px-4 py-2.5 rounded-full bg-[#FFF7ED] border border-[#FED7AA]"
                  style={{ opacity: salesTodayPage >= totalPages ? 0.5 : 1 }}
                  activeOpacity={0.7}
                >
                  <Text className="text-[#EA580C] font-bold text-xs mr-1.5">Next</Text>
                  <Ionicons name="chevron-forward" size={18} color="#EA580C" />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              className="mt-4 rounded-2xl py-3.5 items-center bg-[#FFF7ED] border border-[#FED7AA]"
              onPress={() => setSalesTodayModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text className="text-[#78716C] font-bold text-sm">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default DashboardScreen;