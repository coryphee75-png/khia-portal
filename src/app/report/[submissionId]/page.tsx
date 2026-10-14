'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getDashboardRoute } from '@/lib/constants';
import { BRANCH_LABELS, EXAM_TYPE_LABELS_EN, REPORT_TEXT, ReportArea, ReportData } from '@/lib/grading';
import styles from './report.module.css';

/**
 * /report/[submissionId] - 영어 성적표 (A4 2페이지 인쇄용)
 * 1페이지: 학생 정보, 총점, 영역별 점수표, 영역별 그래프
 * 2페이지: 영역별 코멘트, 총평(Overall Comment), 서명란
 */
export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = String(params.submissionId);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState('');
  const { data: session } = useSession();

  // 성적표는 새 탭으로 열리므로 '뒤로' 기록이 없음 → 새 탭이면 탭 닫기, 아니면 시험 화면(학부모는 대시보드)으로 이동
  const goBack = () => {
    if (window.opener && !window.opener.closed) {
      window.close();
      return;
    }
    const role = session?.user?.role;
    if (data && (role === 'teacher' || role === 'admin')) {
      router.push(`/grading/${data.examId}`);
    } else {
      router.push(getDashboardRoute(role));
    }
  };

  useEffect(() => {
    fetch(`/api/grading/submissions/${submissionId}/report`)
      .then((r) => r.json())
      .then((r) => {
        if (!r.success) throw new Error(r.error || '성적표를 불러올 수 없습니다.');
        setData(r.data);
        document.title = `Score Report - ${r.data.studentName}`;
      })
      .catch((e) => setError(e instanceof Error ? e.message : '오류가 발생했습니다.'));
  }, [submissionId]);

  if (error) return <div className={styles.message}>{error}</div>;
  if (!data) return <div className={styles.message}>Loading...</div>;

  const totalPct = data.totalScore !== null && data.maxScore > 0 ? Math.round((data.totalScore / data.maxScore) * 100) : null;
  const isDraft = data.status !== 'reviewed';
  const info: [string, string][] = [
    [REPORT_TEXT.student, data.studentName],
    [REPORT_TEXT.className, data.className || '-'],
    [REPORT_TEXT.branch, BRANCH_LABELS[data.branch]],
    [REPORT_TEXT.examType, EXAM_TYPE_LABELS_EN[data.examType]],
    [REPORT_TEXT.examDate, data.examDate || '-'],
    [REPORT_TEXT.teacher, data.teacherName || '-'],
  ];

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <button type="button" className={styles.backBtn} onClick={goBack}>
          ← 돌아가기
        </button>
        <span className={styles.toolbarHint}>
          {isDraft ? '검수 완료 전 미리보기입니다 (DRAFT 표시가 함께 인쇄됩니다).' : 'A4 2페이지로 인쇄됩니다. PDF로 저장도 가능해요.'}
        </span>
        <button type="button" className={styles.printBtn} onClick={() => window.print()}>
          인쇄 / PDF 저장
        </button>
      </div>

      {/* ===== Page 1 ===== */}
      <section className={styles.sheet}>
        <ReportHeader />
        {isDraft && <div className={styles.draft}>DRAFT - not yet reviewed by the teacher</div>}

        <div className={styles.titleBlock}>
          <div className={styles.reportLabel}>{REPORT_TEXT.reportTitle}</div>
          <h1>{data.examTitle}</h1>
        </div>

        <div className={styles.infoGrid}>
          {info.map(([k, v]) => (
            <div key={k} className={styles.infoItem}>
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>

        <div className={styles.totalRow}>
          <div className={styles.totalCard}>
            <span>{REPORT_TEXT.totalScore}</span>
            <strong>
              {data.totalScore ?? '-'}
              <small> / {data.maxScore}</small>
            </strong>
            {totalPct !== null && (
              <div className={styles.totalBar}>
                <div style={{ width: `${totalPct}%` }} />
              </div>
            )}
          </div>
          <table className={styles.scoreTable}>
            <thead>
              <tr>
                <th>{REPORT_TEXT.area}</th>
                <th>{REPORT_TEXT.score}</th>
                <th>{REPORT_TEXT.maxScore}</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {data.areas.map((a) => (
                <tr key={a.name}>
                  <td>{a.name}</td>
                  <td className={styles.num}>{a.score ?? '-'}</td>
                  <td className={styles.num}>{a.maxScore}</td>
                  <td className={styles.num}>{a.percent !== null ? `${a.percent}%` : '-'}</td>
                </tr>
              ))}
              <tr className={styles.totalLine}>
                <td>Total</td>
                <td className={styles.num}>{data.totalScore ?? '-'}</td>
                <td className={styles.num}>{data.maxScore}</td>
                <td className={styles.num}>{totalPct !== null ? `${totalPct}%` : '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {data.hasPlacementRules && (
          <div className={styles.placementBox}>
            <span>{REPORT_TEXT.recommendedClass}</span>
            <strong>{data.recommendedClass ?? REPORT_TEXT.noRecommendation}</strong>
          </div>
        )}

        <h2 className={styles.sectionTitle}>{REPORT_TEXT.areaChartTitle}</h2>
        <AreaChart areas={data.areas} />

        <ReportFooter page={1} />
      </section>

      {/* ===== Page 2 ===== */}
      <section className={styles.sheet}>
        <ReportHeader compact studentName={data.studentName} examTitle={data.examTitle} />
        {isDraft && <div className={styles.draft}>DRAFT - not yet reviewed by the teacher</div>}

        <h2 className={styles.sectionTitle}>{REPORT_TEXT.areaComments}</h2>
        <div className={styles.commentList}>
          {data.areas.map((a) => (
            <div key={a.name} className={styles.commentCard}>
              <div className={styles.commentHead}>
                <strong>{a.name}</strong>
                <span>
                  {a.score ?? '-'} / {a.maxScore}
                </span>
              </div>
              <p>{a.comment || '-'}</p>
            </div>
          ))}
        </div>

        <h2 className={styles.sectionTitle}>{REPORT_TEXT.overallComment}</h2>
        <div className={styles.overallBox}>{data.overallComment || '-'}</div>

        <div className={styles.signRow}>
          <div>
            <span>{REPORT_TEXT.teacher}</span>
            <strong>{data.teacherName || ''}</strong>
          </div>
          <div>
            <span>Date</span>
            <strong>{data.reviewedAt || data.examDate || ''}</strong>
          </div>
          <div>
            <span>Signature</span>
            <strong>&nbsp;</strong>
          </div>
        </div>

        <ReportFooter page={2} />
      </section>
    </div>
  );
}

