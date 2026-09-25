import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Table,
  DatePicker,
  Select,
  Button,
  Space,
  Typography,
  Statistic,
  Tag,
  Tooltip,
  Divider,
  Radio,
} from "antd";
import {
  ShoppingOutlined,
  RiseOutlined,
  FallOutlined,
  DownloadOutlined,
  FileTextOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../config/api";
import Loading from "../components/Loading";
import { clientPagination, serverPagination } from "../components/Pagination";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ✅ Replace this with your actual auth hook / context
import { useAuth } from "../hooks/useAuth"; // e.g., returns { user, isAdmin }

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const trendShapes = ["circle", "star", "diamond", "triangle", "cross", "wye"];
const trendShapeMap = {
  circle: "circle",
  star: "star",
  diamond: "diamond",
  triangle: "triangle",
  cross: "cross",
  wye: "wye",
};

const SalesReport = () => {
  // ---------- Authentication ----------
  const { user, isAdmin } = useAuth();
  const userBranchId = user?.branch_id || null; // adjust field name as needed

  // ---------- State ----------
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [dateRange, setDateRange] = useState([
    dayjs().startOf("month"),
    dayjs().endOf("month"),
  ]);
  const [groupBy, setGroupBy] = useState("daily");
  const [selectedBranch, setSelectedBranch] = useState(userBranchId); // default to user's branch
  const [branches, setBranches] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 7,
    total: 0,
  });
  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendShape, setTrendShape] = useState("circle");

  // ---------- Fetch report ----------
  const fetchSalesReport = async (page = 1) => {
    setLoading(true);
    try {
      // Build params – always enforce branch for non‑admins
      const params = {
        start_date: dateRange[0].format("YYYY-MM-DD"),
        end_date: dateRange[1].format("YYYY-MM-DD"),
        group_by: groupBy,
        page: page,
        per_page: pagination.pageSize,
      };

      if (!isAdmin) {
        // Non‑admins can only see their own branch
        params.branch_id = userBranchId;
      } else if (selectedBranch) {
        // Admins can pick any branch (or none for all)
        params.branch_id = selectedBranch;
      }
      // If admin and selectedBranch is null, omit branch_id → get all branches

      const [salesRes, branchesRes] = await Promise.all([
        api.get("/reports/sales", { params }),
        api.get("/branches"),
      ]);

      // Set branches list (for the selector)
      setBranches(
        Array.isArray(branchesRes.data)
          ? branchesRes.data
          : branchesRes.data?.data || []
      );

      const data = salesRes.data || {};
      setSalesData(data.data || []);

      // Build summary
      let summaryData = data.summary || {};
      if (groupBy === "branch") {
        summaryData = {
          total_revenue: summaryData.total_revenue || 0,
          total_transactions: summaryData.total_transactions || 0,
          avg_transaction: summaryData.avg_branch_revenue || 0,
          growth: null,
        };
      } else if (groupBy !== "detail" && summaryData.total_sales !== undefined) {
        const totalTransactions = summaryData.total_transactions || 0;
        const totalSales = summaryData.total_sales || 0;
        summaryData = {
          total_revenue: totalSales,
          total_transactions: totalTransactions,
          avg_transaction:
            totalTransactions > 0 ? totalSales / totalTransactions : 0,
          growth: null,
        };
      } else if (groupBy === "detail") {
        const totalSales = data.summary?.total_sales || 0;
        const totalTransactions = data.summary?.total_transactions || 0;
        summaryData = {
          total_revenue: totalSales,
          total_transactions: totalTransactions,
          avg_transaction:
            totalTransactions > 0 ? totalSales / totalTransactions : 0,
          growth: null,
        };
      } else {
        summaryData = {
          total_revenue: 0,
          total_transactions: 0,
          avg_transaction: 0,
          growth: null,
        };
      }
      setSummary(summaryData);

      // Pagination
      if (data.pagination) {
        setPagination({
          current: data.pagination.current_page,
          pageSize: data.pagination.per_page,
          total: data.pagination.total,
        });
      } else {
        setPagination({
          current: 1,
          pageSize: 7,
          total: data.data?.length || 0,
        });
      }
    } catch (err) {
      console.error("[SalesReport] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Auto‑fetch when filters change ----------
  useEffect(() => {
    fetchSalesReport(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, groupBy, selectedBranch, userBranchId, isAdmin]);

  // ---------- Fetch 6-month trend ----------
  useEffect(() => {
    const fetchTrend = async () => {
      setTrendLoading(true);
      try {
        const end = dayjs().endOf("month");
        const start = dayjs().subtract(5, "month").startOf("month");
        const params = {
          start_date: start.format("YYYY-MM-DD"),
          end_date: end.format("YYYY-MM-DD"),
          group_by: "monthly",
        };
        if (!isAdmin) params.branch_id = userBranchId;
        else if (selectedBranch) params.branch_id = selectedBranch;

        const res = await api.get("/reports/sales", { params });
        const raw = res.data?.data || [];

        const formatted = raw.map((row) => ({
          month: dayjs(row.period + "-01").isValid()
            ? dayjs(row.period + "-01").format("MMM YYYY")
            : row.period,
          sales: Number(row.total_sales) || 0,
          transactions: Number(row.transaction_count) || 0,
          items: Number(row.total_items) || 0,
        }));
        setTrendData(formatted);
      } catch (err) {
        console.error("[SalesReport] Trend fetch error:", err);
      } finally {
        setTrendLoading(false);
      }
    };
    fetchTrend();
  }, [selectedBranch, userBranchId, isAdmin]);

  // ---------- Table pagination handler ----------
  const handleTableChange = (pagination) => {
    fetchSalesReport(pagination.current);
  };

  // ---------- Export CSV ----------
  const handleExport = () => {
    let csvContent = "";
    if (groupBy === "detail") {
      csvContent = [
        ["Date", "Invoice", "Customer", "Items", "Total", "Payment Method", "Branch"],
        ...salesData.map((row) => [
          dayjs(row.created_at).format("YYYY-MM-DD HH:mm"),
          row.invoice_number,
          row.customer_name,
          row.items_count,
          row.total,
          row.payment_method,
          row.branch_name,
        ]),
      ]
        .map((e) => e.join(","))
        .join("\n");
    } else if (groupBy === "branch") {
      csvContent = [
        ["Branch", "Transactions", "Items Sold", "Total Sales", "Avg/Transaction"],
        ...salesData.map((row) => [
          row.branch_name,
          row.transaction_count,
          row.total_items,
          row.total_sales,
          row.avg_transaction,
        ]),
      ]
        .map((e) => e.join(","))
        .join("\n");
    } else {
      csvContent = [
        ["Period", "Transactions", "Total Sales", "Items Sold"],
        ...salesData.map((row) => [
          row.period,
          row.transaction_count,
          row.total_sales,
          row.total_items,
        ]),
      ]
        .map((e) => e.join(","))
        .join("\n");
    }

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales_report_${groupBy}_${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
  };

  // ---------- Table columns ----------
  const groupedColumns = [
    {
      title: "Period",
      dataIndex: "period",
      key: "period",
      render: (period) => <Text strong>{period}</Text>,
    },
    {
      title: "Transactions",
      dataIndex: "transaction_count",
      key: "transaction_count",
      align: "center",
    },
    {
      title: "Total Sales",
      dataIndex: "total_sales",
      key: "total_sales",
      render: (total) => (
        <Text strong style={{ color: "#EA580C" }}>
          ₱{Number(total).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </Text>
      ),
    },
    {
      title: "Items Sold",
      dataIndex: "total_items",
      key: "total_items",
      align: "center",
    },
    {
      title: "Avg / Transaction",
      key: "avg_transaction",
      render: (_, record) => {
        const avg =
          record.transaction_count > 0
            ? record.total_sales / record.transaction_count
            : 0;
        return `₱${avg.toFixed(2)}`;
      },
    },
  ];

  const detailColumns = [
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      render: (date) => dayjs(date).format("MMM DD, YYYY HH:mm"),
    },
    {
      title: "Invoice",
      dataIndex: "invoice_number",
      key: "invoice_number",
      render: (invoice) => <Text strong>{invoice}</Text>,
    },
    {
      title: "Customer",
      dataIndex: "customer_name",
      key: "customer_name",
    },
    {
      title: "Items",
      dataIndex: "items",
      key: "items",
      render: (items) => {
        if (!items || items.length === 0) return "-";
        return (
          <Tooltip
            title={items.map((i) => `${i.product?.name || "N/A"} x${i.quantity}`).join("\n")}
          >
            <Tag>
              {items.length === 1
                ? items[0].product?.name || "N/A"
                : `${items[0].product?.name || "N/A"} +${items.length - 1}`}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      sorter: (a, b) => a.total - b.total,
      render: (total) => (
        <Text strong style={{ color: "#EA580C" }}>
          ₱{Number(total).toLocaleString(undefined, {
            minimumFractionDigits: 2,
          })}
        </Text>
      ),
    },
    {
      title: "Payment",
      dataIndex: "payment_method",
      key: "payment_method",
      render: (method) => <Tag color="orange">{method}</Tag>,
    },
    {
      title: "Branch",
      dataIndex: ["branch", "name"],
      key: "branch_name",
      render: (name) => name || "-",
    },
  ];

  const branchColumns = [
    {
      title: "Branch",
      dataIndex: "branch_name",
      key: "branch_name",
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: "Transactions",
      dataIndex: "transaction_count",
      key: "transaction_count",
      align: "center",
      sorter: (a, b) => a.transaction_count - b.transaction_count,
    },
    {
      title: "Items Sold",
      dataIndex: "total_items",
      key: "total_items",
      align: "center",
    },
    {
      title: "Total Sales",
      dataIndex: "total_sales",
      key: "total_sales",
      sorter: (a, b) => a.total_sales - b.total_sales,
      render: (val) => (
        <Text strong style={{ color: "#EA580C" }}>
          ₱{Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: "Avg / Transaction",
      dataIndex: "avg_transaction",
      key: "avg_transaction",
      render: (val) => `₱${Number(val).toFixed(2)}`,
    },
  ];

  // ---------- Render ----------
  return (
    <div className="min-h-screen bg-[#FFF7ED] p-4 sm:p-6 lg:p-8">
      {/* =========================================================
          HERO HEADER
      ========================================================= */}
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-linear-to-br from-stone-950 via-stone-900 to-orange-950 shadow-[0_20px_50px_rgba(67,20,7,0.20)]">
        {/* Decorative background */}
        <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-orange-500/10 blur-2xl" />

        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="pointer-events-none absolute right-10 top-10 text-[180px] leading-none text-orange-500/5">
          <BarChartOutlined />
        </div>

        {/* Flame accent line */}
        <div className="absolute left-0 right-0 top-0 h-1 bg-linear-to-r from-[#EA580C] via-[#F97316] to-amber" />

        <div className="relative z-10 p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            {/* Brand / Welcome */}
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
                <BarChartOutlined />
                Financial Reports
              </div>

              <Title
                level={1}
                className="mb-0 mt-0 max-w-3xl text-3xl! font-extrabold! tracking-tight! text-white! sm:text-4xl! lg:text-5xl!"
              >
                Sales <span className="text-orange-400">Report</span>
              </Title>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
                Detailed sales analysis and trends
              </p>

              {/* Action buttons */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                  className="h-11! rounded-xl! border-white/15! bg-white/5! px-5! font-medium! text-white! backdrop-blur transition-all duration-300 hover:border-orange-300! hover:bg-white/10! hover:text-orange-300!"
                >
                  Export CSV
                </Button>
                <Button
                  type="primary"
                  icon={<FileTextOutlined />}
                  onClick={fetchSalesReport}
                  loading={loading}
                  className="h-11! rounded-xl! border-none! bg-linear-to-r! from-orange-600! to-amber-500! px-5! font-semibold! shadow-lg! shadow-orange-500/20! transition-all duration-300 hover:from-orange-700! hover:to-amber-600!"
                >
                  Generate Report
                </Button>
              </div>
            </div>
          </div>

          {/* KPI summary stats inside hero */}
          {summary && (
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {/* Total Revenue */}
              <div className="group rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/9">
                <div className="flex items-center justify-between">
                  <div>
                    <Statistic
                      title="Total Revenue"
                      value={summary.total_revenue || 0}
                      styles={{
                        title: { color: "rgba(255,255,255,0.45)" },
                        content: { color: "#EA580C" },
                      }}
                      formatter={(value) =>
                        `₱${Number(value).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}`
                      }
                    />
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/15 text-green-400">
                    <RiseOutlined className="text-xl" />
                  </div>
                </div>
              </div>

              {/* Total Transactions */}
              <div className="group rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/9">
                <div className="flex items-center justify-between">
                  <div>
                    <Statistic
                      title={
                        groupBy === "branch"
                          ? "Total Transactions"
                          : "Total Transactions"
                      }
                      value={summary.total_transactions || 0}
                      styles={{
                        title: { color: "rgba(255,255,255,0.45)" },
                        content: { color: "#D97706" },
                      }}
                    />
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
                    <ShoppingOutlined className="text-xl" />
                  </div>
                </div>
              </div>

              {/* Avg Transaction */}
              <div className="group rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/9">
                <div className="flex items-center justify-between">
                  <div>
                    <Statistic
                      title={
                        groupBy === "branch"
                          ? "Avg Branch Revenue"
                          : "Avg Transaction"
                      }
                      value={summary.avg_transaction || 0}
                      styles={{
                        title: { color: "rgba(255,255,255,0.45)" },
                        content: { color: "#B45309" },
                      }}
                      formatter={(value) => `₱${Number(value).toFixed(2)}`}
                    />
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                    <BarChartOutlined className="text-xl" />
                  </div>
                </div>
              </div>

              {/* Growth / Active Branches */}
              <div className="group rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/9">
                <div className="flex items-center justify-between">
                  <div>
                    <Statistic
                      title={
                        groupBy === "branch"
                          ? "Active Branches"
                          : "Growth (vs previous)"
                      }
                      value={
                        groupBy === "branch"
                          ? summary.total_branches || 0
                          : summary.growth !== null
                          ? summary.growth
                          : "N/A"
                      }
                      suffix={
                        groupBy === "branch"
                          ? ""
                          : summary.growth !== null
                          ? "%"
                          : ""
                      }
                      styles={{
                        title: { color: "rgba(255,255,255,0.45)" },
                        content: {
                          color:
                            groupBy === "branch"
                              ? "#D97706"
                              : summary.growth !== null && summary.growth >= 0
                              ? "#52c41a"
                              : "#ff4d4f",
                        },
                      }}
                    />
                  </div>
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl ${
                      groupBy === "branch"
                        ? "bg-orange-500/15 text-orange-400"
                        : summary.growth !== null && summary.growth >= 0
                        ? "bg-green-500/15 text-green-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {groupBy === "branch" ? (
                      <BarChartOutlined />
                    ) : summary.growth !== null && summary.growth >= 0 ? (
                      <RiseOutlined />
                    ) : (
                      <FallOutlined />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <Row gutter={[16, 16]}>
        {/* Filters */}
        <Col span={24}>
          <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
            <Space wrap>
              <Text strong className="text-sm font-semibold text-stone-700">
                Date Range:
              </Text>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                format="YYYY-MM-DD"
                allowClear={false}
                className="h-11! rounded-xl! border-stone-200! hover:border-orange-300! focus-within:border-orange-500!"
              />
              <Divider orientation="vertical" className="border-orange-100!" />
              <Text strong className="text-sm font-semibold text-stone-700">
                Group By:
              </Text>
              <Radio.Group
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="[&_.ant-radio-button-wrapper]:border-orange-200! [&_.ant-radio-button-wrapper:hover]:border-orange-300! [&_.ant-radio-button-wrapper:hover]:text-orange-600! [&_.ant-radio-button-wrapper-checked]:border-orange-500! [&_.ant-radio-button-wrapper-checked]:bg-orange-500! [&_.ant-radio-button-wrapper-checked]:text-white! [&_.ant-radio-button-wrapper-checked]:shadow-sm! [&_.ant-radio-button-wrapper-checked::before]:bg-orange-500!"
              >
                <Radio.Button value="daily">Daily</Radio.Button>
                <Radio.Button value="weekly">Weekly</Radio.Button>
                <Radio.Button value="monthly">Monthly</Radio.Button>
                <Radio.Button value="detail">Detail</Radio.Button>
              </Radio.Group>
              <Divider orientation="vertical" className="border-orange-100!" />
              <Text strong className="text-sm font-semibold text-stone-700">
                Branch:
              </Text>
              {isAdmin ? (
                <Select
                  style={{ width: 200 }}
                  placeholder="All Branches"
                  allowClear
                  value={selectedBranch}
                  onChange={setSelectedBranch}
                  className="h-11! rounded-xl! border-stone-200! hover:border-orange-300! focus:border-orange-500!"
                >
                  {branches.map((branch) => (
                    <Select.Option key={branch.id} value={branch.id}>
                      {branch.name}
                    </Select.Option>
                  ))}
                </Select>
              ) : (
                // Non‑admins see their branch name as a static text
                <Text strong className="text-sm font-semibold text-stone-700">
                  {branches.find((b) => b.id === userBranchId)?.name ||
                    "Your Branch"}
                </Text>
              )}
            </Space>
          </div>
        </Col>

        {/* 6-Month Trend Chart */}
        <Col span={24}>
          <Card
            variant="borderless"
            className="rounded-2xl border border-orange-100 bg-white shadow-sm"
            title={
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                  <BarChartOutlined />
                </div>
                <span className="text-lg font-bold text-stone-900">
                  6-Month Sales Trend
                </span>
                <span className="rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">
                  {trendData.length} months
                </span>
              </div>
            }
            extra={
              <Select
                value={trendShape}
                onChange={setTrendShape}
                style={{ width: 120 }}
                size="small"
                className="rounded-xl! border-stone-200! hover:border-orange-300! focus:border-orange-500!"
              >
                {trendShapes.map((s) => (
                  <Select.Option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Select.Option>
                ))}
              </Select>
            }
          >
            {trendLoading ? (
              <Loading text="Loading trend data..." />
            ) : trendData.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-300">
                  <BarChartOutlined className="text-3xl" />
                </div>
                <p className="text-stone-500">No trend data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={trendData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(v) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                    }
                  />
                  <ReTooltip
                    formatter={(value, name) => {
                      if (name === "Sales")
                        return [
                          `₱${Number(value).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}`,
                          name,
                        ];
                      return [value, name];
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    name="Sales"
                    stroke="#EA580C"
                    strokeWidth={2}
                    dot={{
                      r: 5,
                      fill: "#EA580C",
                      stroke: "#fff",
                      strokeWidth: 2,
                      symbol: trendShapeMap[trendShape],
                    }}
                    activeDot={{ r: 7 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="transactions"
                    name="Transactions"
                    stroke="#D97706"
                    strokeWidth={2}
                    dot={{
                      r: 5,
                      fill: "#D97706",
                      stroke: "#fff",
                      strokeWidth: 2,
                      symbol: trendShapeMap[trendShape],
                    }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        {/* Data Table */}
        <Col span={24}>
          <Card
            variant="borderless"
            className="rounded-2xl border border-orange-100 bg-white shadow-sm"
            title={
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                  <FileTextOutlined />
                </div>
                <span className="text-lg font-bold text-stone-900">
                  {groupBy === "detail"
                    ? "Transaction Details"
                    : groupBy === "branch"
                    ? "Sales by Branch"
                    : `Sales by ${groupBy}`}
                </span>
                <span className="rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">
                  {salesData.length} rows
                </span>
              </div>
            }
          >
            {groupBy === "detail" ? (
              <Table
                columns={detailColumns}
                dataSource={salesData}
                rowKey="id"
                loading={loading}
                pagination={serverPagination(pagination, { label: "sales" })}
                onChange={handleTableChange}
                scroll={{ x: true }}
                className="[&_.ant-table-container]:rounded-xl! [&_.ant-table-thead_>_tr_>_th]:bg-[#FFF1E6]! [&_.ant-table-thead_>_tr_>_th]:text-stone-700! [&_.ant-table-thead_>_tr_>_th]:font-semibold! [&_.ant-table-tbody_>_tr:hover_>_td]:bg-[#FFF8ED]!"
              />
            ) : groupBy === "branch" ? (
              <Table
                columns={branchColumns}
                dataSource={salesData}
                rowKey="branch_id"
                loading={loading}
                pagination={clientPagination({ label: "branches" })}
                scroll={{ x: true }}
                className="[&_.ant-table-container]:rounded-xl! [&_.ant-table-thead_>_tr_>_th]:bg-[#FFF1E6]! [&_.ant-table-thead_>_tr_>_th]:text-stone-700! [&_.ant-table-thead_>_tr_>_th]:font-semibold! [&_.ant-table-tbody_>_tr:hover_>_td]:bg-[#FFF8ED]!"
              />
            ) : (
              <Table
                columns={groupedColumns}
                dataSource={salesData}
                rowKey="period"
                loading={loading}
                pagination={clientPagination({ label: "days" })}
                scroll={{ x: true }}
                className="[&_.ant-table-container]:rounded-xl! [&_.ant-table-thead_>_tr_>_th]:bg-[#FFF1E6]! [&_.ant-table-thead_>_tr_>_th]:text-stone-700! [&_.ant-table-thead_>_tr_>_th]:font-semibold! [&_.ant-table-tbody_>_tr:hover_>_td]:bg-[#FFF8ED]!"
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SalesReport;