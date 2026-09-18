import React, { useState, useEffect } from "react";
import {
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
  Tooltip,
  Modal,
  Descriptions,
  Input,
} from "antd";
import {
  SwapOutlined,
  ShopOutlined,
  TruckOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  FileTextOutlined,
  SearchOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../config/api";

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

const PullOutReport = () => {
  const [loading, setLoading] = useState(false);
  const [pullOutData, setPullOutData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedSourceBranch, setSelectedSourceBranch] = useState(null);
  const [selectedDestBranch, setSelectedDestBranch] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [dateRange, setDateRange] = useState([dayjs().startOf("month"), dayjs().endOf("month")]);
  const [branches, setBranches] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedPullOut, setSelectedPullOut] = useState(null);
  const [searchText, setSearchText] = useState("");

  const fetchPullOutReport = async (page = 1) => {
    setLoading(true);
    try {
      const [pullOutRes, branchesRes] = await Promise.all([
        api.get("/reports/stock-out", {
          params: {
            start_date: dateRange[0].format("YYYY-MM-DD"),
            end_date: dateRange[1].format("YYYY-MM-DD"),
            source_branch_id: selectedSourceBranch,
            dest_branch_id: selectedDestBranch,
            status: selectedStatus,
            page: page,
            per_page: pagination.pageSize,
          },
        }),
        api.get("/branches"),
      ]);

      setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
      const data = pullOutRes.data || {};
      
      setPullOutData(data.data || []);
      setSummary(data.summary || null);
      if (data.pagination) {
        setPagination({
          current: data.pagination.current_page,
          pageSize: data.pagination.per_page,
          total: data.pagination.total,
        });
      }
    } catch (err) {
      console.error("[PullOutReport] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPullOutReport(1);
  }, [dateRange, selectedSourceBranch, selectedDestBranch, selectedStatus]);

  const handleTableChange = (pagination) => {
    fetchPullOutReport(pagination.current);
  };

  const handleExport = () => {
    const csvContent = [
      ["Date", "From Branch", "To Branch", "Items", "Total Value", "Requested By", "Status"],
      ...pullOutData.map(row => [
        dayjs(row.created_at).format("YYYY-MM-DD HH:mm"),
        row.source_branch,
        row.destination_branch,
        row.items_count,
        row.total_value,
        row.requested_by,
        row.status,
      ]),
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stockout_report_${dayjs().format("YYYY-MM-DD")}.csv`;
    a.click();
  };

  const showDetailModal = (record) => {
    setSelectedPullOut(record);
    setDetailModalVisible(true);
  };

  const columns = [
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      sorter: (a, b) => dayjs(a.created_at).unix() - dayjs(b.created_at).unix(),
      render: (date) => dayjs(date).format("MMM DD, YYYY HH:mm"),
    },
    {
      title: "From Branch",
      dataIndex: "source_branch",
      key: "source_branch",
      render: (branch) => (
        <Space>
          <ShopOutlined />
          <Text>{branch}</Text>
        </Space>
      ),
    },
    {
      title: "To Branch",
      dataIndex: "destination_branch",
      key: "destination_branch",
      render: (branch) => (
        <Space>
          <ShopOutlined />
          <Text>{branch}</Text>
        </Space>
      ),
    },
    {
      title: "Items",
      dataIndex: "items_count",
      key: "items_count",
      align: "center",
    },
    {
      title: "Total Value",
      dataIndex: "total_value",
      key: "total_value",
      sorter: (a, b) => a.total_value - b.total_value,
      render: (value) => (
        <Text strong style={{ color: "#EA580C" }}>
          ₱{Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: "Requested By",
      dataIndex: "requested_by",
      key: "requested_by",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      filters: [
        { text: "Pending", value: "pending" },
        { text: "Approved", value: "approved" },
        { text: "In Transit", value: "in_transit" },
        { text: "Completed", value: "completed" },
        { text: "Rejected", value: "rejected" },
      ],
      render: (status) => {
        const config = {
          pending: { color: "orange", icon: <ClockCircleOutlined /> },
          approved: { color: "blue", icon: <CheckCircleOutlined /> },
          in_transit: { color: "cyan", icon: <TruckOutlined /> },
          completed: { color: "green", icon: <CheckCircleOutlined /> },
          rejected: { color: "red", icon: <CloseCircleOutlined /> },
        };
        const { color, icon } = config[status] || config.pending;
        return <Tag color={color} icon={icon}>{status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}</Tag>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Button type="link" className="!text-orange-600 hover:!text-orange-700" onClick={() => showDetailModal(record)}>
          View Details
        </Button>
      ),
    },
  ];

  const itemColumns = [
    {
      title: "Item",
      dataIndex: "item_name",
      key: "item_name",
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      align: "center",
    },
    {
      title: "Unit Cost",
      dataIndex: "unit_cost",
      key: "unit_cost",
      render: (cost) => cost !== null && cost !== undefined ? `₱${Number(cost).toFixed(2)}` : "-",
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      render: (total) => total !== null && total !== undefined ? `₱${Number(total).toFixed(2)}` : "-",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FFF7ED] p-4 sm:p-6 lg:p-8">
      {/* Hero Header */}
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-stone-950 via-stone-900 to-orange-950 shadow-[0_20px_50px_rgba(67,20,7,0.20)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-500/[0.08] blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-amber-400/[0.06] blur-2xl" />
        <div className="pointer-events-none absolute right-1/3 top-1/2 h-32 w-32 rounded-full bg-orange-400/[0.05] blur-2xl" />

        <div className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-[120px] leading-none text-white/[0.03]">
          <SwapOutlined />
        </div>

        <div className="relative z-10 px-8 py-7">
          <div className="mb-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
              <SwapOutlined />
              Stock Transfers
            </span>
          </div>

          <div className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">
                Stock Out <span className="text-orange-400">Report</span>
              </h1>
              <p className="text-white/60 text-sm">
                Item transfers between branches
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExport}
                className="!h-11 !rounded-xl !border-stone-200 !px-5 !font-medium !text-stone-700 hover:!border-orange-300 hover:!text-orange-600"
              >
                Export CSV
              </Button>
              <Button
                type="primary"
                icon={<FileTextOutlined />}
                onClick={fetchPullOutReport}
                loading={loading}
                className="!h-11 !rounded-xl !border-none !bg-gradient-to-r !from-orange-600 !to-amber-500 !px-5 !font-semibold !shadow-lg !shadow-orange-500/20"
              >
                Generate Report
              </Button>
            </div>
          </div>

          {/* KPI Chips */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/15">
                  <SwapOutlined className="text-orange-400 text-base" />
                </div>
                <div>
                  <p className="text-white/50 text-xs">Total Requests</p>
                  <p className="text-white font-bold text-lg leading-tight">
                    {summary.total_transfers}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/15">
                  <CheckCircleOutlined className="text-orange-400 text-base" />
                </div>
                <div>
                  <p className="text-white/50 text-xs">Completed</p>
                  <p className="text-white font-bold text-lg leading-tight">
                    {summary.completed}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15">
                  <ClockCircleOutlined className="text-amber-400 text-base" />
                </div>
                <div>
                  <p className="text-white/50 text-xs">Pending</p>
                  <p className="text-white font-bold text-lg leading-tight">
                    {summary.pending}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/15">
                  <DollarOutlined className="text-orange-400 text-base" />
                </div>
                <div>
                  <p className="text-white/50 text-xs">Total Value</p>
                  <p className="text-white font-bold text-lg leading-tight">
                    ₱{Number(summary.total_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <SearchOutlined />
          </div>
          <h3 className="text-base font-bold text-stone-900">Filters</h3>
        </div>
        <Space wrap>
          <Text strong>Date Range:</Text>
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            format="YYYY-MM-DD"
            allowClear={false}
            className="!h-11 !rounded-xl !border-stone-200 hover:!border-orange-300 focus:!border-orange-500"
          />
          <Text strong>From Branch:</Text>
          <Select
            style={{ width: 200 }}
            placeholder="All Branches"
            allowClear
            value={selectedSourceBranch}
            onChange={setSelectedSourceBranch}
            className="!h-11 !rounded-xl"
            popupClassName="!rounded-xl"
          >
            {Array.isArray(branches) && branches.map((branch) => (
              <Select.Option key={branch.id} value={branch.id}>
                {branch.name}
              </Select.Option>
            ))}
          </Select>
          <Text strong>To Branch:</Text>
          <Select
            style={{ width: 200 }}
            placeholder="All Branches"
            allowClear
            value={selectedDestBranch}
            onChange={setSelectedDestBranch}
            className="!h-11 !rounded-xl"
            popupClassName="!rounded-xl"
          >
            {Array.isArray(branches) && branches.map((branch) => (
              <Select.Option key={branch.id} value={branch.id}>
                {branch.name}
              </Select.Option>
            ))}
          </Select>
          <Text strong>Status:</Text>
          <Select
            style={{ width: 150 }}
            placeholder="All Status"
            allowClear
            value={selectedStatus}
            onChange={setSelectedStatus}
            className="!h-11 !rounded-xl"
            popupClassName="!rounded-xl"
          >
            <Select.Option value="pending">Pending</Select.Option>
            <Select.Option value="approved">Approved</Select.Option>
            <Select.Option value="in_transit">In Transit</Select.Option>
            <Select.Option value="completed">Completed</Select.Option>
            <Select.Option value="rejected">Rejected</Select.Option>
          </Select>
          <Input
            placeholder="Search reference..."
            prefix={<SearchOutlined className="text-orange-400" />}
            style={{ width: 200 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="!h-11 !rounded-xl !border-stone-200 hover:!border-orange-300 focus:!border-orange-500"
          />
        </Space>
      </div>

      {/* Pull-Out Table */}
      <div className="rounded-2xl border border-orange-100 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-orange-100">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <FileTextOutlined />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">Stock Out Requests</h3>
              <p className="text-xs text-stone-500">{pagination.total} total records</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <Table
            columns={columns}
            dataSource={pullOutData.filter(
              (item) =>
                !searchText ||
                item.reference_number.toLowerCase().includes(searchText.toLowerCase())
            )}
            rowKey="id"
            loading={loading}
            pagination={pagination}
            onChange={handleTableChange}
            scroll={{ x: true }}
          />
        </div>
      </div>

      {/* Detail Modal */}
      <Modal
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
        title={
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <FileTextOutlined />
            </div>
            <span className="font-bold text-stone-900">Stock Out Request Details</span>
          </div>
        }
      >
        {selectedPullOut && (
          <div className="rounded-2xl">
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Reference">{selectedPullOut.reference_number}</Descriptions.Item>
              <Descriptions.Item label="Date">{dayjs(selectedPullOut.created_at).format("MMM DD, YYYY HH:mm")}</Descriptions.Item>
              <Descriptions.Item label="From Branch">{selectedPullOut.source_branch}</Descriptions.Item>
              <Descriptions.Item label="To Branch">{selectedPullOut.destination_branch}</Descriptions.Item>
              <Descriptions.Item label="Requested By">{selectedPullOut.requested_by}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={selectedPullOut.status === "completed" ? "green" : selectedPullOut.status === "pending" ? "orange" : "blue"}>
                  {selectedPullOut.status.charAt(0).toUpperCase() + selectedPullOut.status.slice(1)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Total Items" span={2}>{selectedPullOut.items_count}</Descriptions.Item>
              <Descriptions.Item label="Total Value" span={2}>
                <Text strong style={{ color: "#EA580C", fontSize: 18 }}>
                  ₱{Number(selectedPullOut.total_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Text>
              </Descriptions.Item>
              {selectedPullOut.notes && (
                <Descriptions.Item label="Notes" span={2}>{selectedPullOut.notes}</Descriptions.Item>
              )}
            </Descriptions>

            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <SwapOutlined />
              </div>
              <Title level={5} className="!mb-0 !text-stone-900">Items</Title>
            </div>
            <Table
              columns={itemColumns}
              dataSource={selectedPullOut.items || []}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PullOutReport;
