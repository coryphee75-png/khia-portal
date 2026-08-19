import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { ApiResponse, Note } from '@/types';
import { NoteRow, mapNote } from '@/lib/mappers';

/**
 * GET /api/parent/notes
 * 학부모의 자녀 수업일지 조회
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<Note[]>>> {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const noteRows = await query<NoteRow>(
      `SELECT n.* FROM notes n
       WHERE n.child_id IN (SELECT id FROM children WHERE parent_id = $1)
       ORDER BY n.date DESC`,
      [Number(session.user.id)]
    );
    const notes: Note[] = noteRows.map(mapNote);

    return NextResponse.json({
      success: true,
      data: notes,
    });
  } catch (error) {
    console.error('Notes API error:', error);
    return NextResponse.json(
      { success: false, error: '수업일지를 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
