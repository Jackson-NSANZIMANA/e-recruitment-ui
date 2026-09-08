export const DRAFT_STORAGE_KEY='usrp_application_draft';
export const DRAFT_SCHEMA_VERSION=2;
export const WIZARD_STEPS=['identity','personal','education','documents','consent','review'] as const;
export type WizardStep=(typeof WIZARD_STEPS)[number];
export const NEVER_PERSIST=['nationalId','nationalIdHash','otp','sessionToken'] as const;
export interface ApplicationDraft{readonly version:number;readonly step:WizardStep;readonly updatedAt:string;readonly fields:Readonly<Record<string,unknown>>}
export function sanitizeDraft(fields:Record<string,unknown>):Record<string,unknown>{return Object.fromEntries(Object.entries(fields).filter(([key])=>!(NEVER_PERSIST as readonly string[]).includes(key)));}
export function makeDraft(step:WizardStep,fields:Record<string,unknown>,now:Date):ApplicationDraft{return {version:DRAFT_SCHEMA_VERSION,step,updatedAt:now.toISOString(),fields:sanitizeDraft(fields)};}
export function parseDraft(raw:string|null):ApplicationDraft|null{if(!raw)return null;try{const value=JSON.parse(raw) as Partial<ApplicationDraft>;if(value.version!==DRAFT_SCHEMA_VERSION||typeof value.step!=='string'||!(WIZARD_STEPS as readonly string[]).includes(value.step)||typeof value.fields!=='object'||value.fields===null)return null;return {version:DRAFT_SCHEMA_VERSION,step:value.step as WizardStep,updatedAt:typeof value.updatedAt==='string'?value.updatedAt:'',fields:sanitizeDraft(value.fields as Record<string,unknown>)}}catch{return null}}
export function nextStep(step:WizardStep):WizardStep|null{const i=WIZARD_STEPS.indexOf(step);return i>=0&&i<WIZARD_STEPS.length-1?WIZARD_STEPS[i+1]:null}
export function previousStep(step:WizardStep):WizardStep|null{const i=WIZARD_STEPS.indexOf(step);return i>0?WIZARD_STEPS[i-1]:null}
