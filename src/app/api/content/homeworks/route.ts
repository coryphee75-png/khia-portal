import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { canManageChild } from '@/lib/permissions';
import { ApiResponse, Homework } from '@/types';
import { HomeworkRow, mapHomework } from '@/lib/mappers';

/**
 * POST /api/content/homeworks
 * 숙제 생성 - admin 또는 담당 선생님 전용
 * body: { childId, title, description, subject, dueDate, status }
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<Homework>>> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const childId = Number(body.childId);
    const title = String(body.title || '').trim();
    const subject = String(body.subject || '').trim();
    const dueDate = body.dueDate ? new Date(body.dueDate) : null;
    const status = ['pending', 'completed', 'overdue'].includes(body.status)
      ? body.status
      : 'pending';
    const description = String(body.description || '');

    if (!Number.isFinite(childId) || !title || !subject || !dueDate) {
      return NextResponse.json(
        { success: false, error: '학생, 제목, 과목, 마감일을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!(await canManageChild(session, childId))) {
      return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const row = await queryOne<HomeworkRow>(
      `INSERT INTO homeworks (child_id, title, description, subject, due_date, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [childId, title, description, subject, dueDate, status]
    );

    return NextResponse.json({ success: true, data: mapHomework(row!) });
  } catch (error) {
    console.error('Create homework error:', error);
    return NextResponse.json({ success: false, error: '숙제를 생성할 수 없습니다.' }, { status: 500 });
  }
}
