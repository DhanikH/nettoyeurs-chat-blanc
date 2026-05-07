
export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  image: string;
}

export const teamMembers: TeamMember[] = [
  {
    id: "didacus",
    name: "Didacus Atiang",
    role: "Cleaning Specialist",
    bio: "Hello, I'm Didacus Atiang, a professional Montreal cleaner. With a background in security, I bring trust, discipline, and meticulous attention to detail to every home I clean. From kitchens to carpets, I take pride in providing reliable, top-tier service to make your space safe, spotless, and welcoming. Bonjour, je suis Didacus Atiang, nettoyeur professionnel à Montréal. Fort d'une expérience en sécurité, j'apporte confiance, rigueur et un grand souci du détail à chaque domicile. Des cuisines aux tapis, je suis fier d'offrir un service fiable pour rendre votre espace sûr, impeccable et accueillant.",
    image: "https://i.ibb.co/zHW01yTG/didacus-profile-picture.jpg"
  },
  {
    id: "akilah",
    name: "Akilah Phillips",
    role: "Cleaning Specialist",
    bio: "Hi, I'm Akilah, a Montreal-based cleaner with 4 years of experience in residential, Airbnb, and commercial spaces. Known for being reliable and detail-oriented, I take pride in delivering efficient, high-quality turnovers and deep cleans to always leave your space spotless and welcoming. Bonjour, je suis Akilah, nettoyeuse à Montréal avec 4 ans d'expérience dans les espaces résidentiels, Airbnb et commerciaux. Reconnue pour ma fiabilité et mon souci du détail, je suis fière d'offrir un nettoyage efficace et de haute qualité pour toujours laisser votre espace impeccable et accueillant.",
    image: "https://i.ibb.co/bDhP1xJ/Akilah-profile-picture.jpg"
  },
  {
    id: "ardo",
    name: "Ardo Esse",
    role: "Cleaning Specialist",
    bio: "Hi everyone! My name is Esse . I’m a reliable and detail oriented cleaner with experience in residential cleaning. I take pride in providing high-quality service and making sure clients feel comfortable and satisfied. I’m excited to be part of the team and look forward to working with you all! Salut tout le monde ! Je m’appelle Esse. Je suis une personne fiable et minutieuse avec de l’expérience en entretien résidentiel. J’aime offrir un service de qualité et m’assurer que les clients sont satisfaits et à l’aise. Je suis contente de faire partie de l’équipe et j’ai hâte de travailler avec vous !",
    image: "https://i.ibb.co/20RPzBgW/Ardo-profile-picture.jpg"
  }
];
