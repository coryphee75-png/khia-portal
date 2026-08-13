import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Header from '@/components/common/Header';
import styles from './layout.module.css';

/**
 * 학부모 레이아웃
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

  return (
    <div className={styles.container}>
      <Header />
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>
      <footer className={styles.footer}>
        <p>&copy; 2024 KHIA 포탈. All rights reserved.</p>
      </footer>
    </div>
  );
}
