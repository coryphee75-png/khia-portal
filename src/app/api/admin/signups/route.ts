import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { ApiResponse } from '@/types';

export interface PendingSignupInfo {
  id: string;
  name: string;
  email: string;
  requestedAt: string;
  children: { id: string; name: string; grade: number; classNumber: string }[];
}

interface PendingSignupRow {
  id: number;
  name: string;
  email: string;
  created_at: string;
  child_id: number | null;
  child_name: string | null;
  child_grade: number | null;
  child_class_number: string | null;
}

/**
 * GET /api/admin/signups
 * 관리자 승인 대기 중인 학부모 가입 신청 목록 (연결된 자녀 정보 포함) - 관리자 전용
 */
export async function GET(): Promise<NextResponse<ApiResponse<PendingSignupInfo[]>>> {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const rows = await query<PendingSignupRow>(
    `SELECT u.id, u.name, u.email, u.created_at,
            ch.id AS child_id, ch.name AS child_name, ch.grade AS child_grade, ch.class_number AS child_class_number
     FROM users u
     LEFT JOIN children ch ON ch.parent_id = u.id
     WHERE u.role = 'parent' AND u.status = 'pending'
     ORDER BY u.created_at`
  );

  const byUser = new Map<number, PendingSignupInfo>();
  for (const row of rows) {
    if (!byUser.has(row.id)) {
      byUser.set(row.id, {
        id: String(row.id),
        name: row.name,
        email: row.email,
        requestedAt: row.created_at,
        children: [],
      });
    }
    if (row.child_id !== null) {
      byUser.get(row.id)!.children.push({
        id: String(row.child_id),
        name: row.child_name!,
        grade: row.child_grade!,
        classNumber: row.child_class_number!,
      });
    }
  }

  return NextResponse.json({ success: true, data: Array.from(byUser.values()) });
}
