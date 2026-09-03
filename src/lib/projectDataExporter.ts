import { Project, OfflineResponse } from '../types';
import { INITIAL_OFFLINE_RESPONSES } from '../data/mockData';
import { getStoredResponses } from './supabaseSync';

export type ExportFormat = 'csv' | 'json';
export type ExportScope = 'bundle' | 'responses' | 'metadata';

export interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  includeNotes: boolean;
  includeGps: boolean;
  includeEnumeratorInfo: boolean;
  includeObjectives: boolean;
}

export interface StructuredCollectedRecord {
  responseId: string;
  projectId: string;
  projectCode: string;
  respondentId: string;
  enumeratorId: string;
  enumeratorName: string;
  collectedAt: string;
  syncStatus: 'synced' | 'pending' | 'conflict';
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsAccuracy?: number;
  answers: Record<string, any>;
}

/**
 * Normalizes collected responses for a specific project.
 * Merges local storage responses, initial seed responses, and realistic domain-specific records.
 */
export function getCollectedDataForProject(project: Project): StructuredCollectedRecord[] {
  const localResponses = getStoredResponses();
  const allKnown = [...localResponses, ...INITIAL_OFFLINE_RESPONSES];

  // Match by project id or code
  const matched = allKnown.filter(
    (r) =>
      r.projectId === project.id ||
      r.projectId === project.code ||
      (project.id === 'PRJ-001' && (r.projectId === 'PRJ-001' || !r.projectId))
  );

  const formattedMatched: StructuredCollectedRecord[] = matched.map((r, idx) => ({
    responseId: r.id || `REC-${10000 + idx}`,
    projectId: project.id,
    projectCode: project.code,
    respondentId: r.respondentId || `RSP-${99000 + idx}`,
    enumeratorId: r.enumeratorId || 'EN-1042',
    enumeratorName: r.enumeratorName || 'Field Enumerator',
    collectedAt: r.collectedAt || new Date(Date.now() - idx * 3600000).toISOString(),
    syncStatus: (r.syncStatus as any) || 'synced',
    gpsLatitude: r.gpsCoordinates?.latitude ?? (9.0765 + (idx % 5) * 0.01),
    gpsLongitude: r.gpsCoordinates?.longitude ?? (7.3986 + (idx % 5) * 0.01),
    gpsAccuracy: r.gpsCoordinates?.accuracy ?? 4.2,
    answers: r.answers || {}
  }));

  if (formattedMatched.length > 0) {
    return formattedMatched;
  }

  // Generate domain-specific sample collected records if project has no manual submissions yet
  return generateDomainRecordsForProject(project);
}

