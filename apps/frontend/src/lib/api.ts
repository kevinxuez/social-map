export const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init?.headers||{}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const api = {
  getGraph: () => request<GraphResponse>('/graph'),
  savePositions: (positions: {id:string,x:number,y:number}[]) => request<{updated:number}>(`/graph/positions`, { method:'PUT', body: JSON.stringify(positions)}),
  listEntities: (params: {search?: string; group_id?: string} = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.group_id) q.set('group_id', params.group_id);
    return request<any[]>(`/entities?${q.toString()}`);
  },
  createEntity: (body: any) => request<any>('/entities', { method:'POST', body: JSON.stringify(body)}),
  updateEntity: (id: string, body: any) => request<any>(`/entities/${id}`, { method:'PATCH', body: JSON.stringify(body)}),
  deleteEntity: (id: string) => request<{deleted:boolean}>(`/entities/${id}`, { method:'DELETE'}),
  listGroups: () => request<any[]>('/groups'),
  createGroup: (body: any) => request<any>('/groups', { method:'POST', body: JSON.stringify(body)}),
  updateGroup: (id: string, body: any) => request<any>(`/groups/${id}`, { method:'PATCH', body: JSON.stringify(body)}),
  deleteGroup: (id: string) => request<any>(`/groups/${id}`, { method:'DELETE'}),
  createEdge: (body: any) => request<any>('/edges', { method:'POST', body: JSON.stringify(body)}),
  updateEdge: (id: string, body: any) => request<any>(`/edges/${id}`, { method:'PATCH', body: JSON.stringify(body)}),
  deleteEdge: (id: string) => request<any>(`/edges/${id}`, { method:'DELETE'}),
};

export interface GraphNode { id:string; name:string; contact_email?:string; contact_phone?:string; notes?:string; groupIds:string[]; mainGroupId?:string|null; isCurrentUser:boolean; x?:number; y?:number; }
export interface GraphLink { id:string; source:string; target:string; label?:string|null; }
export interface GraphGroup { id:string; name:string; color?:string; parentId?:string|null; memberIds:string[]; }
export interface GraphResponse { nodes:GraphNode[]; links:GraphLink[]; groups:GraphGroup[] }

export function seededColor(name: string): string {
  let h = 5381;
  for (let i=0;i<name.length;i++) h = ((h<<5)+h)+name.charCodeAt(i);
  const H = (h >>> 0) % 360;
  return `hsl(${H} 60% 60%)`;
}