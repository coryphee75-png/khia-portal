'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SCAN_FILE_ACCEPT,
  SCAN_MAX_FILES,
  SUBMISSION_STATUS_LABELS,
  StudentOption,
  SubmissionSummary,
  formatFileSize,
} from '@/lib/grading';
import { uploadSubmission, validateScanFile } from '@/lib/gradingUpload';
import SubmissionResult from './SubmissionResult';
import styles from '@/app/grading/grading.module.css';

const DIRECT = '__direct__';

/**
 * 학생 답안지 업로드 + 제출 현황
 * - 학생 선택(반 명단 / 지점 학생) 또는 이름 직접 입력(배치고사 신입생)
 * - 한 학생의 답안지 여러 장(PDF 또는 사진)을 한 번에 업로드 → 상태 "대기"
 */
export default function SubmissionsPanel({
  examId,
  blobEnabled,
  onChanged,
}: {
  examId: string;
  blobEnabled: boolean;
  onChanged?: () => void;
}) {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [selected, setSelected] = useState('');
  const [directName, setDirectName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [inputKey, setInputKey] = useState(0);
  const [gradingIds, setGradingIds] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const [sRes, subRes] = await Promise.all([
        fetch(`/api/grading/exams/${examId}/students`).then((r) => r.json()),
        fetch(`/api/grading/exams/${examId}/submissions`).then((r) => r.json()),
      ]);
      if (!sRes.success) throw new Error(sRes.error || '학생 목록을 불러올 수 없습니다.');
      if (!subRes.success) throw new Error(subRes.error || '답안지 목록을 불러올 수 없습니다.');
      setStudents(sRes.data);
      setSubmissions(subRes.data);
      if (sRes.data.length === 0) setSelected(DIRECT);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    load();
  }, [load]);

  const submittedIds = useMemo(
    () => new Set(submissions.map((s) => s.studentId).filter(Boolean) as string[]),
    [submissions]
  );

  const pickFiles = (picked: File[]) => {
    const problems = picked.map(validateScanFile).filter(Boolean) as string[];
    const ok = picked.filter((f) => !validateScanFile(f));
    // 파일 이름 순으로 정렬해서 페이지 순서를 맞춤 (scan_001, scan_002 ...)
    const merged = [...files, ...ok].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (merged.length > SCAN_MAX_FILES) problems.push(`한 학생당 ${SCAN_MAX_FILES}개까지 올릴 수 있습니다.`);
    setFiles(merged.slice(0, SCAN_MAX_FILES));
    setError(problems.join(' '));
  };

  const handleUpload = async () => {
    setError('');
    setNotice('');
    const isDirect = selected === DIRECT;
    const student = students.find((s) => s.id === selected);
    if (!isDirect && !student) return setError('학생을 선택해주세요.');
    if (isDirect && !directName.trim()) return setError('학생 이름을 입력해주세요.');
    if (files.length === 0) return setError('답안지 파일을 선택해주세요.');

    const studentName = isDirect ? directName.trim() : student!.name;
    if (
      submissions.some((s) => (isDirect ? !s.studentId && s.studentName === studentName : s.studentId === selected)) &&
      !window.confirm(`${studentName} 학생의 답안지가 이미 있습니다. 하나 더 올릴까요?`)
    ) {
      return;
    }

    setUploading(true);
    try {
      const created = await uploadSubmission(
        examId,
        { studentId: isDirect ? null : selected, studentName },
        files,
        blobEnabled,
        (done, total) => setProgress(`${done}/${total}`)
      );
      setSubmissions((prev) =>
        [...prev, created].sort((a, b) => a.studentName.localeCompare(b.studentName))
      );
      setNotice(`${studentName} 학생 답안지 ${files.length}장을 올렸습니다.`);
      setFiles([]);
      setDirectName('');
      setInputKey((k) => k + 1);
      // 다음 미제출 학생을 자동 선택
      const next = students.find((s) => s.id !== selected && !submittedIds.has(s.id));
      setSelected(isDirect ? DIRECT : next ? next.id : '');
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      setProgress('');
    }
  };

  const handleGrade = async (s: SubmissionSummary) => {
    setError('');
    setNotice('');
    setGradingIds((prev) => [...prev, s.id]);
    try {
      const res = await fetch(`/api/grading/submissions/${s.id}/grade`, { method: 'POST' });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.success) {
        throw new Error(result?.error || 'AI 채점에 실패했습니다. (시간이 오래 걸리면 잠시 후 목록을 새로고침해보세요)');
      }
      setSubmissions((prev) =>
        prev.map((x) =>
          x.id === s.id ? { ...result.data, recommendedClass: x.recommendedClass, placementNote: x.placementNote } : x
        )
      );
      load();
      setNotice(`${s.studentName} 학생 AI 1차 채점이 끝났습니다. 아래에서 결과를 확인하세요.`);
      setOpenId(s.id);
      setRefreshKey((k) => k + 1);
      onChanged?.();
    } catch (e) {
      setError(`${s.studentName}: ${e instanceof Error ? e.message : 'AI 채점 실패'}`);
    } finally {
      setGradingIds((prev) => prev.filter((id) => id !== s.id));
    }
  };

  const handleDelete = async (s: SubmissionSummary) => {
    if (!window.confirm(`${s.studentName} 학생의 답안지를 삭제할까요? (채점 결과도 함께 삭제됩니다)`)) return;
    const res = await fetch(`/api/grading/submissions/${s.id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok || !result.success) return setError(result?.error || '삭제할 수 없습니다.');
    setSubmissions((prev) => prev.filter((x) => x.id !== s.id));
    onChanged?.();
  };

  if (loading) return <div className={styles.status}>답안지 목록을 불러오는 중...</div>;

  return (
    <div>
      {error && <div className={styles.error}>{error}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      {/* 업로드 폼 */}
      <div className={styles.card}>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            학생
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">학생을 선택하세요</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.className ? ` (${s.className})` : ''}
                  {submittedIds.has(s.id) ? ' ✓ 제출됨' : ''}
                </option>
              ))}
              <option value={DIRECT}>직접 입력 (등록 전 신입생 등)</option>
            </select>
          </label>
          {selected === DIRECT ? (
            <label className={styles.field}>
              학생 이름
              <input
                value={directName}
                onChange={(e) => setDirectName(e.target.value)}
                placeholder="예: 홍길동 (Gildong)"
              />
            </label>
          ) : (
            <div />
          )}

          <div className={`${styles.field} ${styles.fieldFull}`}>
            답안지 파일
            <label className={styles.dropZone}>
              <input
                key={inputKey}
                type="file"
                multiple
                accept={SCAN_FILE_ACCEPT}
                hidden
                disabled={uploading}
                onChange={(e) => {
                  const picked = Array.from(e.target.files || []);
                  e.target.value = '';
                  if (picked.length) pickFiles(picked);
                }}
              />
              <strong>+ 답안지 선택</strong>
              <span>
                스캔 PDF 1개 또는 페이지별 사진 여러 장 (JPG/PNG). 휴대폰에서는 카메라로 바로 찍을 수 있어요.
              </span>
            </label>
            {files.length > 0 && (
              <ul className={styles.fileList}>
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className={styles.fileItem}>
                    <span className={styles.pageNo}>{i + 1}</span>
                    <span className={styles.fileName}>{f.name}</span>
                    <span className={styles.fileSize}>{formatFileSize(f.size)}</span>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`${f.name} 빼기`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem' }}>
          <button type="button" className={styles.primaryBtn} onClick={handleUpload} disabled={uploading}>
            {uploading ? `올리는 중... ${progress}` : '답안지 올리기'}
          </button>
        </div>
      </div>

      {/* 제출 현황 */}
      <div className={styles.card}>
        <div className={styles.areaHeader} style={{ marginBottom: '0.5rem' }}>
          <strong style={{ color: '#0e2c44' }}>제출 현황</strong>
          <span className={styles.areaTotal}>
            {submissions.length}건
            {students.length > 0 && ` · 명단 ${students.length}명 중 ${submittedIds.size}명 제출`}
          </span>
        </div>
        {submissions.length === 0 ? (
          <div className={styles.fileEmpty}>아직 올린 답안지가 없습니다.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.qTable} style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th>학생</th>
                  <th>답안지</th>
                  <th>상태</th>
                  <th>점수</th>
                  <th>추천 반</th>
                  <th>올린 시각</th>
                  <th style={{ textAlign: 'right' }}>채점</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <React.Fragment key={s.id}>
                  <tr>
                    <td style={{ fontWeight: 600, color: '#0e2c44' }}>
                      {s.studentName}
                      {!s.studentId && <span className={styles.typeTag} style={{ marginLeft: 6 }}>미등록</span>}
                    </td>
                    <td>
                      {s.pages.map((p, i) => (
                        <a
                          key={p.url}
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.pageLink}
                          title={p.fileName}
                        >
                          {i + 1}
                        </a>
                      ))}
                    </td>
                    <td>
                      <span className={`${styles.statusTag} ${styles[`status_${s.status}`]}`}>
                        {SUBMISSION_STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    <td>{s.totalScore ?? '—'}</td>
                    <td
                      style={{ fontWeight: 600, color: '#0391d3', whiteSpace: 'nowrap', cursor: s.placementNote ? 'help' : undefined }}
                      title={s.placementNote ?? undefined}
                    >
                      {s.recommendedClass ?? (s.placementNote ? '기준 미달' : '—')}
                      {s.placementNote && <span className={styles.fileSlotHint}> ⓘ</span>}
                    </td>
                    <td style={{ color: '#5b6b78' }}>
                      {new Date(s.createdAt).toLocaleString('ko-KR', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button
                        type="button"
                        className={styles.ghostBtn}
                        style={{ marginRight: 6 }}
                        onClick={() => setOpenId(openId === s.id ? null : s.id)}
                      >
                        {openId === s.id ? '닫기' : s.status === 'pending' ? '점수 입력' : '결과·검수'}
                      </button>
                      {s.status !== 'pending' && (
                        <a
                          href={`/report/${s.id}`}
                          target="_blank"
                          rel="opener"
                          className={styles.ghostBtn}
                          style={{ marginRight: 6, textDecoration: 'none' }}
                          title="영어 성적표 (A4 2페이지 인쇄)"
                        >
                          성적표
                        </a>
                      )}
                      <button
                        type="button"
                        className={s.status === 'pending' ? styles.primaryBtnSm : styles.ghostBtn}
                        disabled={gradingIds.includes(s.id)}
                        onClick={() => handleGrade(s)}
                        title="답안지를 AI가 1차 채점합니다 (1~2분)"
                      >
                        {gradingIds.includes(s.id) ? 'AI 채점 중...' : s.status === 'pending' ? 'AI 채점' : '다시 채점'}
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => handleDelete(s)}
                        aria-label={`${s.studentName} 답안지 삭제`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                  {s.aiError && !gradingIds.includes(s.id) && (
                    <tr>
                      <td colSpan={7} className={styles.aiErrorCell}>
                        마지막 AI 채점 실패: {s.aiError}
                      </td>
                    </tr>
                  )}
                  {openId === s.id && (
                    <tr>
                      <td colSpan={7}>
                        <SubmissionResult
                          submissionId={s.id}
                          refreshKey={refreshKey}
                          onSaved={(status, totalScore) => {
                            setSubmissions((prev) =>
                              prev.map((x) => (x.id === s.id ? { ...x, status, totalScore } : x))
                            );
                            load();
                            onChanged?.();
                          }}
                        />
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
