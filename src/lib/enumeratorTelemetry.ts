import { Enumerator, EnumeratorLocationRecord } from '../types';
import { INITIAL_ENUMERATORS } from '../data/mockData';

const STORAGE_KEY = 'rdip_enumerator_locations';

export interface FieldClusterZone {
  id: string;
  name: string;
  lga: string;
  state: string;
  center: { latitude: number; longitude: number };
  radiusKm: number;
  targetSample: number;
  collectedCount: number;
  assignedEnumeratorId: string;
}

export const KNOWN_FIELD_CLUSTERS: FieldClusterZone[] = [
  {
    id: 'CLUST-01',
    name: 'Kaduna North Primary Care Cluster',
    lga: 'Kaduna North',
    state: 'Kaduna',
    center: { latitude: 10.5105, longitude: 7.4165 },
    radiusKm: 14.5,
    targetSample: 150,
    collectedCount: 142,
    assignedEnumeratorId: 'EN-1042'
  },
  {
    id: 'CLUST-02',
    name: 'Enugu Urban & Rural Buffer Zone',
    lga: 'Enugu North',
    state: 'Enugu',
    center: { latitude: 6.4584, longitude: 7.5464 },
    radiusKm: 22.0,
    targetSample: 120,
    collectedCount: 89,
    assignedEnumeratorId: 'EN-1045'
  },
  {
    id: 'CLUST-03',
    name: 'Port Harcourt Riverine & Coastal Catchment',
    lga: 'Port Harcourt',
    state: 'Rivers',
    center: { latitude: 4.8156, longitude: 7.0498 },
    radiusKm: 18.0,
    targetSample: 220,
    collectedCount: 215,
    assignedEnumeratorId: 'EN-1048'
  },
  {
    id: 'CLUST-04',
    name: 'Ibadan Commercial & Agronomic Perimeter',
    lga: 'Ibadan North',
    state: 'Oyo',
    center: { latitude: 7.3775, longitude: 3.9470 },
    radiusKm: 28.5,
    targetSample: 100,
    collectedCount: 45,
    assignedEnumeratorId: 'EN-1051'
  },
  {
    id: 'CLUST-05',
    name: 'Abuja Federal Capital Health Corridor',
    lga: 'Abuja Municipal',
    state: 'FCT Abuja',
    center: { latitude: 9.0765, longitude: 7.3986 },
    radiusKm: 12.0,
    targetSample: 180,
    collectedCount: 178,
    assignedEnumeratorId: 'EN-1058'
  },
  {
    id: 'CLUST-06',
    name: 'Lagos Island & Coastal Lagoon Pilot',
    lga: 'Lagos Island',
    state: 'Lagos',
    center: { latitude: 6.5244, longitude: 3.3792 },
    radiusKm: 9.5,
    targetSample: 200,
    collectedCount: 164,
    assignedEnumeratorId: 'EN-1048'
  }
];

export function getStoredEnumerators(): Enumerator[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read enumerator locations:', e);
  }

  // Initialize with rich mock data
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ENUMERATORS));
  } catch {}
  return INITIAL_ENUMERATORS;
}

export function saveStoredEnumerators(enumerators: Enumerator[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enumerators));
    try {
      window.dispatchEvent(new CustomEvent('rdip_enumerator_location_updated', { detail: enumerators }));
    } catch {}
  } catch (e) {
    console.error('Failed to save enumerators to storage:', e);
  }
}

/**
 * Updates an enumerator's coordinates directly in real time (e.g. from OfflineFieldInterface)
 */
export function updateEnumeratorTelemetry(
  enumeratorId: string,
  location: Partial<EnumeratorLocationRecord> & { latitude: number; longitude: number },
  extra?: { status?: 'Synced' | 'Pending' | 'Error'; unsyncedDelta?: number; batteryLevel?: number; responsesDelta?: number }
): Enumerator[] {
  const current = getStoredEnumerators();
  const now = new Date().toISOString();

  const newLocRecord: EnumeratorLocationRecord = {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy ?? 4.2,
    altitude: location.altitude ?? 50,
    speed: location.speed ?? 1.4,
    heading: location.heading ?? Math.floor(Math.random() * 360),
    timestamp: location.timestamp || now,
    address: location.address || `Live Field Geofence (Sector ${Math.floor(Math.random() * 12) + 1})`,
    lga: location.lga,
    state: location.state
  };

  const updated = current.map((item) => {
    if (item.id === enumeratorId || item.name.toLowerCase() === enumeratorId.toLowerCase()) {
      const history = item.locationHistory || [];
      const updatedHistory = [newLocRecord, ...history].slice(0, 20);

      return {
        ...item,
        status: extra?.status || item.status,
        batteryLevel: extra?.batteryLevel !== undefined ? extra.batteryLevel : item.batteryLevel,
        responses: extra?.responsesDelta ? item.responses + extra.responsesDelta : item.responses,
        unsyncedCount: extra?.unsyncedDelta !== undefined
          ? Math.max(0, item.unsyncedCount + extra.unsyncedDelta)
          : item.unsyncedCount,
        lastSync: 'Just now',
        coordinates: newLocRecord,
        locationHistory: updatedHistory
      };
    }
    return item;
  });

  saveStoredEnumerators(updated);
  return updated;
}

/**
 * Calculates geographic distance in kilometers using Haversine formula
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
