import { Link } from 'react-router-dom';

const exams = [
  { id: 'module-foundations', title: 'Foundations Module Exam', questions: 10, threshold: '80%' },
  { id: 'midterm-50', title: 'Midterm', questions: 50, threshold: '85%' },
  { id: 'final-written-100', title: 'Final Written', questions: 100, threshold: '90%+' },
  { id: 'practical-final', title: 'Practical Final', questions: 5, threshold: '90% each' }
] as const;

export function ExamLibrary() {
  return (
    <div className="academy-page">
      <section className="academy-section-head"><div><p className="eyebrow">Governed assessment</p><h1>Exams</h1><p>Module, midterm, written final and practical final assessments.</p></div></section>
      <section className="academy-case-grid">
        {exams.map((exam) => <article className="academy-case-card" key={exam.id}><header><span>Exam</span><span>{exam.threshold}</span></header><h2>{exam.title}</h2><p>{exam.questions} assessed items. Critical compliance items may require 100%.</p><Link to={`/tax/academy/exams/${exam.id}`}>Start exam</Link></article>)}
      </section>
    </div>
  );
}
