import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { canManageChild } from '@/lib/permissions';
import { ApiResponse, Evaluation } from '@/types';
import { EvaluationRow, mapEvaluation } from '@/lib/mappers';

async function getOwningChildId(evaluationId: number): Promise<number | null> {
  const row = await queryOne<{ child_id: number }>(
    'SELECT child_id FROM evaluations WHERE id = $1',
    [evaluationId]
  );
  return row?.child_id ?? null;
}

/**
 * PUT /api/content/evaluations/[id]
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<Evaluation>>> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { id } = await params;
  const evaluationId = Number(id);
  if (!Number.isFinite(evaluationId)) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const childId = await getOwningChildId(evaluationId);
  if (childId === null) {
    return NextResponse.json({ success: false, error: '평가를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!(await canManageChild(session, childId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const date = body.date ? new Date(body.date) : null;
    const subject = String(body.subject || '').trim();
    const score = Number(body.score);
    const grade = String(body.grade || '').trim();
    const comments = body.comments ? String(body.comments) : null;

    if (!date || !subject || !Number.isFinite(score) || !grade) {
      return NextResponse.json(
        { success: false, error: '날짜, 과목, 점수, 등급을 입력해주세요.' },
        { status: 400 }
      );
    }

    const row = await queryOne<EvaluationRow>(
      `UPDATE evaluations SET date = $1, subject = $2, score = $3, grade = $4, comments = $5
       WHERE id = $6 RETURNING *`,
      [date, subject, score, grade, comments, evaluationId]
    );

    return NextResponse.json({ success: true, data: mapEvaluation(row!) });
  } catch (error) {
    console.error('Update evaluation error:', error);
    return NextResponse.json({ success: false, error: '평가를 수정할 수 없습니다.' }, { status: 500 });
  }
}

/**
 * DELETE /api/content/evaluations/[id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<null>>> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { id } = await params;
  const evaluationId = Number(id);
  if (!Number.isFinite(evaluationId)) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const childId = await getOwningChildId(evaluationId);
  if (childId === null) {
    return NextResponse.json({ success: false, error: '평가를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!(await canManageChild(session, childId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  await query('DELETE FROM evaluations WHERE id = $1', [evaluationId]);
  return NextResponse.json({ success: true });
}
