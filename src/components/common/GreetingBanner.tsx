'use client';

import React from 'react';
import styles from './GreetingBanner.module.css';

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '좋은 아침이에요';
  if (hour < 18) return '안녕하세요';
  return '늦은 시간까지 고생 많으세요';
}

/**
 * KHIA Learning Hub 스타일의 인사 배너 (파란 그라데이션 + 장식 원)
 * 각 대시보드 상단에 사용
 */
export function GreetingBanner({
  name,
  subtitle = '오늘의 소식을 한눈에 확인해보세요.',
}: {
  name: string;
  subtitle?: string;
}) {
  return (
    <div className={styles.banner}>
      <span className={styles.circleA} />
      <span className={styles.circleB} />
      <div className={styles.title}>
        {getTimeGreeting()}, {name}님! 👋
      </div>
      <div className={styles.subtitle}>{subtitle}</div>
    </div>
  );
}

export default GreetingBanner;
