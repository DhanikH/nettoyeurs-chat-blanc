import { motion } from "motion/react";
import { ShieldCheck, Star, Heart, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { teamMembers as localTeamMembers } from "../the tam/members";
import { fetchCmsContent } from "../services/cmsService";
import { useState, useEffect } from "react";

export default function Team() {
  const { t } = useTranslation();
  const [members, setMembers] = useState<any[]>(localTeamMembers);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTeam = async () => {
      try {
        const sanityMembers = await fetchCmsContent('cleaner');
        if (sanityMembers && sanityMembers.length > 0) {
          // Map sanity fields to our component needs
          const formatted = sanityMembers.map(m => ({
            id: m._id,
            name: m.name,
            role: m.role,
            bio: m.bio,
            image: m.imageUrl || m.image?.asset?._ref || "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
          }));
          
          // Merge with local members, avoiding duplicates by name
          const merged = [...localTeamMembers];
          formatted.forEach(sm => {
            if (!merged.find(lm => lm.name.toLowerCase() === sm.name.toLowerCase())) {
              merged.push(sm);
            }
          });
          setMembers(merged);
        }
      } catch (err) {
        console.error("Failed to load team from Sanity, using local data", err);
      } finally {
        setLoading(false);
      }
    };
    loadTeam();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16 pb-24">
      <div className="text-center space-y-6 max-w-3xl mx-auto">
        <h1 className="text-5xl font-bold text-slate-900 tracking-tight">{t('team.title')}</h1>
        <p className="text-xl text-slate-600">
          {t('team.subtitle')}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8">
          {members.map((member, idx) => (
            <motion.div 
              key={member.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group"
            >
              <div className="h-64 overflow-hidden relative">
                <img 
                  src={member.image} 
                  alt={member.name} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 text-white">
                  <h3 className="text-xl font-bold">{member.name}</h3>
                  <p className="text-emerald-300 font-medium text-sm">{member.role}</p>
                </div>
              </div>
              <div className="p-6">
                <p className="text-slate-600 leading-relaxed">
                  {member.bio}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
