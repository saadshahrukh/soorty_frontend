import { Order } from '@/store/orderStore';
import { generateOrderSlip } from '@/lib/pdf';

interface OrdersTableProps {
  orders: Order[];
  page: number;
  pageSize: number;
  user: any;
  handleEdit: (order: Order) => void;
  handleDelete: (id: string) => void;
}

export default function OrdersTable({
  orders,
  page,
  pageSize,
  user,
  handleEdit,
  handleDelete
}: OrdersTableProps) {
  return (
    <div className="bg-white rounded-lg shadow overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Business</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Selling</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {orders.slice((page-1)*pageSize, page*pageSize).map((order) => (
            <tr key={order._id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  order.businessType === 'Travel' ? 'bg-blue-100 text-blue-800' :
                  order.businessType === 'Dates' ? 'bg-green-100 text-green-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {order.businessType}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.orderId}</td>
              <td className="px-6 py-4 text-sm text-gray-900">{order.productServiceName}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.quantity}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.costPrice}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.sellingPrice}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">{order.profit}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  order.paymentStatus === 'Paid' ? 'bg-green-100 text-green-800' :
                  order.paymentStatus === 'Unpaid' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {order.paymentStatus}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <button
                  onClick={() => handleEdit(order)}
                  className="text-indigo-600 hover:text-indigo-900 mr-3"
                >
                  Edit
                </button>
                {user?.role !== 'DataEntry' && (
                  <button
                    onClick={() => handleDelete(order._id)}
                    className="text-red-600 hover:text-red-900 mr-3"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={async () => {
                    // Debug: log order object to help trace missing customer fields in slip
                    try {
                      console.log('generateOrderSlip - order object:', order);
                      if (!(order as any).customerPhone && !(order as any).clientPhone && !(order as any).customerAddress) {
                        console.warn('Order appears to be missing customerPhone/customerAddress in the object passed to PDF generator');
                      }
                    } catch (e) {
                      console.error('Error logging order for slip debug', e);
                    }
                    await generateOrderSlip(order);
                  }}
                  className="text-emerald-600 hover:text-emerald-800"
                >
                  Slip
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}