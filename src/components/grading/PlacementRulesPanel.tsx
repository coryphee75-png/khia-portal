'use client';

import React, { useEffect, useState } from 'react';
import { ExamArea, PlacementRule } from '@/lib/grading';
import styles from '@/app/grading/grading.module.css';

interface RuleDraft {
  key: number;
  className: string;
  minTotal: string;
  areaMins: Record<string, string>;
}

let seq = 1;
const toDraft = (r: PlacementRule): RuleDraft => ({
  key: seq++,
  className: r.className,
  minTotal: r.minTotal === null ? '' : String(r.minTotal),
  areaMins: Object.fromEntries(Object.entries(r.areaMins).map(([k, v]) => [k, String(v)])),
});

/**
 * 반 배정 기준 입력 - 위쪽 반부터 확인해서 모든 조건(영역별 최소 점수 + 총점)을 넘는 첫 반을 성적표에 추천
 */
export default function PlacementRulesPanel({
  examId,
  areas,
  totalMax,
  onSaved,
}: {
  examId: string;
  areas: ExamArea[];
  totalMax: number;
  onSaved?: () => void;
}) {
  const [rules, setRules] = useState<RuleDraft[]>([]);
  const [classNames, setClassNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const [allowedMisses, setAllowedMisses] = useState(1);

  useEffect(() => {
    Promise.all([
      fetch(`/api/grading/exams/${examId}/placement-rules`).then((r) => r.json()),
      fetch('/api/grading/options').then((r) => r.json()),
    ])
      .then(([rulesRes, optRes]) => {
        if (!rulesRes.success) throw new Error(rulesRes.error || '기준을 불러올 수 없습니다.');
        setRules(rulesRes.data.rules.map(toDraft));
        setAllowedMisses(rulesRes.data.allowedMisses);
        if (optRes.success) setClassNames(optRes.data.classes.map((c: { name: string }) => c.name));
      })
      .catch((e) => setError(e instanceof Error ? e.message : '오류'))
      .finally(() => setLoading(false));
  }, [examId]);

  const update = (key: number, patch: Partial<RuleDraft>) => {
    setRules((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
    setNotice('');
  };

  const move = (index: number, dir: -1 | 1) => {
    setRules((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
    setDirty(true);
  };

  const add = () => {
    setRules((prev) => [...prev, { key: seq++, className: '', minTotal: '', areaMins: {} }]);
    setDirty(true);
  };

  const save = async () => {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const res = await fetch(`/api/grading/exams/${examId}/placement-rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowedMisses,
          rules: rules.map((r) => ({
            className: r.className,
            minTotal: r.minTotal.trim() === '' ? null : Number(r.minTotal),
            areaMins: Object.fromEntries(
              Object.entries(r.areaMins)
                .filter(([, v]) => v.trim() !== '')
                .map(([k, v]) => [k, Number(v)])
            ),
          })),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '저장할 수 없습니다.');
      setRules(result.data.rules.map(toDraft));
      setAllowedMisses(result.data.allowedMisses);
      setDirty(false);
      setNotice('반 배정 기준을 저장했습니다. 성적표와 제출 현황의 추천 반에 바로 반영됩니다.');
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.status}>불러오는 중...</div>;

  return (
    <div className={styles.card}>
      <p className={styles.subtitle} style={{ marginTop: 0, marginBottom: '0.75rem' }}>
        <strong>총점 기준은 반드시 넘고, 영역 기준은 아래에서 정한 개수까지 미달을 허용</strong>해서 통과한 반들 중 기준이 가장
        높은 반이 성적표에 &ldquo;Recommended Class&rdquo;로 표시됩니다. 입력 순서는 상관없어요. 비워둔 칸은 조건 없음이며, 조건이
        하나도 없는 반을 넣어두면 기본 반이 됩니다. (추천만 표시하며, 실제 반 이동은 관리자 화면에서 직접 해주세요)
      </p>
      <label className={styles.missRow}>
        영역 기준 미달 허용
        <select
          className={styles.input}
          value={allowedMisses}
          onChange={(e) => {
            setAllowedMisses(Number(e.target.value));
            setDirty(true);
            setNotice('');
          }}
        >
          <option value={0}>0개 (모든 영역 기준을 넘어야 함)</option>
          <option value={1}>1개까지 허용</option>
          <option value={2}>2개까지 허용</option>
        </select>
        <span className={styles.fileSlotHint}>총점 기준은 항상 넘어야 합니다.</span>
      </label>

      {error && <div className={styles.error}>{error}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      {rules.length === 0 ? (
        <div className={styles.fileEmpty} style={{ marginBottom: '0.75rem' }}>
          아직 기준이 없습니다. &ldquo;+ 반 추가&rdquo;로 높은 반부터 입력해주세요.
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.qTable} style={{ minWidth: 560 + areas.length * 70 }}>
            <thead>
              <tr>
                <th>순서</th>
                <th>반 이름</th>
                {areas.map((a) => (
                  <th key={a.id} style={{ textAlign: 'center' }}>
                    {a.name}
                    <div className={styles.fileSlotHint}>/ {a.maxScore}</div>
                  </th>
                ))}
                <th style={{ textAlign: 'center' }}>
                  총점
                  <div className={styles.fileSlotHint}>/ {totalMax}</div>
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rules.map((r, i) => (
                <tr key={r.key}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className={styles.pageNo}>{i + 1}</span>
                    <button type="button" className={styles.iconBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로">
                      ▲
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => move(i, 1)}
                      disabled={i === rules.length - 1}
                      aria-label="아래로"
                    >
                      ▼
                    </button>
                  </td>
                  <td>
                    <input
                      className={styles.input}
                      list={`class-names-${examId}`}
                      value={r.className}
                      onChange={(e) => update(r.key, { className: e.target.value })}
                      placeholder="예: Jupiter (7YB)"
                    />
                  </td>
                  {areas.map((a) => (
                    <td key={a.id} style={{ textAlign: 'center' }}>
                      <input
                        className={`${styles.input} ${styles.scoreInput}`}
                        type="number"
                        min={0}
                        max={a.maxScore}
                        step={0.5}
                        value={r.areaMins[a.id] ?? ''}
                        onChange={(e) => update(r.key, { areaMins: { ...r.areaMins, [a.id]: e.target.value } })}
                        placeholder="-"
                      />
                    </td>
                  ))}
                  <td style={{ textAlign: 'center' }}>
                    <input
                      className={`${styles.input} ${styles.scoreInput}`}
                      type="number"
                      min={0}
                      max={totalMax}
                      step={0.5}
                      value={r.minTotal}
                      onChange={(e) => update(r.key, { minTotal: e.target.value })}
                      placeholder="-"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => {
                        setRules((prev) => prev.filter((x) => x.key !== r.key));
                        setDirty(true);
                      }}
                      aria-label={`${r.className || '반'} 삭제`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <datalist id={`class-names-${examId}`}>
        {classNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className={styles.reviewBar}>
        <button type="button" className={styles.ghostBtn} onClick={add}>
          + 반 추가
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {dirty && <span className={styles.fileSlotHint}>저장하지 않은 변경 사항이 있어요</span>}
          <button type="button" className={styles.primaryBtnSm} onClick={save} disabled={saving}>
            {saving ? '저장 중...' : '기준 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
