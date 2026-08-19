'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Card from '@/components/common/Card';
import GreetingBanner from '@/components/common/GreetingBanner';
import styles from './page.module.css';
import { StudentDashboardData } from '@/types';

/**
 * 학생 대시보드 페이지
 */
export default function StudentDashboardPage() {
  const { data: session } = useSession();
  const [dashboardData, setDashboardData] = useState<StudentDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/student/dashboard');
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result?.error || '대시보드 데이터를 불러올 수 없습니다.');
        }
        setDashboardData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
        console.error('Student dashboard fetch error:', err);
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
        name={session?.user?.name || '학생'}
        subtitle="오늘의 숙제와 성적을 확인해보세요."
      />

      <div className={styles.grid}>
        {/* 통계 */}
        <Card variant="elevated" title="나의 통계">
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

        {/* 내 숙제 */}
        <Card variant="elevated" title="내 숙제">
          <div className={styles.itemList}>
            {dashboardData?.homeworks && dashboardData.homeworks.length > 0 ? (
              <ul>
                {dashboardData.homeworks.map((hw) => (
                  <li key={hw.id}>
                    <div className={styles.itemTitle}>{hw.title}</div>
                    <div className={styles.itemMeta}>
                      {hw.subject} • {hw.status}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>숙제가 없습니다.</p>
            )}
          </div>
        </Card>

        {/* 최근 성적 */}
        <Card variant="elevated" title="최근 성적">
          <div className={styles.itemList}>
            {dashboardData?.recentEvaluations && dashboardData.recentEvaluations.length > 0 ? (
              <ul>
                {dashboardData.recentEvaluations.map((evaluation) => (
                  <li key={evaluation.id}>
                    <div className={styles.itemTitle}>
                      {evaluation.subject}
                      <span className={styles.grade}>{evaluation.grade}</span>
                    </div>
                    <div className={styles.itemMeta}>
                      점수: {evaluation.score} • {new Date(evaluation.date).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>최근 성적이 없습니다.</p>
            )}
          </div>
        </Card>

        {/* 최근 수업일지 */}
        <Card variant="elevated" title="최근 수업일지">
          <div className={styles.itemList}>
            {dashboardData?.recentNotes && dashboardData.recentNotes.length > 0 ? (
              <ul>
                {dashboardData.recentNotes.map((note) => (
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
        </Card>
      </div>
    </div>
  );
}
