import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { ApiResponse, Album } from '@/types';
import { AlbumRow, AlbumImageRow, mapAlbum } from '@/lib/mappers';

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

    const albumRows = await query<AlbumRow>(
      `SELECT a.* FROM albums a
       WHERE a.child_id IN (SELECT id FROM children WHERE parent_id = $1)
       ORDER BY a.event_date DESC`,
      [Number(session.user.id)]
    );

    const albumIds = albumRows.map((a) => a.id);
    const imageRows = albumIds.length
      ? await query<AlbumImageRow>(
          `SELECT * FROM album_images WHERE album_id = ANY($1::int[]) ORDER BY id`,
          [albumIds]
        )
      : [];

    const albums: Album[] = albumRows.map((row) =>
      mapAlbum(
        row,
        imageRows.filter((img) => img.album_id === row.id)
      )
    );

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
