import {
  Project,
  Enumerator,
  QualityIssue,
  TeamMember,
  SchemaVersion,
  ApiKey,
  Question,
  StatisticalRecommendation,
  UserProfile,
  VariableDictionaryItem,
  AuditLogEntry,
  OfflineResponse,
  StatisticalAnalysisResult
} from '../types';

export const INITIAL_USER: UserProfile = {
  id: 'usr-001',
  name: 'Dr. Aris Thorne',
  email: 'aris.thorne@rdip.edu',
  department: 'Quantitative Methods & Demography',
  institution: 'Global Demographics Institute',
  timezone: 'UTC -05:00 (Eastern Time)',
  role: 'researcher',
  version: 'v2.4.0',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
};

export const MOCK_USER_PROFILE: UserProfile = INITIAL_USER;

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'PRJ-001',
    code: 'PRJ-2024-001',
    title: 'National Health Infrastructure Assessment 2024',
    institution: 'Ministry of Public Health & Global Health Initiative',
    status: 'Active',
    progress: 68,
    enumeratorsCount: 45,
    responsesCount: 12405,
    startDate: '2024-01-15',
    endDate: '2024-11-30',
    description: 'Comprehensive nationwide survey evaluating primary care clinic resource allocation, emergency medical readiness, and regional healthcare supply chains.',
    qualityScore: 94,
    researchObjectives: [
      'Objective 1: Assess emergency medical readiness and facility distribution',
      'Objective 2: Evaluate socio-demographic disparities in healthcare accessibility',
      'Objective 3: Determine supply chain resiliency and stockout frequencies',
      'Objective 4: Model predictors of maternal and infant primary care satisfaction'
    ]
  },
  {
    id: 'PRJ-002',
    code: 'PRJ-2024-002',
    title: 'Urban Mobility & Commuter Transit Equity Study',
    institution: 'Metropolitan Transit Authority & Urban Planning Dept',
    status: 'Collection',
    progress: 42,
    enumeratorsCount: 18,
    responsesCount: 4890,
    startDate: '2024-09-15',
    endDate: '2025-03-31',
    description: 'High-frequency multimodal transit usage assessment capturing commute delays, micro-mobility adoption, and peak-hour passenger distribution.',
    qualityScore: 88,
    researchObjectives: [
      'Objective 1: Map multimodal commuter delay times across municipal sectors',
      'Objective 2: Compare fare affordability indices by income brackets',
      'Objective 3: Quantify micro-mobility substitution effects on bus transit'
    ]
  },
  {
    id: 'PRJ-003',
    code: 'PRJ-2024-003',
    title: 'Smallholder Agronomic Yield Baseline Assessment',
    institution: 'Global Food Security Council',
    status: 'Active',
    progress: 89,
    enumeratorsCount: 85,
    responsesCount: 8920,
    startDate: '2024-02-01',
    endDate: '2024-12-10',
    description: 'Smallholder crop yield analysis across arid zones assessing drought-resistant grain varieties, fertilizer access, and irrigation efficiency.',
    qualityScore: 92,
    researchObjectives: [
      'Objective 1: Establish baseline grain yield per hectare across 5 agro-ecological zones',
      'Objective 2: Test efficacy of micro-dosing fertilizer regimens on sorghum output',
      'Objective 3: Model climate vulnerability and seasonal credit uptake'
    ]
  },
  {
    id: 'PRJ-004',
    code: 'PRJ-2024-004',
    title: 'Post-Secondary Technical Skills & Labor Alignment',
    institution: 'National Directorate of Employment & NSF',
    status: 'Design',
    progress: 15,
    enumeratorsCount: 8,
    responsesCount: 0,
    startDate: '2024-10-01',
    endDate: '2025-06-30',
    description: 'Longitudinal study analyzing graduate employment rates and STEM curriculum alignment with regional labor market demands.',
    qualityScore: 96,
    researchObjectives: [
      'Objective 1: Evaluate transition-to-employment duration for polytechnic graduates',
      'Objective 2: Identify industry skill gap mismatches in computational trades'
    ]
  }
];

