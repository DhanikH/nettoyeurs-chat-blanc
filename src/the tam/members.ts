
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  image: string;
}

export const teamMembers: TeamMember[] = [
  {
    id: "jessica",
    name: "Jessica Benjamin",
    role: "Cleaning Specialist",
    bio: "Jessica is a dedicated professional with a keen eye for detail and a passion for creating spotless, welcoming environments.",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "didacus",
    name: "Didacus Okoth Atiang",
    role: "Cleaning Specialist",
    bio: "Didacus brings years of experience and a commitment to excellence, ensuring every home he touches shines.",
    image: "https://images.unsplash.com/photo-1556157382-97eda2d62296?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "elena",
    name: "Elena Rodriguez",
    role: "Lead Cleaning Specialist",
    bio: "With over 10 years of experience, Elena ensures every home meets our rigorous 50-point quality standard.",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "marc",
    name: "Marc Chen",
    role: "Operations Manager",
    bio: "Marcus coordinates our teams to ensure we are always on time, fully equipped, and ready to transform your space.",
    image: "https://images.unsplash.com/photo-1556157382-97eda2d62296?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "sarah",
    name: "Sarah Jenkins",
    role: "Eco-Cleaning Expert",
    bio: "Sarah specializes in non-toxic, pet-safe cleaning solutions that leave your home fresh without harsh chemicals.",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
  }
];
