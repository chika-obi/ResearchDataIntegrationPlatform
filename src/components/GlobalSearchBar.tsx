import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Project, Question, Enumerator, NavSection } from '../types';
import { INITIAL_QUESTIONS, INITIAL_ENUMERATORS } from '../data/mockData';

export interface GlobalSearchResultItem {
  id: string;
  category: 'project' | 'question' | 'enumerator' | 'navigation';
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  icon: string;
  targetSection: NavSection;
  payload?: any;
}

interface GlobalSearchBarProps {
  projects: Project[];
  onNavigate: (section: NavSection) => void;
  onSelectProject?: (project: Project) => void;
  onSelectEnumerator?: (enumeratorId: string) => void;
  onSelectQuestion?: (questionId: string) => void;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({
  projects,
  onNavigate,
  onSelectProject,
  onSelectEnumerator,
  onSelectQuestion
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'project' | 'question' | 'enumerator'>('all');
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut (Cmd+K or Ctrl+K or /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load questions and enumerators (dynamically checking localStorage cache where available)
  const allQuestions: Question[] = useMemo(() => {
    try {
      const saved = localStorage.getItem('rdip_custom_questions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return INITIAL_QUESTIONS;
  }, [isOpen]);

  const allEnumerators: Enumerator[] = useMemo(() => {
    try {
      const saved = localStorage.getItem('rdip_custom_enumerators');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return INITIAL_ENUMERATORS;
  }, [isOpen]);

  // Aggregate and filter search results
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Quick Suggestions when search input is empty but focused
      const suggestions: GlobalSearchResultItem[] = [
        ...projects.slice(0, 3).map((p) => ({
          id: `p-${p.id}`,
          category: 'project' as const,
          title: p.title,
          subtitle: `${p.code} • ${p.category || 'Public Health'} • ${p.responsesCount.toLocaleString()} responses`,
          badge: p.status,
          badgeColor: p.status === 'Active' ? 'bg-[#006a68]/10 text-[#006a68]' : 'bg-slate-100 text-slate-700',
          icon: 'folder_open',
          targetSection: 'projects' as NavSection,
          payload: p
        })),
        {
          id: 'nav-qa',
          category: 'navigation' as const,
          title: 'Questionnaire Builder',
          subtitle: `${allQuestions.length} survey questions loaded with skip logic & validation`,
          badge: 'Survey Studio',
          badgeColor: 'bg-[#1a365d]/10 text-[#1a365d]',
          icon: 'quiz',
          targetSection: 'questionnaires' as NavSection
        },
        {
          id: 'nav-enum',
          category: 'navigation' as const,
          title: 'Enumerator Fleet & Live Map',
          subtitle: `${allEnumerators.length} active field agents • Offline GPS telemetry`,
          badge: 'Fleet Ops',
          badgeColor: 'bg-[#e88532]/10 text-[#a04e00]',
          icon: 'badge',
          targetSection: 'enumerators' as NavSection
        },
        {
          id: 'nav-stat',
          category: 'navigation' as const,
          title: 'Statistical Models & Hypotheses',
          subtitle: 'Execute ANOVA, OLS Regression, EFA, Chi-Square, and Cronbach alpha',
          badge: 'Biostats',
          badgeColor: 'bg-[#006a68]/10 text-[#006a68]',
          icon: 'query_stats',
          targetSection: 'statistical-analysis' as NavSection
        }
      ];
      return suggestions;
    }

    const items: GlobalSearchResultItem[] = [];

    // 1. Projects Search
    if (selectedCategory === 'all' || selectedCategory === 'project') {
      projects.forEach((proj) => {
        const matchTitle = proj.title.toLowerCase().includes(q);
        const matchCode = proj.code.toLowerCase().includes(q);
        const matchDesc = (proj.description || '').toLowerCase().includes(q);
        const matchCat = (proj.category || '').toLowerCase().includes(q);
        const matchLead = (proj.leadInvestigator || '').toLowerCase().includes(q);

        if (matchTitle || matchCode || matchDesc || matchCat || matchLead) {
          items.push({
            id: `proj-${proj.id}`,
            category: 'project',
            title: proj.title,
            subtitle: `${proj.code} • Lead: ${proj.leadInvestigator || 'PI Team'} • ${proj.responsesCount.toLocaleString()} responses (${proj.progress}% quota)`,
            badge: proj.status,
            badgeColor: proj.status === 'Active' ? 'bg-[#006a68]/10 text-[#006a68]' : 'bg-slate-100 text-slate-700',
            icon: 'folder_open',
            targetSection: 'projects',
            payload: proj
          });
        }
      });
    }

    // 2. Survey Questions Search
    if (selectedCategory === 'all' || selectedCategory === 'question') {
      allQuestions.forEach((quest) => {
        const matchTitle = quest.title.toLowerCase().includes(q);
        const matchNum = quest.number.toLowerCase().includes(q);
        const matchVarName = quest.variableName.toLowerCase().includes(q);
        const matchVarLabel = (quest.variableLabel || '').toLowerCase().includes(q);
        const matchObjective = (quest.linkedObjective || '').toLowerCase().includes(q);
        const matchSection = (quest.section || '').toLowerCase().includes(q);

        if (matchTitle || matchNum || matchVarName || matchVarLabel || matchObjective || matchSection) {
          items.push({
            id: `quest-${quest.id}`,
            category: 'question',
            title: `${quest.number}: ${quest.title}`,
            subtitle: `Var: [${quest.variableName}] • ${quest.type.toUpperCase()} • ${quest.section || 'General'}`,
            badge: quest.dataTypeConstraint || quest.type,
            badgeColor: 'bg-[#1a365d]/10 text-[#1a365d]',
            icon: 'help_outline',
            targetSection: 'questionnaires',
            payload: quest
          });
        }
      });
    }

    // 3. Enumerators Search
    if (selectedCategory === 'all' || selectedCategory === 'enumerator') {
      allEnumerators.forEach((en) => {
        const matchName = en.name.toLowerCase().includes(q);
        const matchId = en.id.toLowerCase().includes(q);
        const matchRegion = (en.region || '').toLowerCase().includes(q);
        const matchPhone = (en.phone || '').toLowerCase().includes(q);

        if (matchName || matchId || matchRegion || matchPhone) {
          items.push({
            id: `enum-${en.id}`,
            category: 'enumerator',
            title: en.name,
            subtitle: `ID: ${en.id} • ${en.region} • ${en.responses} responses • Battery ${en.batteryLevel}%`,
            badge: en.status === 'Synced' ? 'Online Synced' : en.status === 'Pending' ? 'Pending Sync' : 'Offline',
            badgeColor: en.status === 'Synced' ? 'bg-[#006a68]/10 text-[#006a68]' : 'bg-[#e88532]/10 text-[#a04e00]',
            icon: 'person_pin_circle',
            targetSection: 'enumerators',
            payload: en
          });
        }
      });
    }

    return items;
  }, [query, selectedCategory, projects, allQuestions, allEnumerators]);

  // Handle item click/select
  const handleSelectItem = (item: GlobalSearchResultItem) => {
    setIsOpen(false);
    setQuery('');

    if (item.category === 'project' && item.payload) {
      if (onSelectProject) {
        onSelectProject(item.payload);
      }
      onNavigate('projects');
    } else if (item.category === 'question' && item.payload) {
      if (onSelectQuestion) {
        onSelectQuestion(item.payload.id);
      }
      onNavigate('questionnaires');
    } else if (item.category === 'enumerator' && item.payload) {
      if (onSelectEnumerator) {
        onSelectEnumerator(item.payload.id);
      }
      onNavigate('enumerators');
    } else {
      onNavigate(item.targetSection);
    }
  };

  // Keyboard navigation up/down/enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults[activeIndex]) {
        handleSelectItem(searchResults[activeIndex]);
      }
    }
  };