export const INITIAL_QUESTIONS: Question[] = [
  {
    id: 'q1',
    number: 'Q1',
    section: 'Section A: Demographic Profile',
    title: 'What is your current age (in completed years)?',
    variableName: 'Q1_Age',
    variableLabel: 'Age of Respondent (Years)',
    type: 'number',
    required: true,
    options: [],
    linkedObjective: 'Objective 2: Evaluate socio-demographic disparities in healthcare accessibility',
    dataType: 'Numerical',
    measurementLevel: 'Ratio',
    dataTypeConstraint: 'Numeric (Continuous)',
    validationRules: { min: 18, max: 99 }
  },
  {
    id: 'q2',
    number: 'Q2',
    section: 'Section A: Demographic Profile',
    title: 'What is your highest completed educational attainment?',
    variableName: 'Q2_Education',
    variableLabel: 'Highest Educational Level Completed',
    type: 'multiple-choice',
    required: true,
    linkedObjective: 'Objective 2: Evaluate socio-demographic disparities in healthcare accessibility',
    dataType: 'Categorical',
    measurementLevel: 'Ordinal',
    dataTypeConstraint: 'Categorical (Ordinal)',
    options: [
      { id: 'opt-1', label: 'Primary Education or None', numericCode: 1 },
      { id: 'opt-2', label: 'Secondary / High School', numericCode: 2 },
      { id: 'opt-3', label: "Vocational / Associate's Degree", numericCode: 3 },
      { id: 'opt-4', label: "Bachelor's Degree", numericCode: 4 },
      { id: 'opt-5', label: "Postgraduate Degree (Master's / Ph.D.)", numericCode: 5 }
    ]
  },
  {
    id: 'q3',
    number: 'Q3',
    section: 'Section A: Demographic Profile',
    title: 'Primary employment status of the household head',
    variableName: 'Q3_Employment_Status',
    variableLabel: 'Employment Status of Household Head',
    type: 'multiple-choice',
    required: true,
    hasOtherOption: true,
    linkedObjective: 'Objective 2: Evaluate socio-demographic disparities in healthcare accessibility',
    dataType: 'Categorical',
    measurementLevel: 'Nominal',
    dataTypeConstraint: 'Categorical (Nominal)',
    options: [
      { id: 'emp-1', label: 'Formal Full-time Salary Employee', numericCode: 1 },
      { id: 'emp-2', label: 'Informal / Self-Employed Trader', numericCode: 2 },
      { id: 'emp-3', label: 'Agricultural Producer / Farmer', numericCode: 3 },
      { id: 'emp-4', label: 'Part-time / Seasonal Wage Earner', numericCode: 4 },
      { id: 'emp-5', label: 'Unemployed / Seeking Work', numericCode: 5 }
    ]
  },
  {
    id: 'q4',
    number: 'Q4',
    section: 'Section B: Healthcare Access & Readiness',
    title: 'Estimated distance (in km) to the nearest primary health center',
    variableName: 'Q4_Clinic_Distance_KM',
    variableLabel: 'Distance to Nearest Health Facility (km)',
    type: 'number',
    required: true,
    linkedObjective: 'Objective 1: Assess emergency medical readiness and facility distribution',
    dataType: 'Numerical',
    measurementLevel: 'Ratio',
    dataTypeConstraint: 'Numeric (Continuous)',
    validationRules: { min: 0, max: 150 }
  },
  {
    id: 'q5',
    number: 'Q5',
    section: 'Section B: Healthcare Access & Readiness',
    title: 'Primary mode of transportation utilized to reach emergency health facilities',
    variableName: 'Q5_Transport_Mode',
    variableLabel: 'Transport Mode for Emergency Trips',
    type: 'dropdown',
    required: true,
    linkedObjective: 'Objective 1: Assess emergency medical readiness and facility distribution',
    dataType: 'Categorical',
    measurementLevel: 'Nominal',
    dataTypeConstraint: 'Categorical (Nominal)',
    options: [
      { id: 'tr-1', label: 'Walking / Foot', numericCode: 1 },
      { id: 'tr-2', label: 'Bicycle / Micro-mobility', numericCode: 2 },
      { id: 'tr-3', label: 'Commercial Motorcycle / Tricycle', numericCode: 3 },
      { id: 'tr-4', label: 'Public Minibus / Bus', numericCode: 4 },
      { id: 'tr-5', label: 'Private Car / Ambulance', numericCode: 5 }
    ]
  },
  {
    id: 'q6',
    number: 'Q6',
    section: 'Section C: Service Quality & Likert Evaluation',
    title: 'Rate your level of agreement: "The local health clinic has adequate essential medications during emergencies."',
    variableName: 'Q6_Drug_Availability_Likert',
    variableLabel: 'Perceived Essential Drug Availability (5-pt Likert)',
    type: 'likert',
    likertScale: 5,
    required: true,
    linkedObjective: 'Objective 3: Determine supply chain resiliency and stockout frequencies',
    dataType: 'Ordinal',
    measurementLevel: 'Ordinal',
    dataTypeConstraint: 'Categorical (Ordinal)',
    options: [
      { id: 'l-1', label: 'Strongly Disagree', numericCode: 1 },
      { id: 'l-2', label: 'Disagree', numericCode: 2 },
      { id: 'l-3', label: 'Neutral / Undecided', numericCode: 3 },
      { id: 'l-4', label: 'Agree', numericCode: 4 },
      { id: 'l-5', label: 'Strongly Agree', numericCode: 5 }
    ]
  },
  {
    id: 'q7',
    number: 'Q7',
    section: 'Section C: Service Quality & Likert Evaluation',
    title: 'Rate your overall satisfaction score with clinical staff responsiveness (1 to 10 scale)',
    variableName: 'Q7_Satisfaction_Score',
    variableLabel: 'Overall Clinic Satisfaction Index (1-10)',
    type: 'number',
    required: true,
    linkedObjective: 'Objective 4: Model predictors of maternal and infant primary care satisfaction',
    dataType: 'Continuous',
    measurementLevel: 'Interval',
    dataTypeConstraint: 'Numeric (Continuous)',
    validationRules: { min: 1, max: 10 }
  },
  {
    id: 'q8',
    number: 'Q8',
    section: 'Section D: Qualitative Feedback',
    title: 'Provide specific observations regarding facility water, sanitation, and power reliability during night shifts.',
    variableName: 'Q8_WASH_Infrastructure_Notes',
    variableLabel: 'Facility WASH and Power Observations',
    type: 'paragraph',
    required: false,
    options: [],
    linkedObjective: 'Objective 1: Assess emergency medical readiness and facility distribution',
    dataType: 'Categorical',
    measurementLevel: 'Nominal'
  }
];

