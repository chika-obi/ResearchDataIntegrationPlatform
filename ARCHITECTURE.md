# Research Data Integration Platform (RDIP)
## System Architecture & Technical Specification Document

---

### 1. Executive Summary & System Overview

The **Research Data Integration Platform (RDIP)** is a high-assurance, end-to-end web and mobile-responsive application architected for empirical academic research, global public health surveillance, epidemiologic monitoring, and demographic data collection.

RDIP bridges the gap between field enumerators operating in bandwidth-constrained, offline environments and academic principal investigators requiring rigorous methodological precision, relational data integrity, strict row-level security (RLS), and automated statistical workflows.

```
+---------------------------------------------------------------------------------------+
|                                    RDIP ARCHITECTURE                                  |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|  [ Field Enumerators ]          [ Lead Researchers & PIs ]        [ Public Respondents ]
|          |                                   |                              |
|          v                                   v                              v
|  +---------------------------------------------------------------------------------+  |
|  |                     Client Layer (React 18 + Vite + Tailwind)                   |  |
|  |   - Offline-First Collector (IndexedDB/Local Engine + GPS Telemetry)            |  |
|  |   - Interactive Questionnaire Designer & Versioning System                     |  |
|  |   - Data Dictionary & Variable Codebook Manager                                 |  |
|  |   - Statistical Analysis Suite (APA-7 Tables & Hypothesis Testing)              |  |
|  |   - Data Quality Auditor (Outliers, Missing Values & Anomaly Detection)         |  |
|  +---------------------------------------------------------------------------------+  |
|                                          |                                            |
|                                          v                                            |
|  +---------------------------------------------------------------------------------+  |
|  |              Service & Repository Layer (src/lib/rdipDatabaseService.ts)         |  |
|  |   - Typed Query Abstraction & Seamless Local Fallback Strategy                  |  |
|  |   - Offline Response Queuing & Background Synchronization Engine                |  |
|  +---------------------------------------------------------------------------------+  |
|                                          |                                            |
|                                          v                                            |
|  +---------------------------------------------------------------------------------+  |
|  |               Supabase Cloud Platform (PostgreSQL 15+ & PostgREST)               |  |
|  |   - Database-Level Row-Level Security (RLS) Enforcing Strict Isolation          |  |
|  |   - Normalized Relational Entities & Relational Foreign Keys                    |  |
|  |   - Enumerator Assignment Guardrails (`has_project_access`, `is_assigned_enum`) |  |
|  |   - Automated Versioning Lifecycle & Schema Immutability                        |  |
|  |   - Cryptographic Audit Ledger (`audit_logs`)                                   |  |
|  +---------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------+
```

---

### 2. Frontend Layer Architecture

- **Core Framework**: React 18 with TypeScript 5+ bundled via Vite.
- **Styling Architecture**: Tailwind CSS utilizing an institutional research aesthetic (cool slate, deep navy `#002045`, emerald teal `#006a68`, and refined surface borders).
- **Component Design**: Highly modularized functional components located in `src/components/`, separating domain presentation from backend data operations.
- **Client State Management**:
  - React Hooks (`useState`, `useCallback`, `useMemo`, `useEffect`) manage responsive UI state.
  - Storage persistence layer in `localStorage` and `IndexedDB` enables offline-first field surveys.
- **Service Layer Abstraction**:
  - All database communications route through `src/lib/rdipDatabaseService.ts` and `src/lib/supabaseSync.ts`.
  - Views do NOT invoke raw SQL or un-typed API calls directly.
  - If the client is temporarily disconnected or if Supabase tables are in migration, the service layer transparently falls back to cached records, ensuring zero UI downtime or data loss for field enumerators.

---

### 3. Database Layer & PostgreSQL Schema

The database architecture is built upon PostgreSQL (Supabase Cloud). It utilizes `uuid-ossp` and `pgcrypto` extensions with normalized schemas located in `/supabase/migrations/`:

