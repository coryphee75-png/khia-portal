import { Pool, PoolClient } from 'pg';

// PostgreSQL 연결 풀
// - DATABASE_URL이 있으면 그것을 사용 (Vercel Postgres/Neon/Supabase 등 클라우드 DB 배포 시)
// - 없으면 기존 DB_HOST 등 개별 값 사용 (로컬 개발 환경)
// 클라우드 DB는 보통 SSL 연결이 필수라서, DATABASE_URL을 쓸 때는 SSL을 함께 켠다.
const connectionString = process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    })
  : new Pool({
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'khia_portal',
    });

// 에러 핸들러
pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client', err);
});

/**
 * 데이터베이스 쿼리 실행
 * @param query SQL 쿼리
 * @param values 쿼리 파라미터
 * @returns 쿼리 결과
 */
type QueryParam = string | number | boolean | Date | null | number[] | string[];

export async function query<T>(
  text: string,
  values?: QueryParam[]
): Promise<T[]> {
  try {
    const result = await pool.query(text, values);
    return result.rows as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * 단일 행 조회
 */
export async function queryOne<T>(
  text: string,
  values?: QueryParam[]
): Promise<T | null> {
  const results = await query<T>(text, values);
  return results.length > 0 ? results[0] : null;
}

/**
 * 데이터베이스 연결 테스트
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

/**
 * 데이터베이스 풀 종료
 */
export async function closePool(): Promise<void> {
  await pool.end();
}

/**
 * 클라이언트 획득
 */
export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

export default pool;
