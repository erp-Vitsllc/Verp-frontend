'use client';

// Import cards directly to test if DynamicCards re-exports are causing issues
import PersonalDetailsCard from '../cards/PersonalDetailsCard';
import PermanentAddressCard from '../cards/PermanentAddressCard';
import CurrentAddressCard from '../cards/CurrentAddressCard';
import EmergencyContactCard from '../cards/EmergencyContactCard';

export default function PersonalTab({
    employee,
    activeSubTab,
    setActiveSubTab,
    isAdmin,
    hasPermission,
    getCountryName,
    getStateName,
    formatDate,
    hasPermanentAddress,
    hasCurrentAddress,
    hasContactDetails,
    getExistingContacts,
    deletingContactId,
    onEditPersonal,
    onOpenAddressModal,
    onOpenContactModal,
    onEditContact,
    onDeleteContact,
    // Add Education & Experience props
    educationDetails,
    experienceDetails,
    onOpenEducationModal,
    onOpenExperienceModal,
    onEditEducation,
    onEditExperience,
    onDeleteEducation,
    onDeleteExperience,
    deletingEducationId,
    deletingExperienceId,
    onViewDocument
}) {
    return (
        <div>
            {/* Sub-tabs for Personal Information */}
            <div className="flex gap-3 mb-6">
                <button
                    onClick={() => setActiveSubTab('personal-info')}
                    className={`px-6 py-2 text-sm font-semibold rounded-md transition-colors border ${activeSubTab === 'personal-info'
                        ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                        : 'bg-transparent text-gray-500 border-gray-300 hover:text-gray-700'
                        }`}
                >
                    Personal Information
                </button>
                <button
                    onClick={() => setActiveSubTab('education')}
                    className={`px-6 py-2 text-sm font-semibold rounded-md transition-colors border ${activeSubTab === 'education'
                        ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                        : 'bg-transparent text-gray-500 border-gray-300 hover:text-gray-700'
                        }`}
                >
                    Education
                </button>
                <button
                    onClick={() => setActiveSubTab('experience')}
                    className={`px-6 py-2 text-sm font-semibold rounded-md transition-colors border ${activeSubTab === 'experience'
                        ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                        : 'bg-transparent text-gray-500 border-gray-300 hover:text-gray-700'
                        }`}
                >
                    Experience
                </button>
            </div>

            {activeSubTab === 'personal-info' && (
                <div className="space-y-6">
                    <div className="columns-1 lg:columns-2 gap-6 space-y-0">
                        <PersonalDetailsCard
                            employee={employee}
                            isAdmin={isAdmin}
                            hasPermission={hasPermission}
                            getCountryName={getCountryName}
                            formatDate={formatDate}
                            onEdit={onEditPersonal}
                        />

                        <PermanentAddressCard
                            employee={employee}
                            isAdmin={isAdmin}
                            hasPermission={hasPermission}
                            getCountryName={getCountryName}
                            getStateName={getStateName}
                            hasPermanentAddress={hasPermanentAddress}
                            onEdit={() => onOpenAddressModal('permanent')}
                        />

                        <CurrentAddressCard
                            employee={employee}
                            isAdmin={isAdmin}
                            hasPermission={hasPermission}
                            getCountryName={getCountryName}
                            getStateName={getStateName}
                            hasCurrentAddress={hasCurrentAddress}
                            onEdit={() => onOpenAddressModal('current')}
                        />

                        <EmergencyContactCard
                            employee={employee}
                            isAdmin={isAdmin}
                            hasPermission={hasPermission}
                            hasContactDetails={hasContactDetails}
                            getExistingContacts={getExistingContacts}
                            deletingContactId={deletingContactId}
                            onAddContact={() => onOpenContactModal()}
                            onEditContact={(contactId, contactIndex) => onOpenContactModal(contactId, contactIndex)}
                            onDeleteContact={(contactId, contactIndex) => onDeleteContact(contactId, contactIndex)}
                        />
                    </div>

                    {/* Action Buttons */}
                    {(!hasContactDetails || !hasCurrentAddress || !hasPermanentAddress) && (
                        <div className="mt-6">
                            <div className="flex flex-wrap gap-2" style={{ width: '550px' }}>
                                {!hasCurrentAddress && (
                                    <button
                                        onClick={() => onOpenAddressModal('current')}
                                        style={{ width: '174px' }}
                                        className="px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                                    >
                                        Current Address
                                        <span className="text-sm leading-none font-bold">+</span>
                                    </button>
                                )}
                                {!hasPermanentAddress && (
                                    <button
                                        onClick={() => onOpenAddressModal('permanent')}
                                        className="px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                                    >
                                        Permanent Address
                                        <span className="text-sm leading-none font-bold">+</span>
                                    </button>
                                )}
                                {!hasContactDetails && (
                                    <button
                                        onClick={() => onOpenContactModal()}
                                        style={{ width: '200px' }}
                                        className="px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                                    >
                                        Emergency Contact
                                        <span className="text-sm leading-none font-bold">+</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeSubTab === 'education' && (
                <div className="space-y-6">
                    {(isAdmin() || hasPermission('hrm_employees_view_education', 'isView')) && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-gray-800">Education Details</h3>
                                {(isAdmin() || hasPermission('hrm_employees_view_education', 'isCreate')) && (
                                    <button
                                        onClick={onOpenEducationModal}
                                        className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                    >
                                        Add Education
                                        <span className="text-lg leading-none">+</span>
                                    </button>
                                )}
                            </div>

                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-0 table-auto">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">University / Board</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">College / Institute</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Course</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Field of Study</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Completed Year</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Certificate</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {educationDetails && educationDetails.length > 0 ? (
                                            educationDetails.map((education) => {
                                                const educationId = education._id || education.id;
                                                return (
                                                    <tr key={educationId} className="border-b border-gray-100 hover:bg-gray-50">
                                                        <td className="py-3 px-4 text-sm text-gray-500">{education.universityOrBoard || education.university || education.board || '—'}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">{education.collegeOrInstitute || education.college || education.institute || '—'}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">{education.course || '—'}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">{education.fieldOfStudy || '—'}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">{education.completedYear || '—'}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                            {education.certificate?.name ? (
                                                                <button
                                                                    onClick={() => {
                                                                        onViewDocument({
                                                                            data: education.certificate.data || '',
                                                                            name: education.certificate.name || '',
                                                                            mimeType: education.certificate.mimeType || '',
                                                                            moduleId: 'hrm_employees_view_education'
                                                                        });
                                                                    }}
                                                                    className="text-blue-600 hover:text-blue-700 underline"
                                                                >
                                                                    {education.certificate.name}
                                                                </button>
                                                            ) : (
                                                                '—'
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => onEditEducation(education)}
                                                                    className="text-blue-600 hover:text-blue-700"
                                                                    disabled={deletingEducationId === educationId}
                                                                >
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => onDeleteEducation(educationId)}
                                                                    className="text-red-600 hover:text-red-700"
                                                                    disabled={deletingEducationId === educationId}
                                                                >
                                                                    {deletingEducationId === educationId ? (
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
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={7} className="py-16 text-center text-gray-400 text-sm">
                                                    No education details available
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeSubTab === 'experience' && (
                <div className="space-y-6">
                    {(isAdmin() || hasPermission('hrm_employees_view_experience', 'isView')) && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-gray-800">Experience Details</h3>
                                {(isAdmin() || hasPermission('hrm_employees_view_experience', 'isCreate')) && (
                                    <button
                                        onClick={onOpenExperienceModal}
                                        className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                    >
                                        Add Experience
                                        <span className="text-lg leading-none">+</span>
                                    </button>
                                )}
                            </div>

                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-0 table-auto">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Company</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Designation</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Start Date</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">End Date</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Certificate</th>
                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {experienceDetails && experienceDetails.length > 0 ? (
                                            experienceDetails.map((experience) => {
                                                const experienceId = experience._id || experience.id;
                                                return (
                                                    <tr key={experienceId} className="border-b border-gray-100 hover:bg-gray-50">
                                                        <td className="py-3 px-4 text-sm text-gray-500">{experience.company || '—'}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">{experience.designation || '—'}</td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                            {experience.startDate ? formatDate(experience.startDate) : '—'}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                            {experience.endDate ? formatDate(experience.endDate) : '—'}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                            {experience.certificate?.name ? (
                                                                <button
                                                                    onClick={() => {
                                                                        onViewDocument({
                                                                            data: experience.certificate.data || '',
                                                                            name: experience.certificate.name || '',
                                                                            mimeType: experience.certificate.mimeType || '',
                                                                            moduleId: 'hrm_employees_view_experience'
                                                                        });
                                                                    }}
                                                                    className="text-blue-600 hover:text-blue-700 underline"
                                                                >
                                                                    {experience.certificate.name}
                                                                </button>
                                                            ) : (
                                                                '—'
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => onEditExperience(experience)}
                                                                    className="text-blue-600 hover:text-blue-700"
                                                                    disabled={deletingExperienceId === experienceId}
                                                                >
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => onDeleteExperience(experienceId)}
                                                                    className="text-red-600 hover:text-red-700"
                                                                    disabled={deletingExperienceId === experienceId}
                                                                >
                                                                    {deletingExperienceId === experienceId ? (
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
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="py-16 text-center text-gray-400 text-sm">
                                                    No experience details available
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

