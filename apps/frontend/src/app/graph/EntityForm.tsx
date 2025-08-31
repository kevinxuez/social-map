"use client";
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useDebouncedCallback } from './useDebouncedCallback';
interface EntityDraft { name:string; contact_email?:string; contact_phone?:string; notes?:string; groups_in:string[]; connected_people:string[]; main_group_id?:string|null }
import { telemetry } from './telemetryProxy';
interface EntityFormProps { initial?: any; groups: any[]; entities: any[]; links: any[]; onSave:(data:any)=>Promise<void>; onCancel:()=>void; onDelete?:()=>Promise<void>; isNew:boolean; loading?:boolean; }
export function EntityForm({ initial, groups, entities, links, onSave, onCancel, onDelete, isNew }: EntityFormProps){
  // normalize initial so required array fields always exist
  const normalizedInitial: EntityDraft | undefined = initial ? (()=>{
    return {
      ...initial,
      name: initial.name || '',
      contact_email: initial.contact_email || '',
      contact_phone: initial.contact_phone || '',
      notes: initial.notes || '',
      groups_in: (initial as any).groups_in ?? (initial as any).groupIds ?? [],
      connected_people: (initial as any).connected_people ?? [],
      main_group_id: (initial as any).main_group_id ?? (initial as any).mainGroupId ?? null,
    } as EntityDraft;
  })() : undefined;
  const [form,setForm]=useState<EntityDraft>(()=> normalizedInitial || {name:'',contact_email:'',contact_phone:'',notes:'',groups_in:[],connected_people:[], main_group_id:null});
  const [saving,setSaving]=useState(false); const [error,setError]=useState<string|null>(null);
  // map for edge labels keyed by other entity id
  const [edgeLabels,setEdgeLabels]=useState<Record<string,string>>({});
  const [edgeIds,setEdgeIds]=useState<Record<string,string>>({}); // otherId -> edgeId
  useEffect(()=>{ setForm(normalizedInitial || {name:'',contact_email:'',contact_phone:'',notes:'',groups_in:[],connected_people:[], main_group_id:null}); }, [initial?.id]);
  // initialize edge label maps from links
  useEffect(()=>{
    if(!initial) { setEdgeLabels({}); setEdgeIds({}); return; }
    const map:Record<string,string>={}; const idMap:Record<string,string>={};
    links.forEach(l=>{
      if(l.source===initial.id){ map[l.target]= l.label||''; idMap[l.target]=l.id; }
      else if(l.target===initial.id){ map[l.source]= l.label||''; idMap[l.source]=l.id; }
    });
    setEdgeLabels(map); setEdgeIds(idMap);
  },[initial?.id, links]);

  // debounce label patch
  const debouncedPatch = useDebouncedCallback(async (edgeId:string,label:string)=>{
    try { await api.updateEdge(edgeId,{label: label||null}); telemetry('edge_label_update',{id:edgeId}); } catch(e){ /* swallow */ }
  },500);

  function toggleConnection(otherId:string){
    setForm(f=>{
      const active = f.connected_people.includes(otherId);
      const next = active ? f.connected_people.filter(x=>x!==otherId) : [...f.connected_people, otherId];
      return {...f, connected_people: next};
    });
    if(initial){
      // immediate edge create/delete (optimistic) separate from entity save so user can label promptly
      if(!form.connected_people.includes(otherId)){
        // create
        api.createEdge({a_id: initial.id, b_id: otherId}).then(r=>{
          if(r.id){ setEdgeIds(m=>({...m,[otherId]:r.id})); telemetry('edge_add',{id:r.id}); }
        });
      } else {
        const eid = edgeIds[otherId]; if(eid){ api.deleteEdge(eid).then(()=> telemetry('edge_remove',{id:eid})); }
        setEdgeLabels(m=>{ const cp={...m}; delete cp[otherId]; return cp; });
      }
    }
  }

  function updateEdgeLabelLocal(otherId:string,val:string){
    setEdgeLabels(m=>({...m,[otherId]:val}));
    const eid = edgeIds[otherId]; if(eid){ debouncedPatch(eid,val); }
  }
  const [dirty,setDirty]=useState(false);
  useEffect(()=>{ setDirty(true); },[form.name,form.contact_email,form.contact_phone,form.notes,form.groups_in,form.connected_people]);
  function validate(){
    if(!form.name.trim()) { return 'Name required'; }
    return null; // relaxed: no email/phone validation
  }
  async function handleSave(){
    const v = validate(); if(v){ setError(v); return; }
    setSaving(true); setError(null);
    // sanitize: trim, convert blanks to null, dedupe arrays
    const sanitized = {
      ...form,
      contact_email: form.contact_email && form.contact_email.trim() !== '' ? form.contact_email.trim() : null,
      contact_phone: form.contact_phone && form.contact_phone.trim() !== '' ? form.contact_phone.trim() : null,
      groups_in: Array.from(new Set(form.groups_in)),
      connected_people: Array.from(new Set(form.connected_people)),
    };
  try { await onSave(sanitized); telemetry(isNew?'entity_create_success':'entity_update_success'); setDirty(false); } catch(e:any){ const msg=e.message||'Error'; setError(msg); telemetry(isNew?'entity_create_fail':'entity_update_fail'); } finally { setSaving(false); }
  }
  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="block text-xs font-medium">Name *</label>
  <input aria-label="Name" className="w-full border px-2 py-1 rounded" value={form.name} onChange={e=>setForm((f:EntityDraft)=>({...f,name:e.target.value}))} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs">Email</label>
          <input aria-label="Email" className="w-full border px-2 py-1 rounded" value={form.contact_email||''} onChange={e=>setForm((f:EntityDraft)=>({...f,contact_email:e.target.value}))} />
        </div>
        <div>
          <label className="block text-xs">Phone</label>
          <input aria-label="Phone" className="w-full border px-2 py-1 rounded" value={form.contact_phone||''} onChange={e=>setForm((f:EntityDraft)=>({...f,contact_phone:e.target.value}))} />
        </div>
      </div>
      <div>
        <label className="block text-xs">Notes</label>
  <textarea aria-label="Notes" className="w-full border px-2 py-1 rounded h-20" value={form.notes||''} onChange={e=>setForm((f:EntityDraft)=>({...f,notes:e.target.value}))} />
      </div>
      <div>
        <label className="block text-xs">Groups</label>
        <div className="flex flex-wrap gap-1">
          {groups.map(g=>{
            const active = form.groups_in.includes(g.id);
            return (
              <button
                type="button"
                key={g.id}
                className={`px-2 py-0.5 rounded text-[11px] border ${active?'bg-blue-600 text-white':'bg-white'}`}
                onClick={()=> setForm((prev:EntityDraft)=>{
                  const wasActive = prev.groups_in.includes(g.id);
                  const nextGroups = wasActive ? prev.groups_in.filter(x=>x!==g.id) : [...prev.groups_in, g.id];
                  let nextMain = prev.main_group_id;
                  if(wasActive && prev.main_group_id===g.id){ nextMain = null; }
                  // if no main group selected yet, set first added as main
                  if(!wasActive && !nextMain){ nextMain = g.id; }
                  return { ...prev, groups_in: nextGroups, main_group_id: nextMain };
                })}
              >{g.name}</button>
            );
          })}
        </div>
      <div>
        <label className="block text-xs">Main Group</label>
        <select aria-label="Main Group" className="w-full border px-2 py-1 rounded" value={form.main_group_id||''} onChange={e=> setForm(f=>({...f, main_group_id: e.target.value||null}))}>
          <option value="">None</option>
          {form.groups_in.map(gid=>{ const g = groups.find(gg=>gg.id===gid); if(!g) { return null; } return <option key={gid} value={gid}>{g.name}</option>; })}
        </select>
      </div>
      </div>
      <div>
        <label className="block text-xs">Connections (click to toggle; edit labels)</label>
        <div className="space-y-1 max-h-40 overflow-y-auto border p-1 rounded">
          {entities.filter(e=>e.id!==initial?.id).map(e=>{
            const active = form.connected_people.includes(e.id);
            return <div key={e.id} className={`flex items-center gap-2 text-[11px] px-1 py-0.5 rounded ${active?'bg-emerald-50':''}`}>
              <button type="button" className={`px-2 py-0.5 rounded border ${active?'bg-emerald-600 text-white':'bg-white'}`} onClick={()=>toggleConnection(e.id)} aria-label={active? 'Remove connection':'Add connection'}>{active?'−':'+'}</button>
              <span className="flex-1 cursor-pointer" onClick={()=>toggleConnection(e.id)}>{e.name}</span>
              {active && (
                <input
                  className="border px-1 py-0.5 rounded flex-1 min-w-20"
                  placeholder="Label"
                  value={edgeLabels[e.id]||''}
                  onChange={ev=> updateEdgeLabelLocal(e.id, ev.target.value)}
                />
              )}
            </div>;
          })}
        </div>
      </div>
      {error && <div className="text-red-600 text-xs">{error}</div>}
      <div className="flex gap-2 pt-2">
  <button aria-label="Save Entity" disabled={!form.name||saving} onClick={handleSave} className="px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-40">{saving?'Saving...':'Save'}</button>
  <button aria-label="Cancel" onClick={()=>{ onCancel(); }} className="px-3 py-1 rounded border">Cancel</button>
        {!isNew && onDelete && <button onClick={()=>{ if(confirm('Delete entity?')) onDelete(); }} className="ml-auto px-3 py-1 rounded bg-red-600 text-white">Delete</button>}
      </div>
    </div>
  );
}
