import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getClient } from '@/lib/db';
import { ApiResponse } from '@/types';

/**
 * PATCH /api/admin/signups/[id]
 * 학부모 가입 신청 승인/거절 - 관리자 전용
 * body: { action: 'approve' | 'reject' }
 * - approve: users.status를 'approved'로 변경해서 로그인 가능하게 함
 * - reject: 계정을 삭제하고, 연결되어 있던 자녀의 registration_code는 그대로 유지한 채 parent_id만 다시 비워서
 *   같은 코드로 재가입 신청할 수 있게 함
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const { id } = await params;
  const userId = Number(id);
  const body = await req.json();
  const action = body.action;

  if (!Number.isFinite(userId) || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const pending = await client.query<{ id: number }>(
      "SELECT id FROM users WHERE id = $1 AND role = 'parent' AND status = 'pending'",
      [userId]
    );
    if (pending.rows.length === 0) {
      throw new Error('승인 대기 중인 신청을 찾을 수 없습니다.');
    }

    if (action === 'approve') {
      await client.query("UPDATE users SET status = 'approved' WHERE id = $1", [userId]);
    } else {
      await client.query('UPDATE children SET parent_id = NULL WHERE parent_id = $1', [userId]);
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Signup approval error:', error);
    const message = error instanceof Error ? error.message : '처리에 실패했습니다.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  } finally {
    client.release();
  }
}