export const INITIAL_VARIABLE_DICTIONARY: VariableDictionaryItem[] = [
  {
    id: 'var-1',
    variableName: 'Q1_Age',
    label: 'Age of Respondent (Years)',
    dataType: 'Numerical',
    measurementLevel: 'Ratio',
    linkedObjective: 'Objective 2: Evaluate socio-demographic disparities in healthcare accessibility',
    missingValueCode: '-999',
    questionId: 'q1',
    valueLabels: []
  },
  {
    id: 'var-2',
    variableName: 'Q2_Education',
    label: 'Highest Educational Level Completed',
    dataType: 'Categorical',
    measurementLevel: 'Ordinal',
    linkedObjective: 'Objective 2: Evaluate socio-demographic disparities in healthcare accessibility',
    missingValueCode: '99',
    questionId: 'q2',
    valueLabels: [
      { code: 1, label: 'Primary or None' },
      { code: 2, label: 'Secondary School' },
      { code: 3, label: "Vocational / Associate's" },
      { code: 4, label: "Bachelor's Degree" },
      { code: 5, label: 'Postgraduate' }
    ]
  },
  {
    id: 'var-3',
    variableName: 'Q3_Employment_Status',
    label: 'Employment Status of Household Head',
    dataType: 'Categorical',
    measurementLevel: 'Nominal',
    linkedObjective: 'Objective 2: Evaluate socio-demographic disparities in healthcare accessibility',
    missingValueCode: '99',
    questionId: 'q3',
    valueLabels: [
      { code: 1, label: 'Formal Full-time Salary' },
      { code: 2, label: 'Informal Trader' },
      { code: 3, label: 'Agricultural Producer' },
      { code: 4, label: 'Part-time Wage Earner' },
      { code: 5, label: 'Unemployed' }
    ]
  },
  {
    id: 'var-4',
    variableName: 'Q4_Clinic_Distance_KM',
    label: 'Distance to Nearest Health Facility (km)',
    dataType: 'Numerical',
    measurementLevel: 'Ratio',
    linkedObjective: 'Objective 1: Assess emergency medical readiness and facility distribution',
    missingValueCode: '-999',
    questionId: 'q4',
    valueLabels: []
  },
  {
    id: 'var-5',
    variableName: 'Q5_Transport_Mode',
    label: 'Transport Mode for Emergency Trips',
    dataType: 'Categorical',
    measurementLevel: 'Nominal',
    linkedObjective: 'Objective 1: Assess emergency medical readiness and facility distribution',
    missingValueCode: '99',
    questionId: 'q5',
    valueLabels: [
      { code: 1, label: 'Walking' },
      { code: 2, label: 'Bicycle' },
      { code: 3, label: 'Motorcycle / Tricycle' },
      { code: 4, label: 'Public Bus' },
      { code: 5, label: 'Private Car / Ambulance' }
    ]
  },
  {
    id: 'var-6',
    variableName: 'Q6_Drug_Availability_Likert',
    label: 'Perceived Essential Drug Availability (5-pt Likert)',
    dataType: 'Ordinal',
    measurementLevel: 'Ordinal',
    linkedObjective: 'Objective 3: Determine supply chain resiliency and stockout frequencies',
    missingValueCode: '99',
    questionId: 'q6',
    valueLabels: [
      { code: 1, label: 'Strongly Disagree' },
      { code: 2, label: 'Disagree' },
      { code: 3, label: 'Neutral' },
      { code: 4, label: 'Agree' },
      { code: 5, label: 'Strongly Agree' }
    ]
  },
  {
    id: 'var-7',
    variableName: 'Q7_Satisfaction_Score',
    label: 'Overall Clinic Satisfaction Index (1-10)',
    dataType: 'Continuous',
    measurementLevel: 'Interval',
    linkedObjective: 'Objective 4: Model predictors of maternal and infant primary care satisfaction',
    missingValueCode: '-999',
    questionId: 'q7',
    valueLabels: []
  }
];

