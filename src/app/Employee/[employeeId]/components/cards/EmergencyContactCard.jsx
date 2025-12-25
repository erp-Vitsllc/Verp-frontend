'use client';

export default function EmergencyContactCard({
    employee,
    isAdmin,
    hasPermission,
    hasContactDetails,
    getExistingContacts,
    deletingContactId,
    onAddContact,
    onEditContact,
    onDeleteContact
}) {
    // Show only if permission isActive is true AND data exists
    if (!(isAdmin() || hasPermission('hrm_employees_view_emergency', 'isView')) || !hasContactDetails) {
        return null;
    }

    const contacts = getExistingContacts();

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 break-inside-avoid mb-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h3 className="text-xl font-semibold text-gray-800">Emergency Contact</h3>
                {(isAdmin() || hasPermission('hrm_employees_view_emergency', 'isCreate')) && (
                    <button
                        onClick={onAddContact}
                        className="px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
                    >
                        Add Emergency Contact
                        <span className="text-base leading-none">+</span>
                    </button>
                )}
            </div>
            <div>
                {contacts.map((contact, contactIndex) => {
                    const contactFields = [
                        { label: 'Contact', value: `Contact ${contactIndex + 1}`, isHeader: true },
                        { label: 'Relation', value: contact.relation ? contact.relation.charAt(0).toUpperCase() + contact.relation.slice(1) : 'Self' },
                        { label: 'Name', value: contact.name },
                        { label: 'Phone Number', value: contact.number }
                    ].filter(field => field.value && field.value.trim() !== '');

                    return contactFields.map((field, fieldIndex, arr) => (
                        <div
                            key={`${contact.id || contactIndex}-${field.label}`}
                            className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${fieldIndex !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                        >
                            {field.isHeader ? (
                                <>
                                    <span className="text-gray-800 font-semibold">{field.value}</span>
                                    <div className="flex items-center gap-3">
                                        {(isAdmin() || hasPermission('hrm_employees_view_emergency', 'isEdit')) && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEditContact(contact.id, contact.index);
                                                }}
                                                className="text-blue-600 hover:text-blue-700"
                                                title="Edit Contact"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                </svg>
                                            </button>
                                        )}
                                        {(isAdmin() || hasPermission('hrm_employees_view_emergency', 'isDelete')) && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteContact(contact.id, contact.index);
                                                }}
                                                disabled={deletingContactId === (contact.id || `legacy-${contact.index}`)}
                                                className="text-red-500 hover:text-red-600 text-xs font-semibold disabled:opacity-60"
                                            >
                                                {deletingContactId === (contact.id || `legacy-${contact.index}`) ? 'Removing...' : 'Remove'}
                                            </button>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <span className="text-gray-500">{field.label}</span>
                                    <span className="text-gray-500">{field.value}</span>
                                </>
                            )}
                        </div>
                    ));
                }).flat()}
            </div>
        </div>
    );
}




