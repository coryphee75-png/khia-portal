# KHIA 포탈 프로젝트

학부모를 위한 통합 포탈 시스템입니다. 아이의 숙제, 수업일지, 평가, 앨범 등을 한 곳에서 확인할 수 있습니다.

## 🚀 주요 기능

- **로그인**: NextAuth를 사용한 안전한 인증
- **대시보드**: 자녀 정보, 최근 숙제, 수업일지, 평가 한눈에 보기
- **숙제 관리**: 숙제 목록 조회 및 상태 추적 (진행중, 완료, 기한초과)
- **수업일지**: 날짜별 수업 내용 및 첨부파일 관리
- **평가**: 성적 조회 및 통계
- **앨범**: 학교 행사 및 활동 사진 갤러리

## 📁 프로젝트 구조

```
khia-portal/
├── app/                          # Next.js 앱 디렉토리
│   ├── (parent)/                # 학부모 라우트 그룹
│   │   ├── layout.tsx            # 학부모 레이아웃
│   │   ├── dashboard/            # 대시보드
│   │   ├── homeworks/            # 숙제
│   │   ├── notes/                # 수업일지
│   │   ├── evaluations/          # 평가
│   │   └── albums/               # 앨범
│   ├── login/                    # 로그인 페이지
│   ├── api/                      # API 라우트
│   │   └── auth/
│   │       └── [...nextauth]/    # NextAuth 핸들러
│   │   └── parent/
│   │       ├── dashboard/        # 대시보드 API
│   │       ├── homeworks/        # 숙제 API
│   │       ├── notes/            # 수업일지 API
│   │       ├── evaluations/      # 평가 API
│   │       └── albums/           # 앨범 API
│   ├── globals.css               # 전역 스타일
│   ├── layout.tsx                # 루트 레이아웃
│   ├── page.tsx                  # 메인 페이지 (리다이렉트)
│   └── SessionProvider.tsx       # NextAuth 세션 제공자
├── src/
│   ├── app/                      # 추가 앱 파일
│   ├── components/
│   │   └── common/
│   │       ├── Card.tsx          # 카드 컴포넌트
│   │       ├── Card.module.css
│   │       ├── Header.tsx        # 헤더 컴포넌트
│   │       └── Header.module.css
│   ├── lib/
│   │   ├── auth.ts              # NextAuth 설정
│   │   ├── db.ts                # 데이터베이스 연결
│   │   └── constants.ts         # 상수
│   └── types/
│       └── index.ts             # TypeScript 타입 정의
├── middleware.ts                 # 라우트 보호 미들웨어
├── .env.local                   # 환경 변수 (로컬)
├── next.config.ts               # Next.js 설정
├── package.json                 # 의존성
└── tsconfig.json                # TypeScript 설정
```

## 🛠 설치 및 실행

### 필수 요구사항
- Node.js 18+ 
- npm 또는 yarn
- PostgreSQL (선택사항, 더미 데이터 사용 가능)

### 설치

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
# .env.local 파일을 프로젝트 루트에 생성하고 필요한 변수 입력
cp .env.local.example .env.local
```

### 환경 변수 설정

`.env.local` 파일:
```env
# NextAuth 설정
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# 데이터베이스 설정 (선택사항)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-password
DB_NAME=khia_portal

# API
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# 환경
NODE_ENV=development
```

### 개발 서버 실행

```bash
npm run dev
```

서버가 [http://localhost:3000](http://localhost:3000)에서 시작됩니다.

### 테스트 계정

```
이메일: parent@example.com
비밀번호: password
```

## 📦 주요 의존성

- **Next.js 15+**: React 프레임워크
- **NextAuth.js**: 인증 솔루션
- **TypeScript**: 타입 안정성
- **PostgreSQL**: 데이터베이스 (선택사항)
- **CSS Modules**: 컴포넌트 스타일링

## 🔐 보안 기능

- 역할 기반 접근 제어 (Role-Based Access Control)
- 세션 타임아웃 설정 (30분)
- 미들웨어를 통한 라우트 보호
- CSRF 보호

## 🎨 스타일링

- **CSS Modules**: 컴포넌트별 스타일 격리
- **Tailwind CSS**: 유틸리티 기반 스타일링
- **그래디언트**: 모던한 디자인

## 🚀 배포

### Vercel로 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel
```

### 환경 변수 설정

Vercel 대시보드에서 환경 변수를 설정하세요:
- `NEXTAUTH_URL`: 프로덕션 URL
- `NEXTAUTH_SECRET`: 안전한 시크릿 키 생성

## 📝 개발 가이드

### 새로운 페이지 추가

```tsx
// src/app/(parent)/new-page/page.tsx
export default function NewPage() {
  return (
    <div>
      {/* 컨텐츠 */}
    </div>
  );
}
```

### 새로운 API 라우트 추가

```ts
// src/app/api/parent/new-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return NextResponse.json({ data: [] });
}
```

### 데이터베이스 쿼리

```ts
import { query, queryOne } from '@/lib/db';
import { User } from '@/types';

// 여러 행 조회
const users = await query<User>('SELECT * FROM users');

// 단일 행 조회
const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', ['1']);
```

## 🐛 문제 해결

### 로그인 실패
- `.env.local` 파일이 존재하는지 확인
- `NEXTAUTH_SECRET` 값이 설정되어 있는지 확인
- 브라우저 쿠키가 활성화되어 있는지 확인

### 데이터베이스 연결 오류
- PostgreSQL 서버가 실행 중인지 확인
- 환경 변수에서 호스트, 포트, 사용자명 확인
- 데이터베이스가 생성되어 있는지 확인

## 📚 추가 리소스

- [Next.js 문서](https://nextjs.org/docs)
- [NextAuth.js 문서](https://next-auth.js.org)
- [TypeScript 문서](https://www.typescriptlang.org/docs)

## 📄 라이선스

프라이빗 프로젝트

## 👨‍💻 개발자

KHIA 포탈 팀

---

**주의**: 이 프로젝트의 초기 설정입니다. 프로덕션 배포 전에 보안, 데이터베이스, 인증 등을 검토하세요.