export const INITIAL_ENUMERATORS: Enumerator[] = [
  {
    id: 'EN-1042',
    name: 'Sarah Jenkins',
    region: 'North Central Region / Kaduna LGA',
    responses: 142,
    status: 'Synced',
    unsyncedCount: 0,
    lastSync: '10 mins ago',
    signalStrength: 'Good',
    batteryLevel: 94,
    phone: '+234 802 345 6789',
    completionRate: 98.4,
    assignedProjectIds: ['PRJ-001', 'PRJ-003']
  },
  {
    id: 'EN-1045',
    name: 'Marcus Webb',
    region: 'East District / Enugu North LGA',
    responses: 89,
    status: 'Pending',
    unsyncedCount: 34,
    lastSync: '2 hours ago',
    signalStrength: 'Poor',
    batteryLevel: 42,
    phone: '+234 803 456 7890',
    completionRate: 91.2,
    assignedProjectIds: ['PRJ-001']
  },
  {
    id: 'EN-1048',
    name: 'Elena Rodriguez',
    region: 'South Region / Port Harcourt LGA',
    responses: 215,
    status: 'Synced',
    unsyncedCount: 0,
    lastSync: '25 mins ago',
    signalStrength: 'Good',
    batteryLevel: 88,
    phone: '+234 805 567 8901',
    completionRate: 99.1,
    assignedProjectIds: ['PRJ-001', 'PRJ-002']
  },
  {
    id: 'EN-1051',
    name: 'David Chen',
    region: 'West District / Ibadan Central LGA',
    responses: 45,
    status: 'Error',
    unsyncedCount: 12,
    lastSync: '1 day ago',
    signalStrength: 'Poor',
    batteryLevel: 19,
    phone: '+234 807 678 9012',
    completionRate: 84.6,
    assignedProjectIds: ['PRJ-001', 'PRJ-004']
  },
  {
    id: 'EN-1058',
    name: 'Amara Okafor',
    region: 'Central Metro / Abuja Municipal',
    responses: 178,
    status: 'Synced',
    unsyncedCount: 0,
    lastSync: '5 mins ago',
    signalStrength: 'Good',
    batteryLevel: 91,
    phone: '+234 809 789 0123',
    completionRate: 97.8,
    assignedProjectIds: ['PRJ-001', 'PRJ-002', 'PRJ-003']
  }
];

