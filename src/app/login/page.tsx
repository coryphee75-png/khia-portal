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

const roleInfo: Record<UserRole, { name: string; email: string; password: string }> = {
  parent: {
    name: 'PARENT',
    email: 'parent@example.com',
    password: 'password',
  },
  teacher: {
    name: 'TEACHER',
    email: 'teacher@example.com',
    password: 'password',
  },
  student: {
    name: 'STUDENT',
    email: 'student@example.com',
    password: 'password',
  },
  admin: {
    name: 'ADMIN',
    email: 'admin@example.com',
    password: 'password',
  },
};

// 세련된 라인 아이콘 (이모지 대체)
const roleIcons: Record<UserRole, React.ReactElement> = {
  parent: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="8" cy="8" r="2.6" />
      <path d="M3.5 19c0-3 2-5 4.5-5s4.5 2 4.5 5" />
      <circle cx="16.5" cy="9" r="2.1" />
      <path d="M13.7 19c.2-2.4 1.7-4 2.8-4 1.8 0 3.5 1.7 3.9 4" />
    </svg>
  ),
  teacher: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="4" y="4" width="16" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
      <path d="M8 9h5M8 12h3" />
    </svg>
  ),
  student: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M2 8l10-4 10 4-10 4-10-4z" />
      <path d="M6 10.5V16c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5.5" />
      <path d="M22 8v6" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="2.8" />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M17.7 6.3l-1.5 1.5M7.8 16.2l-1.5 1.5M17.7 17.7l-1.5-1.5M7.8 7.8L6.3 6.3" />
    </svg>
  ),
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
      setError('Please enter your ID and password.');
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
      setError('Incorrect ID or password.');
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
              className={`flex-1 py-2 px-2 rounded-lg font-bold transition flex flex-col items-center gap-1 ${
                role === r
                  ? 'bg-[#0391D3] text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {roleIcons[r]}
              <div className="text-[11px] tracking-wide">{roleInfo[r].name}</div>
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
              ID
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0391D3] transition"
              placeholder="Enter your ID"
              disabled={isLoading}
            />
          </div>

          {/* 비밀번호 입력 */}
          <div>
            <label className="block text-gray-700 font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0391D3] transition"
              placeholder="Enter your password"
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
            {isLoading ? 'Signing in...' : 'Log In'}
          </button>
        </form>

        {/* 테스트 계정 정보 */}
        <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
          <p className="text-sm font-bold text-gray-700 mb-2">Test Account</p>
          <p className="text-xs text-gray-600">
            ID: {current.email}
            <br />
            Password: {current.password}
          </p>
        </div>

        {/* 회원가입 / 홈 링크 */}
        <div className="text-center mt-4 space-y-2">
          <p className="text-sm text-gray-600">
            Are you a parent?{' '}
            <Link href="/signup" className="text-[#0391D3] font-bold hover:underline">
              Sign up
            </Link>
          </p>
          <Link
            href="/"
            className="block text-sm text-gray-600 hover:text-[#0391D3] transition"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
