'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { toast } from '@/store/toastStore';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [businessType, setBusinessType] = useState<'Travel' | 'Dates' | 'Belts'>('Dates');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [limit, setLimit] = useState(50);

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    businessType: 'Dates' as 'Travel' | 'Dates' | 'Belts',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Load expenses
  const loadExpenses = async (pageNum = 1) => {
    setLoading(true);
    try {
      const params: any = { page: pageNum, limit };
      if (businessType) params.businessType = businessType;
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) params.endDate = new Date(endDate).toISOString();

      const { data } = await api.get('/expenses', { params });
      setExpenses(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setPage(data.page || 1);
    } catch (e) {
      console.error('Failed to load expenses', e);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses(1);
  }, [businessType, startDate, endDate, limit]);

  // Open add modal
  const openAddModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({
      businessType: 'Dates',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  // Open edit modal
  const openEditModal = (expense: any) => {
    setIsEditing(true);
    setEditingId(expense._id);
    setFormData({
      businessType: expense.businessType,
      amount: String(expense.amount),
      description: expense.description,
      date: new Date(expense.date).toISOString().split('T')[0]
    });
    setShowModal(true);
  };

  // Save expense
  const saveExpense = async () => {
    if (!formData.amount || Number(formData.amount) <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    setModalLoading(true);
    try {
      const payload = {
        businessType: formData.businessType,
        amount: Number(formData.amount),
        description: formData.description,
        date: new Date(formData.date).toISOString()
      };

      if (isEditing && editingId) {
        await api.put(`/expenses/${editingId}`, payload);
        toast.success('Expense updated');
      } else {
        await api.post('/expenses', payload);
        toast.success('Expense added');
      }

      setShowModal(false);
      loadExpenses(1);
    } catch (e) {
      console.error('Failed to save expense', e);
      toast.error('Failed to save expense');
    } finally {
      setModalLoading(false);
    }
  };

  // Delete expense
  const deleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      await api.delete(`/expenses/${id}`);
      toast.success('Expense deleted');
      loadExpenses(page);
    } catch (e) {
      console.error('Failed to delete expense', e);
      toast.error('Failed to delete expense');
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    const sum = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    return sum;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isAdmin={true} />
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Expenses & Ledger</h1>
                <p className="text-gray-600 mt-2">Track business expenses - deducted directly from profit</p>
              </div>
              <button
                onClick={openAddModal}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium flex items-center gap-2"
              >
                <span>+ Add Expense</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Type</label>
                <select
                  value={businessType}
                  onChange={(e) => {
                    setBusinessType(e.target.value as any);
                    setPage(1);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Dates">Dates</option>
                  <option value="Travel">Travel</option>
                  <option value="Belts">Belts</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Items Per Page</label>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-lg border border-red-200 shadow-md">
              <p className="text-xs text-red-700 font-semibold uppercase">Total Expenses</p>
              <p className="text-3xl font-bold text-red-900 mt-2">
                {calculateTotals().toLocaleString('en-PK', {
                  style: 'currency',
                  currency: 'PKR',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}
              </p>
              <p className="text-xs text-red-700 mt-2">{expenses.length} transactions</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-lg border border-orange-200 shadow-md">
              <p className="text-xs text-orange-700 font-semibold uppercase">Deducted from Profit</p>
              <p className="text-3xl font-bold text-orange-900 mt-2">
                -{calculateTotals().toLocaleString('en-PK', {
                  style: 'currency',
                  currency: 'PKR',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}
              </p>
              <p className="text-xs text-orange-700 mt-2">Direct profit impact</p>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-lg border border-yellow-200 shadow-md">
              <p className="text-xs text-yellow-700 font-semibold uppercase">Average Expense</p>
              <p className="text-3xl font-bold text-yellow-900 mt-2">
                {(expenses.length > 0 ? calculateTotals() / expenses.length : 0).toLocaleString('en-PK', {
                  style: 'currency',
                  currency: 'PKR',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}
              </p>
              <p className="text-xs text-yellow-700 mt-2">Per transaction</p>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Business</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Description</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase">Amount</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        <p className="text-sm">Loading expenses...</p>
                      </td>
                    </tr>
                  )}
                  {!loading && expenses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                        <p className="text-sm">No expenses found. Click "Add Expense" to get started.</p>
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    expenses.map((expense) => (
                      <tr key={expense._id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {new Date(expense.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            expense.businessType === 'Travel'
                              ? 'bg-blue-100 text-blue-800'
                              : expense.businessType === 'Dates'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-pink-100 text-pink-800'
                          }`}>
                            {expense.businessType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{expense.description || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-red-600 text-right">
                          -{Number(expense.amount || 0).toLocaleString('en-PK', {
                            style: 'currency',
                            currency: 'PKR',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => openEditModal(expense)}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteExpense(expense._id)}
                            className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition font-medium"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {expenses.length} of {total} expenses — Page {page} / {pages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setPage(Math.min(pages, page + 1))}
                    disabled={page >= pages}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4">
              <h3 className="text-lg font-bold text-white">
                {isEditing ? 'Edit Expense' : 'Add Expense'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Business Type</label>
                <select
                  value={formData.businessType}
                  onChange={(e) =>
                    setFormData({ ...formData, businessType: e.target.value as any })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Dates">Dates</option>
                  <option value="Travel">Travel</option>
                  <option value="Belts">Belts</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount (PKR)</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0"
                  min="0"
                  step="100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Rent, Utilities, Supplies..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                disabled={modalLoading}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveExpense}
                disabled={modalLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {modalLoading ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
