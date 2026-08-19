# KHIA 포탈

KHIA 영어학원 초등반 관리 포탈 — 학부모/선생님/학생을 위한 웹 포탈입니다.

[Next.js](https://nextjs.org)(App Router) + TypeScript + Tailwind CSS + NextAuth(Auth.js) v5 기반으로 제작되었습니다.

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속 후 `/login`에서 아래 테스트 계정으로 로그인할 수 있습니다.

| 역할 | 이메일 | 비밀번호 |
| --- | --- | --- |
| 학부모 | parent@example.com | password |
| 선생님 | teacher@example.com | password |
| 학생 | student@example.com | password |

## 프로젝트 구조

```
src/
  app/            # Next.js App Router 페이지 및 API 라우트
  components/     # 공용 컴포넌트
  lib/            # 인증, DB, 상수 등 라이브러리 코드
  types/          # 공용 타입 정의
```

## 진행 상황

자세한 개발 진행 상황은 [`PROGRESS.md`](./PROGRESS.md)를 참고하세요.

## 배포

배포는 [Vercel](https://vercel.com)을 사용할 예정입니다. 자세한 내용은 [Next.js 배포 문서](https://nextjs.org/docs/app/building-your-application/deploying)를 참고하세요.
