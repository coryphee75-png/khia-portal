import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { ApiResponse } from '@/types';
import { ExamDetail, QuestionType } from '@/lib/grading';
import {
  canManageExam,
  EXAM_SUMMARY_SELECT,
  ExamFileRow,
  ExamSummaryRow,
  mapExamFile,
  mapExamSummary,
} from '@/lib/gradingQueries';
import { removeStoredFile } from '@/lib/gradingStorage';

async function resolveExamId(params: Promise<{ id: string }>): Promise<number | null> {
  const { id } = await params;
  const examId = Number(id);
  return Number.isFinite(examId) && examId > 0 ? examId : null;
}

/**
 * GET /api/grading/exams/[id]
 * 시험 상세 (영역/문항 포함) - 관리자, 해당 시험 담당 선생님
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<ExamDetail>>> {
  const session = await auth();
  const examId = await resolveExamId(params);
  if (!examId) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }
  if (!(await canManageExam(session, examId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const row = await queryOne<ExamSummaryRow>(`${EXAM_SUMMARY_SELECT} WHERE e.id = $1`, [examId]);
  if (!row) {
    return NextResponse.json({ success: false, error: '시험을 찾을 수 없습니다.' }, { status: 404 });
  }

  const areaRows = await query<{ id: number; name: string; max_score: string; order_no: number }>(
    'SELECT id, name, max_score, order_no FROM exam_areas WHERE exam_id = $1 ORDER BY order_no, id',
    [examId]
  );
  const questionRows = await query<{
    id: number;
    area_id: number;
    question_no: number;
    max_score: string;
    question_type: QuestionType;
    label: string | null;
    answer_key: string | null;
    rubric_text: string | null;
  }>(
    `SELECT q.* FROM exam_questions q JOIN exam_areas a ON q.area_id = a.id
     WHERE a.exam_id = $1 ORDER BY q.area_id, q.question_no`,
    [examId]
  );

  const fileRows = await query<ExamFileRow>(
    'SELECT * FROM exam_files WHERE exam_id = $1 ORDER BY kind, created_at',
    [examId]
  );

  const detail: ExamDetail = {
    ...mapExamSummary(row),
    areas: areaRows.map((a) => ({
      id: String(a.id),
      name: a.name,
      maxScore: Number(a.max_score),
      orderNo: a.order_no,
      questions: questionRows
        .filter((q) => q.area_id === a.id)
        .map((q) => ({
          id: String(q.id),
          questionNo: q.question_no,
          maxScore: Number(q.max_score),
          questionType: q.question_type ?? 'choice',
          label: q.label ?? '',
          answerKey: q.answer_key ?? '',
          rubricText: q.rubric_text ?? '',
        })),
    })),
    files: fileRows.map(mapExamFile),
  };

  return NextResponse.json({ success: true, data: detail });
}

/**
 * DELETE /api/grading/exams/[id]
 * 시험 삭제 (영역/문항/제출본/채점결과까지 함께 삭제) - 관리자, 해당 시험 담당 선생님
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<null>>> {
  const session = await auth();
  const examId = await resolveExamId(params);
  if (!examId) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }
  if (!(await canManageExam(session, examId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }
  const files = await query<{ url: string }>(
    `SELECT url FROM exam_files WHERE exam_id = $1
     UNION ALL SELECT unnest(scan_image_urls) FROM submissions WHERE exam_id = $1`,
    [examId]
  );
  await query('DELETE FROM exams WHERE id = $1', [examId]);
  await Promise.all(files.map((f) => removeStoredFile(f.url)));
  return NextResponse.json({ success: true, data: null });
}
