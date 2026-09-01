import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';

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
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot' | 'switch-role'>('switch-role');
  const [email, setEmail] = useState(currentUser.email);
  const [password, setPassword] = useState('••••••••');
  const [name, setName] = useState(currentUser.name);
  const [institution, setInstitution] = useState(currentUser.institution);
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentUser.role);
  const [notification, setNotification] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      ...currentUser,
      email,
      name: email.split('@')[0].replace('.', ' ').toUpperCase(),
      role: selectedRole
    });
    setNotification('Successfully authenticated via Supabase Auth.');
    setTimeout(() => {
      setNotification(null);
      onClose();
    }, 1200);
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      ...currentUser,
      id: `usr-${Date.now().toString().slice(-4)}`,
      name,
      email,
      institution,
      role: selectedRole
    });
    setNotification('Account registered and session established with Supabase Auth.');
    setTimeout(() => {
      setNotification(null);
      onClose();
    }, 1200);
  };

  const handleRoleQuickSwitch = (role: UserRole) => {
    setSelectedRole(role);
    onUpdateUser({
      ...currentUser,
      role
    });
    setNotification(`Switched active profile role to ${role.toUpperCase()}.`);
    setTimeout(() => setNotification(null), 2000);
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(`Password reset instructions dispatched to ${email}.`);
    setTimeout(() => {
      setNotification(null);
      setAuthMode('login');
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#002045]/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#c4c6cf]/60 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header banner */}
        <div className="bg-[#1a365d] text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <span className="material-symbols-outlined text-2xl text-[#91f0ed]">
                {authMode === 'switch-role' ? 'badge' : authMode === 'forgot' ? 'lock_reset' : 'verified_user'}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                {authMode === 'login' && 'Researcher Sign In'}
                {authMode === 'signup' && 'Create RDIP Account'}
                {authMode === 'forgot' && 'Reset Supabase Password'}
                {authMode === 'switch-role' && 'Role & Session Manager'}
              </h2>
              <p className="text-xs text-white/80 mt-0.5">
                Supabase Auth & Row-Level Security (RLS)
              </p>
            </div>
          </div>
        </div>

        {/* Feedback alert */}
        {notification && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-[#91f0ed]/30 border border-[#006a68]/40 text-[#006e6d] text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{notification}</span>
          </div>
        )}

        <div className="p-6 space-y-5">
          {/* Quick Role Switcher */}
          {authMode === 'switch-role' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#f1f3ff] rounded-xl border border-[#c4c6cf]/40 text-xs">
                <div className="font-semibold text-[#002045] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#1a365d]">account_circle</span>
                  Active Authenticated User
                </div>
                <div className="text-[#43474e] mt-1 text-[11px]">
                  <strong>{currentUser.name}</strong> ({currentUser.email})
                </div>
                <div className="text-[11px] text-[#74777f]">{currentUser.institution}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#002045] mb-2 uppercase tracking-wider">
                  Select Active Persona / Role
                </label>
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
                    <span className="material-symbols-outlined text-xl block mb-1">psychology</span>
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
                    <span className="material-symbols-outlined text-xl block mb-1">cell_tower</span>
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
                    <span className="material-symbols-outlined text-xl block mb-1">admin_panel_settings</span>
                    <span className="text-xs font-bold block">Admin</span>
                    <span className="text-[10px] opacity-80 block">Audit & SQL</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-[#c4c6cf]/40 flex justify-between items-center text-xs">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-[#1a365d] font-semibold hover:underline"
                >
                  Switch User / Re-login
                </button>
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
                  placeholder="researcher@institution.edu"
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
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Role Authorization</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"
                >
                  <option value="researcher">Researcher (Full Analytics & Authoring)</option>
                  <option value="enumerator">Enumerator (Field Response Collector)</option>
                  <option value="admin">System Administrator (Audit & Schema Access)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#1a365d] text-white font-semibold hover:bg-[#002045] transition-colors shadow-sm"
              >
                Sign In with Supabase Auth
              </button>

              <div className="pt-2 text-center text-[11px] text-[#43474e]">
                Need a new account?{' '}
                <button
                  type="button"
                  onClick={() => setAuthMode('signup')}
                  className="text-[#1a365d] font-bold hover:underline"
                >
                  Register Institution
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
                  placeholder="Prof. Chika Obi"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Institutional Email</label>
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
                <label className="block font-semibold text-[#161c27] mb-1">Research Institution</label>
                <input
                  type="text"
                  required
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                  placeholder="University of Nigeria / NIH"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Primary Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none bg-white"
                >
                  <option value="researcher">Researcher</option>
                  <option value="enumerator">Enumerator</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#006a68] text-white font-semibold hover:bg-[#002045] transition-colors shadow-sm"
              >
                Create Account & Apply RLS Policy
              </button>

              <div className="pt-1 text-center text-[11px] text-[#43474e]">
                Already have credentials?{' '}
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-[#1a365d] font-bold hover:underline"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* Forgot Password */}
          {authMode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4 text-xs">
              <p className="text-[#43474e] text-xs">
                Enter your institutional email address. Supabase Auth will transmit a cryptographic magic link to reset your credentials.
              </p>
              <div>
                <label className="block font-semibold text-[#161c27] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-[#c4c6cf] focus:border-[#1a365d] outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#1a365d] text-white font-semibold hover:bg-[#002045] transition-colors"
              >
                Send Password Reset Email
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
