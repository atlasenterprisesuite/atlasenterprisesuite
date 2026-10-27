import { describe, expect, it } from 'vitest';
import { validateLinuxSandboxRequest } from '../../packages/core/src/sovereignLinuxSandboxContract';

const base = {
  step:'gps5d-unit',executableId:'vitest-offline',checkoutSha:'a'.repeat(40),
  readonlyCheckout:true,privateTmp:true,dropCapabilities:true,noNewPrivileges:true,
  denyIpv4:true,denyIpv6:true,denyDns:true,denyMetadata:true,noInheritedEnvironment:true,
  noHostSockets:true,noWritableHostMounts:true,pidNamespace:true,mountNamespace:true,
  networkNamespace:true,userNamespace:true,cgroupLimits:true,timeoutMs:60000,
  memoryMb:512,outputBytes:1024,cleanupRequired:true
};
describe('GPS5D sovereign Linux sandbox fail-closed request validation', () => {
  it('validates only a fully restricted allowlisted request; does not execute it', () => {
    expect(validateLinuxSandboxRequest(base)).toEqual({allowed:true,reasons:[]});
  });
  it.each([
    ['step','shell'],['executableId','bash'],['checkoutSha','main'],
    ['readonlyCheckout',false],['privateTmp',false],['dropCapabilities',false],
    ['noNewPrivileges',false],['denyIpv4',false],['denyIpv6',false],
    ['denyDns',false],['denyMetadata',false],['noInheritedEnvironment',false],
    ['noHostSockets',false],['noWritableHostMounts',false],['pidNamespace',false],
    ['mountNamespace',false],['networkNamespace',false],['userNamespace',false],
    ['cgroupLimits',false],['cleanupRequired',false],['timeoutMs',1200001],
    ['memoryMb',4097],['outputBytes',10485761]
  ])('rejects unsafe %s', (key,value) => {
    expect(validateLinuxSandboxRequest({...base,[key]:value}).allowed).toBe(false);
  });
  it('denies unknown request and mismatched step executable', () => {
    expect(validateLinuxSandboxRequest(null).allowed).toBe(false);
    expect(validateLinuxSandboxRequest({...base,step:'gps5d-postgres'}).allowed).toBe(false);
    expect(validateLinuxSandboxRequest({...base,step:'gps5d-typecheck',executableId:'tsc-offline'}).allowed).toBe(true);
  });
});
