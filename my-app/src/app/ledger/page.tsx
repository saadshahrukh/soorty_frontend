"use client";
import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';

export default function LedgerPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [expenses, setExpenses] = useState<any>({});

  const load = async () => {
    try {
      const params: any = {};
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) params.endDate = new Date(endDate).toISOString();
      const s = await api.get('/summary/range', { params });
      setSummary(s.data);
      const e = await api.get('/expenses/totals', { params });
      setExpenses(e.data || {});
    } catch (e) {
      console.error('Ledger load failed', e);
    }
  };

  useEffect(()=>{ load(); }, []);

  const businessTypes = ['Travel','Dates','Belts'];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isAdmin={true} />
      <div className="flex-1 p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Ledger</h1>
        <div className="bg-white p-4 rounded shadow mb-4 flex gap-2 items-end">
          <div>
            <label className="text-xs">Start</label>
            <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="px-2 py-1 border rounded" />
          </div>
          <div>
            <label className="text-xs">End</label>
            <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="px-2 py-1 border rounded" />
          </div>
          <div>
            <button onClick={load} className="px-4 py-2 bg-indigo-600 text-white rounded">Filter</button>
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-3">Ledger Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            {businessTypes.map(b => {
              const exp = Number(expenses[b] || 0);
              const prof = Number(summary?.profit || 0); // overall profit if range used
              return (
                <div key={b} className="p-3 border rounded">
                  <div className="text-xs text-gray-500">{b}</div>
                  <div className="font-medium mt-2">Expenses: {exp.toFixed(2)}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <h4 className="font-semibold">Adjusted Totals</h4>
            <div className="grid grid-cols-4 gap-4 mt-2">
              <div className="p-3 border rounded">
                <div className="text-xs text-gray-500">Sales</div>
                <div className="font-medium">{Number(summary?.sales||0).toFixed(2)}</div>
              </div>
              <div className="p-3 border rounded">
                <div className="text-xs text-gray-500">Cost</div>
                <div className="font-medium">{Number(summary?.cost||0).toFixed(2)}</div>
              </div>
              <div className="p-3 border rounded">
                <div className="text-xs text-gray-500">Profit</div>
                <div className="font-medium">{Number(summary?.profit||0).toFixed(2)}</div>
              </div>
              <div className="p-3 border rounded">
                  <div className="text-xs text-gray-500">Expenses Total</div>
                  <div className="font-medium">{(Object.values(expenses as Record<string, number> || {}).reduce((s:number,v:number)=>s+Number(v||0),0)).toFixed(2)}</div>
                </div>
            </div>
            <div className="mt-3">Adjusted Profit = Profit - Expenses</div>
            <div className="mt-2 font-semibold">{(Number(summary?.profit||0) - (Object.values(expenses as Record<string, number> || {}).reduce((s:number,v:number)=>s+Number(v||0),0))).toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
