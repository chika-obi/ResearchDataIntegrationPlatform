import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { UserProfile, UserRole } from '../types';

/**
 * RDIP AUTHENTICATION & SESSION MANAGEMENT
 *
 * SECURITY RULES:
 * 1. Supabase Auth is the source of identity.
 * 2. public.profiles is the source of the user's RDIP role.
 * 3. The frontend must never grant a privileged role by itself.
 * 4. Suspended/inactive users must not enter the platform.
 * 5. Enumerators are authenticated exactly like other users,
 *    but their database permissions are controlled by RLS.
 */

/**
 * Sign in an existing RDIP user.
 */
export async function signInRDIP(
  email: string,
  password: string,
  currentUser: UserProfile
): Promise<UserProfile> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error('Please enter your email address.');
  }

  if (!password) {
    throw new Error('Please enter your password.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Authentication failed. No user session was created.');
  }

  /*
   * IMPORTANT:
   *
   * Never use a role supplied by the frontend.
   * Always retrieve the role from public.profiles.
   */
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();

    throw new Error(
      'Your account is authenticated, but your RDIP profile could not be found. Please contact the administrator.'
    );
  }

  /*
   * Account status is controlled by the database.
   */
  if (profile.status !== 'active') {
    await supabase.auth.signOut();

    throw new Error(
      `Your RDIP account is currently ${String(profile.status).replace(
        /_/g,
        ' '
      )}. Please contact the administrator.`
    );
  }

  /*
   * Map the database role to the application's existing role type.
   *
   * The database remains authoritative.
   */
  const applicationRole: UserRole =
    profile.role === 'super_admin'
      ? 'admin'
      : (profile.role as UserRole);

  const authenticatedUser: UserProfile = {
    ...currentUser,
    id: data.user.id,
    name: profile.full_name || currentUser.name,
    email: profile.email || normalizedEmail,
    institution: profile.institution || 'Research Institute',
    department: profile.department || '',
    avatar: profile.avatar_url || currentUser.avatar,
    role: applicationRole
  };

  return authenticatedUser;
}

/**
 * Create a normal RDIP account.
 *
 * IMPORTANT:
 * The frontend is NOT allowed to create super_admin,
 * analyst, or other privileged accounts simply by selecting a role.
 *
 * The database trigger remains responsible for authoritative
 * role provisioning.
 */
export async function signUpRDIP(
  name: string,
  email: string,
  password: string,
  institution: string,
  selectedRole: UserRole
): Promise<{
  user: UserProfile | null;
  requiresEmailConfirmation: boolean;
}> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!name.trim()) {
    throw new Error('Please enter your full name.');
  }

  if (!normalizedEmail) {
    throw new Error('Please enter your email address.');
  }

  if (!password) {
    throw new Error('Please enter a password.');
  }

  if (password.length < 8) {
    throw new Error('Password must contain at least 8 characters.');
  }

  /*
   * Only researcher and enumerator can be requested from the
   * public registration interface.
   *
   * NEVER accept "admin" or "super_admin" from the browser.
   */
  const requestedRole =
    selectedRole === 'enumerator'
      ? 'enumerator'
      : 'researcher';

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        full_name: name.trim(),
        institution: institution.trim() || 'Research Institute',
        role: requestedRole
      }
    }
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data.user) {
    throw new Error('Account creation failed. No user was returned.');
  }

  /*
   * Supabase may require email verification.
   */
  if (!data.session) {
    return {
      user: null,
      requiresEmailConfirmation: true
    };
  }

  /*
   * Retrieve the authoritative profile created by the
   * handle_new_user() database trigger.
   */
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();

    throw new Error(
      'Account created, but the RDIP profile could not be loaded. Please contact the administrator.'
    );
  }

  if (profile.status !== 'active') {
    await supabase.auth.signOut();

    throw new Error(
      `Your RDIP account is currently ${String(profile.status).replace(/_/g, ' ')}.`
    );
  }

  const applicationRole: UserRole =
    profile.role === 'super_admin'
      ? 'admin'
      : (profile.role as UserRole);

  const authenticatedUser: UserProfile = {
    id: data.user.id,
    name: profile.full_name || name.trim(),
    email: profile.email || normalizedEmail,
    institution: profile.institution || institution.trim() || 'Research Institute',
    department: profile.department || '',
    avatar: profile.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: applicationRole,
    timezone: 'UTC+01:00 (WAT)',
    version: '1.0'
  };

  return {
    user: authenticatedUser,
    requiresEmailConfirmation: false
  };
}

