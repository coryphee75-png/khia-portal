-- 마이그레이션: 선생님 계정과 학생(children)에도 지점(branch) 구분 추가
-- (db/migration_branch.sql이 classes에 branch를 추가하는 마이그레이션이었다면, 이 파일은 그 다음 단계로
--  선생님 계정과 학생 본인에게도 지점을 직접 붙이는 마이그레이션입니다. 순서 상관없이 실행 가능합니다.)
-- 이미 khia_portal DB를 만들어서 쓰고 계신 경우, schema.sql 전체를 다시 실행할 필요 없이
-- 이 파일만 실행하면 됩니다 (기존 데이터는 그대로 유지되고, 기존 학생은 전부 'Sejong'으로 채워집니다.
-- 기존 선생님 계정의 지점은 NULL로 시작하므로, /admin/users에서 "계정 수정"으로 한 번씩 지정해주세요).
--
-- 실행 방법 (PowerShell / cmd):
--   "C:\Program Files\PostgreSQL\16\bin\psql" -U postgres -d khia_portal -f db/migration_branch_teachers_students.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS branch VARCHAR(20)
    CHECK (branch IS NULL OR branch IN ('Sejong', 'Gwangyo'));

ALTER TABLE children
  ADD COLUMN IF NOT EXISTS branch VARCHAR(20) NOT NULL DEFAULT 'Sejong'
    CHECK (branch IN ('Sejong', 'Gwangyo'));
