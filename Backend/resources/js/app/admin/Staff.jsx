import React, { useState } from "react";
import {
  Card, Table, Tag, Button, Modal, Form, Input, Select, Space, message, Row, Col, Switch, Tooltip, Avatar
} from "antd";
import {
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  TeamOutlined,
  KeyOutlined,
  ReloadOutlined,
  SearchOutlined,
  MailOutlined,
  PhoneOutlined,
  HomeOutlined,
  IdcardOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/config/api";
import Loading from "@/components/Loading";
import { useServerPagination } from "@/components/Pagination";

// ─── Palette — matches ProductList (dark plum + mint) ────────────────────
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

function Staff() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [editingStaff, setEditingStaff] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState(null);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const {
    data: staffList,
    total,
    isLoading,
    pagination,
    setCurrentPage,
    refetch,
  } = useServerPagination({
    queryKey: ["staff", searchTerm, positionFilter],
    url: "/staff",
    params: {
      paginate: "true",
      search: searchTerm || undefined,
      role: positionFilter ? (positionFilter === "Rider" ? "delivery_rider" : "staff") : undefined,
    },
    label: "staff",
    placeholderData: (prev) => prev,
  });

  const getPosition = (s) => (s.role === "delivery_rider" ? "Rider" : "Staff");

  const addMutation = useMutation({
    mutationFn: (payload) => api.post("/staff", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      message.success("Staff member added successfully!");
      setShowAddModal(false);
      addForm.resetFields();
    },
    onError: (err) => {
      message.error(err?.response?.data?.message || "Error adding staff member");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/staff/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      message.success("Staff member updated successfully!");
      setShowEditModal(false);
      setEditingStaff(null);
      editForm.resetFields();
    },
    onError: (err) => {
      message.error(err?.response?.data?.message || "Error updating staff member");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/staff/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      message.success("Staff member deleted successfully");
      setShowDeleteModal(false);
      setSelectedStaff(null);
    },
    onError: (err) => {
      const errorData = err?.response?.data;
      if (errorData?.code === 'STAFF_DELETE_CONSTRAINT') {
        message.error(errorData.message || "Cannot delete staff with existing records. Consider disabling instead.");
        setShowDeleteModal(false);
      } else {
        message.error(errorData?.message || "Error deleting staff member");
      }
    },
  });

  const handleAdd = async () => {
    try {
      const values = await addForm.validateFields();
      await addMutation.mutateAsync({
        username: values.username,
        password: values.password || "default123",
        firstname: values.firstname,
        lastname: values.lastname,
        middlename: values.middlename || null,
        address: values.address || null,
        email: values.email || null,
        phone: values.phone || null,
        position: values.position,
      });
    } catch (err) {
      if (err.errorFields) return;
    }
  };

  const handleUpdate = async () => {
    try {
      const values = await editForm.validateFields();
      const payload = {
        firstname: values.firstname,
        lastname: values.lastname,
        middlename: values.middlename || null,
        address: values.address || null,
        email: values.email || null,
        phone: values.phone || null,
        position: values.position,
        is_active: values.is_active,
      };
      if (values.password) payload.password = values.password;
      await updateMutation.mutateAsync({ id: editingStaff.id, payload });
    } catch (err) {
      if (err.errorFields) return;
    }
  };

  const openEdit = (s) => {
    setEditingStaff(s);
    setShowEditModal(true);
    setTimeout(() => editForm.setFieldsValue({
      username: s.username || "",
      firstname: s.firstname || "",
      lastname: s.lastname || "",
      middlename: s.middlename || "",
      address: s.address || "",
      position: getPosition(s),
      email: s.email || "",
      phone: s.phone || "",
      is_active: s.is_active !== undefined ? s.is_active : true,
      password: "",
    }), 0);
  };

  const columns = [
    {
      title: "User",
      key: "user",
      render: (_, r) => {
        let initials = (r.firstname?.[0] || '') + (r.lastname?.[0] || '');
        return (
          <div className="flex items-center gap-3">
            <Avatar
              size={36}
              icon={<UserOutlined />}
              style={{ backgroundColor: getPosition(r) === "Rider" ? ACCENT_DEEP : ACCENT, color: "#1F1A2E" }}
            />
            <div>
              <div className="font-semibold">
                {r.firstname} {r.middlename ? `${r.middlename.charAt(0)}. ` : ''}{r.lastname}
              </div>
              <div className="text-xs" style={{ color: MUTED }}>{r.username}</div>
            </div>
          </div>
        );
      },
    },
    {
      title: "Contact",
      key: "contact",
      render: (_, r) => (
        <div className="text-sm">
          {r.email && <div><MailOutlined className="mr-1" style={{ color: MUTED }} />{r.email}</div>}
          {r.phone && <div><PhoneOutlined className="mr-1" style={{ color: MUTED }} />{r.phone}</div>}
          {!r.email && !r.phone && <span style={{ color: MUTED }}>—</span>}
        </div>
      ),
    },
    {
      title: "Position",
      key: "position",
      render: (_, r) => {
        const position = getPosition(r);
        return position === "Rider"
          ? <Tag className="rounded-full px-3 py-1" style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}>Rider</Tag>
          : <Tag className="rounded-full px-3 py-1" style={{ background: AMBER_SOFT, color: AMBER, border: `1px solid ${AMBER}30` }}>Staff</Tag>;
      },
    },
    {
      title: "Status",
      key: "status",
      render: (_, r) =>
        r.is_active !== false
          ? <Tag className="rounded-full px-3 py-1" style={{ background: GREEN_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }} icon={<CheckCircleOutlined />}>Active</Tag>
          : <Tag className="rounded-full px-3 py-1" style={{ background: RED_SOFT, color: "#F87171", border: `1px solid ${RED}30` }} icon={<CloseCircleOutlined />}>Inactive</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, r) => (
        <Space>
          <Tooltip title="Edit">
            <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} style={GRADIENT_BTN} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button danger size="small" icon={<DeleteOutlined />} onClick={() => {
              setSelectedStaff(r);
              setShowDeleteModal(true);
            }} className="rounded-xl" style={{ background: RED_SOFT, border: `1px solid ${RED}40`, color: "#F87171" }} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="nm-dark min-h-screen p-6" style={{ background: "#1F1A2E" }}>
      
      {/* Header — dark plum + mint */}
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
                <TeamOutlined className="mr-2" style={{ color: ACCENT }} />
                Staff Management
              </h1>
              <p className="text-sm" style={{ color: MUTED }}>Manage your staff members and riders</p>
            </div>
            <Input
              placeholder="Search by name or username..."
              prefix={<SearchOutlined style={{ color: MUTED }} />}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{ width: 300 }}
              allowClear
              className="rounded-xl py-2"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <Card
        className="mb-6"
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
        styles={{ body: { background: PANEL_BG } }}
      >
        <Space wrap>
          <Select
            placeholder="Filter by position"
            value={positionFilter}
            onChange={(v) => { setPositionFilter(v); setCurrentPage(1); }}
            allowClear
            style={{ width: 160 }}
            onClear={() => setPositionFilter(null)}
            popupClassName="nm-dark-select-dropdown"
          >
            <Select.Option value="Staff">Staff</Select.Option>
            <Select.Option value="Rider">Rider</Select.Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
            style={GHOST_BTN}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { addForm.resetFields(); setShowAddModal(true); }}
            style={GRADIENT_BTN}
          >
            Add Staff
          </Button>
        </Space>
      </Card>

      {/* Staff Members Section */}
      <div className="mb-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: TEXT }}>
              <TeamOutlined className="mr-2" style={{ color: ACCENT }} />
              Staff Members
            </h2>
            <p className="mt-1 text-sm" style={{ color: MUTED }}>View and manage all staff and rider accounts</p>
          </div>
          <Tag
            className="rounded-full px-3 py-1 text-sm font-semibold"
            style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}
          >
            {total} total
          </Tag>
        </div>
      </div>

      <Card
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
        styles={{ body: { background: PANEL_BG } }}
      >
        {isLoading ? (
          <Loading full text="Loading staff members..." />
        ) : (
        <Table
          columns={columns}
          dataSource={staffList}
          rowKey="id"
          loading={false}
          pagination={pagination}
          locale={{
            emptyText: (
              <div className="py-10 text-center">
                <div
                  className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: ACCENT_SOFT, color: ACCENT }}
                >
                  <TeamOutlined className="text-3xl" />
                </div>
                <p className="font-semibold" style={{ color: TEXT }}>No staff members found</p>
                <p className="text-sm" style={{ color: MUTED }}>Try adjusting your search or filter</p>
              </div>
            ),
          }}
        />
        )}
      </Card>

      {/* Add Modal - NewMoon Style */}
      <Modal
        title={
          <span>
            <PlusOutlined className="mr-2" style={{ color: ACCENT }} />
            <span style={{ color: TEXT, fontWeight: 700 }}>Add Staff Member</span>
          </span>
        }
        open={showAddModal}
        onCancel={() => { setShowAddModal(false); addForm.resetFields(); }}
        footer={null}
        width={600}
        destroyOnHidden
        className="rounded-2xl"
      >
        <Form form={addForm} layout="vertical" onFinish={handleAdd}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label={<span style={FIELD_LABEL}>First Name</span>} name="firstname" rules={[{ required: true, message: "First name is required" }]}>
                <Input placeholder="First name" className="rounded-xl" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={<span style={FIELD_LABEL}>Middle Name</span>} name="middlename">
                <Input placeholder="Middle name" className="rounded-xl" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={<span style={FIELD_LABEL}>Last Name</span>} name="lastname" rules={[{ required: true, message: "Last name is required" }]}>
                <Input placeholder="Last name" className="rounded-xl" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={<span style={FIELD_LABEL}>Username</span>} name="username" rules={[{ required: true, message: "Username is required" }]}>
                <Input placeholder="Enter username" prefix={<IdcardOutlined style={{ color: MUTED }} />} className="rounded-xl" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={<span style={FIELD_LABEL}>Password</span>} name="password">
                <Input.Password placeholder="Default: default123" prefix={<KeyOutlined style={{ color: MUTED }} />} className="rounded-xl" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={<span style={FIELD_LABEL}>Email</span>} name="email">
                <Input placeholder="Enter email" prefix={<MailOutlined style={{ color: MUTED }} />} className="rounded-xl" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={<span style={FIELD_LABEL}>Phone</span>} name="phone">
                <Input placeholder="Enter phone number" prefix={<PhoneOutlined style={{ color: MUTED }} />} className="rounded-xl" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label={<span style={FIELD_LABEL}>Address</span>} name="address">
            <Input placeholder="Enter address" prefix={<HomeOutlined style={{ color: MUTED }} />} className="rounded-xl" />
          </Form.Item>
