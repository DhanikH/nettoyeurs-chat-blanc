
export interface Testimonial {
  id: string;
  name: string;
  role: string;
  text: string;
  initial: string;
}

export const testimonials: Testimonial[] = [
  {
    id: "testimonial-1",
    name: "Sarah Jenkins",
    role: "Homeowner",
    text: "Absolutely incredible service. They transformed my house before hosting a major family event. The attention to detail was unmatched.",
    initial: "S"
  },
  {
    id: "testimonial-2",
    name: "Michael Chen",
    role: "Busy Professional",
    text: "I've tried several cleaning services, but none compare to this. The eco-friendly products smell amazing and my home feels truly fresh.",
    initial: "M"
  },
  {
    id: "testimonial-3",
    name: "Emily Rodriguez",
    role: "Recent Mover",
    text: "The move-out clean was spectacular. My landlord was so impressed I got my full deposit back without a single question.",
    initial: "E"
  }
];
