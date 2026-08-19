import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { canManageChild } from '@/lib/permissions';
import { ApiResponse, Homework } from '@/types';
import { HomeworkRow, mapHomework } from '@/lib/mappers';

async function getOwningChildId(homeworkId: number): Promise<number | null> {
  const row = await queryOne<{ child_id: number }>(
    'SELECT child_id FROM homeworks WHERE id = $1',
    [homeworkId]
  );
  return row?.child_id ?? null;
}

/**
 * PUT /api/content/homeworks/[id]
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<Homework>>> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { id } = await params;
  const homeworkId = Number(id);
  if (!Number.isFinite(homeworkId)) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const childId = await getOwningChildId(homeworkId);
  if (childId === null) {
    return NextResponse.json({ success: false, error: '숙제를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!(await canManageChild(session, childId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const title = String(body.title || '').trim();
    const subject = String(body.subject || '').trim();
    const dueDate = body.dueDate ? new Date(body.dueDate) : null;
    const status = ['pending', 'completed', 'overdue'].includes(body.status)
      ? body.status
      : 'pending';
    const description = String(body.description || '');

    if (!title || !subject || !dueDate) {
      return NextResponse.json(
        { success: false, error: '제목, 과목, 마감일을 입력해주세요.' },
        { status: 400 }
      );
    }

    const row = await queryOne<HomeworkRow>(
      `UPDATE homeworks SET title = $1, description = $2, subject = $3, due_date = $4,
         status = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [title, description, subject, dueDate, status, homeworkId]
    );

    return NextResponse.json({ success: true, data: mapHomework(row!) });
  } catch (error) {
    console.error('Update homework error:', error);
    return NextResponse.json({ success: false, error: '숙제를 수정할 수 없습니다.' }, { status: 500 });
  }
}

/**
 * DELETE /api/content/homeworks/[id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<null>>> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { id } = await params;
  const homeworkId = Number(id);
  if (!Number.isFinite(homeworkId)) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const childId = await getOwningChildId(homeworkId);
  if (childId === null) {
    return NextResponse.json({ success: false, error: '숙제를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!(await canManageChild(session, childId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  await query('DELETE FROM homeworks WHERE id = $1', [homeworkId]);
  return NextResponse.json({ success: true });
}
