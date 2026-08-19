/**
 * KHIA 포탈 시드 데이터 스크립트 (Day 3)
 * 실행: node scripts/seed.js
 *
 * db/schema.sql 을 먼저 실행해서 테이블을 만든 뒤 이 스크립트를 실행하세요.
 * .env.local 의 DB_* 값을 읽어서 접속합니다.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// .env.local 을 직접 파싱해서 process.env 에 채워줍니다 (dotenv 의존성 없이)
function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

// DATABASE_URL이 있으면 그것을 사용 (클라우드 DB에 시드 데이터를 넣을 때, 예: 배포용 DB에 1회 실행)
// 없으면 기존 DB_HOST 등 개별 값 사용 (로컬 개발 환경)
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    })
  : new Pool({
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'khia_portal',
    });

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 기존 데이터 초기화 (반복 실행 가능하도록)
    await client.query(
      'TRUNCATE album_images, albums, evaluations, notes, homeworks, children, classes, users RESTART IDENTITY CASCADE'
    );

    const passwordHash = await bcrypt.hash('password', 10);

    const usersResult = await client.query(
      `INSERT INTO users (email, password_hash, name, role, branch) VALUES
        ('parent@example.com', $1, '김학부모', 'parent', NULL),
        ('teacher@example.com', $1, '최선생님', 'teacher', 'Sejong'),
        ('student@example.com', $1, '김학생', 'student', NULL),
        ('admin@example.com', $1, '관리자', 'admin', NULL)
       RETURNING id, role`,
      [passwordHash]
    );

    const parentId = usersResult.rows.find((u) => u.role === 'parent').id;
    const teacherId = usersResult.rows.find((u) => u.role === 'teacher').id;
    const studentUserId = usersResult.rows.find((u) => u.role === 'student').id;

    const classesResult = await client.query(
      `INSERT INTO classes (name, grade, branch, teacher_id) VALUES
        ('초등 3학년 2반', 3, 'Sejong', $1),
        ('초등 1학년 3반', 1, 'Gwangyo', $1)
       RETURNING id, name`,
      [teacherId]
    );
    const class1Id = classesResult.rows[0].id; // 3학년 2반
    const class2Id = classesResult.rows[1].id; // 1학년 3반

    const childrenResult = await client.query(
      `INSERT INTO children (name, grade, class_number, parent_id, registration_code, student_user_id, class_id, branch) VALUES
        ('김학생', 3, '2', $1, 'DEMO0001', $2, $3, 'Sejong'),
        ('김학생 2', 1, '3', $1, 'DEMO0002', NULL, $4, 'Gwangyo')
       RETURNING id, name`,
      [parentId, studentUserId, class1Id, class2Id]
    );
    const child1Id = childrenResult.rows[0].id;
    const child2Id = childrenResult.rows[1].id;

    await client.query(
      `INSERT INTO homeworks (child_id, title, description, subject, due_date, status) VALUES
        ($1, '수학 문제풀이 20문제', 'Chapter 5의 문제를 풀어주세요.', '수학', '2024-12-20', 'pending'),
        ($1, '영어 단어 암기', '제공된 단어장의 단어들을 외워주세요.', '영어', '2024-12-19', 'completed'),
        ($2, '한글 쓰기 연습', '가로 줄 10줄을 써주세요.', '국어', '2024-12-18', 'overdue')`,
      [child1Id, child2Id]
    );

    await client.query(
      `INSERT INTO notes (child_id, date, subject, content, teacher, attachments) VALUES
        ($1, '2024-12-18', '수학', '오늘은 분수의 덧셈과 뺄셈을 배웠습니다. 학생들이 매우 집중했습니다.', '박선생님', NULL),
        ($1, '2024-12-17', '과학', '식물의 생장 과정에 대해 학습했습니다. 모든 학생이 성공적으로 참여했습니다.', '이선생님', ARRAY['science-slides.pdf']),
        ($1, '2024-12-16', '국어', '고전 문학을 통해 한국 문화를 배웠습니다. 학생들의 이해도가 높았습니다.', '김선생님', NULL),
        ($2, '2024-12-15', '영어', '알파벳과 간단한 단어를 배웠습니다. 발음 연습을 열심히 했습니다.', '정선생님', NULL)`,
      [child1Id, child2Id]
    );

    await client.query(
      `INSERT INTO evaluations (child_id, date, subject, score, grade, comments) VALUES
        ($1, '2024-12-15', '수학', 95, 'A+', '매우 우수한 성적입니다. 특히 문제 풀이가 정확합니다.'),
        ($1, '2024-12-10', '영어', 87, 'A', '좋은 성적입니다. 발음 향상이 필요합니다.'),
        ($1, '2024-12-05', '과학', 92, 'A+', '실험 보고서가 우수합니다.'),
        ($1, '2024-11-30', '국어', 85, 'A', '읽기 능력이 향상되었습니다.'),
        ($2, '2024-12-12', '수학', 78, 'B+', '기초가 안정적입니다.')`,
      [child1Id, child2Id]
    );

    const albumsResult = await client.query(
      `INSERT INTO albums (child_id, title, description, event_date) VALUES
        ($1, '2024년 겨울 운동회', '즐거운 겨울 운동회 사진입니다.', '2024-12-10'),
        ($1, '2024년 전시회', '미술 시간에 만든 작품 전시회입니다.', '2024-11-20'),
        ($1, '과학 프로젝트', '우리 반의 과학 프로젝트 결과물입니다.', '2024-11-15')
       RETURNING id`,
      [child1Id]
    );
    const [album1Id, album2Id, album3Id] = albumsResult.rows.map((r) => r.id);

    await client.query(
      `INSERT INTO album_images (album_id, url, caption) VALUES
        ($1, 'https://via.placeholder.com/400?text=Winter+Sports+1', '달리기 경기'),
        ($1, 'https://via.placeholder.com/400?text=Winter+Sports+2', '줄넘기'),
        ($1, 'https://via.placeholder.com/400?text=Winter+Sports+3', '팀 기념사진'),
        ($2, 'https://via.placeholder.com/400?text=Art+Exhibition+1', '회화 작품'),
        ($2, 'https://via.placeholder.com/400?text=Art+Exhibition+2', '조각 작품'),
        ($3, 'https://via.placeholder.com/400?text=Science+Project', '완성된 프로젝트')`,
      [album1Id, album2Id, album3Id]
    );

    await client.query('COMMIT');
    console.log('✅ 시드 데이터 삽입 완료!');
    console.log('   테스트 계정 (공통 비밀번호: password)');
    console.log('   - parent@example.com (학부모)');
    console.log('   - teacher@example.com (선생님)');
    console.log('   - student@example.com (학생)');
    console.log('   - admin@example.com (관리자)');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 시드 데이터 삽입 실패:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
