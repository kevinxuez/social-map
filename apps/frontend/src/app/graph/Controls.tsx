'use client';
import { useState } from 'react';

export default function Controls({ onApply }: { onApply: (p:{root:number;depth:number})=>void }) {
  const [root,setRoot]=useState(1);
  const [depth,setDepth]=useState(1);
  return (
    <div className="m-3 p-3 bg-white/80 rounded-xl shadow flex gap-2 items-center">
      <label>Root</label>
      <input className="border px-2 py-1 rounded" type="number" value={root} onChange={e=>setRoot(+e.target.value)} />
      <label>Depth</label>
      <input className="border px-2 py-1 rounded" type="number" value={depth} onChange={e=>setDepth(+e.target.value)} />
      <button className="px-3 py-1 rounded bg-black text-white" onClick={()=>onApply({root,depth})}>Apply</button>
    </div>
  );
}
