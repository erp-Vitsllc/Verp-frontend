'use client';

export default function TrainingCard({
    training,
    index,
    employee,
    isAdmin,
    hasPermission,
    formatDate,
    deletingTrainingIndex,
    onViewCertificate,
    onEdit,
    onDelete
}) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-xl font-semibold text-gray-800">{training.trainingName || 'Training'}</h3>
                <div className="flex items-center gap-2">
                    {training.certificate?.data && (
                        <button
                            onClick={onViewCertificate}
                            className="text-green-600 hover:text-green-700"
                            title="View Certificate"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                        </button>
                    )}
                    {(isAdmin() || hasPermission('hrm_employees_view_training', 'isEdit')) && (
                        <button
                            onClick={onEdit}
                            className="text-blue-600 hover:text-blue-700"
                            title="Edit"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                    )}
                    {(isAdmin() || hasPermission('hrm_employees_view_training', 'isDelete')) && (
                        <button
                            onClick={onDelete}
                            className="text-red-600 hover:text-red-700"
                            title="Delete"
                            disabled={deletingTrainingIndex === index}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    )}
                </div>
            </div>
            <div>
                {[
                    { label: 'Details', value: training.trainingDetails },
                    { label: 'From', value: training.trainingFrom },
                    { label: 'Date', value: training.trainingDate ? formatDate(training.trainingDate) : null },
                    { label: 'Cost', value: training.trainingCost ? `AED ${training.trainingCost.toFixed(2)}` : null }
                ]
                    .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                    .map((row, rowIndex, arr) => (
                        <div
                            key={row.label}
                            className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${rowIndex !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                        >
                            <span className="text-gray-500">{row.label}</span>
                            <span className="text-gray-500">{row.value}</span>
                        </div>
                    ))}
            </div>
        </div>
    );
}




