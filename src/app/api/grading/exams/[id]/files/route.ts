import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { ApiResponse } from '@/types';
import {
  EXAM_FILE_KINDS,
  EXAM_FILE_MAX_BYTES,
  EXAM_FILE_TYPES,
  ExamFile,
  ExamFileKind,
  getFileExtension,
} from '@/lib/grading';
import { canManageExam, ExamFileRow, isVercelBlobUrl, mapExamFile } from '@/lib/gradingQueries';
import { saveExamFile } from '@/lib/gradingStorage';

type Result = NextResponse<ApiResponse<ExamFile>>;

function fail(error: string, status: number): Result {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * POST /api/grading/exams/[id]/files
 * 시험 자료(시험지 샘플/답지/루브릭) 등록 - 관리자, 해당 시험 담당 선생님
 *
 * 두 가지 방식을 지원합니다.
 * 1) multipart/form-data (field: file, kind) - 서버가 직접 저장 (로컬 개발 환경)
 * 2) application/json { kind, url, fileName, size } - 브라우저가 Vercel Blob에 직접 올린 뒤 주소만 등록
 *    (배포 환경: Vercel 서버 요청 크기 제한(약 4.5MB)을 피해 큰 PDF도 올릴 수 있음)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Result> {
  const session = await auth();
  const { id } = await params;
  const examId = Number(id);
  if (!Number.isFinite(examId) || examId <= 0) return fail('잘못된 요청입니다.', 400);
  if (!(await canManageExam(session, examId))) return fail('접근 권한이 없습니다.', 403);

  try {
    let kind: ExamFileKind;
    let fileName: string;
    let url: string;
    let mimeType: string;
    let size: number;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      kind = String(form.get('kind') || '') as ExamFileKind;
      if (!(file instanceof File)) return fail('파일이 없습니다.', 400);
      fileName = file.name;
      size = file.size;
      const ext = getFileExtension(fileName);
      mimeType = EXAM_FILE_TYPES[ext];
      if (!mimeType) return fail('지원하지 않는 파일 형식입니다. (PDF, 이미지, 한글, 워드, 엑셀 등)', 400);
      if (size > EXAM_FILE_MAX_BYTES) return fail('파일 크기는 30MB 이하여야 합니다.', 400);
      if (!EXAM_FILE_KINDS.includes(kind)) return fail('자료 종류를 선택해주세요.', 400);
      url = await saveExamFile(examId, file, ext, mimeType);
    } else {
      const body = await req.json();
      kind = body.kind;
      fileName = String(body.fileName || '').slice(0, 255);
      url = String(body.url || '');
      size = Number(body.size) || 0;
      const ext = getFileExtension(fileName);
      mimeType = EXAM_FILE_TYPES[ext];
      if (!EXAM_FILE_KINDS.includes(kind)) return fail('자료 종류를 선택해주세요.', 400);
      if (!mimeType) return fail('지원하지 않는 파일 형식입니다.', 400);
      if (!isVercelBlobUrl(url) || !new URL(url).pathname.startsWith(`/exams/${examId}/`)) {
        return fail('잘못된 파일 주소입니다.', 400);
      }
    }

    const row = await queryOne<ExamFileRow>(
      `INSERT INTO exam_files (exam_id, kind, file_name, url, mime_type, size_bytes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [examId, kind, fileName, url, mimeType, size, Number(session!.user.id)]
    );
    return NextResponse.json({ success: true, data: mapExamFile(row!) });
  } catch (error) {
    console.error('Exam file upload error:', error);
    return fail('업로드에 실패했습니다. (DB 마이그레이션 실행 여부를 확인하세요)', 500);
  }
}
