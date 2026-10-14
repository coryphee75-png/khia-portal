import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getClient, query, queryOne } from '@/lib/db';
import { ApiResponse } from '@/types';
import {
  Branch,
  CreateExamInput,
  ExamSummary,
  ExamType,
  isGradingStaff,
  QUESTION_TYPES,
  QuestionType,
} from '@/lib/grading';
import { EXAM_SUMMARY_SELECT, ExamSummaryRow, mapExamSummary } from '@/lib/gradingQueries';
import { canManageClass } from '@/lib/permissions';

const BRANCHES: Branch[] = ['Sejong', 'Gwangyo'];
const EXAM_TYPES: ExamType[] = ['placement', 'regular'];

/**
 * GET /api/grading/exams
 * 시험 목록 - 관리자: 전체(?branch= 필터 가능), 선생님: 본인이 만든 시험 + 담당 반 시험
 */
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<ExamSummary[]>>> {
  const session = await auth();
  if (!isGradingStaff(session)) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  try {
    const branch = req.nextUrl.searchParams.get('branch');
    const conditions: string[] = [];
    const values: (string | number)[] = [];

    if (session!.user.role === 'teacher') {
      values.push(Number(session!.user.id));
      conditions.push(`(e.created_by = $${values.length} OR cl.teacher_id = $${values.length})`);
    }
    if (branch && BRANCHES.includes(branch as Branch)) {
      values.push(branch);
      conditions.push(`e.branch = $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await query<ExamSummaryRow>(
      `${EXAM_SUMMARY_SELECT} ${where} ORDER BY e.exam_date DESC NULLS LAST, e.created_at DESC`,
      values
    );

    return NextResponse.json({ success: true, data: rows.map(mapExamSummary) });
  } catch (error) {
    console.error('List exams error:', error);
    return NextResponse.json(
      { success: false, error: '시험 목록을 불러올 수 없습니다. (DB 마이그레이션 실행 여부를 확인하세요)' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/grading/exams
 * 시험 생성 (영역/문항 함께) - 관리자, 선생님
 * - 정기시험(regular): classId 필수, 지점은 반의 지점을 그대로 사용. 선생님은 담당 반만 가능
 * - 배치고사(placement): classId 없이 branch만 지정
 */
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  const session = await auth();
  if (!isGradingStaff(session)) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  let body: CreateExamInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const title = String(body.title || '').trim();
  const examType = body.examType;
  const examDate = body.examDate ? String(body.examDate).slice(0, 10) : null;

  if (!title) {
    return NextResponse.json({ success: false, error: '시험 이름을 입력해주세요.' }, { status: 400 });
  }
  if (!EXAM_TYPES.includes(examType)) {
    return NextResponse.json({ success: false, error: '시험 종류를 선택해주세요.' }, { status: 400 });
  }

  // 영역/문항 검증
  const areas = Array.isArray(body.areas) ? body.areas : [];
  const cleanAreas = areas
    .map((a) => ({
      name: String(a?.name || '').trim(),
      questions: (Array.isArray(a?.questions) ? a.questions : []).map((q) => ({
        maxScore: Number(q?.maxScore),
        questionType: (QUESTION_TYPES.includes(q?.questionType as QuestionType)
          ? q!.questionType
          : 'choice') as QuestionType,
        label: String(q?.label ?? '').trim().slice(0, 100),
        answerKey: String(q?.answerKey ?? '').trim(),
        rubricText: String(q?.rubricText ?? '').trim(),
      })),
    }))
    .filter((a) => a.name);

  if (cleanAreas.length === 0) {
    return NextResponse.json({ success: false, error: '영역을 1개 이상 입력해주세요.' }, { status: 400 });
  }
  for (const a of cleanAreas) {
    if (a.questions.length === 0) {
      return NextResponse.json(
        { success: false, error: `"${a.name}" 영역에 문항을 1개 이상 추가해주세요.` },
        { status: 400 }
      );
    }
    if (a.questions.some((q) => !Number.isFinite(q.maxScore) || q.maxScore <= 0)) {
      return NextResponse.json(
        { success: false, error: `"${a.name}" 영역의 문항 배점은 0보다 커야 합니다.` },
        { status: 400 }
      );
    }
  }

  // 반 / 지점 결정
  let classId: number | null = null;
  let branch: Branch;
  if (examType === 'regular') {
    classId = Number(body.classId);
    if (!Number.isFinite(classId) || classId <= 0) {
      return NextResponse.json({ success: false, error: '정기시험은 반을 선택해주세요.' }, { status: 400 });
    }
    if (!(await canManageClass(session, classId))) {
      return NextResponse.json({ success: false, error: '담당 반의 시험만 만들 수 있습니다.' }, { status: 403 });
    }
    const cls = await queryOne<{ branch: Branch }>('SELECT branch FROM classes WHERE id = $1', [classId]);
    if (!cls) {
      return NextResponse.json({ success: false, error: '반을 찾을 수 없습니다.' }, { status: 404 });
    }
    branch = cls.branch;
  } else {
    if (!BRANCHES.includes(body.branch as Branch)) {
      return NextResponse.json({ success: false, error: '배치고사 지점을 선택해주세요.' }, { status: 400 });
    }
    branch = body.branch as Branch;
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const exam = await client.query<{ id: number }>(
      `INSERT INTO exams (title, exam_type, class_id, branch, exam_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [title, examType, classId, branch, examDate, Number(session!.user.id)]
    );
    const examId = exam.rows[0].id;

    for (let i = 0; i < cleanAreas.length; i++) {
      const a = cleanAreas[i];
      const areaMax = a.questions.reduce((sum, q) => sum + q.maxScore, 0);
      const area = await client.query<{ id: number }>(
        `INSERT INTO exam_areas (exam_id, name, max_score, order_no) VALUES ($1, $2, $3, $4) RETURNING id`,
        [examId, a.name, areaMax, i + 1]
      );
      const areaId = area.rows[0].id;
      for (let j = 0; j < a.questions.length; j++) {
        const q = a.questions[j];
        await client.query(
          `INSERT INTO exam_questions (area_id, question_no, max_score, question_type, label, answer_key, rubric_text)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [areaId, j + 1, q.maxScore, q.questionType, q.label || null, q.answerKey || null, q.rubricText || null]
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, data: { id: String(examId) } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create exam error:', error);
    return NextResponse.json({ success: false, error: '시험을 생성할 수 없습니다.' }, { status: 500 });
  } finally {
    client.release();
  }
}
