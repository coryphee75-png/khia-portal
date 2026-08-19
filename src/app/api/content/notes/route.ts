import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { canManageChild } from '@/lib/permissions';
import { ApiResponse, Note } from '@/types';
import { NoteRow, mapNote } from '@/lib/mappers';

/**
 * POST /api/content/notes
 * 수업일지 생성 - admin 또는 담당 선생님 전용
 * body: { childId, date, subject, content, teacher, attachments? }
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<Note>>> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const childId = Number(body.childId);
    const date = body.date ? new Date(body.date) : null;
    const subject = String(body.subject || '').trim();
    const content = String(body.content || '').trim();
    const teacherName = String(body.teacher || session.user.name || '선생님').trim();
    const attachments: string[] | null = Array.isArray(body.attachments)
      ? body.attachments.filter((a: unknown) => typeof a === 'string' && a.trim())
      : null;

    if (!Number.isFinite(childId) || !date || !subject || !content) {
      return NextResponse.json(
        { success: false, error: '학생, 날짜, 과목, 내용을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!(await canManageChild(session, childId))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const row = await queryOne<NoteRow>(
      `INSERT INTO notes (child_id, date, subject, content, teacher, attachments)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [childId, date, subject, content, teacherName, attachments]
    );

    return NextResponse.json({ success: true, data: mapNote(row!) });
  } catch (error) {
    console.error('Create note error:', error);
    return NextResponse.json({ success: false, error: '수업일지를 생성할 수 없습니다.' }, { status: 500 });
  }
}
