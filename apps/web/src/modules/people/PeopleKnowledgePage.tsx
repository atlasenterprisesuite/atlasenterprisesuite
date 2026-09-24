import { KnowledgeAtlasPage } from '../knowledge/KnowledgeAtlasPage';

export function PeopleKnowledgePage() {
  return (
    <KnowledgeAtlasPage
      moduleScope="people"
      eyebrow="ATLAS People · Knowledge"
      heading="HR Knowledge"
      description="Governed HR policies, procedures, training references, workflows and evidence for the active organization. This surface reuses ATLAS Memory and the Library Registry instead of creating a parallel HR knowledge store."
    />
  );
}
