-- 마이그레이션: KHIA 채점 도우미 통합 (2026-10-01)
-- 시험(exams) → 영역(exam_areas) → 문항(exam_questions) 구조로 시험을 등록하고,
-- 학생별 시험지 제출본(submissions)에 대해 AI 1차 채점 → 선생님 검수 결과를 저장합니다.
--
-- 이미 khia_portal DB를 쓰고 계신 경우 이 파일만 실행하면 됩니다(기존 데이터는 그대로 유지).
-- 여러 번 실행해도 안전합니다(IF NOT EXISTS). 나중에 테이블이 추가되면(예: exam_files) 이 파일을 다시 실행하면 됩니다.
--
-- 실행 방법
--   로컬 (PowerShell / cmd):
--     "C:\Program Files\PostgreSQL\16\bin\psql" -U postgres -d khia_portal -f db/migration_grading.sql
--   배포 DB (Neon): Neon 콘솔 → SQL Editor에 이 파일 내용을 붙여넣고 실행

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
