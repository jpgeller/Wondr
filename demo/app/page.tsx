import { redirect } from 'next/navigation';
import OnboardingPage from '@/components/onboarding-page';

export default async function Home({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  // Preserve links to plans made before the onboarding flow was added.
  if (plan) redirect(`/agent-test?plan=${encodeURIComponent(plan)}`);
  return <OnboardingPage />;
}
