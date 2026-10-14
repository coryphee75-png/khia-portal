import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { ApiResponse } from '@/types';
import { canManageExam, getSubmissionExamId } from '@/lib/gradingQueries';
import { generateAreaComment, GradingError } from '@/lib/aiGrader';

export const maxDuration = 60;

/**
 * POST /api/grading/submissions/[id]/comment
 * 선생님 채점 영역(Speaking 등)의 영어 코멘트를 AI로 생성 (저장은 하지 않고 문구만 돌려줌)
 * body: { areaId, scores: { [questionId]: number | null }, notes? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ comment: string }>>> {
  const session = await auth();
  const { id } = await params;
  const submissionId = Number(id);
  const examId = Number.isFinite(submissionId) ? await getSubmissionExamId(submissionId) : null;
  if (!examId) return NextResponse.json({ success: false, error: '답안지를 찾을 수 없습니다.' }, { status: 404 });
  if (!(await canManageExam(session, examId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const areaId = Number(body.areaId);
    const scores: Record<string, number | null> = body.scores || {};
    const area = await queryOne<{ name: string }>('SELECT name FROM exam_areas WHERE id = $1 AND exam_id = $2', [areaId, examId]);
    if (!area) return NextResponse.json({ success: false, error: '영역을 찾을 수 없습니다.' }, { status: 400 });

    const sub = await queryOne<{ student_name: string }>('SELECT student_name FROM submissions WHERE id = $1', [submissionId]);
    const qs = await query<{ id: number; question_no: number; label: string | null; max_score: string; rubric_text: string | null }>(
      'SELECT id, question_no, label, max_score, rubric_text FROM exam_questions WHERE area_id = $1 ORDER BY question_no',
      [areaId]
    );
    const items = qs.map((q) => {
      const raw = scores[String(q.id)];
      const n = raw === null || raw === undefined || (raw as unknown) === '' ? null : Number(raw);
      return {
        label: q.label || `Q${q.question_no}`,
        score: n !== null && Number.isFinite(n) ? n : null,
        maxScore: Number(q.max_score),
        rubric: (q.rubric_text || '').slice(0, 400),
      };
    });
    if (items.every((i) => i.score === null)) {
      return NextResponse.json({ success: false, error: '먼저 점수를 입력해주세요.' }, { status: 400 });
    }

    const comment = await generateAreaComment({
      studentName: sub?.student_name || 'The student',
      areaName: area.name,
      items,
      notes: String(body.notes || '').slice(0, 1000),
    });
    return NextResponse.json({ success: true, data: { comment } });
  } catch (error) {
    console.error('Area comment error:', error);
    const message = error instanceof GradingError ? error.message : '코멘트를 만들 수 없습니다.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
