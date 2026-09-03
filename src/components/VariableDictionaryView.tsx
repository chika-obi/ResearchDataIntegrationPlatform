import React, { useState } from 'react';
import { VariableDictionaryItem, DataType, MeasurementLevel } from '../types';
import { INITIAL_VARIABLE_DICTIONARY } from '../data/mockData';

export const VariableDictionaryView: React.FC = () => {
  const [variables, setVariables] = useState<VariableDictionaryItem[]>(() => {
    const saved = localStorage.getItem('rdip_variable_dictionary');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_VARIABLE_DICTIONARY;
      }
    }
    return INITIAL_VARIABLE_DICTIONARY;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDataType, setFilterDataType] = useState<string>('All');
  const [filterObjective, setFilterObjective] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'all' | 'nominal' | 'ordinal' | 'continuous'>('all');
  const [editingVar, setEditingVar] = useState<VariableDictionaryItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // New variable form state
  const [newVarName, setNewVarName] = useState('');
  const [newVarLabel, setNewVarLabel] = useState('');
  const [newVarDataType, setNewVarDataType] = useState<DataType>('Categorical');
  const [newVarMeasurement, setNewVarMeasurement] = useState<MeasurementLevel>('Nominal');
  const [newVarObjective, setNewVarObjective] = useState('Objective 1: Assess emergency medical readiness and facility distribution');
  const [newVarMissingCode, setNewVarMissingCode] = useState('99');
  const [newVarValueLabelsStr, setNewVarValueLabelsStr] = useState('1: Option A\n2: Option B\n3: Option C');

  const filteredVariables = variables.filter((v) => {
    const matchesSearch =
      v.variableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.linkedObjective.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterDataType === 'All' || v.dataType === filterDataType;
    const matchesObj = filterObjective === 'All' || v.linkedObjective.includes(filterObjective);

    let matchesTab = true;
    if (activeTab === 'nominal') {
      matchesTab = v.measurementLevel === 'Nominal' || v.dataType === 'Categorical';
    } else if (activeTab === 'ordinal') {
      matchesTab = v.measurementLevel === 'Ordinal';
    } else if (activeTab === 'continuous') {
      matchesTab =
        v.measurementLevel === 'Interval' ||
        v.measurementLevel === 'Ratio' ||
        v.dataType === 'Numerical' ||
        v.dataType === 'Continuous';
    }

    return matchesSearch && matchesType && matchesObj && matchesTab;
  });

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVar) return;
    const updated = variables.map((v) => (v.id === editingVar.id ? editingVar : v));
    setVariables(updated);
    localStorage.setItem('rdip_variable_dictionary', JSON.stringify(updated));
    setEditingVar(null);
    setNotification(`Variable metadata for ${editingVar.variableName} updated successfully.`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddVariable = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedValueLabels = newVarValueLabelsStr
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const parts = line.split(':');
        return {
          code: parts[0] ? parts[0].trim() : '',
          label: parts[1] ? parts[1].trim() : parts[0].trim()
        };
      });

    const newVar: VariableDictionaryItem = {
      id: `var-${Date.now().toString().slice(-4)}`,
      variableName: newVarName.trim().replace(/\s+/g, '_'),
      label: newVarLabel.trim(),
      dataType: newVarDataType,
      measurementLevel: newVarMeasurement,
      linkedObjective: newVarObjective,
      missingValueCode: newVarMissingCode,
      questionId: `q-${Date.now().toString().slice(-4)}`,
      valueLabels: parsedValueLabels
    };

    const updated = [...variables, newVar];
    setVariables(updated);
    localStorage.setItem('rdip_variable_dictionary', JSON.stringify(updated));
    setIsAddModalOpen(false);
    // Reset form
    setNewVarName('');
    setNewVarLabel('');
    setNotification(`Variable ${newVar.variableName} added to statistical dictionary.`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteVariable = (id: string, name: string) => {
    if (confirm(`Remove variable ${name} from data dictionary?`)) {
      const updated = variables.filter((v) => v.id !== id);
      setVariables(updated);
      localStorage.setItem('rdip_variable_dictionary', JSON.stringify(updated));
      setNotification(`Variable ${name} removed.`);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleExportCodebook = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Variable Name,Label,Data Type,Measurement Level,Linked Objective,Missing Code,Value Labels']
        .concat(
          variables.map(
            (v) =>
              `"${v.variableName}","${v.label}","${v.dataType}","${v.measurementLevel}","${v.linkedObjective}","${
                v.missingValueCode
              }","${v.valueLabels.map((l) => `${l.code}=${l.label}`).join('; ')}"`
          )
        )
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RDIP_Variable_Codebook_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded bg-[#1a365d]/10 text-[#1a365d] text-[11px] font-bold uppercase tracking-wider">
              Engine 7: Variable Dictionary & Codebook
            </span>
            <span className="text-xs text-[#74777f]">N = {variables.length} Codified Variables</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#002045] tracking-tight mt-1">
            Variable Dictionary & Measurement Levels
          </h1>
          <p className="text-[#43474e] text-xs md:text-sm mt-1 max-w-3xl">
            Standardized variable schemas, measurement scales (Nominal, Ordinal, Interval, Ratio), and value coding matrices feeding the Intelligent Statistical Engine.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportCodebook}
            className="px-3.5 py-2 rounded-lg border border-[#c4c6cf] text-[#002045] text-xs font-semibold hover:bg-white flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>Export Codebook (.csv)</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-[#1a365d] text-white text-xs font-semibold hover:bg-[#002045] flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Add Variable Metadata</span>
          </button>
        </div>
      </div>

      {/* Navigation Tab Bar / Views Mode */}
      <div className="flex items-center gap-1.5 p-1 bg-[#e9ecf8]/70 border border-[#c4c6cf]/60 rounded-xl overflow-x-auto scrollbar-none text-xs font-semibold">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'all'
              ? 'bg-white text-[#002045] shadow-xs font-bold'
              : 'text-[#43474e] hover:text-[#002045] hover:bg-white/60'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">menu_book</span>
          <span>All Variables</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            activeTab === 'all' ? 'bg-[#1a365d]/10 text-[#1a365d]' : 'bg-[#c4c6cf]/40 text-[#43474e]'
          }`}>
            {variables.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('nominal')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'nominal'
              ? 'bg-white text-[#002045] shadow-xs font-bold'
              : 'text-[#43474e] hover:text-[#002045] hover:bg-white/60'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">category</span>
          <span>Nominal / Categorical</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            activeTab === 'nominal' ? 'bg-[#1a365d]/10 text-[#1a365d]' : 'bg-[#c4c6cf]/40 text-[#43474e]'
          }`}>
            {variables.filter(v => v.measurementLevel === 'Nominal' || v.dataType === 'Categorical').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ordinal')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'ordinal'
              ? 'bg-white text-[#002045] shadow-xs font-bold'
              : 'text-[#43474e] hover:text-[#002045] hover:bg-white/60'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">format_list_numbered</span>
          <span>Ordinal (Likert)</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            activeTab === 'ordinal' ? 'bg-[#1a365d]/10 text-[#1a365d]' : 'bg-[#c4c6cf]/40 text-[#43474e]'
          }`}>
            {variables.filter(v => v.measurementLevel === 'Ordinal').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('continuous')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg whitespace-nowrap transition-all ${
            activeTab === 'continuous'
              ? 'bg-white text-[#002045] shadow-xs font-bold'
              : 'text-[#43474e] hover:text-[#002045] hover:bg-white/60'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">show_chart</span>
          <span>Interval / Ratio (Continuous)</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            activeTab === 'continuous' ? 'bg-[#1a365d]/10 text-[#1a365d]' : 'bg-[#c4c6cf]/40 text-[#43474e]'
          }`}>
            {variables.filter(v => v.measurementLevel === 'Interval' || v.measurementLevel === 'Ratio' || v.dataType === 'Numerical' || v.dataType === 'Continuous').length}
          </span>
        </button>
      </div>

      {/* Notification */}
      {notification && (
        <div className="p-3 bg-[#e3e8f9] border border-[#adc7f7] rounded-xl text-xs font-semibold text-[#002045] flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[#006a68]">check_circle</span>
          <span>{notification}</span>
        </div>
      )}

      {/* Filters & Search Bar */}
      <div className="bg-white rounded-xl card-shadow border border-[#c4c6cf]/40 p-3.5 sm:p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 text-xs">
        <div className="relative w-full xl:w-80 shrink-0">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#74777f] text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search variable name, label, or objective..."
            className="w-full pl-9 pr-8 py-2 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] focus:ring-1 focus:ring-[#1a365d] outline-none text-xs bg-[#f9f9ff] focus:bg-white transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-[#74777f] hover:text-[#002045]"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 w-full xl:w-auto min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-semibold text-[#43474e] whitespace-nowrap">Data Type:</span>
            <select
              value={filterDataType}
              onChange={(e) => setFilterDataType(e.target.value)}
              className="p-2 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white font-medium text-xs max-w-full"
            >
              <option value="All">All Types</option>
              <option value="Categorical">Categorical</option>
              <option value="Numerical">Numerical</option>
              <option value="Ordinal">Ordinal</option>
              <option value="Continuous">Continuous</option>
            </select>
          </div>

          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <span className="font-semibold text-[#43474e] whitespace-nowrap">Objective:</span>
            <select
              value={filterObjective}
              onChange={(e) => setFilterObjective(e.target.value)}
              className="p-2 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white font-medium text-xs max-w-xs truncate"
            >
              <option value="All">All Research Objectives</option>
              <option value="Objective 1">Objective 1 (Readiness)</option>
              <option value="Objective 2">Objective 2 (Demographics)</option>
              <option value="Objective 3">Objective 3 (Supply Chain)</option>
              <option value="Objective 4">Objective 4 (Satisfaction)</option>
            </select>
          </div>

          {(searchTerm || filterDataType !== 'All' || filterObjective !== 'All' || activeTab !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterDataType('All');
                setFilterObjective('All');
                setActiveTab('all');
              }}
              className="text-[#ba1a1a] hover:underline font-semibold text-[11px] px-2 py-1 rounded bg-[#ba1a1a]/5 hover:bg-[#ba1a1a]/10 whitespace-nowrap transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Dictionary Table */}
      <div className="bg-white rounded-xl card-shadow border border-[#c4c6cf]/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs border-collapse">
            <thead className="bg-[#f1f3ff] border-b border-[#c4c6cf]/60 text-[#002045] font-bold">
              <tr>
                <th className="py-3 px-4">Variable Name</th>
                <th className="py-3 px-4">Variable Label & Question Text</th>
                <th className="py-3 px-4">Data Type</th>
                <th className="py-3 px-4">Measurement Level</th>
                <th className="py-3 px-4">Value Codes & Labels</th>
                <th className="py-3 px-4">Linked Research Objective</th>
                <th className="py-3 px-4 text-center">Missing Code</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c4c6cf]/30">
              {filteredVariables.map((item) => (
                <tr key={item.id} className="hover:bg-[#f9f9ff] transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-[#1a365d]">
                    {item.variableName}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-[#161c27] max-w-xs">
                    {item.label}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                        item.dataType === 'Categorical'
                          ? 'bg-[#d6e3ff] text-[#002045]'
                          : item.dataType === 'Numerical' || item.dataType === 'Continuous'
                          ? 'bg-[#91f0ed]/40 text-[#006e6d]'
                          : 'bg-[#ffdad6] text-[#93000a]'
                      }`}
                    >
                      {item.dataType}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-[#002045] px-2 py-0.5 rounded bg-[#f1f3ff] border border-[#c4c6cf]/40">
                      {item.measurementLevel}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs">
                    {item.valueLabels && item.valueLabels.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {item.valueLabels.map((vl, idx) => (
                          <span
                            key={idx}
                            className="inline-block text-[10px] bg-[#dde2f3]/60 px-1.5 py-0.5 rounded text-[#161c27]"
                          >
                            <strong>{vl.code}</strong> = {vl.label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#74777f] italic text-[11px]">Continuous numeric interval</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-[#43474e] text-[11px] max-w-xs truncate">
                    {item.linkedObjective}
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-[#74777f]">
                    {item.missingValueCode}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingVar(item)}
                        className="p-1 text-[#1a365d] hover:bg-[#e3e8f9] rounded transition-colors"
                        title="Edit Variable"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteVariable(item.id, item.variableName)}
                        className="p-1 text-[#ba1a1a] hover:bg-[#ffdad6] rounded transition-colors"
                        title="Delete Variable"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingVar && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#002045]/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#c4c6cf]/60 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#1a365d] text-white p-5 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base">Edit Variable: {editingVar.variableName}</h3>
              <button
                onClick={() => setEditingVar(null)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs overflow-y-auto">
              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Variable Label</label>
                <input
                  type="text"
                  required
                  value={editingVar.label}
                  onChange={(e) => setEditingVar({ ...editingVar, label: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#161c27] mb-1">Data Type</label>
                  <select
                    value={editingVar.dataType}
                    onChange={(e) =>
                      setEditingVar({ ...editingVar, dataType: e.target.value as DataType })
                    }
                    className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"
                  >
                    <option value="Categorical">Categorical</option>
                    <option value="Numerical">Numerical</option>
                    <option value="Ordinal">Ordinal</option>
                    <option value="Continuous">Continuous</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#161c27] mb-1">Measurement Level</label>
                  <select
                    value={editingVar.measurementLevel}
                    onChange={(e) =>
                      setEditingVar({
                        ...editingVar,
                        measurementLevel: e.target.value as MeasurementLevel
                      })
                    }
                    className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"
                  >
                    <option value="Nominal">Nominal</option>
                    <option value="Ordinal">Ordinal</option>
                    <option value="Interval">Interval</option>
                    <option value="Ratio">Ratio</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Linked Research Objective</label>
                <input
                  type="text"
                  value={editingVar.linkedObjective}
                  onChange={(e) => setEditingVar({ ...editingVar, linkedObjective: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Missing Value Code</label>
                <input
                  type="text"
                  value={editingVar.missingValueCode}
                  onChange={(e) => setEditingVar({ ...editingVar, missingValueCode: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#c4c6cf]/40">
                <button
                  type="button"
                  onClick={() => setEditingVar(null)}
                  className="px-4 py-2 border border-[#c4c6cf] text-[#43474e] rounded-lg font-semibold hover:bg-[#f1f3ff]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1a365d] text-white rounded-lg font-semibold hover:bg-[#002045]"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#002045]/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#c4c6cf]/60 w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-[#1a365d] text-white p-5 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-base">Register New Variable Metadata</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleAddVariable} className="p-6 space-y-3.5 text-xs overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#161c27] mb-1">Variable Name (SPSS style)</label>
                  <input
                    type="text"
                    required
                    placeholder="Q9_Income_Category"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#161c27] mb-1">Missing Value Code</label>
                  <input
                    type="text"
                    required
                    value={newVarMissingCode}
                    onChange={(e) => setNewVarMissingCode(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Variable Label (Descriptive)</label>
                <input
                  type="text"
                  required
                  placeholder="Monthly Estimated Household Income Bracket"
                  value={newVarLabel}
                  onChange={(e) => setNewVarLabel(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#161c27] mb-1">Data Type</label>
                  <select
                    value={newVarDataType}
                    onChange={(e) => setNewVarDataType(e.target.value as DataType)}
                    className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"
                  >
                    <option value="Categorical">Categorical</option>
                    <option value="Numerical">Numerical</option>
                    <option value="Ordinal">Ordinal</option>
                    <option value="Continuous">Continuous</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#161c27] mb-1">Measurement Level</label>
                  <select
                    value={newVarMeasurement}
                    onChange={(e) => setNewVarMeasurement(e.target.value as MeasurementLevel)}
                    className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"
                  >
                    <option value="Nominal">Nominal</option>
                    <option value="Ordinal">Ordinal</option>
                    <option value="Interval">Interval</option>
                    <option value="Ratio">Ratio</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Linked Research Objective</label>
                <select
                  value={newVarObjective}
                  onChange={(e) => setNewVarObjective(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"
                >
                  <option value="Objective 1: Assess emergency medical readiness and facility distribution">
                    Objective 1: Assess emergency medical readiness and facility distribution
                  </option>
                  <option value="Objective 2: Evaluate socio-demographic disparities in healthcare accessibility">
                    Objective 2: Evaluate socio-demographic disparities in healthcare accessibility
                  </option>
                  <option value="Objective 3: Determine supply chain resiliency and stockout frequencies">
                    Objective 3: Determine supply chain resiliency and stockout frequencies
                  </option>
                  <option value="Objective 4: Model predictors of maternal and infant primary care satisfaction">
                    Objective 4: Model predictors of maternal and infant primary care satisfaction
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#161c27] mb-1">
                  Value Codes & Labels (One per line as `Code: Label`)
                </label>
                <textarea
                  rows={3}
                  value={newVarValueLabelsStr}
                  onChange={(e) => setNewVarValueLabelsStr(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none font-mono text-[11px]"
                  placeholder="1: Less than N50,000&#10;2: N50,000 - N100,000&#10;3: Above N100,000"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#c4c6cf]/40">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-[#c4c6cf] text-[#43474e] rounded-lg font-semibold hover:bg-[#f1f3ff]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1a365d] text-white rounded-lg font-semibold hover:bg-[#002045]"
                >
                  Add to Dictionary
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
