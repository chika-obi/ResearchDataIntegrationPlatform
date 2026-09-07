import React, { useEffect } from 'react';
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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  currentSection,
  onNavigate,
  isOfflineMode,
  onToggleOfflineMode,
  isOpenMobile = false,
  onCloseMobile,
  currentUser,
  onOpenAuthModal,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const isEnumerator = currentUser.role === 'enumerator';

  // Handle ESC key to dismiss mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpenMobile && onCloseMobile) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpenMobile, onCloseMobile]);

  const allNavItems: { id: NavSection; label: string; icon: string; badge?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'projects', label: 'Projects Hub', icon: 'folder_open' },
    { id: 'questionnaires', label: 'Questionnaire Studio', icon: 'edit_note' },
    { id: 'dictionary', label: 'Variable Dictionary', icon: 'menu_book', badge: 'SPSS' },
    { id: 'offline-collector', label: isEnumerator ? 'My Assigned Surveys' : 'Offline Field Collector', icon: 'cell_tower', badge: isEnumerator ? 'Assigned' : 'PWA' },
    { id: 'enumerators', label: 'Enumerator Operations', icon: 'groups' },
    { id: 'data-quality', label: 'Data Quality & Clean', icon: 'rule', badge: '94%' },
    { id: 'statistical-analysis', label: 'Statistical Engine', icon: 'psychology' },
    { id: 'visualizations', label: 'Data Visualizations', icon: 'leaderboard' },
    { id: 'reports', label: 'Chapter 4 Reports', icon: 'description', badge: 'APA 7' },
    { id: 'audit-security', label: 'Security & Supabase SQL', icon: 'security' },
    { id: 'settings', label: 'Settings & Encryption', icon: 'settings' }
  ];

  const navItems = isEnumerator
    ? allNavItems.filter((item) => item.id === 'offline-collector' || item.id === 'settings')
    : allNavItems;

  const renderContent = (collapsed: boolean, isMobileView: boolean) => (
    <div className="flex flex-col h-full bg-[#f9f9ff] text-[#161c27] select-none">
      {/* User Header & Persona Switcher */}
      <div className={`border-b border-[#c4c6cf]/60 bg-white transition-all ${collapsed ? 'p-3 flex flex-col items-center' : 'p-4'}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onOpenAuthModal}
              className="relative group cursor-pointer focus:outline-none"
              title={`${currentUser.name} (${currentUser.role}) - Click to manage`}
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#dde2f3] border-2 border-[#1a365d] shadow-xs">
                <img
                  src={currentUser.avatar}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                currentUser.role === 'admin' ? 'bg-[#ff9900]' : currentUser.role === 'enumerator' ? 'bg-[#006a68]' : 'bg-[#1a365d]'
              }`} />
            </button>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg text-[#74777f] hover:text-[#002045] hover:bg-[#f1f3ff] transition-colors mt-1"
                title="Expand Sidebar"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            )}
          </div>
        ) : (
          <div>
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
                  {/* Institution */}
                  <div className="mt-1 text-[11px] text-[#43474e] font-medium leading-snug line-clamp-2" title={currentUser.institution}>
                    {currentUser.institution}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={onOpenAuthModal}
                  className="p-1.5 rounded-lg text-[#74777f] hover:text-[#002045] hover:bg-[#f1f3ff] transition-colors"
                  title="Edit Profile, Switch Role or Upload Photo"
                >
                  <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                </button>

                {!isMobileView && onToggleCollapse && (
                  <button
                    onClick={onToggleCollapse}
                    className="p-1.5 rounded-lg text-[#74777f] hover:text-[#002045] hover:bg-[#f1f3ff] transition-colors"
                    title="Collapse Sidebar"
                  >
                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                  </button>
                )}
              </div>
            </div>

            {isEnumerator && (
              <div className="mt-3 p-2 bg-[#006a68]/10 border border-[#006a68]/20 rounded-lg text-[11px] text-[#006a68] flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] shrink-0">verified_user</span>
                <span className="leading-tight font-medium">RLS Enforced: Restricted to assigned field questionnaires only.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className={`flex-1 overflow-y-auto py-3 space-y-1 ${collapsed ? 'px-2' : 'px-2.5'}`}>
        {navItems.map((item) => {
          const isActive = currentSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                if (isMobileView && onCloseMobile) onCloseMobile();
              }}
              title={collapsed ? `${item.label}${item.badge ? ` (${item.badge})` : ''}` : undefined}
              className={`w-full text-left flex items-center rounded-xl transition-all duration-150 relative cursor-pointer ${
                collapsed
                  ? 'justify-center p-2.5 h-11'
                  : 'justify-between px-3 py-2.5 min-h-[44px] text-xs font-medium'
              } ${
                isActive
                  ? 'text-[#002045] bg-[#e3e8f9] font-bold shadow-xs' + (collapsed ? ' ring-2 ring-[#002045]/20' : ' border-l-4 border-[#002045]')
                  : 'text-[#43474e] hover:bg-[#f1f3ff] hover:text-[#161c27]'
              }`}
            >
              <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'justify-center' : 'flex-1 mr-1.5'}`}>
                <span
                  className={`material-symbols-outlined text-[20px] shrink-0 ${
                    isActive ? 'fill text-[#002045]' : 'text-[#74777f]'
                  }`}
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </div>

              {item.badge && !collapsed && (
                <span
                  className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                    isActive
                      ? 'bg-[#1a365d] text-white'
                      : 'bg-[#dde2f3] text-[#002045]'
                  }`}
                >
                  {item.badge}
                </span>
              )}

              {item.badge && collapsed && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#1a365d]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Offline Mode & Version Footer */}
      <div className={`border-t border-[#c4c6cf]/60 bg-[#f1f3ff]/40 ${collapsed ? 'p-2 space-y-2' : 'p-3.5 space-y-2.5'}`}>
        {collapsed ? (
          <button
            onClick={onToggleOfflineMode}
            className={`w-full flex items-center justify-center p-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
              isOfflineMode
                ? 'bg-[#ba1a1a]/10 border-[#ba1a1a]/30 text-[#ba1a1a]'
                : 'bg-white border-[#c4c6cf] text-[#43474e] hover:bg-[#f9f9ff]'
            }`}
            title={isOfflineMode ? 'Offline Simulation (Click to switch)' : 'Supabase Sync Online (Click to simulate offline)'}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isOfflineMode ? 'wifi_off' : 'wifi'}
            </span>
          </button>
        ) : (
          <button
            onClick={onToggleOfflineMode}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer min-h-[40px] ${
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
        )}

        <div className={`flex items-center text-[11px] text-[#74777f] ${collapsed ? 'justify-center' : 'justify-between px-1'}`}>
          {!collapsed && <span>RDIP Engine</span>}
          <span className="font-mono bg-[#dde2f3] px-1.5 py-0.5 rounded text-[#002045] font-semibold text-[10px]" title={`Version ${currentUser.version}`}>
            {currentUser.version}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop / Laptop / Tablet Adaptive Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-full z-30 shrink-0 border-r border-[#c4c6cf]/60 bg-[#f9f9ff] overflow-hidden transition-[width] duration-200 ease-in-out ${
          isCollapsed ? 'w-[72px]' : 'w-[260px] lg:w-[270px]'
        }`}
      >
        {renderContent(isCollapsed, false)}
      </aside>

      {/* Mobile Drawer Overlay (Phone & Small Screens) */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex" role="dialog" aria-modal="true">
          {/* Backdrop with blur and fade */}
          <div
            className="fixed inset-0 bg-[#002045]/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          {/* Slide-over Drawer Panel */}
          <div className="relative w-[85vw] max-w-xs bg-[#f9f9ff] h-full shadow-2xl z-10 flex flex-col animate-in slide-in-from-left duration-200">
            <div className="absolute top-3 right-3 z-20">
              <button
                onClick={onCloseMobile}
                className="w-10 h-10 rounded-full flex items-center justify-center text-[#43474e] hover:bg-[#e3e8f9] active:bg-[#dde2f3] transition-colors cursor-pointer"
                title="Close Navigation Menu"
                aria-label="Close Navigation Menu"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            {renderContent(false, true)}
          </div>
        </div>
      )}
    </>
  );
};

