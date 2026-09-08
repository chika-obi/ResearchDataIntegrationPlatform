import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const PasswordRecoveryGate: React.FC = () => {
  const [ready, setReady] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    const initialise = async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setReady(!!data.session);
        if (!data.session) {
          setIsError(true);
          setMessage('This password recovery link is invalid or has expired. Please request a new password reset link.');
        }
      }
    };

    initialise();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setReady(!!session);
        setIsError(false);
        setMessage(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsError(false);

    if (newPassword.length < 8) {
      setIsError(true);
      setMessage('Password must contain at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setIsError(true);
      setMessage('The passwords do not match.');
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setMessage('Password updated successfully. You can now sign in as your RDIP account.');
      setNewPassword('');
      setConfirmPassword('');

      window.setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.replace(window.location.origin);
      }, 1600);
    } catch (error: any) {
      setIsError(true);
      setMessage(error?.message || 'Unable to update your password. Please request a new reset link.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] min-h-screen bg-[#f9f9ff] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#c4c6cf]/60 overflow-hidden">
        <div className="bg-[#1a365d] text-white p-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <span className="material-symbols-outlined text-[#91f0ed] text-2xl">lock_reset</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">Set New Password</h1>
              <p className="text-xs text-white/80 mt-1">Research Data Integration Platform</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {!ready ? (
            <div className="text-sm text-[#43474e] leading-relaxed">Verifying your password recovery link...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-[#43474e] leading-relaxed">
                Enter a new password for your RDIP account. Your password must contain at least 8 characters.
              </p>

              <label className="block">
                <span className="block text-xs font-bold text-[#002045] mb-1.5">New Password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-[#c4c6cf] focus:outline-none focus:ring-2 focus:ring-[#006a68]/30 focus:border-[#006a68]"
                  placeholder="Enter new password"
                />
              </label>

              <label className="block">
                <span className="block text-xs font-bold text-[#002045] mb-1.5">Confirm New Password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className="w-full px-3 py-2.5 rounded-lg border border-[#c4c6cf] focus:outline-none focus:ring-2 focus:ring-[#006a68]/30 focus:border-[#006a68]"
                  placeholder="Confirm new password"
                />
              </label>

              {message && (
                <div className={`p-3 rounded-lg text-xs font-semibold border ${isError ? 'bg-[#ffdad6] border-[#ba1a1a]/30 text-[#93000a]' : 'bg-[#91f0ed]/30 border-[#006a68]/40 text-[#006e6d]'}`}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2.5 rounded-lg bg-[#006a68] hover:bg-[#004f4e] disabled:opacity-60 text-white text-sm font-bold transition-colors"
              >
                {isSaving ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          )}

          {message && isError && !ready && (
            <button
              type="button"
              onClick={() => window.location.replace(window.location.origin)}
              className="mt-4 w-full py-2.5 rounded-lg border border-[#c4c6cf] text-[#1a365d] text-sm font-semibold hover:bg-[#f1f3ff]"
            >
              Return to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
