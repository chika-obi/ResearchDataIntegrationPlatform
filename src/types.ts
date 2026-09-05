export type NavSection =
  | 'dashboard'
  | 'projects'
  | 'questionnaires'
  | 'dictionary'
  | 'offline-collector'
  | 'enumerators'
  | 'data-quality'
  | 'statistical-analysis'
  | 'visualizations'
  | 'reports'
  | 'audit-security'
  | 'settings'
  | 'auth'
  | 'public-survey';

export type UserRole = 'researcher' | 'enumerator' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  institution: string;
  department: string;
  role: UserRole;
  avatar: string;
  timezone: string;
  version: string;
}

export type ProjectStatus = 'Design' | 'Active' | 'Collection' | 'Analysis' | 'Complete';

export interface Project {
  id: string;
  code: string;
  title: string;
  institution: string;
  status: ProjectStatus;
  progress: number;
  enumeratorsCount: number;
  responsesCount: number;
  startDate: string;
  endDate: string;
  description: string;
  qualityScore: number;
  notes?: string;
  ownerId?: string;
  researchObjectives?: string[];
  category?: string;
  leadInvestigator?: string;
}

export type QuestionType =
  | 'multiple-choice'
  | 'checkboxes'
  | 'short-text'
  | 'paragraph'
  | 'likert'
  | 'matrix'
  | 'dropdown'
  | 'date-time'
  | 'number'
  | 'geolocation'
  | 'gps-coordinate';

export interface QuestionGpsConfig {
  accuracyThresholdMeters?: number; // e.g. 5, 10, 15, 25
  requireAltitude?: boolean;
  allowManualEntry?: boolean;
  captureMode?: 'point' | 'facility' | 'boundary';
}

export interface QuestionGpsValue {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
  timestamp?: string | null;
}

export type DataType = 'Categorical' | 'Numerical' | 'Ordinal' | 'Continuous';
export type MeasurementLevel = 'Nominal' | 'Ordinal' | 'Interval' | 'Ratio';

export type LogicOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty';

export type LogicAction = 'show' | 'hide' | 'skip_to' | 'require' | 'end_survey';

export interface LogicClause {
  id: string;
  sourceVariable: string;
  operator: LogicOperator;
  value: any;
}

export interface LogicBranch {
  id: string;
  branchType: 'IF' | 'ELIF' | 'ELSE';
  clauses: LogicClause[];
  matchType?: 'ALL' | 'ANY';
  action: LogicAction;
  targetQuestionId?: string;
  customNote?: string;
}

export interface QuestionLogicRule {
  enabled: boolean;
  branches: LogicBranch[];
}

export interface QuestionOption {
  id: string;
  label: string;
  numericCode?: number;
}

export interface Question {
  id: string;
  number: string;
  section?: string;
  title: string;
  helpText?: string;
  variableName: string;
  variableLabel?: string;
  type: QuestionType;
  options?: QuestionOption[];
  required: boolean;
  hasOtherOption?: boolean;
  likertScale?: number; // e.g. 5 or 7
  linkedObjective?: string;
  dataTypeConstraint?: string;
  dataType?: DataType;
  measurementLevel?: MeasurementLevel;
  logicRule?: QuestionLogicRule;
  validationRules?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  gpsConfig?: QuestionGpsConfig;
}

export interface LogicDefinitionItem {
  questionId: string;
  questionNumber?: string;
  variableName: string;
  questionTitle?: string;
  logicRule: QuestionLogicRule;
}

export interface SurveyLogicFlowExport {
  schemaType: 'rdip_questionnaire_logic_flow';
  formatVersion: '1.0';
  exportDate: string;
  surveyTitle?: string;
  surveyVersion?: string;
  description?: string;
  rulesCount: number;
  logicDefinitions: LogicDefinitionItem[];
}

export interface LogicImportResult {
  success: boolean;
  matchedCount: number;
  unmatchedVariables: string[];
  totalImportedRules: number;
  warnings?: string[];
  error?: string;
}

export interface VariableDictionaryItem {
  id: string;
  variableName: string;
  label: string;
  dataType: DataType;
  measurementLevel: MeasurementLevel;
  valueLabels: { code: string | number; label: string }[];
  linkedObjective: string;
  missingValueCode: string;
  questionId: string;
}

export interface EnumeratorLocationRecord {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number; // km/h
  heading?: number; // degrees
  timestamp: string;
  address?: string;
  lga?: string;
  state?: string;
  isSimulated?: boolean;
}

