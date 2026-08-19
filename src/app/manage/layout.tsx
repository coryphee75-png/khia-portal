import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Header from '@/components/common/Header';
import styles from './layout.module.css';

/**
 * 콘텐츠 관리 레이아웃 - 로그인한 사용자만 접근 가능
 * (관리자/선생님만 실제 편집 가능하며, 역할별 세부 권한은 페이지/API에서 확인)
 */
export default async function ManageLayout({
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
        <p>&copy; 2024 My KHIA. All rights reserved.</p>
      </footer>
    </div>
  );
}
