import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Header from '@/components/common/Header';
import { getDashboardRoute } from '@/lib/constants';
import styles from './layout.module.css';

/**
 * 학부모 레이아웃 - 학부모 역할만 접근 가능
 */
export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'parent') {
    redirect(getDashboardRoute(session.user.role));
  }

  return (
    <div className={styles.container}>
      <Header />
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>
      <footer className={styles.footer}>
        <p>&copy; 2024 My KHIA. All rights reserved.</p>
      </footer>
    </div>
  );
}
