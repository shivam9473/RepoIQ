import type { Repository } from "@codeatlas/shared";

type RepoRow = {
  id: string;
  user_id: string;
  github_id: string;
  full_name: string;
  name: string;
  owner: string;
  description: string | null;
  default_branch: string;
  is_private: boolean;
  language: string | null;
  clone_url: string;
  html_url: string;
  status: Repository["status"];
  progress: number;
  status_message: string | null;
  error_message: string | null;
  total_files: number;
  total_chunks: number;
  total_embeddings: number;
  total_functions: number;
  total_classes: number;
  last_indexed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export function mapRepo(row: RepoRow): Repository {
  return {
    id: row.id,
    userId: row.user_id,
    githubId: Number(row.github_id),
    fullName: row.full_name,
    name: row.name,
    owner: row.owner,
    description: row.description,
    defaultBranch: row.default_branch,
    isPrivate: row.is_private,
    language: row.language,
    cloneUrl: row.clone_url,
    htmlUrl: row.html_url,
    status: row.status,
    progress: row.progress,
    statusMessage: row.status_message,
    errorMessage: row.error_message,
    totalFiles: row.total_files,
    totalChunks: row.total_chunks,
    totalEmbeddings: row.total_embeddings,
    totalFunctions: row.total_functions,
    totalClasses: row.total_classes,
    lastIndexedAt: row.last_indexed_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
