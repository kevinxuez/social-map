"use client";
import { telemetry } from './telemetryProxy';

export interface ToolbarProps { onAddEntity: ()=>void; onAddGroup: ()=>void; legend: {id:string;name:string;color:string}[] }
export function Toolbar({ onAddEntity, onAddGroup, legend }: ToolbarProps) {
  return (
    <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur rounded shadow p-2 w-52 space-y-2">
      <div className="flex flex-col gap-2">
        <button className="px-2 py-1 bg-blue-600 text-white rounded text-sm" onClick={()=>{ telemetry('add_node_click'); onAddEntity(); }}>Add Node</button>
        <button className="px-2 py-1 bg-emerald-600 text-white rounded text-sm" onClick={()=>{ telemetry('add_group_click'); onAddGroup(); }}>Add Group</button>
      </div>
      {legend.length>0 && (
        <div className="pt-2 border-t">
          <div className="text-xs font-semibold mb-1">Groups</div>
          <div className="flex flex-wrap gap-1">
            {legend.map(g=>(<span key={g.id} className="px-1 py-0.5 text-[10px] rounded" style={{background:g.color+'33', border:`1px solid ${g.color}`}}>{g.name}</span>))}
          </div>
        </div>
      )}
    </div>
  );
}
