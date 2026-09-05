-- ==============================================================================
-- RESEARCH DATA INTEGRATION PLATFORM (RDIP)
-- Migration 003: Seed Data & Testing Fixtures
-- Description: Isolated test and demonstration data establishing multi-project,
--              multi-questionnaire, and enumerator assignment isolation scenarios.
--              Includes production safety guards, auth foreign key validation,
--              deterministic fixture IDs, idempotent execution, and strictly
--              sequenced version publication to respect immutability triggers.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- IMPORTANT
-- ------------------------------------------------------------------------------
-- This migration contains FICTIONAL development/testing data only.
--
-- It MUST NOT be executed against a production environment with demonstration
-- fixtures enabled.
--
-- To explicitly mark the session as production:
--
--     SET rdip.environment = 'production';
--
-- When that setting is active, the ENTIRE seed operation below is skipped.
-- ------------------------------------------------------------------------------

DO $seed_block$
DECLARE
    v_env TEXT;
BEGIN

    -- ==========================================================================
    -- 0. PRODUCTION SAFETY GUARD
    -- ==========================================================================

    v_env := NULLIF(current_setting('rdip.environment', true), '');

    IF v_env = 'production' THEN
        RAISE NOTICE
            'RDIP: Production environment detected. Skipping all demonstration seed data.';
        RETURN;
    END IF;


    -- ==========================================================================
    -- 1. AUTH USERS PROVISIONING
    -- Fictional development identities only
    -- ==========================================================================

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'auth'
          AND table_name = 'users'
    ) THEN

        INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        )
        VALUES

        -- Super Administrator
        (
            '90000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'admin.security@rdip.org',
            crypt('Password123!', gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"System Security Administrator","role":"super_admin","institution":"RDIP Global Governance"}'::jsonb,
            NOW(),
            NOW()
        ),

        -- Researcher 1
        (
            'a0000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'lead.researcher@rdip.org',
            crypt('Password123!', gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Dr. Chika Obi","role":"researcher","institution":"African Institute for Health Demographics"}'::jsonb,
            NOW(),
            NOW()
        ),

        -- Researcher 2
        (
            'a0000000-0000-0000-0000-000000000002',
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'marcus.vance@rdip.org',
            crypt('Password123!', gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Dr. Marcus Vance","role":"researcher","institution":"Oxford Global Public Health Group"}'::jsonb,
            NOW(),
            NOW()
        ),

        -- Enumerator 1
        (
            'b0000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'john.adebayo@rdip.org',
            crypt('Password123!', gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"John K. Adebayo","role":"enumerator","institution":"Field Operations Corps"}'::jsonb,
            NOW(),
            NOW()
        ),

        -- Enumerator 2
        (
            'b0000000-0000-0000-0000-000000000002',
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'fatima.mansoor@rdip.org',
            crypt('Password123!', gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Fatima Al-Mansoor","role":"enumerator","institution":"Field Operations Corps"}'::jsonb,
            NOW(),
            NOW()
        ),

        -- Data Manager
        (
            'c0000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'elena.rostova@rdip.org',
            crypt('Password123!', gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Elena Rostova, MSc","role":"data_manager","institution":"Global Health Analytics Lab"}'::jsonb,
            NOW(),
            NOW()
        )

        ON CONFLICT (id) DO NOTHING;

    END IF;


    -- ==========================================================================
    -- 2. PUBLIC PROFILES
    -- ==========================================================================
    -- IMPORTANT:
    -- Do not update role/status here because 001 protects these fields from
    -- unauthorized modification. The auth.users trigger already provisions
    -- role/status from the development metadata.
    -- ==========================================================================

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        phone,
        role,
        status,
        institution,
        department
    )
    VALUES (
        '90000000-0000-0000-0000-000000000001',
        'admin.security@rdip.org',
        'System Security Administrator',
        '+1 800 555 0199',
        'super_admin',
        'active',
        'RDIP Global Governance',
        'Information Security & Architecture'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        institution = EXCLUDED.institution,
        department = EXCLUDED.department;


    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        phone,
        role,
        status,
        institution,
        department
    )
    VALUES (
        'a0000000-0000-0000-0000-000000000001',
        'lead.researcher@rdip.org',
        'Dr. Chika Obi',
        '+234 803 123 4567',
        'researcher',
        'active',
        'African Institute for Health Demographics',
        'Department of Epidemiological Surveillance'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        institution = EXCLUDED.institution,
        department = EXCLUDED.department;


    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        phone,
        role,
        status,
        institution,
        department
    )
    VALUES (
        'a0000000-0000-0000-0000-000000000002',
        'marcus.vance@rdip.org',
        'Dr. Marcus Vance',
        '+44 20 7946 0912',
        'researcher',
        'active',
        'Oxford Global Public Health Group',
        'Health Systems & Policy'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        institution = EXCLUDED.institution,
        department = EXCLUDED.department;


    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        phone,
        role,
        status,
        institution,
        department
    )
    VALUES (
        'b0000000-0000-0000-0000-000000000001',
        'john.adebayo@rdip.org',
        'John K. Adebayo',
        '+234 802 345 6789',
        'enumerator',
        'active',
        'Field Operations Corps',
        'Sub-Saharan Region Team Alpha'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        institution = EXCLUDED.institution,
        department = EXCLUDED.department;


    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        phone,
        role,
        status,
        institution,
        department
    )
    VALUES (
        'b0000000-0000-0000-0000-000000000002',
        'fatima.mansoor@rdip.org',
        'Fatima Al-Mansoor',
        '+234 814 987 6543',
        'enumerator',
        'active',
        'Field Operations Corps',
        'Sub-Saharan Region Team Beta'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        institution = EXCLUDED.institution,
        department = EXCLUDED.department;


    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        phone,
        role,
        status,
        institution,
        department
    )
    VALUES (
        'c0000000-0000-0000-0000-000000000001',
        'elena.rostova@rdip.org',
        'Elena Rostova, MSc',
        '+1 415 555 0188',
        'data_manager',
        'active',
        'Global Health Analytics Lab',
        'Biostatistics & Data Harmonization'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        institution = EXCLUDED.institution,
        department = EXCLUDED.department;


    -- ==========================================================================
    -- 3. PROJECTS
    -- ==========================================================================

    -- Project A
    INSERT INTO public.projects (
        id,
        owner_id,
        project_code,
        title,
        description,
        research_topic,
        research_design,
        institution,
        status,
        progress,
        quality_score,
        research_objectives,
        start_date,
        end_date
    )
    VALUES (
        'f0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        'RDIP-2025-001',
        'National Health Infrastructure & Emergency Readiness Assessment',
        'Comprehensive multi-facility empirical study measuring operational readiness, supply chain continuity, and cold-chain capacity across 150 primary care facilities.',
        'Public Health & Emergency Medicine',
        'Cross-Sectional Observational Study',
        'African Institute for Health Demographics',
        'collection',
        68,
        94,
        '[
            "Objective 1: Evaluate cold chain reliability and standby power in rural primary health facilities.",
            "Objective 2: Audit essential medication inventories and emergency stockouts over the trailing 90 days."
        ]'::jsonb,
        '2025-01-15',
        '2025-12-31'
    )
    ON CONFLICT (id) DO NOTHING;


    -- Project B
    INSERT INTO public.projects (
        id,
        owner_id,
        project_code,
        title,
        description,
        research_topic,
        research_design,
        institution,
        status,
        progress,
        quality_score,
        research_objectives,
        start_date,
        end_date
    )
    VALUES (
        'f0000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000001',
        'RDIP-2025-002',
        'Community Water, Sanitation & Hygiene (WASH) Longitudinal Tracking',
        'Household-level randomized observational survey examining water purification adoption and seasonal diarrheal incidence across peri-urban settlements.',
        'Environmental Epidemiology',
        'Prospective Cohort Study',
        'African Institute for Health Demographics',
        'active',
        34,
        98,
        '[
            "Objective 1: Correlate household filtration usage with documented seasonal waterborne morbidity."
        ]'::jsonb,
        '2025-03-01',
        '2026-02-28'
    )
    ON CONFLICT (id) DO NOTHING;


    -- Project C
    -- This project intentionally belongs only to Marcus Vance.
    -- It demonstrates tenant isolation.
    INSERT INTO public.projects (
        id,
        owner_id,
        project_code,
        title,
        description,
        research_topic,
        research_design,
        institution,
        status,
        progress,
        quality_score,
        research_objectives,
        start_date,
        end_date
    )
    VALUES (
        'f0000000-0000-0000-0000-000000000003',
        'a0000000-0000-0000-0000-000000000002',
        'RDIP-2025-099',
        'Regional Maternal & Neonatal Health Surveillance Registry',
        'Confidential clinical and demographic registry tracking perinatal interventions and maternal outcomes in district hospitals.',
        'Maternal & Child Health',
        'Prospective Observational Registry',
        'Oxford Global Public Health Group',
        'draft',
        15,
        99,
        '[
            "Objective 1: Benchmark postpartum hemorrhage triage compliance rates."
        ]'::jsonb,
        '2025-06-01',
        '2026-06-30'
    )
    ON CONFLICT (id) DO NOTHING;


    -- ==========================================================================
    -- 4. PROJECT COLLABORATION MEMBERSHIP
    -- ==========================================================================

    INSERT INTO public.project_members (
        id,
        project_id,
        user_id,
        role,
        permissions,
        status
    )
    VALUES (
        '40000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001',
        'data_manager',
        '{
            "can_edit": true,
            "can_analyze": true,
            "can_export": true,
            "can_manage_enumerators": true
        }'::jsonb,
        'active'
    )
    ON CONFLICT (project_id, user_id) DO NOTHING;


    -- ==========================================================================
    -- 5. QUESTIONNAIRES
    -- ==========================================================================

    INSERT INTO public.questionnaires (
        id,
        project_id,
        created_by,
        name,
        description,
        status
    )
    VALUES (
        'e0000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        'Primary Facility Infrastructure & Vaccine Cold-Chain Audit',
        'Multi-section standard field audit measuring physical facility structure, solar generator uptime, and continuous temperature logging.',
        'published'
    )
    ON CONFLICT (id) DO NOTHING;


    INSERT INTO public.questionnaires (
        id,
        project_id,
        created_by,
        name,
        description,
        status
    )
    VALUES (
        'e0000000-0000-0000-0000-000000000002',
        'f0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        'Essential Medicine Stockouts & Pharmacy Dispensing Log',
        'Audit of WHO essential obstetric and pediatric emergency drugs with shelf-life checks.',
        'published'
    )
    ON CONFLICT (id) DO NOTHING;


    -- ==========================================================================
    -- 6. QUESTIONNAIRE VERSIONS
    -- ==========================================================================
    -- All versions are initially created as DRAFT.
    -- Questions/options are added before publication.
    -- Published versions are never modified after sealing.
    -- ==========================================================================

    INSERT INTO public.questionnaire_versions (
        id,
        questionnaire_id,
        version_number,
        status,
        title,
        description
    )
    VALUES (
        'd0000000-0000-0000-0000-000000000001',
        'e0000000-0000-0000-0000-000000000001',
        '1.0',
        'draft',
        'Primary Facility Infrastructure & Cold-Chain Audit (v1.0 Production Release)',
        'Field-validated baseline version deployed for official regional data collection.'
    )
    ON CONFLICT (id) DO NOTHING;


    INSERT INTO public.questionnaire_versions (
        id,
        questionnaire_id,
        version_number,
        status,
        title,
        description
    )
    VALUES (
        'd0000000-0000-0000-0000-000000000002',
        'e0000000-0000-0000-000000000001',
        '1.1',
        'draft',
        'Primary Facility Infrastructure & Cold-Chain Audit (v1.1 Revision)',
        'Adding automated telemetry sensor questions and expanded solar battery degradation indicators.'
    )
    ON CONFLICT (id) DO NOTHING;


    INSERT INTO public.questionnaire_versions (
        id,
        questionnaire_id,
        version_number,
        status,
        title,
        description
    )
    VALUES (
        'd0000000-0000-0000-0000-000000000003',
        'e0000000-0000-0000-0000-000000000002',
        '1.0',
        'draft',
        'Essential Medicine Stockouts & Pharmacy Dispensing Log (v1.0)',
        'Baseline pharmacy stock surveillance module.'
    )
    ON CONFLICT (id) DO NOTHING;


    -- ==========================================================================
    -- 7. QUESTIONS
    -- ==========================================================================

    -- Q1: Facility Type
    INSERT INTO public.questions (
        id,
        questionnaire_version_id,
        question_number,
        section,
        question_text,
        help_text,
        variable_name,
        variable_label,
        question_type,
        data_type,
        measurement_level,
        required,
        display_order
    )
    VALUES (
        '10000000-0000-0000-0000-000000000001',
        'd0000000-0000-0000-0000-000000000001',
        'Q1',
        'Facility Identification',
        'What is the designated operational tier of this health facility?',
        'Select the official administrative tier designated by the Ministry of Health.',
        'FACILITY_TIER',
        'Health Facility Operational Tier',
        'multiple-choice',
        'Categorical',
        'Nominal',
        true,
        1
    )
    ON CONFLICT (id) DO NOTHING;


    -- Q1 Options
    INSERT INTO public.question_options (
        id,
        question_id,
        option_label,
        option_value,
        numeric_code,
        display_order
    )
    VALUES
    (
        '11000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'Primary Health Care Post (PHC-P)',
        'phc_post',
        1,
        1
    ),
    (
        '11000000-0000-0000-0000-000000000002',
        '10000000-0000-0000-0000-000000000001',
        'Primary Health Centre (PHC)',
        'phc_centre',
        2,
        2
    ),
    (
        '11000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000001',
        'Comprehensive Health Centre (CHC)',
        'chc',
        3,
        3
    ),
    (
        '11000000-0000-0000-0000-000000000004',
        '10000000-0000-0000-0000-000000000001',
        'General / District Hospital',
        'district_hosp',
        4,
        4
    )
    ON CONFLICT (id) DO NOTHING;


    -- Q2: Daily Patient Volume
    INSERT INTO public.questions (
        id,
        questionnaire_version_id,
        question_number,
        section,
        question_text,
        help_text,
        variable_name,
        variable_label,
        question_type,
        data_type,
        measurement_level,
        required,
        display_order
    )
    VALUES (
        '10000000-0000-0000-0000-000000000002',
        'd0000000-0000-0000-0000-000000000001',
        'Q2',
        'Operational Capacity',
        'Average daily outpatient consultations over the preceding 30 days:',
        'Calculate total registered outpatients divided by 30 calendar days.',
        'DAILY_OUTPATIENT_VOLUME',
        'Average 30-Day Daily Outpatient Volume',
        'number',
        'Numerical',
        'Ratio',
        true,
        2
    )
    ON CONFLICT (id) DO NOTHING;


    -- Q3: Functional Vaccine Refrigerator
    INSERT INTO public.questions (
        id,
        questionnaire_version_id,
        question_number,
        section,
        question_text,
        help_text,
        variable_name,
        variable_label,
        question_type,
        data_type,
        measurement_level,
        required,
        display_order
    )
    VALUES (
        '10000000-0000-0000-0000-000000000003',
        'd0000000-0000-0000-0000-000000000001',
        'Q3',
        'Vaccine Cold Chain Infrastructure',
        'Does the facility have at least one functional solar direct-drive vaccine refrigerator?',
        'Inspect the cold room or immunization storage area directly.',
        'HAS_FUNCTIONAL_VACCINE_FRIDGE',
        'Functional Vaccine Refrigerator Present',
        'multiple-choice',
        'Categorical',
        'Nominal',
        true,
        3
    )
    ON CONFLICT (id) DO NOTHING;


    -- Q3 Options
    INSERT INTO public.question_options (
        id,
        question_id,
        option_label,
        option_value,
        numeric_code,
        display_order
    )
    VALUES
    (
        '11000000-0000-0000-0000-000000000005',
        '10000000-0000-0000-0000-000000000003',
        'Yes, fully operational (Within +2°C to +8°C)',
        'yes_operational',
        1,
        1
    ),
    (
        '11000000-0000-0000-0000-000000000006',
        '10000000-0000-0000-0000-000000000003',
        'Present but malfunctioning / temperature out of range',
        'present_malfunctioning',
        2,
        2
    ),
    (
        '11000000-0000-0000-0000-000000000007',
        '10000000-0000-0000-0000-000000000003',
        'No functional refrigerator installed',
        'no_refrigerator',
        0,
        3
    )
    ON CONFLICT (id) DO NOTHING;


    -- Q4: GPS Coordinates
    INSERT INTO public.questions (
        id,
        questionnaire_version_id,
        question_number,
        section,
        question_text,
        help_text,
        variable_name,
        variable_label,
        question_type,
        data_type,
        measurement_level,
        required,
        display_order,
        gps_config
    )
    VALUES (
        '10000000-0000-0000-0000-000000000004',
        'd0000000-0000-0000-0000-000000000001',
        'Q4',
        'Geographic Verification',
        'Acquire geodetic GPS coordinates (Latitude, Longitude, Altitude) at the clinic entrance.',
        'Wait for GPS sensor horizontal accuracy to reach <= 10 meters before recording fix.',
        'FACILITY_GPS_COORDINATES',
        'Clinic Entrance Geodetic Coordinates (WGS84)',
        'geolocation',
        'Continuous',
        'Ratio',
        true,
        4,
        '{
            "captureMode": "point",
            "accuracyThresholdMeters": 10,
            "requireAltitude": true,
            "allowManualEntry": false
        }'::jsonb
    )
    ON CONFLICT (id) DO NOTHING;


    -- ==========================================================================
    -- 8. PUBLISH QUESTIONNAIRE VERSIONS
    -- ==========================================================================
    -- IMPORTANT:
    -- Only draft versions are promoted.
    -- If the version is already published, no UPDATE is attempted.
    -- This protects against conflicts with the immutability triggers.
    -- ==========================================================================

    UPDATE public.questionnaire_versions
    SET
        status = 'published',
        published_by = 'a0000000-0000-0000-0000-000000000001',
        published_at = COALESCE(
            published_at,
            '2025-01-20 09:00:00+00'::timestamptz
        )
    WHERE id = 'd0000000-0000-0000-0000-000000000001'
      AND status = 'draft';


    UPDATE public.questionnaire_versions
    SET
        status = 'published',
        published_by = 'a0000000-0000-0000-0000-000000000001',
        published_at = COALESCE(
            published_at,
            '2025-01-22 10:30:00+00'::timestamptz
        )
    WHERE id = 'd0000000-0000-0000-0000-000000000003'
      AND status = 'draft';


    -- ==========================================================================
    -- 9. CURRENT VERSION POINTERS
    -- ==========================================================================

    UPDATE public.questionnaires
    SET current_version_id = 'd0000000-0000-0000-0000-000000000001'
    WHERE id = 'e0000000-0000-0000-0000-000000000001'
      AND (
          current_version_id IS DISTINCT FROM
          'd0000000-0000-0000-0000-000000000001'
      );


    UPDATE public.questionnaires
    SET current_version_id = 'd0000000-0000-0000-0000-000000000003'
    WHERE id = 'e0000000-0000-0000-0000-000000000002'
      AND (
          current_version_id IS DISTINCT FROM
          'd0000000-0000-0000-0000-000000000003'
      );


    -- ==========================================================================
    -- 10. VARIABLE DICTIONARY
    -- ==========================================================================

    INSERT INTO public.variables (
        id,
        project_id,
        questionnaire_id,
        question_id,
        variable_name,
        variable_label,
        data_type,
        measurement_level,
        possible_values,
        codes,
        missing_value_rules,
        research_objective
    )
    VALUES

    (
        '30000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000001',
        'e0000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'FACILITY_TIER',
        'Health Facility Operational Tier',
        'Categorical',
        'Nominal',
        '[
            "phc_post",
            "phc_centre",
            "chc",
            "district_hosp"
        ]'::jsonb,
        '[
            {"code": 1, "label": "PHC Post"},
            {"code": 2, "label": "PHC Centre"},
            {"code": 3, "label": "CHC"},
            {"code": 4, "label": "District Hospital"}
        ]'::jsonb,
        '{"code": "99", "label": "Unknown / Unregistered"}'::jsonb,
        'Objective 1: Stratify emergency equipment availability across public health service tiers.'
    ),

    (
        '30000000-0000-0000-0000-000000000002',
        'f0000000-0000-0000-0000-000000000001',
        'e0000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000002',
        'DAILY_OUTPATIENT_VOLUME',
        'Average 30-Day Daily Outpatient Volume',
        'Numerical',
        'Ratio',
        '[]'::jsonb,
        '[]'::jsonb,
        '{"code": "-999", "label": "Register Missing / Incomplete"}'::jsonb,
        'Objective 2: Test correlation between patient throughput and medication stockout rates.'
    ),

    (
        '30000000-0000-0000-0000-000000000003',
        'f0000000-0000-0000-0000-000000000001',
        'e0000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000003',
        'HAS_FUNCTIONAL_VACCINE_FRIDGE',
        'Functional Vaccine Refrigerator Present',
        'Categorical',
        'Nominal',
        '[
            "yes_operational",
            "present_malfunctioning",
            "no_refrigerator"
        ]'::jsonb,
        '[
            {"code": 1, "label": "Yes, operational"},
            {"code": 2, "label": "Malfunctioning"},
            {"code": 0, "label": "None"}
        ]'::jsonb,
        '{"code": "9", "label": "Storage Not Inspected"}'::jsonb,
        'Objective 1: Evaluate cold chain reliability and standby power in rural primary health facilities.'
    )

    ON CONFLICT (id) DO NOTHING;


    -- ==========================================================================
    -- 11. QUESTIONNAIRE ASSIGNMENTS
    -- ==========================================================================

    -- John Adebayo -> Questionnaire 1 ONLY
    INSERT INTO public.questionnaire_assignments (
        id,
        questionnaire_id,
        questionnaire_version_id,
        enumerator_id,
        assigned_by,
        status,
        permissions
    )
    VALUES (
        '80000000-0000-0000-0000-000000000001',
        'e0000000-0000-0000-0000-000000000001',
        'd0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        'active',
        '{
            "can_collect": true,
            "can_view_history": true,
            "can_edit_drafts": true
        }'::jsonb
    )
    ON CONFLICT (questionnaire_id, enumerator_id) DO NOTHING;


    -- Fatima Al-Mansoor -> Questionnaire 2 ONLY
    INSERT INTO public.questionnaire_assignments (
        id,
        questionnaire_id,
        questionnaire_version_id,
        enumerator_id,
        assigned_by,
        status,
        permissions
    )
    VALUES (
        '80000000-0000-0000-0000-000000000002',
        'e0000000-0000-0000-0000-000000000002',
        'd0000000-0000-0000-0000-000000000003',
        'b0000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000001',
        'active',
        '{
            "can_collect": true,
            "can_view_history": true,
            "can_edit_drafts": true
        }'::jsonb
    )
    ON CONFLICT (questionnaire_id, enumerator_id) DO NOTHING;


    -- ==========================================================================
    -- 12. RESPONSES
    -- ==========================================================================

    INSERT INTO public.responses (
        id,
        project_id,
        questionnaire_id,
        questionnaire_version_id,
        enumerator_id,
        respondent_id,
        collection_status,
        collected_offline,
        gps_coordinates,
        telemetry,
        submitted_at,
        synced_at
    )
    VALUES (
        '70000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000001',
        'e0000000-0000-0000-0000-000000000001',
        'd0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000001',
        'CLINIC-KUBWA-01',
        'synced',
        true,
        '{
            "latitude": 9.076479,
            "longitude": 7.398574,
            "altitude": 482.5,
            "accuracy": 3.4
        }'::jsonb,
        '{
            "batteryLevel": 88,
            "syncLatencyMs": 1420,
            "deviceId": "SM-G991B-SEC-01"
        }'::jsonb,
        '2025-02-10 11:32:00+00',
        '2025-02-10 11:32:02+00'
    )
    ON CONFLICT (id) DO NOTHING;


    -- ==========================================================================
    -- 13. RESPONSE ANSWERS
    -- ==========================================================================
    -- Deterministic IDs are used so repeated seed execution cannot create
    -- duplicate response-answer rows.
    -- ==========================================================================

    INSERT INTO public.response_answers (
        id,
        response_id,
        question_id,
        variable_name,
        answer_value,
        text_value,
        numeric_value
    )
    VALUES

    (
        '71000000-0000-0000-0000-000000000001',
        '70000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        'FACILITY_TIER',
        '"phc_centre"'::jsonb,
        'phc_centre',
        2
    ),

    (
        '71000000-0000-0000-0000-000000000002',
        '70000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000002',
        'DAILY_OUTPATIENT_VOLUME',
        '124'::jsonb,
        '124',
        124
    ),

    (
        '71000000-0000-0000-0000-000000000003',
        '70000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000003',
        'HAS_FUNCTIONAL_VACCINE_FRIDGE',
        '"yes_operational"'::jsonb,
        'yes_operational',
        1
    ),

    (
        '71000000-0000-0000-0000-000000000004',
        '70000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000004',
        'FACILITY_GPS_COORDINATES',
        '{
            "latitude": 9.076479,
            "longitude": 7.398574,
            "altitude": 482.5,
            "accuracy": 3.4
        }'::jsonb,
        '9.076479, 7.398574',
        NULL
    )

    ON CONFLICT (id) DO NOTHING;


    -- ==========================================================================
    -- 14. DATA QUALITY ISSUES
    -- ==========================================================================

    INSERT INTO public.data_quality_issues (
        id,
        project_id,
        response_id,
        variable_name,
        issue_type,
        severity,
        details,
        status
    )
    VALUES (
        '60000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000001',
        '70000000-0000-0000-0000-000000000001',
        'DAILY_OUTPATIENT_VOLUME',
        'outlier',
        'low',
        'Daily outpatient volume of 124 is 1.8 standard deviations above the regional median of 72 for Primary Health Centres.',
        'pending'
    )
    ON CONFLICT (id) DO NOTHING;


    -- ==========================================================================
    -- 15. STATISTICAL ANALYSIS FIXTURE
    -- ==========================================================================

    INSERT INTO public.statistical_analyses (
        id,
        project_id,
        title,
        analysis_type,
        statistical_test,
        variables_used,
        parameters,
        results,
        p_value,
        interpretation,
        executed_by
    )
    VALUES (
        '50000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000001',
        'Chi-Square Test: Facility Tier vs. Vaccine Refrigerator Operational Status',
        'Non-Parametric',
        'chi-square',
        ARRAY[
            'FACILITY_TIER',
            'HAS_FUNCTIONAL_VACCINE_FRIDGE'
        ],
        '{
            "alpha": 0.05,
            "yates_correction": true
        }'::jsonb,
        '{
            "chi_square_statistic": 14.82,
            "degrees_of_freedom": 6,
            "critical_value": 12.59
        }'::jsonb,
        0.0216,
        'Statistically significant association between facility operational tier and the presence of a functional solar vaccine refrigerator (p = 0.0216 < 0.05).',
        'c0000000-0000-0000-0000-000000000001'
    )
    ON CONFLICT (id) DO NOTHING;


    -- ==========================================================================
    -- 16. AUDIT LOGS
    -- ==========================================================================
    -- Deterministic IDs make the demonstration audit fixtures idempotent.
    -- No UPDATE or DELETE operation is performed against audit_logs.
    -- ==========================================================================

    INSERT INTO public.audit_logs (
        id,
        user_id,
        action,
        entity_type,
        entity_id,
        details
    )
    VALUES

    (
        '90000000-0000-0000-0000-000000000010',
        'a0000000-0000-0000-0000-000000000001',
        'PROJECT_INITIALIZATION',
        'project',
        'f0000000-0000-0000-0000-000000000001',
        '{
            "title": "National Health Infrastructure & Emergency Readiness Assessment",
            "code": "RDIP-2025-001"
        }'::jsonb
    ),

    (
        '90000000-0000-0000-0000-000000000011',
        'a0000000-0000-0000-0000-000000000001',
        'QUESTIONNAIRE_PUBLISHED',
        'questionnaire_version',
        'd0000000-0000-0000-0000-000000000001',
        '{
            "version": "1.0",
            "questionnaireName": "Primary Facility Infrastructure & Vaccine Cold-Chain Audit"
        }'::jsonb
    ),

    (
        '90000000-0000-0000-0000-000000000012',
        'a0000000-0000-0000-0000-000000000001',
        'ENUMERATOR_ASSIGNED',
        'questionnaire_assignment',
        '80000000-0000-0000-0000-000000000001',
        '{
            "enumerator": "John K. Adebayo",
            "questionnaire": "Primary Facility Infrastructure & Vaccine Cold-Chain Audit"
        }'::jsonb
    )

    ON CONFLICT (id) DO NOTHING;


    -- ==========================================================================
    -- FINAL SUCCESS MESSAGE
    -- ==========================================================================

    RAISE NOTICE
        'RDIP: Demonstration seed fixtures populated successfully.';

END $seed_block$;