import { Pool, PoolClient } from 'pg';

// PostgreSQL 연결 풀
const pool = new Pool({
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
export async function query<T>(
  text: string,
  values?: (string | number | boolean | Date | null)[]
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
  values?: (string | number | boolean | Date | null)[]
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