export interface Enumerator {
  id: string;
  name: string;
  region: string;
  responses: number;
  status: 'Synced' | 'Pending' | 'Error';
  unsyncedCount: number;
  lastSync: string;
  signalStrength: 'Good' | 'Moderate' | 'Poor';
  batteryLevel: number;
  phone: string;
  assignedProjectIds?: string[];
  completionRate?: number;
  coordinates?: EnumeratorLocationRecord;
  locationHistory?: EnumeratorLocationRecord[];
}

export interface QualityIssue {
  id: string;
  recordId: string;
  issueType: 'Incomplete Response' | 'Outlier Detected' | 'Conflicting Answers' | 'Duplicate Submission';
  countFound?: number;
  severity: 'high' | 'medium' | 'low';
  details: string;
  status: 'pending' | 'reviewed' | 'excluded' | 'kept';
  timestamp?: string;
  variableAffected?: string;
}

export interface OfflineResponse {
  id: string;
  questionnaireId: string;
  projectId: string;
  respondentId: string;
  enumeratorId: string;
  enumeratorName: string;
  collectedOffline: boolean;
  syncStatus: 'synced' | 'pending' | 'conflict';
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  collectedAt: string;
  syncedAt?: string;
  answers: Record<string, any>;
}

export interface StatisticalRecommendation {
  id: string;
  title: string;
  type: 'Parametric' | 'Non-Parametric' | 'Multivariate' | 'Correlation' | 'Regression';
  confidence: number;
  reason: string;
  variables: string[];
  expectedOutput: string;
  objectiveMatch?: string;
  testCode: 'chi-square' | 't-test' | 'anova' | 'correlation' | 'linear-regression' | 'logistic-regression' | 'mann-whitney';
}

export interface StatisticalAnalysisResult {
  id: string;
  objective: string;
  testType: string;
  independentVars: string[];
  dependentVar: string;
  statisticName: string;
  statisticValue: number;
  degreesOfFreedom: number | string;
  pValue: number;
  effectSizeName: string;
  effectSizeValue: number;
  assumptions: {
    normality: boolean;
    homogeneity: boolean;
    independence: boolean;
  };
  interpretation: string;
  apaFormattedTable: string;
  sampleSize: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userName: string;
  userRole: UserRole;
  action: 'created' | 'updated' | 'deleted' | 'synced' | 'analyzed' | 'validated';
  entity: string;
  details: string;
  ipAddress?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: 'Admin' | 'Editor' | 'Viewer';
  status: 'Active' | 'Pending';
  avatarBg: string;
}

export interface SchemaVersion {
  version: string;
  isCurrent?: boolean;
  deployedDate: string;
  author: string;
  summary: string;
}

export interface ApiKey {
  id: string;
  name: string;
  status: 'Active' | 'Revoked';
  createdDate: string;
  lastUsed: string;
  keyMask: string;
}

// ==============================================================================
// RELATIONAL DATABASE & SUPABASE POSTGRESQL SCHEMAS
// ==============================================================================

export type PlatformRole =
  | 'super_admin'
  | 'researcher'
  | 'research_assistant'
  | 'enumerator'
  | 'data_manager'
  | 'analyst'
  | 'respondent';

export type UserAccountStatus = 'active' | 'suspended' | 'pending_verification' | 'inactive';

export interface DbProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  institution?: string | null;
  department?: string | null;
  role: PlatformRole;
  status: UserAccountStatus;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export type DbProjectStatus = 'draft' | 'active' | 'collection' | 'analysis' | 'completed' | 'archived';

export interface DbProject {
  id: string;
  owner_id: string;
  project_code: string;
  title: string;
  description?: string | null;
  research_topic?: string | null;
  research_design?: string | null;
  institution?: string | null;
  status: DbProjectStatus;
  progress: number;
  quality_score: number;
  research_objectives?: string[];
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export type ProjectMemberRole =
  | 'owner'
  | 'co_investigator'
  | 'research_assistant'
  | 'data_manager'
  | 'analyst'
  | 'field_supervisor'
  | 'viewer';

export interface DbProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
  permissions: {
    can_edit?: boolean;
    can_analyze?: boolean;
    can_export?: boolean;
    can_manage_enumerators?: boolean;
  };
  status: string;
  invited_by?: string | null;
  created_at?: string;
  updated_at?: string;
  profile?: DbProfile;
}

export type QuestionnaireStatus = 'draft' | 'testing' | 'published' | 'closed' | 'archived';

export interface DbQuestionnaire {
  id: string;
  project_id: string;
  created_by: string;
  name: string;
  description?: string | null;
  status: QuestionnaireStatus;
  current_version_id?: string | null;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  current_version?: DbQuestionnaireVersion;
}

