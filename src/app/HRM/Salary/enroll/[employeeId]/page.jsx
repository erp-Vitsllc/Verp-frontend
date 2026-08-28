'use client';

import { useParams } from 'next/navigation';
import HistoricalSalarySetupView from '../HistoricalSalarySetupView';

export default function HistoricalSalarySetupPage() {
    const params = useParams();
    const employeeId = decodeURIComponent(String(params?.employeeId || ''));
    return <HistoricalSalarySetupView employeeId={employeeId} />;
}
