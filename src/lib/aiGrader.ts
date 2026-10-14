/**
 * AI 1차 채점 (서버 전용)
 * - 학생 답안지 스캔(PDF/이미지) + 시험 정답/루브릭을 Claude에 보내 문항별 점수·피드백(영어)을 받음
 * - "선생님 채점(teacher)" 유형(예: Speaking)은 AI가 채점하지 않음
 * - 결과는 항상 선생님 검수 전 1차 결과(status = ai_graded)로 저장
 *
 * 필요한 환경변수: ANTHROPIC_API_KEY (필수), ANTHROPIC_MODEL (선택, 기본 claude-sonnet-5-5)
 */
import { readFile } from 'fs/promises';
import path from 'path';
import { getClient, query, queryOne } from './db';
import { getFileExtension, QuestionType, SCAN_FILE_TYPES } from './grading';
import { GRADING_SYSTEM_PROMPT } from './gradingPrompt';

const API_URL = `${process.env.GRADING_API_BASE_URL || 'https://api.anthropic.com'}/v1/messages`;
export const DEFAULT_GRADING_MODEL = 'claude-sonnet-5-5';

interface QuestionInfo {
  id: number;
  area_id: number;
  area_name: string;
  question_no: number;
  max_score: string;
  question_type: QuestionType;
  label: string | null;
  answer_key: string | null;
  rubric_text: string | null;
}

interface AreaInfo {
  id: number;
  name: string;
  max_score: string;
}

interface AiQuestionResult {
  questionId: string;
  studentAnswer?: string;
  score: number;
  feedback?: string;
  needsReview?: boolean;
}

interface AiResult {
  questions: AiQuestionResult[];
  areas: { areaId: string; comment: string }[];
  overallComment: string;
}

export class GradingError extends Error {}

/** 스캔 파일 1개를 Claude 입력 블록으로 변환 (PDF → document, 이미지 → image) */
async function scanToBlock(url: string, fileName: string): Promise<Record<string, unknown>> {
  const ext = getFileExtension(fileName) || getFileExtension(url);
  const mediaType = SCAN_FILE_TYPES[ext];
  if (!mediaType) throw new GradingError(`지원하지 않는 답안지 형식입니다: ${fileName}`);

  let data: Buffer;
  if (url.startsWith('/uploads/') && !url.includes('..')) {
    data = await readFile(path.join(process.cwd(), 'public', url));
  } else {
    const res = await fetch(url);
    if (!res.ok) throw new GradingError(`답안지 파일을 불러올 수 없습니다: ${fileName}`);
    data = Buffer.from(await res.arrayBuffer());
  }

  if (mediaType === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: mediaType, data: data.toString('base64') } };
  }

  // 휴대폰 사진(장당 4~5MB)을 그대로 보내면 요청 크기 한도(32MB)를 넘으므로
  // 긴 변 1800px JPEG로 줄여서 보냄 (손글씨 판독에는 충분한 해상도, 장당 약 0.3~0.6MB)
  const resized = await shrinkImage(data);
  return {
    type: 'image',
    source: {
      type: 'base64',
      media_type: resized ? 'image/jpeg' : mediaType,
      data: (resized ?? data).toString('base64'),
    },
  };
}

const MAX_IMAGE_EDGE = 1800;

