import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Upload, X, Download, Check, Loader2, Image as ImageIcon } from "lucide-react";
import AssetViewer from "@/components/AssetViewer";
import { toast } from "sonner";

const STEPS = [
  "Removing background...",
  "Generating multi-view...",
  "Reconstructing mesh...",
  "Optimising for game engine...",
  "Finalising export...",
];

type PolyCount = "low" | "medium" | "high";
type TextureRes = 512 | 1024 | 2048;
type ExportFormat = "GLB" | "OBJ" | "FBX";

const Generate = () => {
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [complete, setComplete] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [polyCount, setPolyCount] = useState<PolyCount>("medium");
  const [textureRes, setTextureRes] = useState<TextureRes>(1024);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("GLB");

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, or WEBP)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
      setFileName(file.name);
      setComplete(false);
      setCurrentStep(-1);
    };
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

  const handleGenerate = async () => {
    setGenerating(true);
    setComplete(false);
    for (let i = 0; i < STEPS.length; i++) {
      setCurrentStep(i);
      await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));
    }
    setGenerating(false);
    setComplete(true);
    toast.success("3D asset generated successfully!");
  };

  const handleDownload = () => {
    toast("Download started — this is a demo, no real file is available.");
  };

  return (
    <div className="min-h-screen pt-20 pb-8">
      <div className="container mx-auto flex h-[calc(100vh-6rem)] max-w-7xl flex-col gap-4 px-4 lg:flex-row">
        {/* Left panel */}
        <div className="flex w-full flex-col gap-4 lg:w-[380px] lg:shrink-0">
          {/* Upload zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative flex-1 min-h-[200px] overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : image
                ? "border-border bg-card"
                : "border-border bg-card hover:border-primary/30"
            }`}
          >
            {image ? (
              <div className="relative h-full">
                <img src={image} alt="Upload preview" className="h-full w-full object-contain p-4" />
                <button
                  onClick={() => {
                    setImage(null);
                    setComplete(false);
                    setCurrentStep(-1);
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
                {(["low", "medium", "high"] as PolyCount[]).map((v) => (
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
                disabled={!image || generating}
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
                  <div key={step} className="flex items-center gap-3 text-sm">
                    {i < currentStep ? (
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                    ) : i === currentStep ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-border shrink-0" />
                    )}
                    <span
                      className={
                        i <= currentStep ? "text-foreground" : "text-muted-foreground"
                      }
                    >
                      {step}
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
            <AssetViewer />
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
