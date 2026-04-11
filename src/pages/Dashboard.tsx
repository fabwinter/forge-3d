import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Download, Calendar, Triangle, Boxes } from "lucide-react";
import AssetViewer from "@/components/AssetViewer";
import { supabase } from "@/lib/supabase";
import type { Job, JobStatus } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5 },
  }),
};

const STATUS_COLORS: Record<JobStatus, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  background_removal: "bg-blue-500/20 text-blue-400",
  multiview: "bg-blue-500/20 text-blue-400",
  reconstruction: "bg-blue-500/20 text-blue-400",
  optimising: "bg-blue-500/20 text-blue-400",
  exporting: "bg-blue-500/20 text-blue-400",
  complete: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
};

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Pending",
  background_removal: "Processing",
  multiview: "Processing",
  reconstruction: "Processing",
  optimising: "Processing",
  exporting: "Processing",
  complete: "Complete",
  failed: "Failed",
};

const POLY_LABEL: Record<string, string> = {
  low: "2K polys",
  medium: "8K polys",
  high: "16K polys",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const Dashboard = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchJobs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load assets");
      } else {
        setJobs((data as Job[]) ?? []);
      }
      setLoading(false);
    };

    fetchJobs();
  }, [user]);

  const handleDownload = async (job: Job) => {
    if (!job.output_url) return;
    try {
      const res = await fetch(job.output_url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `meshforge_${job.id}.${(job.format ?? "glb").toLowerCase()}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Download failed. The link may have expired.");
    }
  };

  return (
    <div className="min-h-screen pt-24 px-4 pb-12">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Your Assets</h1>
            <p className="mt-1 text-muted-foreground">
              {loading ? "Loading..." : `${jobs.length} model${jobs.length !== 1 ? "s" : ""} generated`}
            </p>
          </div>
          <Link to="/generate">
            <Button variant="hero" size="sm">
              <Plus className="mr-1 h-4 w-4" />
              New Asset
            </Button>
          </Link>
        </div>

        {/* Loading skeletons */}
        {loading && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <div className="flex justify-between pt-1">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && jobs.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-24 flex flex-col items-center text-center"
          >
            <div className="rounded-2xl border border-dashed border-border bg-card p-12">
              <Boxes className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 font-display text-xl font-semibold">No assets yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Upload your first concept art to generate a 3D model.
              </p>
              <Link to="/generate" className="mt-6 inline-block">
                <Button variant="hero">Create your first asset</Button>
              </Link>
            </div>
          </motion.div>
        )}

        {/* Asset grid */}
        {!loading && jobs.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {jobs.map((job, i) => (
              <motion.div
                key={job.id}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={i}
                className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/30"
              >
                {/* 3D Preview / placeholder */}
                <div className="relative h-48 w-full bg-secondary grid-bg">
                  <AssetViewer
                    mini
                    glbUrl={job.status === "complete" && job.output_url ? job.output_url : undefined}
                  />
                </div>

                <div className="p-4">
                  {/* Status badge */}
                  <div className="mb-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[job.status]
                      }`}
                    >
                      {STATUS_LABEL[job.status]}
                    </span>
                  </div>

                  {/* Meta */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(job.created_at)}
                    </span>
                    {job.poly_budget && (
                      <span className="flex items-center gap-1">
                        <Triangle className="h-3 w-3" />
                        {POLY_LABEL[job.poly_budget]}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    {job.format && (
                      <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
                        {job.format}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs ml-auto"
                      disabled={job.status !== "complete" || !job.output_url}
                      onClick={() => handleDownload(job)}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Download
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
