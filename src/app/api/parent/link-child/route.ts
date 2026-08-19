import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getClient } from '@/lib/db';
import { ApiResponse } from '@/types';

/**
 * POST /api/parent/link-child
 * 로그인한(승인된) 학부모가 형제/자매 등 추가 자녀를 학번/코드로 연결 - 학부모 전용
 * body: { code }
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<{ childName: string }>>> {
  const session = await auth();
  if (!session || session.user.role !== 'parent') {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const client = await getClient();
  try {
    const body = await req.json();
    const code = String(body.code || '').trim().toUpperCase();

    if (!code) {
      return NextResponse.json({ success: false, error: '학번/코드를 입력해주세요.' }, { status: 400 });
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
      throw new Error('이미 다른 학부모 계정에 연결된 학번/코드입니다.');
    }

    await client.query('UPDATE children SET parent_id = $1 WHERE id = $2', [
      Number(session.user.id),
      child.id,
    ]);

    await client.query('COMMIT');
    return NextResponse.json({ success: true, data: { childName: child.name } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Link child error:', error);
    const message = error instanceof Error ? error.message : '자녀 연결에 실패했습니다.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  } finally {
    client.release();
  }
}
