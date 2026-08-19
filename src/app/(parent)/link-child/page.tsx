'use client';

import React, { useState } from 'react';
import styles from './page.module.css';

/**
 * 자녀 추가 등록 페이지 - 승인된 학부모가 형제/자매 등 추가 자녀를 학번/코드로 연결
 */
export default function LinkChildPage() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!code.trim()) {
      setError('학번/코드를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/parent/link-child', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result?.error || '자녀 연결에 실패했습니다.');
      }
      setSuccessMessage(`${result.data.childName} 학생이 내 자녀로 연결되었습니다!`);
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1>자녀 추가 등록</h1>
      <p className={styles.subtitle}>
        형제/자매 등 추가로 연결할 자녀의 학번/코드를 입력해주세요. 코드는 담당 선생님 또는 관리자에게
        받으실 수 있어요.
      </p>

      <div className={styles.box}>
        {error && <div className={styles.error}>{error}</div>}
        {successMessage && <div className={styles.success}>{successMessage}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="예: 4F7K2QXR"
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !code.trim()}>
            {isLoading ? '연결 중...' : '자녀 연결하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
