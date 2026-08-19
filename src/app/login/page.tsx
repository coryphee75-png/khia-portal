'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn, getSession } from 'next-auth/react';
import { getDashboardRoute } from '@/lib/constants';

/**
 * 로그인 페이지 - 3가지 역할별 로그인 (학부모 / 선생님 / 학생)
 */
type UserRole = 'parent' | 'teacher' | 'student' | 'admin';

const roleInfo: Record<UserRole, { icon: string; name: string; email: string; password: string }> = {
  parent: {
    icon: '👨‍👩‍👧‍👦',
    name: '학부모',
    email: 'parent@example.com',
    password: 'password',
  },
  teacher: {
    icon: '👨‍🏫',
    name: '선생님',
    email: 'teacher@example.com',
    password: 'password',
  },
  student: {
    icon: '👨‍🎓',
    name: '학생',
    email: 'student@example.com',
    password: 'password',
  },
  admin: {
    icon: '🛠️',
    name: '관리자',
    email: 'admin@example.com',
    password: 'password',
  },
};

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>('parent');
  const [email, setEmail] = useState(roleInfo.parent.email);
  const [password, setPassword] = useState(roleInfo.parent.password);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 탭 변경
  const handleTabChange = (newRole: UserRole) => {
    setRole(newRole);
    setEmail(roleInfo[newRole].email);
    setPassword(roleInfo[newRole].password);
    setError('');
  };

  // 로그인 처리 (실제 NextAuth 인증)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setIsLoading(false);

    if (result?.error) {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.');
      return;
    }

    const session = await getSession();
    router.push(getDashboardRoute(session?.user?.role));
    router.refresh();
  };

  const current = roleInfo[role];

  return (
    <div className="min-h-screen bg-[#EAF6FC] flex items-center justify-center p-4">
      <div className="bg-white rounded-[28px] shadow-[0_20px_50px_-24px_rgba(3,145,211,0.4)] border border-[#0391D3]/10 p-8 md:p-12 max-w-md w-full">
        {/* 헤더 */}
        <Link href="/" className="flex justify-center mb-6">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/khia-crest.png" alt="KHIA" className="h-12 w-auto mx-auto mb-2" />
            <h1 className="text-2xl font-bold text-[#0E2C44]">
              My KHIA
            </h1>
          </div>
        </Link>

        {/* 탭 버튼 */}
        <div className="flex gap-2 mb-6">
          {(Object.keys(roleInfo) as UserRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleTabChange(r)}
              className={`flex-1 py-2 px-3 rounded-lg font-bold transition ${
                role === r
                  ? 'bg-[#0391D3] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="text-lg mb-1">{roleInfo[r].icon}</div>
              <div className="text-xs">{roleInfo[r].name}</div>
            </button>
          ))}
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded">
              {error}
            </div>
          )}

          {/* 아이디 입력 */}
          <div>
            <label className="block text-gray-700 font-bold mb-2">
              🆔 아이디
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0391D3] transition"
              placeholder="아이디를 입력하세요"
              disabled={isLoading}
            />
          </div>

          {/* 비밀번호 입력 */}
          <div>
            <label className="block text-gray-700 font-bold mb-2">
              🔑 비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0391D3] transition"
              placeholder="비밀번호를 입력하세요"
              disabled={isLoading}
            />
          </div>

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-lg font-bold text-white transition ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-[#0391D3] hover:bg-[#0E6FB8]'
            }`}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 테스트 계정 정보 */}
        <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
          <p className="text-sm font-bold text-gray-700 mb-2">💡 테스트 계정</p>
          <p className="text-xs text-gray-600">
            🆔 {current.email}
            <br />
            🔑 {current.password}
          </p>
        </div>

        {/* 회원가입 / 홈 링크 */}
        <div className="text-center mt-4 space-y-2">
          <p className="text-sm text-gray-600">
            학부모이신가요? 아직 계정이 없다면{' '}
            <Link href="/signup" className="text-[#0391D3] font-bold hover:underline">
              회원가입
            </Link>
          </p>
          <Link
            href="/"
            className="block text-sm text-gray-600 hover:text-[#0391D3] transition"
          >
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
