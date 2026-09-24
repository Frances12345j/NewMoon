import { useState } from "react";
import {
  Card, Table, Button, Modal, Input, InputNumber, Select, message,
  Tag, Row, Col, Space, Checkbox, Divider, Tooltip, DatePicker,
} from "antd";
import {
  ShoppingCartOutlined, TransactionOutlined, ReloadOutlined,
  PlusOutlined, DeleteOutlined, EyeOutlined, InfoCircleOutlined,
  FireOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/config/api";
import { clientPagination, serverPagination } from "@/components/Pagination";

const { RangePicker } = DatePicker;

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

const fmtCurrency = (v) => `₱${Number(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

function SalesRecord() {
  const queryClient = useQueryClient();

  // Filters for sales history
  const [branchFilter, setBranchFilter] = useState("all");
  const [dateRange, setDateRange] = useState(null);

  // New sale form state
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleBranch, setSaleBranch] = useState(null);
  const [saleUser, setSaleUser] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [seniorDiscount, setSeniorDiscount] = useState(false);
  const [cashCollected, setCashCollected] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [saleItems, setSaleItems] = useState([{ product_id: null, quantity: 1, product_name: "", product_price: 0 }]);
  const [submitting, setSubmitting] = useState(false);

  // Detail modal
  const [detailSale, setDetailSale] = useState(null);

  // Data fetching
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get("/branches"),
  });

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: () => api.get("/staff"),
  });

  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get("/products", { params: { per_page: 200 } }),
  });

  const params = {};
  if (branchFilter !== "all") params.branch_id = branchFilter;
  if (dateRange && dateRange[0] && dateRange[1]) {
    params.start_date = dateRange[0].format("YYYY-MM-DD");
    params.end_date = dateRange[1].format("YYYY-MM-DD");
  }

  const { data: salesData, isLoading, refetch } = useQuery({
    queryKey: ["sales", params],
    queryFn: () => api.get("/sales", { params }),
  });

  const branches = branchesData?.data?.data || [];
  const staff = staffData?.data?.data || [];
  const products = productsData?.data?.data || [];
  const sales = salesData?.data?.data || [];

  // Compute today's stats from loaded sales
  const phNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const today = phNow.toISOString().slice(0, 10);
  const todaySales = sales.filter((s) => String(s.sale_date).startsWith(today));
  const todayCount = todaySales.length;
  const todayRevenue = todaySales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const todayItems = todaySales.reduce((sum, s) => {
    if (s.items) return sum + s.items.reduce((iSum, item) => iSum + Number(item.quantity || 0), 0);
    return sum;
  }, 0);

  // Add item row
  const addItem = () => {
    setSaleItems([...saleItems, { product_id: null, quantity: 1, product_name: "", product_price: 0 }]);
  };

  // Remove item row
  const removeItem = (idx) => {
    if (saleItems.length <= 1) return;
    setSaleItems(saleItems.filter((_, i) => i !== idx));
  };

  // Update item
  const updateItem = (idx, field, value) => {
    const updated = [...saleItems];
    if (field === "product_id") {
      const product = products.find((p) => p.id === value);
      updated[idx] = {
        ...updated[idx],
        product_id: value,
        product_name: product?.name || "",
        product_price: Number(product?.price || 0),
        quantity: 1,
      };
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    setSaleItems(updated);
  };

  // Calculate totals
  const subtotal = saleItems.reduce((sum, item) => {
    return sum + (item.product_price * (item.quantity || 0));
  }, 0);

  const discountAmount = seniorDiscount ? subtotal * 0.2 : 0;
  const total = Math.max(subtotal - discountAmount, 0);
  const change = cashCollected - total;

  // Submit sale
  const submitSale = async () => {
    if (!saleBranch) { message.error("Please select a branch"); return; }
    if (!saleUser) { message.error("Please select a staff member"); return; }
    if (!saleItems.length || saleItems.every((i) => !i.product_id)) { message.error("Please add at least one item"); return; }
    if (saleItems.some((i) => !i.product_id)) { message.error("Please select a product for all item rows"); return; }
    if (cashCollected < total) { message.error("Cash collected must be at least the total amount"); return; }

    setSubmitting(true);
    try {
      const payload = {
        branch_id: saleBranch,
        user_id: saleUser,
        customer_name: customerName || null,
        senior_discount: seniorDiscount,
        items: saleItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        cash_collected: cashCollected,
        payment_method: paymentMethod,
      };

      await api.post("/sales", payload);
      message.success("Sale recorded successfully!");
      setShowSaleModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || "Failed to record sale";
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSaleBranch(null);
    setSaleUser(null);
    setCustomerName("");
    setSeniorDiscount(false);
    setCashCollected(0);
    setPaymentMethod("cash");
    setSaleItems([{ product_id: null, quantity: 1, product_name: "", product_price: 0 }]);
  };

  const columns = [
    {
      title: "Invoice",
      dataIndex: "invoice_number",
      key: "invoice_number",
      width: 160,
      render: (v) => <span className="font-mono text-sm">{v}</span>,
    },
    {
      title: "Date",
      dataIndex: "sale_date",
      key: "sale_date",
      width: 120,
      render: (v) => v ? new Date(v + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "-",
    },
    {
      title: "Branch",
      key: "branch",
      width: 140,
      render: (_, r) => r.branch?.name || "-",
    },
    {
      title: "Customer",
      dataIndex: "customer_name",
      key: "customer_name",
      width: 140,
      render: (v) => v || <span style={{ color: MUTED }}>Walk-in</span>,
    },
    {
      title: "Items",
      key: "items_count",
      width: 80,
      render: (_, r) => (r.items?.length || 0),
    },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      width: 120,
      render: (v) => <span className="font-semibold" style={{ color: ACCENT }}>{fmtCurrency(v)}</span>,
    },
    {
      title: "Payment",
      dataIndex: "payment_method",
      key: "payment_method",
      width: 100,
      render: (v) => (
        <Tag className="rounded-full px-3 py-1" style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
          {v || "cash"}
        </Tag>
      ),
    },
    {
      title: "Cashier",
      key: "user",
      width: 140,
      render: (_, r) => r.user?.firstname ? `${r.user.firstname} ${r.user.lastname || ""}` : r.user?.username || "-",
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      render: (_, r) => (
        <Tooltip title="View Details">
          <Button type="text" icon={<EyeOutlined />} onClick={() => setDetailSale(r)} style={{ color: ACCENT }} />
        </Tooltip>
      ),
    },
  ];

  const productOptions = products
    .filter((p) => p.is_active !== false)
    .map((p) => {
      const stock = (p.stocks || []).find((s) => Number(s.branch_id) === Number(saleBranch));
      const qty = Number(stock?.quantity || 0);
      const hasBranch = !!saleBranch;
      return {
        value: p.id,
        disabled: hasBranch && qty <= 0,
        label: hasBranch
          ? `${p.name}${p.sku ? ` (${p.sku})` : ""} — ${fmtCurrency(p.price)}  [Stock: ${qty}]`
          : `${p.name}${p.sku ? ` (${p.sku})` : ""} — ${fmtCurrency(p.price)}`,
        stockQty: qty,
      };
    });

  return (
    <div className="nm-dark min-h-screen p-6" style={{ background: "#1F1A2E" }}>
      

      {/* Header — dark plum with mint accents */}
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
                <FireOutlined className="mr-2" style={{ color: ACCENT }} />
                Sales Record
              </h1>
              <p className="text-sm" style={{ color: MUTED }}>Record new sales and view sales history</p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="relative z-10 mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <TransactionOutlined style={{ color: ACCENT }} /> Today's Transactions
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{todayCount}</p>
            </div>
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <FireOutlined style={{ color: ACCENT }} /> Today's Revenue
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: ACCENT }}>{fmtCurrency(todayRevenue)}</p>
            </div>
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <ShoppingCartOutlined style={{ color: ACCENT }} /> Items Sold Today
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{todayItems}</p>
            </div>
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <TransactionOutlined style={{ color: ACCENT }} /> Total Transactions
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{sales.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <Card
        className="mb-6"
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
        styles={{ body: { background: PANEL_BG } }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="primary"
            size="large"
            icon={<ShoppingCartOutlined />}
            onClick={() => setShowSaleModal(true)}
            style={GRADIENT_BTN}
          >
            New Sale
          </Button>
          <Space wrap>
            <span className="text-sm font-medium" style={{ color: MUTED }}>Branch:</span>
            <Select
              value={branchFilter}
              onChange={setBranchFilter}
              style={{ width: 160 }}
              className="rounded-xl"
              popupClassName="nm-dark-select-dropdown"
            >
              <Select.Option value="all">All Branches</Select.Option>
              {branches.map((b) => (
                <Select.Option key={b.id} value={String(b.id)}>{b.name}</Select.Option>
              ))}
            </Select>
            <RangePicker value={dateRange} onChange={setDateRange} allowClear className="rounded-xl" popupClassName="nm-dark-select-dropdown" />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isLoading}
              style={GHOST_BTN}
            >
              Refresh
            </Button>
          </Space>
        </div>
      </Card>

      {/* Sales History Section */}
      <div className="mb-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: TEXT }}>
              <TransactionOutlined className="mr-2" style={{ color: ACCENT }} />
              Sales History
            </h2>
            <p className="mt-1 text-sm" style={{ color: MUTED }}>Browse and filter all recorded transactions</p>
          </div>
          <Tag
            className="rounded-full px-3 py-1 text-sm font-semibold"
            style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}
          >
            {sales.length} sale{sales.length !== 1 ? 's' : ''}
          </Tag>
        </div>
      </div>

      <Card style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }} styles={{ body: { background: PANEL_BG } }}>
        <Table
          columns={columns}
          dataSource={sales}
          rowKey="id"
          loading={isLoading}
          pagination={clientPagination({ label: "sales" })}
          locale={{
            emptyText: (
              <div className="py-10 text-center">
                <div
                  className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: ACCENT_SOFT, color: ACCENT }}
                >
                  <TransactionOutlined className="text-3xl" />
                </div>
                <p className="font-semibold" style={{ color: TEXT }}>No sales recorded yet</p>
                <p className="text-sm" style={{ color: MUTED }}>Click "New Sale" to record your first transaction</p>
              </div>
            ),
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* New Sale Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-lg"
              style={{ background: ACCENT_SOFT, color: ACCENT }}
            >
              <ShoppingCartOutlined />
            </div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>New Sale</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>Record a new POS transaction</p>
            </div>
          </div>
        }
        open={showSaleModal}
        onCancel={() => { setShowSaleModal(false); resetForm(); }}
        footer={null}
        width={700}
        destroyOnHidden
        className="rounded-2xl"
      >
        <div className="space-y-4">
          {/* Branch & Staff */}
          <Row gutter={16}>
            <Col span={12}>
              <div className="mb-1 text-sm font-semibold" style={FIELD_LABEL}>Branch *</div>
              <Select
                value={saleBranch}
                onChange={setSaleBranch}
                style={{ width: "100%" }}
                placeholder="Select branch"
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
                className="rounded-xl"
                popupClassName="nm-dark-select-dropdown"
              />
            </Col>
            <Col span={12}>
              <div className="mb-1 text-sm font-semibold" style={FIELD_LABEL}>Cashier / Staff *</div>
              <Select
                value={saleUser}
                onChange={setSaleUser}
                style={{ width: "100%" }}
                placeholder="Select staff"
                showSearch
                filterOption={(input, option) => (option?.label || "").toLowerCase().includes(input.toLowerCase())}
                options={staff.map((s) => ({
                    value: s.id,
                    label: `${s.firstname || ""} ${s.lastname || ""}${s.username ? ` (${s.username})` : ""}`,
                  }))}
                className="rounded-xl"
                popupClassName="nm-dark-select-dropdown"
              />
            </Col>
          </Row>

          {/* Customer Name */}
          <div>
            <div className="mb-1 text-sm font-semibold" style={FIELD_LABEL}>Customer Name (optional)</div>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Walk-in customer"
              className="rounded-xl"
            />
          </div>

          <Divider />

          {/* Items */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold" style={FIELD_LABEL}>Items</span>
              <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addItem} className="rounded-xl" style={GHOST_BTN}>
                Add Item
              </Button>
            </div>

            {saleItems.map((item, idx) => {
              const opt = productOptions.find((o) => o.value === item.product_id);
              const maxQty = opt?.stockQty || 0;
              return (
              <Row key={idx} gutter={8} className="mb-2 items-center">
                <Col span={10}>
                  <Select
                    value={item.product_id}
                    onChange={(v) => updateItem(idx, "product_id", v)}
                    style={{ width: "100%" }}
                    placeholder="Search product..."
                    showSearch
                    filterOption={(input, option) => (option?.label || "").toLowerCase().includes(input.toLowerCase())}
                    options={productOptions}
                    popupClassName="nm-dark-select-dropdown"
                  />
                </Col>
                <Col span={4}>
                  <InputNumber
                    value={item.quantity}
                    onChange={(v) => updateItem(idx, "quantity", v || 0)}
                    min={0.5}
                    max={maxQty || undefined}
                    step={0.5}
                    style={{ width: "100%" }}
                    placeholder="Qty"
                  />
                </Col>
                <Col span={3}>
                  <div className="pt-1 text-sm" style={{ color: MUTED }}>{fmtCurrency(item.product_price)}</div>
                </Col>
                <Col span={3}>
                  <div className="pt-1 font-semibold" style={{ color: ACCENT }}>{fmtCurrency(item.product_price * (item.quantity || 0))}</div>
                </Col>
                <Col span={2}>
                  {maxQty > 0 ? (
                    <span className="text-xs whitespace-nowrap" style={{ color: AMBER }}>{maxQty} avail</span>
                  ) : item.product_id ? (
                    <span className="text-xs" style={{ color: "#F87171" }}>out</span>
                  ) : null}
                </Col>
                <Col span={2}>
                  {saleItems.length > 1 && (
                    <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeItem(idx)} />
                  )}
                </Col>
              </Row>
            )})}
          </div>

          <Divider />

          {/* Senior Discount */}
          <Checkbox checked={seniorDiscount} onChange={(e) => setSeniorDiscount(e.target.checked)}>
            Senior Citizen Discount (20%)
          </Checkbox>

          {/* Totals */}
          <div className="space-y-1 rounded-xl p-4" style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}30` }}>
            <Row justify="space-between"><Col>Subtotal:</Col><Col>{fmtCurrency(subtotal)}</Col></Row>
            {seniorDiscount && (
              <Row justify="space-between" style={{ color: "#F87171" }}><Col>Senior Discount (20%):</Col><Col>-{fmtCurrency(discountAmount)}</Col></Row>
            )}
            <Row justify="space-between" className="text-lg font-bold"><Col>Total:</Col><Col style={{ color: ACCENT }}>{fmtCurrency(total)}</Col></Row>
          </div>

          {/* Cash Collected & Payment */}
          <Row gutter={16}>
            <Col span={12}>
              <div className="mb-1 text-sm font-semibold" style={FIELD_LABEL}>Cash Collected *</div>
              <InputNumber
                value={cashCollected}
                onChange={setCashCollected}
                min={0}
                step={0.25}
                prefix="₱"
                style={{ width: "100%" }}
                placeholder="0.00"
                className="rounded-xl"
              />
            </Col>
            <Col span={6}>
              <div className="mb-1 text-sm font-semibold" style={FIELD_LABEL}>Payment Method</div>
              <Select value={paymentMethod} onChange={setPaymentMethod} style={{ width: "100%" }} className="rounded-xl" popupClassName="nm-dark-select-dropdown">
                <Select.Option value="cash">Cash</Select.Option>
                <Select.Option value="card">Card</Select.Option>
                <Select.Option value="gcash">GCash</Select.Option>
                <Select.Option value="maya">Maya</Select.Option>
              </Select>
            </Col>
            <Col span={6}>
              <div className="mb-1 text-sm font-semibold" style={FIELD_LABEL}>Change</div>
              <div
                className="pt-1 text-xl font-bold"
                style={{ color: change >= 0 ? ACCENT : "#F87171" }}
              >
                {fmtCurrency(change)}
              </div>
            </Col>
          </Row>

          {/* Submit */}
          <Button
            type="primary"
            size="large"
            block
            icon={<ShoppingCartOutlined />}
            onClick={submitSale}
            loading={submitting}
            style={GRADIENT_BTN}
          >
            Complete Sale — {fmtCurrency(total)}
          </Button>
        </div>
      </Modal>

      {/* Sale Detail Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-lg"
              style={{ background: ACCENT_SOFT, color: ACCENT }}
            >
              <EyeOutlined />
            </div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>Sale Details — {detailSale?.invoice_number || ""}</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>Transaction breakdown</p>
            </div>
          </div>
        }
        open={!!detailSale}
        onCancel={() => setDetailSale(null)}
        footer={<Button onClick={() => setDetailSale(null)} className="rounded-xl" style={SECONDARY_BTN}>Close</Button>}
        width={600}
        className="rounded-2xl"
      >
        {detailSale && (
          <div className="space-y-4">
            <Row gutter={16}>
              <Col span={12}>
                <div className="text-sm" style={{ color: MUTED }}>Branch</div>
                <div className="font-semibold" style={{ color: TEXT }}>{detailSale.branch?.name || "-"}</div>
              </Col>
              <Col span={12}>
                <div className="text-sm" style={{ color: MUTED }}>Date</div>
                <div className="font-semibold" style={{ color: TEXT }}>{detailSale.sale_date}</div>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <div className="text-sm" style={{ color: MUTED }}>Customer</div>
                <div className="font-semibold" style={{ color: TEXT }}>{detailSale.customer_name || "Walk-in"}</div>
              </Col>
              <Col span={12}>
                <div className="text-sm" style={{ color: MUTED }}>Cashier</div>
                <div className="font-semibold" style={{ color: TEXT }}>
                  {detailSale.user?.firstname} {detailSale.user?.lastname || ""}
                </div>
              </Col>
            </Row>
            <Divider />
            <div className="mb-2 text-sm font-medium" style={{ color: TEXT }}>Items</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: BORDER }}>
                  <th className="py-1 text-left" style={{ color: MUTED }}>Product</th>
                  <th className="py-1 text-right" style={{ color: MUTED }}>Qty</th>
                  <th className="py-1 text-right" style={{ color: MUTED }}>Price</th>
                  <th className="py-1 text-right" style={{ color: MUTED }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(detailSale.items || []).map((item, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: BORDER }}>
                    <td className="py-1">{item.product?.name || `Product #${item.product_id}`}</td>
                    <td className="py-1 text-right">{item.quantity}</td>
                    <td className="py-1 text-right">{fmtCurrency(item.price)}</td>
                    <td className="py-1 text-right font-semibold">{fmtCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Divider />
            <div className="space-y-1 rounded-xl p-4" style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}30` }}>
              <Row justify="space-between"><Col>Subtotal:</Col><Col>{fmtCurrency(detailSale.subtotal)}</Col></Row>
              {Number(detailSale.discount_amount) > 0 && (
                <Row justify="space-between" style={{ color: "#F87171" }}><Col>Discount:</Col><Col>-{fmtCurrency(detailSale.discount_amount)}</Col></Row>
              )}
              <Row justify="space-between" className="text-lg font-bold"><Col>Total:</Col><Col style={{ color: ACCENT }}>{fmtCurrency(detailSale.total)}</Col></Row>
              <Row justify="space-between"><Col>Cash Collected:</Col><Col>{fmtCurrency(detailSale.cash_collected)}</Col></Row>
              <Row justify="space-between"><Col>Change:</Col><Col>{fmtCurrency(detailSale.change_given)}</Col></Row>
              <Row justify="space-between"><Col>Payment Method:</Col><Col><Tag className="rounded-full px-3 py-1" style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}>{detailSale.payment_method || "cash"}</Tag></Col></Row>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default SalesRecord;