export const INITIAL_QUALITY_ISSUES: QualityIssue[] = [
  {
    id: 'iss-1',
    recordId: 'REC-8832',
    issueType: 'Incomplete Response',
    countFound: 14,
    severity: 'medium',
    details: 'Missing answers in Section C (Drug Availability Likert). Fields Q6 and Q7 null with survey marked completed.',
    status: 'pending',
    timestamp: '2024-09-01 10:14:22',
    variableAffected: 'Q6_Drug_Availability_Likert'
  },
  {
    id: 'iss-2',
    recordId: 'REC-9011',
    issueType: 'Outlier Detected',
    countFound: 1,
    severity: 'high',
    details: "Variable 'Q4_Clinic_Distance_KM' = 420.0 km. Exceeds 4.8 standard deviations from sample mean (μ=6.4 km, σ=4.1).",
    status: 'pending',
    timestamp: '2024-09-01 11:32:05',
    variableAffected: 'Q4_Clinic_Distance_KM'
  },
  {
    id: 'iss-3',
    recordId: 'REC-11204',
    issueType: 'Conflicting Answers',
    countFound: 1,
    severity: 'medium',
    details: "Q3 (Employment Status) = 'Unemployed / Seeking Work', but Q5 (Emergency Transport) = 'Private Car / Ambulance' with daily expenditure > N150k.",
    status: 'pending',
    timestamp: '2024-09-01 13:05:44',
    variableAffected: 'Q3_Employment_Status'
  },
  {
    id: 'iss-4',
    recordId: 'REC-11589',
    issueType: 'Duplicate Submission',
    countFound: 2,
    severity: 'low',
    details: 'Identical timestamps (Δt < 4s), identical GPS coordinates (Lat: 9.0765, Lon: 7.3986), and identical responses submitted by EN-1045.',
    status: 'pending',
    timestamp: '2024-09-01 14:18:50',
    variableAffected: 'Respondent_ID'
  }
];

export const CROSS_TAB_DATA = [
  {
    education: 'Primary / None',
    employed: 420,
    informal: 980,
    farming: 1450,
    unemployed: 350,
    total: 3200
  },
  {
    education: 'Secondary School',
    employed: 1420,
    informal: 1850,
    farming: 820,
    unemployed: 410,
    total: 4500
  },
  {
    education: "Bachelor's Degree",
    employed: 2350,
    informal: 620,
    farming: 110,
    unemployed: 180,
    total: 3260
  },
  {
    education: 'Postgraduate',
    employed: 1180,
    informal: 190,
    farming: 35,
    unemployed: 40,
    total: 1445
  }
];

