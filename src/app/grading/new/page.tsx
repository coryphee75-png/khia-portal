'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BRANCH_LABELS,
  Branch,
  ExamFileKind,
  ExamType,
  QUESTION_TYPES,
  QUESTION_TYPE_HINTS,
  QUESTION_TYPE_LABELS,
  QuestionType,
} from '@/lib/grading';
import { EXAM_TEMPLATES } from '@/lib/examTemplates';
import { uploadExamFile, validateExamFile } from '@/lib/gradingUpload';
import ExamFilesPanel, { PanelFileItem } from '@/components/grading/ExamFilesPanel';
import styles from '../grading.module.css';

interface QuestionDraft {
  key: number;
  maxScore: string;
  questionType: QuestionType;
  label: string;
  answerKey: string;
  rubricText: string;
}

interface AreaDraft {
  key: number;
  name: string;
  questions: QuestionDraft[];
}

interface ClassOption {
  id: string;
  name: string;
  grade: number;
  branch: Branch;
}

let keySeq = 1;
const nextKey = () => keySeq++;

function makeQuestions(count: number, score: string, questionType: QuestionType = 'choice'): QuestionDraft[] {
  return Array.from({ length: count }, () => ({
    key: nextKey(),
    maxScore: score,
    questionType,
    label: '',
    answerKey: '',
    rubricText: '',
  }));
}

// 영어학원 시험에서 자주 쓰는 영역으로 시작 (자유롭게 수정/삭제 가능)
const DEFAULT_AREAS = ['Reading', 'Grammar', 'Vocabulary', 'Writing'];

/**
 * /grading/new - 시험 만들기 (영역·배점·정답/루브릭 등록)
 */
