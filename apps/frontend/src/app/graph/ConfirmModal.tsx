"use client";
interface ConfirmModalProps { open:boolean; title:string; message:string; confirmLabel?:string; cancelLabel?:string; onConfirm:()=>void; onCancel:()=>void; }
export function ConfirmModal({ open, title, message, confirmLabel='Confirm', cancelLabel='Cancel', onConfirm, onCancel }: ConfirmModalProps){
  if(!open) { return null; }
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded shadow-lg w-80 p-4 space-y-3">
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-xs whitespace-pre-wrap">{message}</p>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onCancel} className="px-3 py-1 rounded border text-xs">{cancelLabel}</button>
          <button onClick={onConfirm} className="px-3 py-1 rounded bg-red-600 text-white text-xs">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
