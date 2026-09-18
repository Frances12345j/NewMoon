import React, { useState, useEffect } from "react";
import {
  Alert,
  Card,
  Row,
  Col,
  Table,
  DatePicker,
  Select,
  Button,
  Space,
  Typography,
  Statistic,
  Tag,
  Modal,
  Descriptions,
  Image,
  Avatar,
} from "antd";
import {
  TruckOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  UserOutlined,
  ShoppingOutlined,
  DownloadOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "@/config/api";

const { Text } = Typography;
const { RangePicker } = DatePicker;

const STATUS_COLORS = {
  ready: { color: "#D97706", label: "Ready" },
  picked_up: { color: "#059669", label: "Picked Up" },
  out_for_delivery: { color: "#F97316", label: "Out for Delivery" },
  delivered: { color: "#16A34A", label: "Delivered" },
};

const DeliveryReport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [dateRange, setDateRange] = useState([dayjs().startOf("month"), dayjs().endOf("month")]);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedRider, setSelectedRider] = useState(null);
  const [branches, setBranches] = useState([]);
  const [riders, setRiders] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 5, total: 0 });
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchDeliveries = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const [delRes, branchesRes] = await Promise.all([
        api.get("/reports/deliveries", {
          params: {
            start_date: dateRange[0].format("YYYY-MM-DD"),
            end_date: dateRange[1].format("YYYY-MM-DD"),
            status: selectedStatus,
            branch_id: selectedBranch,
            rider_id: selectedRider,
            page,
            per_page: pagination.pageSize,
          },
        }),
        api.get("/branches"),
      ]);

      setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
      const result = delRes.data || {};
      setData(result.data || []);
      setSummary(result.summary || null);
      if (result.pagination) {
        setPagination({
          current: result.pagination.current_page,
          pageSize: result.pagination.per_page,
          total: result.pagination.total,
        });
      }
    } catch (err) {
      console.error("Failed to load deliveries:", err);
      setError(err.response?.data?.message || err.message || "Failed to load delivery records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveries(1);
  }, [dateRange, selectedStatus, selectedBranch, selectedRider]);

  // Load riders for filter
  useEffect(() => {
    api.get("/staff?role=delivery_rider&paginate=false").then((res) => {
      const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setRiders(list);
    }).catch(() => {});
  }, []);

  const handleExport = () => {
    const headers = ["Order #", "Customer", "Address", "Branch", "Rider", "Status", "Total", "Payment", "Date"];
    const csvRows = [headers.join(",")];
    data.forEach((o) => {
      csvRows.push([
        o.order_number,
        `"${o.customer_name}"`,
        `"${o.delivery_address || ""}"`,
        `"${o.branch_name}"`,
        `"${o.rider_name}"`,
        o.status,
        o.total,
        o.payment_method,
        o.created_at,
      ].join(","));
    });
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deliveries_${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showDetail = (order) => {
    setSelectedOrder(order);
    setDetailModalVisible(true);
  };

  const columns = [
    {
      title: "Order #",
      dataIndex: "order_number",
      key: "order_number",
      width: 140,
      render: (val, record) => (
        <a onClick={() => showDetail(record)} className="font-medium text-[#EA580C] hover:text-[#F97316]">
          {val}
        </a>
      ),
    },
    {
      title: "Customer",
      dataIndex: "customer_name",
      key: "customer_name",
      width: 180,
      render: (val) => (
        <div className="flex items-center gap-2">
          <Avatar size={28} icon={<UserOutlined />} style={{ backgroundColor: '#EA580C' }} />
          <span>{val}</span>
        </div>
      ),
    },
    {
      title: "Address",
      dataIndex: "delivery_address",
      key: "delivery_address",
      width: 200,
      ellipsis: true,
    },
    {
      title: "Branch",
      dataIndex: "branch_name",
      key: "branch_name",
      width: 130,
    },
    {
      title: "Rider",
      dataIndex: "rider_name",
      key: "rider_name",
      width: 150,
      render: (val) => (
        <Tag icon={<UserOutlined />} color={val === "Unassigned" ? "default" : "gold"}>
          {val}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status) => {
        const s = STATUS_COLORS[status] || { color: "#6B7280", label: status };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: "Items",
      dataIndex: "items_count",
      key: "items_count",
      width: 70,
      align: "center",
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      width: 110,
      align: "right",
      render: (val) => <span className="font-semibold">₱{Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>,
    },
    {
      title: "Payment",
      dataIndex: "payment_method",
      key: "payment_method",
      width: 100,
      render: (val) => <Tag>{val?.toUpperCase() || "N/A"}</Tag>,
    },
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (val) => dayjs(val).format("MMM D, YYYY h:mm A"),
    },
    {
      title: "Action",
      key: "action",
      width: 80,
      fixed: "right",
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => showDetail(record)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6 bg-gradient-to-br from-[#FFF8ED]/80 via-[#FFFDF9] to-[#FFF1E6]/80 min-h-screen">
      <Row gutter={[16, 16]}>
        {/* Header */}
        <Col span={24}>
          <div className="rounded-2xl overflow-hidden shadow-[0_12px_35px_rgba(69,26,3,0.25)] bg-gradient-to-br from-[#171717] via-[#3B2418] to-[#451A03]">
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
                    <TruckOutlined className="mr-2 text-[#F97316]" />
                    Delivery Report
                  </h1>
                  <p className="text-white/80 text-sm">Delivery status, rider assignments, and order fulfillment</p>
                </div>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                  className="rounded-xl border-[#F59E0B] text-[#FDE68A] hover:bg-white/10 hover:border-[#F59E0B] transition-all duration-200"
                >
                  Export CSV
                </Button>
              </div>
            </div>
          </div>
        </Col>

        {/* Filters */}
        <Col span={24}>
          <Card variant="borderless" size="small" className="rounded-xl border border-[#F5EDE0] shadow-sm">
            <Space wrap size="middle">
              <div>
                <Text type="secondary" className="block text-xs mb-1" style={{ color: "#451A03", fontWeight: 600 }}>Date Range</Text>
                <RangePicker
                  value={dateRange}
                  onChange={(dates) => setDateRange(dates || [dayjs().startOf("month"), dayjs().endOf("month")])}
                  allowClear={false}
                  size="middle"
                  className="rounded-xl"
                />
              </div>
              <div>
                <Text type="secondary" className="block text-xs mb-1" style={{ color: "#451A03", fontWeight: 600 }}>Status</Text>
                <Select
                  style={{ width: 160 }}
                  value={selectedStatus}
                  onChange={setSelectedStatus}
                  allowClear
                  placeholder="All Statuses"
                  className="rounded-xl"
                  options={[
                    { value: "ready", label: "Ready" },
                    { value: "picked_up", label: "Picked Up" },
                    { value: "out_for_delivery", label: "Out for Delivery" },
                    { value: "delivered", label: "Delivered" },
                  ]}
                />
              </div>
              <div>
                <Text type="secondary" className="block text-xs mb-1" style={{ color: "#451A03", fontWeight: 600 }}>Branch</Text>
                <Select
                  style={{ width: 180 }}
                  value={selectedBranch}
                  onChange={setSelectedBranch}
                  allowClear
                  placeholder="All Branches"
                  className="rounded-xl"
                  options={branches.map((b) => ({ value: b.id, label: b.name }))}
                />
              </div>
              <div>
                <Text type="secondary" className="block text-xs mb-1" style={{ color: "#451A03", fontWeight: 600 }}>Rider</Text>
                <Select
                  style={{ width: 180 }}
                  value={selectedRider}
                  onChange={setSelectedRider}
                  allowClear
                  placeholder="All Riders"
                  className="rounded-xl"
                  options={riders.map((r) => ({ value: r.id, label: r.firstname ? `${r.firstname} ${r.lastname || ""}` : r.name }))}
                />
              </div>
            </Space>
          </Card>
        </Col>

        {/* Summary stats */}
        {summary && (
          <Col span={24}>
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <Card variant="borderless" className="rounded-xl border border-[#F5EDE0] shadow-sm" size="small">
                  <Statistic
                    title="Total Deliveries"
                    value={summary.total_deliveries}
                    prefix={<TruckOutlined />}
                    styles={{ content: { color: "#EA580C" } }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card variant="borderless" className="rounded-xl border border-[#F5EDE0] shadow-sm" size="small">
                  <Statistic
                    title="Delivered"
                    value={summary.delivered}
                    prefix={<CheckCircleOutlined />}
                    styles={{ content: { color: "#16A34A" } }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card variant="borderless" className="rounded-xl border border-[#F5EDE0] shadow-sm" size="small">
                  <Statistic
                    title="Out for Delivery"
                    value={summary.out_for_delivery}
                    prefix={<ClockCircleOutlined />}
                    styles={{ content: { color: "#F97316" } }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card variant="borderless" className="rounded-xl border border-[#F5EDE0] shadow-sm" size="small">
                  <Statistic
                    title="Ready / Picked Up"
                    value={summary.ready + summary.picked_up}
                    prefix={<ShoppingOutlined />}
                    styles={{ content: { color: "#D97706" } }}
                  />
                </Card>
              </Col>
            </Row>
          </Col>
        )}

        {error && (
          <Col span={24}>
            <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} />
          </Col>
        )}

        {/* Table */}
        <Col span={24}>
          <Card
            variant="borderless"
            className="rounded-xl border border-[#F5EDE0] shadow-sm"
            title={<span className="text-[#451A03] font-semibold"><TruckOutlined className="mr-2 text-[#F97316]" />Delivery Orders</span>}
          >
            <Table
              columns={columns}
              dataSource={data}
              rowKey="id"
              loading={loading}
              scroll={{ x: 1400 }}
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} deliveries`,
                onChange: (page, pageSize) => {
                  setPagination((prev) => ({ ...prev, current: page, pageSize }));
                  fetchDeliveries(page);
                },
              }}
              size="middle"
            />
          </Card>
        </Col>
      </Row>

      {/* Detail Modal */}
      <Modal
        title={<span><TruckOutlined className="mr-2 text-[#F97316]" /><span className="text-[#451A03] font-bold">Order #{selectedOrder?.order_number || ""}</span></span>}
        open={detailModalVisible}
        onCancel={() => { setDetailModalVisible(false); setSelectedOrder(null); }}
        footer={null}
        width={700}
        className="rounded-2xl"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <Descriptions column={2} size="small" bordered
              styles={{
                label: { color: "#451A03", fontWeight: 600 },
              }}>
              <Descriptions.Item label="Customer">{selectedOrder.customer_name}</Descriptions.Item>
              <Descriptions.Item label="Phone">{selectedOrder.customer_phone || "N/A"}</Descriptions.Item>
              <Descriptions.Item label="Delivery Address" span={2}>
                <div className="flex items-center gap-1">
                  <EnvironmentOutlined className="text-[#F97316]" />
                  {selectedOrder.delivery_address || "N/A"}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Branch">{selectedOrder.branch_name}</Descriptions.Item>
              <Descriptions.Item label="Rider">
                <Tag icon={<UserOutlined />} color={selectedOrder.rider_name === "Unassigned" ? "default" : "gold"}>
                  {selectedOrder.rider_name}
                </Tag>
                {selectedOrder.rider_phone && (
                  <Text className="ml-2 text-xs text-gray-500">
                    <PhoneOutlined /> {selectedOrder.rider_phone}
                  </Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STATUS_COLORS[selectedOrder.status]?.color}>
                  {STATUS_COLORS[selectedOrder.status]?.label || selectedOrder.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Payment">
                <Tag>{selectedOrder.payment_method?.toUpperCase() || "N/A"}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Total">
                <span className="font-bold text-lg text-[#EA580C]">₱{Number(selectedOrder.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Items">{selectedOrder.items_count}</Descriptions.Item>
              <Descriptions.Item label="Date">{dayjs(selectedOrder.created_at).format("MMM D, YYYY h:mm A")}</Descriptions.Item>
              {selectedOrder.delivered_at && (
                <Descriptions.Item label="Delivered At">{dayjs(selectedOrder.delivered_at).format("MMM D, YYYY h:mm A")}</Descriptions.Item>
              )}
            </Descriptions>

            {selectedOrder.delivery_photo && (
              <div>
                <Text strong className="block mb-2 text-[#451A03]">Delivery Photo Proof</Text>
                <Image
                  src={selectedOrder.delivery_photo}
                  alt="Delivery proof"
                  style={{ maxHeight: 300, borderRadius: 8 }}
                  className="border border-[#F5EDE0]"
                />
              </div>
            )}

            {selectedOrder.delivery_notes && (
              <div>
                <Text strong className="block mb-1 text-[#451A03]">Delivery Notes</Text>
                <div className="bg-[#FFF1E6] p-3 rounded-lg border border-[#F5EDE0]">
                  <Text>{selectedOrder.delivery_notes}</Text>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DeliveryReport;
