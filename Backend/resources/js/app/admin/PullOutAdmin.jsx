import { useState } from "react";
import { Card, Table, Button, Modal, Form, Input, message, Tag, Space, Select, Tooltip } from "antd";
import { 
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  InboxOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from "@/config/api";

const { TextArea } = Input;

function PullOutAdmin() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedPullOut, setSelectedPullOut] = useState(null);
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch all stock-outs with server-side pagination + status filter
  const { data: pullOutsData, isLoading: pullOutsLoading, refetch: refetchPullOuts } = useQuery({
    queryKey: ['pullOutsAll', currentPage, pageSize, statusFilter],
    queryFn: () => {
      const params = { page: currentPage, per_page: pageSize };
      if (statusFilter !== "all") params.status = statusFilter;
      return api.get("/stock-outs/getall", { params });
    },
  });

  const pullOuts = pullOutsData?.data?.data || [];
  const stats = pullOutsData?.data?.stats || {};
  const paginationMeta = pullOutsData?.data?.pagination || {};

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => 
      api.post(`/stock-outs/${id}/approve`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Stock out approved successfully");
      setShowApproveModal(false);
      approveForm.resetFields();
      setSelectedPullOut(null);
      queryClient.invalidateQueries({ queryKey: ['pullOutsAll'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to approve stock-out");
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => 
      api.post(`/stock-outs/${id}/reject`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Stock out rejected successfully");
      setShowRejectModal(false);
      rejectForm.resetFields();
      setSelectedPullOut(null);
      queryClient.invalidateQueries({ queryKey: ['pullOutsAll'] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to reject stock-out");
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
      title: "Product",
      key: "product",
      render: (_, record) => (
        <div>
          <div className="font-semibold">{record.product?.name}</div>
          <div className="text-gray-500 text-xs">SKU: {record.product?.sku}</div>
        </div>
      ),
    },
    {
      title: "Branch",
      key: "branch",
      render: (_, record) => (
        <div className="font-semibold">{record.branch?.name}</div>
      ),
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      render: (quantity) => (
        <span className="font-semibold">{quantity}</span>
      ),
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      render: (notes) => notes || <span className="text-gray-400">-</span>,
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      render: (reason) => reason ? <Tag color="purple">{reason}</Tag> : <span className="text-gray-400">-</span>,
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
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => {
                    setSelectedPullOut(record);
                    setShowApproveModal(true);
                  }}
                  className="rounded-full bg-gradient-to-br from-[#16A34A] to-[#22C55E] text-white border-none text-[11px] hover:brightness-110 transition-all duration-200 shadow-[0_2px_8px_rgba(34,197,94,0.3)]"
                >
                  Approve
                </Button>
              </Tooltip>
              <Tooltip title="Reject">
                <Button
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => {
                    setSelectedPullOut(record);
                    setShowRejectModal(true);
                  }}
                  className="rounded-full bg-gradient-to-br from-[#DC2626] to-[#EF4444] text-white border-none text-[11px] hover:brightness-110 transition-all duration-200 shadow-[0_2px_8px_rgba(220,38,38,0.3)]"
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

  // Statistics from server (unpaginated, full dataset)

  const handleRefresh = () => {
    refetchPullOuts();
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
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#EA580C] via-[#F97316] to-[#F59E0B]" />

          <div className="flex items-center justify-between relative z-10">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                <InboxOutlined className="mr-2 text-[#F97316]" />
                Stock Out Management
              </h1>
              <p className="text-white/80 text-sm">Approve or reject product stock-out requests</p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 relative z-10">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Stock Outs</p>
              <p className="text-white font-bold text-xl">{stats.total || 0}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Pending</p>
              <p className="text-white font-bold text-xl">{stats.pending || 0}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Approved</p>
              <p className="text-white font-bold text-xl">{stats.approved || 0}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/70 text-xs">Total Quantity</p>
              <p className="text-white font-bold text-xl">{stats.total_quantity || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - NewMoon Style */}
      <Card className="mb-6 rounded-xl border border-[#F5EDE0] shadow-sm">
        <Space wrap>
          <span className="text-[#451A03] font-semibold text-sm">Filter by status:</span>
          <Select
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
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
            loading={pullOutsLoading}
            className="rounded-xl border-[#EA580C] text-[#EA580C] hover:bg-[#FFF1E6] hover:border-[#F97316] transition-all duration-200"
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Requests Section - NewMoon Style */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#451A03]">
              <InboxOutlined className="mr-2 text-[#F97316]" />
              All Stock Outs
            </h2>
            <p className="text-sm text-gray-500 mt-1">Review and process staff stock-out requests</p>
          </div>
          <Tag className="text-sm px-3 py-1 rounded-full bg-gradient-to-br from-[#EA580C] to-[#F59E0B] text-white border-none">
            {paginationMeta.total || pullOuts.length} stock-out(s)
          </Tag>
        </div>
      </div>

      <Card className="rounded-xl border border-[#F5EDE0] shadow-sm">
        <Table
          columns={columns}
          dataSource={pullOuts}
          rowKey="id"
          loading={pullOutsLoading}
          pagination={{
            current: paginationMeta.current_page || 1,
            pageSize: pageSize,
            total: paginationMeta.total || 0,
            onChange: (page, size) => { setCurrentPage(page); setPageSize(size); },
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} stock-outs`,
          }}
          locale={{
            emptyText: (
              <div className="py-10 text-center">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#FFF1E6] to-[#FFE3C9] rounded-2xl flex items-center justify-center mb-3">
                  <InboxOutlined className="text-3xl text-[#F97316]" />
                </div>
                <p className="text-[#451A03] font-semibold">No stock-outs found</p>
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
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FFF1E6] to-[#FFE3C9] flex items-center justify-center text-[#F97316] text-lg">
              <CheckOutlined />
            </div>
            <div>
              <p className="font-bold text-[#451A03]">Approve Stock Out</p>
              <p className="text-xs font-normal text-stone-400">Confirm the stock-out request</p>
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
          <div className="mb-4 p-4 rounded-xl bg-[#FFF1E6]">
            <div className="font-semibold text-[#451A03]">
              {selectedPullOut.user?.firstname} {selectedPullOut.user?.lastname}
            </div>
            <div className="text-lg font-bold text-[#16A34A]">
              {selectedPullOut.product?.name}
            </div>
            <div className="text-gray-600 text-sm">
              Quantity: {selectedPullOut.quantity}
            </div>
            <div className="text-gray-600 text-sm">
              Branch: {selectedPullOut.branch?.name}
            </div>
            {selectedPullOut.reason && (
              <div className="text-gray-600 text-sm">
                Reason: {selectedPullOut.reason}
              </div>
            )}
            {selectedPullOut.notes && (
              <div className="text-gray-600 text-sm mt-1">
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
              disabled={approveMutation.isPending}
              className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]"
            />
          </Form.Item>
          <div className="p-3 mb-4 rounded-xl bg-[#FFF1E6]">
            <p className="text-xs text-[#451A03] mb-0">
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
                className="rounded-xl border-[#F5EDE0] text-[#451A03] hover:border-[#F97316] hover:text-[#EA580C]"
              >
                Cancel
              </Button>
              <Button
                htmlType="submit"
                loading={approveMutation.isPending}
                icon={<CheckOutlined />}
                className="rounded-xl bg-gradient-to-br from-[#16A34A] to-[#22C55E] border-none shadow-[0_4px_15px_rgba(34,197,94,0.3)] hover:brightness-110"
              >
                Approve Stock Out
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject Modal - NewMoon Style */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div className="w-11 h-11 rounded-xl bg-[#FEF2F2] flex items-center justify-center text-[#DC2626] text-lg">
              <CloseOutlined />
            </div>
            <div>
              <p className="font-bold text-[#451A03]">Reject Stock Out</p>
              <p className="text-xs font-normal text-stone-400">Decline the stock-out request</p>
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
          <div className="mb-4 p-4 rounded-xl bg-red-50">
            <div className="font-semibold text-[#451A03]">
              {selectedPullOut.user?.firstname} {selectedPullOut.user?.lastname}
            </div>
            <div className="text-lg font-bold text-[#DC2626]">
              {selectedPullOut.product?.name}
            </div>
            <div className="text-gray-600 text-sm">
              Quantity: {selectedPullOut.quantity}
            </div>
            <div className="text-gray-600 text-sm">
              Branch: {selectedPullOut.branch?.name}
            </div>
            {selectedPullOut.reason && (
              <div className="text-gray-600 text-sm">
                Reason: {selectedPullOut.reason}
              </div>
            )}
            {selectedPullOut.notes && (
              <div className="text-gray-600 text-sm mt-1">
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
              disabled={rejectMutation.isPending}
              className="rounded-xl border-[#F5EDE0] focus:border-[#DC2626]"
            />
          </Form.Item>
          <div className="p-3 mb-4 rounded-xl bg-red-50">
            <p className="text-xs text-[#DC2626] mb-0">
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
                className="rounded-xl border-[#F5EDE0] text-[#451A03] hover:border-[#F97316] hover:text-[#EA580C]"
              >
                Cancel
              </Button>
              <Button
                danger
                htmlType="submit"
                loading={rejectMutation.isPending}
                icon={<CloseOutlined />}
                className="rounded-xl bg-gradient-to-br from-[#DC2626] to-[#EF4444] border-none shadow-[0_4px_15px_rgba(220,38,38,0.3)] hover:brightness-110"
              >
                Reject Stock Out
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default PullOutAdmin;
