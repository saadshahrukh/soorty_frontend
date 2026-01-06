'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useOrderStore, Order } from '@/store/orderStore';
import api from '@/lib/api';
import { generateBusinessReport } from '@/lib/pdf';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { BellIcon } from '@heroicons/react/24/outline';
import Sidebar from '@/components/Sidebar';

interface Summary {
  summary: {
    Travel: { sales: number; cost: number; profit: number; pending: number; loss: number; orderCount: number };
    Dates: { sales: number; cost: number; profit: number; pending: number; loss: number; orderCount: number };
    Belts: { sales: number; cost: number; profit: number; pending: number; loss: number; orderCount: number };
  };
  totals: {
    sales: number;
    cost: number;
    profit: number;
    pending: number;
    loss: number;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuthStore();
  const { orders, fetchOrders, loading } = useOrderStore();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [activeBusiness, setActiveBusiness] = useState<'Travel' | 'Dates' | 'Belts' | 'All'>('All');
  const [startDate, setStartDate] = useState<string>(''); // ISO string for datetime-local
  const [endDate, setEndDate] = useState<string>('');
  const [logsCount, setLogsCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    } else {
      if (user?.role === 'DataEntry') {
        router.push('/orders');
        return;
      }
      // Initial: current month summary + all orders
      fetchOrders();
      fetchSummary();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (user?.role === 'Admin') {
      const load = async () => {
        try {
          const { data } = await api.get('/users/audit-logs', { params: { limit: 20 } });
          const lastSeen = Number(localStorage.getItem('logs_last_seen') || '0');
          const newCount = data.filter((l: any) => new Date(l.createdAt).getTime() > lastSeen).length;
          setLogsCount(newCount);
        } catch (e) {}
      };
      load();
      const id = setInterval(load, 30000);
      return () => clearInterval(id);
    }
  }, [user?.role]);

  const fetchSummary = async (useFilteredOrders = false) => {
    setSummaryLoading(true);
    try {
      if (useFilteredOrders && (startDate || endDate)) {
        // When filters are applied, compute from filtered orders
        // This will be handled by computedByBusiness, so we'll just set loading to false
        setSummaryLoading(false);
        return;
      } else {
        // Use monthly endpoint for default view
        const { data } = await api.get('/summary/monthly');
        setSummary(data);
      }
    } catch (error) {
      console.error('Fetch summary error:', error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PKR'
    }).format(amount);
  };

  const syncToNow = () => {
    const now = new Date();
    setEndDate(now.toISOString().slice(0, 16));
  };

  const applyRange = async () => {
    setSummaryLoading(true);
    const params: any = {};
    if (startDate) params.startDate = new Date(startDate).toISOString();
    if (endDate) params.endDate = new Date(endDate).toISOString();
    if (activeBusiness !== 'All') params.businessType = activeBusiness;
    
    // Fetch filtered orders - this will update the orders in the store
    // The graph will automatically update because computedByBusiness depends on orders
    await fetchOrders(params);
    
    // Clear summary when filters are applied so graph uses filtered orders data
    // When NO filters are active, fetch default monthly summary
    if (!startDate && !endDate && activeBusiness === 'All') {
      await fetchSummary();
    } else {
      // When filters are active, don't use summary - use filtered orders
      setSummary(null);
    }
    setSummaryLoading(false);
  };
  
  const clearAllFilters = async () => {
    setStartDate('');
    setEndDate('');
    setActiveBusiness('All');
    setPage(1);
    // Fetch all orders (no filters)
    await fetchOrders();
    // Fetch default monthly summary
    await fetchSummary();
  };

  const computedByBusiness = useMemo(() => {
    const groups: Record<'Travel'|'Dates'|'Belts', { sales: number; cost: number; profit: number; pending: number; loss: number; orderCount: number }> = {
      Travel: { sales: 0, cost: 0, profit: 0, pending: 0, loss: 0, orderCount: 0 },
      Dates: { sales: 0, cost: 0, profit: 0, pending: 0, loss: 0, orderCount: 0 },
      Belts: { sales: 0, cost: 0, profit: 0, pending: 0, loss: 0, orderCount: 0 },
    };
    orders.forEach(o => {
      const g = groups[o.businessType];
      g.sales += o.sellingPrice;
      g.cost += o.costPrice;
      g.profit += o.profit || (o.sellingPrice - o.costPrice);
      g.orderCount += 1;
      
      // Calculate pending amount
      if (o.paymentStatus !== 'Paid') {
        if (o.paymentStatus === 'Partial') {
          const order: any = o;
          g.pending += order.partialRemainingAmount || (o.sellingPrice * 0.5);
        } else {
          g.pending += o.sellingPrice;
        }
      }
      
      // Calculate loss (cost not covered by payments)
      const order: any = o;
      const tax = (order.taxPercent || 0) / 100;
      const finalAmount = Math.round((o.sellingPrice * (1 + tax)) * 100) / 100;
      const paidAmount = o.paymentStatus === 'Paid' ? finalAmount : 
                         (o.paymentStatus === 'Partial' ? (order.partialPaidAmount || 0) : 0);
      const orderLoss = Math.max(0, o.costPrice - paidAmount);
      g.loss += orderLoss;
    });
    const totals = Object.values(groups).reduce((acc, g) => ({
      sales: acc.sales + g.sales,
      cost: acc.cost + g.cost,
      profit: acc.profit + g.profit,
      pending: acc.pending + g.pending,
      loss: acc.loss + g.loss,
    }), { sales: 0, cost: 0, profit: 0, pending: 0, loss: 0 });
    return { groups, totals };
  }, [orders]);

