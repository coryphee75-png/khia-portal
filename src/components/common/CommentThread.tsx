'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import styles from './CommentThread.module.css';
import { NoteComment } from '@/types';

const ROLE_LABEL: Record<string, string> = {
  parent: '학부모',
  teacher: '선생님',
  admin: '관리자',
  student: '학생',
};

/**
 * 수업일지 댓글 스레드 - 학부모 ↔ 담임선생님 소통
 * 부모 컴포넌트가 펼쳤을 때만 마운트되도록 사용 (lazy fetch)
 */
export function CommentThread({ noteId }: { noteId: string }) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<NoteComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/notes/${noteId}/comments`);
        const result = await res.json();
        if (!res.ok || !result.success) {
          throw new Error(result?.error || '댓글을 불러올 수 없습니다.');
        }
        if (!cancelled) setComments(result.data || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  const submit = async () => {
    const content = text.trim();
    if (!content) return;
    setPosting(true);
    setError('');
    try {
      const res = await fetch(`/api/notes/${noteId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result?.error || '댓글을 작성할 수 없습니다.');
      }
      setComments((prev) => [...prev, result.data]);
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.');
    } finally {
      setPosting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.thread}>
      <h5 className={styles.title}>댓글{comments.length > 0 ? ` (${comments.length})` : ''}</h5>

      {isLoading ? (
        <p className={styles.status}>불러오는 중...</p>
      ) : comments.length === 0 ? (
        <p className={styles.status}>아직 댓글이 없습니다. 선생님께 궁금한 점을 남겨보세요!</p>
      ) : (
        <ul className={styles.list}>
          {comments.map((c) => {
            const isMine = session?.user?.id === c.authorId;
            return (
              <li
                key={c.id}
                className={`${styles.item} ${c.authorRole === 'teacher' || c.authorRole === 'admin' ? styles.staff : styles.parent} ${isMine ? styles.mine : ''}`}
              >
                <div className={styles.itemHeader}>
                  <span className={styles.authorName}>{c.authorName}</span>
                  <span className={styles.authorRole}>{ROLE_LABEL[c.authorRole] || c.authorRole}</span>
                  <span className={styles.time}>
                    {new Date(c.createdAt).toLocaleString('ko-KR', {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className={styles.itemContent}>{c.content}</p>
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.composer}>
        <textarea
          className={styles.textarea}
          placeholder="댓글을 입력하세요..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={posting}
          rows={2}
        />
        <button
          type="button"
          className={styles.submitBtn}
          onClick={submit}
          disabled={posting || !text.trim()}
        >
          {posting ? '등록 중...' : '등록'}
        </button>
      </div>
    </div>
  );
}

export default CommentThread;
