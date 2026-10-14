import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { ApiResponse } from '@/types';
import {
  getFileExtension,
  SCAN_FILE_TYPES,
  SCAN_MAX_FILES,
  EXAM_FILE_MAX_BYTES,
  SubmissionSummary,
} from '@/lib/grading';
import {
  canManageExam,
  isVercelBlobUrl,
  mapSubmission,
  recommendForSubmissions,
  SubmissionRow,
} from '@/lib/gradingQueries';
import { saveExamFile } from '@/lib/gradingStorage';

async function resolve(
  params: Promise<{ id: string }>
): Promise<{ examId: number; error?: NextResponse<ApiResponse<never>> }> {
  const session = await auth();
  const { id } = await params;
  const examId = Number(id);
  if (!Number.isFinite(examId) || examId <= 0) {
    return { examId, error: NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 }) };
  }
  if (!(await canManageExam(session, examId))) {
    return { examId, error: NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 }) };
  }
  return { examId };
}

/**
 * GET /api/grading/exams/[id]/submissions
 * 시험의 학생 답안지(제출본) 목록 - 관리자, 해당 시험 담당 선생님
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<SubmissionSummary[]>>> {
  const { examId, error } = await resolve(params);
  if (error) return error;
  const rows = await query<SubmissionRow>(
    'SELECT * FROM submissions WHERE exam_id = $1 ORDER BY student_name, created_at',
    [examId]
  );
  const rec = await recommendForSubmissions(examId, rows);
  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      ...mapSubmission(r),
      recommendedClass: rec.get(r.id)?.recommended ?? null,
      placementNote: rec.get(r.id)?.note ?? null,
    })),
  });
}

/**
 * POST /api/grading/exams/[id]/submissions
 * 학생 1명의 답안지 스캔(여러 페이지) 등록 → 상태 pending(대기). AI 채점은 다음 단계에서 실행.
 *
 * 1) multipart/form-data: studentId?, studentName, files(여러 개) - 서버가 저장 (로컬 개발 환경)
 * 2) application/json: { studentId?, studentName, pages: [{ url, fileName }] }
 *    - 브라우저가 Vercel Blob에 직접 올린 뒤 주소만 등록 (배포 환경, 큰 PDF 가능)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<SubmissionSummary>>> {
  const { examId, error } = await resolve(params);
  if (error) return error;
  const fail = (msg: string, status = 400) =>
    NextResponse.json({ success: false, error: msg }, { status });

  try {
    let studentIdRaw: unknown;
    let studentName: string;
    const urls: string[] = [];
    const names: string[] = [];
    let pendingFiles: File[] = [];

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      studentIdRaw = form.get('studentId');
      studentName = String(form.get('studentName') || '').trim();
      const files = form.getAll('files').filter((f): f is File => f instanceof File);
      if (files.length === 0) return fail('답안지 파일을 선택해주세요.');
      if (files.length > SCAN_MAX_FILES) return fail(`한 번에 ${SCAN_MAX_FILES}개까지 올릴 수 있습니다.`);
      for (const f of files) {
        const ext = getFileExtension(f.name);
        if (!SCAN_FILE_TYPES[ext]) return fail(`"${f.name}": 답안지는 PDF 또는 이미지(JPG/PNG/WEBP)만 가능합니다.`);
        if (f.size > EXAM_FILE_MAX_BYTES) return fail(`"${f.name}"이(가) 30MB를 넘습니다.`);
      }
      pendingFiles = files;
    } else {
      const body = await req.json();
      studentIdRaw = body.studentId;
      studentName = String(body.studentName || '').trim();
      const pages: { url?: string; fileName?: string }[] = Array.isArray(body.pages) ? body.pages : [];
      if (pages.length === 0) return fail('답안지 파일을 선택해주세요.');
      if (pages.length > SCAN_MAX_FILES) return fail(`한 번에 ${SCAN_MAX_FILES}개까지 올릴 수 있습니다.`);
      for (const p of pages) {
        const url = String(p.url || '');
        const fileName = String(p.fileName || '').slice(0, 255);
        if (!SCAN_FILE_TYPES[getFileExtension(fileName)]) return fail('답안지는 PDF 또는 이미지만 가능합니다.');
        if (!isVercelBlobUrl(url) || !new URL(url).pathname.startsWith(`/exams/${examId}/`)) {
          return fail('잘못된 파일 주소입니다.');
        }
        urls.push(url);
        names.push(fileName);
      }
    }

    // 학생 확인: 등록 학생을 골랐으면 이름은 DB 값으로, 아니면 직접 입력한 이름(배치고사 신입생)
    let studentId: number | null = null;
    if (studentIdRaw !== null && studentIdRaw !== undefined && String(studentIdRaw) !== '') {
      studentId = Number(studentIdRaw);
      const child = await queryOne<{ name: string }>('SELECT name FROM children WHERE id = $1', [studentId]);
      if (!child) return fail('학생을 찾을 수 없습니다.', 404);
      studentName = child.name;
    }
    if (!studentName) return fail('학생을 선택하거나 이름을 입력해주세요.');
    studentName = studentName.slice(0, 100);

    // 학생 확인이 끝난 뒤에 파일 저장 (검증 실패 시 고아 파일이 남지 않도록)
    for (const f of pendingFiles) {
      const ext = getFileExtension(f.name);
      urls.push(await saveExamFile(examId, f, ext, SCAN_FILE_TYPES[ext], 'submissions'));
      names.push(f.name.slice(0, 255));
    }

    const row = await queryOne<SubmissionRow>(
      `INSERT INTO submissions (exam_id, student_id, student_name, scan_image_urls, scan_file_names)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [examId, studentId, studentName, urls, names]
    );
    return NextResponse.json({ success: true, data: mapSubmission(row!) });
  } catch (err) {
    console.error('Create submission error:', err);
    return fail('답안지를 올릴 수 없습니다. (DB 마이그레이션 실행 여부를 확인하세요)', 500);
  }
}
