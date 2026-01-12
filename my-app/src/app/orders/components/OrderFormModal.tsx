import { useState, useEffect } from 'react';
import { Order } from '@/store/orderStore';
import api from '@/lib/api';
import { toast } from '@/store/toastStore';
import { FormData } from '../page'; 
interface OrderFormModalProps {
  showForm: boolean;
  setShowForm: (show: boolean) => void;
  editingOrder: Order | null;
  formData: any;
  setFormData: (data: any) => void;
  handleSubmit: (e: React.FormEvent) => void;
}

export default function OrderFormModal({
  showForm,
  setShowForm,
  editingOrder,
  formData,
  setFormData,
  handleSubmit
}: OrderFormModalProps) {
  const [products, setProducts] = useState<{ _id: string; name: string; basePrice: number; baseCost?: number; stock?: number; priceTiers?: { label: string; price: number }[]; warehouseQty?: number; warehouseCostPrice?: number }[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [warehouses, setWarehouses] = useState<{ _id: string; name: string }[]>([]);

  useEffect(() => {
    const loadProducts = async () => {
      if (formData.businessType === 'Dates' && formData.warehouseId) {
        try {
          const params: any = { businessType: 'Dates' };
          if (productQuery) params.q = productQuery;
          // Get all products for this business type
          const { data: allProducts } = await api.get('/products', { params });
          
          // For each product, fetch warehouse-specific inventory
          const enrichedProducts = await Promise.all(
            (allProducts || []).map(async (product: any) => {
              try {
                const { data: stockData } = await api.get(`/stock/product/${product._id}`);
                // Find allocation for selected warehouse
                const warehouseAlloc = stockData.allocations?.find((a: any) => a.warehouseId === formData.warehouseId);
                return {
                  ...product,
                  warehouseQty: warehouseAlloc?.quantity || 0,
                  warehouseCostPrice: warehouseAlloc?.currentCostPrice || product.baseCost || 0,
                  batches: warehouseAlloc?.batches || []
                };
              } catch (e) {
                return { ...product, warehouseQty: 0, warehouseCostPrice: 0, batches: [] };
              }
            })
          );
          
          // Filter out products with 0 quantity in selected warehouse
          setProducts(enrichedProducts.filter(p => p.warehouseQty > 0));
        } catch (error) {
          console.error('Failed to load products:', error);
          setProducts([]);
        }
      } else {
        setProducts([]);
      }
    };
    loadProducts();
  }, [formData.businessType, formData.warehouseId, productQuery, showForm]);

  useEffect(() => {
    // load warehouses for selection
    (async () => {
      try {
        const { data } = await api.get('/warehouses');
        setWarehouses(data || []);
        if (data && data.length > 0 && !formData.warehouseId) {
          setFormData((prev: any) => ({ ...prev, warehouseId: data[0]._id }));
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [showForm]);

  // When products array changes, compute aggregated sellingPrice and costPrice
  useEffect(() => {
    const items = formData.products || [];
    if (items.length > 0) {
      const totalSelling = items.reduce((s: number, it: any) => {
        const qty = Number(it.quantity || 0) || 0;
        let unitPrice = 0;
        // priceTiers with selectedTier take precedence
        if (it.priceTiers && Array.isArray(it.priceTiers) && (it.selectedTier !== undefined) && it.selectedTier >= 0) {
          unitPrice = Number(it.priceTiers[it.selectedTier]?.price || 0);
        } else {
          // sellingPrice is stored as unit price
          unitPrice = Number(it.sellingPrice || it.basePrice || 0);
        }
        return s + (unitPrice * qty);
      }, 0 as number);
      const totalCost = items.reduce((s: number, it: any) => s + (Number(it.baseCost || it.costPrice || 0) * Number(it.quantity || 0)), 0);
      setFormData((prev: FormData) => ({ ...prev, sellingPrice: Math.round(totalSelling * 100) / 100, costPrice: Math.round(totalCost * 100) / 100 }));
    }
  }, [formData.products]);

  const lookupCustomerByPhone = async (phone: string) => {
    if (!phone) return;
    try {
      setLoadingLookup(true);
      const { data } = await api.get('/customers', { params: { phone } });
      
      // data can be an array or single object
      const customer = Array.isArray(data) ? data[0] : data;
      
      if (customer && customer.name) {
        // Found customer - populate all fields
        setFormData((prev: FormData) => ({ 
          ...prev, 
          clientPhone: customer.phone || phone, 
          clientName: customer.name || '', 
          clientAddress: customer.address || '', 
          customerSupplierName: customer.name || prev.customerSupplierName 
        }));
      } else {
        // Customer not found - check if user has manually entered name/address
        if (formData.clientName && formData.clientAddress) {
          // User has entered name and address - CREATE new customer
          try {
            const createPayload = {
              name: formData.clientName,
              phone: phone,
              address: formData.clientAddress
            };
            const { data: created } = await api.post('/customers', createPayload);
            if (created && created.name) {
              setFormData((prev: FormData) => ({ 
                ...prev, 
                clientPhone: created.phone || phone,
                clientName: created.name,
                clientAddress: created.address || '',
                customerSupplierName: created.name
              }));
            }
          } catch (createError) {
            console.error('Failed to create customer:', createError);
            // Still allow form submission even if customer creation fails
          }
        } else {
          // No customer found and no manual entry - just keep the phone and clear other fields
          setFormData((prev: FormData) => ({ ...prev, clientPhone: phone, clientName: '', clientAddress: '' }));
        }
      }
    } catch (e) {
      // API error - user can enter manually then create new
      console.error('Customer lookup error:', e);
      setFormData((prev: FormData) => ({ ...prev, clientPhone: phone, clientName: '', clientAddress: '' }));
    } finally {
      setLoadingLookup(false);
    }
  };

  useEffect(() => {
    // Recompute remaining for Partial
    if (formData.paymentStatus === 'Partial') {
      const tax = (formData.taxPercent || 0) / 100;
      // compute total discounts from products and order-level
      const items = formData.products || [];
      const totalLineDiscounts = items.reduce((s: number, it: any) => s + Number(it.discount || 0), 0);
      const orderDiscount = Number(formData.orderDiscount || 0);
      const totalDiscount = totalLineDiscounts + orderDiscount;
      // net selling before tax
      const netSelling = Math.max(0, Number(formData.sellingPrice || 0) - totalDiscount);
      let finalAmount = Math.round((netSelling * (1 + tax)) * 100) / 100;
      // include delivery in finalAmount only when customer is charged
      const delivery = Number(formData.deliveryCharge || 0);
      const deliveryPaidByCustomer = formData.deliveryPaidByCustomer !== undefined ? Boolean(formData.deliveryPaidByCustomer) : true;
      if (deliveryPaidByCustomer) finalAmount = Math.round((finalAmount + delivery) * 100) / 100;
      const remaining = Math.max(0, finalAmount - (formData.partialPaidAmount || 0));
      if (remaining !== formData.partialRemainingAmount) {
        setFormData((prev: FormData) => ({ ...prev, partialRemainingAmount: Math.round(remaining * 100) / 100 }));
      }
    }
  }, [formData.paymentStatus, formData.taxPercent, formData.sellingPrice, formData.partialPaidAmount]);

  // Keep legacy single-product behavior when products array is empty (no-op otherwise)
  useEffect(() => {
    if (formData.businessType === 'Dates' && (!formData.products || formData.products.length === 0)) {
      const selected = products.find(p => p.name === formData.productServiceName);
      if (selected) {
        const qty = Math.max(1, Number(formData.quantity || 0));
        // sellingPrice and costPrice are unit prices in our model
        setFormData((prev: FormData) => ({ ...prev, sellingPrice: Number(selected.basePrice || 0), costPrice: Number(selected.baseCost || 0) }));
      }
    }
  }, [formData.productServiceName, formData.quantity, formData.businessType, products]);

  if (!showForm) return null;

  return (
    <div className="fixed inset-0 !overflow-scroll z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{editingOrder ? 'Edit Order' : 'New Order'}</h2>
          <button onClick={()=>setShowForm(false)} type="button" className="text-gray-500 hover:text-gray-800">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Client section */}
          <div className="col-span-1 md:col-span-2 border rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Client</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.clientPhone || ''}
                    onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                    onBlur={(e) => lookupCustomerByPhone(e.target.value)}
                    placeholder="Search by phone"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button type="button" onClick={() => lookupCustomerByPhone(formData.clientPhone || '')} className="px-3 py-2 bg-indigo-600 text-white rounded-lg">Search</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.clientName || ''}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value, customerSupplierName: e.target.value })}
                  placeholder="Client name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={formData.clientAddress || ''}
                  onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
                  placeholder="Address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
            <select
              value={formData.businessType}
              onChange={(e) => setFormData({ ...formData, businessType: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            >
              <option value="Travel">Travel</option>
              <option value="Dates">Dates</option>
              <option value="Belts">Belts</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
            <select
              value={formData.warehouseId || ''}
              onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Default Warehouse</option>
              {warehouses.map(w => (
                <option key={w._id} value={w._id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
            <input
              type="text"
              value={formData.orderId}
              onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
              placeholder="Auto-generated if left blank"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order Type</label>
            <select
              value={formData.orderType}
              onChange={(e) => setFormData({ ...formData, orderType: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            >
              <option value="Retail">Retail</option>
              <option value="Shopify">Shopify</option>
              <option value="Preorder">Preorder</option>
              <option value="Wholesale">Wholesale</option>
              <option value="Service">Service</option>
            </select>
          </div>
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    Product/Service
  </label>
  {formData.businessType === "Dates" ? (
    <>
      <div className="relative">
        <input
          type="text"
          placeholder="Search product..."
          value={productQuery}
          onChange={(e) => setProductQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition"
        />

        {productQuery && products.length > 0 && (
          <div className="absolute left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 max-h-56 overflow-y-auto shadow-xl animate-fadeIn z-50">
            {products.map((p) => (
              <div
                key={p._id}
                onClick={() => {
                  // prevent adding if out of stock in selected warehouse
                  if ((p.warehouseQty || 0) <= 0) {
                    toast.error('Product is out of stock in selected warehouse');
                    return;
                  }
                  // add or increment product in formData.products
                  setFormData((prev: FormData) => {
                    const items = (prev.products || []).slice() as any[];
                    const idx = items.findIndex(i => i.productId === p._id);
                    if (idx >= 0) {
                      // do not exceed warehouse stock
                      const currentQty = Number(items[idx].quantity || 0);
                      const newQty = Math.min((p.warehouseQty || Infinity), currentQty + 1);
                      items[idx].quantity = newQty;
                      // Use FIFO cost price from this warehouse
                      items[idx].costPrice = Number(p.warehouseCostPrice || p.baseCost || 0);
                    } else {
                      // build composite tiers: default (basePrice) + configured tiers
                      const extraTiers = (p.priceTiers || []).map((t: any) => ({ label: t.label, price: Number(t.price || 0) }));
                      const compositeTiers = [{ label: 'Default', price: Number(p.basePrice || 0) }, ...extraTiers];
                      const unitPrice = compositeTiers[0].price || 0;
                      items.push({
                        productId: p._id,
                        name: p.name,
                        quantity: 1,
                        basePrice: p.basePrice,
                        baseCost: p.warehouseCostPrice || p.baseCost || 0,
                        sellingPrice: unitPrice,
                        costPrice: p.warehouseCostPrice || p.baseCost || 0,
                        discount: 0,
                        availableStock: p.warehouseQty || 0,
                        priceTiers: compositeTiers,
                        selectedTier: 0
                      } as any);
                    }
                    return { ...prev, products: items };
                  });
                  setProductQuery("");
                }}
                className="px-4 py-3 cursor-pointer hover:bg-indigo-50 flex justify-between items-center transition"
              >
                <div>
                  <div className="font-medium text-gray-800">{p.name}</div>
                  <div className="text-xs text-gray-500">Price: {p.basePrice} • Qty: {(p.warehouseQty || 0)} • Cost: {(p.warehouseCostPrice || 0).toFixed(2)} (FIFO)</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {productQuery && products.length === 0 && (
          <div className="absolute left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 px-4 py-3 shadow-md text-sm text-gray-500">
            No products found.
          </div>
        )}
      </div>

      {/* Selected products list */}
      {(formData.products || []).length > 0 && (
        <div className="mt-2 space-y-2">
          {(formData.products || []).map((it: any, idx: number) => (
            <div key={it.productId || idx} className="flex items-center gap-2 border rounded-lg p-2">
              <div className="flex-1">
                <div className="font-medium text-sm">{it.name}</div>
                <div className="text-xs text-gray-500">Base: {it.basePrice}</div>
              </div>
              <div className="w-20">
                <label className="text-xs text-gray-600">Qty</label>
                <input
                  type="number"
                  value={it.quantity}
                  min={1}
                  max={it.availableStock || 999999}
                  onChange={(e) => {
                    const val = Math.max(1, Number(e.target.value || 1));
                    const capped = Math.min(val, it.availableStock || val);
                    setFormData((prev: FormData) => {
                      const items = (prev.products || []).slice() as any[];
                      items[idx].quantity = capped;
                      // if price tiers exist, keep selected tier price, else use basePrice
                      if (items[idx].priceTiers && items[idx].priceTiers.length > 0 && items[idx].selectedTier >= 0) {
                        const sel = items[idx].selectedTier || 0;
                        const tierPrice = Number(items[idx].priceTiers[sel]?.price || items[idx].basePrice || 0);
                        // store unit price
                        items[idx].sellingPrice = tierPrice;
                      } else {
                        // store unit price
                        items[idx].sellingPrice = Number(items[idx].basePrice || 0);
                      }
                      // costPrice is unit cost
                      items[idx].costPrice = Number(items[idx].baseCost || 0);
                      return { ...prev, products: items };
                    });
                  }}
                  className="w-full px-2 py-1 border rounded"
                />
                {it.availableStock !== undefined && (
                  <div className="text-xs text-gray-500">Stock: {it.availableStock}</div>
                )}
              </div>
              <div className="w-24">
                <label className="text-xs text-gray-600">Disc</label>
                <input
                  type="number"
                  value={it.discount || 0}
                  min={0}
                  onChange={(e) => {
                    const val = Number(e.target.value || 0);
                    setFormData((prev: FormData) => {
                      const items = (prev.products || []).slice() as any[];
                      items[idx].discount = val;
                      return { ...prev, products: items };
                    });
                  }}
                  className="w-full px-2 py-1 border rounded"
                />
                {it.priceTiers && it.priceTiers.length > 0 && (
                  <div className="mt-2">
                    <label className="text-xs text-gray-600">Price Tier</label>
                    <select
                      value={it.selectedTier || 0}
                      onChange={(e) => {
                        const sel = Number(e.target.value || 0);
                        setFormData((prev: FormData) => {
                          const items = (prev.products || []).slice() as any[];
                          items[idx].selectedTier = sel;
                          const tierPrice = Number(items[idx].priceTiers[sel]?.price || items[idx].basePrice || 0);
                          // store unit price when a tier is selected
                          items[idx].sellingPrice = tierPrice;
                          return { ...prev, products: items };
                        });
                      }}
                      className="w-full px-2 py-1 border rounded"
                    >
                      {it.priceTiers.map((pt: any, i: number) => (
                        <option key={i} value={i}>{pt.label} — {pt.price}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
                <div className="w-28 text-right">
                <div className="text-xs text-gray-600">Line</div>
                <div className="font-medium">{
                  (() => {
                    const qty = Number(it.quantity || 0) || 0;
                    let lineTotal = 0;
                    if (it.priceTiers && Array.isArray(it.priceTiers) && (it.selectedTier !== undefined)) {
                      const unit = Number(it.priceTiers[it.selectedTier]?.price || 0);
                      lineTotal = unit * qty;
                    } else if (it.sellingPrice !== undefined) {
                      // sellingPrice is stored as unit price
                      lineTotal = Number(it.sellingPrice || 0) * qty;
                    } else {
                      lineTotal = Number(it.basePrice || 0) * qty;
                    }
                    lineTotal = lineTotal - Number(it.discount || 0);
                    return Math.round(lineTotal * 100) / 100;
                  })()
                }</div>
              </div>
              <button type="button" onClick={() => setFormData((prev: FormData) => ({ ...prev, products: (prev.products || []).filter((_, i) => i !== idx) }))} className="px-2 py-1 text-red-600">Remove</button>
            </div>
          ))}
        </div>
      )}
    </>
  ) : (
    <input
      type="text"
      value={formData.productServiceName}
      onChange={(e) =>
        setFormData({ ...formData, productServiceName: e.target.value })
      }
      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
      required
    />
  )}
</div>


          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            {formData.businessType === 'Dates' && (formData.products || []).length > 0 ? (
              <input type="number" value={0} readOnly className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50" />
            ) : (
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                required
                min="0"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price</label>
            <input
              type="number"
              value={formData.costPrice}
              onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
              min="0"
              step="0.01"
              readOnly={(formData.businessType === 'Dates' && (formData.products || []).length > 0) ? true : false}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price</label>
            <input
              type="number"
              value={formData.sellingPrice}
              onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
              min="0"
              step="0.01"
              readOnly={(formData.businessType === 'Dates' && (formData.products || []).length > 0) ? true : false}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tax (%)</label>
            <input
              type="number"
              value={formData.taxPercent}
              onChange={(e) => setFormData({ ...formData, taxPercent: parseFloat(e.target.value || '0') })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              min="0"
              step="0.01"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Charge</label>
            <input
              type="number"
              value={formData.deliveryCharge || 0}
              onChange={(e) => setFormData({ ...formData, deliveryCharge: Number(parseFloat(e.target.value || '0')) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order Discount (Rs)</label>
            <input
              type="number"
              value={formData.orderDiscount || 0}
              onChange={(e) => setFormData({ ...formData, orderDiscount: Number(parseFloat(e.target.value || '0')) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              min="0"
              step="0.01"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="deliveryPaidByCustomer"
              type="checkbox"
              checked={formData.deliveryPaidByCustomer !== undefined ? Boolean(formData.deliveryPaidByCustomer) : true}
              onChange={(e) => setFormData({ ...formData, deliveryPaidByCustomer: e.target.checked })}
              className="h-4 w-4"
            />
            <label htmlFor="deliveryPaidByCustomer" className="text-sm text-gray-700">Charge delivery to customer (customer pays)</label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
            <select
              value={formData.paymentStatus}
              onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            >
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Partial">Partial</option>
            </select>
          </div>

          {formData.paymentStatus === 'Partial' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paid Amount</label>
                <input
                  type="number"
                  value={formData.partialPaidAmount}
                  onChange={(e) => setFormData({ ...formData, partialPaidAmount: parseFloat(e.target.value || '0') })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remaining Amount</label>
                <input
                  type="number"
                  value={formData.partialRemainingAmount}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={formData.paymentMethod}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            >
              <option value="Cash">Cash</option>
              <option value="Bank">Bank</option>
              <option value="JazzCash">JazzCash</option>
              <option value="Online">Online</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer/Supplier Name</label>
            <input
              type="text"
              value={formData.customerSupplierName}
              onChange={(e) => setFormData({ ...formData, customerSupplierName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <input
              type="text"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={()=>setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancel</button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              {editingOrder ? 'Update Order' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}