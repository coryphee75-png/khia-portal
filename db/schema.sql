-- KHIA 포탈 데이터베이스 스키마 (Day 3)
-- 실행: psql -U postgres -d khia_portal -f db/schema.sql

-- 사용자 (학부모 / 선생님 / 학생)
-- status: 관리자가 직접 만든 계정은 'approved', 학부모가 스스로 회원가입한 계정은 'pending'으로 시작해서
--         관리자 승인을 받아야 로그인할 수 있음 (거절되면 'rejected', 실제로는 계정을 바로 삭제하는 방식 사용)
-- branch: 소속 지점 (Sejong / Gwangyo). 선생님 계정에만 의미가 있고(어느 지점 소속인지),
--         학부모/학생/관리자는 NULL로 둠 (학생은 children.branch로 별도 관리)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('parent', 'teacher', 'student', 'admin')),
  status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  branch VARCHAR(20) CHECK (branch IS NULL OR branch IN ('Sejong', 'Gwangyo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 반 (선생님이 담당)
-- branch: 소속 지점 (Sejong / Gwangyo). 같은 My KHIA 하나를 두 지점이 함께 쓰되, 반은 지점별로 구분됨
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  grade INTEGER NOT NULL,
  branch VARCHAR(20) NOT NULL DEFAULT 'Sejong' CHECK (branch IN ('Sejong', 'Gwangyo')),
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 자녀/학생 (학부모의 자녀이며, 동시에 로그인 가능한 학생 계정과도 연결됨)
-- parent_id: 관리자가 학부모를 바로 지정하면 즉시 채워지고, 학부모 회원가입을 기다리는 경우 NULL로 시작함
-- registration_code: 관리자가 학생 등록 시 자동 발급하는 고유 코드. 학부모가 회원가입할 때 이 코드를 입력해서 자녀와 연결함
-- branch: 소속 지점 (Sejong / Gwangyo). 반 배정과 별개로 학생 자체에 직접 붙여둬서,
--         아직 반 배정 전이거나 반이 없어도 어느 지점 소속 학생인지 바로 알 수 있음
CREATE TABLE IF NOT EXISTS children (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  grade INTEGER NOT NULL,
  class_number VARCHAR(20) NOT NULL,
  parent_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  registration_code VARCHAR(20) UNIQUE NOT NULL,
  student_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  branch VARCHAR(20) NOT NULL DEFAULT 'Sejong' CHECK (branch IN ('Sejong', 'Gwangyo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 숙제
CREATE TABLE IF NOT EXISTS homeworks (
  id SERIAL PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  subject VARCHAR(50) NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 수업일지
CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  subject VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  teacher VARCHAR(100) NOT NULL,
  attachments TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 수업일지 댓글 (학부모 ↔ 담임선생님 소통)
CREATE TABLE IF NOT EXISTS note_comments (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 평가
CREATE TABLE IF NOT EXISTS evaluations (
  id SERIAL PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  subject VARCHAR(50) NOT NULL,
  score INTEGER NOT NULL,
  grade VARCHAR(5) NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 앨범
CREATE TABLE IF NOT EXISTS albums (
  id SERIAL PRIMARY KEY,
  child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 앨범 이미지
CREATE TABLE IF NOT EXISTS album_images (
  id SERIAL PRIMARY KEY,
  album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption VARCHAR(255),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_children_parent_id ON children(parent_id);
CREATE INDEX IF NOT EXISTS idx_children_student_user_id ON children(student_user_id);
CREATE INDEX IF NOT EXISTS idx_children_class_id ON children(class_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_child_id ON homeworks(child_id);
CREATE INDEX IF NOT EXISTS idx_notes_child_id ON notes(child_id);
CREATE INDEX IF NOT EXISTS idx_note_comments_note_id ON note_comments(note_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_child_id ON evaluations(child_id);
CREATE INDEX IF NOT EXISTS idx_albums_child_id ON albums(child_id);
CREATE INDEX IF NOT EXISTS idx_album_images_album_id ON album_images(album_id);

-- ===== 채점 기능 (KHIA 채점 도우미 통합, db/migration_grading.sql과 동일) =====
-- 시험 한 건
-- exam_type: placement(배치고사) / regular(정기시험)
-- class_id: 정기시험은 반을 지정, 배치고사는 반 배정 전 신입생 대상이라 NULL 가능(branch만 지정)
-- status: draft(작성 중) / active(채점 진행 중) / closed(마감)
CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  exam_type VARCHAR(20) NOT NULL CHECK (exam_type IN ('placement', 'regular')),
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  branch VARCHAR(20) NOT NULL DEFAULT 'Sejong' CHECK (branch IN ('Sejong', 'Gwangyo')),
  exam_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'closed')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 시험 영역 (예: Reading / Grammar / Vocabulary / Writing)
CREATE TABLE IF NOT EXISTS exam_areas (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  max_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  order_no INTEGER NOT NULL DEFAULT 0
);

-- 문항 (영역에 속함) - 정답과 루브릭(서술형 채점 기준)
CREATE TABLE IF NOT EXISTS exam_questions (
  id SERIAL PRIMARY KEY,
  area_id INTEGER NOT NULL REFERENCES exam_areas(id) ON DELETE CASCADE,
  question_no INTEGER NOT NULL,
  max_score NUMERIC(6,2) NOT NULL DEFAULT 1,
  answer_key TEXT,
  rubric_text TEXT
);

-- 학생 1인의 시험지 제출본
-- student_id: 등록된 학생(children). 배치고사처럼 아직 등록 전인 학생은 NULL + student_name만 저장
-- scan_image_urls: 스캔 이미지(여러 장 가능) - Vercel Blob 또는 로컬 업로드 경로
-- status: pending(업로드만 됨) → ai_graded(AI 1차 채점 완료) → reviewed(선생님 검수 완료, 학부모에게 공개)
CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
  student_name VARCHAR(100) NOT NULL,
  scan_image_urls TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ai_graded', 'reviewed')),
  total_score NUMERIC(7,2),
  overall_comment TEXT,
  graded_at TIMESTAMPTZ,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 문항별 채점 결과 (AI 점수 / 선생님 최종 점수)
CREATE TABLE IF NOT EXISTS submission_answers (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  student_answer TEXT,
  ai_score NUMERIC(6,2),
  final_score NUMERIC(6,2),
  ai_comment TEXT,
  teacher_edited BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (submission_id, question_id)
);

-- 영역별 합산 점수 + 코멘트 (성적표/대시보드용)
CREATE TABLE IF NOT EXISTS submission_area_results (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  area_id INTEGER NOT NULL REFERENCES exam_areas(id) ON DELETE CASCADE,
  score NUMERIC(7,2),
  max_score NUMERIC(7,2),
  ai_comment TEXT,
  final_comment TEXT,
  UNIQUE (submission_id, area_id)
);

CREATE INDEX IF NOT EXISTS idx_exams_class_id ON exams(class_id);
CREATE INDEX IF NOT EXISTS idx_exams_branch ON exams(branch);
CREATE INDEX IF NOT EXISTS idx_exams_created_by ON exams(created_by);
CREATE INDEX IF NOT EXISTS idx_exam_areas_exam_id ON exam_areas(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_area_id ON exam_questions(area_id);
CREATE INDEX IF NOT EXISTS idx_submissions_exam_id ON submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submission_answers_submission_id ON submission_answers(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_area_results_submission_id ON submission_area_results(submission_id);

-- 시험 자료 파일 (시험지 샘플 / 답지 / 루브릭 등) - 2026-10-01 추가
-- kind: exam_paper(시험지 샘플) / answer_key(답지) / rubric(루브릭·채점 기준) / other(기타)
-- url: Vercel Blob 주소 또는 로컬 업로드 경로(/uploads/exams/...)
CREATE TABLE IF NOT EXISTS exam_files (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('exam_paper', 'answer_key', 'rubric', 'other')),
  file_name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  mime_type VARCHAR(150),
  size_bytes INTEGER,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_files_exam_id ON exam_files(exam_id);

-- 문항 유형 / 평가 항목명 (2026-10-01 추가)
-- question_type: choice(객관식, 정답 자동 비교) / short_answer(단답 서술, 철자 규칙 적용)
--                / rubric(루브릭 기준 AI 1차 채점, 예: Writing) / teacher(선생님 직접 채점, 예: Speaking)
-- label: 루브릭 평가 항목 이름 (예: Content, Fluency) - 객관식은 비워둠
ALTER TABLE exam_questions
  ADD COLUMN IF NOT EXISTS question_type VARCHAR(20) NOT NULL DEFAULT 'choice'
    CHECK (question_type IN ('choice', 'short_answer', 'rubric', 'teacher'));
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS label VARCHAR(100);

-- 학생 답안지 스캔 파일 이름 (scan_image_urls와 같은 순서) - 2026-10-01 추가
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS scan_file_names TEXT[] NOT NULL DEFAULT '{}';

-- AI 채점 결과 보조 정보 (2026-10-01 추가)
-- needs_review: AI가 판독이 불확실하다고 표시한 문항 (선생님 확인 필요)
-- ai_error: 마지막 AI 채점 실패 사유 / ai_model: 채점에 쓴 모델
ALTER TABLE submission_answers ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_error TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_model VARCHAR(100);

-- 반 배정 기준 (2026-10-01 추가) - 성적표에 "Recommended Class" 추천만 표시 (실제 반 이동은 관리자가 직접)
-- order_no 가 작은(위쪽) 반부터 확인해서, 모든 조건을 넘는 첫 번째 반을 추천
-- area_mins: {"<영역 id>": 최소점수, ...} (비어 있는 영역은 조건 없음), min_total: 총점 최소 (NULL이면 조건 없음)
CREATE TABLE IF NOT EXISTS exam_placement_rules (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  order_no INTEGER NOT NULL DEFAULT 0,
  class_name VARCHAR(100) NOT NULL,
  min_total NUMERIC(7,2),
  area_mins JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exam_placement_rules_exam_id ON exam_placement_rules(exam_id);

-- 반 배정: 영역 기준 미달 허용 개수 (2026-10-01 추가) - 총점 기준은 항상 넘어야 하고, 영역 기준은 이 개수까지 미달 허용
ALTER TABLE exams ADD COLUMN IF NOT EXISTS placement_allowed_misses INTEGER NOT NULL DEFAULT 1;
