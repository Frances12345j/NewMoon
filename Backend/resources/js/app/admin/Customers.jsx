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
  const colorMap = { cash: "green", cod: "orange", gcash: "gold", card: "cyan" };
  return <Tag color={colorMap[method] || "default"}>{method?.toUpperCase() || "-"}</Tag>;
};

const statusColorMap = {
  pending: "orange",
  confirmed: "gold",
  preparing: "volcano",
  out_for_delivery: "geekblue",
  delivered: "green",
  cancelled: "red",
};

function Customers() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const PAGE_SIZE = 10;

  const queryKey = ["customers", currentPage, searchTerm];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("per_page", PAGE_SIZE);
      params.append("page", currentPage);
      if (searchTerm) params.append("search", searchTerm);
      const { data } = await api.get(`/customers?${params}`);
      return data;
    },
    keepPreviousData: true,
  });

  const customers = data?.data || [];
  const pagination = data?.pagination || {};

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
          <Avatar size={36} icon={<UserOutlined />} style={{ backgroundColor: '#EA580C' }} />
          <div>
            <Text strong>{r.full_name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>@{r.username}</Text>
          </div>
        </div>
      ),
    },
    {
      title: "Contact",
      key: "contact",
      render: (_, r) => (
        <Space orientation="vertical" size={0}>
          {r.email && <Text style={{ fontSize: 12 }}><MailOutlined className="mr-1" />{r.email}</Text>}
          {r.phone && <Text style={{ fontSize: 12 }}><PhoneOutlined className="mr-1" />{r.phone}</Text>}
        </Space>
      ),
    },
    {
      title: "Orders",
      dataIndex: "total_orders",
      key: "total_orders",
      width: 80,
      className: "text-center",
      render: (v) => <Badge count={v} showZero style={{ backgroundColor: "#F97316" }} />,
    },
    {
      title: "Total Spent",
      dataIndex: "total_spent",
      key: "total_spent",
      width: 140,
      className: "text-right",
      render: (v) => (
        <Text strong style={{ color: "#EA580C" }}>
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
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v ? new Date(v).toLocaleDateString() : "-"}
        </Text>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 90,
      render: (_, r) => (
        <Tag color={r.is_active ? "green" : "red"}>{r.is_active ? "Active" : "Inactive"}</Tag>
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
            className="bg-gradient-to-br from-[#EA580C] via-[#F97316] to-[#F59E0B] text-white border-none shadow-[0_2px_8px_rgba(234,88,12,0.3)] hover:brightness-110 transition-all duration-200"
          />
        </Tooltip>
      ),
    },
  ];

  const saleColumns = [
    { title: "Invoice", dataIndex: "invoice_number", key: "invoice_number", render: (v) => <Text code>{v || "-"}</Text> },
    { title: "Branch", dataIndex: "branch", key: "branch", render: (v) => v || "-" },
    { title: "Date", dataIndex: "sale_date", key: "sale_date", render: (v) => v || "-" },
    { title: "Payment", dataIndex: "payment_method", key: "payment_method", render: (v) => paymentMethodTag(v) },
    {
      title: "Amount",
      key: "amount",
      width: 160,
      render: (_, r) => (
        <Space orientation="vertical" size={0}>
          <Text style={{ fontSize: 12, color: "#8c8c8c" }}>
            Cash: ₱{Number(r.cash_collected || 0).toFixed(2)}
          </Text>
          <Text style={{ fontSize: 12, color: "#8c8c8c" }}>
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
    { title: "Order #", dataIndex: "order_number", key: "order_number", render: (v) => <Text code>{v || "-"}</Text> },
    { title: "Branch", dataIndex: "branch", key: "branch", render: (v) => v || "-" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v) => <Tag color={statusColorMap[v] || "default"}>{v || "-"}</Tag>,
    },
    { title: "Payment", dataIndex: "payment_method", key: "payment_method", render: (v) => paymentMethodTag(v) },
    {
      title: "Payment Status",
      dataIndex: "payment_status",
      key: "payment_status",
      render: (v) => <Tag color={v === "paid" ? "green" : "orange"}>{v || "-"}</Tag>,
    },
    {
      title: "GCash Ref",
      dataIndex: "gcash_reference",
      key: "gcash_reference",
      render: (v) => (v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : <Text type="secondary">-</Text>),
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
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v ? new Date(v).toLocaleDateString() : "-"}
        </Text>
      ),
    },
  ];

  const expandedRowRender = (record, type) => {
    const items = record.items || [];
    if (!items.length) return <Text type="secondary" italic>No items</Text>;
    return (
      <Table
        columns={itemColumns}
        dataSource={items}
        rowKey={(_, i) => i}
        pagination={false}
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
    <div className="p-6 bg-gradient-to-br from-[#FFF8ED]/80 via-[#FFFDF9] to-[#FFF1E6]/80 min-h-screen">
      {/* Header - NewMoon Roasted Style */}
      <div className="mb-6 rounded-2xl overflow-hidden shadow-[0_12px_35px_rgba(69,26,3,0.25)] bg-gradient-to-br from-[#171717] via-[#3B2418] to-[#451A03]">
        <div className="px-8 py-6 relative">
          <div className="absolute right-0 top-0 opacity-10">
            <div className="w-64 h-64 rounded-full bg-[#F97316] -mr-32 -mt-32"></div>
          </div>
          <div className="absolute bottom-0 left-1/3 opacity-5">
            <div className="w-48 h-48 rounded-full bg-[#F59E0B]"></div>
          </div>
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#EA580C] via-[#F97316] to-[#F59E0B]" />

          <div className="flex justify-between items-center relative z-10 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                <TeamOutlined className="mr-2 text-[#F97316]" />
                Customer Data
              </h1>
              <p className="text-white/80 text-sm">View and manage registered customers</p>
            </div>
            <Input
              placeholder="Search customers..."
              prefix={<SearchOutlined />}
              allowClear
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{ width: 300 }}
              className="rounded-xl border-0 focus:border-[#F97316] bg-white/95 py-2"
            />
          </div>
        </div>
      </div>

      <Card className="rounded-xl border border-[#F5EDE0] shadow-sm">
        {isLoading ? (
          <Loading full text="Loading customers..." />
        ) : (
        <Table
          columns={listColumns}
          dataSource={customers}
          rowKey="id"
          loading={false}
          pagination={{
            current: pagination.current_page || 1,
            pageSize: PAGE_SIZE,
            total: pagination.total || 0,
            onChange: (p) => setCurrentPage(p),
            showSizeChanger: false,
          }}
          scroll={{ x: 800 }}
          locale={{ emptyText: <div className="py-10 text-center"><div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#FFF1E6] to-[#FFE3C9] rounded-2xl flex items-center justify-center mb-3"><TeamOutlined className="text-3xl text-[#F97316]" /></div><p className="text-[#451A03] font-semibold">No customers found</p><p className="text-gray-400 text-sm">Try adjusting your search</p></div> }}
        />
        )}
      </Card>

      <Modal
        title={<span><UserOutlined className="mr-2 text-[#F97316]" /><span className="text-[#451A03] font-bold">Customer Details</span></span>}
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
            <Card variant="borderless" size="small" className="rounded-xl border border-[#F5EDE0] shadow-sm">
              <Descriptions column={2} bordered size="small"
                styles={{
                  label: { color: "#451A03", fontWeight: 600 },
                }}>
                <Descriptions.Item label="Name" span={2}>{customerDetail.customer.full_name}</Descriptions.Item>
                <Descriptions.Item label="Username">@{customerDetail.customer.username}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={customerDetail.customer.is_active ? "green" : "red"}>
                    {customerDetail.customer.is_active ? "Active" : "Inactive"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Email">{customerDetail.customer.email || "-"}</Descriptions.Item>
                <Descriptions.Item label="Phone">{customerDetail.customer.phone || "-"}</Descriptions.Item>
                <Descriptions.Item label="Address" span={2}>{customerDetail.customer.address || "-"}</Descriptions.Item>
                <Descriptions.Item label="Total Spent">
                  <Text strong style={{ color: "#EA580C" }}>
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
                title={<span><DollarOutlined className="mr-1 text-[#F97316]" /><span className="text-[#451A03] font-semibold">In-Store Sales — {customerDetail.sales.length} transaction{customerDetail.sales.length > 1 ? "s" : ""}</span></span>}
                variant="borderless"
                size="small"
                className="rounded-xl border border-[#F5EDE0] shadow-sm"
              >
                <Table
                  columns={saleColumns}
                  dataSource={customerDetail.sales}
                  rowKey="id"
                  pagination={false}
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
                title={<span><ShoppingCartOutlined className="mr-1 text-[#F97316]" /><span className="text-[#451A03] font-semibold">Online Orders — {customerDetail.orders.length} order{customerDetail.orders.length > 1 ? "s" : ""}</span></span>}
                variant="borderless"
                size="small"
                className="rounded-xl border border-[#F5EDE0] shadow-sm"
              >
                <Table
                  columns={orderColumns}
                  dataSource={customerDetail.orders}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ x: 900 }}
                  expandable={{
                    expandedRowRender: (r) => (
                      <Space orientation="vertical" size="small" style={{ width: "100%" }}>
                        {r.delivery_address && (
                          <Text style={{ fontSize: 12 }}>
                            <HomeOutlined className="mr-1 text-[#F97316]" />Deliver to: {r.delivery_address}
                          </Text>
                        )}
                        {r.gcash_reference && (
                          <Text style={{ fontSize: 12 }}>
                            <CreditCardOutlined className="mr-1 text-[#F97316]" />GCash Ref: {r.gcash_reference}
                          </Text>
                        )}
                        {r.notes && <Text style={{ fontSize: 12 }} type="secondary">Notes: {r.notes}</Text>}
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
              <Empty description="No sales or orders found for this customer" />
            )}

            <Button
              type={customerDetail.customer.is_active ? "primary" : "default"}
              danger={customerDetail.customer.is_active}
              icon={customerDetail.customer.is_active ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
              onClick={() => handleToggleActive(customerDetail.customer)}
              className={customerDetail.customer.is_active
                ? "rounded-xl shadow-[0_4px_15px_rgba(229,72,77,0.25)]"
                : "rounded-xl bg-gradient-to-br from-[#EA580C] via-[#F97316] to-[#F59E0B] border-none text-white shadow-[0_4px_15px_rgba(234,88,12,0.35)] hover:brightness-110 transition-all duration-200"}
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
