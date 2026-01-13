 'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { generateCustomerReport } from '@/lib/pdf';

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [customersPage, setCustomersPage] = useState(1);
  const [customersPages, setCustomersPages] = useState(1);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [customersLimit, setCustomersLimit] = useState(50);
  const [selected, setSelected] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPages, setOrdersPages] = useState(1);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersLimit, setOrdersLimit] = useState(20);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState({ name: '', phone: '', address: '', email: '', notes: '' });
  const [editLoading, setEditLoading] = useState(false);
  
  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Load customers list
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/customers', { params: { q: q || undefined, page: customersPage, limit: customersLimit } });
        if (data && Array.isArray(data.items)) {
          setCustomers(data.items);
          setCustomersTotal(data.total || 0);
          setCustomersPages(data.pages || 1);
        } else if (Array.isArray(data)) {
          setCustomers(data || []);
          setCustomersTotal((data || []).length);
          setCustomersPages(1);
        }
      } catch (e) {
        console.error('Failed to load customers', e);
        setCustomers([]);
        setCustomersTotal(0);
        setCustomersPages(1);
      }
    };
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [q, customersPage, customersLimit]);

  // Fetch orders for selected customer
  const fetchOrdersForCustomer = async (cust: any, page = 1) => {
    const selectedCust = { ...cust };
    setSelected(selectedCust);
    setLoading(true);
    try {
      const params: any = { page, limit: ordersLimit };
      
      // CRITICAL: Filter by customerId (not customerPhone)
      if (cust._id) params.customerId = String(cust._id);
      if (cust.id) params.customerId = String(cust.id);
      
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) params.endDate = new Date(endDate).toISOString();

      const { data } = await api.get('/orders', { params });
      if (data && Array.isArray(data.items)) {
        setOrders(data.items);
        setOrdersTotal(data.total || 0);
        setOrdersPages(data.pages || 1);
        setOrdersPage(data.page || page);
      } else if (Array.isArray(data)) {
        setOrders(data || []);
        setOrdersTotal((data || []).length);
        setOrdersPages(1);
        setOrdersPage(1);
      }
    } catch (e) {
      console.error('Failed to load orders for customer', e);
      setOrders([]);
      setOrdersTotal(0);
      setOrdersPages(1);
      setOrdersPage(1);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = (cust: any) => {
    setCustomersPage(1);
    fetchOrdersForCustomer(cust, 1);
  };

  const goToOrdersPage = (p: number) => {
    if (!selected) return;
    const page = Math.max(1, Math.min(ordersPages || 1, p));
    fetchOrdersForCustomer(selected, page);
  };

  // Open edit modal
  const openEditModal = (customer: any) => {
    setEditData({
      name: customer.name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      email: customer.email || '',
      notes: customer.notes || ''
    });
    setEditModalOpen(true);
  };

  // Save customer edits
  const saveCustomerEdit = async () => {
    if (!selected) return;
    setEditLoading(true);
    try {
      const { data } = await api.put(`/customers/${selected._id}`, editData);
      setSelected(data);
      
      // Update in customers list
      setCustomers(customers.map(c => c._id === data._id ? data : c));
      setEditModalOpen(false);
      alert('Customer updated successfully');
    } catch (e) {
      console.error('Failed to update customer', e);
      alert('Failed to update customer');
    } finally {
      setEditLoading(false);
    }
  };

  // Delete customer
  const deleteCustomer = async () => {
    if (!selected) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/customers/${selected._id}`);
      setCustomers(customers.filter(c => c._id !== selected._id));
      setSelected(null);
      setOrders([]);
      setDeleteModalOpen(false);
      alert('Customer deleted successfully');
    } catch (e) {
      console.error('Failed to delete customer', e);
      alert('Failed to delete customer');
    } finally {
      setDeleteLoading(false);
    }
  };

  const generatePdf = () => {
    if (!selected) return;
    generateCustomerReport({ customer: selected, orders, summary: computeSummary(orders), period: { start: startDate, end: endDate } });
  };

  const computeSummary = (ords: any[]) => {
    const sales = ords.reduce((s, o) => s + Number(o.finalAmount || 0), 0);
    const cost = ords.reduce((s, o) => s + (Number(o.costPrice || 0) + (o.deliveryPaidByCustomer === false ? Number(o.deliveryCharge || 0) : 0)), 0);
    const profit = ords.reduce((s, o) => s + Number(o.profit || 0), 0);
    const pending = ords.reduce((s, o) => s + (o.paymentStatus === 'Partial' ? Number(o.partialRemainingAmount || 0) : (o.paymentStatus === 'Paid' ? 0 : Number(o.finalAmount || 0))), 0);
    return { sales, cost, profit, pending, orderCount: ords.length };
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isAdmin={true} />
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
            <p className="text-gray-600 mt-2">Manage customer information and view order history</p>
          </div>

          {/* Search Bar */}
          <div className="mb-6 flex gap-3">
            <input
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Search by customer name or phone number"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setCustomersPage(1);
              }}
            />
            {q && (
              <button
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                onClick={() => setQ('')}
              >
                Clear
              </button>
            )}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Customers List Panel */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4">
                  <h3 className="font-semibold text-white text-lg">Customers List</h3>
                  <p className="text-indigo-100 text-xs mt-1">{customersTotal} total customers</p>
                </div>

                <div className="space-y-2 max-h-[65vh] overflow-y-auto p-4">
                  {customers.map((c) => (
                    <div
                      key={c._id}
                      className={`p-3 border-2 rounded-lg cursor-pointer transition ${
                        selected && selected._id === c._id
                          ? 'bg-indigo-50 border-indigo-400 shadow-md'
                          : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                      }`}
                      onClick={() => loadOrders(c)}
                    >
                      <div className="font-semibold text-gray-900">{c.name}</div>
                      <div className="text-sm text-gray-600 mt-1">{c.phone}</div>
                      {c.address && <div className="text-xs text-gray-500 mt-1 truncate">{c.address}</div>}
                    </div>
                  ))}
                  {customers.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">No customers found</p>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <select
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={customersLimit}
                      onChange={(e) => {
                        setCustomersLimit(Number(e.target.value));
                        setCustomersPage(1);
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={customersPage <= 1}
                      onClick={() => setCustomersPage(customersPage - 1)}
                    >
                      ← Prev
                    </button>
                    <button
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={customersPage >= customersPages}
                      onClick={() => setCustomersPage(customersPage + 1)}
                    >
                      Next →
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 text-center">
                    Page {customersPage} of {customersPages}
                  </div>
                </div>
              </div>
            </div>

            {/* Orders Panel */}
            <div className="lg:col-span-2">
              {!selected ? (
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-12 text-center">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-medium">Select a customer to view orders</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                  {/* Customer Header */}
                  <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                        <div className="text-indigo-100 text-sm mt-2">
                          <p>📞 {selected.phone}</p>
                          {selected.address && <p>📍 {selected.address}</p>}
                          {selected.email && <p>📧 {selected.email}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="px-4 py-2 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 transition font-medium text-sm"
                          onClick={() => openEditModal(selected)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium text-sm"
                          onClick={() => setDeleteModalOpen(true)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Filter Section */}
                  <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                    <div className="flex gap-3 items-center">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-gray-600">to</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm"
                        onClick={() => selected && fetchOrdersForCustomer(selected, 1)}
                      >
                        Filter
                      </button>
                      <button
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm ml-auto"
                        onClick={generatePdf}
                      >
                        📄 Generate PDF
                      </button>
                    </div>
                  </div>

                  {/* Orders Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Bill #</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Items</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Amount</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Paid</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading && (
                          <tr>
                            <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                              Loading orders...
                            </td>
                          </tr>
                        )}
                        {!loading &&
                          orders.map((o) => (
                            <tr key={o._id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                              <td className="px-6 py-3 font-semibold text-gray-900">{o.orderId}</td>
                              <td className="px-6 py-3 text-gray-600 text-sm">
                                {new Date(o.createdAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </td>
                              <td className="px-6 py-3 text-gray-600 text-sm">
                                {(o.products && o.products.length > 0)
                                  ? o.products.map((p: any) => p.name).join(', ')
                                  : o.productServiceName}
                              </td>
                              <td className="px-6 py-3 text-right font-medium text-gray-900">
                                {Number(o.finalAmount || 0).toLocaleString('en-PK', {
                                  style: 'currency',
                                  currency: 'PKR',
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </td>
                              <td className="px-6 py-3 text-right text-green-600 font-medium">
                                {o.paymentStatus === 'Paid'
                                  ? Number(o.finalAmount || 0).toLocaleString('en-PK', {
                                      style: 'currency',
                                      currency: 'PKR',
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })
                                  : o.paymentStatus === 'Partial'
                                  ? Number(o.partialPaidAmount || 0).toLocaleString('en-PK', {
                                      style: 'currency',
                                      currency: 'PKR',
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2
                                    })
                                  : '₨0.00'}
                              </td>
                              <td className="px-6 py-3 text-right font-medium text-red-600">
                                {Number(
                                  o.partialRemainingAmount ||
                                    (o.paymentStatus === 'Paid' ? 0 : o.finalAmount || 0)
                                ).toLocaleString('en-PK', {
                                  style: 'currency',
                                  currency: 'PKR',
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </td>
                            </tr>
                          ))}
                        {!loading && orders.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                              <p className="text-sm">No orders found for this customer in the selected period.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Orders Pagination */}
                  <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {orders.length} of {ordersTotal} orders
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={ordersLimit}
                        onChange={(e) => {
                          setOrdersLimit(Number(e.target.value));
                          if (selected) fetchOrdersForCustomer(selected, 1);
                        }}
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                      <button
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={ordersPage <= 1}
                        onClick={() => goToOrdersPage(ordersPage - 1)}
                      >
                        ← Prev
                      </button>
                      <span className="text-sm text-gray-600 px-2">
                        {ordersPage} / {ordersPages}
                      </span>
                      <button
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={ordersPage >= ordersPages}
                        onClick={() => goToOrdersPage(ordersPage + 1)}
                      >
                        Next →
                      </button>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="border-t border-gray-200 px-6 py-6 bg-white">
                    <h4 className="font-semibold text-gray-900 mb-4">Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                        <p className="text-xs text-blue-700 font-semibold uppercase">Sales</p>
                        <p className="text-lg font-bold text-blue-900 mt-1">
                          {computeSummary(orders).sales.toLocaleString('en-PK', {
                            style: 'currency',
                            currency: 'PKR',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })}
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                        <p className="text-xs text-orange-700 font-semibold uppercase">Cost</p>
                        <p className="text-lg font-bold text-orange-900 mt-1">
                          {computeSummary(orders).cost.toLocaleString('en-PK', {
                            style: 'currency',
                            currency: 'PKR',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })}
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                        <p className="text-xs text-green-700 font-semibold uppercase">Profit</p>
                        <p className="text-lg font-bold text-green-900 mt-1">
                          {computeSummary(orders).profit.toLocaleString('en-PK', {
                            style: 'currency',
                            currency: 'PKR',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })}
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
                        <p className="text-xs text-red-700 font-semibold uppercase">Pending</p>
                        <p className="text-lg font-bold text-red-900 mt-1">
                          {computeSummary(orders).pending.toLocaleString('en-PK', {
                            style: 'currency',
                            currency: 'PKR',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })}
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                        <p className="text-xs text-purple-700 font-semibold uppercase">Orders</p>
                        <p className="text-lg font-bold text-purple-900 mt-1">{computeSummary(orders).orderCount}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4">
              <h3 className="text-lg font-bold text-white">Edit Customer</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={editData.address}
                  onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={editData.notes}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  rows={3}
                />
              </div>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
              <button
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                onClick={() => setEditModalOpen(false)}
                disabled={editLoading}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={saveCustomerEdit}
                disabled={editLoading}
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="bg-red-600 px-6 py-4">
              <h3 className="text-lg font-bold text-white">Delete Customer?</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700">
                Are you sure you want to delete <strong>{selected?.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
              <button
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={deleteCustomer}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
