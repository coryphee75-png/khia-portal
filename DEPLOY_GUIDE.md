# KHIA 포탈 배포 가이드 (Day 4)

Vercel에 실제로 배포하기 위한 순서입니다. 하나씩 차례대로 따라 하면 됩니다. 막히는 단계가 있으면 화면을 캡처해서 물어보세요.

배포 전에 꼭 알아둘 것: 지금까지는 내 컴퓨터에 있는 PostgreSQL(로컬 DB)과 로컬 폴더(사진 저장)를 썼지만, Vercel은 내 컴퓨터가 아니라 인터넷 어딘가의 서버에서 실행되기 때문에 "인터넷에서 접속 가능한" DB와 저장소가 따로 필요합니다. 그래서 아래 순서에 클라우드 DB(Neon)와 클라우드 저장소(Vercel Blob)를 새로 만드는 과정이 포함되어 있습니다.

---

## 1단계. GitHub에 최신 코드 올리기

VS Code 터미널(코딩용 터미널 말고, 새 터미널 하나 열어서)에서 프로젝트 폴더(`C:\Users\user\khia-portal`)로 이동한 뒤 아래 명령어를 순서대로 입력하세요.

```
git add .
git commit -m "Day 3.5, 3.6, Day 4: 콘텐츠 관리, 사용자 등록, 사진 업로드, 배포 준비"
git push origin main
```

- `git commit` 실행 후 에디터 창이 뜨면 그냥 닫아도 됩니다 (메시지가 이미 입력되어 있어서).
- `git push`가 끝나면 https://github.com/coryphee75-png/khia-portal 에 들어가서 방금 작업한 파일들(`src/app/admin/users` 등)이 실제로 올라갔는지 확인하세요.

---

## 2단계. Vercel 계정 만들고 프로젝트 연결하기

1. https://vercel.com 접속 → "Sign Up" → **"Continue with GitHub"** 선택해서 GitHub 계정으로 가입/로그인 (이미 계정이 있으면 그냥 로그인).
2. 로그인 후 대시보드에서 **"Add New..." → "Project"** 클릭.
3. GitHub 저장소 목록에서 `khia-portal`을 찾아 **"Import"** 클릭.
4. Framework Preset은 자동으로 "Next.js"로 잡힙니다. 다른 설정은 건드리지 말고 아직 **"Deploy" 버튼은 누르지 마세요** — 먼저 3~4단계(DB, 저장소, 환경 변수)를 끝내야 정상 작동합니다. (지금 눌러도 배포는 되지만 로그인/DB 연결이 안 된 상태로 뜹니다.)

---

## 3단계. 클라우드 데이터베이스 만들기 (Neon)

1. 방금 만든 Vercel 프로젝트 화면에서 상단 **"Storage"** 탭 클릭.
2. **"Create Database"** → **"Postgres"** (Neon 제공) 선택 → 이름은 기본값 그대로 두고 **"Create"**.
3. 만들어지면 자동으로 이 Vercel 프로젝트에 연결되면서 `DATABASE_URL`, `POSTGRES_URL` 같은 환경 변수가 **자동으로** 추가됩니다 (직접 입력할 필요 없음).
4. 같은 화면(Storage → 방금 만든 DB → "Query" 또는 "SQL Editor" 탭)에서 SQL을 직접 실행할 수 있습니다. 여기에 `db/schema.sql` 파일 내용을 전체 복사해서 붙여넣고 실행하세요. (VS Code에서 `db/schema.sql` 파일 열어서 전체 선택 → 복사) — 학부모 회원가입 승인 기능(학번/코드, 승인 상태)까지 포함된 최신 스키마이니 이 파일 하나만 실행하면 됩니다.
5. 테이블이 잘 만들어졌는지 확인했으면, 이번엔 **내 컴퓨터**에서 아래처럼 실행해서 테스트 계정(관리자 포함)을 넣습니다:
   - Neon DB 화면에서 "Connection string"(또는 `.env.local` 탭에 보이는 `DATABASE_URL` 값)을 복사
   - VS Code 터미널에서:
     ```
     $env:DATABASE_URL="여기에_복사한_연결_문자열_붙여넣기"
     node scripts/seed.js
     ```
   - "✅ 시드 데이터 삽입 완료!" 메시지가 뜨면 성공입니다.

> ⚠️ 참고: `scripts/seed.js`는 테스트용 계정(admin@example.com 포함)과 예시 데이터를 함께 넣습니다. 나중에 실제 서비스를 시작하면 `/admin/users`에서 진짜 계정들을 등록하고, admin@example.com 같은 테스트 계정은 그대로 두거나 원하면 나중에 지워도 됩니다 (계정 삭제 기능은 아직 없어서, 필요하면 알려주세요 — 만들어 드릴게요).

---

## 4단계. 클라우드 사진 저장소 만들기 (Vercel Blob)

1. Vercel 프로젝트 화면 → **"Storage"** 탭 → **"Create Database"** → **"Blob"** 선택 → **"Create"**.
2. 만들어지면 자동으로 이 프로젝트에 연결되면서 `BLOB_READ_WRITE_TOKEN` 환경 변수가 **자동으로** 추가됩니다.

---

## 5단계. 나머지 환경 변수 직접 입력하기

Vercel 프로젝트 화면 → **"Settings"** → **"Environment Variables"**로 들어가서 아래 값들을 추가하세요 (이름/값을 정확히 입력).

| 이름 | 값 |
|---|---|
| `AUTH_SECRET` | `XFPKum1bw22LNFTiY6nZQdiV4niINIFb6FaPPngxlYE=` (아래 참고) |
| `NEXTAUTH_SECRET` | 위와 동일한 값 |

> 위 `AUTH_SECRET` 값은 지금 임의로 하나 생성해드린 랜덤 값입니다. 이 값 그대로 써도 되고, 더 안전하게 하고 싶으면 https://generate-secret.vercel.app/32 접속해서 나오는 값으로 바꿔도 됩니다. 이 값은 로그인 세션을 암호화하는 데 쓰이는 비밀키라서 외부에 공유하면 안 됩니다.

`DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `AUTH_URL`/`NEXTAUTH_URL`은 3~4단계에서 자동으로 설정되거나(Postgres/Blob), Vercel이 배포 도메인을 자동 인식하기 때문에(`trustHost` 설정) 따로 안 넣어도 됩니다.

---

## 6단계. 배포하기

1. Vercel 프로젝트 화면 상단 **"Deployments"** 탭 → **"Redeploy"** (또는 처음이면 그냥 **"Deploy"**) 클릭.
2. 1~2분 기다리면 "Ready" 상태가 되고 `khia-portal-xxxx.vercel.app` 같은 주소가 생깁니다. 그 주소를 클릭해서 실제 배포된 사이트에 접속해보세요.
3. `admin@example.com` / `password`로 로그인해서 `/admin`, `/admin/users`가 정상적으로 뜨는지 확인하고, 사진 업로드도 한 번 테스트해보세요 (이제 로컬이 아니라 Vercel Blob에 저장되므로 배포 환경에서도 정상 작동해야 합니다).
4. 학부모 회원가입도 함께 테스트해보세요: `/admin/users`에서 학생을 "학부모 나중에 연결"로 하나 등록 → 발급된 코드로 `/signup`에서 가입 신청 → `/admin/users` 상단 "가입 승인 대기"에서 승인 → 그 계정으로 로그인이 되는지 확인.

여기까지 확인되면 Day 4는 끝입니다! 캡처해서 보여주면 Day 5(도메인 연결)로 이어갈게요.
