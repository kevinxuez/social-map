import { event } from '@/lib/telemetry';
export function telemetry(type:string, data?:any){ event(type, data); }
