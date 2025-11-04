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

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/customers', { params: { q: q || undefined, page: customersPage, limit: customersLimit } });
        // API returns { items, total, page, pages }
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

  const fetchOrdersForCustomer = async (cust: any, page = 1) => {
    // Set selected to a stable minimal customer object to avoid stale references
    const selectedCust = { ...cust };
    setSelected(selectedCust);
    setLoading(true);
    try {
      const params: any = { page, limit: ordersLimit };
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) params.endDate = new Date(endDate).toISOString();
      // Send both id and phone (fallbacks) to be robust against different shapes
      if (cust._id) params.customerId = String(cust._id);
      else if (cust.id) params.customerId = String(cust.id);
      if (cust.phone) params.customerPhone = String(cust.phone);
      // Debug: log params to help trace incorrect filtering during testing
      // eslint-disable-next-line no-console
      console.debug('Fetching orders for customer params:', params);
      const { data } = await api.get('/orders', { params });
      // eslint-disable-next-line no-console
      console.debug('Orders response for customer', cust && (cust._id || cust.id || cust.phone), data);
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

  const generatePdf = () => {
    if (!selected) return;
    // Use existing generateCustomerReport in lib/pdf
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
      <div className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Customers</h1>
          <div className="flex gap-4 mb-4">
            <input className="flex-1 px-3 py-2 border rounded" placeholder="Search customer name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="px-4 py-2 bg-indigo-600 text-white rounded" onClick={() => setQ('')}>Clear</button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1 bg-white p-4 rounded shadow">
              <h3 className="font-semibold mb-2">Customers</h3>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {customers.map(c => (
                  <div key={c._id} className={`p-2 border rounded cursor-pointer ${selected && selected._id === c._id ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-indigo-50'}`} onClick={() => loadOrders(c)}>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.phone}</div>
                  </div>
                ))}
                {customers.length === 0 && <div className="text-sm text-gray-500">No customers</div>}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-gray-600">Showing page {customersPage} of {customersPages} — {customersTotal} customers</div>
                <div className="flex items-center gap-2">
                  <select className="px-2 py-1 border rounded" value={customersLimit} onChange={(e)=>{ setCustomersLimit(Number(e.target.value)); setCustomersPage(1); }}>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <button className="px-2 py-1 border rounded" disabled={customersPage<=1} onClick={()=>setCustomersPage(customersPage-1)}>Prev</button>
                  <button className="px-2 py-1 border rounded" disabled={customersPage>=customersPages} onClick={()=>setCustomersPage(customersPage+1)}>Next</button>
                </div>
              </div>
            </div>

            <div className="col-span-2 bg-white p-4 rounded shadow">
              {!selected ? (
                <div className="text-gray-500">Select a customer to view orders</div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold">{selected.name}</h2>
                      <div className="text-sm text-gray-500">{selected.phone} • {selected.address}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-1 border rounded" />
                      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2 py-1 border rounded" />
                      <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={() => selected && fetchOrdersForCustomer(selected,1)}>Filter</button>
                      <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={generatePdf}>Generate PDF</button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500">
                          <th className="p-2">Bill No</th>
                          <th className="p-2">Date</th>
                          <th className="p-2">Items</th>
                          <th className="p-2">Amount</th>
                          <th className="p-2">Paid</th>
                          <th className="p-2">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading && <tr><td colSpan={6} className="p-4">Loading...</td></tr>}
                        {!loading && orders.map(o => (
                          <tr key={o._id} className="border-t">
                            <td className="p-2 font-medium">{o.orderId}</td>
                            <td className="p-2">{new Date(o.createdAt).toLocaleDateString()}</td>
                            <td className="p-2">{(o.products && o.products.length > 0) ? o.products.map((p:any)=>p.name).join(', ') : o.productServiceName}</td>
                            <td className="p-2">{Number(o.finalAmount || 0).toFixed(2)}</td>
                            <td className="p-2">{o.paymentStatus === 'Paid' ? (Number(o.finalAmount||0).toFixed(2)) : (o.paymentStatus==='Partial' ? Number(o.partialPaidAmount||0).toFixed(2) : '0.00')}</td>
                            <td className="p-2">{Number(o.partialRemainingAmount || (o.paymentStatus==='Paid' ? 0 : o.finalAmount||0)).toFixed(2)}</td>
                          </tr>
                        ))}
                        {!loading && orders.length === 0 && <tr><td colSpan={6} className="p-4 text-sm text-gray-500">No orders for this customer in selected period.</td></tr>}
                      </tbody>
                    </table>
                  </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-sm text-gray-600">Showing {orders.length} of {ordersTotal} orders — page {ordersPage} / {ordersPages}</div>
                      <div className="flex items-center gap-2">
                        <select className="px-2 py-1 border rounded" value={ordersLimit} onChange={(e)=>{ setOrdersLimit(Number(e.target.value)); if (selected) fetchOrdersForCustomer(selected,1); }}>
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                        <button className="px-2 py-1 border rounded" disabled={ordersPage<=1} onClick={()=>goToOrdersPage(ordersPage-1)}>Prev</button>
                        <button className="px-2 py-1 border rounded" disabled={ordersPage>=ordersPages} onClick={()=>goToOrdersPage(ordersPage+1)}>Next</button>
                      </div>
                    </div>

                  <div className="mt-4 p-3 bg-gray-50 rounded">
                    <h4 className="font-semibold">Summary</h4>
                    <div className="grid grid-cols-4 gap-4 mt-2">
                      {Object.entries(computeSummary(orders)).map(([k,v]) => (
                        <div key={k} className="text-sm">
                          <div className="text-xs text-gray-500 uppercase">{k}</div>
                          <div className="font-medium">{typeof v === 'number' ? v.toFixed ? v.toFixed(2) : String(v) : String(v)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
