import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiResponse, DashboardData } from '@/types';

/**
 * GET /api/parent/dashboard
 * 학부모 대시보드 데이터 조회
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<DashboardData>>> {
  try {
    const session = await auth();

    if (!session || session.user.role !== 'parent') {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // TODO: 실제 데이터베이스에서 데이터 조회
    // const children = await query<Child>(
    //   'SELECT * FROM children WHERE parent_id = $1',
    //   [session.user.id]
    // );

    // 임시 데이터
    const dashboardData: DashboardData = {
      children: [
        {
          id: '1',
          name: '김학생',
          grade: 3,
          classNumber: '2',
          parentId: session.user.id,
          createdAt: new Date(),
        },
        {
          id: '2',
          name: '김학생 2',
          grade: 1,
          classNumber: '3',
          parentId: session.user.id,
          createdAt: new Date(),
        },
      ],
      recentHomeworks: [
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
      ],
      recentNotes: [
        {
          id: '1',
          childId: '1',
          date: new Date('2024-12-18'),
          subject: '수학',
          content: '오늘은 분수의 덧셈과 뺄셈을 배웠습니다.',
          teacher: '박선생님',
          createdAt: new Date(),
        },
        {
          id: '2',
          childId: '1',
          date: new Date('2024-12-17'),
          subject: '과학',
          content: '식물의 생장 과정에 대해 학습했습니다.',
          teacher: '이선생님',
          createdAt: new Date(),
        },
      ],
      recentEvaluations: [
        {
          id: '1',
          childId: '1',
          date: new Date('2024-12-15'),
          subject: '수학',
          score: 95,
          grade: 'A+',
          comments: '매우 우수한 성적입니다.',
          createdAt: new Date(),
        },
        {
          id: '2',
          childId: '1',
          date: new Date('2024-12-10'),
          subject: '영어',
          score: 87,
          grade: 'A',
          comments: '좋은 성적입니다.',
          createdAt: new Date(),
        },
      ],
      statistics: {
        totalHomeworks: 15,
        completedHomeworks: 12,
        pendingHomeworks: 3,
        averageGrade: 90.5,
        lastUpdate: new Date(),
      },
    };

    return NextResponse.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: '대시보드 데이터를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
