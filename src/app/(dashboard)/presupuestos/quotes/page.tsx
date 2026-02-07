import { redirect } from 'next/navigation';

export default function LegacyQuotesListRedirect() {
  redirect('/quotes');
}
