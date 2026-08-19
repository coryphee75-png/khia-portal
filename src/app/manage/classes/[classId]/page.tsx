'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { getDashboardRoute } from '@/lib/constants';
import { Homework, Note, Evaluation, Album } from '@/types';
import CommentThread from '@/components/common/CommentThread';
import styles from './page.module.css';

interface ManageChild {
  id: string;
  name: string;
  grade: number;
  classNumber: string;
  homeworks: Homework[];
  notes: Note[];
  evaluations: Evaluation[];
  albums: Album[];
}

interface ManageClassData {
  id: string;
  name: string;
  grade: number;
  children: ManageChild[];
}

function toDateInput(value: string | Date): string {
  return String(value).slice(0, 10);
}

export default function ManageClassPage() {
  const params = useParams();
  const classId = String(params.classId);
  const router = useRouter();
  const { data: session, status } = useSession();

  const [data, setData] = useState<ManageClassData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/content/classes/${classId}`);
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result?.error || '불러올 수 없습니다.');
      }
      setData(result.data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (status === 'authenticated') {
      if (session.user.role !== 'admin' && session.user.role !== 'teacher') {
        router.push(getDashboardRoute(session.user.role));
        return;
      }
      load();
    }
  }, [status, session, router, load]);

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return <div className={styles.status}>로딩 중...</div>;
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  if (!data || !session) return null;

  return (
    <div className={styles.page}>
      <Link href={getDashboardRoute(session.user.role)} className={styles.backLink}>
        ← 대시보드로
      </Link>
      <h1>
        {data.name} <span className={styles.gradeTag}>{data.grade}학년</span> 콘텐츠 관리
      </h1>

      {data.children.length === 0 ? (
        <p className={styles.empty}>이 반에 등록된 학생이 없습니다.</p>
      ) : (
        data.children.map((child) => (
          <ChildManagePanel key={child.id} classId={classId} child={child} onChange={load} />
        ))
      )}
    </div>
  );
}

function ChildManagePanel({
  classId,
  child,
  onChange,
}: {
  classId: string;
  child: ManageChild;
  onChange: () => void;
}) {
  return (
    <section className={styles.childPanel}>
      <h2>
        {child.name} <span className={styles.meta}>{child.grade}학년 {child.classNumber}반</span>
      </h2>
      <HomeworkSection childId={child.id} items={child.homeworks} onChange={onChange} />
      <NoteSection childId={child.id} items={child.notes} onChange={onChange} />
      <EvaluationSection childId={child.id} items={child.evaluations} onChange={onChange} />
      <AlbumSection childId={child.id} items={child.albums} onChange={onChange} />
    </section>
  );
}

/* ---------------- 숙제 ---------------- */

function HomeworkSection({
  childId,
  items,
  onChange,
}: {
  childId: string;
  items: Homework[];
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<Homework | 'new' | null>(null);
  const [form, setForm] = useState({ title: '', description: '', subject: '', dueDate: '', status: 'pending' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const startNew = () => {
    setForm({ title: '', description: '', subject: '', dueDate: '', status: 'pending' });
    setErr('');
    setEditing('new');
  };
  const startEdit = (hw: Homework) => {
    setForm({
      title: hw.title,
      description: hw.description,
      subject: hw.subject,
      dueDate: toDateInput(hw.dueDate),
      status: hw.status,
    });
    setErr('');
    setEditing(hw);
  };

  const submit = async () => {
    setSaving(true);
    setErr('');
    try {
      const isNew = editing === 'new';
      const url = isNew ? '/api/content/homeworks' : `/api/content/homeworks/${(editing as Homework).id}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? { ...form, childId } : form),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '저장 실패');
      setEditing(null);
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('이 숙제를 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/content/homeworks/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok || !result.success) {
      alert(result?.error || '삭제 실패');
      return;
    }
    onChange();
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>숙제</h3>
        <button className={styles.addBtn} onClick={startNew}>
          + 추가
        </button>
      </div>
      <ul className={styles.itemList}>
        {items.map((hw) => (
          <li key={hw.id} className={styles.item}>
            <div>
              <strong>{hw.subject}</strong> — {hw.title}
              <span className={styles.statusTag} data-status={hw.status}>
                {hw.status === 'pending' ? '진행중' : hw.status === 'completed' ? '완료' : '기한초과'}
              </span>
              <div className={styles.itemMeta}>마감 {toDateInput(hw.dueDate)}</div>
            </div>
            <div className={styles.itemActions}>
              <button onClick={() => startEdit(hw)}>수정</button>
              <button onClick={() => remove(hw.id)}>삭제</button>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className={styles.emptyItem}>등록된 숙제가 없습니다.</li>}
      </ul>

      {editing && (
        <div className={styles.form}>
          {err && <div className={styles.formError}>{err}</div>}
          <input
            placeholder="과목"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
          <input
            placeholder="제목"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            placeholder="설명"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="pending">진행중</option>
            <option value="completed">완료</option>
            <option value="overdue">기한초과</option>
          </select>
          <div className={styles.formActions}>
            <button onClick={submit} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={() => setEditing(null)}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- 수업일지 ---------------- */

function NoteSection({
  childId,
  items,
  onChange,
}: {
  childId: string;
  items: Note[];
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<Note | 'new' | null>(null);
  const [form, setForm] = useState({ date: '', subject: '', content: '', teacher: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [openCommentsId, setOpenCommentsId] = useState<string | null>(null);

  const startNew = () => {
    setForm({ date: '', subject: '', content: '', teacher: '' });
    setErr('');
    setEditing('new');
  };
  const startEdit = (note: Note) => {
    setForm({ date: toDateInput(note.date), subject: note.subject, content: note.content, teacher: note.teacher });
    setErr('');
    setEditing(note);
  };

  const submit = async () => {
    setSaving(true);
    setErr('');
    try {
      const isNew = editing === 'new';
      const url = isNew ? '/api/content/notes' : `/api/content/notes/${(editing as Note).id}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? { ...form, childId } : form),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '저장 실패');
      setEditing(null);
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('이 수업일지를 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/content/notes/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok || !result.success) {
      alert(result?.error || '삭제 실패');
      return;
    }
    onChange();
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>수업일지</h3>
        <button className={styles.addBtn} onClick={startNew}>
          + 추가
        </button>
      </div>
      <ul className={styles.itemList}>
        {items.map((note) => (
          <li key={note.id} className={styles.item} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <strong>{note.subject}</strong> — {note.content.slice(0, 40)}
                {note.content.length > 40 ? '...' : ''}
                <div className={styles.itemMeta}>
                  {toDateInput(note.date)} · {note.teacher}
                </div>
              </div>
              <div className={styles.itemActions}>
                <button
                  onClick={() => setOpenCommentsId(openCommentsId === note.id ? null : note.id)}
                >
                  {openCommentsId === note.id ? '댓글 닫기' : '댓글'}
                </button>
                <button onClick={() => startEdit(note)}>수정</button>
                <button onClick={() => remove(note.id)}>삭제</button>
              </div>
            </div>
            {openCommentsId === note.id && <CommentThread noteId={note.id} />}
          </li>
        ))}
        {items.length === 0 && <li className={styles.emptyItem}>등록된 수업일지가 없습니다.</li>}
      </ul>

      {editing && (
        <div className={styles.form}>
          {err && <div className={styles.formError}>{err}</div>}
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <input
            placeholder="과목"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
          <input
            placeholder="작성자(선생님 이름)"
            value={form.teacher}
            onChange={(e) => setForm({ ...form, teacher: e.target.value })}
          />
          <textarea
            placeholder="내용"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
          <div className={styles.formActions}>
            <button onClick={submit} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={() => setEditing(null)}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- 평가 ---------------- */

function EvaluationSection({
  childId,
  items,
  onChange,
}: {
  childId: string;
  items: Evaluation[];
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<Evaluation | 'new' | null>(null);
  const [form, setForm] = useState({ date: '', subject: '', score: '', grade: '', comments: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const startNew = () => {
    setForm({ date: '', subject: '', score: '', grade: '', comments: '' });
    setErr('');
    setEditing('new');
  };
  const startEdit = (evalItem: Evaluation) => {
    setForm({
      date: toDateInput(evalItem.date),
      subject: evalItem.subject,
      score: String(evalItem.score),
      grade: evalItem.grade,
      comments: evalItem.comments || '',
    });
    setErr('');
    setEditing(evalItem);
  };

  const submit = async () => {
    setSaving(true);
    setErr('');
    try {
      const isNew = editing === 'new';
      const url = isNew ? '/api/content/evaluations' : `/api/content/evaluations/${(editing as Evaluation).id}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? { ...form, childId } : form),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '저장 실패');
      setEditing(null);
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('이 평가를 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/content/evaluations/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok || !result.success) {
      alert(result?.error || '삭제 실패');
      return;
    }
    onChange();
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>평가</h3>
        <button className={styles.addBtn} onClick={startNew}>
          + 추가
        </button>
      </div>
      <ul className={styles.itemList}>
        {items.map((evalItem) => (
          <li key={evalItem.id} className={styles.item}>
            <div>
              <strong>{evalItem.subject}</strong> — {evalItem.score}점 ({evalItem.grade})
              <div className={styles.itemMeta}>{toDateInput(evalItem.date)}</div>
            </div>
            <div className={styles.itemActions}>
              <button onClick={() => startEdit(evalItem)}>수정</button>
              <button onClick={() => remove(evalItem.id)}>삭제</button>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className={styles.emptyItem}>등록된 평가가 없습니다.</li>}
      </ul>

      {editing && (
        <div className={styles.form}>
          {err && <div className={styles.formError}>{err}</div>}
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <input
            placeholder="과목"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
          <input
            type="number"
            placeholder="점수"
            value={form.score}
            onChange={(e) => setForm({ ...form, score: e.target.value })}
          />
          <input
            placeholder="등급 (예: A+, B, ...)"
            value={form.grade}
            onChange={(e) => setForm({ ...form, grade: e.target.value })}
          />
          <textarea
            placeholder="코멘트"
            value={form.comments}
            onChange={(e) => setForm({ ...form, comments: e.target.value })}
          />
          <div className={styles.formActions}>
            <button onClick={submit} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={() => setEditing(null)}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- 앨범 ---------------- */

interface AlbumImageDraft {
  url: string;
  caption: string;
}

function AlbumSection({
  childId,
  items,
  onChange,
}: {
  childId: string;
  items: Album[];
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<Album | 'new' | null>(null);
  const [form, setForm] = useState({ title: '', description: '', eventDate: '' });
  const [images, setImages] = useState<AlbumImageDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const startNew = () => {
    setForm({ title: '', description: '', eventDate: '' });
    setImages([]);
    setErr('');
    setEditing('new');
  };
  const startEdit = (album: Album) => {
    setForm({
      title: album.title,
      description: album.description || '',
      eventDate: toDateInput(album.eventDate),
    });
    setImages(album.images.map((img) => ({ url: img.url, caption: img.caption || '' })));
    setErr('');
    setEditing(album);
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setErr('');
    try {
      for (const file of Array.from(fileList)) {
        const body = new FormData();
        body.append('file', file);
        const res = await fetch('/api/content/albums/upload', { method: 'POST', body });
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result?.error || `${file.name} 업로드 실패`);
        }
        setImages((prev) => [...prev, { url: result.data.url, caption: '' }]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCaption = (index: number, caption: string) => {
    setImages((prev) => prev.map((img, i) => (i === index ? { ...img, caption } : img)));
  };

  const submit = async () => {
    setSaving(true);
    setErr('');
    try {
      const isNew = editing === 'new';
      const url = isNew ? '/api/content/albums' : `/api/content/albums/${(editing as Album).id}`;
      const payload = {
        title: form.title,
        description: form.description,
        eventDate: form.eventDate,
        images: images.map((img) => ({ url: img.url, caption: img.caption || undefined })),
        ...(isNew ? { childId } : {}),
      };
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result?.error || '저장 실패');
      setEditing(null);
      onChange();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('이 앨범을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/content/albums/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok || !result.success) {
      alert(result?.error || '삭제 실패');
      return;
    }
    onChange();
  };

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h3>앨범</h3>
        <button className={styles.addBtn} onClick={startNew}>
          + 추가
        </button>
      </div>
      <ul className={styles.itemList}>
        {items.map((album) => (
          <li key={album.id} className={styles.item}>
            <div>
              <strong>{album.title}</strong> — 사진 {album.images.length}장
              <div className={styles.itemMeta}>{toDateInput(album.eventDate)}</div>
            </div>
            <div className={styles.itemActions}>
              <button onClick={() => startEdit(album)}>수정</button>
              <button onClick={() => remove(album.id)}>삭제</button>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className={styles.emptyItem}>등록된 앨범이 없습니다.</li>}
      </ul>

      {editing && (
        <div className={styles.form}>
          {err && <div className={styles.formError}>{err}</div>}
          <input
            placeholder="제목"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            type="date"
            value={form.eventDate}
            onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
          />
          <textarea
            placeholder="설명"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className={styles.imageUploadBox}>
            <label className={styles.uploadLabel}>
              {uploading ? '업로드 중...' : '📷 사진 업로드'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                disabled={uploading}
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = '';
                }}
                hidden
              />
            </label>
            {images.length > 0 && (
              <div className={styles.imageGrid}>
                {images.map((img, i) => (
                  <div key={i} className={styles.imageTile}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.caption || `사진 ${i + 1}`} />
                    <input
                      placeholder="설명 (선택)"
                      value={img.caption}
                      onChange={(e) => updateCaption(i, e.target.value)}
                    />
                    <button type="button" onClick={() => removeImage(i)}>
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.formActions}>
            <button onClick={submit} disabled={saving || uploading}>
              {saving ? '저장 중...' : '저장'}
            </button>
            <button onClick={() => setEditing(null)}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
