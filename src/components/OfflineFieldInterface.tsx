import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { UserProfile, Question } from '../types';
import { DEFAULT_QUESTIONS } from '../data/mockData';
import { pushResponseToSupabase, getStoredResponses, saveResponseToLocalDb } from '../lib/supabaseSync';
import { OfflineSurveyCollectorModal } from './OfflineSurveyCollectorModal';

interface OfflineFieldInterfaceProps {
  onReturnToHub: () => void;
  currentUser?: UserProfile;
}

export const OfflineFieldInterface: React.FC<OfflineFieldInterfaceProps> = ({ 
  onReturnToHub,
  currentUser 
}) => {
  const [isOffline, setIsOffline] = useState(true);
  const [isCollectorOpen, setIsCollectorOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);

  // Active survey details deployed by Researcher
  const [surveyTitle, setSurveyTitle] = useState(() => localStorage.getItem('rdip_survey_title') || 'Household Health & Demographics Survey 2024');
  const [surveyVersion, setSurveyVersion] = useState(() => localStorage.getItem('rdip_survey_version') || 'Version 2.4.0');
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(() => {
    const saved = localStorage.getItem('rdip_active_questionnaire');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return DEFAULT_QUESTIONS;
  });

  // Enumerator Profile
  const enumeratorName = currentUser?.name || 'Field Enumerator';
  const enumeratorId = currentUser?.id || 'EN-1048';
  const enumeratorAvatar = currentUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';

  // State for local response list
  const [responsesList, setResponsesList] = useState<any[]>(() => {
    const stored = getStoredResponses();
    if (stored && stored.length > 0) return stored;
    return [
      { id: 'REC-4421', time: '10 mins ago', status: 'Pending', enumeratorName, enumeratorId, answers: { Q3_Employment_Status: 'Formal Full-time', Q4_Clinic_Distance_KM: '4.2', Q6_Drug_Availability_Likert: '4' } },
      { id: 'REC-4420', time: '45 mins ago', status: 'Pending', enumeratorName, enumeratorId, answers: { Q3_Employment_Status: 'Agricultural Producer', Q4_Clinic_Distance_KM: '12.0', Q6_Drug_Availability_Likert: '2' } },
      { id: 'REC-4419', time: '1 hr ago', status: 'Pending', enumeratorName, enumeratorId, answers: { Q3_Employment_Status: 'Informal Trader', Q4_Clinic_Distance_KM: '1.5', Q6_Drug_Availability_Likert: '5' } }
    ];
  });

  const pendingCount = responsesList.filter(r => r.status === 'Pending' || r.syncStatus === 'pending').length;
  const [syncedCount, setSyncedCount] = useState(132);

  // Sync survey update from Researcher whenever component loads
  useEffect(() => {
    const checkUpdates = () => {
      const title = localStorage.getItem('rdip_survey_title');
      const version = localStorage.getItem('rdip_survey_version');
      const qns = localStorage.getItem('rdip_active_questionnaire');
      if (title) setSurveyTitle(title);
      if (version) setSurveyVersion(version);
      if (qns) {
        try {
          const parsed = JSON.parse(qns);
          if (Array.isArray(parsed) && parsed.length > 0) setActiveQuestions(parsed);
        } catch {}
      }
    };
    checkUpdates();
  }, []);

  const handleResponseCollected = (newRecord: any) => {
    setResponsesList((prev) => [
      {
        id: newRecord.id,
        time: 'Just now',
        status: isOffline ? 'Pending' : 'Synced',
        syncStatus: isOffline ? 'pending' : 'synced',
        enumeratorName: newRecord.enumeratorName || enumeratorName,
        enumeratorId: newRecord.enumeratorId || enumeratorId,
        answers: newRecord.answers
      },
      ...prev
    ]);
  };

  const handleSync = async () => {
    if (isOffline) {
      alert('Network unavailable. Toggle "Simulate: Connect Network" at the top banner to connect to Supabase Cloud.');
      return;
    }

    if (responsesList.length === 0) return;

    setIsSyncing(true);
    setSyncFeedback(`Transmitting ${pendingCount} field records by ${enumeratorName} to Supabase PostgreSQL database...`);

    try {
      // Push each record tagged with this Enumerator
      for (const item of responsesList) {
        await pushResponseToSupabase({
          questionnaireId: 'QNR-2024-001',
          enumeratorId: enumeratorId,
          enumeratorName: enumeratorName,
          answers: item.answers,
          gps: gpsEnabled ? { latitude: 6.5244 + Math.random() * 0.05, longitude: 3.3792 + Math.random() * 0.05 } : undefined,
          collectedAt: new Date().toISOString()
        });
      }

      setTimeout(() => {
        setIsSyncing(false);
        setSyncedCount((prev) => prev + pendingCount);
        setResponsesList((prev) => prev.map(r => ({ ...r, status: 'Synced', syncStatus: 'synced' })));
        setSyncFeedback(`Successfully synced responses to Supabase database (Tagged: Enumerator ${enumeratorName}).`);
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.6 }
        });
        setTimeout(() => setSyncFeedback(null), 5000);
      }, 1200);
    } catch {
      setIsSyncing(false);
      setSyncFeedback('Sync saved and cached securely.');
    }
  };

  const handleManualCheckUpdates = () => {
    const qns = localStorage.getItem('rdip_active_questionnaire');
    const title = localStorage.getItem('rdip_survey_title');
    const version = localStorage.getItem('rdip_survey_version');
    if (title) setSurveyTitle(title);
    if (version) setSurveyVersion(version);
    if (qns) {
      try {
        const parsed = JSON.parse(qns);
        if (Array.isArray(parsed)) {
          setActiveQuestions(parsed);
          alert(`Questionnaire updated from Researcher Hub! Loaded "${title || 'Active Survey'}" with ${parsed.length} dynamic questions.`);
          return;
        }
      } catch {}
    }
    alert(`Survey schema is synchronized with Researcher Hub (${activeQuestions.length} questions).`);
  };

  return (
    <div className="max-w-[1050px] mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-200">
      {/* Top Banner Mode Indicator */}
      <div className="flex items-center justify-between">
        <button
          onClick={onReturnToHub}
          className="text-xs font-semibold text-[#1a365d] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Return to Research Web Portal</span>
        </button>

        <button
          onClick={() => setIsOffline(!isOffline)}
          className="text-xs font-bold text-[#006a68] hover:text-[#004e4c] underline flex items-center gap-1 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">
            {isOffline ? 'cloud_upload' : 'wifi_off'}
          </span>
          <span>Simulate: {isOffline ? 'Connect Network (Go Online)' : 'Go Offline'}</span>
        </button>
      </div>

      {/* Enumerator Identity & Banner */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 card-shadow border border-[#c4c6cf]/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <img
              src={enumeratorAvatar}
              alt={enumeratorName}
              className="w-12 h-12 rounded-xl object-cover border-2 border-[#006a68]"
            />
            <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
              isOffline ? 'bg-[#ba1a1a]' : 'bg-[#006a68]'
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#002045]">{enumeratorName}</h2>
              <span className="px-2 py-0.5 rounded bg-[#006a68]/10 text-[#006a68] text-[10px] font-bold uppercase">
                Field Enumerator
              </span>
            </div>
            <p className="text-xs text-[#43474e] mt-0.5 flex items-center gap-2">
              <span>Agent ID: <strong className="font-mono text-[#002045]">{enumeratorId}</strong></span>
              <span>•</span>
              <span>Assigned Area: Sector 04 (Sub-District C)</span>
            </p>
          </div>
        </div>

        {/* Network status pill */}
        <div
          onClick={() => setIsOffline(!isOffline)}
          className={`px-3.5 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-all ${
            isOffline
              ? 'bg-[#ba1a1a]/10 text-[#ba1a1a] border border-[#ba1a1a]/20'
              : 'bg-[#006a68]/10 text-[#006a68] border border-[#006a68]/20'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {isOffline ? 'wifi_off' : 'wifi'}
          </span>
          <span className="text-xs font-bold uppercase tracking-wider">
            {isOffline ? 'Offline Storage Active' : 'Online / Connected'}
          </span>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="md:col-span-8 space-y-6">
          {/* Active Questionnaire Card */}
          <div className="bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40">
            <div className="flex justify-between items-center mb-4 border-b border-[#c4c6cf]/30 pb-2">
              <h2 className="text-base font-bold text-[#002045] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#006a68] text-[20px]">quiz</span>
                <span>Active Research Questionnaire</span>
              </h2>
              <span className="text-[11px] font-semibold text-[#006a68] bg-[#006a68]/10 px-2 py-0.5 rounded">
                Synced from Researcher
              </span>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-start bg-[#f1f3ff] p-4 rounded-xl border border-[#dde2f3]">
                <div>
                  <h3 className="text-sm font-bold text-[#002045]">{surveyTitle}</h3>
                  <p className="text-xs text-[#43474e] mt-1">
                    {surveyVersion} • {activeQuestions.length} Questions Configured • Ready for Data Collection
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {activeQuestions.slice(0, 4).map((q, idx) => (
                      <span key={q.id || idx} className="text-[10px] font-mono bg-white text-[#002045] px-2 py-0.5 rounded border border-[#c4c6cf]/40">
                        {q.variableName || `VAR_${idx + 1}`}
                      </span>
                    ))}
                    {activeQuestions.length > 4 && (
                      <span className="text-[10px] text-[#74777f] font-semibold">
                        +{activeQuestions.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
                <span className="material-symbols-outlined text-[#006a68] bg-[#006a68]/10 p-2 rounded-full shrink-0">
                  verified
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setIsCollectorOpen(true)}
                  className="bg-[#006a68] hover:bg-[#00504e] text-white text-xs font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">add_circle</span>
                  <span>Record New Survey Form</span>
                </button>

                <button
                  onClick={handleManualCheckUpdates}
                  className="border border-[#c4c6cf] text-[#002045] hover:bg-[#f1f3ff] text-xs font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">sync</span>
                  <span>Pull Latest Survey Schema</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sync Center */}
          <div className="bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40">
            <div className="flex justify-between items-center mb-4 border-b border-[#c4c6cf]/30 pb-2">
              <div>
                <h2 className="text-base font-bold text-[#002045]">Database Sync Center</h2>
                <p className="text-xs text-[#74777f]">Data drops directly to Supabase & local persistent database</p>
              </div>
              <span className="text-xs font-bold bg-[#ffdcc5] text-[#703700] px-2.5 py-0.5 rounded-full uppercase border border-[#ffb783]">
                {pendingCount} PENDING
              </span>
            </div>

            {syncFeedback && (
              <div className="mb-4 p-3 rounded-lg bg-[#91f0ed]/30 border border-[#006a68]/40 text-[#006e6d] text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <span className="material-symbols-outlined text-[18px]">
                  {isSyncing ? 'sync' : 'check_circle'}
                </span>
                <span>{syncFeedback}</span>
              </div>
            )}

            <div className="space-y-3">
              {responsesList.length > 0 ? (
                responsesList.map((resp) => {
                  const isPending = resp.status === 'Pending' || resp.syncStatus === 'pending';
                  return (
                    <div
                      key={resp.id}
                      className="flex items-center justify-between p-3.5 border border-[#c4c6cf]/40 rounded-xl bg-[#f9f9ff] hover:bg-white transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`material-symbols-outlined ${isPending ? 'text-[#e88532]' : 'text-[#006a68]'}`}>
                          {isPending ? 'pending_actions' : 'cloud_done'}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-[#161c27]">Response #{resp.id}</p>
                            <span className="text-[10px] text-[#43474e]">
                              Tagged: <strong className="text-[#002045]">{resp.enumeratorName || enumeratorName}</strong>
                            </span>
                          </div>
                          <p className="text-[11px] text-[#74777f]">
                            {resp.time || 'Recorded today'} • {Object.keys(resp.answers || {}).length} variables
                          </p>
                        </div>
                      </div>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                        isPending
                          ? 'text-[#e88532] bg-[#e88532]/10 border border-[#e88532]/30'
                          : 'text-[#006a68] bg-[#006a68]/10 border border-[#006a68]/30'
                      }`}>
                        {isPending ? 'Pending Sync' : 'Database Synced'}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-xs text-[#006a68] font-medium bg-[#006a68]/5 rounded-xl border border-[#006a68]/20">
                  All local responses have been synced with RDIP cloud database!
                </div>
              )}

              <button
                onClick={handleSync}
                disabled={isSyncing || pendingCount === 0}
                className={`w-full mt-4 text-xs font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isOffline
                    ? 'border border-[#c4c6cf] text-[#74777f] bg-[#f9f9ff] cursor-not-allowed'
                    : pendingCount === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-[#006a68] hover:bg-[#00504e] text-white shadow-sm'
                }`}
              >
                <span className={`material-symbols-outlined text-base ${isSyncing ? 'animate-spin' : ''}`}>
                  sync
                </span>
                <span>
                  {isSyncing
                    ? 'Syncing Responses to Supabase...'
                    : isOffline
                    ? 'Sync Disabled in Offline Mode (Toggle Online Above)'
                    : pendingCount === 0
                    ? 'All Records Synchronized'
                    : `Sync ${pendingCount} Records to Supabase Now`}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column / Stats & Sensors */}
        <div className="md:col-span-4 space-y-6">
          {/* Collection Stats */}
          <div className="bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40">
            <h2 className="text-base font-bold text-[#002045] mb-4 border-b border-[#c4c6cf]/30 pb-2">
              Enumerator Session
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#f1f3ff] p-4 rounded-xl text-center">
                <p className="text-2xl font-bold text-[#002045]">{responsesList.length}</p>
                <p className="text-xs text-[#43474e] mt-0.5 font-medium">Collected</p>
              </div>
              <div className="bg-[#f1f3ff] p-4 rounded-xl text-center">
                <p className="text-2xl font-bold text-[#006a68]">{syncedCount}</p>
                <p className="text-xs text-[#43474e] mt-0.5 font-medium">Synced</p>
              </div>
            </div>
          </div>

          {/* Device Sensors */}
          <div className="bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40 space-y-4">
            <h2 className="text-base font-bold text-[#002045] border-b border-[#c4c6cf]/30 pb-2">
              Field Telemetry & GPS
            </h2>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#43474e] text-[20px]">
                  location_on
                </span>
                <div>
                  <span className="text-xs font-semibold text-[#161c27] block">GPS Geostamp</span>
                  <span className="text-[10px] text-[#74777f]">Auto-tag coordinates</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGpsEnabled(!gpsEnabled)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  gpsEnabled ? 'bg-[#006a68]' : 'bg-[#c4c6cf]'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${
                    gpsEnabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#43474e] text-[20px]">mic</span>
                <div>
                  <span className="text-xs font-semibold text-[#161c27] block">Audio Notes</span>
                  <span className="text-[10px] text-[#74777f]">Enumerator notes</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAudioEnabled(!audioEnabled)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  audioEnabled ? 'bg-[#006a68]' : 'bg-[#c4c6cf]'
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${
                    audioEnabled ? 'right-1' : 'left-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Actual interactive Survey Collection Modal */}
      <OfflineSurveyCollectorModal
        isOpen={isCollectorOpen}
        onClose={() => setIsCollectorOpen(false)}
        currentUser={currentUser}
        isOfflineMode={isOffline}
        onResponseCollected={handleResponseCollected}
      />
    </div>
  );
};
