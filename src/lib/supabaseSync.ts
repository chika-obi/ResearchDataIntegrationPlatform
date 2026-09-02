import { supabase } from './supabase';
import { updateEnumeratorTelemetry } from './enumeratorTelemetry';

export interface SyncResponsePayload {
  questionnaireId: string;
  projectId?: string;
  enumeratorId?: string;
  enumeratorName?: string;
  respondentId?: string;
  answers: Record<string, any>;
  gps?: { latitude: number; longitude: number; accuracy?: number };
  batteryLevel?: number;
  collectedAt: string;
}

/**
 * Saves response locally in rdip_collected_responses database table cache
 */
export function saveResponseToLocalDb(payload: SyncResponsePayload & { id?: string; syncStatus?: 'synced' | 'pending' }) {
  try {
    const existingStr = localStorage.getItem('rdip_collected_responses');
    const existing: any[] = existingStr ? JSON.parse(existingStr) : [];
    const newRecord = {
      id: payload.id || `RESP-${Date.now().toString().slice(-6)}`,
      questionnaireId: payload.questionnaireId || 'QNR-2024-001',
      projectId: payload.projectId || 'PRJ-001',
      respondentId: payload.respondentId || `RESP-${Math.floor(1000 + Math.random() * 9000)}`,
      enumeratorId: payload.enumeratorId || 'usr-enum-01',
      enumeratorName: payload.enumeratorName || 'Field Enumerator',
      collectedOffline: true,
      syncStatus: payload.syncStatus || 'pending',
      gpsCoordinates: payload.gps,
      batteryLevel: payload.batteryLevel ?? 95,
      collectedAt: payload.collectedAt || new Date().toISOString(),
      answers: payload.answers
    };
    
    // Prepend new response
    const updated = [newRecord, ...existing.filter(r => r.id !== newRecord.id)];
    localStorage.setItem('rdip_collected_responses', JSON.stringify(updated));

    // Update live enumerator telemetry if GPS is available
    if (payload.gps && (payload.enumeratorId || payload.enumeratorName)) {
      const enumId = payload.enumeratorId || payload.enumeratorName || 'EN-1048';
      updateEnumeratorTelemetry(enumId, {
        latitude: payload.gps.latitude,
        longitude: payload.gps.longitude,
        accuracy: payload.gps.accuracy || 4.2,
        timestamp: payload.collectedAt || new Date().toISOString(),
        address: `Live Geostamped Response #${newRecord.id}`
      }, {
        status: payload.syncStatus === 'synced' ? 'Synced' : 'Pending',
        batteryLevel: payload.batteryLevel ?? 90,
        responsesDelta: 1,
        unsyncedDelta: payload.syncStatus === 'pending' ? 1 : 0
      });
    }

    return newRecord;
  } catch (err) {
    console.error('Error saving local response:', err);
    return null;
  }
}

/**
 * Retrieves all stored survey responses from local database cache
 */
export function getStoredResponses(): any[] {
  try {
    const saved = localStorage.getItem('rdip_collected_responses');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

/**
 * Pushes a single or batch of survey responses directly to Supabase PostgreSQL table 'responses' & 'response_answers'
 */
export async function pushResponseToSupabase(payload: SyncResponsePayload) {
  try {
    // 1. Save to local repository first
    saveResponseToLocalDb({ ...payload, syncStatus: 'synced' });

    // 2. Insert primary response record to Supabase
    const { data: responseData, error: respError } = await supabase
      .from('responses')
      .insert({
        questionnaire_id: payload.questionnaireId,
        enumerator_id: payload.enumeratorId || null,
        collected_offline: true,
        sync_status: 'synced',
        gps_coordinates: payload.gps || null,
        collected_at: payload.collectedAt,
        synced_at: new Date().toISOString()
      })
      .select()
      .single();

    if (respError) {
      console.warn('Supabase responses table insert note (tables may need DDL execution in Supabase SQL Editor):', respError.message);
      return { success: false, error: respError.message, localStored: true };
    }

    // 3. Insert answer breakdown if questions are provided
    if (responseData && payload.answers) {
      const answerRows = Object.entries(payload.answers).map(([key, val]) => ({
        response_id: responseData.id,
        answer_value: { [key]: val }
      }));

      await supabase.from('response_answers').insert(answerRows);
    }

    return { success: true, id: responseData?.id };
  } catch (err: any) {
    return { success: false, error: err?.message, localStored: true };
  }
}

/**
 * Checks if the required tables exist in the connected Supabase instance
 */
export async function verifySupabaseTablesExist(): Promise<{
  tablesExist: boolean;
  tableStatus: Record<string, boolean>;
  message: string;
}> {
  const tables = ['projects', 'questionnaires', 'questions', 'responses', 'response_answers', 'audit_logs', 'project_enumerators'];
  const tableStatus: Record<string, boolean> = {};
  let anyExist = false;

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
      if (!error) {
        tableStatus[table] = true;
        anyExist = true;
      } else if (error.code === '42P01') {
        // PostgreSQL error 42P01: relation (table) does not exist
        tableStatus[table] = false;
      } else {
        // RLS or permission issue, table exists
        tableStatus[table] = true;
        anyExist = true;
      }
    } catch {
      tableStatus[table] = false;
    }
  }

  return {
    tablesExist: anyExist,
    tableStatus,
    message: anyExist
      ? 'Tables detected in Supabase database instance.'
      : 'Tables have not been created yet in the Supabase SQL editor. Run the provided DDL script to create them.'
  };
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  type: 'background_auto' | 'manual_sync' | 'instant_submit' | 'network_check' | 'schema_pull';
  status: 'success' | 'failed' | 'queued_offline' | 'no_records';
  recordsAttempted: number;
  recordsSynced: number;
  networkState: 'online' | 'offline';
  durationMs: number;
  summary: string;
  details?: string;
  endpoint?: string;
  error?: string;
}

