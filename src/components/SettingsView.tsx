import React, { useState } from 'react';
import { INITIAL_USER } from '../data/mockData';

export const SettingsView: React.FC = () => {
  const [user, setUser] = useState(INITIAL_USER);
  const [storageUsed, setStorageUsed] = useState(14.8);
  const [e2eEnabled, setE2eEnabled] = useState(true);
  const [autoSyncInterval, setAutoSyncInterval] = useState('15');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
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
          Platform Settings & User Roles
        </h1>
        <p className="text-[#43474e] text-sm md:text-base mt-1">
          Manage researcher credentials, data encryption policies, and offline storage allocation.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-[#e3e8f9] border border-[#adc7f7] rounded-xl text-xs font-semibold text-[#002045] flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[#006a68]">check_circle</span>
          <span>Researcher profile and encryption parameters updated successfully.</span>
        </div>
      )}

      {/* User Profile Card */}
      <div className="bg-white rounded-xl card-shadow border border-[#c4c6cf]/40 p-6">
        <h2 className="text-base font-bold text-[#002045] border-b border-[#c4c6cf]/30 pb-3 mb-6">
          Researcher Profile
        </h2>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 pb-4 border-b border-[#c4c6cf]/20">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#1a365d] bg-[#dde2f3] shrink-0">
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div className="text-center sm:text-left">
              <h3 className="font-bold text-[#002045] text-base">{user.name}</h3>
              <p className="text-xs text-[#43474e]">{user.email}</p>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded bg-[#1a365d]/10 text-[#1a365d] text-[11px] font-bold">
                {user.role}
              </span>
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
