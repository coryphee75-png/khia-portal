# ✅ KHIA Portal - 초기화 체크리스트

프로젝트 초기화 후 확인사항 및 다음 단계입니다.

## 📋 초기화 확인

### 1. 파일 생성 확인
- [x] 라이브러리 파일 (constants, db, auth, types)
- [x] 컴포넌트 (Card, Header)
- [x] 페이지 (login, dashboard, homeworks, notes, evaluations, albums)
- [x] API 라우트 (auth, parent endpoints)
- [x] 설정 파일 (middleware, .env.local)
- [x] 문서 (README, 가이드)

### 2. 디렉토리 구조 확인
```
✅ src/lib/        - 라이브러리
✅ src/types/      - 타입 정의
✅ src/components/ - 컴포넌트
✅ src/app/        - 페이지
✅ middleware.ts   - 라우트 보호
✅ .env.local      - 환경 변수
```

## 🚀 시작 전 체크리스트

### 1단계: 기본 설정
```bash
# 1. 프로젝트 루트에서 의존성 설치
npm install

# 2. .env.local 파일 확인
cat .env.local  # 또는 편집기에서 열기

# 3. 개발 서버 시작
npm run dev
```

### 2단계: 브라우저 테스트
- [ ] http://localhost:3000 접속
- [ ] 로그인 페이지 확인
- [ ] 테스트 계정으로 로그인
  - 이메일: `parent@example.com`
  - 비밀번호: `password`
- [ ] 대시보드 페이지 확인
- [ ] 각 메뉴 클릭 확인
  - [ ] 숙제
  - [ ] 수업일지
  - [ ] 평가
  - [ ] 앨범

### 3단계: 기능 테스트
- [ ] 로그아웃 기능 테스트
- [ ] 미인증 상태에서 대시보드 접속 시도 (로그인으로 리다이렉트)
- [ ] 반응형 디자인 테스트 (모바일/태블릿/데스크톱)
- [ ] 데이터 로딩 확인 (mock 데이터)

## ⚙️ 환경 변수 설정

### 필수 설정 (현재)
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
```

### 선택 설정 (프로덕션)
```env
# 데이터베이스
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-password
DB_NAME=khia_portal

# 이메일 (선택사항)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# 파일 업로드 (선택사항)
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET_NAME=your-bucket
```

## 🔧 개발 환경 설정 (선택사항)

### VS Code 확장 프로그램 추천
- [ ] ES7+ React/Redux/React-Native snippets
- [ ] Prettier - Code formatter
- [ ] TypeScript Vue Plugin
- [ ] REST Client (API 테스트용)
- [ ] Database Client (DB 관리용)

### 개발 도구 설정
- [ ] VS Code 또는 WebStorm
- [ ] Git 설정
- [ ] ESLint/Prettier 설정

## 📱 테스트 데이터

### 테스트 계정
```
역할: Parent (학부모)
이메일: parent@example.com
비밀번호: password
```

### 샘플 데이터 (API에서 반환)
- 자녀 2명: "김학생" (3학년 2반), "김학생 2" (1학년 3반)
- 숙제 3개: 수학, 영어, 국어
- 수업일지 4개: 날짜별 정렬
- 평가 5개: 다양한 과목
- 앨범 3개: 행사 사진

## 🔒 보안 체크리스트

### 로컬 개발
- [x] NextAuth 설정
- [x] 세션 관리
- [x] 라우트 보호
- [x] 미들웨어 설정

### 프로덕션 준비
- [ ] `NEXTAUTH_SECRET` 변경
  ```bash
  openssl rand -base64 32
  ```
- [ ] HTTPS 설정
- [ ] 데이터베이스 보안
- [ ] 환경 변수 암호화
- [ ] 레이트 리미팅 추가
- [ ] CORS 설정

## 📊 성능 최적화 (선택사항)

### 이미지 최적화
- [ ] 이미지 포맷 최적화 (WebP)
- [ ] 이미지 리사이징
- [ ] 레이지 로딩

### 번들 최적화
```bash
# 번들 분석
npm run build
npm run analyze
```

### 캐싱 전략
- [ ] 정적 페이지 캐싱
- [ ] API 응답 캐싱
- [ ] 이미지 캐싱

## 🐛 문제 해결

### 로그인 실패
```
확인:
1. .env.local 파일 존재 여부
2. NEXTAUTH_SECRET 값 설정
3. 브라우저 쿠키 활성화
4. 콘솔 에러 메시지 확인
```

### 페이지 로딩 오류
```
해결:
1. npm install 다시 실행
2. .next 폴더 삭제
3. npm run dev 재시작
4. 브라우저 캐시 삭제
```

### API 연결 오류
```
확인:
1. 개발 서버 실행 여부
2. API 엔드포인트 확인
3. 네트워크 탭에서 요청 확인
4. 서버 콘솔 에러 메시지 확인
```

## 📚 다음 단계

### 1단계: 데이터베이스 연동
```bash
# PostgreSQL 설치
# .env.local에 DB 정보 입력
# src/lib/db.ts의 TODO 부분 구현
```

### 2단계: 비밀번호 해싱
```bash
npm install bcrypt
# src/lib/auth.ts에서 bcrypt 구현
```

### 3단계: 파일 업로드
```bash
npm install multer sharp
# 또는 uploadthing/AWS S3 연동
```

### 4단계: 이메일 알림
```bash
npm install nodemailer
# 또는 SendGrid/AWS SES 연동
```

### 5단계: 배포
```bash
# Vercel CLI 설치
npm install -g vercel

# 프로젝트 배포
vercel
```

## 📖 유용한 명령어

```bash
# 개발 서버
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start

# 코드 린트
npm run lint

# 타입 체크
npx tsc --noEmit

# 패키지 업데이트
npm update

# 특정 패키지 설치
npm install package-name
```

## 🎓 학습 리소스

- [Next.js 공식 문서](https://nextjs.org/docs)
- [NextAuth.js 공식 문서](https://next-auth.js.org)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs)
- [CSS Modules](https://github.com/css-modules/css-modules)
- [PostgreSQL 튜토리얼](https://www.postgresql.org/docs/current/tutorial.html)

## 💡 팁

1. **API 테스트**: VS Code의 "REST Client" 확장 사용
2. **디버깅**: Chrome DevTools의 Network, Console 탭 활용
3. **데이터 확인**: 브라우저 개발자도구의 Application 탭에서 세션 확인
4. **핫 리로드**: 파일 저장 시 자동 리로드 활용
5. **타입 확인**: IDE의 자동 완성과 타입 힌트 활용

## 📞 지원

문제가 발생하면:
1. `QUICK_START.md` 문제 해결 섹션 참고
2. `PROJECT_README.md`에서 더 자세한 설명 확인
3. 파일의 주석과 코드 검토
4. 브라우저 개발자 도구 확인

---

**축하합니다! 프로젝트 초기화가 완료되었습니다!** 🎉

이제 개발을 시작할 수 있습니다. Happy coding! 💻