```
/supabase
  └── migrations/
      ├── 20250903000001_core_schema.sql      # 14 Relational entities, enums, triggers, indexes
      ├── 20250903000002_rls_policies.sql     # Row Level Security policies & security definer functions
      └── 20250903000003_seed_data.sql        # Realistic multi-project isolation seed data
```

#### Core Entities & Relationships

| Entity | Primary Key | Foreign Keys / Belongs To | Purpose |
| :--- | :--- | :--- | :--- |
| `profiles` | `id` (UUID) | `auth.users.id` (1:1) | User profile, platform role (`researcher`, `enumerator`, `super_admin`, etc.), institution, verification status. |
| `projects` | `id` (UUID) | `owner_id` -> `profiles.id` | Research projects, protocol definitions, research designs, overall quality scores. |
| `project_members` | `id` (UUID) | `project_id`, `user_id` | Granular multi-user team collaboration with JSONB capability matrix. |
| `questionnaires` | `id` (UUID) | `project_id`, `created_by` | Container representing an instrument (e.g., Facility Cold Chain Audit). |
| `questionnaire_versions` | `id` (UUID) | `questionnaire_id` | Version instances (`1.0`, `1.1`), ensuring immutability once published. |
| `questions` | `id` (UUID) | `questionnaire_version_id` | Individual survey items, measurement levels, variable bindings, GPS config. |
| `question_options` | `id` (UUID) | `question_id` | Categorical options, labels, and statistical numeric codes. |
| `variables` | `id` (UUID) | `project_id`, `questionnaire_id` | Research data dictionary defining labels, missing value rules, measurement scales. |
| `questionnaire_assignments` | `id` (UUID) | `questionnaire_id`, `enumerator_id` | Strict assignment junction authorizing enumerators to collect data. |
| `responses` | `id` (UUID) | `project_id`, `questionnaire_id`, `questionnaire_version_id`, `enumerator_id` | Response submission header with telemetry, GPS fixes, sync status. |
| `response_answers` | `id` (UUID) | `response_id`, `question_id` | Normalized response answer rows containing text, numeric, date, or GPS values. |
| `data_quality_issues` | `id` (UUID) | `project_id`, `response_id` | Detected outliers, incomplete records, conflicting inputs, and anomalies. |
| `statistical_analyses` | `id` (UUID) | `project_id` | Stored statistical hypotheses tests (t-tests, ANOVA, Chi-Square) and APA tables. |
| `audit_logs` | `id` (UUID) | `user_id` | Append-only tamper-evident ledger tracking all critical platform actions. |

---

### 4. Row-Level Security (RLS) & Access Control Strategy

The security model is enforced at the database level using PostgreSQL **Row Level Security (RLS)** with `SECURITY DEFINER` helper functions.

#### 4.1. Security Definer Helper Functions
1. `is_super_admin(user_id)`: Verifies if user has platform-level administrative rights.
2. `is_project_owner(target_project_id, user_id)`: Checks if the user is the primary creator/investigator.
3. `has_project_access(target_project_id, user_id)`: Verifies that the user is the owner, a collaborative member (`project_members`), or a super admin.
4. `is_assigned_enumerator(target_questionnaire_id, user_id)`: Evaluates whether an enumerator is active and assigned to that specific questionnaire within valid operational dates.

#### 4.2. Access Control Matrix

| Role | Project Visibility | Questionnaire Design | Data Collection | Response Visibility | Statistical Analysis |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | Platform-Wide (All) | Full Access | Full Access | Full Access (All Projects) | Full Access |
| **Researcher / PI (Owner)** | Owned & Member Projects | Full Authoring & Publishing | Full Access | All Responses in Project | Full Access |
| **Co-Investigator / Member** | Shared Projects Only | Per Member Permissions | Per Permissions | All Responses in Project | Per Permissions |
| **Field Enumerator** | **Hidden** (Zero Project Access) | **Read-Only** (Assigned Qnrs Only) | **Submit** (Assigned Qnrs Only) | **Self-Collected Responses Only** | **No Access** |
| **Public Respondent** | Hidden | Published Public Links | Anonymous Submission | Self (Single Session) | No Access |

