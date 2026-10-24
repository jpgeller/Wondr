'use client';

import { useId } from 'react';

export default function OnboardingLogo({ large = false }: { large?: boolean }) {
  const mask = useId();
  // Use the supplied wordmark as a luminance mask, retaining its exact letter shapes.
  return <svg role="img" aria-label="Wondr" viewBox="60 180 334 98" width={large ? 206 : 74} height={large ? 62 : 23}>
    <defs><mask id={mask} maskUnits="userSpaceOnUse" x="60" y="180" width="334" height="98">
      <image href="/brand/wondr-reference.png" width="960" height="560" />
    </mask></defs>
    <g mask={`url(#${mask})`}>
      <rect x="60" y="180" width="334" height="98" fill="currentColor" />
      <rect x="152" y="180" width="60" height="98" fill="#ff8a34" />
    </g>
  </svg>;
}
