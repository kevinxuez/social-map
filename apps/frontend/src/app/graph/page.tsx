"use client";
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, GraphResponse, seededColor } from '@/lib/api';
import { event as telemetry } from '@/lib/telemetry';
import Nav from '@/components/Nav';
import { useEffect, useMemo, useRef, useState } from 'react';
import { withPageAuthRequired, useUser } from '@auth0/nextjs-auth0/client';
import { polygonHull } from 'd3-polygon';
import { Toolbar } from './Toolbar';
import { EntityForm } from './EntityForm';
import { GroupForm } from './GroupForm';
import { pointInPoly } from './pointInPoly';
import { useDebouncedCallback } from './useDebouncedCallback';
import { Drawer } from './Drawer';
import { ConfirmModal } from './ConfirmModal';
// Proper dynamic import of 2D force graph (avoids bundling VR/A-Frame extras)
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

// Utility: derive a stroke color (slightly darker) from given color (handles hex or hsl)
function deriveStroke(col:string){
  if(col.startsWith('#') && (col.length===7||col.length===4)){
    try {
      const hex = col.length===4 ? '#'+[col[1],col[1],col[2],col[2],col[3],col[3]].join('') : col;
      const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
      const dark = (x:number)=> Math.max(0, Math.min(255, Math.round(x*0.8)));
      const rd=dark(r), gd=dark(g), bd=dark(b);
      return `rgb(${rd},${gd},${bd})`;
    } catch { return col; }
  }
  // hsl(h s% l%) -> reduce lightness
  if(col.startsWith('hsl')){
    return col.replace(/(\d+%)(\))/,'calc($1 - 10%)$2');
  }
  return col;
}

function useEnsureCurrentUser() {
  const { user } = useUser();
  const qc = useQueryClient();
  useEffect(() => {
    (async () => {
      if (!user?.email) {
        return;
      }
      const ents = await api.listEntities({ search: user.email });
      const exists = ents.find((e:any) => e.contact_email === user.email && e.isCurrentUser);
      if (!exists) {
        await api.createEntity({ name: user.name || user.email, contact_email: user.email, is_current_user:true, groups_in:[], connected_people:[] });
        qc.invalidateQueries({ queryKey:['graph'] });
      }
    })();
  }, [user?.email]);
}

type Mode = { type: 'entity'|'group'; id?:string; isEditing:boolean; isNew:boolean } | null;

