"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";

type Warehouse = { _id: string; name: string };
type StockBatch = { batchId: string; quantity: number; costPrice: number; addedAt: string };
type StockAlloc = { 
  warehouseId: string; 
  warehouseName: string; 
  quantity: number;
  currentCostPrice?: number;
  batches?: StockBatch[];
};
type Product = {
  _id: string;
  businessType: "Travel" | "Dates" | "Belts";
  name: string;
  basePrice: number;
  baseCost?: number;
  deliveryCharges?: number;
  stock?: number;
};

export default function ProductsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  // Main state
  const [items, setItems] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [businessType, setBusinessType] = useState<"Dates" | "Travel" | "Belts">("Dates");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [warehouseLoading, setWarehouseLoading] = useState(false);

  // Modals
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showTransferHistory, setShowTransferHistory] = useState(false);

  // Product form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [basePrice, setBasePrice] = useState(0);
  const [baseCost, setBaseCost] = useState(0);
  const [deliveryCharges, setDeliveryCharges] = useState(0);

  // Warehouse management
  const [newWarehouseName, setNewWarehouseName] = useState("");

  // Stock management
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [allocations, setAllocations] = useState<StockAlloc[]>([]);
  const [allocQty, setAllocQty] = useState(0);
  const [allocCostPrice, setAllocCostPrice] = useState(0); // NEW: Cost price per unit for this batch
  const [editingWarehouse, setEditingWarehouse] = useState<string | null>(null);
  const [editingCurrentQty, setEditingCurrentQty] = useState(0);
  const [showAddStockForm, setShowAddStockForm] = useState(false); // Toggle for add stock form

  // Transfer
  const [transferFrom, setTransferFrom] = useState<string | null>(null);
  const [transferTo, setTransferTo] = useState<string | null>(null);
  const [transferQty, setTransferQty] = useState(0);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferHistory, setTransferHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ============= LOAD DATA =============
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    loadProducts();
    loadWarehouses();

    // CRITICAL: Listen for inventory updates from other pages (e.g., order creation)
    const handleInventoryUpdate = () => {
      loadProducts();
    };
    
    window.addEventListener('inventory:updated', handleInventoryUpdate);
    return () => window.removeEventListener('inventory:updated', handleInventoryUpdate);
  }, [isAuthenticated, businessType]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const params: any = { businessType };
      if (selectedWarehouse) params.warehouseId = selectedWarehouse;
      const { data } = await api.get("/products", { params });
      setItems(data || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const loadWarehouses = async () => {
    try {
      setWarehouseLoading(true);
      const { data } = await api.get("/warehouses");
      setWarehouses(data || []);
      if (data?.length > 0 && !selectedWarehouse) {
        setSelectedWarehouse(data[0]._id);
      }
    } catch (error: any) {
      toast.error("Failed to load warehouses");
    } finally {
      setWarehouseLoading(false);
    }
  };

  // ============= PRODUCT CRUD =============
  const addOrUpdateProduct = async () => {
    if (!name || basePrice < 0) {
      toast.error("Please fill required fields correctly");
      return;
    }

    try {
      if (editingId) {
        // When editing, we can update baseCost manually if needed
        await api.put(`/products/${editingId}`, {
          businessType,
          name,
          basePrice,
          baseCost,
          deliveryCharges,
        });
        toast.success("Product updated");
      } else {
        // When creating, NEVER send baseCost - it will be set when stock is added
        await api.post("/products", {
          businessType,
          name,
          basePrice,
          deliveryCharges,
        });
        toast.success("Product created");
      }
      resetProductForm();
      setShowAddProductModal(false);
      await loadProducts();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Operation failed");
    }
  };

  const resetProductForm = () => {
    setEditingId(null);
    setName("");
    setBasePrice(0);
    setBaseCost(0);
    setDeliveryCharges(0);
  };

  const editProduct = (p: Product) => {
    setEditingId(p._id);
    setName(p.name);
    setBasePrice(p.basePrice);
    setBaseCost(p.baseCost || 0);
    setDeliveryCharges(p.deliveryCharges || 0);
    setShowAddProductModal(true);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success("Product deleted");
      await loadProducts();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to delete");
    }
  };

  // ============= WAREHOUSE CRUD =============
  const createWarehouse = async () => {
    if (!newWarehouseName.trim()) {
      toast.error("Enter warehouse name");
      return;
    }
    try {
      await api.post("/warehouses", { name: newWarehouseName });
      toast.success("Warehouse created");
      setNewWarehouseName("");
      await loadWarehouses();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to create warehouse");
    }
  };

  const deleteWarehouse = async (id: string) => {
    if (!confirm("Delete warehouse? (must be empty)")) return;
    try {
      await api.delete(`/warehouses/${id}`);
      toast.success("Warehouse deleted");
      if (selectedWarehouse === id) setSelectedWarehouse(null);
      await loadWarehouses();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to delete");
    }
  };

  // ============= STOCK MANAGEMENT =============
  const openStockModal = async (product: Product) => {
    setSelectedProduct(product);
    setEditingWarehouse(null);
    setEditingCurrentQty(0);
    setAllocQty(0);
    try {
      const { data } = await api.get(`/stock/product/${product._id}`);
      setAllocations(data.allocations || []);
    } catch (error: any) {
      toast.error("Failed to load stock data");
    }
    setShowStockModal(true);
  };

  const startEditWarehouse = (warehouseId: string, currentQty: number) => {
    setEditingWarehouse(warehouseId);
    setEditingCurrentQty(currentQty);
    setAllocQty(currentQty);
  };

  const cancelEditWarehouse = () => {
    setEditingWarehouse(null);
    setEditingCurrentQty(0);
    setAllocQty(0);
  };

  const updateAllocation = async () => {
    if (!selectedProduct || !editingWarehouse) {
      toast.error("Warehouse not selected");
      return;
    }
    if (allocQty < 0) {
      toast.error("Quantity cannot be negative");
      return;
    }

    try {
      await api.put(`/stock/product/${selectedProduct._id}/allocation`, {
        warehouseId: editingWarehouse,
        qty: allocQty,
      });
      toast.success(`Stock updated: ${editingCurrentQty} → ${allocQty} units`);
      setEditingWarehouse(null);
      setEditingCurrentQty(0);
      setAllocQty(0);
      await openStockModal(selectedProduct);
      await loadProducts();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to update allocation");
    }
  };

  // ============= TRANSFER STOCK =============
  const openTransferModal = (product: Product) => {
    setSelectedProduct(product);
    setTransferFrom(null);
    setTransferTo(null);
    setTransferQty(0);
    setShowTransferModal(true);
  };

  const executeTransfer = async () => {
    if (!selectedProduct || !transferFrom || !transferTo || transferQty <= 0) {
      toast.error("Fill all transfer fields correctly");
      return;
    }

    if (transferFrom === transferTo) {
      toast.error("Source and destination must be different");
      return;
    }

    if (!confirm(`Transfer ${transferQty} units from one warehouse to another?`)) return;

    try {
      setTransferLoading(true);
      await api.post("/stock/transfer", {
        productId: selectedProduct._id,
        fromWarehouseId: transferFrom,
        toWarehouseId: transferTo,
        qty: transferQty,
      });
      toast.success("Stock transferred successfully");
      setShowTransferModal(false);
      await openStockModal(selectedProduct);
      await loadProducts();
      // CRITICAL: Broadcast inventory update event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('inventory:updated'));
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Transfer failed");
    } finally {
      setTransferLoading(false);
    }
  };

  // ============= TRANSFER HISTORY =============
  const openTransferHistory = async (product: Product) => {
    setSelectedProduct(product);
    setHistoryLoading(true);
    try {
      const { data } = await api.get("/stock/transfers", {
        params: { productId: product._id, limit: 50 }
      });
      setTransferHistory(data || []);
    } catch (error: any) {
      toast.error("Failed to load transfer history");
    } finally {
      setHistoryLoading(false);
    }
    setShowTransferHistory(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />

      <div className="flex-1">
        {/* Header */}
        <nav className="bg-white border-b sticky top-0 z-40 shadow-sm">
          <div className="px-6 h-14 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-indigo-600">Products</h1>
            <button
              onClick={() => router.push("/orders")}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Go to Orders
            </button>
          </div>
        </nav>

        {/* Content */}
        <div className="p-6">
          {/* Controls */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Business Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Business</label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="Dates">Dates</option>
                  <option value="Travel">Travel</option>
                  <option value="Belts">Belts</option>
                </select>
              </div>

              {/* Warehouse Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Warehouse</label>
                <select
                  value={selectedWarehouse || ""}
                  onChange={(e) => setSelectedWarehouse(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">All Warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 items-end">
                <button
                  onClick={() => {
                    resetProductForm();
                    setShowAddProductModal(true);
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                >
                  + Add Product
                </button>
              </div>

              <div className="flex gap-2 items-end">
                <button
                  onClick={() => setShowWarehouseModal(true)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Manage Warehouses
                </button>
              </div>
            </div>
          </div>

          {/* Products Table */}
          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">Loading products...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">No products found. Create one to get started.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Base Price</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Base Cost</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Delivery</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Stock</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((p) => (
                    <tr key={p._id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{p.basePrice.toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{(p.baseCost || 0).toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{(p.deliveryCharges || 0).toFixed(2)}</td>
                      <td className="px-6 py-3 text-sm font-medium text-indigo-600">{p.stock || 0}</td>
                      <td className="px-6 py-3 text-sm space-x-2">
                        <button
                          onClick={() => openStockModal(p)}
                          className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded hover:bg-cyan-200"
                        >
                          Stock
                        </button>
                        <button
                          onClick={() => openTransferModal(p)}
                          className="px-3 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                        >
                          Transfer
                        </button>
                        <button
                          onClick={() => openTransferHistory(p)}
                          className="px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                        >
                          History
                        </button>
                        <button
                          onClick={() => editProduct(p)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteProduct(p._id)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ============= MODALS ============= */}

      {/* Add/Edit Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingId ? "Edit Product" : "Add New Product"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="Dates">Dates</option>
                  <option value="Travel">Travel</option>
                  <option value="Belts">Belts</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter product name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Price *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={basePrice}
                  onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Cost</label>
                <div className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center h-10">
                  <span className="text-sm">N/A - Set when adding stock</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Charges</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={deliveryCharges}
                  onChange={(e) => setDeliveryCharges(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddProductModal(false);
                  resetProductForm();
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={addOrUpdateProduct}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                {editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Warehouse Management Modal */}
      {showWarehouseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Manage Warehouses</h2>

            {/* Create Warehouse */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-3">Create New Warehouse</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newWarehouseName}
                  onChange={(e) => setNewWarehouseName(e.target.value)}
                  placeholder="Warehouse name (e.g., Main Store)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <button
                  onClick={createWarehouse}
                  disabled={warehouseLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {warehouseLoading ? "..." : "Add"}
                </button>
              </div>
            </div>

            {/* List Warehouses */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Existing Warehouses</h3>
              {warehouseLoading ? (
                <p className="text-gray-500">Loading...</p>
              ) : warehouses.length === 0 ? (
                <p className="text-gray-500">No warehouses yet</p>
              ) : (
                <div className="space-y-2">
                  {warehouses.map((w) => (
                    <div key={w._id} className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
                      <span className="font-medium text-gray-800">{w.name}</span>
                      <button
                        onClick={() => deleteWarehouse(w._id)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowWarehouseModal(false)}
              className="w-full mt-6 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Stock Management Modal */}
      {showStockModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6 max-h-[85vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              📦 Stock Management: {selectedProduct.name}
            </h2>

            {/* Current Cost Price Summary */}
            <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
              <p className="text-sm text-yellow-700">Current Cost Price (FIFO)</p>
              <p className="text-3xl font-bold text-yellow-900">₹ {selectedProduct.baseCost || 0}</p>
              <p className="text-xs text-yellow-600 mt-1">Based on oldest stock batch</p>
            </div>

            {/* Total Stock Summary */}
            <div className="mb-6 p-4 bg-indigo-50 border-2 border-indigo-300 rounded-lg">
              <p className="text-sm text-indigo-700">Total Stock Across All Warehouses</p>
              <p className="text-3xl font-bold text-indigo-900">{allocations.reduce((sum, a) => sum + a.quantity, 0)} units</p>
            </div>

            {/* ADD NEW STOCK SECTION */}
            <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <button
                onClick={() => setShowAddStockForm(!showAddStockForm)}
                className="w-full font-semibold text-green-900 text-lg mb-3 flex items-center justify-between"
              >
                <span>+ Add Stock to Warehouse</span>
                <span className="text-lg">{showAddStockForm ? "−" : "+"}</span>
              </button>

              {showAddStockForm && (
                <div className="space-y-3 pt-3 border-t-2 border-green-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Warehouse *</label>
                    <select
                      value={editingWarehouse || ""}
                      onChange={(e) => setEditingWarehouse(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">-- Select Warehouse --</option>
                      {warehouses.map((w) => (
                        <option key={w._id} value={w._id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                      <input
                        type="number"
                        min="1"
                        value={allocQty}
                        onChange={(e) => setAllocQty(parseInt(e.target.value) || 0)}
                        placeholder="Units"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price per Unit ₹ *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={allocCostPrice}
                        onChange={(e) => setAllocCostPrice(parseFloat(e.target.value) || 0)}
                        placeholder="Cost"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (!editingWarehouse || allocQty <= 0 || allocCostPrice < 0) {
                        toast.error("Fill all fields correctly");
                        return;
                      }
                      try {
                        await api.post(`/stock/product/${selectedProduct._id}/allocate`, {
                          warehouseId: editingWarehouse,
                          qty: allocQty,
                          costPrice: allocCostPrice
                        });
                        toast.success(`Stock added: ${allocQty} units @ ₹${allocCostPrice}`);
                        setEditingWarehouse(null);
                        setAllocQty(0);
                        setAllocCostPrice(0);
                        setShowAddStockForm(false);
                        await openStockModal(selectedProduct);
                        await loadProducts();
                      } catch (error: any) {
                        toast.error(error?.response?.data?.message || "Failed to add stock");
                      }
                    }}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    ✓ Add Stock Batch
                  </button>
                </div>
              )}
            </div>

            {/* Warehouse Stock Breakdown with Batch Details */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 mb-3">Stock by Warehouse (with Batch Tracking)</h3>
              {allocations.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No stock allocated yet. Add stock to get started!</p>
              ) : (
                <div className="space-y-3">
                  {allocations.map((alloc) => (
                    <div
                      key={alloc.warehouseId}
                      className="p-4 rounded-lg border-2 bg-gray-50 border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{alloc.warehouseName}</h4>
                        <span className="text-lg font-bold text-indigo-600">{alloc.quantity} units</span>
                      </div>
                      
                      {alloc.currentCostPrice !== undefined && (
                        <p className="text-sm text-gray-600 mb-2">
                          Current Cost Price: <span className="font-semibold text-green-700">₹ {alloc.currentCostPrice}</span>
                        </p>
                      )}

                      {/* Display Batches if available */}
                      {alloc.batches && alloc.batches.length > 0 && (
                        <div className="mt-2 space-y-2">
                          <p className="text-xs font-semibold text-gray-700">Batches (FIFO Order):</p>
                          {alloc.batches.map((batch, idx) => (
                            <div key={batch.batchId} className={`text-xs p-2 rounded border ${idx === 0 ? 'bg-blue-50 border-blue-300' : 'bg-gray-100 border-gray-300'}`}>
                              <div className="font-semibold text-gray-900">
                                {idx === 0 && "▶ "} Batch {idx + 1}: {batch.quantity} units @ ₹{batch.costPrice}
                              </div>
                              <div className="text-gray-600">ID: {batch.batchId}</div>
                              <div className="text-gray-600">Added: {new Date(batch.addedAt).toLocaleDateString()}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowStockModal(false);
                  setShowAddStockForm(false);
                  cancelEditWarehouse();
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Transfer Modal */}
      {showTransferModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Transfer Stock: {selectedProduct.name}
            </h2>

            <div className="space-y-4">
              {/* From Warehouse */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transfer FROM (Source Warehouse) *
                </label>
                <select
                  value={transferFrom || ""}
                  onChange={(e) => setTransferFrom(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">-- Select Source Warehouse --</option>
                  {warehouses.map((w) => {
                    const alloc = allocations.find((a) => a.warehouseId === w._id);
                    const qty = alloc?.quantity || 0;
                    return (
                      <option key={w._id} value={w._id}>
                        {w.name} ({qty} units available)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* To Warehouse */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Transfer TO (Destination Warehouse) *
                </label>
                <select
                  value={transferTo || ""}
                  onChange={(e) => setTransferTo(e.target.value || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">-- Select Destination Warehouse --</option>
                  {warehouses.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity to Transfer *
                </label>
                <input
                  type="number"
                  min="1"
                  value={transferQty}
                  onChange={(e) => setTransferQty(parseInt(e.target.value) || 0)}
                  placeholder="Enter quantity"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              {/* Info Box */}
              {transferFrom && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-gray-700">
                  <strong>Note:</strong> Make sure the source warehouse has enough stock before transferring.
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={executeTransfer}
                disabled={transferLoading}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium disabled:opacity-50"
              >
                {transferLoading ? "Transferring..." : "Execute Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer History Modal */}
      {showTransferHistory && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-96 overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              📋 Transfer History: {selectedProduct.name}
            </h2>

            {historyLoading ? (
              <p className="text-gray-500 text-center py-4">Loading...</p>
            ) : transferHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No transfers yet</p>
            ) : (
              <div className="space-y-3">
                {transferHistory.map((transfer, idx) => (
                  <div key={transfer._id || idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {transfer.fromWarehouseId?.name || "Unknown"} → {transfer.toWarehouseId?.name || "Unknown"}
                        </p>
                        <p className="text-lg font-bold text-indigo-600">{transfer.qty} units</p>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(transfer.createdAt).toLocaleDateString()} {new Date(transfer.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {transfer.note && (
                      <p className="text-sm text-gray-600">Note: {transfer.note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowTransferHistory(false)}
              className="w-full mt-6 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