export const STAT_RECOMMENDATIONS: StatisticalRecommendation[] = [
  {
    id: 'rec-1',
    title: 'Chi-Square Test of Independence (χ²)',
    type: 'Non-Parametric',
    confidence: 98,
    testCode: 'chi-square',
    reason: 'Two categorical demographic variables with N=12,405. Perfect for testing independence between Educational Attainment and Employment Classification.',
    variables: ['Q2_Education (Ordinal IV)', 'Q3_Employment_Status (Nominal DV)'],
    expectedOutput: "Pearson χ², df, Asymptotic 2-sided p-value, Cramér's V effect size coefficient.",
    objectiveMatch: 'Objective 2: Evaluate socio-demographic disparities in healthcare accessibility'
  },
  {
    id: 'rec-2',
    title: 'Multiple Linear Regression (OLS)',
    type: 'Regression',
    confidence: 94,
    testCode: 'linear-regression',
    reason: 'Continuous dependent variable (Clinic Satisfaction Index) modeled against multi-dimensional numerical predictors and dummy-coded demographics.',
    variables: ['Q7_Satisfaction_Score (DV)', 'Q4_Clinic_Distance_KM (IV₁)', 'Q1_Age (IV₂)', 'Q6_Drug_Availability (IV₃)'],
    expectedOutput: 'Model R², Adjusted R², F-statistic (ANOVA), Unstandardized B & Standardized Beta coefficients, 95% CI.',
    objectiveMatch: 'Objective 4: Model predictors of maternal and infant primary care satisfaction'
  },
  {
    id: 'rec-3',
    title: 'One-Way Analysis of Variance (ANOVA)',
    type: 'Parametric',
    confidence: 91,
    testCode: 'anova',
    reason: 'Evaluating whether mean clinic distance or satisfaction differs significantly across 5 distinct educational achievement strata.',
    variables: ['Q7_Satisfaction_Score (Continuous DV)', 'Q2_Education (5-Group Nominal IV)'],
    expectedOutput: 'F-ratio, Between/Within groups df, p-value, Eta-squared (η²), Tukey HSD post-hoc contrasts.',
    objectiveMatch: 'Objective 2: Evaluate socio-demographic disparities in healthcare accessibility'
  },
  {
    id: 'rec-4',
    title: 'Pearson Product-Moment Correlation (r)',
    type: 'Correlation',
    confidence: 88,
    testCode: 'correlation',
    reason: 'Examining bivariate linear relationship strength and direction between clinic distance (km) and patient satisfaction score.',
    variables: ['Q4_Clinic_Distance_KM (Continuous)', 'Q7_Satisfaction_Score (Continuous)'],
    expectedOutput: "Pearson's r coefficient, r² shared variance, t-statistic, 2-tailed significance p.",
    objectiveMatch: 'Objective 1: Assess emergency medical readiness and facility distribution'
  }
];

