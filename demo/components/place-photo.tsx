'use client';

import { useEffect, useState } from 'react';
import type { PlacePhoto as Photo } from '@/lib/place-photo';
import styles from './onboarding.module.css';

export default function PlacePhoto({ venueName, address, placeId }: { venueName: string; address: string; placeId?: string }) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/place-photo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `${venueName}, ${address}`, placeId }), signal: controller.signal,
    }).then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!controller.signal.aborted) setPhoto(data?.photo || null); })
      .catch(() => { /* A missing photo never prevents reading the plan. */ });
    return () => controller.abort();
  }, [venueName, address, placeId]);
  if (!photo || failed) return null;
  return <figure className={styles.placePhoto}>
    {/* Provider images have short-lived URLs and must not enter the Next image cache. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={photo.url} alt={venueName} width={800} height={450} onError={() => setFailed(true)} />
    <figcaption><a href={photo.mapsUrl || photo.url} target="_blank" rel="noreferrer" translate="no">Google Maps</a>
      {photo.authors.map((author, index) => <span key={index}> · {author.url ? <a href={author.url} target="_blank" rel="noreferrer">{author.name}</a> : author.name}</span>)}
    </figcaption>
  </figure>;
}
