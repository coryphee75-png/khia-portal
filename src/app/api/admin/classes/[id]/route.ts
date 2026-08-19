import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { ApiResponse } from '@/types';
import { BRANCHES, Branch } from '../route';

interface AdminClassRow {
  id: number;
  name: string;
  grade: number;
  branch: Branch;
  teacher_id: number | null;
  teacher_name: string | null;
  student_count: string;
}

interface AdminClassInfo {
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
 * PUT /api/admin/classes/[id]
 * 반 정보 수정 (이름/학년/담당 선생님 배정) - 관리자 전용
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<AdminClassInfo>>> {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const { id } = await params;
  const classId = Number(id);
  if (!Number.isFinite(classId)) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
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

    await query(
      'UPDATE classes SET name = $1, grade = $2, branch = $3, teacher_id = $4 WHERE id = $5',
      [name, grade, branch, teacherId, classId]
    );

    const row = await queryOne<AdminClassRow>(
      `SELECT cl.id, cl.name, cl.grade, cl.branch, cl.teacher_id, u.name AS teacher_name,
              COUNT(ch.id) AS student_count
       FROM classes cl
       LEFT JOIN users u ON cl.teacher_id = u.id
       LEFT JOIN children ch ON ch.class_id = cl.id
       WHERE cl.id = $1
       GROUP BY cl.id, u.name`,
      [classId]
    );

    if (!row) {
      return NextResponse.json({ success: false, error: '반을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: mapAdminClass(row) });
  } catch (error) {
    console.error('Admin update class error:', error);
    return NextResponse.json({ success: false, error: '반을 수정할 수 없습니다.' }, { status: 500 });
  }
}
