"use client";
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, GraphResponse, seededColor } from '@/lib/api';
import { event as telemetry } from '@/lib/telemetry';
import Nav from '@/components/Nav';
import { useEffect, useMemo, useRef, useState } from 'react';
import { withPageAuthRequired, useUser } from '@auth0/nextjs-auth0/client';
import { polygonHull } from 'd3-polygon';
// Proper dynamic import of 2D force graph (avoids bundling VR/A-Frame extras)
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

function useEnsureCurrentUser() {
  const { user } = useUser();
  const qc = useQueryClient();
  useEffect(() => {
    (async () => {
      if (!user?.email) return;
      const ents = await api.listEntities({ search: user.email });
      const exists = ents.find((e:any) => e.contact_email === user.email && e.isCurrentUser);
      if (!exists) {
        await api.createEntity({ name: user.name || user.email, contact_email: user.email, is_current_user:true, groups_in:[], connected_people:[] });
        qc.invalidateQueries({ queryKey:['graph'] });
      }
    })();
  }, [user?.email]);
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  node: any;
  graph: GraphResponse;
}

const Drawer = ({ open, onClose, node, graph }: DrawerProps) => {
  if (!open || !node) {
    return null;
  }
  const neighbors = graph.links
    .filter(l => (typeof l.source === 'string' ? l.source : (l.source as any).id) === node.id || (typeof l.target === 'string' ? l.target : (l.target as any).id) === node.id)
    .map(l => (typeof l.source === 'string' ? l.source : (l.source as any).id) === node.id ? (typeof l.target === 'string' ? l.target : (l.target as any).id) : (typeof l.source === 'string' ? l.source : (l.source as any).id))
    .map(id => graph.nodes.find(n => n.id === id));
  return (
    <div className="fixed top-0 right-0 w-80 h-full bg-white shadow-lg p-4 overflow-y-auto">
      <button className="text-sm mb-2" onClick={onClose}>Close</button>
      <h2 className="font-bold text-lg mb-2">{node.name}</h2>
      <div className="space-y-1 text-sm">
        {node.contact_email && <div>Email: {node.contact_email}</div>}
        {node.contact_phone && <div>Phone: {node.contact_phone}</div>}
        {node.notes && <div>Notes: {node.notes}</div>}
        <div>Main Group: {node.mainGroupId || '—'}</div>
        <div>Groups: {node.groupIds.length}</div>
      </div>
      <h3 className="font-semibold mt-4">Connections</h3>
      <ul className="text-sm list-disc ml-4">
        {neighbors.map(n => n && <li key={n.id}>{n.name}</li>)}
      </ul>
    </div>
  );
};

function GraphCanvas() {
  useEnsureCurrentUser();
  const qc = useQueryClient();
  const { data } = useQuery<GraphResponse>({ queryKey:['graph'], queryFn: api.getGraph, refetchInterval:10000 });
  const [drawerNode, setDrawerNode] = useState<any>(null);
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

  const hulls = useMemo(() => {
    if (!data) {
      return [] as { id: string; hull: [number, number][] | null; color: string }[];
    }
    const groupMap: Record<string, { points: [number, number][]; color: string }> = {};
    data.groups.forEach(g => { groupMap[g.id] = { points: [], color: g.color || seededColor(g.name) }; });
    data.nodes.forEach(n => {
      n.groupIds.forEach(gid => {
        const g = groupMap[gid];
        if (g && typeof n.x === 'number' && typeof n.y === 'number') {
          g.points.push([n.x, n.y]);
        }
      });
    });
  return Object.entries(groupMap).map(([id, g]) => ({ id, hull: g.points.length > 2 ? polygonHull(g.points) as [number, number][] | null : null, color: g.color }));
  }, [data]);

  if (!data) {
    return <div className="flex-1"/>;
  }
  return (
    <>
      <Drawer open={!!drawerNode} node={drawerNode} onClose={()=>{ if(drawerNode) telemetry('drawer_close', { id:drawerNode.id }); setDrawerNode(null);} } graph={data} />
      <ForceGraph2D
        graphData={data as any}
        nodeLabel={(n: any) => n.name}
        onNodeClick={(n: any) => { setDrawerNode(n); telemetry('drawer_open', { id:n.id }); }}
        enableNodeDrag
        onNodeDragEnd={(n: any) => {
          positionsDirty.current[n.id] = { x: n.x, y: n.y };
        }}
        linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D, scale: number) => {
          if (!link.label) {
            return;
          }
          const start: any = link.source; const end: any = link.target;
          if (typeof start.x !== 'number' || typeof end.x !== 'number') {
            return;
          }
          const mx = (start.x + end.x) / 2; const my = (start.y + end.y) / 2;
          const fontSize = 12 / scale; ctx.font = `${fontSize}px sans-serif`; ctx.fillStyle = '#333'; ctx.fillText(link.label, mx, my);
        }}
        nodeCanvasObjectMode={() => 'after'}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
          if (node.isCurrentUser) {
            ctx.beginPath(); ctx.arc(node.x, node.y, 10, 0, Math.PI * 2); ctx.fillStyle = '#ffb703'; ctx.fill();
          }
        }}
        backgroundColor="#fafafa"
        onRenderFramePre={(ctx: CanvasRenderingContext2D) => {
          hulls.forEach(h => {
            if (!h.hull) {
              return;
            }
            ctx.beginPath(); ctx.moveTo(h.hull[0][0], h.hull[0][1]);
            for (let i = 1; i < h.hull.length; i++) { ctx.lineTo(h.hull[i][0], h.hull[i][1]); }
            ctx.closePath(); ctx.fillStyle = `${h.color}55`; ctx.fill();
          });
        }}
      />
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
