import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  Dimensions,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import api from '../../../../lib/api';
import { subscribeRiderLocation } from '../../../../lib/riderLocationService';
import { useAuth } from '../../../../context/authContext';
import { listenToRider } from '../../../../lib/websocket';

const { width, height } = Dimensions.get('window');

interface Branch {
  id: number;
  name: string;
  code: string;
  address: string;
  phone?: string;
  email?: string;
  latitude: number;
  longitude: number;
  is_active?: boolean;
}

interface DeliveryOrder {
  id: string;
  orderNumber: string;
  customer: string;
  address: string;
  items: string;
  total: string;
  status: 'Pending' | 'Preparing' | 'Ready' | 'Picked Up' | 'Out for Delivery' | 'Delivered';
  time: string;
  distance?: string;
  duration?: string;
  latitude: number;
  longitude: number;
  branchId?: number;
}

// MAP HTML WITH DYNAMIC ROUTE SHRINKING (UPDATED STYLE)
const GENERATE_MAP_HTML = (branches: Branch[], orders: DeliveryOrder[], riderLat?: number, riderLng?: number) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=2.0, user-scalable=yes">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    html, body { 
      height: 100%; 
      width: 100%; 
      overflow: hidden;
      background: #FFF7ED;
    }
    #map { 
      height: 100%; 
      width: 100%;
      background: #FFF7ED;
    }
    .marker-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      color: white;
      font-weight: bold;
      font-size: 12px;
      border: 2px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .moving-dot {
      background: #F97316;
      border-radius: 50%;
      border: 3px solid white;
      width: 16px;
      height: 16px;
      box-shadow: 0 0 0 4px rgba(249,115,22,0.3);
    }
    .moving-dot-pulse {
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(249,115,22,0.4); }
      70% { box-shadow: 0 0 0 10px rgba(249,115,22,0); }
      100% { box-shadow: 0 0 0 0 rgba(249,115,22,0); }
    }

    /* ─── Rider heartbeat blue dot ─────────────────────────── */
    .rider-dot {
      position: relative;
      width: 22px;
      height: 22px;
      background: #EA580C;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(69,26,3,0.35);
    }
    .rider-dot::before,
    .rider-dot::after {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: rgba(234,88,12,0.5);
      z-index: -1;
    }
    .rider-dot::before {
      animation: heartbeat 1.6s ease-out infinite;
    }
    .rider-dot::after {
      animation: heartbeat 1.6s ease-out infinite;
      animation-delay: 0.8s;
    }
    @keyframes heartbeat {
      0% {
        opacity: 0.7;
        transform: translate(-50%, -50%) scale(1);
      }
      70%, 100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(2.8);
      }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMap);
      } else {
        initMap();
      }

      function initMap() {
        try {
          var map = L.map('map', {
            zoomControl: true,
            attributionControl: true,
          }).setView([14.5600, 121.0200], 12);

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          window.map = map;
          window.markers = [];
          window.routeLines = [];
          window.orderMarkers = {};
          window.branchMarkers = [];
          window.activeRoutes = {};
          window.riderMarker = null;
          window.riderPos = null;
          window.routeProgress = {};
          window.lastKnownOrderId = null;
          window.routeSegments = {};

          // ─── Icons ──────────────────────────────────────────
          var branchIcon = L.divIcon({
            html: '<div class="marker-icon" style="width:30px;height:30px;background:#F59E0B;font-size:13px;">B</div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            className: ''
          });

var destPinHtml = '<div style="width:24px;height:24px;background:#C2410C;border-radius:50%;border:3px solid white;box-shadow:0 0 15px rgba(194,65,12,0.4);display:flex;align-items:center;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>';
          var destPinIcon = L.divIcon({
            html: destPinHtml,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            className: ''
          });

          window.orderIcons = {
            'Pending': destPinIcon,
            'Confirmed': destPinIcon,
            'Preparing': destPinIcon,
            'Ready': destPinIcon,
            'Picked Up': destPinIcon,
            'Out for Delivery': destPinIcon,
            'Delivered': destPinIcon
          };

          // ─── Rider Heartbeat Blue Dot ──────────────────────────
          var riderIcon = L.divIcon({
            html: '<div class="rider-dot"></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            className: ''
          });

          // ─── Initialize rider marker ────────────────────────
          function initRiderMarker(lat, lng) {
            if (window.riderMarker) {
              window.map.removeLayer(window.riderMarker);
            }
            window.riderMarker = L.marker([lat, lng], { icon: riderIcon }).addTo(map);
            window.riderMarker.bindPopup('You are here');
            window.riderPos = { lat: lat, lng: lng };
            return window.riderMarker;
          }

          // ─── Find nearest point on route ────────────────────
          function findNearestPointOnRoute(routeCoords, lat, lng) {
            if (!routeCoords || routeCoords.length < 2) return null;
            
            var minDist = Infinity;
            var nearestPoint = null;
            var nearestIndex = 0;
            
            for (var i = 0; i < routeCoords.length; i++) {
              var p = routeCoords[i];
              var d = Math.pow(p[0] - lat, 2) + Math.pow(p[1] - lng, 2);
              if (d < minDist) {
                minDist = d;
                nearestPoint = p;
                nearestIndex = i;
              }
            }
            
            return {
              point: nearestPoint,
              index: nearestIndex,
              coords: routeCoords
            };
          }

          // ─── Update route to show remaining path ────────────
          function updateRoutePath(orderId, currentIndex) {
            if (!window.routeSegments[orderId]) return;
            
            var fullCoords = window.routeSegments[orderId].fullCoords;
            if (!fullCoords || fullCoords.length === 0) return;
            
            var remainingCoords = fullCoords.slice(currentIndex);
            
            if (window.activeRoutes[orderId]) {
              window.map.removeLayer(window.activeRoutes[orderId]);
            }
            
            // NewMoon roast-orange route
            var line = L.polyline(remainingCoords, { 
              color: '#EA580C',
              weight: 7,
              opacity: 0.9,
              smoothFactor: 1.5
            });
            
            line.addTo(window.map);
            window.activeRoutes[orderId] = line;
            
            window.routeProgress[orderId] = {
              currentIndex: currentIndex,
              totalLength: fullCoords.length,
              remaining: remainingCoords.length
            };
          }

          // ─── Update rider position with route following ─────
          window.__animRaf = 0;
          function __animateMarkerTo(targetLat, targetLng, dur) {
            if (!window.riderMarker) return;
            var from = window.riderMarker.getLatLng();
            if (window.__animRaf) cancelAnimationFrame(window.__animRaf);
            if (from.lat === targetLat && from.lng === targetLng) return;
            dur = dur || 900;
            var start = null;
            function step(ts) {
              if (start === null) start = ts;
              var t = Math.min(1, (ts - start) / dur);
              var e = 0.5 - 0.5 * Math.cos(Math.PI * t);
              window.riderMarker.setLatLng([from.lat + (targetLat - from.lat) * e, from.lng + (targetLng - from.lng) * e]);
              if (t < 1) window.__animRaf = requestAnimationFrame(step);
              else window.riderMarker.setLatLng([targetLat, targetLng]);
            }
            window.__animRaf = requestAnimationFrame(step);
          }

          function distMeters(lat1, lng1, lat2, lng2) {
            var dl = Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2));
            return dl * 111320;
          }

          window.__updateRiderPos = function(lat, lng, orderId) {
            // Route-snapping: project GPS onto the nearest point on the active route
            var snapLat = lat;
            var snapLng = lng;
            var snappedIndex = -1;
            var didSnap = false;

            if (orderId && window.routeSegments[orderId] && window.routeSegments[orderId].fullCoords) {
              var seg = window.routeSegments[orderId];
              var nearest = findNearestPointOnRoute(seg.fullCoords, lat, lng);
              if (nearest && nearest.point && distMeters(nearest.point[0], nearest.point[1], lat, lng) < 250) {
                snapLat = nearest.point[0];
                snapLng = nearest.point[1];
                snappedIndex = nearest.index;
                didSnap = true;
              }
            }

            if (!didSnap) {
              // No active route for this order yet — try snapping to any visible route
              var allIds = Object.keys(window.routeSegments);
              for (var a = 0; a < allIds.length; a++) {
                var s2 = window.routeSegments[allIds[a]];
                if (!s2 || !s2.fullCoords || !s2.fullCoords.length) continue;
                var n2 = findNearestPointOnRoute(s2.fullCoords, lat, lng);
                if (n2 && n2.point && distMeters(n2.point[0], n2.point[1], lat, lng) < 250) {
                  snapLat = n2.point[0];
                  snapLng = n2.point[1];
                  if (allIds[a] === orderId) snappedIndex = n2.index;
                  didSnap = true;
                  break;
                }
              }
            }

            if (!window.riderMarker) {
              initRiderMarker(snapLat, snapLng);
            }
            window.riderPos = { lat: snapLat, lng: snapLng };

            // Continuous GPS updates come fast — snap directly onto the route so the
            // dot stays ON the line instead of lagging mid-animation. Only animate
            // for larger jumps so movement is still visible.
            var cur = window.riderMarker.getLatLng();
            var moved = distMeters(cur.lat, cur.lng, snapLat, snapLng);
            if (moved < 15) {
              window.riderMarker.setLatLng([snapLat, snapLng]);
            } else {
              __animateMarkerTo(snapLat, snapLng, 700);
            }

            // Trim the route polyline to show only the remaining path from the snapped position
            if (didSnap) {
              var rid = orderId;
              var idx = snappedIndex;
              if (rid && window.routeSegments[rid]) {
                if (idx < 0) {
                  var n3 = findNearestPointOnRoute(window.routeSegments[rid].fullCoords, snapLat, snapLng);
                  idx = n3 ? n3.index : 0;
                }
                updateRoutePath(rid, idx);
              }
            }
          };

          // ─── Persistent Route Management ────────────────────
          window.routeCache = {};
          window.routeColor = '#EA580C'; // NewMoon global route color
          window.__routeGeneration = 0;
          window.pendingRouteFetches = {};

          window.__updateRoutes = function(ordersData, riderLat, riderLng) {
            if (!riderLat || !riderLng) return;

            var currentOrderIds = ordersData.map(o => o.id);
            var activeOrderIds = Object.keys(window.activeRoutes);

            activeOrderIds.forEach(function(id) {
              if (!currentOrderIds.includes(id)) {
                if (window.activeRoutes[id]) {
                  window.map.removeLayer(window.activeRoutes[id]);
                  delete window.activeRoutes[id];
                }
                if (window.routeCache[id]) {
                  delete window.routeCache[id];
                }
                if (window.routeSegments[id]) {
                  delete window.routeSegments[id];
                }
                if (window.routeProgress[id]) {
                  delete window.routeProgress[id];
                }
              }
            });

            ordersData.forEach(function(o) {
              if (!o.latitude || !o.longitude) return;
              
              var orderId = o.id;
              var cacheKey = 'dest|' + o.id + '|' + o.latitude + ',' + o.longitude;

              if (window.routeCache[orderId] && window.routeCache[orderId].cacheKey === cacheKey) {
                var cached = window.routeCache[orderId];
                var stale = cached.origin &&
                  distMeters(cached.origin.lat, cached.origin.lng, riderLat, riderLng) > 1000;
                if (stale) {
                  delete window.routeCache[orderId];
                  delete window.routeSegments[orderId];
                } else {
                  if (window.lastKnownOrderId === orderId || !window.lastKnownOrderId) {
                    window.lastKnownOrderId = orderId;
                    window.__updateRiderPos(riderLat, riderLng, orderId);
                  }
                  return;
                }
              }

              if (window.pendingRouteFetches[orderId]) {
                return;
              }

              var url = 'https://router.project-osrm.org/route/v1/driving/'
                + riderLng + ',' + riderLat + ';'
                + o.longitude + ',' + o.latitude
                + '?geometries=geojson&overview=full&alternatives=false&steps=false';

              window.pendingRouteFetches[orderId] = true;

              fetch(url)
                .then(function(r) { return r.json(); })
                .then(function(data) {
                  delete window.pendingRouteFetches[orderId];
                  
                  if (data.code !== 'Ok' || !data.routes || !data.routes[0]) return;
                  
                  var route = data.routes[0];
                  var coords = route.geometry.coordinates.map(function(c) {
                    return [c[1], c[0]];
                  });
                  
                  window.routeSegments[orderId] = {
                    fullCoords: coords,
                    route: route,
                    origin: { lat: riderLat, lng: riderLng }
                  };
                  
                  window.routeCache[orderId] = {
                    coords: coords,
                    route: route,
                    cacheKey: cacheKey,
                    origin: { lat: riderLat, lng: riderLng },
                    timestamp: Date.now()
                  };

                  if (window.activeRoutes[orderId]) {
                    window.map.removeLayer(window.activeRoutes[orderId]);
                  }

                  // NewMoon route style for initial render
                  var line = L.polyline(coords, { 
                    color: '#EA580C', 
                    weight: 7, 
                    opacity: 0.9,
                    smoothFactor: 1.5
                  });
                  
                  line.addTo(window.map);
                  window.activeRoutes[orderId] = line;

                  if (window.lastKnownOrderId === orderId || !window.lastKnownOrderId) {
                    window.lastKnownOrderId = orderId;
                    window.__updateRiderPos(riderLat, riderLng, orderId);
                  }
                })
                .catch(function(err) {
                  delete window.pendingRouteFetches[orderId];
                  console.log('Route fetch error:', err);
                });
            });
          };

          // ─── Update Order Markers ──────────────────────────
          window.__updateOrderMarkers = function(ordersData) {
            var currentOrderIds = ordersData.map(o => o.id);
            var existingOrderIds = Object.keys(window.orderMarkers);

            existingOrderIds.forEach(function(id) {
              if (!currentOrderIds.includes(id)) {
                if (window.orderMarkers[id]) {
                  window.map.removeLayer(window.orderMarkers[id]);
                  delete window.orderMarkers[id];
                }
              }
            });

            var orderIcons = window.orderIcons || {};
            
            ordersData.forEach(function(o) {
              if (!o.latitude || !o.longitude) return;
              
              var existingMarker = window.orderMarkers[o.id];
              var icon = orderIcons[o.status] || orderIcons['Pending'];

              if (existingMarker) {
                var currentPos = existingMarker.getLatLng();
                if (currentPos.lat !== o.latitude || currentPos.lng !== o.longitude) {
                  existingMarker.setLatLng([o.latitude, o.longitude]);
                }
                if (existingMarker.options.icon !== icon) {
                  existingMarker.setIcon(icon);
                }
              } else {
                var m = L.marker([o.latitude, o.longitude], { icon: icon }).addTo(window.map);
                m.bindPopup('<b>' + o.customer + '</b><br>' + o.address + '<br>' + o.items + '<br>' + o.total);
                window.orderMarkers[o.id] = m;
              }
            });
          };

          // ─── Initial Setup ──────────────────────────────────
          var initialOrders = ${JSON.stringify(orders)};
          var initialBranches = ${JSON.stringify(branches)};

          if (initialBranches && initialBranches.length > 0) {
            initialBranches.forEach(function(b) {
              if (b.latitude && b.longitude) {
                var m = L.marker([b.latitude, b.longitude], { icon: branchIcon }).addTo(map);
                m.bindPopup('<b>' + b.name + '</b><br>' + (b.address || ''));
                window.branchMarkers.push(m);
              }
            });
          }

          window.__updateOrderMarkers(initialOrders);

          var riderLat2 = ${riderLat || 'null'};
          var riderLng2 = ${riderLng || 'null'};
          if (riderLat2 && riderLng2) {
            initRiderMarker(riderLat2, riderLng2);
            window.__updateRoutes(initialOrders, riderLat2, riderLng2);
          }

          // ─── Main Update Function ──────────────────────────
          window.__updateOrders = function(newOrders, riderLat, riderLng) {
            window.__updateOrderMarkers(newOrders);
            
            if (riderLat && riderLng) {
              if (!window.riderMarker) {
                initRiderMarker(riderLat, riderLng);
              }
            }
            
            var currentRiderPos = window.riderPos || { lat: riderLat, lng: riderLng };
            if (currentRiderPos && currentRiderPos.lat && currentRiderPos.lng) {
              window.__updateRoutes(newOrders, currentRiderPos.lat, currentRiderPos.lng);
            }
          };

          window.__updateMovingDot = function(lat, lng, orderId) {
            window.__updateRiderPos(lat, lng, orderId);
          };

          map.on('moveend', function() {
            try {
              var c = map.getCenter();
              sessionStorage.setItem('riderMapView', JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }));
            } catch(e) {}
          });

          var savedView = null;
          try {
            var raw = sessionStorage.getItem('riderMapView');
            if (raw) savedView = JSON.parse(raw);
          } catch(e) {}

          if (savedView && savedView.lat != null && savedView.lng != null && savedView.zoom != null) {
            map.setView([savedView.lat, savedView.lng], savedView.zoom, { animate: false });
          }

          setTimeout(function() {
            map.invalidateSize();
          }, 300);

          setTimeout(function() {
            map.invalidateSize();
          }, 600);

          console.log('Map initialized successfully');
        } catch (error) {
          console.error('Map init error:', error);
        }
      }
    })();
  </script>
