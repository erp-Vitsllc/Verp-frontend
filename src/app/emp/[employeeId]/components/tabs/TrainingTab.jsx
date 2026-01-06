'use client';

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
    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">Training Details</h3>
                    {(isAdmin() || hasPermission('hrm_employees_view_training', 'isCreate')) && (
                        <button
                            onClick={onOpenTrainingModal}
                            className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                        >
                            Add Training
                            <span className="text-lg leading-none">+</span>
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto w-full max-w-full">
                    <table className="w-full min-w-0 table-auto">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Training Details</th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Provider</th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Starting Date</th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Training Cost</th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Certificate</th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employee?.trainingDetails && employee.trainingDetails.length > 0 ? (
                                employee.trainingDetails.map((training, index) => (
                                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="py-3 px-4 text-sm text-gray-500 font-medium">
                                            {training.trainingName || '—'}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-500">
                                            {training.provider || training.trainingFrom || '—'}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-500">
                                            {training.trainingDate ? formatDate(training.trainingDate) : '—'}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-500">
                                            {training.trainingCost ? `${training.trainingCost}` : '—'}
                                        </td>
                                        <td className="py-3 px-4 text-sm text-gray-500">
                                            {training.certificate?.url || training.certificate?.data ? (
                                                <button
                                                    onClick={() => onViewDocument({
                                                        data: training.certificate.url || training.certificate.data,
                                                        name: training.certificate.name || 'Certificate.pdf',
                                                        mimeType: training.certificate.mimeType || 'application/pdf'
                                                    })}
                                                    className="text-blue-600 hover:text-blue-700 underline truncate max-w-[200px] block"
                                                    title={training.certificate.name || 'View Certificate'}
                                                >
                                                    {training.certificate.name || 'View Certificate'}
                                                </button>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-sm">
                                            {(isAdmin() || hasPermission('hrm_employees_view_training', 'isEdit')) ? (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => onEditTraining(training, index)}
                                                        className="text-blue-600 hover:text-blue-700"
                                                        title="Edit"
                                                        disabled={deletingTrainingIndex === index}
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => onDeleteTraining(index)}
                                                        className="text-red-600 hover:text-red-700"
                                                        title="Delete"
                                                        disabled={deletingTrainingIndex === index}
                                                    >
                                                        {deletingTrainingIndex === index ? (
                                                            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                        ) : (
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                            </svg>
                                                        )}
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center text-gray-400 text-sm">
                                        No training details available
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
