'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AnswerResult, QUESTION_TYPE_LABELS, SubmissionDetail, SubmissionStatus } from '@/lib/grading';
import styles from '@/app/grading/grading.module.css';

/**
 * 답안지 1건의 점수 입력 / 검수 화면
 * - 선생님 채점 문항(Speaking 등) 점수 입력
 * - AI 점수 확인·수정, 영역별 코멘트·Overall Comment 수정 (영어)
 * - "검수 완료" → 학부모 성적표에 공개되는 최종 결과로 확정
 */
export default function SubmissionResult({
  submissionId,
  refreshKey,
  onSaved,
}: {
  submissionId: string;
  refreshKey: number;
  onSaved?: (status: SubmissionStatus, totalScore: number | null) => void;
}) {
  const [data, setData] = useState<SubmissionDetail | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // 편집 중인 값 (문항 점수는 문자열로 보관해서 빈칸 입력 허용)
  const [scores, setScores] = useState<Record<string, string>>({});
  const [areaComments, setAreaComments] = useState<Record<string, string>>({});
  const [overall, setOverall] = useState('');
  const [dirty, setDirty] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [commentBusy, setCommentBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/grading/submissions/${submissionId}`)
      .then((r) => r.json())
      .then((r) => {
        if (cancelled) return;
        if (!r.success) throw new Error(r.error || '결과를 불러올 수 없습니다.');
        const d: SubmissionDetail = r.data;
        setData(d);
        setScores(Object.fromEntries(d.answers.map((a) => [a.questionId, a.finalScore === null ? '' : String(a.finalScore)])));
        setAreaComments(Object.fromEntries(d.areas.map((a) => [a.areaId, a.finalComment ?? a.aiComment ?? ''])));
        setOverall(d.overallComment ?? '');
        setDirty(false);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : '오류'));
    return () => {
      cancelled = true;
    };
  }, [submissionId, refreshKey]);

  const teacherItems = useMemo(() => data?.answers.filter((a) => a.questionType === 'teacher') ?? [], [data]);
  const aiItems = useMemo(() => data?.answers.filter((a) => a.questionType !== 'teacher') ?? [], [data]);

  if (error && !data) return <div className={styles.error}>{error}</div>;
  if (!data) return <div className={styles.fileEmpty}>결과를 불러오는 중...</div>;

  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const areaScore = (areaId: string) =>
    data.answers.filter((a) => a.areaId === areaId).reduce((s, a) => s + (num(scores[a.questionId] ?? '') ?? 0), 0);
  const areaFilled = (areaId: string) =>
    data.answers.filter((a) => a.areaId === areaId).some((a) => num(scores[a.questionId] ?? '') !== null);
  const total = data.answers.reduce((s, a) => s + (num(scores[a.questionId] ?? '') ?? 0), 0);
  const maxTotal = data.answers.reduce((s, a) => s + a.maxScore, 0);
  const emptyCount = data.answers.filter((a) => num(scores[a.questionId] ?? '') === null).length;
  const flagged = data.answers.filter((a) => a.needsReview).length;
  const isReviewed = data.status === 'reviewed';

  const setScore = (q: AnswerResult, value: string) => {
    setScores((prev) => ({ ...prev, [q.questionId]: value }));
    setDirty(true);
    setMessage('');
  };

  const save = async (markReviewed: boolean) => {
    setError('');
    setMessage('');
    for (const a of data.answers) {
      const v = num(scores[a.questionId] ?? '');
      if (v !== null && (!Number.isFinite(v) || v < 0 || v > a.maxScore)) {
        const area = data.areas.find((x) => x.areaId === a.areaId)?.name;
        return setError(`${area} ${a.label || a.questionNo}: 0 ~ ${a.maxScore}점 사이로 입력해주세요.`);
      }
    }
    if (markReviewed && emptyCount > 0) {
      return setError(`점수가 비어 있는 문항이 ${emptyCount}개 있습니다. 모두 입력한 뒤 검수 완료해주세요.`);
    }
    if (markReviewed && !window.confirm('검수 완료하면 이 결과가 최종 성적으로 확정됩니다. 진행할까요?')) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/grading/submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: data.answers.map((a) => ({ questionId: a.questionId, finalScore: num(scores[a.questionId] ?? '') })),
          areaComments: data.areas.map((a) => ({ areaId: a.areaId, comment: areaComments[a.areaId] ?? '' })),
          overallComment: overall,
          markReviewed,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '저장할 수 없습니다.');
      setData({ ...data, status: result.data.status, totalScore: result.data.totalScore });
      setDirty(false);
      setMessage(markReviewed ? '검수 완료되었습니다. 최종 성적으로 확정되었어요.' : '저장했습니다.');
      onSaved?.(result.data.status, result.data.totalScore);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  // 선생님 채점 영역(Speaking 등)의 영어 코멘트를 점수+메모로 AI 작성
  const writeComment = async (areaId: string) => {
    setError('');
    setCommentBusy(areaId);
    try {
      const areaScores = Object.fromEntries(
        data.answers.filter((a) => a.areaId === areaId).map((a) => [a.questionId, num(scores[a.questionId] ?? '')])
      );
      const res = await fetch(`/api/grading/submissions/${submissionId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaId, scores: areaScores, notes: notes[areaId] ?? '' }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '코멘트를 만들 수 없습니다.');
      setAreaComments((prev) => ({ ...prev, [areaId]: result.data.comment }));
      setDirty(true);
      setMessage('코멘트를 작성했어요. 확인 후 저장 또는 검수 완료를 눌러주세요.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '코멘트 생성 실패');
    } finally {
      setCommentBusy(null);
    }
  };
  const teacherAreaIds = new Set(teacherItems.map((q) => q.areaId));

  const scoreInput = (q: AnswerResult) => (
    <input
      className={`${styles.input} ${styles.scoreInput}`}
      type="number"
      min={0}
      max={q.maxScore}
      step={0.5}
      value={scores[q.questionId] ?? ''}
      onChange={(e) => setScore(q, e.target.value)}
      placeholder="-"
    />
  );

  return (
    <div className={styles.resultBox}>
      <div className={styles.resultSummary}>
        <div>
          <strong>
            총점 {total} / {maxTotal}
          </strong>
          {emptyCount > 0 && <span className={styles.areaTotal}> · 미입력 {emptyCount}문항</span>}
          {isReviewed && <span className={`${styles.statusTag} ${styles.status_reviewed}`} style={{ marginLeft: 8 }}>검수완료</span>}
        </div>
        {flagged > 0 && <span className={styles.flagTag}>AI 확인 필요 {flagged}문항</span>}
      </div>

      {/* 선생님 채점 (Speaking 등) */}
      {teacherItems.length > 0 && (
        <div className={styles.teacherBox}>
          <div className={styles.fileSlotTitle}>선생님 채점 항목 입력</div>
          <div className={styles.fileSlotHint}>Speaking처럼 AI가 채점하지 않는 항목입니다. 각 항목 점수를 입력하세요.</div>
          <div className={styles.teacherGrid}>
            {teacherItems.map((q) => {
              const area = data.areas.find((a) => a.areaId === q.areaId)?.name;
              return (
                <label key={q.questionId} className={styles.teacherItem} title={q.answerKey || undefined}>
                  <span>
                    {area} · {q.label || `Q${q.questionNo}`}
                  </span>
                  <span className={styles.teacherInputRow}>
                    {scoreInput(q)} / {q.maxScore}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* 영역별 점수 + 코멘트 */}
      <div className={styles.areaResultGrid}>
        {data.areas.map((a) => (
          <div key={a.areaId} className={styles.areaResult}>
            <div className={styles.areaResultHead}>
              <span>{a.name}</span>
              <span>
                {areaFilled(a.areaId) ? areaScore(a.areaId) : '—'} / {a.maxScore}
              </span>
            </div>
            <textarea
              className={`${styles.input} ${styles.commentInput}`}
              rows={3}
              value={areaComments[a.areaId] ?? ''}
              onChange={(e) => {
                setAreaComments((prev) => ({ ...prev, [a.areaId]: e.target.value }));
                setDirty(true);
              }}
              placeholder="Comment (English)"
            />
            {teacherAreaIds.has(a.areaId) && (
              <div className={styles.commentTools}>
                <input
                  className={styles.input}
                  value={notes[a.areaId] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [a.areaId]: e.target.value }))}
                  placeholder="메모 (선택, 한국어 가능) 예: 발음 좋음, 말이 자주 끊김"
                />
                <button
                  type="button"
                  className={styles.ghostBtn}
                  disabled={commentBusy !== null}
                  onClick={() => writeComment(a.areaId)}
                >
                  {commentBusy === a.areaId ? '작성 중...' : 'AI로 코멘트 작성'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <label className={styles.field} style={{ marginTop: '0.75rem' }}>
        Overall Comment
        <textarea
          className={styles.input}
          rows={3}
          value={overall}
          onChange={(e) => {
            setOverall(e.target.value);
            setDirty(true);
          }}
          placeholder="Overall comment for parents (English)"
        />
      </label>

      {/* AI 채점 문항 확인·수정 */}
      {aiItems.length > 0 && (
        <details className={styles.answerDetails} open={flagged > 0}>
          <summary>문항별 점수 확인·수정 ({aiItems.length}문항)</summary>
          <div className={styles.tableWrap}>
            <table className={styles.qTable}>
              <thead>
                <tr>
                  <th>영역 / 번호</th>
                  <th>정답</th>
                  <th>학생 답</th>
                  <th>점수</th>
                  <th>AI Feedback</th>
                </tr>
              </thead>
              <tbody>
                {aiItems.map((q) => {
                  const area = data.areas.find((a) => a.areaId === q.areaId);
                  return (
                    <tr key={q.questionId} className={q.needsReview ? styles.rowFlag : undefined}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {area?.name} {q.questionNo}
                        {q.label && ` (${q.label})`}
                        {q.needsReview && <span className={styles.flagTag} style={{ marginLeft: 6 }}>확인</span>}
                      </td>
                      <td>{q.answerKey || <span className={styles.typeTag}>{QUESTION_TYPE_LABELS[q.questionType]}</span>}</td>
                      <td>{q.studentAnswer ?? '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {scoreInput(q)} / {q.maxScore}
                        {q.aiScore !== null && num(scores[q.questionId] ?? '') !== q.aiScore && (
                          <div className={styles.fileSlotHint}>AI: {q.aiScore}</div>
                        )}
                      </td>
                      <td className={styles.rubricCell}>{q.aiComment ?? ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {error && <div className={styles.error} style={{ marginTop: '0.75rem' }}>{error}</div>}
      {message && <div className={styles.notice} style={{ marginTop: '0.75rem' }}>{message}</div>}

      <div className={styles.reviewBar}>
        <span className={styles.fileSlotHint}>
          {data.aiModel ? `AI 채점 모델: ${data.aiModel}` : 'AI 채점 전 - 선생님 점수만 먼저 입력할 수 있어요.'}
          {dirty && ' · 저장하지 않은 변경 사항이 있어요'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className={styles.ghostBtn} onClick={() => save(false)} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
          <button type="button" className={styles.primaryBtnSm} onClick={() => save(true)} disabled={saving}>
            {isReviewed ? '다시 확정' : '검수 완료'}
          </button>
        </div>
      </div>
    </div>
  );
}
