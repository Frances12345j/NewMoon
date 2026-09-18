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

const { TextArea } = Input;


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
      pending: { color: "#D97706", icon: <ClockCircleOutlined />, text: "Pending" },
      approved: { color: "#16A34A", icon: <CheckCircleOutlined />, text: "Approved" },
      rejected: { color: "#DC2626", icon: <CloseCircleOutlined />, text: "Rejected" },
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
      cash_advance: { color: "#F97316", icon:<span style={{ fontSize: "14px",gap: '4', display: "inline-block" }}>₱</span>, text: "Cash Advance" },
      stock: { color: "#0D9488", icon: <InboxOutlined />, text: "Supply Request" },
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
          <div className="font-semibold">
            {record.user?.firstname} {record.user?.lastname}
          </div>
          <div className="text-gray-500 text-xs">ID: {record.user?.id}</div>
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
          return <span className="font-bold text-[#EA580C]">{formatCurrency(record.amount)}</span>;
        } else {
          return (
            <div>
              <div className="font-semibold">{record.product?.name}</div>
              <div className="text-gray-500 text-xs">Qty: {record.quantity}</div>
              <div className="text-gray-500 text-xs">{record.branch?.name}</div>
            </div>
          );
        }
      },
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      render: (reason) => reason || <span className="text-gray-400">-</span>,
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
          return <span className="text-green-600">{formatDate(record.approved_at)}</span>;
        }
        if (record.status === "rejected" && record.rejected_at) {
          return <span className="text-red-600">{formatDate(record.rejected_at)}</span>;
        }
        return <span className="text-gray-400">-</span>;
      },
    },
    {
      title: "Admin Notes",
      dataIndex: "admin_notes",
      key: "admin_notes",
      render: (notes) => notes || <span className="text-gray-400">-</span>,
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
                  className="rounded-xl bg-gradient-to-br from-[#16A34A] to-[#22C55E] border-none text-white shadow-[0_4px_15px_rgba(34,197,94,0.3)] hover:brightness-110"
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
                  className="rounded-xl bg-gradient-to-br from-[#DC2626] to-[#EF4444] border-none text-white shadow-[0_4px_15px_rgba(220,38,38,0.3)] hover:brightness-110"
                >
                  Reject
                </Button>
              </Tooltip>
            </>
          )}
          {record.status !== "pending" && (
            <span className="text-gray-400 text-sm">No actions</span>
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
    <div className="p-6 bg-gradient-to-br from-[#FFF8ED]/80 via-[#FFFDF9] to-[#FFF1E6]/80 min-h-screen">
      {/* Header - NewMoon Roasted Style */}
      <div className="mb-6 rounded-2xl overflow-hidden shadow-[0_12px_35px_rgba(69,26,3,0.25)] bg-gradient-to-br from-[#171717] via-[#3B2418] to-[#451A03]">
        <div className="px-8 py-6 relative">
          {/* Decorative circles */}
          <div className="absolute right-0 top-0 opacity-10">
            <div className="w-64 h-64 rounded-full bg-[#F97316] -mr-32 -mt-32"></div>
          </div>
          <div className="absolute bottom-0 left-1/3 opacity-5">
            <div className="w-48 h-48 rounded-full bg-[#F59E0B]"></div>
          </div>

          {/* Flame accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#EA580C] via-[#F97316] to-[#F59E0B]" />

          <div className="flex items-center justify-between relative z-10">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                <InboxOutlined className="mr-2 text-[#F97316]" />
                Request Management
              </h1>
              <p className="text-white/80 text-sm">Approve or reject staff requests</p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 relative z-10">
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <p className="text-white/70 text-xs">Total Requests</p>
              <p className="text-white font-bold text-xl mt-1">{statistics.total}</p>
            </div>
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <p className="text-white/70 text-xs">Pending</p>
              <p className="text-white font-bold text-xl mt-1 text-[#FDE68A]">{statistics.pending}</p>
            </div>
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <p className="text-white/70 text-xs">Approved</p>
              <p className="text-white font-bold text-xl mt-1 text-[#FDE68A]">{statistics.approved}</p>
            </div>
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <p className="text-white/70 text-xs">Cash Advance Total</p>
              <p className="text-white font-bold text-xl mt-1 text-[#FDE68A]">{formatCurrency(statistics.cashAdvanceTotal)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar - NewMoon Style */}
      <Card className="mb-6 rounded-xl border border-[#F5EDE0] shadow-sm">
        <Space>
          <span className="text-[#451A03] font-medium text-sm">Filter by status:</span>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 150 }}
            className="rounded-xl"
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
            className="rounded-xl border-[#EA580C] text-[#EA580C] hover:bg-[#FFF1E6] hover:border-[#F97316] transition-all duration-200"
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Requests Table - NewMoon Style */}
      <Card
        className="rounded-xl border border-[#F5EDE0] shadow-sm"
        title={<span className="text-[#451A03] font-semibold"><InboxOutlined className="mr-2 text-[#F97316]" />All Requests</span>}
        extra={<Tag className="text-sm px-3 py-1 rounded-full bg-gradient-to-br from-[#EA580C] to-[#F59E0B] text-white border-none">{filteredRequests.length} request(s)</Tag>}
      >
        <Table
          columns={columns}
          dataSource={filteredRequests}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} requests`,
          }}
          locale={{
            emptyText: (
              <div className="py-10 text-center">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#FFF1E6] to-[#FFE3C9] rounded-2xl flex items-center justify-center mb-3">
                  <DollarOutlined className="text-3xl text-[#F97316]" />
                </div>
                <p className="text-[#451A03] font-semibold">No requests found</p>
                <p className="text-gray-400 text-sm">Try adjusting your filter</p>
              </div>
            ),
          }}
        />
      </Card>

      {/* Approve Modal - NewMoon Style */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FFF1E6] to-[#FFE3C9] flex items-center justify-center text-[#F97316] text-lg"><CheckOutlined /></div>
            <div>
              <p className="font-bold text-[#451A03]">{selectedRequest?.request_type === "cash_advance" ? "Approve Cash Advance" : "Approve Stock Request"}</p>
              <p className="text-xs font-normal text-stone-400">Approve this staff request</p>
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
          <div className="mb-4 p-4 rounded-xl bg-[#FFF1E6]">
            <div className="font-semibold text-[#451A03]">
              {selectedRequest.user?.firstname} {selectedRequest.user?.lastname}
            </div>
            {selectedRequest.request_type === "cash_advance" ? (
              <div className="text-lg font-bold text-[#16A34A]">
                {formatCurrency(selectedRequest.amount)}
              </div>
            ) : (
              <>
                <div className="text-lg font-bold text-[#16A34A]">
                  {selectedRequest.product?.name}
                </div>
                <div className="text-gray-600 text-sm">
                  Quantity: {selectedRequest.quantity}
                </div>
                <div className="text-gray-600 text-sm">
                  Branch: {selectedRequest.branch?.name}
                </div>
              </>
            )}
            {selectedRequest.reason && (
              <div className="text-gray-600 text-sm mt-1">
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
            label={<span className="text-sm font-semibold text-[#451A03]">Admin Notes (Optional)</span>}
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
              className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]"
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
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={approveAdvanceMutation.isPending || approveStockMutation.isPending}
                icon={<CheckOutlined />}
                className="rounded-xl bg-gradient-to-br from-[#16A34A] to-[#22C55E] border-none shadow-[0_4px_15px_rgba(34,197,94,0.3)] hover:brightness-110"
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
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FFF1E6] to-[#FFE3C9] flex items-center justify-center text-[#F97316] text-lg"><CloseOutlined /></div>
            <div>
              <p className="font-bold text-[#451A03]">{selectedRequest?.request_type === "cash_advance" ? "Reject Cash Advance" : "Reject Stock Request"}</p>
              <p className="text-xs font-normal text-stone-400">Reject this staff request</p>
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
          <div className="mb-4 p-4 rounded-xl bg-[#FFF1E6]">
            <div className="font-semibold text-[#451A03]">
              {selectedRequest.user?.firstname} {selectedRequest.user?.lastname}
            </div>
            {selectedRequest.request_type === "cash_advance" ? (
              <div className="text-lg font-bold text-[#DC2626]">
                {formatCurrency(selectedRequest.amount)}
              </div>
            ) : (
              <>
                <div className="text-lg font-bold text-[#DC2626]">
                  {selectedRequest.product?.name}
                </div>
                <div className="text-gray-600 text-sm">
                  Quantity: {selectedRequest.quantity}
                </div>
                <div className="text-gray-600 text-sm">
                  Branch: {selectedRequest.branch?.name}
                </div>
              </>
            )}
            {selectedRequest.reason && (
              <div className="text-gray-600 text-sm mt-1">
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
            label={<span className="text-sm font-semibold text-[#451A03]">Rejection Reason (Optional)</span>}
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
              className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]"
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
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                danger
                htmlType="submit"
                loading={rejectAdvanceMutation.isPending || rejectStockMutation.isPending}
                icon={<CloseOutlined />}
                className="rounded-xl bg-gradient-to-br from-[#DC2626] to-[#EF4444] border-none shadow-[0_4px_15px_rgba(220,38,38,0.3)] hover:brightness-110"
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