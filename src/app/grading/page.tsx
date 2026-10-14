'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  BRANCH_LABELS,
  Branch,
  EXAM_STATUS_LABELS,
  EXAM_TYPE_LABELS,
  ExamSummary,
} from '@/lib/grading';
import styles from './grading.module.css';

type Filter = 'all' | Branch;

/**
 * /grading - 채점 대시보드 (시험 목록)
 * 선생님: 내가 만든 시험 + 담당 반 시험 / 관리자: 두 지점 전체
 */
export default function GradingHomePage() {
  const { data: session } = useSession();
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/grading/exams');
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result?.error || '불러올 수 없습니다.');
        setExams(result.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visible = useMemo(
    () => (filter === 'all' ? exams : exams.filter((e) => e.branch === filter)),
    [exams, filter]
  );

  const isAdmin = session?.user?.role === 'admin';

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h1>KHIA 채점 도우미</h1>
          <p className={styles.subtitle}>
            {isAdmin ? '세종·광교 전체 시험' : '내가 만든 시험과 담당 반 시험'}을 관리합니다. 스캔 업로드 → AI
            1차 채점 → 선생님 검수 → 성적표 순서로 진행됩니다.
          </p>
        </div>
        <Link href="/grading/new" className={styles.primaryBtn}>
          + 시험 만들기
        </Link>
      </div>

      {isAdmin && (
        <div className={styles.tabs}>
          {(['all', 'Sejong', 'Gwangyo'] as Filter[]).map((f) => (
            <button
              key={f}
              className={filter === f ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '전체' : BRANCH_LABELS[f]}
            </button>
          ))}
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div className={styles.status}>로딩 중...</div>
      ) : visible.length === 0 ? (
        <div className={`${styles.card} ${styles.empty}`}>
          아직 등록된 시험이 없습니다. 오른쪽 위 &ldquo;시험 만들기&rdquo;로 첫 시험을 등록해보세요.
        </div>
      ) : (
        <ul className={styles.examList}>
          {visible.map((exam) => (
            <li key={exam.id}>
              <Link href={`/grading/${exam.id}`} className={`${styles.card} ${styles.examItem}`}>
                <div>
                  <div className={styles.examTitle}>{exam.title}</div>
                  <div className={styles.examMeta}>
                    <span
                      className={
                        exam.examType === 'placement'
                          ? `${styles.badge} ${styles.badgePlacement}`
                          : styles.badge
                      }
                    >
                      {EXAM_TYPE_LABELS[exam.examType]}
                    </span>
                    <span className={`${styles.badge} ${styles.badgeBranch}`}>
                      {BRANCH_LABELS[exam.branch]}
                    </span>
                    {exam.className && <span>{exam.className}</span>}
                    {exam.examDate && <span>· {exam.examDate}</span>}
                    <span>
                      · {exam.questionCount}문항 / {exam.totalScore}점
                    </span>
                    <span>· {EXAM_STATUS_LABELS[exam.status]}</span>
                  </div>
                </div>
                <div className={styles.progress}>
                  <div className={styles.progressNum}>
                    {exam.reviewedCount} / {exam.submissionCount}
                  </div>
                  검수완료 / 제출
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
