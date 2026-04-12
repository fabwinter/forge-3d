import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
      "must be set in your Vercel project settings (or .env.local for local dev)."
  );
}

export type JobStatus =
  | "pending"
  | "background_removal"
  | "multiview"
  | "reconstruction"
  | "optimising"
  | "exporting"
  | "complete"
  | "failed";

export type PolyBudget = "low" | "medium" | "high";
export type TextureRes = 512 | 1024 | 2048;
export type ExportFormat = "GLB" | "OBJ" | "FBX";
export type Plan = "free" | "indie" | "studio" | "pro";

export interface Profile {
  id: string;
  email: string;
  plan: Plan;
  generations_used: number;
  generations_limit: number;
  created_at: string;
}

export interface Job {
  id: string;
  user_id: string;
  status: JobStatus;
  poly_budget: PolyBudget | null;
  texture_res: TextureRes | null;
  format: ExportFormat | null;
  input_url: string | null;
  output_url: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at"> & { created_at?: string };
        Update: Partial<Profile>;
      };
      jobs: {
        Row: Job;
        Insert: Omit<Job, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Job>;
      };
    };
  };
}

export const supabase = createClient<Database>(supabaseUrl!, supabaseAnonKey!);
