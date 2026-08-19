import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne, getClient } from '@/lib/db';
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

async function getOwningChildId(albumId: number): Promise<number | null> {
  const row = await queryOne<{ child_id: number }>('SELECT child_id FROM albums WHERE id = $1', [
    albumId,
  ]);
  return row?.child_id ?? null;
}

/**
 * PUT /api/content/albums/[id]
 * body: { title, description?, eventDate, images: [{ url, caption? }] } (images는 전체 교체)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<Album>>> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { id } = await params;
  const albumId = Number(id);
  if (!Number.isFinite(albumId)) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const childId = await getOwningChildId(albumId);
  if (childId === null) {
    return NextResponse.json({ success: false, error: '앨범을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!(await canManageChild(session, childId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const body = await req.json();
  const title = String(body.title || '').trim();
  const description = body.description ? String(body.description) : null;
  const eventDate = body.eventDate ? new Date(body.eventDate) : null;
  const images = parseImages(body.images);

  if (!title || !eventDate) {
    return NextResponse.json(
      { success: false, error: '제목과 행사 날짜를 입력해주세요.' },
      { status: 400 }
    );
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const albumResult = await client.query<AlbumRow>(
      `UPDATE albums SET title = $1, description = $2, event_date = $3 WHERE id = $4 RETURNING *`,
      [title, description, eventDate, albumId]
    );
    const album = albumResult.rows[0];

    await client.query('DELETE FROM album_images WHERE album_id = $1', [albumId]);

    const imageRows: AlbumImageRow[] = [];
    for (const img of images) {
      const result = await client.query<AlbumImageRow>(
        `INSERT INTO album_images (album_id, url, caption) VALUES ($1, $2, $3) RETURNING *`,
        [albumId, img.url, img.caption || null]
      );
      imageRows.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, data: mapAlbum(album, imageRows) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update album error:', error);
    return NextResponse.json({ success: false, error: '앨범을 수정할 수 없습니다.' }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * DELETE /api/content/albums/[id]
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
  const albumId = Number(id);
  if (!Number.isFinite(albumId)) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const childId = await getOwningChildId(albumId);
  if (childId === null) {
    return NextResponse.json({ success: false, error: '앨범을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!(await canManageChild(session, childId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  await query('DELETE FROM albums WHERE id = $1', [albumId]);
  return NextResponse.json({ success: true });
}
