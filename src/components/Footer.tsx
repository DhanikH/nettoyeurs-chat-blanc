import { Link } from "react-router-dom";
import { Cat, Facebook, Instagram, Twitter, Mail, Phone, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-300 pt-24 pb-12 px-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent"></div>
      
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-16 relative z-10">
        <div className="space-y-8">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="bg-emerald-600 p-2.5 rounded-xl shadow-lg shadow-emerald-900/20 group-hover:bg-emerald-500 transition-colors">
              <Cat className="h-6 w-6 text-white" />
            </div>
            <span className="font-display font-bold text-2xl text-white tracking-tight">{t('common.site_name')}</span>
          </Link>
          <p className="text-slate-400 leading-relaxed text-lg font-light">
            {t('footer.about_text') || "Premium eco-friendly cleaning services for modern homes. We bring sparkle to your space with a touch of care."}
          </p>
          <div className="flex gap-4">
            {[Facebook, Instagram, Twitter].map((Icon, i) => (
              <a key={i} href="#" className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all hover:-translate-y-1">
                <Icon className="w-5 h-5" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-white font-bold font-display text-xl mb-8 tracking-wide uppercase text-sm">{t('footer.quick_links')}</h3>
          <ul className="space-y-4">
            {[
              { name: t('nav.about'), path: '/' },
              { name: t('nav.team'), path: '/team' },
              { name: t('nav.quote'), path: '/quote' },
              { name: t('nav.careers'), path: '/careers' }
            ].map((link, i) => (
              <li key={i}>
                <Link to={link.path} className="hover:text-emerald-400 transition-colors flex items-center gap-2 group">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-emerald-400 transition-colors"></div>
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-white font-bold font-display text-xl mb-8 tracking-wide uppercase text-sm">{t('footer.contact_us')}</h3>
          <ul className="space-y-6">
            <li className="flex items-center gap-4">
              <div className="bg-slate-800 p-3 rounded-xl">
                <Phone className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-slate-400">514-757-4970</span>
            </li>
            <li className="flex items-center gap-4">
              <div className="bg-slate-800 p-3 rounded-xl">
                <Mail className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-slate-400">nettoyeurschatblanc@gmail.com</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-24 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6 text-sm font-medium text-slate-500">
        <p>© {currentYear} {t('common.site_name')}. All rights reserved.</p>
        <div className="flex gap-8">
          <a href="#" className="hover:text-white transition-colors">{t('footer.privacy')}</a>
          <a href="#" className="hover:text-white transition-colors">{t('footer.terms')}</a>
          <a href="#" className="hover:text-white transition-colors">{t('footer.cookies')}</a>
        </div>
      </div>
    </footer>
  );
}
