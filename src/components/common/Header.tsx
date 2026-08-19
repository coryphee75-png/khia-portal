'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import styles from './Header.module.css';
import { ROUTES, getDashboardRoute } from '@/lib/constants';

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
          <span className={styles.logoBadge}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/khia-crest.png" alt="" className={styles.logoCrest} />
          </span>
          <h1>My KHIA</h1>
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
                  <Link href={getDashboardRoute(session.user.role)}>대시보드</Link>
                  {session.user.role === 'parent' && (
                    <>
                      <Link href={ROUTES.HOMEWORKS}>숙제</Link>
                      <Link href={ROUTES.NOTES}>수업일지</Link>
                      <Link href={ROUTES.EVALUATIONS}>평가</Link>
                      <Link href={ROUTES.ALBUMS}>앨범</Link>
                      <Link href={ROUTES.LINK_CHILD}>자녀 추가 등록</Link>
                    </>
                  )}
                  {session.user.role === 'admin' && (
                    <Link href={ROUTES.ADMIN_DASHBOARD}>반 관리</Link>
                  )}
                  <a href="https://khia.netlify.app/" target="_blank" rel="noopener noreferrer">
                    KHIA Learning Hub ↗
                  </a>
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
