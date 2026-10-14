import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { ApiResponse } from '@/types';
import { Branch, ExamType, ReportData, SubmissionStatus } from '@/lib/grading';
import { canManageExam, loadAllowedMisses, loadPlacementRules } from '@/lib/gradingQueries';
import { recommendClass } from '@/lib/grading';

/**
 * GET /api/grading/submissions/[id]/report
 * 영어 성적표 데이터
 * - 관리자·담당 선생님: 검수 전에도 미리보기 가능
 * - 학부모: 본인 자녀 + 검수완료(reviewed)된 것만
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<ReportData>>> {
  const session = await auth();
  const { id } = await params;
  const submissionId = Number(id);
  const deny = () => NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  if (!session || !Number.isFinite(submissionId)) return deny();

  const sub = await queryOne<{
    id: number; exam_id: number; student_id: number | null; student_name: string; status: SubmissionStatus;
    total_score: string | null; overall_comment: string | null; reviewed_at: Date | null;
    title: string; exam_type: ExamType; exam_date: Date | string | null; branch: Branch;
    class_name: string | null; child_class_name: string | null; parent_id: number | null;
    reviewer_name: string | null; creator_name: string | null;
  }>(
    `SELECT s.id, s.exam_id, s.student_id, s.student_name, s.status, s.total_score, s.overall_comment, s.reviewed_at,
            e.title, e.exam_type, e.exam_date, e.branch, ecl.name AS class_name, ccl.name AS child_class_name,
            ch.parent_id, ru.name AS reviewer_name, cu.name AS creator_name
     FROM submissions s
     JOIN exams e ON s.exam_id = e.id
     LEFT JOIN classes ecl ON e.class_id = ecl.id
     LEFT JOIN children ch ON s.student_id = ch.id
     LEFT JOIN classes ccl ON ch.class_id = ccl.id
     LEFT JOIN users ru ON s.reviewed_by = ru.id
     LEFT JOIN users cu ON e.created_by = cu.id
     WHERE s.id = $1`,
    [submissionId]
  );
  if (!sub) return NextResponse.json({ success: false, error: '성적표를 찾을 수 없습니다.' }, { status: 404 });

  const role = session.user.role;
  if (role === 'parent') {
    if (sub.parent_id === null || String(sub.parent_id) !== session.user.id || sub.status !== 'reviewed') return deny();
  } else if (!(await canManageExam(session, sub.exam_id))) {
    return deny();
  }

  const areas = await query<{ id: number; name: string; max_score: string; score: string | null; comment: string | null }>(
    `SELECT a.id, a.name, a.max_score, r.score, COALESCE(NULLIF(r.final_comment, ''), r.ai_comment) AS comment
     FROM exam_areas a
     LEFT JOIN submission_area_results r ON r.area_id = a.id AND r.submission_id = $2
     WHERE a.exam_id = $1 ORDER BY a.order_no, a.id`,
    [sub.exam_id, submissionId]
  );

  // 같은 시험의 영역별 평균 (채점된 다른 답안지 포함, 2명 이상일 때만 표시)
  const avgRows = await query<{ area_id: number; avg_pct: string | null; n: string }>(
    `SELECT r.area_id, AVG(r.score / NULLIF(r.max_score, 0) * 100) AS avg_pct, COUNT(*) AS n
     FROM submission_area_results r JOIN submissions s ON r.submission_id = s.id
     WHERE s.exam_id = $1 AND s.status IN ('ai_graded', 'reviewed') AND r.score IS NOT NULL
     GROUP BY r.area_id`,
    [sub.exam_id]
  );
  const avgMap = new Map(avgRows.filter((r) => Number(r.n) >= 2).map((r) => [r.area_id, Number(r.avg_pct)]));

  const toDate = (v: Date | string | null) => {
    if (!v) return null;
    if (v instanceof Date) {
      return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    }
    return String(v).slice(0, 10);
  };

  const maxScore = areas.reduce((s, a) => s + Number(a.max_score), 0);
  const rules = await loadPlacementRules(sub.exam_id);
  const totalScore = sub.total_score !== null ? Number(sub.total_score) : null;
  const recommendedClass = rules.length
    ? recommendClass(
        rules,
        Object.fromEntries(areas.map((a) => [String(a.id), a.score !== null ? Number(a.score) : null])),
        totalScore,
        await loadAllowedMisses(sub.exam_id)
      )
    : null;
  const data: ReportData = {
    submissionId: String(sub.id),
    examId: String(sub.exam_id),
    status: sub.status,
    studentName: sub.student_name,
    className: sub.class_name ?? sub.child_class_name,
    branch: sub.branch,
    examTitle: sub.title,
    examType: sub.exam_type,
    examDate: toDate(sub.exam_date),
    totalScore: sub.total_score !== null ? Number(sub.total_score) : null,
    maxScore,
    areas: areas.map((a) => {
      const score = a.score !== null ? Number(a.score) : null;
      const max = Number(a.max_score);
      const avg = avgMap.get(a.id);
      return {
        name: a.name,
        score,
        maxScore: max,
        percent: score !== null && max > 0 ? Math.round((score / max) * 100) : null,
        averagePercent: avg !== undefined && Number.isFinite(avg) ? Math.round(avg) : null,
        comment: a.comment,
      };
    }),
    overallComment: sub.overall_comment,
    teacherName: sub.reviewer_name ?? sub.creator_name,
    reviewedAt: sub.reviewed_at ? toDate(new Date(sub.reviewed_at)) : null,
    recommendedClass,
    hasPlacementRules: rules.length > 0,
  };
  return NextResponse.json({ success: true, data });
}
