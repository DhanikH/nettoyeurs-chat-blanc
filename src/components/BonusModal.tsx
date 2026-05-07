import React, { useState } from "react";
import { DollarSign, X } from "lucide-react";

interface BonusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bonus: number) => void;
  currentBonus: number;
}

export const BonusModal: React.FC<BonusModalProps> = ({ isOpen, onClose, onSave, currentBonus }) => {
  const [bonus, setBonus] = useState(currentBonus.toString());

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Add Custom Bonus</h2>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700">Bonus Amount ($)</label>
          <input
            type="number"
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
            className="mt-1 block w-full border border-slate-300 rounded-md p-2"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 rounded-lg">Cancel</button>
          <button onClick={() => onSave(parseFloat(bonus))} className="px-4 py-2 bg-emerald-600 text-white rounded-lg">Save Bonus</button>
        </div>
      </div>
    </div>
  );
};
