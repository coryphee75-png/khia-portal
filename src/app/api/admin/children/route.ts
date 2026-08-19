import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne, getClient } from '@/lib/db';
import { ApiResponse } from '@/types';
import bcrypt from 'bcryptjs';
import { BRANCHES, Branch } from '../users/route';

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

/** 학번/코드를 겹치지 않게 발급 (숫자+대문자 8자, 헷갈리기 쉬운 0/O, 1/I는 제외) */
function generateRegistrationCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * GET /api/admin/children
 * 전체 학생(자녀) 목록 - 관리자 전용
 */
export async function GET(): Promise<NextResponse<ApiResponse<AdminChildInfo[]>>> {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const rows = await query<AdminChildRow>(`${CHILD_SELECT} ORDER BY ch.id`);
  return NextResponse.json({ success: true, data: rows.map(mapAdminChild) });
}

/**
 * POST /api/admin/children
 * 학생(자녀) 등록 - 관리자 전용
 * body: {
 *   name, grade, classNumber, parentId?, classId?,
 *   studentAccount?: { email, password }  // 학생 로그인 계정도 함께 생성 (선택)
 * }
 * parentId를 생략하면 학부모 미지정 상태로 등록되고, 발급된 registrationCode를 학부모에게 전달해서
 * /signup 화면에서 스스로 가입 신청(관리자 승인 필요)하도록 안내하면 됩니다.
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<AdminChildInfo>>> {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const body = await req.json();
  const name = String(body.name || '').trim();
  const grade = Number(body.grade);
  const classNumber = String(body.classNumber || '').trim();
  const parentId = body.parentId ? Number(body.parentId) : null;
  const classId = body.classId ? Number(body.classId) : null;
  const branch = (body.branch || 'Sejong') as Branch;
  const studentAccount = body.studentAccount as { email?: string; password?: string } | undefined;

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

  const client = await getClient();
  try {
    await client.query('BEGIN');

    let studentUserId: number | null = null;
    if (studentAccount?.email && studentAccount?.password) {
      const email = studentAccount.email.trim().toLowerCase();
      if (studentAccount.password.length < 4) {
        throw new Error('학생 계정 비밀번호는 4자 이상이어야 합니다.');
      }
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        throw new Error('이미 사용 중인 학생 계정 아이디입니다.');
      }
      const passwordHash = await bcrypt.hash(studentAccount.password, 10);
      const userResult = await client.query<{ id: number }>(
        `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, 'student') RETURNING id`,
        [email, passwordHash, name]
      );
      studentUserId = userResult.rows[0].id;
    }

    // 학번/코드 발급 - 아주 낮은 확률의 중복은 재시도로 처리
    let registrationCode = generateRegistrationCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const existingCode = await client.query('SELECT id FROM children WHERE registration_code = $1', [
        registrationCode,
      ]);
      if (existingCode.rows.length === 0) break;
      registrationCode = generateRegistrationCode();
    }

    const childResult = await client.query<{ id: number }>(
      `INSERT INTO children (name, grade, class_number, parent_id, registration_code, class_id, student_user_id, branch)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [name, grade, classNumber, parentId, registrationCode, classId, studentUserId, branch]
    );

    await client.query('COMMIT');

    const row = await queryOne<AdminChildRow>(`${CHILD_SELECT} WHERE ch.id = $1`, [childResult.rows[0].id]);
    return NextResponse.json({ success: true, data: mapAdminChild(row!) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Admin create child error:', error);
    const message = error instanceof Error ? error.message : '학생을 등록할 수 없습니다.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  } finally {
    client.release();
  }
}
