import React, { useState, useEffect } from 'react';
import { Enumerator } from '../types';
import { INITIAL_ENUMERATORS } from '../data/mockData';
import { getStoredEnumerators, saveStoredEnumerators } from '../lib/enumeratorTelemetry';
import { EnumeratorMapVisualization } from './EnumeratorMapVisualization';
import { QuestionnaireAssignmentModal } from './QuestionnaireAssignmentModal';
import { supabase } from '../lib/supabase';

interface EnumeratorsViewProps {
  onOpenOfflineCollector: () => void;
}

export const EnumeratorsView: React.FC<EnumeratorsViewProps> = ({ onOpenOfflineCollector }) => {
  const [enumerators, setEnumerators] = useState<Enumerator[]>(() => getStoredEnumerators());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEnumerator, setSelectedEnumerator] = useState<Enumerator>(() => {
    const list = getStoredEnumerators();
    return list[1] || list[0] || INITIAL_ENUMERATORS[1];
  });
  const [viewMode, setViewMode] = useState<'map_and_table' | 'full_map' | 'table_only'>('map_and_table');
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isQuestionnaireAssignmentOpen, setIsQuestionnaireAssignmentOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [messageToast, setMessageToast] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [generatedCredentials, setGeneratedCredentials] = useState<{ name: string; email: string; password: string } | null>(null);

  // New Assign Form State
  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState('North District');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [assignProjects, setAssignProjects] = useState<Array<{ id: string; project_code: string; title: string }>>([]);
  const [assignProjectsLoading, setAssignProjectsLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAssignModalOpen) return;
    let cancelled = false;
    const loadAssignProjects = async () => {
      setAssignProjectsLoading(true);
      setProvisionError(null);
      const { data, error } = await supabase
        .from('projects')
        .select('id,project_code,title')
        .neq('status', 'archived')
        .neq('status', 'completed')
        .order('created_at', { ascending: false });
      if (!cancelled) {
        if (error) {
          setAssignProjects([]);
          setProvisionError(`Unable to load research projects: ${error.message}`);
        } else {
          setAssignProjects((data || []) as Array<{ id: string; project_code: string; title: string }>);
          setNewProjectId((current) => current || data?.[0]?.id || '');
        }
        setAssignProjectsLoading(false);
      }
    };
    loadAssignProjects();
    return () => { cancelled = true; };
  }, [isAssignModalOpen]);

  // Synchronize real-time telemetry from OfflineFieldInterface
  useEffect(() => {
    const handleTelemetryUpdate = () => {
      const latest = getStoredEnumerators();
      setEnumerators(latest);
      if (selectedEnumerator) {
        const found = latest.find((e) => e.id === selectedEnumerator.id);
        if (found) setSelectedEnumerator(found);
      }
    };

    window.addEventListener('rdip_enumerator_location_updated', handleTelemetryUpdate);
    window.addEventListener('rdip_response_synced', handleTelemetryUpdate);
    window.addEventListener('storage', handleTelemetryUpdate);

    return () => {
      window.removeEventListener('rdip_enumerator_location_updated', handleTelemetryUpdate);
      window.removeEventListener('rdip_response_synced', handleTelemetryUpdate);
      window.removeEventListener('storage', handleTelemetryUpdate);
    };
  }, [selectedEnumerator]);

  const filteredEnumerators = enumerators.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleForceSync = (id: string) => {
    setSyncingId(id);
    setTimeout(() => {
      setEnumerators((prev) => {
        const updated = prev.map((e) =>
          e.id === id
            ? { ...e, status: 'Synced' as const, unsyncedCount: 0, lastSync: 'Just now', responses: e.responses + e.unsyncedCount }
            : e
        );
        saveStoredEnumerators(updated);
        return updated;
      });
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

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvisionError(null);

    if (!newName.trim() || !newEmail.trim() || !newProjectId) {
      setProvisionError('Enumerator name, email, and research project are required.');
      return;
    }

    setProvisioning(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Authentication error: Please sign in again.');

      const response = await fetch('/api/enumerators', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          phone: newPhone.trim(),
          projectId: newProjectId,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Unable to register enumerator.');
      if (payload.temporaryPassword) {
        setGeneratedCredentials({
          name: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          password: payload.temporaryPassword,
        });
      }

      const defaultCoords = {
        'North District': { latitude: 10.5105, longitude: 7.4165, lga: 'Kaduna North', state: 'Kaduna' },
        'East District': { latitude: 6.4584, longitude: 7.5464, lga: 'Enugu North', state: 'Enugu' },
        'South District': { latitude: 4.8156, longitude: 7.0498, lga: 'Port Harcourt', state: 'Rivers' },
        'West District': { latitude: 7.3775, longitude: 3.9470, lga: 'Ibadan Central', state: 'Oyo' },
        'Central Metro': { latitude: 9.0765, longitude: 7.3986, lga: 'Abuja Municipal', state: 'FCT Abuja' }
      }[newRegion] || { latitude: 9.0765, longitude: 7.3986, lga: 'Central Sector', state: 'Federal' };

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
        phone: newPhone || '+1 (555) 999-0000',
        assignedProjectIds: [newProjectId],
        coordinates: {
          latitude: defaultCoords.latitude,
          longitude: defaultCoords.longitude,
          accuracy: 3.5,
          speed: 1.2,
          timestamp: new Date().toISOString(),
          address: `${newRegion} Field Zone`,
          lga: defaultCoords.lga,
          state: defaultCoords.state
        },
        locationHistory: [
          {
            latitude: defaultCoords.latitude,
            longitude: defaultCoords.longitude,
            timestamp: new Date().toISOString(),
            address: 'Assigned Field Headquarters'
          }
        ]
      };

      const updated = [...enumerators, newEnum];
      setEnumerators(updated);
      saveStoredEnumerators(updated);
      setSelectedEnumerator(newEnum);
      setIsAssignModalOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewProjectId('');
      setMessageToast(payload.message || `Enumerator ${newEnum.name} registered successfully.`);
      setTimeout(() => setMessageToast(null), 4000);
    } catch (error) {
      setProvisionError(error instanceof Error ? error.message : 'Unable to register enumerator.');
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl md:text-3xl font-bold text-[#002045] tracking-tight">
              Enumerators & Geospatial Fleet
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#006a68]/10 text-[#006a68] border border-[#006a68]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#006a68] animate-pulse" />
              <span>REAL-TIME GPS</span>
            </span>
          </div>
          <p className="text-[#43474e] text-sm md:text-base mt-1">
            Real-time GPS tracking, offline tablet telemetry, field buffer monitoring, and sync status dispatch.
          </p>
        </div>

        {/* Action Buttons & View Toggles */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg border border-[#c4c6cf] bg-white p-0.5 text-xs font-semibold text-[#002045] shadow-2xs">
            <button
              onClick={() => setViewMode('map_and_table')}
              className={`px-3 py-2 rounded-md flex items-center gap-1.5 transition-all ${
                viewMode === 'map_and_table' ? 'bg-[#1a365d] text-white shadow-xs' : 'hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">splitscreen</span>
              <span>Map & List</span>
            </button>
            <button
              onClick={() => setViewMode('full_map')}
              className={`px-3 py-2 rounded-md flex items-center gap-1.5 transition-all ${
                viewMode === 'full_map' ? 'bg-[#1a365d] text-white shadow-xs' : 'hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">map</span>
              <span>Expanded Map</span>
            </button>
            <button
              onClick={() => setViewMode('table_only')}
              className={`px-3 py-2 rounded-md flex items-center gap-1.5 transition-all ${
                viewMode === 'table_only' ? 'bg-[#1a365d] text-white shadow-xs' : 'hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">list</span>
              <span>Table</span>
            </button>
          </div>

          <button
            onClick={() => setIsLinkModalOpen(true)}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#1a365d]/10 text-[#1a365d] border border-[#1a365d]/30 hover:bg-[#1a365d]/20 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
            <span>QR Dispatch</span>
          </button>

          <button
            onClick={onOpenOfflineCollector}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#006a68]/10 text-[#006a68] border border-[#006a68]/30 hover:bg-[#006a68]/20 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <span className="material-symbols-outlined text-[16px]">tablet_mac</span>
            <span>Offline Field App</span>
          </button>

          <button
            onClick={() => setIsQuestionnaireAssignmentOpen(true)}
            className="bg-[#006a68] hover:bg-[#004f4e] text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>
            <span>Assign Questionnaire</span>
          </button>

          <button
            onClick={() => setIsAssignModalOpen(true)}
            className="bg-[#1a365d] hover:bg-[#002045] text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Assign Agent</span>
          </button>
        </div>
      </div>

      {/* MAP VISUALIZATION COMPONENT */}
      {viewMode !== 'table_only' && (
        <EnumeratorMapVisualization
          enumerators={enumerators}
          selectedEnumerator={selectedEnumerator}
          onSelectEnumerator={setSelectedEnumerator}
          onForceSync={handleForceSync}
          onSendMessage={handleSendMessage}
          onOpenFieldApp={onOpenOfflineCollector}
        />
      )}

      {/* Grid Layout: Table & Detail Inspector */}
      {viewMode !== 'full_map' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Table Section */}
          <div className="lg:col-span-2 bg-white rounded-xl card-shadow overflow-hidden border border-[#c4c6cf]/40 flex flex-col">
            <div className="p-5 border-b border-[#c4c6cf]/40 flex justify-between items-center bg-[#f9f9ff]">
              <div>
                <h2 className="text-base font-bold text-[#002045]">Active Field Enumerator Fleet</h2>
                <p className="text-xs text-[#74777f]">Click any row to pinpoint location and view device sensor telemetry</p>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#74777f] text-sm">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ID, Name, or Region..."
                  className="pl-9 pr-3 py-1.5 bg-white border border-[#c4c6cf] rounded-lg text-xs focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] w-48 md:w-64 outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#f1f3ff]/60 border-b border-[#c4c6cf]/40 text-xs font-semibold text-[#43474e] uppercase tracking-wider">
                    <th className="py-3 px-4">ID & Agent</th>
                    <th className="py-3 px-4">Study Region & Sector</th>
                    <th className="py-3 px-4">Last Known GPS Fix</th>
                    <th className="py-3 px-4 text-right">Responses</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Pin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c4c6cf]/30 text-xs">
                  {filteredEnumerators.map((item) => {
                    const isSelected = selectedEnumerator?.id === item.id;
                    const hasCoords = Boolean(item.coordinates);
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedEnumerator(item)}
                        className={`hover:bg-[#f1f3ff]/50 transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#e3e8f9]/60 font-medium' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] ${
                              isSelected ? 'bg-[#1a365d] text-white' : 'bg-[#e3e8f9] text-[#002045]'
                            }`}>
                              {(item.name || 'Enumerator').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <span className="font-bold text-[#161c27] block">{item.name}</span>
                              <span className="font-mono text-[11px] text-[#74777f]">{item.id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[#43474e]">
                          <span>{item.region}</span>
                          {item.coordinates?.lga && (
                            <span className="block text-[10px] text-[#74777f]">{item.coordinates.lga}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {hasCoords && item.coordinates ? (
                            <div className="flex items-center gap-1 text-[#006a68]">
                              <span className="material-symbols-outlined text-[15px]">location_on</span>
                              <span className="font-mono text-[11px]">
                                {item.coordinates.latitude.toFixed(3)}°N, {item.coordinates.longitude.toFixed(3)}°E
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#74777f] italic text-[11px]">No GPS fix</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-medium text-[#002045]">
                          <div>{item.responses}</div>
                          {item.unsyncedCount > 0 && (
                            <span className="text-[10px] font-bold text-[#e88532]">
                              +{item.unsyncedCount} buffered
                            </span>
                          )}
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
                            title="Focus Pin on Map"
                            className={`p-1 rounded-full transition-colors ${
                              isSelected ? 'text-[#002045] bg-[#adc7f7]/40' : 'text-[#74777f] hover:text-[#002045]'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              person_pin_circle
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

              {/* Real-time GPS & Telemetry Card */}
              {selectedEnumerator.coordinates && (
                <div className="mt-4 p-3.5 bg-[#f1f3ff] rounded-xl border border-[#c4c6cf]/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#002045] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px] text-[#006a68]">gps_fixed</span>
                      <span>Real-time GPS Fix</span>
                    </span>
                    <span className="text-[10px] font-bold text-[#006a68] bg-[#006a68]/10 px-2 py-0.5 rounded">
                      ± {selectedEnumerator.coordinates.accuracy || 4.2}m
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-[#002045] bg-white p-2 rounded-lg border border-[#c4c6cf]/40 flex justify-between">
                    <span>Lat: {selectedEnumerator.coordinates.latitude.toFixed(4)}°N</span>
                    <span>Lon: {selectedEnumerator.coordinates.longitude.toFixed(4)}°E</span>
                  </div>
                  <p className="text-[11px] text-[#43474e]">
                    Sector: <strong>{selectedEnumerator.coordinates.address || selectedEnumerator.region}</strong>
                  </p>
                </div>
              )}

              {/* Offline Progress */}
              <div className="mt-4 space-y-3">
                <h4 className="text-xs font-bold text-[#002045] uppercase tracking-wider">
                  Offline Buffer & Telemetry
                </h4>

                <div className="bg-[#f9f9ff] p-4 rounded-xl border border-[#c4c6cf]/40 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#43474e]">Unsynced Responses in Buffer</span>
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
                    <span className="text-[#43474e]">Last Cloud Sync</span>
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
            <div className="pt-4 border-t border-[#c4c6cf]/40 space-y-2.5">
              <button
                onClick={() => setIsLinkModalOpen(true)}
                className="w-full bg-[#e3e8f9] hover:bg-[#d6e3ff] text-[#002045] text-xs font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-[#adc7f7] cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm text-[#1a365d]">qr_code_2</span>
                <span>Get {selectedEnumerator.name}'s Link & QR</span>
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleSendMessage}
                  className="bg-transparent border border-[#c4c6cf] text-[#002045] hover:bg-[#f1f3ff] text-xs font-semibold py-2.5 rounded-lg transition-colors text-center cursor-pointer"
                >
                  SMS Prompt
                </button>
                <button
                  onClick={() => handleForceSync(selectedEnumerator.id)}
                  disabled={syncingId === selectedEnumerator.id}
                  className="bg-[#1a365d] hover:bg-[#002045] text-white text-xs font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
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
        </div>
      )}

      {/* Toast Alert */}
      {messageToast && (
        <div className="fixed bottom-6 right-6 z-[110] bg-[#002045] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3">
          <span className="material-symbols-outlined text-[#91f0ed] text-[20px]">info</span>
          <span className="text-xs font-semibold">{messageToast}</span>
        </div>
      )}

      {/* Phase 8: Questionnaire Assignment */}
      <QuestionnaireAssignmentModal
        isOpen={isQuestionnaireAssignmentOpen}
        onClose={() => setIsQuestionnaireAssignmentOpen(false)}
      />

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
              {provisionError && (
                <div role="alert" className="p-3 rounded-lg bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 text-[#8b1515] flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{provisionError}</span>
                </div>
              )}
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
                <label className="block font-semibold text-[#161c27] mb-1">Enumerator Email *</label>
                <input
                  id="enumerator-email"
                  name="enumerator-email"
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="enumerator@example.com"
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Research Project *</label>
                <select
                  id="enumerator-project"
                  name="enumerator-project"
                  required
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value)}
                  disabled={assignProjectsLoading || provisioning}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"
                >
                  <option value="">{assignProjectsLoading ? 'Loading research projects...' : 'Select a research project'}</option>
                  {assignProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.project_code} — {project.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Target District / Region</label>
                <select
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"
                >
                  <option value="North District">North District (Kaduna)</option>
                  <option value="East District">East District (Enugu)</option>
                  <option value="South District">South District (Port Harcourt)</option>
                  <option value="West District">West District (Ibadan)</option>
                  <option value="Central Metro">Central Metro (Abuja)</option>
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
                  disabled={provisioning}
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#c4c6cf] font-semibold text-[#002045] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={provisioning || assignProjectsLoading}
                  className="px-5 py-2 rounded-lg bg-[#1a365d] text-white font-semibold hover:bg-[#002045] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {provisioning ? 'Registering...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enumerator Field Link & QR Modal */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#161c27]/50 backdrop-blur-xs"
            onClick={() => setIsLinkModalOpen(false)}
          />
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-[#c4c6cf]/40 animate-in zoom-in-95 space-y-0">
            {/* Modal Header */}
            <div className="bg-[#1a365d] text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                  <span className="material-symbols-outlined text-xl text-[#91f0ed]">qr_code_scanner</span>
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">Enumerator Field Dispatch Link</h2>
                  <p className="text-xs text-white/80">Direct offline PWA collector URL & QR Code</p>
                </div>
              </div>
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Target Enumerator Info */}
              <div className="p-3.5 bg-[#f1f3ff] rounded-xl border border-[#c4c6cf]/40 flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#002045] text-sm block">{selectedEnumerator.name}</span>
                  <span className="text-[#43474e] text-xs">
                    Enumerator ID: <code className="font-mono bg-white px-1 py-0.5 rounded border border-[#c4c6cf]/40 text-[#002045]">{selectedEnumerator.id}</code> • {selectedEnumerator.region}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#006a68]/10 text-[#006a68] border border-[#006a68]/30 uppercase">
                  Active Field Agent
                </span>
              </div>

              {/* QR Code & Scan Option */}
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-[#f9f9ff] rounded-xl border border-[#c4c6cf]/40">
                <div className="bg-white p-2.5 rounded-xl border-2 border-[#1a365d] shadow-sm shrink-0 flex items-center justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=4&data=${encodeURIComponent(
                      `${window.location.origin}/?mode=field&enum=${selectedEnumerator.id}&token=AUTH_${selectedEnumerator.id}`
                    )}`}
                    alt="Enumerator QR Code"
                    className="w-32 h-32 object-contain rounded-lg"
                  />
                </div>
                <div className="space-y-1.5 text-center sm:text-left">
                  <h4 className="font-bold text-[#002045] text-sm flex items-center justify-center sm:justify-start gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-[#006a68]">smartphone</span>
                    <span>Scan with Tablet / Phone</span>
                  </h4>
                  <p className="text-[#43474e] text-xs leading-relaxed">
                    Point the enumerator device camera at this QR code to instantly open the <strong>Offline PWA Field Collector</strong> configured for {selectedEnumerator.name}.
                  </p>
                  <p className="text-[11px] text-[#74777f]">
                    Works with zero internet once loaded; caches surveys directly in browser memory.
                  </p>
                </div>
              </div>

              {/* Copyable Web URL Link */}
              <div className="space-y-1.5">
                <label className="block font-bold text-[#002045] uppercase tracking-wider text-[11px]">
                  Shareable Field Access URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/?mode=field&enum=${selectedEnumerator.id}&token=AUTH_${selectedEnumerator.id}`}
                    className="flex-1 p-2.5 font-mono text-[11px] bg-white border border-[#c4c6cf] rounded-lg text-[#002045] select-all outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${window.location.origin}/?mode=field&enum=${selectedEnumerator.id}&token=AUTH_${selectedEnumerator.id}`
                      );
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2500);
                    }}
                    className={`px-4 py-2.5 rounded-lg font-semibold flex items-center gap-1.5 shrink-0 transition-colors shadow-2xs ${
                      copiedLink
                        ? 'bg-[#006a68] text-white'
                        : 'bg-[#1a365d] hover:bg-[#002045] text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {copiedLink ? 'done' : 'content_copy'}
                    </span>
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#c4c6cf]/40 flex flex-col sm:flex-row justify-between items-center gap-3">
                <span className="text-[11px] text-[#74777f]">
                  No app download needed • Runs as Progressive Web App
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsLinkModalOpen(false)}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-[#c4c6cf] font-semibold text-[#43474e] hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLinkModalOpen(false);
                      onOpenOfflineCollector();
                    }}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-[#006a68] text-white font-semibold hover:bg-[#004f4e] flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    <span>Launch Field App Now</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>

      {generatedCredentials && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[#002045]/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#c4c6cf]/60 overflow-hidden">
            <div className="bg-[#1a365d] text-white p-5">
              <h3 className="text-lg font-bold">Enumerator Login Credentials</h3>
              <p className="text-xs text-white/80 mt-1">Give these credentials securely to the enumerator.</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-bold text-[#74777f]">Enumerator</p>
                <p className="text-sm font-semibold text-[#002045]">{generatedCredentials.name}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#74777f]">Login email</p>
                <p className="text-sm font-semibold text-[#002045] break-all">{generatedCredentials.email}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#74777f]">Temporary password</p>
                <div className="mt-1 p-3 rounded-lg bg-[#f1f3ff] border border-[#c4c6cf] font-mono text-sm font-bold text-[#002045] select-all break-all">
                  {generatedCredentials.password}
                </div>
              </div>
              <p className="text-xs text-[#43474e] leading-relaxed">This password is temporary. The enumerator should change it after signing in.</p>
              <button
                type="button"
                onClick={() => setGeneratedCredentials(null)}
                className="w-full py-2.5 rounded-lg bg-[#006a68] hover:bg-[#004f4e] text-white text-sm font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
  );
};