export type VersionStatus = 'draft' | 'published' | 'deprecated' | 'archived';

export interface DbQuestionnaireVersion {
  id: string;
  questionnaire_id: string;
  version_number: string;
  status: VersionStatus;
  title: string;
  description?: string | null;
  schema_definition?: Record<string, any>;
  published_by?: string | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  questions?: DbQuestion[];
}

export interface DbQuestion {
  id: string;
  questionnaire_version_id: string;
  question_number: string;
  section?: string | null;
  question_text: string;
  help_text?: string | null;
  variable_name: string;
  variable_label?: string | null;
  question_type: QuestionType;
  data_type: 'Categorical' | 'Numerical' | 'Ordinal' | 'Continuous';
  measurement_level: 'Nominal' | 'Ordinal' | 'Interval' | 'Ratio';
  required: boolean;
  has_other_option?: boolean;
  likert_scale?: number | null;
  linked_research_objective?: string | null;
  validation_rules?: Record<string, any>;
  conditional_logic?: Record<string, any>;
  gps_config?: QuestionGpsConfig;
  display_order: number;
  options?: DbQuestionOption[];
  created_at?: string;
  updated_at?: string;
}

export interface DbQuestionOption {
  id: string;
  question_id: string;
  option_label: string;
  option_value: string;
  numeric_code?: number | null;
  display_order: number;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface DbVariable {
  id: string;
  project_id: string;
  questionnaire_id?: string | null;
  question_id?: string | null;
  variable_name: string;
  variable_label: string;
  data_type: 'Categorical' | 'Numerical' | 'Ordinal' | 'Continuous';
  measurement_level: 'Nominal' | 'Ordinal' | 'Interval' | 'Ratio';
  possible_values?: string[];
  codes?: Array<{ code: number | string; label: string }>;
  missing_value_rules?: Record<string, any>;
  research_objective?: string | null;
  hypothesis_relationship?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type AssignmentStatus = 'active' | 'paused' | 'revoked' | 'completed';

export interface DbQuestionnaireAssignment {
  id: string;
  questionnaire_id: string;
  questionnaire_version_id?: string | null;
  enumerator_id: string;
  assigned_by: string;
  status: AssignmentStatus;
  start_date?: string | null;
  end_date?: string | null;
  permissions?: {
    can_collect?: boolean;
    can_view_history?: boolean;
    can_edit_drafts?: boolean;
  };
  created_at?: string;
  updated_at?: string;
  questionnaire?: DbQuestionnaire;
  enumerator?: DbProfile;
}

export type ResponseSyncStatus =
  | 'draft'
  | 'submitted'
  | 'pending_sync'
  | 'synced'
  | 'conflict'
  | 'rejected'
  | 'locked';

export interface DbResponse {
  id: string;
  project_id: string;
  questionnaire_id: string;
  questionnaire_version_id: string;
  enumerator_id?: string | null;
  respondent_id: string;
  collection_status: ResponseSyncStatus;
  collected_offline: boolean;
  gps_coordinates?: QuestionGpsValue | null;
  telemetry?: Record<string, any>;
  started_at?: string | null;
  completed_at?: string | null;
  submitted_at: string;
  synced_at?: string | null;
  created_at?: string;
  updated_at?: string;
  answers?: DbResponseAnswer[];
}

export interface DbResponseAnswer {
  id: string;
  response_id: string;
  question_id?: string | null;
  variable_name: string;
  answer_value: any;
  text_value?: string | null;
  numeric_value?: number | null;
  boolean_value?: boolean | null;
  date_value?: string | null;
  gps_value?: QuestionGpsValue | null;
  created_at?: string;
}

export interface DbDataQualityIssue {
  id: string;
  project_id: string;
  response_id?: string | null;
  variable_name?: string | null;
  issue_type: 'incomplete_response' | 'outlier' | 'conflicting_answers' | 'duplicate_submission' | 'validation_error' | 'gps_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'ignored';
  flag_metadata?: Record<string, any>;
  detected_at: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
}

export interface DbStatisticalAnalysis {
  id: string;
  project_id: string;
  title: string;
  analysis_type: string;
  statistical_test: string;
  variables_used: string[];
  parameters?: Record<string, any>;
  results: Record<string, any>;
  p_value?: number | null;
  confidence_interval?: Record<string, any> | null;
  effect_size?: Record<string, any> | null;
  assumptions?: Record<string, any> | null;
  interpretation?: string | null;
  executed_by?: string | null;
  executed_at: string;
  created_at?: string;
}

export interface DbAuditLog {
  id: string;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details: Record<string, any>;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

