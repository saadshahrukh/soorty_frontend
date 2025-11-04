import { useState } from 'react';

interface FiltersSectionProps {
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  businessTypeFilter: string;
  setBusinessTypeFilter: (type: any) => void;
  paymentStatusFilter: string;
  setPaymentStatusFilter: (status: any) => void;
  applyFilters: () => void;
  resetFilters: () => void;
}

export default function FiltersSection({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  businessTypeFilter,
  setBusinessTypeFilter,
  paymentStatusFilter,
  setPaymentStatusFilter,
  applyFilters,
  resetFilters
}: FiltersSectionProps) {
  const [minRemaining, setMinRemaining] = useState('');
  const [maxRemaining, setMaxRemaining] = useState('');

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3 md:items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
          <input 
            type="datetime-local" 
            value={startDate} 
            onChange={(e)=>setStartDate(e.target.value)} 
            className="w-full px-3 py-2 border rounded-md" 
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
          <input 
            type="datetime-local" 
            value={endDate} 
            onChange={(e)=>setEndDate(e.target.value)} 
            className="w-full px-3 py-2 border rounded-md" 
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Business</label>
          <select 
            value={businessTypeFilter} 
            onChange={(e)=>setBusinessTypeFilter(e.target.value as any)} 
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="All">All</option>
            <option value="Travel">Travel</option>
            <option value="Dates">Dates</option>
            <option value="Belts">Belts</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Payment Status</label>
          <select 
            value={paymentStatusFilter} 
            onChange={(e)=>setPaymentStatusFilter(e.target.value as any)} 
            className="w-full px-3 py-2 border rounded-md"
          >
            <option value="All">All</option>
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partial">Partial</option>
          </select>
        </div>
        {paymentStatusFilter === 'Partial' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Min Remaining</label>
              <input 
                value={minRemaining}
                onChange={(e)=>setMinRemaining(e.target.value)}
                type="number" 
                step="0.01" 
                className="w-full px-3 py-2 border rounded-md" 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Remaining</label>
              <input 
                value={maxRemaining}
                onChange={(e)=>setMaxRemaining(e.target.value)}
                type="number" 
                step="0.01" 
                className="w-full px-3 py-2 border rounded-md" 
              />
            </div>
          </>
        )}
        <div className="flex gap-2">
          <button 
            onClick={applyFilters} 
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Apply
          </button>
          <button 
            onClick={resetFilters} 
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}