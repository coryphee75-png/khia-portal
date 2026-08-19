import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { ApiResponse } from '@/types';
import bcrypt from 'bcryptjs';
import { BRANCHES, Branch } from '../route';

export interface AdminUserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: Branch | null;
}

// 관리자 계정은 이 화면에서 수정하지 않음 (실수로 자기 자신/다른 관리자 계정을 잠그는 것 방지)
const EDITABLE_ROLES = ['teacher', 'parent', 'student'];

/**
 * PATCH /api/admin/users/[id]
 * 선생님/학부모/학생 계정 수정 - 관리자 전용
 * 비밀번호를 잃어버린 경우 관리자가 대신 새 비밀번호로 재설정할 수 있고, 이름/아이디도 고칠 수 있음.
 * body: { name?, email?, password? } - 최소 하나는 있어야 함
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<AdminUserInfo>>> {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const existing = await queryOne<{ id: number; role: string }>(
    'SELECT id, role FROM users WHERE id = $1',
    [userId]
  );
  if (!existing) {
    return NextResponse.json({ success: false, error: '계정을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!EDITABLE_ROLES.includes(existing.role)) {
    return NextResponse.json({ success: false, error: '이 화면에서는 수정할 수 없는 계정입니다.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : undefined;
    const password = body.password !== undefined ? String(body.password) : undefined;
    // 지점은 선생님 계정에만 의미가 있음 - 다른 역할 계정에 지점 값을 보내면 무시하지 않고 명확히 거부함
    let branch: Branch | undefined;
    if (body.branch !== undefined) {
      if (existing.role !== 'teacher') {
        return NextResponse.json(
          { success: false, error: '선생님 계정에만 지점을 지정할 수 있습니다.' },
          { status: 400 }
        );
      }
      branch = body.branch as Branch;
      if (!BRANCHES.includes(branch)) {
        return NextResponse.json({ success: false, error: '유효하지 않은 지점입니다.' }, { status: 400 });
      }
    }

    if (name === undefined && email === undefined && password === undefined && branch === undefined) {
      return NextResponse.json({ success: false, error: '변경할 내용이 없습니다.' }, { status: 400 });
    }
    if (name !== undefined && !name) {
      return NextResponse.json({ success: false, error: '이름을 입력해주세요.' }, { status: 400 });
    }
    if (email !== undefined) {
      if (!email) {
        return NextResponse.json({ success: false, error: '아이디를 입력해주세요.' }, { status: 400 });
      }
      const dup = await queryOne<{ id: number }>('SELECT id FROM users WHERE email = $1 AND id != $2', [
        email,
        userId,
      ]);
      if (dup) {
        return NextResponse.json({ success: false, error: '이미 사용 중인 아이디입니다.' }, { status: 400 });
      }
    }
    if (password !== undefined && password.length < 4) {
      return NextResponse.json({ success: false, error: '비밀번호는 4자 이상이어야 합니다.' }, { status: 400 });
    }

    const sets: string[] = [];
    const values: (string | number)[] = [];
    let idx = 1;
    if (name !== undefined) {
      sets.push(`name = $${idx++}`);
      values.push(name);
    }
    if (email !== undefined) {
      sets.push(`email = $${idx++}`);
      values.push(email);
    }
    if (password !== undefined) {
      const passwordHash = await bcrypt.hash(password, 10);
      sets.push(`password_hash = $${idx++}`);
      values.push(passwordHash);
    }
    if (branch !== undefined) {
      sets.push(`branch = $${idx++}`);
      values.push(branch);
    }
    sets.push(`updated_at = NOW()`);
    values.push(userId);

    await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`, values);

    const row = await queryOne<{ id: number; name: string; email: string; role: string; branch: Branch | null }>(
      'SELECT id, name, email, role, branch FROM users WHERE id = $1',
      [userId]
    );
    return NextResponse.json({
      success: true,
      data: { id: String(row!.id), name: row!.name, email: row!.email, role: row!.role, branch: row!.branch },
    });
  } catch (error) {
    console.error('Admin update user error:', error);
    return NextResponse.json({ success: false, error: '계정을 수정할 수 없습니다.' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id]
 * 선생님/학부모/학생 계정 삭제 - 관리자 전용
 * - 선생님: classes.teacher_id가 자동으로 미배정 처리됨(ON DELETE SET NULL) - 반과 학생 기록은 그대로 유지.
 * - 학부모: 먼저 연결된 자녀들의 parent_id를 NULL로 풀어준 뒤 계정을 삭제함 - 학생 기록은 삭제되지 않고
 *   "회원가입 대기 중" 상태로 남아 기존 학번/코드로 다시 학부모를 연결할 수 있음(children.parent_id의
 *   기본 ON DELETE CASCADE로 인해 학생까지 함께 지워지는 것을 막기 위한 의도적인 처리).
 * - 학생(로그인 계정만): children.student_user_id가 자동으로 NULL 처리됨(ON DELETE SET NULL) - 학생 정보/
 *   기록은 그대로 유지되고 로그인만 불가능해짐. (학생 정보 자체를 지우려면 /api/admin/children/[id] 사용)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  const session = await auth();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ success: false, error: '접근 권한이 없습니다.' }, { status: 403 });
  }

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ success: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const existing = await queryOne<{ id: number; role: string }>(
    'SELECT id, role FROM users WHERE id = $1',
    [userId]
  );
  if (!existing) {
    return NextResponse.json({ success: false, error: '계정을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!EDITABLE_ROLES.includes(existing.role)) {
    return NextResponse.json({ success: false, error: '이 화면에서는 삭제할 수 없는 계정입니다.' }, { status: 403 });
  }

  try {
    if (existing.role === 'parent') {
      await query('UPDATE children SET parent_id = NULL WHERE parent_id = $1', [userId]);
    }
    await query('DELETE FROM users WHERE id = $1', [userId]);
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Admin delete user error:', error);
    return NextResponse.json({ success: false, error: '계정을 삭제할 수 없습니다.' }, { status: 500 });
  }
}
