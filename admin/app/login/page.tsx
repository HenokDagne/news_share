'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/api';
import { Eye, EyeOff, ShieldCheck, Lock, Sparkles, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forced password change modal
  const [mustChangeModal, setMustChangeModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const user = await login(email.trim(), password);
      if (user.mustChangePassword) {
        setMustChangeModal(true);
      } else {
        router.push('/');
      }
    } catch (err: any) {
      if (err.code === 'PASSWORD_CHANGE_REQUIRED') {
        const savedToken = localStorage.getItem('news_share_admin_token');
        setTempToken(savedToken);
        setMustChangeModal(true);
      } else {
        setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 12) {
      setErrorMessage('New password must be at least 12 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setChangeLoading(true);
    setErrorMessage(null);

    try {
      await apiRequest('/me/password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: password,
          newPassword,
        }),
      });
      setMustChangeModal(false);
      router.push('/');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update password.');
    } finally {
      setChangeLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0A0B0E] p-6 selection:bg-[#00F2FE] selection:text-black">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-[#00F2FE]/10 to-[#FE2C55]/10 blur-[120px]" />

      <div className="relative w-full max-w-md rounded-3xl border border-[#232733] bg-[#12141A]/90 p-8 shadow-2xl backdrop-blur-xl">
        {/* Brand identity */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#00F2FE] to-[#FE2C55] shadow-lg shadow-cyan-500/25">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white">
            NEWS SHARE
          </h2>
          <p className="mt-1 text-xs font-semibold tracking-widest text-[#00F2FE]">
            CONTROL CONSOLE // RESTRICTED ACCESS
          </p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mt-6 rounded-xl border border-rose-800/60 bg-rose-950/40 p-3.5 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-300">
              Staff Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@newsshare.com"
              className="mt-1.5 w-full rounded-xl border border-[#232733] bg-[#181B22] px-4 py-3 text-sm text-white placeholder-gray-600 transition-colors focus:border-[#00F2FE] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-300">
              Password
            </label>
            <div className="relative mt-1.5">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-[#232733] bg-[#181B22] px-4 py-3 pr-11 text-sm text-white placeholder-gray-600 transition-colors focus:border-[#00F2FE] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#25F4EE] py-3 text-sm font-bold text-black transition-all hover:opacity-95 hover:shadow-lg hover:shadow-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Sign In to Console
              </>
            )}
          </button>
        </form>

        <div className="mt-8 border-t border-[#232733] pt-4 text-center">
          <p className="text-[11px] text-gray-500">
            Audit logging and device telemetry are enforced across all sessions.
          </p>
        </div>
      </div>

      {/* Forced Password Change Modal */}
      {mustChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl border border-[#232733] bg-[#12141A] p-7 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Password Change Required
                </h3>
                <p className="text-xs text-gray-400">
                  Initial staff provisioning requires setting a custom strong password.
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-300">
                  New Password (min 12 chars)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create your permanent password"
                  className="mt-1.5 w-full rounded-xl border border-[#232733] bg-[#181B22] px-4 py-2.5 text-sm text-white focus:border-[#00F2FE] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-300">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="mt-1.5 w-full rounded-xl border border-[#232733] bg-[#181B22] px-4 py-2.5 text-sm text-white focus:border-[#00F2FE] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={changeLoading}
                className="w-full rounded-xl bg-[#00F2FE] py-2.5 text-sm font-bold text-black hover:bg-[#25F4EE] transition-all disabled:opacity-50"
              >
                {changeLoading ? 'Updating...' : 'Set Password & Continue'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
