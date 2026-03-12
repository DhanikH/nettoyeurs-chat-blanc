import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { formatDate, formatTime, formatDateTime, formatDateISO } from "../utils/dateUtils";
import { useAuth } from "../context/AuthContext";
import { motion } from "motion/react";
import { Calculator, Bed, Bath, Layout, Grid, Sparkles, ChefHat, Layers, Sun, Briefcase, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Quote() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  
  const [sqftTier, setSqftTier] = useState<string>("");
  const [beds, setBeds] = useState<string>("");
  const [baths, setBaths] = useState<string>("");
  const [commonAreas, setCommonAreas] = useState<string>("");
  const [offices, setOffices] = useState<string>("");
  const [floors, setFloors] = useState<string>("");
  const [windowCleaning, setWindowCleaning] = useState<boolean>(false);
  const [ovenCleaning, setOvenCleaning] = useState<boolean>(false);
  const [deepCleaning, setDeepCleaning] = useState<boolean>(false);
  const [frequency, setFrequency] = useState<"none" | "monthly" | "biweekly" | "weekly">("none");

  const [specialInstructions, setSpecialInstructions] = useState<string>("");
  const [bookingType, setBookingType] = useState<"exact" | "range">("range");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledEndDate, setScheduledEndDate] = useState<string>("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [progress, setProgress] = useState(0);

  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");

  useEffect(() => {
    if (user && user.role === 'homeowner') {
      fetch(`/api/properties/${user.id}`)
        .then(res => res.json())
        .then(data => {
          setProperties(data);
          
          const state = location.state as any;
          if (state?.propertyId) {
            setSelectedPropertyId(state.propertyId);
            const prop = data.find((p: any) => p.id === state.propertyId);
            if (prop && !state.lastJob) {
              // Pre-fill from property defaults if no last job
              setBeds(prop.bedrooms.toString());
              setBaths(prop.bathrooms.toString());
              setCommonAreas(prop.living_rooms.toString());
              setOffices(prop.offices.toString());
              // Estimate sqft tier
              if (prop.square_feet < 1000) setSqftTier("under_1000");
              else if (prop.square_feet < 1500) setSqftTier("1000_1500");
              else if (prop.square_feet < 2000) setSqftTier("1500_2000");
              else if (prop.square_feet < 2500) setSqftTier("2000_2500");
              else if (prop.square_feet < 3000) setSqftTier("2500_3000");
              else setSqftTier("over_3000");
            }
          } else if (data.length > 0) {
            setSelectedPropertyId(data[0].id);
          }

          if (state?.lastJob) {
            const lastJob = state.lastJob;
            setSpecialInstructions(lastJob.special_instructions || "");
            setWindowCleaning(!!lastJob.window_cleaning);
            setOvenCleaning(!!lastJob.oven_cleaning);
            setDeepCleaning(!!lastJob.deep_cleaning);
            setFrequency(lastJob.frequency || "none");
            
            // If we have last job, we should probably also pre-fill property details
            const prop = data.find((p: any) => p.id === lastJob.property_id);
            if (prop) {
              setBeds(prop.bedrooms.toString());
              setBaths(prop.bathrooms.toString());
              setCommonAreas(prop.living_rooms.toString());
              setOffices(prop.offices.toString());
              if (prop.square_feet < 1000) setSqftTier("under_1000");
              else if (prop.square_feet < 1500) setSqftTier("1000_1500");
              else if (prop.square_feet < 2000) setSqftTier("1500_2000");
              else if (prop.square_feet < 2500) setSqftTier("2000_2500");
              else if (prop.square_feet < 3000) setSqftTier("2500_3000");
              else setSqftTier("over_3000");
            }
            // Default window to today + 7 days as requested
            const now = new Date();
            const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            setScheduledDate(formatDateISO(now));
            setScheduledEndDate(formatDateISO(nextWeek));
            setBookingType("range");
          }
        })
        .catch(console.error);
    }
  }, [user, location.state]);

  // Hide quote if any property details change, requiring recalculation
  useEffect(() => {
    setShowQuote(false);
  }, [sqftTier, beds, baths, commonAreas, offices, floors, windowCleaning, ovenCleaning, deepCleaning, specialInstructions]);

  // Pricing Algorithm
  const sqftPricing: Record<string, number> = {
    "under_1000": 45,
    "1000_1500": 65,
    "1500_2000": 90,
    "2000_2500": 115,
    "2500_3000": 140,
    "over_3000": 180,
  };
  
  const parsedBeds = Number(beds) || 0;
  const parsedBaths = Number(baths) || 0;
  const parsedCommon = Number(commonAreas) || 0;
  const parsedOffices = Number(offices) || 0;
  const parsedFloors = Number(floors) || 0;

  const isDateValid = bookingType === 'exact' ? !!scheduledDate : (!!scheduledDate && !!scheduledEndDate);
  const hasInputs = (sqftTier !== "" || beds !== "" || baths !== "" || commonAreas !== "" || offices !== "" || floors !== "") && isDateValid;
  const hasSpecialInstructions = specialInstructions.trim().length > 0;
  
  const sqftPrice = sqftTier ? sqftPricing[sqftTier] : 0;
  const floorsSurcharge = parsedFloors > 1 ? (parsedFloors - 1) * 12 : 0;
  const baseFee = hasInputs ? 25 : 0;
  
  // $25 (Base) + (Sqft Tier) + ($12 * beds) + ($18 * baths) + ($12 * commonAreas) + ($12 * offices) + ($12 * extra floors) + ($40 if windows) + ($15 if oven)
  const basePriceBeforeDeepClean = baseFee + sqftPrice + (12 * parsedBeds) + (18 * parsedBaths) + (12 * parsedCommon) + (12 * parsedOffices) + floorsSurcharge + (windowCleaning ? 40 : 0) + (ovenCleaning ? 15 : 0);
  const basePrice = deepCleaning ? basePriceBeforeDeepClean * 1.5 : basePriceBeforeDeepClean;
  
  let discountMultiplier = 0;
  if (frequency === "monthly") discountMultiplier = 0.10;
  if (frequency === "biweekly") discountMultiplier = 0.15;
  if (frequency === "weekly") discountMultiplier = 0.20;

  const finalPrice = basePrice * (1 - discountMultiplier);
  const savings = basePrice - finalPrice;

  let yearlyTotal = 0;
  let frequencyText = "";
  if (frequency === "monthly") {
    yearlyTotal = finalPrice * 12;
    frequencyText = t('quote.per_month');
  } else if (frequency === "biweekly") {
    yearlyTotal = finalPrice * 26;
    frequencyText = t('quote.bi_weekly');
  } else if (frequency === "weekly") {
    yearlyTotal = finalPrice * 52;
    frequencyText = t('quote.per_week');
  } else {
    yearlyTotal = finalPrice;
    frequencyText = "";
  }

  const handleCalculate = () => {
    setIsCalculating(true);
    setShowQuote(false);
    setProgress(0);
    
    const duration = 2000; // 2 seconds for better UX
    const intervalTime = 50;
    const steps = duration / intervalTime;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      setProgress(Math.min(Math.round((currentStep / steps) * 100), 100));
      
      if (currentStep >= steps) {
        clearInterval(interval);
        setIsCalculating(false);
        setShowQuote(true);
      }
    }, intervalTime);
  };

  const handleBook = async () => {
    if (!user) {
      navigate("/login", { state: { message: t('quote.login_required_msg') || "Please log in to book a service." } });
      return;
    }

    if (properties.length === 0) {
      alert(t('quote.add_property_msg'));
      navigate("/dashboard");
      return;
    }

    if (!selectedPropertyId) {
      alert(t('quote.select_property_msg'));
      return;
    }

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          property_id: selectedPropertyId,
          homeowner_id: user.id,
          scheduled_date: scheduledDate || formatDateISO(new Date(Date.now() + 86400000 * 3)),
          scheduled_end_date: bookingType === 'range' ? scheduledEndDate : null,
          calculated_base_price: basePrice,
          final_transaction_price: finalPrice,
          special_instructions: specialInstructions.trim() || null,
          window_cleaning: windowCleaning,
          oven_cleaning: ovenCleaning,
          deep_cleaning: deepCleaning,
          frequency: frequency
        })
      });
      if (res.ok) {
        alert(hasSpecialInstructions ? t('quote.custom_quote_success') : t('quote.booking_successful'));
        navigate("/dashboard");
      } else {
        const data = await res.json();
        alert(t('quote.error_booking') + ": " + (data.error || t('quote.unknown_error')));
      }
    } catch (err) {
      console.error(err);
      alert(t('quote.error_booking_retry'));
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-12 pb-24 px-4">
      <div className="text-center mb-16 pt-8">
        <h2 className="text-4xl md:text-5xl font-bold font-display text-slate-900 tracking-tight">{t('quote.title')}</h2>
        <p className="text-lg md:text-xl text-slate-600 mt-4 max-w-2xl mx-auto font-light">{t('quote.subtitle')}</p>
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col lg:flex-row"
      >
        <div className="p-8 md:p-10 lg:w-3/5 space-y-10 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-100">
          <div className="flex items-center gap-3 text-slate-900 font-bold font-display text-2xl">
            <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-600">
              <Calculator className="h-6 w-6" />
            </div>
            {t('quote.property_dimensions')}
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                <Grid className="h-4 w-4 text-emerald-600" /> {t('quote.sqft')}
              </label>
              <select 
                value={sqftTier}
                onChange={(e) => setSqftTier(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-white text-slate-700 font-medium shadow-sm appearance-none cursor-pointer"
                style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 1rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
              >
                <option value="" disabled>{t('quote.sqft_select')}</option>
                <option value="under_1000">{t('quote.sqft_under_1000')}</option>
                <option value="1000_1500">{t('quote.sqft_1000_1500')}</option>
                <option value="1500_2000">{t('quote.sqft_1500_2000')}</option>
                <option value="2000_2500">{t('quote.sqft_2000_2500')}</option>
                <option value="2500_3000">{t('quote.sqft_2500_3000')}</option>
                <option value="over_3000">{t('quote.sqft_over_3000')}</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                  <Bed className="h-4 w-4 text-emerald-600" /> {t('quote.bedrooms')}
                </label>
                <input 
                  type="number" 
                  value={beds}
                  onChange={(e) => setBeds(e.target.value)}
                  placeholder="0"
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
                  min="0"
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                  <Bath className="h-4 w-4 text-emerald-600" /> {t('quote.bathrooms')}
                </label>
                <input 
                  type="number" 
                  value={baths}
                  onChange={(e) => setBaths(e.target.value)}
                  placeholder="0"
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
                  min="0"
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                  <Layout className="h-4 w-4 text-emerald-600" /> {t('quote.common_areas')}
                </label>
                <input 
                  type="number" 
                  value={commonAreas}
                  onChange={(e) => setCommonAreas(e.target.value)}
                  placeholder="0"
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
                  min="0"
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                  <Briefcase className="h-4 w-4 text-emerald-600" /> {t('quote.offices')}
                </label>
                <input 
                  type="number" 
                  value={offices}
                  onChange={(e) => setOffices(e.target.value)}
                  placeholder="0"
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
                  min="0"
                />
              </div>
              <div className="space-y-3 col-span-2">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                  <Layers className="h-4 w-4 text-emerald-600" /> {t('quote.floors')}
                </label>
                <input 
                  type="number" 
                  value={floors}
                  onChange={(e) => setFloors(e.target.value)}
                  placeholder="1"
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
                  min="1"
                />
              </div>
            </div>
            
            <div className="pt-8 border-t border-slate-200 space-y-5">
              <div className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" /> {t('quote.cleaning_type')}
              </div>
              
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <label className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer h-full ${deepCleaning ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-white hover:border-emerald-200'}`}>
                    <div className="relative flex items-center mt-1">
                      <input 
                        type="checkbox" 
                        checked={deepCleaning}
                        onChange={(e) => setDeepCleaning(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 transition-colors cursor-pointer"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
                        <Sparkles className="h-4 w-4 text-emerald-600" /> {t('quote.deep_cleaning')}
                      </span>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1">{t('quote.deep_cleaning_desc')}</p>
                    </div>
                  </label>
                </div>
                
                <div className="flex-1 border rounded-2xl p-4 transition-all duration-300 bg-slate-50 border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-3 text-slate-700">{t('quote.deep_clean_includes')}</h4>
                  <ul className="space-y-2">
                    {[
                      t('quote.deep_clean_li1'),
                      t('quote.deep_clean_li2'),
                      t('quote.deep_clean_li3'),
                      t('quote.deep_clean_li4'),
                      t('quote.deep_clean_li5')
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs font-medium text-slate-600">
                        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-200 space-y-5">
              <div className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" /> {t('quote.addons')}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${windowCleaning ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-white hover:border-emerald-200'}`}>
                  <div className="relative flex items-center mt-1">
                    <input 
                      type="checkbox" 
                      checked={windowCleaning}
                      onChange={(e) => setWindowCleaning(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 transition-colors cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
                      <Sun className="h-4 w-4 text-slate-500" /> {t('quote.interior_windows')}
                    </span>
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md inline-block w-fit">{t('quote.flat_fee')}</span>
                  </div>
                </label>
                
                <label className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${ovenCleaning ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-white hover:border-emerald-200'}`}>
                  <div className="relative flex items-center mt-1">
                    <input 
                      type="checkbox" 
                      checked={ovenCleaning}
                      onChange={(e) => setOvenCleaning(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 transition-colors cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-1">
                      <ChefHat className="h-4 w-4 text-slate-500" /> {t('quote.oven_cleaning')}
                    </span>
                    <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-md inline-block w-fit">{t('quote.oven_fee')}</span>
                  </div>
                </label>
              </div>
            </div>
            <div className="pt-8 border-t border-slate-200 space-y-5">
              <div className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" /> {t('quote.special_instructions')}
              </div>
              <div className="space-y-2">
                <p className="text-sm text-slate-500">{t('quote.special_instructions_desc')}</p>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder={t('quote.special_instructions_placeholder')}
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm min-h-[120px] resize-y"
                />
              </div>
            </div>

            <div className="pt-8 border-t border-slate-200 space-y-6">
              <div className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sun className="h-4 w-4 text-emerald-600" /> {t('quote.when_do_you_want_it')}
              </div>
              
              <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
                <button
                  onClick={() => setBookingType("exact")}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${bookingType === "exact" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {t('quote.exact_date')}
                </button>
                <button
                  onClick={() => setBookingType("range")}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${bookingType === "range" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {t('quote.date_range')}
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {bookingType === 'range' ? t('quote.start_date') : t('quote.preferred_date')}
                  </label>
                  <input 
                    type="date" 
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
                    min={formatDateISO(new Date())}
                  />
                  {scheduledDate && (new Date(scheduledDate).getTime() - new Date().getTime()) < (24 * 60 * 60 * 1000) && (
                    <p className="text-xs font-bold text-amber-600 mt-2 bg-amber-50 p-2 rounded-lg border border-amber-100">
                      {t('quote.warning_24h')}
                    </p>
                  )}
                </div>
                {bookingType === 'range' && (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {t('quote.end_date')}
                    </label>
                    <input 
                      type="date" 
                      value={scheduledEndDate}
                      onChange={(e) => setScheduledEndDate(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
                      min={scheduledDate || formatDateISO(new Date())}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:w-2/5 flex flex-col bg-white relative">
          {!showQuote && !isCalculating && (
            <div className="p-10 flex flex-col items-center justify-center h-full text-center">
              <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
                <Sparkles className="h-10 w-10 text-emerald-500" />
              </div>
              <h3 className="text-2xl font-bold font-display text-slate-900 mb-3">{t('quote.ready_to_see')}</h3>
              <p className="text-slate-500 mb-10 leading-relaxed">{t('quote.fill_out_details')}</p>
              <button 
                onClick={handleCalculate}
                disabled={!hasInputs}
                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                  hasInputs 
                    ? "bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-900/20 hover:-translate-y-1" 
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {hasSpecialInstructions ? t('quote.request_custom_quote') : t('quote.calculate_quote')}
              </button>
            </div>
          )}

          {isCalculating && (
            <div className="p-10 flex flex-col items-center justify-center h-full space-y-8 text-center">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
                <Calculator className="w-8 h-8 text-emerald-600 animate-pulse" />
              </div>
              <div className="w-full max-w-xs space-y-3">
                <div className="flex justify-between text-sm font-bold text-slate-700 uppercase tracking-wider">
                  <span>{hasSpecialInstructions ? t('quote.preparing_request') : t('quote.calculating')}</span>
                  <span className="text-emerald-600">{progress}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all duration-100 ease-out" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
              <p className="text-slate-500 text-sm font-medium animate-pulse">
                {hasSpecialInstructions ? t('quote.compiling_custom') : t('quote.analyzing_property')}
              </p>
            </div>
          )}

          {showQuote && (
            <div className="p-10 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex-1 space-y-8">
                <div className="flex items-center gap-3 text-slate-900 font-bold font-display text-2xl">
                  <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-600">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  {t('quote.service_frequency')}
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { id: "none", label: t('quote.one_time'), discount: 0 },
                    { id: "monthly", label: t('quote.monthly'), discount: 10 },
                    { id: "biweekly", label: t('quote.biweekly'), discount: 15 },
                    { id: "weekly", label: t('quote.weekly'), discount: 20 },
                  ].map((tier) => (
                    <button
                      key={tier.id}
                      onClick={() => setFrequency(tier.id as any)}
                      className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${
                        frequency === tier.id 
                          ? "border-emerald-500 bg-emerald-50 shadow-sm" 
                          : "border-slate-100 hover:border-slate-200 bg-white"
                      }`}
                    >
                      <span className={`font-bold text-lg ${frequency === tier.id ? "text-emerald-900" : "text-slate-700"}`}>
                        {tier.label}
                      </span>
                      {tier.discount > 0 && (
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider ${frequency === tier.id ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                          {t('quote.save')} {tier.discount}%
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-slate-200 space-y-8">
                {user && properties.length > 0 && (
                  <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">{t('quote.select_property')}</p>
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-white text-slate-700 font-medium shadow-sm appearance-none cursor-pointer"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 1rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                    >
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.address || t('quote.unnamed_property')}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                  {hasSpecialInstructions ? (
                    <>
                      <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">{t('quote.custom_quote_required')}</p>
                      <p className="text-slate-700 mb-4">{t('quote.custom_quote_desc')}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <span className="text-sm font-bold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-lg">
                          {t('quote.base_estimate')} ${finalPrice.toFixed(2)} {frequencyText}
                        </span>
                      </div>
                      
                      <div className="mt-6 pt-6 border-t border-slate-200/60 space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('quote.disclaimer_title')}</p>
                        <p className="text-[11px] leading-relaxed text-slate-500 font-medium italic">
                          {t('quote.disclaimer_text')}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">{t('quote.final_quote')}</p>
                      <div className="flex items-baseline gap-3 flex-wrap mb-2">
                        <span className="text-5xl font-bold font-display text-slate-900">${finalPrice.toFixed(2)}</span>
                        {frequencyText && (
                          <span className="text-xl font-medium text-slate-500">{frequencyText}</span>
                        )}
                      </div>
                      {discountMultiplier > 0 && (
                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-lg text-slate-400 line-through font-medium">${basePrice.toFixed(2)}</span>
                          <span className="text-sm font-bold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-lg">
                            {t('quote.you_save')} ${savings.toFixed(2)} {t('quote.per_clean')}
                          </span>
                        </div>
                      )}
                      {frequency !== "none" && hasInputs && (
                        <div className="mt-4 pt-4 border-t border-slate-200/60">
                          <p className="text-sm font-bold text-slate-700 flex justify-between">
                            <span>{t('quote.estimated_yearly')}</span>
                            <span className="text-emerald-700">${yearlyTotal.toFixed(2)}</span>
                          </p>
                        </div>
                      )}
                      
                      <div className="mt-6 pt-6 border-t border-slate-200/60 space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('quote.disclaimer_title')}</p>
                        <p className="text-[11px] leading-relaxed text-slate-500 font-medium italic">
                          {t('quote.disclaimer_text')}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-4">
                  <button 
                    onClick={handleBook}
                    disabled={!hasInputs}
                    className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                      hasInputs 
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-900/20 hover:-translate-y-1" 
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {hasSpecialInstructions ? t('quote.submit_custom_request') : t('quote.book_service_now')}
                  </button>
                  
                  {!user && (
                    <p className="text-sm text-center text-slate-500 font-medium bg-slate-50 py-2 rounded-lg border border-slate-100">
                      {t('quote.account_required_book')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
