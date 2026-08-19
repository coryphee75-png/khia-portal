-- 마이그레이션: 수업일지 댓글(학부모 ↔ 담임선생님 소통) 기능 추가
-- 이미 khia_portal DB를 만들어서 쓰고 계신 경우, schema.sql 전체를 다시 실행할 필요 없이
-- 이 파일만 실행하면 됩니다 (기존 데이터는 그대로 유지됩니다).
--
-- 실행 방법 (PowerShell / cmd):
--   "C:\Program Files\PostgreSQL\16\bin\psql" -U postgres -d khia_portal -f db/migration_note_comments.sql

CREATE TABLE IF NOT EXISTS note_comments (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_comments_note_id ON note_comments(note_id);
