import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { queryOne, getClient } from '@/lib/db';
import { ApiResponse } from '@/types';
import bcrypt from 'bcryptjs';
import { BRANCHES, Branch } from '../../users/route';

export interface AdminChildInfo {
  id: string;
  name: string;
  grade: number;
  classNumber: string;
  parentId: string | null;
  parentName: string | null;
  registrationCode: string;
  classId: string | null;
  className: string | null;
  studentUserId: string | null;
  studentEmail: string | null;
  studentName: string | null;
  branch: Branch;
}

interface AdminChildRow {
  id: number;
  name: string;
  grade: number;
  class_number: string;
  parent_id: number | null;
  parent_name: string | null;
  registration_code: string;
  class_id: number | null;
  class_name: string | null;
  student_user_id: number | null;
  student_email: string | null;
  student_name: string | null;
  branch: Branch;
}

function mapAdminChild(row: AdminChildRow): AdminChildInfo {
  return {
    id: String(row.id),
    name: row.name,
    grade: row.grade,
    classNumber: row.class_number,
    parentId: row.parent_id !== null ? String(row.parent_id) : null,
    parentName: row.parent_name,
    registrationCode: row.registration_code,
    classId: row.class_id !== null ? String(row.class_id) : null,
    className: row.class_name,
    studentUserId: row.student_user_id !== null ? String(row.student_user_id) : null,
    studentEmail: row.student_email,
    studentName: row.student_name,
    branch: row.branch,
  };
}

const CHILD_SELECT = `
  SELECT ch.id, ch.name, ch.grade, ch.class_number, ch.parent_id, up.name AS parent_name,
         ch.registration_code, ch.class_id, cl.name AS class_name, ch.student_user_id, us.email AS student_email,
         us.name AS student_name, ch.branch
  FROM children ch
  LEFT JOIN users up ON ch.parent_id = up.id
  LEFT JOIN classes cl ON ch.class_id = cl.id
  LEFT JOIN users us ON ch.student_user_id = us.id
`;

