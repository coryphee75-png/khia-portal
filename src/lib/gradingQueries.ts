/**
 * 채점 기능 서버 전용 코드 - 권한 체크 / 공용 SQL / 매퍼 (API 라우트에서만 사용)
 * - admin: 모든 지점의 시험을 보고 관리 가능
 * - teacher: 본인이 만든 시험 + 본인 담당 반의 시험만 관리 가능
 */
import type { Session } from 'next-auth';
import { query, queryOne } from './db';
import {
  Branch,
  ExamFile,
  ExamFileKind,
  ExamStatus,
  ExamSummary,
  ExamType,
  meetsRule,
  missedAreas,
  PlacementRule,
  recommendClass,
  SubmissionStatus,
  SubmissionSummary,
} from './grading';

type MinimalSession = Pick<Session, 'user'> | null | undefined;

export interface ExamSummaryRow {
  id: number;
  title: string;
  exam_type: ExamType;
  class_id: number | null;
  class_name: string | null;
  branch: Branch;
  exam_date: Date | string | null;
  status: ExamStatus;
  created_by_name: string | null;
  total_score: string | null;
  question_count: string;
  submission_count: string;
  reviewed_count: string;
  created_at: Date | string;
}

/** 시험 목록/상세 공통 SELECT (WHERE 절은 호출하는 쪽에서 붙임) */
export const EXAM_SUMMARY_SELECT = `
  SELECT e.id, e.title, e.exam_type, e.class_id, cl.name AS class_name, e.branch,
         e.exam_date, e.status, u.name AS created_by_name, e.created_at,
         (SELECT COALESCE(SUM(a.max_score), 0) FROM exam_areas a WHERE a.exam_id = e.id) AS total_score,
         (SELECT COUNT(*) FROM exam_questions q JOIN exam_areas a ON q.area_id = a.id
            WHERE a.exam_id = e.id) AS question_count,
         (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id) AS submission_count,
         (SELECT COUNT(*) FROM submissions s WHERE s.exam_id = e.id AND s.status = 'reviewed') AS reviewed_count
  FROM exams e
  LEFT JOIN classes cl ON e.class_id = cl.id
  LEFT JOIN users u ON e.created_by = u.id`;