  const businessOrders = (business: 'Travel' | 'Dates' | 'Belts' | 'All'): Order[] => {
    if (business === 'All') return orders;
    return orders.filter(o => o.businessType === business);
  };
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Determine if we're using filtered data (date or business filters)
  const hasFilters = startDate || endDate || activeBusiness !== 'All';
  
  // IMPORTANT: When filters are applied, we MUST use computedByBusiness (from filtered orders)
  // The fetchOrders with params will filter the orders in the store, so computedByBusiness
  // will automatically reflect the filtered data
  const useFilteredData = hasFilters;

  // Graph data: ALWAYS use filtered orders when date/business filters are active
  // This ensures graph shows same data as the orders table
  const businessChartData = useMemo(() => {
    // When filters are active, use computedByBusiness (which uses filtered orders)
    if (useFilteredData) {
      // Use computed data from filtered orders with safety checks
      if (!computedByBusiness || !computedByBusiness.groups) {
        return [];
      }
      const data = [
        { 
          name: 'Travel', 
          sales: computedByBusiness.groups.Travel?.sales || 0, 
          cost: computedByBusiness.groups.Travel?.cost || 0, 
          profit: computedByBusiness.groups.Travel?.profit || 0, 
          loss: computedByBusiness.groups.Travel?.loss || 0 
        },
        { 
          name: 'Dates', 
          sales: computedByBusiness.groups.Dates?.sales || 0, 
          cost: computedByBusiness.groups.Dates?.cost || 0, 
          profit: computedByBusiness.groups.Dates?.profit || 0, 
          loss: computedByBusiness.groups.Dates?.loss || 0 
        },
        { 
          name: 'Belts', 
          sales: computedByBusiness.groups.Belts?.sales || 0, 
          cost: computedByBusiness.groups.Belts?.cost || 0, 
          profit: computedByBusiness.groups.Belts?.profit || 0, 
          loss: computedByBusiness.groups.Belts?.loss || 0 
        },
      ];
      
      // Filter by activeBusiness if not 'All'
      if (activeBusiness !== 'All') {
        return data.filter(item => item.name === activeBusiness);
      }
      return data;
    } else if (summary && summary.summary) {
      // Use API summary data only when NO filters are active
      const summaryData = summary.summary || {};
      const data = [
        { 
          name: 'Travel', 
          sales: summaryData.Travel?.sales || 0, 
          cost: summaryData.Travel?.cost || 0, 
          profit: summaryData.Travel?.profit || 0, 
          loss: summaryData.Travel?.loss || 0 
        },
        { 
          name: 'Dates', 
          sales: summaryData.Dates?.sales || 0, 
          cost: summaryData.Dates?.cost || 0, 
          profit: summaryData.Dates?.profit || 0, 
          loss: summaryData.Dates?.loss || 0 
        },
        { 
          name: 'Belts', 
          sales: summaryData.Belts?.sales || 0, 
          cost: summaryData.Belts?.cost || 0, 
          profit: summaryData.Belts?.profit || 0, 
          loss: summaryData.Belts?.loss || 0 
        },
      ];
      
      // Filter by activeBusiness if not 'All' (shouldn't happen without filters, but just in case)
      if (activeBusiness !== 'All') {
        return data.filter(item => item.name === activeBusiness);
      }
      return data;
    }
    return [];
  }, [useFilteredData, computedByBusiness, summary, activeBusiness]);

  // Get display totals: ALWAYS use filtered orders data when filters are active
  // This ensures totals match what's shown in the graph and orders table
  const displayTotals = useMemo(() => {
    if (useFilteredData) {
      // Use computed totals from filtered orders
      return computedByBusiness.totals;
    } else if (summary) {
      // Use API summary totals only when NO filters are active
      return summary.totals;
    }
    return { sales: 0, cost: 0, profit: 0, pending: 0, loss: 0 };
  }, [useFilteredData, computedByBusiness, summary]);