function GraphCanvas() {
  useEnsureCurrentUser();
  const qc = useQueryClient();
  const { data } = useQuery<GraphResponse>({ queryKey:['graph'], queryFn: api.getGraph, refetchInterval:10000 });
  // stable graphData prevents force simulation pulsing on refresh
  const [graphData,setGraphData] = useState<any>({nodes:[],links:[],groups:[]});
  useEffect(()=>{
    if(!data){
      return;
    }
    setGraphData((prev: any)=>{
      const nodeIndex: Record<string, any> = {}; prev.nodes.forEach((n:any)=> nodeIndex[n.id]=n);
      const newNodes = data.nodes.map(n=>{
        const ex = nodeIndex[n.id];
        if(ex){
          // update mutable fields
          ex.name = n.name;
          ex.groupIds = n.groupIds;
          ex.mainGroupId = n.mainGroupId;
          ex.isCurrentUser = n.isCurrentUser;
          ex.contact_email = n.contact_email;
          ex.contact_phone = n.contact_phone;
          ex.notes = n.notes;
          if(n.x!=null) { ex.x=n.x; }
          if(n.y!=null) { ex.y=n.y; }
          if(ex.x==null) { ex.x=(Math.random()-0.5)*500; }
          if(ex.y==null) { ex.y=(Math.random()-0.5)*500; }
          return ex;
        }
        return { ...n, x: n.x ?? (Math.random()-0.5)*500, y: n.y ?? (Math.random()-0.5)*500 };
      });
      const linkIndex: Record<string, any> = {}; prev.links.forEach((l:any)=> linkIndex[l.id]=l);
      const newLinks = data.links.map(l=>{ const ex=linkIndex[l.id]; if(ex){ ex.source=l.source; ex.target=l.target; ex.label=l.label; return ex; } return { ...l }; });
      return { nodes:newNodes, links:newLinks, groups:data.groups };
    });
  },[data]);

  const [mode,setMode] = useState<Mode>(null);
  const [activeGroupId,setActiveGroupId] = useState<string|undefined>();
  const [confirm,setConfirm] = useState<{title:string;message:string;onConfirm:()=>void}|null>(null);
  const positionsDirty = useRef<Record<string,{x:number,y:number}>>({});
  const savePositions = useMutation({
    mutationFn: (payload: {id:string,x:number,y:number}[]) => api.savePositions(payload),
    onSuccess: () => {
      positionsDirty.current = {};
      telemetry('graph_positions_saved');
      qc.invalidateQueries({queryKey:['graph']});
    }
  });
  // debounce flush
  useEffect(() => {
    const iv = setInterval(() => {
      const entries = Object.entries(positionsDirty.current).map(([id,p])=>({id,...p}));
      if (entries.length) {
        savePositions.mutate(entries);
      }
    }, 1500);
    return () => clearInterval(iv);
  }, [savePositions]);

  // Dynamic hulls: recompute each frame for live drag updates
  const hullsRef = useRef<{id:string; hull:[number,number][]|null; color:string}[]>([]);
  function computeHulls(){
    const gd = graphData;
    if(!gd?.groups?.length){ hullsRef.current=[]; return hullsRef.current; }
    const groupMap: Record<string, { pts:[number,number][]; color:string }> = {};
    gd.groups.forEach((g:any)=>{ groupMap[g.id]={pts:[], color: g.color || seededColor(g.name)}; });
    (gd.nodes||[]).forEach((n:any)=>{
      if(typeof n.x==='number' && typeof n.y==='number'){
        (n.groupIds||[]).forEach((gid:string)=>{ const gm = groupMap[gid]; if(gm){ gm.pts.push([n.x,n.y]); } });
      }
    });
    const PAD=35;
    const rectFrom=(points:[number,number][]):[number,number][]=>(()=>{ const xs=points.map(p=>p[0]); const ys=points.map(p=>p[1]); const minX=Math.min(...xs)-PAD,maxX=Math.max(...xs)+PAD,minY=Math.min(...ys)-PAD,maxY=Math.max(...ys)+PAD; return [[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY]]; })();
    hullsRef.current = Object.entries(groupMap).map(([id,g])=>{
      let hull: [number,number][]|null = null;
      if(g.pts.length>=3){ hull = polygonHull(g.pts) as [number,number][]|null; }
      else if(g.pts.length>0){ hull = rectFrom(g.pts); }
      return { id, hull, color: g.color };
    });
    return hullsRef.current;
  }

  // track which edge is being edited for its label
  const [editingEdgeId, setEditingEdgeId] = useState<string|null>(null);
  const [edgeLabelDraft, setEdgeLabelDraft] = useState('');
  const updateEdgeLabel = useMutation({
    mutationFn: async ({id,label}:{id:string;label:string}) => api.updateEdge(id,{label: label || null}),
    onSuccess:(_,vars)=>{
      telemetry('edge_label_update',{id:vars.id});
      qc.invalidateQueries({queryKey:['graph']});
    }
  });
  const debouncedEdgeLabelSave = useDebouncedCallback(()=>{
    if(editingEdgeId) {
      updateEdgeLabel.mutate({id:editingEdgeId,label:edgeLabelDraft});
    }
  },600);
  useEffect(()=>{ debouncedEdgeLabelSave(); },[edgeLabelDraft]);

  function beginEditEdge(edge:any){
    setEditingEdgeId(edge.id);
    setEdgeLabelDraft(edge.label||'');
  }
  function finishEditEdge(){
    if(editingEdgeId){
      updateEdgeLabel.mutate({id:editingEdgeId,label:edgeLabelDraft});
    }
    setEditingEdgeId(null);
  }

  const groups = graphData.groups || [];
  const entities = graphData.nodes || [];
  function openEntity(id:string){ const ent = entities.find((e:any)=>e.id===id); if(!ent) { return; } setMode({type:'entity',id, isEditing:false,isNew:false}); telemetry('drawer_open',{id}); }
  function openGroup(id:string){ const g = groups.find((g:any)=>g.id===id); if(!g) { return; } setMode({type:'group',id,isEditing:false,isNew:false}); telemetry('drawer_open',{id}); setActiveGroupId(id); }

  const drawerContent = (()=>{
  if(!mode) { return null; }
    if(mode.type==='entity'){
  const ent = mode.id ? entities.find((e:any)=>e.id===mode.id) : undefined;
      if(mode.isEditing){
        // normalize initial entity shape for form (map graph fields to API fields)
        const entInitial = mode.isNew
          ? (activeGroupId ? { groups_in:[activeGroupId] } : undefined)
          : ent ? { 
              ...ent,
              groups_in: (ent as any).groups_in || ent.groupIds || [],
              main_group_id: ent.mainGroupId,
              // derive current connections from links (handle object or id refs)
              connected_people: Array.from(new Set((graphData.links||[]).flatMap((l:any)=>{
                const s = typeof l.source === 'object' ? l.source.id : l.source;
                const t = typeof l.target === 'object' ? l.target.id : l.target;
                if(s===ent.id) { return [t]; }
                if(t===ent.id) { return [s]; }
                return [];
              })))
            } : undefined;
  return <EntityForm key={mode.isNew? 'new': (ent?.id||'none')} isNew={mode.isNew} initial={entInitial} groups={groups} entities={entities} links={data?.links||[]} onSave={async (form)=>{
          if(mode.isNew){ const created = await api.createEntity({...form}); qc.setQueryData(['graph'], (old:any)=>old); setMode({type:'entity', id: created.id, isEditing:false, isNew:false}); }
          else if(ent){ await api.updateEntity(ent.id, form); setMode(m=> m? {...m,isEditing:false,isNew:false}:m); }
          qc.invalidateQueries({queryKey:['graph']});
        }} onCancel={()=>{ if(mode.isNew) { setMode(null); } else { setMode(m=> m? {...m,isEditing:false}:m ); } }} onDelete={async ()=>{ if(!ent) { return; } setConfirm({
          title: 'Delete Entity',
          message: 'Are you sure you want to delete this entity? This will remove its connections.',
          onConfirm: async ()=>{ telemetry('entity_delete_confirm',{id:ent.id}); setConfirm(null); setMode(null); // optimistic: remove from cache
            qc.setQueryData(['graph'], (old:any)=> old? ({...old, nodes: old.nodes.filter((n:any)=>n.id!==ent.id), links: old.links.filter((l:any)=> l.source!==ent.id && l.target!==ent.id) }):old);
            await api.deleteEntity(ent.id); telemetry('entity_delete_success',{id:ent.id}); qc.invalidateQueries({queryKey:['graph']}); }
        }); }} />;
      }
      // view mode
      if(!ent) return null;
  // Normalize link endpoints (force-graph mutates source/target into node objects)
  const connIds = new Set((graphData?.links||[])
    .filter((l:any)=>{
      const s = typeof l.source==='object' ? l.source.id : l.source;
      const t = typeof l.target==='object' ? l.target.id : l.target;
      return s===ent.id || t===ent.id;
    })
    .map((l:any)=>{
      const s = typeof l.source==='object' ? l.source.id : l.source;
      const t = typeof l.target==='object' ? l.target.id : l.target;
      return s===ent.id ? t : s;
    }));
  const conns = entities.filter((e:any)=> connIds.has(e.id));
  const mainGroupName = ent.mainGroupId ? (groups.find((g:any)=>g.id===ent.mainGroupId)?.name || ent.mainGroupId) : '—';
      return <div className="space-y-2 text-sm">
        <div className="flex justify-between items-start"><h2 className="font-bold text-lg">{ent.name}</h2><button className="text-xs underline" onClick={()=>setMode(m=> m? {...m,isEditing:true}:m)}>Edit</button></div>
        {ent.contact_email && <div>Email: {ent.contact_email}</div>}
        {ent.contact_phone && <div>Phone: {ent.contact_phone}</div>}
        {ent.notes && <div className="whitespace-pre-wrap">{ent.notes}</div>}
  <div>Main Group: {mainGroupName}</div>
        <div>Groups: {ent.groupIds.length}</div>
        <div className="pt-2">
          <div className="font-semibold mb-1">Connections</div>
          <ul className="list-disc ml-4">
            {conns.map((c:any)=> <li key={c.id}><button className="underline" onClick={()=>openEntity(c.id)}>{c.name}</button></li>)}
          </ul>
        </div>
      </div>;
    } else if(mode.type==='group') {
  const grp = mode.id ? groups.find((g:any)=>g.id===mode.id): undefined;
      if(mode.isEditing){
        const grpInitial = mode.isNew ? undefined : grp ? { ...grp, color_hex: (grp as any).color_hex || grp.color, parent_group_id: (grp as any).parent_group_id ?? grp.parentId } : undefined;
  return <GroupForm key={mode.isNew? 'new': (grp?.id||'none')} isNew={mode.isNew} initial={grpInitial} groups={groups} onSave={async (form)=>{ if(mode.isNew){ const created = await api.createGroup(form); setMode({type:'group', id: created.id, isEditing:false, isNew:false}); } else if(grp){ await api.updateGroup(grp.id, form); setMode(m=> m? {...m,isEditing:false,isNew:false}:m); } qc.invalidateQueries({queryKey:['graph']}); }} onCancel={()=>{ if(mode.isNew) { setMode(null); } else { setMode(m=> m? {...m,isEditing:false}:m ); } }} onDelete={async ()=>{ if(!grp) { return; } setConfirm({
          title:'Delete Group',
          message:'Delete this group? Entities remain but will lose this group membership.',
          onConfirm: async ()=>{ telemetry('group_delete_confirm',{id:grp.id}); setConfirm(null); setMode(null); if(activeGroupId===grp.id){ setActiveGroupId(undefined);} qc.setQueryData(['graph'], (old:any)=> old? ({...old, groups: old.groups.filter((g:any)=>g.id!==grp.id)}):old); await api.deleteGroup(grp.id); telemetry('group_delete_success',{id:grp.id}); qc.invalidateQueries({queryKey:['graph']}); }
        }); }} />;
      }
      if(!grp) return null;
  const members = entities.filter((e:any)=> e.groupIds.includes(grp.id));
      return <div className="space-y-2 text-sm">
        <div className="flex justify-between items-start"><h2 className="font-bold text-lg flex items-center gap-2"><span className="inline-block w-3 h-3 rounded" style={{background: grp.color || seededColor(grp.name)}} />{grp.name}</h2><button className="text-xs underline" onClick={()=>setMode(m=> m? {...m,isEditing:true}:m)}>Edit</button></div>
        <div>Members: {members.length}</div>
        <div className="pt-2">
          <div className="font-semibold mb-1">Member List</div>
          <ul className="list-disc ml-4 max-h-40 overflow-y-auto">
            {members.map((m:any)=> <li key={m.id}><button className="underline" onClick={()=>openEntity(m.id)}>{m.name}</button></li>)}
          </ul>
        </div>
      </div>;
    }
    return null;
  })();

  if (!graphData.nodes.length && !graphData.links.length) {
    return <div className="flex-1"/>;
  }
  return (
    <>
  <Toolbar onAddEntity={()=> setMode({type:'entity', isEditing:true, isNew:true}) } onAddGroup={()=> setMode({type:'group', isEditing:true, isNew:true}) } legend={groups.map((g:any)=>({id:g.id,name:g.name,color:g.color||seededColor(g.name)}))} />
      <Drawer open={!!mode} onClose={()=> setMode(null)}>
        <button className="text-xs mb-2" onClick={()=> setMode(null)}>Close</button>
        {drawerContent}
      </Drawer>
      <ForceGraph2D
        graphData={graphData as any}
        nodeLabel={(n: any) => n.name}
        onNodeClick={(n: any) => { openEntity(n.id); }}
        enableNodeDrag
        linkWidth={1}
        linkColor={()=>'#999'}
        onNodeDrag={(n:any)=>{
          // When user starts dragging a previously frozen node, release it so drag can reposition freely
          if(n.__dragActiveStarted !== true){
            // mark we've begun a fresh drag cycle
            n.__dragActiveStarted = true;
            // release prior fixed constraints so pointer can drive position, force-graph will set fx/fy during drag
            n.fx = undefined; n.fy = undefined;
          }
        }}
        onNodeDragEnd={(n: any) => {
          // Persist final position
          positionsDirty.current[n.id] = { x: n.x, y: n.y };
          // Freeze node so it no longer drifts
          n.fx = n.x; n.fy = n.y;
          // reset drag flag for next time
          n.__dragActiveStarted = false;
        }}
        onBackgroundClick={(ev:any)=>{
          // detect hull click: translate screen to graph coords
          const { offsetX, offsetY } = ev;
          // library provides center at 0,0 with current transform accessible via internal state; fallback approximate using globalThis.ForceGraph? skip; simplest: treat offset as graph coords when scale ~1
          // attempt to read canvas transform from context if available
          // (best-effort; if inaccurate user can click nodes instead)
          const pt:[number,number] = [offsetX- (ev.target.width/2), offsetY-(ev.target.height/2)];
          const hullsNow = hullsRef.current.length? hullsRef.current : computeHulls();
          for(const h of hullsNow){
            if(h.hull && pointInPoly(pt, h.hull)){
              openGroup(h.id);
              telemetry('hull_click_open_group',{groupId:h.id});
              break;
            }
          }
        }}
        linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D, scale: number) => {
          const start: any = link.source; const end: any = link.target;
          if (typeof start.x !== 'number' || typeof end.x !== 'number') { return; }
          // draw line explicitly to ensure visibility over hull fills
          ctx.strokeStyle = '#999'; ctx.lineWidth = 1/scale; ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
          // label
          const mx = (start.x + end.x) / 2; const my = (start.y + end.y) / 2;
          const fontSize = 12 / scale; ctx.font = `${fontSize}px Inter, sans-serif`; ctx.fillStyle = '#333';
          const isEditing = editingEdgeId===link.id;
          const label = isEditing? edgeLabelDraft : (link.label||'');
          if(label){
            const pad = 4/scale; const metrics = ctx.measureText(label); const w = metrics.width + pad*2; const h = 14/scale;
            ctx.fillStyle = isEditing? '#fffbe6' : '#ffffffdd';
            ctx.strokeStyle = isEditing? '#f59e0b':'#999';
            ctx.lineWidth = 1/scale;
            ctx.beginPath(); ctx.rect(mx-w/2, my-h/2, w, h); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#111'; ctx.textBaseline='middle'; ctx.textAlign='center'; ctx.fillText(label, mx, my);
          }
        }}
        nodeCanvasObjectMode={() => 'replace'}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale:number) => {
          const r = 8; // radius
            // Node fill
            ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, Math.PI*2);
            ctx.fillStyle = node.isCurrentUser? '#ffb703' : '#2563eb';
            ctx.fill();
            // outline for current user
            if(node.isCurrentUser){ ctx.lineWidth = 2/globalScale; ctx.strokeStyle = '#92400e'; ctx.stroke(); }
            // label
            const label = node.name || '';
            const fontSize = 10 / globalScale; ctx.font = `${fontSize}px Inter, sans-serif`; ctx.textAlign='center'; ctx.textBaseline='top'; ctx.fillStyle = '#111';
            ctx.fillText(label, node.x, node.y + r + 2/globalScale);
        }}
        backgroundColor="#fafafa"
        onRenderFramePre={(ctx: CanvasRenderingContext2D) => {
          const hulls = computeHulls();
          // Draw group hulls
          hulls.forEach(h => {
            if (!h.hull) { return; }
            const pts = h.hull;
            ctx.save();
            ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.closePath();
            // Fill with low alpha base color
            ctx.fillStyle = h.color;
            ctx.globalAlpha = 0.18; // stronger than previous 0.33 hex alpha for visibility
            ctx.fill();
            ctx.globalAlpha = 1;
            // Stroke
            ctx.lineWidth = activeGroupId===h.id ? 3 : 1.2;
            ctx.strokeStyle = deriveStroke(h.color);
            ctx.setLineDash(activeGroupId===h.id ? [] : [6,4]);
            ctx.stroke();
            // Label (centroid)
            const cx = pts.reduce((a,p)=>a+p[0],0)/pts.length;
            const cy = pts.reduce((a,p)=>a+p[1],0)/pts.length;
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillStyle = '#111';
            // backdrop box
            const label = (groups.find((g:any)=>g.id===h.id)?.name)||'';
            if(label){
              const pad = 4; const w = ctx.measureText(label).width + pad*2; const hBox = 16;
              ctx.save();
              ctx.beginPath(); ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=1; ctx.rect(cx-w/2, cy-hBox/2, w, hBox); ctx.fill(); ctx.stroke(); ctx.restore();
              ctx.fillText(label, cx, cy+0.5);
            }
            ctx.restore();
          });
        }}
        onLinkClick={(link:any)=>{
          // toggle edit
          if(editingEdgeId===link.id){ finishEditEdge(); } else { beginEditEdge(link); }
        }}
      />
      {editingEdgeId && (
        <div className="absolute left-1/2 bottom-4 -translate-x-1/2 bg-white shadow px-3 py-2 rounded border flex gap-2 items-center text-xs z-30">
          <input autoFocus value={edgeLabelDraft} onChange={e=> setEdgeLabelDraft(e.target.value)} placeholder="Edge label" className="border px-2 py-0.5 rounded text-xs" />
          <button onClick={()=>{ finishEditEdge(); }} className="px-2 py-0.5 rounded bg-blue-600 text-white">Save</button>
          <button onClick={()=>{ setEditingEdgeId(null); }} className="px-2 py-0.5 rounded border">Cancel</button>
          <button onClick={()=>{ setConfirm({ title:'Clear Label', message:'Remove this edge\'s label?', onConfirm:()=>{ setEdgeLabelDraft(''); finishEditEdge(); setConfirm(null);} }); }} className="px-2 py-0.5 rounded border">Clear</button>
        </div>
      )}
  <ConfirmModal open={!!confirm} title={confirm?.title||''} message={confirm?.message||''} onCancel={()=> setConfirm(null)} onConfirm={()=> confirm?.onConfirm()} />
    </>
  );
}

function GraphPage() {
  return (
    <main className="h-screen flex flex-col">
      <Nav />
      <div className="flex-1 relative">
        <GraphCanvas />
      </div>
    </main>
  );
}

export default withPageAuthRequired(GraphPage);
