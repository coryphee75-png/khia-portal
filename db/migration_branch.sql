-- 마이그레이션: 반(classes)에 지점(branch) 구분 추가 — Sejong Branch / Gwangyo Branch
-- 이미 khia_portal DB를 만들어서 쓰고 계신 경우, schema.sql 전체를 다시 실행할 필요 없이
-- 이 파일만 실행하면 됩니다 (기존 데이터는 그대로 유지되고, 기존 반은 전부 'Sejong'으로 채워집니다).
--
-- 실행 방법 (PowerShell / cmd):
--   "C:\Program Files\PostgreSQL\16\bin\psql" -U postgres -d khia_portal -f db/migration_branch.sql

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS branch VARCHAR(20) NOT NULL DEFAULT 'Sejong'
    CHECK (branch IN ('Sejong', 'Gwangyo'));