async function shrinkImage(data: Buffer): Promise<Buffer | null> {
  try {
    const sharp = (await import('sharp')).default;
    return await sharp(data)
      .rotate() // 휴대폰 사진 방향(EXIF) 바로잡기
      .resize({ width: MAX_IMAGE_EDGE, height: MAX_IMAGE_EDGE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch (error) {
    console.warn('Image resize skipped (sharp unavailable):', error);
    return null;
  }
}

/** base64 블록 크기 합계 (요청 한도 확인용) */
function payloadBytes(content: Record<string, unknown>[]): number {
  return content.reduce((sum, block) => {
    const src = (block as { source?: { data?: string } }).source;
    return sum + (src?.data ? src.data.length : 0);
  }, 0);
}

const MAX_PAYLOAD_BYTES = 28 * 1024 * 1024;

function describeExam(title: string, areas: AreaInfo[], questions: QuestionInfo[]): string {
  const lines: string[] = [`EXAM: ${title}`, ''];
  for (const area of areas) {
    const qs = questions.filter((q) => q.area_id === area.id);
    const aiQs = qs.filter((q) => q.question_type !== 'teacher');
    lines.push(`## AREA "${area.name}" (areaId: ${area.id}, max ${Number(area.max_score)})`);
    if (aiQs.length === 0) {
      lines.push('Scored live by the teacher. Do NOT grade this area and do NOT write a comment for it.', '');
      continue;
    }
    for (const q of aiQs) {
      const name = q.label ? `${q.question_no} (${q.label})` : `${q.question_no}`;
      lines.push(
        `- questionId: ${q.id} | ${area.name} Q${name} | type: ${q.question_type} | max: ${Number(q.max_score)}` +
          (q.answer_key ? ` | answer key: ${q.answer_key}` : '') +
          (q.rubric_text ? `\n  rubric: ${q.rubric_text}` : '')
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}

const SUBMIT_TOOL = {
  name: 'submit_grades',
  description: 'Submit the grading result for this student exam.',
  input_schema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            questionId: { type: 'string' },
            studentAnswer: { type: 'string', description: 'What the student wrote/marked, transcribed. Empty if blank.' },
            score: { type: 'number' },
            feedback: { type: 'string', description: 'Short feedback in English (1 sentence).' },
            needsReview: { type: 'boolean', description: 'true if the mark/handwriting is unclear and the teacher must check.' },
          },
          required: ['questionId', 'score'],
        },
      },
      areas: {
        type: 'array',
        items: {
          type: 'object',
          properties: { areaId: { type: 'string' }, comment: { type: 'string' } },
          required: ['areaId', 'comment'],
        },
      },
      overallComment: { type: 'string' },
    },
    required: ['questions', 'areas', 'overallComment'],
  },
};

async function callClaude(content: Record<string, unknown>[]): Promise<{ result: AiResult; model: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new GradingError('ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local(배포: Vercel 환경변수)에 키를 넣고 서버를 다시 시작하세요.');
  }
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_GRADING_MODEL;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      system:
        GRADING_SYSTEM_PROMPT +
        '\n\nWhen you are done, call the submit_grades tool exactly once with the full result (instead of writing JSON as text).',
      tools: [SUBMIT_TOOL],
      messages: [{ role: 'user', content }],
    }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error?.message || res.statusText;
    if (res.status === 401) throw new GradingError('API 키가 올바르지 않습니다. .env.local의 ANTHROPIC_API_KEY를 확인하세요.');
    if (res.status === 400 && /credit|billing|balance/i.test(msg)) {
      throw new GradingError('Anthropic 계정 크레딧이 부족합니다. Claude Console → Billing에서 충전해주세요.');
    }
    throw new GradingError(`AI 채점 요청 실패 (${res.status}): ${msg}`);
  }

  const blocks: { type: string; name?: string; input?: unknown; text?: string }[] = body?.content || [];
  const toolUse = blocks.find((b) => b.type === 'tool_use' && b.name === 'submit_grades');
  if (toolUse?.input) return { result: toolUse.input as AiResult, model };

  // 도구 대신 텍스트로 JSON을 준 경우 대비
  const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return { result: JSON.parse(match[0]) as AiResult, model };
    } catch {
      /* fall through */
    }
  }
  throw new GradingError('AI 응답을 해석할 수 없습니다. 다시 시도해주세요.');
}

function clampScore(value: unknown, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(0, Math.round(n * 2) / 2));
}

/**
 * 제출본 1건을 AI로 채점하고 DB에 저장
 * - 선생님이 이미 고친 점수(teacher_edited)와 선생님 채점 문항은 덮어쓰지 않음
 */
