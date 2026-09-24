import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card, Table, Tag, Button, Modal, Form, Input, Space, message, Tooltip } from "antd";
import {
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  ReloadOutlined,
  SearchOutlined,
  EditOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Icon, divIcon, point } from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { api } from "@/config/api";
import { getCache, setCache, invalidateCache } from "@/utils/cache";
import Loading from "@/components/Loading";
import { clientPagination, serverPagination } from "@/components/Pagination";
import "leaflet/dist/leaflet.css";

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

const style = document.createElement('style');
style.innerHTML = `
  .custom-marker-cluster {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    color: white;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  }
  .cluster-icon {
    font-size: 14px;
    font-weight: bold;
  }
`;
document.head.appendChild(style);

const customIcon = new Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38],
  shadowSize: [38, 38]
});

const createClusterCustomIcon = function (cluster) {
  return new divIcon({
    html: `<div class="cluster-icon">${cluster.getChildCount()}</div>`,
    className: "custom-marker-cluster",
    iconSize: point(40, 40, true)
  });
};

function MapBounds({ branches }) {
  const map = useMap();
  useEffect(() => {
    if (branches.length > 0) {
      const validBranches = branches.filter(b => b.latitude && b.longitude);
      if (validBranches.length > 0) {
        const bounds = validBranches.map(b => [b.latitude, b.longitude]);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [branches, map]);
  return null;
}

function MapInitializer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => { map.invalidateSize(); }, 100);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function MapFlyTo({ branch }) {
  const map = useMap();
  useEffect(() => {
    if (branch && branch.latitude && branch.longitude) {
      map.flyTo([branch.latitude, branch.longitude], 16, { duration: 1 });
    }
  }, [branch, map]);
  return null;
}

function BranchMap() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [editFormInstance] = Form.useForm();
  const [flyTarget, setFlyTarget] = useState(null);
  const tableRef = useRef(null);

  const loadBranches = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      const cachedBranches = forceRefresh ? null : getCache('branches');
      if (cachedBranches) {
        setBranches(cachedBranches);
        setLoading(false);
        return;
      }
      const response = await api.get("/branches");
      const branchesData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setBranches(branchesData);
      setCache('branches', branchesData);
    } catch (error) {
      console.error("Failed to load branches:", error);
      message.error("Failed to load branches from backend.");
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  const filteredBranches = useMemo(() => {
    return branches.filter(branch =>
      branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (branch.address && branch.address.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [branches, searchTerm]);

  const branchesWithLocation = useMemo(() => filteredBranches.filter(b => b.latitude && b.longitude), [filteredBranches]);
  const branchesWithoutLocation = useMemo(() => filteredBranches.filter(b => !b.latitude || !b.longitude), [filteredBranches]);

  const handleMarkerClick = useCallback((branch) => {
    setSelectedBranch(branch);
    const rowEl = tableRef.current?.querySelector(`[data-row-key="${branch.id}"]`);
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
      rowEl.style.transition = "background 0.3s";
      rowEl.style.background = PANEL_BG_2;
      setTimeout(() => { rowEl.style.background = ""; }, 2000);
    }
  }, []);

  const handleRowClick = useCallback((record) => {
    setSelectedBranch(record);
    if (record.latitude && record.longitude) {
      setFlyTarget(record);
    }
  }, []);

  const handleOpenGoogleMaps = (branch) => {
    if (branch.latitude && branch.longitude) {
      window.open(`https://www.google.com/maps?q=${branch.latitude},${branch.longitude}`, '_blank');
    }
  };

  const handleOpenOpenStreetMap = (branch) => {
    if (branch.latitude && branch.longitude) {
      window.open(`https://www.openstreetmap.org/?mlat=${branch.latitude}&mlon=${branch.longitude}#map=15/${branch.latitude}/${branch.longitude}`, '_blank');
    }
  };

  const handleEditLocation = (branch) => {
    setEditingBranch(branch);
    editFormInstance.setFieldsValue({ address: branch.address || "" });
    setIsEditModalVisible(true);
  };

  const handleSaveLocation = async () => {
    if (!editingBranch) return;
    try {
      const values = await editFormInstance.validateFields();
      if (!values.address || values.address.trim() === "") {
        message.error("Please enter an address.");
        return;
      }

      setIsGeocoding(true);
      const searchQueries = [
        values.address,
        values.address.replace(/,/g, ''),
        values.address.split(',')[0],
        `${values.address}, Philippines`,
        values.address.replace(/\+/g, ' '),
      ];

      let geocodeResult = null;
      for (const query of searchQueries) {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
          );
          const data = await response.json();
          if (data && data.length > 0) { geocodeResult = data[0]; break; }
        } catch (e) { continue; }
      }

      if (!geocodeResult) {
        Modal.confirm({
          title: "Geocoding Failed",
          content: "Automatic geocoding failed. Would you like to enter coordinates manually?",
          okText: "Manual Entry",
          cancelText: "Cancel",
          onOk: () => {
            Modal.confirm({
              title: "Enter Coordinates",
              content: (
                <div>
                  <p className="mb-2">Format: latitude, longitude</p>
                  <p className="text-sm text-gray-500">Example: 8.4845, 124.6522</p>
                </div>
              ),
              okText: "Save",
              onOk: async () => {
                setIsGeocoding(false);
              },
            });
          },
        });
        setIsGeocoding(false);
        return;
      }

      const lat = parseFloat(geocodeResult.lat);
      const lng = parseFloat(geocodeResult.lon);
      const { data: updatedBranch } = await api.put(`/branches/${editingBranch.id}`, {
        latitude: lat,
        longitude: lng,
        address: values.address,
      });
      setBranches(branches.map(b => b.id === editingBranch.id ? updatedBranch : b));
      invalidateCache('branches');
      message.success("Branch location updated successfully!");
      setIsEditModalVisible(false);
      setEditingBranch(null);
      editFormInstance.resetFields();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message || error?.response?.data?.message || "Failed to update branch location");
    } finally {
      setIsGeocoding(false);
    }
  };

  const columns = [
    {
      title: "Branch",
      key: "name",
      render: (_, r) => (
        <div>
          <div className="font-semibold" style={{ color: TEXT }}>{r.name}</div>
          <div className="text-xs" style={{ color: FAINT }}>{r.code}</div>
        </div>
      ),
    },
    {
      title: "Address",
      key: "address",
      render: (_, r) => (
        <div className="flex items-center gap-1">
          <EnvironmentOutlined style={{ color: ACCENT }} />
          <span style={{ color: TEXT }}>{r.address || <span style={{ color: FAINT }}>No address</span>}</span>
        </div>
      ),
    },
    {
      title: "Location Status",
      key: "status",
      render: (_, r) =>
        r.latitude && r.longitude
          ? <Tag style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}>Located</Tag>
          : <Tag style={{ background: AMBER_SOFT, color: AMBER, border: `1px solid ${AMBER}40` }}>No Location</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, r) => (
        <Space>
          <Tooltip title="Edit Location">
            <Button size="small" icon={<EditOutlined />} onClick={() => handleEditLocation(r)} style={GHOST_BTN}>
              Edit Location
            </Button>
          </Tooltip>
          {r.latitude && r.longitude && (
            <>
              <Button size="small" onClick={() => handleOpenGoogleMaps(r)} style={SECONDARY_BTN}>
                Google Maps
              </Button>
              <Button size="small" onClick={() => handleOpenOpenStreetMap(r)} style={SECONDARY_BTN}>
                OpenStreetMap
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

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

          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h1 className="mb-1 text-2xl font-bold" style={{ color: TEXT }}>
                <EnvironmentOutlined className="mr-2" style={{ color: ACCENT }} />
                Branch Locations Map
              </h1>
              <p className="text-sm" style={{ color: MUTED }}>
                View all branch locations on an interactive map
              </p>
            </div>
          </div>

          {/* Quick Stats in Header */}
          <div className="relative z-10 mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <EnvironmentOutlined style={{ color: ACCENT }} /> Total Branches
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{branches.length}</p>
            </div>
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <EnvironmentOutlined style={{ color: ACCENT }} /> With Location
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{branchesWithLocation.length}</p>
            </div>
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
            >
              <p className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
                <EnvironmentOutlined style={{ color: AMBER }} /> Missing Location
              </p>
              <p className="mt-1 text-xl font-bold" style={{ color: TEXT }}>{branchesWithoutLocation.length}</p>
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
        <Space wrap>
          <Input
            placeholder="Search branch name or address..."
            prefix={<SearchOutlined style={{ color: MUTED }} />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadBranches(true)}
            loading={loading}
            style={GHOST_BTN}
          >
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Map Section */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: TEXT }}>
              <EnvironmentOutlined className="mr-2" style={{ color: ACCENT }} />
              Interactive Map
            </h2>
            <p className="text-sm mt-1" style={{ color: MUTED }}>Click markers for branch details</p>
          </div>
          <Tag
            className="rounded-full px-3 py-1 text-sm font-semibold"
            style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}
          >
            {branchesWithLocation.length} located
          </Tag>
        </div>
      </div>

      <Card
        className="mb-6"
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}
        styles={{ body: { padding: 0, background: PANEL_BG } }}
      >
        {loading ? (
          <Loading full text="Loading map..." />
        ) : branchesWithLocation.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl"
              style={{ background: ACCENT_SOFT, color: ACCENT }}
            >
              <EnvironmentOutlined className="text-4xl" />
            </div>
            <p className="mb-2 text-lg font-semibold" style={{ color: TEXT }}>No branch locations found</p>
            <p style={{ color: MUTED }}>Add latitude and longitude to branches to see them on the map</p>
          </div>
        ) : (
          <div className="h-125 w-full md:h-150 lg:h-175">
            <MapContainer
              key={branchesWithLocation.length}
              center={[14.5995, 120.9842]}
              zoom={10}
              style={{ height: "100%", width: "100%" }}
              zoomControl={true}
            >
              <MapInitializer />
              <MapFlyTo branch={flyTarget} />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapBounds branches={branchesWithLocation} />
              <MarkerClusterGroup chunkedLoading iconCreateFunction={createClusterCustomIcon}>
                {branchesWithLocation.map((branch) => (
                  <Marker
                    key={branch.id}
                    position={[branch.latitude, branch.longitude]}
                    icon={customIcon}
                    eventHandlers={{ click: () => handleMarkerClick(branch) }}
                  >
                    <Popup>
                      <div className="p-2 min-w-50">
                        <h3 className="font-bold text-lg text-gray-800 mb-2">{branch.name}</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <EnvironmentOutlined className="text-gray-500 mt-0.5" />
                            <span className="text-gray-600">{branch.address || 'No address'}</span>
                          </div>
                          {branch.phone && (
                            <div className="flex items-start gap-2">
                              <PhoneOutlined className="text-gray-500 mt-0.5" />
                              <span className="text-gray-600">{branch.phone}</span>
                            </div>
                          )}
                          {branch.email && (
                            <div className="flex items-start gap-2">
                              <MailOutlined className="text-gray-500 mt-0.5" />
                              <span className="text-gray-600">{branch.email}</span>
                            </div>
                          )}
                          <div className="pt-2 border-t border-gray-200 flex gap-2">
                            <Button size="small" type="link" onClick={() => handleOpenGoogleMaps(branch)}>
                              Google Maps
                            </Button>
                            <Button size="small" type="link" onClick={() => handleOpenOpenStreetMap(branch)}>
                              OpenStreetMap
                            </Button>
                            <Button size="small" type="link" icon={<EditOutlined />} onClick={() => handleEditLocation(branch)} />
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            </MapContainer>
          </div>
        )}
      </Card>

      {/* Branches Missing Location */}
      {branchesWithoutLocation.length > 0 && (
        <Card
          className="mb-6"
          style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${AMBER}`, borderRadius: 12 }}
          styles={{ body: { background: PANEL_BG } }}
        >
          <div className="flex items-center gap-2 mb-3">
            <EnvironmentOutlined style={{ color: AMBER }} />
            <span className="font-semibold" style={{ color: AMBER }}>Branches Missing Location Data ({branchesWithoutLocation.length})</span>
          </div>
          <div className="space-y-2">
            {branchesWithoutLocation.map((branch) => (
              <div
                key={branch.id}
                className="flex items-center justify-between rounded-xl p-3"
                style={{ background: PANEL_BG_2, border: `1px solid ${BORDER}` }}
              >
                <div>
                  <p className="font-medium" style={{ color: TEXT }}>{branch.name}</p>
                  <p className="text-xs" style={{ color: MUTED }}>{branch.address || 'No address'}</p>
                </div>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEditLocation(branch)}
                  style={GHOST_BTN}
                >
                  Add Location
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* All Branches Table Section */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: TEXT }}>
              <EnvironmentOutlined className="mr-2" style={{ color: ACCENT }} />
              All Branches
            </h2>
            <p className="text-sm mt-1" style={{ color: MUTED }}>Complete list of all registered branches</p>
          </div>
          <Tag
            className="rounded-full px-3 py-1 text-sm font-semibold"
            style={{ background: ACCENT_SOFT, color: ACCENT, border: `1px solid ${ACCENT}30` }}
          >
            {filteredBranches.length} branch{filteredBranches.length !== 1 ? 'es' : ''}
          </Tag>
        </div>
      </div>

      <Card
        style={{ background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 12 }}
        styles={{ body: { background: PANEL_BG } }}
      >
        <div ref={tableRef}>
          <Table
            columns={columns}
            dataSource={filteredBranches}
            rowKey="id"
            rowClassName={(record) => record.id === selectedBranch?.id ? "border-l-4 border-l-[#22D3A8]" : ""}
            onRow={(record) => ({
              onClick: () => handleRowClick(record),
              style: { cursor: record.latitude && record.longitude ? "pointer" : "default" },
            })}
            pagination={clientPagination({ label: "branches" })}
            locale={{ emptyText: <div className="py-10 text-center"><div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: ACCENT_SOFT, color: ACCENT }}><EnvironmentOutlined className="text-3xl" /></div><p className="font-semibold" style={{ color: TEXT }}>No branches found</p><p className="text-sm" style={{ color: MUTED }}>Try adjusting your search</p></div> }}
          />
        </div>
      </Card>

      {/* Edit Location Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg" style={{ background: ACCENT_SOFT, color: ACCENT }}>
              <EditOutlined />
            </div>
            <div>
              <p className="font-bold" style={{ color: TEXT }}>{editingBranch?.name} - Set Location</p>
              <p className="text-xs font-normal" style={{ color: MUTED }}>Find coordinates for this branch</p>
            </div>
          </div>
        }
        open={isEditModalVisible}
        onCancel={() => { setIsEditModalVisible(false); setEditingBranch(null); editFormInstance.resetFields(); }}
        footer={null}
        destroyOnHidden
        className="rounded-2xl"
      >
        <Form form={editFormInstance} layout="vertical" onFinish={handleSaveLocation}>
          <Form.Item
            label={<span style={FIELD_LABEL}>Address</span>}
            name="address"
            rules={[{ required: true, message: "Please enter an address" }]}
          >
            <Input
              placeholder="e.g., 123 Main St, Manila, Philippines"
            />
          </Form.Item>
          <div
            className="mb-4 rounded-xl p-3"
            style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT}30` }}
          >
            <p className="mb-0 text-xs" style={{ color: ACCENT }}>
              <InfoCircleOutlined className="mr-1" />
              Enter a complete address including street, city, and country for accurate location detection.
            </p>
          </div>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button
                onClick={() => { setIsEditModalVisible(false); setEditingBranch(null); editFormInstance.resetFields(); }}
                disabled={isGeocoding}
                style={SECONDARY_BTN}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={isGeocoding}
                style={GRADIENT_BTN}
              >
                Save Location
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BranchMap;