import React, { useState } from "react";
import {
  Tag, Modal, message, Button, Input, Card, Space, Typography,
  Badge, Empty, Descriptions, Table, Tooltip, Avatar,
} from "antd";
import {
  UserOutlined, SearchOutlined, MailOutlined, PhoneOutlined,
  ShoppingCartOutlined, DollarOutlined, TeamOutlined,
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined,
  CreditCardOutlined, HomeOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/config/api";
import Loading from "@/components/Loading";
import { clientPagination, useServerPagination } from "@/components/Pagination";

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

const itemColumns = [
  {
    title: "Product",
    dataIndex: "product_name",
    key: "product_name",
    render: (val) => <Text strong>{val}</Text>,
  },
  {
    title: "Qty",
    dataIndex: "quantity",
    key: "quantity",
    width: 60,
    className: "text-center",
    render: (val) => Number(val),
  },
  {
    title: "Price",
    dataIndex: "price",
    key: "price",
    width: 100,
    className: "text-right",
    render: (val) => `₱${Number(val).toFixed(2)}`,
  },
  {
    title: "Total",
    dataIndex: "total",
    key: "total",
    width: 100,
    className: "text-right",
    render: (val) => <Text strong>₱${Number(val).toFixed(2)}</Text>,
  },
];

const paymentMethodTag = (method) => {
  const tone = {
    cash: { background: GREEN_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` },
    cod: { background: AMBER_SOFT, color: AMBER, border: `1px solid ${AMBER}30` },
    gcash: { background: AMBER_SOFT, color: AMBER, border: `1px solid ${AMBER}30` },
    card: { background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` },
  }[method] || { background: PANEL_BG_2, color: MUTED, border: `1px solid ${BORDER}` };
  return (
    <Tag className="rounded-full px-2 py-0.5" style={tone}>
      {method?.toUpperCase() || "-"}
    </Tag>
  );
};

const statusColorMap = {
  pending: { background: AMBER_SOFT, color: AMBER, border: `1px solid ${AMBER}30` },
  confirmed: { background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` },
  preparing: { background: AMBER_SOFT, color: AMBER, border: `1px solid ${AMBER}30` },
  out_for_delivery: { background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` },
  delivered: { background: GREEN_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` },
  cancelled: { background: RED_SOFT, color: "#F87171", border: `1px solid ${RED}30` },
};

function Customers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const {
    data: customers,
    total,
    isLoading,
    pagination,
    setCurrentPage,
  } = useServerPagination({
    queryKey: ["customers", searchTerm],
    url: "/customers",
    params: { search: searchTerm || undefined },
    label: "customers",
    placeholderData: (prev) => prev,
  });

  const { data: customerDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["customer", selectedCustomer?.id],
    queryFn: async () => {
      const { data } = await api.get(`/customers/${selectedCustomer.id}`);
      return data;
    },
    enabled: !!selectedCustomer && showDetailModal,
  });

  const handleView = (customer) => {
    setSelectedCustomer(customer);
    setShowDetailModal(true);
  };

  const handleToggleActive = async (customer) => {
    try {
      await api.post(`/customers/${customer.id}/toggle-active`);
      message.success(`Customer ${customer.is_active ? "deactivated" : "activated"} successfully`);
      setShowDetailModal(false);
      setSelectedCustomer(null);
    } catch {
      message.error("Failed to update customer status");
    }
  };

  const listColumns = [
    {
      title: "Customer",
      key: "customer",
      width: 220,
      render: (_, r) => (
        <div className="flex items-center gap-3">
          <Avatar size={36} icon={<UserOutlined />} style={{ backgroundColor: ACCENT, color: "#1F1A2E" }} />
          <div>
            <Text strong>{r.full_name}</Text>
            <br />
            <Text style={{ fontSize: 12 }}>@{r.username}</Text>
          </div>
        </div>
      ),
    },
    {
      title: "Contact",
      key: "contact",
      render: (_, r) => (
        <Space orientation="vertical" size={0}>
          {r.email && <Text style={{ fontSize: 12, color: TEXT }}><MailOutlined className="mr-1" />{r.email}</Text>}
          {r.phone && <Text style={{ fontSize: 12, color: TEXT }}><PhoneOutlined className="mr-1" />{r.phone}</Text>}
        </Space>
      ),
    },
    {
      title: "Orders",
      dataIndex: "total_orders",
      key: "total_orders",
      width: 80,
      className: "text-center",
      render: (v) => <Badge count={v} showZero style={{ backgroundColor: ACCENT }} />,
    },
    {
      title: "Total Spent",
      dataIndex: "total_spent",
      key: "total_spent",
      width: 140,
      className: "text-right",
      render: (v) => (
        <Text strong style={{ color: ACCENT }}>
          ₱{Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: "Joined",
      dataIndex: "created_at",
      key: "created_at",
      width: 120,
      render: (v) => (
        <Text style={{ fontSize: 12, color: TEXT }}>
          {v ? new Date(v).toLocaleDateString() : "-"}
        </Text>
      ),
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
      title: "Actions",
      key: "actions",
      width: 80,
      className: "text-center",
      render: (_, r) => (
        <Tooltip title="View Details">
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

  const saleColumns = [
    { title: "Invoice", dataIndex: "invoice_number", key: "invoice_number", render: (v) => <Text code style={{ color: TEXT }}>{v || "-"}</Text> },
    { title: "Branch", dataIndex: "branch", key: "branch", render: (v) => v || "-" },
    { title: "Date", dataIndex: "sale_date", key: "sale_date", render: (v) => v || "-" },
    { title: "Payment", dataIndex: "payment_method", key: "payment_method", render: (v) => paymentMethodTag(v) },
    {
      title: "Amount",
      key: "amount",
      width: 160,
      render: (_, r) => (
        <Space orientation="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>
            Cash: ₱{Number(r.cash_collected || 0).toFixed(2)}
          </Text>
          <Text style={{ fontSize: 12 }}>
            Change: ₱{Number(r.change_given || 0).toFixed(2)}
          </Text>
        </Space>
      ),
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      width: 100,
      className: "text-right",
      sorter: (a, b) => a.total - b.total,
      render: (v) => <Text strong>₱{Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>,
    },
  ];

  const orderColumns = [
    { title: "Order #", dataIndex: "order_number", key: "order_number", render: (v) => <Text code style={{ color: TEXT }}>{v || "-"}</Text> },
    { title: "Branch", dataIndex: "branch", key: "branch", render: (v) => v || "-" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v) => (
        <Tag
          className="rounded-full px-2 py-0.5"
          style={statusColorMap[v] || { background: PANEL_BG_2, color: MUTED, border: `1px solid ${BORDER}` }}
        >
          {v || "-"}
        </Tag>
      ),
    },
    { title: "Payment", dataIndex: "payment_method", key: "payment_method", render: (v) => paymentMethodTag(v) },
    {
      title: "Payment Status",
      dataIndex: "payment_status",
      key: "payment_status",
      render: (v) => (
        <Tag
          className="rounded-full px-2 py-0.5"
          style={v === "paid"
            ? { background: GREEN_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }
            : { background: AMBER_SOFT, color: AMBER, border: `1px solid ${AMBER}30` }}
        >
          {v || "-"}
        </Tag>
      ),
    },
    {
      title: "GCash Ref",
      dataIndex: "gcash_reference",
      key: "gcash_reference",
      render: (v) => (v ? <Text code style={{ fontSize: 11, color: TEXT }}>{v}</Text> : <Text style={{ color: MUTED }}>-</Text>),
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      width: 100,
      className: "text-right",
      sorter: (a, b) => a.total - b.total,
      render: (v) => <Text strong>₱{Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>,
    },
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      width: 90,
      render: (v) => (
        <Text style={{ fontSize: 12 }}>
          {v ? new Date(v).toLocaleDateString() : "-"}
        </Text>
      ),
    },
  ];

  const expandedRowRender = (record, type) => {
    const items = record.items || [];
    if (!items.length) return <Text italic>No items</Text>;
    return (
      <Table
        columns={itemColumns}
        dataSource={items}
        rowKey={(_, i) => i}
        pagination={clientPagination({ label: "items" })}
        size="small"
        bordered
        summary={() => (
          <Table.Summary>
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={3} className="text-right">
                <Text strong>{type === "sale" ? "Sale Total" : "Order Total"}:</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} className="text-right">
                <Text strong>₱{Number(record.total).toFixed(2)}</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    );
  };

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
                Customer Data
              </h1>
              <p className="text-sm" style={{ color: MUTED }}>View and manage registered customers</p>
            </div>
            <Input
              placeholder="Search customers..."
              prefix={<SearchOutlined style={{ color: MUTED }} />}
              allowClear
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{ width: 300 }}
              className="rounded-xl py-2"
            />
          </div>
        </div>
      </div>

      <Card
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
        styles={{ body: { background: PANEL_BG } }}
      >
        {isLoading ? (
          <Loading full text="Loading customers..." />
        ) : (
        <Table
          columns={listColumns}
          dataSource={customers}
          rowKey="id"
          loading={false}
          pagination={pagination}
          scroll={{ x: 800 }}
          locale={{
            emptyText: (
              <div className="py-10 text-center">
                <div
                  className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: ACCENT_SOFT, color: ACCENT }}
                >
                  <TeamOutlined className="text-3xl" />
                </div>
                <p className="font-semibold" style={{ color: TEXT }}>No customers found</p>
                <p className="text-sm" style={{ color: MUTED }}>Try adjusting your search</p>
              </div>
            ),
          }}
        />
        )}
      </Card>

      <Modal
        title={<span><UserOutlined className="mr-2" style={{ color: ACCENT }} /><span style={{ color: TEXT, fontWeight: 700 }}>Customer Details</span></span>}
        open={showDetailModal}
        onCancel={() => { setShowDetailModal(false); setSelectedCustomer(null); }}
        footer={null}
        width={1000}
        className="rounded-2xl"
      >
        {detailLoading ? (
          <Loading text="Loading customer details..." />
        ) : customerDetail ? (
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <Card
              variant="borderless"
              size="small"
              style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
            >
              <Descriptions column={2} bordered size="small"
                styles={{
                  label: { color: ACCENT, fontWeight: 600 },
                  content: { color: TEXT },
                }}>
                <Descriptions.Item label="Name" span={2}>{customerDetail.customer.full_name}</Descriptions.Item>
                <Descriptions.Item label="Username">@{customerDetail.customer.username}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag
                    className="rounded-full px-3 py-1"
                    style={customerDetail.customer.is_active
                      ? { background: GREEN_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }
                      : { background: RED_SOFT, color: "#F87171", border: `1px solid ${RED}30` }}
                  >
                    {customerDetail.customer.is_active ? "Active" : "Inactive"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Email">{customerDetail.customer.email || "-"}</Descriptions.Item>
                <Descriptions.Item label="Phone">{customerDetail.customer.phone || "-"}</Descriptions.Item>
                <Descriptions.Item label="Address" span={2}>{customerDetail.customer.address || "-"}</Descriptions.Item>
                <Descriptions.Item label="Total Spent">
                  <Text strong style={{ color: ACCENT }}>
                    ₱{Number(customerDetail.customer.total_spent).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Orders / Sales">
                  {customerDetail.customer.total_orders} online • {customerDetail.customer.total_sales} in-store
                </Descriptions.Item>
                <Descriptions.Item label="Member Since">
                  {customerDetail.customer.created_at
                    ? new Date(customerDetail.customer.created_at).toLocaleDateString()
                    : "-"}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {customerDetail.sales?.length > 0 && (
              <Card
                title={<span><DollarOutlined className="mr-1" style={{ color: ACCENT }} /><span style={{ color: TEXT, fontWeight: 600 }}>In-Store Sales — {customerDetail.sales.length} transaction{customerDetail.sales.length > 1 ? "s" : ""}</span></span>}
                variant="borderless"
                size="small"
                style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
                styles={{ body: { background: PANEL_BG, padding: 12 } }}
              >
                <Table
                  columns={saleColumns}
                  dataSource={customerDetail.sales}
                  rowKey="id"
                  pagination={clientPagination({ label: "sales" })}
                  size="small"
                  scroll={{ x: 800 }}
                  expandable={{
                    expandedRowRender: (r) => expandedRowRender(r, "sale"),
                    rowExpandable: (r) => (r.items || []).length > 0,
                  }}
                />
              </Card>
            )}

            {customerDetail.orders?.length > 0 && (
              <Card
                title={<span><ShoppingCartOutlined className="mr-1" style={{ color: ACCENT }} /><span style={{ color: TEXT, fontWeight: 600 }}>Online Orders — {customerDetail.orders.length} order{customerDetail.orders.length > 1 ? "s" : ""}</span></span>}
                variant="borderless"
                size="small"
                style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
                styles={{ body: { background: PANEL_BG, padding: 12 } }}
              >
                <Table
                  columns={orderColumns}
                  dataSource={customerDetail.orders}
                  rowKey="id"
                  pagination={clientPagination({ label: "orders" })}
                  size="small"
                  scroll={{ x: 900 }}
                  expandable={{
                    expandedRowRender: (r) => (
                      <Space orientation="vertical" size="small" style={{ width: "100%" }}>
                        {r.delivery_address && (
                          <Text style={{ fontSize: 12 }}>
                            <HomeOutlined className="mr-1" style={{ color: ACCENT }} />Deliver to: {r.delivery_address}
                          </Text>
                        )}
                        {r.gcash_reference && (
                          <Text style={{ fontSize: 12 }}>
                            <CreditCardOutlined className="mr-1" style={{ color: ACCENT }} />GCash Ref: {r.gcash_reference}
                          </Text>
                        )}
                        {r.notes && <Text style={{ fontSize: 12 }}>Notes: {r.notes}</Text>}
                        <Text style={{ fontSize: 12 }}>
                          Subtotal: ₱{Number(r.subtotal || 0).toFixed(2)}
                          {Number(r.delivery_fee || 0) > 0 && ` • Delivery Fee: ₱${Number(r.delivery_fee).toFixed(2)}`}
                        </Text>
                        {expandedRowRender(r, "order")}
                      </Space>
                    ),
                    rowExpandable: (r) => (r.items || []).length > 0 || !!r.delivery_address || !!r.gcash_reference,
                  }}
                />
              </Card>
            )}

            {!customerDetail.sales?.length && !customerDetail.orders?.length && (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: MUTED }}>No sales or orders found for this customer</span>} />
            )}

            <Button
              type={customerDetail.customer.is_active ? "primary" : "default"}
              danger={customerDetail.customer.is_active}
              icon={customerDetail.customer.is_active ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
              onClick={() => handleToggleActive(customerDetail.customer)}
              style={customerDetail.customer.is_active
                ? { background: "transparent", border: `1px solid ${RED}40`, color: "#F87171", fontWeight: 500 }
                : { ...GRADIENT_BTN, borderRadius: 10 }}
            >
              {customerDetail.customer.is_active ? "Deactivate Customer" : "Activate Customer"}
            </Button>
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}

export default Customers;
