import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserPlus, Eye, EyeOff, Camera, X, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bio, setBio] = useState("");
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [cv, setCv] = useState<string | null>(null);
  const [cvName, setCvName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const forcedRole = location.state?.role;
  const [role, setRole] = useState<"homeowner" | "cleaner">(forcedRole || "homeowner");
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (password !== confirmPassword) {
      setError(t('register.passwords_do_not_match'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email, 
          password, 
          role,
          full_name: fullName,
          phone_number: phoneNumber,
          profile_picture: profilePicture,
          cv,
          ...(role === "cleaner" && {
            bio
          })
        })
      });
      
      const contentType = res.headers.get("content-type");
      let data: any = {};
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error("Unexpected response from server");
      }
      
      if (res.ok) {
        login(data);
        if (data.role === "cleaner") {
          navigate("/cleaner");
        } else {
          navigate("/dashboard");
        }
      } else {
        setError(data.error || t('register.registration_failed'));
      }
    } catch (err) {
      setError(t('register.error_occurred'));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { // 1MB limit
        setError(t('register.image_too_large') || "Image must be less than 1MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setError(t('register.cv_too_large') || "CV must be less than 2MB");
        return;
      }
      setCvName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCv(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 px-4 pb-24">
      <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mb-6 transform rotate-3">
            <UserPlus className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold font-display text-slate-900">{t('register.create_account')}</h2>
          <p className="text-slate-500 mt-3 font-light text-lg">{t('register.join_platform')}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm font-medium flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center mb-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden">
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-slate-400" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-emerald-600 text-white p-2 rounded-full cursor-pointer shadow-lg hover:bg-emerald-500 transition-colors">
                <Camera className="w-4 h-4" />
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
              {profilePicture && (
                <button
                  type="button"
                  onClick={() => setProfilePicture(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2 font-medium">{t('register.profile_picture') || "Add a profile picture"}</p>
          </div>

          {!forcedRole && (
            <div className="space-y-3">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">{t('register.i_am_a')}</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRole("homeowner")}
                  className={`py-4 rounded-2xl border-2 font-bold transition-all ${
                    role === "homeowner" 
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm" 
                      : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white"
                  }`}
                >
                  {t('register.homeowner')}
                </button>
                <button
                  type="button"
                  onClick={() => setRole("cleaner")}
                  className={`py-4 rounded-2xl border-2 font-bold transition-all ${
                    role === "cleaner" 
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm" 
                      : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white"
                  }`}
                >
                  {t('register.cleaner')}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">{t('register.email')}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
              placeholder={t('register.email_placeholder')}
            />
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">{t('register.name')}</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
              placeholder={t('register.name_placeholder')}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">{t('register.phone_number')}</label>
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
              placeholder={t('register.phone_placeholder')}
            />
          </div>

          {role === "cleaner" && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">{t('register.tell_us_about_yourself')}</label>
                <textarea
                  required
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm resize-none"
                  placeholder={t('register.bio_placeholder')}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">{t('register.upload_cv') || "Upload CV (PDF/DOCX)"}</label>
                <div className={`relative border-2 border-dashed rounded-2xl p-6 transition-all ${cv ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input 
                    type="file" 
                    accept=".pdf,.doc,.docx" 
                    required={role === 'cleaner'}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    onChange={handleCvChange}
                  />
                  <div className="flex flex-col items-center text-center">
                    <FileText className={`w-10 h-10 mb-2 ${cv ? 'text-emerald-600' : 'text-slate-400'}`} />
                    {cv ? (
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-emerald-900 truncate max-w-[200px]">{cvName}</p>
                        <p className="text-xs text-emerald-600">Click to change file</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-700">{t('register.click_to_upload_cv') || "Click to upload your CV"}</p>
                        <p className="text-xs text-slate-400">PDF, DOC, DOCX up to 2MB</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
          
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">{t('register.password')}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm pr-12"
                placeholder={t('register.password_placeholder')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">{t('register.confirm_password')}</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-5 py-4 rounded-2xl border ${
                  confirmPassword && password !== confirmPassword 
                    ? "border-red-300 focus:ring-red-500 focus:border-red-500" 
                    : "border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
                } focus:ring-2 transition-all font-medium shadow-sm pr-12`}
                placeholder={t('register.password_placeholder')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-red-500 text-sm font-medium mt-1">{t('register.passwords_do_not_match')}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-4 mt-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-emerald-900/20 hover:-translate-y-1"
          >
            {t('register.create_account_button')}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center text-slate-500 font-medium">
          {t('register.already_have_account')}{" "}
          <Link to="/login" className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
            {t('register.sign_in_link')}
          </Link>
        </div>
      </div>
    </div>
  );
}
