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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/config/api";
import Loading from "@/components/Loading";

function Staff() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [editingStaff, setEditingStaff] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const fetchStaff = async ({ queryKey }) => {
    const [_, page, search, position] = queryKey;
    const params = new URLSearchParams();
    params.append("paginate", "true");
    params.append("per_page", PAGE_SIZE);
    params.append("page", page);
    if (search) params.append("search", search);
    if (position) {
      params.append("role", position === "Rider" ? "delivery_rider" : "staff");
    }
    const res = await api.get(`/staff?${params.toString()}`);
    return res.data;
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["staff", currentPage, searchTerm, positionFilter],
    queryFn: fetchStaff,
    placeholderData: (prev) => prev,
  });

  const staffList = data?.data || [];
  const total = data?.total || 0;

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
              style={{ backgroundColor: getPosition(r) === "Rider" ? '#F59E0B' : '#EA580C' }}
            />
            <div>
              <div className="font-semibold">
                {r.firstname} {r.middlename ? `${r.middlename.charAt(0)}. ` : ''}{r.lastname}
              </div>
              <div className="text-gray-400 text-xs">{r.username}</div>
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
          {r.email && <div><MailOutlined className="mr-1 text-gray-400" />{r.email}</div>}
          {r.phone && <div><PhoneOutlined className="mr-1 text-gray-400" />{r.phone}</div>}
          {!r.email && !r.phone && <span className="text-gray-400">—</span>}
        </div>
      ),
    },
    {
      title: "Position",
      key: "position",
      render: (_, r) => {
        const position = getPosition(r);
        return position === "Rider"
          ? <Tag color="orange">Rider</Tag>
          : <Tag color="gold">Staff</Tag>;
      },
    },
    {
      title: "Status",
      key: "status",
      render: (_, r) =>
        r.is_active !== false
          ? <Tag color="green" icon={<CheckCircleOutlined />}>Active</Tag>
          : <Tag color="red" icon={<CloseCircleOutlined />}>Inactive</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, r) => (
        <Space>
          <Tooltip title="Edit">
            <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} className="rounded-xl" />
          </Tooltip>
          <Tooltip title="Delete">
            <Button danger size="small" icon={<DeleteOutlined />} onClick={() => {
              setSelectedStaff(r);
              setShowDeleteModal(true);
            }} className="rounded-xl" />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 bg-gradient-to-br from-[#FFF8ED]/80 via-[#FFFDF9] to-[#FFF1E6]/80 min-h-screen">
      {/* Header - NewMoon Style */}
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
                <TeamOutlined className="mr-2 text-[#F97316]" />
                Staff Management
              </h1>
              <p className="text-white/80 text-sm">Manage your staff members and riders</p>
            </div>
            <Input
              placeholder="Search by name or username..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{ width: 300 }}
              allowClear
              className="rounded-xl border-0 focus:border-[#F97316] bg-white/95 py-2"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons - NewMoon Style */}
      <Card className="mb-6 rounded-xl border border-[#F5EDE0] shadow-sm">
        <Space wrap>
          <Select
            placeholder="Filter by position"
            value={positionFilter}
            onChange={(v) => { setPositionFilter(v); setCurrentPage(1); }}
            allowClear
            style={{ width: 160 }}
            onClear={() => setPositionFilter(null)}
            className="rounded-xl"
          >
            <Select.Option value="Staff">Staff</Select.Option>
            <Select.Option value="Rider">Rider</Select.Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isLoading}
            className="rounded-xl border-[#EA580C] text-[#EA580C] hover:bg-[#FFF1E6] hover:border-[#F97316] transition-all duration-200"
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { addForm.resetFields(); setShowAddModal(true); }}
            className="rounded-xl bg-gradient-to-br from-[#EA580C] via-[#F97316] to-[#F59E0B] border-none shadow-[0_4px_15px_rgba(234,88,12,0.35)] hover:opacity-90 hover:brightness-110 transition-all duration-200"
          >
            Add Staff
          </Button>
        </Space>
      </Card>

      {/* Staff Members Section - NewMoon Style */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#451A03]">
              <TeamOutlined className="mr-2 text-[#F97316]" />
              Staff Members
            </h2>
            <p className="text-sm text-gray-500 mt-1">View and manage all staff and rider accounts</p>
          </div>
          <Tag className="text-sm px-3 py-1 rounded-full bg-gradient-to-br from-[#EA580C] to-[#F59E0B] text-white border-none">
            {total} total
          </Tag>
        </div>
      </div>

      <Card className="rounded-xl border border-[#F5EDE0] shadow-sm">
        {isLoading ? (
          <Loading full text="Loading staff members..." />
        ) : (
        <Table
          columns={columns}
          dataSource={staffList}
          rowKey="id"
          loading={false}
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            total,
            onChange: setCurrentPage,
            showSizeChanger: false,
            showTotal: (t) => `Total ${t} staff members`,
          }}
          locale={{ emptyText: <div className="py-10 text-center"><div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#FFF1E6] to-[#FFE3C9] rounded-2xl flex items-center justify-center mb-3"><TeamOutlined className="text-3xl text-[#F97316]" /></div><p className="text-[#451A03] font-semibold">No staff members found</p><p className="text-gray-400 text-sm">Try adjusting your search or filter</p></div> }}
        />
        )}
      </Card>

      {/* Add Modal - NewMoon Style */}
      <Modal
        title={
          <span>
            <PlusOutlined className="mr-2 text-[#F97316]" />
            <span className="text-[#451A03] font-bold">Add Staff Member</span>
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
              <Form.Item label={<span className="text-[#451A03] font-medium">First Name</span>} name="firstname" rules={[{ required: true, message: "First name is required" }]}>
                <Input placeholder="First name" className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={<span className="text-[#451A03] font-medium">Middle Name</span>} name="middlename">
                <Input placeholder="Middle name" className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={<span className="text-[#451A03] font-medium">Last Name</span>} name="lastname" rules={[{ required: true, message: "Last name is required" }]}>
                <Input placeholder="Last name" className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={<span className="text-[#451A03] font-medium">Username</span>} name="username" rules={[{ required: true, message: "Username is required" }]}>
                <Input placeholder="Enter username" prefix={<IdcardOutlined className="text-gray-400" />} className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={<span className="text-[#451A03] font-medium">Password</span>} name="password">
                <Input.Password placeholder="Default: default123" prefix={<KeyOutlined className="text-gray-400" />} className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={<span className="text-[#451A03] font-medium">Email</span>} name="email">
                <Input placeholder="Enter email" prefix={<MailOutlined className="text-gray-400" />} className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={<span className="text-[#451A03] font-medium">Phone</span>} name="phone">
                <Input placeholder="Enter phone number" prefix={<PhoneOutlined className="text-gray-400" />} className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label={<span className="text-[#451A03] font-medium">Address</span>} name="address">
            <Input placeholder="Enter address" prefix={<HomeOutlined className="text-gray-400" />} className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]" />
          </Form.Item>
          <Form.Item label={<span className="text-[#451A03] font-medium">Position</span>} name="position" rules={[{ required: true, message: "Position is required" }]} initialValue="Staff">
            <Select className="rounded-xl">
              <Select.Option value="Staff">Staff</Select.Option>
              <Select.Option value="Rider">Rider</Select.Option>
            </Select>
          </Form.Item>
          <div className="p-3 mb-4 rounded-xl bg-[#FFF1E6]">
            <p className="text-sm text-[#451A03]"><InfoCircleOutlined className="mr-1 text-[#F97316]" /> New staff will be set as active by default. Default password is "default123".</p>
          </div>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => { setShowAddModal(false); addForm.resetFields(); }} className="rounded-xl">Cancel</Button>
              <Button type="primary" htmlType="submit" loading={addMutation.isPending} className="rounded-xl bg-gradient-to-br from-[#EA580C] via-[#F97316] to-[#F59E0B] border-none shadow-[0_4px_15px_rgba(234,88,12,0.35)] hover:opacity-90 hover:brightness-110 transition-all duration-200">Add Staff</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal - NewMoon Style */}
      <Modal
        title={
          <span>
            <EditOutlined className="mr-2 text-[#F97316]" />
            <span className="text-[#451A03] font-bold">Edit Staff Member</span>
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
              <Form.Item label={<span className="text-[#451A03] font-medium">First Name</span>} name="firstname" rules={[{ required: true, message: "First name is required" }]}>
                <Input placeholder="First name" className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={<span className="text-[#451A03] font-medium">Middle Name</span>} name="middlename">
                <Input placeholder="Middle name" className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label={<span className="text-[#451A03] font-medium">Last Name</span>} name="lastname" rules={[{ required: true, message: "Last name is required" }]}>
                <Input placeholder="Last name" className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={<span className="text-[#451A03] font-medium">Username</span>} name="username">
                <Input prefix={<IdcardOutlined className="text-gray-400" />} disabled className="rounded-xl" />
              </Form.Item>
              <span className="text-xs text-gray-400 -mt-3 block">Username cannot be changed</span>
            </Col>
            <Col span={12}>
              <Form.Item label={<span className="text-[#451A03] font-medium">New Password</span>} name="password">
                <Input.Password placeholder="Leave blank to keep current" prefix={<KeyOutlined className="text-gray-400" />} className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={<span className="text-[#451A03] font-medium">Email</span>} name="email">
                <Input placeholder="Enter email" prefix={<MailOutlined className="text-gray-400" />} className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={<span className="text-[#451A03] font-medium">Phone</span>} name="phone">
                <Input placeholder="Enter phone number" prefix={<PhoneOutlined className="text-gray-400" />} className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label={<span className="text-[#451A03] font-medium">Address</span>} name="address">
            <Input placeholder="Enter address" prefix={<HomeOutlined className="text-gray-400" />} className="rounded-xl border-[#F5EDE0] focus:border-[#F97316]" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={<span className="text-[#451A03] font-medium">Position</span>} name="position" rules={[{ required: true, message: "Position is required" }]}>
                <Select className="rounded-xl">
                  <Select.Option value="Staff">Staff</Select.Option>
                  <Select.Option value="Rider">Rider</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={<span className="text-[#451A03] font-medium">Status</span>} name="is_active" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => { setShowEditModal(false); setEditingStaff(null); editForm.resetFields(); }} className="rounded-xl">Cancel</Button>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending} className="rounded-xl bg-gradient-to-br from-[#EA580C] via-[#F97316] to-[#F59E0B] border-none shadow-[0_4px_15px_rgba(234,88,12,0.35)] hover:opacity-90 hover:brightness-110 transition-all duration-200">Update Staff</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Delete Modal - NewMoon Style */}
      <Modal
        title={
          <span>
            <DeleteOutlined className="mr-2 text-[#F97316]" />
            <span className="text-[#451A03] font-bold">Confirm Delete</span>
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
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #EA580C, #F59E0B)' }}>
            <DeleteOutlined className="text-white text-2xl" />
          </div>
          <p className="text-lg font-semibold mb-2 text-[#451A03]">
            Are you sure you want to delete this staff member?
          </p>
          {selectedStaff && (
            <div className="p-3 bg-[#FFF1E6] rounded-xl text-left">
              <p><UserOutlined className="mr-2 text-[#F97316]" /><strong>{selectedStaff.firstname} {selectedStaff.lastname}</strong></p>
              <p className="text-sm text-gray-500"><IdcardOutlined className="mr-2" />{selectedStaff.username}</p>
              <Tag color={getPosition(selectedStaff) === "Rider" ? "orange" : "gold"}>{getPosition(selectedStaff)}</Tag>
            </div>
          )}
          {selectedStaff?.is_active !== false ? (
            <p className="text-sm text-[#DC2626] mt-3"><InfoCircleOutlined className="mr-1" /> This action cannot be undone. Consider disabling instead.</p>
          ) : (
            <p className="text-sm text-[#DC2626] mt-3"><InfoCircleOutlined className="mr-1" /> This staff member is already inactive. This will permanently remove them.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default Staff;
