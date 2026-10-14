import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { ApiResponse, Homework } from '@/types';
import { HomeworkRow, mapHomework } from '@/lib/mappers';

/**
 * GET /api/parent/homeworks
 * 학부모의 자녀 숙제 목록 조회
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<Homework[]>>> {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const homeworkRows = await query<HomeworkRow>(
      `SELECT h.* FROM homeworks h
       WHERE h.child_id IN (SELECT id FROM children WHERE parent_id = $1)
       ORDER BY h.due_date DESC`,
      [Number(session.user.id)]
    );
    const homeworks: Homework[] = homeworkRows.map(mapHomework);

    return NextResponse.json({
      success: true,
      data: homeworks,
    });
  } catch (error) {
    console.error('Homeworks API error:', error);
    return NextResponse.json(
      { success: false, error: '숙제를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
