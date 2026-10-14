/**
 * 시험 템플릿 - "시험 만들기" 화면에서 불러와 영역/문항/정답/루브릭을 한 번에 채움
 * 채점 기준 원문: Placement_Test_Prodigy_Set_A_Scoring_Guide.pdf (시험 자료 > 루브릭 칸에 함께 업로드)
 */
import { Branch, ExamType, QuestionType } from './grading';

export interface TemplateQuestion {
  maxScore: number;
  questionType: QuestionType;
  label?: string;
  answerKey?: string;
  rubricText?: string;
}

export interface ExamTemplate {
  id: string;
  name: string;
  description: string;
  title: string;
  examType: ExamType;
  branch: Branch;
  areas: { name: string; questions: TemplateQuestion[] }[];
}

const MC_RULE =
  '2 pts if the final, clearly marked choice (or the correct word written out) matches the key. ' +
  'Two or more marks with no clear correction = 0 and flag. Faint/unreadable mark = provisional 0 and flag "needs teacher check". Blank = 0.';

function choice(keys: string[]): TemplateQuestion[] {
  return keys.map((answerKey) => ({ maxScore: 2, questionType: 'choice', answerKey, rubricText: MC_RULE }));
}

const WORD_BOX_RULE =
  'Word Box: escape | enormous | danger | disappear | return ("return" is a distractor). ' +
  '2 = correct word, correct form (ignore capitals). ' +
  '1 = correct word with ONE small spelling slip (one letter missing/extra/swapped, still clearly the word) OR correct word in the wrong form. ' +
  '0 = wrong Word Box word, "return", a word not in the box, two or more spelling errors, or blank. Unreadable handwriting = flag "needs teacher check".';

function wordBox(answerKey: string, slipExample: string): TemplateQuestion {
  return {
    maxScore: 2,
    questionType: 'short_answer',
    answerKey,
    rubricText: `${WORD_BOX_RULE} Example 1-pt answer: "${slipExample}".`,
  };
}

const SPEAKING_LIMITS =
  'Limits: 0 = no response. <5 sentences: Content max 3; <3 sentences: Content max 2. Topic not one of the three: Content max 2. ' +
  'Korean words earn no credit; mostly Korean: Content and Language Use max 1.';

const WRITING_LIMITS =
  'Limits: 0 = blank/unreadable. <5 sentences: Content max 3; <3 sentences: Content max 2. Copied prompt text is not a sentence. ' +
  'Different topic from Speaking: Content max 4 (mention it). Korean words earn no credit. Unreadable words = flag, not errors.';

export const EXAM_TEMPLATES: ExamTemplate[] = [
  {
    id: 'prodigy-set-a',
    name: 'Prodigy Placement Test - Set A (100점)',
    description: 'Reading·Vocabulary·Grammar 각 20점(10문항×2점) + Speaking·Writing 각 20점(루브릭 4항목×5점)',
    title: 'Placement Test - Prodigy Set A',
    examType: 'placement',
    branch: 'Sejong',
    areas: [
      {
        name: 'Reading',
        questions: choice(['A (small)', 'A (Bill)', 'C (cookies)', 'D (a dog)', "B (Bill's best friend)",
          'D (playing)', 'A (up to his neck)', 'B (sound)', 'C (scared)', 'A (to protect her babies)']),
      },
      {
        name: 'Vocabulary',
        questions: [
          ...choice(['B (heavy)', 'A (protect)', 'B (finally)', 'C (choose)', 'B (fast)', 'B (very big)']),
          wordBox('escape', 'escap / escaped'),
          wordBox('enormous', 'enormus'),
          wordBox('danger', 'danjer'),
          wordBox('disappear', 'disapear'),
        ],
      },
      {
        name: 'Grammar',
        questions: choice(['B (an)', 'C (she is)', 'C (at)', 'B (many)', 'C (any)',
          'C (quietly)', 'D (bigger)', 'D (before)', 'D (to watch)', 'C (have never seen)']),
      },
      {
        name: 'Speaking',
        questions: [
          { label: 'Content', rubricText: '5 on topic, 5+ full sentences, 2+ specific details/reasons | 4 on topic, 5 sentences, simple details | 3 3-4 sentences or only some details | 2 1-2 sentences or mostly words/phrases | 1 a few words, heavy prompting. ' + SPEAKING_LIMITS },
          { label: 'Fluency', rubricText: '5 smooth, confident, natural pace | 4 occasional short pauses, quick self-correction | 3 some pauses/restarts but keeps going | 2 frequent long pauses, needs prompts | 1 very halting, word-by-word.' },
          { label: 'Language Use', rubricText: '5 accurate with variety (and, because, adjectives) | 4 mostly accurate, some variety | 3 some errors (tense, a/an, plurals), meaning clear | 2 frequent errors, meaning sometimes unclear | 1 errors block meaning.' },
          { label: 'Pronunciation', rubricText: '5 clear and easy to follow | 4 clear, a few sound errors | 3 generally understandable, some listener effort | 2 often hard to understand | 1 difficult to understand.' },
        ].map((q) => ({ ...q, maxScore: 5, questionType: 'teacher' as QuestionType })),
      },
      {
        name: 'Writing',
        questions: [
          { label: 'Content', rubricText: 'Required: Topic 1 favorite animal + why + 3 facts; Topic 2 favorite hobby + why; Topic 3 beach or mountains + 2 reasons. 5 all required elements + extra detail, 5+ sentences | 4 all required elements, 5+ sentences, simple details | 3 one element missing or only 3-4 sentences | 2 1-2 sentences or mostly off topic | 1 a few words or copied prompt. ' + WRITING_LIMITS },
          { label: 'Organization', rubricText: '5 opening sentence, logical order, closing sentence, linking words (first, also, because, so) | 4 logical order and opening, few linking words | 3 partly organized, list-like | 2 disconnected ideas | 1 random words/phrases.' },
          { label: 'Language Use', rubricText: '5 accurate and varied sentences and vocabulary | 4 mostly accurate, some variety | 3 some errors, meaning clear, repeated simple patterns | 2 frequent errors, meaning sometimes unclear | 1 errors block meaning.' },
          { label: 'Mechanics', rubricText: 'Count capital letters (sentence start, "I"), end punctuation and spelling of common words. 5 = 0-1 error | 4 = 2-3 errors | 3 = 4-6 errors, easy to read | 2 = 7+ errors, harder to read | 1 = errors throughout, no clear sentence boundaries.' },
        ].map((q) => ({ ...q, maxScore: 5, questionType: 'rubric' as QuestionType })),
      },
    ],
  },
];
