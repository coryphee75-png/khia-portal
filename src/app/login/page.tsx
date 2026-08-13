'use client';

import React, { useState } from 'react';
import Link from 'next/link';

/**
 * 로그인 페이지 - 3가지 역할별 로그인
 */
type UserRole = 'parent' | 'teacher' | 'student';

const roleInfo = {
  parent: {
    icon: '👨‍👩‍👧‍👦',
    name: '학부모',
    email: 'parent@example.com',
    password: 'password',
    color: 'from-blue-400 to-blue-600',
  },
  teacher: {
    icon: '👨‍🏫',
    name: '선생님',
    email: 'teacher@example.com',
    password: 'password',
    color: 'from-purple-400 to-purple-600',
  },
  student: {
    icon: '👨‍🎓',
    name: '학생',
    email: 'student@example.com',
    password: 'password',
    color: 'from-pink-400 to-pink-600',
  },
};

export default function LoginPage() {
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

  // 로그인 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // 테스트용 간단한 검증
    if (!email || !password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      setIsLoading(false);
      return;
    }

    // 여기서 실제 로그인 로직을 추가할 수 있습니다
    // 지금은 테스트용으로 간단하게 처리
    setTimeout(() => {
      if (
        email === roleInfo[role].email &&
        password === roleInfo[role].password
      ) {
        alert(`${roleInfo[role].name} 로그인 성공! 🎉`);
        // router.push('/dashboard');
      } else {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.');
      }
      setIsLoading(false);
    }, 500);
  };

  const current = roleInfo[role];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 max-w-md w-full">
        {/* 헤더 */}
        <Link href="/" className="flex justify-center mb-6">
          <div className="text-center">
            <div className="text-4xl mb-2">🎓</div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">
              KHIA
            </h1>
          </div>
        </Link>

        {/* 탭 버튼 */}
        <div className="flex gap-2 mb-6">
          {(Object.keys(roleInfo) as UserRole[]).map((r) => (
            <button
              key={r}
              onClick={() => handleTabChange(r)}
              className={`flex-1 py-2 px-3 rounded-lg font-bold transition ${
                role === r
                  ? `bg-gradient-to-r ${roleInfo[r].color} text-white`
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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

          {/* 이메일 입력 */}
          <div>
            <label className="block text-gray-700 font-bold mb-2">
              📧 이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 transition"
              placeholder="이메일을 입력하세요"
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
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 transition"
              placeholder="비밀번호를 입력하세요"
              disabled={isLoading}
            />
          </div>

          {/* 로그인 버튼 */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-lg font-bold text-white transition transform hover:scale-105 ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : `bg-gradient-to-r ${current.color} hover:shadow-lg`
            }`}
          >
            {isLoading ? '로그인 중... ⏳' : '🚀 로그인'}
          </button>
        </form>

        {/* 테스트 계정 정보 */}
        <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded">
          <p className="text-sm font-bold text-gray-700 mb-2">💡 테스트 계정</p>
          <p className="text-xs text-gray-600">
            📧 {current.email}
            <br />
            🔑 {current.password}
          </p>
        </div>

        {/* 홈 링크 */}
        <div className="text-center mt-4">
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-purple-600 transition"
          >
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

          <div className={styles.formGroup}>
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요"
              required
              disabled={isLoading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              required
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={isLoading}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className={styles.demoInfo}>
          <p>테스트 계정:</p>
          <p>이메일: parent@example.com</p>
          <p>비밀번호: password</p>
        </div>
      </div>
    </div>
  );
}
