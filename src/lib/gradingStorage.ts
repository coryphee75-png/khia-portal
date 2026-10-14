/**
 * 시험 자료 파일 저장소 (서버 전용)
 * - BLOB_READ_WRITE_TOKEN 이 있으면 Vercel Blob (배포 환경)
 * - 없으면 로컬 public/uploads/exams/<examId>/ (npm run dev 전용, .gitignore 처리됨)
 */
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { del, put } from '@vercel/blob';
import { isVercelBlobUrl } from './gradingQueries';

export function isBlobEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/** 파일을 저장하고 접근 주소(url)를 돌려줌 */
export async function saveExamFile(
  examId: number,
  file: File,
  ext: string,
  contentType: string,
  subdir = ''
): Promise<string> {
  const filename = `${randomUUID()}.${ext}`;
  const rel = subdir ? `${examId}/${subdir}` : String(examId);

  if (isBlobEnabled()) {
    const blob = await put(`exams/${rel}/${filename}`, file, {
      access: 'public',
      contentType,
    });
    return blob.url;
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', 'exams', ...rel.split('/'));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/exams/${rel}/${filename}`;
}

/** 저장된 파일 삭제 (실패해도 DB 삭제는 진행되도록 에러를 삼킴) */
export async function removeStoredFile(url: string): Promise<void> {
  try {
    if (isVercelBlobUrl(url)) {
      if (isBlobEnabled()) await del(url);
      return;
    }
    if (url.startsWith('/uploads/exams/') && !url.includes('..')) {
      await unlink(path.join(process.cwd(), 'public', url));
    }
  } catch (error) {
    console.warn('Stored file delete failed (ignored):', url, error);
  }
}
