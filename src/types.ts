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
  ownerId?: string;
  researchObjectives?: string[];
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
  | 'number';

export type DataType = 'Categorical' | 'Numerical' | 'Ordinal' | 'Continuous';
export type MeasurementLevel = 'Nominal' | 'Ordinal' | 'Interval' | 'Ratio';

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
  validationRules?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
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
