import { useState } from "react";
import { Card, Table, Tag, Button, Modal, Form, Input, Select, Space, message, Tooltip, Switch } from "antd";
import {
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  BankOutlined,
  TeamOutlined,
  ReloadOutlined,
  CarOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from "@/config/api";

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

const fetchStaff = async () => {
  try {
    const response = await api.get("/staff?paginate=false");
    if (response.data?.data) {
      return Array.isArray(response.data.data) ? response.data.data : [];
    }
    return Array.isArray(response.data) ? response.data : [];
  } catch (e) {
    console.error("Failed to fetch staff:", e);
    return [];
  }
};

const fetchAssignments = async () => {
  try {
    const response = await api.get("/staff-assignments?paginate=false");
    if (response.data?.data) {
      return Array.isArray(response.data.data) ? response.data.data : [];
    }
    return Array.isArray(response.data) ? response.data : [];
  } catch (e) {
    console.error("Failed to fetch assignments:", e);
    return [];
  }
};

const fetchBranches = async () => {
  try {
    const response = await api.get("/branches");
    const branchesData = response.data?.data;
    return Array.isArray(branchesData) ? branchesData : (Array.isArray(response.data) ? response.data : []);
  } catch (e) {
    console.error("Failed to fetch branches:", e);
    return [];
  }
};

const createAssignment = async (data) => {
  const response = await api.post("/staff-assignments", data);
  return response.data;
};

const updateAssignment = async ({ id, data }) => {
  const response = await api.put(`/staff-assignments/${id}`, data);
  return response.data;
};

const deleteAssignment = async (id) => {
  const response = await api.delete(`/staff-assignments/${id}`);
  return response.data;
};

const toggleAssignmentStatus = async ({ id, is_active }) => {
  const response = await api.put(`/staff-assignments/${id}`, { is_active });
  return response.data;
};

function BranchAssignments() {
  const queryClient = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff'],
    queryFn: fetchStaff,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['assignments'],
    queryFn: fetchAssignments,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: fetchBranches,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const loading = staffLoading || assignmentsLoading || branchesLoading;

  const staffList = Array.isArray(staff) ? staff : [];
  const branchesList = Array.isArray(branches) ? branches : [];
  const staffOnly = staffList.filter(user => user.role === 'staff');
  const riders = staffList.filter(user => user.role === 'delivery_rider');
  const allUsers = [...staffOnly, ...riders];

  const usersWithAssignment = allUsers.map((user) => {
    const assignment = assignments.find((a) => a.user_id === user.id && a.is_active) ||
                       assignments.find((a) => a.user_id === user.id);
    return {
      ...user,
      assignment: assignment || null,
      branch: assignment?.branch || null,
      position: assignment?.position || "Unassigned",
      daily_rate: assignment?.daily_rate || 0,
      is_active: assignment?.is_active ?? false,
    };
  });

  const totalStaff = staffOnly.length;
  const totalRiders = riders.length;
  const totalUsers = allUsers.length;
  const assignedCount = usersWithAssignment.filter((u) => u.assignment).length;
  const unassignedCount = totalUsers - assignedCount;
  const totalBranches = branchesList.length;

  const addMutation = useMutation({
    mutationFn: createAssignment,
    onSuccess: () => {
      message.success("Branch assignment added successfully");
      setShowAddModal(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => {
      const validationErrors = error?.response?.data?.errors;
      if (validationErrors) {
        const firstField = Object.keys(validationErrors)[0];
        const firstMessage = validationErrors[firstField]?.[0];
        message.error(firstMessage || "Failed to add branch assignment");
      } else {
        message.error(error?.response?.data?.message || "Failed to add branch assignment");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateAssignment,
    onSuccess: () => {
      message.success("Branch assignment updated successfully");
      setShowEditModal(false);
      setEditingAssignment(null);
      editForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => {
      const validationErrors = error?.response?.data?.errors;
      if (validationErrors) {
        const firstField = Object.keys(validationErrors)[0];
        const firstMessage = validationErrors[firstField]?.[0];
        message.error(firstMessage || "Failed to update branch assignment");
      } else {
        message.error(error?.response?.data?.message || "Failed to update branch assignment");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAssignment,
    onSuccess: () => {
      message.success("Branch assignment deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => {
      message.error(error?.response?.data?.message || "Failed to delete branch assignment");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleAssignmentStatus,
    onSuccess: (data, variables) => {
      message.success(variables.is_active ? "Assignment activated." : "Assignment deactivated.");
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (error) => {
      message.error(error?.response?.data?.message || "Failed to update assignment status.");
    },
  });

  const handleAddAssignment = async (values) => {
    if (!values.user_id || !values.branch_id) {
      message.error("Please select both a user and a branch");
      return;
    }
    const selectedUser = allUsers.find(u => u.id === Number(values.user_id));
    const defaultPosition = selectedUser?.role === 'delivery_rider' ? 'Delivery Rider' : 'Staff';
    const defaultRate = selectedUser?.role === 'delivery_rider' ? 400 : 500;
    const payload = {
      user_id: Number(values.user_id),
      branch_id: Number(values.branch_id),
      position: values.position || defaultPosition,
      daily_rate: values.daily_rate ? Number(values.daily_rate) : defaultRate,
      is_active: true,
    };
    await addMutation.mutateAsync(payload);
  };

  const handleUpdateAssignment = async (values) => {
    if (!values.user_id || !values.branch_id) {
      message.error("Please select both a user and a branch");
      return;
    }
    const selectedUser = allUsers.find(u => u.id === Number(values.user_id));
    const defaultPosition = selectedUser?.role === 'delivery_rider' ? 'Delivery Rider' : 'Staff';
    const defaultRate = selectedUser?.role === 'delivery_rider' ? 400 : 500;
    const payload = {
      id: editingAssignment.id,
      data: {
        user_id: Number(values.user_id),
        branch_id: Number(values.branch_id),
        position: values.position || defaultPosition,
        daily_rate: values.daily_rate ? Number(values.daily_rate) : defaultRate,
      },
    };
    await updateMutation.mutateAsync(payload);
  };

  const handleDeleteAssignment = (record) => {
    Modal.confirm({
      title: "Delete Branch Assignment",
      icon: <DeleteOutlined style={{ color: RED }} />,
      content: (
        <div>
          <p className="mb-2">Are you sure you want to remove this branch assignment?</p>
          <p className="text-sm" style={{ color: MUTED }}>User: <strong style={{ color: TEXT }}>{record.user?.firstname} {record.user?.lastname}</strong></p>
          <p className="text-sm" style={{ color: MUTED }}>Branch: <strong style={{ color: TEXT }}>{record.branch?.name}</strong></p>
        </div>
      ),
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        await deleteMutation.mutateAsync(record.assignment.id);
      },
    });
  };

  const handleToggleAssignment = (record) => {
    const nextActive = !record.is_active;
    Modal.confirm({
      title: nextActive ? "Activate Branch Assignment" : "Deactivate Branch Assignment",
      content: (
        <div>
          <p className="mb-2">{nextActive ? "This user will be assigned to this branch." : "This user will no longer be assigned to this branch."}</p>
          <p className="text-sm" style={{ color: MUTED }}>User: <strong style={{ color: TEXT }}>{record.user?.firstname} {record.user?.lastname}</strong></p>
          <p className="text-sm" style={{ color: MUTED }}>Branch: <strong style={{ color: TEXT }}>{record.branch?.name}</strong></p>
        </div>
      ),
      okText: nextActive ? "Activate" : "Deactivate",
      okButtonProps: { danger: !nextActive },
      cancelText: "Cancel",
      onOk: async () => {
        await toggleMutation.mutateAsync({ id: record.assignment.id, is_active: nextActive });
      },
    });
  };

  const openEditModal = (record) => {
    setEditingAssignment(record);
    setShowEditModal(true);
    setTimeout(() => editForm.setFieldsValue({
      user_id: record.user_id,
      branch_id: record.branch_id,
      position: record.position,
      daily_rate: record.daily_rate,
    }), 0);
  };

  const columns = [
    {
      title: "No.",
      key: "index",
      width: 60,
      render: (_, __, idx) => <span style={{ color: MUTED }}>{idx + 1}</span>,
    },
    {
      title: "User",
      key: "user",
      render: (_, r) => (
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm text-white"
            style={{ background: GRADIENT_BTN.background }}
          >
            {r.firstname?.charAt(0)?.toUpperCase() || <UserOutlined />}
          </div>
          <div>
            <div className="font-semibold" style={{ color: TEXT }}>{r.firstname} {r.lastname}</div>
            <div className="text-xs" style={{ color: FAINT }}>{r.username}</div>
          </div>
        </div>
      ),
    },
    {
      title: "Type",
      key: "type",
      render: (_, r) =>
        r.role === 'delivery_rider'
          ? <Tag icon={<CarOutlined />} style={{ background: AMBER_SOFT, color: AMBER, border: `1px solid ${AMBER}40` }}>Rider</Tag>
          : <Tag icon={<TeamOutlined />} style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}>Staff</Tag>,
    },
    {
      title: "Branch",
      key: "branch",
      render: (_, r) =>
        r.assignment
          ? <Tag style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}>{r.branch?.name || "N/A"}</Tag>
          : <Tag style={{ background: PANEL_BG_2, color: MUTED, border: `1px solid ${BORDER}` }}>Not Assigned</Tag>,
    },
    {
      title: "Position",
      key: "position",
      render: (_, r) => <span style={{ color: TEXT }}>{r.position || "—"}</span>,
    },
    {
      title: "Daily Rate",
      key: "daily_rate",
      render: (_, r) => <span className="font-medium" style={{ color: ACCENT }}>₱{r.daily_rate || 0}</span>,
    },
    {
      title: "Status",
      key: "status",
      render: (_, r) =>
        r.assignment
          ? r.is_active
            ? <Tag style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}>Active</Tag>
            : <Tag style={{ background: RED_SOFT, color: "#F87171", border: `1px solid ${RED}40` }}>Inactive</Tag>
          : <Tag style={{ background: AMBER_SOFT, color: AMBER, border: `1px solid ${AMBER}40` }}>Unassigned</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, r) => (
        <Space>
          {r.assignment ? (
            <>
              <Tooltip title={r.is_active ? "Deactivate" : "Activate"}>
                <Switch
                  checked={r.is_active}
                  onChange={() => handleToggleAssignment(r)}
                  loading={toggleMutation.isPending}
                  size="small"
                />
              </Tooltip>
              <Tooltip title="Edit Assignment">
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(r)} style={{ color: ACCENT }} />
              </Tooltip>
              <Tooltip title="Delete Assignment">
                <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteAssignment(r)} />
              </Tooltip>
            </>
          ) : (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => {
              setShowAddModal(true);
              setTimeout(() => form.setFieldsValue({ user_id: r.id }), 0);
            }} style={GRADIENT_BTN}>
              Assign
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="nm-dark min-h-screen p-6" style={{ background: "#1F1A2E" }}>
      

      {/* Hero Header — dark plum with mint accents */}
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
                <BankOutlined className="mr-2" style={{ color: ACCENT }} />
                Branch Assignments
              </h1>
              <p className="text-sm" style={{ color: MUTED }}>
                Manage staff and rider branch assignments
              </p>
            </div>
          </div>

          {/* KPI Chips */}
          <div className="relative z-10 mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <TeamOutlined style={{ color: ACCENT }} /> Total Staff
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{totalStaff}</p>
            </div>
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <CarOutlined style={{ color: ACCENT }} /> Total Riders
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{totalRiders}</p>
            </div>
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <TeamOutlined style={{ color: ACCENT }} /> Assigned
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: ACCENT }}>{assignedCount}</p>
            </div>
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <UserOutlined style={{ color: AMBER }} /> Unassigned
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{unassignedCount}</p>
            </div>
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <BankOutlined style={{ color: ACCENT }} /> Total Branches
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{totalBranches}</p>
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
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['staff'] });
              queryClient.invalidateQueries({ queryKey: ['assignments'] });
              queryClient.invalidateQueries({ queryKey: ['branches'] });
            }}
            loading={loading}
            style={GHOST_BTN}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields();
              setShowAddModal(true);
            }}
            style={GRADIENT_BTN}
          >
            Add Assignment
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
              <TeamOutlined />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: TEXT }}>Staff & Riders Directory</h2>
              <p className="text-sm" style={{ color: MUTED }}>View and manage all member assignments</p>
            </div>
          </div>
          <Tag
            className="rounded-full px-3 py-1 text-sm font-semibold"
            style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}
          >
            {totalUsers} {totalUsers === 1 ? "Member" : "Members"}
          </Tag>
        </div>
      </div>

      {/* Table */}
      <Card
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
        styles={{ body: { background: PANEL_BG } }}
      >
        <Table
          columns={columns}
          dataSource={usersWithAssignment}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} members` }}
          locale={{ emptyText: <div className="py-10 text-center"><div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: ACCENT_SOFT, color: ACCENT }}><TeamOutlined className="text-3xl" /></div><p className="font-semibold" style={{ color: TEXT }}>No staff or riders found</p><p className="text-sm" style={{ color: MUTED }}>Add assignments to get started</p></div> }}
        />
      </Card>

      {/* Add Assignment Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg" style={{ background: ACCENT_SOFT, color: ACCENT }}>
              <PlusOutlined />
            </div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>Add Branch Assignment</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>Assign a staff member to a branch</p>
            </div>
          </div>
        }
        open={showAddModal}
        onCancel={() => { setShowAddModal(false); form.resetFields(); }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        <Form form={form} layout="vertical" onFinish={handleAddAssignment} initialValues={{ position: "", daily_rate: "" }}>
          <Form.Item
            label={<span style={FIELD_LABEL}>User</span>}
            name="user_id"
            rules={[{ required: true, message: "Please select a user" }]}
          >
            <Select
              placeholder="Select User"
              showSearch
              optionFilterProp="children"
              popupClassName="nm-dark-select-dropdown"
            >
              {allUsers.map((u) => (
                <Select.Option key={u.id} value={u.id}>
                  {u.firstname} {u.lastname} ({u.username}) - {u.role === 'delivery_rider' ? 'Rider' : 'Staff'}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label={<span style={FIELD_LABEL}>Branch</span>}
            name="branch_id"
            rules={[{ required: true, message: "Please select a branch" }]}
          >
            <Select
              placeholder="Select Branch"
              showSearch
              optionFilterProp="children"
              popupClassName="nm-dark-select-dropdown"
            >
              {branchesList.map((b) => (
                <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label={<span style={FIELD_LABEL}>Position</span>}
            name="position"
          >
            <Input
              placeholder="Auto-filled based on role"
            />
          </Form.Item>
          <Form.Item
            label={<span style={FIELD_LABEL}>Daily Rate</span>}
            name="daily_rate"
          >
            <Input
              type="number"
              placeholder="Auto-filled based on role"
            />
          </Form.Item>
          <div
            className="mb-4 rounded-xl p-3"
            style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}30` }}
          >
            <p className="mb-0 text-xs" style={{ color: ACCENT }}>
              <InfoCircleOutlined className="mr-1" />
              Position and daily rate are auto-filled based on the selected user's role. You can override them manually.
            </p>
          </div>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => { setShowAddModal(false); form.resetFields(); }}
                disabled={addMutation.isPending}
                style={SECONDARY_BTN}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={addMutation.isPending}
                style={GRADIENT_BTN}
              >
                Add Assignment
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Assignment Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg" style={{ background: ACCENT_SOFT, color: ACCENT }}>
              <EditOutlined />
            </div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>Edit Branch Assignment</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>Update assignment details</p>
            </div>
          </div>
        }
        open={showEditModal}
        onCancel={() => { setShowEditModal(false); setEditingAssignment(null); editForm.resetFields(); }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateAssignment}>
          <Form.Item
            label={<span style={FIELD_LABEL}>User</span>}
            name="user_id"
            rules={[{ required: true, message: "Please select a user" }]}
          >
            <Select
              placeholder="Select User"
              showSearch
              optionFilterProp="children"
              popupClassName="nm-dark-select-dropdown"
            >
              {allUsers.map((u) => (
                <Select.Option key={u.id} value={u.id}>
                  {u.firstname} {u.lastname} ({u.username}) - {u.role === 'delivery_rider' ? 'Rider' : 'Staff'}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label={<span style={FIELD_LABEL}>Branch</span>}
            name="branch_id"
            rules={[{ required: true, message: "Please select a branch" }]}
          >
            <Select
              placeholder="Select Branch"
              showSearch
              optionFilterProp="children"
              popupClassName="nm-dark-select-dropdown"
            >
              {branchesList.map((b) => (
                <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label={<span style={FIELD_LABEL}>Position</span>}
            name="position"
          >
            <Input
              placeholder="Enter position"
            />
          </Form.Item>
          <Form.Item
            label={<span style={FIELD_LABEL}>Daily Rate</span>}
            name="daily_rate"
          >
            <Input
              type="number"
              placeholder="Enter daily rate"
            />
          </Form.Item>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => { setShowEditModal(false); setEditingAssignment(null); editForm.resetFields(); }}
                disabled={updateMutation.isPending}
                style={SECONDARY_BTN}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateMutation.isPending}
                style={GRADIENT_BTN}
              >
                Update Assignment
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BranchAssignments;