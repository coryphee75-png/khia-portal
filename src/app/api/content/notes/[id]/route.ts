import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { canManageChild } from '@/lib/permissions';
import { ApiResponse, Note } from '@/types';
import { NoteRow, mapNote } from '@/lib/mappers';

async function getOwningChildId(noteId: number): Promise<number | null> {
  const row = await queryOne<{ child_id: number }>('SELECT child_id FROM notes WHERE id = $1', [
    noteId,
  ]);
  return row?.child_id ?? null;
}

/**
 * PUT /api/content/notes/[id]
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<Note>>> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { id } = await params;
  const noteId = Number(id);
  if (!Number.isFinite(noteId)) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const childId = await getOwningChildId(noteId);
  if (childId === null) {
    return NextResponse.json({ success: false, error: '수업일지를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!(await canManageChild(session, childId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const date = body.date ? new Date(body.date) : null;
    const subject = String(body.subject || '').trim();
    const content = String(body.content || '').trim();
    const teacherName = String(body.teacher || session.user.name || '선생님').trim();
    const attachments: string[] | null = Array.isArray(body.attachments)
      ? body.attachments.filter((a: unknown) => typeof a === 'string' && a.trim())
      : null;

    if (!date || !subject || !content) {
      return NextResponse.json(
        { success: false, error: '날짜, 과목, 내용을 입력해주세요.' },
        { status: 400 }
      );
    }

    const row = await queryOne<NoteRow>(
      `UPDATE notes SET date = $1, subject = $2, content = $3, teacher = $4, attachments = $5
       WHERE id = $6 RETURNING *`,
      [date, subject, content, teacherName, attachments, noteId]
    );

    return NextResponse.json({ success: true, data: mapNote(row!) });
  } catch (error) {
    console.error('Update note error:', error);
    return NextResponse.json({ success: false, error: '수업일지를 수정할 수 없습니다.' }, { status: 500 });
  }
}

/**
 * DELETE /api/content/notes/[id]
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
  const noteId = Number(id);
  if (!Number.isFinite(noteId)) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const childId = await getOwningChildId(noteId);
  if (childId === null) {
    return NextResponse.json({ success: false, error: '수업일지를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!(await canManageChild(session, childId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  await query('DELETE FROM notes WHERE id = $1', [noteId]);
  return NextResponse.json({ success: true });
}
