import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { ApiResponse } from '@/types';
import { Branch, StudentOption } from '@/lib/grading';
import { canManageExam } from '@/lib/gradingQueries';

/**
 * GET /api/grading/exams/[id]/students
 * 답안지 업로드 때 고를 수 있는 학생 목록
 * - 정기시험: 그 반 학생
 * - 배치고사: 같은 지점의 등록 학생 전체 (등록 전 신입생은 이름 직접 입력)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<StudentOption[]>>> {
  const session = await auth();
  const { id } = await params;
  const examId = Number(id);
  if (!Number.isFinite(examId) || !(await canManageExam(session, examId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const exam = await queryOne<{ class_id: number | null; branch: Branch }>(
    'SELECT class_id, branch FROM exams WHERE id = $1',
    [examId]
  );
  if (!exam) {
    return NextResponse.json({ success: false, error: '시험을 찾을 수 없습니다.' }, { status: 404 });
  }

  const rows = await query<{ id: number; name: string; grade: number; class_name: string | null }>(
    exam.class_id
      ? `SELECT ch.id, ch.name, ch.grade, cl.name AS class_name FROM children ch
         LEFT JOIN classes cl ON ch.class_id = cl.id WHERE ch.class_id = $1 ORDER BY ch.name`
      : `SELECT ch.id, ch.name, ch.grade, cl.name AS class_name FROM children ch
         LEFT JOIN classes cl ON ch.class_id = cl.id WHERE ch.branch = $1 ORDER BY ch.name`,
    [exam.class_id ?? exam.branch]
  );

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({ id: String(r.id), name: r.name, grade: r.grade, className: r.class_name })),
  });
}
