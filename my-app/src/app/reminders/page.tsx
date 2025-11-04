"use client";
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import Sidebar from '@/components/Sidebar';

type Order = {
  _id: string;
  orderId: string;
  productServiceName: string;
  paymentStatus: 'Paid'|'Unpaid'|'Partial';
  partialRemainingAmount?: number;
  sellingPrice: number;
  createdAt: string;
  businessType: string;
};

const THRESHOLD_MS = 60_000; // 1 minute (testing)

export default function RemindersPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    load();
  }, [isAuthenticated]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders');
      setOrders(data);
    } finally { setLoading(false); }
  };

  const reminders = useMemo(() => {
    const now = Date.now();
    return orders.filter(o => o.paymentStatus !== 'Paid' && (now - new Date(o.createdAt).getTime() >= THRESHOLD_MS));
  }, [orders]);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isAdmin={true} />
      <div className="flex-1">
        <nav className="bg-white border-b sticky top-0 z-50">
          <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">PS</div>
            <button onClick={()=>router.push('/orders')} className="px-3 py-1.5 bg-indigo-600 text-white rounded-md">Orders</button>
          </div>
        </nav>

        <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-4 mb-6 flex items-center justify-between">
          <div className="text-gray-700">Showing unpaid/partial orders older than 1 minute (testing)</div>
          <button onClick={load} className="px-4 py-2 bg-indigo-600 text-white rounded-md">Refresh</button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">When</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Business</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pending Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td className="px-6 py-4" colSpan={6}>Loading...</td></tr>
              ) : reminders.length === 0 ? (
                <tr><td className="px-6 py-4" colSpan={6}>No reminders</td></tr>
              ) : (
                reminders.map(o => {
                  const pendingAmt = o.paymentStatus === 'Partial' ? (o.partialRemainingAmount ?? o.sellingPrice * 0.5) : o.sellingPrice;
                  return (
                    <tr key={o._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(o.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{o.businessType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{o.orderId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{o.productServiceName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{o.paymentStatus}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-amber-600">{pendingAmt}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </div>
  );
}


