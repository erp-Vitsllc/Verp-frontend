export default function TrainingTab({
    employee,
    isAdmin,
    hasPermission,
    formatDate,
    deletingTrainingIndex,
    onOpenTrainingModal,
    onViewDocument,
    onEditTraining,
    onDeleteTraining
}) {
    // Aggregate and category logic (though training is mostly one category)
    const allTraining = useMemo(() => {
        const internal = (employee?.trainingDetails || []).map((t, idx) => ({ ...t, isSystem: false, index: idx, id: `int-${idx}` }));
        const external = (employee?.trainingDetailsFromTraining || []).map((t, idx) => ({ ...t, isSystem: true, index: idx, id: `ext-${idx}` }));
        return [...internal, ...external].sort((a, b) => {
            const dateA = a.trainingDate ? new Date(a.trainingDate).getTime() : 0;
            const dateB = b.trainingDate ? new Date(b.trainingDate).getTime() : 0;
            return dateB - dateA;
        });
    }, [employee]);

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-800">Training Record</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-100">
                                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-16">Sl. No.</th>
                                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Training Name</th>
                                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Provider</th>
                                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Cost</th>
                                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Certificate</th>
                                <th className="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allTraining.length > 0 ? (
                                allTraining.map((training, index) => (
                                    <tr key={training.id} className="border-b border-gray-50 hover:bg-teal-50/20 transition-colors group">
                                        <td className="py-3 px-4 text-sm text-gray-500 font-medium">#{index + 1}</td>
                                        <td className="py-3 px-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-800">{training.trainingName || '—'}</span>
                                                {training.isSystem && <span className="text-[10px] text-teal-600 font-bold uppercase tracking-tighter">System/External</span>}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {training.provider || training.trainingFrom || '—'}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600">
                                            {training.trainingDate ? formatDate(training.trainingDate) : '—'}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-600 font-medium">
                                            {training.trainingCost ? `AED ${training.trainingCost}` : '—'}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {training.certificate?.url || training.certificate?.data || training.certificate?.name ? (
                                                <button
                                                    onClick={() => onViewDocument({
                                                        data: training.certificate.url || training.certificate.data,
                                                        name: training.certificate.name || 'Certificate.pdf',
                                                        mimeType: training.certificate.mimeType || 'application/pdf'
                                                    })}
                                                    className="text-teal-600 hover:text-teal-800 p-1.5 hover:bg-teal-100 rounded-lg transition-all"
                                                    title="View Certificate"
                                                >
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                                </button>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-end gap-2 transition-opacity">
                                                {!training.isSystem && (isAdmin() || hasPermission('hrm_employees_view_training', 'isEdit')) ? (
                                                    <>
                                                        <button
                                                            onClick={() => onEditTraining(training, training.index)}
                                                            className="p-1.5 text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded"
                                                            title="Edit"
                                                            disabled={deletingTrainingIndex === training.index}
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                        </button>
                                                        <button
                                                            onClick={() => onDeleteTraining(training.index)}
                                                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded"
                                                            title="Delete"
                                                            disabled={deletingTrainingIndex === training.index}
                                                        >
                                                            {deletingTrainingIndex === training.index ? (
                                                                <div className="h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                                                            ) : (
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                            )}
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] text-gray-400 italic font-medium px-2 py-1 bg-gray-50 rounded">System Record</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="7" className="py-20 text-center text-gray-400 font-medium">
                                        No training records found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

import { useMemo } from 'react';