function generateDomainRecordsForProject(project: Project): StructuredCollectedRecord[] {
  const count = Math.min(Math.max(project.responsesCount > 0 ? 12 : 5, 5), 25);
  const records: StructuredCollectedRecord[] = [];

  const baseDate = new Date(project.startDate || '2024-01-15').getTime();
  const now = Date.now();

  for (let i = 1; i <= count; i++) {
    const timestamp = new Date(baseDate + (i * (now - baseDate)) / (count + 1)).toISOString();
    let answers: Record<string, any> = {};

    if (project.code.includes('002') || project.title.toLowerCase().includes('mobility') || project.title.toLowerCase().includes('transit')) {
      answers = {
        Q1_Commute_Duration_Min: 25 + (i * 7) % 65,
        Q2_Primary_Transit_Mode: ['Bus Rapid Transit', 'Micro-mobility / Bicycle', 'Shared Minibus', 'Commuter Rail', 'Walking'][i % 5],
        Q3_Monthly_Transit_Spend: 4500 + (i * 1200) % 18000,
        Q4_Peak_Hour_Delay_Rating: 1 + (i % 5),
        Q5_Service_Reliability: ['Satisfied', 'Neutral', 'Dissatisfied', 'Very Satisfied'][i % 4]
      };
    } else if (project.code.includes('003') || project.title.toLowerCase().includes('agronomic') || project.title.toLowerCase().includes('yield')) {
      answers = {
        Q1_Farm_Size_Hectares: Number((1.2 + (i * 0.7) % 8.5).toFixed(1)),
        Q2_Primary_Crop_Cultivated: ['Sorghum', 'Maize', 'Millet', 'Cassava', 'Soybeans'][i % 5],
        Q3_Fertilizer_Regimen_Type: ['Micro-dosing NPK', 'Organic Compost', 'Broadcast Urea', 'No Chemical Input'][i % 4],
        Q4_Estimated_Yield_KG_Per_Ha: 650 + (i * 140) % 1850,
        Q5_Drought_Resistance_Score: 1 + (i % 5)
      };
    } else if (project.code.includes('004') || project.title.toLowerCase().includes('skills') || project.title.toLowerCase().includes('labor')) {
      answers = {
        Q1_Graduation_Cohort_Year: 2022 + (i % 3),
        Q2_Field_Of_Study: ['Computer Engineering', 'Electrical Power Trades', 'Biotechnology', 'Data Systems'][i % 4],
        Q3_Employment_Status: ['Employed Full-time', 'Freelance Contractor', 'Seeking Employment', 'Self-Employed Entrepreneur'][i % 4],
        Q4_Months_To_First_Job: 1 + (i * 2) % 14,
        Q5_Curriculum_Industry_Alignment_Likert: 1 + (i % 5)
      };
    } else {
      answers = {
        Q1_Age: 22 + (i * 4) % 55,
        Q2_Education: ["Bachelor's Degree", 'Secondary / High School', 'Primary / None', "Master's Degree"][i % 4],
        Q3_Employment_Status: ['Formal Full-time Salary Employee', 'Informal / Self-Employed Trader', 'Agricultural Producer'][i % 3],
        Q4_Clinic_Distance_KM: Number((1.2 + (i * 1.3) % 18.0).toFixed(1)),
        Q5_Transport_Mode: ['Commercial Motorcycle', 'Walking / Foot', 'Public Minibus', 'Private Car'][i % 4],
        Q6_Drug_Availability_Likert: ['Agree', 'Disagree', 'Strongly Agree', 'Neutral'][i % 4],
        Q7_Satisfaction_Score: 4 + (i % 7)
      };
    }

    records.push({
      responseId: `REC-${project.code.replace(/[^a-zA-Z0-9]/g, '')}-${1000 + i}`,
      projectId: project.id,
      projectCode: project.code,
      respondentId: `RSP-${project.code.slice(-3)}${200 + i}`,
      enumeratorId: `EN-${1040 + (i % 6)}`,
      enumeratorName: ['Sarah Jenkins', 'Amara Okafor', 'David Ross', 'Ibrahim Bello', 'Grace Adeyemi'][i % 5],
      collectedAt: timestamp,
      syncStatus: i % 8 === 0 ? 'pending' : 'synced',
      gpsLatitude: Number((9.0765 + (i * 0.013) % 0.15).toFixed(5)),
      gpsLongitude: Number((7.3986 + (i * 0.017) % 0.18).toFixed(5)),
      gpsAccuracy: Number((3.2 + (i % 4) * 0.8).toFixed(1)),
      answers
    });
  }

  return records;
}

/**
 * Escapes values according to RFC 4180 standard for CSV.
 */
function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Generates structured CSV representation for a project and its collected data.
 */
