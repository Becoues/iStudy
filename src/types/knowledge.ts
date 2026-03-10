export interface KnowledgeQuiz {
  question: string;
  options: string[];
  hint: string;
  answer: string;
  explanation: string;
}

export interface KnowledgeItemData {
  title: string;
  difficulty: "basic" | "intermediate" | "advanced";
  summary: string;
  details: string;
  mermaid: string | null;
  quiz: KnowledgeQuiz;
  imageUrl?: string;
}

export interface GenerationResponse {
  tags: string[];
  items: KnowledgeItemData[];
}

export interface ExpansionResponse {
  items: KnowledgeItemData[];
}

export interface KnowledgeItemWithChildren {
  id: string;
  moduleId: string;
  parentId: string | null;
  orderIndex: number;
  title: string;
  difficulty: string;
  content: KnowledgeItemData;
  depth: number;
  children: KnowledgeItemWithChildren[];
  commentCount: number;
}

export interface ModuleListItem {
  id: string;
  topic: string;
  tags: string[];
  itemCount: number;
  status: string;
  createdAt: string;
}

export interface CommentData {
  id: string;
  itemId: string;
  content: string;
  createdAt: string;
}

export interface SettingsData {
  provider: string;
  apiKey: string;
  model: string;
}
