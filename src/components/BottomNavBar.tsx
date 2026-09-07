import React from 'react';
import { NavSection, UserProfile } from '../types';

interface BottomNavBarProps {
  currentSection: NavSection;
  onNavigate: (section: NavSection) => void;
  currentUser?: UserProfile;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentSection, onNavigate, currentUser }) => {
  const isEnumerator = currentUser?.role === 'enumerator';

  // Mobile nav items based on role
  const items: { id: NavSection; label: string; icon: string; aliases?: NavSection[] }[] = isEnumerator
    ? [
        { id: 'offline-collector', label: 'Field Surveys', icon: 'cell_tower' },
        { id: 'settings', label: 'Settings', icon: 'settings' }
      ]
    : [
        { id: 'dashboard', label: 'Home', icon: 'home' },
        { id: 'projects', label: 'Projects', icon: 'folder' },
        { id: 'questionnaires', label: 'Build', icon: 'add_circle' },
        { id: 'statistical-analysis', label: 'Stats', icon: 'analytics', aliases: ['statistical-analysis', 'visualizations', 'data-quality'] },
        { id: 'settings', label: 'Settings', icon: 'settings' }
      ];

  return (
    <nav
      className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 py-1.5 pb-2.5 sm:pb-2 md:hidden bg-[#f9f9ff]/95 backdrop-blur-md shadow-[0_-2px_10px_rgba(0,0,0,0.06)] border-t border-[#c4c6cf]/50"
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0.625rem))' }}
      aria-label="Mobile Navigation Bar"
    >
      {items.map((item) => {
        const isActive =
          currentSection === item.id || (item.aliases && item.aliases.includes(currentSection));
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center transition-all duration-150 active:scale-95 py-1 px-2.5 rounded-xl min-w-[54px] min-h-[48px] cursor-pointer ${
              isActive
                ? 'bg-[#1a365d] text-white shadow-xs'
                : 'text-[#43474e] hover:bg-[#f1f3ff] hover:text-[#002045]'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] mb-0.5 ${
                isActive ? 'fill text-white' : 'text-[#43474e]'
              }`}
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
            <span className="text-[10px] sm:text-[11px] font-semibold leading-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