const DEFAULT_SYNC_LOGS: SyncLogEntry[] = [
  {
    id: 'LOG-INIT-003',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    type: 'background_auto',
    status: 'success',
    recordsAttempted: 2,
    recordsSynced: 2,
    networkState: 'online',
    durationMs: 340,
    summary: 'Background heartbeat synchronized 2 field records',
    details: 'Pushed batch records #REC-4417, #REC-4418 to remote PostgreSQL cluster.',
    endpoint: 'Supabase / responses & response_answers'
  },
  {
    id: 'LOG-INIT-002',
    timestamp: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
    type: 'instant_submit',
    status: 'queued_offline',
    recordsAttempted: 1,
    recordsSynced: 0,
    networkState: 'offline',
    durationMs: 42,
    summary: 'Offline buffer ingested response #REC-4419',
    details: 'Network connectivity offline. Stored safely in local persistent SQLite/IndexedDB queue.',
    endpoint: 'Local Browser Cache (IndexedDB)'
  },
  {
    id: 'LOG-INIT-001',
    timestamp: new Date(Date.now() - 1000 * 60 * 65).toISOString(),
    type: 'schema_pull',
    status: 'success',
    recordsAttempted: 0,
    recordsSynced: 0,
    networkState: 'online',
    durationMs: 185,
    summary: 'Questionnaire schema synchronized (v2.4.0)',
    details: 'Verified survey definition hash with Researcher Hub. 8 active survey variables ready for data collection.',
    endpoint: 'Supabase / questionnaires'
  }
];

export function getStoredSyncLogs(): SyncLogEntry[] {
  try {
    const raw = localStorage.getItem('rdip_sync_history_logs');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    // Return defaults if none saved
    localStorage.setItem('rdip_sync_history_logs', JSON.stringify(DEFAULT_SYNC_LOGS));
    return DEFAULT_SYNC_LOGS;
  } catch {
    return DEFAULT_SYNC_LOGS;
  }
}

export function saveSyncLog(
  log: Omit<SyncLogEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): SyncLogEntry {
  try {
    const existing = getStoredSyncLogs();
    const newEntry: SyncLogEntry = {
      id: log.id || `LOG-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: log.timestamp || new Date().toISOString(),
      type: log.type,
      status: log.status,
      recordsAttempted: log.recordsAttempted ?? 0,
      recordsSynced: log.recordsSynced ?? 0,
      networkState: log.networkState || 'offline',
      durationMs: log.durationMs ?? 0,
      summary: log.summary,
      details: log.details,
      endpoint: log.endpoint || 'Supabase PostgreSQL / responses',
      error: log.error
    };

    const updated = [newEntry, ...existing].slice(0, 100); // keep last 100 logs
    localStorage.setItem('rdip_sync_history_logs', JSON.stringify(updated));

    try {
      window.dispatchEvent(new CustomEvent('rdip_sync_log_added', { detail: newEntry }));
    } catch {}

    return newEntry;
  } catch (e) {
    console.error('Failed to save sync log:', e);
    return {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...log
    };
  }
}

export function clearStoredSyncLogs(): void {
  try {
    localStorage.setItem('rdip_sync_history_logs', JSON.stringify([]));
    try {
      window.dispatchEvent(new CustomEvent('rdip_sync_log_cleared'));
    } catch {}
  } catch {}
}

