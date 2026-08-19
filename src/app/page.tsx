import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#EAF6FC] flex items-center justify-center p-4">
      {/* 중앙 콘텐츠 박스 */}
      <div className="bg-white rounded-[28px] shadow-[0_20px_50px_-24px_rgba(3,145,211,0.4)] border border-[#0391D3]/10 p-8 md:p-12 max-w-md w-full text-center">
        {/* 로고/제목 */}
        <div className="mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/khia-crest.png" alt="KHIA" className="h-16 w-auto mx-auto mb-2" />
          <h1 className="text-4xl font-extrabold text-[#0E2C44]">
            My KHIA
          </h1>
          <p className="text-lg font-semibold text-[#0391D3] mt-1">Parent Portal</p>
        </div>

        {/* 환영 배너 */}
        <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#0391D3] via-[#1287C7] to-[#0E6FB8] p-6 mb-6 shadow-[0_12px_28px_-12px_rgba(3,145,211,0.45)]">
          <span className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
          <span className="absolute right-4 -bottom-8 w-16 h-16 rounded-full bg-white/10" />
          <h2 className="relative text-2xl font-extrabold text-white">Welcome! 👋</h2>
          <p className="relative text-white/90 text-sm mt-1">
            Everything about our school, all in one place!
          </p>
        </div>

        {/* 설명 */}
        <p className="text-gray-600 mb-8 leading-relaxed">
          Easily check homework, grades, and photos.
        </p>

        {/* 로그인 버튼 */}
        <Link
          href="/login"
          className="inline-block w-full bg-[#0391D3] hover:bg-[#0E6FB8] text-white font-bold py-3 px-6 rounded-2xl shadow-[0_10px_24px_-8px_rgba(3,145,211,0.6)] transition mb-4"
        >
          Log In
        </Link>

        {/* 추가 정보 */}
        <p className="text-sm text-gray-500">
          Have a question?
          <br />
          Ask your teacher!
        </p>
      </div>
    </div>
  );
}