export const INITIAL_ANALYSIS_RESULTS: StatisticalAnalysisResult[] = [
  {
    id: 'res-1',
    objective: 'Objective 2: Evaluate socio-demographic disparities in healthcare accessibility',
    testType: 'Pearson Chi-Square Test of Independence',
    independentVars: ['Q2_Education (Highest Education Level)'],
    dependentVar: 'Q3_Employment_Status (Employment Classification)',
    statisticName: 'χ²',
    statisticValue: 842.61,
    degreesOfFreedom: 12,
    pValue: 0.00001,
    effectSizeName: "Cramér's V",
    effectSizeValue: 0.261,
    sampleSize: 12405,
    assumptions: {
      normality: true,
      homogeneity: true,
      independence: true
    },
    interpretation: 'A Pearson Chi-Square test of independence revealed a highly statistically significant association between educational attainment and employment classification, χ²(12, N = 12,405) = 842.61, p < .001. The effect size, Cramér’s V = .261, reflects a moderate practical association across socio-economic strata. Null hypothesis H₀ is strongly rejected.',
    apaFormattedTable: `Table 4.2
Chi-Square Contingency Test of Independence between Education and Employment
-----------------------------------------------------------------------------
Variable                        Value       df      Asymp. Sig (2-sided)
-----------------------------------------------------------------------------
Pearson Chi-Square             842.61a     12      p < .001
Likelihood Ratio               861.34      12      p < .001
Cramér's V                      0.261               p < .001
N of Valid Cases               12,405
-----------------------------------------------------------------------------
a. 0 cells (0.0%) have expected count less than 5. Minimum expected count is 48.6.`
  },
  {
    id: 'res-2',
    objective: 'Objective 4: Model predictors of maternal and infant primary care satisfaction',
    testType: 'Multiple Linear Regression (OLS)',
    independentVars: ['Q4_Clinic_Distance_KM', 'Q6_Drug_Availability_Likert', 'Q1_Age'],
    dependentVar: 'Q7_Satisfaction_Score (1-10)',
    statisticName: 'F(3, 12401)',
    statisticValue: 412.87,
    degreesOfFreedom: '3, 12401',
    pValue: 0.00001,
    effectSizeName: 'R² (Variance Explained)',
    effectSizeValue: 0.384,
    sampleSize: 12405,
    assumptions: {
      normality: true,
      homogeneity: true,
      independence: true
    },
    interpretation: 'Multiple linear regression analysis indicated that clinic distance, essential drug availability, and respondent age significantly predicted patient satisfaction, F(3, 12401) = 412.87, p < .001, explaining 38.4% of total score variance (R² = .384, Adj R² = .383). Essential drug availability exerted the strongest positive standardized impact (β = .482, p < .001), while facility distance was negatively associated (β = -.314, p < .001).',
    apaFormattedTable: `Table 4.3
OLS Multiple Regression Analysis Predicting Overall Clinic Satisfaction Score (N = 12,405)
------------------------------------------------------------------------------------------
Predictor Variable            B         SE B       β          t         p       95% CI
------------------------------------------------------------------------------------------
(Constant)                   4.218      0.112      --       37.66     <.001   [3.99, 4.43]
Drug Availability (Q6)       0.684      0.016     .482      42.75     <.001   [0.65, 0.71]
Facility Distance km (Q4)   -0.142      0.005    -.314     -28.40     <.001  [-0.15,-0.13]
Respondent Age (Q1)          0.012      0.002     .074       6.00     <.001   [0.01, 0.02]
------------------------------------------------------------------------------------------
Model Summary: R = .620, R² = .384, Adjusted R² = .383, F(3, 12401) = 412.87, p < .001`
  }
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-1',
    timestamp: '2026-09-01 14:32:10',
    userName: 'Dr. Aris Thorne',
    userRole: 'researcher',
    action: 'updated',
    entity: 'Questionnaire (PRJ-001)',
    details: 'Modified skip-logic constraints and validation bounds for Question 4 (Q4_Clinic_Distance_KM).',
    ipAddress: '192.168.1.104'
  },
  {
    id: 'log-2',
    timestamp: '2026-09-01 14:15:42',
    userName: 'Sarah Jenkins',
    userRole: 'enumerator',
    action: 'synced',
    entity: 'Responses Batch (PRJ-001)',
    details: 'Uploaded 45 offline encrypted survey records from Northern District field device EN-1042.',
    ipAddress: '105.112.98.24'
  },
  {
    id: 'log-3',
    timestamp: '2026-09-01 13:48:00',
    userName: 'Dr. Aris Thorne',
    userRole: 'researcher',
    action: 'analyzed',
    entity: 'Statistical Engine (Objective 4)',
    details: 'Executed OLS Multiple Linear Regression model with 12,405 valid records. Generated Table 4.3.',
    ipAddress: '192.168.1.104'
  },
  {
    id: 'log-4',
    timestamp: '2026-09-01 12:10:18',
    userName: 'System Automated Rule Engine',
    userRole: 'admin',
    action: 'validated',
    entity: 'Data Quality Engine',
    details: 'Triggered automated outlier sweep: flagged REC-9011 with 4.8σ distance anomaly.',
    ipAddress: '10.0.0.1'
  },
  {
    id: 'log-5',
    timestamp: '2026-09-01 10:04:55',
    userName: 'Maya Lin',
    userRole: 'admin',
    action: 'created',
    entity: 'Project Schema v2.0',
    details: 'Published questionnaire v2.0 with socio-demographic modular blocks and deployed to live edge cache.',
    ipAddress: '192.168.1.118'
  }
];