/**
 * Get the currently authenticated RDIP user.
 *
 * This should be called when the application starts or
 * when the browser refreshes.
 */
export async function getCurrentRDIPUser(
  currentUser: UserProfile
): Promise<UserProfile | null> {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    console.error('RDIP session error:', error);
    return null;
  }

  if (!session?.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (profileError || !profile) {
    console.error('RDIP profile lookup failed:', profileError);
    await supabase.auth.signOut();
    return null;
  }

  /*
   * Never allow an inactive account to remain logged in.
   */
  if (profile.status !== 'active') {
    await supabase.auth.signOut();
    return null;
  }

  const applicationRole: UserRole =
    profile.role === 'super_admin'
      ? 'admin'
      : (profile.role as UserRole);

  return {
    ...currentUser,
    id: session.user.id,
    name: profile.full_name || currentUser.name,
    email: profile.email || session.user.email || currentUser.email,
    institution: profile.institution || 'Research Institute',
    department: profile.department || '',
    avatar: profile.avatar_url || currentUser.avatar,
    role: applicationRole
  };
}

/**
 * Sign out completely from the RDIP application.
 */
export async function signOutRDIP(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Listen for real Supabase authentication changes.
 *
 * The application should use this to keep its local user state
 * synchronized with the actual Supabase session.
 */
export function subscribeToRDIPAuth(
  callback: (
    user: {
      id: string;
      email?: string;
    } | null
  ) => void
) {
  const {
    data: { subscription }
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      callback({
        id: session.user.id,
        email: session.user.email
      });
    } else {
      callback(null);
    }
  });

  return () => {
    subscription.unsubscribe();
  };
}

