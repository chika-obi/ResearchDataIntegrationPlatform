import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Enumerator, EnumeratorLocationRecord } from '../types';
import { KNOWN_FIELD_CLUSTERS, FieldClusterZone, updateEnumeratorTelemetry } from '../lib/enumeratorTelemetry';

interface EnumeratorMapVisualizationProps {
  enumerators: Enumerator[];
  selectedEnumerator: Enumerator | null;
  onSelectEnumerator: (enumerator: Enumerator) => void;
  onForceSync?: (enumeratorId: string) => void;
  onSendMessage?: (enumerator: Enumerator) => void;
  onOpenFieldApp?: () => void;
}

type MapLayerMode = 'topographic' | 'satellite' | 'heatmap';

// Projection bounds covering Nigeria / West Africa study zones:
// Lat: ~4.0°N (Niger Delta) to ~13.8°N (Northern Border)
// Lon: ~2.5°E (Western border) to ~14.5°E (Lake Chad)
const MAP_BOUNDS = {
  minLat: 3.8,
  maxLat: 13.9,
  minLon: 2.6,
  maxLon: 14.6
};

// SVG Canvas Coordinate Dimensions
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 700;

export const EnumeratorMapVisualization: React.FC<EnumeratorMapVisualizationProps> = ({
  enumerators,
  selectedEnumerator,
  onSelectEnumerator,
  onForceSync,
  onSendMessage,
  onOpenFieldApp
}) => {
  const [mapMode, setMapMode] = useState<MapLayerMode>('topographic');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Layer Visibility
  const [showAccuracyCircles, setShowAccuracyCircles] = useState(true);
  const [showBreadcrumbs, setShowBreadcrumbs] = useState(true);
  const [showClusterZones, setShowClusterZones] = useState(true);
  const [showSignalWaves, setShowSignalWaves] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Synced' | 'Pending' | 'Error'>('ALL');
  const [regionFilter, setRegionFilter] = useState<string>('ALL');

  // Real-time ping notification state
  const [lastLivePing, setLastLivePing] = useState<{
    enumeratorName: string;
    coordinates: { latitude: number; longitude: number };
    time: string;
    message: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Converts Geocoordinates (Lat, Lon) to SVG Canvas (X, Y)
  const projectGeoToSvg = (lat: number, lon: number): { x: number; y: number } => {
    // Equirectangular projection clamped to bounds
    const normalizedX = (lon - MAP_BOUNDS.minLon) / (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon);
    // In SVG Y is inverted (0 is top)
    const normalizedY = 1 - (lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);

    return {
      x: Math.round(normalizedX * CANVAS_WIDTH),
      y: Math.round(normalizedY * CANVAS_HEIGHT)
    };
  };

  // Listen to live telemetry updates from OfflineFieldInterface
  useEffect(() => {
    const handleTelemetryEvent = (e: any) => {
      if (e.detail) {
        const payload = Array.isArray(e.detail) ? e.detail[0] : e.detail;
        if (payload?.coordinates || payload?.gps) {
          const coords = payload.coordinates || payload.gps;
          setLastLivePing({
            enumeratorName: payload.name || payload.enumeratorName || 'Field Enumerator',
            coordinates: { latitude: coords.latitude, longitude: coords.longitude },
            time: 'Just now',
            message: `Live GPS Fix received from ${payload.name || payload.enumeratorName || 'Field Agent'}`
          });

          // Auto-hide ping banner after 6 seconds
          const timer = setTimeout(() => setLastLivePing(null), 6000);
          return () => clearTimeout(timer);
        }
      }
    };

    window.addEventListener('rdip_enumerator_location_updated', handleTelemetryEvent);
    window.addEventListener('rdip_response_synced', handleTelemetryEvent);
    return () => {
      window.removeEventListener('rdip_enumerator_location_updated', handleTelemetryEvent);
      window.removeEventListener('rdip_response_synced', handleTelemetryEvent);
    };
  }, []);

  // Filtered enumerators
  const filteredEnumerators = useMemo(() => {
    return enumerators.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (regionFilter !== 'ALL' && !item.region.toLowerCase().includes(regionFilter.toLowerCase())) return false;
      return true;
    });
  }, [enumerators, statusFilter, regionFilter]);

  // Pan & Zoom Handlers
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(3.5, prev + 0.3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(0.7, prev - 0.3));
  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleCenterOnEnumerator = (e: Enumerator) => {
    onSelectEnumerator(e);
    if (e.coordinates) {
      const pos = projectGeoToSvg(e.coordinates.latitude, e.coordinates.longitude);
      // Center SVG point inside canvas
      setZoomLevel(1.8);
      setPanOffset({
        x: (CANVAS_WIDTH / 2 - pos.x) * 1.8,
        y: (CANVAS_HEIGHT / 2 - pos.y) * 1.8
      });
    }
  };

  // Mouse Drag Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Simulation Trigger: simulate a GPS movement pulse from a field enumerator
  const handleSimulateFieldMovement = () => {
    const target = selectedEnumerator || enumerators[0];
    if (!target) return;

    // Small random wander (approx 200m - 500m)
    const currentLat = target.coordinates?.latitude || 9.0765;
    const currentLon = target.coordinates?.longitude || 7.3986;
    const deltaLat = (Math.random() - 0.45) * 0.015;
    const deltaLon = (Math.random() - 0.45) * 0.015;

    const newLat = Math.round((currentLat + deltaLat) * 10000) / 10000;
    const newLon = Math.round((currentLon + deltaLon) * 10000) / 10000;

    updateEnumeratorTelemetry(target.id, {
      latitude: newLat,
      longitude: newLon,
      accuracy: Math.round((2.5 + Math.random() * 4) * 10) / 10,
      altitude: Math.round(150 + Math.random() * 200),
      speed: Math.round((1.2 + Math.random() * 2.5) * 10) / 10,
      heading: Math.floor(Math.random() * 360),
      address: `Active Field Transit • Ward Sector ${Math.floor(Math.random() * 10) + 1}`,
      timestamp: new Date().toISOString()
    }, {
      batteryLevel: Math.max(10, target.batteryLevel - 1),
      unsyncedDelta: Math.random() > 0.6 ? 1 : 0
    });

    setLastLivePing({
      enumeratorName: target.name,
      coordinates: { latitude: newLat, longitude: newLon },
      time: 'Just now',
      message: `Simulated GPS displacement for ${target.name} (${newLat.toFixed(4)}°N, ${newLon.toFixed(4)}°E)`
    });
  };

  // Fleet Statistics
  const activeCount = enumerators.filter((e) => e.status === 'Synced' || e.status === 'Pending').length;
  const totalUnsynced = enumerators.reduce((acc, curr) => acc + curr.unsyncedCount, 0);
  const totalResponses = enumerators.reduce((acc, curr) => acc + curr.responses, 0);

  return (
    <div className="bg-white rounded-2xl card-shadow border border-[#c4c6cf]/50 overflow-hidden flex flex-col space-y-0">
      {/* Top Header & Telemetry Bar */}
      <div className="p-4 sm:p-5 border-b border-[#c4c6cf]/40 bg-[#f9f9ff] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1a365d] text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[18px]">map</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-[#002045] flex items-center gap-2">
                <span>Real-Time Geospatial Fleet Map</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#006a68]/10 text-[#006a68] border border-[#006a68]/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#006a68] animate-ping" />
                  <span>LIVE GPS TELEMETRY</span>
                </span>
              </h2>
              <p className="text-xs text-[#43474e]">
                Tracking last known coordinates, GPS accuracy boundaries, and movement breadcrumbs from Offline Field App.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Map Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Layer Selector */}
          <div className="inline-flex rounded-lg border border-[#c4c6cf] bg-white p-0.5 text-xs font-semibold text-[#002045]">
            <button
              onClick={() => setMapMode('topographic')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                mapMode === 'topographic' ? 'bg-[#1a365d] text-white shadow-xs' : 'hover:bg-slate-50'
              }`}
            >
              Topographic
            </button>
            <button
              onClick={() => setMapMode('satellite')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                mapMode === 'satellite' ? 'bg-[#1a365d] text-white shadow-xs' : 'hover:bg-slate-50'
              }`}
            >
              Dark Radar
            </button>
            <button
              onClick={() => setMapMode('heatmap')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                mapMode === 'heatmap' ? 'bg-[#1a365d] text-white shadow-xs' : 'hover:bg-slate-50'
              }`}
            >
              Heatmap
            </button>
          </div>

          <button
            onClick={handleSimulateFieldMovement}
            title="Simulate live GPS movement pulse"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#006a68]/10 text-[#006a68] border border-[#006a68]/30 hover:bg-[#006a68]/20 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined text-[16px]">sensors</span>
            <span>Simulate Live Ping</span>
          </button>
        </div>
      </div>

      {/* Fleet Telemetry Metric Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#c4c6cf]/30 border-b border-[#c4c6cf]/40 bg-[#f1f3ff]/40 text-xs">
        <div className="p-3 px-4 flex items-center justify-between">
          <span className="text-[#43474e]">Active GPS Transponders</span>
          <span className="font-mono font-bold text-[#002045]">{activeCount} / {enumerators.length}</span>
        </div>
        <div className="p-3 px-4 flex items-center justify-between">
          <span className="text-[#43474e]">Buffered Offline Responses</span>
          <span className="font-mono font-bold text-[#e88532]">{totalUnsynced}</span>
        </div>
        <div className="p-3 px-4 flex items-center justify-between">
          <span className="text-[#43474e]">Total Survey Geo-fixes</span>
          <span className="font-mono font-bold text-[#006a68]">{totalResponses}</span>
        </div>
        <div className="p-3 px-4 flex items-center justify-between">
          <span className="text-[#43474e]">Mean Field Accuracy</span>
          <span className="font-mono font-bold text-[#002045]">± 4.1m (RTK)</span>
        </div>
      </div>

      {/* Main Map Container */}
      <div className="relative w-full h-[480px] md:h-[540px] bg-[#e6edf8] overflow-hidden select-none" ref={containerRef}>
        {/* Real-time Ping Alert Toast */}
        {lastLivePing && (
          <div className="absolute top-4 left-4 right-4 sm:right-auto z-30 bg-[#002045]/95 text-white p-3 px-4 rounded-xl shadow-xl border border-[#91f0ed]/30 backdrop-blur-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-3 max-w-md">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00f2fe] animate-ping shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-[#91f0ed] block">{lastLivePing.message}</span>
              <span className="text-white/70 text-[11px]">
                Lat: {lastLivePing.coordinates.latitude.toFixed(4)}°N • Lon: {lastLivePing.coordinates.longitude.toFixed(4)}°E • {lastLivePing.time}
              </span>
            </div>
            <button
              onClick={() => setLastLivePing(null)}
              className="ml-auto text-white/60 hover:text-white p-1"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* Floating Map Toolbar Controls (Top Right) */}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
          <div className="bg-white/90 backdrop-blur-md rounded-xl p-1 shadow-lg border border-[#c4c6cf]/50 flex flex-col">
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="w-8 h-8 flex items-center justify-center text-[#002045] hover:bg-[#f1f3ff] rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
            <div className="h-[1px] bg-[#c4c6cf]/40 my-0.5" />
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="w-8 h-8 flex items-center justify-center text-[#002045] hover:bg-[#f1f3ff] rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">remove</span>
            </button>
            <div className="h-[1px] bg-[#c4c6cf]/40 my-0.5" />
            <button
              onClick={handleResetView}
              title="Reset Extent"
              className="w-8 h-8 flex items-center justify-center text-[#002045] hover:bg-[#f1f3ff] rounded-lg transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            </button>
          </div>

          {/* Layer Toggle Quick Menu */}
          <div className="bg-white/90 backdrop-blur-md rounded-xl p-2 shadow-lg border border-[#c4c6cf]/50 text-[11px] font-semibold text-[#002045] space-y-1 hidden sm:block">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#1a365d]">
              <input
                type="checkbox"
                checked={showAccuracyCircles}
                onChange={(e) => setShowAccuracyCircles(e.target.checked)}
                className="rounded text-[#006a68] focus:ring-0"
              />
              <span>Accuracy Buffers</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#1a365d]">
              <input
                type="checkbox"
                checked={showBreadcrumbs}
                onChange={(e) => setShowBreadcrumbs(e.target.checked)}
                className="rounded text-[#006a68] focus:ring-0"
              />
              <span>Route Trails</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#1a365d]">
              <input
                type="checkbox"
                checked={showClusterZones}
                onChange={(e) => setShowClusterZones(e.target.checked)}
                className="rounded text-[#006a68] focus:ring-0"
              />
              <span>Sample Zones</span>
            </label>
          </div>
        </div>

        {/* Filter Bar (Bottom Left) */}
        <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-2 bg-white/90 backdrop-blur-md p-2 rounded-xl shadow-lg border border-[#c4c6cf]/50 text-xs">
          <div className="flex items-center gap-1 text-[#43474e]">
            <span className="material-symbols-outlined text-[16px]">filter_alt</span>
            <span className="font-semibold text-[11px]">Filter:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-white border border-[#c4c6cf] rounded-md px-2 py-1 text-[11px] font-medium text-[#002045] outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="Synced">🟢 Synced Only</option>
            <option value="Pending">🟠 Pending Offline</option>
            <option value="Error">🔴 Low Battery / Error</option>
          </select>

          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="bg-white border border-[#c4c6cf] rounded-md px-2 py-1 text-[11px] font-medium text-[#002045] outline-none"
          >
            <option value="ALL">All Study Sectors</option>
            <option value="Kaduna">Kaduna / North Central</option>
            <option value="Enugu">Enugu / East District</option>
            <option value="Port Harcourt">Port Harcourt / South</option>
            <option value="Ibadan">Ibadan / West District</option>
            <option value="Abuja">Abuja / Central Metro</option>
            <option value="Lagos">Lagos / Coastal Pilot</option>
          </select>
        </div>

        {/* Map Canvas / SVG Layer */}
        <div
          className={`w-full h-full cursor-${isDragging ? 'grabbing' : 'grab'} transition-colors duration-300 ${
            mapMode === 'satellite'
              ? 'bg-[#0f172a]'
              : mapMode === 'heatmap'
              ? 'bg-[#18181b]'
              : 'bg-[#e6edf8]'
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
            className="w-full h-full pointer-events-auto"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.25s ease-out'
            }}
          >
            <defs>
              {/* Gradients */}
              <linearGradient id="nigeriaTerrainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={mapMode === 'satellite' ? '#1e293b' : '#dcfce7'} stopOpacity={0.8} />
                <stop offset="50%" stopColor={mapMode === 'satellite' ? '#0f172a' : '#f0fdf4'} stopOpacity={0.9} />
                <stop offset="100%" stopColor={mapMode === 'satellite' ? '#020617' : '#ecfdf5'} stopOpacity={0.9} />
              </linearGradient>

              {/* Heatmap blur filter */}
              <filter id="heatGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="30" />
              </filter>

              {/* Marker Drop Shadow */}
              <filter id="pinShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
              </filter>
            </defs>

            {/* Ocean & Coastal Water Background */}
            <rect
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              fill={mapMode === 'satellite' ? '#070b14' : mapMode === 'heatmap' ? '#09090b' : '#cde4f7'}
            />

            {/* National Landmass Silhouette (Nigeria & Regional West Africa) */}
            <path
              d="M 120 420 
                 Q 130 320, 160 220 
                 Q 200 120, 320 80 
                 Q 500 50, 720 70 
                 Q 890 90, 940 180 
                 Q 970 300, 920 430 
                 Q 860 520, 780 580 
                 Q 650 630, 520 620 
                 Q 420 600, 310 610 
                 Q 210 620, 140 590 
                 Q 110 520, 120 420 Z"
              fill="url(#nigeriaTerrainGrad)"
              stroke={mapMode === 'satellite' ? '#334155' : mapMode === 'heatmap' ? '#27272a' : '#94a3b8'}
              strokeWidth="2.5"
              strokeDasharray={mapMode === 'satellite' ? '4 2' : 'none'}
            />

            {/* River Niger & Benue Confluence Vector */}
            <path
              d="M 140 380 Q 250 390, 360 410 T 500 460 Q 640 470, 780 430 M 500 460 Q 480 530, 440 610"
              fill="none"
              stroke={mapMode === 'satellite' ? '#0284c7' : mapMode === 'heatmap' ? '#1e293b' : '#7dd3fc'}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeOpacity="0.75"
            />

            {/* Major Regional Grid & Inter-State Corridors */}
            <g opacity={mapMode === 'satellite' ? 0.3 : 0.45} stroke={mapMode === 'satellite' ? '#64748b' : '#94a3b8'} strokeDasharray="6 4" strokeWidth="1">
              {/* Kaduna to Abuja link */}
              <line x1="480" y1="230" x2="480" y2="340" />
              {/* Abuja to Enugu link */}
              <line x1="480" y1="340" x2="490" y2="520" />
              {/* Enugu to Port Harcourt link */}
              <line x1="490" y1="520" x2="450" y2="630" />
              {/* Ibadan to Lagos link */}
              <line x1="230" y1="460" x2="190" y2="520" />
              {/* Ibadan to Abuja corridor */}
              <line x1="230" y1="460" x2="480" y2="340" />
            </g>

            {/* Regional Name Watermarks */}
            <g fontSize="13" fontWeight="700" fill={mapMode === 'satellite' ? '#64748b' : '#64748b'} opacity="0.6" letterSpacing="2">
              <text x="440" y="210">NORTH CENTRAL (KADUNA)</text>
              <text x="440" y="325">FEDERAL CAPITAL (ABUJA)</text>
              <text x="510" y="510">EASTERN SECTOR (ENUGU)</text>
              <text x="360" y="650">NIGER DELTA (PORT HARCOURT)</text>
              <text x="140" y="445">WESTERN SECTOR (IBADAN)</text>
              <text x="120" y="540">LAGOS METRO</text>
            </g>

            {/* Heatmap Density Layer (if active) */}
            {mapMode === 'heatmap' && (
              <g filter="url(#heatGlow)" opacity="0.8">
                {enumerators.map((e) => {
                  if (!e.coordinates) return null;
                  const pos = projectGeoToSvg(e.coordinates.latitude, e.coordinates.longitude);
                  const intensityRadius = Math.min(90, Math.max(35, e.responses * 0.4));
                  return (
                    <circle
                      key={`heat-${e.id}`}
                      cx={pos.x}
                      cy={pos.y}
                      r={intensityRadius}
                      fill={e.responses > 150 ? '#ef4444' : e.responses > 80 ? '#f59e0b' : '#3b82f6'}
                    />
                  );
                })}
              </g>
            )}

            {/* Study Sample Cluster Catchment Geofence Circles */}
            {showClusterZones && (
              <g>
                {KNOWN_FIELD_CLUSTERS.map((clust) => {
                  const pos = projectGeoToSvg(clust.center.latitude, clust.center.longitude);
                  const radiusPixels = clust.radiusKm * 3.2;
                  const isAssignedSelected = selectedEnumerator?.id === clust.assignedEnumeratorId;
                  return (
                    <g key={clust.id} className="transition-all duration-200">
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={radiusPixels}
                        fill={isAssignedSelected ? '#006a68' : '#1a365d'}
                        fillOpacity={isAssignedSelected ? 0.15 : 0.06}
                        stroke={isAssignedSelected ? '#006a68' : '#1a365d'}
                        strokeWidth={isAssignedSelected ? 2.5 : 1.5}
                        strokeDasharray={isAssignedSelected ? 'none' : '4 3'}
                      />
                      <text
                        x={pos.x}
                        y={pos.y - radiusPixels - 6}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="600"
                        fill={mapMode === 'satellite' ? '#94a3b8' : '#43474e'}
                      >
                        {clust.name} ({clust.collectedCount}/{clust.targetSample})
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Breadcrumb Transit Trail Historical Paths */}
            {showBreadcrumbs && (
              <g>
                {filteredEnumerators.map((e) => {
                  if (!e.locationHistory || e.locationHistory.length < 2) return null;
                  const points = e.locationHistory.map((pt) => {
                    const p = projectGeoToSvg(pt.latitude, pt.longitude);
                    return `${p.x},${p.y}`;
                  }).join(' ');

                  const isSelected = selectedEnumerator?.id === e.id;
                  return (
                    <g key={`trail-${e.id}`}>
                      <polyline
                        points={points}
                        fill="none"
                        stroke={isSelected ? '#006a68' : '#64748b'}
                        strokeWidth={isSelected ? 3 : 1.8}
                        strokeDasharray="4 3"
                        strokeOpacity={isSelected ? 0.9 : 0.5}
                      />
                      {/* Trail Waypoints */}
                      {e.locationHistory.map((wpt, idx) => {
                        const wpPos = projectGeoToSvg(wpt.latitude, wpt.longitude);
                        return (
                          <circle
                            key={`wpt-${e.id}-${idx}`}
                            cx={wpPos.x}
                            cy={wpPos.y}
                            r={isSelected ? 3.5 : 2.5}
                            fill={isSelected ? '#006a68' : '#64748b'}
                            opacity={0.8}
                          />
                        );
                      })}
                    </g>
                  );
                })}
              </g>
            )}

            {/* Active Enumerator Markers & Pins */}
            {filteredEnumerators.map((e) => {
              if (!e.coordinates) return null;
              const pos = projectGeoToSvg(e.coordinates.latitude, e.coordinates.longitude);
              const isSelected = selectedEnumerator?.id === e.id;
              const isSynced = e.status === 'Synced';
              const isPending = e.status === 'Pending';
              const statusColor = isSynced ? '#006a68' : isPending ? '#e88532' : '#ba1a1a';
              const accuracyRadius = Math.max(12, (e.coordinates.accuracy || 4.2) * 2.8);

              return (
                <g
                  key={e.id}
                  onClick={(evt) => {
                    evt.stopPropagation();
                    onSelectEnumerator(e);
                  }}
                  className="cursor-pointer group"
                  filter="url(#pinShadow)"
                >
                  {/* GPS Accuracy Buffer Circle */}
                  {showAccuracyCircles && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={accuracyRadius}
                      fill={statusColor}
                      fillOpacity={isSelected ? 0.22 : 0.1}
                      stroke={statusColor}
                      strokeWidth={isSelected ? 1.5 : 1}
                      strokeDasharray="2 2"
                    />
                  )}

                  {/* Pulsing Radar Wave on Active Transmitters */}
                  {showSignalWaves && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isSelected ? 26 : 18}
                      fill="none"
                      stroke={statusColor}
                      strokeWidth="2"
                      opacity="0.8"
                    >
                      <animate
                        attributeName="r"
                        values="10;32;44"
                        dur="2.4s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.9;0.3;0"
                        dur="2.4s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Pin Base & Stem */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isSelected ? 16 : 13}
                    fill={isSelected ? '#002045' : 'white'}
                    stroke={statusColor}
                    strokeWidth={isSelected ? 3.5 : 2.5}
                    className="transition-all duration-200"
                  />

                  {/* Status Center Icon or Initial */}
                  <text
                    x={pos.x}
                    y={pos.y + 4}
                    textAnchor="middle"
                    fontSize={isSelected ? '10' : '9'}
                    fontWeight="800"
                    fill={isSelected ? 'white' : '#002045'}
                    fontFamily="monospace"
                  >
                    {e.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </text>

                  {/* Top Badge: Unsynced offline buffer badge */}
                  {e.unsyncedCount > 0 && (
                    <g>
                      <circle
                        cx={pos.x + 11}
                        cy={pos.y - 11}
                        r="7"
                        fill="#e88532"
                        stroke="white"
                        strokeWidth="1.5"
                      />
                      <text
                        x={pos.x + 11}
                        y={pos.y - 8.5}
                        textAnchor="middle"
                        fontSize="8"
                        fontWeight="800"
                        fill="white"
                      >
                        {e.unsyncedCount}
                      </text>
                    </g>
                  )}

                  {/* Marker Callout Label */}
                  <g transform={`translate(${pos.x}, ${pos.y + (isSelected ? 26 : 22)})`}>
                    <rect
                      x="-55"
                      y="-10"
                      width="110"
                      height="20"
                      rx="6"
                      fill={isSelected ? '#002045' : 'white'}
                      stroke={isSelected ? '#91f0ed' : '#c4c6cf'}
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight={isSelected ? '700' : '600'}
                      fill={isSelected ? 'white' : '#161c27'}
                    >
                      {e.name.split(' ')[0]} ({e.id})
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Selected Enumerator Geospatial Details Drawer */}
      {selectedEnumerator && selectedEnumerator.coordinates && (
        <div className="p-5 border-t border-[#c4c6cf]/40 bg-[#f9f9ff] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#1a365d] text-white flex items-center justify-center shrink-0 shadow-sm border border-[#1a365d]/20">
              <span className="material-symbols-outlined text-2xl text-[#91f0ed]">person_pin_circle</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#002045]">{selectedEnumerator.name}</h3>
                <span className="font-mono text-xs text-[#74777f]">({selectedEnumerator.id})</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    selectedEnumerator.status === 'Synced'
                      ? 'bg-[#006a68]/10 text-[#006a68]'
                      : selectedEnumerator.status === 'Pending'
                      ? 'bg-[#ffdcc5]/70 text-[#703700]'
                      : 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
                  }`}
                >
                  {selectedEnumerator.status}
                </span>
              </div>
              <p className="text-xs text-[#43474e] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>📍 <strong className="text-[#002045]">Lat: {selectedEnumerator.coordinates.latitude.toFixed(4)}°N, Lon: {selectedEnumerator.coordinates.longitude.toFixed(4)}°E</strong></span>
                <span>🎯 Precision: <strong>± {selectedEnumerator.coordinates.accuracy || 4.2}m</strong></span>
                <span>⚡ Speed: <strong>{selectedEnumerator.coordinates.speed || 1.4} km/h</strong></span>
                <span>🔋 Battery: <strong>{selectedEnumerator.batteryLevel}%</strong></span>
              </p>
              <p className="text-[11px] text-[#74777f] mt-0.5">
                Sector Location: {selectedEnumerator.coordinates.address || selectedEnumerator.region} • Last fix: {selectedEnumerator.lastSync}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => handleCenterOnEnumerator(selectedEnumerator)}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-[#c4c6cf] text-[#002045] hover:bg-[#f1f3ff] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px]">center_focus_strong</span>
              <span>Center Pin</span>
            </button>

            {onSendMessage && (
              <button
                onClick={() => onSendMessage(selectedEnumerator)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-[#c4c6cf] text-[#002045] hover:bg-[#f1f3ff] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px]">sms</span>
                <span>SMS Check-in</span>
              </button>
            )}

            {onForceSync && (
              <button
                onClick={() => onForceSync(selectedEnumerator.id)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1a365d] hover:bg-[#002045] text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">sync</span>
                <span>Force Remote Sync</span>
              </button>
            )}

            {onOpenFieldApp && (
              <button
                onClick={onOpenFieldApp}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#006a68] hover:bg-[#00504e] text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">tablet_mac</span>
                <span>Launch Field App</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
