import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { ApiResponse, } from '@/types';
import { SubmissionSummary } from '@/lib/grading';
import { canManageExam, getSubmissionExamId, mapSubmission, SubmissionRow } from '@/lib/gradingQueries';
import { gradeSubmission, GradingError } from '@/lib/aiGrader';

// 답안지 여러 장을 읽고 채점하는 데 1~2분 걸릴 수 있음 (Vercel 함수 최대 실행 시간)
export const maxDuration = 300;

/**
 * POST /api/grading/submissions/[id]/grade
 * 답안지 AI 1차 채점 실행 (다시 누르면 재채점, 선생님이 고친 점수는 유지)
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<SubmissionSummary>>> {
  const session = await auth();
  const { id } = await params;
  const submissionId = Number(id);
  const examId = Number.isFinite(submissionId) ? await getSubmissionExamId(submissionId) : null;
  if (!examId) {
    return NextResponse.json({ success: false, error: '답안지를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!(await canManageExam(session, examId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    await gradeSubmission(submissionId);
    const row = await queryOne<SubmissionRow>('SELECT * FROM submissions WHERE id = $1', [submissionId]);
    return NextResponse.json({ success: true, data: mapSubmission(row!) });
  } catch (error) {
    console.error('AI grading error:', error);
    let message: string;
    if (error instanceof GradingError) {
      message = error.message;
    } else {
      const detail = error instanceof Error ? error.message : String(error);
      message = /column .* does not exist|열.*없습니다|relation .* does not exist/i.test(detail)
        ? `DB에 필요한 칸이 없습니다. db/migration_grading.sql을 다시 실행해주세요. (${detail})`
        : `AI 채점 중 오류가 발생했습니다: ${detail}`;
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