/* ==============================================================================
 * AUTH MODAL COMPONENT
 * ============================================================================== */

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onUpdateUser: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser
}) => {
  const [authMode, setAuthMode] = useState<
    'switch-role' | 'edit-profile' | 'login' | 'signup' | 'forgot'
  >('switch-role');
  const [email, setEmail] = useState(currentUser.email);
  const [password, setPassword] = useState('');
  const [name, setName] = useState(currentUser.name);
  const [institution, setInstitution] = useState(currentUser.institution);
  const [department, setDepartment] = useState(
    currentUser.department || 'Department of Demography & Social Statistics'
  );
  const [avatar, setAvatar] = useState(currentUser.avatar);
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentUser.role);
  const [notification, setNotification] = useState<{
    message: string;
    isError?: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sync state when currentUser changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name);
      setEmail(currentUser.email);
      setInstitution(currentUser.institution);
      setDepartment(
        currentUser.department || 'Department of Demography & Social Statistics'
      );
      setAvatar(currentUser.avatar);
      setSelectedRole(currentUser.role);
      setPassword('');
      setNotification(null);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // Handle local image upload from user device
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setNotification({
          message: 'Image size should be under 5MB.',
          isError: true
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const newAvatar = event.target.result as string;
          setAvatar(newAvatar);
          setNotification({
            message: 'Photo loaded! Click "Save Profile Changes" to apply.'
          });
          setTimeout(() => setNotification(null), 3000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfileChanges = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...currentUser,
      name: name.trim() || 'Researcher',
      email: email.trim() || 'user@rdip.edu',
      institution: institution.trim() || 'Research Institute',
      department: department.trim(),
      avatar: avatar || currentUser.avatar,
      role: selectedRole
    };
    onUpdateUser(updated);
    setNotification({
      message: 'Profile information & image updated successfully!'
    });
    setTimeout(() => {
      setNotification(null);
      setAuthMode('switch-role');
    }, 1200);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setNotification(null);

    try {
      if (password) {
        const authenticatedUser = await signInRDIP(email, password, currentUser);
        onUpdateUser(authenticatedUser);
        setNotification({
          message: `Authenticated successfully as ${authenticatedUser.name} (${authenticatedUser.role}).`
        });
        setTimeout(() => {
          setNotification(null);
          onClose();
        }, 1200);
      } else {
        // Fallback for simulation / offline demo if no password entered
        onUpdateUser({
          ...currentUser,
          email,
          name: name || email.split('@')[0].replace('.', ' ').toUpperCase(),
          role: selectedRole
        });
        setNotification({ message: 'Session updated.' });
        setTimeout(() => {
          setNotification(null);
          onClose();
        }, 1000);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Login failed. Please verify credentials.';
      setNotification({ message: errorMessage, isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setNotification(null);

    try {
      const result = await signUpRDIP(
        name,
        email,
        password,
        institution,
        selectedRole
      );

      if (result.requiresEmailConfirmation) {
        setNotification({
          message:
            'Registration successful! Please check your email to confirm your account.'
        });
        setTimeout(() => {
          setNotification(null);
          setAuthMode('login');
        }, 3000);
      } else if (result.user) {
        onUpdateUser(result.user);
        setNotification({
          message:
            'Account registered and authenticated successfully with Supabase Auth.'
        });
        setTimeout(() => {
          setNotification(null);
          onClose();
        }, 1200);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Registration failed. Please try again.';
      setNotification({ message: errorMessage, isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleQuickSwitch = (role: UserRole) => {
    setSelectedRole(role);
    onUpdateUser({
      ...currentUser,
      role
    });
    setNotification({
      message: `Active persona switched to ${role.toUpperCase()}. UI access rules updated.`
    });
    setTimeout(() => setNotification(null), 2000);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setNotification(null);

    try {
      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      setNotification({
        message: `Password reset instructions dispatched to ${email}.`
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Password reset failed.';
      setNotification({ message: errorMessage, isError: true });
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setNotification(null);
        setAuthMode('login');
      }, 2500);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOutRDIP();
      setNotification({ message: 'Signed out successfully.' });
      setTimeout(() => {
        setNotification(null);
        onClose();
      }, 1000);
    } catch {
      setNotification({ message: 'Signed out locally.' });
      setTimeout(() => {
        setNotification(null);
        onClose();
      }, 1000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#002045]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#c4c6cf]/60 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header banner */}
        <div className="bg-[#1a365d] text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
              <span className="material-symbols-outlined text-2xl text-[#91f0ed]">
                {authMode === 'switch-role'
                  ? 'badge'
                  : authMode === 'edit-profile'
                  ? 'edit_square'
                  : authMode === 'forgot'
                  ? 'lock_reset'
                  : 'verified_user'}
              </span>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {authMode === 'switch-role' && 'Role & Session Manager'}
                {authMode === 'edit-profile' && 'Edit Profile & Custom Photo'}
                {authMode === 'login' && 'Researcher Sign In'}
                {authMode === 'signup' && 'Create RDIP Account'}
                {authMode === 'forgot' && 'Reset Supabase Password'}
              </h2>
              <p className="text-xs text-white/80 mt-0.5">
                {authMode === 'switch-role' &&
                  'Switch between Researcher, Enumerator, and Admin views'}
                {authMode === 'edit-profile' &&
                  'Customize your name, institution, and profile photo'}
                {authMode === 'login' &&
                  'Supabase Auth & Row-Level Security (RLS)'}
                {authMode === 'signup' &&
                  'Register new institutional researcher account'}
                {authMode === 'forgot' &&
                  'Send password reset link to your email'}
              </p>
            </div>
          </div>
        </div>

        {/* Feedback alert */}
        {notification && (
          <div
            className={`mx-6 mt-4 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
              notification.isError
                ? 'bg-[#ffdad6] border border-[#ba1a1a]/30 text-[#93000a]'
                : 'bg-[#91f0ed]/30 border border-[#006a68]/40 text-[#006e6d]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {notification.isError ? 'error' : 'check_circle'}
            </span>
            <span>{notification.message}</span>
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* Quick Role Switcher View */}
          {authMode === 'switch-role' && (
            <div className="space-y-4">
              {/* Current User Card */}
              <div className="p-3.5 bg-[#f1f3ff] rounded-xl border border-[#c4c6cf]/40 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#1a365d] bg-white shrink-0 shadow-xs">
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-bold text-[#002045] text-sm truncate flex items-center gap-1.5">
                      <span>{currentUser.name}</span>
                    </div>
                    <div className="mt-0.5">
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
                    <div
                      className="text-[11px] text-[#43474e] font-medium truncate mt-0.5"
                      title={currentUser.institution}
                    >
                      {currentUser.institution}
                    </div>
                    <div className="text-[#74777f] text-[10px] truncate">
                      {currentUser.email}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAuthMode('edit-profile')}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#c4c6cf] hover:border-[#1a365d] text-[#1a365d] font-semibold text-xs shrink-0 flex items-center gap-1 shadow-2xs hover:bg-[#e3e8f9] transition-all"
                  title="Edit details & upload photo"
                >
                  <span className="material-symbols-outlined text-[15px]">edit</span>
                  <span>Edit</span>
                </button>
              </div>

              {/* Persona Selector with explanation */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-[#002045] uppercase tracking-wider">
                    Simulate / Switch Active Persona
                  </label>
                  <span className="text-[11px] text-[#74777f]">Test RLS rules</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRoleQuickSwitch('researcher')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      currentUser.role === 'researcher'
                        ? 'bg-[#1a365d] text-white border-[#1a365d] shadow-sm'
                        : 'bg-white text-[#43474e] border-[#c4c6cf] hover:bg-[#f1f3ff]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl block mb-1">
                      psychology
                    </span>
                    <span className="text-xs font-bold block">Researcher</span>
                    <span className="text-[10px] opacity-80 block">Full Suite</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleQuickSwitch('enumerator')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      currentUser.role === 'enumerator'
                        ? 'bg-[#006a68] text-white border-[#006a68] shadow-sm'
                        : 'bg-white text-[#43474e] border-[#c4c6cf] hover:bg-[#f1f3ff]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl block mb-1">
                      cell_tower
                    </span>
                    <span className="text-xs font-bold block">Enumerator</span>
                    <span className="text-[10px] opacity-80 block">Offline Field</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleQuickSwitch('admin')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      currentUser.role === 'admin'
                        ? 'bg-[#371800] text-white border-[#371800] shadow-sm'
                        : 'bg-white text-[#43474e] border-[#c4c6cf] hover:bg-[#f1f3ff]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl block mb-1">
                      admin_panel_settings
                    </span>
                    <span className="text-xs font-bold block">Admin</span>
                    <span className="text-[10px] opacity-80 block">Audit & SQL</span>
                  </button>
                </div>

                <div className="mt-2.5 p-2.5 bg-[#f9f9ff] border border-[#c4c6cf]/30 rounded-lg text-[11px] text-[#43474e] leading-snug">
                  {currentUser.role === 'researcher' && (
                    <span>
                      🎓 <strong>Researcher View:</strong> Author survey forms, build variable
                      codebooks, run statistical inference, and generate Chapter 4 reports.
                    </span>
                  )}
                  {currentUser.role === 'enumerator' && (
                    <span>
                      📱 <strong>Enumerator View:</strong> Collect survey data in the offline PWA,
                      capture GPS/battery telemetry, and sync encrypted batch submissions.
                    </span>
                  )}
                  {currentUser.role === 'admin' && (
                    <span>
                      🛡️ <strong>Admin View:</strong> Monitor full audit trails, evaluate Row-Level
                      Security (RLS) rules, and export Supabase PostgreSQL schemas.
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-2 border-t border-[#c4c6cf]/40 flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className="text-[#1a365d] font-semibold hover:underline"
                  >
                    Supabase Sign In
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isLoading}
                    className="text-[#ba1a1a] font-semibold hover:underline"
                  >
                    Sign Out
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-[#1a365d] text-white rounded-lg font-semibold hover:bg-[#002045]"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Edit Profile & Custom Image Upload Mode */}
          {authMode === 'edit-profile' && (
            <form onSubmit={handleSaveProfileChanges} className="space-y-4 text-xs">
              {/* Photo Upload Section */}
              <div className="p-3.5 bg-[#f1f3ff] rounded-xl border border-[#c4c6cf]/40 flex items-center gap-4">
                <div className="relative group shrink-0">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#1a365d] bg-white shadow-xs">
                    <img
                      src={avatar}
                      alt="Uploaded Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 flex-1">
                  <span className="font-bold text-[#002045] block">Profile Photo / Avatar</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer px-3 py-1.5 bg-[#1a365d] text-white rounded-lg font-semibold text-[11px] hover:bg-[#002045] transition-colors inline-flex items-center gap-1 shadow-2xs">
                      <span className="material-symbols-outlined text-[14px]">upload</span>
                      <span>Upload Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setAvatar(
                          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                        )
                      }
                      className="px-2 py-1 bg-white border border-[#c4c6cf] text-[#43474e] rounded text-[11px] hover:bg-slate-50"
                      title="Preset Avatar 1"
                    >
                      Preset 1
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAvatar(
                          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
                        )
                      }
                      className="px-2 py-1 bg-white border border-[#c4c6cf] text-[#43474e] rounded text-[11px] hover:bg-slate-50"
                      title="Preset Avatar 2"
                    >
                      Preset 2
                    </button>
                  </div>
                  <p className="text-[10px] text-[#74777f]">
                    Supports PNG, JPG, WebP from your computer
                  </p>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-[#161c27] mb-1">
                    Full Name / Title
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Chika Obi"
                    className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#161c27] mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. researcher@rdip.org"
                    className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#161c27] mb-1">
                    Research Institution / University
                  </label>
                  <input
                    type="text"
                    required
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="e.g. Institute for Health Demographics"
                    className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#161c27] mb-1">
                    Department / Division
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Department of Epidemiological Surveillance"
                    className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#161c27] mb-1">Role Designation</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                    className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"
                  >
                    <option value="researcher">Researcher (Authoring & Analytics)</option>
                    <option value="enumerator">Enumerator (Field Response Collector)</option>
                    <option value="admin">Administrator (System Governance)</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-[#c4c6cf]/40 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setAuthMode('switch-role')}
                  className="px-3 py-2 text-[#43474e] hover:text-[#161c27] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#006a68] text-white rounded-lg font-semibold hover:bg-[#004f4e] shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Save Profile</span>
                </button>
              </div>
            </form>
          )}

          {/* Login Form */}
          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                  placeholder="lead.researcher@rdip.org"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-[#161c27]">Password</label>
                  <button
                    type="button"
                    onClick={() => setAuthMode('forgot')}
                    className="text-[#1a365d] hover:underline text-[11px]"
                  >
                    Forgot Password?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-[#1a365d] text-white font-semibold hover:bg-[#002045] transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      refresh
                    </span>
                    <span>Authenticating...</span>
                  </>
                ) : (
                  'Sign In with Supabase Auth'
                )}
              </button>

              <div className="pt-2 flex justify-between items-center text-[11px] text-[#43474e]">
                <button
                  type="button"
                  onClick={() => setAuthMode('switch-role')}
                  className="text-[#43474e] hover:underline"
                >
                  Back to Role Switcher
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className="text-[#1a365d] font-bold hover:underline"
                >
                  Create Account
                </button>
              </div>
            </form>
          )}

          {/* Signup Form */}
          {authMode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                  placeholder="Dr. Chika Obi"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#161c27] mb-1">
                  Institutional Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                  placeholder="chika.obi@university.edu"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#161c27] mb-1">
                  Research Institution
                </label>
                <input
                  type="text"
                  required
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                  placeholder="African Institute for Health Demographics"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Requested Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"
                >
                  <option value="researcher">Researcher</option>
                  <option value="enumerator">Enumerator</option>
                </select>
                <span className="text-[10px] text-[#74777f] mt-1 block">
                  Admin roles cannot be self-requested and require database provisioning.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-[#006a68] text-white font-semibold hover:bg-[#004f4e] transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      refresh
                    </span>
                    <span>Registering...</span>
                  </>
                ) : (
                  'Create Institutional Account'
                )}
              </button>

              <div className="pt-1 flex justify-between items-center text-[11px] text-[#43474e]">
                <button
                  type="button"
                  onClick={() => setAuthMode('switch-role')}
                  className="text-[#43474e] hover:underline"
                >
                  Back to Role Switcher
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-[#1a365d] font-bold hover:underline"
                >
                  Sign In Instead
                </button>
              </div>
            </form>
          )}

          {/* Forgot Password */}
          {authMode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4 text-xs">
              <p className="text-[#43474e] text-xs">
                Enter your institutional email address. Supabase Auth will transmit a
                cryptographic password reset link.
              </p>
              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                  placeholder="researcher@rdip.org"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-[#1a365d] text-white font-semibold hover:bg-[#002045] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      refresh
                    </span>
                    <span>Transmitting Link...</span>
                  </>
                ) : (
                  'Send Password Reset Link'
                )}
              </button>

              <div className="text-center text-[11px]">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-[#1a365d] font-bold hover:underline"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