function toDateString(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    // DATE 컬럼은 로컬 자정으로 파싱되므로 로컬 기준 YYYY-MM-DD로 변환
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

export function mapExamSummary(row: ExamSummaryRow): ExamSummary {
  return {
    id: String(row.id),
    title: row.title,
    examType: row.exam_type,
    classId: row.class_id !== null ? String(row.class_id) : null,
    className: row.class_name,
    branch: row.branch,
    examDate: toDateString(row.exam_date),
    status: row.status,
    createdByName: row.created_by_name,
    totalScore: Number(row.total_score ?? 0),
    questionCount: Number(row.question_count),
    submissionCount: Number(row.submission_count),
    reviewedCount: Number(row.reviewed_count),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * 특정 시험을 관리(조회/채점/검수)할 수 있는지 확인
 */
export async function canManageExam(session: MinimalSession, examId: number): Promise<boolean> {
  if (!session?.user) return false;
  if (session.user.role === 'admin') return true;
  if (session.user.role !== 'teacher') return false;

  const row = await queryOne<{ created_by: number | null; teacher_id: number | null }>(
    `SELECT e.created_by, cl.teacher_id
     FROM exams e LEFT JOIN classes cl ON e.class_id = cl.id
     WHERE e.id = $1`,
    [examId]
  );
  if (!row) return false;
  const me = session.user.id;
  return String(row.created_by) === me || String(row.teacher_id) === me;
}

// ===== 시험 자료 파일 =====
export interface ExamFileRow {
  id: number;
  exam_id: number;
  kind: ExamFileKind;
  file_name: string;
  url: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: Date | string;
}

export function mapExamFile(row: ExamFileRow): ExamFile {
  return {
    id: String(row.id),
    kind: row.kind,
    fileName: row.file_name,
    url: row.url,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** Vercel Blob에 올라간 파일 주소인지 확인 (클라이언트가 등록 요청한 url 검증용) */
export function isVercelBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.endsWith('.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

// ===== 학생 답안지 =====
export interface SubmissionRow {
  id: number;
  exam_id: number;
  student_id: number | null;
  student_name: string;
  scan_image_urls: string[];
  scan_file_names: string[];
  status: SubmissionStatus;
  total_score: string | null;
  overall_comment?: string | null;
  graded_at?: Date | string | null;
  ai_error?: string | null;
  ai_model?: string | null;
  created_at: Date | string;
}

export function mapSubmission(row: SubmissionRow): SubmissionSummary {
  return {
    id: String(row.id),
    studentId: row.student_id !== null ? String(row.student_id) : null,
    studentName: row.student_name,
    status: row.status,
    totalScore: row.total_score !== null ? Number(row.total_score) : null,
    aiError: row.ai_error ?? null,
    pages: (row.scan_image_urls || []).map((url, i) => ({
      url,
      fileName: row.scan_file_names?.[i] || `page-${i + 1}`,
    })),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** 특정 제출본이 속한 시험 id (권한 체크용) */
export async function getSubmissionExamId(submissionId: number): Promise<number | null> {
  const row = await queryOne<{ exam_id: number }>('SELECT exam_id FROM submissions WHERE id = $1', [
    submissionId,
  ]);
  return row ? row.exam_id : null;
}

// ===== 반 배정 기준 =====
export async function loadAllowedMisses(examId: number): Promise<number> {
  const row = await queryOne<{ placement_allowed_misses: number | null }>(
    'SELECT placement_allowed_misses FROM exams WHERE id = $1',
    [examId]
  );
  return row?.placement_allowed_misses ?? 1;
}

export async function loadPlacementRules(examId: number): Promise<PlacementRule[]> {
  const rows = await query<{ id: number; class_name: string; min_total: string | null; area_mins: Record<string, number> | null }>(
    'SELECT id, class_name, min_total, area_mins FROM exam_placement_rules WHERE exam_id = $1 ORDER BY order_no, id',
    [examId]
  );
  return rows.map((r) => ({
    id: String(r.id),
    className: r.class_name,
    minTotal: r.min_total !== null ? Number(r.min_total) : null,
    areaMins: Object.fromEntries(Object.entries(r.area_mins || {}).map(([k, v]) => [k, Number(v)])),
  }));
}

/** 제출본별 영역 점수/총점으로 추천 반 + 반별 통과 여부 설명 계산 (시험 단위로 한 번에) */
export async function recommendForSubmissions(
  examId: number,
  submissions: { id: number; total_score: string | null }[]
): Promise<Map<number, { recommended: string | null; note: string }>> {
  const result = new Map<number, { recommended: string | null; note: string }>();
  const rules = await loadPlacementRules(examId);
  if (rules.length === 0 || submissions.length === 0) return result;
  const allowedMisses = await loadAllowedMisses(examId);
  const rows = await query<{ submission_id: number; area_id: number; score: string | null; name: string }>(
    `SELECT r.submission_id, r.area_id, r.score, a.name FROM submission_area_results r
     JOIN submissions s ON r.submission_id = s.id JOIN exam_areas a ON r.area_id = a.id WHERE s.exam_id = $1`,
    [examId]
  );
  const areaNames = new Map(rows.map((r) => [String(r.area_id), r.name]));
  for (const s of submissions) {
    if (s.total_score === null) {
      result.set(s.id, { recommended: null, note: '아직 점수가 없습니다.' });
      continue;
    }
    const total = Number(s.total_score);
    const scores: Record<string, number | null> = {};
    rows.filter((r) => r.submission_id === s.id).forEach((r) => {
      scores[String(r.area_id)] = r.score !== null ? Number(r.score) : null;
    });
    // 반별로 통과/미달 사유를 한 줄씩 (마우스를 올리면 보이는 설명)
    const lines = rules.map((rule) => {
      const misses: string[] = [];
      const totalFail = rule.minTotal !== null && total < rule.minTotal;
      if (totalFail) misses.push(`총점 ${total} < ${rule.minTotal}`);
      for (const areaId of missedAreas(rule, scores)) {
        const sc = scores[areaId];
        const name = areaNames.get(areaId) ?? '영역';
        misses.push(sc === null || sc === undefined ? `${name} 점수 없음` : `${name} ${sc} < ${rule.areaMins[areaId]}`);
      }
      const pass = meetsRule(rule, scores, total, allowedMisses);
      if (pass) return `${rule.className}: 통과${misses.length ? ` (허용 미달: ${misses.join(', ')})` : ''}`;
      return `${rule.className}: 미달 (${misses.join(', ')})`;
    });
    result.set(s.id, {
      recommended: recommendClass(rules, scores, total, allowedMisses),
      note: `영역 미달 ${allowedMisses}개까지 허용\n` + lines.join('\n'),
    });
  }
  return result;
}
