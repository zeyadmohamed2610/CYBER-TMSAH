import {passkeyFailure} from './errors';
/** Small, user-copyable report; never includes a challenge, credential, session or account ID. */
export interface RegistrationDiagnostic {
  stage:'device-create';
  errorName:string;
  errorCode:string;
  message:string;
  origin:string;
  rpId:string;
  destination:string;
  userActivation:boolean|null;
  browser:string;
}
function record(value:unknown):Record<string,unknown> {return value && typeof value==='object' ? value as Record<string,unknown> : {};}
function safeMessage(value:unknown):string {
  if(typeof value!=='string')return '';
  return value.replace(/\S+@\S+/g,'[removed]').replace(/https?:\/\/\S+/g,'[url]').replace(/[A-Za-z0-9_+./=-]{24,}/g,'[removed]').slice(0,240);
}
export function registrationDiagnostic(error:unknown,options:unknown,destination:string,userActivation:boolean|null):RegistrationDiagnostic {
  const detail=record(error),cause=record(detail.cause),rp=record(record(options).rp);
  const classified=passkeyFailure(error);
  return {
    stage:'device-create',
    errorName:typeof cause.name==='string' ? cause.name.slice(0,60) : typeof detail.name==='string' ? detail.name.slice(0,60) : 'Unknown',
    errorCode:typeof detail.code==='string' && /^[A-Z0-9_]{1,100}$/.test(detail.code) ? detail.code : ('code' in classified ? classified.code : undefined) ?? 'UNCLASSIFIED',
    message:safeMessage(cause.message ?? detail.message),
    origin:location.origin,rpId:typeof rp.id==='string' ? rp.id : '',destination,userActivation,
    browser:navigator.userAgent.match(/(?:Chrome|Firefox|Version)\/\d+(?:\.\d+)*/)?.[0] ?? 'Unknown',
  };
}
