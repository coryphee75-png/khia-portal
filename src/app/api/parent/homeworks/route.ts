import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiResponse, Homework } from '@/types';

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

    // TODO: 실제 데이터베이스에서 숙제 조회
    // const homeworks = await query<Homework>(
    //   'SELECT * FROM homeworks WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1) ORDER BY due_date DESC',
    //   [session.user.id]
    // );

    const homeworks: Homework[] = [
      {
        id: '1',
        childId: '1',
        title: '수학 문제풀이 20문제',
        description: 'Chapter 5의 문제를 풀어주세요.',
        subject: '수학',
        dueDate: new Date('2024-12-20'),
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        childId: '1',
        title: '영어 단어 암기',
        description: '제공된 단어장의 단어들을 외워주세요.',
        subject: '영어',
        dueDate: new Date('2024-12-19'),
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '3',
        childId: '2',
        title: '한글 쓰기 연습',
        description: '가로 줄 10줄을 써주세요.',
        subject: '국어',
        dueDate: new Date('2024-12-18'),
        status: 'overdue',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

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
