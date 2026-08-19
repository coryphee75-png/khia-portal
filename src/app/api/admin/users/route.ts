import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { ApiResponse } from '@/types';
import bcrypt from 'bcryptjs';

export type Branch = 'Sejong' | 'Gwangyo';
export const BRANCHES: Branch[] = ['Sejong', 'Gwangyo'];

export interface AdminUserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: Branch | null;
}

const CREATABLE_ROLES = ['teacher', 'parent', 'student'];

/**
 * GET /api/admin/users?role=teacher|parent|student
 * 역할별 사용자 계정 목록 조회 - 관리자 전용 (role 생략 시 전체)
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<AdminUserInfo[]>>> {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const role = req.nextUrl.searchParams.get('role');
  const rows =
    role && CREATABLE_ROLES.includes(role)
      ? await query<{ id: number; name: string; email: string; role: string; branch: Branch | null }>(
          'SELECT id, name, email, role, branch FROM users WHERE role = $1 ORDER BY name',
          [role]
        )
      : await query<{ id: number; name: string; email: string; role: string; branch: Branch | null }>(
          "SELECT id, name, email, role, branch FROM users WHERE role != 'admin' ORDER BY role, name"
        );

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({ id: String(r.id), name: r.name, email: r.email, role: r.role, branch: r.branch })),
  });
}

/**
 * POST /api/admin/users
 * 선생님/학부모/학생 계정 생성 - 관리자 전용
 * body: { name, email, password, role: 'teacher' | 'parent' | 'student' }
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<AdminUserInfo>>> {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = String(body.role || '');

    if (!name || !email || !password || !CREATABLE_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, error: '이름, 아이디, 비밀번호, 역할을 올바르게 입력해주세요.' },
        { status: 400 }
      );
    }
    if (password.length < 4) {
      return NextResponse.json(
        { success: false, error: '비밀번호는 4자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 지점(branch)은 선생님 계정에만 의미가 있음 - 선생님은 필수로 지정, 그 외 역할은 항상 NULL
    let branch: Branch | null = null;
    if (role === 'teacher') {
      branch = (body.branch || 'Sejong') as Branch;
      if (!BRANCHES.includes(branch)) {
        return NextResponse.json({ success: false, error: '유효하지 않은 지점입니다.' }, { status: 400 });
      }
    }

    const existing = await queryOne<{ id: number }>('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 아이디입니다.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const row = await queryOne<{ id: number; name: string; email: string; role: string; branch: Branch | null }>(
      `INSERT INTO users (email, password_hash, name, role, branch) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, branch`,
      [email, passwordHash, name, role, branch]
    );

    return NextResponse.json({
      success: true,
      data: { id: String(row!.id), name: row!.name, email: row!.email, role: row!.role, branch: row!.branch },
    });
  } catch (error) {
    console.error('Admin create user error:', error);
    return NextResponse.json({ success: false, error: '계정을 생성할 수 없습니다.' }, { status: 500 });
  }
}
