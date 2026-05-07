import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { useAuth } from '../context/AuthContext';

export const PaymentMethodForm = ({ onComplete }: { onComplete: () => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !user) return;

    setIsProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || 'An error occurred');
      setIsProcessing(false);
      return;
    }

    const res = await fetch('/api/create-setup-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ homeowner_id: user.id, userId: user.id }),
    });
    const data = await res.json();
    console.log("Setup intent response:", data);
    const { clientSecret } = data;

    const pendingQuote = localStorage.getItem('pendingQuote');
    console.log("Confirming setup with clientSecret:", clientSecret);
    const { error: confirmError } = await stripe.confirmSetup({
      elements,
      clientSecret,
      confirmParams: {
        return_url: pendingQuote ? `${window.location.origin}/quote` : `${window.location.origin}/settings`,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      console.error("Confirm setup error:", confirmError);
      setError(confirmError.message || 'An error occurred');
    } else {
      console.log("Setup confirmed successfully");
      onComplete();
    }
    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ paymentMethodTypes: ['card'] }} />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50"
      >
        {isProcessing ? 'Processing...' : 'Save Payment Method'}
      </button>
    </form>
  );
};
