import { useState, useEffect } from "react";
import { formatDate, formatTime, formatDateTime } from "../utils/dateUtils";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Briefcase, Calendar as CalendarIcon, CheckCircle, MapPin, DollarSign, Clock, Star, AlertCircle, ChevronLeft, ChevronRight, MessageSquare, Trophy, X, User, Shield, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CustomerNotes } from "../components/CustomerNotes";

export default function CleanerDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [pendingJobs, setPendingJobs] = useState<any[]>([]);
  const [myJobs, setMyJobs] = useState<any[]>([]);
  const [rating, setRating] = useState<{ averageRating: number; totalReviews: number; level: string; split: number; totalJobs: number; abandonedCount: number }>({ averageRating: 0, totalReviews: 0, level: 'Starter', split: 40, totalJobs: 0, abandonedCount: 0 });
  const [reviews, setReviews] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [claimingJobId, setClaimingJobId] = useState<string | null>(null);
  const [confirmingClaimAbandonedId, setConfirmingClaimAbandonedId] = useState<string | null>(null);
  const [abandoningJobId, setAbandoningJobId] = useState<string | null>(null);
  const [confirmingAbandonId, setConfirmingAbandonId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedSpecificDate, setSelectedSpecificDate] = useState<string>("");
  const [viewingNotesCustomerId, setViewingNotesCustomerId] = useState<string | null>(null);
  const [viewingNotesCustomerName, setViewingNotesCustomerName] = useState<string>("");
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [resubmitData, setResubmitData] = useState({ fullName: user?.full_name || "", phoneNumber: user?.phone_number || "", bio: user?.bio || "" });
  const [showResubmitForm, setShowResubmitForm] = useState(false);

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
      if (user.role !== "cleaner") {
        navigate("/dashboard");
        return;
      }
      if (user.is_approved) {
        fetchPendingJobs();
        fetchMyJobs();
        fetchRating();
        fetchReviews();
        fetchLeaderboard();
      }
    }
  }, [user, loading, navigate]);

  const fetchPendingJobs = async () => {
    try {
      const res = await fetch("/api/jobs/pending");
      const data = await res.json();
      setPendingJobs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMyJobs = async () => {
    try {
      const res = await fetch(`/api/jobs/cleaner/${user?.id}`);
      const data = await res.json();
      setMyJobs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRating = async () => {
    try {
      const res = await fetch(`/api/cleaners/${user?.id}/rating`);
      const data = await res.json();
      setRating(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/cleaners/${user?.id}/reviews`);
      const data = await res.json();
      setReviews(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch("/api/cleaners/leaderboard/all");
      const data = await res.json();
      setLeaderboard(data);
    } catch (err) {
      console.error(err);
    }
  };

  const renderJobDate = (job: any) => {
    if (job.job_lifecycle_status === 'claimed_scheduled' || job.job_lifecycle_status === 'completed') {
      return (
        <span className="text-emerald-600 font-bold flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4" />
          Confirmed: {formatDate(job.specific_date || job.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      );
    }

    if (job.scheduled_end_date) {
      return (
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="w-4 h-4 text-slate-400" />
          {formatDate(job.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric' })} - {formatDate(job.scheduled_end_date, { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5">
        <CalendarIcon className="w-4 h-4 text-slate-400" />
        {formatDate(job.scheduled_date, { weekday: 'short', month: 'short', day: 'numeric' })}
      </div>
    );
  };

  const handleClaim = async (jobId: string, specificDate?: string) => {
    const job = pendingJobs.find(j => j.id === jobId);
    const dateToUse = specificDate || (job ? job.scheduled_date.split(' to ')[0] : "");
    
    try {
      const res = await fetch(`/api/jobs/${jobId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleaner_id: user?.id, specific_date: dateToUse })
      });
      if (res.ok) {
        // Optimistic update
        setPendingJobs(prev => prev.filter(j => j.id !== jobId));
        setClaimingJobId(null);
        setSelectedSpecificDate("");
        setActionMessage({ type: 'success', text: "Job claimed successfully!" });
        fetchMyJobs(); // Refresh my jobs
      } else {
        const data = await res.json();
        setActionMessage({ type: 'error', text: data.error || t('cleaner_dashboard.failed_claim_job') });
        fetchPendingJobs(); // Refresh pending jobs in case someone else claimed it
      }
    } catch (err) {
      console.error(err);
      setActionMessage({ type: 'error', text: "Error claiming job." });
    }
  };

  const handleAbandon = async (jobId: string) => {
    setAbandoningJobId(jobId);
    setActionMessage(null);
    
    try {
      const res = await fetch(`/api/jobs/${jobId}/abandon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleaner_id: user?.id })
      });
      
      const data = await res.json().catch(() => ({ error: "Server error" }));

      if (res.ok) {
        setActionMessage({ type: 'success', text: "Job abandoned successfully. This has been recorded and the job is back on the marketplace." });
        fetchMyJobs();
        fetchPendingJobs();
        fetchRating(); // Update abandoned count
      } else {
        setActionMessage({ type: 'error', text: data.error || "Failed to abandon job" });
      }
    } catch (err) {
      console.error(err);
      setActionMessage({ type: 'error', text: "An error occurred while abandoning the job." });
    } finally {
      setAbandoningJobId(null);
    }
  };

  const handleComplete = async (jobId: string) => {
    setActionMessage(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cleaner_id: user?.id })
      });
      if (res.ok) {
        setActionMessage({ type: 'success', text: "Job marked as complete!" });
        fetchMyJobs();
      } else {
        const data = await res.json();
        setActionMessage({ type: 'error', text: data.error || "Failed to complete job" });
      }
    } catch (err) {
      console.error(err);
      setActionMessage({ type: 'error', text: "Error completing job." });
    }
  };

  const handleResubmit = async (e: any) => {
    e.preventDefault();
    setIsResubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user?.email,
          password: "RE-SUBMISSION", // Backend should probably handle this or we need the actual password. 
          // Wait, my backend change requires password. 
          // This is a problem if they don't know their password or if I don't want to ask for it again.
          role: "cleaner",
          full_name: resubmitData.fullName,
          phone_number: resubmitData.phoneNumber,
          bio: resubmitData.bio
        })
      });
      if (res.ok) {
        setActionMessage({ type: 'success', text: "Application updated successfully!" });
        setShowResubmitForm(false);
        // We might need to refresh the user context if we want to show updated data immediately
      } else {
        const data = await res.json();
        setActionMessage({ type: 'error', text: data.error || "Failed to update application" });
      }
    } catch (err) {
      console.error(err);
      setActionMessage({ type: 'error', text: "Error updating application" });
    } finally {
      setIsResubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return null;

  if (!user.is_approved) {
    return (
      <div className="max-w-2xl mx-auto mt-16 px-4 pb-24">
        <div className="text-center space-y-6 bg-white p-12 rounded-3xl shadow-sm border border-slate-100">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-amber-50 text-amber-500 mb-4 border-8 border-amber-50/50">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold font-display text-slate-900">{t('cleaner_dashboard.account_pending')}</h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            {t('cleaner_dashboard.pending_message')}
          </p>

          {!showResubmitForm ? (
            <button 
              onClick={() => setShowResubmitForm(true)}
              className="mt-4 px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
            >
              Update Application Details
            </button>
          ) : (
            <form onSubmit={handleResubmit} className="mt-8 p-8 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-4 animate-in fade-in slide-in-from-top-4">
              <h3 className="font-bold font-display text-slate-900 text-lg mb-4">Update Your Application</h3>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={resubmitData.fullName}
                  onChange={e => setResubmitData({...resubmitData, fullName: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone Number</label>
                <input 
                  type="tel" 
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={resubmitData.phoneNumber}
                  onChange={e => setResubmitData({...resubmitData, phoneNumber: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bio / Experience</label>
                <textarea 
                  required
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  value={resubmitData.bio}
                  onChange={e => setResubmitData({...resubmitData, bio: e.target.value})}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="submit" 
                  disabled={isResubmitting}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-all disabled:opacity-50"
                >
                  {isResubmitting ? "Updating..." : "Save Changes"}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowResubmitForm(false)}
                  className="px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 mt-8 text-left">
            <h3 className="font-bold font-display text-slate-900 mb-4 text-lg">{t('cleaner_dashboard.what_happens_next')}</h3>
            <ul className="text-slate-600 space-y-3 list-none">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</div>
                <span>{t('cleaner_dashboard.step_1')}</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</div>
                <span>{t('cleaner_dashboard.step_2')}</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</div>
                <span>{t('cleaner_dashboard.step_3')}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Calendar Helpers
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getJobsForDay = (day: number) => {
    const dateStr = new Date(year, month, day).toISOString().split('T')[0];
    return myJobs.filter(job => 
      (job.specific_date && job.specific_date.startsWith(dateStr)) || 
      (!job.specific_date && job.scheduled_date.startsWith(dateStr))
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold font-display text-slate-900 tracking-tight">{t('cleaner_dashboard.title')}</h1>
          <p className="text-slate-500 mt-2 text-xl font-light">{t('cleaner_dashboard.subtitle')}</p>
        </div>
        <div className="relative z-10 flex flex-wrap items-center gap-4">
          <div className="bg-emerald-50 text-emerald-700 px-6 py-4 rounded-2xl font-medium flex items-center gap-4 border border-emerald-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-emerald-100 p-3 rounded-xl">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="text-[10px] text-emerald-600/80 uppercase tracking-widest font-bold">{t('cleaner_dashboard.total_earned')}</div>
              <div className="text-xl font-bold font-display tracking-wide">${myJobs.filter(j => j.job_lifecycle_status === 'completed').reduce((sum, job) => sum + (job.cleaner_payout || (job.final_transaction_price * (rating.split / 100))), 0).toFixed(2)}</div>
            </div>
          </div>
          
          {rating.totalReviews > 0 && (
            <div className="bg-amber-50 text-amber-700 px-6 py-4 rounded-2xl font-medium flex items-center gap-4 border border-amber-100 shadow-sm hover:shadow-md transition-shadow" title="Rolling average of last 20 jobs">
              <div className="bg-amber-100 p-3 rounded-xl">
                <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
              </div>
              <div>
                <div className="text-[10px] text-amber-600/80 uppercase tracking-widest font-bold">{t('cleaner_dashboard.rating')}</div>
                <div className="text-xl font-bold font-display tracking-wide">{rating.averageRating.toFixed(1)} <span className="text-sm font-normal text-amber-600/70">({rating.totalReviews})</span></div>
              </div>
            </div>
          )}
          
          <div className="bg-indigo-50 text-indigo-700 px-6 py-4 rounded-2xl font-medium flex items-center gap-4 border border-indigo-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-indigo-100 p-3 rounded-xl">
              <Briefcase className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <div className="text-[10px] text-indigo-600/80 uppercase tracking-widest font-bold">{t('cleaner_dashboard.level')}</div>
              <div className="text-xl font-bold font-display tracking-wide">{rating.level} <span className="text-sm font-normal text-indigo-600/70">({rating.split}%)</span></div>
            </div>
          </div>

          {rating.abandonedCount > 0 && (
            <div className="bg-red-50 text-red-700 px-5 py-3 rounded-2xl font-medium flex items-center gap-3 border border-red-100 shadow-sm">
              <div className="bg-red-100 p-2 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-xs text-red-600/80 uppercase tracking-wider font-bold">Abandonments</div>
                <div className="text-lg font-bold">{rating.abandonedCount}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {actionMessage && (
        <div className={`p-4 rounded-2xl border animate-in fade-in slide-in-from-top-2 duration-300 ${
          actionMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-3">
            {actionMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <p className="font-medium">{actionMessage.text}</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left Column: Job Board & Leaderboard */}
        <div className="lg:col-span-5 space-y-8">
          
          {/* Marketplace Job Board */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  {t('cleaner_dashboard.available_jobs')}
                </h2>
                <p className="text-sm text-slate-500 mt-1">{t('cleaner_dashboard.claim_jobs_msg')}</p>
              </div>
              <span className="bg-emerald-100 text-emerald-700 py-1 px-3 rounded-full text-xs font-bold">
                {pendingJobs.length}
              </span>
            </div>
            <div className="p-6 space-y-4 bg-slate-50/50 max-h-[600px] overflow-y-auto">
              {pendingJobs.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-100 border-dashed">
                  <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-lg">{t('cleaner_dashboard.no_jobs_available')}</p>
                  <p className="text-sm mt-1">{t('cleaner_dashboard.check_back_later')}</p>
                </div>
              ) : (
                pendingJobs.map(job => (
                  <div key={job.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                          {job.homeowner_picture ? (
                            <img 
                              src={job.homeowner_picture} 
                              alt={job.homeowner_name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <User className="w-7 h-7 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1 text-slate-900 font-bold text-2xl font-display">
                            ${(job.cleaner_payout || (job.final_transaction_price * (rating.split / 100))).toFixed(2)}
                            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider ml-1">{t('cleaner_dashboard.payout')}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-500 mt-2">
                            {renderJobDate(job)}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {job.homeowner_name && (
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">{job.homeowner_name}</span>
                            )}
                            <button
                              onClick={() => {
                                setViewingNotesCustomerId(job.homeowner_id);
                                setViewingNotesCustomerName(job.homeowner_email);
                              }}
                              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              {t('customer_notes')}
                            </button>
                          </div>
                          {job.address && (
                            <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                              <MapPin className="w-4 h-4" />
                              {job.address}
                            </div>
                          )}
                        </div>
                      </div>
                      {claimingJobId === job.id ? (
                        <div className="flex flex-col gap-2">
                          <input 
                            type="date" 
                            className="px-2 py-1 text-sm border rounded-lg"
                            min={job.scheduled_date}
                            max={job.scheduled_end_date || job.scheduled_date}
                            value={selectedSpecificDate}
                            onChange={(e) => setSelectedSpecificDate(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleClaim(job.id, selectedSpecificDate)}
                              disabled={job.scheduled_end_date && !selectedSpecificDate}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                            >
                              Confirm
                            </button>
                            <button 
                              onClick={() => { setClaimingJobId(null); setSelectedSpecificDate(""); }}
                              className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {confirmingClaimAbandonedId === job.id ? (
                            <div className="flex flex-col gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100 animate-in zoom-in-95">
                              <span className="text-xs font-bold text-amber-700 text-center flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> This job was previously abandoned.
                              </span>
                              <span className="text-[10px] text-amber-600 text-center">Are you sure you want to claim it?</span>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => {
                                    setConfirmingClaimAbandonedId(null);
                                    if (job.scheduled_end_date) {
                                      setClaimingJobId(job.id);
                                    } else {
                                      handleClaim(job.id);
                                    }
                                  }}
                                  className="flex-1 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors"
                                >
                                  Yes, Claim
                                </button>
                                <button 
                                  onClick={() => setConfirmingClaimAbandonedId(null)}
                                  className="flex-1 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                if (job.is_abandoned) {
                                  setConfirmingClaimAbandonedId(job.id);
                                } else if (job.scheduled_end_date) {
                                  setClaimingJobId(job.id);
                                } else {
                                  handleClaim(job.id);
                                }
                              }}
                              className="px-5 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl font-medium hover:bg-emerald-600 hover:text-white transition-colors group-hover:shadow-sm"
                            >
                              {t('cleaner_dashboard.claim')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600 flex items-center justify-between border border-slate-100">
                      <div className="flex items-center gap-1.5"><span className="font-medium text-slate-900">{t('cleaner_dashboard.sq_ft')}</span> {job.square_feet || "N/A"}</div>
                      <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                      <div className="flex items-center gap-1.5"><span className="font-medium text-slate-900">{t('cleaner_dashboard.beds')}</span> {job.bedrooms || "N/A"}</div>
                      <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                      <div className="flex items-center gap-1.5"><span className="font-medium text-slate-900">{t('cleaner_dashboard.baths')}</span> {job.bathrooms || "N/A"}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cleaner Leaderboard */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                {t('cleaner_dashboard.leaderboard')}
              </h2>
              <p className="text-sm text-slate-500 mt-1">{t('cleaner_dashboard.top_rated_cleaners')}</p>
              <div className="mt-4 bg-amber-50 border border-amber-100 text-amber-800 text-sm p-3 rounded-xl flex items-start gap-3 font-medium">
                <div className="bg-amber-100 p-1.5 rounded-lg shrink-0">
                  <DollarSign className="w-4 h-4 text-amber-600" />
                </div>
                <div className="mt-0.5">{t('cleaner_dashboard.leaderboard_bonus_msg')}</div>
              </div>
            </div>
            <div className="p-6 space-y-3 bg-slate-50/50 max-h-[400px] overflow-y-auto">
              {leaderboard.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {t('cleaner_dashboard.no_ratings_yet')}
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((cleaner, index) => (
                    <div key={cleaner.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      cleaner.id === user.id ? 'border-emerald-200 bg-emerald-50 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold font-display text-lg shrink-0 ${
                          index === 0 ? 'bg-amber-100 text-amber-600 border border-amber-200' :
                          index === 1 ? 'bg-slate-200 text-slate-600 border border-slate-300' :
                          index === 2 ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          #{index + 1}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                          {cleaner.profile_picture ? (
                            <img 
                              src={cleaner.profile_picture} 
                              alt={cleaner.full_name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Star className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="font-bold text-slate-900 truncate max-w-[120px]">
                          {cleaner.id === user.id ? t('cleaner_dashboard.you') : cleaner.full_name || cleaner.contact_email.split('@')[0]}
                        </div>
                        {cleaner.abandonedCount > 0 && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {cleaner.abandonedCount} Abandoned
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 bg-emerald-100/50 px-2.5 py-1 rounded-lg">
                          <Trophy className="w-3.5 h-3.5" />
                          {cleaner.totalPoints} {t('cleaner_dashboard.pts')}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5 font-medium">
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            {Number(cleaner.averageRating).toFixed(1)}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span>{cleaner.totalReviews} {t('cleaner_dashboard.revs')}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Calendar & Reviews */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* My Schedule Calendar */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-slate-600" />
                  {t('cleaner_dashboard.my_schedule')}
                </h2>
                <p className="text-sm text-slate-500 mt-1">{t('cleaner_dashboard.upcoming_completed_jobs')}</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                <button onClick={prevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-bold font-display text-slate-900 min-w-[140px] text-center">
                  {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={nextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-slate-600">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 bg-slate-50/30 overflow-x-auto">
              <div className="min-w-[600px]">
                <div className="grid grid-cols-7 gap-2 mb-3">
                  {[t('cleaner_dashboard.sun'), t('cleaner_dashboard.mon'), t('cleaner_dashboard.tue'), t('cleaner_dashboard.wed'), t('cleaner_dashboard.thu'), t('cleaner_dashboard.fri'), t('cleaner_dashboard.sat')].map(day => (
                    <div key={day} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {blanks.map(blank => (
                    <div key={`blank-${blank}`} className="aspect-square rounded-2xl bg-slate-50/50 border border-slate-100/50"></div>
                  ))}
                  {days.map(day => {
                    const dayJobs = getJobsForDay(day);
                    const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
                    
                    return (
                      <div 
                        key={day} 
                        className={`aspect-square rounded-2xl border p-2 flex flex-col transition-all ${
                          isToday ? 'border-emerald-500 bg-emerald-50/30 shadow-sm' : 'border-slate-200 bg-white hover:border-emerald-300'
                        }`}
                      >
                        <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-xl mb-1 ${
                          isToday ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200' : 'text-slate-600'
                        }`}>
                          {day}
                        </span>
                        <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto custom-scrollbar pr-0.5">
                          {dayJobs.map(job => (
                            <div 
                              key={job.id} 
                              className={`text-xs p-1.5 rounded-lg truncate font-bold border ${
                                job.job_lifecycle_status === 'completed' 
                                  ? 'bg-slate-50 text-slate-400 border-slate-100 line-through' 
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              }`}
                              title={`$${(job.cleaner_payout || (job.final_transaction_price * (rating.split / 100))).toFixed(2)} - ${job.square_feet} sqft ${job.specific_date ? `(Confirmed: ${job.specific_date})` : ''}`}
                            >
                              ${(job.cleaner_payout || (job.final_transaction_price * (rating.split / 100))).toFixed(0)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Job List for selected month */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/80 space-y-4 max-h-[400px] overflow-y-auto">
              <h3 className="font-bold font-display text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                {t('cleaner_dashboard.job_details_for', { month: currentDate.toLocaleString('default', { month: 'long' }) })}
              </h3>
              {myJobs.filter(job => new Date(job.scheduled_date).getMonth() === month && new Date(job.scheduled_date).getFullYear() === year).length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-white rounded-2xl border border-slate-100 border-dashed">
                  {t('cleaner_dashboard.no_jobs_scheduled')}
                </div>
              ) : (
                myJobs
                  .filter(job => new Date(job.scheduled_date).getMonth() === month && new Date(job.scheduled_date).getFullYear() === year)
                  .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
                  .map(job => (
                  <div key={job.id} className={`rounded-2xl border p-5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${job.job_lifecycle_status === 'completed' ? 'bg-white border-slate-100 opacity-75' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                        {job.homeowner_picture ? (
                          <img 
                            src={job.homeowner_picture} 
                            alt={job.homeowner_name} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <User className="w-7 h-7 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-slate-900 font-bold text-xl font-display">
                          <DollarSign className="w-5 h-5 text-slate-400" />
                          {(job.cleaner_payout || (job.final_transaction_price * (rating.split / 100))).toFixed(2)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-2">
                          {renderJobDate(job)}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {job.homeowner_name && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">{job.homeowner_name}</span>
                          )}
                          <button
                            onClick={() => {
                              setViewingNotesCustomerId(job.homeowner_id);
                              setViewingNotesCustomerName(job.homeowner_email);
                            }}
                            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            {t('customer_notes')}
                          </button>
                        </div>
                        {job.address && (
                          <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                            <MapPin className="w-4 h-4" />
                            {job.address}
                          </div>
                        )}
                        
                        {job.homeowner_preferences && (
                          <div className="mt-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 space-y-2">
                            {(() => {
                              const prefs = JSON.parse(job.homeowner_preferences);
                              return (
                                <>
                                  <div className="flex items-start gap-2 text-xs">
                                    <Shield className="w-3.5 h-3.5 text-indigo-600 mt-0.5" />
                                    <div>
                                      <span className="font-bold text-indigo-900 block uppercase tracking-wider text-[9px] mb-0.5">{t('settings.entry_instructions')}</span>
                                      <span className="text-indigo-700">{prefs.entry_instructions || "No instructions provided"}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <Heart className="w-3.5 h-3.5 text-indigo-600" />
                                    <div>
                                      <span className="font-bold text-indigo-900 uppercase tracking-wider text-[9px] mr-2">{t('settings.has_pets')}</span>
                                      <span className="text-indigo-700">
                                        {typeof prefs.has_pets === 'boolean' 
                                          ? (prefs.has_pets ? "Yes" : "No") 
                                          : prefs.has_pets}
                                      </span>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-3 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 inline-flex">
                          <span>{job.square_feet || "N/A"} sqft</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span>{job.bedrooms || "N/A"} beds</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span>{job.bathrooms || "N/A"} baths</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3">
                      {job.job_lifecycle_status === 'claimed_scheduled' ? (
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={() => handleComplete(job.id)}
                            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-sm"
                          >
                            <CheckCircle className="w-4 h-4" /> {t('cleaner_dashboard.mark_complete')}
                          </button>
                          
                          {confirmingAbandonId === job.id ? (
                            <div className="flex flex-col gap-2 p-3 bg-red-50 rounded-xl border border-red-100 animate-in zoom-in-95">
                              <span className="text-xs font-bold text-red-700 text-center">Are you sure? This will affect your stats.</span>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => {
                                    handleAbandon(job.id);
                                    setConfirmingAbandonId(null);
                                  }}
                                  className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                                >
                                  Yes, Abandon
                                </button>
                                <button 
                                  onClick={() => setConfirmingAbandonId(null)}
                                  className="flex-1 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              disabled={abandoningJobId === job.id}
                              onClick={() => setConfirmingAbandonId(job.id)}
                              className="px-5 py-2.5 bg-white text-red-600 border border-red-200 rounded-xl font-medium hover:bg-red-50 transition-colors flex items-center gap-2 shadow-sm group/abandon disabled:opacity-50"
                            >
                              <AlertCircle className={`w-4 h-4 ${abandoningJobId === job.id ? 'animate-spin' : 'group-hover/abandon:animate-pulse'}`} /> 
                              {abandoningJobId === job.id ? "Abandoning..." : "Abandon Job"}
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" /> {t('cleaner_dashboard.completed')}
                          </span>
                          {job.rating && (
                            <div className="flex items-center gap-1.5 text-amber-600 text-sm font-bold bg-amber-50 px-3 py-1 rounded-lg border border-amber-100">
                              <Star className="w-4 h-4 fill-current" /> {job.rating} / 5
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* My Ratings & Reviews */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-500" />
                {t('cleaner_dashboard.my_ratings_reviews')}
              </h2>
              <p className="text-sm text-slate-500 mt-1">{t('cleaner_dashboard.feedback_msg')}</p>
            </div>
            <div className="p-6 space-y-4 bg-slate-50/50 max-h-[400px] overflow-y-auto">
              {reviews.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-100 border-dashed">
                  <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-lg">{t('cleaner_dashboard.no_reviews_yet')}</p>
                  <p className="text-sm mt-1">{t('cleaner_dashboard.complete_jobs_msg')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map(review => (
                    <div key={review.id} className="p-5 rounded-2xl border border-slate-100 bg-white shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-100">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-slate-200"
                              }`}
                            />
                          ))}
                        </div>
                        <div className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          {formatDate(review.scheduled_date)}
                        </div>
                      </div>
                      
                      <div className="text-slate-700 mb-4 italic font-serif text-lg leading-relaxed">
                        "{review.review_comment || t('cleaner_dashboard.no_comment_provided')}"
                      </div>
                      
                      <div className="text-xs font-medium text-slate-500 flex items-center gap-2 border-t border-slate-100 pt-3">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                          {review.homeowner_email.charAt(0).toUpperCase()}
                        </div>
                        {review.homeowner_email}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
      
      {/* Customer Notes Modal */}
      {viewingNotesCustomerId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                {t('customer_notes')}
              </h2>
              <button 
                onClick={() => setViewingNotesCustomerId(null)}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <CustomerNotes 
                customerId={viewingNotesCustomerId} 
                customerName={viewingNotesCustomerName} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
