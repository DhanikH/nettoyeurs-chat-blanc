import { useState, useEffect, useMemo } from "react";
import { formatDate, formatTime, formatDateTime } from "../utils/dateUtils";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Shield, CheckCircle, Users, AlertTriangle, Star, Calendar, Home, Briefcase, ChevronLeft, ChevronRight, MapPin, MessageSquare, X, DollarSign, Clock, FileText, Maximize, Layout, ExternalLink, ShieldCheck, Zap, AlertCircle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CustomerNotes } from "../components/CustomerNotes";
import { fetchCmsContent, createCmsEntry, deleteCmsEntry } from "../services/cmsService";

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const adminHeaders = {
    "x-user-id": user?.id || "",
    "x-user-role": user?.role || ""
  };
  const [activeTab, setActiveTab] = useState<"overview" | "applications" | "cleaners" | "properties" | "payments" | "feedback" | "quotes" | "content">("overview");
  const [cleaners, setCleaners] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [applicationHistory, setApplicationHistory] = useState<any[]>([]);
  const [badRatings, setBadRatings] = useState<any[]>([]);
  const [allJobs, setAllJobs] = useState<any[]>([]);
  const [allProperties, setAllProperties] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [viewingNotesCustomerId, setViewingNotesCustomerId] = useState<string | null>(null);
  const [viewingNotesCustomerName, setViewingNotesCustomerName] = useState<string>("");
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleSyncToSanity = async (cleaner: any) => {
    setSyncing(cleaner.id);
    try {
      const res = await fetch(`/api/admin/cleaners/${cleaner.id}/sync-sanity`, {
        method: "POST",
        headers: adminHeaders
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync to Sanity");
      }

      alert(`Successfully synced ${cleaner.full_name} to Sanity!`);
      fetchCleaners();
    } catch (err: any) {
      console.error("Sanity Sync Error:", err);
      alert(`Failed to sync to Sanity: ${err.message}`);
    } finally {
      setSyncing(null);
    }
  };
  
  const [lastSeen, setLastSeen] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("admin_last_seen");
    return saved ? JSON.parse(saved) : {};
  });

  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (activeTab) {
      const now = new Date().toISOString();
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
      fetchFeedback();
    }
  }, [user, loading, navigate]);

  const [refreshing, setRefreshing] = useState(false);

  const pendingApplications = useMemo(() => {
    // Start with cleaners who are pending
    const fromCleaners = cleaners.filter(c => c.is_approved === 0);
    
    // Look for any other user who is pending and might be a cleaner
    // (e.g. if they have a CV or bio or were registered as cleaner but missed by the cleaners fetch)
    const fromAllUsers = allUsers.filter(u => 
      u.is_approved === 0 && 
      (u.role_designation === 'cleaner' || u.cv || u.bio) &&
      !fromCleaners.find(c => c.id === u.id)
    );

    const merged = [...fromCleaners, ...fromAllUsers];
    
    // Sort by created_at desc
    return merged.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [cleaners, allUsers]);

  const fetchCleaners = async () => {
    console.log("[Admin] Fetching cleaners...");
    try {
      const [localCleaners, sanityCleaners] = await Promise.all([
        fetch("/api/admin/cleaners", { headers: adminHeaders }).then(r => r.ok ? r.json() : []),
        fetchCmsContent('cleaner').catch(() => [])
      ]);
      console.log("[Admin] Local cleaners fetched:", localCleaners.length);
      
      // Merge them (prefer local for auth-related things, but Sanity for profile)
      const merged = [...localCleaners];
      
      if (Array.isArray(sanityCleaners) && sanityCleaners.length > 0) {
        sanityCleaners.forEach(sc => {
          const existing = merged.find(lc => lc.contact_email === sc.email);
          if (existing) {
            existing.full_name = sc.name;
            existing.bio = sc.bio;
            existing.role_designation = sc.role;
            existing.phone_number = sc.phone || existing.phone_number;
            existing.is_from_sanity = true;
          } else {
            merged.push({
              id: sc._id,
              full_name: sc.name,
              contact_email: sc.email,
              phone_number: sc.phone || '',
              bio: sc.bio,
              role_designation: sc.role,
              is_approved: 1,
              is_from_sanity: true,
              averageRating: 5, // Default for sanity-only cleaners
              totalReviews: 0,
              totalJobs: 0,
              level: "Starter",
              split: 40
            });
          }
        });
      }
      
      const filtered = merged.filter(c => !c.is_deleted);
      console.log("[Admin] Total merged cleaners:", filtered.length);
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
      const [localApps, sanityApps] = await Promise.all([
        fetch("/api/admin/applications/history", { headers: adminHeaders }).then(r => r.ok ? r.json() : []),
        fetchCmsContent('applicant').catch(() => [])
      ]);
      console.log("[Admin] Local applications fetched:", localApps.length);
      
      const merged = [...localApps];
      if (Array.isArray(sanityApps) && sanityApps.length > 0) {
        sanityApps.forEach(sa => {
          const existing = merged.find(la => la.contact_email === sa.email);
          if (!existing) {
            merged.push({
              id: sa._id,
              full_name: sa.fullName,
              contact_email: sa.email,
              phone_number: sa.phone,
              bio: sa.bio,
              is_approved: sa.status === 'approved' ? 1 : sa.status === 'rejected' ? 2 : 0,
              created_at: new Date().toISOString(),
              is_from_sanity: true
            });
          }
        });
      }
      
      console.log("[Admin] Total merged applications:", merged.length);
      setApplicationHistory(merged);
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
        setAllJobs(data);
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
    try {
      const res = await fetch(`/api/admin/cleaners/${id}/approve`, {
        method: "POST",
        headers: adminHeaders
      });
      if (res.ok) {
        fetchCleaners();
        fetchAllUsers();
        fetchApplicationHistory();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleForceApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/approve`, {
        method: "POST",
        headers: adminHeaders
      });
      if (res.ok) {
        fetchCleaners();
        fetchAllUsers();
        fetchApplicationHistory();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectCleaner = async (id: string) => {
    if (!window.confirm("Are you sure you want to reject this application? The data will be kept for your records.")) return;
    try {
      const res = await fetch(`/api/admin/cleaners/${id}/reject`, {
        method: "POST",
        headers: adminHeaders
      });
      if (res.ok) {
        fetchCleaners();
        fetchApplicationHistory();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestoreUser = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/restore`, {
        method: "POST",
        headers: adminHeaders
      });
      if (res.ok) {
        fetchCleaners();
        fetchAllUsers();
        fetchApplicationHistory();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveQuote = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/jobs/${id}/approve-quote`, {
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

  const handleRejectQuote = async (id: string) => {
    if (!window.confirm("Are you sure you want to reject this quote request?")) return;
    try {
      const res = await fetch(`/api/admin/jobs/${id}/reject-quote`, {
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

  const [cmsStatus, setCmsStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [sanityData, setSanityData] = useState<any[]>([]);
  const [loadingSanity, setLoadingSanity] = useState(false);

  const fetchSanityData = async () => {
    setLoadingSanity(true);
    try {
      const data = await fetchCmsContent('cleaner');
      setSanityData(data);
    } catch (err) {
      console.error("Error fetching Sanity data:", err);
    } finally {
      setLoadingSanity(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'content') {
      fetchSanityData();
    }
  }, [activeTab]);
  const [cmsError, setCmsError] = useState<string | null>(null);
  const [deletingSanityId, setDeletingSanityId] = useState<string | null>(null);

  const handleDeleteSanityEntry = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" from Sanity?`)) return;
    
    setDeletingSanityId(id);
    try {
      await deleteCmsEntry(id);
      fetchSanityData();
    } catch (err) {
      console.error("Error deleting Sanity entry:", err);
      alert("Failed to delete from Sanity.");
    } finally {
      setDeletingSanityId(null);
    }
  };

  const testCmsConnection = async () => {
    setCmsStatus('testing');
    setCmsError(null);
    try {
      const result = await fetchCmsContent('testimonial');
      if (result) {
        setCmsStatus('success');
      } else {
        throw new Error('No response from Sanity');
      }
    } catch (err: any) {
      setCmsStatus('error');
      setCmsError(err.message || 'Connection failed');
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
    if (!window.confirm(`Are you sure you want to deactivate ${cleaner?.full_name || 'this cleaner'}? The information will stay in the database but the user will no longer be able to log in.`)) return;
    
    try {
      // 1. Delete locally (soft delete)
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: adminHeaders
      });

      if (res.ok) {
        // 2. Try to delete from Sanity if it was synced
        try {
          await fetch(`/api/admin/cleaners/${cleaner?.contact_email}/sync-sanity`, {
            method: "DELETE",
            headers: adminHeaders
          });
          console.log("Deleted from Sanity successfully");
        } catch (sanityErr) {
          console.warn("Could not delete from Sanity:", sanityErr);
        }

        fetchCleaners();
        fetchAllUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user || user.role !== "admin") return null;

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

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
        <button
          onClick={() => setActiveTab("content")}
          className={`py-3 px-4 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors relative ${
            activeTab === "content"
              ? "border-b-2 border-emerald-600 text-emerald-600"
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Layout className="w-4 h-4" />
          {t('admin.tabs.content') || "Content (CMS)"}
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
                              {cleaner.is_from_sanity && (
                                <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] rounded-md font-medium">Sanity</span>
                              )}
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
                      const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
                      const dayJobs = allJobs.filter(j => 
                        (j.specific_date && j.specific_date.startsWith(dateStr)) || 
                        (!j.specific_date && j.scheduled_date && j.scheduled_date.startsWith(dateStr))
                      );
                      const isToday = new Date().toISOString().split('T')[0] === dateStr;
                      
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
                                <div className="font-bold mb-0.5">{job.address || t('admin.no_address')}</div>
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
              </div>
              <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
                {allJobs.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">{t('admin.no_bookings')}</div>
                ) : (
                  allJobs.map(job => (
                    <div key={job.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-slate-900">
                          ${(job.final_transaction_price || 0).toFixed(2)}
                          {job.cleaner_payout != null && (
                            <span className="text-sm font-normal text-emerald-600 ml-2">
                              ({t('cleaner_dashboard.payout')}: ${Number(job.cleaner_payout).toFixed(2)})
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                          {job.specific_date ? (
                            <span className="font-bold text-emerald-600">
                              {t('admin.confirmed')} {formatDate(new Date(job.specific_date))}
                            </span>
                          ) : (
                            <>
                              {formatDate(new Date(job.scheduled_date))}
                              {job.scheduled_end_date && (
                                <>
                                  <span className="mx-1">-</span>
                                  {formatDate(new Date(job.scheduled_end_date))}
                                </>
                              )}
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
                      <div className="text-sm text-slate-600 mb-3">
                        <span className="font-medium text-slate-900">{t('admin.cleaner')}</span> {job.cleaner_email || <span className="text-amber-600 italic">{t('admin.no_cleaner_assigned')}</span>}
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
                                {cleaner.is_from_sanity && (
                                  <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-600 text-xs rounded-full font-medium">Sanity</span>
                                )}
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
                              {t('admin.applied_on') || "Applied on"}: {cleaner.created_at ? formatDate(new Date(cleaner.created_at)) : "N/A"}
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
                          <button
                            onClick={() => handleApprove(cleaner.id)}
                            className="flex-1 md:flex-none px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-5 h-5" />
                            {t('admin.approve_application') || "Approve Application"}
                          </button>
                          <button
                            onClick={() => handleRejectCleaner(cleaner.id)}
                            className="flex-1 md:flex-none px-6 py-3 bg-white text-red-600 border border-red-100 rounded-xl font-bold hover:bg-red-50 transition-all"
                          >
                            {t('admin.reject') || "Reject"}
                          </button>
                          <button
                            onClick={() => handleDeleteCleaner(cleaner.id)}
                            className="flex-1 md:flex-none px-6 py-3 bg-white text-red-600 border border-red-100 rounded-xl font-bold hover:bg-red-50 transition-all"
                          >
                            Deactivate
                          </button>

                          {!cleaner.is_from_sanity && (
                            <button
                              onClick={() => handleSyncToSanity(cleaner)}
                              disabled={syncing === cleaner.id}
                              className="flex-1 md:flex-none px-6 py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-bold hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              <RefreshCw className={`w-5 h-5 ${syncing === cleaner.id ? 'animate-spin' : ''}`} />
                              {syncing === cleaner.id ? "Syncing..." : "Sync to Sanity"}
                            </button>
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
                          <td className="py-4 px-4 text-slate-500">{formatDate(new Date(app.created_at))}</td>
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
                                {cleaner.is_from_sanity && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-semibold border border-emerald-200">
                                    <ShieldCheck className="w-3 h-3" />
                                    Safe & Stored
                                  </span>
                                )}
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
                          {!cleaner.is_approved && (
                            <button
                              onClick={() => handleApprove(cleaner.id)}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 whitespace-nowrap self-start"
                            >
                              <CheckCircle className="w-4 h-4" />
                              {t('admin.approve')}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteCleaner(cleaner.id)}
                            className="px-4 py-2 bg-white text-red-600 border border-red-100 rounded-lg font-medium hover:bg-red-50 transition-colors flex items-center gap-2 whitespace-nowrap self-start"
                          >
                            <X className="w-4 h-4" />
                            Deactivate
                          </button>

                          {!cleaner.is_from_sanity && (
                            <button
                              onClick={() => handleSyncToSanity(cleaner)}
                              disabled={syncing === cleaner.id}
                              className="px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg font-medium hover:bg-indigo-100 transition-colors flex items-center gap-2 whitespace-nowrap self-start disabled:opacity-50"
                            >
                              <RefreshCw className={`w-4 h-4 ${syncing === cleaner.id ? 'animate-spin' : ''}`} />
                              {syncing === cleaner.id ? "Syncing..." : "Sync to Sanity"}
                            </button>
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
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 transition-all"
                              >
                                Restore
                              </button>
                            ) : (
                              u.is_approved !== 1 && (
                                <button
                                  onClick={() => handleForceApprove(u.id)}
                                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 transition-all"
                                >
                                  Force Approve
                                </button>
                              )
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
                          {formatDate(new Date(rating.scheduled_date))}
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
                      {t('admin.property_id')}#{prop.id ? prop.id.slice(0, 8) : 'N/A'}
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
                              {formatDate(new Date(job.scheduled_date))}
                            </span>
                          </div>
                          <div className="text-sm text-slate-600">
                            <span className="font-medium text-slate-900">{t('admin.homeowner')}:</span> {job.homeowner_name || job.homeowner_email}
                          </div>
                          <div className="text-sm text-slate-600">
                            <span className="font-medium text-slate-900">{t('admin.address')}:</span> {job.address || 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg font-bold text-xs uppercase tracking-wider">
                        {t('admin.waiting_for_customer') || "Waiting for Customer"}
                      </div>
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
                            <span className="font-bold text-slate-900 text-lg">${job.cleaner_payout ? job.cleaner_payout.toFixed(2) : '0.00'}</span>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                              {formatDate(new Date(job.scheduled_date))}
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
                      <button
                        onClick={() => handlePayCleaner(job.id)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {t('admin.mark_as_paid')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                          <div className="text-xs text-slate-500">{formatDate(new Date(job.scheduled_date))}</div>
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
                          "{job.special_instructions}"
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
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map(job => (
                        <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="font-medium text-slate-900">{job.homeowner_name || job.homeowner_email}</div>
                            <div className="text-xs text-slate-500">{job.address}</div>
                          </td>
                          <td className="py-4 px-4 text-sm text-slate-600">
                            {formatDate(new Date(job.scheduled_date))}
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
                              {formatDateTime(new Date(item.created_at))}
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

      {activeTab === "content" && (
        <div className="space-y-8">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-200 bg-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-indigo-900 flex items-center gap-3">
                    <Layout className="w-6 h-6 text-indigo-600" />
                    {t('admin.cms_management') || "CMS Management (Sanity.io)"}
                  </h2>
                  <p className="text-indigo-700 mt-2">Manage your website content through a professional third-party CMS.</p>
                </div>
                <a 
                  href="https://www.sanity.io/manage" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Sanity Studio
                </a>
              </div>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      Configuration Status
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                        <span className="text-sm text-slate-600">Project ID</span>
                        <span className={`text-xs font-mono px-2 py-1 rounded ${import.meta.env.VITE_SANITY_PROJECT_ID ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {import.meta.env.VITE_SANITY_PROJECT_ID ? 'Configured' : 'Missing'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                        <span className="text-sm text-slate-600">Dataset</span>
                        <span className="text-xs font-mono px-2 py-1 bg-blue-100 text-blue-700 rounded">
                          {import.meta.env.VITE_SANITY_DATASET || 'production'}
                        </span>
                      </div>
                      {import.meta.env.VITE_SANITY_ORGANIZATION_ID && (
                        <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                          <span className="text-sm text-slate-600">Org ID</span>
                          <span className="text-xs font-mono px-2 py-1 bg-slate-100 text-slate-700 rounded">
                            {import.meta.env.VITE_SANITY_ORGANIZATION_ID}
                          </span>
                        </div>
                      )}
                      <button
                        onClick={testCmsConnection}
                        disabled={cmsStatus === 'testing'}
                        className={`w-full mt-4 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                          cmsStatus === 'success' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                          cmsStatus === 'error' ? 'bg-red-100 text-red-700 border border-red-200' :
                          'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                        }`}
                      >
                        {cmsStatus === 'testing' ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Testing...
                          </>
                        ) : cmsStatus === 'success' ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Connection Successful!
                          </>
                        ) : cmsStatus === 'error' ? (
                          <>
                            <AlertCircle className="w-4 h-4" />
                            Connection Failed
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            Test Connection
                          </>
                        )}
                      </button>
                      {cmsError && (
                        <p className="mt-2 text-xs text-red-600 text-center">{cmsError}</p>
                      )}
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100">
                    <h3 className="text-lg font-bold text-amber-900 mb-2">How it works</h3>
                    <p className="text-sm text-amber-800 leading-relaxed">
                      We use <strong>Sanity.io</strong> as a Headless CMS. This allows you to edit text, images, and testimonials without touching the code. 
                      Changes made in Sanity will reflect on the website in real-time.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600" />
                        Sanity Explorer
                      </h3>
                      <button 
                        onClick={fetchSanityData}
                        className="p-2 text-slate-500 hover:text-indigo-600 transition-colors"
                        title="Refresh Data"
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingSanity ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                      {loadingSanity ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                          <p className="text-sm">Fetching data from Content Lake...</p>
                        </div>
                      ) : sanityData.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
                          No data found in Sanity. Try syncing a cleaner first.
                        </div>
                      ) : (
                        sanityData.map((item: any) => (
                          <div key={item._id} className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-all group/item">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900">{item.name}</span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  ID: {item._id ? item._id.substring(0, 12) : 'N/A'}...
                                </span>
                              </div>
                              <button
                                onClick={() => handleDeleteSanityEntry(item._id, item.name)}
                                disabled={deletingSanityId === item._id}
                                className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover/item:opacity-100 disabled:opacity-50"
                                title="Delete from Sanity"
                              >
                                {deletingSanityId === item._id ? (
                                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                  <X className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs text-slate-500 truncate">
                                <span className="font-medium text-slate-700">Email:</span> {item.email}
                              </div>
                              <div className="text-xs text-slate-500">
                                <span className="font-medium text-slate-700">Role:</span> {item.role}
                              </div>
                              {item.bio && (
                                <div className="text-xs text-slate-500 line-clamp-2 italic mt-2 border-l-2 border-slate-200 pl-2">
                                  "{item.bio}"
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
            </div>
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
    </div>
  );
}
