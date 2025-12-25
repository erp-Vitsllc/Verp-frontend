'use client';

// Import cards directly to test if DynamicCards re-exports are causing issues
import PersonalDetailsCard from '../cards/PersonalDetailsCard';
import PermanentAddressCard from '../cards/PermanentAddressCard';
import CurrentAddressCard from '../cards/CurrentAddressCard';
import EmergencyContactCard from '../cards/EmergencyContactCard';

export default function PersonalTab({
    employee,
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
    onDeleteContact
}) {
    return (
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
    );
}

