import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { ApiResponse } from '@/types';
import { Branch, isGradingStaff } from '@/lib/grading';
import { isBlobEnabled } from '@/lib/gradingStorage';

export interface GradingOptions {
  classes: { id: string; name: string; grade: number; branch: Branch }[];
  /** 선생님 계정의 소속 지점(없으면 null) - 배치고사 기본 지점으로 사용 */
  myBranch: Branch | null;
  /** Vercel Blob 사용 여부 - true면 브라우저가 Blob에 직접 업로드(큰 파일 가능) */
  blobEnabled: boolean;
}

/**
 * GET /api/grading/options
 * 시험 만들기 화면에서 고를 수 있는 반 목록 (관리자: 전체, 선생님: 담당 반)
 */
export async function GET(): Promise<NextResponse<ApiResponse<GradingOptions>>> {
  const session = await auth();
  if (!isGradingStaff(session)) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const isAdmin = session!.user.role === 'admin';
  const rows = await query<{ id: number; name: string; grade: number; branch: Branch }>(
    isAdmin
      ? 'SELECT id, name, grade, branch FROM classes ORDER BY branch, grade, name'
      : 'SELECT id, name, grade, branch FROM classes WHERE teacher_id = $1 ORDER BY branch, grade, name',
    isAdmin ? [] : [Number(session!.user.id)]
  );
  const me = await queryOne<{ branch: Branch | null }>('SELECT branch FROM users WHERE id = $1', [
    Number(session!.user.id),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      classes: rows.map((r) => ({ id: String(r.id), name: r.name, grade: r.grade, branch: r.branch })),
      myBranch: me?.branch ?? null,
      blobEnabled: isBlobEnabled(),
    },
  });
}
