import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import {
  Box,
  Controls,
  StudioLight,
  Sign,
  type SceneQuality,
} from "./SceneKit";
export { Box, Controls } from "./SceneKit";
import type { Group } from "three";
import type { Fieldwork } from "./types";

type Point = [number, number, number];
function Marker({
  at,
  active,
  reduced,
}: {
  at: Point;
  active: boolean;
  reduced: boolean;
  quality?: SceneQuality;
}) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (ref.current && !reduced)
      ref.current.position.y = at[1] + Math.sin(clock.elapsedTime * 2) * 0.045;
  });
  return (
    <group ref={ref} position={at}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.045, 8, 24]} />
        <meshStandardMaterial color={active ? "#0967FF" : "#FF6A1F"} />
      </mesh>
    </group>
  );
}
function Plant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.42, z]}>
      <Box at={[0, 0.38, 0]} size={[0.035, 0.8, 0.035]} color="#38784b" />
      {[0, 1, 2].map((i) => (
        <group
          key={i}
          position={[0, 0.22 + i * 0.18, 0]}
          rotation={[0, i * 2, 0]}
        >
          <mesh
            position={[0.1, 0, 0]}
            rotation={[0, 0, 0.5]}
            scale={[0.2, 0.065, 0.12]}
            castShadow
          >
            <sphereGeometry args={[1, 20, 12]} />
            <meshStandardMaterial color={i % 2 ? "#50af64" : "#248751"} />
          </mesh>
          <mesh position={[-0.11, 0.02, 0]} castShadow>
            <sphereGeometry args={[0.065, 20, 16]} />
            <meshStandardMaterial color="#FF6A1F" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
function ActionEffects({
  field,
  reduced,
}: {
  field: Fieldwork;
  reduced: boolean;
  quality?: SceneQuality;
}) {
  const vent = useRef<Group>(null),
    fan = useRef<Group>(null),
    flow = useRef<Group>(null);
  const action = field.action?.id;
  const open = !!action && action !== "water";
  useFrame(({ clock }, delta) => {
    if (vent.current)
      vent.current.rotation.x = reduced
        ? open
          ? -1
          : 0
        : vent.current.rotation.x +
          ((open ? -1 : 0) - vent.current.rotation.x) * Math.min(1, delta * 3);
    if (fan.current && open && !reduced) fan.current.rotation.z += delta * 4;
    if (flow.current && !reduced)
      flow.current.children.forEach((drop, i) => {
        if (action === "water")
          drop.position.y = 1.5 - ((clock.elapsedTime * 0.65 + i * 0.12) % 1);
        else
          drop.position.z = -1.4 + ((clock.elapsedTime * 0.9 + i * 0.23) % 2.8);
      });
  });
  return (
    <group>
      <group
        position={[0, 2.45, -2.18]}
        ref={vent}
        rotation={[reduced && open ? -1 : 0, 0, 0]}
      >
        <Box
          at={[0, 0.42, 0]}
          size={[1.4, 0.85, 0.065]}
          color={open ? "#a8ddd4" : "#c1d4cb"}
        />
        <Box at={[0, 0, 0]} size={[1.5, 0.05, 0.1]} color="#0967ff" />
      </group>
      <group position={[2.25, 2.2, -2]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.1, 20]} />
          <meshStandardMaterial color="#f7f5ed" />
        </mesh>
        <group ref={fan}>
          {[0, 1, 2, 3].map((i) => (
            <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
              <Box
                at={[0, 0.16, 0.07]}
                size={[0.1, 0.27, 0.05]}
                color={open ? "#0967ff" : "#8eaca0"}
              />
            </group>
          ))}
        </group>
      </group>
      {open && (
        <group ref={flow}>
          {Array.from({ length: 9 }, (_, i) => (
            <mesh
              key={i}
              position={[
                -0.7 + (i % 3) * 0.65,
                1.4 + (i % 2) * 0.4,
                -1.4 + (i % 4) * 0.7,
              ]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <coneGeometry args={[0.06, 0.3, 6]} />
              <meshStandardMaterial color="#65a8ff" />
            </mesh>
          ))}
        </group>
      )}
      {action === "water" && (
        <group ref={flow}>
          {Array.from({ length: 18 }, (_, i) => (
            <mesh
              key={i}
              position={[
                -1.8 + (i % 3) * 0.4,
                0.7 + (i % 4) * 0.2,
                -0.1 + Math.floor(i / 3) * 0.3,
              ]}
            >
              <sphereGeometry args={[0.045, 8, 6]} />
              <meshStandardMaterial color="#0967ff" />
            </mesh>
          ))}
        </group>
      )}
      {action === "water" && (
        <Box
          at={[-1.4, 1.65, 0.6]}
          size={[0.055, 0.055, 2.3]}
          color="#0967ff"
        />
      )}
      {action === "escalate" && (
        <group position={[0.2, 0.15, 1.8]}>
          <Box at={[0, 0.55, 0]} size={[0.36, 0.5, 0.24]} color="#ff6a1f" />
          <mesh position={[0, 0.99, 0]}>
            <sphereGeometry args={[0.18, 12, 8]} />
            <meshStandardMaterial color="#f3c6a7" />
          </mesh>
          <mesh position={[0, 1.12, 0]}>
            <sphereGeometry
              args={[0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <meshStandardMaterial color="#0967ff" />
          </mesh>
          <Box at={[-0.1, 0.17, 0]} size={[0.13, 0.34, 0.17]} color="#32485c" />
          <Box at={[0.1, 0.17, 0]} size={[0.13, 0.34, 0.17]} color="#32485c" />
          <Box at={[0.4, 0.18, 0]} size={[0.35, 0.3, 0.23]} color="#7c3aed" />
        </group>
      )}
    </group>
  );
}
function Room({
  field,
  selected,
  inspect,
  reduced,
  quality = "high",
}: {
  field: Fieldwork;
  selected: string;
  inspect: (id: string) => void;
  reduced: boolean;
  quality?: SceneQuality;
}) {
  const [hover, setHover] = useState("");
  const interactive = (id: string) => ({
    onClick: (event: { stopPropagation(): void }) => {
      event.stopPropagation();
      inspect(id);
    },
    onPointerOver: (event: { stopPropagation(): void }) => {
      event.stopPropagation();
      setHover(id);
    },
    onPointerOut: () => setHover(""),
  });
  useEffect(() => {
    document.body.style.cursor = hover ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hover]);
  const pin = (id: string, at: Point) => (
    <Marker
      at={at}
      active={field.inspected.includes(id) || selected === id}
      reduced={reduced}
    />
  );
  return (
    <>
      <color attach="background" args={["#e9efe8"]} />
      <StudioLight quality={quality} />
      <Box at={[0, -0.15, 0]} size={[7.5, 0.3, 5.8]} color="#d1dbc9" />
      <Box at={[0, 0.02, 0]} size={[6.5, 0.1, 4.8]} color="#f7f2e5" />
      <Box at={[0.1, 0.09, 0.2]} size={[0.8, 0.03, 4.5]} color="#d6dfd5" />
      {[-3.1, 3.1].map((x) =>
        [-2.2, 0, 2.2].map((z) => (
          <Box
            key={`${x}-${z}`}
            at={[x, 1.4, z]}
            size={[0.08, 2.8, 0.08]}
            color="#93b9a6"
          />
        )),
      )}
      {[-2.2, 0, 2.2].map((z) => (
        <group key={z}>
          <Box
            at={[-1.55, 3.2, z]}
            size={[3.4, 0.09, 0.09]}
            color="#93b9a6"
            rotation={[0, 0, 0.32]}
          />
          <Box
            at={[1.55, 3.2, z]}
            size={[3.4, 0.09, 0.09]}
            color="#93b9a6"
            rotation={[0, 0, -0.32]}
          />
        </group>
      ))}
      <Box at={[0, 3.7, 0]} size={[0.08, 0.08, 4.5]} color="#93b9a6" />
      <mesh position={[0, 1.4, -2.22]}>
        <planeGeometry args={[6.2, 2.6]} />
        <meshPhysicalMaterial
          color="#dbf5ec"
          transparent
          opacity={0.25}
          roughness={0.08}
          metalness={0.12}
          clearcoat={1}
          side={2}
          depthWrite={false}
        />
      </mesh>
      <group {...interactive("plants")}>
        {[-1.4, 1.5].map((x) => (
          <group key={x}>
            <Box at={[x, 0.25, 0.6]} size={[1.55, 0.35, 2.4]} color="#c4a079" />
            <Box
              at={[x, 0.44, 0.6]}
              size={[1.4, 0.025, 2.25]}
              color="#735340"
            />
            {[-0.2, 0.55, 1.3].map((z) =>
              [-0.35, 0.35].map((dx) => (
                <Plant key={`${dx}-${z}`} x={x + dx} z={z} />
              )),
            )}
          </group>
        ))}
        {pin("plants", [-1.4, 1.5, 0.8])}
      </group>
      <group {...interactive("sensor")}>
        <Box at={[-2.5, 0.9, -0.5]} size={[0.07, 1.6, 0.07]} color="#83999a" />
        <Box at={[-2.5, 1.5, -0.5]} size={[0.42, 0.5, 0.24]} color="#ffffff" />
        <Box
          at={[-2.5, 1.53, -0.37]}
          size={[0.3, 0.24, 0.02]}
          color={(field.temperature ?? 33) > 28 ? "#FF6A1F" : "#0967FF"}
        />
        {pin("sensor", [-2.5, 1.98, -0.5])}
      </group>
      <group {...interactive("controller")}>
        <Box at={[1.25, 1.2, -1.9]} size={[0.75, 0.95, 0.3]} color="#0967FF" />
        <Box
          at={[1.25, 1.36, -1.72]}
          size={[0.54, 0.38, 0.02]}
          color="#d5f3ea"
        />
        <Box at={[1.25, 1, -1.72]} size={[0.24, 0.07, 0.03]} color="#FF6A1F" />
        {pin("controller", [1.25, 2, -1.9])}
      </group>
      <group {...interactive("tank")} position={[2.6, 0.7, -1.3]}>
        <Box at={[0, 0, 0.405]} size={[0.2, 0.95, 0.02]} color="#f4f7ff" />
        <Box
          at={[0, -0.45 + (field.action?.id === "water" ? 0.25 : 0.37), 0.423]}
          size={[0.13, field.action?.id === "water" ? 0.5 : 0.74, 0.025]}
          color="#0967ff"
        />
        <mesh castShadow>
          <cylinderGeometry args={[0.4, 0.4, 1.2, 20]} />
          <meshStandardMaterial color="#7C3AED" />
        </mesh>
        <Box at={[0, 0.65, 0]} size={[0.3, 0.1, 0.3]} color="#c8b5f2" />
        {pin("tank", [0, 1.1, 0])}
      </group>
      <group {...interactive("journal")}>
        <Box at={[-1.4, 0.7, -1.6]} size={[1.4, 0.12, 0.65]} color="#debb90" />
        {[-1.95, -0.85].map((x) => (
          <Box
            key={x}
            at={[x, 0.38, -1.6]}
            size={[0.08, 0.6, 0.4]}
            color="#70847a"
          />
        ))}
        <Box at={[-1.4, 0.8, -1.6]} size={[0.5, 0.05, 0.35]} color="#FF6A1F" />
        {pin("journal", [-1.4, 1.3, -1.6])}
      </group>
      <group {...interactive("weather")}>
        <Box at={[3.45, 1.2, 1.6]} size={[0.06, 2.4, 0.06]} color="#92a5a0" />
        <mesh position={[3.45, 2.35, 1.6]} castShadow>
          <sphereGeometry args={[0.22, 12, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <Box at={[3.45, 2.6, 1.6]} size={[0.6, 0.04, 0.08]} color="#FF6A1F" />
        {pin("weather", [3.45, 3, 1.6])}
      </group>
      <ActionEffects field={field} reduced={reduced} />
      <Sign
        title="SMART FARM / A"
        detail={`현재 온도 ${field.temperature ?? 33} °C · 교대 점검`}
        at={[0, 2.45, -2.16]}
        width={2.3}
        color="#ff6a1f"
      />
      <Controls
        reduced={reduced}
        focus={
          (
            {
              plants: [-1.4, 0, 0.8],
              sensor: [-2.5, 0, -0.5],
              controller: [1.25, 0, -1.9],
              tank: [2.6, 0, -1.3],
              journal: [-1.4, 0, -1.6],
              weather: [3.45, 0, 1.6],
            } as Record<string, Point>
          )[selected]
        }
      />
    </>
  );
}
export default function Greenhouse(props: {
  field: Fieldwork;
  selected: string;
  inspect: (id: string) => void;
  reduced: boolean;
  quality?: SceneQuality;
}) {
  return (
    <Canvas
      shadows
      orthographic
      camera={{ position: [8, 7, 9], zoom: 62, near: 0.1, far: 100 }}
      dpr={[1, props.quality === "balanced" ? 1.25 : 2]}
      frameloop={props.reduced ? "demand" : "always"}
      gl={{
        antialias: true,
        powerPreference: props.quality === "balanced" ? "low-power" : "high-performance",
        toneMapping: ACESFilmicToneMapping,
        outputColorSpace: SRGBColorSpace,
      }}
    >
      <Room {...props} />
    </Canvas>
  );
}
