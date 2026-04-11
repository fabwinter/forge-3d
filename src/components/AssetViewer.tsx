import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Grid } from "@react-three/drei";

interface AssetViewerProps {
  mini?: boolean;
  modelUrl?: string;
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

const Scene = ({ mini }: { mini?: boolean }) => {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <pointLight position={[-5, 3, -5]} intensity={0.3} color="#7c3aed" />
      <PlaceholderMesh />
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
      <Environment preset="night" />
    </>
  );
};

const AssetViewer = ({ mini = false }: AssetViewerProps) => {
  return (
    <div className={`w-full ${mini ? "h-full" : "h-full min-h-[400px]"}`}>
      <Canvas
        camera={{ position: mini ? [2, 1.5, 2] : [3, 2, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Scene mini={mini} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default AssetViewer;
