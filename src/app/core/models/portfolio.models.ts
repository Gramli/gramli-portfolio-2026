export interface Project {
  id: string;
  title: string;
  description: string;
  problemStatement: string;
  solution: string;
  technologies: string[];
  role: string;
  liveUrl?: string;
  sourceUrl?: string;
  imageUrl?: string;
  type?: 'commercial' | 'personal';
  status: 'online' | 'offline' | 'archived' | 'in-development';
}

export interface SkillItem {
  name: string;
  hidden?: boolean;
}

export interface SkillCategory {
  name: string;
  skills: SkillItem[];
  icon?: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface Profile {
  name: string;
  role: string;
  shortBio: string;
  longBio: string;
  philosophy: string;
  email: string;
  github: string;
  linkedin: string;
  devto?: string;
  blog?: string;
  location: string;
  avatarUrl?: string;
  stats: Stat[];
}
