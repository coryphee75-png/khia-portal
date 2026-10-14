import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Header from '@/components/common/Header';
import { getDashboardRoute } from '@/lib/constants';
import styles from './layout.module.css';

/**
 * 채점(KHIA 채점 도우미) 레이아웃 - 선생님/관리자만 접근 가능
 * (학부모는 검수완료된 성적표만 별도 경로로 열람)
 */
export default async function GradingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'teacher' && session.user.role !== 'admin') {
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
