import { describe, expect, it } from 'vitest';
import { iosCapabilities } from '../../apps/web/src/modules/device-os/IosDeviceSetupPage';
const baseline = { online:true, secure:true, standalone:false, notification:true, camera:true, speech:true };
describe('iOS device setup fail-closed contract',()=>{
 it('does not mark offline capability available without a verified worker',()=>expect(iosCapabilities(baseline).offline).toBe('unsupported'));
 it('blocks identity, voice and preference sync when offline',()=>{const result=iosCapabilities({...baseline,online:false});expect(result.identity).toBe('offline');expect(result.voice).toBe('offline');expect(result.preferences).toBe('offline');});
 it('does not mark camera available without secure context',()=>expect(iosCapabilities({...baseline,secure:false}).camera).toBe('unsupported'));
 it('does not claim unsupported speech recognition',()=>expect(iosCapabilities({...baseline,speech:false}).voice).toBe('unsupported'));
 it('does not mark push delivered just because API exists',()=>expect(iosCapabilities(baseline).notifications).toBe('requires-action'));
});
