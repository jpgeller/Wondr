import AccountPlanner from '@/components/account-planner';
import { currentUser } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AgentTest({ searchParams }: { searchParams: Promise<{ plan?: string; ready?: string }> }) {
  const params = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/agent-test?${new URLSearchParams(params)}`)}`);
  if (!params.plan) redirect('/');
  return <AccountPlanner planId={params.plan} startReady={params.ready === '1'} />;
}
