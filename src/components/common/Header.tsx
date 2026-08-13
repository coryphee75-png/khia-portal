'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import styles from './Header.module.css';
import { ROUTES } from '@/lib/constants';

/**
 * 헤더 컴포넌트
 */
export function Header() {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut({ redirect: true, callbackUrl: ROUTES.LOGIN });
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href={ROUTES.HOME} className={styles.logo}>
          <h1>KHIA 포탈</h1>
        </Link>

        <nav className={styles.nav}>
          {session?.user ? (
            <div className={styles.userMenu}>
              <span className={styles.userName}>
                {session.user.name || session.user.email}
              </span>
              <button
                className={styles.menuButton}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="메뉴"
              >
                ☰
              </button>

              {isMenuOpen && (
                <div className={styles.dropdown}>
                  <Link href={ROUTES.PARENT_DASHBOARD}>대시보드</Link>
                  <Link href={ROUTES.HOMEWORKS}>숙제</Link>
                  <Link href={ROUTES.NOTES}>수업일지</Link>
                  <Link href={ROUTES.EVALUATIONS}>평가</Link>
                  <Link href={ROUTES.ALBUMS}>앨범</Link>
                  <hr />
                  <button onClick={handleLogout} className={styles.logoutBtn}>
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href={ROUTES.LOGIN} className={styles.loginLink}>
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
