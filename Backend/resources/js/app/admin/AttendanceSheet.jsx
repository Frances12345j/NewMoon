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
      return <Tag color="#16A34A" icon={<CheckCircleOutlined />}>Present</Tag>;
    }
    if (normalized === "completed_late") {
      return <Tag color="#16A34A" icon={<CheckCircleOutlined />}>Completed (Late)</Tag>;
    }
    if (normalized === "late") {
      return <Tag color="#D97706" icon={<ClockCircleOutlined />}>Late</Tag>;
    }
    if (normalized === "absent") {
      return <Tag color="#DC2626" icon={<CloseCircleOutlined />}>Absent</Tag>;
    }
    return <Tag color="#6B7280">{status || "Unknown"}</Tag>;
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
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FFF1E6] to-[#FFE3C9] flex items-center justify-center text-[#F97316] text-xs font-semibold">
            {r.user?.firstname?.charAt(0) || "?"}
          </div>
          <span className="font-medium text-[#451A03]">
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
      render: (_, r) => r.branch?.name || <span className="text-gray-400">N/A</span>,
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
      render: (_, r) => <span className="text-[#16A34A] font-medium">₱{r.daily_rate?.toFixed(2) || "0.00"}</span>,
    },
  ];

  return (
    <div className="p-6 bg-gradient-to-br from-[#FFF8ED]/80 via-[#FFFDF9] to-[#FFF1E6]/80 min-h-screen">
      {/* Hero Header */}
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
                Attendance Records
              </h1>
              <p className="text-white/80 text-sm">Staff attendance for {dayjs(selectedDate).format("MMMM D, YYYY")}</p>
            </div>
          </div>

          {/* KPI Chips */}
          <div className="grid grid-cols-3 gap-3 mt-4 relative z-10">
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <p className="text-white/70 text-xs flex items-center gap-1.5">
                <CheckCircleOutlined className="text-[#F97316]" /> Present
              </p>
              <p className="text-white font-bold text-xl mt-1">{stats.present}</p>
            </div>
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <p className="text-white/70 text-xs flex items-center gap-1.5">
                <ClockCircleOutlined className="text-[#F97316]" /> Late
              </p>
              <p className="text-white font-bold text-xl mt-1">{stats.late}</p>
            </div>
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/10">
              <p className="text-white/70 text-xs flex items-center gap-1.5">
                <CloseCircleOutlined className="text-[#F97316]" /> Absent
              </p>
              <p className="text-white font-bold text-xl mt-1">{stats.absent}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card variant="borderless" className="mb-6 rounded-xl border border-[#F5EDE0] shadow-sm">
        <Space wrap>
          <DatePicker
            value={dayjs(selectedDate)}
            onChange={(date) => {
              if (date) setSelectedDate(date.format("YYYY-MM-DD"));
            }}
            allowClear={false}
            className="rounded-xl"
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
            className="rounded-xl border-[#EA580C] text-[#EA580C] hover:bg-[#FFF1E6] hover:border-[#F97316] transition-all duration-200"
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Section Header */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FFF1E6] to-[#FFE3C9] flex items-center justify-center text-[#F97316] text-lg shadow-sm">
              <UserOutlined />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#451A03]">Attendance Records</h2>
              <p className="text-sm text-stone-400">Staff attendance for {dayjs(selectedDate).format("MMMM D, YYYY")}</p>
            </div>
          </div>
          <Tag className="text-sm px-3 py-1 rounded-full bg-gradient-to-br from-[#EA580C] to-[#F59E0B] text-white border-none">
            {filteredData.length} record{filteredData.length !== 1 ? 's' : ''}
          </Tag>
        </div>
      </div>

      {/* Table */}
      <Card variant="borderless" className="rounded-xl border border-[#F5EDE0] shadow-sm">
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey={(record) => record.id ?? `${record.user_id}-${selectedDate}`}
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} records` }}
          locale={{ emptyText: <div className="py-10 text-center"><div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#FFF1E6] to-[#FFE3C9] rounded-2xl flex items-center justify-center mb-3"><TeamOutlined className="text-3xl text-[#F97316]" /></div><p className="text-[#451A03] font-semibold">No attendance records found</p><p className="text-gray-400 text-sm">Try selecting a different date</p></div> }}
        />
      </Card>
    </div>
  );
}

export default AttendanceView;