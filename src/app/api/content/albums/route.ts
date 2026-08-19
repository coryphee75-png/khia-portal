import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getClient } from '@/lib/db';
import { canManageChild } from '@/lib/permissions';
import { ApiResponse, Album } from '@/types';
import { AlbumRow, AlbumImageRow, mapAlbum } from '@/lib/mappers';

interface ImageInput {
  url: string;
  caption?: string;
}

function parseImages(input: unknown): ImageInput[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((img) => img && typeof img.url === 'string' && img.url.trim())
    .map((img) => ({ url: String(img.url).trim(), caption: img.caption ? String(img.caption) : undefined }));
}

/**
 * POST /api/content/albums
 * 앨범 생성 - admin 또는 담당 선생님 전용
 * body: { childId, title, description?, eventDate, images: [{ url, caption? }] }
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<Album>>> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
  }

  const body = await req.json();
  const childId = Number(body.childId);
  const title = String(body.title || '').trim();
  const description = body.description ? String(body.description) : null;
  const eventDate = body.eventDate ? new Date(body.eventDate) : null;
  const images = parseImages(body.images);

  if (!Number.isFinite(childId) || !title || !eventDate) {
    return NextResponse.json(
      { success: false, error: '학생, 제목, 행사 날짜를 입력해주세요.' },
      { status: 400 }
    );
  }

  if (!(await canManageChild(session, childId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const albumResult = await client.query<AlbumRow>(
      `INSERT INTO albums (child_id, title, description, event_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [childId, title, description, eventDate]
    );
    const album = albumResult.rows[0];

    const imageRows: AlbumImageRow[] = [];
    for (const img of images) {
      const result = await client.query<AlbumImageRow>(
        `INSERT INTO album_images (album_id, url, caption) VALUES ($1, $2, $3) RETURNING *`,
        [album.id, img.url, img.caption || null]
      );
      imageRows.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, data: mapAlbum(album, imageRows) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create album error:', error);
    return NextResponse.json({ success: false, error: '앨범을 생성할 수 없습니다.' }, { status: 500 });
  } finally {
    client.release();
  }
}
