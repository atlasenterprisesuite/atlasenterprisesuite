import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), 'utf8');
}

const [contract, tokens, main] = await Promise.all([
  read('DESIGN.md'),
  read('apps/web/src/atlas-design-tokens.css'),
  read('apps/web/src/main.tsx')
]);

const errors = [];

const requiredContractSections = [
  '## Operating rule',
  '## Tokens',
  '## Interaction states',
  '## Responsive behavior',
  '## Accessibility',
  '## Truthful state policy',
  '## Completion gate'
];

for (const section of requiredContractSections) {
  if (!contract.includes(section)) errors.push(`DESIGN.md missing: ${section}`);
}

const requiredTokens = [
  '--atlas-bg:',
  '--atlas-surface-1:',
  '--atlas-text:',
  '--atlas-cyan:',
  '--atlas-success:',
  '--atlas-warning:',
  '--atlas-danger:',
  '--atlas-focus:',
  '--atlas-radius-md:',
  '--atlas-space-4:',
  '--atlas-font-sans:',
  '--atlas-duration-base:',
  '--atlas-touch-target:'
];

for (const token of requiredTokens) {
  if (!tokens.includes(token)) errors.push(`atlas-design-tokens.css missing: ${token}`);
}

const tokenImport = "import './atlas-design-tokens.css';";
const globalStyleImport = "import './styles.css';";
const tokenIndex = main.indexOf(tokenImport);
const styleIndex = main.indexOf(globalStyleImport);

if (tokenIndex === -1) errors.push('main.tsx does not import atlas-design-tokens.css');
if (styleIndex === -1) errors.push('main.tsx does not import styles.css');
if (tokenIndex !== -1 && styleIndex !== -1 && tokenIndex > styleIndex) {
  errors.push('atlas-design-tokens.css must load before styles.css');
}

if (!tokens.includes('@media (prefers-reduced-motion: reduce)')) {
  errors.push('design tokens must include reduced-motion behavior');
}

if (!tokens.includes(':focus-visible')) {
  errors.push('design tokens must include a shared focus-visible treatment');
}

if (errors.length) {
  console.error('ATLAS Design Intelligence gate failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('ATLAS Design Intelligence gate passed.');
