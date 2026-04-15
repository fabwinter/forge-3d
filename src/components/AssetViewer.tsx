import { Suspense, useRef, Component, ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, useGLTF } from "@react-three/drei";
import { Group } from "three";

class ViewerErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full items-center justify-center text-center p-4">
          <div>
            <p className="text-sm text-muted-foreground">Failed to load 3D model</p>
            <p className="mt-1 text-xs text-destructive">{this.state.error}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface AssetViewerProps {
  mini?: boolean;
  glbUrl?: string;
}

const PlaceholderMesh = () => {
  return (
    <mesh rotation={[0, Math.PI / 4, 0]} castShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="hsl(263, 70%, 50%)"
        roughness={0.3}
        metalness={0.7}
        emissive="hsl(263, 70%, 30%)"
        emissiveIntensity={0.15}
      />
    </mesh>
  );
};

const GLBModel = ({ url }: { url: string }) => {
  const { scene } = useGLTF(url);
  const ref = useRef<Group>(null);
  return <primitive ref={ref} object={scene} />;
};

const Scene = ({ mini, glbUrl }: { mini?: boolean; glbUrl?: string }) => {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-4, 2, -4]} intensity={0.4} color="#a78bfa" />
      <pointLight position={[-5, 3, -5]} intensity={0.5} color="#7c3aed" />
      {glbUrl ? <GLBModel url={glbUrl} /> : <PlaceholderMesh />}
      {!mini && (
        <Grid
          position={[0, -1.2, 0]}
          args={[20, 20]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#1a1a2e"
          sectionSize={2}
          sectionThickness={1}
          sectionColor="#2a2a4e"
          fadeDistance={15}
          fadeStrength={1}
          infiniteGrid
        />
      )}
      <OrbitControls
        enablePan={!mini}
        enableZoom={!mini}
        autoRotate
        autoRotateSpeed={mini ? 3 : 1}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.5}
      />
    </>
  );
};

const AssetViewer = ({ mini = false, glbUrl }: AssetViewerProps) => {
  return (
    <div className={`w-full ${mini ? "h-full" : "h-full min-h-[400px]"}`}>
      <ViewerErrorBoundary>
      <Canvas
        camera={{ position: mini ? [2, 1.5, 2] : [3, 2, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Suspense
          fallback={
            mini ? null : (
              <mesh>
                <boxGeometry args={[0.01, 0.01, 0.01]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            )
          }
        >
          <Scene mini={mini} glbUrl={glbUrl} />
        </Suspense>
      </Canvas>
      </ViewerErrorBoundary>
      {!mini && glbUrl === undefined && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0" />
      )}
    </div>
  );
};

export default AssetViewer;
