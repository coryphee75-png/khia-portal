import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/db';
import { ApiResponse } from '@/types';
import bcrypt from 'bcryptjs';

/**
 * POST /api/signup
 * 학부모 회원가입 신청 (로그인 불필요, 누구나 호출 가능)
 * body: { name, loginId, password, code }
 *
 * - 이메일이 아니라 아이디(loginId)로 가입합니다. users.email 컬럼을 로그인 아이디로 그대로 재사용합니다
 *   (이메일 형식 검증을 하지 않을 뿐, 컬럼/로그인 로직은 기존과 동일합니다).
 * - code(자녀 학번/코드)로 children 테이블에서 아직 학부모가 연결되지 않은 학생을 찾아 연결합니다.
 * - 계정은 status='pending'으로 생성되어, 관리자가 /admin/users 에서 승인하기 전까지는 로그인할 수 없습니다.
 * - 승인 후에는 로그인해서 형제/자매의 코드를 추가로 입력해 자녀를 더 연결할 수 있습니다 (/link-child).
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<{ childName: string }>>> {
  const client = await getClient();
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const loginId = String(body.loginId || '').trim().toLowerCase();
    const password = String(body.password || '');
    const code = String(body.code || '').trim().toUpperCase();

    if (!name || !loginId || !password || !code) {
      return NextResponse.json(
        { success: false, error: '이름, 아이디, 비밀번호, 자녀 학번/코드를 모두 입력해주세요.' },
        { status: 400 }
      );
    }
    if (password.length < 4) {
      return NextResponse.json(
        { success: false, error: '비밀번호는 4자 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    const childResult = await client.query<{ id: number; name: string; parent_id: number | null }>(
      'SELECT id, name, parent_id FROM children WHERE registration_code = $1',
      [code]
    );
    const child = childResult.rows[0];
    if (!child) {
      throw new Error('입력하신 학번/코드를 찾을 수 없습니다. 코드를 다시 확인해주세요.');
    }
    if (child.parent_id !== null) {
      throw new Error('이미 학부모 계정이 연결된 학번/코드입니다. 관리자에게 문의해주세요.');
    }

    const existingId = await client.query('SELECT id FROM users WHERE email = $1', [loginId]);
    if (existingId.rows.length > 0) {
      throw new Error('이미 사용 중인 아이디입니다.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await client.query<{ id: number }>(
      `INSERT INTO users (email, password_hash, name, role, status)
       VALUES ($1, $2, $3, 'parent', 'pending') RETURNING id`,
      [loginId, passwordHash, name]
    );
    const newUserId = userResult.rows[0].id;

    await client.query('UPDATE children SET parent_id = $1 WHERE id = $2', [newUserId, child.id]);

    await client.query('COMMIT');

    return NextResponse.json({ success: true, data: { childName: child.name } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Signup error:', error);
    const message = error instanceof Error ? error.message : '가입 신청에 실패했습니다.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  } finally {
    client.release();
  }
}
