import React, { useEffect, useState } from 'react';
import { NavSection, Project, UserProfile, Question } from './types';
import { INITIAL_PROJECTS, INITIAL_USER } from './data/mockData';
import { TopAppBar } from './components/TopAppBar';
import { NavigationDrawer } from './components/NavigationDrawer';
import { BottomNavBar } from './components/BottomNavBar';
import { DashboardView } from './components/DashboardView';
import { ProjectsView } from './components/ProjectsView';
import {
  QuestionnaireBuilderView,
  ensureQuestionsStartWithQ1
} from './components/QuestionnaireBuilderView';
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
import { supabase } from './lib/supabase';
import {
  fetchProjects,
  createProjectInDb,
  mapDbProjectToProject
} from './lib/rdipDatabaseService';
import { DbProjectStatus } from './types';

export function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showPublicSurveyModal, setShowPublicSurveyModal] = useState(false);

  /*
   * IMPORTANT SECURITY PRINCIPLE
   *
   * Supabase Auth is the source of identity.
   * public.profiles is the source of the RDIP role.
   *
   * localStorage is NOT trusted for authentication or authorization.
   */
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USER);

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  /*
   * Current application section.
   *
   * We deliberately do not restore the section from localStorage
   * because an enumerator must never be able to restore a
   * researcher-only route from an old browser session.
   */
  const [currentSection, setCurrentSection] =
    useState<NavSection>('dashboard');

  /*
   * Local project cache.
   *
   * This is retained for the current application workflow.
   * Database/RLS remains the authoritative security boundary.
   */
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('rdip_projects');

    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error(
          'Failed to load projects from storage',
          e
        );
      }
    }

    return INITIAL_PROJECTS;
  });

  const [selectedProject, setSelectedProject] =
    useState<Project | null>(() => {
      return projects[0] || INITIAL_PROJECTS[0];
    });


  /**
   * Convert the database role into the application's role.
   *
   * The database uses:
   *   super_admin
   *
   * while the existing frontend uses:
   *   admin
   *
   * All other roles are preserved.
   */
  const mapDatabaseRoleToApplicationRole = (
    role: string
  ): UserProfile['role'] => {
    if (role === 'super_admin') {
      return 'admin';
    }

    return role as UserProfile['role'];
  };

  /**
   * Loads live projects from Supabase database as authoritative source.
   */
  const loadProjectsFromSupabase = async () => {
    try {
      const { data, error } = await fetchProjects();
      if (error) {
        console.warn('[RDIP DB] Projects query failed, maintaining current cache:', error);
        return;
      }

      if (data && Array.isArray(data)) {
        const liveProjects = data.map(mapDbProjectToProject);
        setProjects(liveProjects);
        if (liveProjects.length > 0) {
          setSelectedProject((prev) => {
            if (!prev || !liveProjects.some((p) => p.id === prev.id)) {
              return liveProjects[0];
            }
            return prev;
          });
        }
        localStorage.setItem('rdip_projects', JSON.stringify(liveProjects));
      }
    } catch (err) {
      console.error('[RDIP DB] Exception loading projects from Supabase:', err);
    }
  };


  /**
   * Load the authenticated user's authoritative RDIP profile.
   *
   * The role is NEVER obtained from localStorage.
   */
  const loadAuthenticatedUser = async (
    authUser: {
      id: string;
      email?: string;
    }
  ): Promise<UserProfile | null> => {
    const {
      data: profile,
      error: profileError
    } = await supabase
      .from('profiles')
      .select(
        'id, email, full_name, phone, avatar_url, institution, department, role, status'
      )
      .eq('id', authUser.id)
      .single();

    let userProfileRecord = profile;

    if (profileError || !userProfileRecord) {
      console.warn(
        'RDIP profile lookup returned no record, attempting profile provisioning:',
        profileError
      );

      const defaultFullName = authUser.email ? authUser.email.split('@')[0] : 'Researcher';
      try {
        await supabase
          .from('profiles')
          .upsert({
            id: authUser.id,
            email: authUser.email || '',
            full_name: defaultFullName,
            institution: 'Research Institute',
            role: 'researcher',
            status: 'active'
          });

        const { data: retriedProfile } = await supabase
          .from('profiles')
          .select(
            'id, email, full_name, phone, avatar_url, institution, department, role, status'
          )
          .eq('id', authUser.id)
          .maybeSingle();

        userProfileRecord = retriedProfile;
      } catch (upsertErr) {
        console.error('Failed to auto-provision profile:', upsertErr);
      }

      if (!userProfileRecord) {
        console.error('RDIP profile lookup failed and profile could not be loaded.');
        return null;
      }
    }

    /*
     * Never allow a non-active account into the application.
     */
    if (userProfileRecord.status !== 'active') {
      console.warn(
        'RDIP account is not active:',
        userProfileRecord.status
      );

      return null;
    }

    const databaseRole = String(userProfileRecord.role);

    const authenticatedUser: UserProfile = {
      ...INITIAL_USER,
      id: userProfileRecord.id,
      name: userProfileRecord.full_name || 'Researcher',
      email: userProfileRecord.email || authUser.email || '',
      institution:
        userProfileRecord.institution || 'Research Institute',
      department:
        userProfileRecord.department || '',
      avatar:
        userProfileRecord.avatar_url || '',
      role:
        mapDatabaseRoleToApplicationRole(databaseRole)
    };

    return authenticatedUser;
  };


  /**
   * Handle the real Supabase authentication state.
   *
   * This runs when:
   * - the application first opens
   * - a user signs in
   * - a user signs out
   * - a Supabase session changes
   * - the browser refreshes
   */
  useEffect(() => {
    let mounted = true;

    const initialiseAuthentication = async () => {
      setIsAuthLoading(true);

      try {
        const {
          data: {
            session
          },
          error
        } = await supabase.auth.getSession();

        if (error) {
          console.error(
            'Unable to retrieve RDIP Supabase session:',
            error
          );

          if (mounted) {
            setIsAuthenticated(false);
            setCurrentUser(INITIAL_USER);
            setCurrentSection('dashboard');
            setIsAuthModalOpen(true);
          }

          return;
        }

        if (!session?.user) {
          if (mounted) {
            setIsAuthenticated(false);
            setCurrentUser(INITIAL_USER);
            setCurrentSection('dashboard');
            setIsAuthModalOpen(true);
          }

          return;
        }

        const authenticatedUser =
          await loadAuthenticatedUser({
            id: session.user.id,
            email: session.user.email
          });

        if (!mounted) {
          return;
        }

        if (!authenticatedUser) {
          await supabase.auth.signOut();

          setIsAuthenticated(false);
          setCurrentUser(INITIAL_USER);
          setCurrentSection('dashboard');
          setIsAuthModalOpen(true);

          return;
        }

        setCurrentUser(authenticatedUser);
        setIsAuthenticated(true);

        if (authenticatedUser.role !== 'enumerator') {
          loadProjectsFromSupabase();
        }

        /*
         * Enumerators always start in their isolated
         * field collector terminal.
         */
        if (
          authenticatedUser.role === 'enumerator'
        ) {
          setCurrentSection(
            'offline-collector'
          );
        }
      } catch (error) {
        console.error(
          'RDIP authentication initialization failed:',
          error
        );

        if (mounted) {
          setIsAuthenticated(false);
          setCurrentUser(INITIAL_USER);
          setCurrentSection('dashboard');
          setIsAuthModalOpen(true);
        }
      } finally {
        if (mounted) {
          setIsAuthLoading(false);
        }
      }
    };

    initialiseAuthentication();

    /*
     * Listen for REAL Supabase authentication changes.
     */
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) {
          return;
        }

        /*
         * SIGNED OUT
         */
        if (!session?.user) {
          setIsAuthenticated(false);
          setCurrentUser(INITIAL_USER);
          setCurrentSection('dashboard');
          setIsCreateProjectOpen(false);
          setShowPublicSurveyModal(false);
          setIsAuthModalOpen(true);

          return;
        }

        /*
         * SIGNED IN / SESSION RESTORED
         *
         * Always reload the profile from Supabase.
         */
        try {
          const authenticatedUser =
            await loadAuthenticatedUser({
              id: session.user.id,
              email: session.user.email
            });

          if (!mounted) {
            return;
          }

          if (!authenticatedUser) {
            await supabase.auth.signOut();

            setIsAuthenticated(false);
            setCurrentUser(INITIAL_USER);
            setCurrentSection('dashboard');
            setIsAuthModalOpen(true);

            return;
          }

          setCurrentUser(authenticatedUser);
          setIsAuthenticated(true);

          if (authenticatedUser.role !== 'enumerator') {
            loadProjectsFromSupabase();
          }

          /*
           * Enumerators are permanently restricted to the
           * field collector section at the UI routing layer.
           */
          if (
            authenticatedUser.role === 'enumerator'
          ) {
            setCurrentSection(
              'offline-collector'
            );
          }
        } catch (error) {
          console.error(
            'Failed to load authenticated RDIP profile:',
            error
          );

          await supabase.auth.signOut();

          setIsAuthenticated(false);
          setCurrentUser(INITIAL_USER);
          setCurrentSection('dashboard');
          setIsAuthModalOpen(true);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);


  /**
   * Update local application user state.
   *
   * IMPORTANT:
   * This function is kept for compatibility with AuthModal and
   * SettingsView, but authorization is still ultimately governed
   * by Supabase Auth + public.profiles + RLS.
   */
  const handleUpdateUser = (
    updatedUser: UserProfile
  ) => {
    setCurrentUser(updatedUser);
    setIsAuthenticated(true);

    /*
     * Do not persist role/authentication information to
     * localStorage as an authorization source.
     *
     * We only retain non-security UI information.
     */
    localStorage.setItem(
      'rdip_user_preferences',
      JSON.stringify({
        name: updatedUser.name,
        institution: updatedUser.institution,
        department: updatedUser.department
      })
    );

    /*
     * Enforce enumerator routing immediately.
     */
    if (
      updatedUser.role === 'enumerator'
    ) {
      setCurrentSection(
        'offline-collector'
      );
    }
  };


  /**
   * Secure application navigation.
   *
   * Frontend navigation is NOT the primary security mechanism.
   * Supabase RLS remains the actual database security boundary.
   *
   * This guard prevents the enumerator UI from exposing
   * researcher-only application modules.
   */
  const handleNavigate = (
    section: NavSection
  ) => {
    /*
     * Public survey remains available as a separate modal.
     */
    if (
      section === 'public-survey'
    ) {
      setShowPublicSurveyModal(true);
      return;
    }

    /*
     * Never allow unauthenticated users to enter protected
     * application modules.
     */
    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }

    /*
     * ENUMERATOR ISOLATION
     *
     * Enumerators may ONLY access:
     * - offline-collector
     * - settings
     */
    if (
      currentUser.role === 'enumerator' &&
      section !== 'offline-collector' &&
      section !== 'settings'
    ) {
      setCurrentSection(
        'offline-collector'
      );

      setIsMobileMenuOpen(false);

      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });

      return;
    }

    setCurrentSection(section);
    setIsMobileMenuOpen(false);

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };


  /**
   * Create a new research project with Supabase as the authoritative source.
   *
   * Real INSERT is performed into public.projects using the authenticated researcher's UUID.
   * Database RLS strictly verifies that owner_id = auth.uid() and role is researcher/admin.
   */
  const handleCreateProject = async (
    newProjectData: Omit<
      Project,
      'id' |
      'code' |
      'progress' |
      'enumeratorsCount' |
      'responsesCount' |
      'qualityScore'
    >,
    templateQuestions?: Question[],
    extraMetadata?: {
      researchTopic?: string;
      researchDesign?: string;
    }
  ): Promise<{ success: boolean; error?: string; project?: Project }> => {
    /*
     * Never permit an enumerator to create a project.
     */
    if (currentUser.role === 'enumerator') {
      console.warn('RDIP: Enumerator attempted to create a project. Operation blocked.');
      return {
        success: false,
        error: 'Enumerators are not permitted to create research projects.'
      };
    }

    // Retrieve active authenticated Supabase user session
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const authUser = authData?.user;

    if (authError || !authUser) {
      return {
        success: false,
        error: 'Authentication error: Active Supabase session required. Please sign in.'
      };
    }

    // Generate unique human-readable project code (e.g. PRJ-2025-ABCD123)
    const year = new Date().getFullYear();
    const randomSuffix = `${Date.now().toString(36).toUpperCase().slice(-4)}${Math.floor(100 + Math.random() * 900)}`;
    const projectCode = `PRJ-${year}-${randomSuffix}`;

    // Map UI status to Supabase project_lifecycle_status
    let dbStatus: DbProjectStatus = 'draft';
    if (newProjectData.status === 'Active') {
      dbStatus = 'active';
    } else if (newProjectData.status === 'Collection') {
      dbStatus = 'collection';
    } else if (newProjectData.status === 'Analysis') {
      dbStatus = 'analysis';
    } else if (newProjectData.status === 'Complete') {
      dbStatus = 'completed';
    } else {
      dbStatus = 'draft';
    }

    // Real Supabase INSERT with owner_id = authenticated user UUID
    const { data: dbProject, error: dbError } = await createProjectInDb({
      owner_id: authUser.id,
      project_code: projectCode,
      title: newProjectData.title.trim(),
      description: newProjectData.description || null,
      research_topic: extraMetadata?.researchTopic || newProjectData.category || 'General Research',
      research_design: extraMetadata?.researchDesign || 'Field Survey Protocol',
      institution: newProjectData.institution.trim() || 'Research Institute',
      status: dbStatus,
      progress: 0,
      quality_score: 100,
      research_objectives: newProjectData.researchObjectives || [],
      start_date: newProjectData.startDate || new Date().toISOString().split('T')[0],
      end_date: newProjectData.endDate || '2025-12-31',
      notes: newProjectData.notes || null,
      metadata: {
        created_via: 'RDIP Web Portal',
        client_timestamp: new Date().toISOString()
      }
    });

    if (dbError || !dbProject) {
      return {
        success: false,
        error: `Supabase database error: ${dbError || 'Failed to insert project into public.projects.'}`
      };
    }

    // Map database record to application project format
    const realProject = mapDbProjectToProject(dbProject);

    // Update application state with real Supabase project record
    const updatedProjects = [realProject, ...projects.filter((p) => p.id !== realProject.id)];
    setProjects(updatedProjects);
    setSelectedProject(realProject);

    localStorage.setItem('rdip_projects', JSON.stringify(updatedProjects));

    /*
     * If template questions are provided, load them into
     * questionnaire storage starting strictly with Q1.
     */
    if (templateQuestions && templateQuestions.length > 0) {
      const normalizedQuestions = ensureQuestionsStartWithQ1(templateQuestions);

      localStorage.setItem('rdip_active_questionnaire', JSON.stringify(normalizedQuestions));
      localStorage.setItem('rdip_survey_title', `${realProject.title} Questionnaire`);
      localStorage.setItem('rdip_survey_version', 'v1.0 (Template)');

      window.dispatchEvent(
        new CustomEvent('rdip_template_loaded', {
          detail: normalizedQuestions
        })
      );
    }

    // Asynchronously refresh projects from Supabase to guarantee consistency
    loadProjectsFromSupabase().catch(() => {});

    return {
      success: true,
      project: realProject
    };
  };


  /**
   * Update a project in the current local project state.
   */
  const handleUpdateProject = (
    updatedProject: Project
  ) => {
    /*
     * Enumerators should never reach project management.
     */
    if (
      currentUser.role === 'enumerator'
    ) {
      console.warn(
        'RDIP: Enumerator attempted to modify a project. Operation blocked.'
      );
      return;
    }

    const updated = projects.map(
      (p) =>
        p.id === updatedProject.id
          ? updatedProject
          : p
    );

    setProjects(updated);

    localStorage.setItem(
      'rdip_projects',
      JSON.stringify(updated)
    );

    if (
      selectedProject?.id ===
      updatedProject.id
    ) {
      setSelectedProject(
        updatedProject
      );
    }
  };


  /*
   * Authentication loading screen.
   *
   * We wait for Supabase to determine the actual session before
   * rendering protected application content.
   */
  if (isAuthLoading) {
    return (
      <div className="h-screen bg-[#f9f9ff] text-[#161c27] flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="text-2xl font-bold mb-2">
            RDIP
          </div>

          <div className="text-sm text-gray-500">
            Securely establishing your session...
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="h-screen bg-[#f9f9ff] text-[#161c27] flex flex-col font-sans antialiased overflow-hidden">

      {/* Top Header Bar */}
      <TopAppBar
        currentSection={
          currentSection
        }
        onNavigate={
          handleNavigate
        }
        onOpenMobileMenu={() =>
          setIsMobileMenuOpen(true)
        }
        onToggleAuthModal={() =>
          setIsAuthModalOpen(true)
        }
        isOfflineMode={
          isOfflineMode
        }
        currentUser={
          currentUser
        }
        projects={
          projects
        }
        onSelectProject={(p) => {
          /*
           * Enumerators cannot select projects from
           * the researcher project interface.
           */
          if (
            currentUser.role ===
            'enumerator'
          ) {
            return;
          }

          setSelectedProject(p);

          handleNavigate(
            'projects'
          );
        }}
      />


      {/* Main Body Layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Persistent Desktop Sidebar & Mobile Drawer */}
        <NavigationDrawer
          currentSection={
            currentSection
          }
          onNavigate={
            handleNavigate
          }
          isOfflineMode={
            isOfflineMode
          }
          onToggleOfflineMode={() =>
            setIsOfflineMode(
              !isOfflineMode
            )
          }
          isOpenMobile={
            isMobileMenuOpen
          }
          onCloseMobile={() =>
            setIsMobileMenuOpen(false)
          }
          currentUser={
            currentUser
          }
          onOpenAuthModal={() =>
            setIsAuthModalOpen(true)
          }
        />


        {/* Dynamic Main Content View */}
        <main
          className={`flex-1 min-w-0 flex flex-col ${
            currentSection ===
              'questionnaires' ||
            currentSection ===
              'offline-collector'
              ? 'overflow-hidden pb-16 md:pb-0'
              : 'overflow-y-auto pb-20 md:pb-8'
          }`}
        >

          {/* Researcher Dashboard */}
          {currentSection ===
            'dashboard' && (
            <DashboardView
              projects={
                projects
              }
              currentUser={
                currentUser
              }
              onNavigate={
                handleNavigate
              }
              onOpenCreateProject={() =>
                setIsCreateProjectOpen(
                  true
                )
              }
              onOpenProfile={() =>
                setIsAuthModalOpen(
                  true
                )
              }
              onSelectProject={(p) => {
                /*
                 * Enumerators should never enter
                 * project management from here.
                 */
                if (
                  currentUser.role ===
                  'enumerator'
                ) {
                  return;
                }

                setSelectedProject(
                  p
                );

                handleNavigate(
                  'projects'
                );
              }}
            />
          )}


          {/* Projects */}
          {currentSection ===
            'projects' && (
            <ProjectsView
              projects={
                projects
              }
              onOpenCreateProject={() =>
                setIsCreateProjectOpen(
                  true
                )
              }
              onNavigate={
                handleNavigate
              }
              onSelectProject={(p) =>
                setSelectedProject(
                  p
                )
              }
              onUpdateProject={
                handleUpdateProject
              }
            />
          )}


          {/* Questionnaire Studio */}
          {currentSection ===
            'questionnaires' && (
            <QuestionnaireBuilderView
              onOpenPreview={() =>
                setShowPublicSurveyModal(
                  true
                )
              }
              projects={projects}
              selectedProject={selectedProject}
              onSelectProject={(p) => setSelectedProject(p)}
              currentUser={currentUser}
              isAuthenticated={isAuthenticated}
            />
          )}


          {/* Variable Dictionary */}
          {currentSection ===
            'dictionary' && (
            <VariableDictionaryView />
          )}


          {/* Data Quality */}
          {currentSection ===
            'data-quality' && (
            <DataQualityView />
          )}


          {/* Enumerator Management */}
          {currentSection ===
            'enumerators' && (
            <EnumeratorsView
              onOpenOfflineCollector={() =>
                handleNavigate(
                  'offline-collector'
                )
              }
            />
          )}


          {/* Enumerator Field Collector */}
          {currentSection ===
            'offline-collector' && (
            <OfflineFieldInterface
              onReturnToHub={() =>
                /*
                 * Do NOT send enumerators to the researcher
                 * enumerator-management screen.
                 *
                 * Send them back to their assigned survey
                 * terminal instead.
                 */
                handleNavigate(
                  'offline-collector'
                )
              }
              currentUser={
                currentUser
              }
            />
          )}


          {/* Statistical Analysis */}
          {currentSection ===
            'statistical-analysis' && (
            <StatisticalAnalysisView />
          )}


          {/* Visualizations */}
          {currentSection ===
            'visualizations' && (
            <VisualizationsView />
          )}


          {/* Reports */}
          {currentSection ===
            'reports' && (
            <ReportsView />
          )}


          {/* Audit & Security */}
          {currentSection ===
            'audit-security' && (
            <AuditSecurityView />
          )}


          {/* Settings */}
          {currentSection ===
            'settings' && (
            <SettingsView
              currentUser={
                currentUser
              }
              onUpdateUser={
                handleUpdateUser
              }
            />
          )}

        </main>
      </div>


      {/* Mobile Bottom Navigation */}
      <BottomNavBar
        currentSection={
          currentSection
        }
        onNavigate={
          handleNavigate
        }
        currentUser={
          currentUser
        }
      />


      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={
          isCreateProjectOpen
        }
        onClose={() =>
          setIsCreateProjectOpen(
            false
          )
        }
        onCreate={
          handleCreateProject
        }
      />


      {/* Authentication Modal */}
      <AuthModal
        isOpen={
          isAuthModalOpen
        }
        onClose={() =>
          setIsAuthModalOpen(
            false
          )
        }
        currentUser={
          currentUser
        }
        onUpdateUser={
          handleUpdateUser
        }
      />


      {/* Public Survey Modal */}
      <PublicSurveyModal
        isOpen={
          showPublicSurveyModal
        }
        onClose={() =>
          setShowPublicSurveyModal(
            false
          )
        }
      />

    </div>
  );
}

export default App;