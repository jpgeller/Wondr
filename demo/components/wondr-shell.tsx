import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './planner.module.css';

export function WondrLogo() {
  // Display the original artwork unchanged; the viewBox frames only its wordmark.
  return <svg viewBox="60 180 334 98" className={styles.logo} aria-hidden="true">
    <image href="/brand/wondr-reference.png" width="960" height="560" />
  </svg>;
}

export default function WondrShell({ children, account, skipTo = 'plan-form' }: {
  children: ReactNode; account?: ReactNode; skipTo?: string;
}) {
  return <div className={styles.page}>
    <div className={styles.landscape} aria-hidden="true" />
    <a className={styles.skipLink} href={`#${skipTo}`}>Skip to content</a>
    <header className={styles.header}>
      <Link href="/" aria-label="Wondr home" className={styles.wordmark}><WondrLogo /></Link>
      <nav className={styles.account} aria-label="Account">{account}</nav>
    </header>
    {children}
    <footer className={styles.footer}><span>A day outside the usual.</span><span>Wonder first. Wander next.</span></footer>
  </div>;
}
