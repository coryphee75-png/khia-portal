'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Card from '@/components/common/Card';
import CommentThread from '@/components/common/CommentThread';
import styles from './page.module.css';
import { Note } from '@/types';

/**
 * 수업일지 페이지
 */
export default function NotesPage() {
  const { data: session } = useSession();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await fetch('/api/parent/notes');
        if (!response.ok) throw new Error('수업일지를 불러올 수 없습니다.');
        const data = await response.json();
        setNotes(data.data || []);
      } catch (error) {
        console.error('Notes fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotes();
  }, []);

  // 날짜별로 정렬
  const sortedNotes = [...notes].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // 날짜별로 그룹화
  const groupedNotes = sortedNotes.reduce(
    (acc, note) => {
      const dateKey = new Date(note.date).toLocaleDateString();
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(note);
      return acc;
    },
    {} as Record<string, Note[]>
  );

  return (
    <div className={styles.container}>
      <h1>수업일지</h1>

      {isLoading ? (
        <div className={styles.loading}>로딩 중...</div>
      ) : notes.length > 0 ? (
        <div className={styles.timeline}>
          {Object.entries(groupedNotes).map(([date, dateNotes]) => (
            <div key={date} className={styles.dateGroup}>
              <h3 className={styles.dateHeader}>{date}</h3>
              <div className={styles.notesList}>
                {dateNotes.map((note) => (
                  <Card
                    key={note.id}
                    variant="outlined"
                    onClick={() => setSelectedNote(note)}
                  >
                    <div className={styles.noteCard}>
                      <h4>{note.subject}</h4>
                      <p className={styles.teacher}>선생님: {note.teacher}</p>
                      <p className={styles.content}>{note.content}</p>
                      {note.attachments && note.attachments.length > 0 && (
                        <div className={styles.attachments}>
                          <span>첨부파일 ({note.attachments.length})</span>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <p className={styles.emptyMessage}>수업일지가 없습니다.</p>
        </Card>
      )}

      {/* 상세 보기 모달 */}
      {selectedNote && (
        <div className={styles.modal} onClick={() => setSelectedNote(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => setSelectedNote(null)}>
              ✕
            </button>
            <h2>{selectedNote.subject}</h2>
            <p className={styles.modalMeta}>
              {new Date(selectedNote.date).toLocaleDateString()} • {selectedNote.teacher}
            </p>
            <p className={styles.modalContent}>{selectedNote.content}</p>
            {selectedNote.attachments && selectedNote.attachments.length > 0 && (
              <div className={styles.modalAttachments}>
                <h4>첨부파일</h4>
                <ul>
                  {selectedNote.attachments.map((file, idx) => (
                    <li key={idx}>{file}</li>
                  ))}
                </ul>
              </div>
            )}
            <CommentThread noteId={selectedNote.id} />
          </div>
        </div>
      )}
    </div>
  );
}
