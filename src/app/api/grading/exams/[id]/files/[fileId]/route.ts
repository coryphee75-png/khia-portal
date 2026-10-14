import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { ApiResponse } from '@/types';
import { canManageExam } from '@/lib/gradingQueries';
import { removeStoredFile } from '@/lib/gradingStorage';

/**
 * DELETE /api/grading/exams/[id]/files/[fileId]
 * 시험 자료 파일 삭제 (저장소 파일 + DB 기록) - 관리자, 해당 시험 담당 선생님
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
): Promise<NextResponse<ApiResponse<null>>> {
  const session = await auth();
  const { id, fileId } = await params;
  const examId = Number(id);
  const fid = Number(fileId);
  if (!Number.isFinite(examId) || !Number.isFinite(fid)) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }
  if (!(await canManageExam(session, examId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const row = await queryOne<{ url: string }>(
    'DELETE FROM exam_files WHERE id = $1 AND exam_id = $2 RETURNING url',
    [fid, examId]
  );
  if (!row) {
    return NextResponse.json({ success: false, error: '파일을 찾을 수 없습니다.' }, { status: 404 });
  }
  await removeStoredFile(row.url);
  return NextResponse.json({ success: true, data: null });
}
