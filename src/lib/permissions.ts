/**
 * 콘텐츠 관리 권한 체크 헬퍼
 * - admin: 모든 반/학생의 콘텐츠를 관리 가능
 * - teacher: 자신이 담당(classes.teacher_id)하는 반의 학생 콘텐츠만 관리 가능
 * - parent/student: 관리 권한 없음 (조회만 가능)
 */
import { Session } from 'next-auth';
import { queryOne } from './db';

type MinimalSession = Pick<Session, 'user'> | null | undefined;

/**
 * 특정 학생(child)의 콘텐츠(숙제/수업일지/평가/앨범)를 관리할 수 있는지 확인
 */
export async function canManageChild(
  session: MinimalSession,
  childId: number
): Promise<boolean> {
  if (!session?.user) return false;
  if (session.user.role === 'admin') return true;
  if (session.user.role !== 'teacher') return false;

  const row = await queryOne<{ teacher_id: number | null }>(
    `SELECT cl.teacher_id FROM children ch
     JOIN classes cl ON ch.class_id = cl.id
     WHERE ch.id = $1`,
    [childId]
  );

  return !!row && row.teacher_id !== null && String(row.teacher_id) === session.user.id;
}

/**
 * 특정 반(class)을 관리할 수 있는지 확인 (반 정보 수정, 학생 배정 등)
 */
export async function canManageClass(
  session: MinimalSession,
  classId: number
): Promise<boolean> {
  if (!session?.user) return false;
  if (session.user.role === 'admin') return true;
  if (session.user.role !== 'teacher') return false;

  const row = await queryOne<{ teacher_id: number | null }>(
    'SELECT teacher_id FROM classes WHERE id = $1',
    [classId]
  );

  return !!row && row.teacher_id !== null && String(row.teacher_id) === session.user.id;
}

export function isAdmin(session: MinimalSession): boolean {
  return session?.user?.role === 'admin';
}

/**
 * 특정 학생(child)의 콘텐츠를 "볼" 수 있는지 확인 (댓글 등 소통 기능용)
 * - admin: 전체 열람 가능
 * - teacher: 담당 반의 학생만 (canManageChild와 동일)
 * - parent: 자신의 자녀만 열람 가능
 */
export async function canAccessChild(
  session: MinimalSession,
  childId: number
): Promise<boolean> {
  if (!session?.user) return false;
  if (session.user.role === 'admin' || session.user.role === 'teacher') {
    return canManageChild(session, childId);
  }
  if (session.user.role === 'parent') {
    const row = await queryOne<{ parent_id: number | null }>(
      'SELECT parent_id FROM children WHERE id = $1',
      [childId]
    );
    return !!row && row.parent_id !== null && String(row.parent_id) === session.user.id;
  }
  return false;
}
