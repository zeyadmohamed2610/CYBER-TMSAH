import {expect,it} from 'vitest';
import {passkeyFailure} from '../passkeys/errors';
it.each(['ConstraintError','NotSupportedError','UnknownError','TypeError'])('does not label a %s device error as a network failure',name=>{
 const failure=passkeyFailure(new DOMException('provider error',name));
 expect(failure.error).not.toMatch(/اتصال|إنترنت/);
 expect(failure.success).toBe(false);
});
it('recognizes a wrapped DOM error without relying on Error instance identity',()=>{
 expect(passkeyFailure({name:'WebAuthnError',cause:{name:'ConstraintError'}})).toMatchObject({code:'DEVICE_REQUIREMENTS_UNAVAILABLE'});
});
it('keeps cancellation distinct from unsupported device requirements',()=>{
 expect(passkeyFailure({cause:{name:'NotAllowedError'}})).toMatchObject({cancelled:true});
});
it('does not expose native provider messages containing account details',()=>{
 expect(passkeyFailure(new DOMException('private-account@example.com','UnknownError')).error).not.toContain('private-account');
});
