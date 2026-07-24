'use client';

import FineFormCard1 from './FineFormCard1';
import FineFormCard2 from './FineFormCard2';
import FineFormCard3 from './FineFormCard3';
import FineFormCard4 from './FineFormCard4';
import FineFormCard5 from './FineFormCard5';
import FineFormCardGroupParties from './FineFormCardGroupParties';
import EntityPaymentDetailsCard from '../../shared/components/EntityPaymentDetailsCard';
import { isLossDamageFineType } from './LossDamageFineDetailsSection';
import { isApprovedFineStatus } from '../utils/fineApprovedEdit';

/**
 * Fine Form tab — two independent columns so row heights don't force-align across cards.
 * Group Fine overview: Asset Fine Report (with vehicle details) + Group Parties (no HR card).
 * Employee financial cards (summary + schedules) are identical across all fine types for the same employee.
 */
export default function FineFormCards(props) {
    const {
        fine,
        isCompanyFine = false,
        employeeOwnerId,
        showGroupPlaceholder = false,
        isGroupOverview = false,
    } = props;

    if (!fine) return null;

    const showLossDamageCards = isLossDamageFineType(fine);
    const groupOverview = Boolean(isGroupOverview || showGroupPlaceholder);
    const showEmployeeFinancials = Boolean(employeeOwnerId) && !isCompanyFine && !groupOverview;

    const fineTotalPayable = isCompanyFine && props.getCompShare
        ? Number(props.getCompShare(fine)) || 0
        : props.getEmpShare
            ? Number(props.getEmpShare(fine, employeeOwnerId)) || 0
            : Number(fine.totalFineAmount || fine.fineAmount || 0) ||
              Number(fine.employeeAmount || 0) + Number(fine.companyAmount || 0) + Number(fine.serviceCharge || 0);
    const fineEmployeeId =
        employeeOwnerId ||
        fine.employeeId ||
        fine.assignedEmployees?.find(
            (ae) => ae.employeeId && !['VEGA-HR-0000', 'VEGA_INTERNAL'].includes(ae.employeeId),
        )?.employeeId ||
        '';

    const financialCardProps = {
        ...props,
        showFinancialCards: showEmployeeFinancials,
        allEmployeeLoans: props.allEmployeeLoans || [],
    };

    const paymentDetailsCard = !groupOverview ? (
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
            allowPay={Boolean(props.allowPay)}
            onPaymentSuccess={props.onPaymentSuccess}
        />
    ) : null;

    // Group Fine overview — Asset report (full vehicle details) + party breakdown (no HR card)
    if (groupOverview) {
        return (
            <div className="flex flex-col lg:flex-row gap-6 items-start w-full min-w-0 print:hidden">
                <div className="flex flex-col gap-6 flex-1 min-w-0 w-full">
                    <FineFormCard1 {...props} showGroupPlaceholder />
                </div>
                <div className="flex flex-col gap-6 flex-1 min-w-0 w-full">
                    <FineFormCardGroupParties
                        fine={fine}
                        companyName={
                            props.companyName ||
                            fine.company?.name ||
                            fine.companyName
                        }
                        formatDate={props.formatDate}
                        canEditPartyPayables={Boolean(props.canEditPartyPayables)}
                        onPartyPayablesChange={props.onPartyPayablesChange}
                    />
                </div>
            </div>
        );
    }

    const individualPartiesCard = (
        <FineFormCardGroupParties
            fine={fine}
            companyName={
                props.companyName ||
                fine.company?.name ||
                fine.companyName
            }
            formatDate={props.formatDate}
            canEditPartyPayables={Boolean(props.canEditPartyPayables)}
            onPartyPayablesChange={props.onPartyPayablesChange}
        />
    );

    if (!showEmployeeFinancials) {
        return (
            <div className="flex flex-col lg:flex-row gap-6 items-start w-full min-w-0 print:hidden">
                <div className="flex flex-col gap-6 flex-1 min-w-0 w-full">
                    <FineFormCard1 {...props} />
                    {paymentDetailsCard}
                </div>
                <div className="flex flex-col gap-6 flex-1 min-w-0 w-full">
                    {individualPartiesCard}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full min-w-0 print:hidden">
            <div className="flex flex-col gap-6 flex-1 min-w-0 w-full">
                <FineFormCard1 {...props} />
                <FineFormCard3 {...financialCardProps} />
                {paymentDetailsCard}
            </div>

            <div className="flex flex-col gap-6 flex-1 min-w-0 w-full">
                {individualPartiesCard}
                {showLossDamageCards ? <FineFormCard2 {...props} /> : null}
                <FineFormCard4 {...financialCardProps} />
                <FineFormCard5 {...financialCardProps} />
            </div>
        </div>
    );
}
