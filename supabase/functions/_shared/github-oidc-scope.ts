const DEFAULT_GITHUB_REPOSITORY = 'atlasenterprisesuite/atlasenterprisesuite';
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function configuredRepositories() {
  const raw =
    Deno.env.get('ATLAS_GITHUB_REPOSITORIES') ||
    Deno.env.get('ATLAS_CANONICAL_REPO') ||
    DEFAULT_GITHUB_REPOSITORY;

  const repositories = [...new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  )];

  if (repositories.length === 0 || repositories.some((value) => !REPOSITORY_PATTERN.test(value))) {
    throw new Error('atlas_github_repository_scope_invalid');
  }

  return repositories;
}

export function createGitHubOidcScope(workflowFiles: string[]) {
  const repositories = configuredRepositories();
  const repositorySet = new Set(repositories);
  const workflowRefs = new Set(
    repositories.flatMap((repository) =>
      workflowFiles.map(
        (workflow) => `${repository}/.github/workflows/${workflow}@refs/heads/main`
      )
    )
  );

  return {
    repositories,
    canonicalRepository: repositories[0],
    workflowRefs,
    allowsRepository(repository: unknown, owner: unknown) {
      const repositoryValue = String(repository || '');
      const ownerValue = String(owner || '');
      if (!repositorySet.has(repositoryValue)) return false;
      return repositoryValue.split('/')[0] === ownerValue;
    }
  };
}
