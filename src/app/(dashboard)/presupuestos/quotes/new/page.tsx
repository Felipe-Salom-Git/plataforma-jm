import { redirect } from 'next/navigation';

export default function LegacyQuotesNewRedirect() {
    redirect('/quotes/new');
}
