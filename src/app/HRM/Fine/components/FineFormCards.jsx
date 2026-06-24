'use client';

import FineFormCard1 from './FineFormCard1';
import FineFormCard2 from './FineFormCard2';
import FineFormCard3 from './FineFormCard3';
import FineFormCard4 from './FineFormCard4';
import FineFormCard5 from './FineFormCard5';
import EntityPaymentDetailsCard from '../../shared/components/EntityPaymentDetailsCard';
import { isLossDamageFineType } from './LossDamageFineDetailsSection';
import { isApprovedFineStatus } from '../utils/fineApprovedEdit';

/**
 * Fine Form tab — two independent columns so row heights don't force-align across cards.
 * Left: Asset Fine Report → Payment Summary
 * Right: HR & Accounts → Current Deduction Schedule → New Schedule
 */
export default function FineFormCards(props) {
    const { fine } = props;

    if (!fine) return null;

    const showLossDamageCards = isLossDamageFineType(fine);
    const fineTotalPayable = props.getEmpShare
        ? Number(props.getEmpShare(fine)) || 0
        : Number(fine.totalFineAmount || fine.fineAmount || 0) ||
          Number(fine.employeeAmount || 0) + Number(fine.companyAmount || 0) + Number(fine.serviceCharge || 0);
    const fineEmployeeId =
        props.employeeOwnerId ||
        fine.employeeId ||
        fine.assignedEmployees?.find(
            (ae) => ae.employeeId && !['VEGA-HR-0000', 'VEGA_INTERNAL'].includes(ae.employeeId)
        )?.employeeId ||
        '';
    const paymentDetailsCard = (
        <EntityPaymentDetailsCard
            entityType="Fine"
            referenceId={fine.fineId}
            relatedEntityId={fine._id}
            totalPayable={fineTotalPayable}
            paidAmount={fine.paidAmount}
            typeLabel="Fine"
            entityRecord={fine}
            employeeId={fineEmployeeId}
            isPayable={isApprovedFineStatus(fine.fineStatus) && fineTotalPayable > 0}
            onPaymentSuccess={props.onPaymentSuccess}
        />
    );

    if (!showLossDamageCards) {
        return (
            <div className="flex flex-col gap-6 w-full min-w-0 print:hidden">
                <FineFormCard1 {...props} />
                {paymentDetailsCard}
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full min-w-0 print:hidden">
            <div className="flex flex-col gap-6 flex-1 min-w-0 w-full">
                <FineFormCard1 {...props} />
                <FineFormCard3 {...props} />
                {paymentDetailsCard}
            </div>

            <div className="flex flex-col gap-6 flex-1 min-w-0 w-full">
                <FineFormCard2 {...props} />
                <FineFormCard4 {...props} />
                <FineFormCard5 {...props} />
            </div>
        </div>
    );
}
