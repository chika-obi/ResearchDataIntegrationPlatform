import React, { useState } from 'react';
import { NavSection, Project, UserProfile } from './types';
import { INITIAL_PROJECTS, MOCK_USER_PROFILE } from './data/mockData';
import { NavigationDrawer } from './components/NavigationDrawer';
import { TopAppBar } from './components/TopAppBar';
import { BottomNavBar } from './components/BottomNavBar';
import { DashboardView } from './components/DashboardView';
import { ProjectsView } from './components/ProjectsView';
import { QuestionnaireBuilderView } from './components/QuestionnaireBuilderView';
import { VariableDictionaryView } from './components/VariableDictionaryView';
import { DataQualityView } from './components/DataQualityView';
import { EnumeratorsView } from './components/EnumeratorsView';
import { OfflineFieldInterface } from './components/OfflineFieldInterface';
import { StatisticalAnalysisView } from './components/StatisticalAnalysisView';
import { VisualizationsView } from './components/VisualizationsView';
import { ReportsView } from './components/ReportsView';
import { AuditSecurityView } from './components/AuditSecurityView';
import { SettingsView } from './components/SettingsView';
import { CreateProjectModal } from './components/CreateProjectModal';
import { PublicSurveyModal } from './components/PublicSurveyModal';
import { AuthModal } from './components/AuthModal';

export default function App() {
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [showPublicSurveyModal, setShowPublicSurveyModal] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile>(MOCK_USER_PROFILE);
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [selectedProject, setSelectedProject] = useState<Project | null>(INITIAL_PROJECTS[0]);

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
    >
  ) => {
    const newId = (projects.length + 1).toString();
    const newCode = `PRJ-${2024000 + projects.length + 1}`;
    const newProject: Project = {
      ...newProjectData,
      id: newId,
      code: newCode,
      progress: 0,
      enumeratorsCount: 0,
      responsesCount: 0,
      qualityScore: 100
    };
    setProjects([newProject, ...projects]);
    setSelectedProject(newProject);
  };

  return (
    <div className="min-h-screen bg-[#f9f9ff] text-[#161c27] flex flex-col font-sans antialiased">
      {/* Top Header Bar */}
      <TopAppBar
        currentSection={currentSection}
        onNavigate={handleNavigate}
        onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        onToggleAuthModal={() => setIsAuthModalOpen(true)}
        isOfflineMode={isOfflineMode}
        currentUser={currentUser}
      />

      {/* Main Body Layout */}
      <div className="flex-1 flex overflow-hidden">
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
        <main className="flex-1 overflow-y-auto pb-20 md:pb-8">
          {currentSection === 'dashboard' && (
            <DashboardView
              projects={projects}
              onNavigate={handleNavigate}
              onOpenCreateProject={() => setIsCreateProjectOpen(true)}
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
            <OfflineFieldInterface onReturnToHub={() => handleNavigate('enumerators')} />
          )}

          {currentSection === 'statistical-analysis' && <StatisticalAnalysisView />}

          {currentSection === 'visualizations' && <VisualizationsView />}

          {currentSection === 'reports' && <ReportsView />}

          {currentSection === 'audit-security' && <AuditSecurityView />}

          {currentSection === 'settings' && <SettingsView />}
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

      <PublicSurveyModal
        isOpen={showPublicSurveyModal}
        onClose={() => setShowPublicSurveyModal(false)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUpdateUser={setCurrentUser}
      />
    </div>
  );
}
