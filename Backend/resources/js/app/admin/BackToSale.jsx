import { useState } from "react";
import {
  Card, Table, Tag, Row, Col, Statistic, Select, Button, Space, Modal, Form, Input, message, Tooltip, DatePicker,
} from "antd";
import {
  ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined,
  CheckOutlined, CloseOutlined, UserOutlined, ShoppingCartOutlined, ArrowLeftOutlined, SearchOutlined,
  RollbackOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/config/api";

const { TextArea } = Input;
const { RangePicker } = DatePicker;

function BackToSale() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [dateRange, setDateRange] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [rejectForm] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["backToSalesAll", currentPage, pageSize, statusFilter, searchText, dateRange],
    queryFn: () => {
      const params = { page: currentPage, per_page: pageSize };
      if (statusFilter !== "all") params.status = statusFilter;
      if (searchText.trim()) params.search = searchText.trim();
      if (dateRange?.[0] && dateRange?.[1]) {
        params.start_date = dateRange[0].format("YYYY-MM-DD");
        params.end_date = dateRange[1].format("YYYY-MM-DD");
      }
      return api.get("/back-to-sales/all", { params });
    },
  });

  const records = data?.data?.data || [];
  const stats = data?.data?.stats || {};
  const paginationMeta = data?.data?.pagination || {};

  const approveMutation = useMutation({
    mutationFn: ({ id }) => api.post(`/back-to-sales/${id}/approve`),
    onSuccess: () => {
      message.success("Return approved");
      setShowApproveModal(false);
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["backToSalesAll"] });
    },
    onError: (e) => message.error(e.response?.data?.message || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, adminNotes }) =>
      api.post(`/back-to-sales/${id}/reject`, { admin_notes: adminNotes }),
    onSuccess: () => {
      message.success("Return rejected");
      setShowRejectModal(false);
      rejectForm.resetFields();
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["backToSalesAll"] });
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
      width: 180,
      render: (_, r) => (
        <div>
          <div className="font-semibold text-[#451A03]"><UserOutlined className="mr-1 text-[#F97316]" />{r.user?.firstname} {r.user?.lastname}</div>
          <div className="text-stone-400 text-xs">ID: {r.user?.id}</div>
        </div>
      ),
    },
    {
      title: "Product",
      key: "product",
      width: 180,
      render: (_, r) => (
        <div>
          <div className="font-semibold text-[#451A03]">{r.product?.name}</div>
          <div className="text-stone-400 text-xs">Branch: {r.branch?.name}</div>
        </div>
      ),
    },
    {
      title: "Qty",
      dataIndex: "quantity",
      key: "quantity",
      width: 80,
      render: (v) => <span className="font-semibold text-lg text-[#EA580C]">{v}</span>,
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      width: 200,
      render: (v) => v || <span className="text-gray-400">-</span>,
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
        if (r.status === "approved" && r.approved_at) return <span className="text-green-600">{fmtDate(r.approved_at)}</span>;
        if (r.status === "rejected" && r.rejected_at) return <span className="text-red-600">{fmtDate(r.rejected_at)}</span>;
        return <span className="text-gray-400">-</span>;
      },
    },
    {
      title: "Admin Notes",
      dataIndex: "admin_notes",
      key: "admin_notes",
      width: 160,
      render: (v) => v || <span className="text-gray-400">-</span>,
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
                <Button type="primary" size="small" icon={<CheckOutlined />}
                  onClick={() => { setSelected(r); setShowApproveModal(true); }}
                  className="rounded-xl bg-gradient-to-br from-[#16A34A] to-[#22C55E] border-none shadow-[0_4px_15px_rgba(34,197,94,0.3)] hover:brightness-110 transition-all duration-200">
                  Approve
                </Button>
              </Tooltip>
              <Tooltip title="Reject">
                <Button size="small" icon={<CloseOutlined />}
                  onClick={() => { setSelected(r); setShowRejectModal(true); }}
                  className="rounded-xl bg-gradient-to-br from-[#DC2626] to-[#EF4444] border-none shadow-[0_4px_15px_rgba(220,38,38,0.3)] hover:brightness-110 transition-all duration-200 text-white">
                  Reject
                </Button>
              </Tooltip>
            </>
          )}
          {r.status !== "pending" && <span className="text-gray-400 text-sm">-</span>}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 bg-gradient-to-br from-[#FFF8ED]/80 via-[#FFFDF9] to-[#FFF1E6]/80 min-h-screen">
      {/* Hero Header */}
      <div className="mb-6 rounded-2xl overflow-hidden shadow-[0_12px_35px_rgba(69,26,3,0.25)] bg-gradient-to-br from-[#171717] via-[#3B2418] to-[#451A03]">
        <div className="px-8 py-6 relative">
          <div className="absolute right-0 top-0 opacity-10">
            <div className="w-64 h-64 rounded-full bg-[#F97316] -mr-32 -mt-32"></div>
          </div>
          <div className="absolute bottom-0 left-1/3 opacity-5">
            <div className="w-48 h-48 rounded-full bg-[#F59E0B]"></div>
          </div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#EA580C] via-[#F97316] to-[#F59E0B]" />

          <div className="flex items-center justify-between relative z-10 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                <RollbackOutlined className="mr-2 text-[#F97316]" />
                Back-to-Sales
              </h1>
              <p className="text-white/80 text-sm">Manage unsold stock returned from branches</p>
            </div>
          </div>

          {/* KPI Chips */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 relative z-10">
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <p className="text-white/70 text-xs flex items-center gap-1.5">
                <ShoppingCartOutlined className="text-[#F97316]" /> Total Returns
              </p>
              <p className="text-white font-bold text-xl mt-1">{stats.total || 0}</p>
            </div>
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <p className="text-white/70 text-xs flex items-center gap-1.5">
                <ClockCircleOutlined className="text-[#F97316]" /> Pending
              </p>
              <p className="text-white font-bold text-xl mt-1">{stats.pending || 0}</p>
            </div>
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <p className="text-white/70 text-xs flex items-center gap-1.5">
                <CheckCircleOutlined className="text-[#F97316]" /> Approved
              </p>
              <p className="text-white font-bold text-xl mt-1">{stats.approved || 0}</p>
            </div>
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <p className="text-white/70 text-xs flex items-center gap-1.5">
                <ArrowLeftOutlined className="text-[#F97316]" /> Qty Returned
              </p>
              <p className="text-white font-bold text-xl mt-1">{stats.total_quantity || 0} <span className="text-sm font-normal text-white/50">pcs</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistic Cards */}
      <Row gutter={16} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" size="small" className="rounded-xl border border-[#F5EDE0] shadow-sm">
            <Statistic title="Total Returns" value={stats.total || 0} prefix={<ShoppingCartOutlined />} styles={{ content: { color: "#EA580C" } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" size="small" className="rounded-xl border border-[#F5EDE0] shadow-sm">
            <Statistic title="Pending" value={stats.pending || 0} styles={{ content: { color: "#D97706" } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" size="small" className="rounded-xl border border-[#F5EDE0] shadow-sm">
            <Statistic title="Approved" value={stats.approved || 0} styles={{ content: { color: "#16A34A" } }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card variant="borderless" size="small" className="rounded-xl border border-[#F5EDE0] shadow-sm">
            <Statistic title="Qty Returned" value={stats.total_quantity || 0} suffix="pcs" styles={{ content: { color: "#F97316" } }} />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card variant="borderless" className="mb-6 rounded-xl border border-[#F5EDE0] shadow-sm">
        <Space wrap>
          <span className="text-sm font-semibold text-[#451A03]">Status:</span>
          <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }} style={{ width: 130 }} className="rounded-xl">
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
          />
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

      {/* Section Header */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FFF1E6] to-[#FFE3C9] flex items-center justify-center text-[#F97316] text-lg shadow-sm">
              <RollbackOutlined />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#451A03]">Return Requests</h2>
              <p className="text-sm text-stone-400">Review and process returned stock</p>
            </div>
          </div>
          <Tag className="text-sm px-3 py-1 rounded-full bg-gradient-to-br from-[#EA580C] to-[#F59E0B] text-white border-none">
            {paginationMeta.total || records.length} record(s)
          </Tag>
        </div>
      </div>

      {/* Table */}
      <Card variant="borderless" className="rounded-xl border border-[#F5EDE0] shadow-sm">
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: paginationMeta.current_page || 1,
            pageSize: pageSize,
            total: paginationMeta.total || 0,
            onChange: (page, size) => { setCurrentPage(page); setPageSize(size); },
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} records`,
          }}
          locale={{ emptyText: <div className="py-10 text-center"><div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#FFF1E6] to-[#FFE3C9] rounded-2xl flex items-center justify-center mb-3"><RollbackOutlined className="text-3xl text-[#F97316]" /></div><p className="text-[#451A03] font-semibold">No back-to-sales records found</p><p className="text-gray-400 text-sm">Try adjusting your search or filters</p></div> }}
        />
      </Card>

      {/* Approve Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FFF1E6] to-[#FFE3C9] flex items-center justify-center text-[#16A34A] text-lg shadow-sm">
              <CheckCircleOutlined />
            </div>
            <div>
              <p className="font-bold text-[#451A03]">Approve Return</p>
              <p className="text-xs font-normal text-stone-400">Confirm the return request</p>
            </div>
          </div>
        }
        open={showApproveModal}
        onCancel={() => { setShowApproveModal(false); setSelected(null); }}
        onOk={handleApprove}
        confirmLoading={approveMutation.isPending}
        okText="Approve"
        okButtonProps={{ icon: <CheckOutlined />, className: "!rounded-xl !bg-gradient-to-br !from-[#16A34A] !to-[#22C55E] !border-none !shadow-[0_4px_15px_rgba(34,197,94,0.3)]" }}
        className="rounded-2xl"
      >
        {selected && (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-[#FFF1E6]">
              <div className="font-semibold text-[#451A03]">{selected.user?.firstname} {selected.user?.lastname}</div>
              <div className="text-lg font-bold text-[#16A34A] mt-1">{selected.product?.name}</div>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-stone-600">Quantity: <strong>{selected.quantity}</strong></span>
                <span className="text-stone-600">Branch: <strong>{selected.branch?.name}</strong></span>
              </div>
              {selected.notes && <div className="text-stone-600 text-sm mt-2">Notes: {selected.notes}</div>}
            </div>
            <div className="text-sm text-stone-500">
              Approving confirms this return. The quantity was already deducted from <strong>{selected.branch?.name}</strong> stock when the return was filed.
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FFF1E6] to-[#FFE3C9] flex items-center justify-center text-[#DC2626] text-lg shadow-sm">
              <CloseCircleOutlined />
            </div>
            <div>
              <p className="font-bold text-[#451A03]">Reject Return</p>
              <p className="text-xs font-normal text-stone-400">Provide a reason for rejection</p>
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
            <div className="text-lg font-bold text-[#DC2626] mt-1">{selected.product?.name}</div>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-stone-600">Quantity: <strong>{selected.quantity}</strong></span>
              <span className="text-stone-600">Branch: <strong>{selected.branch?.name}</strong></span>
            </div>
            {selected.notes && <div className="text-stone-600 text-sm mt-2">Notes: {selected.notes}</div>}
          </div>
        )}
        <Form form={rejectForm} layout="vertical" onFinish={handleReject} initialValues={{ admin_notes: "" }}>
          <Form.Item label={<span className="text-sm font-semibold text-[#451A03]">Rejection Reason (Optional)</span>} name="admin_notes" rules={[{ max: 500, message: "Reason cannot exceed 500 characters" }]}>
            <TextArea rows={4} placeholder="Provide a reason for rejection" maxLength={500} showCount disabled={rejectMutation.isPending} className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]" />
          </Form.Item>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => { setShowRejectModal(false); rejectForm.resetFields(); setSelected(null); }} disabled={rejectMutation.isPending} className="!rounded-xl">Cancel</Button>
              <Button htmlType="submit" loading={rejectMutation.isPending} icon={<CloseOutlined />} className="!rounded-xl !bg-gradient-to-br !from-[#DC2626] !to-[#EF4444] !border-none !shadow-[0_4px_15px_rgba(220,38,38,0.3)] !text-white hover:brightness-110">Reject</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BackToSale;