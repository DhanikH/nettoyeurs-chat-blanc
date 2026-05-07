import React, { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

interface PaymentFormProps {
  jobId: string;
  amount: number;
  breakdown?: {
    baseQuote: number;
    taxes: number;
    processingFee: number;
    totalCharge: number;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({ jobId, amount, breakdown, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentMethod, setPaymentMethod] = useState<'card'>('card');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || 'An unexpected error occurred.');
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Payment succeeded, now update our database
      try {
        const res = await fetch(`/api/jobs/${jobId}/pay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': 'homeowner' // In a real app, this would be handled by auth middleware
          },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            amount: breakdown ? breakdown.totalCharge : amount
          })
        });
        
        if (res.ok) {
          onSuccess();
        } else {
          setErrorMessage('Payment succeeded but we failed to update the job status. Please contact support.');
        }
      } catch (err) {
        console.error('Error updating job status:', err);
        setErrorMessage('Payment succeeded but we failed to update the job status. Please contact support.');
      }
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex gap-4 mb-6">
        <button
          type="button"
          className="flex-1 py-3 rounded-xl font-bold transition-all bg-slate-900 text-white"
        >
          Credit Card
        </button>
      </div>

      {breakdown ? (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4 space-y-2">
          <div className="flex justify-between text-slate-600">
            <span>Base Quote</span>
            <span>${breakdown.baseQuote.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Taxes (14.975%)</span>
            <span>${breakdown.taxes.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Processing Fee</span>
            <span>${breakdown.processingFee.toFixed(2)}</span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between text-xl font-bold text-slate-900">
            <span>Total Charge</span>
            <span>${breakdown.totalCharge.toFixed(2)}</span>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between mb-4">
          <span className="text-slate-600 font-medium">Total Amount</span>
          <span className="text-xl font-bold text-slate-900">${amount.toFixed(2)}</span>
        </div>
      )}

      <PaymentElement options={{ paymentMethodTypes: ['card'] }} />

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-700 text-sm animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 pt-4">
        <button
          disabled={isProcessing || (paymentMethod === 'card' && (!stripe || !elements))}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              Pay Now
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="w-full py-3 text-slate-400 font-medium hover:text-slate-600 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      {paymentMethod === 'card' && (
        <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
          <ShieldCheck className="w-3 h-3" />
          Secure SSL Encrypted Payment
        </div>
      )}
    </form>
  );
};
