import { redirect } from 'next/navigation';

export default function LegacyBudgetRedirect({ params }: { params: { id: string } }) {
    redirect(`/quotes/${params.id}`);
}