</body>
</html>`;
};

const STATUS_COLORS: Record<string, string> = {
  Pending: '#F59E0B',
  Preparing: '#7C2D12',
  Ready: '#EA580C',
  'Picked Up': '#16A34A',
  'Out for Delivery': '#F97316',
  Delivered: '#16A34A',
};

const STATUS_ICONS: Record<string, any> = {
  Pending: 'pending',
  Preparing: 'schedule',
  Ready: 'check-circle',
  'Picked Up': 'local-shipping',
  'Out for Delivery': 'directions-bike',
  Delivered: 'check-circle',
};

export default function RiderMapScreen() {
  const { user } = useAuth();
  const webViewRef = useRef<WebView>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapHtml, setMapHtml] = useState('');
  const [mapError, setMapError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  const STATUS_MAP: Record<string, DeliveryOrder['status']> = {
    pending: 'Pending',
    accepted: 'Preparing',
    preparing: 'Preparing',
    ready: 'Ready',
    picked_up: 'Picked Up',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    cancelled: 'Delivered',
  };

  const mapReadyRef = useRef(false);
  const prevOrdersRef = useRef<string>('');
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSelectedOrderRef = useRef<string | null>(null);

  useEffect(() => {
    loadBranches();
    loadOrders();
    let unsubscribe: (() => void) | null = null;
    if (user?.id) {
      unsubscribe = listenToRider(user.id, () => {
        loadOrders();
      });
    }
    return () => {
      unsubscribe?.();
    };
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [])
  );

  const loadOrders = async () => {
    try {
      const res = await api.get('/rider/orders?per_page=50');
      const raw = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
      const key = raw.map((o: any) => o.id + '-' + (o.status || '') + '-' + (o.customer_latitude || '') + '-' + (o.customer_longitude || '')).join('|');
      
      if (key === prevOrdersRef.current) return;
      prevOrdersRef.current = key;
      
      const mapped: DeliveryOrder[] = raw.map((o: any) => ({
        id: String(o.id),
        orderNumber: o.order_number,
        customer: o.customer_name,
        address: o.customer_address || o.branch_address,
        items: Array.isArray(o.items) ? o.items.map((i: any) => `${i.quantity}x ${i.name}`).join(', ') : '',
        total: `₱${Number(o.total).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
        status: STATUS_MAP[o.status] || 'Pending',
        time: o.created_at,
        latitude: o.customer_latitude || o.branch_latitude || 0,
        longitude: o.customer_longitude || o.branch_longitude || 0,
        branchId: o.branch_id,
      }));
      
      setOrders(mapped);
      
      if (isMapReady && webViewRef.current) {
        const activeOrders = mapped.filter(o => o.status === 'Picked Up' || o.status === 'Out for Delivery');
        const riderPos = riderLocation || { lat: 14.5600, lng: 121.0200 };
        
        const targetOrderId = lastSelectedOrderRef.current || 
                             (activeOrders.length > 0 ? activeOrders[0].id : null);
        
        const js = `
          if (window.__updateOrders) {
            window.__updateOrders(${JSON.stringify(activeOrders)}, ${riderPos.lat}, ${riderPos.lng});
          }
          if (window.__updateMovingDot && ${targetOrderId ? `'${targetOrderId}'` : 'null'}) {
            window.__updateMovingDot(${riderPos.lat}, ${riderPos.lng}, '${targetOrderId}');
          }
          true;
        `;
        webViewRef.current.injectJavaScript(js);
      }
    } catch (err) {
      console.log('Failed to load orders:', err);
    }
  };

  // ─── Rider location (shared service started by GpsGate) ──────
  useEffect(() => {
    const unsub = subscribeRiderLocation((pos) => {
      if (pos) setRiderLocation(pos);
    });
    return unsub;
  }, []);

  const loadBranches = async () => {
    try {
      setIsRefreshing(true);
      const response = await api.get('/branches');
      const data = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setBranches(data.length > 0 ? data : [
        { id: 1, name: 'Main Branch', code: 'MB', address: 'Metro Manila', latitude: 14.5600, longitude: 121.0200 }
      ]);
    } catch (error) {
      console.log('Failed to load branches:', error);
      setBranches([
        { id: 1, name: 'Main Branch', code: 'MB', address: 'Metro Manila', latitude: 14.5600, longitude: 121.0200 }
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const mapOrders = orders.filter(o => o.status === 'Picked Up' || o.status === 'Out for Delivery');

  useEffect(() => {
    if (branches.length > 0) {
      const html = GENERATE_MAP_HTML(branches, mapOrders, riderLocation?.lat, riderLocation?.lng);
      setMapHtml(html);
      setLoading(false);
    }
  }, [branches]);

  // Smooth rider marker movement with route following
  useEffect(() => {
    if (!isMapReady || !riderLocation || !webViewRef.current) return;
    
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      const activeOrders = orders.filter(o => o.status === 'Picked Up' || o.status === 'Out for Delivery');
      const targetOrderId = lastSelectedOrderRef.current || 
                           (activeOrders.length > 0 ? activeOrders[0].id : null);
      
      const js = `
        if (window.__updateMovingDot) {
          window.__updateMovingDot(${riderLocation.lat}, ${riderLocation.lng}, ${targetOrderId ? `'${targetOrderId}'` : 'null'});
        }
        true;
      `;
      webViewRef.current?.injectJavaScript(js);
    }, 100);
    
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [riderLocation, isMapReady, orders]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'navigate' && msg.lat && msg.lng) {
        openDirections(msg.lat, msg.lng, msg.label || '');
      } else if (msg.type === 'select') {
        setSelectedId(String(msg.id));
        lastSelectedOrderRef.current = String(msg.id);
      }
    } catch (err) {
      console.log('[Map] Message error:', err);
    }
  }, []);

  const openDirections = (lat: number, lng: number, label: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Open Maps', `Navigate to: ${label}\n${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    });
  };

  const focusItem = (lat: number, lng: number, id: string) => {
    setSelectedId(id);
    lastSelectedOrderRef.current = id;
    
    const js = `
      if (window.map) {
        window.map.setView([${lat}, ${lng}], 16, { animate: true });
        if (window.orderMarkers && window.orderMarkers['${id}']) {
          window.orderMarkers['${id}'].openPopup();
        }
      }
      true;
    `;
    webViewRef.current?.injectJavaScript(js);
  };

  const centerOnRider = () => {
    if (riderLocation) {
      setSelectedId(null);
      const js = `
        if (window.map) {
          window.map.setView([${riderLocation.lat}, ${riderLocation.lng}], 15, { animate: true });
        }
        true;
      `;
      webViewRef.current?.injectJavaScript(js);
    } else {
      Alert.alert('Location Unavailable', 'Unable to get your current location. Please check your GPS settings.');
    }
  };

  const toPickup = orders.filter(o => ['Ready', 'Preparing', 'Picked Up'].includes(o.status));
  const toDeliver = orders.filter(o => ['Ready', 'Picked Up', 'Out for Delivery'].includes(o.status));
  const displayedOrders = orders.filter(o =>
    ['Ready', 'Preparing', 'Picked Up', 'Out for Delivery'].includes(o.status)
  );

  const getStatusBadge = (order: DeliveryOrder) => {
    const color = STATUS_COLORS[order.status] || '#9CA3AF';
    return (
      <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: color + '20' }}>
        <Text className="text-xs font-semibold" style={{ color, fontSize: 10 }}>{order.status}</Text>
      </View>
    );
  };

  if (mapError) {
    return (
      <SafeAreaView className="flex-1 bg-[#FFF7ED]">
        <StatusBar barStyle="light-content" backgroundColor="#171717" />
        <LinearGradient
          colors={['#171717', '#241207', '#451A03']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ paddingTop: 8, paddingBottom: 18, paddingHorizontal: 16 }}
        >
          <View className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-[#EA580C] opacity-20" />
          <View className="absolute -bottom-14 -left-12 w-40 h-40 rounded-full bg-[#F59E0B] opacity-10" />
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 rounded-2xl bg-[#262626] items-center justify-center mr-3 border border-[#3A3A3A]" activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={20} color="#FED7AA" />
            </TouchableOpacity>
            <View>
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-xl bg-[#EA580C] items-center justify-center mr-2">
                  <Ionicons name="flame" size={17} color="#FFFFFF" />
                </View>
                <Text className="text-white text-base font-extrabold leading-5">NewMoon Rider</Text>
              </View>
              <Text className="text-[#FED7AA] text-[10px] font-bold uppercase tracking-wider mt-0.5">Delivery Map</Text>
            </View>
          </View>
        </LinearGradient>
        <View className="flex-1 items-center justify-center bg-[#FFF7ED] p-6">
          <View
            className="w-24 h-24 rounded-full bg-[#FFF1E6] border border-[#FED7AA] items-center justify-center mb-5"
            style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 4 }}
          >
            <Ionicons name="map-outline" size={44} color="#EA580C" />
          </View>
          <Text className="text-[#451A03] text-lg font-extrabold">Map unavailable</Text>
          <Text className="text-stone-500 text-sm mt-2 text-center">Unable to load the map. Please check your internet connection.</Text>
          <TouchableOpacity
            className="mt-6 bg-[#EA580C] px-10 py-4 rounded-2xl flex-row items-center"
            activeOpacity={0.8}
            style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3 }}
            onPress={() => {
              setMapError(false);
              setLoading(true);
              const html = GENERATE_MAP_HTML(branches, mapOrders, riderLocation?.lat, riderLocation?.lng);
              setMapHtml(html);
              setLoading(false);
            }}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text className="text-white font-extrabold text-base">Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#FFF7ED]">
      <StatusBar barStyle="light-content" backgroundColor="#171717" />

      {/* Premium NewMoon Header */}
      <LinearGradient
        colors={['#171717', '#241207', '#451A03']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: 8, paddingBottom: 18, paddingHorizontal: 16, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}
      >
        <View className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-[#EA580C] opacity-20" />
        <View className="absolute -bottom-14 -left-12 w-40 h-40 rounded-full bg-[#F59E0B] opacity-10" />

        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-2xl bg-[#262626] items-center justify-center mr-3 border border-[#3A3A3A]"
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#FED7AA" />
          </TouchableOpacity>

          <View className="flex-1">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-xl bg-[#EA580C] items-center justify-center mr-2">
                <Ionicons name="flame" size={17} color="#FFFFFF" />
              </View>
              <View>
                <Text className="text-white text-[15px] font-extrabold leading-5">NewMoon Rider</Text>
                <Text className="text-[#FDBA74] text-[10px] font-bold uppercase tracking-wider">Delivery Map</Text>
              </View>
            </View>
            <Text className="text-[#FED7AA] text-[11px] font-semibold mt-1.5">
              {toDeliver.length} ready · {toPickup.length - toDeliver.length} preparing
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={centerOnRider}
              className="bg-[#FFF1E6] p-2 rounded-2xl border border-[#FED7AA]"
              activeOpacity={0.7}
              style={styles.button}
            >
              <Ionicons name="locate-outline" size={18} color="#EA580C" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={loadBranches}
              className="bg-[#FFF1E6] p-2 rounded-2xl border border-[#FED7AA]"
              activeOpacity={0.7}
              disabled={isRefreshing}
              style={styles.button}
            >
              {isRefreshing ? (
                <ActivityIndicator size={18} color="#EA580C" />
              ) : (
                <Ionicons name="refresh" size={18} color="#EA580C" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Map */}
      <View className="flex-1">
        {loading ? (
          <View className="flex-1 items-center justify-center bg-[#FFF7ED]">
            <View
              className="w-16 h-16 rounded-3xl bg-[#FFF1E6] items-center justify-center mb-4"
              style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 4 }}
            >
              <Ionicons name="flame" size={30} color="#EA580C" />
            </View>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text className="text-[#451A03] font-bold mt-3 text-sm">Loading delivery map...</Text>
          </View>
        ) : mapHtml ? (
          <WebView
            ref={webViewRef}
            style={{
              flex: 1,
              backgroundColor: '#FFF7ED',
            }}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            mixedContentMode="always"
            source={{ html: mapHtml }}
            onMessage={handleMessage}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            onLoadEnd={() => {
              mapReadyRef.current = true;
              setIsMapReady(true);
              if (riderLocation) {
                const activeOrders = orders.filter(o => o.status === 'Picked Up' || o.status === 'Out for Delivery');
                const targetOrderId = activeOrders.length > 0 ? activeOrders[0].id : null;
                const js = `
                  if (window.__updateMovingDot) {
                    window.__updateMovingDot(${riderLocation.lat}, ${riderLocation.lng}, ${targetOrderId ? `'${targetOrderId}'` : 'null'});
                  }
                  true;
                `;
                webViewRef.current?.injectJavaScript(js);
              }
              const activeOrders = orders.filter(o => o.status === 'Picked Up' || o.status === 'Out for Delivery');
              if (activeOrders.length > 0) {
                const riderPos = riderLocation || { lat: 14.5600, lng: 121.0200 };
                const targetOrderId = activeOrders[0].id;
                const js = `
                  if (window.__updateOrders) {
                    window.__updateOrders(${JSON.stringify(activeOrders)}, ${riderPos.lat}, ${riderPos.lng});
                  }
                  if (window.__updateMovingDot) {
                    window.__updateMovingDot(${riderPos.lat}, ${riderPos.lng}, '${targetOrderId}');
                  }
                  true;
                `;
                webViewRef.current?.injectJavaScript(js);
              }
              setTimeout(() => {
                webViewRef.current?.injectJavaScript(`
                  if (window.map) {
                    window.map.invalidateSize();
                  }
                  true;
                `);
              }, 500);
            }}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.log('WebView error:', nativeEvent);
              setMapError(true);
            }}
            onHttpError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.log('HTTP error:', nativeEvent);
              setMapError(true);
            }}
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-[#FFF7ED]">
            <View className="w-20 h-20 rounded-full bg-[#FFF1E6] border border-[#FED7AA] items-center justify-center mb-3">
              <Ionicons name="map-outline" size={34} color="#EA580C" />
            </View>
            <Text className="text-[#451A03] text-base font-extrabold">No map data</Text>
            <Text className="text-stone-500 text-sm mt-1">Could not load the delivery map</Text>
          </View>
        )}
      </View>

      {/* Bottom delivery list */}
      <View className="bg-[#FFFBF5] border-t border-[#F5EDE0] rounded-t-3xl" style={{ maxHeight: 280 }}>
        <View className="px-4 py-3 flex-row justify-between items-center">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-xl bg-[#EA580C] items-center justify-center mr-2.5"
              style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 }}
            >
              <Ionicons name="bicycle" size={16} color="#FFFFFF" />
            </View>
            <Text className="text-[#171717] font-extrabold text-sm">Active Deliveries</Text>
          </View>
          <View className="bg-[#FFF1E6] px-3 py-1 rounded-full border border-[#FED7AA]">
            <Text className="text-[#9A3412] text-xs font-extrabold">{displayedOrders.length} orders</Text>
          </View>
        </View>

        <ScrollView
          className="flex-1 px-4 pt-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8 }}
        >
          {displayedOrders.length === 0 ? (
            <View className="items-center py-8">
              <View
                className="w-16 h-16 rounded-full bg-[#FFF1E6] border border-[#FED7AA] items-center justify-center mb-3"
                style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 2 }}
              >
                <Ionicons name="bicycle" size={30} color="#EA580C" />
              </View>
              <Text className="text-[#451A03] text-sm font-extrabold">All caught up!</Text>
              <Text className="text-stone-500 text-xs mt-1">No active deliveries</Text>
            </View>
          ) : (
            displayedOrders.map((order) => {
              const isSelected = selectedId === order.id;
              const statusColor = STATUS_COLORS[order.status] || '#EA580C';
              return (
                <TouchableOpacity
                  key={order.id}
                  className={`rounded-2xl mb-2.5 p-3 border ${
                    isSelected ? 'bg-[#FFF7ED] border-[#EA580C]' : 'bg-white border-[#F5EDE0]'
                  }`}
                  style={!isSelected ? { shadowColor: '#451A03', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 } : {}}
                  activeOpacity={0.7}
                  onPress={() => focusItem(order.latitude, order.longitude, order.id)}
                >
                  <View className="flex-row items-center">
                    <View
                      className="w-10 h-10 rounded-2xl items-center justify-center mr-3"
                      style={{ backgroundColor: statusColor + '14' }}
                    >
                      <MaterialIcons
                        name={STATUS_ICONS[order.status] || 'pending'}
                        size={20}
                        color={statusColor}
                      />
                    </View>

                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="text-sm font-bold text-[#171717] flex-1" numberOfLines={1}>{order.customer}</Text>
                        {getStatusBadge(order)}
                      </View>
                      <View className="flex-row items-center mt-0.5">
                        <Ionicons name="location-outline" size={12} color="#A8A29E" style={{ marginRight: 4 }} />
                        <Text className="text-[11px] text-stone-500 flex-1" numberOfLines={1}>{order.address}</Text>
                      </View>
                      <View className="flex-row items-center mt-1.5 flex-wrap">
                        {order.distance ? (
                          <>
                            <Ionicons name="navigate-outline" size={11} color="#A8A29E" style={{ marginRight: 3 }} />
                            <Text className="text-[10px] text-stone-400">{order.distance}</Text>
                          </>
                        ) : null}
                        {order.duration ? (
                          <>
                            <Text className="text-[#E7E0D8] mx-1.5">|</Text>
                            <Ionicons name="time-outline" size={11} color="#A8A29E" style={{ marginRight: 3 }} />
                            <Text className="text-[10px] text-stone-400">{order.duration}</Text>
                          </>
                        ) : null}
                        {order.items ? (
                          <View className="flex-row items-center bg-[#FFF7ED] px-2 py-0.5 rounded-full border border-[#FED7AA] ml-1">
                            <Ionicons name="fast-food-outline" size={10} color="#C2410C" style={{ marginRight: 3 }} />
                            <Text className="text-[10px] text-[#7C2D12] font-semibold" numberOfLines={1} style={{ maxWidth: 120 }}>{order.items}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <View className="items-end ml-2">
                      <Text className="text-sm font-extrabold text-[#451A03]">{order.total}</Text>
                      <TouchableOpacity
                        className="mt-1.5 bg-[#EA580C] px-3 py-2 rounded-xl flex-row items-center"
                        activeOpacity={0.8}
                        style={{ shadowColor: '#EA580C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2 }}
                        onPress={() => openDirections(order.latitude, order.longitude, order.customer)}
                      >
                        <Ionicons name="navigate" size={13} color="#FFFFFF" />
                        <Text className="text-[12px] font-extrabold text-white ml-1">Go</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});