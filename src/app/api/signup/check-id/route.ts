import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { ApiResponse } from '@/types';

/**
 * GET /api/signup/check-id?id=xxx
 * 회원가입용 아이디 중복확인 (로그인 불필요, 누구나 호출 가능)
 */
export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ available: boolean }>>> {
  const id = (req.nextUrl.searchParams.get('id') || '').trim().toLowerCase();

  if (!id) {
    return NextResponse.json({ success: false, error: '아이디를 입력해주세요.' }, { status: 400 });
  }

  const existing = await queryOne<{ id: number }>('SELECT id FROM users WHERE email = $1', [id]);

  return NextResponse.json({ success: true, data: { available: !existing } });
}
