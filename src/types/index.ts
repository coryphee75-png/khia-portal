// 사용자 타입
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'parent' | 'teacher' | 'student' | 'admin';
  children?: Child[];
  createdAt: Date;
  updatedAt: Date;
}

// 아이 정보
export interface Child {
  id: string;
  name: string;
  grade: number;
  classNumber: string;
  parentId: string;
  createdAt: Date;
}

// 숙제
export interface Homework {
  id: string;
  childId: string;
  title: string;
  description: string;
  subject: string;
  dueDate: Date;
  status: 'pending' | 'completed' | 'overdue';
  createdAt: Date;
  updatedAt: Date;
}

// 수업일지
export interface Note {
  id: string;
  childId: string;
  date: Date;
  subject: string;
  content: string;
  teacher: string;
  attachments?: string[];
  createdAt: Date;
}

// 수업일지 댓글
export interface NoteComment {
  id: string;
  noteId: string;
  authorId: string;
  authorName: string;
  authorRole: 'parent' | 'teacher' | 'student' | 'admin';
  content: string;
  createdAt: Date;
}

// 평가
export interface Evaluation {
  id: string;
  childId: string;
  date: Date;
  subject: string;
  score: number;
  grade: string;
  comments?: string;
  createdAt: Date;
}

// 앨범
export interface Album {
  id: string;
  childId: string;
  title: string;
  description?: string;
  images: AlbumImage[];
  eventDate: Date;
  createdAt: Date;
}

// 앨범 이미지
export interface AlbumImage {
  id: string;
  url: string;
  caption?: string;
  uploadedAt: Date;
}

// 대시보드 데이터
export interface DashboardData {
  children: Child[];
  recentHomeworks: Homework[];
  recentNotes: Note[];
  recentEvaluations: Evaluation[];
  statistics: DashboardStatistics;
}

// 대시보드 통계
export interface DashboardStatistics {
  totalHomeworks: number;
  completedHomeworks: number;
  pendingHomeworks: number;
  averageGrade: number;
  lastUpdate: Date;
}

// 반 정보
export interface ClassInfo {
  id: string;
  name: string;
  grade: number;
  studentCount: number;
}

// 선생님 대시보드 데이터
export interface TeacherDashboardData {
  classes: ClassInfo[];
  totalStudents: number;
  pendingHomeworksToGrade: number;
  recentNotes: Note[];
}

// 학생 대시보드 데이터
export interface StudentDashboardData {
  homeworks: Homework[];
  recentNotes: Note[];
  recentEvaluations: Evaluation[];
  statistics: {
    totalHomeworks: number;
    completedHomeworks: number;
    averageGrade: number;
  };
}

// API 응답
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 세션 데이터
export interface SessionData {
  user: User;
  expires: Date;
}

// 로그인 요청
export interface LoginRequest {
  email: string;
  password: string;
}

// 로그인 응답
export interface LoginResponse {
  token: string;
  user: User;
}
