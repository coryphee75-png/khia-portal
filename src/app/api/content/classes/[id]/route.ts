import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { canManageClass } from '@/lib/permissions';
import { ApiResponse } from '@/types';
import {
  ChildRow,
  HomeworkRow,
  NoteRow,
  EvaluationRow,
  AlbumRow,
  AlbumImageRow,
  mapChild,
  mapHomework,
  mapNote,
  mapEvaluation,
  mapAlbum,
} from '@/lib/mappers';

export interface ManageChild {
  id: string;
  name: string;
  grade: number;
  classNumber: string;
  homeworks: ReturnType<typeof mapHomework>[];
  notes: ReturnType<typeof mapNote>[];
  evaluations: ReturnType<typeof mapEvaluation>[];
  albums: ReturnType<typeof mapAlbum>[];
}

export interface ManageClassData {
  id: string;
  name: string;
  grade: number;
  children: ManageChild[];
}

/**
 * GET /api/content/classes/[id]
 * 반 콘텐츠 관리 화면용 데이터 (반의 학생별 숙제/수업일지/평가/앨범 전체) - admin 또는 담당 선생님 전용
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<ManageClassData>>> {
  const session = await auth();
  const { id } = await params;
  const classId = Number(id);

  if (!Number.isFinite(classId)) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const allowed = await canManageClass(session, classId);
  if (!allowed) {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const classRow = await queryOne<{ id: number; name: string; grade: number }>(
    'SELECT id, name, grade FROM classes WHERE id = $1',
    [classId]
  );

  if (!classRow) {
    return NextResponse.json({ success: false, error: '반을 찾을 수 없습니다.' }, { status: 404 });
  }

  const childRows = await query<ChildRow>(
    'SELECT * FROM children WHERE class_id = $1 ORDER BY id',
    [classId]
  );

  const childIds = childRows.map((c) => c.id);

  const [homeworkRows, noteRows, evaluationRows, albumRows] = childIds.length
    ? await Promise.all([
        query<HomeworkRow>(
          'SELECT * FROM homeworks WHERE child_id = ANY($1::int[]) ORDER BY due_date DESC',
          [childIds]
        ),
        query<NoteRow>('SELECT * FROM notes WHERE child_id = ANY($1::int[]) ORDER BY date DESC', [
          childIds,
        ]),
        query<EvaluationRow>(
          'SELECT * FROM evaluations WHERE child_id = ANY($1::int[]) ORDER BY date DESC',
          [childIds]
        ),
        query<AlbumRow>(
          'SELECT * FROM albums WHERE child_id = ANY($1::int[]) ORDER BY event_date DESC',
          [childIds]
        ),
      ])
    : [[], [], [], []];

  const albumIds = albumRows.map((a) => a.id);
  const imageRows = albumIds.length
    ? await query<AlbumImageRow>(
        'SELECT * FROM album_images WHERE album_id = ANY($1::int[]) ORDER BY id',
        [albumIds]
      )
    : [];

  const children: ManageChild[] = childRows.map((child) => {
    const base = mapChild(child);
    return {
      id: base.id,
      name: base.name,
      grade: base.grade,
      classNumber: base.classNumber,
      homeworks: homeworkRows.filter((h) => h.child_id === child.id).map(mapHomework),
      notes: noteRows.filter((n) => n.child_id === child.id).map(mapNote),
      evaluations: evaluationRows.filter((e) => e.child_id === child.id).map(mapEvaluation),
      albums: albumRows
        .filter((a) => a.child_id === child.id)
        .map((a) => mapAlbum(a, imageRows.filter((img) => img.album_id === a.id))),
    };
  });

  return NextResponse.json({
    success: true,
    data: { id: String(classRow.id), name: classRow.name, grade: classRow.grade, children },
  });
}
