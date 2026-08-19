import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { ApiResponse } from '@/types';

export type Branch = 'Sejong' | 'Gwangyo';
export const BRANCHES: Branch[] = ['Sejong', 'Gwangyo'];

interface AdminClassRow {
  id: number;
  name: string;
  grade: number;
  branch: Branch;
  teacher_id: number | null;
  teacher_name: string | null;
  student_count: string;
}

export interface AdminClassInfo {
  id: string;
  name: string;
  grade: number;
  branch: Branch;
  teacherId: string | null;
  teacherName: string | null;
  studentCount: number;
}

function mapAdminClass(row: AdminClassRow): AdminClassInfo {
  return {
    id: String(row.id),
    name: row.name,
    grade: row.grade,
    branch: row.branch,
    teacherId: row.teacher_id !== null ? String(row.teacher_id) : null,
    teacherName: row.teacher_name,
    studentCount: Number(row.student_count),
  };
}

/**
 * GET /api/admin/classes
 * 전체 반 목록 조회 (담당 선생님/학생 수 포함) - 관리자 전용
 */
export async function GET(): Promise<NextResponse<ApiResponse<AdminClassInfo[]>>> {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const rows = await query<AdminClassRow>(
    `SELECT cl.id, cl.name, cl.grade, cl.branch, cl.teacher_id, u.name AS teacher_name,
            COUNT(ch.id) AS student_count
     FROM classes cl
     LEFT JOIN users u ON cl.teacher_id = u.id
     LEFT JOIN children ch ON ch.class_id = cl.id
     GROUP BY cl.id, u.name
     ORDER BY cl.branch, cl.id`
  );

  return NextResponse.json({ success: true, data: rows.map(mapAdminClass) });
}

/**
 * POST /api/admin/classes
 * 새 반 생성 - 관리자 전용
 * body: { name: string, grade: number, teacherId?: string | null }
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<AdminClassInfo>>> {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const grade = Number(body.grade);
    const branch = (body.branch || 'Sejong') as Branch;
    const teacherId = body.teacherId ? Number(body.teacherId) : null;

    if (!name || !Number.isFinite(grade)) {
      return NextResponse.json(
        { success: false, error: '반 이름과 학년을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!BRANCHES.includes(branch)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 지점입니다.' },
        { status: 400 }
      );
    }

    if (teacherId !== null) {
      const teacher = await queryOne<{ id: number }>(
        "SELECT id FROM users WHERE id = $1 AND role = 'teacher'",
        [teacherId]
      );
      if (!teacher) {
        return NextResponse.json(
          { success: false, error: '유효하지 않은 선생님입니다.' },
          { status: 400 }
        );
      }
    }

    const inserted = await queryOne<{ id: number }>(
      'INSERT INTO classes (name, grade, branch, teacher_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, grade, branch, teacherId]
    );

    const row = await queryOne<AdminClassRow>(
      `SELECT cl.id, cl.name, cl.grade, cl.branch, cl.teacher_id, u.name AS teacher_name,
              COUNT(ch.id) AS student_count
       FROM classes cl
       LEFT JOIN users u ON cl.teacher_id = u.id
       LEFT JOIN children ch ON ch.class_id = cl.id
       WHERE cl.id = $1
       GROUP BY cl.id, u.name`,
      [inserted!.id]
    );

    return NextResponse.json({ success: true, data: mapAdminClass(row!) });
  } catch (error) {
    console.error('Admin create class error:', error);
    return NextResponse.json({ success: false, error: '반을 생성할 수 없습니다.' }, { status: 500 });
  }
}
