/**
 * KHIA 채점 도우미 - 공용 타입/라벨 (클라이언트 화면에서도 import 하므로 DB 코드를 넣지 말 것)
 * 서버 전용 권한 체크/SQL은 ./gradingQueries.ts 에 있습니다.
 */
import type { Session } from 'next-auth';

type MinimalSession = Pick<Session, 'user'> | null | undefined;

export type ExamType = 'placement' | 'regular';
export type ExamStatus = 'draft' | 'active' | 'closed';
export type SubmissionStatus = 'pending' | 'ai_graded' | 'reviewed';
export type Branch = 'Sejong' | 'Gwangyo';

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  placement: '배치고사',
  regular: '정기시험',
};

export const EXAM_STATUS_LABELS: Record<ExamStatus, string> = {
  draft: '작성 중',
  active: '채점 진행 중',
  closed: '마감',
};

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending: '대기',
  ai_graded: 'AI채점완료',
  reviewed: '검수완료',
};

export const BRANCH_LABELS: Record<Branch, string> = {
  Sejong: 'Sejong Branch',
  Gwangyo: 'Gwangyo Branch',
};

// ===== 문항 유형 =====
export type QuestionType = 'choice' | 'short_answer' | 'rubric' | 'teacher';

export const QUESTION_TYPES: QuestionType[] = ['choice', 'short_answer', 'rubric', 'teacher'];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  choice: '객관식',
  short_answer: '단답(서술)',
  rubric: '루브릭(AI)',
  teacher: '선생님 채점',
};

export const QUESTION_TYPE_HINTS: Record<QuestionType, string> = {
  choice: '정답과 비교해 AI가 자동 채점',
  short_answer: '손글씨 단답 - 철자 규칙 등 루브릭에 따라 부분 점수',
  rubric: '루브릭 기준으로 AI가 1차 채점 → 선생님 검수 (예: Writing)',
  teacher: 'AI 채점 없이 선생님이 직접 점수 입력 (예: Speaking)',
};

export interface ExamQuestion {
  id: string;
  questionNo: number;
  questionType: QuestionType;
  label: string;
  maxScore: number;
  answerKey: string;
  rubricText: string;
}

export interface ExamArea {
  id: string;
  name: string;
  maxScore: number;
  orderNo: number;
  questions: ExamQuestion[];
}

export interface ExamSummary {
  id: string;
  title: string;
  examType: ExamType;
  classId: string | null;
  className: string | null;
  branch: Branch;
  examDate: string | null;
  status: ExamStatus;
  createdByName: string | null;
  totalScore: number;
  questionCount: number;
  submissionCount: number;
  reviewedCount: number;
  createdAt: string;
}

export interface ExamDetail extends ExamSummary {
  areas: ExamArea[];
  files: ExamFile[];
}

// ===== 시험 자료 파일 (시험지 샘플 / 답지 / 루브릭) =====
export type ExamFileKind = 'exam_paper' | 'answer_key' | 'rubric' | 'other';

export const EXAM_FILE_KINDS: ExamFileKind[] = ['exam_paper', 'answer_key', 'rubric', 'other'];

export const EXAM_FILE_KIND_LABELS: Record<ExamFileKind, string> = {
  exam_paper: '시험지 샘플',
  answer_key: '답지',
  rubric: '루브릭 (채점 기준)',
  other: '기타 자료',
};

export const EXAM_FILE_KIND_HINTS: Record<ExamFileKind, string> = {
  exam_paper: '빈 시험지 원본 (PDF/이미지/한글/워드)',
  answer_key: '정답이 표시된 답지',
  rubric: '서술형·말하기 등 채점 기준표',
  other: '듣기 대본 등 참고 자료',
};

export interface ExamFile {
  id: string;
  kind: ExamFileKind;
  fileName: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

/** 업로드 가능한 확장자 → Content-Type (한글 .hwp는 브라우저가 type을 비워 보내는 경우가 많아 확장자로 판별) */
export const EXAM_FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  hwp: 'application/x-hwp',
  hwpx: 'application/haansofthwpx',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
};

