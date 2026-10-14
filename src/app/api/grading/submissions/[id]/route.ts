import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getClient, query, queryOne } from '@/lib/db';
import { ApiResponse } from '@/types';
import { QuestionType, SubmissionDetail } from '@/lib/grading';
import { canManageExam, getSubmissionExamId, mapSubmission, SubmissionRow } from '@/lib/gradingQueries';
import { removeStoredFile } from '@/lib/gradingStorage';

const num = (v: string | null | undefined): number | null => (v === null || v === undefined ? null : Number(v));

/**
 * GET /api/grading/submissions/[id]
 * 답안지 1건의 채점 결과 (영역별 점수/코멘트 + 문항별 점수) - 관리자, 해당 시험 담당 선생님
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<SubmissionDetail>>> {
  const session = await auth();
  const { id } = await params;
  const submissionId = Number(id);
  const examId = Number.isFinite(submissionId) ? await getSubmissionExamId(submissionId) : null;
  if (!examId) {
    return NextResponse.json({ success: false, error: '답안지를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!(await canManageExam(session, examId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const row = await queryOne<SubmissionRow>('SELECT * FROM submissions WHERE id = $1', [submissionId]);
  const areas = await query<{
    id: number; name: string; max_score: string; score: string | null; ai_comment: string | null; final_comment: string | null;
  }>(
    `SELECT a.id, a.name, a.max_score, r.score, r.ai_comment, r.final_comment
     FROM exam_areas a
     LEFT JOIN submission_area_results r ON r.area_id = a.id AND r.submission_id = $2
     WHERE a.exam_id = $1 ORDER BY a.order_no, a.id`,
    [examId, submissionId]
  );
  const answers = await query<{
    question_id: number; area_id: number; question_no: number; question_type: QuestionType; label: string | null;
    max_score: string; answer_key: string | null; student_answer: string | null; ai_score: string | null;
    final_score: string | null; ai_comment: string | null; needs_review: boolean | null; teacher_edited: boolean | null;
  }>(
    `SELECT q.id AS question_id, q.area_id, q.question_no, q.question_type, q.label, q.max_score, q.answer_key,
            sa.student_answer, sa.ai_score, sa.final_score, sa.ai_comment, sa.needs_review, sa.teacher_edited
     FROM exam_questions q
     JOIN exam_areas a ON q.area_id = a.id
     LEFT JOIN submission_answers sa ON sa.question_id = q.id AND sa.submission_id = $2
     WHERE a.exam_id = $1 ORDER BY a.order_no, q.question_no`,
    [examId, submissionId]
  );

  const detail: SubmissionDetail = {
    ...mapSubmission(row!),
    examId: String(examId),
    overallComment: row!.overall_comment ?? null,
    gradedAt: row!.graded_at ? new Date(row!.graded_at).toISOString() : null,
    aiModel: row!.ai_model ?? null,
    areas: areas.map((a) => ({
      areaId: String(a.id),
      name: a.name,
      maxScore: Number(a.max_score),
      score: num(a.score),
      aiComment: a.ai_comment,
      finalComment: a.final_comment,
    })),
    answers: answers.map((q) => ({
      questionId: String(q.question_id),
      areaId: String(q.area_id),
      questionNo: q.question_no,
      questionType: q.question_type,
      label: q.label ?? '',
      maxScore: Number(q.max_score),
      answerKey: q.answer_key ?? '',
      studentAnswer: q.student_answer,
      aiScore: num(q.ai_score),
      finalScore: num(q.final_score),
      aiComment: q.ai_comment,
      needsReview: !!q.needs_review,
      teacherEdited: !!q.teacher_edited,
    })),
  };
  return NextResponse.json({ success: true, data: detail });
}

/**
 * DELETE /api/grading/submissions/[id]
 * 학생 답안지(제출본) 삭제 - 스캔 파일과 채점 결과도 함께 삭제
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<null>>> {
  const session = await auth();
  const { id } = await params;
  const submissionId = Number(id);
  const examId = Number.isFinite(submissionId) ? await getSubmissionExamId(submissionId) : null;
  if (!examId) {
    return NextResponse.json({ success: false, error: '답안지를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!(await canManageExam(session, examId))) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }
  const row = await queryOne<{ scan_image_urls: string[] }>(
    'DELETE FROM submissions WHERE id = $1 RETURNING scan_image_urls',
    [submissionId]
  );
  await Promise.all((row?.scan_image_urls || []).map((u) => removeStoredFile(u)));
  return NextResponse.json({ success: true, data: null });
}

interface PatchBody {
  /** 문항별 최종 점수 (선생님 채점 Speaking, AI 점수 수정 모두 여기로) - null이면 점수 비움 */
  answers?: { questionId: string; finalScore: number | null }[];
  /** 영역별 코멘트 (선생님이 고친 최종 코멘트, 영어) */
  areaComments?: { areaId: string; comment: string }[];
  overallComment?: string;
  /** true면 저장 후 검수완료 처리 (모든 문항 점수가 있어야 함) */
  markReviewed?: boolean;
}

