import React, { useState, useEffect } from "react";
import { formatDate, formatTime, formatDateTime } from "../utils/dateUtils";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Home, Calendar, Plus, Save, Star, Clock, MapPin, DollarSign, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [properties, setProperties] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProp, setNewProp] = useState({ address: "", sqft: 1500, beds: 3, baths: 2, living: 1, offices: 0, windows: 10 });
  const [rebookModal, setRebookModal] = useState<{ show: boolean, property: any, lastJob: any }>({ show: false, property: null, lastJob: null });
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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
      fetchProperties();
      fetchJobs();
    }
  }, [user, loading, navigate]);

  const fetchProperties = async () => {
    try {
      const res = await fetch(`/api/properties/${user?.id}`);
      const data = await res.json();
      setProperties(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch(`/api/jobs/homeowner/${user?.id}`);
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_id: user?.id,
          address: newProp.address,
          square_feet: newProp.sqft,
          bedrooms: newProp.beds,
          bathrooms: newProp.baths,
          living_rooms: newProp.living,
          offices: newProp.offices,
          windows: newProp.windows
        })
      });
      if (res.ok) {
        setShowAddForm(false);
        fetchProperties();
      }
    } catch (err) {
      console.error(err);
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
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
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

  const handleCancel = async (jobId: string) => {
    setCancellingJobId(jobId);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeowner_id: user?.id })
      });
      
      const data = await res.json().catch(() => ({ error: "Server error" }));

      if (res.ok) {
        setActionMessage({ type: 'success', text: t('dashboard.cancel_success') || "Booking cancelled successfully!" });
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
    if (job.job_lifecycle_status === 'claimed_scheduled') {
      return (
        <span className="text-emerald-600 flex items-center gap-1.5 font-bold">
          <CheckCircle className="w-4 h-4" />
          {t('dashboard.confirmed')}: {formatDate(job.specific_date || job.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      );
    }

    if (job.scheduled_end_date) {
      return (
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-slate-400" />
          {formatDate(job.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric' })} - {formatDate(job.scheduled_end_date, { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5">
        <Calendar className="w-4 h-4 text-slate-400" />
        {formatDate(job.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric' })}
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
    
    // If it's within 24h, it's only cancellable if it hasn't been claimed yet
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const isWithin24h = (targetDate.getTime() - now.getTime()) < twentyFourHours;
    
    if (isWithin24h && job.cleaner_id) {
      return false;
    }
    
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
                <form onSubmit={handleAddProperty} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 mb-6">
                  <h3 className="font-bold font-display text-slate-900">{t('dashboard.add_new_property')}</h3>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t('dashboard.address')}</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                      value={newProp.address}
                      onChange={e => setNewProp({...newProp, address: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">{t('dashboard.sq_ft')}</label>
                      <input 
                        type="number" 
                        required
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={newProp.sqft}
                        onChange={e => setNewProp({...newProp, sqft: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">{t('dashboard.beds')}</label>
                      <input 
                        type="number" 
                        required
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={newProp.beds}
                        onChange={e => setNewProp({...newProp, beds: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">{t('dashboard.baths')}</label>
                      <input 
                        type="number" 
                        required
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={newProp.baths}
                        onChange={e => setNewProp({...newProp, baths: parseInt(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">{t('dashboard.windows')}</label>
                      <input 
                        type="number" 
                        required
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={newProp.windows}
                        onChange={e => setNewProp({...newProp, windows: parseInt(e.target.value)})}
                      />
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
                properties.map(prop => (
                  <div key={prop.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="bg-slate-50 p-2.5 rounded-xl text-slate-600">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{prop.address || t('dashboard.unnamed_property')}</h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {prop.square_feet} sqft • {prop.bedrooms} bed • {prop.bathrooms} bath
                        </p>
                      </div>
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
                {jobs.filter(j => j.job_lifecycle_status !== 'completed' && j.job_lifecycle_status !== 'cancelled').length}
              </span>
            </div>
            
            <div className="p-8 space-y-6">
              {jobs.filter(j => j.job_lifecycle_status !== 'completed' && j.job_lifecycle_status !== 'cancelled').length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-100 border-dashed">
                  <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-lg">{t('dashboard.no_active_bookings')}</p>
                  <p className="text-sm mt-1">{t('dashboard.select_property_book')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {jobs.filter(j => j.job_lifecycle_status !== 'completed' && j.job_lifecycle_status !== 'cancelled').map(job => (
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
                            {job.cleaner_name && (
                              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                {t('dashboard.cleaner') || "Cleaner"}: {job.cleaner_name}
                              </span>
                            )}
                            {job.job_lifecycle_status === 'pending_quote' ? (
                              <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                {t('dashboard.pending_quote') || "Pending Quote"}
                              </span>
                            ) : job.job_lifecycle_status === 'pending_claim' ? (
                              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                {t('dashboard.pending')}
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {t('dashboard.scheduled')} {job.specific_date ? `for ${formatDate(job.specific_date)}` : ''}
                              </span>
                            )}
                          </div>
                          {job.address && (
                            <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {job.address}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <div className="text-2xl font-bold font-display text-slate-900">
                            ${job.final_transaction_price.toFixed(2)}
                          </div>
                          <div className="text-xs text-slate-500 uppercase tracking-wider font-medium mt-1">
                            {t('dashboard.total_price')}
                          </div>
                        </div>
                        {job.job_lifecycle_status !== 'completed' && job.job_lifecycle_status !== 'cancelled' && (
                          <div className="flex flex-col items-end gap-2">
                            {confirmingCancelId === job.id ? (
                              <div className="flex items-center gap-2 bg-red-50 p-2 rounded-xl border border-red-100 animate-in fade-in slide-in-from-right-2">
                                <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">{t('common.are_you_sure')}</span>
                                <button
                                  onClick={() => {
                                    handleCancel(job.id);
                                    setConfirmingCancelId(null);
                                  }}
                                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                >
                                  {t('dashboard.yes_cancel')}
                                </button>
                                <button
                                  onClick={() => setConfirmingCancelId(null)}
                                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                                >
                                  {t('common.no')}
                                </button>
                              </div>
                            ) : (
                              <button
                                disabled={cancellingJobId === job.id}
                                onClick={() => {
                                  if (isCancellable(job)) {
                                    setConfirmingCancelId(job.id);
                                  } else {
                                    setActionMessage({ 
                                      type: 'error', 
                                      text: t('dashboard.cannot_cancel_24h_claimed') || "This job cannot be cancelled because it is less than 24 hours away and has already been claimed by a cleaner." 
                                    });
                                  }
                                }}
                                className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors ${
                                  isCancellable(job) 
                                    ? "text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100" 
                                    : "text-slate-400 bg-slate-100 cursor-not-allowed"
                                } ${cancellingJobId === job.id ? 'opacity-50 cursor-wait' : ''}`}
                              >
                                {cancellingJobId === job.id ? (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 animate-spin" />
                                    {t('common.processing')}
                                  </span>
                                ) : job.job_lifecycle_status === 'pending_quote' 
                                  ? t('dashboard.cancel_quote') 
                                  : t('dashboard.cancel_booking')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Payments Needed */}
          {jobs.filter(j => j.job_lifecycle_status === 'completed' && !j.paid).length > 0 && (
            <div className="bg-white rounded-3xl shadow-sm border border-amber-200 overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-400"></div>
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-500" />
                  {t('dashboard.payments_due')}
                </h2>
              </div>
              <div className="p-6 bg-amber-50/30 space-y-4">
                {jobs.filter(j => j.job_lifecycle_status === 'completed' && !j.paid).map(job => (
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

          {/* History & Reviews */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
                <Save className="w-5 h-5 text-slate-400" />
                {t('dashboard.past_cleanings')}
              </h2>
            </div>
            <div className="p-6 bg-slate-50/50 space-y-4 max-h-[600px] overflow-y-auto">
              {jobs.filter(j => j.job_lifecycle_status === 'completed').length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {t('dashboard.no_past_cleanings')}
                </div>
              ) : (
                jobs.filter(j => j.job_lifecycle_status === 'completed').map(job => (
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

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6">
                <DollarSign className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold font-display text-slate-900 mb-2">{t('dashboard.payment_title') || "Complete Payment"}</h2>
              <p className="text-slate-500 mb-6">{t('dashboard.payment_desc') || "Securely pay for your completed cleaning service."}</p>
              
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 mb-8 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">{t('dashboard.amount_due') || "Amount Due"}:</span>
                  <span className="font-bold text-slate-900 text-xl">
                    ${jobs.find(j => j.id === showPaymentModal)?.final_transaction_price.toFixed(2)}
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('dashboard.card_number') || "Card Number"}</label>
                    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-400 font-mono">
                      •••• •••• •••• 4242
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('dashboard.expiry') || "Expiry"}</label>
                      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-400 font-mono">
                        MM / YY
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CVC</label>
                      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-400 font-mono">
                        •••
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => handlePay(showPaymentModal)}
                  disabled={isPaying}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                >
                  {isPaying ? (
                    <>
                      <Clock className="w-5 h-5 animate-spin" />
                      {t('dashboard.processing_payment') || "Processing..."}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      {t('dashboard.confirm_payment') || "Confirm Payment"}
                    </>
                  )}
                </button>
                <button 
                  onClick={() => setShowPaymentModal(null)}
                  disabled={isPaying}
                  className="w-full py-3 text-slate-400 font-medium hover:text-slate-600 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
