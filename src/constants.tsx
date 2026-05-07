import { Sun, ChefHat, Sparkles, Layers } from "lucide-react";

export const addons = [
  { id: 'interior_windows', name: 'Interior Windows', pricePerHour: 47.5, icon: Sun },
  { id: 'inside_oven', name: 'Inside Oven', pricePerHour: 38, icon: ChefHat },
  { id: 'inside_fridge', name: 'Inside Fridge', pricePerHour: 28.5, icon: Sparkles },
  { id: 'laundry_folding', name: 'Load of Laundry', pricePerHour: 19, icon: Layers },
];

export const addonData = addons.map(({ icon, ...rest }) => rest);
