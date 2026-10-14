# KHIA Portal - 빠른 시작 가이드

## ✅ 초기화 완료 항목

프로젝트가 완전히 초기화되었습니다! 다음 항목들이 생성되었습니다:

### 📁 디렉토리 및 파일

#### 라이브러리 파일
- ✅ `src/lib/constants.ts` - 라우트, 색상, 상수 정의
- ✅ `src/lib/db.ts` - PostgreSQL 데이터베이스 연결
- ✅ `src/lib/auth.ts` - NextAuth 설정
- ✅ `src/types/index.ts` - TypeScript 타입 정의

#### 컴포넌트
- ✅ `src/components/common/Card.tsx` - 재사용 가능한 카드
- ✅ `src/components/common/Header.tsx` - 헤더 컴포넌트

#### 페이지
- ✅ `src/app/login/page.tsx` - 로그인 페이지
- ✅ `src/app/(parent)/layout.tsx` - 학부모 레이아웃
- ✅ `src/app/(parent)/dashboard/page.tsx` - 대시보드
- ✅ `src/app/(parent)/homeworks/page.tsx` - 숙제 목록
- ✅ `src/app/(parent)/notes/page.tsx` - 수업일지
- ✅ `src/app/(parent)/evaluations/page.tsx` - 평가
- ✅ `src/app/(parent)/albums/page.tsx` - 앨범

#### API 라우트
- ✅ `src/app/api/auth/[...nextauth]/route.ts` - NextAuth 핸들러
- ✅ `src/app/api/parent/dashboard/route.ts` - 대시보드 데이터
- ✅ `src/app/api/parent/homeworks/route.ts` - 숙제 API
- ✅ `src/app/api/parent/notes/route.ts` - 수업일지 API
- ✅ `src/app/api/parent/evaluations/route.ts` - 평가 API
- ✅ `src/app/api/parent/albums/route.ts` - 앨범 API

#### 설정 파일
- ✅ `.env.local` - 환경 변수
- ✅ `middleware.ts` - 라우트 보호

## 🚀 다음 단계

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 수정하세요:

```env
# NextAuth 설정
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-change-in-production

# 데이터베이스 (선택사항)
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

**Important**: 프로덕션에서는 `NEXTAUTH_SECRET`을 안전한 값으로 변경하세요:
```bash
openssl rand -base64 32
```

### 3. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 열기

### 4. 테스트 로그인

```
이메일: parent@example.com
비밀번호: password
```

## 📝 주요 기능

| 기능 | URL | 상태 |
|------|-----|------|
| 로그인 | `/login` | ✅ 구현됨 |
| 대시보드 | `/dashboard` | ✅ 구현됨 |
| 숙제 | `/homeworks` | ✅ 구현됨 |
| 수업일지 | `/notes` | ✅ 구현됨 |
| 평가 | `/evaluations` | ✅ 구현됨 |
| 앨범 | `/albums` | ✅ 구현됨 |

## 🔧 기술 스택

- **Framework**: Next.js 15+
- **Authentication**: NextAuth.js
- **Database**: PostgreSQL (선택사항)
- **Language**: TypeScript
- **Styling**: CSS Modules + Tailwind CSS
- **Component Pattern**: React + Server/Client Components

## 📚 구조 설명

### 라우팅
- 공개 라우트: `/login`, `/`
- 보호된 라우트: `/dashboard`, `/homeworks` 등
- 라우트 그룹: `(parent)` - 학부모 섹션 조직화

### 인증 흐름
1. 사용자가 `/login`에서 로그인
2. NextAuth이 credentials 검증
3. 세션 생성 및 JWT 토큰 발급
4. 미들웨어가 라우트 보호
5. 미인증 사용자는 자동으로 로그인 페이지로 리다이렉트

### API 패턴
```
GET  /api/parent/{resource}      # 목록 조회
POST /api/parent/{resource}      # 생성
PUT  /api/parent/{resource}/{id} # 수정
DEL  /api/parent/{resource}/{id} # 삭제
```

## ⚠️ 주의사항

### 현재 상태
- 🟡 **Mock 데이터 사용**: 실제 데이터베이스 연결 필요
- 🟡 **비밀번호 해싱 미구현**: bcrypt 추가 필요
- 🟡 **파일 업로드 미구현**: multer/uploadthing 추가 필요
- 🟡 **이메일 알림 미구현**: 이메일 서비스 통합 필요

### 프로덕션 체크리스트
- [ ] PostgreSQL 데이터베이스 설정
- [ ] 비밀번호 해싱 (bcrypt) 구현
- [ ] 파일 업로드 서비스 통합 (AWS S3, Cloudinary 등)
- [ ] 환경 변수 암호화
- [ ] HTTPS 설정
- [ ] 에러 핸들링 개선
- [ ] 로깅 시스템 추가
- [ ] 모니터링 설정

## 🆘 문제 해결

### 로그인 실패
```
확인사항:
1. .env.local 파일이 존재하는지
2. NEXTAUTH_SECRET이 설정되어 있는지
3. 브라우저 쿠키가 활성화되어 있는지
```

### 모듈 import 오류
```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
```

### 포트 충돌
```bash
# 다른 포트에서 실행
npm run dev -- -p 3001
```

## 📖 유용한 링크

- [Next.js 문서](https://nextjs.org/docs)
- [NextAuth.js 문서](https://next-auth.js.org)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs)
- [PostgreSQL 문서](https://www.postgresql.org/docs)

## 💡 팁

- VS Code의 "REST Client" 확장으로 API 테스트
- DevTools의 Network 탭에서 API 요청 확인
- 로컬 스토리지에서 세션 토큰 확인 가능

---

**질문이나 문제가 있으시면, 프로젝트 README 또는 각 파일의 주석을 참고하세요.**

Happy Coding! 🎉
