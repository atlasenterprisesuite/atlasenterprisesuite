import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { completeAcademyAttempt, startAcademyAttempt, submitAcademyAnswer } from '../../../lib/taxAcademyApi';

const prompts = [
  'Identify the filing-status fact that controls this scenario.',
  'Which source document must be reconciled before form activation?',
  'Identify the form or schedule that is activated by the stated facts.',
  'What evidence gate would block release if unresolved?',
  'State the dependency that must be recalculated after a material adjustment.'
] as const;

export function ExamRunner() {
  const { examId = 'module-foundations' } = useParams();
  const [attemptId, setAttemptId] = useState('');
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [state, setState] = useState('Not started');

  const start = async () => {
    setState('Starting…');
    try {
      const attempt = await startAcademyAttempt({ caseId: `exam:${examId}`, caseVersion: '2026.1', mode: examId.includes('practical') ? 'capstone' : 'exam' });
      setAttemptId(attempt.id); setState('Active');
    } catch (error) { setState(error instanceof Error ? error.message : 'Unable to start exam'); }
  };

  const save = async (index: number, value: string) => {
    const id = `exam-item-${index + 1}`;
    setResponses((current) => ({ ...current, [id]: value }));
    if (attemptId) await submitAcademyAnswer({ attemptId, questionId: id, value });
  };

  const finish = async () => {
    if (!attemptId) return;
    setState('Submitting…');
    try { await completeAcademyAttempt(attemptId); setState('Submitted — evaluation sealed'); }
    catch (error) { setState(error instanceof Error ? error.message : 'Unable to submit exam'); }
  };

  return (
    <div className="academy-page">
      <section className="academy-section-head"><div><p className="eyebrow">Exam · {examId}</p><h1>Governed Exam Runner</h1><p>Answers remain sealed during an active exam. Explanations are unavailable until submission and applicable review policy.</p></div><div className="academy-run-state"><span>{state}</span>{attemptId ? <button className="academy-primary" onClick={finish}>Submit exam</button> : <button className="academy-primary" onClick={start}>Begin exam</button>}</div></section>
      <div className="academy-warning"><strong>Closed-book assessment</strong><span>No hints, solutions or grading details are delivered to the candidate while this attempt is active.</span></div>
      <section className="academy-exam-list">
        {prompts.map((prompt, index) => <article key={prompt}><span>{index + 1}</span><div><h2>{prompt}</h2><textarea disabled={!attemptId} value={responses[`exam-item-${index + 1}`] || ''} onChange={(event) => save(index, event.target.value)} placeholder="Candidate response…" /></div></article>)}
      </section>
    </div>
  );
}
