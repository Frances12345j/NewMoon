import React, { useState } from "react";
import {
  Table, Tag, Modal, Input, Space, Typography, Avatar, Descriptions,
  Card, Tooltip, Button, Empty, Segmented,
} from "antd";
import {
  UserOutlined, SearchOutlined, MailOutlined, PhoneOutlined,
  EnvironmentOutlined, IdcardOutlined, TeamOutlined, TruckOutlined,
  CrownOutlined, HomeOutlined, EyeOutlined, CoffeeOutlined, InfoCircleOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/config/api";
import Loading from "@/components/Loading";

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

const { Text } = Typography;

const ROLE_META = {
  staff: { label: "Staff", color: "orange", icon: <CoffeeOutlined /> },
  delivery_rider: { label: "Rider", color: "geekblue", icon: <TruckOutlined /> },
  customer: { label: "Customer", color: "green", icon: <CrownOutlined /> },
};

const ROLE_AVATAR_COLOR = {
  staff: ACCENT,
  delivery_rider: ACCENT_DEEP,
  customer: ACCENT,
};

function getInitials(u = {}) {
  const first = (u.firstname || "").trim()[0] || "";
  const last = (u.lastname || "").trim()[0] || "";
  return (first + last).toUpperCase() || (u.username || "U")[0].toUpperCase();
}

function profileAvatar(u, size, fontSize) {
  return (
    <Avatar
      size={size}
      src={u.avatar_url || undefined}
      style={{
        background: u.avatar_url ? undefined : (ROLE_AVATAR_COLOR[u.role] || ACCENT),
        color: "#1F1A2E",
        fontWeight: 700,
        fontSize: fontSize,
      }}
    >
      {!u.avatar_url && getInitials(u)}
    </Avatar>
  );
}

function roleTag(role, size = "default") {
  const meta = ROLE_META[role] || { label: role || "User", color: "default" };
  const tone = {
    staff: { background: AMBER_SOFT, color: AMBER, border: `1px solid ${AMBER}30` },
    delivery_rider: { background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` },
    customer: { background: GREEN_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` },
  }[role] || { background: PANEL_BG_2, color: MUTED, border: `1px solid ${BORDER}` };
  return (
    <Tag
      className="rounded-full px-2 py-0.5"
      style={{ ...tone, fontSize: size === "small" ? 11 : undefined }}
    >
      {meta.label}
    </Tag>
  );
}

function UserProfiles() {
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const queryKey = ["user-profiles", roleFilter, searchTerm];

  const { data: users, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (roleFilter !== "all") params.append("role", roleFilter);
      if (searchTerm) params.append("search", searchTerm);
      const { data } = await api.get(`/users?${params}`);
      return Array.isArray(data) ? data : [];
    },
  });

  const handleView = (user) => {
    setSelectedUser(user);
    setShowDetailModal(true);
  };

  const columns = [
    {
      title: "User",
      key: "user",
      width: 240,
      render: (_, r) => {
        const meta = ROLE_META[r.role] || {};
        return (
          <div className="flex items-center gap-3">
            {profileAvatar(r, 38)}
            <div>
              <Text strong>{r.full_name || "—"}</Text>
              <br />
              <Text style={{ color: MUTED, fontSize: 12 }}>
                {meta.icon} @{r.username}
              </Text>
            </div>
          </div>
        );
      },
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      width: 100,
      render: (role) => roleTag(role),
    },
    {
      title: "Contact",
      key: "contact",
      render: (_, r) => (
        <Space orientation="vertical" size={0}>
          {r.email ? <Text style={{ fontSize: 12 }}><MailOutlined className="mr-1" />{r.email}</Text> : <Text style={{ fontSize: 12, color: MUTED }}>—</Text>}
          {r.phone ? <Text style={{ fontSize: 12 }}><PhoneOutlined className="mr-1" />{r.phone}</Text> : <Text style={{ fontSize: 12, color: MUTED }}>—</Text>}
        </Space>
      ),
    },
    {
      title: "Branch / Position",
      key: "branch",
      width: 180,
      render: (_, r) => {
        if (r.role === "customer") return <Text style={{ color: MUTED }}>—</Text>;
        return (
          <Space orientation="vertical" size={0}>
            {r.position && <Text style={{ fontSize: 12 }} strong>{r.position}</Text>}
            {r.branch_name
              ? <Text style={{ fontSize: 12 }}><EnvironmentOutlined className="mr-1" style={{ color: ACCENT }} />{r.branch_name}</Text>
              : <Text style={{ fontSize: 12, color: MUTED }}>Unassigned</Text>}
          </Space>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      width: 90,
      render: (_, r) => (
        <Tag
          className="rounded-full px-3 py-1"
          style={r.is_active
            ? { background: GREEN_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }
            : { background: RED_SOFT, color: "#F87171", border: `1px solid ${RED}30` }}
        >
          {r.is_active ? "Active" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Joined",
      dataIndex: "created_at",
      key: "created_at",
      width: 110,
      render: (v) => (
        <Text style={{ fontSize: 12, color: TEXT }}>
          {v ? new Date(v).toLocaleDateString() : "-"}
        </Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      className: "text-center",
      render: (_, r) => (
        <Tooltip title="View Profile">
          <Button
            shape="circle"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleView(r)}
            style={GRADIENT_BTN}
          />
        </Tooltip>
      ),
    },
  ];

  const filterOptions = [
    { label: "All", value: "all", icon: <UserOutlined /> },
    { label: "Staff", value: "staff", icon: <CoffeeOutlined /> },
    { label: "Rider", value: "delivery_rider", icon: <TruckOutlined /> },
    { label: "Customer", value: "customer", icon: <CrownOutlined /> },
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
                <IdcardOutlined className="mr-2" style={{ color: ACCENT }} />
                User Profiles
              </h1>
              <p className="text-sm" style={{ color: MUTED }}>
                View profiles of staff, riders, and registered customers
              </p>
            </div>
            <Input
              placeholder="Search by name, username, email, phone..."
              prefix={<SearchOutlined style={{ color: MUTED }} />}
              allowClear
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: 320 }}
              className="rounded-xl py-2"
            />
          </div>
        </div>
      </div>

      <Card
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
        styles={{ body: { background: PANEL_BG } }}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            options={filterOptions}
            value={roleFilter}
            onChange={(v) => setRoleFilter(v)}
          />
          {!isLoading && (
            <Text style={{ fontSize: 13, color: MUTED }}>
              <TeamOutlined className="mr-1" style={{ color: ACCENT }} />
              {users.length} profile{users.length !== 1 ? "s" : ""}
            </Text>
          )}
        </div>

        {isLoading ? (
          <Loading full text="Loading profiles..." />
        ) : (
          <Table
            columns={columns}
            dataSource={users}
            rowKey="id"
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 900 }}
            locale={{
              emptyText: (
                <div className="py-10 text-center">
                  <div
                    className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl"
                    style={{ background: ACCENT_SOFT, color: ACCENT }}
                  >
                    <IdcardOutlined className="text-3xl" />
                  </div>
                  <p className="font-semibold" style={{ color: TEXT }}>No profiles found</p>
                  <p className="text-sm" style={{ color: MUTED }}>Try adjusting your search or filter</p>
                </div>
              ),
            }}
          />
        )}
      </Card>

      <Modal
        title={
          <span>
            <UserOutlined className="mr-2" style={{ color: ACCENT }} />
            <span style={{ color: TEXT, fontWeight: 700 }}>User Profile</span>
          </span>
        }
        open={showDetailModal}
        onCancel={() => { setShowDetailModal(false); setSelectedUser(null); }}
        footer={[
          <Button
            key="close"
            style={GRADIENT_BTN}
            onClick={() => { setShowDetailModal(false); setSelectedUser(null); }}
          >
            Close
          </Button>,
        ]}
        width={720}
        className="rounded-2xl"
      >
        {selectedUser && (
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <Card
              variant="borderless"
              size="small"
              style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
            >
              <div className="flex items-center gap-4 mb-4">
                {profileAvatar(selectedUser, 64, 24)}
                <div>
                  <Text strong style={{ fontSize: 18 }}>{selectedUser.full_name || "—"}</Text>
                  <br />
                  <Text style={{ color: MUTED }}>@{selectedUser.username}</Text>
                  <div className="mt-1 flex items-center gap-2">
                    {roleTag(selectedUser.role)}
                    <Tag
                      className="rounded-full px-3 py-1"
                      style={selectedUser.is_active
                        ? { background: GREEN_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }
                        : { background: RED_SOFT, color: "#F87171", border: `1px solid ${RED}30` }}
                    >
                      {selectedUser.is_active ? "Active" : "Inactive"}
                    </Tag>
                  </div>
                </div>
              </div>

              <Descriptions column={2} bordered size="small"
                styles={{
                  label: { color: ACCENT, fontWeight: 600 },
                  content: { color: TEXT },
                }}
              >
                <Descriptions.Item label="First Name">{selectedUser.firstname || "-"}</Descriptions.Item>
                <Descriptions.Item label="Last Name">{selectedUser.lastname || "-"}</Descriptions.Item>
                <Descriptions.Item label="Middle Name">{selectedUser.middlename || "-"}</Descriptions.Item>
                <Descriptions.Item label="Username">@{selectedUser.username}</Descriptions.Item>
                <Descriptions.Item label="Email">
                  {selectedUser.email ? <Text><MailOutlined className="mr-1" style={{ color: ACCENT }} />{selectedUser.email}</Text> : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Phone">
                  {selectedUser.phone ? <Text><PhoneOutlined className="mr-1" style={{ color: ACCENT }} />{selectedUser.phone}</Text> : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Address" span={2}>
                  {selectedUser.address ? <Text><HomeOutlined className="mr-1" style={{ color: ACCENT }} />{selectedUser.address}</Text> : "-"}
                </Descriptions.Item>
                {selectedUser.role !== "customer" && (
                  <>
                    <Descriptions.Item label="Position">{selectedUser.position || "-"}</Descriptions.Item>
                    <Descriptions.Item label="Branch">
                      {selectedUser.branch_name
                        ? <Text><EnvironmentOutlined className="mr-1" style={{ color: ACCENT }} />{selectedUser.branch_name}</Text>
                        : <Text style={{ color: MUTED }}>Unassigned</Text>}
                    </Descriptions.Item>
                  </>
                )}
                <Descriptions.Item label="Account Type">
                  <Text>{ROLE_META[selectedUser.role]?.label || selectedUser.role || "User"}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Member Since">
                  {selectedUser.created_at
                    ? new Date(selectedUser.created_at).toLocaleDateString()
                    : "-"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <div
              className="flex items-center gap-2 rounded-xl px-4 py-3"
              style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}30`, borderRadius: 12 }}
            >
              <InfoCircleOutlined style={{ color: ACCENT }} />
              <Text style={{ fontSize: 13, color: ACCENT }}>
                This profile is synced with what the account owner keeps updated in the mobile app.
              </Text>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
}

export default UserProfiles;