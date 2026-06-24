'use client';

import LoanFormCard1 from './LoanFormCard1';
import LoanFormCard2 from './LoanFormCard2';
import EntityPaymentDetailsCard from '../../shared/components/EntityPaymentDetailsCard';
import FineFormCard3 from '../../Fine/components/FineFormCard3';
import FineFormCard4 from '../../Fine/components/FineFormCard4';
import FineFormCard5 from '../../Fine/components/FineFormCard5';
import { loanToScheduleView, EMPTY_LOAN_FORM_SUMMARIES } from '../utils/buildLoanFormSummaries';
import { isApprovedLoanRecord } from '../utils/loanScheduleUtils';

/**
 * Loan / Advance Form tab — two independent columns (matches Fine Form layout).
 * Left: Application Details → Payment Summary → Payment Details
 * Right: HR and Accounts → Current Deduction Schedule → New Schedule
 */
export default function LoanFormCards(props) {
    const {
        loan,
        fineSummaries,
        allEmployeeFines = [],
        allEmployeeLoans = [],
        employeeOwnerId,
    } = props;

    if (!loan) return null;

    const scheduleView = loanToScheduleView(loan);
    const financialCardProps = {
        fine: scheduleView,
        showFinancialCards: true,
        fineSummaries: fineSummaries || EMPTY_LOAN_FORM_SUMMARIES,
        allEmployeeFines,
        allEmployeeLoans,
        viewingLoan: loan,
        employeeOwnerId,
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full min-w-0 print:hidden">
            <div className="flex flex-col gap-6 flex-1 min-w-0 w-full">
                <LoanFormCard1 {...props} />
                <FineFormCard3 {...financialCardProps} />
                <EntityPaymentDetailsCard
                    entityType={loan.type === 'Advance' ? 'Advance' : 'Loan'}
                    referenceId={loan.loanId}
                    relatedEntityId={loan._id || loan.id}
                    totalPayable={loan.amount}
                    paidAmount={loan.paidAmount}
                    typeLabel={loan.type === 'Advance' ? 'Advance' : 'Loan'}
                    entityRecord={loan}
                    employeeId={loan.employeeId}
                    isPayable={isApprovedLoanRecord(loan)}
                    onPaymentSuccess={props.onPaymentSuccess}
                />
            </div>
            <div className="flex flex-col gap-6 flex-1 min-w-0 w-full">
                <LoanFormCard2 {...props} />
                <FineFormCard4 {...financialCardProps} />
                <FineFormCard5 {...financialCardProps} />
            </div>
        </div>
    );
}
