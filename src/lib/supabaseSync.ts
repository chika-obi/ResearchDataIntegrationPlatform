import { supabase } from './supabase';

export interface SyncResponsePayload {
  questionnaireId: string;
  enumeratorId?: string;
  answers: Record<string, any>;
  gps?: { latitude: number; longitude: number; accuracy?: number };
  batteryLevel?: number;
  collectedAt: string;
}

/**
 * Pushes a single or batch of survey responses directly to Supabase PostgreSQL table 'responses' & 'response_answers'
 */
export async function pushResponseToSupabase(payload: SyncResponsePayload) {
  try {
    // 1. Insert primary response record
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

    // 2. Insert answer breakdown if questions are provided
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