export const INITIAL_OFFLINE_RESPONSES: OfflineResponse[] = [
  {
    id: 'off-101',
    questionnaireId: 'q-prj-001',
    projectId: 'PRJ-001',
    respondentId: 'RSP-99214',
    enumeratorId: 'EN-1042',
    enumeratorName: 'Sarah Jenkins',
    collectedOffline: true,
    syncStatus: 'pending',
    collectedAt: '2026-09-01 14:12:00',
    gpsCoordinates: { latitude: 10.5105, longitude: 7.4165, accuracy: 4.2 },
    answers: {
      Q1_Age: 38,
      Q2_Education: 'Bachelor\'s Degree',
      Q3_Employment_Status: 'Formal Full-time Salary Employee',
      Q4_Clinic_Distance_KM: 3.2,
      Q5_Transport_Mode: 'Commercial Motorcycle / Tricycle',
      Q6_Drug_Availability_Likert: 'Agree',
      Q7_Satisfaction_Score: 8
    }
  },
  {
    id: 'off-102',
    questionnaireId: 'q-prj-001',
    projectId: 'PRJ-001',
    respondentId: 'RSP-99215',
    enumeratorId: 'EN-1042',
    enumeratorName: 'Sarah Jenkins',
    collectedOffline: true,
    syncStatus: 'pending',
    collectedAt: '2026-09-01 14:20:15',
    gpsCoordinates: { latitude: 10.5118, longitude: 7.4172, accuracy: 3.8 },
    answers: {
      Q1_Age: 52,
      Q2_Education: 'Secondary / High School',
      Q3_Employment_Status: 'Informal / Self-Employed Trader',
      Q4_Clinic_Distance_KM: 8.5,
      Q5_Transport_Mode: 'Walking / Foot',
      Q6_Drug_Availability_Likert: 'Disagree',
      Q7_Satisfaction_Score: 4
    }
  },
  {
    id: 'off-103',
    questionnaireId: 'q-prj-001',
    projectId: 'PRJ-001',
    respondentId: 'RSP-99216',
    enumeratorId: 'EN-1042',
    enumeratorName: 'Sarah Jenkins',
    collectedOffline: true,
    syncStatus: 'pending',
    collectedAt: '2026-09-01 14:28:40',
    gpsCoordinates: { latitude: 10.5132, longitude: 7.4189, accuracy: 5.1 },
    answers: {
      Q1_Age: 26,
      Q2_Education: 'Postgraduate Degree (Master\'s / Ph.D.)',
      Q3_Employment_Status: 'Formal Full-time Salary Employee',
      Q4_Clinic_Distance_KM: 1.8,
      Q5_Transport_Mode: 'Private Car / Ambulance',
      Q6_Drug_Availability_Likert: 'Strongly Agree',
      Q7_Satisfaction_Score: 9
    }
  }
];

export const INITIAL_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'u1',
    name: 'Dr. Aris Thorne',
    email: 'aris.thorne@rdip.edu',
    initials: 'AT',
    role: 'Admin',
    status: 'Active',
    avatarBg: 'bg-[#1a365d]'
  },
  {
    id: 'u2',
    name: 'Dr. Maya Lin',
    email: 'mlin@rdip.edu',
    initials: 'ML',
    role: 'Editor',
    status: 'Active',
    avatarBg: 'bg-[#006a68]'
  },
  {
    id: 'u3',
    name: 'David Ross',
    email: 'dross@rdip.edu',
    initials: 'DR',
    role: 'Viewer',
    status: 'Pending',
    avatarBg: 'bg-[#74777f]'
  }
];

export const INITIAL_SCHEMA_VERSIONS: SchemaVersion[] = [
  {
    version: 'v2.0',
    isCurrent: true,
    deployedDate: 'Oct 24, 2024',
    author: 'Dr. Aris Thorne',
    summary: 'Added socio-demographic modular blocks. Updated mandatory field validation rules for Section B & Likert scales.'
  },
  {
    version: 'v1.1',
    isCurrent: false,
    deployedDate: 'Sep 12, 2024',
    author: 'Maya Lin',
    summary: 'Minor bug fixes in skip logic for question 14a. Typo corrections in localization strings.'
  },
  {
    version: 'v1.0',
    isCurrent: false,
    deployedDate: 'Jan 05, 2024',
    author: 'System',
    summary: 'Base schema implementation for baseline nationwide survey wave.'
  }
];

export const INITIAL_API_KEYS: ApiKey[] = [
  {
    id: 'key-1',
    name: 'RStudio Analytics Pipeline',
    status: 'Active',
    createdDate: 'Oct 01, 2024',
    lastUsed: '2 hours ago',
    keyMask: 'rdip_prod_••••••••••••8f2a'
  },
  {
    id: 'key-2',
    name: 'Tableau Live Sync (Read-Only)',
    status: 'Active',
    createdDate: 'Sep 15, 2024',
    lastUsed: '5 mins ago',
    keyMask: 'rdip_read_••••••••••••92bc'
  }
];
