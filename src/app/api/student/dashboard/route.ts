import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { ApiResponse, StudentDashboardData } from '@/types';
import {
  ChildRow,
  HomeworkRow,
  NoteRow,
  EvaluationRow,
  mapHomework,
  mapNote,
  mapEvaluation,
} from '@/lib/mappers';

/**
 * GET /api/student/dashboard
 * 학생 대시보드 데이터 조회
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<StudentDashboardData>>> {
  try {
    const session = await auth();

    if (!session || session.user.role !== 'student') {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const studentUserId = Number(session.user.id);

    // 이 학생 계정과 연결된 학생 본인 레코드 조회
    const child = await queryOne<ChildRow>(
      'SELECT * FROM children WHERE student_user_id = $1',
      [studentUserId]
    );

    if (!child) {
      const emptyData: StudentDashboardData = {
        homeworks: [],
        recentNotes: [],
        recentEvaluations: [],
        statistics: { totalHomeworks: 0, completedHomeworks: 0, averageGrade: 0 },
      };
      return NextResponse.json({ success: true, data: emptyData });
    }

    const [homeworkRows, noteRows, evaluationRows, statsRow] = await Promise.all([
      query<HomeworkRow>(
        'SELECT * FROM homeworks WHERE child_id = $1 ORDER BY due_date DESC LIMIT 5',
        [child.id]
      ),
      query<NoteRow>(
        'SELECT * FROM notes WHERE child_id = $1 ORDER BY date DESC LIMIT 5',
        [child.id]
      ),
      query<EvaluationRow>(
        'SELECT * FROM evaluations WHERE child_id = $1 ORDER BY date DESC LIMIT 5',
        [child.id]
      ),
      queryOne<{
        total_homeworks: string;
        completed_homeworks: string;
        average_grade: string | null;
      }>(
        `SELECT
           COUNT(h.id) AS total_homeworks,
           COUNT(h.id) FILTER (WHERE h.status = 'completed') AS completed_homeworks,
           (SELECT AVG(score) FROM evaluations WHERE child_id = $1) AS average_grade
         FROM homeworks h WHERE h.child_id = $1`,
        [child.id]
      ),
    ]);

    const dashboardData: StudentDashboardData = {
      homeworks: homeworkRows.map(mapHomework),
      recentNotes: noteRows.map(mapNote),
      recentEvaluations: evaluationRows.map(mapEvaluation),
      statistics: {
        totalHomeworks: Number(statsRow?.total_homeworks || 0),
        completedHomeworks: Number(statsRow?.completed_homeworks || 0),
        averageGrade: statsRow?.average_grade
          ? Math.round(Number(statsRow.average_grade) * 10) / 10
          : 0,
      },
    };

    return NextResponse.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error('Student dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: '대시보드 데이터를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
