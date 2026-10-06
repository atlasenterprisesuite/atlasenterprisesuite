import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAcademyExams, type AcademyExamSummary } from '../../../lib/taxAcademyApi';

function formatMode(mode: AcademyExamSummary['mode']) {
  return mode === 'manual_practical' ? 'Practical review' : 'Written exam';
}

function formatRulePackStatus(status: AcademyExamSummary['rulePackStatus']) {
  if (status === 'training_current') return 'Training current';
  if (status === 'production_certified') return 'Production certified';
  if (status === 'retired') return 'Retired';
  return 'Draft';
}

export function ExamLibrary() {
  const [exams, setExams] = useState<AcademyExamSummary[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listAcademyExams()
      .then((items) => {
        if (!active) return;
        setExams(items);
        setState('ready');
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load exams');
        setState('error');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="academy-page">
      <section className="academy-section-head">
        <div>
          <p className="eyebrow">Governed assessment</p>
          <h1>Exams</h1>
          <p>Module, midterm, written final and practical final assessments loaded from the protected Academy bank.</p>
        </div>
      </section>

      {state === 'loading' && <p role="status">Loading governed exam catalog…</p>}
      {state === 'error' && <p role="alert">Exam catalog unavailable: {error}</p>}
      {state === 'ready' && exams.length === 0 && <p role="status">No active Academy exams are currently available.</p>}

      <section className="academy-case-grid" aria-label="Academy exams">
        {exams.map((exam) => {
          const questionCount = exam.questionCount;
          const passingScore = exam.passingScore;
          const rulePackStatus = exam.rulePackStatus;
          const mode = exam.mode;
          return (
            <article className="academy-case-card" key={exam.examId}>
              <header>
                <span>{formatMode(mode)}</span>
                <span>{passingScore}% minimum</span>
              </header>
              <h2>{exam.title}</h2>
              <p>{questionCount} assessed items · Tax year {exam.taxYear} · {formatRulePackStatus(rulePackStatus)}.</p>
              {rulePackStatus !== 'production_certified' && (
                <p className="academy-muted">Training only — this assessment does not authorize production filing.</p>
              )}
              <Link to={`/tax/academy/exams/${exam.examId}`}>Start exam</Link>
            </article>
          );
        })}
      </section>
    </div>
  );
}
