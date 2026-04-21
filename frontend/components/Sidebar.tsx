import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Check, X, MessageSquare, RefreshCw, CheckCircle, AlertCircle, LogOut, AlertTriangle, Loader2, Settings } from 'lucide-react';

interface Session {
  session_id: string;
  title: string;
}

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  editingSessionId: string | null;
  editTitle: string;
  user: any;
  onCreateSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onEditSession: (sessionId: string, title: string) => void;
  onUpdateTitle: (sessionId: string, title: string) => void;
  onCancelEdit: () => void;
  onDeleteSession: (sessionId: string) => void;
  onLogout: () => void;
  onUserUpdate: (updatedUser: any) => void;
  setEditTitle: (title: string) => void;
}

// Account Settings Modal Component
function AccountSettings({ user, onClose, onUpdateName, onDeleteAccount }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      setError('Name cannot be empty');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/auth/update-name`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('thynkflow_token')}`
        },
        body: JSON.stringify({ name: newName })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to update name');
      }

      setSuccess('✅ Name updated successfully!');
      setIsEditing(false);
      
      const userData = JSON.parse(localStorage.getItem('thynkflow_user') || '{}');
      userData.name = newName;
      localStorage.setItem('thynkflow_user', JSON.stringify(userData));
      
      onUpdateName(newName);

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update name');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setError('Please type DELETE to confirm');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('thynkflow_token')}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to delete account');
      }

      localStorage.removeItem('thynkflow_token');
      localStorage.removeItem('thynkflow_user');
      
      onDeleteAccount();
    } catch (err: any) {
      setError(err.message || 'Failed to delete account');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 transform transition-all animate-scale-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Account Settings</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-3xl font-semibold shadow-lg">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm animate-shake">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm animate-slide-in">
              {success}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setError('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter new name"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleUpdateName}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Save
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setNewName(user?.name || '');
                      setError('');
                    }}
                    disabled={loading}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <span className="text-gray-900 font-medium">{user?.name}</span>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-gray-600">{user?.email}</span>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Account
            </button>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 transform transition-all animate-scale-in">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm animate-shake">
                  {error}
                </div>
              )}

              <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-800 mb-3">
                  Deleting your account will permanently remove:
                </p>
                <ul className="text-sm text-red-700 space-y-1 ml-4 list-disc">
                  <li>All your chat sessions</li>
                  <li>All your messages and data</li>
                  <li>Your account information</li>
                </ul>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="font-bold text-red-600">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => {
                    setDeleteConfirmText(e.target.value);
                    setError('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="DELETE"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                    setError('');
                  }}
                  disabled={loading}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={loading || deleteConfirmText !== 'DELETE'}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete Forever
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  sessions,
  currentSessionId,
  editingSessionId,
  editTitle,
  user,
  onCreateSession,
  onSelectSession,
  onEditSession,
  onUpdateTitle,
  onCancelEdit,
  onDeleteSession,
  onLogout,
  onUserUpdate,
  setEditTitle,
}: SidebarProps) {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'other'>('bug');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [refreshMessage, setRefreshMessage] = useState('');
  const [currentModel, setCurrentModel] = useState('');

  // Account settings state
  const [showAccountSettings, setShowAccountSettings] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) return;

    setIsSubmitting(true);
    setErrorMessage('');
    
    try {
      const response = await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('thynkflow_token')}`
        },
        body: JSON.stringify({ type: feedbackType, message: feedbackText })
      });

      const data = await response.json();

      if (data.success) {
        setSubmitSuccess(true);
        setEmailSent(data.email_sent);
        setFeedbackText('');
        
        setTimeout(() => {
          setShowFeedbackModal(false);
          setSubmitSuccess(false);
          setEmailSent(false);
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshModel = async () => {
    setIsRefreshing(true);
    setRefreshStatus('idle');
    
    try {
      const response = await fetch(`${API_URL}/refresh-model`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('thynkflow_token')}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setRefreshStatus('success');
        setRefreshMessage(data.message);
        setCurrentModel(data.model);
        setTimeout(() => {
          setRefreshStatus('idle');
          setRefreshMessage('');
        }, 5000);
      }
    } catch (error) {
      setRefreshStatus('error');
      setRefreshMessage('Failed to refresh model');
      setTimeout(() => {
        setRefreshStatus('idle');
        setRefreshMessage('');
      }, 5000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    try {
      setIsRedirecting(true);
      
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('thynkflow_token')}`
          }
        });
      } catch (error) {
        console.error('Logout API error:', error);
      }
      
      setTimeout(() => {
        onLogout();
      }, 800);
    } catch (error) {
      console.error('Logout error:', error);
      onLogout();
    }
  };

  const handleUserUpdate = (newName: string) => {
    const updatedUser = { ...user, name: newName };
    onUserUpdate(updatedUser);
  };

  const handleDeleteAccount = () => {
    onLogout();
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            T
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">ThynkFlow</h1>
            <p className="text-xs text-gray-500">AI v1.0.4</p>
          </div>
        </div>

        <button
          onClick={onCreateSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="px-4 py-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Recent Chats
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        {sessions.map((session) => (
          <div
            key={session.session_id}
            className={`group px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              currentSessionId === session.session_id
                ? 'bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200'
                : 'hover:bg-gray-50'
            }`}
            onClick={() => onSelectSession(session.session_id)}
          >
            {editingSessionId === session.session_id ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={() => onUpdateTitle(session.session_id, editTitle)}
                  className="text-green-600 hover:text-green-700"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  onClick={onCancelEdit}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-800 truncate block">
                    {session.title}
                  </span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditSession(session.session_id, session.title);
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <Edit2 className="w-3 h-3 text-gray-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.session_id);
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <Trash2 className="w-3 h-3 text-gray-600" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* System Actions Section */}
      <div className="px-4 py-3 border-t border-gray-200 space-y-2">
        <button
          onClick={() => setShowFeedbackModal(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          Report & Feedback
        </button>

        <button
          onClick={handleRefreshModel}
          disabled={isRefreshing}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
            refreshStatus === 'success'
              ? 'bg-green-100 text-green-700 border border-green-300'
              : refreshStatus === 'error'
              ? 'bg-red-100 text-red-700 border border-red-300'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } ${isRefreshing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {refreshStatus === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : refreshStatus === 'error' ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          )}
          <span>
            {isRefreshing ? 'Refreshing...' : refreshStatus === 'success' ? 'Model Refreshed!' : 'Refresh AI Model'}
          </span>
        </button>

        {refreshMessage && (
          <div
            className={`text-xs p-2 rounded ${
              refreshStatus === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {refreshMessage}
          </div>
        )}

        {currentModel && refreshStatus === 'success' && (
          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
            <span className="font-semibold">Model:</span> {currentModel.replace('models/', '')}
          </div>
        )}
      </div>

      {/* User Info Section */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-500 truncate" title={user?.email}>
              {user?.email || ''}
            </p>
          </div>
          <button
            onClick={() => setShowAccountSettings(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Account Settings"
          >
            <Settings className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <button
          onClick={handleLogoutClick}
          disabled={isRedirecting}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

      {/* Account Settings Modal */}
      {showAccountSettings && (
        <AccountSettings
          user={user}
          onClose={() => setShowAccountSettings(false)}
          onUpdateName={handleUserUpdate}
          onDeleteAccount={handleDeleteAccount}
        />
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 transform transition-all animate-scale-in">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Confirm Logout</h3>
                  <p className="text-sm text-gray-600">Are you sure you want to sign out?</p>
                </div>
              </div>
              
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700">
                  You will need to log in again to access your chats and sessions.
                </p>
              </div>

              {isRedirecting && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-600 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Logging out...
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  disabled={isRedirecting}
                  className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  disabled={isRedirecting}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isRedirecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Logging out...
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      Yes, Logout
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 transform transition-all animate-scale-in">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Report & Feedback
              </h3>
              
              {submitSuccess ? (
                <div className="py-8 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <p className="text-green-600 font-medium">Feedback submitted successfully!</p>
                  {emailSent ? (
                    <p className="text-sm text-gray-500 mt-2">✅ Check your email for confirmation.</p>
                  ) : (
                    <p className="text-sm text-yellow-600 mt-2">⚠️ Feedback saved, but email notification failed.</p>
                  )}
                </div>
              ) : (
                <>
                  {errorMessage && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-600">{errorMessage}</p>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type
                    </label>
                    <select
                      value={feedbackType}
                      onChange={(e) => setFeedbackType(e.target.value as 'bug' | 'feature' | 'other')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="bug">Bug Report</option>
                      <option value="feature">Feature Request</option>
                      <option value="other">Other Feedback</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Message
                    </label>
                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Describe your feedback..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowFeedbackModal(false);
                        setFeedbackText('');
                        setSubmitSuccess(false);
                        setErrorMessage('');
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitFeedback}
                      disabled={!feedbackText.trim() || isSubmitting}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scale-in {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }

        @keyframes slide-in {
          from {
            transform: translateY(-10px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }

        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }

        .animate-slide-in {
          animation: slide-in 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}