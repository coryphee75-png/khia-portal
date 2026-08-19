import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { ApiResponse } from '@/types';

export interface TeacherOption {
  id: string;
  name: string;
  email: string;
}

/**
 * GET /api/admin/teachers
 * 선생님 계정 목록 (반 배정용 드롭다운) - 관리자 전용
 */
export async function GET(): Promise<NextResponse<ApiResponse<TeacherOption[]>>> {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const rows = await query<{ id: number; name: string; email: string }>(
    "SELECT id, name, email FROM users WHERE role = 'teacher' ORDER BY name"
  );

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({ id: String(r.id), name: r.name, email: r.email })),
  });
}
