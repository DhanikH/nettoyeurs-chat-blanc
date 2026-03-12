import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Leaf, Clock, Sparkles, Droplets, Home as HomeIcon, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { testimonials as staticTestimonials } from "../customer feedback/testimonials";
import { fetchCmsContent } from "../services/cmsService";

export default function Home() {
  const { t } = useTranslation();
  const [testimonials, setTestimonials] = useState(staticTestimonials);

  useEffect(() => {
    const loadCmsContent = async () => {
      const cmsTestimonials = await fetchCmsContent('testimonial');
      if (cmsTestimonials && cmsTestimonials.length > 0) {
        // Map Sanity schema to our app schema
        const mapped = cmsTestimonials.map((t: any) => ({
          id: t._id,
          text: t.content,
          name: t.author,
          role: t.role,
          initial: t.author.charAt(0)
        }));
        setTestimonials(mapped);
      }
    };
    loadCmsContent();
  }, []);

  return (
    <div className="bg-slate-50 text-slate-800 font-sans">
      {/* Hero Section */}
      <section className="relative w-full h-[75vh] md:h-[90vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80" 
            alt="Clean living room" 
            className="w-full h-full object-cover scale-105 animate-slow-zoom"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900/70"></div>
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto space-y-10">
          <h1 
            className="text-6xl md:text-8xl font-bold font-display text-white tracking-tight drop-shadow-2xl leading-[0.9] animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200"
            dangerouslySetInnerHTML={{ __html: t('home.hero_title') }}
          />
          <p className="text-xl md:text-3xl text-slate-200 max-w-2xl mx-auto drop-shadow-lg font-light leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
            {t('home.hero_subtitle')}
          </p>
          <div className="pt-10 animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-700">
            <Link 
              to="/quote" 
              className="inline-block px-12 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold text-xl transition-all shadow-2xl shadow-emerald-900/40 hover:shadow-emerald-500/40 hover:-translate-y-1 active:scale-95"
            >
              {t('home.get_quote')}
            </Link>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section className="py-24 px-4 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-slate-900 mb-4">{t('home.why_choose_us')}</h2>
          <div className="w-24 h-1.5 bg-emerald-500 mx-auto rounded-full"></div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-12">
          <div className="flex flex-col items-center text-center space-y-4 p-8 rounded-3xl bg-white shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-2 transform -rotate-3">
              <ShieldCheck className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold font-display text-slate-900">{t('home.reliable_title')}</h3>
            <p className="text-slate-600 leading-relaxed">
              {t('home.reliable_desc')}
            </p>
          </div>
          
          <div className="flex flex-col items-center text-center space-y-4 p-8 rounded-3xl bg-white shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-2 transform rotate-3">
              <Leaf className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold font-display text-slate-900">{t('home.eco_title')}</h3>
            <p className="text-slate-600 leading-relaxed">
              {t('home.eco_desc')}
            </p>
          </div>
          
          <div className="flex flex-col items-center text-center space-y-4 p-8 rounded-3xl bg-white shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-2 transform -rotate-3">
              <Clock className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold font-display text-slate-900">{t('home.time_title')}</h3>
            <p className="text-slate-600 leading-relaxed">
              {t('home.time_desc')}
            </p>
          </div>
        </div>
      </section>

      {/* What We Do Section */}
      <section className="py-24 px-4 bg-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-slate-900 mb-4">{t('home.what_we_do')}</h2>
            <div className="w-24 h-1.5 bg-emerald-500 mx-auto rounded-full"></div>
            <p className="mt-6 text-slate-600 max-w-2xl mx-auto text-lg">
              {t('home.what_we_do_desc')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200/60 hover:shadow-xl transition-all group">
              <Sparkles className="w-12 h-12 text-emerald-500 mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-bold font-display text-slate-900 mb-3">{t('home.standard_title')}</h3>
              <p className="text-slate-600 mb-8 leading-relaxed">
                {t('home.standard_desc')}
              </p>
              <ul className="space-y-3 text-slate-600 text-sm font-medium">
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> {t('home.standard_li1')}</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> {t('home.standard_li2')}</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> {t('home.standard_li3')}</li>
              </ul>
            </div>

            <div className="bg-slate-900 p-10 rounded-3xl shadow-lg hover:shadow-xl transition-all group text-slate-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -z-0"></div>
              <Droplets className="w-12 h-12 text-emerald-400 mb-6 group-hover:scale-110 transition-transform relative z-10" />
              <h3 className="text-2xl font-bold font-display text-white mb-3 relative z-10">{t('home.deep_title')}</h3>
              <p className="text-slate-300 mb-8 leading-relaxed relative z-10">
                {t('home.deep_desc')}
              </p>
              <ul className="space-y-3 text-slate-300 text-sm font-medium relative z-10">
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> {t('home.deep_li1')}</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> {t('home.deep_li2')}</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div> {t('home.deep_li3')}</li>
              </ul>
            </div>

            <div className="bg-white p-10 rounded-3xl shadow-sm border border-slate-200/60 hover:shadow-xl transition-all group">
              <HomeIcon className="w-12 h-12 text-emerald-500 mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-bold font-display text-slate-900 mb-3">{t('home.move_title')}</h3>
              <p className="text-slate-600 mb-8 leading-relaxed">
                {t('home.move_desc')}
              </p>
              <ul className="space-y-3 text-slate-600 text-sm font-medium">
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> {t('home.move_li1')}</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> {t('home.move_li2')}</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> {t('home.move_li3')}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-24 px-4 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold font-display text-slate-900 mb-4">{t('home.our_work')}</h2>
          <div className="w-24 h-1.5 bg-emerald-500 mx-auto rounded-full"></div>
          <p className="mt-6 text-slate-600 max-w-2xl mx-auto text-lg">
            {t('home.our_work_desc')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="relative h-96 rounded-3xl overflow-hidden group shadow-md">
              <img 
                src="https://images.unsplash.com/photo-1584622650111-993a426fbf0a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
                alt="Before cleaning" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-6 left-6 bg-slate-900/80 text-white px-5 py-1.5 rounded-full text-sm font-medium backdrop-blur-md">
                {t('home.before')}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="relative h-96 rounded-3xl overflow-hidden group shadow-md">
              <img 
                src="https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
                alt="After cleaning" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-6 left-6 bg-emerald-600/90 text-white px-5 py-1.5 rounded-full text-sm font-medium backdrop-blur-md">
                {t('home.after')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-32 px-4 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),transparent_70%)]"></div>
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px]"></div>
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px]"></div>
        </div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-bold font-display mb-6 tracking-tight">{t('home.loved_by')}</h2>
            <div className="w-24 h-1.5 bg-emerald-500 mx-auto rounded-full"></div>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {testimonials.map((testimonial) => (
              <div key={testimonial.id} className="bg-white/5 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/10 hover:bg-white/10 transition-all duration-500 group">
                <div className="flex gap-1 mb-8">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-5 h-5 fill-emerald-400 text-emerald-400" />
                  ))}
                </div>
                <p className="text-slate-300 mb-10 text-xl leading-relaxed font-serif italic">
                  "{testimonial.text}"
                </p>
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center text-2xl font-bold font-display text-white shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                    {testimonial.initial}
                  </div>
                  <div>
                    <p className="font-bold font-display text-white text-lg">{testimonial.name}</p>
                    <p className="text-emerald-400/80 text-sm font-medium tracking-wide uppercase">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Final CTA */}
      <section className="py-32 px-4 text-center max-w-3xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold font-display text-slate-900 mb-6">{t('home.ready')}</h2>
        <p className="text-xl text-slate-600 mb-10 font-light">
          {t('home.ready_desc')}
        </p>
        <Link 
          to="/quote" 
          className="inline-block px-12 py-5 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
        >
          {t('home.free_quote')}
        </Link>
      </section>
    </div>
  );
}
