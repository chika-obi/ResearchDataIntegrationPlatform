import React, { useState } from 'react';
import { Project } from '../types';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (newProject: Omit<Project, 'id' | 'code' | 'progress' | 'enumeratorsCount' | 'responsesCount' | 'qualityScore'>) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate
}) => {
  const [title, setTitle] = useState('');
  const [institution, setInstitution] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Active' | 'Pending Approval' | 'Draft'>('Draft');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !institution.trim()) return;

    onCreate({
      title: title.trim(),
      institution: institution.trim(),
      startDate,
      endDate: endDate || '2025-12-31',
      description: description.trim() || 'New research initiative.',
      status
    });

    setTitle('');
    setInstitution('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#161c27]/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-[#c4c6cf]/40 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#c4c6cf]/50 flex justify-between items-center bg-[#f9f9ff]">
          <h2 className="text-[18px] font-bold text-[#002045]">Create New Project</h2>
          <button
            onClick={onClose}
            className="text-[#74777f] hover:text-[#002045] p-1 rounded-full hover:bg-[#e3e8f9] transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-[#161c27] mb-1.5">
              Project Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. National Literacy & Digital Skills Survey 2024"
              className="w-full px-3.5 py-2.5 bg-[#f9f9ff] rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] focus:ring-2 focus:ring-[#1a365d]/20 text-[14px] text-[#161c27] outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#161c27] mb-1.5">
              Institution / Client *
            </label>
            <input
              type="text"
              required
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. Ministry of Education & Science"
              className="w-full px-3.5 py-2.5 bg-[#f9f9ff] rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] focus:ring-2 focus:ring-[#1a365d]/20 text-[14px] text-[#161c27] outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#161c27] mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#f9f9ff] rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] focus:ring-2 focus:ring-[#1a365d]/20 text-[14px] text-[#161c27] outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#161c27] mb-1.5">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#f9f9ff] rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] focus:ring-2 focus:ring-[#1a365d]/20 text-[14px] text-[#161c27] outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#161c27] mb-1.5">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-[#f9f9ff] rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] focus:ring-2 focus:ring-[#1a365d]/20 text-[14px] text-[#161c27] outline-none transition-all"
            >
              <option value="Draft">Draft</option>
              <option value="Active">Active</option>
              <option value="Pending Approval">Pending Approval</option>
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#161c27] mb-1.5">
              Project Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief overview of research objectives, target demographics, and sampling strategy..."
              className="w-full px-3.5 py-2.5 bg-[#f9f9ff] rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] focus:ring-2 focus:ring-[#1a365d]/20 text-[14px] text-[#161c27] outline-none resize-none transition-all"
            />
          </div>

          <div className="pt-3 border-t border-[#c4c6cf]/40 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-[14px] font-semibold text-[#002045] border border-[#c4c6cf] hover:bg-[#f1f3ff] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-lg text-[14px] font-semibold bg-[#1a365d] text-white hover:bg-[#002045] transition-colors shadow-sm"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
