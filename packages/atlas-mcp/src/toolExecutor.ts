import type { AtlasOrchestrator, PersistencePort } from '../../ai-core/src';
import { authorize, type AtlasActor } from '../../governance/src';
import type { AtlasTask, AtlasTaskState } from '../../task-protocol/src';
import { toolPermission, type AtlasToolId } from './toolIds';

export type TestKind = 'unit' | 'integration' | 'typecheck' | 'build';

export function fixedTestCommand(kind: TestKind): string {
  const commands: Record<TestKind, string> = {
    unit: 'npm run test:unit',
    integration: 'npm run test:integration',
    typecheck: 'npm run typecheck',
    build: 'npm run build'
  };
  const command = commands[kind];
  if (!command) throw new Error(`Unsupported ATLAS test command: ${String(kind)}`);
  return command;
}

export interface AtlasMcpOperations {
  repoInspect?: (args: Record<string, unknown>, actor: AtlasActor) => Promise<unknown>;
  codePropose?: (args: Record<string, unknown>, actor: AtlasActor) => Promise<unknown>;
  runFixedCommand?: (command: string, actor: AtlasActor) => Promise<unknown>;
  createPr?: (args: Record<string, unknown>, actor: AtlasActor) => Promise<unknown>;
  verifyCi?: (args: Record<string, unknown>, actor: AtlasActor) => Promise<unknown>;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function requiredString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${key} is required`);
  return value;
}

export class ToolExecutor {
  constructor(private readonly options: {
    orchestrator: AtlasOrchestrator;
    persistence: PersistencePort;
    operations?: AtlasMcpOperations;
  }) {}

  async execute(toolId: AtlasToolId, rawArgs: unknown, actor: AtlasActor): Promise<unknown> {
    const decision = authorize(actor, toolPermission[toolId], actor.scope);
    if (!decision.allowed) throw new Error(`ATLAS tool denied: ${decision.reason}`);
    const args = record(rawArgs);

    switch (toolId) {
      case 'atlas.task.create':
        return this.options.orchestrator.createTask(args.task as AtlasTask, actor);
      case 'atlas.task.read':
        return this.options.orchestrator.readTask(actor.scope, requiredString(args, 'taskId'), actor);
      case 'atlas.task.update':
        return this.options.orchestrator.transitionTask(
          actor.scope,
          requiredString(args, 'taskId'),
          requiredString(args, 'state') as AtlasTaskState,
          actor
        );
      case 'atlas.agent.delegate':
        return this.options.orchestrator.delegate(
          actor.scope,
          requiredString(args, 'taskId'),
          requiredString(args, 'agentId'),
          requiredString(args, 'prompt'),
          actor
        );
      case 'atlas.test.run': {
        const operation = this.options.operations?.runFixedCommand;
        if (!operation) throw new Error('ATLAS test execution adapter is not configured');
        return operation(fixedTestCommand(requiredString(args, 'kind') as TestKind), actor);
      }
      case 'atlas.repo.inspect': {
        const operation = this.options.operations?.repoInspect;
        if (!operation) throw new Error('ATLAS repository inspection adapter is not configured');
        return operation(args, actor);
      }
      case 'atlas.code.propose': {
        const operation = this.options.operations?.codePropose;
        if (!operation) throw new Error('ATLAS code proposal adapter is not configured');
        return operation(args, actor);
      }
      case 'atlas.pr.create': {
        const operation = this.options.operations?.createPr;
        if (!operation) throw new Error('ATLAS pull-request adapter is not configured');
        return operation(args, actor);
      }
      case 'atlas.ci.verify': {
        const operation = this.options.operations?.verifyCi;
        if (!operation) throw new Error('ATLAS CI verification adapter is not configured');
        return operation(args, actor);
      }
      case 'atlas.deploy.request':
        return this.options.orchestrator.requestDeployment(actor.scope, requiredString(args, 'taskId'), actor);
      case 'atlas.audit.read':
        return this.options.persistence.listEvents(actor.scope, requiredString(args, 'taskId'));
      case 'atlas.task.claim':
      case 'atlas.agent.respond':
      case 'atlas.review.request':
        throw new Error(`${toolId} is declared but not enabled in collaboration fabric v1`);
      default:
        throw new Error(`Unknown ATLAS tool: ${String(toolId)}`);
    }
  }
}
