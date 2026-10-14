'use client';

import React from 'react';
import {
  EXAM_FILE_ACCEPT,
  EXAM_FILE_KINDS,
  EXAM_FILE_KIND_HINTS,
  EXAM_FILE_KIND_LABELS,
  ExamFileKind,
  formatFileSize,
} from '@/lib/grading';
import styles from '@/app/grading/grading.module.css';

export interface PanelFileItem {
  key: string;
  kind: ExamFileKind;
  fileName: string;
  sizeBytes: number | null;
  /** 업로드 완료된 파일만 주소가 있음 (시험 저장 전 대기 파일은 없음) */
  url?: string;
}

/**
 * 시험 자료 업로드 패널 - 시험지 샘플 / 답지 / 루브릭 / 기타 자료 칸별로 파일을 올리고 지움
 * (화면 표시만 담당하고, 실제 업로드/삭제는 부모 컴포넌트가 처리)
 */
export default function ExamFilesPanel({
  files,
  busyKinds = [],
  onAdd,
  onRemove,
}: {
  files: PanelFileItem[];
  busyKinds?: ExamFileKind[];
  onAdd: (kind: ExamFileKind, files: File[]) => void;
  onRemove: (item: PanelFileItem) => void;
}) {
  return (
    <div className={styles.fileGrid}>
      {EXAM_FILE_KINDS.map((kind) => {
        const items = files.filter((f) => f.kind === kind);
        const busy = busyKinds.includes(kind);
        return (
          <div key={kind} className={styles.fileSlot}>
            <div className={styles.fileSlotHeader}>
              <div>
                <div className={styles.fileSlotTitle}>{EXAM_FILE_KIND_LABELS[kind]}</div>
                <div className={styles.fileSlotHint}>{EXAM_FILE_KIND_HINTS[kind]}</div>
              </div>
              <label className={styles.ghostBtn} aria-disabled={busy}>
                {busy ? '올리는 중...' : '+ 파일'}
                <input
                  type="file"
                  multiple
                  accept={EXAM_FILE_ACCEPT}
                  disabled={busy}
                  hidden
                  onChange={(e) => {
                    const picked = Array.from(e.target.files || []);
                    e.target.value = '';
                    if (picked.length) onAdd(kind, picked);
                  }}
                />
              </label>
            </div>

            {items.length === 0 ? (
              <div className={styles.fileEmpty}>아직 올린 파일이 없습니다.</div>
            ) : (
              <ul className={styles.fileList}>
                {items.map((item) => (
                  <li key={item.key} className={styles.fileItem}>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.fileName}>
                        {item.fileName}
                      </a>
                    ) : (
                      <span className={styles.fileName}>{item.fileName}</span>
                    )}
                    <span className={styles.fileSize}>{formatFileSize(item.sizeBytes)}</span>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => onRemove(item)}
                      aria-label={`${item.fileName} 삭제`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
