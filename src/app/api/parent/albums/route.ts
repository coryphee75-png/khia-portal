import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiResponse, Album } from '@/types';

/**
 * GET /api/parent/albums
 * 학부모의 자녀 앨범 조회
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<Album[]>>> {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // TODO: 실제 데이터베이스에서 앨범 조회
    // const albums = await query<Album>(
    //   'SELECT * FROM albums WHERE child_id IN (SELECT id FROM children WHERE parent_id = $1) ORDER BY event_date DESC',
    //   [session.user.id]
    // );

    const albums: Album[] = [
      {
        id: '1',
        childId: '1',
        title: '2024년 겨울 운동회',
        description: '즐거운 겨울 운동회 사진입니다.',
        images: [
          {
            id: '1-1',
            url: 'https://via.placeholder.com/400?text=Winter+Sports+1',
            caption: '달리기 경기',
            uploadedAt: new Date(),
          },
          {
            id: '1-2',
            url: 'https://via.placeholder.com/400?text=Winter+Sports+2',
            caption: '줄넘기',
            uploadedAt: new Date(),
          },
          {
            id: '1-3',
            url: 'https://via.placeholder.com/400?text=Winter+Sports+3',
            caption: '팀 기념사진',
            uploadedAt: new Date(),
          },
        ],
        eventDate: new Date('2024-12-10'),
        createdAt: new Date(),
      },
      {
        id: '2',
        childId: '1',
        title: '2024년 전시회',
        description: '미술 시간에 만든 작품 전시회입니다.',
        images: [
          {
            id: '2-1',
            url: 'https://via.placeholder.com/400?text=Art+Exhibition+1',
            caption: '회화 작품',
            uploadedAt: new Date(),
          },
          {
            id: '2-2',
            url: 'https://via.placeholder.com/400?text=Art+Exhibition+2',
            caption: '조각 작품',
            uploadedAt: new Date(),
          },
        ],
        eventDate: new Date('2024-11-20'),
        createdAt: new Date(),
      },
      {
        id: '3',
        childId: '1',
        title: '과학 프로젝트',
        description: '우리 반의 과학 프로젝트 결과물입니다.',
        images: [
          {
            id: '3-1',
            url: 'https://via.placeholder.com/400?text=Science+Project',
            caption: '완성된 프로젝트',
            uploadedAt: new Date(),
          },
        ],
        eventDate: new Date('2024-11-15'),
        createdAt: new Date(),
      },
    ];

    return NextResponse.json({
      success: true,
      data: albums,
    });
  } catch (error) {
    console.error('Albums API error:', error);
    return NextResponse.json(
      { success: false, error: '앨범을 불러올 수 없습니다.' },
      { status: 500 }
    );
  }
}
