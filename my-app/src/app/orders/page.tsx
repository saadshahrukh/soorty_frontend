 'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Sidebar from '@/components/Sidebar';
import { useOrderStore, Order } from '@/store/orderStore';
import { generateOrdersReport } from '@/lib/pdf';
import FiltersSection from './components/FiltersSection';
import OrdersTable from "@/app/orders/components/OrdersTable";
import OrderFormModal from './components/OrderFormModal';
import DeleteModal from './components/DeleteModal';
import HeaderActions from './components/HeaderActions';
import api from '@/lib/api';

type BusinessType = 'Travel' | 'Dates' | 'Belts';
 export type FormData = {
  businessType: BusinessType;
  orderId: string;
  orderType: 'Retail' | 'Shopify' | 'Preorder' | 'Wholesale' | 'Service';
  // For multi-product support (preferred)
  products?: Array<{
    productId: string;
    name: string;
    quantity: number;
    basePrice: number;
    baseCost?: number;
    sellingPrice: number;
    costPrice: number;
    discount?: number;
  }>;
    warehouseId?: string;
  // Backwards-compatible single-product fields
  productServiceName: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  taxPercent: number;
  deliveryCharge?: number;
  deliveryPaidByCustomer?: boolean;
  orderDiscount?: number;
  partialPaidAmount: number;
  partialRemainingAmount: number;
  paymentStatus: 'Paid' | 'Unpaid' | 'Partial';
  paymentMethod: 'Cash' | 'Bank' | 'JazzCash' | 'Online';
  // Client info (phone lookup will populate name/address)
  clientPhone?: string;
  clientName?: string;
  clientAddress?: string;
  customerSupplierName: string;
  remarks: string;
};

