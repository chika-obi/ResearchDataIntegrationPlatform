import { Question } from '../types';

export interface SurveyTemplate {
  id: string;
  name: string;
  category: string;
  badge: string;
  icon: string;
  tagline: string;
  description: string;
  defaultTitle: string;
  defaultInstitution: string;
  defaultNotes: string;
  researchObjectives: string[];
  questions: Question[];
}

export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    id: 'public-health',
    name: 'Public Health & Clinical Access',
    category: 'Epidemiology',
    badge: '7 Questions',
    icon: 'medical_services',
    tagline: 'Primary care facilities, medical readiness, emergency transit, and clinic barriers',
    description: 'Standardized questionnaire protocol assessing facility distance, transport modes, healthcare costs, and patient satisfaction across primary clinics.',
    defaultTitle: 'National Health Infrastructure & Facility Access Survey',
    defaultInstitution: 'Ministry of Public Health & Global Health Initiative',
    defaultNotes: 'IRB Protocol #2025-PH09 approved. Cluster sampling across target health catchment zones. Dual-language enumerator administration.',
    researchObjectives: [
      'Objective 1: Quantify travel distance and transit barriers to emergency care',
      'Objective 2: Evaluate socio-demographic disparities in health facility access',
      'Objective 3: Assess out-of-pocket consultation expenditure and clinic satisfaction'
    ],
    questions: [
      {
        id: 'tmpl-ph-q1',
        number: 'Q1',
        section: 'Section A: Demographic Profile',
        title: 'What is your current age (in completed years)?',
        variableName: 'Q1_Age',
        variableLabel: 'Age of Respondent (Years)',
        type: 'number',
        required: true,
        options: [],
        linkedObjective: 'Objective 2: Evaluate socio-demographic disparities in health facility access',
        dataType: 'Numerical',
        measurementLevel: 'Ratio',
        dataTypeConstraint: 'Numeric (Continuous)',
        validationRules: { min: 18, max: 105 }
      },
      {
        id: 'tmpl-ph-q2',
        number: 'Q2',
        section: 'Section A: Demographic Profile',
        title: 'What is your highest completed educational attainment?',
        variableName: 'Q2_Education',
        variableLabel: 'Highest Educational Level Completed',
        type: 'multiple-choice',
        required: true,
        linkedObjective: 'Objective 2: Evaluate socio-demographic disparities in health facility access',
        dataType: 'Categorical',
        measurementLevel: 'Ordinal',
        dataTypeConstraint: 'Categorical (Ordinal)',
        options: [
          { id: 'opt-ph-1', label: 'Primary Education or None', numericCode: 1 },
          { id: 'opt-ph-2', label: 'Secondary / High School', numericCode: 2 },
          { id: 'opt-ph-3', label: "Vocational / Associate's Degree", numericCode: 3 },
          { id: 'opt-ph-4', label: "Bachelor's Degree", numericCode: 4 },
          { id: 'opt-ph-5', label: 'Postgraduate Degree (Master/PhD)', numericCode: 5 }
        ]
      },
      {
        id: 'tmpl-ph-q3',
        number: 'Q3',
        section: 'Section B: Healthcare Facilities',
        title: 'Estimated distance (in km) to the nearest primary health clinic',
        variableName: 'Q3_Clinic_Distance_KM',
        variableLabel: 'Distance to Nearest Health Facility (km)',
        type: 'number',
        required: true,
        linkedObjective: 'Objective 1: Quantify travel distance and transit barriers to emergency care',
        dataType: 'Numerical',
        measurementLevel: 'Ratio',
        dataTypeConstraint: 'Numeric (Continuous)',
        validationRules: { min: 0, max: 120 }
      },
      {
        id: 'tmpl-ph-q4',
        number: 'Q4',
        section: 'Section B: Healthcare Facilities',
        title: 'Primary transportation mode utilized for emergency medical visits',
        variableName: 'Q4_Transport_Mode',
        variableLabel: 'Primary Emergency Transport Mode',
        type: 'dropdown',
        required: true,
        linkedObjective: 'Objective 1: Quantify travel distance and transit barriers to emergency care',
        dataType: 'Categorical',
        measurementLevel: 'Nominal',
        dataTypeConstraint: 'Categorical (Nominal)',
        options: [
          { id: 'tr-1', label: 'Walking / Foot', numericCode: 1 },
          { id: 'tr-2', label: 'Bicycle / Two-Wheeler', numericCode: 2 },
          { id: 'tr-3', label: 'Commercial Motorcycle / Tricycle', numericCode: 3 },
          { id: 'tr-4', label: 'Public Bus / Minibus', numericCode: 4 },
          { id: 'tr-5', label: 'Private Automobile / Ambulance', numericCode: 5 }
        ]
      },
      {
        id: 'tmpl-ph-q5',
        number: 'Q5',
        section: 'Section C: Economic Burden',
        title: 'Out-of-pocket consultation fee paid during most recent visit (USD or local equiv)',
        variableName: 'Q5_Out_Of_Pocket_Fee',
        variableLabel: 'Out-of-Pocket Consultation Fee',
        type: 'number',
        required: true,
        linkedObjective: 'Objective 3: Assess out-of-pocket consultation expenditure and clinic satisfaction',
        dataType: 'Numerical',
        measurementLevel: 'Ratio',
        dataTypeConstraint: 'Numeric (Continuous)',
        validationRules: { min: 0, max: 2500 }
      },
      {
        id: 'tmpl-ph-q6',
        number: 'Q6',
        section: 'Section C: Service Quality',
        title: 'Overall satisfaction with primary clinic personnel attentiveness and cleanliness',
        variableName: 'Q6_Clinic_Satisfaction',
        variableLabel: 'Overall Clinic Satisfaction Rating',
        type: 'likert',
        required: true,
        linkedObjective: 'Objective 3: Assess out-of-pocket consultation expenditure and clinic satisfaction',
        dataType: 'Ordinal',
        measurementLevel: 'Ordinal',
        dataTypeConstraint: 'Categorical (Ordinal)',
        options: [
          { id: 'lik-1', label: 'Very Dissatisfied', numericCode: 1 },
          { id: 'lik-2', label: 'Dissatisfied', numericCode: 2 },
          { id: 'lik-3', label: 'Neutral', numericCode: 3 },
          { id: 'lik-4', label: 'Satisfied', numericCode: 4 },
          { id: 'lik-5', label: 'Very Satisfied', numericCode: 5 }
        ]
      },
      {
        id: 'tmpl-ph-q7',
        number: 'Q7',
        section: 'Section C: Service Quality',
        title: 'Additional observations or institutional feedback regarding primary clinic services',
        variableName: 'Q7_Qualitative_Notes',
        variableLabel: 'Respondent Clinic Feedback',
        type: 'paragraph',
        required: false,
        options: [],
        linkedObjective: 'Objective 3: Assess out-of-pocket consultation expenditure and clinic satisfaction',
        dataType: 'Categorical',
        measurementLevel: 'Nominal',
        dataTypeConstraint: 'Text (Unstructured)'
      }
    ]
  },
  {
    id: 'socio-economic',
    name: 'Household Socio-Economic & Living Standards',
    category: 'Economics',
    badge: '6 Questions',
    icon: 'roofing',
    tagline: 'Household income tiers, asset ownership indices, education, and housing resilience',
    description: 'Multi-indicator living standards questionnaire measuring multidimensional poverty, household expenditure, durable assets, and dwelling characteristics.',
    defaultTitle: 'Household Socio-Economic & Living Standards Benchmark 2025',
    defaultInstitution: 'National Statistical Bureau & Economic Policy Directorate',
    defaultNotes: 'Two-stage stratified random sampling. Target respondent is designated household head or adult spouse. Field validation against census enumeration areas.',
    researchObjectives: [
      'Objective 1: Compute household multidimensional asset index and wealth quintiles',
      'Objective 2: Evaluate relationship between parental education and monthly expenditures',
      'Objective 3: Map housing structural quality and utility access across urban and peri-urban wards'
    ],
    questions: [
      {
        id: 'tmpl-se-q1',
        number: 'Q1',
        section: 'Section A: Household Head Demographics',
        title: 'Age of designated household head (in completed years)',
        variableName: 'Q1_Head_Age',
        variableLabel: 'Age of Household Head',
        type: 'number',
        required: true,
        options: [],
        linkedObjective: 'Objective 1: Compute household multidimensional asset index and wealth quintiles',
        dataType: 'Numerical',
        measurementLevel: 'Ratio',
        dataTypeConstraint: 'Numeric (Continuous)',
        validationRules: { min: 18, max: 100 }
      },
      {
        id: 'tmpl-se-q2',
        number: 'Q2',
        section: 'Section A: Household Head Demographics',
        title: 'Total number of individuals currently residing in this household',
        variableName: 'Q2_Household_Size',
        variableLabel: 'Total Household Members',
        type: 'number',
        required: true,
        options: [],
        linkedObjective: 'Objective 1: Compute household multidimensional asset index and wealth quintiles',
        dataType: 'Numerical',
        measurementLevel: 'Ratio',
        dataTypeConstraint: 'Numeric (Discrete)',
        validationRules: { min: 1, max: 25 }
      },
      {
        id: 'tmpl-se-q3',
        number: 'Q3',
        section: 'Section B: Economic Activity',
        title: 'Primary source of household livelihood and income',
        variableName: 'Q3_Income_Source',
        variableLabel: 'Primary Livelihood Source',
        type: 'multiple-choice',
        required: true,
        linkedObjective: 'Objective 2: Evaluate relationship between parental education and monthly expenditures',
        dataType: 'Categorical',
        measurementLevel: 'Nominal',
        dataTypeConstraint: 'Categorical (Nominal)',
        options: [
          { id: 'inc-1', label: 'Formal Wage / Public or Private Salary', numericCode: 1 },
          { id: 'inc-2', label: 'Commercial Farming / Livestock Sales', numericCode: 2 },
          { id: 'inc-3', label: 'Informal Petty Trade / Small Enterprise', numericCode: 3 },
          { id: 'inc-4', label: 'Daily Casual / Agricultural Wage Labor', numericCode: 4 },
          { id: 'inc-5', label: 'Remittances / Government Welfare Grants', numericCode: 5 }
        ]
      },
      {
        id: 'tmpl-se-q4',
        number: 'Q4',
        section: 'Section B: Economic Activity',
        title: 'Estimated total household expenditure over the past 30 days (USD or equiv)',
        variableName: 'Q4_Monthly_Expenditure',
        variableLabel: 'Monthly Household Expenditure',
        type: 'number',
        required: true,
        options: [],
        linkedObjective: 'Objective 2: Evaluate relationship between parental education and monthly expenditures',
        dataType: 'Numerical',
        measurementLevel: 'Ratio',
        dataTypeConstraint: 'Numeric (Continuous)',
        validationRules: { min: 10, max: 15000 }
      },
      {
        id: 'tmpl-se-q5',
        number: 'Q5',
        section: 'Section C: Asset Wealth Index',
        title: 'Which of the following productive and household assets does this home own in working order?',
        variableName: 'Q5_Asset_Inventory',
        variableLabel: 'Household Asset Checklist',
        type: 'checkboxes',
        required: true,
        linkedObjective: 'Objective 1: Compute household multidimensional asset index and wealth quintiles',
        dataType: 'Categorical',
        measurementLevel: 'Nominal',
        dataTypeConstraint: 'Categorical (Multi-Select)',
        options: [
          { id: 'ast-1', label: 'Solar Power System or Grid Connection', numericCode: 1 },
          { id: 'ast-2', label: 'Functional Smartphone / Tablet', numericCode: 2 },
          { id: 'ast-3', label: 'Refrigerator / Freezer', numericCode: 3 },
          { id: 'ast-4', label: 'Motorcycle / Motorized Scooter', numericCode: 4 },
          { id: 'ast-5', label: 'Bank Account or Mobile Money Wallet', numericCode: 5 }
        ]
      },
      {
        id: 'tmpl-se-q6',
        number: 'Q6',
        section: 'Section C: Dwelling Infrastructure',
        title: 'Predominant construction material of external dwelling walls',
        variableName: 'Q6_Wall_Material',
        variableLabel: 'Dwelling Wall Material',
        type: 'dropdown',
        required: true,
        linkedObjective: 'Objective 3: Map housing structural quality and utility access across urban and peri-urban wards',
        dataType: 'Categorical',
        measurementLevel: 'Nominal',
        dataTypeConstraint: 'Categorical (Nominal)',
        options: [
          { id: 'mat-1', label: 'Cement Blocks / Fired Brick with Mortar', numericCode: 1 },
          { id: 'mat-2', label: 'Sun-dried Mud Bricks / Adobe', numericCode: 2 },
          { id: 'mat-3', label: 'Corrugated Iron / Metal Sheets', numericCode: 3 },
          { id: 'mat-4', label: 'Timber / Bamboo with Wattle', numericCode: 4 }
        ]
      }
    ]
  },
  {
    id: 'agronomy-yield',
    name: 'Smallholder Agronomic Yield & Food Security',
    category: 'Agriculture',
    badge: '5 Questions',
    icon: 'agriculture',
    tagline: 'Crop varieties, acreage, fertilizer micro-dosing, irrigation, and harvest yield',
    description: 'Empirical agronomy questionnaire capturing parcel hectarage, improved seed varieties, synthetic and organic fertilizer usage, and post-harvest output.',
    defaultTitle: 'Smallholder Crop Yield Baseline & Agronomic Practices Survey',
    defaultInstitution: 'Agricultural Research Council & Food Security Alliance',
    defaultNotes: 'GPS parcel boundary polygon required at interview conclusion. Cross-verify fertilizer dosage against standard 50kg bag equivalents.',
    researchObjectives: [
      'Objective 1: Establish baseline grain yield (metric tons/ha) across smallholder plots',
      'Objective 2: Test productivity differentials between hybrid seeds vs saved landraces',
      'Objective 3: Model adoption factors for micro-irrigation and inorganic fertilizer'
    ],
    questions: [
      {
        id: 'tmpl-ag-q1',
        number: 'Q1',
        section: 'Section A: Land Holding & Plot Size',
        title: 'Total land area cultivated under primary crops this agricultural season (in Hectares)',
        variableName: 'Q1_Plot_Acreage_Ha',
        variableLabel: 'Cultivated Farm Size (Hectares)',
        type: 'number',
        required: true,
        options: [],
        linkedObjective: 'Objective 1: Establish baseline grain yield (metric tons/ha) across smallholder plots',
        dataType: 'Numerical',
        measurementLevel: 'Ratio',
        dataTypeConstraint: 'Numeric (Continuous)',
        validationRules: { min: 0.1, max: 200 }
      },
      {
        id: 'tmpl-ag-q2',
        number: 'Q2',
        section: 'Section A: Crop Varieties',
        title: 'Primary staple cereal or legume cultivated on the main agricultural parcel',
        variableName: 'Q2_Primary_Crop',
        variableLabel: 'Primary Staple Crop',
        type: 'dropdown',
        required: true,
        linkedObjective: 'Objective 2: Test productivity differentials between hybrid seeds vs saved landraces',
        dataType: 'Categorical',
        measurementLevel: 'Nominal',
        dataTypeConstraint: 'Categorical (Nominal)',
        options: [
          { id: 'crp-1', label: 'Maize (Zea mays)', numericCode: 1 },
          { id: 'crp-2', label: 'Sorghum / Pearl Millet', numericCode: 2 },
          { id: 'crp-3', label: 'Cassava / Tuber Roots', numericCode: 3 },
          { id: 'crp-4', label: 'Rice (Paddy or Upland)', numericCode: 4 },
          { id: 'crp-5', label: 'Soybean / Cowpea Legumes', numericCode: 5 }
        ]
      },
      {
        id: 'tmpl-ag-q3',
        number: 'Q3',
        section: 'Section B: Inputs & Practices',
        title: 'Did you apply chemical or organic fertilizer to your primary parcel this season?',
        variableName: 'Q3_Fertilizer_Used',
        variableLabel: 'Fertilizer Application Status',
        type: 'multiple-choice',
        required: true,
        linkedObjective: 'Objective 3: Model adoption factors for micro-irrigation and inorganic fertilizer',
        dataType: 'Categorical',
        measurementLevel: 'Nominal',
        dataTypeConstraint: 'Categorical (Dichotomous)',
        options: [
          { id: 'fert-1', label: 'Yes - Inorganic / Mineral Fertilizer (NPK/Urea)', numericCode: 1 },
          { id: 'fert-2', label: 'Yes - Organic Compost / Manure Only', numericCode: 2 },
          { id: 'fert-3', label: 'Yes - Combined Mineral and Organic Regimen', numericCode: 3 },
          { id: 'fert-4', label: 'No - No Fertilizer Applied This Season', numericCode: 0 }
        ]
      },
      {
        id: 'tmpl-ag-q4',
        number: 'Q4',
        section: 'Section B: Water Management',
        title: 'Primary water source utilized for parcel crop cultivation',
        variableName: 'Q4_Irrigation_Source',
        variableLabel: 'Irrigation & Water Management Type',
        type: 'multiple-choice',
        required: true,
        linkedObjective: 'Objective 3: Model adoption factors for micro-irrigation and inorganic fertilizer',
        dataType: 'Categorical',
        measurementLevel: 'Nominal',
        dataTypeConstraint: 'Categorical (Nominal)',
        options: [
          { id: 'wtr-1', label: 'Strictly Rainfed Agriculture', numericCode: 1 },
          { id: 'wtr-2', label: 'Gravity Furrow / Canal Scheme', numericCode: 2 },
          { id: 'wtr-3', label: 'Motorized Pump (River / Borehole)', numericCode: 3 },
          { id: 'wtr-4', label: 'Solar Drip Micro-irrigation System', numericCode: 4 }
        ]
      },
      {
        id: 'tmpl-ag-q5',
        number: 'Q5',
        section: 'Section C: Yield Outcome',
        title: 'Total harvest quantity obtained from primary parcel (in 50kg bags or metric quintals)',
        variableName: 'Q5_Total_Yield_Bags',
        variableLabel: 'Harvest Yield (50kg Bags Equivalent)',
        type: 'number',
        required: true,
        options: [],
        linkedObjective: 'Objective 1: Establish baseline grain yield (metric tons/ha) across smallholder plots',
        dataType: 'Numerical',
        measurementLevel: 'Ratio',
        dataTypeConstraint: 'Numeric (Continuous)',
        validationRules: { min: 0, max: 2000 }
      }
    ]
  },
  {
    id: 'education-labor',
    name: 'Higher Education & Labor Market Alignment',
    category: 'Education',
    badge: '5 Questions',
    icon: 'school',
    tagline: 'Technical competencies, internship duration, graduate job placement, and wage outcomes',
    description: 'Tracer study instrument surveying recent tertiary and vocational graduates regarding job search duration, skill utilization, and labor market transitions.',
    defaultTitle: 'Tertiary Graduate Employment & Workforce Competency Tracer Study',
    defaultInstitution: 'National Higher Education Council & Labor Observatory',
    defaultNotes: 'Cohort sampling covering graduating classes of 2023-2024. Web-assisted personal interviewing (CAPI/CATI) with alumni email verification.',
    researchObjectives: [
      'Objective 1: Measure transition duration from degree completion to first formal employment',
      'Objective 2: Evaluate perceived curriculum alignment with employer technological demands',
      'Objective 3: Identify key determinants of entry-level salary compensation'
    ],
    questions: [
      {
        id: 'tmpl-ed-q1',
        number: 'Q1',
        section: 'Section A: Academic Background',
        title: 'Academic faculty or primary study discipline of your highest qualification',
        variableName: 'Q1_Academic_Faculty',
        variableLabel: 'Graduating Academic Discipline',
        type: 'dropdown',
        required: true,
        linkedObjective: 'Objective 1: Measure transition duration from degree completion to first formal employment',
        dataType: 'Categorical',
        measurementLevel: 'Nominal',
        dataTypeConstraint: 'Categorical (Nominal)',
        options: [
          { id: 'fac-1', label: 'Computer Science & Software Engineering', numericCode: 1 },
          { id: 'fac-2', label: 'Electrical / Civil / Mechanical Engineering', numericCode: 2 },
          { id: 'fac-3', label: 'Health Sciences, Nursing & Pharmacy', numericCode: 3 },
          { id: 'fac-4', label: 'Business Administration, Finance & Accounting', numericCode: 4 },
          { id: 'fac-5', label: 'Social Sciences, Humanities & Law', numericCode: 5 }
        ]
      },
      {
        id: 'tmpl-ed-q2',
        number: 'Q2',
        section: 'Section A: Academic Background',
        title: 'Did you complete an accredited industry internship or work practicum during your studies?',
        variableName: 'Q2_Internship_Completed',
        variableLabel: 'Industry Internship Status',
        type: 'multiple-choice',
        required: true,
        linkedObjective: 'Objective 2: Evaluate perceived curriculum alignment with employer technological demands',
        dataType: 'Categorical',
        measurementLevel: 'Nominal',
        dataTypeConstraint: 'Categorical (Dichotomous)',
        options: [
          { id: 'int-1', label: 'Yes - Mandatory formal internship (>3 months)', numericCode: 1 },
          { id: 'int-2', label: 'Yes - Voluntary summer internship (<3 months)', numericCode: 2 },
          { id: 'int-3', label: 'No - Did not participate in an internship', numericCode: 0 }
        ]
      },
      {
        id: 'tmpl-ed-q3',
        number: 'Q3',
        section: 'Section B: Employment Status',
        title: 'Current primary labor market status (at the time of this interview)',
        variableName: 'Q3_Current_Employment_Status',
        variableLabel: 'Current Employment Status',
        type: 'multiple-choice',
        required: true,
        linkedObjective: 'Objective 1: Measure transition duration from degree completion to first formal employment',
        dataType: 'Categorical',
        measurementLevel: 'Nominal',
        dataTypeConstraint: 'Categorical (Nominal)',
        options: [
          { id: 'emp-1', label: 'Employed Full-time in field of study', numericCode: 1 },
          { id: 'emp-2', label: 'Employed in an unrelated commercial field', numericCode: 2 },
          { id: 'emp-3', label: 'Self-employed / Entrepreneurial Founder', numericCode: 3 },
          { id: 'emp-4', label: 'Unemployed and actively seeking employment', numericCode: 4 },
          { id: 'emp-5', label: 'Pursuing further postgraduate studies', numericCode: 5 }
        ]
      },
      {
        id: 'tmpl-ed-q4',
        number: 'Q4',
        section: 'Section B: Employment Transition',
        title: 'Number of months taken from graduation to obtaining your first paid position (enter 0 if hired before graduating)',
        variableName: 'Q4_Months_To_Job',
        variableLabel: 'Duration to First Employment (Months)',
        type: 'number',
        required: true,
        options: [],
        linkedObjective: 'Objective 1: Measure transition duration from degree completion to first formal employment',
        dataType: 'Numerical',
        measurementLevel: 'Ratio',
        dataTypeConstraint: 'Numeric (Continuous)',
        validationRules: { min: 0, max: 48 }
      },
      {
        id: 'tmpl-ed-q5',
        number: 'Q5',
        section: 'Section C: Curriculum Relevance',
        title: 'How well did your university academic curriculum prepare you for current workplace tools and tasks?',
        variableName: 'Q5_Curriculum_Relevance',
        variableLabel: 'Perceived Curriculum Workplace Relevance',
        type: 'likert',
        required: true,
        linkedObjective: 'Objective 2: Evaluate perceived curriculum alignment with employer technological demands',
        dataType: 'Ordinal',
        measurementLevel: 'Ordinal',
        dataTypeConstraint: 'Categorical (Ordinal)',
        options: [
          { id: 'rel-1', label: 'Poorly Prepared (Major Gaps)', numericCode: 1 },
          { id: 'rel-2', label: 'Somewhat Prepared', numericCode: 2 },
          { id: 'rel-3', label: 'Adequately Prepared', numericCode: 3 },
          { id: 'rel-4', label: 'Well Prepared', numericCode: 4 },
          { id: 'rel-5', label: 'Exceptionally Well Prepared', numericCode: 5 }
        ]
      }
    ]
  }
];
