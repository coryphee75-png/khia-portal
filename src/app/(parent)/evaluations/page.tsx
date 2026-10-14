'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Card from '@/components/common/Card';
import styles from './page.module.css';
import { Evaluation } from '@/types';
import { GRADE_COLORS } from '@/lib/constants';

/**
 * 평가 페이지
 */
export default function EvaluationsPage() {
  const { data: session } = useSession();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  useEffect(() => {
    const fetchEvaluations = async () => {
      try {
        const response = await fetch('/api/parent/evaluations');
        if (!response.ok) throw new Error('평가를 불러올 수 없습니다.');
        const data = await response.json();
        setEvaluations(data.data || []);
      } catch (error) {
        console.error('Evaluations fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvaluations();
  }, []);

  const subjects = ['all', ...new Set(evaluations.map((e) => e.subject))];
  const filteredEvaluations =
    selectedSubject === 'all'
      ? evaluations
      : evaluations.filter((e) => e.subject === selectedSubject);

  // 평균 계산
  const average =
    evaluations.length > 0
      ? (evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length).toFixed(1)
      : 'N/A';

  const getGradeColor = (grade: string): string => {
    return GRADE_COLORS[grade as keyof typeof GRADE_COLORS] || '#999';
  };

  return (
    <div className={styles.container}>
      <h1>평가</h1>

      {isLoading ? (
        <div className={styles.loading}>로딩 중...</div>
      ) : evaluations.length > 0 ? (
        <>
          {/* 통계 */}
          <Card variant="elevated" className={styles.statsCard}>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>총 평가 수</span>
                <span className={styles.statValue}>{evaluations.length}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>평균 점수</span>
                <span className={styles.statValue}>{average}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>최고 등급</span>
                <span
                  className={styles.statValue}
                  style={{
                    background: getGradeColor(
                      evaluations.reduce((prev, current) =>
                        prev.score > current.score ? prev : current
                      ).grade
                    ),
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                  }}
                >
                  {evaluations.reduce((prev, current) =>
                    prev.score > current.score ? prev : current
                  ).grade}
                </span>
              </div>
            </div>
          </Card>

          {/* 필터 */}
          <div className={styles.filters}>
            {subjects.map((subject) => (
              <button
                key={subject}
                className={selectedSubject === subject ? styles.active : ''}
                onClick={() => setSelectedSubject(subject)}
              >
                {subject === 'all' ? '전체' : subject}
              </button>
            ))}
          </div>

          {/* 평가 목록 */}
          <div className={styles.evaluationsList}>
            {filteredEvaluations.map((evaluation) => (
              <Card key={evaluation.id} variant="outlined">
                <div className={styles.evaluationCard}>
                  <div className={styles.evaluationHeader}>
                    <h3>{evaluation.subject}</h3>
                    <div
                      className={styles.gradeBadge}
                      style={{ backgroundColor: getGradeColor(evaluation.grade) }}
                    >
                      {evaluation.grade}
                    </div>
                  </div>
                  <p className={styles.date}>
                    {new Date(evaluation.date).toLocaleDateString()}
                  </p>
                  <div className={styles.scoreBar}>
                    <div
                      className={styles.scoreProgress}
                      style={{ width: `${evaluation.score}%` }}
                    />
                  </div>
                  <p className={styles.score}>점수: {evaluation.score}점</p>
                  {evaluation.comments && (
                    <p className={styles.comments}>{evaluation.comments}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card>
          <p className={styles.emptyMessage}>평가가 없습니다.</p>
        </Card>
      )}
    </div>
  );
}
