'use client';

// Import card directly to test if DynamicCards re-exports are causing issues
import TrainingCard from '../cards/TrainingCard';

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
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-gray-800">Training Details</h2>
                {(isAdmin() || hasPermission('hrm_employees_view_training', 'isCreate')) && (
                    <button
                        onClick={onOpenTrainingModal}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
                    >
                        <span>+</span> Add Training
                    </button>
                )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {employee?.trainingDetails && employee.trainingDetails.length > 0 ? (
                    employee.trainingDetails.map((training, index) => (
                        <TrainingCard
                            key={index}
                            training={training}
                            index={index}
                            employee={employee}
                            isAdmin={isAdmin}
                            hasPermission={hasPermission}
                            formatDate={formatDate}
                            deletingTrainingIndex={deletingTrainingIndex}
                            onViewCertificate={() => {
                                if (training.certificate?.data) {
                                    onViewDocument({
                                        data: training.certificate.data,
                                        name: training.certificate.name || `${training.trainingName} Certificate.pdf`,
                                        mimeType: training.certificate.mimeType || 'application/pdf'
                                    });
                                }
                            }}
                            onEdit={() => onEditTraining(training, index)}
                            onDelete={() => onDeleteTraining(index)}
                        />
                    ))
                ) : (
                    <div className="col-span-2 py-16 text-center text-gray-400 text-sm">
                        No training details available
                    </div>
                )}
            </div>
        </div>
    );
}