  if (loading || summaryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    
    <div className="min-h-screen bg-gray-50 flex w-full max-w-full">
      {/* Navbar */}
       <Sidebar isAdmin={user?.role==='Admin'} />
       <div className='flex-1 flex flex-col' >
      <nav className="bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b sticky top-0 z-50 !w-[100%]">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">PS</div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-800 truncate">Pak Soorty Business Dashboard</h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">           
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-700">
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center font-semibold">
                  {user?.name?.[0]}
                </div>
                <span>{user?.name}</span>
                <span className="text-gray-400">•</span>
                <span>{user?.role}</span>
              </div>
              <button
                onClick={() => { logout(); router.push("/login"); }}
                className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all"
                title="Logout"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Filters Section */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800">Filter Data</h3>
            </div>
            {hasFilters && (
              <span className="px-3 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full">
                Filters Active
              </span>
            )}
          </div>
          
          <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">End Date & Time</label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Business Type</label>
                <select
                  value={activeBusiness}
                  onChange={(e)=>{ setActiveBusiness(e.target.value as any); setPage(1); }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all bg-white"
                >
                  <option value="All">All Businesses</option>
                  <option value="Travel">Travel</option>
                  <option value="Dates">Dates</option>
                  <option value="Belts">Belts</option>
                </select>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={syncToNow} 
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-all flex items-center gap-2"
                title="Set end date to now"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Now
              </button>
              <button 
                onClick={applyRange} 
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Apply Filters
              </button>
              <button 
                onClick={clearAllFilters} 
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-all flex items-center gap-2"
                disabled={!hasFilters}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Clear All
              </button>
            </div>
          </div>
          
          {hasFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Filtered View:</span> Graph and all metrics below are now showing data based on your selected filters. 
                {startDate && endDate && (
                  <span className="ml-2 text-indigo-600">
                    {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                  </span>
                )}
                {activeBusiness !== 'All' && (
                  <span className="ml-2 text-indigo-600">• {activeBusiness} only</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-md border border-green-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wide">Total Sales</h3>
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-green-700">
              {formatCurrency(displayTotals.sales)}
            </p>
            {hasFilters && <p className="text-xs text-green-600 mt-1">Filtered</p>}
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-md border border-red-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wide">Total Cost</h3>
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-red-700">
              {formatCurrency(displayTotals.cost)}
            </p>
            {hasFilters && <p className="text-xs text-red-600 mt-1">Filtered</p>}
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-md border border-blue-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Net Profit</h3>
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-blue-700">
              {formatCurrency(displayTotals.profit)}
            </p>
            {hasFilters && <p className="text-xs text-blue-600 mt-1">Filtered</p>}
          </div>

          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl shadow-md border border-yellow-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">Pending Payments</h3>
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-yellow-700">
              {formatCurrency(displayTotals.pending)}
            </p>
            {hasFilters && <p className="text-xs text-yellow-600 mt-1">Filtered</p>}
          </div>
          
          <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-xl shadow-md border border-rose-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Loss</h3>
              <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-rose-700">
              {formatCurrency(displayTotals.loss)}
            </p>
            {hasFilters && <p className="text-xs text-rose-600 mt-1">Filtered</p>}
          </div>
        </div>

        {/* Enhanced Graph Section */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Business Comparison</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {hasFilters ? 'Showing filtered data' : 'All-time comparison by business'}
                </p>
              </div>
            </div>
            {businessChartData.length === 0 && (
              <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                No data
              </span>
            )}
          </div>
          
          {businessChartData.length > 0 ? (
            <div style={{ width: '100%', height: 380 }} className="mt-4">
              <ResponsiveContainer>
                <BarChart data={businessChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#6b7280"
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    fontSize={12}
                    tick={{ fill: '#6b7280' }}
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                      return value.toString();
                    }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="circle"
                  />
                  <Bar dataKey="sales" fill="#10b981" name="Sales" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="cost" fill="#64748b" name="Cost" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="profit" fill="#3b82f6" name="Profit" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="loss" fill="#f59e0b" name="Loss" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-gray-500 text-lg font-medium">No data available</p>
                <p className="text-gray-400 text-sm mt-1">Apply filters to see data or check back later</p>
              </div>
            </div>
          )}
        </div>

        {/* Business Breakdown Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {['Travel','Dates','Belts'].map((business) => {
            const summaryData = summary?.summary || {};
            const data = useFilteredData
              ? (computedByBusiness?.groups as any)?.[business] || { sales: 0, cost: 0, profit: 0, orderCount: 0 }
              : (summary ? summaryData[business as keyof typeof summaryData] || { sales: 0, cost: 0, profit: 0, orderCount: 0 } : (computedByBusiness?.groups as any)?.[business] || { sales: 0, cost: 0, profit: 0, orderCount: 0 });
            
            const isActive = activeBusiness === business;
            const businessColors = {
              Travel: { bg: 'from-blue-50 to-blue-100', border: 'border-blue-200', text: 'text-blue-700', accent: 'bg-blue-600' },
              Dates: { bg: 'from-green-50 to-green-100', border: 'border-green-200', text: 'text-green-700', accent: 'bg-green-600' },
              Belts: { bg: 'from-purple-50 to-purple-100', border: 'border-purple-200', text: 'text-purple-700', accent: 'bg-purple-600' },
            };
            const colors = businessColors[business as keyof typeof businessColors] || businessColors.Travel;
            
            return (
              <div 
                key={business} 
                className={`bg-gradient-to-br ${colors.bg} rounded-xl shadow-md ${isActive ? `border-2 ${colors.border}` : 'border border-gray-200'} p-6 hover:shadow-lg transition-all`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-xl font-bold ${colors.text}`}>{business}</h2>
                  {isActive && (
                    <span className={`px-2 py-1 text-xs font-medium ${colors.accent} text-white rounded-full`}>
                      Selected
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-white/60 rounded-lg p-2">
                    <span className="text-sm font-medium text-gray-700">Sales:</span>
                    <span className="font-bold text-green-700">{formatCurrency(data?.sales || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/60 rounded-lg p-2">
                    <span className="text-sm font-medium text-gray-700">Cost:</span>
                    <span className="font-bold text-red-700">{formatCurrency(data?.cost || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/60 rounded-lg p-2">
                    <span className="text-sm font-medium text-gray-700">Profit:</span>
                    <span className="font-bold text-blue-700">{formatCurrency(data?.profit || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/60 rounded-lg p-2">
                    <span className="text-sm font-medium text-gray-700">Orders:</span>
                    <span className="font-bold text-gray-900">{data?.orderCount || 0}</span>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setActiveBusiness(business as any);
                        setPage(1);
                      }}
                      className={`flex-1 px-4 py-2 ${colors.accent} text-white rounded-lg hover:opacity-90 font-medium transition-all text-sm`}
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => generateBusinessReport({ business: business as any, orders: businessOrders(business as any), summary: data })}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-all text-sm"
                    >
                      <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      PDF
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Unpaid/Pending section */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">Unpaid & Partial Payments</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {(['Travel','Dates','Belts'] as const).map(b => {
              const g = (computedByBusiness.groups as any)[b];
              return (
                <div key={b} className="border rounded-lg p-4">
                  <div className="flex justify-between">
                    <span className="font-semibold">{b}</span>
                    <span className="text-sm text-gray-500">Orders: {g.orderCount}</span>
                  </div>
                  <div className="mt-2 text-sm text-gray-700">Pending: {formatCurrency(g.pending)}</div>
                </div>
              );
            })}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Business</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pending Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders
                  .filter(o => o.paymentStatus !== 'Paid')
                  .map(o => {
                    const pendingAmt = o.paymentStatus === 'Partial' ? o.sellingPrice * 0.5 : o.sellingPrice;
                    return (
                      <tr key={o._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{o.businessType}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{o.orderId}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{o.customerSupplierName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{o.paymentStatus}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-amber-600">{formatCurrency(pendingAmt)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(o.createdAt).toLocaleString()}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">{activeBusiness==='All' ? 'Recent Orders' : `${activeBusiness} Orders`}</h2>
              <div className="flex gap-2">
                {['All','Travel','Dates','Belts'].map(b => (
                  <button
                    key={b}
                    onClick={() => setActiveBusiness(b as any)}
                    className={`px-3 py-1 rounded text-sm ${activeBusiness===b ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Business</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {businessOrders(activeBusiness).slice((page-1)*pageSize, page*pageSize).map((order) => (
                  <tr key={order._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        order.businessType === 'Travel' ? 'bg-blue-100 text-blue-800' :
                        order.businessType === 'Dates' ? 'bg-green-100 text-green-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {order.businessType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.orderId}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{order.productServiceName}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        order.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' :
                        order.paymentStatus === 'Unpaid' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">
                      {formatCurrency(order.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between p-4">
            <div className="text-sm text-gray-600">Page {page} of {Math.max(1, Math.ceil(businessOrders(activeBusiness).length / pageSize))}</div>
            <div className="flex gap-2">
              <button disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1 rounded-md bg-gray-100 disabled:opacity-50">Prev</button>
              <button disabled={page*pageSize>=businessOrders(activeBusiness).length} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 rounded-md bg-gray-100 disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

