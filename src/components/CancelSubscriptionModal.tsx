import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}

export const CancelSubscriptionModal: React.FC<CancelSubscriptionModalProps> = ({ isOpen, onClose, onConfirm, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full relative shadow-xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X className="h-6 w-6" />
        </button>
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-amber-100 p-3 rounded-full text-amber-600">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold font-display">Cancel Subscription</h2>
        </div>
        <p className="text-slate-600 mb-8 whitespace-pre-line">{message}</p>
        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-full border border-slate-200 hover:bg-slate-50 font-semibold"
          >
            No, Keep Plan
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 py-3 px-4 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold"
          >
            Yes, Cancel Plan
          </button>
        </div>
      </div>
    </div>
  );
};
