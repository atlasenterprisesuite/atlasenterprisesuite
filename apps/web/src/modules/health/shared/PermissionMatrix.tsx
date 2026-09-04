export function PermissionMatrix({ required, granted }: { required: readonly string[]; granted: readonly string[] }) {
  return <div className="health-panel"><h3>Permission matrix</h3><div className="permission-list">{required.map(permission => <div key={permission}><code>{permission}</code><span className={granted.includes(permission) ? 'permission-granted' : 'permission-missing'}>{granted.includes(permission) ? 'Granted' : 'Not granted'}</span></div>)}</div></div>;
}
