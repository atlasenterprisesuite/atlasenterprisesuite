export type AuraExecutionEvent = Readonly<{
 version: 1;
 type: 'execution.workflow.changed';
 organizationId: string;
 tenantId: string;
 workflowId: string;
 revision: number;
}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Scope must originate from verified server authorization, never the event itself.
// An accepted event is only an invalidation hint, not authoritative workflow state.
export function parseAuraExecutionEvent(value:unknown,scope:{organizationId:string;tenantId:string}):AuraExecutionEvent|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(Object.keys(v).length!==6||v.version!==1||v.type!=='execution.workflow.changed')return null;
 if(!uuid.test(scope.organizationId)||scope.tenantId!==scope.organizationId||v.organizationId!==scope.organizationId||v.tenantId!==scope.tenantId)return null;
 if(typeof v.workflowId!=='string'||!uuid.test(v.workflowId)||typeof v.revision!=='number'||!Number.isSafeInteger(v.revision)||v.revision<1)return null;
 return {version:1,type:'execution.workflow.changed',organizationId:scope.organizationId,tenantId:scope.tenantId,workflowId:v.workflowId,revision:v.revision};
}
