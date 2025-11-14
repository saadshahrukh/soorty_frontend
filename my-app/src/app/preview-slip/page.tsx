"use client";
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { generateOrderSlip } from '@/lib/pdf';
import { toast } from '@/store/toastStore';
import api from '@/lib/api';

export default function PreviewSlipPage() {
  const [business, setBusiness] = useState<'Dates'|'Travel'|'Belts'>('Dates');
  const [orderId, setOrderId] = useState('');
  const [customerName, setCustomerName] = useState('Demo Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  const [deliveryPaidByCustomer, setDeliveryPaidByCustomer] = useState<boolean>(true);
  const [paymentStatus, setPaymentStatus] = useState<'Pending'|'Paid'|'Partial'>('Pending');
  const [partialPaidAmount, setPartialPaidAmount] = useState<number>(0);

  const [products, setProducts] = useState<Array<any>>([
    { name: 'Sample Item', sellingPrice: 1000, costPrice: 700, quantity: 1, discount: 0 }
  ]);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (productQuery && business === 'Dates') {
        try {
          const { data } = await api.get('/products', { params: { businessType: 'Dates', q: productQuery } });
          if (!cancelled) setProductResults(data || []);
        } catch (err) {
          console.error('Product search failed', err);
        }
      } else {
        setProductResults([]);
      }
    };
    const t = window.setTimeout(load, 250);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [productQuery, business]);

  const lookupCustomerByPhone = async (phone: string) => {
    if (!phone) return;
    try {
      const { data } = await api.get('/customers', { params: { phone } });
      if (data) {
        setCustomerName(data.name || '');
        setCustomerAddress(data.address || '');
        setCustomerPhone(data.phone || phone);
      }
    } catch (err) {
      // ignore - not found
      setCustomerPhone(phone);
      setCustomerName('');
      setCustomerAddress('');
    }
  };

  const addProduct = () => setProducts(prev => [...prev, { name: '', sellingPrice: 0, costPrice: 0, quantity: 1, discount: 0 }]);
  const updateProduct = (idx: number, patch: Partial<any>) => setProducts(prev => prev.map((p,i) => i===idx ? { ...p, ...patch } : p));
  const removeProduct = (idx: number) => setProducts(prev => prev.filter((_,i)=>i!==idx));

  const previewSlip = async () => {
    if (products.length === 0) { toast.error('Add at least one product'); return; }
    setIsGenerating(true);
    toast.info('Generating bill...');

    const order: any = {
      orderId: (orderId && String(orderId).trim()) || String(Date.now()),
      businessType: business,
      products: products.map(p=>({ name: p.name || 'Item', sellingPrice: Number(p.sellingPrice||0), costPrice: Number(p.costPrice||0), quantity: Number(p.quantity||1), discount: Number(p.discount||0) })),
      customerName,
      customerPhone,
      customerAddress,
      taxPercent: taxPercent || 0,
      deliveryCharge: Number(deliveryCharge || 0),
      deliveryPaidByCustomer,
      paymentStatus,
      partialPaidAmount: Number(partialPaidAmount || 0),
      createdAt: new Date().toISOString()
    };

    try {
      await generateOrderSlip(order);
      toast.success('Slip generated (preview)');
      // reset form to defaults after successful generation
      setOrderId('');
      setBusiness('Dates');
      setCustomerName('Demo Customer');
      setCustomerPhone('');
      setCustomerAddress('');
      setTaxPercent(0);
      setDeliveryCharge(0);
      setDeliveryPaidByCustomer(true);
      setPaymentStatus('Pending');
      setPartialPaidAmount(0);
      setProducts([{ name: 'Sample Item', sellingPrice: 1000, costPrice: 700, quantity: 1, discount: 0 }]);
      setProductQuery('');
      setProductResults([]);
    } catch (err) {
      console.error('Preview slip failed', err);
      toast.error('Failed to generate slip');
    }
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isAdmin={true} />
      <div className="flex-1 p-6 max-w-4xl mx-auto">
  <h1 className="text-2xl font-bold mb-4">Preview Slip</h1>

        <div className="bg-white p-4 rounded shadow mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600">Business</label>
              <select value={business} onChange={(e)=>setBusiness(e.target.value as any)} className="w-full px-3 py-2 border rounded">
                <option value="Dates">Dates</option>
                <option value="Travel">Travel</option>
                <option value="Belts">Belts</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Tax (%)</label>
              <input type="number" value={taxPercent} onChange={(e)=>setTaxPercent(Number(e.target.value))} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Delivery Charge</label>
              <input type="number" value={deliveryCharge} onChange={(e)=>setDeliveryCharge(Number(e.target.value))} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Delivery Paid By Customer</label>
              <select value={String(deliveryPaidByCustomer)} onChange={(e)=>setDeliveryPaidByCustomer(e.target.value==='true')} className="w-full px-3 py-2 border rounded">
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow mb-4">
          <h3 className="font-semibold mb-2">Customer</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input placeholder="Bill No (optional)" value={orderId} onChange={(e)=>setOrderId(e.target.value)} className="px-3 py-2 border rounded" />
            <input placeholder="Customer name" value={customerName} onChange={(e)=>setCustomerName(e.target.value)} className="px-3 py-2 border rounded" />
            <input placeholder="Phone" value={customerPhone} onChange={(e)=>setCustomerPhone(e.target.value)} onBlur={(e)=>lookupCustomerByPhone(e.target.value)} className="px-3 py-2 border rounded" />
            <input placeholder="Address" value={customerAddress} onChange={(e)=>setCustomerAddress(e.target.value)} className="px-3 py-2 border rounded col-span-1 sm:col-span-3" />
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Products</h3>
            <button onClick={addProduct} className="px-2 py-1 bg-indigo-600 text-white rounded">Add Product</button>
          </div>

          <div className="mb-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search product..."
                value={productQuery}
                onChange={(e)=>setProductQuery(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              />
              {productQuery && productResults.length > 0 && (
                <div className="absolute left-0 right-0 bg-white border mt-1 rounded shadow max-h-56 overflow-auto z-50">
                  {productResults.map((pr:any)=> (
                    <div key={pr._id} className="px-3 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between" onClick={()=>{
                      // add product to list
                      setProducts(prev=>[...prev, { name: pr.name, sellingPrice: pr.basePrice, costPrice: pr.baseCost || 0, quantity: 1, discount: 0 }]);
                      setProductQuery('');
                      setProductResults([]);
                    }}>{pr.name}<span className="text-xs text-gray-500">{pr.basePrice}</span></div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {products.map((p, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input placeholder="Name" value={p.name} onChange={(e)=>updateProduct(idx, { name: e.target.value })} className="sm:col-span-5 px-2 py-2 border rounded min-w-0" />
                <input placeholder="Price" type="number" value={p.sellingPrice} onChange={(e)=>updateProduct(idx, { sellingPrice: Number(e.target.value) })} className="sm:col-span-2 px-2 py-2 border rounded" />
                <input placeholder="Cost" type="number" value={p.costPrice} onChange={(e)=>updateProduct(idx, { costPrice: Number(e.target.value) })} className="sm:col-span-2 px-2 py-2 border rounded" />
                <input placeholder="Qty" type="number" value={p.quantity} onChange={(e)=>updateProduct(idx, { quantity: Number(e.target.value) })} className="sm:col-span-1 px-2 py-2 border rounded" />
                <input placeholder="Disc" type="number" value={p.discount} onChange={(e)=>updateProduct(idx, { discount: Number(e.target.value) })} className="sm:col-span-1 px-2 py-2 border rounded" />
                <div className="sm:col-span-1 flex gap-2">
                  <button onClick={()=>removeProduct(idx)} className="px-2 py-1 bg-red-600 text-white rounded">Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-600">Payment Status</label>
              <select value={paymentStatus} onChange={(e)=>setPaymentStatus(e.target.value as any)} className="w-full px-3 py-2 border rounded">
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
                <option value="Partial">Partial</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600">Partial Paid Amount</label>
              <input type="number" value={partialPaidAmount} onChange={(e)=>setPartialPaidAmount(Number(e.target.value))} className="w-full px-3 py-2 border rounded" />
            </div>
            <div className="flex items-end justify-end">
              <button onClick={previewSlip} className="px-4 py-2 bg-emerald-600 text-white rounded">Generate Preview Slip</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
