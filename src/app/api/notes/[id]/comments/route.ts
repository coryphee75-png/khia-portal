import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { canAccessChild } from '@/lib/permissions';
import { ApiResponse, NoteComment } from '@/types';
import { NoteCommentRow, mapNoteComment } from '@/lib/mappers';

/**
 * 수업일지 댓글 - 학부모 ↔ 담임선생님(및 관리자) 소통
 * - GET: 댓글 목록 조회
 * - POST: 댓글 작성
 * 접근 권한: 그 수업일지가 속한 학생을 볼 수 있는 사람만 (학부모 본인 자녀 / 담당 선생님 / 관리자)
 */

async function getOwningChildId(noteId: number): Promise<number | null> {
  const row = await queryOne<{ child_id: number }>('SELECT child_id FROM notes WHERE id = $1', [
    noteId,
  ]);
  return row?.child_id ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<NoteComment[]>>> {
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
  if (!(await canAccessChild(session, childId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const rows = await query<NoteCommentRow>(
      `SELECT nc.id, nc.note_id, nc.author_id, nc.content, nc.created_at,
              u.name AS author_name, u.role AS author_role
       FROM note_comments nc
       JOIN users u ON u.id = nc.author_id
       WHERE nc.note_id = $1
       ORDER BY nc.created_at ASC`,
      [noteId]
    );
    return NextResponse.json({ success: true, data: rows.map(mapNoteComment) });
  } catch (error) {
    console.error('List note comments error:', error);
    return NextResponse.json({ success: false, error: '댓글을 불러올 수 없습니다.' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<NoteComment>>> {
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
  if (!(await canAccessChild(session, childId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const content = String(body.content || '').trim();
    if (!content) {
      return NextResponse.json({ success: false, error: '댓글 내용을 입력해주세요.' }, { status: 400 });
    }
    if (content.length > 1000) {
      return NextResponse.json(
        { success: false, error: '댓글은 1000자 이내로 작성해주세요.' },
        { status: 400 }
      );
    }

    const row = await queryOne<NoteCommentRow>(
      `WITH inserted AS (
         INSERT INTO note_comments (note_id, author_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, note_id, author_id, content, created_at
       )
       SELECT inserted.*, u.name AS author_name, u.role AS author_role
       FROM inserted JOIN users u ON u.id = inserted.author_id`,
      [noteId, Number(session.user.id), content]
    );

    return NextResponse.json({ success: true, data: mapNoteComment(row!) });
  } catch (error) {
    console.error('Create note comment error:', error);
    return NextResponse.json({ success: false, error: '댓글을 작성할 수 없습니다.' }, { status: 500 });
  }
}
