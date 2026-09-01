import React, { useState } from 'react';
import { Enumerator } from '../types';
import { INITIAL_ENUMERATORS } from '../data/mockData';

interface EnumeratorsViewProps {
  onOpenOfflineCollector: () => void;
}

export const EnumeratorsView: React.FC<EnumeratorsViewProps> = ({ onOpenOfflineCollector }) => {
  const [enumerators, setEnumerators] = useState<Enumerator[]>(INITIAL_ENUMERATORS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEnumerator, setSelectedEnumerator] = useState<Enumerator>(INITIAL_ENUMERATORS[1]); // Default to Marcus Webb
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [messageToast, setMessageToast] = useState<string | null>(null);

  // New Assign Form State
  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState('North District');
  const [newPhone, setNewPhone] = useState('');

  const filteredEnumerators = enumerators.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleForceSync = (id: string) => {
    setSyncingId(id);
    setTimeout(() => {
      setEnumerators((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, status: 'Synced', unsyncedCount: 0, lastSync: 'Just now', responses: e.responses + e.unsyncedCount }
            : e
        )
      );
      if (selectedEnumerator?.id === id) {
        setSelectedEnumerator((prev) => ({
          ...prev,
          status: 'Synced',
          unsyncedCount: 0,
          lastSync: 'Just now',
          responses: prev.responses + prev.unsyncedCount
        }));
      }
      setSyncingId(null);
      setMessageToast(`Successfully synced records for ${selectedEnumerator.name}.`);
      setTimeout(() => setMessageToast(null), 3000);
    }, 1500);
  };

  const handleSendMessage = () => {
    setMessageToast(`SMS prompt dispatched to ${selectedEnumerator.name} (${selectedEnumerator.phone}).`);
    setTimeout(() => setMessageToast(null), 3000);
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newEnum: Enumerator = {
      id: `EN-${1050 + enumerators.length + 1}`,
      name: newName.trim(),
      region: newRegion,
      responses: 0,
      status: 'Synced',
      unsyncedCount: 0,
      lastSync: 'Just now',
      signalStrength: 'Good',
      batteryLevel: 100,
      phone: newPhone || '+1 (555) 999-0000'
    };

    setEnumerators([...enumerators, newEnum]);
    setSelectedEnumerator(newEnum);
    setIsAssignModalOpen(false);
    setNewName('');
    setNewPhone('');
  };

  return (
    <div className="max-w-[1280px] mx-auto p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#002045] tracking-tight">
            Enumerators
          </h1>
          <p className="text-[#43474e] text-sm md:text-base mt-1">
            Field management, offline tablet telemetry, and sync status tracking.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          <button
            onClick={onOpenOfflineCollector}
            className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#006a68]/10 text-[#006a68] border border-[#006a68]/30 hover:bg-[#006a68]/20 transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">tablet_mac</span>
            <span>Launch Offline Field App</span>
          </button>

          <button
            onClick={() => setIsAssignModalOpen(true)}
            className="bg-[#1a365d] hover:bg-[#002045] text-white px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Assign Enumerators</span>
          </button>
        </div>
      </div>

      {/* Grid Layout: Table & Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table Section */}
        <div className="lg:col-span-2 bg-white rounded-xl card-shadow overflow-hidden border border-[#c4c6cf]/40 flex flex-col">
          <div className="p-5 border-b border-[#c4c6cf]/40 flex justify-between items-center bg-[#f9f9ff]">
            <h2 className="text-base font-bold text-[#002045]">Assigned Enumerators</h2>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#74777f] text-sm">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID or Name..."
                className="pl-9 pr-3 py-1.5 bg-white border border-[#c4c6cf] rounded-lg text-xs focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] w-48 md:w-60 outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f1f3ff]/60 border-b border-[#c4c6cf]/40 text-xs font-semibold text-[#43474e] uppercase tracking-wider">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Region</th>
                  <th className="py-3 px-4 text-right">Responses</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c4c6cf]/30 text-xs">
                {filteredEnumerators.map((item) => {
                  const isSelected = selectedEnumerator?.id === item.id;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedEnumerator(item)}
                      className={`hover:bg-[#f1f3ff]/50 transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#e3e8f9]/60 font-medium' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono text-[#74777f]">{item.id}</td>
                      <td className="py-3.5 px-4 font-bold text-[#161c27]">{item.name}</td>
                      <td className="py-3.5 px-4 text-[#43474e]">{item.region}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-[#002045]">
                        {item.responses}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            item.status === 'Synced'
                              ? 'bg-[#006a68]/10 text-[#006a68]'
                              : item.status === 'Pending'
                              ? 'bg-[#ffdcc5]/70 text-[#703700]'
                              : 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          className={`p-1 rounded-full transition-colors ${
                            isSelected ? 'text-[#002045] bg-[#adc7f7]/40' : 'text-[#74777f]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            chevron_right
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Details Inspector Panel */}
        <div className="bg-white rounded-xl card-shadow p-6 border border-[#c4c6cf]/40 flex flex-col justify-between space-y-6">
          <div>
            <div className="border-b border-[#c4c6cf]/40 pb-4 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-[#002045]">{selectedEnumerator.name}</h3>
                <p className="text-xs text-[#43474e] mt-0.5">
                  ID: {selectedEnumerator.id} • {selectedEnumerator.region}
                </p>
                <p className="text-[11px] text-[#74777f] mt-0.5">
                  Phone: {selectedEnumerator.phone}
                </p>
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  selectedEnumerator.status === 'Synced'
                    ? 'bg-[#006a68]/10 text-[#006a68]'
                    : selectedEnumerator.status === 'Pending'
                    ? 'bg-[#ffdcc5]/70 text-[#703700]'
                    : 'bg-[#ba1a1a]/10 text-[#ba1a1a]'
                }`}
              >
                {selectedEnumerator.status === 'Pending' ? 'Pending Sync' : selectedEnumerator.status}
              </span>
            </div>

            {/* Offline Progress */}
            <div className="mt-5 space-y-3">
              <h4 className="text-xs font-bold text-[#002045] uppercase tracking-wider">
                Offline Progress
              </h4>

              <div className="bg-[#f9f9ff] p-4 rounded-xl border border-[#c4c6cf]/40 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[#43474e]">Unsynced Responses</span>
                  <span className="font-mono font-bold text-[#002045]">
                    {selectedEnumerator.unsyncedCount}
                  </span>
                </div>
                <div className="w-full bg-[#dde2f3] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#e88532] h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        selectedEnumerator.unsyncedCount > 0
                          ? Math.min(100, selectedEnumerator.unsyncedCount * 3)
                          : 0
                      }%`
                    }}
                  />
                </div>
              </div>

              <div className="bg-[#f9f9ff] p-4 rounded-xl border border-[#c4c6cf]/40 space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[#43474e]">Last Sync Attempt</span>
                  <span className="font-semibold text-[#161c27]">
                    {selectedEnumerator.lastSync}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#43474e]">Signal Strength</span>
                  <div className="flex items-center gap-1 text-[#43474e]">
                    <span className="material-symbols-outlined text-[16px] text-[#e88532]">
                      signal_cellular_alt_1_bar
                    </span>
                    <span className="font-semibold">{selectedEnumerator.signalStrength}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[#43474e]">Tablet Battery</span>
                  <div className="flex items-center gap-1 text-[#43474e]">
                    <span className="material-symbols-outlined text-[16px] text-[#006a68]">
                      battery_5_bar
                    </span>
                    <span className="font-semibold">{selectedEnumerator.batteryLevel}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[#c4c6cf]/40 grid grid-cols-2 gap-3">
            <button
              onClick={handleSendMessage}
              className="bg-transparent border border-[#c4c6cf] text-[#002045] hover:bg-[#f1f3ff] text-xs font-semibold py-2.5 rounded-lg transition-colors text-center"
            >
              Message
            </button>
            <button
              onClick={() => handleForceSync(selectedEnumerator.id)}
              disabled={syncingId === selectedEnumerator.id}
              className="bg-[#1a365d] hover:bg-[#002045] text-white text-xs font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              {syncingId === selectedEnumerator.id ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">sync</span>
                  <span>Force Sync</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Toast Alert */}
      {messageToast && (
        <div className="fixed bottom-6 right-6 z-[110] bg-[#002045] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3">
          <span className="material-symbols-outlined text-[#91f0ed] text-[20px]">info</span>
          <span className="text-xs font-semibold">{messageToast}</span>
        </div>
      )}

      {/* Assign Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#161c27]/40 backdrop-blur-xs"
            onClick={() => setIsAssignModalOpen(false)}
          />
          <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl p-6 border border-[#c4c6cf]/40 animate-in zoom-in-95 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[#c4c6cf]/40">
              <h2 className="text-base font-bold text-[#002045]">Assign New Field Enumerator</h2>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-[#74777f] hover:text-[#002045] p-1 rounded-full"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Enumerator Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Samuel K. Vance"
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Target District / Region</label>
                <select
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"
                >
                  <option value="North District">North District</option>
                  <option value="East District">East District</option>
                  <option value="South District">South District</option>
                  <option value="West District">West District</option>
                  <option value="Central Metro">Central Metro</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[#c4c6cf]/40 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#c4c6cf] font-semibold text-[#002045]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#1a365d] text-white font-semibold hover:bg-[#002045]"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