/**
 * PATCH /api/admin/children/[id]
 * 학생 정보 수정 - 관리자 전용
 * 이름/학년/반 번호를 고치거나, 반을 이동하거나(classId), 연결된 학부모를 바꿀 수 있음(parentId).
 * 숙제/수업일지/평가/앨범/댓글은 전부 이 학생의 id(child_id)를 기준으로 저장되어 있어서,
 * 반이나 학부모가 바뀌어도 기존 기록은 삭제/재생성 없이 그대로 유지됩니다 - children 행만 갱신합니다.
 * studentEmail을 함께 보내면 로그인 계정도 같이 처리합니다: 아직 로그인 계정이 없는 학생이면 새로 만들고
 * (이때 studentPassword 4자 이상 필수), 이미 있으면 아이디/비밀번호를 갱신합니다(studentPassword를 비워두면
 * 기존 비밀번호 유지). studentEmail을 아예 보내지 않으면 로그인 계정은 건드리지 않습니다.
 * body: { name, grade, classNumber, parentId?: string|null, classId?: string|null,
 *         studentEmail?: string, studentPassword?: string }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<AdminChildInfo>>> {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const { id } = await params;
  const childId = Number(id);
  if (!Number.isFinite(childId)) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const existing = await queryOne<{ id: number; student_user_id: number | null }>(
    'SELECT id, student_user_id FROM children WHERE id = $1',
    [childId]
  );
  if (!existing) {
    return NextResponse.json({ success: false, error: '학생을 찾을 수 없습니다.' }, { status: 404 });
  }

  const body = await req.json();
  const name = String(body.name || '').trim();
  const grade = Number(body.grade);
  const classNumber = String(body.classNumber || '').trim();
  const parentId = body.parentId ? Number(body.parentId) : null;
  const classId = body.classId ? Number(body.classId) : null;
  const branch = (body.branch || 'Sejong') as Branch;
  const studentEmail = body.studentEmail !== undefined ? String(body.studentEmail).trim().toLowerCase() : '';
  const studentPassword = body.studentPassword !== undefined ? String(body.studentPassword) : '';

  if (!name || !Number.isFinite(grade) || !classNumber) {
    return NextResponse.json(
      { success: false, error: '이름, 학년, 반 번호를 입력해주세요.' },
      { status: 400 }
    );
  }

  if (!BRANCHES.includes(branch)) {
    return NextResponse.json({ success: false, error: '유효하지 않은 지점입니다.' }, { status: 400 });
  }

  if (parentId !== null) {
    const parent = await queryOne<{ id: number }>(
      "SELECT id FROM users WHERE id = $1 AND role = 'parent'",
      [parentId]
    );
    if (!parent) {
      return NextResponse.json({ success: false, error: '유효하지 않은 학부모입니다.' }, { status: 400 });
    }
  }

  if (classId !== null) {
    const cls = await queryOne<{ id: number }>('SELECT id FROM classes WHERE id = $1', [classId]);
    if (!cls) {
      return NextResponse.json({ success: false, error: '유효하지 않은 반입니다.' }, { status: 400 });
    }
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    let studentUserId = existing.student_user_id;

    if (studentEmail) {
      const dup = await client.query<{ id: number }>(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [studentEmail, studentUserId || 0]
      );
      if (dup.rows.length > 0) {
        throw new Error('이미 사용 중인 로그인 아이디입니다.');
      }

      if (studentUserId) {
        // 이미 로그인 계정이 있는 학생 - 아이디는 항상 갱신, 비밀번호는 입력했을 때만 갱신
        if (studentPassword) {
          if (studentPassword.length < 4) {
            throw new Error('비밀번호는 4자 이상이어야 합니다.');
          }
          const passwordHash = await bcrypt.hash(studentPassword, 10);
          await client.query('UPDATE users SET email = $1, password_hash = $2, updated_at = NOW() WHERE id = $3', [
            studentEmail,
            passwordHash,
            studentUserId,
          ]);
        } else {
          await client.query('UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2', [
            studentEmail,
            studentUserId,
          ]);
        }
      } else {
        // 로그인 계정이 없던 학생에게 새로 발급 - 새 계정이므로 비밀번호 필수
        if (!studentPassword || studentPassword.length < 4) {
          throw new Error('새 로그인 계정을 만들려면 비밀번호를 4자 이상 입력해주세요.');
        }
        const passwordHash = await bcrypt.hash(studentPassword, 10);
        const userResult = await client.query<{ id: number }>(
          `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, 'student') RETURNING id`,
          [studentEmail, passwordHash, name]
        );
        studentUserId = userResult.rows[0].id;
      }
    }

    await client.query(
      `UPDATE children SET name = $1, grade = $2, class_number = $3, parent_id = $4, class_id = $5, student_user_id = $6, branch = $7 WHERE id = $8`,
      [name, grade, classNumber, parentId, classId, studentUserId, branch, childId]
    );

    await client.query('COMMIT');

    const row = await queryOne<AdminChildRow>(`${CHILD_SELECT} WHERE ch.id = $1`, [childId]);
    return NextResponse.json({ success: true, data: mapAdminChild(row!) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Admin update child error:', error);
    const message = error instanceof Error ? error.message : '학생 정보를 수정할 수 없습니다.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  } finally {
    client.release();
  }
}

/**
 * DELETE /api/admin/children/[id]
 * 학생(자녀) 삭제 - 관리자 전용
 * 학생을 완전히 삭제합니다. 이 학생의 숙제/수업일지/평가/앨범/댓글 기록도 함께 삭제되며(children 삭제 시
 * 자동 연쇄 삭제, db/schema.sql의 ON DELETE CASCADE), 학생 본인 로그인 계정이 있었다면 그 계정도 함께
 * 삭제합니다. 되돌릴 수 없는 작업이므로 프론트엔드에서 확인 절차를 거친 뒤 호출해야 합니다.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const { id } = await params;
  const childId = Number(id);
  if (!Number.isFinite(childId)) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const existing = await queryOne<{ id: number; student_user_id: number | null }>(
    'SELECT id, student_user_id FROM children WHERE id = $1',
    [childId]
  );
  if (!existing) {
    return NextResponse.json({ success: false, error: '학생을 찾을 수 없습니다.' }, { status: 404 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM children WHERE id = $1', [childId]);
    if (existing.student_user_id) {
      await client.query('DELETE FROM users WHERE id = $1', [existing.student_user_id]);
    }
    await client.query('COMMIT');
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Admin delete child error:', error);
    return NextResponse.json({ success: false, error: '학생을 삭제할 수 없습니다.' }, { status: 500 });
  } finally {
    client.release();
  }
}
