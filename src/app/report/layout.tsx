import React from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

/**
 * 성적표 레이아웃 - 로그인 필요 (헤더/푸터 없이 인쇄용 화면만)
 * 세부 권한(선생님/관리자/본인 자녀 학부모)은 API에서 확인
 */
export default async function ReportLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');
  return <>{children}</>;
}
