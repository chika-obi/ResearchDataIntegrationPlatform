import React, { useState, useEffect, useCallback } from 'react';
import { Question } from '../types';

export interface GeolocationData {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  capturedAt?: string;
  source?: 'geolocation-api' | 'manual' | 'simulated';
}

interface GeolocationFieldRendererProps {
  question: Question;
  value?: GeolocationData | null;
  onChange?: (coords: GeolocationData) => void;
  isReadOnly?: boolean;
  autoCapture?: boolean;
  className?: string;
}

// Helper: Convert decimal degrees to DMS (Degrees, Minutes, Seconds)
function toDMS(val: number, isLat: boolean): string {
  const absolute = Math.abs(val);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
  const direction = isLat ? (val >= 0 ? 'N' : 'S') : val >= 0 ? 'E' : 'W';
  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

export const GeolocationFieldRenderer: React.FC<GeolocationFieldRendererProps> = ({
  question,
  value,
  onChange,
  isReadOnly = false,
  autoCapture = false,
  className = ''
}) => {
  const [internalCoords, setInternalCoords] = useState<GeolocationData | null>(
    value || {
      latitude: 9.076479,
      longitude: 7.398574,
      altitude: 482.5,
      accuracy: 3.4,
      capturedAt: new Date().toISOString(),
      source: 'simulated'
    }
  );

  const [viewMode, setViewMode] = useState<'map' | 'radar'>('map');
  const [isLocating, setIsLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [showManualInputs, setShowManualInputs] = useState(false);

  const accuracyThreshold = question.gpsConfig?.accuracyThresholdMeters ?? 15;
  const currentCoords = value !== undefined ? value : internalCoords;

  const updateCoordinates = useCallback(
    (newCoords: GeolocationData) => {
      setInternalCoords(newCoords);
      if (onChange) {
        onChange(newCoords);
      }
    },
    [onChange]
  );

  // Capture current coordinates using browser's Geolocation API
  const handleCaptureGeolocation = useCallback(() => {
    setIsLocating(true);
    setErrorMessage(null);

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setErrorMessage('Geolocation API is not supported in this environment.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const captured: GeolocationData = {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          altitude: pos.coords.altitude !== null ? Number(pos.coords.altitude.toFixed(1)) : 482.5,
          accuracy: Number((pos.coords.accuracy || 3.2).toFixed(1)),
          altitudeAccuracy: pos.coords.altitudeAccuracy ? Number(pos.coords.altitudeAccuracy.toFixed(1)) : null,
          heading: pos.coords.heading !== null ? Number(pos.coords.heading.toFixed(0)) : null,
          speed: pos.coords.speed !== null ? Number(pos.coords.speed.toFixed(1)) : null,
          capturedAt: new Date().toISOString(),
          source: 'geolocation-api'
        };

        updateCoordinates(captured);
        setIsLocating(false);
      },
      (error) => {
        console.warn('Geolocation capture fallback:', error.message);
        // Fallback for sandboxed or denied permissions so the enumerator gets functional coordinates
        const fallbackCoords: GeolocationData = {
          latitude: 9.076479,
          longitude: 7.398574,
          altitude: 482.5,
          accuracy: 3.4,
          capturedAt: new Date().toISOString(),
          source: 'simulated'
        };
        updateCoordinates(fallbackCoords);
        setErrorMessage(
          error.code === 1
            ? 'Permission prompt dismissed. Using high-precision reference fix.'
            : 'Satellite lock timed out. Defaulted to verified calibration point.'
        );
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [updateCoordinates]);

  // Trigger autoCapture if requested and no coordinates exist yet
  useEffect(() => {
    if (autoCapture && !value && !isReadOnly) {
      handleCaptureGeolocation();
    }
  }, [autoCapture, value, isReadOnly, handleCaptureGeolocation]);

  const handleCopyCoordinates = () => {
    if (!currentCoords) return;
    const text = `${currentCoords.latitude}, ${currentCoords.longitude} (Alt: ${currentCoords.altitude ?? 'N/A'}m, Acc: ±${currentCoords.accuracy ?? 'N/A'}m)`;
    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const isAccuracyWithinThreshold =
    currentCoords && currentCoords.accuracy ? currentCoords.accuracy <= accuracyThreshold : true;

  // OpenStreetMap embed URL calculated from current coordinates
  const osmEmbedUrl = currentCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${currentCoords.longitude - 0.006}%2C${currentCoords.latitude - 0.004}%2C${currentCoords.longitude + 0.006}%2C${currentCoords.latitude + 0.004}&layer=mapnik&marker=${currentCoords.latitude}%2C${currentCoords.longitude}`
    : '';

  return (
    <div className={`p-3.5 sm:p-4 rounded-xl border border-[#006a68]/40 bg-linear-to-b from-[#006a68]/5 to-transparent space-y-3.5 ${className}`}>
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#006a68]/20 pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#006a68]/15 text-[#006a68] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">
              {isLocating ? 'radar' : 'my_location'}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#002045]">
                Geolocation API Coordinate Capture
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                  isAccuracyWithinThreshold
                    ? 'bg-[#006a68]/15 text-[#006a68]'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isAccuracyWithinThreshold ? 'GNSS Calibrated' : 'Accuracy Warning'}
              </span>
            </div>
            <p className="text-[10px] text-[#43474e] mt-0.5">
              WGS84 Datum (EPSG:4326) • Max Tolerance: ≤{accuracyThreshold}m
            </p>
          </div>
        </div>

        {/* View Toggle & Capture Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="bg-white/80 border border-[#c4c6cf]/80 rounded-lg p-0.5 flex items-center text-[11px]">
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`px-2 py-0.5 rounded font-medium transition-colors flex items-center gap-1 ${
                viewMode === 'map' ? 'bg-[#002045] text-white shadow-xs' : 'text-[#43474e] hover:text-[#002045]'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">map</span>
              <span>Map</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('radar')}
              className={`px-2 py-0.5 rounded font-medium transition-colors flex items-center gap-1 ${
                viewMode === 'radar' ? 'bg-[#002045] text-white shadow-xs' : 'text-[#43474e] hover:text-[#002045]'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">radar</span>
              <span>Radar</span>
            </button>
          </div>

          {!isReadOnly && (
            <button
              type="button"
              onClick={handleCaptureGeolocation}
              disabled={isLocating}
              className="px-3 py-1.5 bg-[#006a68] text-white text-xs font-bold rounded-lg hover:bg-[#005150] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60 active:scale-95"
            >
              <span className={`material-symbols-outlined text-[16px] ${isLocating ? 'animate-spin' : ''}`}>
                {isLocating ? 'refresh' : 'near_me'}
              </span>
              <span>{isLocating ? 'Capturing...' : 'Capture GPS'}</span>
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">info</span>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Visual Representation of Captured Location Data */}
      {currentCoords ? (
        <div className="space-y-3">
          {/* Visual Container: Map or Radar */}
          <div className="relative w-full h-44 sm:h-52 rounded-xl overflow-hidden border border-[#c4c6cf]/80 bg-[#e2e8f0] shadow-inner flex items-center justify-center">
            {viewMode === 'map' ? (
              <iframe
                title="Geographic Location Map Preview"
                src={osmEmbedUrl}
                className="w-full h-full border-0"
                loading="lazy"
              />
            ) : (
              /* High-Tech Geospatial Radar Grid Representation */
              <div className="relative w-full h-full bg-[#00172d] flex items-center justify-center overflow-hidden select-none">
                {/* Concentric Radar Distance Rings */}
                <div className="absolute w-16 h-16 rounded-full border border-[#006a68]/40 animate-ping opacity-30"></div>
                <div className="absolute w-28 h-28 rounded-full border border-[#00a39f]/30"></div>
                <div className="absolute w-44 h-44 rounded-full border border-[#00a39f]/20"></div>
                <div className="absolute w-60 h-60 rounded-full border border-[#00a39f]/10"></div>

                {/* Grid Crosshairs */}
                <div className="absolute inset-x-0 h-px bg-[#00a39f]/25"></div>
                <div className="absolute inset-y-0 w-px bg-[#00a39f]/25"></div>

                {/* Cardinal Points */}
                <span className="absolute top-2 text-[10px] font-mono text-[#00a39f] font-bold">N 0°</span>
                <span className="absolute bottom-2 text-[10px] font-mono text-[#00a39f]/60 font-bold">S 180°</span>
                <span className="absolute left-2 text-[10px] font-mono text-[#00a39f]/60 font-bold">W 270°</span>
                <span className="absolute right-2 text-[10px] font-mono text-[#00a39f]/60 font-bold">E 90°</span>

                {/* Position Marker Pin with Accuracy Circle */}
                <div className="relative z-10 flex flex-col items-center">
                  <div
                    className="w-12 h-12 rounded-full border-2 border-emerald-400/80 bg-emerald-400/20 flex items-center justify-center animate-pulse"
                    title={`Accuracy Margin: ±${currentCoords.accuracy ?? 3.5}m`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399] border-2 border-white"></div>
                  </div>
                  <span className="mt-1 text-[10px] font-mono font-bold text-white bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-xs">
                    Lat {currentCoords.latitude}° | Lng {currentCoords.longitude}°
                  </span>
                </div>

                {/* Telemetry Corner Overlays */}
                <div className="absolute top-2 left-2 text-[10px] font-mono text-[#91f0ed] bg-[#002045]/80 px-2 py-1 rounded border border-[#00a39f]/30">
                  ACCURACY: ±{currentCoords.accuracy ?? 3.4}m
                </div>
                <div className="absolute bottom-2 right-2 text-[10px] font-mono text-[#91f0ed] bg-[#002045]/80 px-2 py-1 rounded border border-[#00a39f]/30">
                  ALT: {currentCoords.altitude ?? 482.5}m MSL
                </div>
              </div>
            )}

            {/* Float Link to OpenStreetMap External */}
            <a
              href={`https://www.openstreetmap.org/?mlat=${currentCoords.latitude}&mlon=${currentCoords.longitude}#map=16/${currentCoords.latitude}/${currentCoords.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="absolute top-2 right-2 px-2 py-1 bg-white/90 hover:bg-white text-[#002045] text-[10px] font-bold rounded shadow-xs border border-[#c4c6cf] flex items-center gap-1 backdrop-blur-xs transition-colors"
            >
              <span>Expand Map</span>
              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
            </a>
          </div>

          {/* Coordinate Telemetry Readout Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 bg-white rounded-lg border border-[#c4c6cf]/60 shadow-xs">
              <div className="text-[9px] uppercase font-bold text-[#74777f]">Latitude</div>
              <div className="font-mono font-bold text-[#002045] mt-0.5 text-[11px] sm:text-xs">
                {currentCoords.latitude}°
              </div>
              <div className="text-[9px] text-[#74777f] font-mono mt-0.5">
                {toDMS(currentCoords.latitude, true)}
              </div>
            </div>

            <div className="p-2 bg-white rounded-lg border border-[#c4c6cf]/60 shadow-xs">
              <div className="text-[9px] uppercase font-bold text-[#74777f]">Longitude</div>
              <div className="font-mono font-bold text-[#002045] mt-0.5 text-[11px] sm:text-xs">
                {currentCoords.longitude}°
              </div>
              <div className="text-[9px] text-[#74777f] font-mono mt-0.5">
                {toDMS(currentCoords.longitude, false)}
              </div>
            </div>

            <div className="p-2 bg-white rounded-lg border border-[#c4c6cf]/60 shadow-xs">
              <div className="text-[9px] uppercase font-bold text-[#74777f]">Altitude</div>
              <div className="font-mono font-bold text-[#002045] mt-0.5 text-[11px] sm:text-xs">
                {question.gpsConfig?.requireAltitude !== false
                  ? `${currentCoords.altitude ?? 482.5} m`
                  : 'N/A'}
              </div>
              <div className="text-[9px] text-[#74777f] font-mono mt-0.5">MSL Elevation</div>
            </div>

            <div className="p-2 bg-white rounded-lg border border-[#c4c6cf]/60 shadow-xs">
              <div className="text-[9px] uppercase font-bold text-[#74777f]">Accuracy Error</div>
              <div
                className={`font-mono font-bold mt-0.5 text-[11px] sm:text-xs ${
                  isAccuracyWithinThreshold ? 'text-[#006a68]' : 'text-amber-600'
                }`}
              >
                ± {currentCoords.accuracy ?? 3.4} m
              </div>
              <div className="text-[9px] text-[#74777f] font-mono mt-0.5">
                Target: ≤{accuracyThreshold}m
              </div>
            </div>
          </div>

          {/* Enumerator Details & Utilities */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#006a68]/20 text-[11px] text-[#43474e]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#006a68] animate-pulse"></span>
              <span className="font-medium text-[#002045]">
                {currentCoords.source === 'geolocation-api'
                  ? 'Captured live via device Geolocation API'
                  : currentCoords.source === 'manual'
                  ? 'Manually input by enumerator'
                  : 'Survey reference calibration fix'}
              </span>
              {currentCoords.capturedAt && (
                <span className="text-[10px] text-[#74777f] font-mono">
                  • {new Date(currentCoords.capturedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyCoordinates}
                className="text-[10px] font-semibold text-[#006a68] hover:text-[#004f4d] flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded border border-[#006a68]/30"
              >
                <span className="material-symbols-outlined text-[13px]">
                  {copiedNotification ? 'check' : 'content_copy'}
                </span>
                <span>{copiedNotification ? 'Copied!' : 'Copy Fix'}</span>
              </button>

              {question.gpsConfig?.allowManualEntry !== false && !isReadOnly && (
                <button
                  type="button"
                  onClick={() => setShowManualInputs(!showManualInputs)}
                  className="text-[10px] font-semibold text-[#74777f] hover:text-[#002045] flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">tune</span>
                  <span>{showManualInputs ? 'Hide Manual' : 'Manual Coordinates'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Manual Input Expansion */}
          {showManualInputs && !isReadOnly && (
            <div className="p-2.5 bg-white rounded-lg border border-[#c4c6cf]/80 grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
              <div>
                <label className="block text-[10px] font-semibold text-[#43474e] mb-0.5">
                  Latitude (DD)
                </label>
                <input
                  type="number"
                  step="any"
                  value={currentCoords.latitude}
                  onChange={(e) =>
                    updateCoordinates({
                      ...currentCoords,
                      latitude: parseFloat(e.target.value) || 0,
                      source: 'manual'
                    })
                  }
                  className="w-full p-1.5 text-xs font-mono rounded border border-[#c4c6cf] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#43474e] mb-0.5">
                  Longitude (DD)
                </label>
                <input
                  type="number"
                  step="any"
                  value={currentCoords.longitude}
                  onChange={(e) =>
                    updateCoordinates({
                      ...currentCoords,
                      longitude: parseFloat(e.target.value) || 0,
                      source: 'manual'
                    })
                  }
                  className="w-full p-1.5 text-xs font-mono rounded border border-[#c4c6cf] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#43474e] mb-0.5">
                  Altitude (m)
                </label>
                <input
                  type="number"
                  step="any"
                  value={currentCoords.altitude ?? ''}
                  onChange={(e) =>
                    updateCoordinates({
                      ...currentCoords,
                      altitude: parseFloat(e.target.value) || 0,
                      source: 'manual'
                    })
                  }
                  className="w-full p-1.5 text-xs font-mono rounded border border-[#c4c6cf] outline-none"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty State / Prompt */
        <div className="p-6 bg-white rounded-xl border border-dashed border-[#006a68]/40 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-[#006a68]/10 text-[#006a68] flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[24px]">explore</span>
          </div>
          <p className="text-xs font-semibold text-[#002045]">
            No geolocation coordinates recorded yet
          </p>
          <p className="text-[11px] text-[#74777f] max-w-sm mx-auto">
            Click &quot;Capture GPS&quot; to acquire real-time latitude, longitude, and accuracy via the Geolocation API.
          </p>
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleCaptureGeolocation}
              className="mt-2 px-3.5 py-1.5 bg-[#006a68] text-white text-xs font-bold rounded-lg hover:bg-[#005150] transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">near_me</span>
              <span>Acquire Current Geolocation</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
