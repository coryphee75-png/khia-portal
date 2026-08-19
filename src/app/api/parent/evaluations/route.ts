import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { ApiResponse, Evaluation } from '@/types';
import { EvaluationRow, mapEvaluation } from '@/lib/mappers';

/**
 * GET /api/parent/evaluations
 * 학부모의 자녀 평가 조회
 */
export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<Evaluation[]>>> {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const evaluationRows = await query<EvaluationRow>(
      `SELECT e.* FROM evaluations e
       WHERE e.child_id IN (SELECT id FROM children WHERE parent_id = $1)
       ORDER BY e.date DESC`,
      [Number(session.user.id)]
    );
    const evaluations: Evaluation[] = evaluationRows.map(mapEvaluation);

    return NextResponse.json({
      success: true,
      data: evaluations,
    });
  } catch (error) {
    console.error('Evaluations API error:', error);
    return NextResponse.json(
      { success: false, error: '평가를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
