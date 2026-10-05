import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  completeAcademyExamAttempt,
  getAcademyExam,
  startAcademyAttempt,
  submitAcademyAnswer,
  type AcademyExamPayload,
  type AcademyExamSubmissionResult
} from '../../../lib/taxAcademyApi';

export function ExamRunner() {
  const { examId = 'module-foundations' } = useParams();
  const [exam, setExam] = useState<AcademyExamPayload | null>(null);
  const [attemptId, setAttemptId] = useState('');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AcademyExamSubmissionResult | null>(null);
  const [state, setState] = useState('Not started');

  const start = async () => {
    setState('Loading protected exam…');
    try {
      const payload = await getAcademyExam(examId);
      const attempt = await startAcademyAttempt({
        caseId: `exam:${payload.examId}`,
        caseVersion: payload.version,
        mode: payload.mode === 'manual_practical' ? 'capstone' : 'exam'
      });
      setExam(payload);
      setAttemptId(attempt.id);
      setResult(null);
      setState('Active');
    } catch (error) {
      setState(error instanceof Error ? error.message : 'Unable to start exam');
    }
  };

  const save = async (questionId: string, value: string) => {
    setResponses((current) => ({ ...current, [questionId]: value }));
    if (attemptId) await submitAcademyAnswer({ attemptId, questionId, value });
  };

  const finish = async () => {
    if (!attemptId) return;
    setState('Submitting…');
    try {
      const submission = await completeAcademyExamAttempt(attemptId);
      setResult(submission);
      if (submission.passed === null) setState('Submitted — reviewer evaluation pending');
      else setState(submission.passed ? `Passed · ${submission.score}%` : `Not passed · ${submission.score}%`);
    } catch (error) {
      setState(error instanceof Error ? error.message : 'Unable to submit exam');
    }
  };

  return (
    <div className="academy-page">
      <section className="academy-section-head">
        <div>
          <p className="eyebrow">Exam · {examId}</p>
          <h1>{exam?.title || 'Governed Exam Runner'}</h1>
          <p>Answers remain sealed during an active exam. Explanations are unavailable until submission and applicable review policy.</p>
        </div>
        <div className="academy-run-state">
          <span>{state}</span>
          {attemptId && !result
            ? <button className="academy-primary" onClick={finish}>Submit exam</button>
            : !attemptId
              ? <button className="academy-primary" onClick={start}>Begin exam</button>
              : null}
        </div>
      </section>

      <div className="academy-warning">
        <strong>Closed-book assessment</strong>
        <span>No hints, solutions or grading details are delivered to the candidate while this attempt is active.</span>
      </div>

      {result ? (
        <section className="academy-result-card" aria-live="polite">
          <h2>Assessment result</h2>
          {result.score === null ? (
            <p>This practical assessment is awaiting authorized reviewer scoring.</p>
          ) : (
            <p>Score: <strong>{result.score}%</strong> · {result.passed ? 'Passed' : 'Not passed'}</p>
          )}
          {result.criticalFailures.length > 0 && (
            <p>Critical compliance failures: {result.criticalFailures.join(', ')}</p>
          )}
        </section>
      ) : null}

      <section className="academy-exam-list">
        {(exam?.questions || []).map((question, index) => (
          <article key={question.questionId}>
            <span>{index + 1}</span>
            <div>
              <h2>{question.prompt}</h2>
              {question.options.length > 0 ? (
                <div className="academy-exam-options" role="radiogroup" aria-label={`Question ${index + 1}`}>
                  {question.options.map((option) => (
                    <label key={option.value}>
                      <input
                        type="radio"
                        name={question.questionId}
                        disabled={!attemptId}
                        checked={responses[question.questionId] === option.value}
                        onChange={() => save(question.questionId, option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  disabled={!attemptId}
                  value={responses[question.questionId] || ''}
                  onChange={(event) => setResponses((current) => ({ ...current, [question.questionId]: event.target.value }))}
                  onBlur={(event) => save(question.questionId, event.target.value)}
                  placeholder="Candidate response…"
                />
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
