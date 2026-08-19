import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { canManageChild } from '@/lib/permissions';
import { ApiResponse, Evaluation } from '@/types';
import { EvaluationRow, mapEvaluation } from '@/lib/mappers';

/**
 * POST /api/content/evaluations
 * 평가 생성 - admin 또는 담당 선생님 전용
 * body: { childId, date, subject, score, grade, comments? }
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<Evaluation>>> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const childId = Number(body.childId);
    const date = body.date ? new Date(body.date) : null;
    const subject = String(body.subject || '').trim();
    const score = Number(body.score);
    const grade = String(body.grade || '').trim();
    const comments = body.comments ? String(body.comments) : null;

    if (!Number.isFinite(childId) || !date || !subject || !Number.isFinite(score) || !grade) {
      return NextResponse.json(
        { success: false, error: '학생, 날짜, 과목, 점수, 등급을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!(await canManageChild(session, childId))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const row = await queryOne<EvaluationRow>(
      `INSERT INTO evaluations (child_id, date, subject, score, grade, comments)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [childId, date, subject, score, grade, comments]
    );

    return NextResponse.json({ success: true, data: mapEvaluation(row!) });
  } catch (error) {
    console.error('Create evaluation error:', error);
    return NextResponse.json({ success: false, error: '평가를 생성할 수 없습니다.' }, { status: 500 });
  }
}