<Form.Item label={<span style={FIELD_LABEL}>Position</span>} name="position" rules={[{ required: true, message: "Position is required" }]} initialValue="Staff">
          <Select className="rounded-xl" popupClassName="nm-dark-select-dropdown">
            <Select.Option value="Staff">Staff</Select.Option>
            <Select.Option value="Rider">Rider</Select.Option>
          </Select>
        </Form.Item>
        <div
          className="mb-4 rounded-xl p-3"
          style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}30` }}
        >
          <p className="text-sm" style={{ color: ACCENT }}>
            <InfoCircleOutlined className="mr-1" style={{ color: ACCENT }} /> New staff will be set as active by default. Default password is "default123".
          </p>
        </div>
        <Form.Item className="mb-0">
          <Space className="w-full justify-end">
            <Button onClick={() => { setShowAddModal(false); addForm.resetFields(); }} className="rounded-xl" style={SECONDARY_BTN}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={addMutation.isPending} className="rounded-xl" style={GRADIENT_BTN}>Add Staff</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>

      {/* Edit Modal */}
      <Modal
        title={
          <span>
            <EditOutlined className="mr-2" style={{ color: ACCENT }} />
            <span style={{ color: TEXT, fontWeight: 700 }}>Edit Staff Member</span>
          </span>
        }
        open={showEditModal}
        onCancel={() => { setShowEditModal(false); setEditingStaff(null); editForm.resetFields(); }}
        footer={null}
        width={600}
        destroyOnHidden
        className="rounded-2xl"
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdate}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label={<span style={FIELD_LABEL}>First Name</span>} name="firstname" rules={[{ required: true, message: "First name is required" }]}>
                <Input placeholder="First name" className="rounded-xl" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={<span style={FIELD_LABEL}>Middle Name</span>} name="middlename">
                <Input placeholder="Middle name" className="rounded-xl" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={<span style={FIELD_LABEL}>Last Name</span>} name="lastname" rules={[{ required: true, message: "Last name is required" }]}>
                <Input placeholder="Last name" className="rounded-xl" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={<span style={FIELD_LABEL}>Username</span>} name="username">
                <Input prefix={<IdcardOutlined style={{ color: MUTED }} />} disabled className="rounded-xl" />
              </Form.Item>
              <span className="-mt-3 block text-xs" style={{ color: MUTED }}>Username cannot be changed</span>
            </Col>
            <Col span={12}>
              <Form.Item label={<span style={FIELD_LABEL}>New Password</span>} name="password">
                <Input.Password placeholder="Leave blank to keep current" prefix={<KeyOutlined style={{ color: MUTED }} />} className="rounded-xl" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={<span style={FIELD_LABEL}>Email</span>} name="email">
                <Input placeholder="Enter email" prefix={<MailOutlined style={{ color: MUTED }} />} className="rounded-xl" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={<span style={FIELD_LABEL}>Phone</span>} name="phone">
                <Input placeholder="Enter phone number" prefix={<PhoneOutlined style={{ color: MUTED }} />} className="rounded-xl" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label={<span style={FIELD_LABEL}>Address</span>} name="address">
            <Input placeholder="Enter address" prefix={<HomeOutlined style={{ color: MUTED }} />} className="rounded-xl" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={<span style={FIELD_LABEL}>Position</span>} name="position" rules={[{ required: true, message: "Position is required" }]}>
                <Select className="rounded-xl" popupClassName="nm-dark-select-dropdown">
                  <Select.Option value="Staff">Staff</Select.Option>
                  <Select.Option value="Rider">Rider</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={<span style={FIELD_LABEL}>Status</span>} name="is_active" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => { setShowEditModal(false); setEditingStaff(null); editForm.resetFields(); }} className="rounded-xl" style={SECONDARY_BTN}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending} className="rounded-xl" style={GRADIENT_BTN}>Update Staff</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Delete Modal */}
      <Modal
        title={
          <span>
            <DeleteOutlined className="mr-2" style={{ color: ACCENT }} />
            <span style={{ color: TEXT, fontWeight: 700 }}>Confirm Delete</span>
          </span>
        }
        open={showDeleteModal}
        onCancel={() => { setShowDeleteModal(false); setSelectedStaff(null); }}
        onOk={() => deleteMutation.mutate(selectedStaff?.id)}
        okText="Delete"
        okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
        cancelText="Cancel"
        width={420}
        className="rounded-2xl"
      >
        <div className="py-4 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: RED_SOFT, border: `1px solid ${RED}30` }}
          >
            <DeleteOutlined className="text-2xl" style={{ color: "#F87171" }} />
          </div>
          <p className="mb-2 text-lg font-semibold" style={{ color: TEXT }}>
            Are you sure you want to delete this staff member?
          </p>
          {selectedStaff && (
            <div className="rounded-xl p-3 text-left" style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}30` }}>
              <p><UserOutlined className="mr-2" style={{ color: ACCENT }} /><strong>{selectedStaff.firstname} {selectedStaff.lastname}</strong></p>
              <p className="text-sm" style={{ color: MUTED }}><IdcardOutlined className="mr-2" />{selectedStaff.username}</p>
              <Tag
                className="rounded-full px-3 py-1"
                style={getPosition(selectedStaff) === "Rider"
                  ? { background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }
                  : { background: AMBER_SOFT, color: AMBER, border: `1px solid ${AMBER}30` }}
              >
                {getPosition(selectedStaff)}
              </Tag>
            </div>
          )}
          {selectedStaff?.is_active !== false ? (
            <p className="mt-3 text-sm" style={{ color: "#F87171" }}><InfoCircleOutlined className="mr-1" /> This action cannot be undone. Consider disabling instead.</p>
          ) : (
            <p className="mt-3 text-sm" style={{ color: "#F87171" }}><InfoCircleOutlined className="mr-1" /> This staff member is already inactive. This will permanently remove them.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default Staff;
