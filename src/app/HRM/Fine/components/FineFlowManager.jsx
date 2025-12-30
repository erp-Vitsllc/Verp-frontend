'use client';

import { useState } from 'react';
import FineTypeSelectionModal from './FineTypeSelectionModal';
import ViolationTypeSelectionModal from './ViolationTypeSelectionModal';
import DamageTypeSelectionModal from './DamageTypeSelectionModal';
import AddVehicleFineModal from './AddVehicleFineModal';
import AddSafetyFineModal from './AddSafetyFineModal';
import AddProjectDamageModal from './AddProjectDamageModal';
import AddLossDamageModal from './AddLossDamageModal';
import AddOtherDamageModal from './AddOtherDamageModal';
import AddFineModal from './AddFineModal'; // Assuming we reuse this for general fines

export default function FineFlowManager({ isOpen, onClose, onSuccess, employees = [] }) {
    const [step, setStep] = useState('category'); // category, violation_type, damage_type, vehicle_form, safety_form, project_damage_form, loss_damage_form, other_damage_form, general_form
    const [selections, setSelections] = useState({
        category: '',
        subCategory: ''
    });

    if (!isOpen) return null;

    const handleCategorySelect = (category) => {
        if (category === 'Violation') {
            setSelections(prev => ({ ...prev, category }));
            setStep('violation_type');
        } else if (category === 'Damage') {
            setSelections(prev => ({ ...prev, category }));
            setStep('damage_type');
        }
    };

    const handleViolationTypeSelect = (subCategory) => {
        if (subCategory === 'Vehicle Fine') {
            setSelections(prev => ({ ...prev, subCategory }));
            setStep('vehicle_form');
        } else if (subCategory === 'Safety Fine') {
            setSelections(prev => ({ ...prev, subCategory }));
            setStep('safety_form');
        } else {
            // Others
            setSelections(prev => ({ ...prev, subCategory }));
            setStep('general_form');
        }
    };

    const handleDamageTypeSelect = (subCategory) => {
        if (subCategory === 'Project Damage') {
            setSelections(prev => ({ ...prev, subCategory }));
            setStep('project_damage_form');
        } else if (subCategory === 'Loss & Damage') {
            setSelections(prev => ({ ...prev, subCategory }));
            setStep('loss_damage_form');
        } else if (subCategory === 'Other Damage') {
            setSelections(prev => ({ ...prev, subCategory }));
            setStep('other_damage_form');
        }
    };

    const handleBack = () => {
        if (step === 'violation_type' || step === 'damage_type') {
            setStep('category');
        } else if (step === 'vehicle_form' || step === 'safety_form') {
            setStep('violation_type');
        } else if (step === 'project_damage_form' || step === 'loss_damage_form' || step === 'other_damage_form') {
            setStep('damage_type');
        } else if (step === 'general_form') {
            if (selections.category === 'Violation') setStep('violation_type');
            else if (selections.category === 'Damage') setStep('damage_type');
            else setStep('category');
        }
    };

    const handleClose = () => {
        setStep('category');
        setSelections({ category: '', subCategory: '' });
        onClose();
    };

    return (
        <>
            {step === 'category' && (
                <FineTypeSelectionModal
                    isOpen={isOpen}
                    onClose={handleClose}
                    onSelect={handleCategorySelect}
                />
            )}

            {step === 'violation_type' && (
                <ViolationTypeSelectionModal
                    isOpen={isOpen}
                    onClose={handleClose}
                    onSelect={handleViolationTypeSelect}
                    onBack={handleBack}
                />
            )}

            {step === 'damage_type' && (
                <DamageTypeSelectionModal
                    isOpen={isOpen}
                    onClose={handleClose}
                    onSelect={handleDamageTypeSelect}
                    onBack={handleBack}
                />
            )}

            {step === 'vehicle_form' && (
                <AddVehicleFineModal
                    isOpen={isOpen}
                    onClose={handleClose}
                    onSuccess={() => {
                        onSuccess();
                        handleClose();
                    }}
                    employees={employees}
                    onBack={handleBack}
                />
            )}

            {step === 'safety_form' && (
                <AddSafetyFineModal
                    isOpen={isOpen}
                    onClose={handleClose}
                    onSuccess={() => {
                        onSuccess();
                        handleClose();
                    }}
                    employees={employees}
                    onBack={handleBack}
                />
            )}

            {step === 'project_damage_form' && (
                <AddProjectDamageModal
                    isOpen={isOpen}
                    onClose={handleClose}
                    onSuccess={() => {
                        onSuccess();
                        handleClose();
                    }}
                    employees={employees}
                    onBack={handleBack}
                />
            )}

            {step === 'loss_damage_form' && (
                <AddLossDamageModal
                    isOpen={isOpen}
                    onClose={handleClose}
                    onSuccess={() => {
                        onSuccess();
                        handleClose();
                    }}
                    employees={employees}
                    onBack={handleBack}
                />
            )}

            {step === 'other_damage_form' && (
                <AddOtherDamageModal
                    isOpen={isOpen}
                    onClose={handleClose}
                    onSuccess={() => {
                        onSuccess();
                        handleClose();
                    }}
                    employees={employees}
                    onBack={handleBack}
                />
            )}

            {step === 'general_form' && (
                <AddFineModal
                    isOpen={isOpen}
                    onClose={handleClose}
                    onSuccess={() => {
                        onSuccess();
                        handleClose();
                    }}
                    employees={employees}
                    initialData={{
                        category: selections.category,
                        subCategory: selections.subCategory
                    }}
                />
            )}
        </>
    );
}
