import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  Row,
  Col,
  Tag,
  Space,
  message,
  Badge,
} from "antd";
import {
  PlusOutlined,
  ShopOutlined,
  StockOutlined,
  ProductOutlined,
  TeamOutlined,
  ReloadOutlined,
  WarningOutlined,
  ShoppingCartOutlined,
  FireOutlined,
  StarOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPesoSign } from "@fortawesome/free-solid-svg-icons";
import { api } from "@/config/api";
import { getCache, setCache, invalidateCache } from "@/utils/cache";
import Loading from "@/components/Loading";

const DASHBOARD_ENDPOINTS = ["branches", "staff", "sales", "products"];

function Dashboard() {
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loadError, setLoadError] = useState("");
  const [lowStockItems, setLowStockItems] = useState([]);
  const [showLowStockModal, setShowLowStockModal] = useState(false);

  const [dismissedLowStock, setDismissedLowStock] = useState(() => {
    return sessionStorage.getItem("dismissed_low_stock") === "true";
  });

  const [addBranchForm] = Form.useForm();

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const userName = currentUser.name || currentUser.username || "";

  // Philippine Time
  useEffect(() => {
    const updatePHTime = () => {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const phTime = new Date(utc + 8 * 60 * 60 * 1000);
      setCurrentTime(phTime);
    };

    updatePHTime();

    const timer = setInterval(updatePHTime, 1000);

    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const inFlightRef = useRef(null);

  const loadDashboardData = useCallback(
    (forceRefresh = false) => {
      // Prevent duplicate requests
      if (inFlightRef.current) return inFlightRef.current;

      const run = (async () => {
        setLoading(true);
        setLoadError("");

        try {
          const results = await Promise.allSettled(
            DASHBOARD_ENDPOINTS.map((key) => {
              const cached = forceRefresh ? null : getCache(key);

              if (cached !== null) {
                return Promise.resolve({
                  key,
                  data: cached,
                });
              }

              return api
                .get(`/${key}`)
                .then((res) => ({
                  key,
                  data: res.data?.data || [],
                }));
            })
          );

          const rejectedIdx = results.findIndex(
            (r) => r.status === "rejected"
          );

          if (rejectedIdx !== -1) {
            const reason = results[rejectedIdx].reason;
            const status = reason?.response?.status;

            const backendMessage =
              reason?.response?.data?.message ||
              reason?.response?.data?.error ||
              reason?.message;

            if (status === 401 || status === 419) {
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              localStorage.removeItem("role");
              localStorage.removeItem("isLoggedIn");

              navigate("/");
              return;
            }

            throw new Error(
              `GET /${DASHBOARD_ENDPOINTS[rejectedIdx]} failed` +
                (status ? ` (HTTP ${status})` : "") +
                (backendMessage ? `: ${backendMessage}` : "")
            );
          }

          const dataMap = {};

          results.forEach((r) => {
            dataMap[r.value.key] = r.value.data;
          });

          const staffRows = (dataMap.staff || []).map((s) => {
            const assignments = Array.isArray(s.branchAssignments)
              ? s.branchAssignments
              : Array.isArray(s.branch_assignments)
              ? s.branch_assignments
              : [];

            const branchId =
              assignments?.[0]?.branch_id ||
              s.branch_id ||
              s.branchId ||
              null;

            return {
              ...s,
              branch_id: branchId,
            };
          });

          const branchesData = dataMap.branches || [];
          const staffData = staffRows;
          const salesData = dataMap.sales || [];
          const productsData = dataMap.products || [];

          setBranches(branchesData);
          setStaff(staffData);
          setSales(salesData);
          setProducts(productsData);

          // Low stock detection
          const lowStock = [];

          for (const product of productsData) {
            if (!product.product_stocks) continue;

            for (const stock of product.product_stocks) {
              const qty = parseQuantity(stock?.quantity);
              const minStock = parseInt(stock?.minimum_stock, 10) || 0;

              if (minStock > 0 && qty > 0 && qty < minStock) {
                const branch = branchesData.find(
                  (b) => String(b.id) === String(stock.branch_id)
                );

                lowStock.push({
                  product_name: product.name,
                  product_sku: product.sku,
                  branch_name:
                    branch?.name || `Branch #${stock.branch_id}`,
                  quantity: qty,
                  minimum_stock: minStock,
                });
              }
            }
          }

          setLowStockItems(lowStock);

          if (lowStock.length > 0 && !dismissedLowStock) {
            setShowLowStockModal(true);
          }

          // Cache
          setCache("branches", branchesData);
          setCache("staff", staffData);
          setCache("sales", salesData);
          setCache("products", productsData);
        } catch (err) {
          const msg =
            err?.message || "Failed to load dashboard data from backend.";

          setLoadError(msg);
          message.error(msg);
        } finally {
          setLoading(false);
          inFlightRef.current = null;
        }
      })();

      inFlightRef.current = run;

      return run;
    },
    [navigate]
  );

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const parseQuantity = (value) => {
    if (value === null || value === undefined || value === "") return 0;

    const n =
      typeof value === "string"
        ? parseFloat(value.replace(/,/g, ""))
        : Number(value);

    return Number.isFinite(n) ? n : 0;
  };

  const getBranchProductsCount = (branchId) => {
    const target = String(branchId);

    const total = products.reduce((sum, product) => {
      if (!product.product_stocks) return sum;

      const stock = product.product_stocks.find(
        (s) => String(s.branch_id) === target
      );

      return sum + parseQuantity(stock?.quantity);
    }, 0);

    return Math.round(total);
  };

  const getBranchProductCount = (branchId) => {
    const target = String(branchId);

    return products.filter((product) => {
      if (!product.product_stocks) return false;

      return product.product_stocks.some(
        (s) => String(s.branch_id) === target
      );
    }).length;
  };

  const getBranchStaffCount = (branchId) => {
    const target = String(branchId);

    return staff.filter((s) => {
      const assignments = Array.isArray(s.branchAssignments)
        ? s.branchAssignments
        : Array.isArray(s.branch_assignments)
        ? s.branch_assignments
        : [];

      if (assignments.length > 0) {
        return assignments.some((a) => {
          if (!a) return false;
          if (a.is_active === false) return false;

          return (
            a.branch_id != null &&
            String(a.branch_id) === target
          );
        });
      }

      if (s.branch_id == null || s.branch_id === "") return false;

      return String(s.branch_id) === target;
    }).length;
  };

  const handleAddBranch = async (values) => {
    try {
      const { data } = await api.post("/branches", {
        name: values.name,
        code: values.code,
        address: values.address,
      });

      setBranches((prev) => [...prev, data]);

      addBranchForm.resetFields();
      setIsModalOpen(false);

      invalidateCache("branches");

      message.success("Branch created successfully!");
    } catch (err) {
      message.error(
        err?.response?.data?.message ||
          "Failed to create branch"
      );
    }
  };

  const totalSales = sales.reduce(
    (sum, sale) => sum + parseFloat(sale.total || 0),
    0
  );

  const todaySales = sales
    .filter((sale) => {
      const today = new Date();
      const saleDate = new Date(sale.created_at);

      return saleDate.toDateString() === today.toDateString();
    })
    .reduce(
      (sum, sale) => sum + parseFloat(sale.total || 0),
      0
    );

  const formatCurrency = (amount) =>
    `₱${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
    })}`;

  const navigateTo = (path) => navigate(path);

  return (
    <div className="min-h-screen bg-[#FFF8ED] p-4 sm:p-6 lg:p-8">
      {/* =========================================================
          HERO HEADER
      ========================================================= */}
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#1A0F08] via-[#2A1608] to-[#451A03] shadow-[0_20px_50px_rgba(67,20,7,0.20)]">
        {/* Decorative background */}
        <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-orange-500/10 blur-2xl" />

        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="pointer-events-none absolute right-10 top-10 text-[180px] leading-none text-orange-500/5">
          <FireOutlined />
        </div>

        <div className="relative z-10 p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            {/* Brand / Welcome */}
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
                <FireOutlined />
                NewMoon Lechon Manok & Liempo
              </div>

              <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
                {getGreeting()}
                {userName ? (
                  <>
                    , <span className="text-orange-400">{userName}</span>
                  </>
                ) : null}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
                Here&apos;s how your charcoal-roasted business is doing
                today. Monitor branches, inventory, staff, and sales from
                one powerful management system.
              </p>

              {/* Food badges */}
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  "Lechon Manok",
                  "Liempo",
                  "Grilled Favorites",
                ].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* PH Time */}
            <div className="min-w-[240px] rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-orange-300">
                <ClockCircleOutlined />
                Philippines Time
              </div>

              <p className="mt-2 text-2xl font-bold tracking-tight text-white">
                {currentTime.toLocaleTimeString("en-PH", {
                  hour12: true,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>

              <p className="mt-1 text-xs text-white/45">
                {currentTime.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* =====================================================
              KPI CARDS
          ===================================================== */}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {/* Branches */}
            <div
              onClick={() => navigateTo("/branch-map")}
              className="group cursor-pointer rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-400/30 hover:bg-white/[0.09]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white/45">
                    Total Branches
                  </p>

                  <p className="mt-1 text-2xl font-bold text-white">
                    {branches.length}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-[#F97316]">
                  <ShopOutlined className="text-xl" />
                </div>
              </div>

              <p className="mt-2 text-[11px] font-medium text-white/30 group-hover:text-orange-300">
                Manage branches →
              </p>
            </div>

            {/* Staff */}
            <div
              onClick={() => navigateTo("/staff")}
              className="group cursor-pointer rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-400/30 hover:bg-white/[0.09]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white/45">
                    Total Staff
                  </p>

                  <p className="mt-1 text-2xl font-bold text-white">
                    {staff.length}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                  <TeamOutlined className="text-xl" />
                </div>
              </div>

              <p className="mt-2 text-[11px] font-medium text-white/30 group-hover:text-amber-300">
                Manage staff →
              </p>
            </div>

            {/* Today's Sales */}
            <div
              onClick={() => navigateTo("/sales")}
              className="group cursor-pointer rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-green-400/30 hover:bg-white/[0.09]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white/45">
                    Today's Sales
                  </p>

                  <p className="mt-1 text-xl font-bold text-white">
                    {formatCurrency(todaySales)}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/15 text-green-400">
                  <FontAwesomeIcon
                    icon={faPesoSign}
                    className="text-lg"
                  />
                </div>
              </div>

              <p className="mt-2 text-[11px] font-medium text-white/30 group-hover:text-green-300">
                View sales →
              </p>
            </div>

            {/* Total Sales */}
            <div
              onClick={() => navigateTo("/sales")}
              className="group cursor-pointer rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-red-400/30 hover:bg-white/[0.09]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white/45">
                    Total Sales
                  </p>

                  <p className="mt-1 text-xl font-bold text-white">
                    {formatCurrency(totalSales)}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
                  <StarOutlined className="text-lg" />
                </div>
              </div>

              <p className="mt-2 text-[11px] font-medium text-white/30 group-hover:text-red-300">
                View sales →
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          ERROR
      ========================================================= */}
      {loadError && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <WarningOutlined className="mt-0.5" />
          <span>{loadError}</span>
        </div>
      )}

      {/* =========================================================
          QUICK ACTIONS
      ========================================================= */}
      <section className="mb-7 rounded-2xl border border-[#F5EDE0] bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#EA580C]">
              Quick Actions
            </p>

            <h2 className="mt-1 text-lg font-bold tracking-tight text-stone-900">
              Keep your data fresh
            </h2>

            <p className="mt-1 text-sm text-stone-500">
              Refresh your dashboard or register a new branch in seconds.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadDashboardData(true)}
              loading={loading}
              className="!h-11 !rounded-xl !border-[#F5EDE0] !px-5 !font-medium !text-stone-700 hover:!border-orange-300 hover:!text-[#EA580C]"
            >
              Refresh
            </Button>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                addBranchForm.resetFields();
                setIsModalOpen(true);
              }}
              className="!h-11 !rounded-xl !border-none !bg-gradient-to-r !from-orange-600 !to-amber-500 !px-5 !font-semibold !shadow-lg !shadow-orange-500/20 transition-all duration-300 hover:!from-orange-700 hover:!to-amber-600"
            >
              Add Branch
            </Button>

            {lowStockItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowLowStockModal(true)}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 text-sm font-semibold text-red-600 transition-all duration-300 hover:bg-red-100"
              >
                <WarningOutlined />
                {lowStockItems.length} Low Stock
              </button>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================
          BRANCH SECTION HEADER
      ========================================================= */}
      <section className="mb-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-[#EA580C]">
                <ShopOutlined />
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-stone-900">
                Branches
              </h2>
            </div>

            <p className="mt-2 text-sm text-stone-500">
              Manage and monitor each NewMoon branch's
              performance.
            </p>
          </div>

          <div className="inline-flex w-fit items-center rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-[#C2410C]">
            {branches.length}{" "}
            {branches.length === 1 ? "Branch" : "Branches"}
          </div>
        </div>
      </section>

      {/* =========================================================
          BRANCHES
      ========================================================= */}
      {loading ? (
        <div className="rounded-2xl border border-orange-100 bg-white py-16 shadow-sm">
          <Loading text="Loading branches..." />
        </div>
      ) : branches.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-orange-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-50 text-orange-300">
            <ShopOutlined className="text-4xl" />
          </div>

          <h3 className="mt-5 text-xl font-bold text-stone-800">
            No branches yet
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm text-stone-500">
            Start building your NewMoon operations by adding
            your first branch.
          </p>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              addBranchForm.resetFields();
              setIsModalOpen(true);
            }}
            className="!mt-5 !rounded-xl !border-none !bg-gradient-to-r !from-orange-600 !to-amber-500 !font-semibold"
          >
            Add Your First Branch
          </Button>
        </div>
      ) : (
        <Row gutter={[18, 18]}>
          {branches.map((branch) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={branch.id}>
              <div
                onClick={() => navigateTo(`/branch/${branch.id}`)}
                className="group h-full cursor-pointer overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_18px_40px_rgba(234,88,12,0.12)]"
              >
                {/* Branch Header */}
                <div className="relative overflow-hidden bg-gradient-to-br from-[#1A0F08] via-[#2A1608] to-[#451A03] px-5 py-6">
                  <div className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-orange-500/10" />

                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-500/10 text-orange-400">
                      <ShopOutlined className="text-2xl" />
                    </div>

                    <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                      Branch
                    </div>
                  </div>
                </div>

                {/* Branch Content */}
                <div className="p-5">
                  <div className="mb-5">
                    <h3 className="truncate text-lg font-bold text-stone-900">
                      {branch.name}
                    </h3>

                    {branch.code && (
                      <span className="mt-1 inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-[#C2410C]">
                        #{branch.code}
                      </span>
                    )}

                    {branch.address && (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-500">
                        {branch.address}
                      </p>
                    )}
                  </div>

                  {/* Branch Statistics */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-orange-50/70 px-3 py-2.5">
                      <span className="flex items-center gap-2 text-xs font-medium text-stone-600">
                        <StockOutlined className="text-orange-500" />
                        Stock
                      </span>

                      <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-orange-700 shadow-sm">
                        {getBranchProductsCount(branch.id)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-amber-50/70 px-3 py-2.5">
                      <span className="flex items-center gap-2 text-xs font-medium text-stone-600">
                        <TeamOutlined className="text-amber-500" />
                        Staff
                      </span>

                      <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-amber-700 shadow-sm">
                        {getBranchStaffCount(branch.id)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2.5">
                      <span className="flex items-center gap-2 text-xs font-medium text-stone-600">
                        <ProductOutlined className="text-stone-500" />
                        Products
                      </span>

                      <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-stone-700 shadow-sm">
                        {getBranchProductCount(branch.id)}
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-right text-[11px] font-medium text-stone-300 transition-all duration-200 group-hover:text-[#EA580C]">
                    View branch →
                  </p>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}

      {/* =========================================================
          LOW STOCK MODAL
      ========================================================= */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500">
              <WarningOutlined />
            </div>

            <div>
              <p className="font-bold text-stone-900">
                Low Stock Alert
              </p>
              <p className="text-xs font-normal text-stone-400">
                Inventory requires attention
              </p>
            </div>
          </div>
        }
        open={showLowStockModal}
        onCancel={() => setShowLowStockModal(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setDismissedLowStock(true);
                sessionStorage.setItem(
                  "dismissed_low_stock",
                  "true"
                );
                setShowLowStockModal(false);
              }}
              className="!rounded-xl"
            >
              Dismiss
            </Button>

            <Button
              type="primary"
              danger
              onClick={() => {
                setShowLowStockModal(false);
                navigate("/inventory");
              }}
              className="!rounded-xl !border-none !bg-red-600"
            >
              View Inventory
            </Button>
          </div>
        }
        width={650}
        className="rounded-2xl"
      >
        <div className="mb-4 rounded-xl bg-red-50 p-4">
          <p className="mb-0 text-sm text-red-700">
            <WarningOutlined className="mr-2" />
            {lowStockItems.length} product
            {lowStockItems.length > 1 ? "s are" : " is"} running
            low on stock.
          </p>
        </div>

        <div className="max-h-[320px] overflow-auto rounded-xl border border-stone-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-stone-50">
              <tr className="border-b border-stone-100">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Product
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Branch
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Qty
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Min
                </th>
              </tr>
            </thead>

            <tbody>
              {lowStockItems.map((item, i) => (
                <tr
                  key={i}
                  className="border-b border-stone-50 last:border-0"
                >
                  <td className="px-4 py-3 text-stone-800">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
                        <ShoppingCartOutlined />
                      </div>

                      <span className="max-w-[160px] truncate font-medium">
                        {item.product_name}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-stone-600">
                    {item.branch_name}
                  </td>

                  <td className="px-4 py-3 text-right font-bold text-red-600">
                    {item.quantity}
                  </td>

                  <td className="px-4 py-3 text-right text-stone-500">
                    {item.minimum_stock}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* =========================================================
          ADD BRANCH MODAL
      ========================================================= */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <PlusOutlined />
            </div>

            <div>
              <p className="font-bold text-stone-900">
                Add New Branch
              </p>
              <p className="text-xs font-normal text-stone-400">
                Add a NewMoon business location
              </p>
            </div>
          </div>
        }
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          addBranchForm.resetFields();
        }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        <div className="mb-5 mt-2 rounded-xl bg-orange-50 p-4">
          <p className="mb-0 text-xs leading-5 text-orange-800">
            <InfoCircleOutlined className="mr-2" />
            This branch information will be visible to staff
            members and customers.
          </p>
        </div>

        <Form
          form={addBranchForm}
          layout="vertical"
          onFinish={handleAddBranch}
        >
          <Form.Item
            label={
              <span className="text-sm font-semibold text-stone-700">
                Branch Name
              </span>
            }
            name="name"
            rules={[
              {
                required: true,
                message: "Branch name is required",
              },
            ]}
          >
            <Input
              placeholder="Enter branch name"
              className="!h-11 !rounded-xl !border-stone-200 hover:!border-orange-300 focus:!border-orange-500"
            />
          </Form.Item>

          <Form.Item
            label={
              <span className="text-sm font-semibold text-stone-700">
                Branch Code
              </span>
            }
            name="code"
            rules={[
              {
                required: true,
                message: "Branch code is required",
              },
            ]}
          >
            <Input
              placeholder="Example: MAIN"
              className="!h-11 !rounded-xl !border-stone-200 hover:!border-orange-300 focus:!border-orange-500"
            />
          </Form.Item>

          <Form.Item
            label={
              <span className="text-sm font-semibold text-stone-700">
                Branch Address
              </span>
            }
            name="address"
            rules={[
              {
                required: true,
                message: "Branch address is required",
              },
            ]}
          >
            <Input.TextArea
              placeholder="Enter complete branch address"
              rows={3}
              className="!rounded-xl !border-stone-200 hover:!border-orange-300 focus:!border-orange-500"
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  setIsModalOpen(false);
                  addBranchForm.resetFields();
                }}
                className="!h-11 !rounded-xl !px-5"
              >
                Cancel
              </Button>

              <Button
                type="primary"
                htmlType="submit"
                className="!h-11 !rounded-xl !border-none !bg-gradient-to-r !from-orange-600 !to-amber-500 !px-5 !font-semibold !shadow-lg !shadow-orange-500/20"
              >
                Create Branch
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Dashboard;