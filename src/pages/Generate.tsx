import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Upload, X, Download, Check, Loader2, Image as ImageIcon } from "lucide-react";
import AssetViewer from "@/components/AssetViewer";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { JobStatus, PolyBudget, TextureRes, ExportFormat } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const API_URL = import.meta.env.VITE_API_URL as string | undefined;

const STEPS: { label: string; status: JobStatus }[] = [
  { label: "Removing background...", status: "background_removal" },
  { label: "Generating multi-view...", status: "multiview" },
  { label: "Reconstructing mesh...", status: "reconstruction" },
  { label: "Optimising for game engine...", status: "optimising" },
  { label: "Finalising export...", status: "exporting" },
];

const statusToStepIndex = (status: JobStatus): number => {
  const map: Record<JobStatus, number> = {
    pending: -1,
    background_removal: 0,
    multiview: 1,
    reconstruction: 2,
    optimising: 3,
    exporting: 4,
    complete: 5,
    failed: -2,
  };
  return map[status] ?? -1;
};

const Generate = () => {
  const { user, session } = useAuth();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [complete, setComplete] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [glbUrl, setGlbUrl] = useState<string | undefined>(undefined);
  const [jobId, setJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [polyCount, setPolyCount] = useState<PolyBudget>("medium");
  const [textureRes, setTextureRes] = useState<TextureRes>(1024);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("GLB");

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, or WEBP)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }
    setImageFile(file);
    setFileName(file.name);
    setComplete(false);
    setCurrentStep(-1);
    setGlbUrl(undefined);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleGenerateReal = async () => {
    if (!imageFile) return;
    if (!user || !session) {
      toast.error("You must be signed in to generate assets.");
      return;
    }
    if (!API_URL) {
      toast.error("VITE_API_URL is not configured. Set it in your Vercel environment variables.");
      return;
    }

    setGenerating(true);
    setComplete(false);
    setCurrentStep(-1);
    setGlbUrl(undefined);

    try {
      // 1. Upload image to Supabase Storage
      const ext = imageFile.name.split(".").pop() ?? "png";
      const storagePath = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("input-images")
        .upload(storagePath, imageFile, { contentType: imageFile.type, upsert: false });

      if (uploadError) {
        const msg =
          uploadError.message.toLowerCase().includes("bucket") ||
          uploadError.message.toLowerCase().includes("not found")
            ? 'Storage bucket "input-images" not found. Run supabase/schema.sql in your Supabase SQL Editor to create it.'
            : `Upload failed: ${uploadError.message}`;
        throw new Error(msg);
      }

      const { data: urlData } = supabase.storage.from("input-images").getPublicUrl(storagePath);
      const inputUrl = urlData.publicUrl;

      // 2. Call FastAPI to create job
      const response = await fetch(`${API_URL}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          input_url: inputUrl,
          poly_budget: polyCount,
          texture_res: textureRes,
          format: exportFormat,
          user_id: user.id,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => null);
        const detail = errBody?.detail ?? errBody?.message ?? null;
        if (response.status === 429) {
          throw new Error("Generation limit reached. Upgrade your plan to continue.");
        }
        throw new Error(
          detail
            ? `Generation failed: ${detail}`
            : `Server returned ${response.status}. Check VITE_API_URL is set correctly.`
        );
      }

      const { job_id } = (await response.json()) as { job_id: string; status: string };
      setJobId(job_id);

      // 3. Poll job status every 3 seconds
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`${API_URL}/api/jobs/${job_id}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });

          if (!pollRes.ok) {
            console.error(`[Generate] Poll ${job_id}: HTTP ${pollRes.status}`);
            return;
          }

          const job = (await pollRes.json()) as {
            status: JobStatus;
            output_url: string | null;
            error_message: string | null;
          };

          if (job.status === "failed") {
            stopPolling();
            setGenerating(false);
            const msg = job.error_message ?? "Generation failed";
            console.error(`[Generate] Job ${job_id} failed:`, msg);
            toast.error(msg);
            setCurrentStep(-1);
            return;
          }

          const stepIdx = statusToStepIndex(job.status);
          if (stepIdx >= 0) setCurrentStep(stepIdx);

          if (job.status === "complete") {
            stopPolling();
            setGenerating(false);
            setComplete(true);
            if (job.output_url) setGlbUrl(job.output_url);
            toast.success("3D asset generated successfully!");
          }
        } catch (pollErr) {
          console.error(`[Generate] Poll ${job_id} network error:`, pollErr);
        }
      }, 3000);
    } catch (err) {
      stopPolling();
      setGenerating(false);
      const msg = err instanceof Error ? err.message : "Generation failed";
      console.error("[Generate] handleGenerateReal error:", err);
      toast.error(msg);
    }
  };

  const handleGenerate = () => {
    handleGenerateReal();
  };

  const handleDownload = async () => {
    if (!glbUrl) {
      toast.error("No output file available to download.");
      return;
    }
    try {
      const res = await fetch(glbUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `meshforge_asset_${jobId ?? "model"}.${exportFormat.toLowerCase()}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error("[Generate] Download error:", err);
      toast.error(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-8">
      <div className="container mx-auto flex h-[calc(100vh-6rem)] max-w-7xl flex-col gap-4 px-4 lg:flex-row">
        {/* Left panel */}
        <div className="flex w-full flex-col gap-4 lg:w-[380px] lg:shrink-0">
          {/* Upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative flex-1 min-h-[200px] overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : imagePreview
                ? "border-border bg-card"
                : "border-border bg-card hover:border-primary/30"
            }`}
          >
            {imagePreview ? (
              <div className="relative h-full">
                <img src={imagePreview} alt="Upload preview" className="h-full w-full object-contain p-4" />
                <button
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                    setComplete(false);
                    setCurrentStep(-1);
                    setGlbUrl(undefined);
                    stopPolling();
                    setGenerating(false);
                  }}
                  className="absolute top-2 right-2 rounded-lg bg-secondary p-1.5 text-foreground hover:bg-secondary/80"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 left-2 rounded-md bg-secondary/80 px-2 py-1 text-xs backdrop-blur-sm">
                  {fileName}
                </div>
              </div>
            ) : (
              <label className="flex h-full cursor-pointer flex-col items-center justify-center gap-3 p-8">
                <div className="rounded-xl bg-primary/10 p-4">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium">Drop your image here</p>
                  <p className="mt-1 text-sm text-muted-foreground">PNG, JPG, WEBP up to 10MB</p>
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </label>
            )}
          </div>

          {/* Settings */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-4">
            <h3 className="font-display text-sm font-semibold">Output Settings</h3>

            {/* Poly count */}
            <div>
              <label className="text-xs text-muted-foreground">Poly Count</label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {(["low", "medium", "high"] as PolyBudget[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setPolyCount(v)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium capitalize transition-colors ${
                      polyCount === v
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v}
                    <span className="block text-[10px] opacity-60">
                      {v === "low" ? "2K" : v === "medium" ? "8K" : "16K"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Texture */}
            <div>
              <label className="text-xs text-muted-foreground">Texture Resolution</label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {([512, 1024, 2048] as TextureRes[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setTextureRes(v)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      textureRes === v
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v}px
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="text-xs text-muted-foreground">Export Format</label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {(["GLB", "OBJ", "FBX"] as ExportFormat[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setExportFormat(v)}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      exportFormat === v
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Generate / Download buttons */}
          <div className="flex gap-2">
            {!complete ? (
              <Button
                variant="hero"
                className="flex-1"
                disabled={!imageFile || generating}
                onClick={handleGenerate}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ImageIcon className="mr-2 h-4 w-4" />
                    Generate
                  </>
                )}
              </Button>
            ) : (
              <Button variant="hero" className="flex-1" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download {exportFormat}
              </Button>
            )}
          </div>

          {/* Progress steps */}
          <AnimatePresence>
            {generating && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl border border-border bg-card p-4 space-y-2 overflow-hidden"
              >
                {STEPS.map((step, i) => (
                  <div key={step.status} className="flex items-center gap-3 text-sm">
                    {i < currentStep ? (
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                    ) : i === currentStep ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-border shrink-0" />
                    )}
                    <span className={i <= currentStep ? "text-foreground" : "text-muted-foreground"}>
                      {step.label}
                    </span>
                  </div>
                ))}
                <p className="mt-2 text-xs text-muted-foreground">Estimated time: ~15-30 seconds</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right panel — 3D viewer */}
        <div className="flex-1 min-h-[300px] rounded-xl border border-border bg-card overflow-hidden relative">
          {complete ? (
            <AssetViewer glbUrl={glbUrl} />
          ) : (
            <div className="h-full w-full grid-bg flex items-center justify-center">
              {generating ? (
                <AssetViewer />
              ) : (
                <div className="text-center text-muted-foreground">
                  <div className="mx-auto mb-3 rounded-xl bg-secondary p-4 w-fit">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                  <p className="text-sm">Upload an image and click Generate</p>
                  <p className="text-xs mt-1">Your 3D model will appear here</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Generate;
