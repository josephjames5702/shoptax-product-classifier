import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { updateProfile, changePassword } from '../../api/client';
import { User, Lock, CheckCircle2, AlertCircle, Loader2, LogOut } from 'lucide-react';

interface UserProfilePageProps {
  onLogout: () => void;
}

export const UserProfilePage: React.FC<UserProfilePageProps> = ({ onLogout }) => {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(
    user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username : ''
  );
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setIsUpdatingProfile(true);

    try {
      await updateProfile({ name });
      await refreshUser();
      setProfileMsg({ text: 'Profile updated successfully.', type: 'success' });
    } catch (err: any) {
      setProfileMsg({
        text: err?.response?.data?.error || 'Failed to update profile.',
        type: 'error',
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);

    if (newPassword !== confirmPassword) {
      setPwdMsg({ text: 'New passwords do not match.', type: 'error' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setPwdMsg({ text: 'Password changed successfully.', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdMsg({
        text: err?.response?.data?.error || 'Failed to change password.',
        type: 'error',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div className="card-panel p-6 space-y-1">
        <h1 className="text-xl font-bold text-slate-900">Account Profile</h1>
        <p className="text-xs text-slate-500">
          Manage your account credentials, security, and profile preferences.
        </p>
      </div>

      {/* Account Info Card */}
      <div className="card-panel p-6 space-y-4">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
            {(user?.username || 'U')[0].toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-slate-900">{user?.username}</div>
            <div className="text-xs text-slate-400">
              Role: <span className="font-semibold text-slate-700">{user?.role}</span>
              {user?.date_joined && (
                <span> • Member since {new Date(user.date_joined).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
            <User className="w-4 h-4 text-blue-600" />
            <span>Profile Details</span>
          </h2>

          {profileMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                profileMsg.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border border-rose-200 text-rose-700'
              }`}
            >
              {profileMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{profileMsg.text}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isUpdatingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Card */}
      <div className="card-panel p-6 space-y-4">
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
            <Lock className="w-4 h-4 text-blue-600" />
            <span>Change Password</span>
          </h2>

          {pwdMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                pwdMsg.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border border-rose-200 text-rose-700'
              }`}
            >
              {pwdMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{pwdMsg.text}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isChangingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Logout Card */}
      <div className="card-panel p-6 flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-slate-900">Sign Out of Session</div>
          <div className="text-[11px] text-slate-400">Terminates your current browser session.</div>
        </div>
        <button
          onClick={onLogout}
          className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
