
export interface Rating {
  id: string;
  name: string;
  role: string;
  text: string;
  stars: number;
}

export const ratings: Rating[] = [
  {
    id: "rating-1",
    name: "Sarah Jenkins",
    role: "Homeowner",
    text: "Absolutely incredible service. They transformed my house before hosting a major family event. The attention to detail was unmatched.",
    stars: 5
  },
  {
    id: "rating-2",
    name: "Michael Chen",
    role: "Busy Professional",
    text: "I've tried several cleaning services, but none compare to this. The eco-friendly products smell amazing and my home feels truly fresh.",
    stars: 5
  },
  {
    id: "rating-3",
    name: "Emily Rodriguez",
    role: "Recent Mover",
    text: "The move-out clean was spectacular. My landlord was so impressed I got my full deposit back without a single question.",
    stars: 5
  }
];
