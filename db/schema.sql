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
