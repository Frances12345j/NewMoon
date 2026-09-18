import { useState } from "react";
import { Card, Table, Button, Modal, Form, Input, message, Tag, Space, Select, Tooltip } from "antd";
import {
  InboxOutlined, ReloadOutlined, CheckCircleOutlined,
  ClockCircleOutlined, CloseCircleOutlined,
  CheckOutlined, CloseOutlined, ShopOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/config/api";

const { TextArea } = Input;

function SupplyRequest() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["stockRequestsAll"],
    queryFn: () => api.get("/supply-requests/all"),
  });

  const requests = data?.data?.data || [];

  const filtered = statusFilter === "all"
    ? requests
    : requests.filter((r) => r.status === statusFilter);

  const approveMutation = useMutation({
    mutationFn: ({ id, adminNotes }) =>
      api.post(`/supply-requests/${id}/approve`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Supply request approved");
      setShowApproveModal(false);
      approveForm.resetFields();
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["stockRequestsAll"] });
    },
    onError: (e) => message.error(e.response?.data?.message || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, adminNotes }) =>
      api.post(`/supply-requests/${id}/reject`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Supply request rejected");
      setShowRejectModal(false);
      rejectForm.resetFields();
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["stockRequestsAll"] });
    },
    onError: (e) => message.error(e.response?.data?.message || "Failed to reject"),
  });

  const handleApprove = (values) => {
    approveMutation.mutate({ id: selected.id, adminNotes: values.admin_notes || null });
  };

  const handleReject = (values) => {
    rejectMutation.mutate({ id: selected.id, adminNotes: values.admin_notes || null });
  };

  const statusTag = (status) => {
    const m = {
      pending: { color: "#D97706", icon: <ClockCircleOutlined />, text: "Pending" },
      approved: { color: "#16A34A", icon: <CheckCircleOutlined />, text: "Approved" },
      rejected: { color: "#DC2626", icon: <CloseCircleOutlined />, text: "Rejected" },
    };
    const c = m[status] || m.pending;
    return <Tag color={c.color} icon={c.icon}>{c.text}</Tag>;
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

  const columns = [
    {
      title: "Staff",
      key: "staff",
      render: (_, r) => (
        <div>
          <div className="font-semibold">{r.user?.firstname} {r.user?.lastname}</div>
          <div className="text-gray-500 text-xs">ID: {r.user?.id}</div>
        </div>
      ),
    },
    {
      title: "Product",
      key: "product",
      render: (_, r) => (
        <div>
          <div className="font-semibold">{r.product?.name}</div>
          <div className="text-gray-500 text-xs">Qty: {r.quantity}</div>
        </div>
      ),
    },
    {
      title: "Branch",
      key: "branch",
      render: (_, r) => (
        <span><ShopOutlined className="mr-1 text-[#F97316]" />{r.branch?.name || "-"}</span>
      ),
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      render: (v) => v || <span className="text-gray-400">-</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v) => statusTag(v),
    },
    {
      title: "Requested At",
      dataIndex: "requested_at",
      key: "requested_at",
      render: (v) => fmtDate(v),
    },
    {
      title: "Processed At",
      key: "processed",
      render: (_, r) => {
        if (r.status === "approved" && r.approved_at) return <span className="text-green-600">{fmtDate(r.approved_at)}</span>;
        if (r.status === "rejected" && r.rejected_at) return <span className="text-red-600">{fmtDate(r.rejected_at)}</span>;
        return <span className="text-gray-400">-</span>;
      },
    },
    {
      title: "Admin Notes",
      dataIndex: "admin_notes",
      key: "admin_notes",
      render: (v) => v || <span className="text-gray-400">-</span>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, r) => (
        <Space>
          {r.status === "pending" && (
            <>
              <Tooltip title="Approve">
                <Button type="primary" size="small" icon={<CheckOutlined />}
                  onClick={() => { setSelected(r); setShowApproveModal(true); }}
                  className="rounded-xl bg-gradient-to-br from-[#16A34A] to-[#22C55E] border-none text-white shadow-[0_4px_15px_rgba(34,197,94,0.3)] hover:brightness-110">
                  Approve
                </Button>
              </Tooltip>
              <Tooltip title="Reject">
                <Button danger size="small" icon={<CloseOutlined />}
                  onClick={() => { setSelected(r); setShowRejectModal(true); }}
                  className="rounded-xl bg-gradient-to-br from-[#DC2626] to-[#EF4444] border-none text-white shadow-[0_4px_15px_rgba(220,38,38,0.3)] hover:brightness-110">
                  Reject
                </Button>
              </Tooltip>
            </>
          )}
          {r.status !== "pending" && <span className="text-gray-400 text-sm">No actions</span>}
        </Space>
      ),
    },
  ];

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    totalQty: requests.filter((r) => r.status === "approved").reduce((s, r) => s + Number(r.quantity), 0),
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
                Supply Request Management
              </h1>
              <p className="text-white/80 text-sm">Approve or reject staff supply requests</p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 relative z-10">
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <p className="text-white/70 text-xs">Total Requests</p>
              <p className="text-white font-bold text-xl mt-1">{stats.total}</p>
            </div>
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <p className="text-white/70 text-xs">Pending</p>
              <p className="text-white font-bold text-xl mt-1 text-[#FDE68A]">{stats.pending}</p>
            </div>
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <p className="text-white/70 text-xs">Approved</p>
              <p className="text-white font-bold text-xl mt-1 text-[#FDE68A]">{stats.approved}</p>
            </div>
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <p className="text-white/70 text-xs">Approved Qty</p>
              <p className="text-white font-bold text-xl mt-1 text-[#FDE68A]">{stats.totalQty} pcs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - NewMoon Style */}
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
            onClick={() => refetch()}
            loading={isLoading}
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
              Supply Requests
            </h2>
            <p className="text-sm text-gray-500 mt-1">Review and process staff supply requests</p>
          </div>
          <Tag className="text-sm px-3 py-1 rounded-full bg-gradient-to-br from-[#EA580C] to-[#F59E0B] text-white border-none">
            {filtered.length} request(s)
          </Tag>
        </div>
      </div>

      <Card className="rounded-xl border border-[#F5EDE0] shadow-sm">
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} requests` }}
          locale={{ emptyText: <div className="py-10 text-center"><div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#FFF1E6] to-[#FFE3C9] rounded-2xl flex items-center justify-center mb-3"><InboxOutlined className="text-3xl text-[#F97316]" /></div><p className="text-[#451A03] font-semibold">No supply requests found</p><p className="text-gray-400 text-sm">Try adjusting your filter</p></div> }}
        />
      </Card>

      {/* Approve Modal - NewMoon Style */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FFF1E6] to-[#FFE3C9] flex items-center justify-center text-[#F97316] text-lg"><CheckOutlined /></div>
            <div>
              <p className="font-bold text-[#451A03]">Approve Supply Request</p>
              <p className="text-xs font-normal text-stone-400">Approve this staff supply request</p>
            </div>
          </div>
        }
        open={showApproveModal}
        onCancel={() => { setShowApproveModal(false); approveForm.resetFields(); setSelected(null); }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        {selected && (
          <div className="mb-4 p-4 rounded-xl bg-[#FFF1E6]">
            <div className="font-semibold text-[#451A03]">{selected.user?.firstname} {selected.user?.lastname}</div>
            <div className="text-lg font-bold text-[#16A34A]">{selected.product?.name}</div>
            <div className="text-gray-600 text-sm">Quantity: {selected.quantity}</div>
            <div className="text-gray-600 text-sm">Branch: {selected.branch?.name}</div>
            {selected.reason && <div className="text-gray-600 text-sm mt-1">Reason: {selected.reason}</div>}
          </div>
        )}
        <Form form={approveForm} layout="vertical" onFinish={handleApprove} initialValues={{ admin_notes: "" }}>
          <Form.Item
            label={<span className="text-sm font-semibold text-[#451A03]">Admin Notes (Optional)</span>}
            name="admin_notes"
            rules={[{ max: 500, message: "Notes cannot exceed 500 characters" }]}
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
              This action will approve the supply request and notify the staff member.
            </p>
          </div>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => { setShowApproveModal(false); approveForm.resetFields(); setSelected(null); }}
                disabled={approveMutation.isPending}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={approveMutation.isPending}
                icon={<CheckOutlined />}
                className="rounded-xl bg-gradient-to-br from-[#16A34A] to-[#22C55E] border-none shadow-[0_4px_15px_rgba(34,197,94,0.3)] hover:brightness-110"
              >
                Approve
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
              <p className="font-bold text-[#451A03]">Reject Supply Request</p>
              <p className="text-xs font-normal text-stone-400">Reject this staff supply request</p>
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
          <div className="mb-4 p-4 rounded-xl bg-[#FFF1E6]">
            <div className="font-semibold text-[#451A03]">{selected.user?.firstname} {selected.user?.lastname}</div>
            <div className="text-lg font-bold text-[#DC2626]">{selected.product?.name}</div>
            <div className="text-gray-600 text-sm">Quantity: {selected.quantity}</div>
            <div className="text-gray-600 text-sm">Branch: {selected.branch?.name}</div>
            {selected.reason && <div className="text-gray-600 text-sm mt-1">Reason: {selected.reason}</div>}
          </div>
        )}
        <Form form={rejectForm} layout="vertical" onFinish={handleReject} initialValues={{ admin_notes: "" }}>
          <Form.Item
            label={<span className="text-sm font-semibold text-[#451A03]">Rejection Reason (Optional)</span>}
            name="admin_notes"
            rules={[{ max: 500, message: "Reason cannot exceed 500 characters" }]}
          >
            <TextArea
              rows={4}
              placeholder="Provide a reason for rejection"
              maxLength={500}
              showCount
              disabled={rejectMutation.isPending}
              className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]"
            />
          </Form.Item>
          <div className="p-3 mb-4 rounded-xl bg-red-50">
            <p className="text-xs text-red-700 mb-0">
              <InfoCircleOutlined className="mr-1" />
              This action will reject the supply request and notify the staff member.
            </p>
          </div>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => { setShowRejectModal(false); rejectForm.resetFields(); setSelected(null); }}
                disabled={rejectMutation.isPending}
                className="rounded-xl"
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
                Reject
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default SupplyRequest;