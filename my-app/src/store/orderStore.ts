import { create } from 'zustand';
import api from '@/lib/api';

export interface Order {
  _id: string;
  businessType: 'Travel' | 'Dates' | 'Belts';
  orderId: string;
  orderType: 'Retail' | 'Shopify' | 'Preorder' | 'Wholesale' | 'Service';
  productServiceName: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  paymentStatus: 'Paid' | 'Unpaid' | 'Partial';
  paymentMethod: 'Cash' | 'Bank' | 'JazzCash' | 'Online';
  customerSupplierName: string;
  remarks: string;
  profit: number;
  createdAt: string;
  updatedAt: string;
}

interface OrderState {
  orders: Order[];
  loading: boolean;
  fetchOrders: (filters?: any) => Promise<void>;
  createOrder: (order: Partial<Order>) => Promise<void>;
  updateOrder: (id: string, order: Partial<Order>) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  loading: false,
  
  fetchOrders: async (filters = {}) => {
    set({ loading: true });
    try {
      const { data } = await api.get('/orders', { params: filters });
      set({ orders: data, loading: false });
    } catch (error) {
      console.error('Fetch orders error:', error);
      set({ loading: false });
    }
  },
  
  createOrder: async (order: Partial<Order>) => {
    try {
      const { data } = await api.post('/orders', order);
      set({ orders: [...get().orders, data] });
    } catch (error) {
      console.error('Create order error:', error);
    }
  },
  
  updateOrder: async (id: string, order: Partial<Order>) => {
    try {
      const { data } = await api.put(`/orders/${id}`, order);
      set({ orders: get().orders.map(o => o._id === id ? data : o) });
    } catch (error) {
      console.error('Update order error:', error);
    }
  },
  
  deleteOrder: async (id: string) => {
    try {
      await api.delete(`/orders/${id}`);
      set({ orders: get().orders.filter(o => o._id !== id) });
    } catch (error) {
      console.error('Delete order error:', error);
    }
  },
}));

