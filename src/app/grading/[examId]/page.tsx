'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  BRANCH_LABELS,
  EXAM_STATUS_LABELS,
  EXAM_TYPE_LABELS,
  ExamDetail,
  ExamFileKind,
  QUESTION_TYPE_LABELS,
} from '@/lib/grading';
import { uploadExamFile } from '@/lib/gradingUpload';
import ExamFilesPanel, { PanelFileItem } from '@/components/grading/ExamFilesPanel';
import SubmissionsPanel from '@/components/grading/SubmissionsPanel';
import PlacementRulesPanel from '@/components/grading/PlacementRulesPanel';
import styles from '../grading.module.css';

/**
 * /grading/[examId] - 시험 상세
 * 지금은 시험 구성(영역/문항/정답)을 확인하는 화면이고,
 * 다음 단계에서 학생별 스캔 업로드 + AI 1차 채점 + 제출 현황이 이 화면에 추가됩니다.
 */
export default function ExamDetailPage() {
  const params = useParams();
  const examId = String(params.examId);
  const router = useRouter();

  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');
  const [blobEnabled, setBlobEnabled] = useState(false);
  const [busyKinds, setBusyKinds] = useState<ExamFileKind[]>([]);
  const [rulesVersion, setRulesVersion] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/grading/exams/${examId}`);
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '불러올 수 없습니다.');
      setExam(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    load();
    fetch('/api/grading/options')
      .then((r) => r.json())
      .then((r) => setBlobEnabled(!!r?.data?.blobEnabled))
      .catch(() => {});
  }, [load]);

  useEffect(() => {
    // 시험 만들기 화면에서 일부 자료 업로드가 실패했으면 ?fileErrors=N 으로 넘어옴
    const failed = Number(new URLSearchParams(window.location.search).get('fileErrors') || 0);
    if (failed > 0) {
      setFileError(`자료 파일 ${failed}개를 올리지 못했습니다. 아래 "시험 자료"에서 다시 올려주세요.`);
    }
  }, []);

  const handleAddFiles = async (kind: ExamFileKind, files: File[]) => {
    setFileError('');
    setBusyKinds((prev) => [...prev, kind]);
    const problems: string[] = [];
    for (const file of files) {
      try {
        const uploaded = await uploadExamFile(examId, kind, file, blobEnabled);
        setExam((prev) => (prev ? { ...prev, files: [...prev.files, uploaded] } : prev));
      } catch (e) {
        problems.push(e instanceof Error ? e.message : `${file.name} 업로드 실패`);
      }
    }
    if (problems.length) setFileError(problems.join(' '));
    setBusyKinds((prev) => prev.filter((k) => k !== kind));
  };

  const handleRemoveFile = async (item: PanelFileItem) => {
    if (!window.confirm(`"${item.fileName}" 파일을 삭제할까요?`)) return;
    const res = await fetch(`/api/grading/exams/${examId}/files/${item.key}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok || !result.success) {
      setFileError(result?.error || '삭제할 수 없습니다.');
      return;
    }
    setExam((prev) => (prev ? { ...prev, files: prev.files.filter((f) => f.id !== item.key) } : prev));
  };

  const handleDelete = async () => {
    if (!exam) return;
    const ok = window.confirm(
      `"${exam.title}" 시험을 삭제할까요?\n영역·문항과 제출된 시험지/채점 결과도 모두 함께 삭제됩니다.`
    );
    if (!ok) return;
    const res = await fetch(`/api/grading/exams/${examId}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok || !result.success) {
      setError(result?.error || '삭제할 수 없습니다.');
      return;
    }
    router.push('/grading');
  };

  if (loading) return <div className={styles.status}>로딩 중...</div>;

  if (error || !exam) {
    return (
      <div className={styles.page}>
        <Link href="/grading" className={styles.backLink}>
          ← 시험 목록
        </Link>
        <div className={styles.error}>{error || '시험을 찾을 수 없습니다.'}</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/grading" className={styles.backLink}>
        ← 시험 목록
      </Link>

      <div className={styles.titleRow}>
        <div>
          <h1>{exam.title}</h1>
          <div className={styles.examMeta} style={{ marginTop: '0.4rem' }}>
            <span
              className={
                exam.examType === 'placement' ? `${styles.badge} ${styles.badgePlacement}` : styles.badge
              }
            >
              {EXAM_TYPE_LABELS[exam.examType]}
            </span>
            <span className={`${styles.badge} ${styles.badgeBranch}`}>{BRANCH_LABELS[exam.branch]}</span>
            {exam.className && <span>{exam.className}</span>}
            {exam.examDate && <span>· {exam.examDate}</span>}
            <span>· {EXAM_STATUS_LABELS[exam.status]}</span>
            {exam.createdByName && <span>· 작성 {exam.createdByName}</span>}
          </div>
        </div>
        <button type="button" className={styles.dangerBtn} onClick={handleDelete}>
          시험 삭제
        </button>
      </div>

      <div className={styles.summaryGrid}>
        <div className={`${styles.card} ${styles.stat}`}>
          <div className={styles.statValue}>{exam.areas.length}</div>
          <div className={styles.statLabel}>영역</div>
        </div>
        <div className={`${styles.card} ${styles.stat}`}>
          <div className={styles.statValue}>{exam.questionCount}</div>
          <div className={styles.statLabel}>문항</div>
        </div>
        <div className={`${styles.card} ${styles.stat}`}>
          <div className={styles.statValue}>{exam.totalScore}</div>
          <div className={styles.statLabel}>만점</div>
        </div>
        <div className={`${styles.card} ${styles.stat}`}>
          <div className={styles.statValue}>
            {exam.reviewedCount}/{exam.submissionCount}
          </div>
          <div className={styles.statLabel}>검수완료 / 제출</div>
        </div>
      </div>

      <div className={styles.sectionTitle}>
        <h2>학생 답안지</h2>
      </div>
      <p className={styles.subtitle} style={{ marginTop: '-0.4rem', marginBottom: '0.75rem' }}>
        학생이 푼 시험지를 학생별로 올린 뒤 &ldquo;AI 채점&rdquo;을 누르면 1~2분 안에 1차 채점됩니다. (Speaking은 선생님이 직접
        입력, 결과는 선생님 검수 후 확정)
      </p>
      <SubmissionsPanel key={rulesVersion} examId={examId} blobEnabled={blobEnabled} onChanged={load} />

      <div className={styles.sectionTitle}>
        <h2>반 배정 기준</h2>
      </div>
      <PlacementRulesPanel
        examId={examId}
        areas={exam.areas}
        totalMax={exam.totalScore}
        onSaved={() => setRulesVersion((v) => v + 1)}
      />

      <div className={styles.sectionTitle}>
        <h2>시험 자료</h2>
      </div>
      {fileError && <div className={styles.error}>{fileError}</div>}
      <div className={styles.card}>
        <ExamFilesPanel
          files={exam.files.map((f) => ({
            key: f.id,
            kind: f.kind,
            fileName: f.fileName,
            sizeBytes: f.sizeBytes,
            url: f.url,
          }))}
          busyKinds={busyKinds}
          onAdd={handleAddFiles}
          onRemove={handleRemoveFile}
        />
      </div>

      <div className={styles.sectionTitle}>
        <h2>영역 및 정답</h2>
      </div>

      {exam.areas.map((area) => (
        <div key={area.id} className={`${styles.card} ${styles.areaCard}`}>
          <div className={styles.areaHeader}>
            <strong style={{ color: '#0e2c44' }}>{area.name}</strong>
            <span className={styles.areaTotal}>
              {area.questions.length}문항 · {area.maxScore}점
            </span>
          </div>
          <div className={styles.tableWrap}>
        <table className={styles.qTable}>
            <thead>
              <tr>
                <th>번호</th>
                <th>유형</th>
                <th>배점</th>
                <th>정답 / 평가 항목</th>
                <th>루브릭</th>
              </tr>
            </thead>
            <tbody>
              {area.questions.map((q) => (
                <tr key={q.id}>
                  <td className={styles.qNo} style={{ paddingTop: '0.35rem' }}>
                    {q.questionNo}
                  </td>
                  <td>
                    <span className={styles.typeTag}>{QUESTION_TYPE_LABELS[q.questionType]}</span>
                  </td>
                  <td>{q.maxScore}</td>
                  <td>{q.answerKey || q.label || <span style={{ color: '#adb5bd' }}>—</span>}</td>
                  <td className={styles.rubricCell}>
                    {q.rubricText ? (
                      <div className={styles.clamp2} title={q.rubricText}>
                        {q.rubricText}
                      </div>
                    ) : (
                      <span style={{ color: '#adb5bd' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      ))}
    </div>
  );
}
