"use client";
import { useEffect, useState, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { generateOrderSlip } from '@/lib/pdf';
import { toast } from '@/store/toastStore';

export default function ExpensesPage() {
  // businessAdd is used in the Add Expense form; businessFilter is used for listing/filtering
  const [businessAdd, setBusinessAdd] = useState<'Travel'|'Dates'|'Belts'>('Dates');
  const [businessFilter, setBusinessFilter] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState<string>('');
  const [description, setDescription] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState<any | null>(null);
  const debounceRef = useRef<number | null>(null);

  const load = async (p = 1) => {
    setLoading(true);
    try {
  const params: any = { page: p, limit: 50 };
  if (businessFilter) params.businessType = businessFilter;
      if (q) params.q = q;
      if (startDateFilter) params.startDate = new Date(startDateFilter).toISOString();
      if (endDateFilter) params.endDate = new Date(endDateFilter).toISOString();
      if (minAmount) params.minAmount = Number(minAmount);
      if (maxAmount) params.maxAmount = Number(maxAmount);
      const { data } = await api.get('/expenses', { params });
      if (data && data.items) {
        setList(data.items);
        setPage(data.page || 1);
        setPages(data.pages || 1);
      }
    } catch (e) {
      console.error('Failed to load expenses', e);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  // initial load
  useEffect(() => { load(1); }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => load(1), 300);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [q, startDateFilter, endDateFilter, minAmount, maxAmount]);

  const applyFilters = () => { load(1); };
  const clearFilters = () => {
    setBusinessFilter(''); setQ(''); setStartDateFilter(''); setEndDateFilter(''); setMinAmount(''); setMaxAmount('');
    load(1);
  };

  const save = async () => {
    try {
  const payload = { businessType: businessAdd, amount, description, date: date || new Date().toISOString() };
      await api.post('/expenses', payload);
      toast.success('Expense saved');
      setAmount(0); setDescription(''); setDate('');
      load(1);
    } catch (e:any) {
      console.error('Save failed', e);
      toast.error(e?.response?.data?.message || 'Failed to save expense');
    }
  };

  const generateFakeSlip = async () => {
    try {
      // Build a fake order object using values from the add form. This will not be saved.
      const fakeOrder: any = {
        orderId: `FAKE-${Date.now()}`,
        businessType: businessAdd,
        productServiceName: description || 'Sample Item',
        sellingPrice: Number(amount) || 0,
        quantity: 1,
        orderDiscount: 0,
        deliveryCharge: 0,
        deliveryPaidByCustomer: true,
        paymentStatus: 'Pending',
        customerName: 'Demo Customer',
        customerPhone: '',
        customerAddress: '',
        createdAt: new Date().toISOString(),
      };

      await generateOrderSlip(fakeOrder);
    } catch (err) {
      console.error('Failed to generate fake slip', err);
      toast.error('Failed to generate slip');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this expense?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      toast.success('Deleted');
      load(page);
    } catch (e) {
      console.error('Delete failed', e);
      toast.error('Delete failed');
    }
  };

  const startEdit = (exp: any) => {
    setEditing({ ...exp });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const payload = { businessType: editing.businessType, amount: Number(editing.amount || 0), description: editing.description, date: editing.date };
      await api.put(`/expenses/${editing._id}`, payload);
      toast.success('Expense updated');
      setEditing(null);
      load(page);
    } catch (e) {
      console.error('Update failed', e);
      toast.error('Update failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isAdmin={true} />
      <div className="flex-1 p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Expenses & Ledger</h1>

        {/* Top controls: add form + filters */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-3">Add Expense</h3>
            <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Business</label>
                  <select aria-label="Business" className="block w-full px-3 py-2 border rounded bg-white" value={businessAdd} onChange={(e)=>setBusinessAdd(e.target.value as any)}>
                    <option value="Dates">Dates</option>
                    <option value="Travel">Travel</option>
                    <option value="Belts">Belts</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-600">Amount</label>
                  <input aria-label="Amount" inputMode="numeric" type="number" className="w-full px-3 py-2 border rounded" value={amount} onChange={(e)=>setAmount(Number(e.target.value))} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-600">Date</label>
                  <input aria-label="Date" type="date" className="w-full px-3 py-2 border rounded" value={date} onChange={(e)=>setDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Description</label>
                  <input aria-label="Description" className="w-full px-3 py-2 border rounded" value={description} onChange={(e)=>setDescription(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <div className="flex gap-2">
                  <button type="button" onClick={generateFakeSlip} className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded">Preview Slip</button>
                  <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow">Add Expense</button>
                </div>
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-3">Search & Filters</h3>
            <div className="flex flex-col md:flex-row md:items-center md:gap-4 flex-wrap">
              <div className="flex-1 min-w-0 relative">
                {/* Search bar with icon + clear */}
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
                </div>
                <input placeholder="Search description..." value={q} onChange={(e)=>setQ(e.target.value)} className="pl-10 pr-10 w-full max-w-full px-3 py-2 border rounded min-w-0" />
                {q && (
                  <button onClick={()=>setQ('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>

              <div className="flex gap-2 flex-wrap items-center mt-3 md:mt-0">
                <select value={businessFilter} onChange={(e)=>setBusinessFilter(e.target.value)} className="px-3 py-2 border rounded max-w-full min-w-0 w-44">
                  <option value="">All Business</option>
                  <option value="Dates">Dates</option>
                  <option value="Travel">Travel</option>
                  <option value="Belts">Belts</option>
                </select>
                <input title="Start date" type="date" value={startDateFilter} onChange={(e)=>setStartDateFilter(e.target.value)} className="px-3 py-2 border rounded max-w-full min-w-0 w-40" />
                <input title="End date" type="date" value={endDateFilter} onChange={(e)=>setEndDateFilter(e.target.value)} className="px-3 py-2 border rounded max-w-full min-w-0 w-40" />
                <input placeholder="Min" value={minAmount} onChange={(e)=>setMinAmount(e.target.value)} className="px-3 py-2 border rounded max-w-full min-w-0 w-28" />
                <input placeholder="Max" value={maxAmount} onChange={(e)=>setMaxAmount(e.target.value)} className="px-3 py-2 border rounded max-w-full min-w-0 w-28" />
              </div>

              <div className="flex gap-2 mt-3 md:mt-0">
                <button onClick={applyFilters} className="px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">Apply</button>
                <button onClick={clearFilters} className="px-3 py-2 border rounded">Clear</button>
              </div>
            </div>

            {/* Active filter chips */}
            <div className="mt-3 flex flex-wrap gap-2">
              {q && (<span className="text-xs bg-gray-100 px-2 py-1 rounded flex items-center gap-2">Search: <strong className="ml-1">{q}</strong></span>)}
              {businessFilter && (<span className="text-xs bg-gray-100 px-2 py-1 rounded">Business: <strong className="ml-1">{businessFilter}</strong></span>)}
              {startDateFilter && (<span className="text-xs bg-gray-100 px-2 py-1 rounded">From: {startDateFilter}</span>)}
              {endDateFilter && (<span className="text-xs bg-gray-100 px-2 py-1 rounded">To: {endDateFilter}</span>)}
              {(minAmount || maxAmount) && (<span className="text-xs bg-gray-100 px-2 py-1 rounded">Amount: {minAmount || '0'} - {maxAmount || '∞'}</span>)}
            </div>
          </div>
        </div>

        {/* Table / ledger */}
        <div className="bg-white p-4 rounded shadow">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">Ledger Entries</h4>
            <div className="text-sm text-gray-600">Showing {list.length} items</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="p-2">Date</th>
                  <th className="p-2">Business</th>
                  <th className="p-2">Description</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5} className="p-4">Loading...</td></tr>}
                {!loading && list.map(l=> (
                  <tr key={l._id} className="border-t hover:bg-gray-50">
                    <td className="p-2 align-top w-32">{new Date(l.date).toLocaleDateString()}</td>
                    <td className="p-2 align-top w-28">{l.businessType}</td>
                    <td className="p-2 align-top">{l.description}</td>
                    <td className="p-2 align-top font-medium">-{Number(l.amount).toFixed(2)}</td>
                    <td className="p-2 align-top">
                      <div className="flex gap-2">
                        <button onClick={()=>startEdit(l)} className="px-2 py-1 bg-amber-500 text-white rounded">Edit</button>
                        <button onClick={()=>remove(l._id)} className="px-2 py-1 bg-red-600 text-white rounded">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && list.length===0 && <tr><td colSpan={5} className="p-4 text-sm text-gray-500">No expenses found</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm text-gray-600">Page {page} / {pages}</div>
            <div>
              <button disabled={page<=1} onClick={()=>load(page-1)} className="px-2 py-1 border rounded mr-2">Prev</button>
              <button disabled={page>=pages} onClick={()=>load(page+1)} className="px-2 py-1 border rounded">Next</button>
            </div>
          </div>
        </div>

        {/* Edit Modal */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white p-6 rounded shadow w-full max-w-lg">
              <h3 className="font-semibold mb-3">Edit Expense</h3>
              <div className="grid grid-cols-1 gap-2">
                <label className="text-xs">Business</label>
                <select value={editing.businessType} onChange={(e)=>setEditing({...editing, businessType: e.target.value})} className="px-2 py-1 border rounded">
                  <option value="Dates">Dates</option>
                  <option value="Travel">Travel</option>
                  <option value="Belts">Belts</option>
                </select>
                <label className="text-xs">Amount</label>
                <input type="number" value={editing.amount} onChange={(e)=>setEditing({...editing, amount: e.target.value})} className="px-2 py-1 border rounded" />
                <label className="text-xs">Date</label>
                <input type="date" value={editing.date ? new Date(editing.date).toISOString().slice(0,10) : ''} onChange={(e)=>setEditing({...editing, date: e.target.value})} className="px-2 py-1 border rounded" />
                <label className="text-xs">Description</label>
                <input value={editing.description} onChange={(e)=>setEditing({...editing, description: e.target.value})} className="px-2 py-1 border rounded" />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={()=>setEditing(null)} className="px-3 py-1 border rounded">Cancel</button>
                <button onClick={saveEdit} className="px-3 py-1 bg-indigo-600 text-white rounded">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
