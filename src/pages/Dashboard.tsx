import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Download, Calendar, Triangle, Boxes } from "lucide-react";
import AssetViewer from "@/components/AssetViewer";

interface Asset {
  id: string;
  name: string;
  polyCount: number;
  createdAt: string;
  format: string;
  thumbnail?: string;
}

const mockAssets: Asset[] = [
  { id: "1", name: "Viking Helmet", polyCount: 8200, createdAt: "2026-04-10", format: "GLB" },
  { id: "2", name: "Crystal Sword", polyCount: 4100, createdAt: "2026-04-09", format: "GLB" },
  { id: "3", name: "Space Helmet", polyCount: 15800, createdAt: "2026-04-08", format: "OBJ" },
  { id: "4", name: "Mushroom Prop", polyCount: 2000, createdAt: "2026-04-07", format: "GLB" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5 },
  }),
};

const Dashboard = () => {
  const [assets] = useState<Asset[]>(mockAssets);

  return (
    <div className="min-h-screen pt-24 px-4 pb-12">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Your Assets</h1>
            <p className="mt-1 text-muted-foreground">{assets.length} models generated</p>
          </div>
          <Link to="/generate">
            <Button variant="hero" size="sm">
              <Plus className="mr-1 h-4 w-4" />
              New Asset
            </Button>
          </Link>
        </div>

        {assets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-24 flex flex-col items-center text-center"
          >
            <div className="rounded-2xl border border-dashed border-border bg-card p-12">
              <Boxes className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 font-display text-xl font-semibold">No assets yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">Upload your first concept art to generate a 3D model.</p>
              <Link to="/generate" className="mt-6 inline-block">
                <Button variant="hero">Create your first asset</Button>
              </Link>
            </div>
          </motion.div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assets.map((asset, i) => (
              <motion.div
                key={asset.id}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={i}
                className="group overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/30"
              >
                {/* 3D Preview */}
                <div className="relative h-48 w-full bg-secondary grid-bg">
                  <AssetViewer mini />
                </div>

                <div className="p-4">
                  <h3 className="font-display font-semibold truncate">{asset.name}</h3>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Triangle className="h-3 w-3" />
                      {asset.polyCount.toLocaleString()} polys
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(asset.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">{asset.format}</span>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
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