#### 4.3. Enumerator Isolation Guarantee
A core architectural requirement of RDIP is strict enumerator assignment isolation:
- An enumerator querying `public.questionnaires` can ONLY select questionnaires where an active record exists in `public.questionnaire_assignments`.
- An enumerator querying `public.responses` can ONLY view rows where `enumerator_id = auth.uid()`. They cannot view records collected by other field workers.
- When submitting a response, `public.responses_insert_policy` enforces that the enumerator is assigned to `questionnaire_id` before the write is accepted.

---

### 5. Versioning & Immutability Architecture

Academic research and clinical trials demand that questionnaires cannot be mutated retroactively while field responses are actively being collected.

```
       [ Draft v1.0 ]  --->  [ Testing v1.0 ]  --->  [ Published v1.0 ]
             |                                              |
      (Direct Edits)                                 (Immutable Lock)
             |                                              |
             +--------------------> [ Branch Draft v1.1 ] <-+
                                            |
                                      (Iterative Edits)
```

1. **Version States**:
   - `draft`: Questions, options, and validation rules can be freely modified or re-ordered.
   - `published`: The version is locked. No questions or options can be deleted or altered.
   - `deprecated`: Older published version superseded by a newer release.
2. **Response Anchoring**:
   - Every submitted response explicitly stores both `questionnaire_id` AND `questionnaire_version_id`.
   - If an investigator alters questions in a new release (v1.1), historical responses remain reliably anchored to v1.0's exact schema definition.

---

### 6. Data Dictionary & Codebook Engine

The Data Dictionary (`public.variables`) serves as the single source of truth for downstream statistical harmonization:

- **Standardized Naming**: Enforces snake_case or SCREAMING_SNAKE_CASE variable names (e.g., `FACILITY_TIER`, `DAILY_OUTPATIENT_VOLUME`).
- **Measurement Classification**: Strictly classifies variables into `Nominal`, `Ordinal`, `Interval`, or `Ratio` scales.
- **Categorical Coding**: Maps string option values to standardized numeric codes (e.g., `1 = Primary Health Post`, `2 = Comprehensive Health Centre`).
- **Missing Value Protocols**: Explicitly documents missing value codes (e.g., `99 = Unknown`, `-999 = Log Missing`) to prevent missing values from corrupting mean and standard deviation calculations.

---

### 7. Offline Synchronization & Telemetry Engine

- **Local Storage Buffer**: Responses collected without cellular connectivity are immediately serialized into an encrypted local buffer.
- **GPS Verification**: The collector captures geodetic WGS84 fixes (Latitude, Longitude, Altitude, Accuracy) alongside device battery and telemetry metrics.
- **Adaptive Sync Queue**:
  - When network connectivity is re-established, the background sync engine streams queued batches to `/api` or Supabase REST endpoints.
  - Idempotent UUID primary keys prevent duplicate ingestion.
  - Successfully synced records receive an immutable `synced_at` timestamp.

---

### 8. Verification & Test Evidence

The schema and security policies have been verified against the development seed scenario:
- `Dr. Chika Obi` (Lead Researcher) owns `Project A` and `Project B`.
- `Dr. Marcus Vance` (Separate Researcher) owns `Project C`.
- `John K. Adebayo` is assigned solely to `Questionnaire 1` (Facility Infrastructure).
- `Fatima Al-Mansoor` is assigned solely to `Questionnaire 2` (Medication Stockouts).
- **Result**: RLS guarantees that John Adebayo cannot read Questionnaire 2 or Project C, and Fatima cannot access Questionnaire 1. Lead researchers retain full access to their respective projects.
