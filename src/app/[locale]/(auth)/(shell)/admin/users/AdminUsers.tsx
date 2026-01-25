'use client';

import { CheckCircle, Download, Edit2, Loader2, Save, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  registrationDate: string;
  paymentDate: string | null;
  userStatus: string;
  planType: string | null;
  totalPaid: number;
  couponUsed: boolean;
  discountAmount: number;
  trialEndDate: string | null;
  expirationDate: string | null;
  isFreeAccess: boolean;
  isPayPalTrial?: boolean;
  paypalTrialEndDate?: string | null;
  isTrialCoupon?: boolean;
};

export function AdminUsers() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showFreeAccessModal, setShowFreeAccessModal] = useState(false);
  const [freeAccessDays, setFreeAccessDays] = useState(30);
  const [freeAccessDate, setFreeAccessDate] = useState('');
  const [isGrantingAccess, setIsGrantingAccess] = useState(false);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [newPlanType, setNewPlanType] = useState<string>('');
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error('Failed to load users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleExport = async () => {
    try {
      const csv = [
        ['Name', 'Email', 'Role', 'Registration Date', 'Status', 'Plan', 'Total Paid', 'Coupon Used'].join(','),
        ...users.map(user => [
          user.name,
          user.email,
          user.role,
          new Date(user.registrationDate).toLocaleDateString(),
          user.userStatus,
          user.planType || '—',
          user.totalPaid.toFixed(2),
          user.couponUsed ? 'Yes' : 'No',
        ].join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Users exported successfully');
    } catch (error: any) {
      console.error('Error exporting users:', error);
      toast.error('Failed to export users');
    }
  };

  const handleGrantFreeAccess = async () => {
    if (!selectedUser || isGrantingAccess) {
      return;
    }

    try {
      setIsGrantingAccess(true);
      const params = new URLSearchParams({ userId: selectedUser.id });
      const data: any = {};
      if (freeAccessDate) {
        data.endDate = freeAccessDate;
      } else {
        data.days = freeAccessDays;
      }

      const response = await fetch(`/api/admin/users/free-access?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to grant free access');
      }

      toast.success(`Free access granted to ${selectedUser.email}`);
      setShowFreeAccessModal(false);
      setSelectedUser(null);
      setFreeAccessDays(30);
      setFreeAccessDate('');
      setIsGrantingAccess(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error granting free access:', error);
      toast.error('Failed to grant free access');
      setIsGrantingAccess(false);
    }
  };

  const handleRevokeFreeAccess = async (userId: string) => {
    // eslint-disable-next-line no-alert
    if (!confirm('Are you sure you want to revoke free access?')) {
      return;
    }

    try {
      const params = new URLSearchParams({ userId });
      const response = await fetch(`/api/admin/users/free-access?${params}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke free access');
      }

      toast.success('Free access revoked');
      fetchUsers();
    } catch (error: any) {
      console.error('Error revoking free access:', error);
      toast.error('Failed to revoke free access');
    }
  };

  const handlePlanEdit = (user: AdminUser) => {
    setEditingPlan(user.id);
    setNewPlanType(user.planType || 'free');
  };

  const handlePlanCancel = () => {
    setEditingPlan(null);
    setNewPlanType('');
  };

  const handlePlanUpdate = async (userId: string) => {
    if (!newPlanType || isUpdatingPlan) {
      return;
    }

    try {
      setIsUpdatingPlan(true);
      const params = new URLSearchParams({ userId });
      const response = await fetch(`/api/admin/users/plan?${params}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planType: newPlanType,
          billingCycle: 'monthly', // Default to monthly, can be extended later
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update plan');
      }

      toast.success('Plan updated successfully');
      setEditingPlan(null);
      setNewPlanType('');
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating plan:', error);
      toast.error(error.message || 'Failed to update plan');
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; bg: string }> = {
      'Active User (Paid)': {
        color: 'text-green-700 dark:text-green-400',
        bg: 'bg-green-100 dark:bg-green-900/30',
      },
      'Free Trial': {
        color: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-100 dark:bg-blue-900/30',
      },
      'Churned': {
        color: 'text-red-700 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-900/30',
      },
      'Free Access': {
        color: 'text-purple-700 dark:text-purple-400',
        bg: 'bg-purple-100 dark:bg-purple-900/30',
      },
    };

    const badge = badges[status] || {
      color: 'text-gray-700 dark:text-gray-400',
      bg: 'bg-gray-100 dark:bg-gray-900/30',
    };

    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.color} ${badge.bg}`}
      >
        {status}
      </span>
    );
  };

  const getRemainingDays = (expirationDate: string | null): number | null => {
    if (!expirationDate) {
      return null;
    }
    const now = new Date();
    const end = new Date(expirationDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage users, subscriptions, and access permissions
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            <Download className="h-5 w-5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Registration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Total Paid
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Coupon
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Trial/Free Access
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {users.map(user => (
                <tr key={user.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {new Date(user.registrationDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(user.userStatus)}</td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {editingPlan === user.id
                      ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={newPlanType}
                              onValueChange={setNewPlanType}
                            >
                              <SelectTrigger className="h-8 w-32" disabled={isUpdatingPlan}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="free">Free</SelectItem>
                                <SelectItem value="basic">Basic</SelectItem>
                                <SelectItem value="pro">Pro</SelectItem>
                                <SelectItem value="business">Business</SelectItem>
                                <SelectItem value="trial">Trial</SelectItem>
                              </SelectContent>
                            </Select>
                            <button
                              onClick={() => handlePlanUpdate(user.id)}
                              disabled={isUpdatingPlan}
                              className="text-green-600 hover:text-green-900 disabled:opacity-50 dark:text-green-400 dark:hover:text-green-300"
                              title="Save"
                            >
                              {isUpdatingPlan
                                ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  )
                                : (
                                    <Save className="h-4 w-4" />
                                  )}
                            </button>
                            <button
                              onClick={handlePlanCancel}
                              disabled={isUpdatingPlan}
                              className="text-gray-600 hover:text-gray-900 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-300"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )
                      : (
                          <div className="flex items-center gap-2">
                            {user.planType
                              ? (
                                  <span className="capitalize">{user.planType}</span>
                                )
                              : (
                                  <span className="text-gray-400">—</span>
                                )}
                            <button
                              onClick={() => handlePlanEdit(user)}
                              className="text-blue-600 transition-opacity hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Edit Plan"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900 dark:text-white">
                    $
                    {user.totalPaid.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.couponUsed
                      ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )
                      : (
                          <X className="h-5 w-5 text-gray-400" />
                        )}
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">
                    {user.isFreeAccess && user.expirationDate
                      ? (
                          <div>
                            <div className="mb-1 text-xs font-medium text-purple-600 dark:text-purple-400">
                              Free Access
                            </div>
                            <div>{new Date(user.expirationDate).toLocaleDateString()}</div>
                            {(() => {
                              const remainingDays = getRemainingDays(user.expirationDate);
                              if (remainingDays === null) {
                                return null;
                              }
                              if (remainingDays < 0) {
                                return (
                                  <div className="text-xs text-red-600 dark:text-red-400">
                                    Expired
                                    {' '}
                                    {Math.abs(remainingDays)}
                                    {' '}
                                    days ago
                                  </div>
                                );
                              }
                              return (
                                <div className="text-xs text-green-600 dark:text-green-400">
                                  {remainingDays}
                                  {' '}
                                  {remainingDays === 1 ? 'day' : 'days'}
                                  {' '}
                                  left
                                </div>
                              );
                            })()}
                          </div>
                        )
                      : (
                          <span className="text-gray-400">—</span>
                        )}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                    <div className="flex gap-2">
                      {user.userStatus === 'Churned' && !user.isPayPalTrial && (
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowFreeAccessModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          Grant Access
                        </button>
                      )}
                      {user.isFreeAccess && user.expirationDate && getRemainingDays(user.expirationDate) !== null && getRemainingDays(user.expirationDate)! >= 0 && (
                        <button
                          onClick={() => handleRevokeFreeAccess(user.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Free Access Modal */}
      {showFreeAccessModal && selectedUser && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
              Grant Free Access
            </h2>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              User:
              {' '}
              <strong>{selectedUser.email}</strong>
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="free-access-days" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Number of Days
                </label>
                <input
                  id="free-access-days"
                  type="number"
                  value={freeAccessDays}
                  onChange={e => setFreeAccessDays(Number.parseInt(e.target.value) || 30)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  min="1"
                />
              </div>

              <div className="text-center text-gray-500 dark:text-gray-400">OR</div>

              <div>
                <label htmlFor="free-access-end-date" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  End Date
                </label>
                <input
                  id="free-access-end-date"
                  type="date"
                  value={freeAccessDate}
                  onChange={e => setFreeAccessDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  if (isGrantingAccess) {
                    return;
                  }
                  setShowFreeAccessModal(false);
                  setSelectedUser(null);
                  setFreeAccessDays(30);
                  setFreeAccessDate('');
                  setIsGrantingAccess(false);
                }}
                disabled={isGrantingAccess}
                className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleGrantFreeAccess}
                disabled={isGrantingAccess}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-pink-500 px-4 py-2 text-white transition-colors hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGrantingAccess
                  ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    )
                  : (
                      'Grant Access'
                    )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
