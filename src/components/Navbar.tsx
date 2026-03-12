import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Cat, LogOut, User as UserIcon, Globe, Menu, X, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NotificationBell } from "./NotificationBell";
import { useState } from "react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('fr') ? 'en' : 'fr';
    i18n.changeLanguage(newLang);
  };

  return (
    <nav className="bg-white/70 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-24">
          <div className="flex items-center gap-12">
            <Link to="/" className="flex-shrink-0 flex items-center gap-4 group">
              <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg shadow-emerald-200 group-hover:bg-emerald-500 transition-all group-hover:rotate-6 group-hover:scale-110">
                <Cat className="h-6 w-6 text-white" />
              </div>
              <span className="font-display font-black text-2xl md:text-3xl text-slate-900 tracking-tighter">{t('common.site_name_short')}</span>
            </Link>
            <div className="hidden lg:flex items-center gap-10">
              <Link to="/" className="text-sm font-bold text-slate-500 hover:text-emerald-600 transition-colors uppercase tracking-widest">{t('nav.about')}</Link>
              <Link to="/team" className="text-sm font-bold text-slate-500 hover:text-emerald-600 transition-colors uppercase tracking-widest">{t('nav.team')}</Link>
              <Link to="/quote" className="text-sm font-bold text-slate-500 hover:text-emerald-600 transition-colors uppercase tracking-widest">{t('nav.quote')}</Link>
              <Link to="/careers" className="text-sm font-bold text-slate-500 hover:text-emerald-600 transition-colors uppercase tracking-widest">{t('nav.careers')}</Link>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <div className="hidden md:flex items-center gap-6">
              <button
                onClick={toggleLanguage}
                className="text-slate-500 hover:text-emerald-600 font-bold flex items-center gap-2 transition-colors px-3 py-2 rounded-xl hover:bg-slate-100"
                title="Toggle Language"
              >
                <Globe className="h-5 w-5" />
                <span className="text-xs uppercase tracking-tighter">{i18n.language.startsWith('fr') ? 'FR' : 'EN'}</span>
              </button>
              {user ? (
                <div className="flex items-center gap-4">
                  <NotificationBell />
                  <div className="h-8 w-px bg-slate-200 mx-2"></div>
                  <Link
                    to={user.role === "admin" ? "/admin" : user.role === "cleaner" ? "/cleaner" : "/dashboard"}
                    className="text-slate-700 hover:text-emerald-600 font-bold flex items-center gap-2 transition-colors bg-slate-50 px-4 py-2 rounded-xl border border-slate-100"
                  >
                    {user.profile_picture ? (
                      <img src={user.profile_picture} alt="Profile" className="h-6 w-6 rounded-full object-cover border border-slate-200" />
                    ) : (
                      <UserIcon className="h-4 w-4" />
                    )}
                    {t('nav.dashboard')}
                  </Link>
                  <Link
                    to="/settings"
                    className="p-2.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-xl transition-all"
                    title={t('nav.settings') || "Settings"}
                  >
                    <Settings className="h-5 w-5" />
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title={t('nav.logout')}
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <Link to="/login" className="text-slate-600 hover:text-slate-900 font-bold transition-colors px-4 py-2">
                    {t('nav.login')}
                  </Link>
                  <Link
                    to="/register"
                    className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 hover:shadow-2xl hover:-translate-y-1 active:scale-95"
                  >
                    {t('nav.signup')}
                  </Link>
                </div>
              )}
            </div>
            
            {/* Mobile Menu Button */}
            <div className="lg:hidden flex items-center gap-3">
              {user && <NotificationBell />}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-100 animate-in slide-in-from-top duration-300 shadow-xl">
          <div className="px-4 pt-4 pb-8 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Link 
                to="/" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center p-4 rounded-2xl bg-slate-50 text-slate-900 font-bold text-sm hover:bg-slate-100 transition-colors"
              >
                {t('nav.about')}
              </Link>
              <Link 
                to="/team" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center p-4 rounded-2xl bg-slate-50 text-slate-900 font-bold text-sm hover:bg-slate-100 transition-colors"
              >
                {t('nav.team')}
              </Link>
              <Link 
                to="/quote" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center p-4 rounded-2xl bg-emerald-50 text-emerald-700 font-bold text-sm hover:bg-emerald-100 transition-colors"
              >
                {t('nav.quote')}
              </Link>
              <Link 
                to="/careers" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center p-4 rounded-2xl bg-slate-50 text-slate-900 font-bold text-sm hover:bg-slate-100 transition-colors"
              >
                {t('nav.careers')}
              </Link>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <button
                onClick={() => { toggleLanguage(); setIsMenuOpen(false); }}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 text-slate-700 font-bold text-sm"
              >
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-slate-400" />
                  {t('nav.language')}
                </div>
                <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 uppercase">{i18n.language.startsWith('fr') ? 'FR' : 'EN'}</span>
              </button>

              {user ? (
                <>
                  <Link
                    to={user.role === "admin" ? "/admin" : user.role === "cleaner" ? "/cleaner" : "/dashboard"}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-50 text-indigo-700 font-bold text-sm"
                  >
                    {user.profile_picture ? (
                      <img src={user.profile_picture} alt="Profile" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <UserIcon className="h-5 w-5" />
                    )}
                    {t('nav.dashboard')}
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 text-slate-700 font-bold text-sm"
                  >
                    <Settings className="h-5 w-5" />
                    {t('nav.settings') || "Settings"}
                  </Link>
                  <button
                    onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl bg-red-50 text-red-600 font-bold text-sm"
                  >
                    <LogOut className="h-5 w-5" />
                    {t('nav.logout')}
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link 
                    to="/login" 
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center p-4 rounded-2xl border border-slate-200 text-slate-700 font-bold text-sm"
                  >
                    {t('nav.login')}
                  </Link>
                  <Link 
                    to="/register" 
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center p-4 rounded-2xl bg-slate-900 text-white font-bold text-sm"
                  >
                    {t('nav.signup')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
