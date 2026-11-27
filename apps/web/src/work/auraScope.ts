export function summarizeAuraWork(org:string, rows:readonly {organizationId:string;status:string}[]) {
 if(!org.trim()) throw new Error('organization_scope_missing');
 const scoped=rows.filter(row=>row.organizationId===org);
 const byStatus:Record<string,number>=Object.create(null);
 for(const row of scoped){const status=row.status || 'unknown';byStatus[status]=(byStatus[status]??0)+1;}
 return {total:scoped.length,byStatus};
}
