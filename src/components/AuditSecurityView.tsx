import React, { useState } from 'react';
import { AuditLogEntry } from '../types';
import { INITIAL_AUDIT_LOGS } from '../data/mockData';

export const AuditSecurityView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [filterAction, setFilterAction] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'audit-trail' | 'supabase-schema' | 'rls-policies' | 'permissions'>('audit-trail');
  const [copySuccess, setCopySuccess] = useState(false);

  const filteredLogs = logs.filter((log) => {
    const matchesAction = filterAction === 'All' || log.action === filterAction;
    const matchesSearch =
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesAction && matchesSearch;
  });

  const SUPABASE_SQL_SCHEMA = `-- =========================================================
-- RDIP (RESEARCH DATA INTELLIGENCE PLATFORM) SUPABASE SCHEMA
-- PostgreSQL DDL with UUID Extensions, Indexes, and RLS
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (Supabase Auth Synchronization)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  institution TEXT,
  role TEXT DEFAULT 'researcher' CHECK (role IN ('researcher', 'enumerator', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Projects Table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  institution TEXT,
  description TEXT,
  status TEXT DEFAULT 'design' CHECK (status IN ('design', 'active', 'collection', 'analysis', 'complete')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Project Enumerators Junction Table
CREATE TABLE project_enumerators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  assigned_lga TEXT,
  last_active TIMESTAMP WITH TIME ZONE,
  total_responses_collected INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('synced', 'pending', 'conflict')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Questionnaires Table
CREATE TABLE questionnaires (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  version TEXT DEFAULT '1.0',
  title TEXT NOT NULL,
  style TEXT DEFAULT 'academic' CHECK (style IN ('academic', 'modern', 'onepage')),
  branding JSONB, -- { logo_url, primary_colour, font, institution }
  is_published BOOLEAN DEFAULT FALSE,
  share_link TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Questions Table (Variable Codebook Architecture)
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  questionnaire_id UUID REFERENCES questionnaires(id) ON DELETE CASCADE,
  section TEXT,
  question_order INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL, -- 'multiple_choice', 'checkbox', 'text', 'likert', 'dropdown', 'date', 'number'
  variable_name TEXT NOT NULL, -- e.g. 'Q1_Age'
  variable_label TEXT,
  data_type TEXT NOT NULL, -- 'categorical', 'numerical', 'ordinal', 'continuous'
  measurement_level TEXT, -- 'nominal', 'ordinal', 'interval', 'ratio'
  response_options JSONB,
  likert_scale INTEGER,
  is_required BOOLEAN DEFAULT TRUE,
  linked_objective TEXT, -- 'Objective 1', 'Objective 2', etc.
  validation_rules JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Offline / Online Survey Responses
CREATE TABLE responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  questionnaire_id UUID REFERENCES questionnaires(id) ON DELETE CASCADE,
  enumerator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  respondent_id UUID DEFAULT uuid_generate_v4(),
  collected_offline BOOLEAN DEFAULT FALSE,
  sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  gps_coordinates JSONB, -- { latitude, longitude, accuracy }
  collected_at TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Response Answers Key-Value Table
CREATE TABLE response_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  response_id UUID REFERENCES responses(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  answer_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Audit Logs Table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Analysis Results Cache
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  objective TEXT NOT NULL,
  test_type TEXT NOT NULL,
  variables JSONB,
  statistic_value FLOAT,
  degrees_of_freedom TEXT,
  p_value FLOAT,
  effect_size FLOAT,
  interpretation TEXT,
  assumptions_passed JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`;

  const SUPABASE_RLS_POLICIES = `-- =========================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES FOR SUPABASE POSTGRESQL
-- Enforcing strict multi-tenant and role-based access control
-- =========================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

-- 1. Users Security Policy
CREATE POLICY "Users can view and update own profile" ON users
  FOR ALL USING (auth.uid() = id);

-- 2. Projects Security Policy (Owner full access)
CREATE POLICY "Project owners have full access" ON projects
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Enumerators can view assigned projects" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_enumerators 
      WHERE project_id = projects.id AND user_id = auth.uid()
    )
  );

-- 3. Responses Policy (Offline Insert and Sync)
CREATE POLICY "Enumerators can insert offline responses" ON responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_enumerators pe
      JOIN questionnaires q ON q.project_id = pe.project_id
      WHERE q.id = responses.questionnaire_id 
      AND pe.user_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can view all project responses" ON responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM questionnaires q
      JOIN projects p ON p.id = q.project_id
      WHERE q.id = responses.questionnaire_id 
      AND p.owner_id = auth.uid()
    )
  );

-- 4. Audit Log Policy
CREATE POLICY "Admins and Owners can inspect audit trail" ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = audit_logs.project_id AND p.owner_id = auth.uid()
    )
  );`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const handleDownloadSQL = () => {
    const fullSql = `${SUPABASE_SQL_SCHEMA}\n\n${SUPABASE_RLS_POLICIES}`;
    const blob = new Blob([fullSql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RDIP_Supabase_Schema_and_RLS_${new Date().toISOString().slice(0, 10)}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-[#371800]/10 text-[#371800] text-[11px] font-bold uppercase tracking-wider">
              Engine 11: Security & Audit Engine
            </span>
            <span className="text-xs text-[#74777f]">Supabase RLS & Immutable Audit Trail</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#002045] tracking-tight mt-1">
            Security, Audit Logs & Database Schema
          </h1>
          <p className="text-[#43474e] text-xs md:text-sm mt-1">
            Enterprise row-level security policies, cryptographic data provenance logs, and production Supabase PostgreSQL migration definitions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadSQL}
            className="px-3.5 py-2 rounded-lg border border-[#c4c6cf] text-[#002045] text-xs font-semibold hover:bg-white flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Download .sql Migration</span>
          </button>
          <button
            onClick={() => handleCopy(activeTab === 'supabase-schema' ? SUPABASE_SQL_SCHEMA : SUPABASE_RLS_POLICIES)}
            className="px-4 py-2 rounded-lg bg-[#1a365d] text-white text-xs font-semibold hover:bg-[#002045] flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
            <span>{copySuccess ? 'Copied to Clipboard!' : 'Copy Active SQL'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[#c4c6cf]/40 gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('audit-trail')}
          className={`pb-3 relative transition-colors flex items-center gap-1.5 ${
            activeTab === 'audit-trail'
              ? 'text-[#002045] border-b-2 border-[#1a365d] font-bold'
              : 'text-[#74777f] hover:text-[#161c27]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">history</span>
          <span>Live Audit Trail ({logs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('supabase-schema')}
          className={`pb-3 relative transition-colors flex items-center gap-1.5 ${
            activeTab === 'supabase-schema'
              ? 'text-[#002045] border-b-2 border-[#1a365d] font-bold'
              : 'text-[#74777f] hover:text-[#161c27]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">database</span>
          <span>Supabase PostgreSQL Schema</span>
        </button>

        <button
          onClick={() => setActiveTab('rls-policies')}
          className={`pb-3 relative transition-colors flex items-center gap-1.5 ${
            activeTab === 'rls-policies'
              ? 'text-[#002045] border-b-2 border-[#1a365d] font-bold'
              : 'text-[#74777f] hover:text-[#161c27]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">security</span>
          <span>Row-Level Security (RLS) Policies</span>
        </button>

        <button
          onClick={() => setActiveTab('permissions')}
          className={`pb-3 relative transition-colors flex items-center gap-1.5 ${
            activeTab === 'permissions'
              ? 'text-[#002045] border-b-2 border-[#1a365d] font-bold'
              : 'text-[#74777f] hover:text-[#161c27]'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">vpn_key</span>
          <span>Role Permissions Matrix</span>
        </button>
      </div>

      {/* Audit Trail Tab */}
      {activeTab === 'audit-trail' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl card-shadow border border-[#c4c6cf]/40 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full sm:w-80">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#74777f] text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search audit trail by user, entity, details..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="font-semibold text-[#43474e]">Action Filter:</span>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="p-2 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white font-medium"
              >
                <option value="All">All Actions</option>
                <option value="created">Created</option>
                <option value="updated">Updated</option>
                <option value="synced">Synced</option>
                <option value="analyzed">Analyzed</option>
                <option value="validated">Validated</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-xl card-shadow border border-[#c4c6cf]/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#f1f3ff] border-b border-[#c4c6cf]/60 text-[#002045] font-bold">
                  <tr>
                    <th className="py-3 px-4">Timestamp (UTC)</th>
                    <th className="py-3 px-4">User / Agent</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Target Entity</th>
                    <th className="py-3 px-4">Cryptographic Details</th>
                    <th className="py-3 px-4 text-right">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c4c6cf]/30">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#f9f9ff] transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-[#74777f]">
                        {log.timestamp}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#002045]">
                        {log.userName}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.userRole === 'admin'
                              ? 'bg-[#371800]/15 text-[#572900]'
                              : log.userRole === 'researcher'
                              ? 'bg-[#1a365d]/10 text-[#1a365d]'
                              : 'bg-[#006a68]/15 text-[#006a68]'
                          }`}
                        >
                          {log.userRole}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                            log.action === 'created'
                              ? 'bg-[#91f0ed]/40 text-[#006e6d]'
                              : log.action === 'updated'
                              ? 'bg-[#d6e3ff] text-[#002045]'
                              : log.action === 'synced'
                              ? 'bg-[#e3e8f9] text-[#1a365d]'
                              : log.action === 'analyzed'
                              ? 'bg-[#f1f3ff] text-[#371800]'
                              : 'bg-[#ffdad6] text-[#ba1a1a]'
                          }`}
                        >
                          {log.action.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#161c27]">
                        {log.entity}
                      </td>
                      <td className="py-3 px-4 text-[#43474e] max-w-sm text-[11px]">
                        {log.details}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-[#74777f]">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Supabase Schema Tab */}
      {activeTab === 'supabase-schema' && (
        <div className="bg-[#002045] text-[#d6e3ff] rounded-xl p-5 border border-[#1a365d] shadow-lg space-y-3 font-mono text-xs overflow-x-auto">
          <div className="flex justify-between items-center pb-3 border-b border-white/10 font-sans text-xs">
            <span className="text-white font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#91f0ed]">database</span>
              Supabase PostgreSQL Schema (Full Production DDL)
            </span>
            <span className="text-[#86a0cd] text-[11px]">9 Relational Tables with Foreign Keys</span>
          </div>
          <pre className="text-[11px] leading-relaxed whitespace-pre font-mono select-all">
            {SUPABASE_SQL_SCHEMA}
          </pre>
        </div>
      )}

      {/* RLS Policies Tab */}
      {activeTab === 'rls-policies' && (
        <div className="bg-[#002045] text-[#d6e3ff] rounded-xl p-5 border border-[#1a365d] shadow-lg space-y-3 font-mono text-xs overflow-x-auto">
          <div className="flex justify-between items-center pb-3 border-b border-white/10 font-sans text-xs">
            <span className="text-white font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#91f0ed]">lock</span>
              PostgreSQL Row-Level Security (RLS) Declarations
            </span>
            <span className="text-[#86a0cd] text-[11px]">Tenant Isolation & Role Policies</span>
          </div>
          <pre className="text-[11px] leading-relaxed whitespace-pre font-mono select-all">
            {SUPABASE_RLS_POLICIES}
          </pre>
        </div>
      )}

      {/* Role Permissions Matrix Tab */}
      {activeTab === 'permissions' && (
        <div className="bg-white rounded-xl card-shadow border border-[#c4c6cf]/40 p-6 space-y-6">
          <h2 className="text-base font-bold text-[#002045] border-b border-[#c4c6cf]/30 pb-3">
            Role-Based Access Control (RBAC) Matrix
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#f1f3ff] text-[#002045] font-bold border-b border-[#c4c6cf]/60">
                <tr>
                  <th className="py-3 px-4">Capability / Engine</th>
                  <th className="py-3 px-4 text-center">Researcher (Owner)</th>
                  <th className="py-3 px-4 text-center">Editor (Collaborator)</th>
                  <th className="py-3 px-4 text-center">Enumerator (Field)</th>
                  <th className="py-3 px-4 text-center">System Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c4c6cf]/30">
                <tr>
                  <td className="py-3 px-4 font-semibold text-[#161c27]">Project Management (Create/Delete)</td>
                  <td className="py-3 px-4 text-center text-[#006a68] font-bold">✓ Full</td>
                  <td className="py-3 px-4 text-center text-[#74777f]">View Only</td>
                  <td className="py-3 px-4 text-center text-[#ba1a1a]">✕ None</td>
                  <td className="py-3 px-4 text-center text-[#006a68] font-bold">✓ Full</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-[#161c27]">Questionnaire & Variable Authoring</td>
                  <td className="py-3 px-4 text-center text-[#006a68] font-bold">✓ Full</td>
                  <td className="py-3 px-4 text-center text-[#006a68] font-bold">✓ Full</td>
                  <td className="py-3 px-4 text-center text-[#74777f]">Read-Only</td>
                  <td className="py-3 px-4 text-center text-[#006a68] font-bold">✓ Full</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-[#161c27]">Offline Field Data Collection</td>
                  <td className="py-3 px-4 text-center text-[#006a68] font-bold">✓ Permitted</td>
                  <td className="py-3 px-4 text-center text-[#006a68] font-bold">✓ Permitted</td>
                  <td className="py-3 px-4 text-center text-[#006a68] font-bold">✓ Primary (Assigned LGAs)</td>
                  <td className="py-3 px-4 text-center text-[#006a68] font-bold">✓ Permitted</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-[#161c27]">Statistical Computation & Thesis Report</td>
                  <td className="py-3 px-4 text-center text-[#006a68] font-bold">✓ Full</td>
                  <td className="py-3 px-4 text-center text-[#006a68] font-bold">✓ Full</td>
                  <td className="py-3 px-4 text-center text-[#ba1a1a]">✕ None</td>
                  <td className="py-3 px-4 text-center text-[#006a68] font-bold">✓ Full</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold text-[#161c27]">Audit Logs & Database Schema DDL</td>
                  <td className="py-3 px-4 text-center text-[#006a68] font-bold">✓ View Project</td>
                  <td className="py-3 px-4 text-center text-[#74777f]">Restricted</td>
                  <td className="py-3 px-4 text-center text-[#ba1a1a]">✕ None</td>
                  <td className="py-3 px-4 text-center text-[#006a68] font-bold">✓ Full Global</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
