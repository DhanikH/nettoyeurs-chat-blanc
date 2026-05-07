import React from 'react';
import { X } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X className="h-6 w-6" />
        </button>
        <h2 className="text-2xl font-bold font-display mb-4">Terms and Conditions</h2>
        <div className="space-y-4 text-slate-600">
          <p><strong>36-Hour Cancellation Policy:</strong> Cancellations made more than 36 hours in advance are free. Cancellations made within 36 hours of the scheduled start time will incur a late cancellation fee of 40% of the total booking price, charged to the card on file.</p>
          <p><strong>Property Accuracy:</strong> You agree to provide accurate information regarding your property's size and condition. Inaccurate information may lead to price adjustments or service refusal. If a cleaner arrives on-site and the property significantly differs from the information provided, and you refuse to pay for the necessary price adjustment, a 40% charge will be applied to your card.</p>
          <p><strong>Recurring Plan Commitments:</strong> By selecting a recurring plan, you agree to a minimum commitment of 4 cleanings for Monthly, 8 for Bi-weekly, and 16 for Weekly plans. Cancelling before fulfilling this commitment will result in a pricing adjustment fee equal to the total discounts received.</p>
        </div>
      </div>
    </div>
  );
};
