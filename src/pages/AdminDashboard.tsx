import { useState, useEffect, useMemo } from "react";
import { formatDate, formatTime, formatDateTime } from "../utils/dateUtils";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Shield, CheckCircle, Users, AlertTriangle, Star, Calendar, Home, Briefcase, ChevronLeft, ChevronRight, MapPin, MessageSquare, X, DollarSign, Clock, FileText, Maximize, Layout, ExternalLink, ShieldCheck, Zap, AlertCircle, RefreshCw, History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CustomerNotes } from "../components/CustomerNotes";
import { BonusModal } from "../components/BonusModal";
import { PayoutModal } from "../components/PayoutModal";

const PhotoModal = ({ job, onClose }: { job: any, onClose: () => void }) => {
  console.log("PhotoModal job:", job);
  console.log("PhotoModal job_media:", job.job_media);
  const beforePhotos = job.job_media?.filter((m: any) => m.category === 'before') || [];
  const afterPhotos = job.job_media?.filter((m: any) => m.category === 'after') || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xl font-bold">Job Photos</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-6">
          <div>
            <h3 className="font-semibold mb-3">Before</h3>
            {beforePhotos.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {beforePhotos.map((m: any) => <img key={m.id} src={m.url} alt="Before" className="rounded-lg w-full h-32 object-cover" referrerPolicy="no-referrer" />)}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No before photos found for this job.</p>
            )}
          </div>
          <div>
            <h3 className="font-semibold mb-3">After</h3>
            {afterPhotos.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {afterPhotos.map((m: any) => <img key={m.id} src={m.url} alt="After" className="rounded-lg w-full h-32 object-cover" referrerPolicy="no-referrer" />)}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No after photos found for this job.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const adminHeaders = {
    "x-user-id": user?.id || "",
    "x-user-role": user?.role || ""
  };
  const [activeTab, setActiveTab] = useState<"overview" | "applications" | "cleaners" | "properties" | "payments" | "feedback" | "quotes" | "invoices" | "history">("overview");
  const [selectedJobForPhotos, setSelectedJobForPhotos] = useState<any>(null);
  const [selectedJobForBonus, setSelectedJobForBonus] = useState<any | null>(null);
  const [selectedJobForPayout, setSelectedJobForPayout] = useState<any | null>(null);
  const [cleaners, setCleaners] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [applicationHistory, setApplicationHistory] = useState<any[]>([]);
  const [badRatings, setBadRatings] = useState<any[]>([]);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [allCharges, setAllCharges] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [viewingNotesCustomerId, setViewingNotesCustomerId] = useState<string | null>(null);
  const [viewingNotesCustomerName, setViewingNotesCustomerName] = useState<string>("");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [successIds, setSuccessIds] = useState<Set<string>>(new Set());
  const [jobPrices, setJobPrices] = useState<Record<string, number>>({});
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);
  const [cleanerToRemove, setCleanerToRemove] = useState<string | null>(null);
  const [showRemoveModal, setShowRemoveModal] = useState<boolean>(false);
  const [addStrike, setAddStrike] = useState<boolean>(false);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [tempScheduledDate, setTempScheduledDate] = useState<string>("");
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [tempJobData, setTempJobData] = useState<any>({});
  const [jobFilterTab, setJobFilterTab] = useState<'all' | 'past' | 'future'>('all');
  
  const [lastSeen, setLastSeen] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("admin_last_seen");
    try {
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error("Error parsing admin_last_seen:", e);
      return {};
    }
  });

  const [currentDate, setCurrentDate] = useState(new window.Date());

  useEffect(() => {
    if (activeTab) {
      const now = new window.Date().toISOString();
      setLastSeen(prev => {
        const next = { ...prev, [activeTab]: now };
        localStorage.setItem("admin_last_seen", JSON.stringify(next));
        return next;
      });
    }
  }, [activeTab]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
      return;
    }
    if (user) {
      if (user.role !== "admin") {
        navigate("/dashboard");
        return;
      }
      fetchCleaners();
      fetchAllUsers();
      fetchApplicationHistory();
      fetchBadRatings();
      fetchAllJobs();
      fetchAllProperties();
      fetchCharges();
      fetchFeedback();
    }
  }, [user, loading, navigate]);

  const [refreshing, setRefreshing] = useState(false);

  const pendingApplications = useMemo(() => {
    // Start with cleaners who are pending OR recently approved (successIds)
    const fromCleaners = cleaners.filter(c => c.is_approved === 0 || successIds.has(c.id));
    
    // Look for any other user who is pending and might be a cleaner
    // (e.g. if they have a CV or bio or were registered as cleaner but missed by the cleaners fetch)
    const fromAllUsers = allUsers.filter(u => 
      (u.is_approved === 0 || successIds.has(u.id)) && 
      (u.role_designation === 'cleaner' || u.cv || u.bio) &&
      !fromCleaners.find(c => c.id === u.id)
    );

    const merged = [...fromCleaners, ...fromAllUsers];
    
    // Sort by created_at desc
    return merged.sort((a, b) => {
      const dateA = a.created_at ? new window.Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new window.Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [cleaners, allUsers]);

  const fetchCleaners = async () => {
    console.log("[Admin] Fetching cleaners...");
    try {
      const localCleaners = await fetch("/api/admin/cleaners", { headers: adminHeaders }).then(r => r.ok ? r.json() : []);
      console.log("[Admin] Local cleaners fetched:", localCleaners.length);
      
      const filtered = localCleaners.filter((c: any) => !c.is_deleted);
      console.log("[Admin] Total cleaners:", filtered.length);
      setCleaners(filtered);
    } catch (err) {
      console.error("[Admin] Error fetching cleaners:", err);
    }
  };

  const fetchAllUsers = async () => {
    console.log("[Admin] Fetching all users...");
    try {
      const res = await fetch("/api/admin/users/all", { headers: adminHeaders });
      if (res.ok) {
        const data = await res.json();
        console.log("[Admin] All users fetched:", data.length);
        setAllUsers(data);
      }
    } catch (err) {
      console.error("[Admin] Error fetching all users:", err);
    }
  };

  const fetchApplicationHistory = async () => {
    console.log("[Admin] Fetching application history...");
    try {
      const localApps = await fetch("/api/admin/applications/history", { headers: adminHeaders }).then(r => r.ok ? r.json() : []);
      console.log("[Admin] Local applications fetched:", localApps.length);
      
      setApplicationHistory(localApps);
    } catch (err) {
      console.error("[Admin] Error fetching application history:", err);
    }
  };

  const refreshAllData = async () => {
    console.log("[Admin] Manually refreshing all data...");
    setRefreshing(true);
    try {
      await Promise.all([
        fetchCleaners(),
        fetchAllUsers(),
        fetchApplicationHistory(),
        fetchBadRatings(),
        fetchAllJobs(),
        fetchAllProperties(),
        fetchFeedback()
      ]);
      console.log("[Admin] Data refresh complete.");
    } catch (err) {
      console.error("[Admin] Error refreshing data:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchBadRatings = async () => {
    try {
      const res = await fetch("/api/admin/bad-ratings", { headers: adminHeaders });
      if (res.ok) {
        const data = await res.json();
        setBadRatings(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllJobs = async () => {
    try {
      const res = await fetch("/api/admin/jobs", { headers: adminHeaders });
      if (res.ok) {
        const data = await res.json();
        const filtered = (Array.isArray(data) ? data : []).filter((job: any) => job.job_lifecycle_status !== 'cancelled');
        const uniqueJobs: any[] = [];
        const ids = new Set();
        filtered.forEach((j: any) => {
          if (!ids.has(j.id)) {
            uniqueJobs.push(j);
            ids.add(j.id);
          } else {
            console.error("Duplicate job ID found, filtering out:", j.id);
          }
        });
        setAllJobs(uniqueJobs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllProperties = async () => {
    try {
      const res = await fetch("/api/admin/properties", { headers: adminHeaders });
      if (res.ok) {
        const data = await res.json();
        setAllProperties(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCharges = async () => {
    try {
      const res = await fetch("/api/admin/charges", { headers: adminHeaders });
      if (res.ok) {
        const data = await res.json();
        setAllCharges(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFeedback = async () => {
    try {
      const res = await fetch("/api/admin/feedback", {
        headers: adminHeaders
      });
      const data = await res.json();
      setFeedback(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/cleaners/${id}/approve`, {
        method: "POST",
        headers: adminHeaders
      });
      if (res.ok) {
        setSuccessIds(prev => new Set(prev).add(id));
        await Promise.all([
          fetchCleaners(),
          fetchAllUsers(),
          fetchApplicationHistory()
        ]);
        // Keep success state for 3 seconds
        setTimeout(() => {
          setSuccessIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleMarkChargePaid = async (chargeId: string) => {
    setProcessingIds(prev => new Set(prev).add(chargeId));
    try {
      const res = await fetch(`/api/admin/charges/${chargeId}/pay`, {
        method: "POST",
        headers: adminHeaders
      });
      if (res.ok) {
        fetchCharges();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(chargeId);
        return next;
      });
    }
  };

  const handleSendInvoice = async (jobId: string) => {
    setProcessingIds(prev => new Set(prev).add(jobId));
    try {
      const res = await fetch(`/api/jobs/${jobId}/invoice`, {
        method: "POST",
        headers: adminHeaders
      });
      if (res.ok) {
        await fetchAllJobs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const handleForceApprove = async (id: string) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/users/${id}/approve`, {
        method: "POST",
        headers: adminHeaders
      });
      if (res.ok) {
        setSuccessIds(prev => new Set(prev).add(id));
        await Promise.all([
          fetchCleaners(),
          fetchAllUsers(),
          fetchApplicationHistory()
        ]);
        setTimeout(() => {
          setSuccessIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleRejectCleaner = async (id: string) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/cleaners/${id}/reject`, {
        method: "POST",
        headers: adminHeaders
      });
      if (res.ok) {
        await Promise.all([
          fetchCleaners(),
          fetchApplicationHistory()
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleRestoreUser = async (id: string) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/users/${id}/restore`, {
        method: "POST",
        headers: adminHeaders
      });
      if (res.ok) {
        await Promise.all([
          fetchCleaners(),
          fetchAllUsers(),
          fetchApplicationHistory()
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleUpdateQuote = async (id: string) => {
    try {
      const res = await fetch(`/api/jobs/${id}/update-quote`, {
        method: "PATCH",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ calculated_base_price: tempPrice })
      });
      if (res.ok) {
        await fetchAllJobs();
        setEditingPriceId(null);
      } else {
        const errorData = await res.json();
        alert(`Failed to update price: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("[Admin] Error updating price:", err);
    }
  };

  const handleApproveQuote = async (id: string) => {
    const price = jobPrices[id];
    if (!price) {
      alert("Please enter a price");
      return;
    }
    try {
      const res = await fetch(`/api/admin/jobs/${id}/approve-quote`, {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ price })
      });
      if (res.ok) {
        fetchAllJobs();
      } else {
        const errorData = await res.json();
        console.error("[Admin] Failed to approve quote:", errorData);
        alert(`Failed to approve quote: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("[Admin] Error approving quote:", err);
    }
  };

  const handleRejectQuote = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/jobs/${id}/reject-quote`, {
        method: "POST",
        headers: adminHeaders
      });
      if (res.ok) {
        fetchAllJobs();
      } else {
        const errorData = await res.json();
        console.error("[Admin] Failed to reject quote:", errorData);
        alert(`Failed to reject quote: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("[Admin] Error rejecting quote:", err);
    }
  };

  const handlePayCleaner = async (id: string) => {
    try {
      const res = await fetch(`/api/jobs/${id}/pay-cleaner`, {
        method: "POST",
        headers: adminHeaders
      });
      if (res.ok) {
        fetchAllJobs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkPaymentReceived = async (id: string) => {
    try {
      const res = await fetch(`/api/jobs/${id}/mark-paid`, {
        method: "POST",
        headers: adminHeaders
      });
      if (res.ok) {
        fetchAllJobs();
      } else {
        alert("Failed to mark payment as received.");
      }
    } catch (err) {
      console.error(err);
      alert("Error marking payment as received.");
    }
  };

  const handleRemoveCleaner = async (id: string) => {
    setCleanerToRemove(id);
    setShowRemoveModal(true);
  };

  const confirmRemoveCleaner = async () => {
    if (!cleanerToRemove) return;
    try {
      const res = await fetch(`/api/admin/jobs/${cleanerToRemove}/remove-cleaner`, {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ strike: addStrike })
      });
      if (res.ok) {
        fetchAllJobs();
        setShowRemoveModal(false);
        setCleanerToRemove(null);
        setAddStrike(false);
      } else {
        alert("Failed to remove cleaner");
      }
    } catch (err) {
      console.error("[Admin] Error removing cleaner:", err);
    }
  };

  const handleUpdateJobDate = async (id: string, newDate: string) => {
    try {
      const res = await fetch(`/api/admin/jobs/${id}/update-date`, {
        method: "POST",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ new_date: newDate })
      });
      if (res.ok) {
        fetchAllJobs();
        setEditingDateId(null);
        setTempScheduledDate("");
      } else {
        alert("Failed to update date");
      }
    } catch (err) {
      console.error("[Admin] Error updating date:", err);
      alert("Error updating date");
    }
  };

  const handleToggleCompleted = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/jobs/${id}/toggle-completed`, {
        method: "POST",
        headers: adminHeaders
      });
      if (res.ok) {
        fetchAllJobs();
      } else {
        alert("Failed to toggle status");
      }
    } catch (err) {
      console.error("[Admin] Error toggling status:", err);
      alert("Error toggling status");
    }
  };

  const handleUpdateAllJobData = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/jobs/${id}/update-all`, {
        method: "PATCH",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(tempJobData)
      });
      if (res.ok) {
        fetchAllJobs();
        setEditingJobId(null);
        setTempJobData({});
      } else {
        alert("Failed to update job");
      }
    } catch (err) {
      console.error("[Admin] Error updating job:", err);
      alert("Error updating job");
    }
  };


  const handleResolveFeedback = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/feedback/${id}/resolve`, {
        method: "POST",
        headers: adminHeaders
      });
      if (res.ok) {
        fetchFeedback();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCleaner = async (id: string) => {
    const cleaner = cleaners.find(c => c.id === id);
    
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      // 1. Delete locally (soft delete)
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: adminHeaders
      });

      if (res.ok) {
        await Promise.all([
          fetchCleaners(),
          fetchAllUsers()
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user || user.role !== "admin") return null;

  const daysInMonth = new window.Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new window.Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const prevMonth = () => setCurrentDate(new window.Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new window.Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const monthNames = [
    t('common.january'), t('common.february'), t('common.march'), t('common.april'),
    t('common.may'), t('common.june'), t('common.july'), t('common.august'),
    t('common.september'), t('common.october'), t('common.november'), t('common.december')
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-100 rounded-full -mr-32 -mt-32 blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500"></div>
        <div className="flex items-center gap-6 relative z-10">
          <div className="bg-slate-900 p-5 rounded-2xl text-white shadow-lg shadow-slate-200">
            <Shield className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-4xl font-bold font-display text-slate-900 tracking-tight">{t('admin.title')}</h1>
            <p className="text-slate-500 mt-2 text-xl font-light">{t('admin.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={refreshAllData}
          disabled={refreshing}
          className={`relative z-10 px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* Quick Stats / Pending Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          onClick={() => setActiveTab("applications")}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            {pendingApplications.length > 0 && (
              <span className="px-3 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-full animate-pulse">
                {pendingApplications.length} {t('admin.pending')}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900">{t('admin.tabs.applications')}</h3>
          <p className="text-sm text-slate-500 mt-1">{t('admin.applications_subtitle') || "Review new cleaner sign-ups"}</p>
        </div>

        <div 
          onClick={() => setActiveTab("quotes")}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:scale-110 transition-transform">
              <Briefcase className="w-6 h-6" />
            </div>
            {allJobs.filter(j => j.job_lifecycle_status === 'pending_quote').length > 0 && (
              <span className="px-3 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-full animate-pulse">
                {allJobs.filter(j => j.job_lifecycle_status === 'pending_quote').length} {t('admin.pending')}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900">{t('admin.quote_requests') || "Quote Requests"}</h3>
          <p className="text-sm text-slate-500 mt-1">{t('admin.quotes_subtitle') || "Jobs requiring manual pricing"}</p>
        </div>

        <div 
          onClick={() => setActiveTab("feedback")}
          className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform">
              <MessageSquare className="w-6 h-6" />
            </div>
            {feedback.filter(f => f.status === 'pending').length > 0 && (
              <span className="px-3 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-full animate-pulse">
                {feedback.filter(f => f.status === 'pending').length} {t('admin.pending')}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900">{t('admin.tabs.feedback')}</h3>
          <p className="text-sm text-slate-500 mt-1">{t('admin.feedback_subtitle_short') || "Issues reported by users"}</p>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto no-scrollbar pb-px">
        <button
          onClick={() => setActiveTab("overview")}
          className={`py-3 px-4 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors relative ${
            activeTab === "overview"
              ? "border-b-2 border-emerald-600 text-emerald-600"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Calendar className="w-4 h-4" />
          {t('admin.tabs.calendar')}
          {allJobs.some(j => j.job_lifecycle_status === 'pending_quote') && (
            <span className="absolute top-2 right-0 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("applications")}
          className={`py-3 px-4 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors relative ${
            activeTab === "applications"
              ? "border-b-2 border-emerald-600 text-emerald-600"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          {t('admin.tabs.applications') || "Applications"}
          {pendingApplications.length > 0 && (
            <span className="absolute top-2 right-0 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("cleaners")}
          className={`py-3 px-4 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === "cleaners"
              ? "border-b-2 border-emerald-600 text-emerald-600"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Users className="w-4 h-4" />
          {t('admin.tabs.cleaners')}
        </button>
        <button
          onClick={() => setActiveTab("properties")}
          className={`py-3 px-4 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors relative ${
            activeTab === "properties"
              ? "border-b-2 border-emerald-600 text-emerald-600"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Home className="w-4 h-4" />
          {t('admin.tabs.properties')}
          {allProperties.some(p => !lastSeen['properties'] || p.created_at > lastSeen['properties']) && (
            <span className="absolute top-2 right-0 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`py-3 px-4 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors relative ${
            activeTab === "payments"
              ? "border-b-2 border-emerald-600 text-emerald-600"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Briefcase className="w-4 h-4" />
          {t('admin.tabs.payments')}
          {allJobs.some(j => j.job_lifecycle_status === 'completed' && (!j.paid || !j.cleaner_paid)) && (
            <span className="absolute top-2 right-0 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("invoices")}
          className={`py-3 px-4 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors relative ${
            activeTab === "invoices"
              ? "border-b-2 border-emerald-600 text-emerald-600"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Invoices
          {allJobs.some(j => j.job_lifecycle_status === 'pending_invoice') && (
            <span className="absolute top-2 right-0 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`py-3 px-4 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors relative ${
            activeTab === "history"
              ? "border-b-2 border-emerald-600 text-emerald-600"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <History className="w-4 h-4" />
          History
        </button>
        <button
          onClick={() => setActiveTab("quotes")}
          className={`py-3 px-4 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors relative ${
            activeTab === "quotes"
              ? "border-b-2 border-emerald-600 text-emerald-600"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <FileText className="w-4 h-4" />
          {t('admin.quote_requests') || "Quotes"}
          {allJobs.some(j => j.job_lifecycle_status === 'pending_quote') && (
            <span className="absolute top-2 right-0 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("feedback")}
          className={`py-3 px-4 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors relative ${
            activeTab === "feedback"
              ? "border-b-2 border-emerald-600 text-emerald-600"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          {t('admin.tabs.feedback') || "Reports"}
          {feedback.some(f => f.status === 'pending') && (
            <span className="absolute top-2 right-0 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          )}
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-fit">
              <div className="p-6 border-b border-slate-200 bg-emerald-50 flex items-center justify-between">
                <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-emerald-600" />
                  {t('admin.pending_applications') || "Pending Applications"}
                </h2>
                {pendingApplications.length > 0 && (
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg">
                    {pendingApplications.length}
                  </span>
                )}
              </div>
              <div className="p-6">
                {pendingApplications.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    {t('admin.no_pending_applications') || "No pending applications."}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingApplications.slice(0, 3).map(cleaner => (
                      <div key={cleaner.id} className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 overflow-hidden">
                            {cleaner.profile_picture ? (
                              <img src={cleaner.profile_picture} alt={cleaner.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Users className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">
                              {cleaner.full_name || cleaner.contact_email}
                            </p>
                            <p className="text-xs text-slate-500">{cleaner.contact_email}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setActiveTab("applications")}
                          className="text-xs font-bold text-emerald-600 hover:underline"
                        >
                          Review
                        </button>
                      </div>
                    ))}
                    {pendingApplications.length > 3 && (
                      <button 
                        onClick={() => setActiveTab("applications")}
                        className="w-full py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
                      >
                        View all {pendingApplications.length} applications
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  {t('admin.upcoming_events')}
                </h2>
                <div className="flex items-center gap-4">
                  <button onClick={prevMonth} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <span className="font-bold text-slate-900 min-w-[120px] text-center">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </span>
                  <button onClick={nextMonth} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-x-auto">
                <div className="min-w-[600px]">
                  <div className="grid grid-cols-7 gap-2 mb-2">
                    {[
                      t('common.sun'), t('common.mon'), t('common.tue'), t('common.wed'),
                      t('common.thu'), t('common.fri'), t('common.sat')
                    ].map(day => (
                      <div key={day} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {blanks.map(blank => (
                      <div key={`blank-${blank}`} className="aspect-square rounded-xl bg-slate-50/50 border border-slate-100"></div>
                    ))}
                    {days.map(day => {
                      const dateStr = new window.Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
                      const dayJobs = allJobs.filter(j => 
                        (j.specific_date && j.specific_date.startsWith(dateStr)) || 
                        (!j.specific_date && j.scheduled_date && j.scheduled_date.startsWith(dateStr))
                      );
                      const isToday = new window.Date().toISOString().split('T')[0] === dateStr;
                      
                      return (
                        <div key={day} className={`aspect-square rounded-xl border p-2 flex flex-col ${isToday ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                          <div className={`text-sm font-bold mb-1 ${isToday ? 'text-emerald-700' : 'text-slate-700'}`}>
                            {day}
                          </div>
                          <div className="flex-1 overflow-y-auto space-y-1 no-scrollbar">
                            {dayJobs.map(job => (
                              <div key={job.id} className={`text-[10px] p-1.5 rounded font-medium truncate border ${
                                job.job_lifecycle_status === 'completed' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                                job.job_lifecycle_status === 'claimed_scheduled' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                <div className="font-bold mb-0.5">{job.address || t('admin.no_address')} {job.subscription_id && <RefreshCw className="w-2 h-2 inline ml-1" />}</div>
                                <div>{job.cleaner_email ? (job.cleaner_full_name || job.cleaner_email.split('@')[0]) : t('admin.no_one_assigned')}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-slate-600" />
                  {t('admin.all_bookings')}
                </h2>
                <p className="text-sm text-slate-500 mt-1">{t('admin.what_to_do')}</p>
                <div className="flex gap-2 mt-4">
                  {(['all', 'past', 'future'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setJobFilterTab(tab)}
                      className={`px-3 py-1 text-xs font-bold rounded-full capitalize ${jobFilterTab === tab ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
                {allJobs.filter(job => {
                  const jobDate = new Date(job.scheduled_date);
                  const now = new Date();
                  if (jobFilterTab === 'past') return jobDate < now;
                  if (jobFilterTab === 'future') return jobDate >= now;
                  return true;
                }).length === 0 ? (
                  <div className="text-center py-8 text-slate-500">{t('admin.no_bookings')}</div>
                ) : (
                  allJobs.filter(job => {
                    const jobDate = new Date(job.scheduled_date);
                    const now = new Date();
                    if (jobFilterTab === 'past') return jobDate < now;
                    if (jobFilterTab === 'future') return jobDate >= now;
                    return true;
                  }).map(job => (
                    <div key={job.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-slate-900">
                          ${(job.final_transaction_price || 0).toFixed(2)}
                          {job.cleaner_payout != null && (
                            <span className="text-sm font-normal text-emerald-600 ml-2">
                              ({t('cleaner_dashboard.payout')}: ${Number(job.cleaner_payout).toFixed(2)})
                            </span>
                          )}
                          <button
                            onClick={() => {
                              setEditingJobId(job.id);
                              setTempJobData({
                                final_transaction_price: job.final_transaction_price,
                                final_cleaner_payout: job.final_cleaner_payout,
                                custom_bonus: job.custom_bonus
                              });
                            }}
                            className="ml-2 text-xs text-indigo-600 hover:underline"
                          >
                            Modify
                          </button>
                          {editingJobId === job.id && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                              <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm">
                                <h3 className="font-bold text-lg mb-4">Modify Booking</h3>
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-xs font-medium text-slate-700">Total Price</label>
                                    <input type="number" value={tempJobData.final_transaction_price || 0} onChange={(e) => setTempJobData({...tempJobData, final_transaction_price: parseFloat(e.target.value)})} className="w-full border rounded p-2" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-700">Cleaner Payout</label>
                                    <input type="number" value={tempJobData.final_cleaner_payout || 0} onChange={(e) => setTempJobData({...tempJobData, final_cleaner_payout: parseFloat(e.target.value)})} className="w-full border rounded p-2" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-slate-700">5-Star Bonus</label>
                                    <input type="number" value={tempJobData.custom_bonus || 0} onChange={(e) => setTempJobData({...tempJobData, custom_bonus: parseFloat(e.target.value)})} className="w-full border rounded p-2" />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-6">
                                  <button onClick={() => setEditingJobId(null)} className="px-4 py-2 text-slate-600">Cancel</button>
                                  <button onClick={() => handleUpdateAllJobData(job.id)} className="px-4 py-2 bg-indigo-600 text-white rounded">Save</button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                          {editingDateId === job.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="datetime-local"
                                value={tempScheduledDate}
                                onChange={(e) => setTempScheduledDate(e.target.value)}
                                className="text-xs border rounded p-1"
                              />
                              <button onClick={() => handleUpdateJobDate(job.id, tempScheduledDate)} className="text-emerald-600 font-bold">Save</button>
                              <button onClick={() => setEditingDateId(null)} className="text-slate-500">Cancel</button>
                            </div>
                          ) : (
                            <>
                              {job.specific_date ? (
                                <span className="font-bold text-emerald-600">
                                  {t('admin.confirmed')} {formatDateTime(new window.Date(job.specific_date), { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              ) : (
                                <>
                                  {formatDateTime(new window.Date(job.scheduled_date), { dateStyle: 'short', timeStyle: 'short' })}
                                  {job.scheduled_end_date && (
                                    <>
                                      <span className="mx-1">-</span>
                                      {formatDateTime(new window.Date(job.scheduled_end_date), { dateStyle: 'short', timeStyle: 'short' })}
                                    </>
                                  )}
                                  <button
                                    onClick={() => {
                                      setEditingDateId(job.id);
                                      setTempScheduledDate(job.scheduled_date.slice(0, 16));
                                    }}
                                    className="ml-2 text-indigo-600 hover:underline"
                                  >
                                    Edit
                                  </button>
                                  {(() => {
                                    try {
                                      const instructions = JSON.parse(job.special_instructions);
                                      if (instructions && instructions.original_scheduled_date) {
                                        return (
                                          <div className="text-[10px] text-slate-400 mt-1">
                                            Original: {formatDateTime(new window.Date(instructions.original_scheduled_date), { dateStyle: 'short', timeStyle: 'short' })}
                                          </div>
                                        );
                                      }
                                    } catch (e) {
                                      return null;
                                    }
                                    return null;
                                  })()}
                                </>
                              )}
                              <div className="mt-2">
                                <button
                                  onClick={() => handleToggleCompleted(job.id)}
                                  className={`text-xs font-bold px-2 py-1 rounded ${job.job_lifecycle_status === 'completed' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}
                                >
                                  {job.job_lifecycle_status === 'completed' ? 'Mark as Not Done' : 'Mark as Done'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-slate-600 mb-2">
                        <span className="font-medium text-slate-900">{t('admin.homeowner')}</span> {job.homeowner_email}
                        <button
                          onClick={() => {
                            setViewingNotesCustomerId(job.homeowner_id);
                            setViewingNotesCustomerName(job.homeowner_email);
                          }}
                          className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded transition-colors"
                        >
                          <MessageSquare className="w-3 h-3" />
                          {t('admin.notes')}
                        </button>
                      </div>
                      <div className="text-sm text-slate-600 mb-2">
                        <span className="font-medium text-slate-900">{t('admin.address')}</span> {job.address || 'N/A'}
                      </div>
                      <div className="text-sm text-slate-600 mb-3 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-slate-900">{t('admin.cleaner')}</span> {job.cleaner_email || <span className="text-amber-600 italic">{t('admin.no_cleaner_assigned')}</span>}
                        </div>
                        {job.cleaner_id && (
                          <button
                            onClick={() => handleRemoveCleaner(job.id)}
                            className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline"
                          >
                            {t('admin.remove_cleaner') || "Remove"}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                            job.job_lifecycle_status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                            job.job_lifecycle_status === 'claimed_scheduled' ? 'bg-blue-100 text-blue-700' :
                            job.job_lifecycle_status === 'cancelled' ? 'bg-slate-100 text-slate-500' :
                            job.job_lifecycle_status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {job.job_lifecycle_status.replace('_', ' ')}
                          </span>
                          {job.job_lifecycle_status === 'pending_quote' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveQuote(job.id)}
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 transition-colors"
                              >
                                Approve Quote
                              </button>
                              <button
                                onClick={() => handleRejectQuote(job.id)}
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-red-600 text-white rounded hover:bg-red-500 transition-colors"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          {job.job_lifecycle_status === 'completed' && (
                            <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                              job.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {job.paid ? t('dashboard.paid') : t('admin.payment_needed')}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500">
                          {job.square_feet} {t('admin.sqft')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "applications" && (
        <div className="space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-emerald-50">
              <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-600" />
                {t('admin.tabs.applications') || "New Cleaner Applications"}
              </h2>
              <p className="text-sm text-emerald-700 mt-1">{t('admin.applications_subtitle') || "Review and approve new cleaner sign-ups"}</p>
            </div>
            <div className="p-6">
              {pendingApplications.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  {t('admin.no_pending_applications') || "No pending applications to review."}
                </div>
              ) : (
                <div className="space-y-6">
                  {pendingApplications.map(cleaner => (
                    <div key={cleaner.id} className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all">
                      <div className="flex flex-col md:flex-row justify-between gap-6">
                        <div className="flex-1 space-y-4">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 overflow-hidden">
                              {cleaner.profile_picture ? (
                                <img src={cleaner.profile_picture} alt={cleaner.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <Users className="w-6 h-6" />
                              )}
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-slate-900">
                                {cleaner.full_name || cleaner.contact_email}
                              </h3>
                              <p className="text-slate-500">{cleaner.contact_email}</p>
                              {cleaner.phone_number && <p className="text-sm text-slate-400 mt-1">{cleaner.phone_number}</p>}
                            </div>
                          </div>
                          
                          {cleaner.bio && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{t('admin.experience_bio') || "Experience & Bio"}</h4>
                              <p className="text-slate-700 leading-relaxed">{cleaner.bio}</p>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-4 text-sm">
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Calendar className="w-4 h-4" />
                              {t('admin.applied_on') || "Applied on"}: {cleaner.created_at ? formatDate(new window.Date(cleaner.created_at)) : "N/A"}
                            </div>
                            {cleaner.cv && (
                              <a 
                                href={cleaner.cv} 
                                download={`${cleaner.full_name}_CV.pdf`}
                                className="flex items-center gap-1.5 text-emerald-600 font-bold hover:text-emerald-500 transition-colors"
                              >
                                <FileText className="w-4 h-4" />
                                {t('admin.view_cv') || "View CV"}
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-row md:flex-col gap-3 justify-end">
                          {successIds.has(cleaner.id) ? (
                            <div className="flex-1 md:flex-none px-6 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-300">
                              <ShieldCheck className="w-5 h-5" />
                              {t('admin.approved') || "Approved"}
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleApprove(cleaner.id)}
                                disabled={processingIds.has(cleaner.id)}
                                className={`flex-1 md:flex-none px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 ${processingIds.has(cleaner.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                {processingIds.has(cleaner.id) ? (
                                  <RefreshCw className="w-5 h-5 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-5 h-5" />
                                )}
                                {t('admin.approve_application') || "Approve Application"}
                              </button>
                              <button
                                onClick={() => handleRejectCleaner(cleaner.id)}
                                disabled={processingIds.has(cleaner.id)}
                                className="flex-1 md:flex-none px-6 py-3 bg-white text-red-600 border border-red-100 rounded-xl font-bold hover:bg-red-50 transition-all disabled:opacity-50"
                              >
                                {t('admin.reject') || "Reject"}
                              </button>
                              <button
                                onClick={() => handleDeleteCleaner(cleaner.id)}
                                disabled={processingIds.has(cleaner.id)}
                                className="flex-1 md:flex-none px-6 py-3 bg-white text-red-600 border border-red-100 rounded-xl font-bold hover:bg-red-50 transition-all disabled:opacity-50"
                              >
                                Deactivate
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-600" />
                {t('admin.application_history') || "Application History"}
              </h2>
              <p className="text-sm text-slate-500 mt-1">{t('admin.history_subtitle') || "History of all cleaner applications"}</p>
            </div>
            <div className="p-6">
              {applicationHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  {t('admin.no_history') || "No applications in the past week."}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t('register.name')}</th>
                        <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Contact Info</th>
                        <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t('admin.applied_on')}</th>
                        <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{t('admin.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applicationHistory.map(app => (
                        <tr key={app.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${app.is_deleted ? 'opacity-50' : ''}`}>
                          <td className="py-4 px-4 font-medium text-slate-900">{app.full_name}</td>
                          <td className="py-4 px-4">
                            <div className="text-sm text-slate-600">{app.contact_email}</div>
                            {app.phone_number && <div className="text-xs text-slate-400">{app.phone_number}</div>}
                          </td>
                          <td className="py-4 px-4 text-slate-500">{formatDate(new window.Date(app.created_at))}</td>
                          <td className="py-4 px-4">
                            {app.is_deleted ? (
                              <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-200 text-slate-600">
                                Removed
                              </span>
                            ) : (
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                app.is_approved === 1 ? 'bg-emerald-100 text-emerald-700' : 
                                app.is_approved === 2 ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {app.is_approved === 1 ? t('admin.approved') : 
                                 app.is_approved === 2 ? t('admin.rejected') || "Rejected" :
                                 t('admin.pending')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "cleaners" && (
        <div className="grid grid-cols-1 gap-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-600" />
                {t('admin.tabs.cleaners')}
              </h2>
              <p className="text-sm text-slate-500 mt-1">{t('admin.cleaners_ratings_subtitle')}</p>
            </div>
            <div className="p-6">
              {cleaners.filter(c => c.is_approved === 1).length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  {t('admin.no_cleaners')}
                </div>
              ) : (
                <div className="space-y-4">
                  {cleaners.filter(c => c.is_approved === 1).map(cleaner => (
                    <div key={cleaner.id} className="flex flex-col p-4 rounded-xl border border-slate-200 bg-white shadow-sm gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 overflow-hidden shrink-0">
                            {cleaner.profile_picture ? (
                              <img src={cleaner.profile_picture} alt={cleaner.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Users className="w-8 h-8" />
                            )}
                          </div>
                          <div className="space-y-2">
                            <div>
                              <div className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                {cleaner.full_name || cleaner.contact_email}
                              </div>
                              <div className="text-sm text-slate-500">{cleaner.contact_email}</div>
                              {cleaner.phone_number && (
                                <div className="text-sm text-slate-500">{cleaner.phone_number}</div>
                              )}
                            </div>
                            
                            {cleaner.bio && (
                              <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2">
                                <span className="font-medium block mb-1">{t('admin.about_experience')}</span>
                                {cleaner.bio}
                              </div>
                            )}

                            <div className="flex items-center gap-4 mt-2">
                              <div className="text-sm text-slate-500">
                                {t('admin.status')}: {cleaner.is_approved ? (
                                  <span className="text-emerald-600 font-medium">{t('admin.approved')}</span>
                                ) : (
                                  <span className="text-amber-600 font-medium">{t('admin.pending')}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-sm text-slate-600" title={t('admin.rating_title')}>
                                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                <span className="font-medium">{cleaner.averageRating ? Number(cleaner.averageRating).toFixed(1) : "N/A"}</span>
                                <span className="text-slate-400">({cleaner.totalReviews} {t('admin.reviews')})</span>
                              </div>
                              <div className="flex items-center gap-1 text-sm text-indigo-600 font-medium">
                                <Briefcase className="w-4 h-4" />
                                {t('admin.level')} {cleaner.level || t('admin.starter')} ({cleaner.split || 40}%)
                              </div>
                              {cleaner.abandoned_count > 0 && (
                                <div className="flex items-center gap-1 text-sm text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">
                                  <AlertTriangle className="w-4 h-4" />
                                  {cleaner.abandoned_count} {t('admin.abandoned')}
                                </div>
                              )}
                              <div className="text-sm text-slate-500">
                                {cleaner.totalJobs || 0} {t('admin.jobs')}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {successIds.has(cleaner.id) ? (
                            <div className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium flex items-center gap-2 whitespace-nowrap self-start">
                              <ShieldCheck className="w-4 h-4" />
                              {t('admin.approved')}
                            </div>
                          ) : (
                            <>
                              {!cleaner.is_approved && (
                                <button
                                  onClick={() => handleApprove(cleaner.id)}
                                  disabled={processingIds.has(cleaner.id)}
                                  className={`px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 whitespace-nowrap self-start ${processingIds.has(cleaner.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {processingIds.has(cleaner.id) ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4" />
                                  )}
                                  {t('admin.approve')}
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteCleaner(cleaner.id)}
                                disabled={processingIds.has(cleaner.id)}
                                className="px-4 py-2 bg-white text-red-600 border border-red-100 rounded-lg font-medium hover:bg-red-50 transition-colors flex items-center gap-2 whitespace-nowrap self-start disabled:opacity-50"
                              >
                                <X className="w-4 h-4" />
                                Deactivate
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-slate-600" />
                {t('admin.all_registered_users') || "All Registered Users (Debug/Management)"}
              </h2>
              <p className="text-sm text-slate-500 mt-1">View every account in the system to find "lost" applications.</p>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Name/Email</th>
                      <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Role</th>
                      <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map(u => (
                      <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 overflow-hidden shrink-0">
                              {u.profile_picture ? (
                                <img src={u.profile_picture} alt={u.full_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <Users className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{u.full_name || "No Name"}</div>
                              <div className="text-xs text-slate-500">{u.contact_email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 uppercase">
                            {u.role_designation}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            u.is_deleted ? 'bg-slate-200 text-slate-600' :
                            u.is_approved === 1 ? 'bg-emerald-100 text-emerald-700' : 
                            u.is_approved === 2 ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {u.is_deleted ? "Deleted" :
                             u.is_approved === 1 ? "Approved" : 
                             u.is_approved === 2 ? "Rejected" : 
                             "Pending"}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-2">
                            {u.is_deleted ? (
                              <button
                                onClick={() => handleRestoreUser(u.id)}
                                disabled={processingIds.has(u.id)}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all disabled:opacity-50"
                              >
                                Restore
                              </button>
                            ) : (
                              <>
                                {successIds.has(u.id) ? (
                                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" />
                                    Approved
                                  </span>
                                ) : (
                                  u.is_approved !== 1 && (
                                    <button
                                      onClick={() => handleForceApprove(u.id)}
                                      disabled={processingIds.has(u.id)}
                                      className={`text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 transition-all ${processingIds.has(u.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      {processingIds.has(u.id) ? (
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                      ) : (
                                        "Force Approve"
                                      )}
                                    </button>
                                  )
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-red-50">
              <h2 className="text-xl font-bold text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                {t('admin.bad_ratings')}
              </h2>
              <p className="text-sm text-red-700 mt-1">{t('admin.bad_ratings_subtitle')}</p>
            </div>
            <div className="p-6">
              {badRatings.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  {t('admin.no_bad_ratings')}
                </div>
              ) : (
                <div className="space-y-4">
                  {badRatings.map(rating => (
                    <div key={rating.id} className="p-4 rounded-xl border border-red-100 bg-red-50/50 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < rating.rating
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-slate-300"
                              }`}
                            />
                          ))}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatDate(new window.Date(rating.scheduled_date))}
                        </div>
                      </div>
                      
                      <div className="text-sm text-slate-700 mb-3 italic">
                        "{rating.review_comment || t('admin.no_comment')}"
                      </div>
                      
                      <div className="text-xs text-slate-500 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-red-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden border border-red-200 shrink-0">
                            {rating.cleaner_picture ? (
                              <img src={rating.cleaner_picture} alt={rating.cleaner_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Users className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-700">{rating.cleaner_name || rating.cleaner_email}</div>
                            <div className="text-[10px] uppercase tracking-wider">{t('admin.cleaner')}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden border border-red-200 shrink-0">
                            {rating.homeowner_picture ? (
                              <img src={rating.homeowner_picture} alt={rating.homeowner_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Users className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-indigo-600">{rating.homeowner_name || rating.homeowner_email}</div>
                            <div className="text-[10px] uppercase tracking-wider">{t('admin.homeowner')}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "properties" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Home className="w-5 h-5 text-slate-600" />
              {t('admin.tabs.properties')}
            </h2>
            <p className="text-sm text-slate-500 mt-1">{t('admin.properties_subtitle')}</p>
          </div>
          <div className="p-6">
            {allProperties.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                {t('admin.no_properties')}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {allProperties.map(prop => (
                  <div key={prop.id} className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 text-slate-900 font-bold mb-3">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      {prop.address || `${t('admin.property_id')}#${prop.id ? prop.id.slice(0, 8) : 'N/A'}`}
                      <button
                        onClick={() => {
                          setViewingNotesCustomerId(prop.owner_id);
                          setViewingNotesCustomerName(prop.owner_email);
                        }}
                        className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
                        title={t('admin.view_notes')}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t('admin.owner')}:</span>
                        <span className="font-medium text-slate-900 truncate ml-2" title={prop.owner_email}>{prop.owner_email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t('admin.size')}:</span>
                        <span className="font-medium text-slate-900">{prop.square_feet} {t('admin.sqft')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t('admin.beds_baths')}:</span>
                        <span className="font-medium text-slate-900">{prop.bedrooms} / {prop.bathrooms}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t('admin.living_offices')}:</span>
                        <span className="font-medium text-slate-900">{prop.living_rooms} / {prop.offices}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{t('admin.windows')}:</span>
                        <span className="font-medium text-slate-900">{prop.windows}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Floors:</span>
                        <span className="font-medium text-slate-900">{prop.floors || 1}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "payments" && (
        <div className="space-y-8">
          {/* Payments from Customers */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-amber-50">
              <h2 className="text-xl font-bold text-amber-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-600" />
                {t('admin.customer_payments') || "Payments from Customers"}
              </h2>
              <p className="text-sm text-amber-700 mt-1">{t('admin.customer_payments_subtitle') || "Jobs completed but not yet paid by the customer"}</p>
            </div>
            <div className="p-6">
              {allJobs.filter(j => j.job_lifecycle_status === 'completed' && !j.paid).length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  {t('admin.no_customer_payments') || "No pending customer payments."}
                </div>
              ) : (
                <div className="space-y-4">
                  {allJobs.filter(j => j.job_lifecycle_status === 'completed' && !j.paid).map(job => (
                    <div key={job.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                          {job.homeowner_picture ? (
                            <img src={job.homeowner_picture} alt={job.homeowner_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Users className="w-6 h-6 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-900 text-lg">${(job.final_transaction_price || 0).toFixed(2)}</span>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                              {formatDate(new window.Date(job.scheduled_date))}
                            </span>
                          </div>
                          <div className="text-sm text-slate-600">
                            {(() => {
                              const basePrice = parseFloat(job.calculated_base_price || 0);
                              const addonPrice = parseFloat(job.final_addon_price || 0);
                              const customerTotal = basePrice + addonPrice;
                              const baseCut = customerTotal * 0.45;
                              const ratingBonus = job.rating === 5 ? 15.00 : 0.00;
                              const totalPayout = baseCut + ratingBonus;
                              return `Cleaner Cut: $${baseCut.toFixed(2)} | 5-Star Bonus: $${ratingBonus.toFixed(2)} | Total Payout: $${totalPayout.toFixed(2)}`;
                            })()}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleMarkPaymentReceived(job.id)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-xs font-bold uppercase tracking-wider"
                      >
                        Mark as Received
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Subscription Adjustment Fees */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-indigo-50">
              <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-600" />
                Subscription Adjustment Fees
              </h2>
              <p className="text-sm text-indigo-700 mt-1">Early cancellation fees logged for recurring plans</p>
            </div>
            <div className="p-6">
              {allCharges.filter(c => c.status === 'pending').length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No pending adjustment fees.
                </div>
              ) : (
                <div className="space-y-4">
                  {allCharges.filter(c => c.status === 'pending').map(charge => (
                    <div key={charge.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shrink-0">
                          <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-900 text-lg">${(charge.amount || 0).toFixed(2)}</span>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                              {formatDate(new window.Date(charge.created_at))}
                            </span>
                          </div>
                          <div className="text-sm text-slate-600">
                            <span className="font-medium text-slate-900">Customer:</span> {charge.users?.full_name || charge.users?.contact_email}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 italic">
                            {charge.reason}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleMarkChargePaid(charge.id)}
                        disabled={processingIds.has(charge.id)}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {processingIds.has(charge.id) ? "Processing..." : "Mark as Paid"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Payouts to Cleaners */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-emerald-50">
              <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-600" />
                {t('admin.cleaner_payouts') || "Payouts to Cleaners"}
              </h2>
              <p className="text-sm text-emerald-700 mt-1">{t('admin.cleaner_payouts_subtitle') || "Completed jobs that need to be paid out to the cleaner"}</p>
            </div>
            <div className="p-6">
              {allJobs.filter(j => j.job_lifecycle_status === 'completed' && !j.cleaner_paid).length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  {t('admin.no_cleaner_payouts') || "No pending cleaner payouts."}
                </div>
              ) : (
                <div className="space-y-4">
                  {allJobs.filter(j => j.job_lifecycle_status === 'completed' && !j.cleaner_paid).map(job => (
                    <div key={job.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                          {job.cleaner_picture ? (
                            <img src={job.cleaner_picture} alt={job.cleaner_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Users className="w-6 h-6 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-900 text-lg">
                              ${(() => {
                                if (job.final_cleaner_payout != null) {
                                  return parseFloat(job.final_cleaner_payout).toFixed(2);
                                }
                                const basePrice = parseFloat(job.calculated_base_price || 0);
                                const addonPrice = parseFloat(job.final_addon_price || 0);
                                const customerTotal = basePrice + addonPrice;
                                const baseCut = customerTotal * 0.45;
                                const ratingBonus = job.rating === 5 ? 15.00 : 0.00;
                                return (baseCut + ratingBonus + (job.custom_bonus || 0)).toFixed(2);
                              })()}
                            </span>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                              {formatDate(new window.Date(job.scheduled_date))}
                            </span>
                          </div>
                          <div className="text-sm text-slate-600">
                            <span className="font-medium text-slate-900">{t('admin.cleaner')}:</span> {job.cleaner_name || job.cleaner_email}
                          </div>
                          <div className="text-sm text-slate-600">
                            <span className="font-medium text-slate-900">{t('admin.address')}:</span> {job.address || 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => setSelectedJobForPayout(job)}
                          className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition-colors flex items-center gap-2 whitespace-nowrap"
                        >
                          Modify Payout
                        </button>
                        <button
                          onClick={() => handlePayCleaner(job.id)}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                        >
                          <CheckCircle className="w-4 h-4" />
                          {t('admin.mark_as_paid')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "invoices" && (
        <div className="space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-emerald-50">
              <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Pending Invoices
              </h2>
              <p className="text-sm text-emerald-700 mt-1">Jobs awaiting final review and invoicing</p>
            </div>
            <div className="divide-y divide-slate-200">
              {allJobs.filter(j => j.job_lifecycle_status === 'pending_invoice').map(job => {
                const basePrice = job.calculated_base_price || 0;
                const addonPrice = job.final_addon_price || 0;
                const total = basePrice + addonPrice;

                return (
                  <div key={job.id} className="p-6 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{job.property_address}</h3>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-slate-600">Base Quote:</p>
                        {editingPriceId === job.id ? (
                          <input
                            type="number"
                            value={tempPrice}
                            onChange={(e) => setTempPrice(parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 border rounded"
                          />
                        ) : (
                          <span className="font-medium">${basePrice.toFixed(2)}</span>
                        )}
                        {editingPriceId === job.id ? (
                          <>
                            <button onClick={() => handleUpdateQuote(job.id)} className="text-xs text-emerald-600 font-bold">Save</button>
                            <button onClick={() => setEditingPriceId(null)} className="text-xs text-slate-500">Cancel</button>
                          </>
                        ) : (
                          <button onClick={() => { setEditingPriceId(job.id); setTempPrice(basePrice); }} className="text-xs text-indigo-600 font-bold">Edit</button>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">Add-ons: ${addonPrice.toFixed(2)}</p>
                      <p className="text-base font-bold text-slate-900 mt-2">
                        Invoice Total: ${total.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedJobForPhotos(job)}
                        className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        View Photos
                      </button>
                      <button
                        onClick={() => handleSendInvoice(job.id)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        Send Final Invoice
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-slate-600" />
                Past Cleanings
              </h2>
              <p className="text-sm text-slate-600 mt-1">Review details and photos of completed jobs</p>
            </div>
            <div className="divide-y divide-slate-200">
              {allJobs.filter(j => j.job_lifecycle_status === 'completed').map(job => (
                <div key={job.id} className="p-6 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{job.property_address}</h3>
                    <p className="text-sm text-slate-600">Date: {formatDate(new window.Date(job.scheduled_date))}</p>
                    <p className="text-sm text-slate-600">Cleaner: {job.cleaner_name}</p>
                    <p className="text-sm text-slate-600">Homeowner: {job.homeowner_name}</p>
                    <p className="text-sm text-slate-600">Price: ${job.final_transaction_price?.toFixed(2)}</p>
                    <p className="text-sm text-slate-600">Rating: {job.rating || 'N/A'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedJobForPhotos(job)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      View Photos
                    </button>
                    <button
                      onClick={() => setSelectedJobForBonus(job)}
                      className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                    >
                      Add Bonus
                    </button>
                    <button
                      onClick={() => setSelectedJobForPayout(job)}
                      className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      Modify Payout
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "quotes" && (
        <div className="space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-amber-50">
              <h2 className="text-xl font-bold text-amber-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                {t('admin.quote_requests') || "Pending Quote Requests"}
              </h2>
              <p className="text-sm text-amber-700 mt-1">Jobs that require manual pricing and approval</p>
            </div>
            <div className="p-6">
              {allJobs.filter(j => j.job_lifecycle_status === 'pending_quote').length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No pending quote requests.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {allJobs.filter(j => j.job_lifecycle_status === 'pending_quote').map(job => (
                    <div key={job.id} className="p-5 rounded-xl border border-amber-200 bg-amber-50/30 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="text-lg font-bold text-slate-900">${(job.final_transaction_price || 0).toFixed(2)}</div>
                          <div className="text-xs text-slate-500">{formatDate(new window.Date(job.scheduled_date))}</div>
                          <div className="mt-2">
                            <label className="text-xs font-bold text-slate-700">Price:</label>
                            <input
                              type="number"
                              className="w-20 px-2 py-1 rounded-lg border border-slate-300 text-sm ml-2"
                              value={jobPrices[job.id] || job.final_transaction_price || ''}
                              onChange={(e) => setJobPrices(prev => ({ ...prev, [job.id]: parseFloat(e.target.value) }))}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveQuote(job.id)}
                            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectQuote(job.id)}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600">{job.homeowner_email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600">{job.address || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Maximize className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600">{job.square_feet} sqft ({job.bedrooms}BR, {job.bathrooms}BA)</span>
                        </div>
                      </div>
                      {job.special_instructions && (
                        <div className="mt-4 p-3 bg-white rounded-lg border border-amber-100 text-xs text-slate-600 italic">
                          {(() => {
                            try {
                              const parsed = JSON.parse(job.special_instructions);
                              const addonMap: Record<string, string> = {
                                'interior_windows': 'Interior Windows',
                                'inside_oven': 'Inside Oven',
                                'inside_fridge': 'Inside Fridge',
                                'laundry_folding': 'Load of Laundry',
                                'finished_basement': 'Finished Basement'
                              };
                              return (
                                <div>
                                  {parsed.instructions && <p>{parsed.instructions}</p>}
                                  {(parsed.selected_addons && parsed.selected_addons.length > 0) && (
                                    <div className="mt-1">
                                      <p className="font-bold">Extras:</p>
                                      {parsed.selected_addons.map((id: string, index: number) => (
                                        <p key={`${id}-${index}`}>{addonMap[id] || id}</p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            } catch (e) {
                              return <p>"{job.special_instructions}"</p>;
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-600" />
                {t('admin.quote_history') || "Quote History"}
              </h2>
              <p className="text-sm text-slate-500 mt-1">Previous requests that have been approved or rejected</p>
            </div>
            <div className="p-6">
              {allJobs.filter(j => j.job_lifecycle_status !== 'pending_quote').length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No previous quote requests found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Customer</th>
                        <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                        <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Price</th>
                        <th className="py-4 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allJobs
                        .filter(j => j.job_lifecycle_status !== 'pending_quote')
                        .sort((a, b) => new window.Date(b.created_at).getTime() - new window.Date(a.created_at).getTime())
                        .map(job => (
                        <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="font-medium text-slate-900">{job.homeowner_name || job.homeowner_email}</div>
                            <div className="text-xs text-slate-500">{job.address}</div>
                          </td>
                          <td className="py-4 px-4 text-sm text-slate-600">
                            {formatDate(new window.Date(job.scheduled_date))}
                          </td>
                          <td className="py-4 px-4 text-sm font-bold text-slate-900">
                            ${(job.final_transaction_price || 0).toFixed(2)}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              job.job_lifecycle_status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                              job.job_lifecycle_status === 'rejected' ? 'bg-red-100 text-red-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {job.job_lifecycle_status === 'cancelled' ? 'Rejected' : 
                               job.job_lifecycle_status === 'rejected' ? 'Rejected' :
                               'Approved'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "feedback" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-slate-50">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              {t('admin.tabs.feedback') || "User Reports & Feedback"}
            </h2>
            <p className="text-sm text-slate-500 mt-1">{t('admin.feedback_subtitle') || "Review mistakes or issues reported by users across the platform"}</p>
          </div>
          <div className="p-6">
            {feedback.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                {t('admin.no_feedback') || "No reports found."}
              </div>
            ) : (
              <div className="space-y-4">
                {feedback.map(item => (
                  <div key={item.id} className={`p-6 rounded-2xl border transition-all ${
                    item.status === 'pending' ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-75'
                  }`}>
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                              item.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {item.status}
                            </span>
                            <span className="text-xs text-slate-400">
                              {formatDateTime(new window.Date(item.created_at))}
                            </span>
                          </div>
                          <div className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                            {item.page_url}
                          </div>
                        </div>
                        
                        <p className="text-slate-900 font-medium leading-relaxed">
                          {item.content}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                              {item.user_picture ? (
                                <img src={item.user_picture} alt={item.user_name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <Users className="w-3 h-3" />
                              )}
                            </div>
                            <span className="font-medium text-slate-700">{item.user_name || item.user_email || "Guest"}</span>
                            {item.user_role && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                item.user_role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                item.user_role === 'cleaner' ? 'bg-blue-100 text-blue-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {item.user_role}
                              </span>
                            )}
                          </div>
                          {item.user_email && (
                            <div className="text-slate-400">
                              {item.user_email}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {item.status === 'pending' && (
                        <div className="flex items-start">
                          <button
                            onClick={() => handleResolveFeedback(item.id)}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-500 transition-all flex items-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {t('admin.mark_resolved') || "Mark Resolved"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


      {/* Customer Notes Modal */}
      {viewingNotesCustomerId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-600" />
                {t('admin.customer_notes')}
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

      {selectedJobForBonus && (
        <BonusModal
          isOpen={!!selectedJobForBonus}
          onClose={() => setSelectedJobForBonus(null)}
          onSave={async (bonus) => {
            try {
              const res = await fetch(`/api/jobs/${selectedJobForBonus.id}/bonus`, {
                method: "POST",
                headers: { ...adminHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({ bonus }),
              });
              if (res.ok) {
                setSelectedJobForBonus(null);
                refreshAllData();
                alert("Bonus added successfully!");
              } else {
                alert("Failed to add bonus.");
              }
            } catch (err) {
              console.error(err);
              alert("Error adding bonus.");
            }
          }}
          currentBonus={selectedJobForBonus.custom_bonus || 0}
        />
      )}
      {selectedJobForPayout && (
        <PayoutModal
          isOpen={!!selectedJobForPayout}
          onClose={() => setSelectedJobForPayout(null)}
          onSave={async (payout) => {
            try {
              const res = await fetch(`/api/jobs/${selectedJobForPayout.id}/update-payout`, {
                method: "POST",
                headers: { ...adminHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({ payout }),
              });
              if (res.ok) {
                setSelectedJobForPayout(null);
                refreshAllData();
                alert("Payout modified successfully!");
              } else {
                alert("Failed to modify payout.");
              }
            } catch (err) {
              console.error(err);
              alert("Error modifying payout.");
            }
          }}
          currentPayout={selectedJobForPayout.final_cleaner_payout || selectedJobForPayout.cleaner_payout || 0}
        />
      )}
      {showRemoveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">Are you sure?</h2>
            <p className="text-sm text-slate-600 mb-4">Are you sure you want to remove this cleaner from the job?</p>
            <label className="flex items-center gap-2 mb-6 text-sm">
              <input type="checkbox" checked={addStrike} onChange={(e) => setAddStrike(e.target.checked)} />
              Add a strike to this cleaner's account?
            </label>
            <div className="flex gap-3">
              <button onClick={() => setShowRemoveModal(false)} className="flex-1 px-4 py-2 bg-slate-100 rounded-lg text-sm font-semibold hover:bg-slate-200">Cancel</button>
              <button onClick={confirmRemoveCleaner} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">Yes, Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