/**
 * PATCH /api/grading/submissions/[id]
 * 선생님 점수 입력/수정 + 코멘트 수정 + 검수완료 처리 - 관리자, 해당 시험 담당 선생님
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ status: string; totalScore: number | null }>>> {
  const session = await auth();
  const { id } = await params;
  const submissionId = Number(id);
  const examId = Number.isFinite(submissionId) ? await getSubmissionExamId(submissionId) : null;
  const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
  if (!examId) return fail('답안지를 찾을 수 없습니다.', 404);
  if (!(await canManageExam(session, examId))) return fail('접근 권한이 없습니다.', 403);

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return fail('잘못된 요청입니다.');
  }

  const questions = await query<{ id: number; area_id: number; max_score: string; label: string | null; question_no: number; area_name: string }>(
    `SELECT q.id, q.area_id, q.max_score, q.label, q.question_no, a.name AS area_name
     FROM exam_questions q JOIN exam_areas a ON q.area_id = a.id WHERE a.exam_id = $1`,
    [examId]
  );
  const qById = new Map(questions.map((q) => [String(q.id), q]));
  const areaIds = new Set(questions.map((q) => String(q.area_id)));

  // 점수 검증 (0 ~ 배점, 0.5점 단위)
  const updates: { qid: number; score: number | null }[] = [];
  for (const a of body.answers || []) {
    const q = qById.get(String(a.questionId));
    if (!q) return fail('이 시험에 없는 문항이 포함되어 있습니다.');
    if (a.finalScore === null || a.finalScore === undefined || (a.finalScore as unknown) === '') {
      updates.push({ qid: q.id, score: null });
      continue;
    }
    const n = Number(a.finalScore);
    const max = Number(q.max_score);
    if (!Number.isFinite(n) || n < 0 || n > max) {
      return fail(`${q.area_name} ${q.question_no}${q.label ? ` (${q.label})` : ''}: 0 ~ ${max}점 사이로 입력해주세요.`);
    }
    updates.push({ qid: q.id, score: Math.round(n * 2) / 2 });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const u of updates) {
      await client.query(
        `INSERT INTO submission_answers (submission_id, question_id, final_score, teacher_edited, needs_review)
         VALUES ($1, $2, $3, TRUE, FALSE)
         ON CONFLICT (submission_id, question_id) DO UPDATE SET
           final_score = EXCLUDED.final_score,
           teacher_edited = (submission_answers.ai_score IS DISTINCT FROM EXCLUDED.final_score) OR submission_answers.teacher_edited,
           needs_review = FALSE`,
        [submissionId, u.qid, u.score]
      );
    }

    // 영역 점수 다시 합산 + 코멘트 저장
    const comments = new Map((body.areaComments || []).filter((c) => areaIds.has(String(c.areaId))).map((c) => [String(c.areaId), String(c.comment ?? '').slice(0, 4000)]));
    const areas = await client.query<{ id: number; max_score: string }>('SELECT id, max_score FROM exam_areas WHERE exam_id = $1', [examId]);
    for (const area of areas.rows) {
      const sum = await client.query<{ score: string | null }>(
        `SELECT SUM(sa.final_score) AS score FROM submission_answers sa JOIN exam_questions q ON sa.question_id = q.id
         WHERE sa.submission_id = $1 AND q.area_id = $2`,
        [submissionId, area.id]
      );
      const hasComment = comments.has(String(area.id));
      await client.query(
        `INSERT INTO submission_area_results (submission_id, area_id, score, max_score, final_comment)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (submission_id, area_id) DO UPDATE SET
           score = EXCLUDED.score, max_score = EXCLUDED.max_score,
           final_comment = CASE WHEN $6 THEN EXCLUDED.final_comment ELSE submission_area_results.final_comment END`,
        [submissionId, area.id, sum.rows[0].score, area.max_score, hasComment ? comments.get(String(area.id)) || null : null, hasComment]
      );
    }

    const total = await client.query<{ total: string | null }>(
      'SELECT SUM(final_score) AS total FROM submission_answers WHERE submission_id = $1',
      [submissionId]
    );
    await client.query(
      `UPDATE submissions SET total_score = $2, updated_at = NOW(),
         overall_comment = CASE WHEN $3::text IS NULL THEN overall_comment ELSE $3 END
       WHERE id = $1`,
      [submissionId, total.rows[0].total, body.overallComment === undefined ? null : String(body.overallComment).slice(0, 4000)]
    );

    if (body.markReviewed) {
      const missing = await client.query<{ area_name: string; question_no: number; label: string | null }>(
        `SELECT a.name AS area_name, q.question_no, q.label FROM exam_questions q
         JOIN exam_areas a ON q.area_id = a.id
         LEFT JOIN submission_answers sa ON sa.question_id = q.id AND sa.submission_id = $2
         WHERE a.exam_id = $1 AND sa.final_score IS NULL ORDER BY a.order_no, q.question_no`,
        [examId, submissionId]
      );
      if (missing.rows.length > 0) {
        await client.query('ROLLBACK');
        const list = missing.rows.slice(0, 6).map((m) => `${m.area_name} ${m.label || m.question_no}`).join(', ');
        return fail(`점수가 비어 있는 문항이 ${missing.rows.length}개 있습니다: ${list}${missing.rows.length > 6 ? ' 등' : ''}`);
      }
      await client.query(
        `UPDATE submissions SET status = 'reviewed', reviewed_by = $2, reviewed_at = NOW() WHERE id = $1`,
        [submissionId, Number(session!.user.id)]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update submission error:', error);
    return fail('저장할 수 없습니다.', 500);
  } finally {
    client.release();
  }

  const row = await queryOne<{ status: string; total_score: string | null }>(
    'SELECT status, total_score FROM submissions WHERE id = $1',
    [submissionId]
  );
  return NextResponse.json({ success: true, data: { status: row!.status, totalScore: num(row!.total_score) } });
}
