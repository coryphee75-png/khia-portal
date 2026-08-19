'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { getClassManageRoute } from '@/lib/constants';
import GreetingBanner from '@/components/common/GreetingBanner';
import styles from './page.module.css';

type Branch = 'Sejong' | 'Gwangyo';
const BRANCH_LABELS: Record<Branch, string> = {
  Sejong: 'Sejong Branch',
  Gwangyo: 'Gwangyo Branch',
};

interface AdminClassInfo {
  id: string;
  name: string;
  grade: number;
  branch: Branch;
  teacherId: string | null;
  teacherName: string | null;
  studentCount: number;
}

interface TeacherOption {
  id: string;
  name: string;
  email: string;
}

export default function AdminPage() {
  const { data: session } = useSession();
  const [classes, setClasses] = useState<AdminClassInfo[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newClass, setNewClass] = useState({ name: '', grade: '', branch: 'Sejong' as Branch, teacherId: '' });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', grade: '', branch: 'Sejong' as Branch, teacherId: '' });
  const [branchFilter, setBranchFilter] = useState<Branch | 'all'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [classesRes, teachersRes] = await Promise.all([
        fetch('/api/admin/classes'),
        fetch('/api/admin/teachers'),
      ]);
      const classesResult = await classesRes.json();
      const teachersResult = await teachersRes.json();
      if (!classesRes.ok || !classesResult.success) {
        throw new Error(classesResult?.error || '반 목록을 불러올 수 없습니다.');
      }
      setClasses(classesResult.data);
      setTeachers(teachersResult.success ? teachersResult.data : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createClass = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/admin/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClass),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '생성 실패');
      setNewClass({ name: '', grade: '', branch: 'Sejong', teacherId: '' });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (cls: AdminClassInfo) => {
    setEditingId(cls.id);
    setEditForm({ name: cls.name, grade: String(cls.grade), branch: cls.branch, teacherId: cls.teacherId || '' });
  };

  const saveEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/classes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '수정 실패');
      setEditingId(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했습니다.');
    }
  };

  if (loading) return <div className={styles.status}>로딩 중...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.page}>
      <GreetingBanner
        name={session?.user?.name || '관리자'}
        subtitle="반과 사용자를 관리하고 학원 소식을 확인해보세요."
      />
      <p className={styles.subtitle}>
        반을 만들고 담당 선생님을 배정하세요. 배정된 선생님은 해당 반의 숙제/수업일지/평가/앨범을 관리할 수 있습니다.
        <Link href="/admin/users">사용자 관리 (선생님·학부모·학생 등록) →</Link>
      </p>

      <section className={styles.newClassBox}>
        <h2 className={styles.sectionTitle}>새 반 만들기</h2>
        <div className={styles.newClassForm}>
          <input
            placeholder="반 이름 (예: 초등 3학년 2반)"
            value={newClass.name}
            onChange={(e) => setNewClass({ ...newClass, name: e.target.value })}
          />
          <input
            type="number"
            placeholder="학년"
            value={newClass.grade}
            onChange={(e) => setNewClass({ ...newClass, grade: e.target.value })}
          />
          <select
            value={newClass.branch}
            onChange={(e) => setNewClass({ ...newClass, branch: e.target.value as Branch })}
          >
            {(Object.keys(BRANCH_LABELS) as Branch[]).map((b) => (
              <option key={b} value={b}>
                {BRANCH_LABELS[b]}
              </option>
            ))}
          </select>
          <select
            value={newClass.teacherId}
            onChange={(e) => setNewClass({ ...newClass, teacherId: e.target.value })}
          >
            <option value="">담당 선생님 미배정</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.email})
              </option>
            ))}
          </select>
          <button onClick={createClass} disabled={creating || !newClass.name || !newClass.grade}>
            {creating ? '생성 중...' : '반 만들기'}
          </button>
        </div>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>전체 반 목록</h2>
        <div className={styles.branchTabs}>
          <button
            className={branchFilter === 'all' ? styles.branchTabActive : styles.branchTab}
            onClick={() => setBranchFilter('all')}
          >
            전체 ({classes.length})
          </button>
          {(Object.keys(BRANCH_LABELS) as Branch[]).map((b) => (
            <button
              key={b}
              className={branchFilter === b ? styles.branchTabActive : styles.branchTab}
              onClick={() => setBranchFilter(b)}
            >
              {BRANCH_LABELS[b]} ({classes.filter((c) => c.branch === b).length})
            </button>
          ))}
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>지점</th>
              <th>반 이름</th>
              <th>학년</th>
              <th>담당 선생님</th>
              <th>학생 수</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {classes
              .filter((cls) => branchFilter === 'all' || cls.branch === branchFilter)
              .map((cls) => (
              <tr key={cls.id}>
                {editingId === cls.id ? (
                  <>
                    <td>
                      <select
                        value={editForm.branch}
                        onChange={(e) => setEditForm({ ...editForm, branch: e.target.value as Branch })}
                      >
                        {(Object.keys(BRANCH_LABELS) as Branch[]).map((b) => (
                          <option key={b} value={b}>
                            {BRANCH_LABELS[b]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={editForm.grade}
                        onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        value={editForm.teacherId}
                        onChange={(e) => setEditForm({ ...editForm, teacherId: e.target.value })}
                      >
                        <option value="">미배정</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{cls.studentCount}</td>
                    <td className={styles.actions}>
                      <button onClick={() => saveEdit(cls.id)}>저장</button>
                      <button onClick={() => setEditingId(null)}>취소</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>
                      <span className={styles.branchBadge}>{BRANCH_LABELS[cls.branch]}</span>
                    </td>
                    <td>{cls.name}</td>
                    <td>{cls.grade}학년</td>
                    <td>{cls.teacherName || <span className={styles.unassigned}>미배정</span>}</td>
                    <td>{cls.studentCount}명</td>
                    <td className={styles.actions}>
                      <button onClick={() => startEdit(cls)}>수정</button>
                      <Link href={getClassManageRoute(cls.id)} className={styles.manageLink}>
                        콘텐츠 관리
                      </Link>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {classes.filter((cls) => branchFilter === 'all' || cls.branch === branchFilter).length === 0 && (
              <tr>
                <td colSpan={6} className={styles.emptyRow}>
                  아직 생성된 반이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
