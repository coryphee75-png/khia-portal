import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 flex items-center justify-center p-4">
      {/* 중앙 콘텐츠 박스 */}
      <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-12 max-w-md text-center">
        {/* 로고/제목 */}
        <div className="mb-6">
          <div className="text-5xl mb-2">🎓</div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">
            KHIA
          </h1>
          <p className="text-lg text-gray-600 mt-1">포탈</p>
        </div>

        {/* 환영 메시지 */}
        <h2 className="text-3xl font-bold text-gray-800 mb-4">
          환영합니다! 👋
        </h2>

        {/* 설명 */}
        <p className="text-gray-600 mb-8 leading-relaxed">
          우리 학교의 모든 소식을 한곳에서 만나보세요!
          <br />
          <br />
          숙제, 성적, 사진을 쉽게 확인할 수 있습니다.
        </p>

        {/* 로그인 버튼 */}
        <Link
          href="/login"
          className="inline-block w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg transition transform hover:scale-105 mb-4"
        >
          🔐 관리자 로그인
        </Link>

        {/* 추가 정보 */}
        <p className="text-sm text-gray-500">
          궁금한 점이 있나요?
          <br />
          선생님에게 물어봐주세요!
        </p>
      </div>
    </div>
  );
}
