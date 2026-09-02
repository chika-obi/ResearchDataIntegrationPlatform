import React from 'react';
import { NavSection, UserProfile } from '../types';

interface NavigationDrawerProps {
  currentSection: NavSection;
  onNavigate: (section: NavSection) => void;
  isOfflineMode: boolean;
  onToggleOfflineMode: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  currentUser: UserProfile;
  onOpenAuthModal: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  currentSection,
  onNavigate,
  isOfflineMode,
  onToggleOfflineMode,
  isOpenMobile,
  onCloseMobile,
  currentUser,
  onOpenAuthModal
}) => {
  const navItems: { id: NavSection; label: string; icon: string; badge?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'projects', label: 'Projects Hub', icon: 'folder_open' },
    { id: 'questionnaires', label: 'Questionnaire Studio', icon: 'edit_note' },
    { id: 'dictionary', label: 'Variable Dictionary', icon: 'menu_book', badge: 'SPSS' },
    { id: 'offline-collector', label: 'Offline Field Collector', icon: 'cell_tower', badge: 'PWA' },
    { id: 'enumerators', label: 'Enumerator Operations', icon: 'groups' },
    { id: 'data-quality', label: 'Data Quality & Clean', icon: 'rule', badge: '94%' },
    { id: 'statistical-analysis', label: 'Statistical Engine', icon: 'psychology' },
    { id: 'visualizations', label: 'Data Visualizations', icon: 'leaderboard' },
    { id: 'reports', label: 'Chapter 4 Reports', icon: 'description', badge: 'APA 7' },
    { id: 'audit-security', label: 'Security & Supabase SQL', icon: 'security' },
    { id: 'settings', label: 'Settings & Encryption', icon: 'settings' }
  ];

  const drawerContent = (
    <div className="flex flex-col h-full bg-[#f9f9ff] text-[#161c27] select-none">
      {/* User Header & Persona Switcher */}
      <div className="p-4 border-b border-[#c4c6cf]/60 bg-white">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-[#dde2f3] shrink-0 border border-[#c4c6cf]/60 shadow-xs mt-0.5">
              <img
                src={currentUser.avatar}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-[#002045] truncate leading-tight">
                {currentUser.name}
              </h2>
              {/* Role badge */}
              <div className="mt-1">
                <span
                  className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    currentUser.role === 'researcher'
                      ? 'bg-[#1a365d]/10 text-[#1a365d] border border-[#1a365d]/20'
                      : currentUser.role === 'admin'
                      ? 'bg-[#371800]/15 text-[#572900] border border-[#572900]/20'
                      : 'bg-[#006a68]/15 text-[#006a68] border border-[#006a68]/20'
                  }`}
                >
                  {currentUser.role}
                </span>
              </div>
              {/* Institution directly under Role */}
              <div className="mt-1 text-[11px] text-[#43474e] font-medium leading-snug line-clamp-2" title={currentUser.institution}>
                {currentUser.institution}
              </div>
            </div>
          </div>

          <button
            onClick={onOpenAuthModal}
            className="p-1.5 rounded-lg text-[#74777f] hover:text-[#002045] hover:bg-[#f1f3ff] transition-colors shrink-0 mt-0.5"
            title="Edit Profile, Switch Role or Upload Photo"
          >
            <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
          </button>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = currentSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full text-left flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 relative ${
                isActive
                  ? 'text-[#002045] bg-[#e3e8f9] border-l-4 border-[#002045] font-bold shadow-xs'
                  : 'text-[#43474e] hover:bg-[#f1f3ff] hover:text-[#161c27]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`material-symbols-outlined text-[18px] ${
                    isActive ? 'fill text-[#002045]' : 'text-[#74777f]'
                  }`}
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                    isActive
                      ? 'bg-[#1a365d] text-white'
                      : 'bg-[#dde2f3] text-[#002045]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Offline Mode & Version */}
      <div className="p-3.5 border-t border-[#c4c6cf]/60 space-y-2.5 bg-[#f1f3ff]/40">
        <button
          onClick={onToggleOfflineMode}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
            isOfflineMode
              ? 'bg-[#ba1a1a]/10 border-[#ba1a1a]/30 text-[#ba1a1a]'
              : 'bg-white border-[#c4c6cf] text-[#43474e] hover:bg-[#f9f9ff]'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">
              {isOfflineMode ? 'wifi_off' : 'wifi'}
            </span>
            <span>{isOfflineMode ? 'Offline Simulation' : 'Supabase Sync'}</span>
          </div>
          <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#dde2f3] text-[#002045]">
            {isOfflineMode ? 'OFFLINE' : 'ONLINE'}
          </span>
        </button>

        <div className="flex items-center justify-between text-[11px] text-[#74777f] px-1">
          <span>RDIP Core Engine</span>
          <span className="font-mono bg-[#dde2f3] px-1.5 py-0.5 rounded text-[#002045] font-semibold text-[10px]">
            {currentUser.version}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col h-full z-30 w-[260px] shrink-0 border-r border-[#c4c6cf]/60 sticky top-16 h-[calc(100vh-4rem)]">
        {drawerContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-[#002045]/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-4/5 max-w-xs bg-[#f9f9ff] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            <div className="absolute top-3 right-3 z-20">
              <button
                onClick={onCloseMobile}
                className="p-1 rounded-full text-[#43474e] hover:bg-[#e3e8f9]"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {drawerContent}
          </div>
        </div>
      )}
    </>
  );
};
