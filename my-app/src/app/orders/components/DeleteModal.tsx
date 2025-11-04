interface DeleteModalProps {
  showDeleteModal: boolean;
  setShowDeleteModal: (show: boolean) => void;
  delStart: string;
  setDelStart: (date: string) => void;
  delEnd: string;
  setDelEnd: (date: string) => void;
  delBusiness: string;
  setDelBusiness: (business: any) => void;
  deleting: boolean;
  clearDeleteFilters: () => void;
  deleteByFilter: () => void;
}

export default function DeleteModal({
  showDeleteModal,
  setShowDeleteModal,
  delStart,
  setDelStart,
  delEnd,
  setDelEnd,
  delBusiness,
  setDelBusiness,
  deleting,
  clearDeleteFilters,
  deleteByFilter
}: DeleteModalProps) {
  if (!showDeleteModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <h3 className="text-lg font-bold mb-4">Delete Orders by Filter</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
            <input type="datetime-local" value={delStart} onChange={(e)=>setDelStart(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
            <input type="datetime-local" value={delEnd} onChange={(e)=>setDelEnd(e.target.value)} className="w-full px-3 py-2 border rounded-md" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Business</label>
            <select value={delBusiness} onChange={(e)=>setDelBusiness(e.target.value as any)} className="w-full px-3 py-2 border rounded-md">
              <option value="All">All</option>
              <option value="Travel">Travel</option>
              <option value="Dates">Dates</option>
              <option value="Belts">Belts</option>
            </select>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded p-3 mb-4">
          This action is permanent and cannot be undone.
        </div>
        <div className="flex justify-between">
          <button onClick={clearDeleteFilters} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">Clear</button>
          <div className="flex gap-2">
            <button onClick={()=>setShowDeleteModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">Cancel</button>
            <button disabled={deleting} onClick={deleteByFilter} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}