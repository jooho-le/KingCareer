import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  Box3,
  CanvasTexture,
  Color,
  Mesh,
  MeshPhysicalMaterial,
  PMREMGenerator,
  SRGBColorSpace,
  Vector3,
  type Group,
  type OrthographicCamera,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export type Point = [number, number, number];
export type SceneQuality = "high" | "balanced";

export function Box({
  at,
  size,
  color,
  rotation = [0, 0, 0],
  metal = false,
}: {
  at: Point;
  size: Point;
  color: string;
  rotation?: Point;
  metal?: boolean;
}) {
  const geometry = useMemo(
    () =>
      new RoundedBoxGeometry(
        ...size,
        2,
        Math.min(0.065, Math.min(...size) * 0.22),
      ),
    [size[0], size[1], size[2]],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh position={at} rotation={rotation} castShadow receiveShadow>
      <primitive object={geometry} attach="geometry" />
      <meshPhysicalMaterial
        color={color}
        roughness={metal ? 0.28 : 0.58}
        metalness={metal ? 0.7 : 0.03}
        clearcoat={metal ? 0.3 : 0.12}
        clearcoatRoughness={0.36}
      />
    </mesh>
  );
}

export function StudioLight({ quality = "high" }: { quality?: SceneQuality }) {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04, 0.1, 100, {
      size: quality === "high" ? 256 : 128,
    });
    const previous = scene.environment,
      intensity = scene.environmentIntensity;
    scene.environment = target.texture;
    scene.environmentIntensity = 0.45;
    invalidate();
    return () => {
      scene.environment = previous;
      scene.environmentIntensity = intensity;
      target.dispose();
      room.dispose();
      generator.dispose();
    };
  }, [gl, scene, quality, invalidate]);
  return (
    <>
      <hemisphereLight args={["#eef5ff", "#85735c", 0.65]} />
      <directionalLight
        position={[-3, 8, 5]}
        intensity={2.4}
        color="#fff1df"
        castShadow
        shadow-mapSize={quality === "high" ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.00015}
        shadow-normalBias={0.035}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={0.5}
        shadow-camera-far={24}
      />
      <directionalLight
        position={[5, 4, -3]}
        intensity={1.15}
        color="#c8dfff"
      />
    </>
  );
}

// Asset materials are cloned: tinting this model never changes cached GLTF instances.
export function Model({
  file,
  length = 1,
  at = [0, 0, 0],
  rotation = [0, 0, 0],
  paint = false,
}: {
  file: string;
  length?: number;
  at?: Point;
  rotation?: Point;
  paint?: boolean;
}) {
  const gltf = useLoader(GLTFLoader, `/models/kenney/${file}`);
  const { model, center, scale, materials } = useMemo(() => {
    const model = gltf.scene.clone(true);
    const materials: MeshPhysicalMaterial[] = [];
    model.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
      const convert = (original: MeshPhysicalMaterial) => {
        const m = new MeshPhysicalMaterial({
          color: original.color || new Color("white"),
          map: original.map,
          metalness: paint ? 0.22 : original.metalness || 0.05,
          roughness: paint ? 0.3 : 0.57,
          clearcoat: paint ? 0.8 : 0.14,
          clearcoatRoughness: 0.22,
          transparent: original.transparent,
          opacity: original.opacity,
          side: original.side,
        });
        materials.push(m);
        return m;
      };
      node.material = Array.isArray(node.material)
        ? node.material.map(convert)
        : convert(node.material);
    });
    model.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(model),
      size = bounds.getSize(new Vector3()),
      center = bounds.getCenter(new Vector3());
    center.y = bounds.min.y;
    return {
      model,
      center,
      scale: length / Math.max(size.x, size.y, size.z, 0.001),
      materials,
    };
  }, [gltf, length, paint]);
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  return (
    <group position={at} rotation={rotation} scale={scale}>
      <primitive
        object={model}
        position={[-center.x, -center.y, -center.z]}
        dispose={null}
      />
    </group>
  );
}

export function Sign({
  title,
  detail = "",
  at,
  width = 1.8,
  color = "#0967ff",
  rotation = [0, 0, 0],
}: {
  title: string;
  detail?: string;
  at: Point;
  width?: number;
  color?: string;
  rotation?: Point;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 320;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1b2639";
    ctx.fillRect(0, 0, 1024, 320);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 14, 320);
    ctx.font = '600 52px "Malgun Gothic", sans-serif';
    ctx.fillStyle = "#ffffff";
    ctx.fillText(title, 48, 113, 924);
    ctx.font = '36px "Malgun Gothic", sans-serif';
    ctx.fillStyle = "#c2d3e7";
    ctx.fillText(detail, 48, 218, 924);
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }, [title, detail, color]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={at} rotation={rotation}>
      <planeGeometry args={[width, (width * 320) / 1024]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

export function Controls({
  focus,
  reduced = false,
  overview = 0,
}: {
  focus?: Point;
  reduced?: boolean;
  overview?: number;
}) {
  const { camera, gl, invalidate, size } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const aim = useRef<{ target: Vector3; zoom: number } | null>(null);
  const base = Math.min(size.width / 10.5, size.height / 7.5);
  useEffect(() => {
    const ctrl = new OrbitControls(camera, gl.domElement);
    ctrl.target.set(0, 0.65, 0);
    ctrl.enablePan = false;
    ctrl.minPolarAngle = 0.48;
    ctrl.maxPolarAngle = 1.34;
    ctrl.minZoom = 18;
    ctrl.maxZoom = 170;
    ctrl.enableDamping = false;
    const stop = () => {
      aim.current = null;
    };
    ctrl.addEventListener("start", stop);
    ctrl.addEventListener("change", () => invalidate());
    ctrl.update();
    controls.current = ctrl;
    return () => {
      controls.current = null;
      ctrl.dispose();
    };
  }, [camera, gl, invalidate]);
  useEffect(() => {
    const view = camera as OrthographicCamera;
    const target = focus
      ? new Vector3(focus[0] * 0.72, 0.85, focus[2] * 0.72)
      : new Vector3(0, 0.65, 0);
    const zoom = base * (focus ? 1.4 : 1);
    if (reduced) {
      controls.current?.target.copy(target);
      view.zoom = zoom;
      view.updateProjectionMatrix();
      controls.current?.update();
      aim.current = null;
    } else aim.current = { target, zoom };
    invalidate();
  }, [
    focus?.[0],
    focus?.[1],
    focus?.[2],
    base,
    reduced,
    overview,
    camera,
    invalidate,
  ]);
  useFrame((_, delta) => {
    if (!aim.current || !controls.current) return;
    const view = camera as OrthographicCamera,
      target = aim.current;
    const blend = 1 - Math.exp(-delta * 5);
    controls.current.target.lerp(target.target, blend);
    view.zoom += (target.zoom - view.zoom) * blend;
    view.updateProjectionMatrix();
    controls.current.update();
    if (
      controls.current.target.distanceTo(target.target) < 0.004 &&
      Math.abs(view.zoom - target.zoom) < 0.03
    )
      aim.current = null;
    else invalidate();
  });
  return null;
}

export function Arrival({
  children,
  reduced,
}: {
  children: React.ReactNode;
  reduced: boolean;
}) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    if (group.current && !reduced)
      group.current.position.y *= Math.exp(-delta * 5);
  });
  return (
    <group ref={group} position={[0, reduced ? 0 : 0.28, 0]}>
      {children}
    </group>
  );
}
