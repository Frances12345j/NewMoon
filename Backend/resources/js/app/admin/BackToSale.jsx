import { useState } from "react";
import {
  Card, Table, Tag, Row, Col, Statistic, Select, Button, Space, Modal, Form, Input, message, Tooltip, DatePicker,
} from "antd";
import {
  ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
  CheckOutlined, CloseOutlined, UserOutlined, ShoppingCartOutlined, ArrowLeftOutlined, SearchOutlined,
  RollbackOutlined,
} from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/config/api";
import { invalidateCache } from "@/utils/cache";
import { useServerPagination } from "@/components/Pagination";

const { TextArea } = Input;
const { RangePicker } = DatePicker;

// ─── Palette — matches MenuSidebar / Dashboard (dark plum + mint) ─────
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

function BackToSale() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [dateRange, setDateRange] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [rejectForm] = Form.useForm();
  const queryClient = useQueryClient();

  const {
    data: records,
    total,
    isLoading,
    pagination,
    setCurrentPage,
    refetch,
    raw: backToSaleData,
  } = useServerPagination({
    queryKey: ["backToSalesAll", statusFilter, searchText, dateRange],
    url: "/back-to-sales/all",
    params: {
      status: statusFilter === "all" ? undefined : statusFilter,
      search: searchText.trim() || undefined,
      start_date: dateRange?.[0] ? dateRange[0].format("YYYY-MM-DD") : undefined,
      end_date: dateRange?.[1] ? dateRange[1].format("YYYY-MM-DD") : undefined,
    },
    label: "records",
  });

  const stats = backToSaleData?.stats || {};

  const approveMutation = useMutation({
    mutationFn: ({ id }) => api.post(`/back-to-sales/${id}/approve`),
    onSuccess: () => {
      message.success("Return approved — unsold stock saved to inventory for tomorrow's sale");
      setShowApproveModal(false);
      setSelected(null);
      invalidateCache("products");
      queryClient.invalidateQueries({ queryKey: ["backToSalesAll"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => message.error(e.response?.data?.message || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, adminNotes }) =>
      api.post(`/back-to-sales/${id}/reject`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Return rejected — quantity stays out of available inventory");
      setShowRejectModal(false);
      rejectForm.resetFields();
      setSelected(null);
      invalidateCache("products");
      queryClient.invalidateQueries({ queryKey: ["backToSalesAll"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => message.error(e.response?.data?.message || "Failed to reject"),
  });

  const handleApprove = () => {
    approveMutation.mutate({ id: selected.id });
  };

  const handleReject = (values) => {
    rejectMutation.mutate({ id: selected.id, adminNotes: values.admin_notes || null });
  };

  const statusTag = (status) => {
    const m = {
      pending: { background: AMBER_SOFT, color: AMBER, icon: <ClockCircleOutlined />, text: "Pending" },
      approved: { background: GREEN_SOFT, color: ACCENT, icon: <CheckCircleOutlined />, text: "Approved" },
      rejected: { background: RED_SOFT, color: "#F87171", icon: <CloseCircleOutlined />, text: "Rejected" },
    };
    const c = m[status] || m.pending;
    return (
      <Tag
        className="rounded-full px-3 py-1"
        style={{ background: c.background, color: c.color, border: "none", fontWeight: 600 }}
        icon={c.icon}
      >
        {c.text}
      </Tag>
    );
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

  const columns = [
    {
      title: "Staff",
      key: "staff",
      width: 180,
      render: (_, r) => (
        <div>
          <div className="font-semibold" style={{ color: TEXT }}><UserOutlined className="mr-1" style={{ color: ACCENT }} />{r.user?.firstname} {r.user?.lastname}</div>
          <div className="text-xs" style={{ color: MUTED }}>ID: {r.user?.id}</div>
        </div>
      ),
    },
    {
      title: "Product",
      key: "product",
      width: 180,
      render: (_, r) => (
        <div>
          <div className="font-semibold" style={{ color: TEXT }}>{r.product?.name}</div>
          <div className="text-xs" style={{ color: MUTED }}>Branch: {r.branch?.name}</div>
        </div>
      ),
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      key: "quantity",
      width: 80,
      render: (v) => <span className="font-semibold text-lg" style={{ color: ACCENT }}>{v}</span>,
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      width: 200,
      render: (v) => v || <span style={{ color: MUTED }}>-</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v) => statusTag(v),
    },
    {
      title: "Returned At",
      dataIndex: "returned_at",
      key: "returned_at",
      width: 160,
      render: (v) => fmtDate(v),
    },
    {
      title: "Processed",
      key: "processed",
      width: 160,
      render: (_, r) => {
        if (r.status === "approved" && r.approved_at) return <span style={{ color: ACCENT }}>{fmtDate(r.approved_at)}</span>;
        if (r.status === "rejected" && r.rejected_at) return <span style={{ color: "#F87171" }}>{fmtDate(r.rejected_at)}</span>;
        return <span style={{ color: MUTED }}>-</span>;
      },
    },
    {
      title: "Admin Notes",
      dataIndex: "admin_notes",
      key: "admin_notes",
      width: 160,
      render: (v) => v || <span style={{ color: MUTED }}>-</span>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      render: (_, r) => (
        <Space>
          {r.status === "pending" && (
            <>
              <Tooltip title="Approve return">
                <Button size="small" icon={<CheckOutlined />}
                  onClick={() => { setSelected(r); setShowApproveModal(true); }}
                  style={{ background: ACCENT, border: "none", color: "#1F1A2E", fontWeight: 700, fontSize: 11, borderRadius: 9999 }}>
                  Approve
                </Button>
              </Tooltip>
              <Tooltip title="Reject">
                <Button size="small" danger icon={<CloseOutlined />}
                  onClick={() => { setSelected(r); setShowRejectModal(true); }}
                  style={{ fontSize: 11, borderRadius: 9999 }}>
                  Reject
                </Button>
              </Tooltip>
            </>
          )}
          {r.status !== "pending" && <span className="text-sm" style={{ color: MUTED }}>-</span>}
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
            <div
              className="-mr-32 -mt-32 h-64 w-64 rounded-full"
              style={{ background: ACCENT }}
            />
          </div>
          <div className="absolute bottom-0 left-1/3 opacity-5">
            <div className="h-48 w-48 rounded-full" style={{ background: ACCENT }} />
          </div>

          {/* Accent line */}
          <div
            className="absolute left-0 right-0 top-0 h-1"
            style={{ background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_DEEP})` }}
          />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="mb-1 text-2xl font-bold" style={{ color: TEXT }}>
                <RollbackOutlined className="mr-2" style={{ color: ACCENT }} />
                Back-to-Sales
              </h1>
              <p className="text-sm" style={{ color: MUTED }}>Manage unsold stock returned from branches</p>
            </div>
          </div>

          {/* KPI Chips */}
          <div className="relative z-10 mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <ShoppingCartOutlined style={{ color: ACCENT }} /> Total Returns
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{stats.total || 0}</p>
            </div>
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <ClockCircleOutlined style={{ color: ACCENT }} /> Pending
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{stats.pending || 0}</p>
            </div>
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <CheckCircleOutlined style={{ color: ACCENT }} /> Approved
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{stats.approved || 0}</p>
            </div>
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <ArrowLeftOutlined style={{ color: ACCENT }} /> Qty Returned
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>
                {stats.total_quantity || 0} <span className="text-sm font-normal" style={{ color: MUTED }}>pcs</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistic Cards */}
      <Row gutter={16} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" className="rounded-xl" style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }} styles={{ body: { background: PANEL_BG } }}>
            <Statistic title={<span style={{ color: MUTED }}>Total Returns</span>} value={stats.total || 0} prefix={<ShoppingCartOutlined />} styles={{ content: { color: ACCENT } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" className="rounded-xl" style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }} styles={{ body: { background: PANEL_BG } }}>
            <Statistic title={<span style={{ color: MUTED }}>Pending</span>} value={stats.pending || 0} styles={{ content: { color: AMBER } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" className="rounded-xl" style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }} styles={{ body: { background: PANEL_BG } }}>
            <Statistic title={<span style={{ color: MUTED }}>Approved</span>} value={stats.approved || 0} styles={{ content: { color: ACCENT } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" className="rounded-xl" style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }} styles={{ body: { background: PANEL_BG } }}>
            <Statistic title={<span style={{ color: MUTED }}>Qty Returned</span>} value={stats.total_quantity || 0} suffix="pcs" styles={{ content: { color: ACCENT } }} />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card
        className="mb-6"
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
        styles={{ body: { background: PANEL_BG } }}
      >
        <Space wrap>
          <span className="text-sm font-semibold" style={{ color: MUTED }}>Status:</span>
          <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }} style={{ width: 130 }} className="rounded-xl" popupClassName="nm-dark-select-dropdown">
            <Select.Option value="all">All</Select.Option>
            <Select.Option value="pending">Pending</Select.Option>
            <Select.Option value="approved">Approved</Select.Option>
            <Select.Option value="rejected">Rejected</Select.Option>
          </Select>
          <Input
            placeholder="Search product or staff..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
            style={{ width: 220 }}
            allowClear
            className="rounded-xl"
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates)}
            style={{ width: 250 }}
            className="rounded-xl"
            popupClassName="nm-dark-select-dropdown"
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
            style={GHOST_BTN}
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Section Header */}
      <div className="mb-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-lg"
              style={{ background: ACCENT_SOFT, color: ACCENT }}
            >
              <RollbackOutlined />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: TEXT }}>Return Requests</h2>
              <p className="text-sm" style={{ color: MUTED }}>Review and process returned stock</p>
            </div>
          </div>
          <Tag
            className="rounded-full px-3 py-1 text-sm font-semibold"
            style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}
          >
            {total || records.length} record(s)
          </Tag>
        </div>
      </div>

      {/* Table */}
      <Card style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }} styles={{ body: { background: PANEL_BG } }}>
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={isLoading}
          pagination={pagination}
          locale={{
            emptyText: (
              <div className="py-10 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: ACCENT_SOFT, color: ACCENT }}>
                  <RollbackOutlined className="text-3xl" />
                </div>
                <p className="font-semibold" style={{ color: TEXT }}>No back-to-sales records found</p>
                <p className="text-sm" style={{ color: MUTED }}>Try adjusting your search or filters</p>
              </div>
            ),
          }}
        />
      </Card>

      {/* Approve Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-lg"
              style={{ background: ACCENT_SOFT, color: ACCENT }}
            >
              <CheckCircleOutlined />
            </div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>Approve Return</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>Confirm the return request</p>
            </div>
          </div>
        }
        open={showApproveModal}
        onCancel={() => { setShowApproveModal(false); setSelected(null); }}
        onOk={handleApprove}
        confirmLoading={approveMutation.isPending}
        okText="Approve"
        okButtonProps={{ icon: <CheckOutlined />, className: "rounded-xl", style: GRADIENT_BTN }}
        className="rounded-2xl"
      >
        {selected && (
          <div className="space-y-3">
            {/* Product/Staff summary */}
            <div className="rounded-xl p-4" style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}30` }}>
              <div className="font-semibold" style={{ color: TEXT }}>{selected.user?.firstname} {selected.user?.lastname}</div>
              <div className="mt-1 text-lg font-bold" style={{ color: ACCENT }}>{selected.product?.name}</div>
              <div className="mt-2 flex gap-4 text-sm">
                <span style={{ color: MUTED }}>Quantity: <strong>{selected.quantity}</strong></span>
                <span style={{ color: MUTED }}>Branch: <strong>{selected.branch?.name}</strong></span>
              </div>
              {selected.notes && <div className="mt-2 text-sm" style={{ color: MUTED }}>Notes: {selected.notes}</div>}
            </div>

            {/* Inventory restore info panel */}
            <div className="flex gap-3 rounded-xl p-4" style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}30` }}>
              <div className="mt-0.5 text-xl" style={{ color: ACCENT }}>✓</div>
              <div>
                <div className="text-sm font-bold" style={{ color: TEXT }}>Stock will be saved to inventory for tomorrow's sale</div>
                <div className="mt-1 text-sm" style={{ color: ACCENT }}>
                  Approving this return will save <strong>{selected.quantity} unit(s)</strong> of{" "}
                  <strong>{selected.product?.name}</strong> into{" "}
                  <strong>{selected.branch?.name}</strong>'s inventory with a fresh stock batch,
                  so the unsold products can be sold again tomorrow in the POS and viewed in Inventory.
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-lg"
              style={{ background: RED_SOFT, color: "#F87171" }}
            >
              <CloseCircleOutlined />
            </div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>Reject Return</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>Provide a reason for rejection</p>
            </div>
          </div>
        }
        open={showRejectModal}
        onCancel={() => { setShowRejectModal(false); rejectForm.resetFields(); setSelected(null); }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        {selected && (
          <div className="mb-4 rounded-xl p-4" style={{ background: RED_SOFT, border: `1px solid ${RED}40` }}>
            <div className="font-semibold" style={{ color: TEXT }}>{selected.user?.firstname} {selected.user?.lastname}</div>
            <div className="mt-1 text-lg font-bold" style={{ color: "#F87171" }}>{selected.product?.name}</div>
            <div className="mt-2 flex gap-4 text-sm">
              <span style={{ color: MUTED }}>Quantity: <strong>{selected.quantity}</strong></span>
              <span style={{ color: MUTED }}>Branch: <strong>{selected.branch?.name}</strong></span>
            </div>
            {selected.notes && <div className="mt-2 text-sm" style={{ color: MUTED }}>Notes: {selected.notes}</div>}
          </div>
        )}
        <Form form={rejectForm} layout="vertical" onFinish={handleReject} initialValues={{ admin_notes: "" }}>
          <Form.Item label={<span style={FIELD_LABEL}>Rejection Reason (Optional)</span>} name="admin_notes" rules={[{ max: 500, message: "Reason cannot exceed 500 characters" }]}>
            <TextArea rows={4} placeholder="Provide a reason for rejection" maxLength={500} showCount disabled={rejectMutation.isPending} className="rounded-xl" />
          </Form.Item>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => { setShowRejectModal(false); rejectForm.resetFields(); setSelected(null); }} disabled={rejectMutation.isPending} className="rounded-xl" style={SECONDARY_BTN}>Cancel</Button>
              <Button danger htmlType="submit" loading={rejectMutation.isPending} icon={<CloseOutlined />} className="rounded-xl">Reject</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BackToSale;