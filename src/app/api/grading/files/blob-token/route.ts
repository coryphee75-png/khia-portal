import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { auth } from '@/lib/auth';
import { EXAM_FILE_MAX_BYTES, EXAM_FILE_TYPES } from '@/lib/grading';
import { canManageExam } from '@/lib/gradingQueries';

/**
 * POST /api/grading/files/blob-token
 * 브라우저 → Vercel Blob 직접 업로드용 토큰 발급 (배포 환경 전용)
 * clientPayload = 시험 id, 업로드 경로는 exams/<시험 id>/... 로 제한
 * 업로드가 끝나면 브라우저가 /api/grading/exams/[id]/files 로 주소를 등록합니다.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const examId = Number(clientPayload);
        if (!Number.isFinite(examId) || !(await canManageExam(session, examId))) {
          throw new Error('접근 권한이 없습니다.');
        }
        if (!pathname.startsWith(`exams/${examId}/`)) {
          throw new Error('잘못된 업로드 경로입니다.');
        }
        return {
          allowedContentTypes: Array.from(new Set(Object.values(EXAM_FILE_TYPES))),
          maximumSizeInBytes: EXAM_FILE_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '업로드 토큰을 만들 수 없습니다.' },
      { status: 400 }
    );
  }
}
