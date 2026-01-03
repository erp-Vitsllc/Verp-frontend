'use client';

import { useState, useRef, useEffect } from 'react';
import { Trash2, ChevronDown } from 'lucide-react';

export default function DropdownWithDelete({
    options = [],
    value,
    onChange,
    onDelete,
    onAdd,
    placeholder = "Select Option",
    addNewLabel = "+ Add New",
    disabled = false,
    error = false
}) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    const handleDelete = (e, option) => {
        e.stopPropagation(); // Prevent selecting the option when clicking delete
        onDelete(option);
    };

    const handleAdd = () => {
        onAdd();
        setIsOpen(false);
    };

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            {/* Trigger Button (Looks like select input) */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full h-10 px-3 flex items-center justify-between rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none transition-all ${error ? 'border-red-500 ring-2 ring-red-400/20' :
                    isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-[#E5E7EB]'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}`}
                disabled={disabled}
            >
                <span className={`block truncate ${!selectedOption ? 'text-gray-400' : ''}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="py-1">
                        {options.length > 0 ? (
                            options.map((option) => (
                                <div
                                    key={option.value}
                                    onClick={() => handleSelect(option.value)}
                                    className={`relative flex items-center justify-between px-3 py-2 text-sm cursor-pointer group ${value === option.value ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    <span className="truncate pr-8">{option.label}</span>

                                    {/* Delete Button (Only visible on hover or if it's the selected item, but we'll show on hover for better UX) */}
                                    {!option.isSystem && (
                                        <button
                                            type="button"
                                            onClick={(e) => handleDelete(e, option)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-2 text-sm text-gray-400 text-center">No options available</div>
                        )}

                        {/* Divider */}
                        <div className="border-t border-gray-100 my-1"></div>

                        {/* Add New Option */}
                        {onAdd && (
                            <div
                                onClick={handleAdd}
                                className="px-3 py-2 text-sm text-blue-600 font-medium cursor-pointer hover:bg-blue-50 flex items-center justify-center gap-2 transition-colors"
                            >
                                <span>{addNewLabel}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
