import React, { useState, useEffect } from "react";
import { formatDate, formatTime, formatDateTime } from "../utils/dateUtils";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Home, Calendar, Plus, Save, Star, Clock, MapPin, DollarSign, CheckCircle, CreditCard, Trash2, Edit2, X } from "lucide-react";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { CancelSubscriptionModal } from "../components/CancelSubscriptionModal";
import { useTranslation } from "react-i18next";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { PaymentForm } from "../components/PaymentForm";
import { PaymentMethodList } from "../components/PaymentMethodList";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) : null;

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [properties, setProperties] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<any | null>(null);
  const [newProp, setNewProp] = useState({ address: "", city: "", postalCode: "", sqft: 1500, beds: 3, baths: 2, living: 1, offices: 0, kitchens: 1, floors: 1, entryInstructions: "", preferredTime: "Morning (8am - 12pm)", hasPets: false });
  const [rebookModal, setRebookModal] = useState<{ show: boolean, property: any, lastJob: any }>({ show: false, property: null, lastJob: null });
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState<any | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ show: boolean, propertyId: string | null }>({ show: false, propertyId: null });
  const [cancelModal, setCancelModal] = useState<{ show: boolean, sub: any | null, message: string }>({ show: false, sub: null, message: "" });
  const [cancelJobModal, setCancelJobModal] = useState<{ show: boolean, jobId: string | null }>({ show: false, jobId: null });
  const [subscriptionDetailsModal, setSubscriptionDetailsModal] = useState<{ show: boolean, sub: any | null }>({ show: false, sub: null });

  const handleViewSubscriptionDetails = (sub: any) => {
    setSubscriptionDetailsModal({ show: true, sub });
  };

  const [postponeModal, setPostponeModal] = useState<{ show: boolean, job: any | null }>({ show: false, job: null });
  const [newDate, setNewDate] = useState("");
  const [isPostponing, setIsPostponing] = useState(false);

  const handlePostponeJob = (job: any) => {
    setPostponeModal({ show: true, job });
  };

  const confirmPostpone = async () => {
    if (!postponeModal.job || !newDate) {
      alert("Please select a new date.");
      return;
    }
    setIsPostponing(true);

    try {
      const res = await fetch(`/api/jobs/${postponeModal.job.id}/postpone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_date: newDate, subscription_id: postponeModal.job.subscription_id })
      });

      if (res.ok) {
        setPostponeModal({ show: false, job: null });
        setNewDate("");
        fetchJobs();
        alert("Job postponed successfully!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to postpone job");
      }
    } catch (err) {
      console.error(err);
      alert("Error postponing job");
    } finally {
      setIsPostponing(false);
    }
  };

  useEffect(() => {
    console.log("Subscriptions state updated:", subscriptions);
  }, [subscriptions]);

  useEffect(() => {
    if (showPaymentModal) {
      fetch("/api/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: showPaymentModal })
      })
        .then(res => res.json())
        .then(data => {
          setClientSecret(data.clientSecret);
          setPaymentBreakdown(data.breakdown);
        })
        .catch(err => console.error("Error fetching client secret:", err));
    } else {
      setClientSecret(null);
      setPaymentBreakdown(null);
    }
  }, [showPaymentModal]);

  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
      return;
    }
    if (user) {
      if (user.role === "cleaner") {
        navigate("/cleaner");
        return;
      }
      if (user.role === "admin") {
        navigate("/admin");
        return;
      }
      fetchProperties();
      fetchJobs();
      fetchSubscriptions();
    }
  }, [user, loading, navigate]);

  const fetchProperties = async () => {
    console.log("Fetching properties for user:", user?.id);
    try {
      const res = await fetch(`/api/properties/${user?.id}`);
      const data = await res.json();
      console.log("Fetched properties:", data);
      setProperties(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch(`/api/jobs/homeowner/${user?.id}`);
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch(`/api/subscriptions/homeowner/${user?.id}`);
      const data = await res.json();
      console.log("Fetched subscriptions:", data);
      setSubscriptions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProp.floors <= 0) {
      alert("Floors must be greater than 0");
      return;
    }
    try {
      const url = editingProperty ? `/api/properties/${editingProperty.id}` : "/api/properties";
      const method = editingProperty ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_id: user?.id,
          address: `${newProp.address}, ${newProp.city}`,
          postal_code: newProp.postalCode,
          square_feet: newProp.sqft,
          bedrooms: newProp.beds,
          bathrooms: newProp.baths,
          living_rooms: newProp.living,
          offices: newProp.offices,
          kitchens: newProp.kitchens,
          floors: newProp.floors,
          entry_instructions: newProp.entryInstructions,
          preferred_time: newProp.preferredTime,
          has_pets: newProp.hasPets
        })
      });
      if (res.ok) {
        setShowAddForm(false);
        setEditingProperty(null);
        fetchProperties();
      } else {
        const data = await res.json();
        alert(`Failed to save property: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error saving property.");
    }
  };

  const handleDeleteProperty = async (propertyId: string) => {
    console.log("Deleting property:", propertyId, "User ID:", user?.id);
    setDeleteModal({ show: true, propertyId });
  };

  const confirmDeleteProperty = async () => {
    const propertyId = deleteModal.propertyId;
    if (!propertyId) return;
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner_id: user?.id })
      });
      if (res.ok) {
        fetchProperties();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(`Failed to delete property: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting property.");
    }
  };

  const handleBook = async (property: any) => {
    // Check for last job
    try {
      const res = await fetch(`/api/jobs/homeowner/${user?.id}/last`);
      const lastJob = await res.json();
      
      if (lastJob && lastJob.property_id === property.id) {
        setRebookModal({ show: true, property, lastJob });
      } else {
        // No last job for this property, go to quote
        navigate("/quote", { state: { propertyId: property.id } });
      }
    } catch (err) {
      console.error(err);
      navigate("/quote", { state: { propertyId: property.id } });
    }
  };

  const handleRebookSame = async () => {
    const { property, lastJob } = rebookModal;
    if (!property || !lastJob) return;

    const now = new Date();
    const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: property.id,
          homeowner_id: user?.id,
          scheduled_date: now.toISOString().split('T')[0],
          scheduled_end_date: oneWeekLater.toISOString().split('T')[0],
          calculated_base_price: lastJob.calculated_base_price,
          final_transaction_price: lastJob.final_transaction_price,
          special_instructions: lastJob.special_instructions,
          window_cleaning: lastJob.window_cleaning,
          oven_cleaning: lastJob.oven_cleaning,
          deep_cleaning: lastJob.deep_cleaning,
          frequency: lastJob.frequency
        })
      });
      if (res.ok) {
        alert(t('dashboard.booking_successful'));
        setRebookModal({ show: false, property: null, lastJob: null });
        fetchJobs();
      } else {
        const data = await res.json();
        alert(t('dashboard.error_booking') + ": " + (data.error || t('dashboard.unknown_error')));
      }
    } catch (err) {
      console.error(err);
      alert(t('dashboard.error_booking_retry'));
    }
  };

  const handleRebookCustomize = () => {
    const { property, lastJob } = rebookModal;
    navigate("/quote", { state: { propertyId: property.id, lastJob } });
    setRebookModal({ show: false, property: null, lastJob: null });
  };

  const [ratingComment, setRatingComment] = useState<{ [key: string]: string }>({});
  const [selectedRating, setSelectedRating] = useState<{ [key: string]: number }>({});
  const [isPaying, setIsPaying] = useState(false);

  const handleRateJob = async (jobId: string) => {
    const rating = selectedRating[jobId];
    if (!rating) return;

    try {
      const comment = ratingComment[jobId] || "";
      const res = await fetch(`/api/jobs/${jobId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment })
      });
      if (res.ok) {
        fetchJobs();
      } else {
        alert(t('dashboard.failed_rate_job'));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePay = async (jobId: string) => {
    setIsPaying(true);
    try {
      // Simulate network delay for payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const res = await fetch(`/api/jobs/${jobId}/pay`, {
        method: "POST"
      });
      if (res.ok) {
        setShowPaymentModal(null);
        fetchJobs();
      } else {
        alert(t('dashboard.failed_process_payment'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPaying(false);
    }
  };

  const handleAcceptQuote = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/accept-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        fetchJobs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectQuote = async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/reject-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        fetchJobs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelSubscription = (sub: any) => {
    console.log("Cancelling subscription:", sub);
    const futureBookings = Array.isArray(jobs) ? jobs.filter(j => j.subscription_id === sub.id && j.job_lifecycle_status !== 'completed' && j.job_lifecycle_status !== 'cancelled') : [];
    console.log("Future bookings:", futureBookings);
    const hasStarted = sub.completed_cleanings > 0 || futureBookings.length > 0;
    console.log("Has started:", hasStarted);
    
    const minCommitments: Record<string, number> = {
      'monthly': 4,
      'biweekly': 8,
      'weekly': 16
    };
    const minRequired = minCommitments[sub.frequency] || 0;
    const isEarly = sub.completed_cleanings < minRequired;
    
    let message = `Are you sure you want to cancel your ${sub.frequency} subscription for ${sub.properties?.address}?`;
    
    if (hasStarted) {
      message += `\n\nNote: Bookings have already been made for this plan. You will be charged according to the terms and conditions.`;
    }
    
    if (isEarly) {
      message += `\n\nNote: You have completed ${sub.completed_cleanings} out of the required ${minRequired} cleanings for this plan. An early cancellation fee of $${sub.total_discount_received.toFixed(2)} (the total discounts you've received so far) will be applied.`;
    }
    
    setCancelModal({ show: true, sub, message });
  };

  const confirmCancelSubscription = async () => {
    const { sub } = cancelModal;
    if (!sub) return;

    try {
      console.log("Sending cancellation request...");
      const res = await fetch("/api/jobs/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription_id: sub.id,
          homeowner_id: user?.id
        })
      });
      if (res.ok) {
        console.log("Subscription cancelled successfully.");
        alert("Subscription cancelled successfully.");
        setSubscriptions(prev => prev.filter(s => s.id !== sub.id));
      } else {
        const data = await res.json();
        console.error("Failed to cancel subscription:", data);
        alert("Failed to cancel subscription: " + JSON.stringify(data));
      }
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      alert("Error cancelling subscription.");
    }
    setCancelModal({ show: false, sub: null, message: "" });
  };

  const handleCancel = async (jobId: string) => {
    setCancelJobModal({ show: false, jobId: null });
    setActionMessage(null);

    try {
      const res = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeowner_id: user?.id })
      });
      
      const data = await res.json().catch(() => ({ error: "Server error" }));

      if (res.ok) {
        if (data.warning) {
          setActionMessage({ type: 'error', text: data.warning });
        } else {
          setActionMessage({ type: 'success', text: t('dashboard.cancel_success') || "Booking cancelled successfully!" });
        }
        fetchJobs();
      } else {
        setActionMessage({ type: 'error', text: data.error || t('dashboard.failed_cancel_job') });
      }
    } catch (err) {
      console.error(err);
      setActionMessage({ type: 'error', text: t('dashboard.error_cancelling') || "Error cancelling booking." });
    } finally {
      setCancellingJobId(null);
    }
  };

  const renderJobDate = (job: any) => {
    console.log("Job object (Dashboard):", job);
    if (job.job_lifecycle_status === 'claimed_scheduled') {
      return (
        <span className="text-emerald-600 flex items-center gap-1.5 font-bold">
          <CheckCircle className="w-4 h-4" />
          {t('dashboard.confirmed')}: {formatDate(job.specific_date || job.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric' })}{job.time_frame ? ` (${job.time_frame})` : ''}
        </span>
      );
    }

    if (job.scheduled_end_date) {
      return (
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-slate-400" />
          {formatDate(job.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric' })} - {formatDate(job.scheduled_end_date, { weekday: 'short', month: 'short', day: 'numeric' })}{job.time_frame ? ` (${job.time_frame})` : ''}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5">
        <Calendar className="w-4 h-4 text-slate-400" />
        {formatDate(job.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric' })}{job.time_frame ? ` (${job.time_frame})` : ''}
      </div>
    );
  };

  const isCancellable = (job: any) => {
    if (job.job_lifecycle_status === 'completed' || job.job_lifecycle_status === 'cancelled') return false;
    
    const targetDateStr = job.specific_date || (job.scheduled_date ? job.scheduled_date.split(' to ')[0] : null);
    if (!targetDateStr) return true;

    const parts = targetDateStr.split('-');
    if (parts.length !== 3) return true;

    const [y, m, d] = parts.map(Number);
    const targetDate = new Date(y, m - 1, d);
    const now = new Date();
    
    // If it's within 24h, it's now cancellable with a fee
    
    return true;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold font-display text-slate-900 tracking-tight">
            {t('dashboard.welcome_back', { name: user.full_name || t('dashboard.homeowner') })}
          </h1>
          <p className="text-slate-500 mt-2 text-xl font-light">{t('dashboard.manage_properties')}</p>
        </div>
        <div className="relative z-10 bg-emerald-50 text-emerald-700 px-6 py-4 rounded-2xl font-medium flex items-center gap-4 border border-emerald-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="bg-emerald-100 p-3 rounded-xl">
            <Star className="w-6 h-6 text-emerald-600 fill-emerald-600" />
          </div>
          <div>
            <div className="text-xs text-emerald-600/80 uppercase tracking-widest font-bold">{t('dashboard.loyalty_tier')}</div>
            <div className="capitalize text-xl font-bold font-display tracking-wide">{user.loyalty_subscription_tier}</div>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-2xl border animate-in fade-in slide-in-from-top-2 duration-300 ${
          actionMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-3">
            {actionMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
            <p className="font-medium">{actionMessage.text}</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Properties Column */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-2xl font-bold font-display text-slate-900 flex items-center gap-3">
                <Home className="w-6 h-6 text-emerald-600" />
                {t('dashboard.my_properties')}
              </h2>
              <button 
                onClick={() => setShowAddForm(!showAddForm)}
                className={`p-2.5 rounded-xl transition-all duration-300 ${
                  showAddForm ? 'bg-slate-900 text-white rotate-45' : 'bg-white text-slate-600 shadow-sm border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 bg-white flex-1">
              {showAddForm && (
                <form onSubmit={handleSaveProperty} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 mb-6">
                  <h3 className="font-bold font-display text-slate-900">{editingProperty ? t('dashboard.edit_property') : t('dashboard.add_new_property')}</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                        value={newProp.address}
                        onChange={e => setNewProp({...newProp, address: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                        value={newProp.city}
                        onChange={e => setNewProp({...newProp, city: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Postal Code</label>
                      <input 
                        type="text" 
                        required
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                        value={newProp.postalCode}
                        onChange={e => setNewProp({...newProp, postalCode: e.target.value})}
                      />
                      {['h3c0y9', 'h4r3j8'].includes(newProp.postalCode.toLowerCase().replace(/\s/g, '')) && (
                        <p className="text-xs text-emerald-600 font-bold mt-1">location discount applied.</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">{t('dashboard.sq_ft')}</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={newProp.sqft}
                        onChange={e => setNewProp({...newProp, sqft: e.target.value === "" ? 0 : parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">{t('dashboard.beds')}</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={newProp.beds}
                        onChange={e => setNewProp({...newProp, beds: e.target.value === "" ? 0 : parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">{t('dashboard.baths')}</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={newProp.baths}
                        onChange={e => setNewProp({...newProp, baths: e.target.value === "" ? 0 : parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Living Rooms</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={newProp.living}
                        onChange={e => setNewProp({...newProp, living: e.target.value === "" ? 0 : parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Offices</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={newProp.offices}
                        onChange={e => setNewProp({...newProp, offices: e.target.value === "" ? 0 : parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Floors</label>
                      <input 
                        type="number" 
                        required
                        min="1"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={newProp.floors || 1}
                        onChange={e => setNewProp({...newProp, floors: e.target.value === "" ? 1 : Math.max(1, parseInt(e.target.value))})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Kitchens</label>
                      <input 
                        type="number" 
                        required
                        min="0"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={newProp.kitchens}
                        onChange={e => setNewProp({...newProp, kitchens: e.target.value === "" ? "" : parseInt(e.target.value, 10)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Entry Instructions</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={newProp.entryInstructions}
                        onChange={e => setNewProp({...newProp, entryInstructions: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Preferred Cleaning Time</label>
                      <select
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all bg-white"
                        value={newProp.preferredTime}
                        onChange={e => setNewProp({...newProp, preferredTime: e.target.value})}
                      >
                        <option value="Morning (8am - 12pm)">Morning (8am - 12pm)</option>
                        <option value="Afternoon (12pm - 4pm)">Afternoon (12pm - 4pm)</option>
                        <option value="Evening (4pm - 8pm)">Evening (4pm - 8pm)</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="hasPets"
                        checked={newProp.hasPets}
                        onChange={e => setNewProp({...newProp, hasPets: e.target.checked})}
                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <label htmlFor="hasPets" className="text-sm font-medium text-slate-700">Has Pets</label>
                    </div>
                  </div>
                  <button type="submit" className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors">
                    {t('dashboard.save_property')}
                  </button>
                </form>
              )}

              {properties.length === 0 && !showAddForm ? (
                <div className="text-center py-10 text-slate-500 bg-white rounded-2xl border border-slate-100 border-dashed">
                  <Home className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p>{t('dashboard.no_properties')}</p>
                  <button 
                    onClick={() => setShowAddForm(true)}
                    className="mt-3 text-emerald-600 font-medium hover:text-emerald-700"
                  >
                    {t('dashboard.add_first_property')}
                  </button>
                </div>
              ) : (
                Array.isArray(properties) && properties.map(prop => (
                  <div key={prop.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="bg-slate-50 p-2.5 rounded-xl text-slate-600">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900">{prop.address || t('dashboard.unnamed_property')}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {prop.square_feet} sqft • {prop.bedrooms} bed • {prop.bathrooms} bath
                        </p>
                        {['h3c0y9', 'h4r3j8'].includes(prop.postal_code?.toLowerCase().replace(/\s/g, '')) && (
                          <p className="text-xs text-emerald-600 font-bold mt-1">location discount applied</p>
                        )}
                      </div>
                      <button 
                        onClick={() => {
                          setEditingProperty(prop);
                          setShowAddForm(true);
                          // Pre-populate newProp state with prop data
                          const [street, city] = prop.address.split(', ');
                          setNewProp({
                            address: street,
                            city: city || '',
                            postalCode: prop.postal_code,
                            sqft: prop.square_feet,
                            beds: prop.bedrooms,
                            baths: prop.bathrooms,
                            living: prop.living_rooms,
                            offices: prop.offices,
                            kitchens: prop.kitchens,
                            floors: (prop.floors && prop.floors >= 1) ? prop.floors : 1,
                            entryInstructions: prop.entry_instructions || "",
                            preferredTime: prop.preferred_time || "Morning (8am - 12pm)",
                            hasPets: prop.has_pets || false
                          });
                        }}
                        className="text-slate-400 hover:text-emerald-500 transition-colors mr-2"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteProperty(prop.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <button 
                      onClick={() => handleBook(prop)}
                      className="w-full py-2.5 bg-emerald-50 text-emerald-700 rounded-xl font-medium hover:bg-emerald-600 hover:text-white transition-colors group-hover:shadow-sm"
                    >
                      {t('dashboard.book_cleaning')}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bookings Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Active & Pending Bookings */}
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-2xl font-bold font-display text-slate-900 flex items-center gap-3">
                <Clock className="w-6 h-6 text-emerald-600" />
                {t('dashboard.active_bookings')}
              </h2>
              <span className="bg-emerald-100 text-emerald-700 py-1.5 px-4 rounded-full text-sm font-bold shadow-sm">
                {Array.isArray(jobs) ? jobs.filter(j => j.job_lifecycle_status !== 'completed' && j.job_lifecycle_status !== 'cancelled').length : 0}
              </span>
            </div>
            
            <div className="p-8 space-y-6">
              {(() => {
                const activeJobs = jobs.filter(j => j.job_lifecycle_status !== 'completed' && j.job_lifecycle_status !== 'cancelled');
                
                const grouped = activeJobs.reduce((acc, job) => {
                  if (job.subscription_id) {
                    if (!acc[job.subscription_id]) {
                      acc[job.subscription_id] = { type: 'subscription', jobs: [], frequency: job.frequency };
                    }
                    acc[job.subscription_id].jobs.push(job);
                  } else {
                    acc[`job_${job.id}`] = { type: 'job', job };
                  }
                  return acc;
                }, {} as Record<string, any>);

                return Object.values(grouped).length === 0 ? (
                  <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-100 border-dashed">
                    <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-lg">{t('dashboard.no_active_bookings')}</p>
                    <p className="text-sm mt-1">{t('dashboard.select_property_book')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.values(grouped).map((item: any) => {
                      if (item.type === 'subscription') {
                        const nextJob = item.jobs.sort((a: any, b: any) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())[0];
                        return (
                          <div key={`sub_${nextJob.subscription_id}`} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className="bg-emerald-50 w-14 h-14 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100">
                                <Calendar className="w-7 h-7" />
                              </div>
                              <div>
                                <h3 className="font-bold text-lg text-slate-900">
                                  {formatDate(nextJob.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric' })}
                                </h3>
                                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mt-2 w-fit">
                                  <Calendar className="w-3 h-3" />
                                  {item.frequency}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      const job = item.job;
                      return (
                        <div key={job.id} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="relative">
                              <div className="bg-emerald-50 w-14 h-14 rounded-2xl flex items-center justify-center text-emerald-600 overflow-hidden border border-emerald-100">
                                {job.cleaner_picture ? (
                                  <img 
                                    src={job.cleaner_picture} 
                                    alt={job.cleaner_name} 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <Calendar className="w-7 h-7" />
                                )}
                              </div>
                              {job.cleaner_id && (
                                <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-lg shadow-sm border border-slate-100">
                                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-bold text-lg text-slate-900">
                                  {renderJobDate(job)}
                                </h3>
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => setCancelJobModal({ show: true, jobId: job.id })}
                            className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Payments Needed */}
          {Array.isArray(jobs) && jobs.filter(j => j.job_lifecycle_status === 'completed' && !j.paid).length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-amber-200 overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-500" />
                  {t('dashboard.payments_due')}
                </h2>
              </div>
              <div className="p-6 bg-amber-50/30 space-y-4">
                {Array.isArray(jobs) && jobs.filter(j => j.job_lifecycle_status === 'completed' && !j.paid).map(job => (
                  <div key={job.id} className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        {t('dashboard.completed_on', { date: formatDate(new Date(job.scheduled_date)) })}
                      </div>
                      {job.address && <div className="font-medium text-slate-900">{job.address}</div>}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-xl font-bold text-slate-900">
                        ${job.final_transaction_price.toFixed(2)}
                      </div>
                      <button 
                        className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-sm"
                        onClick={() => setShowPaymentModal(job.id)}
                      >
                        {t('dashboard.pay_now')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recurring Plans */}
          {subscriptions.length > 0 && (
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-indigo-50/30">
                <h2 className="text-2xl font-bold font-display text-slate-900 flex items-center gap-3">
                  <Clock className="w-6 h-6 text-indigo-600" />
                  Recurring Plans
                </h2>
                <span className="bg-indigo-100 text-indigo-700 py-1.5 px-4 rounded-full text-sm font-bold shadow-sm">
                  {subscriptions.length}
                </span>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  {subscriptions.map(sub => (
                    <div key={sub.id} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="bg-indigo-50 w-14 h-14 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100">
                          <Calendar className="w-7 h-7" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg text-slate-900 capitalize">
                              {sub.frequency} Plan
                            </h3>
                            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                              Active
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {sub.properties?.address}
                          </div>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="text-xs font-medium text-slate-500">
                              <span className="text-indigo-600 font-bold">{sub.completed_cleanings}</span> Cleanings Completed
                            </div>
                            <div className="text-xs font-medium text-slate-500">
                              Total Savings: <span className="text-emerald-600 font-bold">${sub.total_discount_received.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleViewSubscriptionDetails(sub)}
                        className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 transition-all text-sm"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleCancelSubscription(sub)}
                        className="px-6 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all text-sm"
                      >
                        Cancel Plan
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Payment Methods */}
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-2xl font-bold font-display text-slate-900 flex items-center gap-3">
                <CreditCard className="w-6 h-6 text-slate-600" />
                Payment Methods
              </h2>
            </div>
            <div className="p-8">
              <PaymentMethodList />
            </div>
          </div>

          {/* History & Reviews */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
                <Save className="w-5 h-5 text-slate-400" />
                {t('dashboard.past_cleanings')}
              </h2>
            </div>
            <div className="p-6 bg-slate-50/50 space-y-4 max-h-[600px] overflow-y-auto">
              {Array.isArray(jobs) && jobs.filter(j => j.job_lifecycle_status === 'completed').length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {t('dashboard.no_past_cleanings')}
                </div>
              ) : (
                Array.isArray(jobs) && jobs.filter(j => j.job_lifecycle_status === 'completed').map(job => (
                  <div key={job.id} className="bg-white rounded-2xl border border-slate-200 p-6 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-lg text-slate-900">
                            ${job.final_transaction_price.toFixed(2)}
                          </span>
                          {job.job_lifecycle_status === 'cancelled' ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold uppercase tracking-wider">{t('dashboard.cancelled')}</span>
                          ) : job.paid ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase tracking-wider">{t('dashboard.paid')}</span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold uppercase tracking-wider">{t('dashboard.unpaid')}</span>
                          )}
                        </div>
                          <div className="text-sm text-slate-500 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {renderJobDate(job)}
                          </div>
                      </div>
                      {job.address && (
                        <div className="text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                          {job.address}
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-5 pt-5 border-t border-slate-100">
                      {!job.rating ? (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <p className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <Star className="w-4 h-4 text-amber-500" />
                            {t('dashboard.rate_cleaner')}
                          </p>
                          <div className="space-y-3">
                            <textarea
                              placeholder={t('dashboard.how_was_service')}
                              className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white resize-none"
                              rows={2}
                              value={ratingComment[job.id] || ""}
                              onChange={(e) => setRatingComment({...ratingComment, [job.id]: e.target.value})}
                            />
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <button
                                    key={star}
                                    onClick={() => setSelectedRating({...selectedRating, [job.id]: star})}
                                    className={`p-1.5 transition-transform hover:scale-110 focus:outline-none ${
                                      (selectedRating[job.id] || 0) >= star ? 'text-amber-400' : 'text-slate-300'
                                    }`}
                                  >
                                    <Star className={`w-7 h-7 ${ (selectedRating[job.id] || 0) >= star ? 'fill-current' : ''}`} />
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => handleRateJob(job.id)}
                                disabled={!selectedRating[job.id]}
                                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                                  selectedRating[job.id]
                                    ? "bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-100"
                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                }`}
                              >
                                {t('common.submit') || "Submit Review"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-slate-500">{t('dashboard.your_rating')}</span>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map(star => (
                                <Star 
                                  key={star} 
                                  className={`w-4 h-4 ${job.rating >= star ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} 
                                />
                              ))}
                            </div>
                          </div>
                          {job.review_comment && (
                            <p className="text-sm text-slate-700 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
                              "{job.review_comment}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
      
      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold font-display text-slate-900">Complete Payment</h2>
                <button 
                  onClick={() => setShowPaymentModal(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <Plus className="w-6 h-6 rotate-45 text-slate-400" />
                </button>
              </div>

              {clientSecret && stripePromise ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <PaymentForm 
                    jobId={showPaymentModal}
                    amount={jobs.find(j => j.id === showPaymentModal)?.final_transaction_price || 0}
                    breakdown={paymentBreakdown}
                    onSuccess={() => {
                      setShowPaymentModal(null);
                      setActionMessage({ type: 'success', text: "Payment successful!" });
                      fetchJobs();
                    }}
                    onCancel={() => setShowPaymentModal(null)}
                  />
                </Elements>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center gap-4">
                  <Clock className="w-10 h-10 text-emerald-500 animate-spin" />
                  <p className="text-slate-500 font-medium">Preparing secure checkout...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rebook Modal */}
      {rebookModal.show && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">
                <Clock className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold font-display text-slate-900 mb-2">{t('dashboard.rebook_title')}</h2>
              <p className="text-slate-500 mb-6">{t('dashboard.rebook_desc')}</p>
              
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 mb-8">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t('dashboard.rebook_window_desc')}</div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">${rebookModal.lastJob.final_transaction_price.toFixed(2)}</span>
                  <span className="text-sm text-slate-500">{rebookModal.property.address}</span>
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={handleRebookSame}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-200"
                >
                  {t('dashboard.rebook_same')}
                </button>
                <button 
                  onClick={handleRebookCustomize}
                  className="w-full py-4 bg-white text-slate-900 border-2 border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                >
                  {t('dashboard.rebook_customize')}
                </button>
                <button 
                  onClick={() => setRebookModal({ show: false, property: null, lastJob: null })}
                  className="w-full py-3 text-slate-400 font-medium hover:text-slate-600 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        <ConfirmationModal
          isOpen={deleteModal.show}
          onClose={() => setDeleteModal({ show: false, propertyId: null })}
          onConfirm={confirmDeleteProperty}
          title="Delete Property"
          message="Are you sure you want to delete this property? This action cannot be undone."
        />
        <CancelSubscriptionModal
          isOpen={cancelModal.show}
          onClose={() => setCancelModal({ show: false, sub: null, message: "" })}
          onConfirm={confirmCancelSubscription}
          message={cancelModal.message}
        />
        <ConfirmationModal
          isOpen={cancelJobModal.show}
          onClose={() => setCancelJobModal({ show: false, jobId: null })}
          onConfirm={() => cancelJobModal.jobId && handleCancel(cancelJobModal.jobId)}
          title="Cancel Booking"
          message="Are you sure you want to cancel this booking?"
        />
        {subscriptionDetailsModal.show && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold font-display text-slate-900">Subscription Details</h2>
                  <button 
                    onClick={() => setSubscriptionDetailsModal({ show: false, sub: null })}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                  {jobs.filter(j => j.subscription_id === subscriptionDetailsModal.sub.id)
                    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
                    .map(job => (
                    <div key={job.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <div className="font-bold text-slate-900">{formatDate(job.scheduled_date)}</div>
                        <div className="text-sm text-slate-500">{job.job_lifecycle_status}</div>
                      </div>
                      <button
                        onClick={() => handlePostponeJob(job)}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 transition-all"
                      >
                        Postpone
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {postponeModal.show && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8">
                <h2 className="text-2xl font-bold font-display text-slate-900 mb-6">Postpone Job</h2>
                <input 
                  type="date" 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 mb-6"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                />
                <div className="flex gap-4">
                  <button 
                    onClick={() => setPostponeModal({ show: false, job: null })}
                    className="flex-1 py-3 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmPostpone}
                    disabled={isPostponing}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-all disabled:opacity-50"
                  >
                    {isPostponing ? "Postponing..." : "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}