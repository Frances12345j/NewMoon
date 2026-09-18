import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Badge, Modal, Tooltip } from "antd";
import {
  DashboardOutlined,
  TeamOutlined,
  UserOutlined,
  LogoutOutlined,
  PullRequestOutlined,
  RiseOutlined,
  EnvironmentOutlined,
  TruckOutlined,
  TransactionOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
  DollarOutlined,
  InboxOutlined,
  AuditOutlined,
  BellOutlined,
  FileTextOutlined,
  ArrowLeftOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { api } from "../config/api";
import logo from "../assets/logooos.jpg";
import chicken from "../assets/chicken.jpg";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
    ],
  },
  {
    label: "Products",
    items: [
      { key: "/inventory", icon: <AppstoreOutlined />, label: "Product List" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { key: "/supply-requests", icon: <InboxOutlined />, label: "Supply Requests" },
      { key: "/pullout-admin", icon: <PullRequestOutlined />, label: "Stock Out" },
      { key: "/back-to-sales", icon: <ArrowLeftOutlined />, label: "Back-to-Sales" },
    ],
  },
  {
    label: "Finance",
    items: [
      { key: "/sales", icon: <TransactionOutlined />, label: "Sales" },
      { key: "/cash-advance", icon: <DollarOutlined />, label: "Cash Advance" },
      { key: "/attendance", icon: <DatabaseOutlined />, label: "Attendance" },
    ],
  },
  {
    label: "People",
    items: [
      { key: "/customers", icon: <TeamOutlined />, label: "Customers" },
      { key: "/staff", icon: <UserOutlined />, label: "Staff Management" },
      { key: "/staff-performance", icon: <RiseOutlined />, label: "Performance" },
      { key: "/delivery", icon: <TruckOutlined />, label: "Delivery Fleet" },
    ],
  },
  {
    label: "Branches",
    items: [
      { key: "/branch-map", icon: <EnvironmentOutlined />, label: "Branch Info" },
      { key: "/branch-assign", icon: <AuditOutlined />, label: "Assignments" },
    ],
  },
  {
    label: "Reports",
    items: [
      { key: "/reports", icon: <FileTextOutlined />, label: "Reports" },
    ],
  },
];

function tagStyle(color) {
  const map = {
    green: { bg: "#F0FDF4", text: "#15803D" },
    orange: { bg: "#FFF7ED", text: "#C2410C" },
    amber: { bg: "#FFFBEB", text: "#B45309" },
    red: { bg: "#FEF2F2", text: "#B91C1C" },
  };
  const c = map[color] || map.orange;
  return { fontSize: 9, padding: "2px 6px", borderRadius: 4, background: c.bg, color: c.text, fontWeight: 600, flexShrink: 0, alignSelf: "flex-start", marginTop: 2 };
}

function MenuSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved ? JSON.parse(saved) : false;
  });
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [notificationPanelVisible, setNotificationPanelVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userRole = localStorage.getItem("role") || "admin";

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebarCollapsed", JSON.stringify(next));
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    navigate("/login", { replace: true });
    setLogoutModalVisible(false);
  };

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get("/notifications/unread-count");
      setUnreadCount(res.data.unread_count);
    } catch { }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get("/notifications", { params: { per_page: 10 } });
      setNotifications(res.data.data || []);
    } catch { }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    fetchNotifications();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount, fetchNotifications]);

  const handleMarkAsRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch { }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { }
  };

  const isActive = (key) => location.pathname === key;
  const sidebarW = collapsed ? 68 : 220;

  return (
    <>
      <aside
        style={{
          width: sidebarW,
          minWidth: sidebarW,
          maxWidth: sidebarW,
          height: "100vh",
          position: "sticky",
          top: 0,
          display: "flex",
          flexDirection: "column",
          background: "#1A0F08",
          transition: "width 0.2s ease",
          overflow: "hidden",
          flexShrink: 0,
          zIndex: 100,
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: collapsed ? "14px 0" : "14px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            flexShrink: 0,
          }}
        >
          <div
            onClick={() => navigate("/dashboard")}
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", overflow: "hidden" }}
          >
            <div
              style={{
                width: 36, height: 36, borderRadius: 10, overflow: "hidden",
                flexShrink: 0, border: "1.5px solid rgba(249,115,22,0.4)",
              }}
            >
              {!logoError ? (
                <img
                  src={logo}
                  alt="NewMoon"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={() => setLogoError(true)}
                />
              ) : (
                <div style={{ width: "100%", height: "100%", background: "#F97316", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                  NM
                </div>
              )}
            </div>
            {!collapsed && (
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#FAFAF9", letterSpacing: "-0.3px", lineHeight: 1.2 }}>
                  New<span style={{ color: "#F97316" }}>Moon</span>
                </div>
                <div style={{ fontSize: 10, color: "#78716C", fontWeight: 500, marginTop: 1, whiteSpace: "nowrap" }}>
                  Lechon Manok
                </div>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={toggleCollapsed}
              style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 6, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#78716C", flexShrink: 0, transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            >
              <LeftOutlined style={{ fontSize: 10 }} />
            </button>
          )}
          {collapsed && (
            <button onClick={toggleCollapsed} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#78716C", padding: 0, marginTop: 6 }}>
              <RightOutlined style={{ fontSize: 10 }} />
            </button>
          )}
        </div>

        {/* Chicken Banner */}
        {!collapsed && (
          <div style={{ margin: "10px 10px 0", borderRadius: 10, overflow: "hidden", flexShrink: 0, position: "relative", height: 72 }}>
            <img src={chicken} alt="Roasted Chicken" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 60%" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(26,15,8,0.88) 0%, rgba(26,15,8,0.25) 100%)", display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#FAFAF9", lineHeight: 1.2 }}>🔥 Fresh Roasted</div>
              <div style={{ fontSize: 10, color: "#D97706", fontWeight: 500, marginTop: 2 }}>Lechon Manok & Liempo</div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="nm-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 0 8px" }}>
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.label} style={{ marginBottom: 2 }}>
              {!collapsed && (
                <div style={{ fontSize: 9.5, fontWeight: 600, color: "#57534E", letterSpacing: "0.08em", textTransform: "uppercase", padding: "10px 14px 4px" }}>
                  {group.label}
                </div>
              )}
              {collapsed && gi > 0 && (
                <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "5px 10px" }} />
              )}
              {group.items.map((item) => {
                const active = isActive(item.key);
                return (
                  <Tooltip key={item.key} title={collapsed ? item.label : ""} placement="right">
                    <div
                      onClick={() => navigate(item.key)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: collapsed ? "0 0" : "0 10px",
                        margin: collapsed ? "2px 8px" : "1px 8px",
                        height: 36, borderRadius: 8, cursor: "pointer",
                        background: active ? "#F97316" : "transparent",
                        color: active ? "#FFFFFF" : "#A8A29E",
                        fontWeight: active ? 600 : 400,
                        fontSize: 13,
                        transition: "all 0.15s ease",
                        justifyContent: collapsed ? "center" : "flex-start",
                        userSelect: "none",
                      }}
                      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "rgba(249,115,22,0.12)"; e.currentTarget.style.color = "#F97316"; } }}
                      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#A8A29E"; } }}
                    >
                      <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
                      {!collapsed && <span style={{ fontSize: 13 }}>{item.label}</span>}
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </div>

        {/* User + Bell (expanded) */}
        {!collapsed && (
          <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#F97316", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                {(user.name || user.username || "A")[0].toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#FAFAF9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.name || user.username || "Admin"}
                </div>
                <div style={{ fontSize: 10, color: "#57534E" }}>
                  {userRole === "admin" ? "Administrator" : "Staff"}
                </div>
              </div>
            </div>

            <button
              onClick={() => { setNotificationPanelVisible(!notificationPanelVisible); if (!notificationPanelVisible) fetchNotifications(); }}
              style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, display: "flex", alignItems: "center", transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <Badge count={unreadCount} size="small" offset={[2, -2]}>
                <BellOutlined style={{ fontSize: 16, color: "#78716C" }} />
              </Badge>
            </button>

            {notificationPanelVisible && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setNotificationPanelVisible(false)} />
                <div style={{ position: "absolute", left: 8, bottom: "100%", marginBottom: 8, width: 290, zIndex: 50, background: "#fff", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", border: "1px solid #F5EDE0", maxHeight: 340, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #F5EDE0" }}>
                    <span style={{ fontWeight: 600, fontSize: 12, color: "#1C1917" }}>Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllAsRead} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#F97316", fontWeight: 600, padding: 0 }}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div style={{ overflowY: "auto", flex: 1 }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#A8A29E" }}>No notifications</div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} onClick={() => !n.is_read && handleMarkAsRead(n.id)} style={{ padding: "9px 14px", cursor: "pointer", background: !n.is_read ? "#FFF7ED" : "#fff", borderBottom: "1px solid #F9F5F0", display: "flex", gap: 8 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: !n.is_read ? "#F97316" : "transparent", marginTop: 5, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: "#292524", lineHeight: 1.4 }}>{n.message}</div>
                            {n.data?.branch_name && <div style={{ fontSize: 10, color: "#F97316", marginTop: 2, fontWeight: 600 }}>{n.data.branch_name}</div>}
                            <div style={{ fontSize: 10, color: "#A8A29E", marginTop: 2 }}>{new Date(n.created_at).toLocaleString()}</div>
                          </div>
                          {n.type === "stock_received" && <span style={tagStyle("green")}>Received</span>}
                          {n.type === "cash_advance_request" && <span style={tagStyle("orange")}>Cash Adv</span>}
                          {n.type === "stock_request" && <span style={tagStyle("amber")}>Request</span>}
                          {n.type === "low_stock" && <span style={tagStyle("red")}>Low Stock</span>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Collapsed: bell */}
        {collapsed && (
          <div style={{ padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <Tooltip title="Notifications" placement="right">
              <button onClick={() => { setNotificationPanelVisible(!notificationPanelVisible); if (!notificationPanelVisible) fetchNotifications(); }} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6, borderRadius: 8 }}>
                <Badge count={unreadCount} size="small">
                  <BellOutlined style={{ fontSize: 16, color: "#78716C" }} />
                </Badge>
              </button>
            </Tooltip>
          </div>
        )}

        {/* Sign Out */}
        <div style={{ padding: collapsed ? "8px 8px" : "8px 10px", borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <Tooltip title={collapsed ? "Sign out" : ""} placement="right">
            <button
              onClick={() => setLogoutModalVisible(true)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 8, padding: collapsed ? "7px 0" : "7px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)", background: "transparent", color: "#78716C", cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#78716C"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
            >
              <LogoutOutlined style={{ fontSize: 14 }} />
              {!collapsed && <span>Sign Out</span>}
            </button>
          </Tooltip>
        </div>
      </aside>

      <Modal
        title="Sign Out"
        open={logoutModalVisible}
        onCancel={() => setLogoutModalVisible(false)}
        onOk={handleLogout}
        okText="Yes, Sign Out"
        okButtonProps={{ danger: true, className: "rounded-lg" }}
        cancelButtonProps={{ className: "rounded-lg" }}
      >
        <p style={{ color: "#44403C" }}>Are you sure you want to sign out?</p>
        <p style={{ fontSize: 12, color: "#A8A29E", marginTop: 4 }}>You will need to sign in again to access the dashboard.</p>
      </Modal>

      <style>{`
        .nm-scroll::-webkit-scrollbar { width: 3px; }
        .nm-scroll::-webkit-scrollbar-track { background: transparent; }
        .nm-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        .nm-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>
    </>
  );
}

export default MenuSidebar;