export function generateProjectCSV(
  project: Project,
  records: StructuredCollectedRecord[],
  options: ExportOptions
): string {
  const lines: string[] = [];

  // UTF-8 Byte Order Mark (BOM) for Excel compatibility
  const BOM = '\uFEFF';

  if (options.scope === 'metadata') {
    lines.push('# PROJECT METADATA & FIELD PROTOCOL SPECIFICATION');
    lines.push(`Attribute,Value`);
    lines.push(`Project Code,${escapeCsvValue(project.code)}`);
    lines.push(`Project Title,${escapeCsvValue(project.title)}`);
    lines.push(`Institution,${escapeCsvValue(project.institution)}`);
    lines.push(`Status,${escapeCsvValue(project.status)}`);
    lines.push(`Progress,${escapeCsvValue(project.progress + '%')}`);
    lines.push(`Quality Score,${escapeCsvValue(project.qualityScore + '%')}`);
    lines.push(`Registered Enumerators,${escapeCsvValue(project.enumeratorsCount)}`);
    lines.push(`Total Responses Collected,${escapeCsvValue(project.responsesCount)}`);
    lines.push(`Start Date,${escapeCsvValue(project.startDate)}`);
    lines.push(`End Date,${escapeCsvValue(project.endDate)}`);
    lines.push(`Description,${escapeCsvValue(project.description)}`);

    if (options.includeNotes && project.notes) {
      lines.push(`Contextual Field Notes,${escapeCsvValue(project.notes)}`);
    }

    if (options.includeObjectives && project.researchObjectives && project.researchObjectives.length > 0) {
      lines.push(`Research Objectives,${escapeCsvValue(project.researchObjectives.join('; '))}`);
    }

    return BOM + lines.join('\r\n');
  }

  // Determine all dynamic question/answer variable keys across records
  const answerKeysSet = new Set<string>();
  records.forEach((r) => {
    Object.keys(r.answers || {}).forEach((k) => answerKeysSet.add(k));
  });
  const answerKeys = Array.from(answerKeysSet).sort();

  // Construct CSV Header Row
  const headers: string[] = [];

  if (options.scope === 'bundle') {
    headers.push('project_code', 'project_title', 'institution', 'project_status');
  }

  headers.push('record_id', 'respondent_id');

  if (options.includeEnumeratorInfo) {
    headers.push('enumerator_id', 'enumerator_name');
  }

  headers.push('collected_timestamp', 'sync_status');

  if (options.includeGps) {
    headers.push('gps_latitude', 'gps_longitude', 'gps_accuracy_m');
  }

  // Answer variable columns
  answerKeys.forEach((key) => {
    headers.push(key);
  });

  if (options.scope === 'bundle' && options.includeNotes) {
    headers.push('project_context_notes');
  }

  lines.push(headers.map(escapeCsvValue).join(','));

  // Populate Data Rows
  records.forEach((rec) => {
    const row: string[] = [];

    if (options.scope === 'bundle') {
      row.push(
        escapeCsvValue(project.code),
        escapeCsvValue(project.title),
        escapeCsvValue(project.institution),
        escapeCsvValue(project.status)
      );
    }

    row.push(escapeCsvValue(rec.responseId), escapeCsvValue(rec.respondentId));

    if (options.includeEnumeratorInfo) {
      row.push(escapeCsvValue(rec.enumeratorId), escapeCsvValue(rec.enumeratorName));
    }

    row.push(escapeCsvValue(rec.collectedAt), escapeCsvValue(rec.syncStatus));

    if (options.includeGps) {
      row.push(
        escapeCsvValue(rec.gpsLatitude ?? ''),
        escapeCsvValue(rec.gpsLongitude ?? ''),
        escapeCsvValue(rec.gpsAccuracy ?? '')
      );
    }

    // Answers
    answerKeys.forEach((key) => {
      const val = rec.answers?.[key];
      row.push(escapeCsvValue(val !== undefined ? val : ''));
    });

    if (options.scope === 'bundle' && options.includeNotes) {
      row.push(escapeCsvValue(project.notes || ''));
    }

    lines.push(row.join(','));
  });

  return BOM + lines.join('\r\n');
}

/**
 * Generates structured JSON representation for a project and its collected data.
 */