  // Keep active index in bounds
  useEffect(() => {
    setActiveIndex(0);
  }, [searchResults.length, selectedCategory, query]);

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md mx-2 md:mx-6 z-50">
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <span className="material-symbols-outlined absolute left-3 text-[#74777f] text-[18px] pointer-events-none">
          search
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Global search: projects, questions, enumerators... (Press ⌘K or /)"
          className="w-full pl-9 pr-16 py-1.5 bg-[#f1f3ff] hover:bg-[#e9ecf8] focus:bg-white text-xs font-medium text-[#002045] placeholder-[#74777f] rounded-xl border border-[#c4c6cf]/60 focus:border-[#1a365d] focus:ring-2 focus:ring-[#1a365d]/15 outline-none transition-all shadow-2xs"
        />

        {/* Clear Button / Shortcut Tag */}
        <div className="absolute right-2.5 flex items-center gap-1">
          {query ? (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="text-[#74777f] hover:text-[#002045] p-0.5 rounded-full hover:bg-slate-200 transition-colors"
              title="Clear search"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-[#74777f] bg-white px-1.5 py-0.5 rounded border border-[#c4c6cf]/40 shadow-2xs pointer-events-none">
              <span className="text-[9px]">⌘</span>K
            </kbd>
          )}
        </div>
      </div>

      {/* Dropdown Results Box */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-2xl border border-[#c4c6cf]/70 overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-2 max-h-[460px]">
          {/* Category Filter Chips */}
          <div className="p-2.5 bg-[#f9f9ff] border-b border-[#c4c6cf]/40 flex items-center justify-between gap-1 flex-wrap">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'all', label: 'All Results' },
                  { id: 'project', label: 'Projects' },
                  { id: 'question', label: 'Survey Questions' },
                  { id: 'enumerator', label: 'Enumerators' }
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-[#1a365d] text-white shadow-2xs'
                      : 'text-[#43474e] hover:bg-[#e3e8f9]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <span className="text-[10px] text-[#74777f] font-medium hidden sm:inline-block">
              {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}
            </span>
          </div>

          {/* Results List */}
          <div className="overflow-y-auto flex-1 divide-y divide-[#c4c6cf]/20 max-h-[360px]">
            {searchResults.length > 0 ? (
              searchResults.map((item, idx) => {
                const isSelected = activeIndex === idx;
                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelectItem(item)}
                    className={`p-3 px-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#f1f3ff]' : 'hover:bg-[#f9f9ff]'
                    }`}
                  >
                    {/* Item Icon */}
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        item.category === 'project'
                          ? 'bg-[#1a365d]/10 text-[#1a365d]'
                          : item.category === 'question'
                          ? 'bg-[#006a68]/10 text-[#006a68]'
                          : item.category === 'enumerator'
                          ? 'bg-[#e88532]/10 text-[#a04e00]'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    </div>

                    {/* Text Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-[#002045] truncate">{item.title}</h4>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 ${item.badgeColor}`}
                        >
                          {item.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#43474e] truncate mt-0.5">{item.subtitle}</p>
                    </div>

                    {/* Chevron Indicator */}
                    <span className="material-symbols-outlined text-[16px] text-[#74777f] shrink-0 self-center">
                      arrow_forward
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center space-y-2">
                <span className="material-symbols-outlined text-[32px] text-[#74777f]">search_off</span>
                <p className="text-xs font-semibold text-[#002045]">No matches found for "{query}"</p>
                <p className="text-[11px] text-[#74777f]">
                  Try searching by project code (e.g. PRJ-001), variable names (e.g. Q4_Clinic_Distance), or agent names (e.g. Sarah).
                </p>
              </div>
            )}
          </div>

          {/* Footer Shortcuts */}
          <div className="p-2 bg-[#f9f9ff] border-t border-[#c4c6cf]/40 flex items-center justify-between text-[10px] text-[#74777f] px-3.5">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-[#c4c6cf]/40">↑</kbd>{' '}
                <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-[#c4c6cf]/40">↓</kbd> to navigate
              </span>
              <span>
                <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-[#c4c6cf]/40">↵</kbd> to open
              </span>
              <span>
                <kbd className="font-mono bg-white px-1 py-0.5 rounded border border-[#c4c6cf]/40">esc</kbd> to close
              </span>
            </div>
            <span className="font-semibold text-[#1a365d]">RDIP Instant Index</span>
          </div>
        </div>
      )}
    </div>
  );
};
