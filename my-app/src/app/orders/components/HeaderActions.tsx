import { User } from '@/store/authStore';
import { useState } from 'react';
import { importLatestShopifyOrder } from '@/lib/shopifyClient';
import { toast } from '@/store/toastStore';

interface HeaderActionsProps {
  showForm: boolean;
  openAddOrderForm: () => void;
  generateOrdersReport: () => void;
  router: any;
  user: User | null;
  setShowDeleteModal: (show: boolean) => void;
}

export default function HeaderActions({
  showForm,
  openAddOrderForm,
  generateOrdersReport,
  router,
  user,
  setShowDeleteModal
}: HeaderActionsProps) {
  const [loadingImport, setLoadingImport] = useState(false);
  return (
    <div className="mb-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
      <button
        onClick={openAddOrderForm}
        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
      >
        {showForm ? 'Cancel' : '+ Add New Order'}
      </button>
      <div>
        <button
          onClick={generateOrdersReport}
          className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
        >
          Export All (PDF)
        </button>
        <button
          onClick={async () => {
            try {
              setLoadingImport(true);
              const resp = await importLatestShopifyOrder();
              if (resp?.status === 'no-orders') {
                toast.info('No orders found on Shopify');
              } else if (resp?.status === 'ok') {
                toast.success(`Shopify order ${resp.action}`);
                // Dispatch a custom event so parent pages can refresh if needed
                window.dispatchEvent(new CustomEvent('shopify:imported', { detail: resp }));
              } else {
                toast.error(resp?.message || 'Import returned unexpected response');
              }
            } catch (e: any) {
              console.error('Import failed', e);
              toast.error(e?.message || 'Import failed');
            } finally {
              setLoadingImport(false);
            }
          }}
          className="ml-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          disabled={loadingImport}
        >
          {loadingImport ? 'Importing...' : 'Import Latest Shopify'}
        </button>
        <button
          onClick={() => router.push('/products')}
          className="ml-2 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
        >
          Products
        </button>
        {user?.role !== 'DataEntry' && (
          <button
            onClick={() => setShowDeleteModal(true)}
            className="ml-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Delete by Filter
          </button>
        )}
      </div>
    </div>
  );
}