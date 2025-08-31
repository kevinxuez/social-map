export interface TelemetryEvent { type:string; ts:number; data?:any }

export async function sendEvent(e: TelemetryEvent) {
  const base = process.env.NEXT_PUBLIC_API_BASE!;
  try {
    await fetch(`${base}/telemetry`, { method:'POST', body: JSON.stringify(e), headers:{'Content-Type':'application/json'} });
  } catch {
    // swallow
  }
}

export function event(type: string, data?: any) {
  sendEvent({ type, ts: Date.now(), data });
}
