import React, { useState } from 'react';
import confetti from 'canvas-confetti';

interface OfflineFieldInterfaceProps {
  onReturnToHub: () => void;
}

export const OfflineFieldInterface: React.FC<OfflineFieldInterfaceProps> = ({ onReturnToHub }) => {
  const [isOffline, setIsOffline] = useState(true);
  const [pendingCount, setPendingCount] = useState(5);
  const [collectedCount, setCollectedCount] = useState(137);
  const [syncedCount, setSyncedCount] = useState(132);
  const [isSyncing, setIsSyncing] = useState(false);
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [responsesList, setResponsesList] = useState([
    { id: '4421', time: '10 mins ago', status: 'Pending' },
    { id: '4420', time: '45 mins ago', status: 'Pending' },
    { id: '4419', time: '1 hr ago', status: 'Pending' },
    { id: '4418', time: '2 hrs ago', status: 'Pending' },
    { id: '4417', time: '3 hrs ago', status: 'Pending' }
  ]);

  const handleSync = () => {
    if (isOffline) {
      alert('Network unavailable. Toggle "Online" mode at the top banner to simulate reconnecting to cellular towers.');
      return;
    }

    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncedCount((prev) => prev + pendingCount);
      setPendingCount(0);
      setResponsesList([]);
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 }
      });
    }, 1800);
  };

  const handleCollectNewSurvey = () => {
    const nextId = (4421 + responsesList.length + 1).toString();
    setCollectedCount((prev) => prev + 1);
    setPendingCount((prev) => prev + 1);
    setResponsesList([
      { id: nextId, time: 'Just now', status: 'Pending' },
      ...responsesList
    ]);
  };

  return (
    <div className="max-w-[1000px] mx-auto p-4 md:p-8 space-y-6 animate-in fade-in duration-200">
      {/* Top Banner Mode Indicator */}
      <div className="flex items-center justify-between">
        <button
          onClick={onReturnToHub}
          className="text-xs font-semibold text-[#1a365d] hover:underline flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Return to Research Web Portal</span>
        </button>

        <button
          onClick={() => setIsOffline(!isOffline)}
          className="text-xs font-medium text-[#43474e] hover:text-[#002045] underline"
        >
          Simulate: {isOffline ? 'Connect Network' : 'Go Offline'}
        </button>
      </div>

      {/* Offline Banner */}
      <div
        onClick={() => setIsOffline(!isOffline)}
        className={`rounded-xl p-4 flex items-center justify-center gap-3 cursor-pointer transition-all ${
          isOffline
            ? 'bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 text-[#ba1a1a]'
            : 'bg-[#006a68]/10 border border-[#006a68]/20 text-[#006a68]'
        }`}
      >
        <span className="material-symbols-outlined text-xl">
          {isOffline ? 'wifi_off' : 'wifi'}
        </span>
        <span className="text-sm font-bold tracking-wide uppercase">
          {isOffline
            ? 'Collection Mode: OFFLINE (Tap to reconnect)'
            : 'Collection Mode: ONLINE (Connected to RDIP Node 04)'}
        </span>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="md:col-span-8 space-y-6">
          {/* Active Questionnaire Card */}
          <div className="bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40">
            <h2 className="text-base font-bold text-[#002045] mb-4 border-b border-[#c4c6cf]/30 pb-2">
              Active Questionnaire
            </h2>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center bg-[#f1f3ff] p-4 rounded-xl">
                <div>
                  <h3 className="text-sm font-bold text-[#002045]">Household Survey 2024</h3>
                  <p className="text-xs text-[#43474e] mt-0.5">
                    Version 2.1 • Size: 4.2MB • 42 Modules
                  </p>
                </div>
                <span className="material-symbols-outlined text-[#006a68] bg-[#006a68]/10 p-2 rounded-full">
                  check_circle
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleCollectNewSurvey}
                  className="bg-[#1a365d] hover:bg-[#002045] text-white text-xs font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  <span>Record New Survey Form</span>
                </button>

                <button
                  onClick={() => alert('Questionnaire schema is up to date (v2.1).')}
                  className="border border-[#c4c6cf] text-[#002045] hover:bg-[#f1f3ff] text-xs font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  <span>Check Questionnaire Updates</span>
                </button>
              </div>
            </div>
          </div>

          {/* Sync Center */}
          <div className="bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40">
            <div className="flex justify-between items-center mb-4 border-b border-[#c4c6cf]/30 pb-2">
              <h2 className="text-base font-bold text-[#002045]">Sync Center</h2>
              <span className="text-xs font-bold bg-[#ffdcc5] text-[#703700] px-2.5 py-0.5 rounded-full uppercase border border-[#ffb783]">
                {pendingCount} PENDING
              </span>
            </div>

            <div className="space-y-3">
              {responsesList.length > 0 ? (
                responsesList.map((resp) => (
                  <div
                    key={resp.id}
                    className="flex items-center justify-between p-3.5 border border-[#c4c6cf]/40 rounded-xl bg-[#f9f9ff]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[#74777f]">draft</span>
                      <div>
                        <p className="text-xs font-bold text-[#161c27]">Response #{resp.id}</p>
                        <p className="text-[11px] text-[#43474e]">Completed: {resp.time}</p>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-[#e88532] bg-[#e88532]/10 px-2 py-0.5 rounded">
                      Local Storage
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-[#006a68] font-medium bg-[#006a68]/5 rounded-xl border border-[#006a68]/20">
                  All local responses have been synced with RDIP cloud!
                </div>
              )}

              <button
                onClick={handleSync}
                disabled={isSyncing || responsesList.length === 0}
                className={`w-full mt-4 text-xs font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
                  isOffline
                    ? 'border border-[#c4c6cf] text-[#74777f] bg-[#f9f9ff] cursor-not-allowed'
                    : 'bg-[#006a68] hover:bg-[#00504e] text-white shadow-sm'
                }`}
              >
                <span className={`material-symbols-outlined text-base ${isSyncing ? 'animate-spin' : ''}`}>
                  sync
                </span>
                <span>
                  {isSyncing
                    ? 'Syncing Encrypted Field Records...'
                    : isOffline
                    ? 'Sync Now (Requires Network Connection)'
                    : `Sync ${pendingCount} Records Now`}
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
              Session Stats
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#f1f3ff] p-4 rounded-xl text-center">
                <p className="text-2xl font-bold text-[#002045]">{collectedCount}</p>
                <p className="text-xs text-[#43474e] mt-0.5 font-medium">Collected</p>
              </div>
              <div className="bg-[#f1f3ff] p-4 rounded-xl text-center">
                <p className="text-2xl font-bold text-[#006a68]">{syncedCount}</p>
                <p className="text-xs text-[#43474e] mt-0.5 font-medium">Synced</p>
              </div>
            </div>
          </div>

          {/* Sensors & Hardware Settings */}
          <div className="bg-white rounded-xl p-6 card-shadow border border-[#c4c6cf]/40 space-y-4">
            <h2 className="text-base font-bold text-[#002045] border-b border-[#c4c6cf]/30 pb-2">
              Device Sensors
            </h2>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#43474e] text-[20px]">
                  location_on
                </span>
                <span className="text-xs font-semibold text-[#161c27]">GPS Tagging</span>
              </div>
              <button
                type="button"
                onClick={() => setGpsEnabled(!gpsEnabled)}
                className={`w-9 h-5 rounded-full transition-colors relative ${
                  gpsEnabled ? 'bg-[#1a365d]' : 'bg-[#c4c6cf]'
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
                <span className="text-xs font-semibold text-[#161c27]">Audio Metadata</span>
              </div>
              <button
                type="button"
                onClick={() => setAudioEnabled(!audioEnabled)}
                className={`w-9 h-5 rounded-full transition-colors relative ${
                  audioEnabled ? 'bg-[#1a365d]' : 'bg-[#c4c6cf]'
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
    </div>
  );
};
