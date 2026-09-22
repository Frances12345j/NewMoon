import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Modal,
  Form,
  Input,
  Row,
  Col,
  message,
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
  RiseOutlined,
  CheckCircleOutlined,
  TruckOutlined,
  LineChartOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
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

  // ─── Sales Performance state ────────────────────────────────────
  const [salesPeriod, setSalesPeriod] = useState("today");

  // ─── Online Orders / Online Sales state ─────────────────────────
  const [onlineOverview, setOnlineOverview] = useState(null);
  const [onlinePeriod, setOnlinePeriod] = useState("week");
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState("");

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
      if (inFlightRef.current) return inFlightRef.current;

      const run = (async () => {
        setLoading(true);
        setLoadError("");

        try {
          const results = await Promise.allSettled(
            DASHBOARD_ENDPOINTS.map((key) => {
              const cached = forceRefresh ? null : getCache(key);

              if (cached !== null) {
                return Promise.resolve({ key, data: cached });
              }

              return api.get(`/${key}`).then((res) => ({
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

            return { ...s, branch_id: branchId };
          });

          const branchesData = dataMap.branches || [];
          const staffData = staffRows;
          const salesData = dataMap.sales || [];
          const productsData = dataMap.products || [];

          setBranches(branchesData);
          setStaff(staffData);
          setSales(salesData);
          setProducts(productsData);

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

  // ─── Online orders overview (live) ──────────────────────────────
  const loadOnlineOverview = useCallback(async () => {
    try {
      setOnlineLoading(true);
      setOnlineError("");

      const { data } = await api.get("/admin/orders/overview", {
        params: { period: onlinePeriod },
      });

      setOnlineOverview(data);
    } catch (err) {
      const status = err?.response?.status;

      if (status === 401 || status === 419) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("role");
        localStorage.removeItem("isLoggedIn");
        navigate("/");
        return;
      }

      setOnlineError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load online orders"
      );
    } finally {
      setOnlineLoading(false);
    }
  }, [navigate, onlinePeriod]);

  useEffect(() => {
    loadOnlineOverview();

    const interval = setInterval(() => loadOnlineOverview(), 30000);
    return () => clearInterval(interval);
  }, [loadOnlineOverview]);

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

          return a.branch_id != null && String(a.branch_id) === target;
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
        err?.response?.data?.message || "Failed to create branch"
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
    .reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0);

  const formatCurrency = (amount) =>
    `₱${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
    })}`;

  // ─── Derived salesChartData based on salesPeriod ────────────────
  const salesChartData = (() => {
    const now = new Date();

    const buckets = [];
    const labelFor = (d) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    if (salesPeriod === "today") {
      for (let h = 0; h < 24; h++) {
        buckets.push({ key: h, label: `${h}:00`, amount: 0 });
      }
      sales.forEach((s) => {
        const d = new Date(s.created_at);
        if (d.toDateString() !== now.toDateString()) return;
        const h = d.getHours();
        buckets[h].amount += parseFloat(s.total || 0);
      });
    } else if (salesPeriod === "week") {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        buckets.push({ key: d.toDateString(), label: labelFor(d), amount: 0 });
      }
      sales.forEach((s) => {
        const d = new Date(s.created_at);
        const bucket = buckets.find((b) => b.key === d.toDateString());
        if (bucket) bucket.amount += parseFloat(s.total || 0);
      });
    } else {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        buckets.push({ key: d.toDateString(), label: labelFor(d), amount: 0 });
      }
      sales.forEach((s) => {
        const d = new Date(s.created_at);
        const bucket = buckets.find((b) => b.key === d.toDateString());
        if (bucket) bucket.amount += parseFloat(s.total || 0);
      });
    }

    return buckets;
  })();

  // ─── Derived bestSellers ────────────────────────────────────────
  const bestSellers = (() => {
    const map = new Map();

    sales.forEach((sale) => {
      const items =
        sale.items ||
        sale.sale_items ||
        sale.order_items ||
        sale.products ||
        [];

      if (!Array.isArray(items) || items.length === 0) return;

      items.forEach((item) => {
        const name =
          item.product_name ||
          item.name ||
          item.product?.name ||
          "Unknown item";
        const qty = parseQuantity(item.quantity || item.qty || 1);
        const price = parseFloat(item.price || item.unit_price || 0);
        const revenue = parseFloat(item.subtotal || qty * price || 0);

        if (!map.has(name)) {
          map.set(name, { name, qty: 0, revenue: 0 });
        }
        const entry = map.get(name);
        entry.qty += qty;
        entry.revenue += revenue;
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  })();

  // ─── Derived branchPerformance ──────────────────────────────────
  const branchPerformance = branches.map((b) => {
    const branchSales = sales.filter(
      (s) => String(s.branch_id) === String(b.id)
    );

    const salesTotal = branchSales.reduce(
      (sum, s) => sum + parseFloat(s.total || 0),
      0
    );

    return {
      id: b.id,
      name: b.name,
      sales: salesTotal,
      orders: branchSales.length,
      staffCount: getBranchStaffCount(b.id),
    };
  });

  // ─── Derived recentActivity ─────────────────────────────────────
  const recentActivity = (() => {
    const events = [];

    sales.slice(0, 20).forEach((s) => {
      const branch = branches.find(
        (b) => String(b.id) === String(s.branch_id)
      );
      events.push({
        kind: "order",
        ts: new Date(s.created_at),
        text: `New sale recorded`,
        detail: formatCurrency(parseFloat(s.total || 0)),
        branch: branch?.name || null,
      });
    });

    return events
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 6);
  })();

  // ─── Derived inventoryWatch ─────────────────────────────────────
  const inventoryWatch = (() => {
    const items = [];

    products.forEach((product) => {
      if (!product.product_stocks) return;

      product.product_stocks.forEach((stock) => {
        const qty = parseQuantity(stock?.quantity);
        const min = parseInt(stock?.minimum_stock, 10) || 0;

        if (min <= 0) return;

        const branch = branches.find(
          (b) => String(b.id) === String(stock.branch_id)
        );

        const pct = Math.min(100, Math.round((qty / min) * 100));

        let status, color;
        if (qty === 0) {
          status = "Out of Stock";
          color = "#EF4444";
        } else if (qty < min * 0.5) {
          status = "Critical";
          color = "#EF4444";
        } else if (qty < min) {
          status = "Low";
          color = "#F59E0B";
        } else {
          status = "Healthy";
          color = "#22D3A8";
        }

        if (qty < min) {
          items.push({
            name: `${product.name}${branch ? ` · ${branch.name}` : ""}`,
            qty,
            min,
            pct,
            status,
            color,
          });
        }
      });
    });

    return items
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 4);
  })();

  const navigateTo = (path) => navigate(path);

  // ─── Palette — matches MenuSidebar (dark plum + mint) ───────────
  const PAGE_BG = "#1F1A2E";
  const PANEL_BG = "#2A2438";
  const PANEL_BG_2 = "#332C45";
  const BORDER = "rgba(255,255,255,0.06)";
  const TEXT = "#FFFFFF";
  const MUTED = "#A5A0B5";
  const FAINT = "#6E6A7E";
  const ACCENT = "#22D3A8";
  const ACCENT_DEEP = "#16B48C";
  const ACCENT_SOFT = "rgba(34,211,168,0.12)";
  const AMBER = "#F59E0B";
  const AMBER_SOFT = "rgba(245,158,11,0.15)";
  const GREEN = "#22D3A8";
  const GREEN_SOFT = "rgba(34,211,168,0.12)";
  const RED = "#EF4444";
  const RED_SOFT = "rgba(239,68,68,0.15)";

  // ─── Online orders derived data ─────────────────────────────────
  const OVERVIEW_STATUS = [
    { key: "pending", label: "Pending", color: "#F59E0B" },
    { key: "confirmed", label: "Confirmed", color: "#38BDF8" },
    { key: "preparing", label: "Preparing", color: "#FB923C" },
    { key: "ready", label: "Ready", color: "#D97706" },
    { key: "picked_up", label: "Picked Up", color: "#A78BFA" },
    { key: "out_for_delivery", label: "Out for Delivery", color: "#F97316" },
    { key: "delivered", label: "Delivered", color: ACCENT },
    { key: "cancelled", label: "Cancelled", color: RED },
  ];

  const overviewStatus = onlineOverview?.status_counts || {};
  const overviewSummary = onlineOverview?.summary || {};
  const recentOnlineOrders = onlineOverview?.recent_orders || [];
  const onlineChart = onlineOverview?.chart || [];

  const onlineStatusColor = (status) => {
    const meta = OVERVIEW_STATUS.find((s) => s.key === status);
    return meta ? meta.color : MUTED;
  };

  const onlineStatusLabel = (status) => {
    const meta = OVERVIEW_STATUS.find((s) => s.key === status);
    return meta ? meta.label : status;
  };

  const onlineChartHasData = onlineChart.some(
    (d) => Number(d.orders) > 0 || Number(d.revenue) > 0
  );

  // ─── Palette — matches MenuSidebar (dark plum + mint) ───────────
  return (
    <div className="min-h-screen" style={{ background: PAGE_BG }}>
      {/* =========================================================
          PAGE TITLE
      ========================================================= */}
      <section className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: TEXT }}>
          {getGreeting()}
          {userName ? `, ${userName}` : ""}
        </h1>
        <p className="mt-1 text-sm" style={{ color: MUTED }}>
          Welcome back to NewMoon Lechon Manok and Liempo House!
        </p>
      </section>

      {/* =========================================================
          KPI CARDS
      ========================================================= */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div
          onClick={() => navigateTo("/branch-map")}
          className="cursor-pointer rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
          onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
          onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: AMBER_SOFT, color: AMBER }}>
              <ShopOutlined style={{ fontSize: 20 }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: TEXT }}>{branches.length}</p>
              <p className="text-xs" style={{ color: MUTED }}>Total Branches</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => navigateTo("/staff")}
          className="cursor-pointer rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
          onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
          onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: ACCENT_SOFT, color: ACCENT }}>
              <TeamOutlined style={{ fontSize: 20 }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: TEXT }}>{staff.length}</p>
              <p className="text-xs" style={{ color: MUTED }}>Total Staff</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => navigateTo("/sales")}
          className="cursor-pointer rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
          onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
          onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: RED_SOFT, color: RED }}>
              <FontAwesomeIcon icon={faPesoSign} style={{ fontSize: 18 }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: TEXT }}>{formatCurrency(todaySales)}</p>
              <p className="text-xs" style={{ color: MUTED }}>Today&apos;s Sales</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => navigateTo("/sales")}
          className="cursor-pointer rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
          onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
          onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: GREEN_SOFT, color: GREEN }}>
              <StarOutlined style={{ fontSize: 20 }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: TEXT }}>{formatCurrency(totalSales)}</p>
              <p className="text-xs" style={{ color: MUTED }}>Total Sales</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => navigateTo("/delivery")}
          className="cursor-pointer rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
          onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
          onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(167,139,250,0.15)", color: "#A78BFA" }}>
              <ShoppingCartOutlined style={{ fontSize: 20 }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: TEXT }}>{overviewSummary.total_orders ?? 0}</p>
              <p className="text-xs" style={{ color: MUTED }}>Online Orders</p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          QUICK ACTIONS — moved above Sales Performance
      ========================================================= */}
      <section
        className="mb-6 rounded-2xl p-5"
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: ACCENT }}>
              Quick Actions
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight" style={{ color: TEXT }}>
              Keep your data fresh
            </h2>
            <p className="mt-1 text-sm" style={{ color: MUTED }}>
              Refresh your dashboard or register a new branch in seconds.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadDashboardData(true)}
              loading={loading}
              style={{
                height: 44,
                borderRadius: 12,
                background: PANEL_BG_2,
                border: `1px solid ${BORDER}`,
                color: TEXT,
                fontWeight: 500,
              }}
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
              style={{
                height: 44,
                borderRadius: 12,
                background: ACCENT,
                border: "none",
                color: "#1F1A2E",
                fontWeight: 700,
                boxShadow: "none",
              }}
            >
              Add Branch
            </Button>

            {lowStockItems.length > 0 && (
              <button
                type="button"
                onClick={() => setShowLowStockModal(true)}
                className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200"
                style={{
                  background: RED_SOFT,
                  border: `1px solid ${RED}30`,
                  color: "#FCA5A5",
                }}
              >
                <WarningOutlined />
                {lowStockItems.length} Low Stock
              </button>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================
          ERROR
      ========================================================= */}
      {loadError && (
        <div
          className="mb-6 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm"
          style={{ background: RED_SOFT, border: `1px solid ${RED}30`, color: "#FCA5A5" }}
        >
          <WarningOutlined className="mt-0.5" />
          <span>{loadError}</span>
        </div>
      )}

      {/* =========================================================
          SALES PERFORMANCE — FULL WIDTH
      ========================================================= */}
      <section
        className="mb-6 rounded-2xl p-6"
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
      >
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight" style={{ color: TEXT }}>
              Sales Performance
            </h2>
            <p className="text-xs" style={{ color: MUTED }}>
              Track your Branches sales over time
            </p>
          </div>
          <div
            className="flex rounded-lg p-0.5"
            style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
          >
            {["today", "week", "month"].map((p) => (
              <button
                key={p}
                onClick={() => setSalesPeriod(p)}
                className="rounded-md px-3 py-1 text-xs font-semibold transition-colors"
                style={
                  salesPeriod === p
                    ? { background: ACCENT, color: "#1F1A2E" }
                    : { color: MUTED, background: "transparent" }
                }
                onMouseEnter={(e) => {
                  if (salesPeriod !== p) e.currentTarget.style.color = ACCENT;
                }}
                onMouseLeave={(e) => {
                  if (salesPeriod !== p) e.currentTarget.style.color = MUTED;
                }}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="h-64">
          {salesChartData.every((d) => d.amount === 0) ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{ background: ACCENT_SOFT, color: ACCENT }}
              >
                <RiseOutlined style={{ fontSize: 22 }} />
              </div>
              <p className="mt-3 text-sm font-semibold" style={{ color: TEXT }}>
                No sales in this period
              </p>
              <p className="text-xs" style={{ color: MUTED }}>
                Sales will appear here once recorded
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesChartData} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={BORDER} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: MUTED }}
                  axisLine={{ stroke: BORDER }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: MUTED }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value) || 0)}
                  contentStyle={{
                    borderRadius: 10,
                    border: `1px solid ${BORDER}`,
                    background: PANEL_BG_2,
                    color: TEXT,
                    fontSize: 12,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                  }}
                  labelStyle={{ color: MUTED }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke={ACCENT}
                  strokeWidth={2}
                  fill="url(#salesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* =========================================================
          ONLINE ORDERS + ONLINE SALES
      ========================================================= */}
      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Online Orders Tracker */}
        <section
          className="rounded-2xl p-5"
          style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: AMBER_SOFT, color: AMBER }}
              >
                <TruckOutlined style={{ fontSize: 18 }} />
              </div>
              <div>
                <h2 className="text-[17px] font-bold tracking-tight" style={{ color: TEXT }}>
                  Online Orders
                </h2>
                <p className="text-xs" style={{ color: MUTED }}>
                  Live customer orders from the app
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  background: ACCENT_SOFT,
                  color: ACCENT,
                  border: `1px solid ${ACCENT}30`,
                }}
              >
                <SyncOutlined spin={onlineLoading} />
                Live · 30s
              </span>
              <button
                type="button"
                onClick={() => loadOnlineOverview()}
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}`, color: MUTED, cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = ACCENT; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = MUTED; }}
              >
                <ReloadOutlined />
              </button>
            </div>
          </div>

          {onlineError && (
            <div
              className="mb-4 rounded-xl px-3 py-2 text-xs"
              style={{ background: RED_SOFT, border: `1px solid ${RED}30`, color: "#FCA5A5" }}
            >
              <WarningOutlined className="mr-2" />
              {onlineError}
            </div>
          )}

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {OVERVIEW_STATUS.map((s) => (
              <div
                key={s.key}
                className="rounded-xl p-3"
                style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold leading-none" style={{ color: s.color }}>
                    {overviewStatus[s.key] || 0}
                  </span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }}
                  />
                </div>
                <p className="mt-2 truncate text-[11px] font-medium" style={{ color: MUTED }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl p-3" style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}30` }}>
              <p className="text-lg font-bold leading-none" style={{ color: ACCENT }}>
                {overviewSummary.active_orders ?? 0}
              </p>
              <p className="mt-1 text-[11px] font-medium" style={{ color: MUTED }}>
                Active Orders
              </p>
            </div>
            <div className="rounded-xl p-3" style={{ background: AMBER_SOFT, border: `1px solid ${AMBER}30` }}>
              <p className="text-lg font-bold leading-none" style={{ color: AMBER }}>
                {overviewSummary.today_orders ?? 0}
              </p>
              <p className="mt-1 text-[11px] font-medium" style={{ color: MUTED }}>
                Today&apos;s Orders
              </p>
            </div>
            <div className="rounded-xl p-3" style={{ background: AMBER_SOFT, border: `1px solid ${AMBER}30` }}>
              <p className="text-lg font-bold leading-none" style={{ color: AMBER }}>
                {formatCurrency(overviewSummary.today_revenue ?? 0)}
              </p>
              <p className="mt-1 text-[11px] font-medium" style={{ color: MUTED }}>
                Today&apos;s Revenue
              </p>
            </div>
            <div className="rounded-xl p-3" style={{ background: GREEN_SOFT, border: `1px solid ${GREEN}30` }}>
              <p className="text-lg font-bold leading-none" style={{ color: GREEN }}>
                {formatCurrency(overviewSummary.delivered_revenue ?? 0)}
              </p>
              <p className="mt-1 text-[11px] font-medium" style={{ color: MUTED }}>
                Delivered Revenue
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: MUTED }}>
                Recent Online Orders
              </p>
              <button
                type="button"
                onClick={() => navigateTo("/delivery")}
                className="text-xs font-semibold transition-opacity"
                style={{ color: ACCENT, background: "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.75"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              >
                View All →
              </button>
            </div>

            {recentOnlineOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <TruckOutlined style={{ fontSize: 22, color: FAINT }} />
                <p className="mt-2 text-sm font-medium" style={{ color: TEXT }}>
                  No online orders yet
                </p>
                <p className="text-xs" style={{ color: MUTED }}>
                  Customer app orders will appear here
                </p>
              </div>
            ) : (
              <div className="max-h-80 space-y-2 overflow-auto pr-1">
                {recentOnlineOrders.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center gap-3 rounded-lg p-2.5"
                    style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold"
                      style={{ background: `${onlineStatusColor(o.status)}1a`, color: onlineStatusColor(o.status) }}
                    >
                      {o.order_number?.replace("ORD-", "").slice(-5)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold" style={{ color: TEXT }}>
                        {o.customer_name}
                      </p>
                      <p className="truncate text-[11px]" style={{ color: MUTED }}>
                        {o.branch_name} · {o.payment_method?.toUpperCase()}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] font-bold" style={{ color: AMBER }}>
                        {formatCurrency(o.total)}
                      </p>
                      <span
                        className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: `${onlineStatusColor(o.status)}1a`, color: onlineStatusColor(o.status) }}
                      >
                        {onlineStatusLabel(o.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Online Sales Chart */}
        <section
          className="rounded-2xl p-5"
          style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
        >
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: RED_SOFT, color: RED }}
              >
                <LineChartOutlined style={{ fontSize: 18 }} />
              </div>
              <div>
                <h2 className="text-[17px] font-bold tracking-tight" style={{ color: TEXT }}>
                  Online Sales
                </h2>
                <p className="text-xs" style={{ color: MUTED }}>
                  Revenue and order volume from app orders
                </p>
              </div>
            </div>

            <div
              className="flex w-fit rounded-lg p-0.5"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              {["today", "week", "month"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setOnlinePeriod(p)}
                  className="rounded-md px-3 py-1 text-xs font-semibold transition-colors"
                  style={
                    onlinePeriod === p
                      ? { background: AMBER, color: "#1F1A2E" }
                      : { color: MUTED, background: "transparent" }
                  }
                  onMouseEnter={(e) => {
                    if (onlinePeriod !== p) e.currentTarget.style.color = AMBER;
                  }}
                  onMouseLeave={(e) => {
                    if (onlinePeriod !== p) e.currentTarget.style.color = MUTED;
                  }}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64">
            {!onlineChartHasData ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ background: AMBER_SOFT, color: AMBER }}
                >
                  <RiseOutlined style={{ fontSize: 22 }} />
                </div>
                <p className="mt-3 text-sm font-semibold" style={{ color: TEXT }}>
                  No online sales in this period
                </p>
                <p className="text-xs" style={{ color: MUTED }}>
                  App orders will appear here once placed
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={onlineChart}
                  margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="onlineRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={AMBER} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={BORDER} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: MUTED }}
                    axisLine={{ stroke: BORDER }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="revenue"
                    tick={{ fontSize: 10, fill: MUTED }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="orders"
                    orientation="right"
                    width={30}
                    tick={{ fontSize: 10, fill: MUTED }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value, name) =>
                      name === "Revenue"
                        ? formatCurrency(Number(value) || 0)
                        : Number(value) || 0
                    }
                    contentStyle={{
                      borderRadius: 10,
                      border: `1px solid ${BORDER}`,
                      background: PANEL_BG_2,
                      color: TEXT,
                      fontSize: 12,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                    }}
                    labelStyle={{ color: MUTED }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: MUTED }} />
                  <Bar
                    yAxisId="orders"
                    dataKey="orders"
                    name="Orders"
                    fill={ACCENT_DEEP}
                    radius={[3, 3, 0, 0]}
                    barSize={9}
                  />
                  <Area
                    yAxisId="revenue"
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke={AMBER}
                    strokeWidth={2}
                    fill="url(#onlineRevenueFill)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      {/* =========================================================
          BEST SELLERS + BRANCH PERFORMANCE
      ========================================================= */}
      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Best Sellers */}
        <section
          className="rounded-2xl p-5"
          style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
        >
          <h2 className="text-[17px] font-bold tracking-tight" style={{ color: TEXT }}>
            Today&apos;s Best Sellers
          </h2>
          <p className="mb-4 text-xs" style={{ color: MUTED }}>
            Most-ordered items across all sales
          </p>
          {bestSellers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FireOutlined style={{ fontSize: 22, color: ACCENT }} />
              <p className="mt-2 text-sm font-medium" style={{ color: TEXT }}>
                No sales yet
              </p>
              <p className="text-xs" style={{ color: MUTED }}>
                Ordered items will be ranked here
              </p>
            </div>
          ) : (
            <div>
              {bestSellers.map((b, i) => (
                <div
                  key={b.name}
                  className="flex items-center gap-3 py-3"
                  style={{ borderTop: i === 0 ? "none" : `1px solid ${BORDER}` }}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                    style={
                      i === 0
                        ? { background: ACCENT, color: "#1F1A2E" }
                        : { background: ACCENT_SOFT, color: ACCENT }
                    }
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" style={{ color: TEXT }}>
                      {b.name}
                    </p>
                    <p className="text-xs" style={{ color: MUTED }}>
                      {b.qty} sold
                    </p>
                  </div>
                  <div className="text-sm font-bold" style={{ color: ACCENT }}>
                    {formatCurrency(b.revenue)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Branch Performance */}
        <section
          className="rounded-2xl p-5"
          style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[17px] font-bold tracking-tight" style={{ color: TEXT }}>
                Branch Performance
              </h2>
              <p className="text-xs" style={{ color: MUTED }}>
                Sales activity by location
              </p>
            </div>
            <button
              onClick={() => navigateTo("/branch-map")}
              className="text-xs font-semibold transition-colors"
              style={{ color: ACCENT, background: "transparent", border: "none", cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              All Branches →
            </button>
          </div>
          {branchPerformance.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ShopOutlined style={{ fontSize: 22, color: ACCENT }} />
              <p className="mt-2 text-sm font-medium" style={{ color: TEXT }}>
                No branches
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {branchPerformance.map((b) => (
                <button
                  key={b.id}
                  onClick={() => navigateTo(`/branch/${b.id}`)}
                  className="group flex flex-col gap-2 rounded-lg p-4 text-left transition-all duration-200"
                  style={{
                    background: PANEL_BG_2,
                    border: `1px solid ${BORDER}`,
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
                  onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold" style={{ color: TEXT }}>
                      {b.name}
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 text-[10px] font-semibold"
                      style={{ color: ACCENT }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: ACCENT }}
                      />
                      Open
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: MUTED }}>Sales</span>
                    <span className="font-bold" style={{ color: ACCENT }}>
                      {formatCurrency(b.sales)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: MUTED }}>Orders</span>
                    <span className="font-semibold" style={{ color: TEXT }}>
                      {b.orders}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: MUTED }}>Staff</span>
                    <span className="font-semibold" style={{ color: TEXT }}>
                      {b.staffCount}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* =========================================================
          RECENT ACTIVITY + INVENTORY WATCH
      ========================================================= */}
      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Recent Activity */}
        <section
          className="rounded-2xl p-5"
          style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
        >
          <h2 className="text-[17px] font-bold tracking-tight" style={{ color: TEXT }}>
            Recent Activity
          </h2>
          <p className="mb-4 text-xs" style={{ color: MUTED }}>
            Latest Branches sales
          </p>
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ClockCircleOutlined style={{ fontSize: 22, color: MUTED }} />
              <p className="mt-2 text-sm font-medium" style={{ color: TEXT }}>
                No recent activity
              </p>
            </div>
          ) : (
            <div className="relative space-y-0">
              {recentActivity.map((e, i) => (
                <div key={i} className="relative flex gap-3 pb-4">
                  {i < recentActivity.length - 1 && (
                    <span
                      className="absolute top-5 h-full w-px"
                      style={{ left: 9, background: BORDER }}
                    />
                  )}
                  <span
                    className="mt-1.5 flex shrink-0 items-center justify-center rounded-full"
                    style={{
                      width: 18,
                      height: 18,
                      border: `2px solid ${e.kind === "order" ? ACCENT : AMBER}`,
                      background: PANEL_BG,
                      boxShadow: `0 0 0 3px ${ACCENT_SOFT}`,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold" style={{ color: TEXT }}>
                        {e.text}
                      </span>
                      <span className="shrink-0 text-[11px]" style={{ color: MUTED }}>
                        {e.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: MUTED }}>
                      <span className="font-semibold" style={{ color: ACCENT }}>{e.detail}</span>
                      {e.branch ? <span>· {e.branch}</span> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Inventory Watch */}
        <section
          className="rounded-2xl p-5"
          style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[17px] font-bold tracking-tight" style={{ color: TEXT }}>
                Inventory Watch
              </h2>
              <p className="text-xs" style={{ color: MUTED }}>
                Stock levels that need monitoring
              </p>
            </div>
            <button
              onClick={() => navigateTo("/inventory")}
              className="text-xs font-semibold transition-colors"
              style={{ color: ACCENT, background: "transparent", border: "none", cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              Full Stock Room →
            </button>
          </div>
          {inventoryWatch.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircleOutlined style={{ fontSize: 22, color: ACCENT }} />
              <p className="mt-2 text-sm font-medium" style={{ color: TEXT }}>
                Inventory looks healthy
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {inventoryWatch.map((it) => (
                <div
                  key={it.name}
                  className="rounded-lg p-3"
                  style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold" style={{ color: TEXT }}>
                        {it.name}
                      </p>
                      <p className="text-[11px]" style={{ color: MUTED }}>
                        {it.qty} remaining · minimum {it.min}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{ background: `${it.color}1a`, color: it.color }}
                    >
                      {it.status}
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full"
                    style={{ background: BORDER }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${it.pct}%`, background: it.color }}
                    />
                  </div>
                </div>
              ))}
              {lowStockItems.length > 0 && (
                <button
                  onClick={() => setShowLowStockModal(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
                  style={{
                    background: RED_SOFT,
                    border: `1px solid ${RED}30`,
                    color: "#FCA5A5",
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.22)"}
                  onMouseLeave={e => e.currentTarget.style.background = RED_SOFT}
                >
                  <WarningOutlined />
                  View all {lowStockItems.length} low-stock alert{lowStockItems.length > 1 ? "s" : ""}
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {/* =========================================================
          BRANCH SECTION HEADER
      ========================================================= */}
      <section className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: ACCENT_SOFT, color: ACCENT }}
              >
                <ShopOutlined />
              </div>
              <h2 className="text-2xl font-bold tracking-tight" style={{ color: TEXT }}>
                Branches
              </h2>
            </div>
            <p className="mt-2 text-sm" style={{ color: MUTED }}>
              Manage and monitor each NewMoon branch&apos;s performance.
            </p>
          </div>

          <div
            className="inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}
          >
            {branches.length} {branches.length === 1 ? "Branch" : "Branches"}
          </div>
        </div>
      </section>

      {/* =========================================================
          BRANCHES GRID
      ========================================================= */}
      {loading ? (
        <div
          className="rounded-2xl py-16"
          style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
        >
          <Loading text="Loading branches..." />
        </div>
      ) : branches.length === 0 ? (
        <div
          className="rounded-2xl px-6 py-16 text-center"
          style={{ background: PANEL_BG, border: `1px dashed ${BORDER}` }}
        >
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl"
            style={{ background: ACCENT_SOFT, color: ACCENT }}
          >
            <ShopOutlined style={{ fontSize: 32 }} />
          </div>
          <h3 className="mt-5 text-xl font-bold" style={{ color: TEXT }}>
            No branches yet
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: MUTED }}>
            Start building your NewMoon operations by adding your first branch.
          </p>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              addBranchForm.resetFields();
              setIsModalOpen(true);
            }}
            style={{
              marginTop: 20,
              height: 44,
              borderRadius: 12,
              background: ACCENT,
              border: "none",
              color: "#1F1A2E",
              fontWeight: 700,
              boxShadow: "none",
            }}
          >
            Add Your First Branch
          </Button>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {branches.map((branch) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={branch.id}>
              <div
                onClick={() => navigateTo(`/branch/${branch.id}`)}
                className="group h-full cursor-pointer overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
                onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
                onMouseLeave={e => e.currentTarget.style.borderColor = BORDER}
              >
                <div
                  className="relative overflow-hidden px-5 py-5"
                  style={{ background: PANEL_BG_2, borderBottom: `1px solid ${BORDER}` }}
                >
                  <div className="relative z-10 flex items-center justify-between">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ background: ACCENT_SOFT, color: ACCENT }}
                    >
                      <ShopOutlined style={{ fontSize: 20 }} />
                    </div>
                    <div
                      className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ background: PANEL_BG, color: MUTED, border: `1px solid ${BORDER}` }}
                    >
                      Branch
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-5">
                    <h3 className="truncate text-lg font-bold" style={{ color: TEXT }}>
                      {branch.name}
                    </h3>
                    {branch.code && (
                      <span
                        className="mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
                        style={{ background: ACCENT_SOFT, color: ACCENT }}
                      >
                        #{branch.code}
                      </span>
                    )}
                    {branch.address && (
                      <p className="mt-2 line-clamp-2 text-xs leading-5" style={{ color: MUTED }}>
                        {branch.address}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div
                      className="flex items-center justify-between rounded-xl px-3 py-2.5"
                      style={{ background: PANEL_BG_2 }}
                    >
                      <span className="flex items-center gap-2 text-xs font-medium" style={{ color: MUTED }}>
                        <StockOutlined style={{ color: ACCENT }} />
                        Stock
                      </span>
                      <span
                        className="rounded-lg px-2.5 py-1 text-xs font-bold"
                        style={{ background: PANEL_BG, color: TEXT }}
                      >
                        {getBranchProductsCount(branch.id)}
                      </span>
                    </div>

                    <div
                      className="flex items-center justify-between rounded-xl px-3 py-2.5"
                      style={{ background: PANEL_BG_2 }}
                    >
                      <span className="flex items-center gap-2 text-xs font-medium" style={{ color: MUTED }}>
                        <TeamOutlined style={{ color: AMBER }} />
                        Staff
                      </span>
                      <span
                        className="rounded-lg px-2.5 py-1 text-xs font-bold"
                        style={{ background: PANEL_BG, color: TEXT }}
                      >
                        {getBranchStaffCount(branch.id)}
                      </span>
                    </div>

                    <div
                      className="flex items-center justify-between rounded-xl px-3 py-2.5"
                      style={{ background: PANEL_BG_2 }}
                    >
                      <span className="flex items-center gap-2 text-xs font-medium" style={{ color: MUTED }}>
                        <ProductOutlined style={{ color: MUTED }} />
                        Products
                      </span>
                      <span
                        className="rounded-lg px-2.5 py-1 text-xs font-bold"
                        style={{ background: PANEL_BG, color: TEXT }}
                      >
                        {getBranchProductCount(branch.id)}
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-right text-[11px] font-medium" style={{ color: FAINT }}>
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
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: RED_SOFT, color: RED }}
            >
              <WarningOutlined />
            </div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>Low Stock Alert</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>
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
                sessionStorage.setItem("dismissed_low_stock", "true");
                setShowLowStockModal(false);
              }}
              className="rounded-xl!"
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
              className="rounded-xl! border-none! bg-red-600!"
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
            {lowStockItems.length > 1 ? "s are" : " is"} running low on stock.
          </p>
        </div>

        <div className="max-h-80 overflow-auto rounded-xl border border-stone-100">
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
                <tr key={i} className="border-b border-stone-50 last:border-0">
                  <td className="px-4 py-3 text-stone-800">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
                        <ShoppingCartOutlined />
                      </div>
                      <span className="max-w-40 truncate font-medium">
                        {item.product_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{item.branch_name}</td>
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
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: ACCENT_SOFT, color: ACCENT }}
            >
              <PlusOutlined />
            </div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>Add New Branch</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>
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
        <div
          className="mb-5 mt-2 rounded-xl p-4"
          style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}30` }}
        >
          <p className="mb-0 text-xs leading-5" style={{ color: ACCENT }}>
            <InfoCircleOutlined className="mr-2" />
            This branch information will be visible to staff members and customers.
          </p>
        </div>

        <Form form={addBranchForm} layout="vertical" onFinish={handleAddBranch}>
          <Form.Item
            label={<span className="text-sm font-semibold text-stone-700">Branch Name</span>}
            name="name"
            rules={[{ required: true, message: "Branch name is required" }]}
          >
            <Input
              placeholder="Enter branch name"
              className="h-11! rounded-xl! border-stone-200! hover:border-orange-300! focus:border-orange-500!"
            />
          </Form.Item>

          <Form.Item
            label={<span className="text-sm font-semibold text-stone-700">Branch Code</span>}
            name="code"
            rules={[{ required: true, message: "Branch code is required" }]}
          >
            <Input
              placeholder="Example: MAIN"
              className="h-11! rounded-xl! border-stone-200! hover:border-orange-300! focus:border-orange-500!"
            />
          </Form.Item>

          <Form.Item
            label={<span className="text-sm font-semibold text-stone-700">Branch Address</span>}
            name="address"
            rules={[{ required: true, message: "Branch address is required" }]}
          >
            <Input.TextArea
              placeholder="Enter complete branch address"
              rows={3}
              className="rounded-xl! border-stone-200! hover:border-orange-300! focus:border-orange-500!"
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  setIsModalOpen(false);
                  addBranchForm.resetFields();
                }}
                className="h-11! rounded-xl! px-5!"
              >
                Cancel
              </Button>

              <Button
                type="primary"
                htmlType="submit"
                className="h-11! rounded-xl! border-none! bg-[#22D3A8] px-5! font-semibold text-[#1F1A2E] shadow-none hover:bg-[#16B48C]!"
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