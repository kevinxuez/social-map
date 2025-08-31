"use client";
import { useEffect, useRef } from 'react';
interface DrawerProps { open:boolean; onClose:()=>void; children:React.ReactNode; }
export function Drawer({ open, onClose, children }: DrawerProps){
  const ref = useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    if(!open) { return; }
    function onKey(e:KeyboardEvent){ if(e.key==='Escape'){ onClose(); } }
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  },[open,onClose]);
  // basic focus trap
  useEffect(()=>{ if(open && ref.current){ const el = ref.current.querySelector<HTMLElement>('button, input, textarea, select'); el?.focus(); } },[open]);
  if(!open) { return null; }
  return (
    <div className="fixed top-0 right-0 w-96 h-full bg-white shadow-lg p-4 overflow-y-auto z-20 border-l" ref={ref}>
      {children}
    </div>
  );
}
