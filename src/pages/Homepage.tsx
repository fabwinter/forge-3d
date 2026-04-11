import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Zap, Gem, Gamepad2, ArrowRight, Box } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "From concept art to 3D model in under 30 seconds. No manual sculpting required.",
  },
  {
    icon: Gem,
    title: "Production Quality",
    description: "Clean topology, proper UVs, and PBR-ready textures straight out of the box.",
  },
  {
    icon: Gamepad2,
    title: "Game-Engine Ready",
    description: "Export to GLB, OBJ, or FBX with optimized poly counts for Unity and Unreal.",
  },
];

const pricing = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    features: ["10 assets per month", "Up to 8K polys", "GLB export", "Community support"],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Indie",
    price: "$19",
    period: "/month",
    features: ["150 assets per month", "Up to 8K polys", "GLB + OBJ export", "Email support"],
    cta: "Get Indie",
    highlighted: false,
  },
  {
    name: "Studio",
    price: "$49",
    period: "/month",
    features: ["600 assets per month", "Up to 16K polys", "GLB + OBJ + FBX export", "2048px textures", "Priority queue"],
    cta: "Get Studio",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "$99",
    period: "/month",
    features: ["2000 assets per month", "Up to 16K polys", "All formats", "API access", "Priority GPU", "Dedicated support"],
    cta: "Get Pro",
    highlighted: false,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" as const },
  }),
};

const Homepage = () => {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        
        {/* Floating glow orb */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px] animate-pulse-glow" />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm"
          >
            <Box className="h-3.5 w-3.5 text-primary" />
            Powered by InstantMesh AI
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="font-display text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl md:text-7xl"
          >
            Turn concept art into{" "}
            <span className="text-gradient">game-ready 3D</span> assets
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
          >
            Upload a sketch, photo, or concept art. Get a production-quality 3D model
            with clean topology in seconds — not hours.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <Link to="/generate">
              <Button variant="hero" size="lg" className="text-base px-8 py-6">
                Start for free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button variant="hero-outline" size="lg" className="text-base px-8 py-6">
                View Dashboard
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/50 py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="font-display text-center text-3xl font-bold sm:text-4xl"
          >
            Why MeshForge?
          </motion.h2>
          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
                className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30 hover:bg-surface-hover"
              >
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="border-t border-border/50 py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="font-display text-center text-3xl font-bold sm:text-4xl"
          >
            Simple pricing
          </motion.h2>
          <p className="mt-4 text-center text-muted-foreground">Start free. Upgrade when you need more.</p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pricing.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
                className={`rounded-xl border p-6 ${
                  plan.highlighted
                    ? "border-primary/50 bg-card glow-border"
                    : "border-border bg-card"
                }`}
              >
                <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/generate" className="mt-8 block">
                  <Button
                    variant={plan.highlighted ? "hero" : "hero-outline"}
                    className="w-full"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 px-4">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Box className="h-5 w-5 text-primary" />
            <span className="font-display font-semibold">MeshForge</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 MeshForge. Built with AI.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Homepage;
