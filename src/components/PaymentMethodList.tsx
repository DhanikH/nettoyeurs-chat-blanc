import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Trash2, Loader2, CreditCard } from 'lucide-react';

export const PaymentMethodList = ({ refresh }: { refresh?: number }) => {
  const { user } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPaymentMethods = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/payment-methods?homeowner_id=${user.id}`);
      const data = await res.json();
      console.log("Payment methods API response:", data);
      setPaymentMethods(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching payment methods:", err);
      setPaymentMethods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentMethods();
  }, [user, refresh]);

  const handleDelete = async (id: string) => {
    if (!user || !confirm("Are you sure you want to remove this card?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/payment-methods/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeowner_id: user.id }),
      });
      if (res.ok) {
        fetchPaymentMethods();
      } else {
        alert("Failed to delete payment method");
      }
    } catch (err) {
      console.error("Error deleting payment method:", err);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="p-4"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      {paymentMethods.length === 0 ? (
        <p className="text-slate-500 text-sm">No saved cards.</p>
      ) : (
        paymentMethods.map((pm) => (
          <div key={pm.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-slate-400" />
              <span className="font-medium text-slate-700">
                •••• {pm.card.last4}
              </span>
              <span className="text-sm text-slate-500">
                {pm.card.exp_month}/{pm.card.exp_year}
              </span>
            </div>
            <button
              onClick={() => handleDelete(pm.id)}
              disabled={deletingId === pm.id}
              className="p-2 text-slate-400 hover:text-red-600 transition-colors"
            >
              {deletingId === pm.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
            </button>
          </div>
        ))
      )}
    </div>
  );
};
