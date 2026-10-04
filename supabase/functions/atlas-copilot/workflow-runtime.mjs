function fail(code,status=500,details={}){return Object.assign(new Error(code),{code,status,...details});}
function cleanId(value){return typeof value==='string'&&value.trim()?value.trim():null;}
function now(clock){const value=Number(clock());return Number.isFinite(value)?value:Date.now();}
function clone(value){return structuredClone(value);}
function requireContext(context){if(!context?.organization_id||!context?.user_id)throw fail('invalid_agent_context',400);const permissions=Array.isArray(context?.permissions)?context.permissions:[];if(!permissions.includes('*')&&!permissions.includes('intelligence.use'))throw fail('permission_denied',403);return context;}
function requireStore(store){if(!store||typeof store.createWorkflowRun!=='function'||typeof store.getWorkflowRun!=='function'||typeof store.saveWorkflowRun!=='function')throw new TypeError('workflow_store_required');return store;}
function normalizeWorkflow(raw){const id=cleanId(raw?.id),version=Number(raw?.version),steps=Array.isArray(raw?.steps)?raw.steps:[];if(!id||!Number.isInteger(version)||version<1)throw new TypeError('workflow_definition_invalid');for(const step of steps){if(!cleanId(step?.id)||!['task','parallel','verify','checkpoint'].includes(step?.type))throw new TypeError('workflow_definition_invalid');if(step.type==='parallel'&&!Array.isArray(step.branches))throw new TypeError('workflow_definition_invalid');}return Object.freeze({id,version,steps:clone(steps)});}
function publicRun(run){const {organization_id,user_id,input,current_index,...safe}=run;return clone(safe);}
function errorShape(error,extra={}){return {...extra,code:cleanId(error?.code)||'workflow_step_failed',message:error instanceof Error?error.message:'workflow step failed'};}
export function createWorkflowRuntime({store,workflows=[],executors={},clock=Date.now,idFactory=()=>crypto.randomUUID()}={}){
  requireStore(store);
  const definitions=new Map((Array.isArray(workflows)?workflows:[]).map(raw=>{const wf=normalizeWorkflow(raw);return [wf.id,wf];}));
  function executor(name){const fn=executors?.[name];if(typeof fn!=='function')throw fail('workflow_executor_unavailable',503,{executor:name});return fn;}
  async function persist(run){run.updated_at=now(clock);await store.saveWorkflowRun({run:clone(run)});return run;}
  async function process(run,context){
    const workflow=definitions.get(run.workflow_id);if(!workflow||workflow.version!==run.workflow_version){run.status='failed';run.errors.push({step_id:null,code:'workflow_definition_unavailable',message:'workflow definition unavailable'});return publicRun(await persist(run));}
    run.status='running';await persist(run);
    for(let index=run.current_index;index<workflow.steps.length;index+=1){
      const step=workflow.steps[index];run.current_step_id=step.id;
      if(step.type==='checkpoint'){
        run.current_index=index+1;run.status='awaiting_checkpoint';run.checkpoint={step_id:step.id,requested_at:now(clock)};await persist(run);return publicRun(run);
      }
      if(step.type==='parallel'){
        const branches=step.branches||[];
        const settled=await Promise.allSettled(branches.map(async branch=>{
          const id=cleanId(branch?.id),name=cleanId(branch?.executor);if(!id||!name)throw fail('workflow_definition_invalid',500);
          const value=await executor(name)({input:clone(run.input),context:clone(context),outputs:clone(run.outputs),run:publicRun(run),step:clone(step),branch:clone(branch)});
          return {id,value};
        }));
        const branchOutput={};let failed=false;
        settled.forEach((result,branchIndex)=>{const branch=branches[branchIndex],branchId=cleanId(branch?.id)||`branch-${branchIndex}`;if(result.status==='fulfilled'){branchOutput[result.value.id]=clone(result.value.value);}else{failed=true;run.errors.push(errorShape(result.reason,{step_id:step.id,branch_id:branchId}));}});
        run.outputs[step.id]=branchOutput;run.current_index=index+1;await persist(run);
        if(failed){run.status='failed';run.current_step_id=step.id;await persist(run);return publicRun(run);}continue;
      }
      try{
        const name=cleanId(step.executor);if(!name)throw fail('workflow_definition_invalid',500);
        const value=await executor(name)({input:clone(run.input),context:clone(context),outputs:clone(run.outputs),run:publicRun(run),step:clone(step)});
        run.outputs[step.id]=clone(value);run.current_index=index+1;await persist(run);
      }catch(error){run.errors.push(errorShape(error,{step_id:step.id}));run.status='failed';run.current_index=index;await persist(run);return publicRun(run);}
    }
    run.status='completed';run.current_step_id=null;run.checkpoint=null;await persist(run);return publicRun(run);
  }
  async function execute({context,workflow_id,input={}}={}){
    const c=requireContext(context),workflowId=cleanId(workflow_id),workflow=definitions.get(workflowId);if(!workflow)throw fail('workflow_not_found',404);
    const runId=cleanId(idFactory());if(!runId)throw fail('internal_error',500);
    const timestamp=now(clock),run={id:runId,workflow_id:workflow.id,workflow_version:workflow.version,organization_id:c.organization_id,user_id:c.user_id,status:'created',input:clone(input),outputs:{},errors:[],current_index:0,current_step_id:null,checkpoint:null,approvals:[],created_at:timestamp,updated_at:timestamp};
    await store.createWorkflowRun({run:clone(run)});return process(run,c);
  }
  async function getRun({context,run_id}={}){const c=requireContext(context),id=cleanId(run_id);if(!id)throw fail('invalid_input',400);const run=await store.getWorkflowRun({context:c,run_id:id});if(!run)throw fail('workflow_run_not_found',404);if(run.organization_id!==c.organization_id||run.user_id!==c.user_id)throw fail('workflow_run_not_found',404);return publicRun(run);}
  async function resume({context,run_id,approval}={}){
    const c=requireContext(context),id=cleanId(run_id);if(!id)throw fail('invalid_input',400);const run=await store.getWorkflowRun({context:c,run_id:id});if(!run||run.organization_id!==c.organization_id||run.user_id!==c.user_id)throw fail('workflow_run_not_found',404);if(run.status!=='awaiting_checkpoint'||!run.checkpoint)throw fail('workflow_not_awaiting_checkpoint',409);
    const approved=approval?.approved===true,actor=cleanId(approval?.actor_id);if(!actor||actor!==c.user_id)throw fail('approval_actor_mismatch',403);
    run.approvals=Array.isArray(run.approvals)?run.approvals:[];run.approvals.push({step_id:run.checkpoint.step_id,approved,actor_id:actor,created_at:now(clock)});
    run.checkpoint=null;
    if(!approved){run.status='failed';run.errors=Array.isArray(run.errors)?run.errors:[];run.errors.push({step_id:null,code:'checkpoint_denied',message:'workflow checkpoint denied'});await persist(run);return publicRun(run);}
    return process(run,c);
  }
  return Object.freeze({execute,resume,getRun});
}
