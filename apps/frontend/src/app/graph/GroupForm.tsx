"use client";
import { useState, useEffect } from 'react';
interface GroupDraft { name:string; color_hex:string; parent_group_id:string|null }
import { GROUP_COLORS } from './constants';
import { telemetry } from './telemetryProxy';
interface GroupFormProps { initial?:any; groups:any[]; onSave:(data:any)=>Promise<void>; onCancel:()=>void; onDelete?:()=>Promise<void>; isNew:boolean; }
export function GroupForm({ initial, groups, onSave, onCancel, onDelete, isNew }: GroupFormProps){
  const [form,setForm]=useState<GroupDraft>(()=>initial||{name:'',color_hex:GROUP_COLORS[0],parent_group_id:null});
  const [saving,setSaving]=useState(false); const [error,setError]=useState<string|null>(null); const [dirty,setDirty]=useState(false);
  useEffect(()=>{ setForm(initial||{name:'',color_hex:GROUP_COLORS[0],parent_group_id:null}); setDirty(false); }, [initial?.id]);
  useEffect(()=>{ setDirty(true); },[form.name, form.color_hex, form.parent_group_id]);
  function validate(){ if(!form.name.trim()) { return 'Name required'; } return null; }
  async function handleSave(){ const v=validate(); if(v){ setError(v); return; } setSaving(true); setError(null); try { await onSave(form); telemetry(isNew?'group_create_success':'group_update_success'); setDirty(false);} catch(e:any){ setError(e.message||'Error'); telemetry(isNew?'group_create_fail':'group_update_fail'); } finally { setSaving(false);} }
  return (
    <div className="space-y-3 text-sm">
      <div>
        <label className="block text-xs font-medium">Name *</label>
  <input aria-label="Group Name" className="w-full border px-2 py-1 rounded" value={form.name} onChange={e=>setForm((f:GroupDraft)=>({...f,name:e.target.value}))} />
      </div>
      <div>
        <label className="block text-xs">Color</label>
        <div className="flex flex-wrap gap-1">
          {GROUP_COLORS.map(c=> <button key={c} type="button" className={`w-6 h-6 rounded border ${form.color_hex===c? 'outline outline-2 outline-black':''}`} style={{background:c}} onClick={()=>setForm((f:GroupDraft)=>({...f,color_hex:c}))} />)}
        </div>
      </div>
      <div>
        <label className="block text-xs">Parent Group</label>
  <select aria-label="Parent Group" className="w-full border px-2 py-1 rounded" value={form.parent_group_id||''} onChange={e=>setForm((f:GroupDraft)=>({...f,parent_group_id:e.target.value||null}))}>
          <option value="">None</option>
          {groups.filter(g=>g.id!==initial?.id).map(g=> <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      {error && <div className="text-red-600 text-xs">{error}</div>}
      <div className="flex gap-2 pt-2">
  <button aria-label="Save Group" disabled={!form.name||saving} onClick={handleSave} className="px-3 py-1 rounded bg-emerald-600 text-white disabled:opacity-40">{saving?'Saving...':'Save'}</button>
  <button aria-label="Cancel" onClick={()=>{ onCancel(); }} className="px-3 py-1 rounded border">Cancel</button>
        {!isNew && onDelete && <button onClick={()=>{ if(confirm('Delete group?')) onDelete(); }} className="ml-auto px-3 py-1 rounded bg-red-600 text-white">Delete</button>}
      </div>
    </div>
  );
}
