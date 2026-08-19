'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Card from '@/components/common/Card';
import GreetingBanner from '@/components/common/GreetingBanner';
import styles from './page.module.css';
import { TeacherDashboardData } from '@/types';
import { getClassManageRoute } from '@/lib/constants';

/**
 * 선생님 대시보드 페이지
 */
export default function TeacherDashboardPage() {
  const { data: session } = useSession();
  const [dashboardData, setDashboardData] = useState<TeacherDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/teacher/dashboard');
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result?.error || '대시보드 데이터를 불러올 수 없습니다.');
        }
        setDashboardData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
        console.error('Teacher dashboard fetch error:', err);
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
      <GreetingBanner
        name={session?.user?.name || '선생님'}
        subtitle="담당 반 학생들의 소식을 확인해보세요."
      />

      <div className={styles.grid}>
        {/* 담당 반 */}
        <Card variant="elevated" title="담당 반">
          <div className={styles.childrenList}>
            {dashboardData?.classes && dashboardData.classes.length > 0 ? (
              <ul>
                {dashboardData.classes.map((cls) => (
                  <li key={cls.id}>
                    <span className={styles.childName}>{cls.name}</span>
                    <span className={styles.childGrade}>학생 {cls.studentCount}명</span>
                    <Link href={getClassManageRoute(cls.id)} className={styles.moreLink}>
                      콘텐츠 관리 →
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p>담당 중인 반이 없습니다. 관리자에게 반 배정을 요청하세요.</p>
            )}
          </div>
        </Card>

        {/* 통계 */}
        <Card variant="elevated" title="통계">
          <div className={styles.statistics}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>담당 반 수</span>
              <span className={styles.statValue}>
                {dashboardData?.classes.length || 0}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>전체 학생 수</span>
              <span className={styles.statValue}>
                {dashboardData?.totalStudents || 0}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>채점 대기 숙제</span>
              <span className={styles.statValue}>
                {dashboardData?.pendingHomeworksToGrade || 0}
              </span>
            </div>
          </div>
        </Card>

        {/* 최근 작성한 수업일지 */}
        <Card variant="elevated" title="최근 작성한 수업일지">
          <div className={styles.itemList}>
            {dashboardData?.recentNotes && dashboardData.recentNotes.length > 0 ? (
              <ul>
                {dashboardData.recentNotes.map((note) => (
                  <li key={note.id}>
                    <div className={styles.itemTitle}>{note.subject}</div>
                    <div className={styles.itemMeta}>
                      {new Date(note.date).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>최근 작성한 수업일지가 없습니다.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
