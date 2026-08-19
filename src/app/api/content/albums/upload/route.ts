import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiResponse } from '@/types';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { put } from '@vercel/blob';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

/**
 * POST /api/content/albums/upload
 * 앨범 사진 업로드 - admin 또는 선생님 전용 (multipart/form-data, field name: "file")
 *
 * 저장 방식:
 * - BLOB_READ_WRITE_TOKEN 환경 변수가 있으면 Vercel Blob(클라우드 스토리지)에 저장 (배포 환경)
 * - 없으면 로컬 파일시스템(public/uploads/albums)에 저장 (로컬 개발 환경, npm run dev 전용)
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<{ url: string }>>> {
  const session = await auth();
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'teacher')) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: '파일이 없습니다.' }, { status: 400 });
    }

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { success: false, error: 'JPG, PNG, GIF, WEBP 이미지만 업로드할 수 있습니다.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: '파일 크기는 5MB 이하여야 합니다.' },
        { status: 400 }
      );
    }

    const filename = `${randomUUID()}.${ext}`;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`albums/${filename}`, file, {
        access: 'public',
        contentType: file.type,
      });
      return NextResponse.json({ success: true, data: { url: blob.url } });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'albums');
    await mkdir(uploadDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, filename), buffer);

    return NextResponse.json({ success: true, data: { url: `/uploads/albums/${filename}` } });
  } catch (error) {
    console.error('Album upload error:', error);
    return NextResponse.json({ success: false, error: '업로드에 실패했습니다.' }, { status: 500 });
  }
}