export async function gradeSubmission(submissionId: number): Promise<void> {
  const sub = await queryOne<{
    id: number;
    exam_id: number;
    student_name: string;
    scan_image_urls: string[];
    scan_file_names: string[];
    exam_title: string;
  }>(
    `SELECT s.id, s.exam_id, s.student_name, s.scan_image_urls, s.scan_file_names, e.title AS exam_title
     FROM submissions s JOIN exams e ON s.exam_id = e.id WHERE s.id = $1`,
    [submissionId]
  );
  if (!sub) throw new GradingError('답안지를 찾을 수 없습니다.');
  if (!sub.scan_image_urls?.length) throw new GradingError('답안지 파일이 없습니다.');

  const areas = await query<AreaInfo>(
    'SELECT id, name, max_score FROM exam_areas WHERE exam_id = $1 ORDER BY order_no, id',
    [sub.exam_id]
  );
  const questions = await query<QuestionInfo>(
    `SELECT q.id, q.area_id, a.name AS area_name, q.question_no, q.max_score, q.question_type, q.label,
            q.answer_key, q.rubric_text
     FROM exam_questions q JOIN exam_areas a ON q.area_id = a.id
     WHERE a.exam_id = $1 ORDER BY a.order_no, q.question_no`,
    [sub.exam_id]
  );
  const aiQuestions = questions.filter((q) => q.question_type !== 'teacher');
  if (aiQuestions.length === 0) throw new GradingError('AI가 채점할 문항이 없습니다. (모두 선생님 채점 문항)');

  try {
    const content: Record<string, unknown>[] = [];
    for (let i = 0; i < sub.scan_image_urls.length; i++) {
      content.push({ type: 'text', text: `Scanned page ${i + 1} of the student's answer sheet:` });
      content.push(await scanToBlock(sub.scan_image_urls[i], sub.scan_file_names?.[i] || ''));
    }
    if (payloadBytes(content) > MAX_PAYLOAD_BYTES) {
      throw new GradingError(
        '답안지 파일이 너무 커서 AI에 보낼 수 없습니다. 사진으로 올리거나, PDF는 해상도를 낮춰(예: 150dpi) 다시 올려주세요.'
      );
    }
    content.push({
      type: 'text',
      text:
        describeExam(sub.exam_title, areas, questions) +
        '\nGrade every question listed above that has a questionId (one result per questionId). ' +
        'Write one comment per graded area (skip teacher-scored areas) and an overall comment. ' +
        'All feedback and comments must be in English.',
    });

    const { result, model } = await callClaude(content);

    const byId = new Map<string, AiQuestionResult>();
    for (const r of result.questions || []) byId.set(String(r.questionId), r);
    const areaComments = new Map<string, string>();
    for (const a of result.areas || []) areaComments.set(String(a.areaId), String(a.comment || ''));

    const client = await getClient();
    try {
      await client.query('BEGIN');
      for (const q of aiQuestions) {
        const r = byId.get(String(q.id));
        const max = Number(q.max_score);
        const score = r ? clampScore(r.score, max) : 0;
        const feedback = r ? String(r.feedback || '') : 'Not graded by AI - please check this item.';
        const needsReview = r ? !!r.needsReview : true;
        await client.query(
          `INSERT INTO submission_answers
             (submission_id, question_id, student_answer, ai_score, final_score, ai_comment, needs_review)
           VALUES ($1, $2, $3, $4, $4, $5, $6)
           ON CONFLICT (submission_id, question_id) DO UPDATE SET
             student_answer = EXCLUDED.student_answer,
             ai_score = EXCLUDED.ai_score,
             ai_comment = EXCLUDED.ai_comment,
             needs_review = EXCLUDED.needs_review,
             final_score = CASE WHEN submission_answers.teacher_edited
                                THEN submission_answers.final_score ELSE EXCLUDED.final_score END`,
          [submissionId, q.id, r?.studentAnswer ? String(r.studentAnswer).slice(0, 2000) : null, score, feedback, needsReview]
        );
      }

      for (const area of areas) {
        const sum = await client.query<{ score: string | null }>(
          `SELECT SUM(sa.final_score) AS score FROM submission_answers sa
           JOIN exam_questions q ON sa.question_id = q.id
           WHERE sa.submission_id = $1 AND q.area_id = $2`,
          [submissionId, area.id]
        );
        await client.query(
          `INSERT INTO submission_area_results (submission_id, area_id, score, max_score, ai_comment)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (submission_id, area_id) DO UPDATE SET
             score = EXCLUDED.score, max_score = EXCLUDED.max_score, ai_comment = EXCLUDED.ai_comment`,
          [submissionId, area.id, sum.rows[0].score, area.max_score, areaComments.get(String(area.id)) || null]
        );
      }

      const total = await client.query<{ total: string | null }>(
        'SELECT SUM(final_score) AS total FROM submission_answers WHERE submission_id = $1',
        [submissionId]
      );
      await client.query(
        `UPDATE submissions SET status = 'ai_graded', total_score = $2, overall_comment = $3,
           graded_at = NOW(), ai_model = $4, ai_error = NULL, updated_at = NOW()
         WHERE id = $1`,
        [submissionId, total.rows[0].total, String(result.overallComment || ''), model]
      );
      await client.query('COMMIT');
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await query('UPDATE submissions SET ai_error = $2, updated_at = NOW() WHERE id = $1', [
      submissionId,
      message.slice(0, 1000),
    ]);
    throw error;
  }
}

/**
 * 선생님이 채점한 영역(예: Speaking)의 영어 코멘트를 점수와 메모로 생성
 * - 답안지 이미지 없이 텍스트만 보내므로 빠르고 저렴함
 */
export async function generateAreaComment(input: {
  studentName: string;
  areaName: string;
  items: { label: string; score: number | null; maxScore: number; rubric: string }[];
  notes?: string;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new GradingError('ANTHROPIC_API_KEY가 설정되지 않았습니다.');
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_GRADING_MODEL;

  const lines = input.items
    .map((i) => `- ${i.label}: ${i.score ?? 'not scored'} / ${i.maxScore}${i.rubric ? ` (rubric: ${i.rubric})` : ''}`)
    .join('\n');
  const prompt =
    `Write the "${input.areaName}" comment for ${input.studentName}'s English placement test report.\n` +
    `Scores given by the teacher:\n${lines}\n` +
    (input.notes?.trim() ? `Teacher's notes (may be in Korean - use the meaning, write only English):\n${input.notes.trim()}\n` : '') +
    'Write 2-3 sentences in English for parents: one concrete strength and one or two concrete next steps, ' +
    'consistent with the scores. Warm and specific. Do not mention numbers or the rubric. Output only the comment text.';

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new GradingError(`AI 코멘트 생성 실패 (${res.status}): ${body?.error?.message || res.statusText}`);
  const text = (body?.content || [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n')
    .trim();
  if (!text) throw new GradingError('AI가 코멘트를 만들지 못했습니다. 다시 시도해주세요.');
  return text;
}
