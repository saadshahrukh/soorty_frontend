"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import Sidebar from '@/components/Sidebar';

type PriceTier = { label: string; price: number };
type Product = { _id: string; businessType: 'Travel'|'Dates'|'Belts'; name: string; basePrice: number; baseCost?: number; deliveryCharges?: number; stock?: number; priceTiers?: PriceTier[] };

export default function ProductsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [businessType, setBusinessType] = useState<'Dates'|'Travel'|'Belts'>('Dates');
  const [name, setName] = useState('');
  const [basePrice, setBasePrice] = useState<number>(0);
  const [baseCost, setBaseCost] = useState<number>(0);
  const [deliveryCharges, setDeliveryCharges] = useState<number>(0);
  const [stock, setStock] = useState<number>(0);
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    load();
  }, [isAuthenticated, businessType]);

  const load = async (q = '') => {
    setLoading(true);
    try {
      const params: any = { businessType };
      if (q) params.q = q;
      const { data } = await api.get('/products', { params });
      setItems(data);
    } finally { setLoading(false); }
  };

  const addProduct = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/products/${editingId}`, { businessType, name, basePrice, baseCost, deliveryCharges, stock, priceTiers });
        setEditingId(null);
      } else {
        await api.post('/products', { businessType, name, basePrice, baseCost, deliveryCharges, stock, priceTiers });
      }
      setName(''); setBasePrice(0); setBaseCost(0); setDeliveryCharges(0); setStock(0); setPriceTiers([]);
      setShowModal(false);
      await load();
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    await api.delete(`/products/${id}`);
    await load();
  };

  const edit = (p: Product) => {
    setEditingId(p._id);
    setBusinessType(p.businessType);
    setName(p.name);
    setBasePrice(p.basePrice || 0);
    // stored p.baseCost already includes deliveryCharges (server stores baseCost + delivery). When editing, expose baseCost without delivery so server can recompute.
    const del = (p as any).deliveryCharges || 0;
    setBaseCost((p.baseCost || 0) - del);
    setDeliveryCharges(del);
    setStock((p as any).stock || 0);
    setPriceTiers((p as any).priceTiers || []);
    setShowModal(true);
  };

  const adjustStock = async (id: string, delta: number) => {
    try {
      const prod = items.find(x => x._id === id) as any;
      const newStock = Math.max(0, (prod?.stock || 0) + delta);
      await api.put(`/products/${id}`, { stock: newStock });
      await load();
    } catch (e) {
      console.error('Failed to adjust stock', e);
    }
  };

  // Debounced search for products by name
  useEffect(() => {
    let id: any;
    if (!searchTerm) {
      // small delay to avoid double calls when clearing
      id = setTimeout(() => { setIsSearching(false); load(); }, 150);
      return () => clearTimeout(id);
    }
    setIsSearching(true);
    id = setTimeout(async () => {
      try {
        await load(searchTerm);
      } catch (e) {
        console.error('Product search failed', e);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [searchTerm, businessType]);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1">
        <nav className="bg-white border-b sticky top-0 z-50">
          <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">PS</div>
            <button onClick={()=>router.push('/orders')} className="px-3 py-1.5 bg-indigo-600 text-white rounded-md">Orders</button>
          </div>
        </nav>

        <div className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <select value={businessType} onChange={(e)=>setBusinessType(e.target.value as any)} className="px-3 py-2 border rounded-md">
                <option value="Dates">Dates</option>
                <option value="Travel">Travel</option>
                <option value="Belts">Belts</option>
              </select>
              <div className="relative">
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products by name"
                  className="px-3 py-2 border rounded-md w-80"
                />
                {isSearching && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    <svg className="animate-spin h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                  </div>
                )}
              </div>
            </div>

            <div>
              <button onClick={() => { setEditingId(null); setName(''); setBasePrice(0); setBaseCost(0); setDeliveryCharges(0); setShowModal(true); }} className="px-4 py-2 bg-emerald-600 text-white rounded-md">ADD PRODUCT</button>
            </div>
          </div>

          {/* Modal for add/edit product */}
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl p-6">
                <h3 className="text-lg font-semibold mb-4">{editingId ? 'Edit Product' : 'Add Product'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Business</label>
                    <select value={businessType} onChange={(e)=>setBusinessType(e.target.value as any)} className="w-full px-3 py-2 border rounded-md">
                      <option value="Dates">Dates</option>
                      <option value="Travel">Travel</option>
                      <option value="Belts">Belts</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Product Name</label>
                    <input value={name} onChange={(e)=>setName(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Base Price</label>
                    <input type="number" step="0.01" value={basePrice} onChange={(e)=>setBasePrice(parseFloat(e.target.value||'0'))} className="w-full px-3 py-2 border rounded-md" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Stock Quantity</label>
                    <input type="number" step="1" value={stock} onChange={(e)=>setStock(parseInt(e.target.value||'0'))} className="w-full px-3 py-2 border rounded-md" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Base Cost</label>
                    <input type="number" step="0.01" value={baseCost} onChange={(e)=>setBaseCost(parseFloat(e.target.value||'0'))} className="w-full px-3 py-2 border rounded-md" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Charges</label>
                    <input type="number" step="0.01" value={deliveryCharges} onChange={(e)=>setDeliveryCharges(parseFloat(e.target.value||'0'))} className="w-full px-3 py-2 border rounded-md" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Price Tiers</label>
                    <div className="space-y-2">
                      {priceTiers.map((pt, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input className="px-3 py-2 border rounded-md flex-1" value={pt.label} onChange={(e)=> setPriceTiers(prev=> prev.map((x,idx)=> idx===i ? { ...x, label: e.target.value } : x))} placeholder="Label (e.g. Retail, Reseller)" />
                          <input type="number" step="0.01" className="w-36 px-3 py-2 border rounded-md" value={pt.price} onChange={(e)=> setPriceTiers(prev=> prev.map((x,idx)=> idx===i ? { ...x, price: parseFloat(e.target.value||'0') } : x))} />
                          <button onClick={()=> setPriceTiers(prev=> prev.filter((_,idx)=>idx!==i))} className="px-3 py-2 bg-rose-600 text-white rounded-md">Remove</button>
                        </div>
                      ))}
                      <div>
                        <button onClick={()=> setPriceTiers(prev => [...prev, { label: `Tier ${prev.length+1}`, price: basePrice || 0 }])} className="px-3 py-2 bg-indigo-600 text-white rounded-md">Add Price Tier</button>
                        <p className="text-xs text-gray-500 mt-1">Define alternate selling prices for different customer types. Base price is the default.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={() => { setShowModal(false); setEditingId(null); }} className="px-4 py-2 bg-gray-100 rounded-md">Cancel</button>
                  <button onClick={addProduct} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white rounded-md">{saving ? 'Saving...' : (editingId ? 'Update' : 'Save')}</button>
                </div>
              </div>
            </div>
          )}

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Business</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prices</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delivery</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td className="px-6 py-4" colSpan={6}>Loading...</td></tr>
              ) : items.length === 0 ? (
                <tr><td className="px-6 py-4" colSpan={6}>No products</td></tr>
              ) : (
                items.map(p => (
                  <tr key={p._id}>
                    <td className="px-6 py-4 text-sm">{p.name}</td>
                    <td className="px-6 py-4 text-sm">{p.businessType}</td>
                    <td className="px-6 py-4 text-sm">{p.basePrice}</td>
                    <td className="px-6 py-4 text-sm">
                      {(p as any).priceTiers && (p as any).priceTiers.length > 0 ? (
                        <div className="flex flex-col">
                          {(p as any).priceTiers.map((pt: PriceTier, i: number) => (
                            <span key={i} className="text-xs text-gray-600">{pt.label}: {pt.price}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded ${((p as any).stock || 0) > 0 ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-800'}`}>{(p as any).stock || 0}</span>
                        <div className="flex gap-1">
                          <button onClick={()=>adjustStock(p._id, 1)} className="px-2 py-1 bg-gray-100 rounded">+</button>
                          <button onClick={()=>adjustStock(p._id, -1)} className="px-2 py-1 bg-gray-100 rounded">-</button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">{p.baseCost || 0}</td>
                    <td className="px-6 py-4 text-sm">{(p as any).deliveryCharges || 0}</td>
                    <td className="px-6 py-4 text-sm">
                      <button onClick={()=>edit(p)} className="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
                      <button onClick={()=>remove(p._id)} className="text-rose-600 hover:text-rose-800">Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </div>
  );
}


