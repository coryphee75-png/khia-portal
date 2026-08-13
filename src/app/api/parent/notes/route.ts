import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiResponse, Note } from '@/types';

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

    // TODO: 실제 데이터베이스에서 수업일지 조회
    // const notes = await query<Note>(
    //   'SELECT * FROM notes WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1) ORDER BY date DESC',
    //   [session.user.id]
    // );

    const notes: Note[] = [
      {
        id: '1',
        childId: '1',
        date: new Date('2024-12-18'),
        subject: '수학',
        content: '오늘은 분수의 덧셈과 뺄셈을 배웠습니다. 학생들이 매우 집중했습니다.',
        teacher: '박선생님',
        createdAt: new Date(),
      },
      {
        id: '2',
        childId: '1',
        date: new Date('2024-12-17'),
        subject: '과학',
        content:
          '식물의 생장 과정에 대해 학습했습니다. 모든 학생이 성공적으로 참여했습니다.',
        teacher: '이선생님',
        attachments: ['science-slides.pdf'],
        createdAt: new Date(),
      },
      {
        id: '3',
        childId: '1',
        date: new Date('2024-12-16'),
        subject: '국어',
        content:
          '고전 문학을 통해 한국 문화를 배웠습니다. 학생들의 이해도가 높았습니다.',
        teacher: '김선생님',
        createdAt: new Date(),
      },
      {
        id: '4',
        childId: '2',
        date: new Date('2024-12-15'),
        subject: '영어',
        content: '알파벳과 간단한 단어를 배웠습니다. 발음 연습을 열심히 했습니다.',
        teacher: '정선생님',
        createdAt: new Date(),
      },
    ];

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
