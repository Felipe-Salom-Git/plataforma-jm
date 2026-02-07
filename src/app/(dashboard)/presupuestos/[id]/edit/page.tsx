import { redirect } from 'next/navigation';

export default function LegacyEditBudgetRedirect({ params }: { params: { id: string } }) {
    redirect(`/quotes/${params.id}/edit`);
}
