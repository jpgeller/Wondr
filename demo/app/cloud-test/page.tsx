import { notFound } from 'next/navigation';
import { cloudTestEnabled, exampleProfile } from '@/lib/agent/example-profile';
import CloudTest from './test';

export const dynamic = 'force-dynamic';

export default function Page() {
  if (!cloudTestEnabled()) notFound();
  return <CloudTest profile={exampleProfile()} />;
}
