'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Card from '@/components/common/Card';
import Link from 'next/link';
import styles from './page.module.css';
import { ROUTES } from '@/lib/constants';
import { DashboardData } from '@/types';

/**
 * 학부모 대시보드 페이지
 */
export default function DashboardPage() {
  const { data: session } = useSession();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/parent/dashboard');
        if (!response.ok) {
          throw new Error('대시보드 데이터를 불러올 수 없습니다.');
        }
        const data = await response.json();
        setDashboardData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
        console.error('Dashboard fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return <div className={styles.loading}>로딩 중...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={styles.dashboard}>
      <h1>안녕하세요, {session?.user?.name || '학부모'}님!</h1>

      <div className={styles.grid}>
        {/* 자녀 정보 */}
        <Card variant="elevated" title="자녀 정보">
          <div className={styles.childrenList}>
            {dashboardData?.children && dashboardData.children.length > 0 ? (
              <ul>
                {dashboardData.children.map((child) => (
                  <li key={child.id}>
                    <span className={styles.childName}>{child.name}</span>
                    <span className={styles.childGrade}>
                      {child.grade}학년 {child.classNumber}반
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>등록된 자녀가 없습니다.</p>
            )}
          </div>
        </Card>

        {/* 통계 */}
        <Card variant="elevated" title="통계">
          <div className={styles.statistics}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>전체 숙제</span>
              <span className={styles.statValue}>
                {dashboardData?.statistics.totalHomeworks || 0}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>완료된 숙제</span>
              <span className={styles.statValue}>
                {dashboardData?.statistics.completedHomeworks || 0}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>평균 등급</span>
              <span className={styles.statValue}>
                {dashboardData?.statistics.averageGrade?.toFixed(1) || 'N/A'}
              </span>
            </div>
          </div>
        </Card>

        {/* 최근 숙제 */}
        <Card variant="elevated" title="최근 숙제">
          <div className={styles.itemList}>
            {dashboardData?.recentHomeworks && dashboardData.recentHomeworks.length > 0 ? (
              <ul>
                {dashboardData.recentHomeworks.slice(0, 3).map((hw) => (
                  <li key={hw.id}>
                    <div className={styles.itemTitle}>{hw.title}</div>
                    <div className={styles.itemMeta}>
                      {hw.subject} • {hw.status}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>최근 숙제가 없습니다.</p>
            )}
          </div>
          <Link href={ROUTES.HOMEWORKS} className={styles.moreLink}>
            더보기 →
          </Link>
        </Card>

        {/* 최근 수업일지 */}
        <Card variant="elevated" title="최근 수업일지">
          <div className={styles.itemList}>
            {dashboardData?.recentNotes && dashboardData.recentNotes.length > 0 ? (
              <ul>
                {dashboardData.recentNotes.slice(0, 3).map((note) => (
                  <li key={note.id}>
                    <div className={styles.itemTitle}>{note.subject}</div>
                    <div className={styles.itemMeta}>
                      {new Date(note.date).toLocaleDateString()} • {note.teacher}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>최근 수업일지가 없습니다.</p>
            )}
          </div>
          <Link href={ROUTES.NOTES} className={styles.moreLink}>
            더보기 →
          </Link>
        </Card>

        {/* 최근 평가 */}
        <Card variant="elevated" title="최근 평가">
          <div className={styles.itemList}>
            {dashboardData?.recentEvaluations && dashboardData.recentEvaluations.length > 0 ? (
              <ul>
                {dashboardData.recentEvaluations.slice(0, 3).map((eval) => (
                  <li key={eval.id}>
                    <div className={styles.itemTitle}>
                      {eval.subject}
                      <span className={styles.grade}>{eval.grade}</span>
                    </div>
                    <div className={styles.itemMeta}>
                      점수: {eval.score} • {new Date(eval.date).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>최근 평가가 없습니다.</p>
            )}
          </div>
          <Link href={ROUTES.EVALUATIONS} className={styles.moreLink}>
            더보기 →
          </Link>
        </Card>
      </div>

      {/* 빠른 링크 */}
      <div className={styles.quickLinks}>
        <Link href={ROUTES.ALBUMS}>앨범</Link>
        <Link href={ROUTES.NOTES}>수업일지</Link>
        <Link href={ROUTES.HOMEWORKS}>숙제</Link>
        <Link href={ROUTES.EVALUATIONS}>평가</Link>
      </div>
    </div>
  );
}
