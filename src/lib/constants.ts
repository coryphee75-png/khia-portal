// 라우트 상수
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  PARENT_DASHBOARD: '/dashboard',
  HOMEWORKS: '/homeworks',
  NOTES: '/notes',
  EVALUATIONS: '/evaluations',
  ALBUMS: '/albums',
} as const;

// 등급 색상 매핑
export const GRADE_COLORS: Record<string, string> = {
  'A+': '#ff6b6b',
  'A': '#ff8787',
  'B+': '#ffa94d',
  'B': '#ffd43b',
  'C+': '#a9e34b',
  'C': '#74b9ff',
  'D': '#a29bfe',
  'F': '#fd79a8',
} as const;

// 등급 레벨
export const GRADE_LEVELS = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'] as const;

// 사용자 역할
export const USER_ROLES = {
  PARENT: 'parent',
  TEACHER: 'teacher',
  ADMIN: 'admin',
} as const;

// API 엔드포인트
export const API_ENDPOINTS = {
  AUTH_LOGIN: '/api/auth/login',
  AUTH_LOGOUT: '/api/auth/logout',
  PARENT_DASHBOARD: '/api/parent/dashboard',
  HOMEWORKS: '/api/parent/homeworks',
  NOTES: '/api/parent/notes',
  EVALUATIONS: '/api/parent/evaluations',
  ALBUMS: '/api/parent/albums',
} as const;

// 페이지네이션
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;

// 시간 설정
export const TIME_CONFIG = {
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30분
  REFRESH_INTERVAL: 5 * 60 * 1000, // 5분
} as const;
