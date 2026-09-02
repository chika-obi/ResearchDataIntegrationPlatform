import React, { useState, useEffect } from 'react';
import { INITIAL_USER } from '../data/mockData';
import { UserProfile } from '../types';
import { getSupabaseConfig, saveSupabaseConfig, checkSupabaseConnection, SupabaseHealthCheckResult } from '../lib/supabase';

interface SettingsViewProps {
  currentUser?: UserProfile;
  onUpdateUser?: (user: UserProfile) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onUpdateUser
}) => {
  const [user, setUser] = useState<UserProfile>(() => {
    if (currentUser) return currentUser;
    const saved = localStorage.getItem('rdip_user_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_USER;
      }
    }
    return INITIAL_USER;
  });

  useEffect(() => {
    if (currentUser) {
      setUser(currentUser);
    }
  }, [currentUser]);
  const [storageUsed, setStorageUsed] = useState(14.8);
  const [e2eEnabled, setE2eEnabled] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Supabase Connection State
  const [supabaseUrl, setSupabaseUrl] = useState(() => getSupabaseConfig().supabaseUrl);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(() => getSupabaseConfig().supabaseAnonKey);
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<SupabaseHealthCheckResult | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [supabaseSaveMessage, setSupabaseSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    // Initial connection check
    handleTestConnection();
  }, []);

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    const result = await checkSupabaseConnection();
    setConnectionStatus(result);
    setIsTestingConnection(false);
  };

  const handleSaveSupabaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(supabaseUrl, supabaseAnonKey);
    setSupabaseSaveMessage('Supabase credentials saved and active.');
    handleTestConnection();
    setTimeout(() => setSupabaseSaveMessage(null), 3000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const newAvatar = event.target.result as string;
          const updated = { ...user, avatar: newAvatar };
          setUser(updated);
          localStorage.setItem('rdip_user_profile', JSON.stringify(updated));
          if (onUpdateUser) {
            onUpdateUser(updated);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('rdip_user_profile', JSON.stringify(user));
    if (onUpdateUser) {
      onUpdateUser(user);
    }
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleClearCache = () => {
    if (confirm('Clear local offline cached datasets and temporary schemas?')) {
      setStorageUsed(0.4);
      alert('Local storage cache purged.');
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-[#002045] tracking-tight">
          Platform Settings & Cloud Integration
        </h1>
        <p className="text-[#43474e] text-sm md:text-base mt-1">
          Manage Supabase connection, researcher credentials, data encryption policies, and offline storage allocation.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-[#e3e8f9] border border-[#adc7f7] rounded-xl text-xs font-semibold text-[#002045] flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[#006a68]">check_circle</span>
          <span>Researcher profile and encryption parameters updated successfully.</span>
        </div>
      )}

      {/* Supabase Live Connection Card */}
      <div className="bg-white rounded-xl card-shadow border border-[#c4c6cf]/40 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#c4c6cf]/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#006a68]/10 text-[#006a68] flex items-center justify-center border border-[#006a68]/20">
              <span className="material-symbols-outlined text-2xl">database</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#002045]">Supabase Cloud Database & Auth</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                  connectionStatus?.connected ? 'bg-[#91f0ed]/40 text-[#004f4e] border border-[#006a68]/30' : 'bg-[#ffdad6] text-[#93000a]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus?.connected ? 'bg-[#006a68] animate-pulse' : 'bg-[#ba1a1a]'}`} />
                  {connectionStatus?.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <p className="text-xs text-[#43474e] mt-0.5">
                Connected to project instance for live table synchronization and role-level security.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            className="px-3.5 py-1.5 rounded-lg border border-[#c4c6cf] text-[#1a365d] hover:bg-[#f1f3ff] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${isTestingConnection ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{isTestingConnection ? 'Testing...' : 'Test Connection'}</span>
          </button>
        </div>

        {supabaseSaveMessage && (
          <div className="p-3 bg-[#e3e8f9] border border-[#adc7f7] rounded-xl text-xs font-semibold text-[#002045] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[#006a68]">check_circle</span>
            <span>{supabaseSaveMessage}</span>
          </div>
        )}

        {/* Connection Diagnostics Banner */}
        {connectionStatus && (
          <div className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            connectionStatus.connected
              ? 'bg-[#f1f3ff] border-[#c4c6cf]/60 text-[#002045]'
              : 'bg-[#ffdad6]/40 border-[#ffdad6] text-[#410002]'
          }`}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#006a68]">
                {connectionStatus.connected ? 'verified' : 'error'}
              </span>
              <span className="font-medium">{connectionStatus.message}</span>
            </div>
            {connectionStatus.latencyMs !== undefined && (
              <span className="font-mono text-[11px] text-[#43474e] bg-white px-2 py-0.5 rounded border border-[#c4c6cf]/40 shrink-0">
                Latency: {connectionStatus.latencyMs}ms
              </span>
            )}
          </div>
        )}

        {/* Supabase Configuration Form */}
        <form onSubmit={handleSaveSupabaseConfig} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-[#161c27] mb-1">
                Supabase Project URL
              </label>
              <input
                type="url"
                required
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none font-mono text-xs"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-[#161c27]">
                  Publishable / Anon API Key
                </label>
                <button
                  type="button"
                  onClick={() => setIsKeyVisible(!isKeyVisible)}
                  className="text-[#1a365d] hover:underline text-[11px]"
                >
                  {isKeyVisible ? 'Hide Key' : 'Show Key'}
                </button>
              </div>
              <input
                type={isKeyVisible ? 'text' : 'password'}
                required
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                placeholder="sb_publishable_..."
                className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-[#74777f]">
              Row-Level Security (RLS) policies and authentication tokens are evaluated securely.
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#006a68] text-white text-xs font-semibold hover:bg-[#004f4e] transition-colors shadow-xs"
            >
              Update Supabase Credentials
            </button>
          </div>
        </form>
      </div>

      {/* User Profile Card */}
      <div className="bg-white rounded-xl card-shadow border border-[#c4c6cf]/40 p-6">
        <h2 className="text-base font-bold text-[#002045] border-b border-[#c4c6cf]/30 pb-3 mb-6">
          Researcher Profile
        </h2>

        {saveSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-[#91f0ed]/30 border border-[#006a68]/40 text-[#006e6d] text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>Profile and custom photo saved successfully!</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 pb-4 border-b border-[#c4c6cf]/20">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#1a365d] bg-[#dde2f3] shrink-0 shadow-xs">
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div className="text-center sm:text-left space-y-1">
              <h3 className="font-bold text-[#002045] text-base">{user.name}</h3>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="px-2.5 py-0.5 rounded bg-[#1a365d]/10 text-[#1a365d] text-[11px] font-bold uppercase border border-[#1a365d]/20">
                  {user.role}
                </span>
                <label className="cursor-pointer px-2.5 py-1 bg-white border border-[#c4c6cf] hover:border-[#1a365d] text-[#1a365d] rounded text-[11px] font-semibold hover:bg-[#f1f3ff] transition-all inline-flex items-center gap-1 shadow-2xs">
                  <span className="material-symbols-outlined text-[14px]">upload</span>
                  <span>Upload Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="text-xs font-semibold text-[#1a365d] pt-0.5">
                {user.institution}
              </div>
              <p className="text-xs text-[#74777f]">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-[#161c27] mb-1">Full Name</label>
              <input
                type="text"
                value={user.name}
                onChange={(e) => setUser({ ...user, name: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#161c27] mb-1">Affiliated Institution</label>
              <input
                type="text"
                value={user.institution}
                onChange={(e) => setUser({ ...user, institution: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#1a365d] text-white text-xs font-semibold hover:bg-[#002045] transition-colors"
            >
              Save Profile Changes
            </button>
          </div>
        </form>
      </div>

      {/* Security & Offline Storage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Security / Encryption */}
        <div className="bg-white rounded-xl card-shadow border border-[#c4c6cf]/40 p-6 space-y-4">
          <h2 className="text-base font-bold text-[#002045] border-b border-[#c4c6cf]/30 pb-3">
            Security & Cryptography
          </h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#161c27]">AES-256 Field Encryption</p>
              <p className="text-[11px] text-[#43474e]">Encrypt local responses before storage</p>
            </div>
            <button
              type="button"
              onClick={() => setE2eEnabled(!e2eEnabled)}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                e2eEnabled ? 'bg-[#006a68]' : 'bg-[#c4c6cf]'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${
                  e2eEnabled ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="p-3 bg-[#f1f3ff] rounded-lg border border-[#c4c6cf]/40 text-xs">
            <div className="font-semibold text-[#002045] mb-1">Public Key Fingerprint</div>
            <div className="font-mono text-[10px] text-[#74777f] break-all">
              4F9B-88E2-A103-CF78-552D-991A-BB02-E344
            </div>
          </div>
        </div>

        {/* Offline Storage Quota */}
        <div className="bg-white rounded-xl card-shadow border border-[#c4c6cf]/40 p-6 space-y-4">
          <h2 className="text-base font-bold text-[#002045] border-b border-[#c4c6cf]/30 pb-3">
            Offline Storage Quota
          </h2>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-[#43474e]">IndexedDB Local Cache</span>
              <span className="font-bold font-mono text-[#002045]">{storageUsed} MB / 500 MB</span>
            </div>
            <div className="w-full bg-[#dde2f3] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#1a365d] h-full rounded-full transition-all"
                style={{ width: `${(storageUsed / 500) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-[#74777f]">Cached schemas: 12 forms</span>
            <button
              onClick={handleClearCache}
              className="px-3 py-1.5 border border-[#ba1a1a]/40 text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg text-xs font-semibold transition-colors"
            >
              Purge Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

