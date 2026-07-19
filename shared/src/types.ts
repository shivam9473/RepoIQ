export type UserRole = "user" | "admin";

export interface User {
  id: string;
  githubId: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  accessToken: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export type IndexingStatus =
  | "pending"
  | "cloning"
  | "parsing"
  | "embedding"
  | "storing"
  | "ready"
  | "failed";

export interface Repository {
  id: string;
  userId: string;
  githubId: number;
  fullName: string;
  name: string;
  owner: string;
  description: string | null;
  defaultBranch: string;
  isPrivate: boolean;
  language: string | null;
  cloneUrl: string;
  htmlUrl: string;
  status: IndexingStatus;
  progress: number;
  statusMessage: string | null;
  errorMessage: string | null;
  totalFiles: number;
  totalChunks: number;
  totalEmbeddings: number;
  totalFunctions: number;
  totalClasses: number;
  lastIndexedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ChunkKind =
  | "function"
  | "class"
  | "method"
  | "interface"
  | "module"
  | "type"
  | "other";

export interface CodeChunk {
  id: string;
  repositoryId: string;
  filePath: string;
  language: string;
  kind: ChunkKind;
  name: string;
  signature: string | null;
  content: string;
  startLine: number;
  endLine: number;
  parentName: string | null;
  hash: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: CodeCitation[];
  createdAt: string;
}

export interface CodeCitation {
  filePath: string;
  name: string;
  kind: ChunkKind;
  startLine: number;
  endLine: number;
  score?: number;
}

export interface Conversation {
  id: string;
  userId: string;
  repositoryId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchHistoryItem {
  id: string;
  userId: string;
  repositoryId: string;
  query: string;
  createdAt: string;
}

export interface DashboardStats {
  repositories: number;
  readyRepos: number;
  indexingRepos: number;
  totalFiles: number;
  totalFunctions: number;
  totalClasses: number;
  totalEmbeddings: number;
  recentChats: Conversation[];
  searchHistory: SearchHistoryItem[];
}

export interface DependencyNode {
  id: string;
  label: string;
  type: "file" | "module" | "package";
  language?: string;
}

export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface ArchitectureOverview {
  summary: string;
  layers: { name: string; description: string; files: string[] }[];
  entryPoints: string[];
  keyModules: { name: string; purpose: string }[];
}

export interface IndexingJobPayload {
  repositoryId: string;
  userId: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "go",
  "cpp",
  "c",
  "rust",
  "ruby",
  "php",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const QUEUE_NAMES = {
  INDEXING: "repo-indexing",
} as const;

export const EXTENSION_LANGUAGE_MAP: Record<string, SupportedLanguage> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".java": "java",
  ".go": "go",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".c": "c",
  ".h": "c",
  ".hpp": "cpp",
  ".rs": "rust",
  ".rb": "ruby",
  ".php": "php",
};
