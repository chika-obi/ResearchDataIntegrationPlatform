import React, { useState } from 'react';
import { NavSection, UserProfile } from '../types';

interface TopAppBarProps {
  currentSection: NavSection;
  onNavigate: (section: NavSection) => void;
  onOpenMobileMenu: () => void;
  onToggleAuthModal?: () => void;
  isOfflineMode: boolean;
  currentUser: UserProfile;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  currentSection,
  onNavigate,
  onOpenMobileMenu,
  onToggleAuthModal,
  isOfflineMode,
  currentUser
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: 1, title: 'Data Quality Anomaly', desc: 'Outlier value in Q4_Clinic_Distance_KM (420.0 km flagged)', time: '12m ago', unread: true },
    { id: 2, title: 'Field Batch Synced', desc: 'Sarah Jenkins uploaded 45 offline encrypted records', time: '25m ago', unread: true },
    { id: 3, title: 'Statistical Model Ready', desc: 'OLS Multiple Regression executed for Objective 4', time: '1h ago', unread: false }
  ];

  return (
    <header className="bg-[#f9f9ff] border-b border-[#c4c6cf]/60 h-16 flex items-center justify-between px-4 md:px-8 z-40 sticky top-0 w-full">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Mobile menu hamburger */}
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden text-[#002045] p-2 -ml-2 rounded-full hover:bg-[#e3e8f9] transition-colors"
          title="Open Menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        <div
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-[#1a365d] text-white flex items-center justify-center font-bold text-sm shadow-xs">
            R
          </div>
          <div>
            <span className="text-[19px] font-black text-[#002045] tracking-tight">RDIP</span>
            <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#1a365d]/10 text-[#1a365d]">
              Research Intelligence
            </span>
          </div>
        </div>

        {/* Section breadcrumbs (Desktop) */}
        <div className="hidden lg:flex items-center gap-2 ml-4 text-[13px] text-[#43474e]">
          <span className="material-symbols-outlined text-[16px] text-[#74777f]">chevron_right</span>
          <span className="capitalize font-semibold text-[#002045]">
            {currentSection.replace('-', ' ')}
          </span>
          {isOfflineMode && (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#ba1a1a]/10 text-[#ba1a1a] border border-[#ba1a1a]/20">
              <span className="material-symbols-outlined text-[12px]">wifi_off</span>
              Offline Simulation
            </span>
          )}
        </div>
      </div>

      {/* Right side tools */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-full text-[#43474e] hover:text-[#002045] hover:bg-[#f1f3ff] transition-colors relative"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#ba1a1a] rounded-full ring-2 ring-white"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-[#c4c6cf]/60 p-3 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-2 border-b border-[#c4c6cf]/30 mb-2">
                <span className="text-xs font-bold text-[#002045] uppercase tracking-wider">
                  System Telemetry Alerts
                </span>
                <span className="text-[10px] bg-[#d6e3ff] text-[#002045] font-semibold px-2 py-0.5 rounded-full">
                  2 Pending
                </span>
              </div>
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-lg text-xs transition-colors ${
                      n.unread ? 'bg-[#f1f3ff] border-l-3 border-[#1a365d]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-semibold text-[#002045]">{n.title}</div>
                    <div className="text-[#43474e] text-[11px] mt-0.5">{n.desc}</div>
                    <div className="text-[10px] text-[#74777f] mt-1">{n.time}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Public survey preview quick trigger */}
        <button
          onClick={() => onNavigate('public-survey')}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#c4c6cf] text-[#002045] text-xs font-semibold hover:bg-white transition-colors shadow-2xs"
        >
          <span className="material-symbols-outlined text-[16px] text-[#006a68]">open_in_new</span>
          <span>Respondent Portal</span>
        </button>

        {/* Auth / Role Switcher trigger */}
        <button
          onClick={onToggleAuthModal}
          className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-[#1a365d]/20 transition-all cursor-pointer"
          title="Account / Switch Persona Role"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden border border-[#c4c6cf]/60 bg-[#dde2f3] shadow-xs">
            <img
              src={currentUser.avatar}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          </div>
        </button>
      </div>
    </header>
  );
};
