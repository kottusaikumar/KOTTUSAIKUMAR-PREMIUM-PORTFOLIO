// Skills-grid content: one entry per tech badge shown in the
// "My Skills" section. Each entry either points at a colored
// simpleicons.org logo (`slug`) or supplies its own inline
// SVG / lucide icon (`icon`) for logos simpleicons renders poorly
// on this dark background.
import type { ReactNode } from "react";
import { Brain, Cpu, MessageSquare } from "lucide-react";
import {
  IconCSS3,
  IconFlask,
  IconThreeJs,
  IconTableau,
  IconPowerBI,
  IconGitHub,
  IconVSCode,
} from "./skills.icons";

export const SKILLS: {
  name: string;
  slug?: string;
  colored?: boolean;
  icon?: ReactNode;
}[] = [
  { name: "Python", slug: "python", colored: true },
  { name: "C++", slug: "cplusplus", colored: true },
  { name: "PostgreSQL", slug: "postgresql", colored: true },
  { name: "Machine Learning", icon: <Brain size={36} /> },
  { name: "Deep Learning", icon: <Cpu size={36} /> },
  { name: "NLP", icon: <MessageSquare size={36} /> },
  { name: "React", slug: "react", colored: true },
  { name: "HTML5", slug: "html5", colored: true },
  { name: "CSS3", icon: <IconCSS3 /> },
  { name: "TensorFlow", slug: "tensorflow", colored: true },
  { name: "PyTorch", slug: "pytorch", colored: true },
  { name: "Keras", slug: "keras", colored: true },
  { name: "Pandas", slug: "pandas", colored: true },
  { name: "NumPy", slug: "numpy", colored: true },
  { name: "Scikit-learn", slug: "scikitlearn", colored: true },
  { name: "LangChain", slug: "langchain", colored: true },
  { name: "FastAPI", slug: "fastapi", colored: true },
  { name: "Flask", icon: <IconFlask /> },
  { name: "Streamlit", slug: "streamlit", colored: true },
  { name: "Three.js", icon: <IconThreeJs /> },
  { name: "Tableau", icon: <IconTableau /> },
  { name: "Power BI", icon: <IconPowerBI /> },
  { name: "Docker", slug: "docker", colored: true },
  { name: "Git", slug: "git", colored: true },
  { name: "GitHub", icon: <IconGitHub /> },
  { name: "VS Code", icon: <IconVSCode /> },
];

// Resolve a simpleicons.org logo URL for a given skill slug.
// White variant is used when the section background is dark.
export function skillIconUrl(slug: string, colored?: boolean) {
  return colored
    ? `https://cdn.simpleicons.org/${slug}`
    : `https://cdn.simpleicons.org/${slug}/ffffff`;
}

// Render whichever icon representation a skill entry has:
// a fetched simpleicons logo, or a locally-defined icon component.
export function renderSkillIcon(s: {
  slug?: string;
  colored?: boolean;
  icon?: ReactNode;
  name: string;
}) {
  if (s.slug) {
    return (
      <img
        src={skillIconUrl(s.slug, s.colored)}
        alt={s.name}
        loading="lazy"
        width={36}
        height={36}
      />
    );
  }
  return <>{s.icon}</>;
}
