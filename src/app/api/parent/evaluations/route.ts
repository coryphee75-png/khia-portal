import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiResponse, Evaluation } from '@/types';

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

    // TODO: 실제 데이터베이스에서 평가 조회
    // const evaluations = await query<Evaluation>(
    //   'SELECT * FROM evaluations WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1) ORDER BY date DESC',
    //   [session.user.id]
    // );

    const evaluations: Evaluation[] = [
      {
        id: '1',
        childId: '1',
        date: new Date('2024-12-15'),
        subject: '수학',
        score: 95,
        grade: 'A+',
        comments: '매우 우수한 성적입니다. 특히 문제 풀이가 정확합니다.',
        createdAt: new Date(),
      },
      {
        id: '2',
        childId: '1',
        date: new Date('2024-12-10'),
        subject: '영어',
        score: 87,
        grade: 'A',
        comments: '좋은 성적입니다. 발음 향상이 필요합니다.',
        createdAt: new Date(),
      },
      {
        id: '3',
        childId: '1',
        date: new Date('2024-12-05'),
        subject: '과학',
        score: 92,
        grade: 'A+',
        comments: '실험 보고서가 우수합니다.',
        createdAt: new Date(),
      },
      {
        id: '4',
        childId: '1',
        date: new Date('2024-11-30'),
        subject: '국어',
        score: 85,
        grade: 'A',
        comments: '읽기 능력이 향상되었습니다.',
        createdAt: new Date(),
      },
      {
        id: '5',
        childId: '2',
        date: new Date('2024-12-12'),
        subject: '수학',
        score: 78,
        grade: 'B+',
        comments: '기초가 안정적입니다.',
        createdAt: new Date(),
      },
    ];

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
