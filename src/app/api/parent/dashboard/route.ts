import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { ApiResponse, DashboardData } from '@/types';
import {
  ChildRow,
  HomeworkRow,
  NoteRow,
  EvaluationRow,
  mapChild,
  mapHomework,
  mapNote,
  mapEvaluation,
} from '@/lib/mappers';

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

    const parentId = Number(session.user.id);

    const childRows = await query<ChildRow>(
      'SELECT * FROM children WHERE parent_id = $1 ORDER BY id',
      [parentId]
    );

    const [homeworkRows, noteRows, evaluationRows, statsRows] = await Promise.all([
      query<HomeworkRow>(
        `SELECT h.* FROM homeworks h
         JOIN children c ON h.child_id = c.id
         WHERE c.parent_id = $1
         ORDER BY h.due_date DESC LIMIT 5`,
        [parentId]
      ),
      query<NoteRow>(
        `SELECT n.* FROM notes n
         JOIN children c ON n.child_id = c.id
         WHERE c.parent_id = $1
         ORDER BY n.date DESC LIMIT 5`,
        [parentId]
      ),
      query<EvaluationRow>(
        `SELECT e.* FROM evaluations e
         JOIN children c ON e.child_id = c.id
         WHERE c.parent_id = $1
         ORDER BY e.date DESC LIMIT 5`,
        [parentId]
      ),
      query<{
        total_homeworks: string;
        completed_homeworks: string;
        pending_homeworks: string;
        average_grade: string | null;
      }>(
        `SELECT
           COUNT(h.id) AS total_homeworks,
           COUNT(h.id) FILTER (WHERE h.status = 'completed') AS completed_homeworks,
           COUNT(h.id) FILTER (WHERE h.status = 'pending') AS pending_homeworks,
           (SELECT AVG(e.score) FROM evaluations e
              JOIN children c2 ON e.child_id = c2.id WHERE c2.parent_id = $1) AS average_grade
         FROM homeworks h
         JOIN children c ON h.child_id = c.id
         WHERE c.parent_id = $1`,
        [parentId]
      ),
    ]);

    const stats = statsRows[0];

    const dashboardData: DashboardData = {
      children: childRows.map(mapChild),
      recentHomeworks: homeworkRows.map(mapHomework),
      recentNotes: noteRows.map(mapNote),
      recentEvaluations: evaluationRows.map(mapEvaluation),
      statistics: {
        totalHomeworks: Number(stats?.total_homeworks || 0),
        completedHomeworks: Number(stats?.completed_homeworks || 0),
        pendingHomeworks: Number(stats?.pending_homeworks || 0),
        averageGrade: stats?.average_grade ? Math.round(Number(stats.average_grade) * 10) / 10 : 0,
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
