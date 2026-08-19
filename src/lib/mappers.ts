/**
 * DB 행(snake_case) → 프론트엔드 타입(camelCase) 변환 헬퍼
 */
import {
  Child,
  Homework,
  Note,
  NoteComment,
  Evaluation,
  Album,
  AlbumImage,
  ClassInfo,
} from '@/types';

export interface ChildRow {
  id: number;
  name: string;
  grade: number;
  class_number: string;
  parent_id: number;
  student_user_id: number | null;
  class_id: number | null;
  created_at: Date;
}

export function mapChild(row: ChildRow): Child {
  return {
    id: String(row.id),
    name: row.name,
    grade: row.grade,
    classNumber: row.class_number,
    parentId: String(row.parent_id),
    createdAt: row.created_at,
  };
}

export interface HomeworkRow {
  id: number;
  child_id: number;
  title: string;
  description: string | null;
  subject: string;
  due_date: Date;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export function mapHomework(row: HomeworkRow): Homework {
  return {
    id: String(row.id),
    childId: String(row.child_id),
    title: row.title,
    description: row.description || '',
    subject: row.subject,
    dueDate: row.due_date,
    status: row.status as Homework['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface NoteRow {
  id: number;
  child_id: number;
  date: Date;
  subject: string;
  content: string;
  teacher: string;
  attachments: string[] | null;
  created_at: Date;
}

export function mapNote(row: NoteRow): Note {
  return {
    id: String(row.id),
    childId: String(row.child_id),
    date: row.date,
    subject: row.subject,
    content: row.content,
    teacher: row.teacher,
    attachments: row.attachments || undefined,
    createdAt: row.created_at,
  };
}

export interface NoteCommentRow {
  id: number;
  note_id: number;
  author_id: number;
  content: string;
  created_at: Date;
  author_name: string;
  author_role: string;
}

export function mapNoteComment(row: NoteCommentRow): NoteComment {
  return {
    id: String(row.id),
    noteId: String(row.note_id),
    authorId: String(row.author_id),
    authorName: row.author_name,
    authorRole: row.author_role as NoteComment['authorRole'],
    content: row.content,
    createdAt: row.created_at,
  };
}

export interface EvaluationRow {
  id: number;
  child_id: number;
  date: Date;
  subject: string;
  score: number;
  grade: string;
  comments: string | null;
  created_at: Date;
}

export function mapEvaluation(row: EvaluationRow): Evaluation {
  return {
    id: String(row.id),
    childId: String(row.child_id),
    date: row.date,
    subject: row.subject,
    score: row.score,
    grade: row.grade,
    comments: row.comments || undefined,
    createdAt: row.created_at,
  };
}

export interface AlbumRow {
  id: number;
  child_id: number;
  title: string;
  description: string | null;
  event_date: Date;
  created_at: Date;
}

export interface AlbumImageRow {
  id: number;
  album_id: number;
  url: string;
  caption: string | null;
  uploaded_at: Date;
}

export function mapAlbumImage(row: AlbumImageRow): AlbumImage {
  return {
    id: String(row.id),
    url: row.url,
    caption: row.caption || undefined,
    uploadedAt: row.uploaded_at,
  };
}

export function mapAlbum(row: AlbumRow, images: AlbumImageRow[]): Album {
  return {
    id: String(row.id),
    childId: String(row.child_id),
    title: row.title,
    description: row.description || undefined,
    images: images.map(mapAlbumImage),
    eventDate: row.event_date,
    createdAt: row.created_at,
  };
}

export interface ClassRow {
  id: number;
  name: string;
  grade: number;
  student_count: string | number;
}

export function mapClassInfo(row: ClassRow): ClassInfo {
  return {
    id: String(row.id),
    name: row.name,
    grade: row.grade,
    studentCount: Number(row.student_count),
  };
}