export const EXAM_FILE_ACCEPT = Object.keys(EXAM_FILE_TYPES)
  .map((ext) => `.${ext}`)
  .join(',');

export const EXAM_FILE_MAX_BYTES = 30 * 1024 * 1024; // 30MB

export function getFileExtension(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i >= 0 ? fileName.slice(i + 1).toLowerCase() : '';
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** 시험 생성 요청 body */
export interface CreateExamInput {
  title: string;
  examType: ExamType;
  classId?: string | null;
  branch?: Branch;
  examDate?: string | null;
  areas: {
    name: string;
    questions: {
      maxScore: number;
      questionType?: QuestionType;
      label?: string;
      answerKey?: string;
      rubricText?: string;
    }[];
  }[];
}

export function isGradingStaff(session: MinimalSession): boolean {
  return session?.user?.role === 'admin' || session?.user?.role === 'teacher';
}

// ===================================================================
// 결과 언어 설정
// 채점 결과(문항별 피드백, 영역별 코멘트, 총평)와 성적표/결과지에 나오는 모든 내용은 영어로 출력합니다.
// (선생님이 쓰는 관리 화면 - 시험 만들기/목록/검수 버튼 등 - 은 한국어 유지)
// ===================================================================
export const GRADING_OUTPUT_LANGUAGE = 'en' as const;

/** 성적표·결과지 화면/인쇄물에 쓰는 영어 문구 */
export const REPORT_TEXT = {
  reportTitle: 'Score Report',
  academyName: 'KHIA',
  student: 'Student',
  className: 'Class',
  branch: 'Branch',
  examTitle: 'Exam',
  examType: 'Exam Type',
  examDate: 'Exam Date',
  totalScore: 'Total Score',
  area: 'Area',
  score: 'Score',
  maxScore: 'Max',
  percentage: '%',
  question: 'Q',
  studentAnswer: 'Student Answer',
  correctAnswer: 'Answer Key',
  feedback: 'Feedback',
  areaComments: 'Comments by Area',
  overallComment: 'Overall Comment',
  areaChartTitle: 'Score by Area (%)',
  classAverage: 'Class Average',
  teacher: 'Teacher',
  print: 'Print',
  notReviewed: 'This report will be available after the teacher has finished reviewing.',
  recommendedClass: 'Recommended Class',
  noRecommendation: 'To be discussed with the teacher',
} as const;

export const EXAM_TYPE_LABELS_EN: Record<ExamType, string> = {
  placement: 'Placement Test',
  regular: 'Regular Test',
};

export const SUBMISSION_STATUS_LABELS_EN: Record<SubmissionStatus, string> = {
  pending: 'Pending',
  ai_graded: 'AI Graded',
  reviewed: 'Reviewed',
};

// ===================================================================
// 학생 답안지 (제출본)
// ===================================================================
/** 답안지 스캔은 AI가 읽을 수 있는 PDF/이미지만 허용 */
export const SCAN_FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const SCAN_FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';

export const SCAN_MAX_FILES = 20;

export interface ScanPage {
  url: string;
  fileName: string;
}

export interface SubmissionSummary {
  id: string;
  studentId: string | null;
  studentName: string;
  status: SubmissionStatus;
  totalScore: number | null;
  /** 반 배정 기준에 따른 추천 반 (기준이 없거나 해당 반이 없으면 null) */
  recommendedClass?: string | null;
  /** 반별 통과/미달 설명 (추천 반에 마우스를 올리면 표시) */
  placementNote?: string | null;
  /** 마지막 AI 채점 실패 사유 (성공하면 null) */
  aiError: string | null;
  pages: ScanPage[];
  createdAt: string;
}

export interface StudentOption {
  id: string;
  name: string;
  grade: number;
  className: string | null;
}

// ===== 채점 결과 (AI 1차 / 선생님 검수) =====
export interface AnswerResult {
  questionId: string;
  areaId: string;
  questionNo: number;
  questionType: QuestionType;
  label: string;
  maxScore: number;
  answerKey: string;
  studentAnswer: string | null;
  aiScore: number | null;
  finalScore: number | null;
  aiComment: string | null;
  needsReview: boolean;
  teacherEdited: boolean;
}

export interface AreaResult {
  areaId: string;
  name: string;
  maxScore: number;
  score: number | null;
  aiComment: string | null;
  finalComment: string | null;
}

export interface SubmissionDetail extends SubmissionSummary {
  examId: string;
  overallComment: string | null;
  gradedAt: string | null;
  aiModel: string | null;
  areas: AreaResult[];
  answers: AnswerResult[];
}

// ===== 성적표 (Score Report, 영어) =====
export interface ReportArea {
  name: string;
  score: number | null;
  maxScore: number;
  percent: number | null;
  /** 같은 시험 다른 학생들의 평균 % (2명 이상일 때만) */
  averagePercent: number | null;
  comment: string | null;
}

export interface ReportData {
  submissionId: string;
  examId: string;
  status: SubmissionStatus;
  studentName: string;
  className: string | null;
  branch: Branch;
  examTitle: string;
  examType: ExamType;
  examDate: string | null;
  totalScore: number | null;
  maxScore: number;
  areas: ReportArea[];
  overallComment: string | null;
  teacherName: string | null;
  reviewedAt: string | null;
  /** 반 배정 기준이 있으면 추천 반 (조건에 맞는 반이 없으면 null) */
  recommendedClass: string | null;
  hasPlacementRules: boolean;
}

// ===== 반 배정 기준 (Placement rules) =====
export interface PlacementRule {
  id?: string;
  className: string;
  /** 총점 최소 (null이면 조건 없음) */
  minTotal: number | null;
  /** 영역 id → 최소 점수 (없는 영역은 조건 없음) */
  areaMins: Record<string, number>;
}

/** 반 기준의 높이 (총점 기준 우선, 같으면 영역 기준 합) - 높을수록 상위 반 */
function ruleLevel(rule: PlacementRule): [number, number] {
  const areaSum = Object.values(rule.areaMins).reduce((s, v) => s + v, 0);
  return [rule.minTotal ?? 0, areaSum];
}

/** 이 반의 영역 기준 중 학생이 못 넘은 영역 id 목록 (점수가 없는 영역도 미달) */
export function missedAreas(rule: PlacementRule, areaScores: Record<string, number | null>): string[] {
  return Object.entries(rule.areaMins)
    .filter(([areaId, min]) => {
      const s = areaScores[areaId];
      return s === null || s === undefined || s < min;
    })
    .map(([areaId]) => areaId);
}

/**
 * 학생이 이 반 조건을 통과하는지
 * - 총점 기준은 반드시 넘어야 함
 * - 영역 기준은 allowedMisses 개수까지 미달 허용
 */
export function meetsRule(
  rule: PlacementRule,
  areaScores: Record<string, number | null>,
  total: number | null,
  allowedMisses = 0
): boolean {
  if (rule.minTotal !== null && (total === null || total < rule.minTotal)) return false;
  return missedAreas(rule, areaScores).length <= allowedMisses;
}

/**
 * 조건을 통과한 반들 중에서 "기준이 가장 높은 반"을 추천 (입력 순서와 무관)
 * - 기준 높이: 총점 기준이 높은 반이 우선, 같으면 영역별 기준 합이 큰 반
 * - 점수가 비어 있는 영역에 조건이 있으면 그 반은 통과하지 못함
 */
export function recommendClass(
  rules: PlacementRule[],
  areaScores: Record<string, number | null>,
  total: number | null,
  allowedMisses = 0
): string | null {
  const passed = rules.filter((r) => meetsRule(r, areaScores, total, allowedMisses));
  if (passed.length === 0) return null;
  passed.sort((x, y) => {
    const [xt, xa] = ruleLevel(x);
    const [yt, ya] = ruleLevel(y);
    return yt - xt || ya - xa;
  });
  return passed[0].className;
}

export interface PlacementSettings {
  rules: PlacementRule[];
  /** 영역 기준 미달 허용 개수 (총점 기준은 항상 필수) */
  allowedMisses: number;
}
