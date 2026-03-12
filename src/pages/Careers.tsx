import { useNavigate } from "react-router-dom";
import { DollarSign, Briefcase, Clock, ShieldCheck, Star, CheckCircle2, ArrowRight, HelpCircle } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

export default function Careers() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const benefits = [
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: t('careers.benefits.pay_title'),
      description: t('careers.benefits.pay_desc')
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: t('careers.benefits.hours_title'),
      description: t('careers.benefits.hours_desc')
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: t('careers.benefits.payments_title'),
      description: t('careers.benefits.payments_desc')
    },
    {
      icon: <Briefcase className="w-6 h-6" />,
      title: t('careers.benefits.workflow_title'),
      description: t('careers.benefits.workflow_desc')
    }
  ];

  const requirements = [
    t('careers.requirements.item1'),
    t('careers.requirements.item2'),
    t('careers.requirements.item3'),
    t('careers.requirements.item4'),
    t('careers.requirements.item5'),
    t('careers.requirements.item6')
  ];

  const faqs = [
    {
      question: t('careers.faq.q1'),
      answer: t('careers.faq.a1')
    },
    {
      question: t('careers.faq.q2'),
      answer: t('careers.faq.a2')
    },
    {
      question: t('careers.faq.q3'),
      answer: t('careers.faq.a3')
    }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-24 pb-24">
      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6 pt-12"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold mb-4">
          <Star className="w-4 h-4 fill-current" />
          <span>{t('careers.hiring_badge')}</span>
        </div>
        <h1 
          className="text-5xl md:text-6xl font-bold text-slate-900 tracking-tight"
          dangerouslySetInnerHTML={{ __html: t('careers.hero_title') }}
        />
        <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          {t('careers.hero_subtitle')}
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
          <button 
            onClick={() => navigate("/register", { state: { role: 'cleaner' } })}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-2 group"
          >
            {t('careers.apply_now')}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button 
            onClick={() => {
              const el = document.getElementById('how-it-works');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-8 py-4 bg-white border-2 border-slate-200 hover:border-emerald-600 hover:text-emerald-600 text-slate-600 rounded-xl font-bold text-lg transition-all"
          >
            {t('careers.learn_more')}
          </button>
        </div>
      </motion.section>

      {/* Benefits Grid */}
      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
        {benefits.map((benefit, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow space-y-4"
          >
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
              {benefit.icon}
            </div>
            <h3 className="text-xl font-bold text-slate-900">{benefit.title}</h3>
            <p className="text-slate-600 leading-relaxed">{benefit.description}</p>
          </motion.div>
        ))}
      </section>

      {/* How it Works & Requirements */}
      <section id="how-it-works" className="grid lg:grid-cols-2 gap-12 items-center">
        <div className="bg-slate-900 rounded-[2.5rem] p-12 text-white space-y-8">
          <h2 className="text-3xl font-bold">{t('careers.how_it_works.title')}</h2>
          <div className="space-y-8">
            {[
              { step: "1", title: t('careers.how_it_works.step1_title'), desc: t('careers.how_it_works.step1_desc') },
              { step: "2", title: t('careers.how_it_works.step2_title'), desc: t('careers.how_it_works.step2_desc') },
              { step: "3", title: t('careers.how_it_works.step3_title'), desc: t('careers.how_it_works.step3_desc') },
              { step: "4", title: t('careers.how_it_works.step4_title'), desc: t('careers.how_it_works.step4_desc') }
            ].map((item, i) => (
              <div key={i} className="flex gap-6">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500 text-emerald-950 flex items-center justify-center font-bold text-lg">
                  {item.step}
                </div>
                <div className="space-y-1">
                  <h4 className="text-xl font-semibold">{item.title}</h4>
                  <p className="text-slate-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-8 p-4">
          <h2 className="text-3xl font-bold text-slate-900">{t('careers.requirements.title')}</h2>
          <p className="text-lg text-slate-600">
            {t('careers.requirements.subtitle')}
          </p>
          <ul className="space-y-4">
            {requirements.map((req, i) => (
              <li key={i} className="flex items-center gap-3 text-slate-700">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                <span>{req}</span>
              </li>
            ))}
          </ul>
          <div className="pt-4">
            <button 
              onClick={() => navigate("/register", { state: { role: 'cleaner' } })}
              className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg transition-all shadow-lg"
            >
              {t('careers.start_application')}
            </button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="space-y-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold text-slate-900">{t('careers.faq.title')}</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            {t('careers.faq.subtitle')}
          </p>
        </div>
        <div className="max-w-3xl mx-auto grid gap-6">
          {faqs.map((faq, i) => (
            <div key={i} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-3 text-slate-900 font-bold">
                <HelpCircle className="w-5 h-5 text-emerald-600" />
                <h3>{faq.question}</h3>
              </div>
              <p className="text-slate-600 pl-8 leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-emerald-600 rounded-[2.5rem] p-12 text-center text-white space-y-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        <h2 className="text-4xl font-bold relative z-10">{t('careers.ready_title')}</h2>
        <p className="text-xl text-emerald-50 max-w-xl mx-auto relative z-10">
          {t('careers.ready_subtitle')}
        </p>
        <div className="relative z-10">
          <button 
            onClick={() => navigate("/register")}
            className="px-12 py-5 bg-white text-emerald-600 hover:bg-emerald-50 rounded-2xl font-bold text-xl transition-all shadow-xl"
          >
            {t('careers.apply_button')}
          </button>
        </div>
      </section>
    </div>
  );
}
