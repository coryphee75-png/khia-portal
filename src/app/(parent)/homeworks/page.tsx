'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Card from '@/components/common/Card';
import styles from './page.module.css';
import { Homework } from '@/types';

/**
 * 숙제 목록 페이지
 */
export default function HomeworksPage() {
  const { data: session } = useSession();
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');

  useEffect(() => {
    const fetchHomeworks = async () => {
      try {
        const response = await fetch('/api/parent/homeworks');
        if (!response.ok) throw new Error('숙제를 불러올 수 없습니다.');
        const data = await response.json();
        setHomeworks(data.data || []);
      } catch (error) {
        console.error('Homeworks fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHomeworks();
  }, []);

  const filteredHomeworks = homeworks.filter((hw) => {
    if (filter === 'all') return true;
    return hw.status === filter;
  });

  const getStatusBadgeClass = (status: string) => {
    return styles[`status_${status}`] || '';
  };

  return (
    <div className={styles.container}>
      <h1>숙제</h1>

      <div className={styles.filters}>
        <button
          className={filter === 'all' ? styles.active : ''}
          onClick={() => setFilter('all')}
        >
          전체 ({homeworks.length})
        </button>
        <button
          className={filter === 'pending' ? styles.active : ''}
          onClick={() => setFilter('pending')}
        >
          진행중 ({homeworks.filter((h) => h.status === 'pending').length})
        </button>
        <button
          className={filter === 'completed' ? styles.active : ''}
          onClick={() => setFilter('completed')}
        >
          완료 ({homeworks.filter((h) => h.status === 'completed').length})
        </button>
        <button
          className={filter === 'overdue' ? styles.active : ''}
          onClick={() => setFilter('overdue')}
        >
          기한초과 ({homeworks.filter((h) => h.status === 'overdue').length})
        </button>
      </div>

      {isLoading ? (
        <div className={styles.loading}>로딩 중...</div>
      ) : filteredHomeworks.length > 0 ? (
        <div className={styles.homeworkList}>
          {filteredHomeworks.map((homework) => (
            <Card key={homework.id} variant="outlined">
              <div className={styles.homeworkCard}>
                <div className={styles.homeworkHeader}>
                  <h3>{homework.title}</h3>
                  <span className={`${styles.statusBadge} ${getStatusBadgeClass(homework.status)}`}>
                    {homework.status === 'pending'
                      ? '진행중'
                      : homework.status === 'completed'
                        ? '완료'
                        : '기한초과'}
                  </span>
                </div>
                <p className={styles.subject}>{homework.subject}</p>
                <p className={styles.description}>{homework.description}</p>
                <div className={styles.footer}>
                  <span className={styles.dueDate}>
                    마감: {new Date(homework.dueDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <p className={styles.emptyMessage}>
            {filter === 'all' ? '숙제가 없습니다.' : '해당하는 숙제가 없습니다.'}
          </p>
        </Card>
      )}
    </div>
  );
}
