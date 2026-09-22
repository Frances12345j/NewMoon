import { useState, useCallback } from "react";
import dayjs from "dayjs";
import {
  Card, Table, Tag, Row, Col, Statistic, Select, Button, Space, Progress, DatePicker, Avatar,
  Modal, Form, InputNumber, Input, message, Tooltip, Empty, Tabs, Divider,
} from "antd";
import {
  ReloadOutlined, TeamOutlined, ShoppingCartOutlined, ShopOutlined,
  GiftOutlined, RiseOutlined, FallOutlined, UserOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, ClockCircleOutlined, TrophyOutlined, AimOutlined, BarChartOutlined,
  ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, FundOutlined,
  SettingOutlined, WarningOutlined, StarOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/config/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { LineChart } from "@mui/x-charts/LineChart";
import { BarChart as MuiBarChart } from "@mui/x-charts/BarChart";
import { PieChart as MuiPieChart } from "@mui/x-charts/PieChart";
import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import MuiTextField from "@mui/material/TextField";
import MuiMenuItem from "@mui/material/MenuItem";

const { MonthPicker } = DatePicker;

// ─── Palette — matches ProductList (dark plum + mint) ─────
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

// Inline style tokens
const FIELD_LABEL = { color: "#FFFFFF", fontWeight: 500 };
const GRADIENT_BTN = {
  background: "linear-gradient(135deg, #22D3A8, #16B48C)",
  border: "none",
  color: "#1F1A2E",
  fontWeight: 700,
  boxShadow: "none",
};
const SECONDARY_BTN = {
  background: PANEL_BG_2,
  border: `1px solid ${BORDER}`,
  color: TEXT,
  fontWeight: 500,
};
const GHOST_BTN = {
  background: "transparent",
  border: `1px solid ${ACCENT}40`,
  color: ACCENT,
  fontWeight: 500,
};

const RATING_COLORS = {
  Excellent: { color: "green", bg: GREEN_SOFT, border: "#22D3A8" },
  Good: { color: "gold", bg: AMBER_SOFT, border: "#F59E0B" },
  Average: { color: "orange", bg: AMBER_SOFT, border: "#F59E0B" },
  "Needs Improvement": { color: "volcano", bg: RED_SOFT, border: "#EF4444" },
  Poor: { color: "red", bg: RED_SOFT, border: "#EF4444" },
};

const CHART_COLORS = ["#22D3A8", "#16B48C", "#F59E0B", "#22c55e", "#14b8a6", "#8b5cf6", "#ec4899", "#3B82F6"];

// MUI X Charts dark styling — readable axis/legend/grid on plum cards
const CHART_SX = {
  "& .MuiChartsSurface": { color: "#FFFFFF" },
  "& .MuiChartsAxis-tickLabel": { fill: "#A5A0B5" },
  "& .MuiChartsAxis-label": { fill: "#FFFFFF" },
  "& .MuiChartsAxis-line": { stroke: "rgba(255,255,255,0.15)" },
  "& .MuiChartsAxis-tick": { stroke: "rgba(255,255,255,0.15)" },
  "& .MuiChartsGrid-line": { stroke: "rgba(255,255,255,0.08)" },
  "& .MuiChartsLegend-root text": { fill: "#FFFFFF", fontSize: 12 },
  "& .MuiChartsLegend-markLabel": { fill: "#FFFFFF" },
};

const shapes = ["circle", "square", "diamond", "cross", "star", "triangle", "wye"];
const marksMapping = {
  true: true,
  false: false,
  start: "start",
  end: "end",
  every2: ({ index }) => index % 2 === 0,
};
const marksOptions = Object.keys(marksMapping);

function StaffPerformance() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [branchId, setBranchId] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [targetModalVisible, setTargetModalVisible] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [targetForm] = Form.useForm();
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deletingTarget, setDeletingTarget] = useState(null);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [bulkForm] = Form.useForm();
  const [chartMarks, setChartMarks] = useState("true");
  const [chartShape, setChartShape] = useState("circle");

  // Branches
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get("/branches"),
  });
  const branches = branchesData?.data?.data || [];

  // Staff performance
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["staffPerformance", month, branchId],
    queryFn: () => {
      const params = new URLSearchParams();
      params.append("month", month);
      if (branchId && branchId !== "all") params.append("branch_id", branchId);
      return api.get(`/staff-performance?${params}`).then((r) => r.data);
    },
  });

  // Sales targets
  const { data: targetsData, isLoading: targetsLoading } = useQuery({
    queryKey: ["salesTargets", branchId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (branchId && branchId !== "all") params.append("branch_id", branchId);
      return api.get(`/sales-targets?${params}`).then((r) => r.data);
    },
  });

  // Staff list for target assignment
  const { data: staffData } = useQuery({
    queryKey: ["staffList"],
    queryFn: () => api.get("/staff").then((r) => r.data?.data || r.data || []),
  });
  const staffList = Array.isArray(staffData)
    ? staffData.filter((s) => s.role === "staff")
    : [];

  const targets = targetsData?.data || [];
  const staffDataList = data?.data || [];
  const meta = data?.meta || {};
  const branchAggregates = data?.branches || [];
  const monthlyTrend = data?.monthly_trend || [];

  // Mutations
  const saveTargetMutation = useMutation({
    mutationFn: (values) => {
      if (editingTarget) {
        return api.put(`/sales-targets/${editingTarget.id}`, values);
      }
      return api.post("/sales-targets", values);
    },
    onSuccess: (res) => {
      message.success(res.data?.message || "Target saved");
      setTargetModalVisible(false);
      setEditingTarget(null);
      targetForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["salesTargets"] });
      queryClient.invalidateQueries({ queryKey: ["staffPerformance"] });
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to save target");
    },
  });

  const deleteTargetMutation = useMutation({
    mutationFn: (id) => api.delete(`/sales-targets/${id}`),
    onSuccess: () => {
      message.success("Target deleted");
      setDeleteConfirmVisible(false);
      setDeletingTarget(null);
      queryClient.invalidateQueries({ queryKey: ["salesTargets"] });
      queryClient.invalidateQueries({ queryKey: ["staffPerformance"] });
    },
  });

  const bulkTargetMutation = useMutation({
    mutationFn: (values) => api.post("/sales-targets/bulk", values),
    onSuccess: (res) => {
      message.success(res.data?.message || "Targets set for all branches");
      setBulkModalVisible(false);
      bulkForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["salesTargets"] });
      queryClient.invalidateQueries({ queryKey: ["staffPerformance"] });
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to set bulk targets");
    },
  });

  const handleMonthChange = (date) => {
    if (date) setMonth(date.format("YYYY-MM"));
  };

  const openTargetModal = (target = null) => {
    setEditingTarget(target);
    if (target) {
      targetForm.setFieldsValue({
        branch_id: target.branch_id,
        target_products: target.target_products,
      });
    } else {
      targetForm.resetFields();
    }
    setTargetModalVisible(true);
  };

  const handleTargetSubmit = () => {
    targetForm.validateFields().then((values) => {
      const payload = {
        branch_id: values.branch_id,
        target_products: values.target_products,
        user_id: null,
      };
      saveTargetMutation.mutate(payload);
    });
  };

  // Chart data — daily products
  const productTargetChart = staffDataList.map((s) => ({
    name: s.full_name?.split(" ")[0] || "Staff",
    sold: s.quota.daily_products_sold ?? s.quota.total_products_sold,
    target: s.quota.daily_target ?? Math.ceil(s.quota.target_products / 30),
    soldMonthly: s.quota.total_products_sold,
    targetMonthly: s.quota.target_products,
  }));

  const attendancePieData = (() => {
    const onTime = staffDataList.reduce((sum, s) => sum + s.attendance.on_time_days, 0);
    const late = staffDataList.reduce((sum, s) => sum + s.attendance.late_days, 0);
    const totalDays = onTime + late;
    if (totalDays === 0) return [];
    return [
      { name: "On Time", value: onTime, color: "#22D3A8" },
      { name: "Late", value: late, color: "#F59E0B" },
    ];
  })();

  // Performance table columns
  const columns = [
    {
      title: "Rank",
      key: "rank",
      width: 60,
      align: "center",
      render: (_, __, i) => (
        <div className="flex items-center justify-center">
          {i === 0 ? <TrophyOutlined className="text-lg" style={{ color: AMBER }} /> :
           i === 1 ? <StarOutlined className="text-lg" style={{ color: MUTED }} /> :
           i === 2 ? <StarOutlined className="text-lg" style={{ color: FAINT }} /> :
           <span className="font-medium" style={{ color: MUTED }}>{i + 1}</span>}
        </div>
      ),
    },
    {
      title: "Staff",
      key: "staff",
      width: 200,
      render: (_, r) => (
        <div className="flex items-center gap-3">
          <Avatar size={36} icon={<UserOutlined />}
            style={{ backgroundColor: r.rating === "Excellent" ? GREEN : r.rating === "Good" ? AMBER : r.rating === "Average" ? ACCENT_DEEP : RED }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: TEXT }}>{r.full_name}</div>
            {r.branch && <div className="mt-0.5 flex items-center gap-1 text-xs" style={{ color: MUTED }}><ShopOutlined />{r.branch.name}</div>}
          </div>
        </div>
      ),
    },
    {
      title: "Attendance",
      key: "attendance",
      width: 200,
      render: (_, r) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium" style={{ color: ACCENT }}>{r.attendance.present_days}d present</span>
            {r.attendance.late_days > 0 && <span style={{ color: AMBER }}>{r.attendance.late_days} late</span>}
          </div>
          <Progress percent={Math.round(r.attendance.attendance_rate)} size="small"
            strokeColor={r.attendance.attendance_rate >= 90 ? ACCENT : r.attendance.attendance_rate >= 75 ? AMBER : RED}
            format={() => `${Math.round(r.attendance.attendance_rate)}%`} />
          <div className="text-xs" style={{ color: FAINT }}>{r.attendance.total_hours}h total</div>
        </div>
      ),
    },
    {
      title: "Daily Products vs Target",
      key: "products_target",
      width: 220,
      render: (_, r) => {
        const dailySold = r.quota.daily_products_sold ?? 0;
        const dailyTarget = r.quota.daily_target ?? 0;
        const pct = dailyTarget > 0 ? Math.min(100, Math.round((dailySold / dailyTarget) * 100)) : 0;
        const achieved = pct >= 100;
        return (
          <div>
            <div className="text-sm font-semibold" style={{ color: TEXT }}>
              {dailySold} / {dailyTarget} pcs
            </div>
            <Progress percent={pct} size="small" strokeColor={achieved ? ACCENT : AMBER} />
            <div className="mt-0.5 text-xs">
              {achieved
                ? <span className="font-medium" style={{ color: ACCENT }}>Target reached ({pct}%)</span>
                : <span style={{ color: MUTED }}>{pct}% achieved</span>}
            </div>
          </div>
        );
      },
    },
    {
      title: "Incentive",
      key: "incentive",
      width: 120,
      render: (_, r) => (
        <div className="text-center">
          <div className="text-sm font-bold" style={{ color: ACCENT }}>₱{r.quota.incentive_amount.toLocaleString()}</div>
          <div className="text-xs" style={{ color: FAINT }}>{r.quota.threshold_40_pcs} × 40pcs</div>
        </div>
      ),
    },
    {
      title: "Score",
      key: "score",
      width: 140,
      render: (_, r) => {
        const cfg = RATING_COLORS[r.rating] || RATING_COLORS.Poor;
        const scoreColor = cfg.color === "green" ? ACCENT : cfg.color === "gold" ? AMBER : cfg.color === "orange" ? ACCENT_DEEP : cfg.color === "volcano" ? "#F87171" : RED;
        return (
          <div className="text-center">
            <div className="mb-1 text-2xl font-bold" style={{ color: scoreColor }}>
              {r.performance_score}
            </div>
            <Tag color={cfg.color} className="rounded-full px-3 py-0.5 text-xs">{r.rating}</Tag>
          </div>
        );
      },
    },
    {
      title: "Trend",
      key: "trend",
      width: 100,
      render: (_, r) => (
        <div className="space-y-1">
          {[
            { label: "Sales", value: r.trend.sales },
            { label: "Products", value: r.trend.products },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1 text-xs">
              {value > 0 ? <ArrowUpOutlined style={{ color: ACCENT }} /> :
               value < 0 ? <ArrowDownOutlined style={{ color: RED }} /> :
               <MinusOutlined style={{ color: FAINT }} />}
              <span style={{ color: value > 0 ? ACCENT : value < 0 ? "#F87171" : FAINT }}>
                {Math.abs(value)}%
              </span>
              <span style={{ color: FAINT }}>{label}</span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  // Targets table columns
  const targetColumns = [
    {
      title: "Target For",
      key: "target_for",
      render: (_, r) => (
        <div>
          {r.user ? (
            <div className="flex items-center gap-2">
              <Avatar size={28} icon={<UserOutlined />} style={{ backgroundColor: ACCENT }} />
              <div>
                <div className="text-sm font-medium" style={{ color: TEXT }}>{r.user.firstname} {r.user.lastname}</div>
                {r.branch && <div className="text-xs" style={{ color: FAINT }}>{r.branch.name}</div>}
              </div>
            </div>
          ) : r.branch ? (
            <div className="flex items-center gap-2">
              <Avatar size={28} icon={<ShopOutlined />} style={{ backgroundColor: AMBER }} />
              <div className="text-sm font-medium" style={{ color: TEXT }}>{r.branch.name} (All Staff)</div>
            </div>
          ) : (
            <span style={{ color: FAINT }}>Unknown</span>
          )}
        </div>
      ),
    },
    {
      title: "Product Target",
      dataIndex: "target_products",
      key: "target_products",
      render: (v) => <span className="font-semibold">{v} pcs</span>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_, r) => (
        <Space>
          <Tooltip title="Edit">
            <Button type="text" icon={<EditOutlined />} onClick={() => openTargetModal(r)} style={{ color: ACCENT }} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button type="text" icon={<DeleteOutlined />} onClick={() => { setDeletingTarget(r); setDeleteConfirmVisible(true); }}
              style={{ color: RED }} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="nm-dark min-h-screen p-6" style={{ background: "#1F1A2E" }}>
      

      {/* Header — dark plum with mint accents */}
      <div
        className="mb-6 overflow-hidden rounded-2xl"
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
      >
        <div className="relative px-8 py-6">
          {/* Decorative circles */}
          <div className="absolute right-0 top-0 opacity-10">
            <div className="-mr-32 -mt-32 h-64 w-64 rounded-full" style={{ background: ACCENT }} />
          </div>
          <div className="absolute bottom-0 left-1/3 opacity-5">
            <div className="h-48 w-48 rounded-full" style={{ background: ACCENT }} />
          </div>

          {/* Accent line */}
          <div
            className="absolute left-0 right-0 top-0 h-1"
            style={{ background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_DEEP})` }}
          />

          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h1 className="mb-1 text-2xl font-bold" style={{ color: TEXT }}>
                <TrophyOutlined className="mr-2" style={{ color: ACCENT }} />
                Staff Monitoring
              </h1>
              <p className="text-sm" style={{ color: MUTED }}>
                Evaluate employee productivity based on sales targets, attendance, and branch performance
              </p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="relative z-10 mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl px-4 py-3" style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}>
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <TeamOutlined style={{ color: ACCENT }} /> Total Staff
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{meta.total_staff || 0}</p>
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}>
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <ShoppingCartOutlined style={{ color: ACCENT }} /> Total Sales
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: ACCENT }}>₱{Number(meta.total_sales || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}>
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <RiseOutlined style={{ color: ACCENT }} /> Today&apos;s Achievement
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{meta.daily_target_achievement_pct || 0}%</p>
              <p className="text-xs" style={{ color: FAINT }}>{meta.total_daily_products || 0} / {meta.total_daily_targets || 0} pcs today</p>
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}>
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <TrophyOutlined style={{ color: ACCENT }} /> Avg Performance
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{meta.avg_performance_score || 0}/100</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card
        className="mb-6"
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
        styles={{ body: { background: PANEL_BG } }}
      >
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="mb-1 text-xs font-semibold" style={FIELD_LABEL}>Month</div>
            <MonthPicker value={month ? dayjs(month, "YYYY-MM") : null} onChange={handleMonthChange}
              allowClear={false} format="MMMM YYYY" style={{ width: 160 }} className="rounded-xl" popupClassName="nm-dark-select-dropdown" />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold" style={FIELD_LABEL}>Branch</div>
            <Select value={branchId} onChange={setBranchId} style={{ width: 180 }} className="rounded-xl"
              popupClassName="nm-dark-select-dropdown"
              options={[{ value: "all", label: "All Branches" }, ...branches.map((b) => ({ value: String(b.id), label: b.name }))]} />
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading} style={GHOST_BTN}>
            Refresh
          </Button>
          <Button type="primary" icon={<SettingOutlined />}
            onClick={() => openTargetModal()} style={GRADIENT_BTN}>
            Manage Targets
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}
        className="mb-6"
        items={[
          {
            key: "overview",
            label: <span><BarChartOutlined /> Performance Overview</span>,
            children: (
              <>
                {/* Summary Stats */}
                <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                  {[
                    { title: "Total Sales", value: `₱${Number(meta.total_sales || 0).toLocaleString()}`, icon: <ShoppingCartOutlined />, color: ACCENT },
                    { title: "Today's Products Sold", value: `${meta.total_daily_products || 0} pcs`, icon: <GiftOutlined />, color: TEXT },
                    { title: "Avg Attendance", value: `${Math.round(meta.avg_attendance_rate || 0)}%`, icon: <CheckCircleOutlined />, color: TEXT },
                    { title: "Total Incentives", value: `₱${Number(meta.total_incentives || 0).toLocaleString()}`, icon: <TrophyOutlined />, color: ACCENT },
                  ].map(({ title, value, icon, color }) => (
                    <Card key={title} style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }} styles={{ body: { padding: 20, background: PANEL_BG } }}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: ACCENT_SOFT, color: ACCENT }}>
                          {icon}
                        </div>
                        <div>
                          <div className="text-xs" style={{ color: MUTED }}>{title}</div>
                          <div className="text-lg font-bold" style={{ color }}>{value}</div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Charts Row */}
                <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                  {/* Products vs Target Bar Chart */}
                  <Card className="lg:col-span-2" style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }} styles={{ body: { padding: 20, background: PANEL_BG } }}>
                    <h3 className="mb-4 font-semibold" style={{ color: TEXT }}>
                      <BarChartOutlined className="mr-2" style={{ color: ACCENT }} />Daily Products vs Target by Staff
                    </h3>
                    {productTargetChart.length > 0 ? (
                      <MuiBarChart
                        height={300}
                        sx={CHART_SX}
                        xAxis={[{ data: productTargetChart.map((d) => d.name) }]}
                        series={[
                          { data: productTargetChart.map((d) => d.sold), label: "Products Sold", color: ACCENT },
                          { data: productTargetChart.map((d) => d.target), label: "Target (pcs)", color: AMBER },
                        ]}
                      />
                    ) : (
                      <Empty description="No data" />
                    )}
                  </Card>

                  {/* Attendance Pie */}
                  <Card style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }} styles={{ body: { padding: 20, background: PANEL_BG } }}>
                    <h3 className="mb-4 font-semibold" style={{ color: TEXT }}>
                      <ClockCircleOutlined className="mr-2" style={{ color: ACCENT }} />Attendance Distribution
                    </h3>
                    {attendancePieData.length > 0 ? (
                      <MuiPieChart
                        height={200}
                        width={200}
                        sx={CHART_SX}
                        series={[
                          {
                            data: attendancePieData.map((d, i) => ({
                              id: i,
                              value: d.value,
                              label: d.name,
                              color: d.color,
                            })),
                            highlightScope: { fade: "global", highlight: "item" },
                            faded: { innerRadius: 30, additionalRadius: -30, color: "gray" },
                            valueFormatter: (v) => `${v.label}: ${v.value}`,
                          },
                        ]}
                      />
                    ) : (
                      <Empty description="No attendance data" />
                    )}
                  </Card>
                </div>

                {/* Monthly Trend */}
                {monthlyTrend.length > 0 && (
                  <Card className="mb-6" style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }} styles={{ body: { padding: 20, background: PANEL_BG } }}>
                    <h3 className="mb-4 font-semibold" style={{ color: TEXT }}>
                      <FundOutlined className="mr-2" style={{ color: ACCENT }} />6-Month Trend
                    </h3>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                      <Stack direction={{ xs: "row", md: "column" }} spacing={1}>
                        <MuiTextField
                          select
                          label="Marks"
                          value={chartMarks}
                          onChange={(e) => setChartMarks(e.target.value)}
                          size="small"
                          sx={{
                            minWidth: 150,
                            "& .MuiOutlinedInput-root": { color: TEXT, backgroundColor: PANEL_BG_2, "& fieldset": { borderColor: BORDER } },
                            "& .MuiInputLabel-root": { color: MUTED, "&.Mui-focused": { color: ACCENT } },
                            "& .MuiSvgIcon-root": { color: MUTED },
                          }}
                        >
                          {marksOptions.map((opt) => (
                            <MuiMenuItem key={opt} value={opt}>{opt}</MuiMenuItem>
                          ))}
                        </MuiTextField>
                        <MuiTextField
                          select
                          label="Shape"
                          value={chartShape}
                          onChange={(e) => setChartShape(e.target.value)}
                          size="small"
                          sx={{
                            minWidth: 150,
                            "& .MuiOutlinedInput-root": { color: TEXT, backgroundColor: PANEL_BG_2, "& fieldset": { borderColor: BORDER } },
                            "& .MuiInputLabel-root": { color: MUTED, "&.Mui-focused": { color: ACCENT } },
                            "& .MuiSvgIcon-root": { color: MUTED },
                          }}
                        >
                          {shapes.map((s) => (
                            <MuiMenuItem key={s} value={s}>{s}</MuiMenuItem>
                          ))}
                        </MuiTextField>
                      </Stack>
                      <Box sx={{ flexGrow: 1 }}>
                        <LineChart
                          height={300}
                          sx={CHART_SX}
                          dataset={monthlyTrend.map((d) => ({
                            month: d.label,
                            sales: Number(d.total_sales) || 0,
                            attendance: Number(d.attendance_rate) || 0,
                          }))}
                          series={[
                            {
                              dataKey: "sales",
                              label: "Total Sales",
                              curve: "natural",
                              showMark: marksMapping[chartMarks],
                              shape: chartShape,
                              yAxisId: "left",
                              color: ACCENT,
                            },
                            {
                              dataKey: "attendance",
                              label: "Attendance Rate (%)",
                              curve: "natural",
                              showMark: marksMapping[chartMarks],
                              shape: chartShape,
                              yAxisId: "right",
                              color: AMBER,
                            },
                          ]}
                          xAxis={[{ scaleType: "point", dataKey: "month" }]}
                          yAxis={[
                            { id: "left", valueFormatter: (v) => `₱${(v / 1000).toFixed(0)}k` },
                            { id: "right", position: "right", valueFormatter: (v) => `${v}%` },
                          ]}
                          grid={{ vertical: true, horizontal: true }}
                        />
                      </Box>
                    </Stack>
                  </Card>
                )}

                {/* Performance Table */}
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: TEXT }}>
                      <TeamOutlined className="mr-2" style={{ color: ACCENT }} />Staff Rankings
                    </h2>
                    <p className="mt-1 text-sm" style={{ color: MUTED }}>Detailed performance metrics for {dayjs(month, "YYYY-MM").format("MMMM YYYY")}</p>
                  </div>
                  <Tag className="rounded-full px-3 py-1 text-sm font-semibold" style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
                    {staffDataList.length} staff
                  </Tag>
                </div>

                <Card
                  style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
                  styles={{ body: { background: PANEL_BG } }}
                >
                  <Table columns={columns} dataSource={staffDataList} rowKey="id" loading={isLoading}
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `Total ${t} staff` }}
                    locale={{ emptyText: (
                      <div className="py-10 text-center">
                        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: ACCENT_SOFT, color: ACCENT }}>
                          <TeamOutlined className="text-3xl" />
                        </div>
                        <p className="font-semibold" style={{ color: TEXT }}>No performance data for this period</p>
                        <p className="text-sm" style={{ color: MUTED }}>Try adjusting the month or branch filter</p>
                      </div>
                    ) }} />
                </Card>
              </>
            ),
          },
          {
            key: "branches",
            label: <span><ShopOutlined /> Branch Comparison</span>,
            children: (
              <>
                <Card className="mb-6" style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }} styles={{ body: { padding: 20, background: PANEL_BG } }}>
                  <h3 className="mb-4 font-semibold" style={{ color: TEXT }}>
                    <ShopOutlined className="mr-2" style={{ color: ACCENT }} />Branch Performance Overview
                  </h3>
                  {branchAggregates.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={branchAggregates} layout="vertical" barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: MUTED }} tickLine={false} />
                        <YAxis type="category" dataKey="branch_name" tick={{ fontSize: 12, fill: MUTED }} width={120} tickLine={false} />
                        <ReTooltip contentStyle={{ background: PANEL_BG_2, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT }} labelStyle={{ color: TEXT }} />
                        <Legend wrapperStyle={{ color: MUTED }} />
                        <Bar dataKey="total_products" name="Products Sold" fill={ACCENT} radius={[0, 4, 4, 0]} />
                        <Bar dataKey="total_target_products" name="Target (pcs)" fill={AMBER} radius={[0, 4, 4, 0]} opacity={0.4} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="No branch data" />
                  )}
                </Card>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {branchAggregates.map((b) => (
                    <Card key={b.branch_id} style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }} styles={{ body: { padding: 20, background: PANEL_BG } }}>
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl font-bold" style={{ background: ACCENT_SOFT, color: ACCENT }}>
                          {b.branch_name?.charAt(0) || "B"}
                        </div>
                        <div>
                          <div className="font-semibold" style={{ color: TEXT }}>{b.branch_name}</div>
                          <div className="text-xs" style={{ color: FAINT }}>{b.staff_count} staff</div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="mb-1 flex justify-between text-xs" style={{ color: MUTED }}>
                            <span>Products vs Sales Target</span>
                            <span className="font-medium" style={{ color: TEXT }}>{b.total_products} / {b.total_target_products} pcs</span>
                          </div>
                          <Progress percent={Math.min(100, b.target_achievement_pct || 0)} size="small"
                            strokeColor={(b.target_achievement_pct || 0) >= 100 ? ACCENT : AMBER} />
                        </div>
                        <div className="flex justify-between text-xs" style={{ color: MUTED }}>
                          <span>Avg Attendance</span>
                          <span className="font-medium" style={{ color: TEXT }}>{b.avg_attendance_rate}%</span>
                        </div>
                        <div className="flex justify-between text-xs" style={{ color: MUTED }}>
                          <span>Avg Score</span>
                          <span className="font-bold" style={{ color: TEXT }}>{b.avg_score}/100</span>
                        </div>
                        <div className="flex justify-between text-xs" style={{ color: MUTED }}>
                          <span>Products Sold</span>
                          <span className="font-medium" style={{ color: TEXT }}>{b.total_products} pcs</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            ),
          },
          {
            key: "targets",
            label: <span><AimOutlined /> Sales Targets</span>,
            children: (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: TEXT }}>
                      <AimOutlined className="mr-2" style={{ color: ACCENT }} />Sales Targets
                    </h2>
                    <p className="mt-1 text-sm" style={{ color: MUTED }}>Set and manage sales targets per branches</p>
                  </div>
                  <Space>
                    <Button icon={<ShopOutlined />}
                      onClick={() => { bulkForm.resetFields(); setBulkModalVisible(true); }}
                      style={GHOST_BTN}>
                      Set All Branches
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => openTargetModal()}
                      style={GRADIENT_BTN}>
                      Add Target
                    </Button>
                  </Space>
                </div>
                <Card
                  style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
                  styles={{ body: { background: PANEL_BG } }}
                >
                  <Table columns={targetColumns} dataSource={targets} rowKey="id" loading={targetsLoading}
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: (
                      <div className="py-10 text-center">
                        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: ACCENT_SOFT, color: ACCENT }}>
                          <AimOutlined className="text-3xl" />
                        </div>
                        <p className="font-semibold" style={{ color: TEXT }}>No targets set yet. Click &quot;Add Target&quot; to create one.</p>
                      </div>
                    ) }} />
                </Card>
              </>
            ),
          },
        ]}
      />

      {/* Target Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg" style={{ background: ACCENT_SOFT, color: ACCENT }}>
              {editingTarget ? <EditOutlined /> : <PlusOutlined />}
            </div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>{editingTarget ? "Edit Sales Target" : "Add Sales Target"}</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>{editingTarget ? "Update the target for this branch" : "Create a new sales target"}</p>
            </div>
          </div>
        }
        open={targetModalVisible}
        onCancel={() => { setTargetModalVisible(false); setEditingTarget(null); targetForm.resetFields(); }}
        onOk={handleTargetSubmit}
        confirmLoading={saveTargetMutation.isPending}
        okText={editingTarget ? "Update" : "Create"}
        okButtonProps={{ style: GRADIENT_BTN }}
        cancelButtonProps={{ style: SECONDARY_BTN }}
        width={520}
      >
        <Form form={targetForm} layout="vertical" className="mt-4">
          <Form.Item label={<span className="text-sm font-semibold" style={FIELD_LABEL}>Branch</span>} name="branch_id" rules={[{ required: true, message: "Select a branch" }]}>
            <Select placeholder="Select branch" showSearch optionFilterProp="label"
              popupClassName="nm-dark-select-dropdown"
              options={branches.map((b) => ({ value: b.id, label: b.name }))} />
          </Form.Item>
          <Form.Item label={<span className="text-sm font-semibold" style={FIELD_LABEL}>Product Target (pcs)</span>} name="target_products" rules={[{ required: true, message: "Enter product target" }]}>
            <InputNumber style={{ width: "100%" }} min={1} step={10} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg" style={{ background: RED_SOFT, color: RED }}>
              <WarningOutlined />
            </div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>Delete Target</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>This action cannot be undone</p>
            </div>
          </div>
        }
        open={deleteConfirmVisible}
        onCancel={() => { setDeleteConfirmVisible(false); setDeletingTarget(null); }}
        onOk={() => deletingTarget && deleteTargetMutation.mutate(deletingTarget.id)}
        confirmLoading={deleteTargetMutation.isPending}
        okText="Delete"
        okButtonProps={{ danger: true, style: { background: "linear-gradient(135deg, #EF4444, #DC2626)", border: "none", color: "#FFFFFF", fontWeight: 600 } }}
        cancelButtonProps={{ style: SECONDARY_BTN }}
      >
        <p style={{ color: TEXT }}>Are you sure you want to delete this sales target?</p>
        {deletingTarget && (
          <p className="mt-2 text-sm" style={{ color: MUTED }}>
            {deletingTarget.user ? `${deletingTarget.user.firstname} ${deletingTarget.user.lastname}` : deletingTarget.branch?.name || "Unknown"}
          </p>
        )}
      </Modal>

      {/* Set All Branches Bulk Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg" style={{ background: ACCENT_SOFT, color: ACCENT }}>
              <ShopOutlined />
            </div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>Set Target for All Branches</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>Apply one target across all branches</p>
            </div>
          </div>
        }
        open={bulkModalVisible}
        onCancel={() => { setBulkModalVisible(false); bulkForm.resetFields(); }}
        onOk={() => {
          bulkForm.validateFields().then((values) => {
            const payload = { ...values };
            bulkTargetMutation.mutate(payload);
          });
        }}
        confirmLoading={bulkTargetMutation.isPending}
        okText="Apply to All Branches"
        okButtonProps={{ style: GRADIENT_BTN }}
        cancelButtonProps={{ style: SECONDARY_BTN }}
        width={520}
      >
        <div className="mb-4 mt-2 rounded-xl p-4" style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}30`, borderRadius: 12 }}>
          <p className="text-sm font-medium" style={{ color: ACCENT }}>
            <ShopOutlined className="mr-1" />This will create or update the sales target for every active branch.
          </p>
          <p className="mt-1 text-xs" style={{ color: MUTED }}>
            Branch-specific targets will be set. Individual staff targets are not affected.
          </p>
        </div>
        <Form form={bulkForm} layout="vertical">
          <Form.Item label={<span className="text-sm font-semibold" style={FIELD_LABEL}>Product Target (pcs)</span>} name="target_products" rules={[{ required: true, message: "Enter product target" }]}>
            <InputNumber style={{ width: "100%" }} min={1} step={10} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default StaffPerformance;