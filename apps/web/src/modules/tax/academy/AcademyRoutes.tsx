import { Route, Routes } from 'react-router-dom';
import { AcademyAdmin } from './AcademyAdmin';
import { AcademyDashboard } from './AcademyDashboard';
import { CertificationProfile } from './CertificationProfile';
import { ExamLibrary } from './ExamLibrary';
import { ExamRunner } from './ExamRunner';
import { InstructorReviewQueue } from './InstructorReviewQueue';
import { PracticalReturnRunner } from './PracticalReturnRunner';
import { PracticeLibrary } from './PracticeLibrary';
import { ResultsDashboard } from './ResultsDashboard';
import './academy.css';

export function AcademyRoutes() {
  return (
    <Routes>
      <Route index element={<AcademyDashboard />} />
      <Route path="practice" element={<PracticeLibrary />} />
      <Route path="practice/:caseId" element={<PracticalReturnRunner />} />
      <Route path="exams" element={<ExamLibrary />} />
      <Route path="exams/:examId" element={<ExamRunner />} />
      <Route path="results" element={<ResultsDashboard />} />
      <Route path="certification" element={<CertificationProfile />} />
      <Route path="review" element={<InstructorReviewQueue />} />
      <Route path="admin" element={<AcademyAdmin />} />
    </Routes>
  );
}
