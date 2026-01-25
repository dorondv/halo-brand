'use client';

import { Edit, Gift, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type Coupon = {
  id: string;
  code: string;
  trialDays: number;
  description: string | null;
  validFrom: string;
  validUntil: string | null;
  maxUses: number | null;
  currentUses: number;
  isActive: boolean;
  createdAt: string;
};

export function AdminCoupons() {
  const { showToast, success, error: showError } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    trialDays: 30,
    description: '',
    validUntil: '',
    maxUses: '',
    isActive: true,
  });

  const fetchCoupons = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/coupons');
      if (!response.ok) {
        throw new Error('Failed to load coupons');
      }
      const data = await response.json();
      setCoupons(data);
    } catch (error: any) {
      console.error('Error fetching coupons:', error);
      showError('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    void fetchCoupons();
  }, [fetchCoupons]);

  const resetForm = useCallback(() => {
    setFormData({
      code: '',
      trialDays: 30,
      description: '',
      validUntil: '',
      maxUses: '',
      isActive: true,
    });
  }, []);

  const handleCreate = async () => {
    try {
      const data: any = {
        code: formData.code,
        trialDays: formData.trialDays,
        description: formData.description || undefined,
        isActive: formData.isActive,
      };

      if (formData.validUntil) {
        data.validUntil = formData.validUntil;
      }

      if (formData.maxUses) {
        data.maxUses = Number.parseInt(formData.maxUses);
      }

      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create coupon');
      }

      success('Coupon created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchCoupons();
    } catch (error: any) {
      console.error('Error creating coupon:', error);
      showToast(error.message || 'Failed to create coupon', 'error');
    }
  };

  const handleUpdate = async () => {
    if (!editingCoupon) {
      return;
    }

    try {
      const data: any = {
        trialDays: formData.trialDays,
        description: formData.description || undefined,
        isActive: formData.isActive,
      };

      if (formData.validUntil) {
        data.validUntil = formData.validUntil;
      }

      if (formData.maxUses) {
        data.maxUses = Number.parseInt(formData.maxUses);
      }

      const response = await fetch('/api/admin/coupons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingCoupon.id, ...data }),
      });

      if (!response.ok) {
        throw new Error('Failed to update coupon');
      }

      showToast('Coupon updated successfully', 'success');
      setEditingCoupon(null);
      resetForm();
      fetchCoupons();
    } catch (error: any) {
      console.error('Error updating coupon:', error);
      showToast('Failed to update coupon', 'error');
    }
  };

  const handleDelete = async (couponId: string) => {
    // eslint-disable-next-line no-alert
    if (!confirm('Are you sure you want to deactivate this coupon?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/coupons?id=${couponId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to deactivate coupon');
      }

      success('Coupon deactivated');
      fetchCoupons();
    } catch (error: any) {
      console.error('Error deleting coupon:', error);
      showToast('Failed to deactivate coupon', 'error');
    }
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      trialDays: coupon.trialDays,
      description: coupon.description || '',
      validUntil: coupon.validUntil ? coupon.validUntil.split('T')[0] || '' : '',
      maxUses: coupon.maxUses?.toString() || '',
      isActive: coupon.isActive,
    });
    setShowCreateModal(true);
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Trial Coupons</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Create and manage trial coupon codes
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setEditingCoupon(null);
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-pink-500 px-4 py-2 text-white transition-colors hover:bg-pink-600"
        >
          <Plus className="h-5 w-5" />
          Create Coupon
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {coupons.map(coupon => (
          <div
            key={coupon.id}
            className={`rounded-lg border bg-white dark:bg-gray-800 ${
              coupon.isActive
                ? 'border-gray-200 dark:border-gray-700'
                : 'border-gray-300 opacity-60 dark:border-gray-600'
            } p-6`}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-pink-500" />
                <span className="font-mono text-lg font-bold text-gray-900 dark:text-white">
                  {coupon.code}
                </span>
              </div>
              <span
                className={`rounded px-2 py-1 text-xs font-medium ${
                  coupon.isActive
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {coupon.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Trial Days: </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {coupon.trialDays}
                </span>
              </div>
              {coupon.description && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Description: </span>
                  <span className="text-gray-900 dark:text-white">{coupon.description}</span>
                </div>
              )}
              <div>
                <span className="text-gray-600 dark:text-gray-400">Uses: </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {coupon.currentUses}
                  {coupon.maxUses && ` / ${coupon.maxUses}`}
                </span>
              </div>
              {coupon.validUntil && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Valid Until: </span>
                  <span className="text-gray-900 dark:text-white">
                    {new Date(coupon.validUntil).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => openEditModal(coupon)}
                className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                <Edit className="mr-1 inline h-4 w-4" />
                Edit
              </button>
              <button
                onClick={() => handleDelete(coupon.id)}
                className="rounded-lg bg-red-100 px-3 py-2 text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
              {editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
            </h2>

            <div className="space-y-4">
              {!editingCoupon && (
                <div>
                  <label htmlFor="coupon-code" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Coupon Code *
                  </label>
                  <input
                    id="coupon-code"
                    type="text"
                    value={formData.code}
                    onChange={e =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="TRYOUT30"
                    required
                  />
                </div>
              )}

              <div>
                <label htmlFor="trial-days" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Trial Days *
                </label>
                <input
                  id="trial-days"
                  type="number"
                  value={formData.trialDays}
                  onChange={e =>
                    setFormData({ ...formData, trialDays: Number.parseInt(e.target.value) || 30 })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  min="1"
                  required
                />
              </div>

              <div>
                <label htmlFor="coupon-description" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <input
                  id="coupon-description"
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="30-day trial coupon"
                />
              </div>

              <div>
                <label htmlFor="valid-until" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Valid Until (optional)
                </label>
                <input
                  id="valid-until"
                  type="date"
                  value={formData.validUntil}
                  onChange={e => setFormData({ ...formData, validUntil: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="max-uses" className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Max Uses (optional)
                </label>
                <input
                  id="max-uses"
                  type="number"
                  value={formData.maxUses}
                  onChange={e => setFormData({ ...formData, maxUses: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  min="1"
                  placeholder="Unlimited"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-pink-500 dark:border-gray-600"
                />
                <label
                  htmlFor="isActive"
                  className="ml-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  Active
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingCoupon(null);
                  resetForm();
                }}
                className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={editingCoupon ? handleUpdate : handleCreate}
                className="flex-1 rounded-lg bg-pink-500 px-4 py-2 text-white transition-colors hover:bg-pink-600"
              >
                {editingCoupon ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
