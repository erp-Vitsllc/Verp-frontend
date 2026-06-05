'use client';

import { useParams } from 'next/navigation';
import AddEmployee from '../page';

export default function EditEmployeePage() {
    const params = useParams();
    const id = params?.id;

    return <AddEmployee id={id} />;
}