export default function NewExamPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [examType, setExamType] = useState<ExamType>('regular');
  const [classId, setClassId] = useState('');
  const [branch, setBranch] = useState<Branch>('Sejong');
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [areas, setAreas] = useState<AreaDraft[]>(() =>
    DEFAULT_AREAS.map((name) => ({ key: nextKey(), name, questions: makeQuestions(5, '4') }))
  );

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [blobEnabled, setBlobEnabled] = useState(false);
  // 시험 저장 전에 골라둔 자료 파일 (저장 직후 업로드)
  const [pendingFiles, setPendingFiles] = useState<{ key: string; kind: ExamFileKind; file: File }[]>([]);
  const [savingStep, setSavingStep] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/grading/options');
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result?.error || '반 목록을 불러올 수 없습니다.');
        setClasses(result.data.classes);
        if (result.data.myBranch) setBranch(result.data.myBranch);
        setBlobEnabled(!!result.data.blobEnabled);
        if (result.data.classes.length === 0) setExamType('placement');
        setOptionsLoaded(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
      }
    })();
  }, []);

  const total = useMemo(
    () =>
      areas.reduce(
        (sum, a) => sum + a.questions.reduce((s, q) => s + (Number(q.maxScore) || 0), 0),
        0
      ),
    [areas]
  );

  // ===== 영역/문항 편집 헬퍼 =====
  const updateArea = (key: number, patch: Partial<AreaDraft>) =>
    setAreas((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));

  const updateQuestion = (areaKey: number, qKey: number, patch: Partial<QuestionDraft>) =>
    setAreas((prev) =>
      prev.map((a) =>
        a.key === areaKey
          ? { ...a, questions: a.questions.map((q) => (q.key === qKey ? { ...q, ...patch } : q)) }
          : a
      )
    );

  const addQuestions = (areaKey: number, count: number, score: string, questionType: QuestionType) =>
    setAreas((prev) =>
      prev.map((a) =>
        a.key === areaKey
          ? { ...a, questions: [...a.questions, ...makeQuestions(count, score, questionType)] }
          : a
      )
    );

  // ===== 템플릿 불러오기 =====
  const applyTemplate = (templateId: string) => {
    const t = EXAM_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    const hasInput = title.trim() || areas.some((a) => a.questions.some((q) => q.answerKey || q.rubricText));
    if (hasInput && !window.confirm('지금 입력한 영역/문항을 템플릿 내용으로 바꿀까요?')) return;
    setTitle(t.title);
    setExamType(t.examType);
    setBranch(t.branch);
    setAreas(
      t.areas.map((a) => ({
        key: nextKey(),
        name: a.name,
        questions: a.questions.map((q) => ({
          key: nextKey(),
          maxScore: String(q.maxScore),
          questionType: q.questionType,
          label: q.label ?? '',
          answerKey: q.answerKey ?? '',
          rubricText: q.rubricText ?? '',
        })),
      }))
    );
  };

  const removeQuestion = (areaKey: number, qKey: number) =>
    setAreas((prev) =>
      prev.map((a) =>
        a.key === areaKey ? { ...a, questions: a.questions.filter((q) => q.key !== qKey) } : a
      )
    );

  const addArea = () =>
    setAreas((prev) => [...prev, { key: nextKey(), name: '', questions: makeQuestions(5, '4') }]);

  const removeArea = (key: number) => setAreas((prev) => prev.filter((a) => a.key !== key));

  // ===== 자료 파일 (저장 전 대기) =====
  const addPendingFiles = (kind: ExamFileKind, files: File[]) => {
    const problems = files.map(validateExamFile).filter(Boolean);
    if (problems.length) setError(problems.join(' '));
    const ok = files.filter((f) => !validateExamFile(f));
    setPendingFiles((prev) => [...prev, ...ok.map((file) => ({ key: `p${nextKey()}`, kind, file }))]);
  };

  const pendingItems: PanelFileItem[] = pendingFiles.map((p) => ({
    key: p.key,
    kind: p.kind,
    fileName: p.file.name,
    sizeBytes: p.file.size,
  }));

  // ===== 저장 =====
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) return setError('시험 이름을 입력해주세요.');
    if (examType === 'regular' && !classId) return setError('정기시험은 반을 선택해주세요.');
    if (areas.length === 0) return setError('영역을 1개 이상 추가해주세요.');

    setSaving(true);
    try {
      const res = await fetch('/api/grading/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          examType,
          classId: examType === 'regular' ? classId : null,
          branch,
          examDate: examDate || null,
          areas: areas.map((a) => ({
            name: a.name,
            questions: a.questions.map((q) => ({
              maxScore: Number(q.maxScore),
              questionType: q.questionType,
              label: q.label,
              answerKey: q.answerKey,
              rubricText: q.rubricText,
            })),
          })),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '저장할 수 없습니다.');
      const examId: string = result.data.id;

      // 시험이 만들어진 뒤 자료 파일을 차례로 업로드 (실패한 파일은 상세 화면에서 다시 올릴 수 있음)
      let failed = 0;
      for (let i = 0; i < pendingFiles.length; i++) {
        setSavingStep(`자료 업로드 중 (${i + 1}/${pendingFiles.length})`);
        try {
          await uploadExamFile(examId, pendingFiles[i].kind, pendingFiles[i].file, blobEnabled);
        } catch (uploadError) {
          console.error('Exam file upload failed:', uploadError);
          failed++;
        }
      }
      router.push(failed ? `/grading/${examId}?fileErrors=${failed}` : `/grading/${examId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
      setSaving(false);
    }
  };

  return (
    <form className={styles.page} onSubmit={handleSubmit}>
      <Link href="/grading" className={styles.backLink}>
        ← 시험 목록
      </Link>
      <div className={styles.titleRow}>
        <div>
          <h1>시험 만들기</h1>
          <p className={styles.subtitle}>
            영역과 문항별 배점·정답을 등록하세요. 서술형/손글씨 문항은 루브릭(채점 기준)을 적어두면 AI가
            그 기준으로 1차 채점합니다.
          </p>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* 템플릿 */}
      <div className={`${styles.card} ${styles.templateBar}`}>
        <div>
          <div className={styles.fileSlotTitle}>템플릿으로 시작하기</div>
          <div className={styles.fileSlotHint}>KHIA 시험의 영역·정답·채점 기준을 한 번에 불러옵니다.</div>
        </div>
        <select
          className={styles.input}
          style={{ maxWidth: 360 }}
          value=""
          onChange={(e) => applyTemplate(e.target.value)}
        >
          <option value="">템플릿 선택...</option>
          {EXAM_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* 기본 정보 */}
      <div className={styles.card}>
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.fieldFull}`}>
            시험 이름
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 2026 10월 정기시험 / 신입생 배치고사"
            />
          </label>

          <label className={styles.field}>
            시험 종류
            <select value={examType} onChange={(e) => setExamType(e.target.value as ExamType)}>
              <option value="regular">정기시험 (반 단위)</option>
              <option value="placement">배치고사 (반 배정 전 신입생)</option>
            </select>
          </label>

          <label className={styles.field}>
            시험일
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </label>

          {examType === 'regular' ? (
            <label className={`${styles.field} ${styles.fieldFull}`}>
              반
              <select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">반을 선택하세요</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    [{BRANCH_LABELS[c.branch]}] {c.name} ({c.grade}학년)
                  </option>
                ))}
              </select>
              {optionsLoaded && classes.length === 0 && (
                <span className={styles.subtitle}>담당 반이 없습니다. 관리자에게 반 배정을 요청하세요.</span>
              )}
            </label>
          ) : (
            <label className={`${styles.field} ${styles.fieldFull}`}>
              지점
              <select value={branch} onChange={(e) => setBranch(e.target.value as Branch)}>
                <option value="Sejong">{BRANCH_LABELS.Sejong}</option>
                <option value="Gwangyo">{BRANCH_LABELS.Gwangyo}</option>
              </select>
            </label>
          )}
        </div>
      </div>

      {/* 시험 자료 파일 */}
      <div className={styles.sectionTitle}>
        <h2>시험 자료 (선택)</h2>
      </div>
      <div className={styles.card}>
        <p className={styles.subtitle} style={{ marginTop: 0, marginBottom: '0.75rem' }}>
          시험지 샘플·답지·루브릭 파일을 올려두면 선생님끼리 공유할 수 있고, 다음 단계에서 AI 채점의 기준 자료로
          함께 사용합니다. 파일은 &ldquo;시험 저장&rdquo;을 누를 때 업로드됩니다.
        </p>
        <ExamFilesPanel
          files={pendingItems}
          onAdd={addPendingFiles}
          onRemove={(item) => setPendingFiles((prev) => prev.filter((p) => p.key !== item.key))}
        />
      </div>

      {/* 영역 / 문항 */}
      <div className={styles.sectionTitle}>
        <h2>영역 및 문항</h2>
        <button type="button" className={styles.ghostBtn} onClick={addArea}>
          + 영역 추가
        </button>
      </div>

      {areas.map((area) => (
        <AreaEditor
          key={area.key}
          area={area}
          onRename={(name) => updateArea(area.key, { name })}
          onRemove={() => removeArea(area.key)}
          onUpdateQuestion={(qKey, patch) => updateQuestion(area.key, qKey, patch)}
          onRemoveQuestion={(qKey) => removeQuestion(area.key, qKey)}
          onAddQuestions={(count, score, type) => addQuestions(area.key, count, score, type)}
        />
      ))}

      <div className={styles.stickyBar}>
        <span className={styles.totalLabel}>
          총 {areas.reduce((n, a) => n + a.questions.length, 0)}문항 · 만점 {total}점
        </span>
        <button type="submit" className={styles.primaryBtn} disabled={saving}>
          {saving ? savingStep || '저장 중...' : '시험 저장'}
        </button>
      </div>
    </form>
  );
}

