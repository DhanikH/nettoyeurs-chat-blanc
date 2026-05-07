import React, { useState } from 'react';
import { X, Clock } from 'lucide-react';

interface AddonTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (addonTimes: Record<string, number>) => void;
  addons: { id: string; name: string }[];
}

export const AddonTimeModal: React.FC<AddonTimeModalProps> = ({ isOpen, onClose, onConfirm, addons }) => {
  const [addonTimes, setAddonTimes] = useState<Record<string, number>>({});

  if (!isOpen) return null;

  const handleTimeChange = (addonId: string, minutes: string) => {
    setAddonTimes(prev => ({
      ...prev,
      [addonId]: parseInt(minutes) || 0
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full relative shadow-xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-bold font-display mb-6">Enter Time Spent on Add-ons</h2>
        <div className="space-y-4 mb-8">
          {addons.map(addon => (
            <div key={addon.id} className="flex items-center justify-between gap-4">
              <label className="font-medium text-slate-700">{addon.name}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Minutes"
                  className="w-24 px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  onChange={(e) => handleTimeChange(addon.id, e.target.value)}
                />
                <span className="text-sm text-slate-500">mins</span>
              </div>
            </div>
          ))}
        </div>
        <button 
          onClick={() => { onConfirm(addonTimes); onClose(); }}
          className="w-full py-3 px-4 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
        >
          Submit & Complete Job
        </button>
      </div>
    </div>
  );
};
