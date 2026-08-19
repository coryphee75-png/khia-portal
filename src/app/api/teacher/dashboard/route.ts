import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { ApiResponse, TeacherDashboardData } from '@/types';
import { ClassRow, NoteRow, mapClassInfo, mapNote } from '@/lib/mappers';

/**
 * GET /api/teacher/dashboard
 * 선생님 대시보드 데이터 조회
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<TeacherDashboardData>>> {
  try {
    const session = await auth();

    if (!session || session.user.role !== 'teacher') {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      );
    }

    const teacherId = Number(session.user.id);

    const [classRows, totalsRow, pendingRow, noteRows] = await Promise.all([
      query<ClassRow>(
        `SELECT cl.id, cl.name, cl.grade, COUNT(ch.id) AS student_count
         FROM classes cl
         LEFT JOIN children ch ON ch.class_id = cl.id
         WHERE cl.teacher_id = $1
         GROUP BY cl.id
         ORDER BY cl.id`,
        [teacherId]
      ),
      query<{ total: string }>(
        `SELECT COUNT(ch.id) AS total FROM children ch
         JOIN classes cl ON ch.class_id = cl.id
         WHERE cl.teacher_id = $1`,
        [teacherId]
      ),
      query<{ pending: string }>(
        `SELECT COUNT(h.id) AS pending FROM homeworks h
         JOIN children ch ON h.child_id = ch.id
         JOIN classes cl ON ch.class_id = cl.id
         WHERE cl.teacher_id = $1 AND h.status = 'pending'`,
        [teacherId]
      ),
      query<NoteRow>(
        `SELECT n.* FROM notes n
         JOIN children ch ON n.child_id = ch.id
         JOIN classes cl ON ch.class_id = cl.id
         WHERE cl.teacher_id = $1
         ORDER BY n.date DESC LIMIT 5`,
        [teacherId]
      ),
    ]);

    const dashboardData: TeacherDashboardData = {
      classes: classRows.map(mapClassInfo),
      totalStudents: Number(totalsRow[0]?.total || 0),
      pendingHomeworksToGrade: Number(pendingRow[0]?.pending || 0),
      recentNotes: noteRows.map(mapNote),
    };

    return NextResponse.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error('Teacher dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: '대시보드 데이터를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
