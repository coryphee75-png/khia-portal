'use client';

import React, { useState } from 'react';
import Link from 'next/link';

/**
 * 학부모 회원가입 페이지 - 로그인 없이 누구나 접근 가능
 * 이메일 대신 아이디(문자/숫자)로 가입합니다. 자녀의 학번/코드(관리자가 발급, 가정통신문 등으로 전달)를
 * 입력해서 자녀와 연결한 뒤 관리자 승인을 받아야 로그인할 수 있습니다.
 */
export default function SignupPage() {
  const [name, setName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [idAvailable, setIdAvailable] = useState(false);
  const [successChildName, setSuccessChildName] = useState('');

  const handleIdChange = (value: string) => {
    setLoginId(value);
    setIdAvailable(false); // 아이디를 바꾸면 다시 중복확인 해야 함
  };

  const checkIdAvailable = async () => {
    const id = loginId.trim();
    if (!id) {
      alert('아이디를 먼저 입력해주세요.');
      return;
    }
    setIsChecking(true);
    try {
      const res = await fetch(`/api/signup/check-id?id=${encodeURIComponent(id)}`);
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result?.error || '중복확인에 실패했습니다.');
      }
      if (result.data.available) {
        setIdAvailable(true);
        alert('사용 가능한 아이디입니다.');
      } else {
        setIdAvailable(false);
        alert('이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !loginId || !password || !code) {
      alert('모든 항목을 입력해주세요.');
      return;
    }
    if (!idAvailable) {
      alert('아이디 중복확인을 먼저 해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, loginId, password, code }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        // 아이디가 그 사이 다른 사람에게 선점된 경우 등, 서버에서 최종 거부되면 팝업으로 안내
        if (result?.error && result.error.includes('아이디')) {
          setIdAvailable(false);
        }
        throw new Error(result?.error || '가입 신청에 실패했습니다.');
      }
      setSuccessChildName(result.data.childName);
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (successChildName) {
    return (
      <div className="min-h-screen bg-[#EAF6FC] flex items-center justify-center p-4">
        <div className="bg-white rounded-[28px] shadow-[0_20px_50px_-24px_rgba(3,145,211,0.4)] border border-[#0391D3]/10 p-8 md:p-12 max-w-md w-full text-center">
          <div className="text-4xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">가입 신청이 완료되었습니다</h1>
          <p className="text-gray-600 mb-6">
            <strong>{successChildName}</strong> 학생의 학부모로 신청되었습니다. 관리자 승인 후 로그인할 수
            있어요. 승인되면 안내를 받으신 뒤 로그인해주세요.
          </p>
          <Link
            href="/login"
            className="inline-block w-full py-3 px-4 rounded-lg font-bold text-white bg-[#0391D3] hover:bg-[#0E6FB8] transition"
          >
            로그인 화면으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EAF6FC] flex items-center justify-center p-4">
      <div className="bg-white rounded-[28px] shadow-[0_20px_50px_-24px_rgba(3,145,211,0.4)] border border-[#0391D3]/10 p-8 md:p-12 max-w-md w-full">
        <Link href="/" className="flex justify-center mb-6">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/khia-crest.png" alt="KHIA" className="h-12 w-auto mx-auto mb-2" />
            <h1 className="text-2xl font-bold text-[#0E2C44]">
              My KHIA
            </h1>
          </div>
        </Link>

        <h2 className="text-lg font-bold text-gray-800 mb-1 text-center">학부모 회원가입</h2>
        <p className="text-sm text-gray-500 mb-6 text-center">
          자녀의 학번/코드는 담당 선생님 또는 관리자에게 받으실 수 있어요.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0391D3] transition"
              placeholder="학부모님 성함"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm">🆔 아이디</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={loginId}
                onChange={(e) => handleIdChange(e.target.value)}
                className="flex-1 min-w-0 px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0391D3] transition"
                placeholder="로그인에 사용할 아이디"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={checkIdAvailable}
                disabled={isChecking || isLoading || !loginId.trim()}
                className={`shrink-0 px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition ${
                  isChecking || isLoading || !loginId.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#EAF6FC] text-[#0391D3] hover:bg-[#d8eef8]'
                }`}
              >
                {isChecking ? '확인 중...' : '중복확인'}
              </button>
            </div>
            {idAvailable && (
              <p className="text-xs text-green-600 mt-1">✅ 사용 가능한 아이디입니다.</p>
            )}
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm">🔑 비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0391D3] transition"
              placeholder="4자 이상"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm">🔢 자녀 학번/코드</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#0391D3] transition tracking-widest"
              placeholder="예: 4F7K2QXR"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-lg font-bold text-white transition ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-[#0391D3] hover:bg-[#0E6FB8]'
            }`}
          >
            {isLoading ? '신청 중...' : '가입 신청'}
          </button>
        </form>

        <div className="text-center mt-4 space-y-2">
          <p className="text-sm text-gray-600">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-[#0391D3] font-bold hover:underline">
              로그인
            </Link>
          </p>
          <Link href="/" className="block text-sm text-gray-600 hover:text-[#0391D3] transition">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
