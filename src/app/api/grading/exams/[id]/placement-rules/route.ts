import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getClient, query } from '@/lib/db';
import { ApiResponse } from '@/types';
import { PlacementRule, PlacementSettings } from '@/lib/grading';
import { canManageExam, loadAllowedMisses, loadPlacementRules } from '@/lib/gradingQueries';

async function loadSettings(examId: number): Promise<PlacementSettings> {
  return { rules: await loadPlacementRules(examId), allowedMisses: await loadAllowedMisses(examId) };
}

async function check(params: Promise<{ id: string }>) {
  const session = await auth();
  const { id } = await params;
  const examId = Number(id);
  if (!Number.isFinite(examId) || !(await canManageExam(session, examId))) return null;
  return examId;
}

/**
 * GET /api/grading/exams/[id]/placement-rules
 * 반 배정 기준 목록 (위쪽 반부터 우선)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<PlacementSettings>>> {
  const examId = await check(params);
  if (!examId) return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  return NextResponse.json({ success: true, data: await loadSettings(examId) });
}

/**
 * PUT /api/grading/exams/[id]/placement-rules
 * 반 배정 기준 전체 저장 (보낸 순서 = 우선순위)
 * body: { rules: [{ className, minTotal, areaMins: { [areaId]: number } }] }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<PlacementSettings>>> {
  const examId = await check(params);
  const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
  if (!examId) return fail('접근 권한이 없습니다.', 403);

  let rules: PlacementRule[];
  let allowedMisses: number;
  try {
    const body = await req.json();
    rules = Array.isArray(body.rules) ? body.rules : [];
    allowedMisses = Math.max(0, Math.min(5, Math.floor(Number(body.allowedMisses ?? 1)) || 0));
  } catch {
    return fail('잘못된 요청입니다.');
  }

  const areas = await query<{ id: number; name: string; max_score: string }>(
    'SELECT id, name, max_score FROM exam_areas WHERE exam_id = $1',
    [examId]
  );
  const areaMax = new Map(areas.map((a) => [String(a.id), { name: a.name, max: Number(a.max_score) }]));
  const examMax = areas.reduce((s, a) => s + Number(a.max_score), 0);

  const clean: { className: string; minTotal: number | null; areaMins: Record<string, number> }[] = [];
  for (const r of rules) {
    const className = String(r.className || '').trim().slice(0, 100);
    if (!className) return fail('반 이름을 입력해주세요.');
    let minTotal: number | null = null;
    if (r.minTotal !== null && r.minTotal !== undefined && String(r.minTotal) !== '') {
      minTotal = Number(r.minTotal);
      if (!Number.isFinite(minTotal) || minTotal < 0 || minTotal > examMax) {
        return fail(`${className}: 총점 기준은 0 ~ ${examMax}점 사이로 입력해주세요.`);
      }
    }
    const areaMins: Record<string, number> = {};
    for (const [areaId, raw] of Object.entries(r.areaMins || {})) {
      if (raw === null || raw === undefined || String(raw) === '') continue;
      const a = areaMax.get(String(areaId));
      if (!a) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > a.max) {
        return fail(`${className}: ${a.name} 기준은 0 ~ ${a.max}점 사이로 입력해주세요.`);
      }
      areaMins[String(areaId)] = n;
    }
    clean.push({ className, minTotal, areaMins });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM exam_placement_rules WHERE exam_id = $1', [examId]);
    await client.query('UPDATE exams SET placement_allowed_misses = $2 WHERE id = $1', [examId, allowedMisses]);
    for (let i = 0; i < clean.length; i++) {
      const r = clean[i];
      await client.query(
        `INSERT INTO exam_placement_rules (exam_id, order_no, class_name, min_total, area_mins)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [examId, i + 1, r.className, r.minTotal, JSON.stringify(r.areaMins)]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Save placement rules error:', error);
    return fail('저장할 수 없습니다. (DB 마이그레이션 실행 여부를 확인하세요)', 500);
  } finally {
    client.release();
  }
  return NextResponse.json({ success: true, data: await loadSettings(examId) });
}