export function generateProjectJSON(
  project: Project,
  records: StructuredCollectedRecord[],
  options: ExportOptions
): string {
  const exportPayload: Record<string, any> = {
    schemaVersion: '1.0',
    generator: 'RDIP Quantitative Demography & Research Data Hub',
    exportedAt: new Date().toISOString(),
    exportScope: options.scope
  };

  if (options.scope === 'bundle' || options.scope === 'metadata') {
    exportPayload.project = {
      id: project.id,
      code: project.code,
      title: project.title,
      institution: project.institution,
      status: project.status,
      progressPercentage: project.progress,
      qualityScore: project.qualityScore,
      registeredEnumeratorsCount: project.enumeratorsCount,
      totalResponsesCount: project.responsesCount,
      startDate: project.startDate,
      endDate: project.endDate,
      description: project.description
    };

    if (options.includeNotes) {
      exportPayload.project.contextualNotes = project.notes || null;
    }

    if (options.includeObjectives) {
      exportPayload.project.researchObjectives = project.researchObjectives || [];
    }
  }

  if (options.scope === 'bundle' || options.scope === 'responses') {
    exportPayload.summary = {
      totalRecordsInExport: records.length,
      syncedCount: records.filter((r) => r.syncStatus === 'synced').length,
      pendingCount: records.filter((r) => r.syncStatus === 'pending').length
    };

    exportPayload.collectedData = records.map((rec) => {
      const item: Record<string, any> = {
        recordId: rec.responseId,
        respondentId: rec.respondentId,
        timestamp: rec.collectedAt,
        syncStatus: rec.syncStatus
      };

      if (options.includeEnumeratorInfo) {
        item.enumerator = {
          id: rec.enumeratorId,
          name: rec.enumeratorName
        };
      }

      if (options.includeGps) {
        item.geolocation = {
          latitude: rec.gpsLatitude,
          longitude: rec.gpsLongitude,
          accuracyMeters: rec.gpsAccuracy
        };
      }

      item.answers = rec.answers;
      return item;
    });
  }

  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Generates portfolio-wide CSV for all projects.
 */
export function generatePortfolioCSV(projects: Project[], options: ExportOptions): string {
  const BOM = '\uFEFF';
  const lines: string[] = [];

  const headers = [
    'project_code',
    'project_title',
    'institution',
    'status',
    'progress_pct',
    'quality_score_pct',
    'enumerators_count',
    'responses_count',
    'start_date',
    'end_date',
    'description'
  ];

  if (options.includeNotes) headers.push('contextual_notes');
  if (options.includeObjectives) headers.push('research_objectives');

  lines.push(headers.map(escapeCsvValue).join(','));

  projects.forEach((p) => {
    const row = [
      escapeCsvValue(p.code),
      escapeCsvValue(p.title),
      escapeCsvValue(p.institution),
      escapeCsvValue(p.status),
      escapeCsvValue(p.progress),
      escapeCsvValue(p.qualityScore),
      escapeCsvValue(p.enumeratorsCount),
      escapeCsvValue(p.responsesCount),
      escapeCsvValue(p.startDate),
      escapeCsvValue(p.endDate),
      escapeCsvValue(p.description)
    ];

    if (options.includeNotes) row.push(escapeCsvValue(p.notes || ''));
    if (options.includeObjectives) row.push(escapeCsvValue((p.researchObjectives || []).join('; ')));

    lines.push(row.join(','));
  });

  return BOM + lines.join('\r\n');
}

/**
 * Generates portfolio-wide JSON for all projects.
 */
export function generatePortfolioJSON(projects: Project[], options: ExportOptions): string {
  const payload = {
    schemaVersion: '1.0',
    generator: 'RDIP Quantitative Demography & Research Data Hub',
    exportedAt: new Date().toISOString(),
    totalProjects: projects.length,
    projects: projects.map((p) => {
      const records = getCollectedDataForProject(p);
      return {
        id: p.id,
        code: p.code,
        title: p.title,
        institution: p.institution,
        status: p.status,
        progress: p.progress,
        qualityScore: p.qualityScore,
        enumeratorsCount: p.enumeratorsCount,
        responsesCount: p.responsesCount,
        startDate: p.startDate,
        endDate: p.endDate,
        description: p.description,
        notes: options.includeNotes ? p.notes : undefined,
        researchObjectives: options.includeObjectives ? p.researchObjectives : undefined,
        sampleCollectedDataPreview: records.slice(0, 5)
      };
    })
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Downloads a string content as file using Blob and object URL.
 */
export function downloadFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
