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
import { clientPagination, serverPagination } from "@/components/Pagination";

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
const RED_BTN = {
  background: "linear-gradient(135deg, #EF4444, #DC2626)",
  border: "none",
  color: "#FFFFFF",
  fontWeight: 700,
  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
};

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
      pending: { soft: AMBER_SOFT, color: AMBER, icon: <ClockCircleOutlined />, text: "Pending" },
      approved: { soft: GREEN_SOFT, color: ACCENT, icon: <CheckCircleOutlined />, text: "Approved" },
      rejected: { soft: RED_SOFT, color: "#F87171", icon: <CloseCircleOutlined />, text: "Rejected" },
    };
    const c = m[status] || m.pending;
    return <Tag className="rounded-full px-3 py-1" icon={c.icon} style={{ background: c.soft, color: c.color, border: `1px solid ${c.color}30` }}>{c.text}</Tag>;
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";

  const columns = [
    {
      title: "Staff",
      key: "staff",
      render: (_, r) => (
        <div>
          <div className="font-semibold">{r.user?.firstname} {r.user?.lastname}</div>
          <div className="text-xs" style={{ color: MUTED }}>ID: {r.user?.id}</div>
        </div>
      ),
    },
    {
      title: "Product",
      key: "product",
      render: (_, r) => (
        <div>
          <div className="font-semibold">{r.product?.name}</div>
          <div className="text-xs" style={{ color: MUTED }}>Qty: {r.quantity}</div>
        </div>
      ),
    },
    {
      title: "Branch",
      key: "branch",
      render: (_, r) => (
        <span><ShopOutlined className="mr-1" style={{ color: ACCENT }} />{r.branch?.name || "-"}</span>
      ),
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      render: (v) => v || <span style={{ color: MUTED }}>-</span>,
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
        if (r.status === "approved" && r.approved_at) return <span style={{ color: ACCENT }}>{fmtDate(r.approved_at)}</span>;
        if (r.status === "rejected" && r.rejected_at) return <span style={{ color: "#F87171" }}>{fmtDate(r.rejected_at)}</span>;
        return <span style={{ color: MUTED }}>-</span>;
      },
    },
    {
      title: "Admin Notes",
      dataIndex: "admin_notes",
      key: "admin_notes",
      render: (v) => v || <span style={{ color: MUTED }}>-</span>,
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
                  style={GRADIENT_BTN}>
                  Approve
                </Button>
              </Tooltip>
              <Tooltip title="Reject">
                <Button size="small" icon={<CloseOutlined />}
                  onClick={() => { setSelected(r); setShowRejectModal(true); }}
                  style={RED_BTN}>
                  Reject
                </Button>
              </Tooltip>
            </>
          )}
          {r.status !== "pending" && <span className="text-sm" style={{ color: MUTED }}>No actions</span>}
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
    <div className="nm-dark min-h-screen p-6" style={{ background: "#1F1A2E" }}>
      

      {/* Header */}
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
                <InboxOutlined className="mr-2" style={{ color: ACCENT }} />
                Supply Request Management
              </h1>
              <p className="text-sm" style={{ color: MUTED }}>
                Approve or reject staff supply requests
              </p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="relative z-10 mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl px-4 py-3" style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}>
              <p className="text-xs" style={{ color: MUTED }}>Total Requests</p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{stats.total}</p>
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}>
              <p className="text-xs" style={{ color: MUTED }}>Pending</p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{stats.pending}</p>
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}>
              <p className="text-xs" style={{ color: MUTED }}>Approved</p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{stats.approved}</p>
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}>
              <p className="text-xs" style={{ color: MUTED }}>Approved Qty</p>
              <p className="mt-1 text-xl font-bold" style={{ color: ACCENT }}>{stats.totalQty} pcs</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <Card
        className="mb-6"
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
        styles={{ body: { background: PANEL_BG } }}
      >
        <Space>
          <span className="text-sm font-medium" style={{ color: MUTED }}>Filter by status:</span>
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
            onClick={() => refetch()}
            loading={isLoading}
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
              Supply Requests
            </h2>
            <p className="mt-1 text-sm" style={{ color: MUTED }}>
              Review and process staff supply requests
            </p>
          </div>
          <Tag
            className="rounded-full px-3 py-1 text-sm"
            style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}
          >
            {filtered.length} request(s)
          </Tag>
        </div>
      </div>

      <Card
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
        styles={{ body: { background: PANEL_BG } }}
      >
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={isLoading}
          pagination={clientPagination({ label: "requests" })}
          locale={{
            emptyText: (
              <div className="py-10 text-center">
                <div
                  className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: ACCENT_SOFT, color: ACCENT }}
                >
                  <InboxOutlined className="text-3xl" />
                </div>
                <p className="font-semibold" style={{ color: TEXT }}>No supply requests found</p>
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
            ><CheckOutlined /></div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>Approve Supply Request</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>Approve this staff supply request</p>
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
          <div className="mb-4 rounded-xl p-4" style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}30` }}>
            <div className="font-semibold" style={{ color: TEXT }}>{selected.user?.firstname} {selected.user?.lastname}</div>
            <div className="font-bold" style={{ color: ACCENT }}>{selected.product?.name}</div>
            <div className="text-sm" style={{ color: MUTED }}>Quantity: {selected.quantity}</div>
            <div className="text-sm" style={{ color: MUTED }}>Branch: {selected.branch?.name}</div>
            {selected.reason && <div className="mt-1 text-sm" style={{ color: MUTED }}>Reason: {selected.reason}</div>}
          </div>
        )}
        <Form form={approveForm} layout="vertical" onFinish={handleApprove} initialValues={{ admin_notes: "" }}>
          <Form.Item
            label={<span className="text-sm font-semibold" style={{ color: TEXT }}>Admin Notes (Optional)</span>}
            name="admin_notes"
            rules={[{ max: 500, message: "Notes cannot exceed 500 characters" }]}
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
          <div className="mb-4 rounded-xl p-3" style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}30` }}>
            <p className="mb-0 text-xs" style={{ color: ACCENT }}>
              <InfoCircleOutlined className="mr-1" />
              This action will approve the supply request and notify the staff member.
            </p>
          </div>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => { setShowApproveModal(false); approveForm.resetFields(); setSelected(null); }}
                disabled={approveMutation.isPending}
                style={SECONDARY_BTN}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={approveMutation.isPending}
                icon={<CheckOutlined />}
                style={GRADIENT_BTN}
              >
                Approve
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
            ><CloseOutlined /></div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>Reject Supply Request</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>Reject this staff supply request</p>
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
          <div className="mb-4 rounded-xl p-4" style={{ background: RED_SOFT, border: `1px solid ${RED}30` }}>
            <div className="font-semibold" style={{ color: TEXT }}>{selected.user?.firstname} {selected.user?.lastname}</div>
            <div className="font-bold" style={{ color: "#F87171" }}>{selected.product?.name}</div>
            <div className="text-sm" style={{ color: MUTED }}>Quantity: {selected.quantity}</div>
            <div className="text-sm" style={{ color: MUTED }}>Branch: {selected.branch?.name}</div>
            {selected.reason && <div className="mt-1 text-sm" style={{ color: MUTED }}>Reason: {selected.reason}</div>}
          </div>
        )}
        <Form form={rejectForm} layout="vertical" onFinish={handleReject} initialValues={{ admin_notes: "" }}>
          <Form.Item
            label={<span className="text-sm font-semibold" style={{ color: TEXT }}>Rejection Reason (Optional)</span>}
            name="admin_notes"
            rules={[{ max: 500, message: "Reason cannot exceed 500 characters" }]}
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
          <div className="mb-4 rounded-xl p-3" style={{ background: RED_SOFT, border: `1px solid ${RED}30` }}>
            <p className="mb-0 text-xs" style={{ color: "#F87171" }}>
              <InfoCircleOutlined className="mr-1" />
              This action will reject the supply request and notify the staff member.
            </p>
          </div>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => { setShowRejectModal(false); rejectForm.resetFields(); setSelected(null); }}
                disabled={rejectMutation.isPending}
                style={SECONDARY_BTN}
              >
                Cancel
              </Button>
              <Button
                htmlType="submit"
                loading={rejectMutation.isPending}
                icon={<CloseOutlined />}
                style={RED_BTN}
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