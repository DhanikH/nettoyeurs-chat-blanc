import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { User, Settings as SettingsIcon, Trash2, Save, Bell, Shield, Heart, AlertTriangle, Clock, Camera, X, FileText, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { TermsModal } from "../components/TermsModal";

import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { PaymentMethodForm } from '../components/PaymentMethodForm';
import { PaymentMethodList } from '../components/PaymentMethodList';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

export default function Settings() {
  const { user, loading, logout, login } = useAuth();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    full_name: "",
    phone_number: "",
    bio: "",
    profile_picture: "" as string | null,
    cv: "" as string | null,
    preferences: {
      notifications: true,
      email_notifications: true,
      sms_notifications: false,
      marketing: false,
      entry_instructions: "",
      languages: "",
      preferred_language: "English"
    }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
      return;
    }
    if (user) {
      fetchUserData();
      if (searchParams.get('addCard') === 'true') {
        initPaymentSetup();
      }
    }
  }, [user, loading, navigate, searchParams]);

  const initPaymentSetup = async () => {
    try {
      const res = await fetch('/api/create-setup-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeowner_id: user?.id, userId: user?.id }),
      });
      const data = await res.json();
      if (data.error) {
        setMessage({ type: 'error', text: data.error });
      } else if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      } else {
        setMessage({ type: 'error', text: 'Failed to initialize payment setup.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'An error occurred while initializing payment setup.' });
    }
  };

  const fetchUserData = async () => {
    try {
      const res = await fetch(`/api/users/${user?.id}`, {
        headers: {
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || ""
        }
      });
      if (res.ok) {
        const data = await res.json();
        
    // Parse address if it was stored as a combined string
        
        setFormData({
          full_name: data.full_name || "",
          phone_number: data.phone_number || "",
          bio: data.bio || "",
          profile_picture: data.profile_picture || null,
          cv: data.cv || null,
          preferences: data.preferences ? (() => {
            try {
              return JSON.parse(data.preferences);
            } catch (e) {
              console.error("Error parsing preferences:", e);
              return formData.preferences;
            }
          })() : formData.preferences
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/users/${user?.id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || ""
        },
        body: JSON.stringify({
          full_name: formData.full_name,
          phone_number: formData.phone_number,
          bio: formData.bio,
          profile_picture: formData.profile_picture,
          cv: formData.cv,
          preferences: JSON.stringify(formData.preferences)
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: t('settings.save_success') || "Settings saved successfully!" });
        // Update local auth context too
        if (user) {
          login({
            ...user,
            full_name: formData.full_name,
            profile_picture: formData.profile_picture || undefined
          });
        }
        fetchUserData();
      } else {
        console.error("Failed to save settings:", await res.text());
        setMessage({ type: 'error', text: t('settings.save_error') || "Failed to save settings." });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: t('settings.error_occurred') || "An error occurred." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const res = await fetch(`/api/users/${user?.id}`, {
        method: "DELETE",
        headers: {
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || ""
        }
      });

      if (res.ok) {
        logout();
        navigate("/");
      } else {
        alert(t('settings.delete_error') || "Failed to delete account.");
      }
    } catch (err) {
      console.error(err);
      alert(t('settings.error_occurred') || "An error occurred.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit
        setMessage({ type: 'error', text: t('register.image_too_large') || "Image must be less than 1MB" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, profile_picture: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setMessage({ type: 'error', text: t('register.cv_too_large') || "CV must be less than 2MB" });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, cv: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="flex items-center gap-4">
        <div className="bg-slate-900 p-3 rounded-2xl text-white shadow-lg shadow-slate-200">
          <SettingsIcon className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">{t('settings.title') || "Account Settings"}</h1>
          <p className="text-slate-500 mt-1">{t('settings.subtitle') || "Manage your profile and preferences"}</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl border animate-in fade-in slide-in-from-top-2 duration-300 ${
          message.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <p className="font-medium">{message.text}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Profile Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-bold font-display text-slate-900">{t('settings.profile_info') || "Profile Information"}</h2>
          </div>
          <div className="p-8 grid md:grid-cols-2 gap-6">
            <div className="md:col-span-2 flex flex-col items-center mb-4">
              <div className="relative">
                <div className="w-32 h-32 rounded-full bg-slate-100 border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
                  {formData.profile_picture ? (
                    <img src={formData.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-slate-300" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 bg-emerald-600 text-white p-2.5 rounded-full cursor-pointer shadow-lg hover:bg-emerald-500 transition-colors border-2 border-white">
                  <Camera className="w-5 h-5" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
                {formData.profile_picture && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, profile_picture: null })}
                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-md hover:bg-red-600 transition-colors border-2 border-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-3 font-medium">{t('settings.profile_picture') || "Profile Picture"}</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">{t('settings.full_name') || "Full Name"}</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
                className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">{t('settings.phone') || "Phone Number"}</label>
              <input
                type="tel"
                value={formData.phone_number}
                onChange={e => setFormData({...formData, phone_number: e.target.value})}
                className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">{t('settings.bio') || "Bio / About"}</label>
              <textarea
                rows={4}
                value={formData.bio}
                onChange={e => setFormData({...formData, bio: e.target.value})}
                className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
              />
            </div>

            {user.role === 'cleaner' && (
              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">{t('settings.cv') || "Curriculum Vitae (CV)"}</label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center border border-slate-200 shadow-sm text-slate-400">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">{formData.cv ? "CV Uploaded" : "No CV Uploaded"}</p>
                    <p className="text-xs text-slate-500">PDF, DOC, DOCX up to 2MB</p>
                  </div>
                  <div className="flex gap-2">
                    {formData.cv && (
                      <a 
                        href={formData.cv} 
                        download="CV.pdf"
                        className="p-2 bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                        title="Download CV"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                    <label className="px-4 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg font-bold text-xs cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
                      {formData.cv ? "Update CV" : "Upload CV"}
                      <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleCvChange} />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preferences Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <Heart className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-bold font-display text-slate-900">{t('settings.preferences') || "Preferences"}</h2>
          </div>
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="font-bold text-slate-900">{t('settings.notifications') || "Push Notifications"}</p>
                  <p className="text-sm text-slate-500">{t('settings.notifications_desc') || "Receive updates about your bookings"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFormData({
                  ...formData, 
                  preferences: {...formData.preferences, notifications: !formData.preferences.notifications}
                })}
                className={`w-12 h-6 rounded-full transition-colors relative ${formData.preferences.notifications ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.preferences.notifications ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="font-bold text-slate-900">{t('settings.email_notifications') || "Email Notifications"}</p>
                    <p className="text-sm text-slate-500">{t('settings.email_notifications_desc') || "Get updates via email"}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData, 
                    preferences: {...formData.preferences, email_notifications: !formData.preferences.email_notifications}
                  })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${formData.preferences.email_notifications ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.preferences.email_notifications ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="font-bold text-slate-900">{t('settings.sms_notifications') || "SMS Notifications"}</p>
                    <p className="text-sm text-slate-500">{t('settings.sms_notifications_desc') || "Get updates via text message"}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData, 
                    preferences: {...formData.preferences, sms_notifications: !formData.preferences.sms_notifications}
                  })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${formData.preferences.sms_notifications ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.preferences.sms_notifications ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {user.role === 'cleaner' && (
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">{t('settings.languages_spoken') || "Languages Spoken"}</label>
                  <input
                    type="text"
                    value={formData.preferences.languages}
                    onChange={e => setFormData({
                      ...formData,
                      preferences: {...formData.preferences, languages: e.target.value}
                    })}
                    className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder={t('settings.languages_placeholder') || "e.g., English, Spanish"}
                  />
                </div>
              )}

              {user.role === 'homeowner' && (
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">{t('settings.preferred_language') || "Preferred Language"}</label>
                  <input
                    type="text"
                    value={formData.preferences.preferred_language}
                    onChange={e => setFormData({
                      ...formData,
                      preferences: {...formData.preferences, preferred_language: e.target.value}
                    })}
                    className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder={t('settings.preferred_language_placeholder') || "e.g., English"}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center gap-3 disabled:opacity-50"
          >
            {isSaving ? <Clock className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {t('settings.save_changes') || "Save Changes"}
          </button>
        </div>
      </form>

      {/* Account Management Section */}
      <div className="pt-10 border-t border-slate-200">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <Shield className="w-5 h-5 text-slate-600" />
            <h2 className="text-xl font-bold font-display text-slate-900">Payment Methods</h2>
          </div>
          <div className="p-8 space-y-6">
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-emerald-900 text-sm">
              <p className="font-bold mb-1">Why add a payment method?</p>
              <p>We require a payment method on file to secure your booking. You will NOT be charged until your service is completed. Please review our <button onClick={() => setShowTermsModal(true)} className="underline font-bold">Terms and Conditions</button> for details on our cancellation policy.</p>
            </div>
            <PaymentMethodList />
            {!clientSecret ? (
              <button
                type="button"
                onClick={initPaymentSetup}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700"
              >
                Add Payment Method
              </button>
            ) : (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PaymentMethodForm onComplete={() => {
                  setClientSecret(null);
                  setRefresh(prev => prev + 1);
                  setMessage({ type: 'success', text: 'Payment method added successfully!' });
                  if (localStorage.getItem('pendingQuote')) {
                    navigate('/quote');
                  }
                }} />
              </Elements>
            )}
            <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
          </div>
        </div>
      </div>

      <div className="pt-10 border-t border-slate-200">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <Shield className="w-5 h-5 text-slate-600" />
            <h2 className="text-xl font-bold font-display text-slate-900">{t('settings.account_management') || "Account Management"}</h2>
          </div>
          <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="font-bold text-slate-900">{t('settings.delete_account') || "Delete Account"}</p>
              <p className="text-sm text-slate-500 mt-1">{t('settings.delete_desc') || "Permanently delete your account and all associated data. This action cannot be undone."}</p>
            </div>
            
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-6 py-3 bg-white text-slate-400 border border-slate-200 rounded-xl font-bold hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all flex items-center gap-2 whitespace-nowrap"
              >
                <Trash2 className="w-5 h-5" />
                {t('settings.delete_account_btn') || "Delete Account"}
              </button>
            ) : (
              <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
                <p className="text-sm font-bold text-slate-900">{t('common.are_you_sure')}</p>
                <button
                  onClick={handleDeleteAccount}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors"
                >
                  {t('common.yes_delete') || "Yes, Delete"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-300 transition-colors"
                >
                  {t('common.cancel')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
