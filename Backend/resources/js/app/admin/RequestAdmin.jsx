import { useState } from "react";
import { Card, Table, Button, Modal, Form, Input, message, Tag, Space, Select, Tooltip } from "antd";
import { 
  DollarOutlined, 
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  InboxOutlined
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from "@/config/api";
import { clientPagination, serverPagination } from "@/components/Pagination";

const { TextArea } = Input;

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


function RequestAdmin() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch all cash advances
  const { data: advancesData, isLoading: advancesLoading, refetch: refetchAdvances } = useQuery({
    queryKey: ['cashAdvancesAll'],
    queryFn: () => api.get("/cash-advances/all"),
  });

  // Fetch all stock requests
  const { data: stockRequestsData, isLoading: stockRequestsLoading, refetch: refetchStockRequests } = useQuery({
    queryKey: ['stockRequestsAll'],
    queryFn: () => api.get("/supply-requests/all"),
  });

  const advances = advancesData?.data?.data || [];
  const stockRequests = stockRequestsData?.data?.data || [];
  const isLoading = advancesLoading || stockRequestsLoading;

  // Combine both request types into a single array
  const allRequests = [
    ...advances.map(a => ({ ...a, request_type: 'cash_advance' })),
    ...stockRequests.map(s => ({ ...s, request_type: 'stock' }))
  ].sort((a, b) => new Date(b.requested_at) - new Date(a.requested_at));

  // Filter requests based on status
  const filteredRequests = statusFilter === "all" 
    ? allRequests
    : allRequests.filter((a) => a.status === statusFilter);

  // Approve mutation for cash advances
  const approveAdvanceMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => 
      api.post(`/cash-advances/${id}/approve`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Cash advance request approved successfully");
      setShowApproveModal(false);
      approveForm.resetFields();
      setSelectedRequest(null);
      queryClient.invalidateQueries({ queryKey: ['cashAdvancesAll'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to approve request");
    },
  });

  // Reject mutation for cash advances
  const rejectAdvanceMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => 
      api.post(`/cash-advances/${id}/reject`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Cash advance request rejected successfully");
      setShowRejectModal(false);
      rejectForm.resetFields();
      setSelectedRequest(null);
      queryClient.invalidateQueries({ queryKey: ['cashAdvancesAll'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to reject request");
    },
  });

  // Approve mutation for stock requests
  const approveStockMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => 
      api.post(`/supply-requests/${id}/approve`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Stock request approved successfully");
      setShowApproveModal(false);
      approveForm.resetFields();
      setSelectedRequest(null);
      queryClient.invalidateQueries({ queryKey: ['stockRequestsAll'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to approve request");
    },
  });

  // Reject mutation for stock requests
  const rejectStockMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => 
      api.post(`/supply-requests/${id}/reject`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Stock request rejected successfully");
      setShowRejectModal(false);
      rejectForm.resetFields();
      setSelectedRequest(null);
      queryClient.invalidateQueries({ queryKey: ['stockRequestsAll'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to reject request");
    },
  });

  const handleApprove = (values) => {
    if (selectedRequest.request_type === "cash_advance") {
      approveAdvanceMutation.mutate({
        id: selectedRequest.id,
        adminNotes: values.admin_notes || null,
      });
    } else {
      approveStockMutation.mutate({
        id: selectedRequest.id,
        adminNotes: values.admin_notes || null,
      });
    }
  };

  const handleReject = (values) => {
    if (selectedRequest.request_type === "cash_advance") {
      rejectAdvanceMutation.mutate({
        id: selectedRequest.id,
        adminNotes: values.admin_notes || null,
      });
    } else {
      rejectStockMutation.mutate({
        id: selectedRequest.id,
        adminNotes: values.admin_notes || null,
      });
    }
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      pending: { color: AMBER, icon: <ClockCircleOutlined />, text: "Pending" },
      approved: { color: ACCENT, icon: <CheckCircleOutlined />, text: "Approved" },
      rejected: { color: RED, icon: <CloseCircleOutlined />, text: "Rejected" },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <Tag color={config.color} icon={config.icon}>
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

  const formatCurrency = (amount) => {
    return `₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getRequestTypeTag = (type) => {
    const config = {
      cash_advance: { color: AMBER, icon:<span style={{ fontSize: "14px",gap: '4', display: "inline-block" }}>₱</span>, text: "Cash Advance" },
      stock: { color: ACCENT, icon: <InboxOutlined />, text: "Supply Request" },
    };
    const typeConfig = config[type] || config.cash_advance;
    return (
      <Tag color={typeConfig.color} icon={typeConfig.icon}>
        {typeConfig.text}
      </Tag>
    );
  };

  // Unified columns for both request types
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
      title: "Type",
      key: "request_type",
      render: (_, record) => getRequestTypeTag(record.request_type),
    },
    {
      title: "Details",
      key: "details",
      render: (_, record) => {
        if (record.request_type === "cash_advance") {
          return <span className="font-bold" style={{ color: ACCENT }}>{formatCurrency(record.amount)}</span>;
        } else {
          return (
            <div>
              <div className="font-semibold" style={{ color: TEXT }}>{record.product?.name}</div>
              <div className="text-xs" style={{ color: MUTED }}>Qty: {record.quantity}</div>
              <div className="text-xs" style={{ color: MUTED }}>{record.branch?.name}</div>
            </div>
          );
        }
      },
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      render: (reason) => reason || <span style={{ color: FAINT }}>-</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => getStatusTag(status),
    },
    {
      title: "Requested At",
      dataIndex: "requested_at",
      key: "requested_at",
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
        return <span style={{ color: FAINT }}>-</span>;
      },
    },
    {
      title: "Admin Notes",
      dataIndex: "admin_notes",
      key: "admin_notes",
      render: (notes) => notes || <span style={{ color: FAINT }}>-</span>,
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
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => {
                    setSelectedRequest(record);
                    setShowApproveModal(true);
                  }}
                  style={GRADIENT_BTN}
                  className="rounded-xl hover:brightness-110 shadow-none"
                >
                  Approve
                </Button>
              </Tooltip>
              <Tooltip title="Reject">
                <Button
                  danger
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => {
                    setSelectedRequest(record);
                    setShowRejectModal(true);
                  }}
                  style={{ background: "linear-gradient(135deg, #EF4444, #DC2626)", border: "none", color: "#FFFFFF", fontWeight: 600 }}
                  className="rounded-xl hover:brightness-110 shadow-none"
                >
                  Reject
                </Button>
              </Tooltip>
            </>
          )}
          {record.status !== "pending" && (
            <span style={{ color: FAINT }}>No actions</span>
          )}
        </Space>
      ),
    },
  ];

  // Combined statistics
  const statistics = {
    total: allRequests.length,
    pending: allRequests.filter((a) => a.status === "pending").length,
    approved: allRequests.filter((a) => a.status === "approved").length,
    rejected: allRequests.filter((a) => a.status === "rejected").length,
    cashAdvanceTotal: advances
      .filter((a) => a.status === "approved")
      .reduce((sum, a) => sum + Number(a.amount), 0),
    stockTotal: stockRequests
      .filter((a) => a.status === "approved")
      .reduce((sum, a) => sum + Number(a.quantity), 0),
  };

  const handleRefresh = () => {
    refetchAdvances();
    refetchStockRequests();
  };

  return (
    <div className="nm-dark min-h-screen p-6" style={{ background: "#1F1A2E" }}>
      

      {/* Header - NewMoon Roasted Style */}
      <div className="mb-6 rounded-2xl overflow-hidden shadow-[0_12px_35px_rgba(0,0,0,0.45)]" style={{ background: `linear-gradient(135deg, ${PANEL_BG}, ${PANEL_BG_2})`, border: `1px solid ${BORDER}` }}>
        <div className="px-8 py-6 relative">
          {/* Decorative circles */}
          <div className="absolute right-0 top-0 opacity-10">
            <div className="w-64 h-64 rounded-full" style={{ background: ACCENT }} />
          </div>
          <div className="absolute bottom-0 left-1/3 opacity-5">
            <div className="w-48 h-48 rounded-full" style={{ background: ACCENT }} />
          </div>

          {/* Accent line */}
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_DEEP})` }} />

          <div className="flex items-center justify-between relative z-10">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                <InboxOutlined className="mr-2" style={{ color: ACCENT }} />
                Request Management
              </h1>
              <p style={{ color: MUTED }} className="text-sm">Approve or reject staff requests</p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 relative z-10">
            <div className="rounded-2xl px-4 py-3" style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}>
              <p style={{ color: MUTED }} className="text-xs">Total Requests</p>
              <p className="font-bold text-xl mt-1 text-white">{statistics.total}</p>
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}>
              <p style={{ color: MUTED }} className="text-xs">Pending</p>
              <p className="font-bold text-xl mt-1" style={{ color: AMBER }}>{statistics.pending}</p>
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}>
              <p style={{ color: MUTED }} className="text-xs">Approved</p>
              <p className="font-bold text-xl mt-1" style={{ color: ACCENT }}>{statistics.approved}</p>
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}>
              <p style={{ color: MUTED }} className="text-xs">Cash Advance Total</p>
              <p className="font-bold text-xl mt-1" style={{ color: ACCENT }}>{formatCurrency(statistics.cashAdvanceTotal)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar - NewMoon Style */}
      <Card
        className="mb-6 rounded-xl shadow-sm"
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
        styles={{ body: { background: PANEL_BG } }}
      >
        <Space wrap>
          <span style={FIELD_LABEL} className="text-sm">Filter by status:</span>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
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
            loading={isLoading}
            style={GHOST_BTN}
            className="rounded-xl"
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Requests Table - NewMoon Style */}
      <Card
        className="rounded-xl shadow-sm"
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
        styles={{ body: { background: PANEL_BG }, header: { background: PANEL_BG, borderBottom: `1px solid ${BORDER}` } }}
        title={<span style={{ color: TEXT }} className="font-semibold"><InboxOutlined className="mr-2" style={{ color: ACCENT }} />All Requests</span>}
        extra={
          <Tag
            className="text-sm px-3 py-1 rounded-full border-none"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`, color: "#1F1A2E", fontWeight: 700 }}
          >
            {filteredRequests.length} request(s)
          </Tag>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredRequests}
          rowKey="id"
          loading={isLoading}
          pagination={clientPagination({ label: "requests" })}
          locale={{
            emptyText: (
              <div className="py-10 text-center">
                <div
                  className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}33` }}
                >
                  <DollarOutlined className="text-3xl" style={{ color: ACCENT }} />
                </div>
                <p className="font-semibold" style={{ color: TEXT }}>No requests found</p>
                <p style={{ color: MUTED }} className="text-sm">Try adjusting your filter</p>
              </div>
            ),
          }}
        />
      </Card>

      {/* Approve Modal - NewMoon Style */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-lg"
              style={{ background: ACCENT_SOFT, color: ACCENT }}
            >
              <CheckOutlined />
            </div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>{selectedRequest?.request_type === "cash_advance" ? "Approve Cash Advance" : "Approve Stock Request"}</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>Approve this staff request</p>
            </div>
          </div>
        }
        open={showApproveModal}
        onCancel={() => {
          setShowApproveModal(false);
          approveForm.resetFields();
          setSelectedRequest(null);
        }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        {selectedRequest && (
          <div className="mb-4 p-4 rounded-xl" style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}33` }}>
            <div className="font-semibold" style={{ color: TEXT }}>
              {selectedRequest.user?.firstname} {selectedRequest.user?.lastname}
            </div>
            {selectedRequest.request_type === "cash_advance" ? (
              <div className="text-lg font-bold" style={{ color: ACCENT }}>
                {formatCurrency(selectedRequest.amount)}
              </div>
            ) : (
              <>
                <div className="text-lg font-bold" style={{ color: ACCENT }}>
                  {selectedRequest.product?.name}
                </div>
                <div style={{ color: MUTED }} className="text-sm">
                  Quantity: {selectedRequest.quantity}
                </div>
                <div style={{ color: MUTED }} className="text-sm">
                  Branch: {selectedRequest.branch?.name}
                </div>
              </>
            )}
            {selectedRequest.reason && (
              <div style={{ color: MUTED }} className="text-sm mt-1">
                Reason: {selectedRequest.reason}
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
            label={<span style={FIELD_LABEL} className="text-sm font-semibold">Admin Notes (Optional)</span>}
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
              disabled={approveAdvanceMutation.isPending || approveStockMutation.isPending}
              className="rounded-xl"
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => {
                  setShowApproveModal(false);
                  approveForm.resetFields();
                  setSelectedRequest(null);
                }}
                disabled={approveAdvanceMutation.isPending || approveStockMutation.isPending}
                style={SECONDARY_BTN}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={approveAdvanceMutation.isPending || approveStockMutation.isPending}
                icon={<CheckOutlined />}
                style={GRADIENT_BTN}
                className="rounded-xl hover:brightness-110"
              >
                Approve Request
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject Modal - NewMoon Style */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-lg"
              style={{ background: RED_SOFT, color: RED }}
            >
              <CloseOutlined />
            </div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>{selectedRequest?.request_type === "cash_advance" ? "Reject Cash Advance" : "Reject Stock Request"}</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>Reject this staff request</p>
            </div>
          </div>
        }
        open={showRejectModal}
        onCancel={() => {
          setShowRejectModal(false);
          rejectForm.resetFields();
          setSelectedRequest(null);
        }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        {selectedRequest && (
          <div className="mb-4 p-4 rounded-xl" style={{ background: RED_SOFT, border: `1px solid ${RED}40` }}>
            <div className="font-semibold" style={{ color: TEXT }}>
              {selectedRequest.user?.firstname} {selectedRequest.user?.lastname}
            </div>
            {selectedRequest.request_type === "cash_advance" ? (
              <div className="text-lg font-bold" style={{ color: "#F87171" }}>
                {formatCurrency(selectedRequest.amount)}
              </div>
            ) : (
              <>
                <div className="text-lg font-bold" style={{ color: "#F87171" }}>
                  {selectedRequest.product?.name}
                </div>
                <div style={{ color: MUTED }} className="text-sm">
                  Quantity: {selectedRequest.quantity}
                </div>
                <div style={{ color: MUTED }} className="text-sm">
                  Branch: {selectedRequest.branch?.name}
                </div>
              </>
            )}
            {selectedRequest.reason && (
              <div style={{ color: MUTED }} className="text-sm mt-1">
                Reason: {selectedRequest.reason}
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
            label={<span style={FIELD_LABEL} className="text-sm font-semibold">Rejection Reason (Optional)</span>}
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
              disabled={rejectAdvanceMutation.isPending || rejectStockMutation.isPending}
              className="rounded-xl"
            />
          </Form.Item>

          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => {
                  setShowRejectModal(false);
                  rejectForm.resetFields();
                  setSelectedRequest(null);
                }}
                disabled={rejectAdvanceMutation.isPending || rejectStockMutation.isPending}
                style={SECONDARY_BTN}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                danger
                htmlType="submit"
                loading={rejectAdvanceMutation.isPending || rejectStockMutation.isPending}
                icon={<CloseOutlined />}
                style={{ background: "linear-gradient(135deg, #EF4444, #DC2626)", border: "none", color: "#FFFFFF", fontWeight: 700, boxShadow: "none" }}
                className="rounded-xl hover:brightness-110"
              >
                Reject Request
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default RequestAdmin;