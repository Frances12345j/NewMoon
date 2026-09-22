import React, { useEffect, useState } from "react";
import { Card, Table, Tag, Button, Space, DatePicker, Input, message } from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
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

function AttendanceView() {
  const [attendanceData, setAttendanceData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loadAttendanceData = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/attendance", {
        params: { date: selectedDate },
      });
      const records = response.data?.data ?? [];
      setAttendanceData(records);
    } catch (error) {
      console.error("Error loading attendance:", error);
      message.error("Failed to load attendance data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceData();
  }, [selectedDate]);

  const filteredData = Array.isArray(attendanceData)
    ? attendanceData.filter((item) => {
        const firstName = item.user?.firstname || "";
        const lastName = item.user?.lastname || "";
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName.toLowerCase().includes(searchTerm.toLowerCase());
      })
    : [];

  const formatTime = (time) => {
    if (!time) return "-";
    try {
      if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
      }
      const date = new Date(time);
      if (isNaN(date.getTime())) return time;
      return date.toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return time;
    }
  };

  const statusTag = (status) => {
    const normalized = String(status).toLowerCase().trim();
    if (normalized === "present" || normalized === "completed") {
      return <Tag className="rounded-full px-3 py-1" icon={<CheckCircleOutlined />} style={{ background: GREEN_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}>Present</Tag>;
    }
    if (normalized === "completed_late") {
      return <Tag className="rounded-full px-3 py-1" icon={<CheckCircleOutlined />} style={{ background: GREEN_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}>Completed (Late)</Tag>;
    }
    if (normalized === "late") {
      return <Tag className="rounded-full px-3 py-1" icon={<ClockCircleOutlined />} style={{ background: AMBER_SOFT, color: AMBER, border: `1px solid ${AMBER}30` }}>Late</Tag>;
    }
    if (normalized === "absent") {
      return <Tag className="rounded-full px-3 py-1" icon={<CloseCircleOutlined />} style={{ background: RED_SOFT, color: "#F87171", border: `1px solid ${RED}30` }}>Absent</Tag>;
    }
    return <Tag style={{ background: PANEL_BG_2, color: MUTED, border: "none" }}>{status || "Unknown"}</Tag>;
  };

  const getStatusStats = (data) => {
    let present = 0, late = 0, absent = 0;
    data.forEach(item => {
      const status = String(item.status).toLowerCase().trim();
      if (status === "present" || status === "completed" || status === "completed_late") present++;
      else if (status === "late") late++;
      else if (status === "absent") absent++;
    });
    return { present, late, absent };
  };

  const totalStaff = filteredData.length;
  const stats = getStatusStats(filteredData);

  const columns = [
    {
      title: "Staff Name",
      key: "name",
      render: (_, r) => (
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
            style={{ background: PANEL_BG_2, color: ACCENT }}
          >
            {r.user?.firstname?.charAt(0) || "?"}
          </div>
          <span className="font-medium" style={{ color: TEXT }}>
            {r.user?.firstname && r.user?.lastname
              ? `${r.user.firstname} ${r.user.lastname}`
              : r.user?.firstname || r.user?.lastname || "Unknown Staff"}
          </span>
        </div>
      ),
    },
    {
      title: "Branch",
      key: "branch",
      render: (_, r) => r.branch?.name || <span style={{ color: MUTED }}>N/A</span>,
    },
    {
      title: "Time In",
      key: "time_in",
      align: "center",
      render: (_, r) => <span className="font-mono">{formatTime(r.time_in)}</span>,
    },
    {
      title: "Time Out",
      key: "time_out",
      align: "center",
      render: (_, r) => <span className="font-mono">{formatTime(r.time_out)}</span>,
    },
    {
      title: "Status",
      key: "status",
      align: "center",
      render: (_, r) => statusTag(r.status),
    },
    {
      title: "Hours Worked",
      key: "hours_worked",
      align: "center",
      render: (_, r) => (r.hours_worked ? `${r.hours_worked}h` : "-"),
    },
    {
      title: "Daily Rate",
      key: "daily_rate",
      align: "right",
      render: (_, r) => <span className="font-medium" style={{ color: ACCENT }}>₱{r.daily_rate?.toFixed(2) || "0.00"}</span>,
    },
  ];

  return (
    <div className="nm-dark min-h-screen p-6" style={{ background: "#1F1A2E" }}>
      

      {/* Hero Header */}
      <div
        className="mb-6 overflow-hidden rounded-2xl"
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}` }}
      >
        <div className="relative px-8 py-6">
          <div className="absolute right-0 top-0 opacity-10">
            <div className="-mr-32 -mt-32 h-64 w-64 rounded-full" style={{ background: ACCENT }} />
          </div>
          <div className="absolute bottom-0 left-1/3 opacity-5">
            <div className="h-48 w-48 rounded-full" style={{ background: ACCENT }} />
          </div>
          <div
            className="absolute left-0 right-0 top-0 h-1"
            style={{ background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_DEEP})` }}
          />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="mb-1 text-2xl font-bold" style={{ color: TEXT }}>
                <TeamOutlined className="mr-2" style={{ color: ACCENT }} />
                Attendance Records
              </h1>
              <p className="text-sm" style={{ color: MUTED }}>
                Staff attendance for {dayjs(selectedDate).format("MMMM D, YYYY")}
              </p>
            </div>
          </div>

          {/* KPI Chips */}
          <div className="relative z-10 mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl px-4 py-3" style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}>
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <CheckCircleOutlined style={{ color: ACCENT }} /> Present
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{stats.present}</p>
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}>
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <ClockCircleOutlined style={{ color: AMBER }} /> Late
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{stats.late}</p>
            </div>
            <div className="rounded-2xl px-4 py-3" style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}>
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <CloseCircleOutlined style={{ color: RED }} /> Absent
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{stats.absent}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card
        className="mb-6"
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
        styles={{ body: { background: PANEL_BG } }}
      >
        <Space wrap>
          <DatePicker
            value={dayjs(selectedDate)}
            onChange={(date) => {
              if (date) setSelectedDate(date.format("YYYY-MM-DD"));
            }}
            allowClear={false}
            className="rounded-xl"
            popupClassName="nm-dark-select-dropdown"
          />
          <Input
            placeholder="Search staff..."
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 220 }}
            allowClear
            className="rounded-xl"
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={loadAttendanceData}
            loading={isLoading}
            style={GHOST_BTN}
          >
            Refresh
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
              <UserOutlined />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: TEXT }}>Attendance Records</h2>
              <p className="text-sm" style={{ color: MUTED }}>
                Staff attendance for {dayjs(selectedDate).format("MMMM D, YYYY")}
              </p>
            </div>
          </div>
          <Tag
            className="rounded-full px-3 py-1 text-sm"
            style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}
          >
            {filteredData.length} record{filteredData.length !== 1 ? 's' : ''}
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
          dataSource={filteredData}
          rowKey={(record) => record.id ?? `${record.user_id}-${selectedDate}`}
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} records` }}
          locale={{
            emptyText: (
              <div className="py-10 text-center">
                <div
                  className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: ACCENT_SOFT, color: ACCENT }}
                >
                  <TeamOutlined className="text-3xl" />
                </div>
                <p className="font-semibold" style={{ color: TEXT }}>No attendance records found</p>
                <p className="text-sm" style={{ color: MUTED }}>Try selecting a different date</p>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default AttendanceView;