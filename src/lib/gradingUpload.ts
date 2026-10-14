'use client';

/**
 * 시험 자료 파일 업로드 (브라우저 전용)
 * - blobEnabled(배포 환경): 브라우저 → Vercel Blob 직접 업로드 후 주소만 서버에 등록 (30MB까지)
 * - 로컬 개발 환경: 서버로 multipart 전송 → public/uploads/exams 에 저장
 */
import { upload } from '@vercel/blob/client';
import {
  EXAM_FILE_MAX_BYTES,
  EXAM_FILE_TYPES,
  ExamFile,
  ExamFileKind,
  getFileExtension,
  SCAN_FILE_TYPES,
  SubmissionSummary,
} from './grading';

/** 업로드 전에 형식/크기를 확인해서 문제가 있으면 안내 문구를 돌려줌 */
export function validateExamFile(file: File): string | null {
  const ext = getFileExtension(file.name);
  if (!EXAM_FILE_TYPES[ext]) {
    return `"${file.name}"은(는) 올릴 수 없는 형식입니다. (PDF, 이미지, 한글, 워드, 엑셀, 파워포인트, txt)`;
  }
  if (file.size > EXAM_FILE_MAX_BYTES) {
    return `"${file.name}"이(가) 30MB를 넘습니다.`;
  }
  return null;
}

export async function uploadExamFile(
  examId: string,
  kind: ExamFileKind,
  file: File,
  blobEnabled: boolean
): Promise<ExamFile> {
  const problem = validateExamFile(file);
  if (problem) throw new Error(problem);

  let res: Response;
  if (blobEnabled) {
    const ext = getFileExtension(file.name);
    const blob = await upload(`exams/${examId}/${kind}.${ext}`, file, {
      access: 'public',
      handleUploadUrl: '/api/grading/files/blob-token',
      clientPayload: examId,
      contentType: EXAM_FILE_TYPES[ext],
    });
    res = await fetch(`/api/grading/exams/${examId}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, url: blob.url, fileName: file.name, size: file.size }),
    });
  } else {
    const body = new FormData();
    body.append('file', file);
    body.append('kind', kind);
    res = await fetch(`/api/grading/exams/${examId}/files`, { method: 'POST', body });
  }

  const result = await res.json();
  if (!res.ok || !result.success) throw new Error(result?.error || '업로드에 실패했습니다.');
  return result.data as ExamFile;
}

// ===== 학생 답안지 업로드 =====
export function validateScanFile(file: File): string | null {
  const ext = getFileExtension(file.name);
  if (!SCAN_FILE_TYPES[ext]) {
    return `"${file.name}": 답안지는 PDF 또는 이미지(JPG/PNG/WEBP)만 올릴 수 있습니다.`;
  }
  if (file.size > EXAM_FILE_MAX_BYTES) return `"${file.name}"이(가) 30MB를 넘습니다.`;
  return null;
}

/** 학생 1명의 답안지(여러 페이지)를 올리고 제출본으로 등록 */
export async function uploadSubmission(
  examId: string,
  student: { studentId: string | null; studentName: string },
  files: File[],
  blobEnabled: boolean,
  onProgress?: (done: number, total: number) => void
): Promise<SubmissionSummary> {
  for (const f of files) {
    const problem = validateScanFile(f);
    if (problem) throw new Error(problem);
  }

  let res: Response;
  if (blobEnabled) {
    const pages: { url: string; fileName: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = getFileExtension(f.name);
      const blob = await upload(`exams/${examId}/submissions/scan.${ext}`, f, {
        access: 'public',
        handleUploadUrl: '/api/grading/files/blob-token',
        clientPayload: examId,
        contentType: SCAN_FILE_TYPES[ext],
      });
      pages.push({ url: blob.url, fileName: f.name });
      onProgress?.(i + 1, files.length);
    }
    res = await fetch(`/api/grading/exams/${examId}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...student, pages }),
    });
  } else {
    const body = new FormData();
    if (student.studentId) body.append('studentId', student.studentId);
    body.append('studentName', student.studentName);
    files.forEach((f) => body.append('files', f));
    res = await fetch(`/api/grading/exams/${examId}/submissions`, { method: 'POST', body });
    onProgress?.(files.length, files.length);
  }

  const result = await res.json();
  if (!res.ok || !result.success) throw new Error(result?.error || '답안지를 올릴 수 없습니다.');
  return result.data as SubmissionSummary;
}
