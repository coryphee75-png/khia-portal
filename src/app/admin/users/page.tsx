'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import styles from '../page.module.css';

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: Branch | null;
}

type Branch = 'Sejong' | 'Gwangyo';
const BRANCH_LABELS: Record<Branch, string> = {
  Sejong: 'Sejong Branch',
  Gwangyo: 'Gwangyo Branch',
};

interface ClassOption {
  id: string;
  name: string;
  grade: number;
  branch: Branch;
}

interface ChildInfo {
  id: string;
  name: string;
  grade: number;
  classNumber: string;
  parentId: string | null;
  parentName: string | null;
  registrationCode: string;
  classId: string | null;
  className: string | null;
  studentUserId: string | null;
  studentEmail: string | null;
  studentName: string | null;
  branch: Branch;
}

interface PendingSignup {
  id: string;
  name: string;
  email: string;
  requestedAt: string;
  children: { id: string; name: string; grade: number; classNumber: string }[];
}

const emptyAccountForm = { name: '', email: '', password: '' };

export default function AdminUsersPage() {
  const [teachers, setTeachers] = useState<UserInfo[]>([]);
  const [parents, setParents] = useState<UserInfo[]>([]);
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [pendingSignups, setPendingSignups] = useState<PendingSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signupActionId, setSignupActionId] = useState<string | null>(null);

  const [teacherForm, setTeacherForm] = useState({ ...emptyAccountForm, branch: 'Sejong' as Branch });
  const [parentForm, setParentForm] = useState(emptyAccountForm);
  const [studentForm, setStudentForm] = useState({
    name: '',
    grade: '',
    classNumber: '',
    parentId: '',
    classId: '',
    branch: 'Sejong' as Branch,
    createLogin: false,
    studentEmail: '',
    studentPassword: '',
  });

  const [creatingTeacher, setCreatingTeacher] = useState(false);
  const [creatingParent, setCreatingParent] = useState(false);
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [teacherErr, setTeacherErr] = useState('');
  const [parentErr, setParentErr] = useState('');
  const [studentErr, setStudentErr] = useState('');

  // 학생 정보 수정 (이름/학년/반 번호/학부모/배정 반) - 반을 옮기거나 학부모를 바꿔도
  // 숙제/수업일지/평가/앨범 기록은 학생 id 기준으로 저장되어 있어서 그대로 유지됨
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  const [childEditForm, setChildEditForm] = useState({
    name: '',
    grade: '',
    classNumber: '',
    parentId: '',
    classId: '',
    branch: 'Sejong' as Branch,
    studentEmail: '',
    studentPassword: '',
  });
  const [childEditErr, setChildEditErr] = useState('');
  const [savingChild, setSavingChild] = useState(false);

  // 로그인 계정 수정 (선생님/학부모/학생 계정 공통) - 이름/아이디를 고치거나, 비밀번호를 잃어버렸을 때
  // 관리자가 대신 새 비밀번호로 바꿔줄 수 있음 (비밀번호 칸은 비워두면 그대로 유지됨)
  const [acctTarget, setAcctTarget] = useState<{ id: string; label: string; role: string } | null>(null);
  const [acctForm, setAcctForm] = useState({ name: '', email: '', password: '', branch: 'Sejong' as Branch });
  const [acctErr, setAcctErr] = useState('');
  const [acctSaving, setAcctSaving] = useState(false);

  // 삭제 처리 중인 항목 표시(중복 클릭 방지)
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teachersRes, parentsRes, childrenRes, classesRes, signupsRes] = await Promise.all([
        fetch('/api/admin/users?role=teacher'),
        fetch('/api/admin/users?role=parent'),
        fetch('/api/admin/children'),
        fetch('/api/admin/classes'),
        fetch('/api/admin/signups'),
      ]);
      const [teachersR, parentsR, childrenR, classesR, signupsR] = await Promise.all([
        teachersRes.json(),
        parentsRes.json(),
        childrenRes.json(),
        classesRes.json(),
        signupsRes.json(),
      ]);
      if (!teachersRes.ok || !teachersR.success) throw new Error(teachersR?.error || '불러오기 실패');
      setTeachers(teachersR.data);
      setParents(parentsR.success ? parentsR.data : []);
      setChildren(childrenR.success ? childrenR.data : []);
      setClasses(classesR.success ? classesR.data : []);
      setPendingSignups(signupsR.success ? signupsR.data : []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSignupAction = async (id: string, action: 'approve' | 'reject') => {
    setSignupActionId(id);
    try {
      const res = await fetch(`/api/admin/signups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '처리 실패');
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setSignupActionId(null);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const createTeacher = async () => {
    setCreatingTeacher(true);
    setTeacherErr('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...teacherForm, role: 'teacher' }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '생성 실패');
      setTeacherForm({ ...emptyAccountForm, branch: 'Sejong' });
      load();
    } catch (e) {
      setTeacherErr(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setCreatingTeacher(false);
    }
  };

  const createParent = async () => {
    setCreatingParent(true);
    setParentErr('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parentForm, role: 'parent' }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '생성 실패');
      setParentForm(emptyAccountForm);
      load();
    } catch (e) {
      setParentErr(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setCreatingParent(false);
    }
  };

  const createStudent = async () => {
    setCreatingStudent(true);
    setStudentErr('');
    try {
      const payload: Record<string, unknown> = {
        name: studentForm.name,
        grade: studentForm.grade,
        classNumber: studentForm.classNumber,
        parentId: studentForm.parentId || null,
        classId: studentForm.classId || null,
        branch: studentForm.branch,
      };
      if (studentForm.createLogin) {
        payload.studentAccount = {
          email: studentForm.studentEmail,
          password: studentForm.studentPassword,
        };
      }
      const res = await fetch('/api/admin/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '생성 실패');
      setStudentForm({
        name: '',
        grade: '',
        classNumber: '',
        parentId: '',
        classId: '',
        branch: 'Sejong',
        createLogin: false,
        studentEmail: '',
        studentPassword: '',
      });
      if (!studentForm.parentId) {
        alert(
          `학생이 등록되었습니다. 학부모 회원가입용 학번/코드: ${result.data.registrationCode}\n\n이 코드를 학부모님께 전달하면 /signup 화면에서 직접 회원가입할 수 있어요 (관리자 승인 필요).`
        );
      }
      load();
    } catch (e) {
      setStudentErr(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setCreatingStudent(false);
    }
  };

  const startEditChild = (c: ChildInfo) => {
    setEditingChildId(c.id);
    setChildEditForm({
      name: c.name,
      grade: String(c.grade),
      classNumber: c.classNumber,
      parentId: c.parentId || '',
      classId: c.classId || '',
      branch: c.branch,
      studentEmail: c.studentEmail || '',
      studentPassword: '',
    });
    setChildEditErr('');
  };

  const cancelEditChild = () => {
    setEditingChildId(null);
    setChildEditErr('');
  };

  const saveEditChild = async (id: string) => {
    setSavingChild(true);
    setChildEditErr('');
    try {
      const payload: Record<string, unknown> = {
        name: childEditForm.name,
        grade: childEditForm.grade,
        classNumber: childEditForm.classNumber,
        parentId: childEditForm.parentId || null,
        classId: childEditForm.classId || null,
        branch: childEditForm.branch,
      };
      // 로그인 아이디를 입력한 경우에만 로그인 계정을 새로 만들거나 갱신함 (비워두면 기존 계정은 그대로 둠)
      if (childEditForm.studentEmail.trim()) {
        payload.studentEmail = childEditForm.studentEmail.trim();
        if (childEditForm.studentPassword) payload.studentPassword = childEditForm.studentPassword;
      }
      const res = await fetch(`/api/admin/children/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '수정 실패');
      setEditingChildId(null);
      load();
    } catch (e) {
      setChildEditErr(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setSavingChild(false);
    }
  };

  const openAccountEdit = (
    id: string,
    label: string,
    role: string,
    name: string,
    email: string,
    branch: Branch | null
  ) => {
    setAcctTarget({ id, label, role });
    setAcctForm({ name, email, password: '', branch: branch || 'Sejong' });
    setAcctErr('');
  };

  const closeAccountEdit = () => {
    setAcctTarget(null);
    setAcctForm({ name: '', email: '', password: '', branch: 'Sejong' });
    setAcctErr('');
  };

  const submitAccountEdit = async () => {
    if (!acctTarget) return;
    if (!acctForm.name.trim() || !acctForm.email.trim()) {
      setAcctErr('이름과 아이디를 입력해주세요.');
      return;
    }
    if (acctForm.password && acctForm.password.length < 4) {
      setAcctErr('비밀번호는 4자 이상이어야 합니다. (바꾸지 않으려면 비워두세요)');
      return;
    }
    setAcctSaving(true);
    setAcctErr('');
    try {
      const payload: Record<string, unknown> = {
        name: acctForm.name.trim(),
        email: acctForm.email.trim(),
      };
      if (acctForm.password) payload.password = acctForm.password;
      if (acctTarget.role === 'teacher') payload.branch = acctForm.branch;
      const res = await fetch(`/api/admin/users/${acctTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '변경 실패');
      closeAccountEdit();
      load();
    } catch (e) {
      setAcctErr(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setAcctSaving(false);
    }
  };

  const deleteTeacher = async (id: string, name: string) => {
    if (
      !confirm(
        `${name} 선생님 계정을 삭제할까요?\n담당하던 반은 "미배정" 상태가 되고, 반과 학생 기록은 그대로 유지됩니다.`
      )
    )
      return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '삭제 실패');
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const deleteParent = async (id: string, name: string) => {
    if (
      !confirm(
        `${name} 학부모 계정을 삭제할까요?\n연결된 자녀는 삭제되지 않고 "회원가입 대기 중" 상태로 남으며, 기존 학번/코드로 다시 학부모를 연결할 수 있습니다.`
      )
    )
      return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '삭제 실패');
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const deleteChild = async (id: string, name: string) => {
    if (
      !confirm(
        `${name} 학생을 삭제할까요?\n이 학생의 숙제·수업일지·평가·앨범·댓글 기록이 모두 함께 삭제되며, 되돌릴 수 없습니다. 학생 로그인 계정이 있다면 그 계정도 함께 삭제됩니다.`
      )
    )
      return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/children/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '삭제 실패');
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className={styles.status}>로딩 중...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.page}>
      <h1>사용자 관리</h1>
      <p className={styles.subtitle}>
        선생님·학부모 계정과 학생을 등록하세요. <Link href="/admin">← 반 관리로 돌아가기</Link>
      </p>

      <section className={styles.newClassBox}>
        <h2 className={styles.sectionTitle}>가입 승인 대기 ({pendingSignups.length}건)</h2>
        {pendingSignups.length === 0 ? (
          <p className={styles.unassigned}>대기 중인 학부모 회원가입 신청이 없습니다.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>이름</th>
                <th>아이디</th>
                <th>연결된 자녀</th>
                <th>처리</th>
              </tr>
            </thead>
            <tbody>
              {pendingSignups.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.email}</td>
                  <td>
                    {s.children.length > 0
                      ? s.children.map((c) => `${c.name} (${c.grade}학년 ${c.classNumber}반)`).join(', ')
                      : '없음'}
                  </td>
                  <td className={styles.actions}>
                    <button
                      onClick={() => handleSignupAction(s.id, 'approve')}
                      disabled={signupActionId === s.id}
                    >
                      승인
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('이 가입 신청을 거절할까요? 계정이 삭제되고 학번/코드는 재사용 가능해집니다.')) {
                          handleSignupAction(s.id, 'reject');
                        }
                      }}
                      disabled={signupActionId === s.id}
                    >
                      거절
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.newClassBox}>
        <h2 className={styles.sectionTitle}>선생님 등록</h2>
        {teacherErr && <div className={styles.error}>{teacherErr}</div>}
        <div className={styles.newClassForm}>
          <input
            placeholder="이름"
            value={teacherForm.name}
            onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
          />
          <input
            placeholder="아이디"
            value={teacherForm.email}
            onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={teacherForm.password}
            onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
          />
          <select
            value={teacherForm.branch}
            onChange={(e) => setTeacherForm({ ...teacherForm, branch: e.target.value as Branch })}
          >
            {(Object.keys(BRANCH_LABELS) as Branch[]).map((b) => (
              <option key={b} value={b}>
                {BRANCH_LABELS[b]}
              </option>
            ))}
          </select>
          <button
            onClick={createTeacher}
            disabled={creatingTeacher || !teacherForm.name || !teacherForm.email || !teacherForm.password}
          >
            {creatingTeacher ? '등록 중...' : '선생님 등록'}
          </button>
        </div>
      </section>

      <section className={styles.newClassBox}>
        <h2 className={styles.sectionTitle}>학부모 등록</h2>
        {parentErr && <div className={styles.error}>{parentErr}</div>}
        <div className={styles.newClassForm}>
          <input
            placeholder="이름"
            value={parentForm.name}
            onChange={(e) => setParentForm({ ...parentForm, name: e.target.value })}
          />
          <input
            placeholder="아이디"
            value={parentForm.email}
            onChange={(e) => setParentForm({ ...parentForm, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={parentForm.password}
            onChange={(e) => setParentForm({ ...parentForm, password: e.target.value })}
          />
          <button
            onClick={createParent}
            disabled={creatingParent || !parentForm.name || !parentForm.email || !parentForm.password}
          >
            {creatingParent ? '등록 중...' : '학부모 등록'}
          </button>
        </div>
      </section>

      <section className={styles.newClassBox}>
        <h2 className={styles.sectionTitle}>학생 등록</h2>
        {studentErr && <div className={styles.error}>{studentErr}</div>}
        <div className={styles.newClassForm}>
          <input
            placeholder="학생 이름"
            value={studentForm.name}
            onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
          />
          <input
            type="number"
            placeholder="학년"
            value={studentForm.grade}
            onChange={(e) => setStudentForm({ ...studentForm, grade: e.target.value })}
          />
          <input
            placeholder="반 번호 (예: 2)"
            value={studentForm.classNumber}
            onChange={(e) => setStudentForm({ ...studentForm, classNumber: e.target.value })}
          />
          <select
            value={studentForm.parentId}
            onChange={(e) => setStudentForm({ ...studentForm, parentId: e.target.value })}
          >
            <option value="">학부모 나중에 연결 (학번/코드로 학부모가 직접 가입)</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.email})
              </option>
            ))}
          </select>
          <select
            value={studentForm.branch}
            onChange={(e) => {
              const branch = e.target.value as Branch;
              const stillValid = classes.some((c) => c.id === studentForm.classId && c.branch === branch);
              setStudentForm({ ...studentForm, branch, classId: stillValid ? studentForm.classId : '' });
            }}
          >
            {(Object.keys(BRANCH_LABELS) as Branch[]).map((b) => (
              <option key={b} value={b}>
                {BRANCH_LABELS[b]}
              </option>
            ))}
          </select>
          <select
            value={studentForm.classId}
            onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}
          >
            <option value="">반 배정 안 함</option>
            {classes
              .filter((c) => c.branch === studentForm.branch)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={studentForm.createLogin}
            onChange={(e) => setStudentForm({ ...studentForm, createLogin: e.target.checked })}
          />
          이 학생에게 로그인 계정도 발급 (학생이 직접 로그인해서 볼 수 있게)
        </label>
        {studentForm.createLogin && (
          <div className={styles.newClassForm}>
            <input
              placeholder="학생 계정 아이디"
              value={studentForm.studentEmail}
              onChange={(e) => setStudentForm({ ...studentForm, studentEmail: e.target.value })}
            />
            <input
              type="password"
              placeholder="학생 계정 비밀번호"
              value={studentForm.studentPassword}
              onChange={(e) => setStudentForm({ ...studentForm, studentPassword: e.target.value })}
            />
          </div>
        )}
        <div className={styles.newClassForm}>
          <button
            onClick={createStudent}
            disabled={
              creatingStudent ||
              !studentForm.name ||
              !studentForm.grade ||
              !studentForm.classNumber
            }
          >
            {creatingStudent ? '등록 중...' : '학생 등록'}
          </button>
        </div>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>선생님 목록 ({teachers.length}명)</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>이름</th>
              <th>아이디</th>
              <th>지점</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.email}</td>
                <td>
                  {t.branch ? (
                    <span className={styles.branchBadge}>{BRANCH_LABELS[t.branch]}</span>
                  ) : (
                    <span className={styles.unassigned}>미지정</span>
                  )}
                </td>
                <td className={styles.actions}>
                  <button onClick={() => openAccountEdit(t.id, `${t.name} 선생님`, 'teacher', t.name, t.email, t.branch)}>
                    계정 수정
                  </button>
                  <button
                    className={styles.dangerBtn}
                    onClick={() => deleteTeacher(t.id, t.name)}
                    disabled={deletingId === t.id}
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {teachers.length === 0 && (
              <tr>
                <td colSpan={4} className={styles.emptyRow}>
                  등록된 선생님이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>학부모 목록 ({parents.length}명)</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>이름</th>
              <th>아이디</th>
              <th>자녀</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {parents.map((p) => {
              const kids = children.filter((c) => c.parentId === p.id);
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.email}</td>
                  <td>
                    {kids.length === 0 ? (
                      <span className={styles.unassigned}>연결된 자녀 없음</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {kids.map((c) => (
                          <div
                            key={c.id}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}
                          >
                            <span>{c.name}</span>
                            <span className={styles.unassigned}>{c.className || '반 미배정'}</span>
                            <span className={styles.branchBadge}>{BRANCH_LABELS[c.branch]}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className={styles.actions}>
                    <button onClick={() => openAccountEdit(p.id, `${p.name} 학부모`, 'parent', p.name, p.email, null)}>
                      계정 수정
                    </button>
                    <button
                      className={styles.dangerBtn}
                      onClick={() => deleteParent(p.id, p.name)}
                      disabled={deletingId === p.id}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
            {parents.length === 0 && (
              <tr>
                <td colSpan={4} className={styles.emptyRow}>
                  등록된 학부모가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>학생 목록 ({children.length}명)</h2>
        <p className={styles.unassigned}>
          이름/학년/반 번호를 고치거나, 반을 옮기거나(담당 선생님이 자동으로 바뀝니다), 연결된 학부모를 바꿀 수
          있어요. 기존 숙제·수업일지·평가·앨범 기록은 학생 정보가 바뀌어도 그대로 유지됩니다. "수정" 화면의
          로그인 계정 칸에 아이디/비밀번호를 입력하고 저장하면, 로그인 계정이 없던 학생은 새로 발급되고 이미
          있는 학생은 아이디/비밀번호가 바뀝니다.
        </p>
        {childEditErr && <div className={styles.error}>{childEditErr}</div>}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>이름</th>
              <th>학년/반</th>
              <th>지점</th>
              <th>학부모</th>
              <th>학번/코드</th>
              <th>배정 반</th>
              <th>로그인 계정</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {children.map((c) =>
              editingChildId === c.id ? (
                <tr key={c.id}>
                  <td>
                    <input
                      value={childEditForm.name}
                      onChange={(e) => setChildEditForm({ ...childEditForm, name: e.target.value })}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <input
                        type="number"
                        value={childEditForm.grade}
                        onChange={(e) => setChildEditForm({ ...childEditForm, grade: e.target.value })}
                        style={{ width: '4.5rem' }}
                      />
                      <input
                        placeholder="반 번호"
                        value={childEditForm.classNumber}
                        onChange={(e) => setChildEditForm({ ...childEditForm, classNumber: e.target.value })}
                      />
                    </div>
                  </td>
                  <td>
                    <select
                      value={childEditForm.branch}
                      onChange={(e) => {
                        const branch = e.target.value as Branch;
                        const stillValid = classes.some(
                          (cls) => cls.id === childEditForm.classId && cls.branch === branch
                        );
                        setChildEditForm({
                          ...childEditForm,
                          branch,
                          classId: stillValid ? childEditForm.classId : '',
                        });
                      }}
                    >
                      {(Object.keys(BRANCH_LABELS) as Branch[]).map((b) => (
                        <option key={b} value={b}>
                          {BRANCH_LABELS[b]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={childEditForm.parentId}
                      onChange={(e) => setChildEditForm({ ...childEditForm, parentId: e.target.value })}
                    >
                      <option value="">미연결</option>
                      {parents.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.email})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <code>{c.registrationCode}</code>
                  </td>
                  <td>
                    <select
                      value={childEditForm.classId}
                      onChange={(e) => setChildEditForm({ ...childEditForm, classId: e.target.value })}
                    >
                      <option value="">미배정</option>
                      {classes
                        .filter((cls) => cls.branch === childEditForm.branch)
                        .map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <input
                        placeholder="로그인 아이디"
                        value={childEditForm.studentEmail}
                        onChange={(e) => setChildEditForm({ ...childEditForm, studentEmail: e.target.value })}
                      />
                      <input
                        type="password"
                        placeholder={c.studentUserId ? '새 비밀번호(선택)' : '비밀번호(4자 이상)'}
                        value={childEditForm.studentPassword}
                        onChange={(e) => setChildEditForm({ ...childEditForm, studentPassword: e.target.value })}
                      />
                    </div>
                  </td>
                  <td className={styles.actions}>
                    <button onClick={() => saveEditChild(c.id)} disabled={savingChild}>
                      {savingChild ? '저장 중...' : '저장'}
                    </button>
                    <button onClick={cancelEditChild} disabled={savingChild}>
                      취소
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    {c.grade}학년 {c.classNumber}반
                  </td>
                  <td>
                    <span className={styles.branchBadge}>{BRANCH_LABELS[c.branch]}</span>
                  </td>
                  <td>
                    {c.parentName || (
                      <span className={styles.unassigned}>회원가입 대기 중</span>
                    )}
                  </td>
                  <td>
                    <code>{c.registrationCode}</code>
                  </td>
                  <td>{c.className || <span className={styles.unassigned}>미배정</span>}</td>
                  <td>{c.studentEmail || <span className={styles.unassigned}>없음</span>}</td>
                  <td className={styles.actions}>
                    <button onClick={() => startEditChild(c)}>수정</button>
                    {c.studentUserId && (
                      <button
                        onClick={() =>
                          openAccountEdit(
                            c.studentUserId!,
                            `${c.name} 학생`,
                            'student',
                            c.studentName || c.name,
                            c.studentEmail || '',
                            null
                          )
                        }
                      >
                        계정 수정
                      </button>
                    )}
                    <button
                      className={styles.dangerBtn}
                      onClick={() => deleteChild(c.id, c.name)}
                      disabled={deletingId === c.id}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              )
            )}
            {children.length === 0 && (
              <tr>
                <td colSpan={8} className={styles.emptyRow}>
                  등록된 학생이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {acctTarget && (
        <div className={styles.pwModalOverlay} onClick={closeAccountEdit}>
          <div className={styles.pwModal} onClick={(e) => e.stopPropagation()}>
            <h3>{acctTarget.label} 계정 수정</h3>
            <p>이름과 로그인 아이디를 고치거나, 비밀번호를 잃어버렸다면 새 비밀번호를 입력하세요.</p>
            {acctErr && <div className={styles.error}>{acctErr}</div>}
            <input
              placeholder="이름"
              value={acctForm.name}
              onChange={(e) => setAcctForm({ ...acctForm, name: e.target.value })}
              autoFocus
            />
            <input
              placeholder="로그인 아이디"
              value={acctForm.email}
              onChange={(e) => setAcctForm({ ...acctForm, email: e.target.value })}
            />
            <input
              type="password"
              placeholder="새 비밀번호 (바꾸지 않으려면 비워두세요)"
              value={acctForm.password}
              onChange={(e) => setAcctForm({ ...acctForm, password: e.target.value })}
            />
            {acctTarget.role === 'teacher' && (
              <select
                value={acctForm.branch}
                onChange={(e) => setAcctForm({ ...acctForm, branch: e.target.value as Branch })}
              >
                {(Object.keys(BRANCH_LABELS) as Branch[]).map((b) => (
                  <option key={b} value={b}>
                    {BRANCH_LABELS[b]}
                  </option>
                ))}
              </select>
            )}
            <div className={styles.pwModalActions}>
              <button className={styles.pwModalCancel} onClick={closeAccountEdit} disabled={acctSaving}>
                취소
              </button>
              <button className={styles.pwModalSave} onClick={submitAccountEdit} disabled={acctSaving}>
                {acctSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
