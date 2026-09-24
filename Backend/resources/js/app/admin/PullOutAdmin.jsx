import { useState } from "react";
import { Card, Table, Button, Modal, Form, Input, message, Tag, Space, Select, Tooltip } from "antd";
import { 
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  InboxOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from "@/config/api";
import { useServerPagination } from "@/components/Pagination";

const { TextArea } = Input;

// ─── Palette — matches Sidebar / Dashboard (dark plum + mint) ─────
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

function PullOutAdmin() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedPullOut, setSelectedPullOut] = useState(null);
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const queryClient = useQueryClient();

  // All stock-outs with server-side pagination + status filter (via shared hook)
  const {
    data: pullOuts,
    total,
    isLoading: pullOutsLoading,
    pagination,
    setCurrentPage,
    refetch: refetchPullOuts,
    raw: pullOutsData,
  } = useServerPagination({
    queryKey: ["pullOutsAll", statusFilter],
    url: "/pull-outs/getall",
    params: { status: statusFilter === "all" ? undefined : statusFilter },
    label: "stock-outs",
  });

  const stats = pullOutsData?.stats || {};

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => 
      api.post(`/pull-outs/${id}/approve`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Stock out approved successfully");
      setShowApproveModal(false);
      approveForm.resetFields();
      setSelectedPullOut(null);
      queryClient.invalidateQueries({ queryKey: ['pullOutsAll'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to approve Pull-Out");
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => 
      api.post(`/pull-outs/${id}/reject`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Stock out rejected successfully");
      setShowRejectModal(false);
      rejectForm.resetFields();
      setSelectedPullOut(null);
      queryClient.invalidateQueries({ queryKey: ['pullOutsAll'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to reject Pull-Out");
    },
  });

  const handleApprove = (values) => {
    approveMutation.mutate({
      id: selectedPullOut.id,
      adminNotes: values.admin_notes || null,
    });
  };

  const handleReject = (values) => {
    rejectMutation.mutate({
      id: selectedPullOut.id,
      adminNotes: values.admin_notes || null,
    });
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      pending: { background: AMBER_SOFT, color: AMBER, icon: <ClockCircleOutlined />, text: "Pending" },
      approved: { background: GREEN_SOFT, color: ACCENT, icon: <CheckCircleOutlined />, text: "Approved" },
      rejected: { background: RED_SOFT, color: "#F87171", icon: <CloseCircleOutlined />, text: "Rejected" },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Tag
        className="rounded-full px-3 py-1"
        style={{ background: config.background, color: config.color, border: "none", fontWeight: 600 }}
        icon={config.icon}
      >
        {config.text}
      </Tag>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const columns = [
    {
      title: "Staff",
      key: "staff",
      render: (_, record) => (
        <div>
          <div className="font-semibold" style={{ color: TEXT }}>
            {record.user?.firstname} {record.user?.lastname}
          </div>
          <div className="text-xs" style={{ color: MUTED }}>ID: {record.user?.id}</div>
        </div>
      ),
    },
    {
      title: "Product",
      key: "product",
      render: (_, record) => (
        <div>
          <div className="font-semibold" style={{ color: TEXT }}>{record.product?.name}</div>
          <div className="text-xs" style={{ color: MUTED }}>SKU: {record.product?.sku}</div>
        </div>
      ),
    },
    {
      title: "Branch",
      key: "branch",
      render: (_, record) => (
        <div className="font-semibold" style={{ color: TEXT }}>{record.branch?.name}</div>
      ),
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      render: (quantity) => (
        <span className="font-semibold" style={{ color: TEXT }}>{quantity}</span>
      ),
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      render: (notes) => notes || <span style={{ color: MUTED }}>-</span>,
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      render: (reason) => reason ? <Tag style={{ background: ACCENT_SOFT, color: ACCENT, border: "none" }}>{reason}</Tag> : <span style={{ color: MUTED }}>-</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => getStatusTag(status),
    },
    {
      title: "Requested At",
      dataIndex: "pulled_out_at",
      key: "pulled_out_at",
      render: (date) => formatDate(date),
    },
    {
      title: "Processed At",
      key: "processed_date",
      render: (_, record) => {
        if (record.status === "approved" && record.approved_at) {
          return <span style={{ color: ACCENT }}>{formatDate(record.approved_at)}</span>;
        }
        if (record.status === "rejected" && record.rejected_at) {
          return <span style={{ color: "#F87171" }}>{formatDate(record.rejected_at)}</span>;
        }
        return <span style={{ color: MUTED }}>-</span>;
      },
    },
    {
      title: "Admin Notes",
      dataIndex: "admin_notes",
      key: "admin_notes",
      render: (notes) => notes || <span style={{ color: MUTED }}>-</span>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          {record.status === "pending" && (
            <>
              <Tooltip title="Approve">
                <Button
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => {
                    setSelectedPullOut(record);
                    setShowApproveModal(true);
                  }}
                  style={{ background: ACCENT, border: "none", color: "#1F1A2E", fontWeight: 700, fontSize: 11, borderRadius: 9999 }}
                >
                  Approve
                </Button>
              </Tooltip>
              <Tooltip title="Reject">
                <Button
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => {
                    setSelectedPullOut(record);
                    setShowRejectModal(true);
                  }}
                  style={{ fontSize: 11, borderRadius: 9999 }}
                >
                  Reject
                </Button>
              </Tooltip>
            </>
          )}
          {record.status !== "pending" && (
            <span className="text-sm" style={{ color: MUTED }}>No actions</span>
          )}
        </Space>
      ),
    },
  ];

  // Statistics from server (unpaginated, full dataset)

  const handleRefresh = () => {
    refetchPullOuts();
  };

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

          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h1 className="mb-1 text-2xl font-bold" style={{ color: TEXT }}>
                <InboxOutlined className="mr-2" style={{ color: ACCENT }} />
                Pull Out Management
              </h1>
              <p className="text-sm" style={{ color: MUTED }}>
                Approve or reject product stock-out requests
              </p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="relative z-10 mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <InboxOutlined style={{ color: ACCENT }} /> Total Stock Outs
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
                <InboxOutlined style={{ color: ACCENT }} /> Total Quantity
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{stats.total_quantity || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter / Action Toolbar */}
      <Card
        className="mb-6"
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
        styles={{ body: { background: PANEL_BG } }}
      >
        <Space wrap>
          <span className="text-sm font-semibold" style={{ color: MUTED }}>Filter by status:</span>
          <Select
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
            style={{ width: 150 }}
            className="rounded-xl"
            popupClassName="nm-dark-select-dropdown"
          >
            <Select.Option value="all">All</Select.Option>
            <Select.Option value="pending">Pending</Select.Option>
            <Select.Option value="approved">Approved</Select.Option>
            <Select.Option value="rejected">Rejected</Select.Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={pullOutsLoading}
            style={GHOST_BTN}
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Requests Section */}
      <div className="mb-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: TEXT }}>
              <InboxOutlined className="mr-2" style={{ color: ACCENT }} />
              All Stock Outs
            </h2>
            <p className="mt-1 text-sm" style={{ color: MUTED }}>
              Review and process staff stock-out requests
            </p>
          </div>
          <Tag
            className="rounded-full px-3 py-1 text-sm font-semibold"
            style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}
          >
            {total || pullOuts.length} stock-out(s)
          </Tag>
        </div>
      </div>

      <Card
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
        styles={{ body: { background: PANEL_BG } }}
      >
        <Table
          columns={columns}
          dataSource={pullOuts}
          rowKey="id"
          loading={pullOutsLoading}
          pagination={pagination}
          locale={{
            emptyText: (
              <div className="py-10 text-center">
                <div
                  className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: ACCENT_SOFT, color: ACCENT }}
                >
                  <InboxOutlined className="text-3xl" />
                </div>
                <p className="font-semibold" style={{ color: TEXT }}>No stock-outs found</p>
                <p className="text-sm" style={{ color: MUTED }}>Try adjusting your filter</p>
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
              <CheckOutlined />
            </div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>Approve Pull-Out</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>Confirm the pull-out request</p>
            </div>
          </div>
        }
        open={showApproveModal}
        onCancel={() => {
          setShowApproveModal(false);
          approveForm.resetFields();
          setSelectedPullOut(null);
        }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        {selectedPullOut && (
          <div
            className="mb-4 rounded-xl p-4"
            style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}30` }}
          >
            <div className="font-semibold" style={{ color: TEXT }}>
              {selectedPullOut.user?.firstname} {selectedPullOut.user?.lastname}
            </div>
            <div className="text-lg font-bold" style={{ color: ACCENT }}>
              {selectedPullOut.product?.name}
            </div>
            <div className="text-sm" style={{ color: MUTED }}>
              Quantity: {selectedPullOut.quantity}
            </div>
            <div className="text-sm" style={{ color: MUTED }}>
              Branch: {selectedPullOut.branch?.name}
            </div>
            {selectedPullOut.reason && (
              <div className="text-sm" style={{ color: MUTED }}>
                Reason: {selectedPullOut.reason}
              </div>
            )}
            {selectedPullOut.notes && (
              <div className="mt-1 text-sm" style={{ color: MUTED }}>
                Notes: {selectedPullOut.notes}
              </div>
            )}
          </div>
        )}
        <Form
          form={approveForm}
          layout="vertical"
          onFinish={handleApprove}
          initialValues={{ admin_notes: "" }}
        >
          <Form.Item
            label={<span style={FIELD_LABEL}>Admin Notes (Optional)</span>}
            name="admin_notes"
            rules={[
              { max: 500, message: "Notes cannot exceed 500 characters" },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="Add any notes for this approval"
              maxLength={500}
              showCount
              disabled={approveMutation.isPending}
              className="rounded-xl"
            />
          </Form.Item>
          <div
            className="mb-4 rounded-xl p-3"
            style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}30` }}
          >
            <p className="mb-0 text-xs" style={{ color: ACCENT }}>
              <InfoCircleOutlined className="mr-1" />
              This action will approve the stock-out request and notify the staff member.
            </p>
          </div>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => {
                  setShowApproveModal(false);
                  approveForm.resetFields();
                  setSelectedPullOut(null);
                }}
                disabled={approveMutation.isPending}
                className="rounded-xl"
                style={SECONDARY_BTN}
              >
                Cancel
              </Button>
              <Button
                htmlType="submit"
                loading={approveMutation.isPending}
                icon={<CheckOutlined />}
                className="rounded-xl"
                style={GRADIENT_BTN}
              >
                Approve Pull-Out
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-lg"
              style={{ background: RED_SOFT, color: "#F87171" }}
            >
              <CloseOutlined />
            </div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>Reject Pull-Out</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>Decline the pull-out request</p>
            </div>
          </div>
        }
        open={showRejectModal}
        onCancel={() => {
          setShowRejectModal(false);
          rejectForm.resetFields();
          setSelectedPullOut(null);
        }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        {selectedPullOut && (
          <div
            className="mb-4 rounded-xl p-4"
            style={{ background: RED_SOFT, border: `1px solid ${RED}40` }}
          >
            <div className="font-semibold" style={{ color: TEXT }}>
              {selectedPullOut.user?.firstname} {selectedPullOut.user?.lastname}
            </div>
            <div className="text-lg font-bold" style={{ color: "#F87171" }}>
              {selectedPullOut.product?.name}
            </div>
            <div className="text-sm" style={{ color: MUTED }}>
              Quantity: {selectedPullOut.quantity}
            </div>
            <div className="text-sm" style={{ color: MUTED }}>
              Branch: {selectedPullOut.branch?.name}
            </div>
            {selectedPullOut.reason && (
              <div className="text-sm" style={{ color: MUTED }}>
                Reason: {selectedPullOut.reason}
              </div>
            )}
            {selectedPullOut.notes && (
              <div className="mt-1 text-sm" style={{ color: MUTED }}>
                Notes: {selectedPullOut.notes}
              </div>
            )}
          </div>
        )}
        <Form
          form={rejectForm}
          layout="vertical"
          onFinish={handleReject}
          initialValues={{ admin_notes: "" }}
        >
          <Form.Item
            label={<span style={FIELD_LABEL}>Rejection Reason (Optional)</span>}
            name="admin_notes"
            rules={[
              { max: 500, message: "Reason cannot exceed 500 characters" },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="Provide a reason for rejection"
              maxLength={500}
              showCount
              disabled={rejectMutation.isPending}
              className="rounded-xl"
            />
          </Form.Item>
          <div
            className="mb-4 rounded-xl p-3"
            style={{ background: RED_SOFT, border: `1px solid ${RED}40` }}
          >
            <p className="mb-0 text-xs" style={{ color: "#F87171" }}>
              <InfoCircleOutlined className="mr-1" />
              This action will reject the stock-out request and notify the staff member.
            </p>
          </div>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => {
                  setShowRejectModal(false);
                  rejectForm.resetFields();
                  setSelectedPullOut(null);
                }}
                disabled={rejectMutation.isPending}
                className="rounded-xl"
                style={SECONDARY_BTN}
              >
                Cancel
              </Button>
              <Button
                danger
                htmlType="submit"
                loading={rejectMutation.isPending}
                icon={<CloseOutlined />}
                className="rounded-xl"
              >
                Reject Pull-Out
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default PullOutAdmin;