function AreaEditor({
  area,
  onRename,
  onRemove,
  onUpdateQuestion,
  onRemoveQuestion,
  onAddQuestions,
}: {
  area: AreaDraft;
  onRename: (name: string) => void;
  onRemove: () => void;
  onUpdateQuestion: (qKey: number, patch: Partial<QuestionDraft>) => void;
  onRemoveQuestion: (qKey: number) => void;
  onAddQuestions: (count: number, score: string, questionType: QuestionType) => void;
}) {
  const [bulkCount, setBulkCount] = useState('5');
  const [bulkScore, setBulkScore] = useState('4');
  const [bulkType, setBulkType] = useState<QuestionType>('choice');
  const areaTotal = area.questions.reduce((s, q) => s + (Number(q.maxScore) || 0), 0);

  return (
    <div className={`${styles.card} ${styles.areaCard}`}>
      <div className={styles.areaHeader}>
        <input
          className={styles.input}
          value={area.name}
          onChange={(e) => onRename(e.target.value)}
          placeholder="영역 이름 (예: Reading)"
        />
        <span className={styles.areaTotal}>
          {area.questions.length}문항 · {areaTotal}점
        </span>
        <button type="button" className={styles.dangerBtn} onClick={onRemove}>
          영역 삭제
        </button>
      </div>

      {area.questions.length > 0 && (
        <div className={styles.tableWrap}>
        <table className={styles.qTable}>
          <thead>
            <tr>
              <th>번호</th>
              <th>유형</th>
              <th>배점</th>
              <th>정답 / 평가 항목</th>
              <th>루브릭 (채점 기준, 선택)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {area.questions.map((q, i) => (
              <tr key={q.key}>
                <td className={styles.qNo}>{i + 1}</td>
                <td className={styles.qType}>
                  <select
                    className={styles.input}
                    value={q.questionType}
                    title={QUESTION_TYPE_HINTS[q.questionType]}
                    onChange={(e) => onUpdateQuestion(q.key, { questionType: e.target.value as QuestionType })}
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {QUESTION_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={styles.qScore}>
                  <input
                    className={styles.input}
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={q.maxScore}
                    onChange={(e) => onUpdateQuestion(q.key, { maxScore: e.target.value })}
                  />
                </td>
                <td>
                  {q.questionType === 'rubric' || q.questionType === 'teacher' ? (
                    <input
                      className={styles.input}
                      value={q.label}
                      onChange={(e) => onUpdateQuestion(q.key, { label: e.target.value })}
                      placeholder="평가 항목 (예: Content)"
                    />
                  ) : (
                    <input
                      className={styles.input}
                      value={q.answerKey}
                      onChange={(e) => onUpdateQuestion(q.key, { answerKey: e.target.value })}
                      placeholder="예: B / apple"
                    />
                  )}
                </td>
                <td>
                  <textarea
                    className={styles.input}
                    rows={1}
                    value={q.rubricText}
                    onChange={(e) => onUpdateQuestion(q.key, { rubricText: e.target.value })}
                    placeholder="예: 주어+동사 완전한 문장이면 만점, 철자 오류 1개당 -1"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => onRemoveQuestion(q.key)}
                    aria-label={`${i + 1}번 문항 삭제`}
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

      <div className={styles.bulkRow}>
        문항
        <input
          className={styles.input}
          type="number"
          min="1"
          value={bulkCount}
          onChange={(e) => setBulkCount(e.target.value)}
        />
        개를 배점
        <input
          className={styles.input}
          type="number"
          min="0.5"
          step="0.5"
          value={bulkScore}
          onChange={(e) => setBulkScore(e.target.value)}
        />
        점,
        <select
          className={styles.input}
          style={{ width: 'auto' }}
          value={bulkType}
          onChange={(e) => setBulkType(e.target.value as QuestionType)}
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        유형으로
        <button
          type="button"
          className={styles.ghostBtn}
          onClick={() =>
            onAddQuestions(Math.max(1, Math.min(100, Number(bulkCount) || 1)), bulkScore, bulkType)
          }
        >
          추가
        </button>
      </div>
    </div>
  );
}
