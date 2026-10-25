import { notFound } from 'next/navigation';
import DesignPreview from './preview';

// A local-only review screen. Never available on Vercel, including previews.
export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DesignPreview />;
}
