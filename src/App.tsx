import React, { useState } from 'react';
import { NavSection, Project, UserProfile, Question } from './types';
import { INITIAL_PROJECTS, INITIAL_USER } from './data/mockData';
import { TopAppBar } from './components/TopAppBar';
import { NavigationDrawer } from './components/NavigationDrawer';
import { BottomNavBar } from './components/BottomNavBar';
import { DashboardView } from './components/DashboardView';
import { ProjectsView } from './components/ProjectsView';
import { QuestionnaireBuilderView, ensureQuestionsStartWithQ1 } from './components/QuestionnaireBuilderView';
import { VariableDictionaryView } from './components/VariableDictionaryView';
import { DataQualityView } from './components/DataQualityView';
import { EnumeratorsView } from './components/EnumeratorsView';
import { StatisticalAnalysisView } from './components/StatisticalAnalysisView';
import { VisualizationsView } from './components/VisualizationsView';
import { ReportsView } from './components/ReportsView';
import { AuditSecurityView } from './components/AuditSecurityView';
import { SettingsView } from './components/SettingsView';
import { CreateProjectModal } from './components/CreateProjectModal';
import { AuthModal } from './components/AuthModal';
import { PublicSurveyModal } from './components/PublicSurveyModal';
import { OfflineFieldInterface } from './components/OfflineFieldInterface';

export function App() {
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showPublicSurveyModal, setShowPublicSurveyModal] = useState(false);

  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('rdip_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse user from storage', e);
      }
    }
    return INITIAL_USER;
  });

  const handleUpdateUser = (updated: UserProfile) => {
    setCurrentUser(updated);
    localStorage.setItem('rdip_user', JSON.stringify(updated));
  };

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('rdip_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to load projects from storage', e);
      }
    }
    return INITIAL_PROJECTS;
  });

  const [selectedProject, setSelectedProject] = useState<Project | null>(() => {
    return projects[0] || INITIAL_PROJECTS[0];
  });

  const handleNavigate = (section: NavSection) => {
    if (section === 'public-survey') {
      setShowPublicSurveyModal(true);
      return;
    }
    setCurrentSection(section);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateProject = (
    newProjectData: Omit<
      Project,
      'id' | 'code' | 'progress' | 'enumeratorsCount' | 'responsesCount' | 'qualityScore'
    >,
    templateQuestions?: Question[]
  ) => {
    const newId = (projects.length + 1).toString();
    const newCode = `PRJ-${2025000 + projects.length + 1}`;
    const newProject: Project = {
      ...newProjectData,
      id: newId,
      code: newCode,
      progress: 0,
      enumeratorsCount: 0,
      responsesCount: 0,
      qualityScore: 100
    };

    const updatedProjects = [newProject, ...projects];
    setProjects(updatedProjects);
    setSelectedProject(newProject);
    localStorage.setItem('rdip_projects', JSON.stringify(updatedProjects));

    // If template questions are provided, load them into questionnaire storage starting strictly with Q1
    if (templateQuestions && templateQuestions.length > 0) {
      const normalizedQuestions = ensureQuestionsStartWithQ1(templateQuestions);
      localStorage.setItem('rdip_active_questionnaire', JSON.stringify(normalizedQuestions));
      localStorage.setItem('rdip_survey_title', `${newProject.title} Questionnaire`);
      localStorage.setItem('rdip_survey_version', 'v1.0 (Template)');
      window.dispatchEvent(new CustomEvent('rdip_template_loaded', { detail: normalizedQuestions }));
    }
  };

  const handleUpdateProject = (updatedProject: Project) => {
    const updated = projects.map((p) => (p.id === updatedProject.id ? updatedProject : p));
    setProjects(updated);
    localStorage.setItem('rdip_projects', JSON.stringify(updated));
    if (selectedProject?.id === updatedProject.id) {
      setSelectedProject(updatedProject);
    }
  };

  return (
    <div className="h-screen bg-[#f9f9ff] text-[#161c27] flex flex-col font-sans antialiased overflow-hidden">
      {/* Top Header Bar */}
      <TopAppBar
        currentSection={currentSection}
        onNavigate={handleNavigate}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onToggleAuthModal={() => setIsAuthModalOpen(true)}
        isOfflineMode={isOfflineMode}
        currentUser={currentUser}
        projects={projects}
        onSelectProject={(p) => {
          setSelectedProject(p);
          handleNavigate('projects');
        }}
      />

      {/* Main Body Layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Persistent Desktop Sidebar & Mobile Drawer */}
        <NavigationDrawer
          currentSection={currentSection}
          onNavigate={handleNavigate}
          isOfflineMode={isOfflineMode}
          onToggleOfflineMode={() => setIsOfflineMode(!isOfflineMode)}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          currentUser={currentUser}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
        />

        {/* Dynamic Main Content View */}
        <main
          className={`flex-1 min-w-0 flex flex-col ${
            currentSection === 'questionnaires' || currentSection === 'offline-collector'
              ? 'overflow-hidden pb-16 md:pb-0'
              : 'overflow-y-auto pb-20 md:pb-8'
          }`}
        >
          {currentSection === 'dashboard' && (
            <DashboardView
              projects={projects}
              currentUser={currentUser}
              onNavigate={handleNavigate}
              onOpenCreateProject={() => setIsCreateProjectOpen(true)}
              onOpenProfile={() => setIsAuthModalOpen(true)}
              onSelectProject={(p) => {
                setSelectedProject(p);
                handleNavigate('projects');
              }}
            />
          )}

          {currentSection === 'projects' && (
            <ProjectsView
              projects={projects}
              onOpenCreateProject={() => setIsCreateProjectOpen(true)}
              onNavigate={handleNavigate}
              onSelectProject={(p) => setSelectedProject(p)}
              onUpdateProject={handleUpdateProject}
            />
          )}

          {currentSection === 'questionnaires' && (
            <QuestionnaireBuilderView
              onOpenPreview={() => setShowPublicSurveyModal(true)}
            />
          )}

          {currentSection === 'dictionary' && <VariableDictionaryView />}

          {currentSection === 'data-quality' && <DataQualityView />}

          {currentSection === 'enumerators' && (
            <EnumeratorsView
              onOpenOfflineCollector={() => handleNavigate('offline-collector')}
            />
          )}

          {currentSection === 'offline-collector' && (
            <OfflineFieldInterface 
              onReturnToHub={() => handleNavigate('enumerators')} 
              currentUser={currentUser}
            />
          )}

          {currentSection === 'statistical-analysis' && <StatisticalAnalysisView />}

          {currentSection === 'visualizations' && <VisualizationsView />}

          {currentSection === 'reports' && <ReportsView />}

          {currentSection === 'audit-security' && <AuditSecurityView />}

          {currentSection === 'settings' && (
            <SettingsView
              currentUser={currentUser}
              onUpdateUser={handleUpdateUser}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNavBar currentSection={currentSection} onNavigate={handleNavigate} />

      {/* Modals */}
      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onCreate={handleCreateProject}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUpdateUser={handleUpdateUser}
      />

      <PublicSurveyModal
        isOpen={showPublicSurveyModal}
        onClose={() => setShowPublicSurveyModal(false)}
      />
    </div>
  );
}

export default App;