export default function OrdersPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [logsCount, setLogsCount] = useState(0);
  const { orders, fetchOrders, createOrder, updateOrder, deleteOrder, loading } = useOrderStore();
  
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<any>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'All'|'Paid'|'Unpaid'|'Partial'>('All');
  const [businessTypeFilter, setBusinessTypeFilter] = useState<'All'|'Travel'|'Dates'|'Belts'>('All');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const generateId = () => String(Math.floor(10000 + Math.random() * 90000));

  const [formData, setFormData] = useState<FormData>({
    businessType: 'Travel',
    orderId: '',
    orderType: 'Retail',
    productServiceName: '',
    products: [],
    quantity: 0,
    costPrice: 0,
    sellingPrice: 0,
    taxPercent: 0,
    partialPaidAmount: 0,
    partialRemainingAmount: 0,
    paymentStatus: 'Unpaid',
    paymentMethod: 'Cash',
    clientPhone: '',
    clientName: '',
    clientAddress: '',
    deliveryCharge: 0,
    deliveryPaidByCustomer: true,
    orderDiscount: 0,
    customerSupplierName: '',
    remarks: '',
    warehouseId: ''
  });

  // Delete-by-filter modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [delStart, setDelStart] = useState('');
  const [delEnd, setDelEnd] = useState('');
  const [delBusiness, setDelBusiness] = useState<'All'|'Travel'|'Dates'|'Belts'>('All');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    } else {
      fetchOrders();
    }
  }, [isAuthenticated]);

  // Refresh orders when a Shopify import completes elsewhere in the app
  useEffect(() => {
    const handler = (e: any) => {
      // optionally inspect e.detail for more info
      fetchOrders();
      // show a friendly toast
      try { const { toast } = require('@/store/toastStore'); toast.success('Orders refreshed after Shopify import'); } catch {}
    };
    window.addEventListener('shopify:imported', handler as EventListener);
    return () => window.removeEventListener('shopify:imported', handler as EventListener);
  }, []);

  // Debounced suggestions for orderId (Bill No)
  useEffect(() => {
    let id: any;
    if (searchTerm === '') {
      // clear search -> refetch default
      id = setTimeout(() => {
        fetchOrders();
        setIsSearching(false);
        setSuggestions([]);
        setShowSuggestions(false);
      }, 200);
      return () => clearTimeout(id);
    }

    setIsSearching(true);
    id = setTimeout(async () => {
      try {
        const { data } = await api.get('/orders/search', { params: { q: searchTerm, limit: 10 } });
        setSuggestions(data || []);
        setShowSuggestions(true);
        setHighlightedIndex(-1);
      } catch (e) {
        console.error('Suggestion fetch failed', e);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(id);
  }, [searchTerm]);

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

  useEffect(() => {
    // Auto-generate ID when opening form for new order
    if (showForm && !editingOrder && !formData.orderId) {
      setFormData(prev => ({ ...prev, orderId: generateId() }));
    }
  }, [showForm, editingOrder]);

  const applyFilters = async () => {
    const params: any = {};
    if (startDate) params.startDate = new Date(startDate).toISOString();
    if (endDate) params.endDate = new Date(endDate).toISOString();
    if (paymentStatusFilter !== 'All') params.paymentStatus = paymentStatusFilter;
    if (businessTypeFilter !== 'All') params.businessType = businessTypeFilter;
    await fetchOrders(params);
    setPage(1);
  };

  const clearDeleteFilters = () => {
    setDelStart('');
    setDelEnd('');
    setDelBusiness('All');
  };

  const deleteByFilter = async () => {
    setDeleting(true);
    try {
      const payload: any = {};
      if (delStart) payload.startDate = new Date(delStart).toISOString();
      if (delEnd) payload.endDate = new Date(delEnd).toISOString();
      if (delBusiness !== 'All') payload.businessType = delBusiness;
      await api.delete('/orders/bulk', { data: payload });
      setShowDeleteModal(false);
      clearDeleteFilters();
      await applyFilters();
    } catch (e) {
      console.error('Bulk delete failed', e);
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Prepare payload: prefer products array if present
      const payload: any = { ...formData };
      
      // CRITICAL: Add userId from authenticated user
      if (user && user.id) {
        payload.userId = user.id;
      } else {
        throw new Error('User not authenticated');
      }
      
      if (formData.products && formData.products.length > 0) {
        // Ensure numeric values and remove client transient fields
        payload.products = formData.products.map(p => ({
          productId: p.productId,
          name: p.name,
          quantity: Number(p.quantity),
          basePrice: Number(p.basePrice),
          baseCost: Number(p.baseCost || 0),
          sellingPrice: Number(p.sellingPrice),
          costPrice: Number(p.costPrice),
          discount: Number(p.discount || 0)
        }));
        // keep sellingPrice/costPrice totals for backwards compatibility
        payload.sellingPrice = Number(formData.sellingPrice || 0);
        payload.costPrice = Number(formData.costPrice || 0);
        // Provide a human-friendly productServiceName for legacy fields and validations
        payload.productServiceName = formData.products.map(p => p.name).join(', ');
      }
      // Ensure customerSupplierName is present (backend requires it)
      if (!payload.customerSupplierName) payload.customerSupplierName = formData.clientName || formData.customerSupplierName || '';

      // If clientPhone provided, ensure a Customer exists: lookup by phone, create if missing
      if (formData.clientPhone) {
        try {
          const { data: existing } = await api.get('/customers', { params: { phone: formData.clientPhone } });
          if (existing && existing.name) {
            payload.customerSupplierName = existing.name;
          }
        } catch (e) {
          // Not found -> create customer record before creating order
          try {
            const createPayload = {
              name: formData.clientName || payload.customerSupplierName || 'Unknown',
              phone: formData.clientPhone,
              address: formData.clientAddress || ''
            };
            const { data: created } = await api.post('/customers', createPayload);
            if (created && created.name) payload.customerSupplierName = created.name;
          } catch (ce) {
            // swallow customer create errors but continue to create order (backend will still validate required fields)
            console.error('Customer create failed', ce);
          }
        }
      }

        // persist customer contact fields on the order so slips can use them
        if (formData.clientPhone) payload.customerPhone = formData.clientPhone;
        if (formData.clientAddress) payload.customerAddress = formData.clientAddress;
    // persist one-time delivery charge and who pays it
    if (formData.deliveryCharge) payload.deliveryCharge = Number(formData.deliveryCharge || 0);
    payload.deliveryPaidByCustomer = formData.deliveryPaidByCustomer !== undefined ? Boolean(formData.deliveryPaidByCustomer) : true;
  // persist order-level discount
  payload.orderDiscount = Number(formData.orderDiscount || 0);

      // If products array present, ensure totals and total quantity are computed now (avoid stale state)
      if (payload.products && payload.products.length > 0) {
        const totalSelling = payload.products.reduce((s: number, p: any) => s + (Number(p.sellingPrice || p.basePrice || 0) * Number(p.quantity || 0)), 0);
        const totalCost = payload.products.reduce((s: number, p: any) => s + (Number(p.costPrice || p.baseCost || 0) * Number(p.quantity || 0)), 0);
        const totalQty = payload.products.reduce((s: number, p: any) => s + Number(p.quantity || 0), 0);
        payload.sellingPrice = Math.round(totalSelling * 100) / 100;
        payload.costPrice = Math.round(totalCost * 100) / 100;
        payload.quantity = totalQty;
      }

      if (editingOrder) {
        await updateOrder(editingOrder._id, payload);
      } else {
        await createOrder(payload);
      }
      
      setShowForm(false);
      setEditingOrder(null);
      setFormData({
        businessType: 'Travel',
        orderId: '',
        orderType: 'Retail',
        productServiceName: '',
        products: [],
        quantity: 0,
        costPrice: 0,
        sellingPrice: 0,
        taxPercent: 0,
        partialPaidAmount: 0,
        partialRemainingAmount: 0,
        paymentStatus: 'Unpaid',
        paymentMethod: 'Cash',
        clientPhone: '',
        clientName: '',
        clientAddress: '',
        customerSupplierName: '',
        orderDiscount: 0,
        remarks: ''
      });
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setFormData({
      businessType: order.businessType,
      orderId: order.orderId,
      orderType: order.orderType,
      productServiceName: order.productServiceName || '',
      products: (order as any).products && (order as any).products.length > 0 ? (order as any).products.map((p: any) => ({
        productId: p.productId || p._id || '',
        name: p.name,
        quantity: p.quantity,
        basePrice: p.basePrice,
        baseCost: p.baseCost || 0,
        sellingPrice: p.sellingPrice,
        costPrice: p.costPrice,
        discount: p.discount || 0
      })) : [],
      quantity: order.quantity || 0,
      costPrice: order.costPrice || 0,
      sellingPrice: order.sellingPrice || 0,
      taxPercent: (order as any).taxPercent || 0,
      partialPaidAmount: (order as any).partialPaidAmount || 0,
      partialRemainingAmount: (order as any).partialRemainingAmount || 0,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      clientPhone: (order as any).clientPhone || '',
      clientName: order.customerSupplierName || '',
      clientAddress: (order as any).clientAddress || '',
      deliveryCharge: (order as any).deliveryCharge || 0,
      deliveryPaidByCustomer: (order as any).deliveryPaidByCustomer !== undefined ? Boolean((order as any).deliveryPaidByCustomer) : true,
      orderDiscount: (order as any).orderDiscount || 0,
      customerSupplierName: order.customerSupplierName,
      remarks: order.remarks
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this order?')) {
      await deleteOrder(id);
    }
  };

  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setPaymentStatusFilter('All');
    setBusinessTypeFilter('All');
    fetchOrders();
  };

  const openAddOrderForm = () => {
    setShowForm(!showForm);
    setEditingOrder(null);
    setFormData({
      businessType: 'Travel',
      orderId: '',
      orderType: 'Retail',
      productServiceName: '',
      products: [],
      quantity: 0,
      costPrice: 0,
      sellingPrice: 0,
      taxPercent: 0,
      partialPaidAmount: 0,
      partialRemainingAmount: 0,
      paymentStatus: 'Unpaid',
      paymentMethod: 'Cash',
      clientPhone: '',
      clientName: '',
      clientAddress: '',
      customerSupplierName: '',
      remarks: ''
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isAdmin={user?.role==='Admin'} />
      <div className="flex-1">
        <nav className="bg-white border-b sticky top-0 z-50">
          <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">BD</div>
            <button onClick={logout} className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700">Sign out</button>
          </div>
        </nav>

        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <FiltersSection
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            businessTypeFilter={businessTypeFilter}
            setBusinessTypeFilter={setBusinessTypeFilter}
            paymentStatusFilter={paymentStatusFilter}
            setPaymentStatusFilter={setPaymentStatusFilter}
            applyFilters={applyFilters}
            resetFilters={resetFilters}
          />

          {/* Search bar and loader */}
          <div className="mt-4 mb-4 flex items-center gap-3">
            <div className="relative flex-1">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  // Keyboard navigation for suggestions and Enter to trigger selection/search
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightedIndex(i => Math.min((suggestions.length - 1), (i + 1)));
                    setShowSuggestions(true);
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightedIndex(i => Math.max(-1, (i - 1)));
                    return;
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                      const s = suggestions[highlightedIndex];
                      setSearchTerm(s.orderId);
                      setShowSuggestions(false);
                      fetchOrders({ orderId: s.orderId });
                    } else {
                      // No suggestion selected -> perform search by orderId
                      setShowSuggestions(false);
                      fetchOrders({ orderId: searchTerm });
                    }
                  }
                }}
                onBlur={() => {
                  // small delay to allow click selection
                  setTimeout(() => setShowSuggestions(false), 150);
                }}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                placeholder="Search by Bill No / Order ID"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {isSearching && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  <svg className="animate-spin h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                </div>
              )}

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-40 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow max-h-60 overflow-auto">
                  {suggestions.map((s, idx) => (
                    <li
                      key={s._id}
                      onMouseDown={(ev) => { ev.preventDefault(); /* prevent blur */ }}
                      onClick={() => { setSearchTerm(s.orderId); setShowSuggestions(false); fetchOrders({ orderId: s.orderId }); }}
                      className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${idx === highlightedIndex ? 'bg-indigo-50' : ''}`}
                    >
                      <div className="text-sm font-medium">{s.orderId}</div>
                      <div className="text-xs text-gray-500">{s.customerSupplierName || (s.customer && s.customer.name) || s.customerPhone || ''}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={() => { setSearchTerm(''); setSuggestions([]); fetchOrders(); }}
              className="px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Clear
            </button>
          </div>

          <HeaderActions
            showForm={showForm}
            openAddOrderForm={openAddOrderForm}
            generateOrdersReport={() => generateOrdersReport(orders, 'All Orders Report')}
            router={router}
            user={user}
            setShowDeleteModal={setShowDeleteModal}
          />

          <OrderFormModal
            showForm={showForm}
            setShowForm={setShowForm}
            editingOrder={editingOrder}
            formData={formData}
            setFormData={setFormData}
            handleSubmit={handleSubmit}
          />

          {/* Full-screen loader overlay when fetching large data sets or initial load */}
          {loading && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 border-4 border-t-indigo-500 border-gray-200 rounded-full animate-spin mb-4"></div>
                <div className="text-lg font-medium text-gray-700">Loading orders...</div>
                <div className="text-sm text-gray-500">This may take a moment if the dataset is large.</div>
              </div>
            </div>
          )}

          <OrdersTable
            orders={orders}
            page={page}
            pageSize={pageSize}
            user={user}
            handleEdit={handleEdit}
            handleDelete={handleDelete}
          />

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">Page {page} of {Math.max(1, Math.ceil(orders.length / pageSize))}</div>
            <div className="flex gap-2">
              <button disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1 rounded-md bg-gray-100 disabled:opacity-50">Prev</button>
              <button disabled={page*pageSize>=orders.length} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 rounded-md bg-gray-100 disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      </div>

      <DeleteModal
        showDeleteModal={showDeleteModal}
        setShowDeleteModal={setShowDeleteModal}
        delStart={delStart}
        setDelStart={setDelStart}
        delEnd={delEnd}
        setDelEnd={setDelEnd}
        delBusiness={delBusiness}
        setDelBusiness={setDelBusiness}
        deleting={deleting}
        clearDeleteFilters={clearDeleteFilters}
        deleteByFilter={deleteByFilter}
      />
    </div>
  );
}