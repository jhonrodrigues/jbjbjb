export type LpTemplate = {
  id: string;
  name: string;
  description: string;
  bestFor: string;
  palette: { primary: string; secondary: string; accent: string };
  fonts: string;
  hero: string;
  sections: string[];
  visual: string;
};

export const LP_TEMPLATES: LpTemplate[] = [
  {
    id: "beauty_premium",
    name: "Beauty Premium",
    description: "Editorial suave, fotografia ampla e acentos quentes.",
    bestFor: "Clínicas de estética, salões e spas",
    palette: { primary: "#2A1712", secondary: "#F7EFE8", accent: "#B76E4D" },
    fonts: "Serifada editorial + sans humanista",
    hero: "Imagem com movimento suave e tipografia editorial",
    sections: ["Hero", "Serviços", "Antes e depois", "Depoimentos", "Agendamento"],
    visual: "Cards macios, muito respiro e detalhes em dourado queimado",
  },
  {
    id: "medical_clean",
    name: "Medical Clean",
    description: "Clareza, confiança e hierarquia objetiva.",
    bestFor: "Odontologia, clínicas e saúde",
    palette: { primary: "#102A43", secondary: "#F4F8FB", accent: "#2D7FF9" },
    fonts: "Sans geométrica + mono para dados",
    hero: "Split screen com prova de confiança",
    sections: ["Hero", "Especialidades", "Equipe", "Credenciais", "Contato"],
    visual: "Bordas finas, azul clínico e ícones lineares",
  },
  {
    id: "corporate_modern",
    name: "Corporate Modern",
    description: "Institucional contemporâneo, denso e direto.",
    bestFor: "Imobiliárias, consultorias e serviços B2B",
    palette: { primary: "#161B22", secondary: "#F3F4F6", accent: "#3B82F6" },
    fonts: "Sans neo-grotesca + display condensada",
    hero: "Split screen com números e CTA",
    sections: ["Hero", "Soluções", "Cases", "Processo", "Contato"],
    visual: "Grid rígido, contraste alto e cartões com borda",
  },
  {
    id: "luxury_minimal",
    name: "Luxury Minimal",
    description: "Poucos elementos, muito contraste e espaço negativo.",
    bestFor: "Arquitetura, estética high-ticket e joalherias",
    palette: { primary: "#111111", secondary: "#F7F5F0", accent: "#A8895B" },
    fonts: "Display serifada + sans neutra",
    hero: "Tipografia grande com imagem em parallax moderado",
    sections: ["Hero", "Manifesto", "Seleção", "Galeria", "Contato"],
    visual: "Linhas editoriais, numeração discreta e dourado contido",
  },
  {
    id: "bold_creative",
    name: "Bold Creative",
    description: "Tipografia expressiva, blocos de cor e energia.",
    bestFor: "Barbearias, academias e marcas jovens",
    palette: { primary: "#101010", secondary: "#F2FF5A", accent: "#FF5C35" },
    fonts: "Display pesada + sans condensada",
    hero: "Tipografia animada com elementos flutuantes",
    sections: ["Hero", "Serviços", "Planos", "Prova social", "Agenda"],
    visual: "Cards com sombra dura, pills e contraste ácido",
  },
  {
    id: "local_business",
    name: "Local Business",
    description: "Próximo, legível e orientado a contato.",
    bestFor: "Restaurantes, pet shops, oficinas e comércio local",
    palette: { primary: "#1C2A1E", secondary: "#F4F1E8", accent: "#E07A3F" },
    fonts: "Sans legível + serifada de apoio",
    hero: "Hero com imagem e selo de bairro",
    sections: ["Hero", "Serviços", "Localização", "Depoimentos", "WhatsApp"],
    visual: "Botões grandes, ícones sólidos e cartões arredondados",
  },
];

export const HERO_OPTIONS = [
  { id: "editorial_minimal", label: "Minimalista editorial" },
  { id: "animated_gradient", label: "Gradiente animado" },
  { id: "floating_elements", label: "Elementos flutuantes" },
  { id: "soft_motion_image", label: "Imagem com movimento suave" },
  { id: "split_screen", label: "Split screen" },
  { id: "animated_type", label: "Tipografia com animação" },
] as const;

export const ANIMATION_OPTIONS = [
  { id: "fade_in", label: "Fade in" },
  { id: "parallax", label: "Parallax moderado" },
  { id: "floating", label: "Elementos flutuantes" },
  { id: "scroll_transitions", label: "Transições no scroll" },
  { id: "hover", label: "Hover" },
  { id: "animated_gradient", label: "Gradiente animado" },
] as const;

export const SECTION_OPTIONS = [
  "Hero",
  "Serviços",
  "Sobre",
  "Antes e depois",
  "Galeria",
  "Depoimentos",
  "Equipe",
  "Planos",
  "Localização",
  "FAQ",
  "Contato",
] as const;

export const DEFAULT_LP_CONFIG = {
  template: "local_business",
  palette: { primary: "#1C2A1E", secondary: "#F4F1E8", accent: "#E07A3F" },
  typography: "Geist",
  headerStyle: "minimal",
  heroStyle: "editorial_minimal",
  sections: ["Hero", "Serviços", "Localização", "Depoimentos", "Contato"],
  buttonStyle: "solid",
  cardStyle: "soft",
  spacing: "balanced",
  effects: ["fade_in", "hover"],
  reducedMotion: true,
};