function ReportHeader({ compact, studentName, examTitle }: { compact?: boolean; studentName?: string; examTitle?: string }) {
  return (
    <header className={compact ? `${styles.header} ${styles.headerCompact}` : styles.header}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/khia-crest.png" alt="KHIA" className={styles.crest} />
      <div>
        <div className={styles.academy}>KOREA HERALD INTERNATIONAL ACADEMY</div>
        <div className={styles.academySub}>
          {compact ? `${studentName} | ${examTitle}` : 'Student Assessment Report'}
        </div>
      </div>
    </header>
  );
}

function ReportFooter({ page }: { page: number }) {
  return (
    <footer className={styles.footer}>
      <span>Korea Herald International Academy</span>
      <span>Page {page} of 2</span>
    </footer>
  );
}

/** 영역별 % 가로 막대 그래프 (같은 시험 평균이 있으면 점선 표시) */
function AreaChart({ areas }: { areas: ReportArea[] }) {
  const rowH = 46;
  const labelW = 120;
  const barW = 420;
  const top = 26;
  const height = top + areas.length * rowH + 8;
  const hasAvg = areas.some((a) => a.averagePercent !== null);

  return (
    <div className={styles.chartWrap}>
      <svg viewBox={`0 0 ${labelW + barW + 70} ${height}`} className={styles.chart} role="img" aria-label="Score by area">
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={labelW + (barW * t) / 100} x2={labelW + (barW * t) / 100} y1={top - 6} y2={height - 8} stroke="#E3EBF0" strokeWidth={1} />
            <text x={labelW + (barW * t) / 100} y={top - 10} textAnchor="middle" fontSize={10} fill="#8A99A6">
              {t}%
            </text>
          </g>
        ))}
        {areas.map((a, i) => {
          const y = top + i * rowH + 8;
          const pct = a.percent ?? 0;
          return (
            <g key={a.name}>
              <text x={labelW - 12} y={y + 15} textAnchor="end" fontSize={13} fontWeight={700} fill="#0E2C44">
                {a.name}
              </text>
              <rect x={labelW} y={y} width={barW} height={22} rx={5} fill="#EAF6FC" />
              <rect x={labelW} y={y} width={(barW * pct) / 100} height={22} rx={5} fill="#0391D3" />
              <text x={labelW + barW + 10} y={y + 16} fontSize={13} fontWeight={700} fill="#0E2C44">
                {a.percent !== null ? `${a.percent}%` : '-'}
              </text>
              {a.averagePercent !== null && (
                <line
                  x1={labelW + (barW * a.averagePercent) / 100}
                  x2={labelW + (barW * a.averagePercent) / 100}
                  y1={y - 4}
                  y2={y + 26}
                  stroke="#0E2C44"
                  strokeWidth={2}
                  strokeDasharray="3 2"
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className={styles.legend}>
        <span>
          <i className={styles.legendBar} /> Student
        </span>
        {hasAvg && (
          <span>
            <i className={styles.legendAvg} /> {REPORT_TEXT.classAverage}
          </span>
        )}
      </div>
    </div>
  );
}
