import React from 'react';
import { NavSection } from '../types';

interface BottomNavBarProps {
  currentSection: NavSection;
  onNavigate: (section: NavSection) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentSection, onNavigate }) => {
  // Mobile nav maps to 5 primary actions as shown in mobile mockups
  const items: { id: NavSection; label: string; icon: string; aliases?: NavSection[] }[] = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'projects', label: 'Projects', icon: 'folder' },
    { id: 'questionnaires', label: 'Build', icon: 'add_circle' },
    { id: 'statistical-analysis', label: 'Stats', icon: 'analytics', aliases: ['statistical-analysis', 'visualizations', 'data-quality'] },
    { id: 'settings', label: 'Settings', icon: 'settings' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-2 md:hidden bg-[#f9f9ff] shadow-[0_-1px_3px_rgba(0,0,0,0.1)] border-t border-[#c4c6cf]/40 rounded-t-xl">
      {items.map((item) => {
        const isActive =
          currentSection === item.id || (item.aliases && item.aliases.includes(currentSection));
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center transition-transform active:scale-95 py-1 px-3 rounded-xl min-w-[56px] ${
              isActive
                ? 'bg-[#1a365d] text-white'
                : 'text-[#43474e] hover:bg-[#f1f3ff]'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[22px] mb-0.5 ${
                isActive ? 'fill text-white' : 'text-[#43474e]'
              }`}
              style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
            <span className="text-[11px] font-semibold leading-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
