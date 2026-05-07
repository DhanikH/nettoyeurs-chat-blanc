import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { formatDate, formatTime, formatDateTime, formatDateISO } from "../utils/dateUtils";
import { useAuth } from "../context/AuthContext";
import { motion } from "motion/react";
import { Calculator, Bed, Bath, Layout, Grid, Sparkles, ChefHat, Layers, Sun, Briefcase, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TermsModal } from "../components/TermsModal";
import { addons } from "../constants";

export default function Quote() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  
  const [sqftTier, setSqftTier] = useState<string>("");
  const [beds, setBeds] = useState<string>("");
  const [fullBaths, setFullBaths] = useState<string>("");
  const [halfBaths, setHalfBaths] = useState<string>("");
  const [kitchens, setKitchens] = useState<string>("");
  const [livingRooms, setLivingRooms] = useState<string>("");
  const [offices, setOffices] = useState<string>("");
  const [floors, setFloors] = useState<string>("");
  const [windowCleaning, setWindowCleaning] = useState<boolean>(false);
  const [ovenCleaning, setOvenCleaning] = useState<boolean>(false);
  const [deepCleaning, setDeepCleaning] = useState<boolean>(false);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<"none" | "monthly" | "biweekly" | "weekly">("none");

  const [specialInstructions, setSpecialInstructions] = useState<string>("");
  const [bookingType, setBookingType] = useState<"exact" | "range">("range");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledEndDate, setScheduledEndDate] = useState<string>("");
  const [timeFrame, setTimeFrame] = useState<string>("morning");
  const [timeTravelError, setTimeTravelError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");

  useEffect(() => {
    setTimeTravelError(null);
  }, [scheduledDate, timeFrame]);

  useEffect(() => {
    if (user && user.role === 'homeowner') {
      fetch(`/api/properties/${user.id}`)
        .then(res => res.json())
        .then(data => {
          setProperties(data);
          
          const pendingQuote = localStorage.getItem('pendingQuote');
          if (pendingQuote) {
            try {
              const quote = JSON.parse(pendingQuote);
              setSelectedPropertyId(quote.property_id);
              setScheduledDate(quote.scheduled_date || "");
              setScheduledEndDate(quote.scheduled_end_date || "");
              setTimeFrame(quote.time_frame);
              try {
                const parsed = JSON.parse(quote.special_instructions);
                setSpecialInstructions(parsed.instructions || "");
              } catch (e) {
                setSpecialInstructions(quote.special_instructions || "");
              }
              setWindowCleaning(!!quote.window_cleaning);
              setOvenCleaning(!!quote.oven_cleaning);
              setDeepCleaning(!!quote.deep_cleaning);
              setFrequency(quote.frequency || "none");
              setBookingType(quote.scheduled_end_date ? "range" : "exact");
              
              const prop = data.find((p: any) => p.id === quote.property_id);
              if (prop) {
                setBeds(prop.bedrooms.toString());
                setFullBaths(prop.bathrooms.toString());
                setHalfBaths("0");
                setKitchens(prop.kitchens?.toString() || "0");
                setLivingRooms(prop.living_rooms.toString());
                setOffices(prop.offices.toString());
                if (prop.square_feet < 1000) setSqftTier("under_1000");
                else if (prop.square_feet < 1500) setSqftTier("1000_1500");
                else if (prop.square_feet < 2000) setSqftTier("1500_2000");
                else if (prop.square_feet < 2500) setSqftTier("2000_2500");
                else if (prop.square_feet < 3000) setSqftTier("2500_3000");
                else setSqftTier("over_3000");
              }
              localStorage.removeItem('pendingQuote');
            } catch (e) {
              console.error("Error parsing pendingQuote:", e);
              localStorage.removeItem('pendingQuote');
            }
            return;
          }

          const state = location.state as any;
          if (state?.propertyId) {
            setSelectedPropertyId(state.propertyId);
            const prop = data.find((p: any) => p.id === state.propertyId);
            if (prop && !state.lastJob) {
              // Pre-fill from property defaults if no last job
              setBeds(prop.bedrooms.toString());
              setFullBaths(prop.bathrooms.toString());
              setHalfBaths("0");
              setKitchens(prop.kitchens?.toString() || "0");
              setLivingRooms(prop.living_rooms.toString());
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
            try {
              const parsed = JSON.parse(lastJob.special_instructions);
              setSpecialInstructions(parsed.instructions || "");
            } catch (e) {
              setSpecialInstructions(lastJob.special_instructions || "");
            }
            setWindowCleaning(!!lastJob.window_cleaning);
            setOvenCleaning(!!lastJob.oven_cleaning);
            setDeepCleaning(!!lastJob.deep_cleaning);
            setFrequency(lastJob.frequency || "none");
            
            // If we have last job, we should probably also pre-fill property details
            const prop = data.find((p: any) => p.id === lastJob.property_id);
            if (prop) {
              setBeds(prop.bedrooms.toString());
              setFullBaths(prop.bathrooms.toString());
              setHalfBaths("0");
              setKitchens(prop.kitchens?.toString() || "0");
              setLivingRooms(prop.living_rooms.toString());
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
  }, [sqftTier, beds, fullBaths, halfBaths, kitchens, livingRooms, offices, floors, windowCleaning, ovenCleaning, deepCleaning, specialInstructions]);

  const addonPrice = selectedAddons.reduce((sum, id) => sum + ((addons.find(a => a.id === id)?.pricePerHour || 0) * 0.5), 0);

  const toggleAddon = (id: string) => {
    setSelectedAddons(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const sqftPricing: Record<string, number> = {
    "under_1000": 19,
    "1000_1500": 47.5,
    "1500_2000": 66.5,
    "2000_2500": 85.5,
    "2500_3000": 104.5,
    "over_3000": 133,
  };
  
  const parsedBeds = Number(beds) || 0;
  const parsedFullBaths = Number(fullBaths) || 0;
  const parsedHalfBaths = Number(halfBaths) || 0;
  const parsedKitchens = Number(kitchens) || 0;
  const parsedLivingRooms = Number(livingRooms) || 0;
  const parsedOffices = Number(offices) || 0;
  const parsedFloors = Number(floors) || 0;

  const today = new Date();
  const maxDate = new Date(today);
  maxDate.setMonth(today.getMonth() + 1);
  const maxDateISO = formatDateISO(maxDate);

  const isDateValid = bookingType === 'exact' ? !!scheduledDate : (!!scheduledDate && !!scheduledEndDate);
  const hasInputs = (sqftTier !== "" || beds !== "" || fullBaths !== "" || halfBaths !== "" || kitchens !== "" || livingRooms !== "" || offices !== "" || floors !== "") && isDateValid;
  const hasSpecialInstructions = specialInstructions.trim().length > 0;
  
  const sqftPrice = sqftTier ? sqftPricing[sqftTier] : 0;
  const floorsSurcharge = parsedFloors > 1 ? (parsedFloors - 1) * 9.5 : 0;
  const baseFee = hasInputs ? 23.75 : 0;
  
  // $23.75 (Base) + (Sqft Tier) + ($9.5 * beds) + ($14.25 * fullBaths) + ($9.5 * halfBaths) + ($19 * kitchens) + ($9.5 * livingRooms) + ($19 * offices) + ($9.5 * extra floors) + ($38 if windows) + ($14.25 if oven)
  const basePriceBeforeDeepClean = baseFee + sqftPrice + (9.5 * parsedBeds) + (14.25 * parsedFullBaths) + (9.5 * parsedHalfBaths) + (19 * parsedKitchens) + (9.5 * parsedLivingRooms) + (19 * parsedOffices) + floorsSurcharge + (windowCleaning ? 38 : 0) + (ovenCleaning ? 14.25 : 0) + addonPrice;
  const basePrice = deepCleaning ? basePriceBeforeDeepClean * 1.5 : basePriceBeforeDeepClean;
  
  let finalPrice = basePrice;

  // Apply frequency discount
  if (frequency === "monthly") finalPrice *= 0.90;
  else if (frequency === "biweekly") finalPrice *= 0.85;
  else if (frequency === "weekly") finalPrice *= 0.80;

  // Apply postal code discount sequentially
  const property = properties.find(p => p.id === selectedPropertyId);
  const postalCode = property?.postal_code?.toLowerCase().replace(/\s/g, '');
  if (['h3c0y9', 'h4r3j8'].includes(postalCode || '')) {
    finalPrice *= 0.95; // Apply additional 5% discount to the already discounted price
  }

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
      setNotification(t('quote.account_required_book') || "Please log in or create an account to book a service.");
      setTimeout(() => setNotification(null), 5000);
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selectedDateObj = new Date(scheduledDate + 'T00:00:00');
    
    // Time-travel validation
    const now = new Date();
    const montrealNow = new Date(now.toLocaleString("en-US", {timeZone: "America/Montreal"}));
    
    const selectedDateOnly = new Date(selectedDateObj.toDateString());
    const todayOnly = new Date(montrealNow.toDateString());
    
    if (scheduledDate && selectedDateOnly < todayOnly) {
      setTimeTravelError("The selected starting date and time have already passed. Please select a valid future date and time to continue.");
      return;
    }
    
    if (scheduledDate && selectedDateOnly.getTime() === todayOnly.getTime()) {
      const currentHour = montrealNow.getHours();
      const frameEnds: Record<string, number> = {
        early_morning: 8,
        morning: 12,
        afternoon: 17,
        evening: 20,
        night: 24
      };
      
      if (frameEnds[timeFrame] && currentHour >= frameEnds[timeFrame]) {
        setTimeTravelError("The selected starting date and time have already passed. Please select a valid future date and time to continue.");
        return;
      }
    }

    if (bookingType === 'range' && scheduledEndDate && new Date(scheduledEndDate + 'T00:00:00') < today) {
      alert("You cannot book a service for a date that has already passed.");
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
          full_bathrooms: parsedFullBaths,
          half_bathrooms: parsedHalfBaths,
          kitchens: parsedKitchens,
          living_rooms: parsedLivingRooms,
          offices: parsedOffices,
          floors: parsedFloors,
          calculated_base_price: basePrice,
          final_transaction_price: finalPrice,
          special_instructions: JSON.stringify({
            instructions: specialInstructions.trim(),
            selected_addons: selectedAddons,
            time_frame: timeFrame
          }),
          window_cleaning: windowCleaning,
          oven_cleaning: ovenCleaning,
          deep_cleaning: deepCleaning,
          frequency: frequency
        })
      });
      const data = await res.json();

      if (!res.ok) {
        console.error("Error creating job:", data.error);
        if (res.status === 402) {
          localStorage.setItem('pendingQuote', JSON.stringify({
            property_id: selectedPropertyId,
            scheduled_date: scheduledDate,
            scheduled_end_date: bookingType === 'range' ? scheduledEndDate : null,
            time_frame: timeFrame,
            full_bathrooms: parsedFullBaths,
            half_bathrooms: parsedHalfBaths,
            kitchens: parsedKitchens,
            living_rooms: parsedLivingRooms,
            offices: parsedOffices,
            floors: parsedFloors,
            calculated_base_price: basePrice,
            final_transaction_price: finalPrice,
            special_instructions: JSON.stringify({
              instructions: specialInstructions.trim(),
              selected_addons: selectedAddons,
              time_frame: timeFrame
            }),
            window_cleaning: windowCleaning,
            oven_cleaning: ovenCleaning,
            deep_cleaning: deepCleaning,
            frequency: frequency
          }));
          
          setNotification(t('quote.payment_method_required') || "A payment method is required to secure your booking. You won't be charged until you confirm your service.");
          setTimeout(() => {
            setNotification(null);
            navigate("/settings?addCard=true");
          }, 3000);
        } else {
          alert(t('quote.error_booking') + ": " + (data.error || t('quote.unknown_error')));
        }
        return;
      }

      setShowCelebration(true);
    } catch (err) {
      console.error(err);
      alert(t('quote.error_booking_retry'));
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-4 md:py-8 space-y-8 md:space-y-12 pb-24 px-4">
      <div className="text-center mb-8 md:mb-16 pt-4 md:pt-8">
        <h2 className="text-4xl md:text-5xl font-bold font-display text-slate-900 tracking-tight">{t('quote.title')}</h2>
        <p className="text-lg md:text-xl text-slate-600 mt-4 max-w-2xl mx-auto font-light">{t('quote.subtitle')}</p>
      </div>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col lg:flex-row"
      >
        <div className="p-6 md:p-10 lg:w-3/5 space-y-10 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-100">
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
                className="w-full px-4 py-3 md:px-5 md:py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-white text-slate-700 font-medium shadow-sm appearance-none cursor-pointer"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-3">
                <label className="flex items-start flex-wrap gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                  <Bed className="h-4 w-4 mt-0.5 text-emerald-600" /> {t('quote.bedrooms')}
                </label>
                <input 
                  type="number" 
                  value={beds}
                  onChange={(e) => setBeds(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 md:px-5 md:py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
                  min="0"
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-start flex-wrap gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                  <Bath className="h-4 w-4 mt-0.5 text-emerald-600" /> {t('quote.full_bathrooms')}
                </label>
                <input 
                  type="number" 
                  value={fullBaths}
                  onChange={(e) => setFullBaths(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 md:px-5 md:py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
                  min="0"
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-start flex-wrap gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                  <Bath className="h-4 w-4 mt-0.5 text-emerald-600" /> {t('quote.half_bathrooms')}
                </label>
                <input 
                  type="number" 
                  value={halfBaths}
                  onChange={(e) => setHalfBaths(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 md:px-5 md:py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
                  min="0"
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-start flex-wrap gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                  <ChefHat className="h-4 w-4 mt-0.5 text-emerald-600" /> {t('quote.kitchens')}
                </label>
                <input 
                  type="number" 
                  value={kitchens}
                  onChange={(e) => setKitchens(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 md:px-5 md:py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
                  min="0"
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-start flex-wrap gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                  <Layout className="h-4 w-4 mt-0.5 text-emerald-600" /> {t('quote.common_areas')}
                </label>
                <input 
                  type="number" 
                  value={livingRooms}
                  onChange={(e) => setLivingRooms(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 md:px-5 md:py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
                  min="0"
                />
              </div>
              <div className="space-y-3">
                <label className="flex items-start flex-wrap gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                  <Briefcase className="h-4 w-4 mt-0.5 text-emerald-600" /> {t('quote.offices')}
                </label>
                <input 
                  type="number" 
                  value={offices}
                  onChange={(e) => setOffices(e.target.value)}
                  placeholder="0"
                  className="w-full px-4 py-3 md:px-5 md:py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
                  min="0"
                />
              </div>
              <div className="space-y-3 md:col-span-2">
                <label className="flex items-start flex-wrap gap-2 text-sm font-bold text-slate-700 uppercase tracking-wider">
                  <Layers className="h-4 w-4 mt-0.5 text-emerald-600" /> {t('quote.floors')}
                </label>
                <input 
                  type="number" 
                  value={floors}
                  onChange={(e) => setFloors(e.target.value)}
                  placeholder="1"
                  className="w-full px-4 py-3 md:px-5 md:py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addons.map(addon => {
                  const Icon = addon.icon;
                  const isSelected = selectedAddons.includes(addon.id);
                  return (
                    <div
                      key={addon.id}
                      onClick={() => toggleAddon(addon.id)}
                      className={`cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center justify-between ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-200'}`}
                    >
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={isSelected} onChange={() => {}} className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 transition-colors cursor-pointer" />
                        <Icon className="h-5 w-5 text-slate-500" />
                        <span className="text-sm font-bold text-slate-900">{addon.name}</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md">+${addon.pricePerHour.toFixed(2)}/hr</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                * All add-ons are charged per 30 minutes, with a minimum of 30 minutes.
              </p>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {bookingType === 'range' ? t('quote.start_date') : t('quote.preferred_date')}
                  </label>
                  <input 
                    type="date" 
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full px-4 py-3 md:px-5 md:py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
                    min={formatDateISO(new Date())}
                    max={maxDateISO}
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
                      className="w-full px-4 py-3 md:px-5 md:py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium shadow-sm"
                      min={scheduledDate || formatDateISO(new Date())}
                      max={maxDateISO}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {t('quote.preferred_time_frame')}
                </label>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    {[
                      { id: 'early_morning', label: t('quote.early_morning'), time: t('quote.early_morning_time') },
                      { id: 'morning', label: t('quote.morning'), time: t('quote.morning_time') },
                      { id: 'afternoon', label: t('quote.afternoon'), time: t('quote.afternoon_time') },
                      { id: 'evening', label: t('quote.evening'), time: t('quote.evening_time') },
                      { id: 'night', label: t('quote.night'), time: t('quote.night_time') },
                    ].map((tf) => (
                      <button
                        key={tf.id}
                        type="button"
                        onClick={() => setTimeFrame(tf.id)}
                        className={`p-3 rounded-xl border-2 transition-all text-center flex flex-col items-center gap-1 ${
                          timeFrame === tf.id 
                            ? 'border-emerald-500 bg-emerald-50' 
                            : 'border-slate-100 bg-white hover:border-slate-200'
                        }`}
                      >
                        <span className={`text-sm font-bold ${timeFrame === tf.id ? 'text-emerald-900' : 'text-slate-700'}`}>
                          {tf.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {tf.time}
                        </span>
                      </button>
                    ))}
                  </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:w-2/5 flex flex-col bg-white relative">
          {!showQuote && !isCalculating && (
            <div className="p-6 md:p-10 flex flex-col items-center justify-center h-full text-center">
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
            <div className="p-6 md:p-10 flex flex-col items-center justify-center h-full space-y-8 text-center">
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
            <div className="p-6 md:p-10 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                      {Array.isArray(properties) && properties.map(p => (
                        <option key={p.id} value={p.id}>{p.address || t('quote.unnamed_property')}</option>
                      ))}
                    </select>
                    {['h3c0y9', 'h4r3j8'].includes(properties.find(p => p.id === selectedPropertyId)?.postal_code?.toLowerCase().replace(/\s/g, '') || '') && (
                      <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
                        <Sparkles className="h-6 w-6 text-emerald-600" />
                        <div>
                          <p className="text-sm text-emerald-900 font-bold">🎉 location discount applied</p>
                          <p className="text-xs text-emerald-700">Your postal code qualifies for a location discount.</p>
                        </div>
                      </div>
                    )}
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
                      <p className="text-sm text-slate-500 font-bold uppercase tracking-wider mb-2">
                        {selectedAddons.length > 0 ? "Estimated Total Price" : t('dashboard.total_price')}
                      </p>
                      <div className="flex items-baseline gap-3 flex-wrap mb-2">
                        <span className="text-5xl font-bold font-display text-slate-900">${finalPrice.toFixed(2)}</span>
                        {frequencyText && (
                          <span className="text-xl font-medium text-slate-500">{frequencyText}</span>
                        )}
                      </div>
                      {selectedAddons.length > 0 && (
                        <p className="text-xs text-slate-500 mt-2">
                          * Note: Add-ons are billed based on actual time spent.
                        </p>
                      )}
                      {savings > 0 && (
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
                  <label className="flex items-start gap-3 text-sm text-slate-600">
                    <input 
                      type="checkbox" 
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      I have read and agree to the <button onClick={() => setShowTermsModal(true)} className="font-bold text-emerald-600 hover:underline">Terms and Conditions</button> regarding the 36-hour cancellation policy, property accuracy, and recurring plan commitments.
                    </span>
                  </label>
                  <button 
                    onClick={handleBook}
                    disabled={!hasInputs || !termsAccepted}
                    className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                      hasInputs && termsAccepted
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-900/20 hover:-translate-y-1" 
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {hasSpecialInstructions ? t('quote.submit_custom_request') : t('quote.book_service_now')}
                  </button>
                  {timeTravelError && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-red-50 text-red-800 rounded-2xl border border-red-200 text-sm font-medium text-center"
                    >
                      {timeTravelError}
                    </motion.div>
                  )}
                  {notification && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="p-4 bg-amber-50 text-amber-800 rounded-2xl border border-amber-200 text-sm font-medium text-center"
                    >
                      {notification}
                      <button onClick={() => navigate('/login')} className="block w-full mt-2 text-amber-900 underline font-bold">Log in / Sign up</button>
                    </motion.div>
                  )}
                  
                  {!user && (
                    <p className="text-sm text-center text-slate-500 font-medium bg-slate-50 py-2 rounded-lg border border-slate-100">
                      {t('quote.account_required_book')}
                    </p>
                  )}
                </div>
                <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
              </div>
            </div>
          )}
        </div>
      </motion.div>
      {showCelebration && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center p-8 bg-white rounded-3xl shadow-2xl border border-slate-100"
          >
            <Sparkles className="h-24 w-24 text-emerald-500 mx-auto mb-6 animate-bounce" />
            <h2 className="text-4xl font-bold font-display text-slate-900 mb-4">Thank you for booking your cleaning.</h2>
            <p className="text-slate-600 mb-8">Your booking is confirmed.</p>
            <button 
              onClick={() => navigate("/dashboard")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-2xl transition-all"
            >
              Go to Dashboard
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
