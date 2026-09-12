import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ACESFilmicToneMapping, SRGBColorSpace, type Group } from "three";
import {
  Box,
  Controls,
  StudioLight,
  Model,
  Sign,
  Arrival,
  type SceneQuality,
} from "./SceneKit";
import RoomDetails, { AutomotiveBay } from "./RoomDetails";
import type { Fieldwork } from "./types";
import type { CareerId } from "../data";
type Point = [number, number, number];
const layouts: Record<string, Point[]> = {
  developer: [
    [-1.6, 0, 0.65],
    [-2, 0, -1.65],
    [0, 0, -1.7],
    [1.3, 0, 1.5],
    [2.4, 0, -1.5],
    [-2.8, 0, 2.1],
  ],
  nurse: [
    [1.7, 0, 1.5],
    [-2.35, 0, -1.6],
    [-1.4, 0, 0.3],
    [0.75, 0, 0.4],
    [2.3, 0, -1.65],
    [0, 0, -1.7],
  ],
  engineer: [
    [-0.9, 0, 0.3],
    [1.8, 0, -1.7],
    [-2.65, 0, -1.8],
    [1.9, 0, 1.4],
    [2.7, 0, 0],
    [-2.9, 0, 1.8],
  ],
  researcher: [
    [-1.6, 0, 0.7],
    [-2, 0, -1.65],
    [0, 0, -1.7],
    [1.8, 0, 0.8],
    [2.3, 0, -1.5],
    [-2.7, 0, 2.1],
  ],
};
function Cylinder({
  at,
  radius,
  height,
  color,
  rotate = false,
}: {
  at: Point;
  radius: number;
  height: number;
  color: string;
  rotate?: boolean;
}) {
  return (
    <mesh
      position={at}
      rotation={rotate ? [Math.PI / 2, 0, 0] : [0, 0, 0]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[radius, radius, height, 40]} />
      <meshPhysicalMaterial
        color={color}
        roughness={0.34}
        metalness={0.15}
        clearcoat={0.25}
      />
    </mesh>
  );
}
function Screen({
  color = "#0967ff",
  tall = false,
  title = "WORK STATION",
  detail = "현장 기록을 확인해 보세요",
}: {
  color?: string;
  tall?: boolean;
  title?: string;
  detail?: string;
}) {
  return (
    <>
      <Box at={[0, 0.75, 0]} size={[1.1, 0.12, 0.65]} color="#cfb49b" />
      <Box at={[0, 0.4, 0]} size={[0.08, 0.7, 0.4]} color="#71848b" />
      <Box
        at={[0, 1.25, -0.12]}
        size={[0.9, tall ? 1.1 : 0.65, 0.12]}
        color="#263447"
      />
      <Box
        at={[0, 1.25, -0.045]}
        size={[0.77, tall ? 0.92 : 0.51, 0.02]}
        color={color}
      />
      <Sign
        title={title}
        detail={detail}
        at={[0, 1.25, -0.029]}
        width={0.76}
        color={color}
      />
      <Model
        file="furniture/computerKeyboard.glb"
        length={0.48}
        at={[-0.08, 0.82, 0.13]}
      />
      <Model
        file="furniture/computerMouse.glb"
        length={0.12}
        at={[0.37, 0.82, 0.13]}
      />
    </>
  );
}
function Folder({ color = "#7c3aed" }: { color?: string }) {
  return (
    <>
      <Box at={[0, 0.75, 0]} size={[1, 0.1, 0.6]} color="#d9c6ac" />
      <Box at={[0, 0.4, 0]} size={[0.7, 0.65, 0.45]} color="#e7dfd2" />
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          at={[-0.28 + i * 0.28, 0.85, 0]}
          size={[0.22, 0.09, 0.35]}
          color={i === 1 ? color : "#f5f3eb"}
        />
      ))}
    </>
  );
}
function Person() {
  return (
    <group position={[0.3, 0.1, 1.9]}>
      <Cylinder at={[0, 0.55, 0]} radius={0.2} height={0.5} color="#ff6a1f" />
      <mesh position={[0, 1, 0]}>
        <sphereGeometry args={[0.19, 14, 10]} />
        <meshStandardMaterial color="#f1bf9f" />
      </mesh>
      <Box at={[-0.12, 0.18, 0]} size={[0.13, 0.36, 0.16]} color="#34384e" />
      <Box at={[0.12, 0.18, 0]} size={[0.13, 0.36, 0.16]} color="#34384e" />
    </group>
  );
}
function Props({
  cid,
  index,
  effect,
  reduced,
  value,
}: {
  cid: CareerId;
  index: number;
  effect?: string;
  reduced: boolean;
  value?: number;
}) {
  if (cid === "developer") {
    if (index === 4)
      return (
        <>
          {[0, ...(effect === "scale" ? [1] : [])].map((i) => (
            <group key={i} position={[i * 0.7, 0, 0]}>
              <Box at={[0, 0.9, 0]} size={[0.55, 1.8, 0.65]} color="#253747" />
              {[0, 1, 2, 3].map((n) => (
                <Box
                  key={n}
                  at={[0, 0.32 + n * 0.36, 0.34]}
                  size={[0.42, 0.08, 0.03]}
                  color="#61d6b5"
                />
              ))}
            </group>
          ))}
        </>
      );
    if (index === 0 || index === 1)
      return (
        <Screen
          title={index === 0 ? "LOGIN STATUS" : "EVENT LOG"}
          detail={
            index === 0
              ? `실패율 ${value ?? 38}%`
              : effect === "rollback" || effect === "patch"
                ? "인증 요청 복구 중"
                : "인증 설정 오류 발견"
          }
          color={
            effect === "rollback" || effect === "patch" ? "#278d7f" : "#ff6a1f"
          }
        />
      );
    if (index === 2)
      return (
        <Screen color={effect === "rollback" ? "#0967ff" : "#7c3aed"} tall />
      );
    return <Folder color={index === 3 ? "#ff6a1f" : "#0967ff"} />;
  }
  if (cid === "nurse") {
    if (index === 2)
      return (
        <>
          <Box at={[0, 0.4, 0]} size={[1.35, 0.35, 0.75]} color="#fff" />
          <Box at={[0.35, 0.65, 0]} size={[0.35, 0.15, 0.65]} color="#d5c5f7" />
          <Box
            at={[0.68, 0.67, 0]}
            size={[0.06, 0.7, 0.86]}
            color="#a9bac8"
            metal
          />
          {[-0.39, 0.39].map((z) => (
            <group key={z}>
              <Box
                at={[0, 0.73, z]}
                size={[1, 0.05, 0.05]}
                color="#bac7ce"
                metal
              />
              {[-0.4, 0.4].map((x) => (
                <Box
                  key={x}
                  at={[x, 0.58, z]}
                  size={[0.035, 0.32, 0.035]}
                  color="#bac7ce"
                  metal
                />
              ))}
            </group>
          ))}
          {[-0.55, 0.55].map((x) => (
            <Cylinder
              key={x}
              at={[x, 0.15, 0]}
              radius={0.13}
              height={0.8}
              color="#657382"
              rotate
            />
          ))}
        </>
      );
    if (index === 3)
      return (
        <>
          <Box at={[0, 0.8, 0]} size={[0.75, 0.1, 0.6]} color="#0967ff" />
          <Box at={[0, 0.35, 0]} size={[0.75, 0.1, 0.6]} color="#c5d9f5" />
          {[-0.3, 0.3].map((x) => (
            <Box
              key={x}
              at={[x, 0.5, 0]}
              size={[0.04, 0.9, 0.4]}
              color="#8493a0"
            />
          ))}
          <Box at={[0, 0.94, 0]} size={[0.45, 0.2, 0.33]} color="#f5e6d0" />
        </>
      );
    if (index === 1)
      return (
        <>
          <Box at={[0, 1.1, 0]} size={[0.45, 1.8, 0.25]} color="#f4f2ea" />
          <mesh position={[0, 1.6, 0.18]}>
            <sphereGeometry args={[0.14, 14, 10]} />
            <meshStandardMaterial
              color={
                effect === "silence"
                  ? "#b9c0c5"
                  : effect
                    ? "#4bcdb0"
                    : "#ff6a1f"
              }
              emissive={
                effect === "silence"
                  ? "#000000"
                  : effect
                    ? "#1f6954"
                    : "#bd4315"
              }
              emissiveIntensity={0.5}
            />
          </mesh>
        </>
      );
    if (index === 4)
      return (
        <>
          <Folder color="#70cabb" />
          <Cylinder
            at={[0, 1.08, 0]}
            radius={0.13}
            height={0.4}
            color="#f5f8ff"
          />
          <Box at={[0, 1.32, 0]} size={[0.25, 0.07, 0.1]} color="#0967ff" />
        </>
      );
    return <Screen color="#7c3aed" />;
  }
  if (cid === "engineer") {
    if (index === 0) return <AutomotiveBay effect={effect} reduced={reduced} />;
    if (index === 3)
      return (
        <>
          <Model
            file="car/wheel-racing.glb"
            length={0.95}
            at={[0, 0.2, 0]}
            rotation={[0, Math.PI / 2, 0]}
          />
          <Box at={[0, 0.13, 0]} size={[0.9, 0.12, 0.6]} color="#ff6a1f" />
        </>
      );
    if (index === 4)
      return (
        <>
          <Box at={[0, 0.55, 0]} size={[0.75, 0.9, 0.55]} color="#353b54" />
          <Box at={[0, 1.03, 0]} size={[0.3, 0.09, 0.24]} color="#7c3aed" />
          <Box at={[0, 0.5, 0.3]} size={[0.45, 0.15, 0.025]} color="#55cbab" />
        </>
      );
    return index === 2 ? (
      <Folder />
    ) : (
      <Screen
        color={
          effect === "review"
            ? "#ff6a1f"
            : effect === "align"
              ? "#28967b"
              : "#0967ff"
        }
      />
    );
  }
  if (index === 0 || index === 4)
    return (
      <>
        <Box at={[0, 0.7, 0]} size={[1.4, 0.12, 0.65]} color="#e4d8bf" />
        {[0, 1, 2].map((i) => (
          <group key={i} position={[-0.45 + i * 0.45, 0, 0]}>
            <mesh position={[0, 1, 0]} castShadow>
              <cylinderGeometry args={[0.179, 0.179, 0.48, 40]} />
              <meshPhysicalMaterial
                color="#e8f5ff"
                roughness={0.08}
                transparent
                opacity={0.32}
                metalness={0.05}
                clearcoat={1}
                depthWrite={false}
              />
            </mesh>
            <Cylinder
              at={[0, 1, 0]}
              radius={0.146}
              height={0.35}
              color={
                effect === "mix" ? "#adcdf0" : i % 2 ? "#ffb780" : "#c0a8ed"
              }
            />
            <Cylinder
              at={[0, 1.24, 0]}
              radius={0.18}
              height={0.06}
              color="#fff"
            />
          </group>
        ))}
      </>
    );
  if (index === 3)
    return (
      <>
        <Box at={[0, 0.3, 0]} size={[0.85, 0.45, 0.7]} color="#7c3aed" />
        <Cylinder
          at={[0, 0.95, 0]}
          radius={0.35}
          height={0.8}
          color="#bcd8eb"
        />
        <Box at={[0, 1.42, 0]} size={[0.9, 0.12, 0.6]} color="#0967ff" />
      </>
    );
  return index === 2 ? (
    <Screen color={effect === "repeat" ? "#ff6a1f" : "#0967ff"} />
  ) : (
    <Folder />
  );
}
function Room({
  cid,
  field,
  selected,
  inspect,
  reduced,
  quality = "high",
}: {
  cid: CareerId;
  field: Fieldwork;
  selected: string;
  inspect: (id: string) => void;
  reduced: boolean;
  quality?: SceneQuality;
}) {
  const spots = layouts[cid];
  const moving = useRef<Group>(null),
    rotor = useRef<Group>(null);
  const effect = field.action?.id;
  useFrame(({ clock }, delta) => {
    if (moving.current) {
      const target =
        cid === "nurse" && effect === "prepare" ? 2.7 : spots[3][0];
      moving.current.position.x = reduced
        ? target
        : moving.current.position.x +
          (target - moving.current.position.x) * Math.min(1, delta * 3);
    }
    if (rotor.current && !reduced && (effect === "mix" || effect === "change"))
      rotor.current.rotation.y = clock.elapsedTime * 4;
  });
  return (
    <>
      <color
        attach="background"
        args={[
          cid === "nurse"
            ? "#eee9f4"
            : cid === "engineer"
              ? "#f0e8de"
              : "#e7edf3",
        ]}
      />
      <StudioLight quality={quality} />
      <Box at={[0, -0.15, 0]} size={[7.6, 0.3, 6.2]} color="#ced6da" />
      <Box at={[0, 0.03, 0]} size={[7.3, 0.08, 5.9]} color="#f6f5f1" />
      <Box at={[0, 1.25, -2.8]} size={[7.3, 2.5, 0.12]} color="#d8e1e7" />
      <Box at={[-3.65, 0.55, -0.6]} size={[0.12, 1.1, 4.4]} color="#d8e1e7" />
      <Box
        at={[0, 0.09, 0.7]}
        size={[0.65, 0.015, 3.8]}
        color={effect === "prepare" ? "#a5dace" : "#e2dceb"}
      />
      <RoomDetails cid={cid} />
      {field.objects.map((o, index) => (
        <group
          key={o.id}
          position={
            reduced && cid === "nurse" && index === 3 && effect === "prepare"
              ? [2.7, 0, spots[index][2]]
              : spots[index]
          }
          ref={index === 3 ? moving : undefined}
          onClick={(e) => {
            e.stopPropagation();
            inspect(o.id);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            (e.nativeEvent.target as HTMLElement).style.cursor = "pointer";
          }}
          onPointerOut={(e) => {
            (e.nativeEvent.target as HTMLElement).style.cursor = "grab";
          }}
        >
          <Props
            cid={cid}
            index={index}
            effect={effect}
            reduced={reduced}
            value={field.metricValue}
          />
          <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry
              args={[0.7, selected === o.id ? 0.065 : 0.035, 8, 36]}
            />
            <meshStandardMaterial
              color={
                selected === o.id
                  ? "#7c3aed"
                  : field.inspected.includes(o.id)
                    ? "#0967ff"
                    : "#ff6a1f"
              }
            />
          </mesh>
        </group>
      ))}
      {cid === "researcher" && (effect === "mix" || effect === "change") && (
        <group position={[spots[3][0], 1.2, spots[3][2]]} ref={rotor}>
          <Box at={[0, 0, 0]} size={[0.55, 0.06, 0.08]} color="#ff6a1f" />
          <Box at={[0, 0, 0]} size={[0.08, 0.06, 0.55]} color="#ff6a1f" />
        </group>
      )}
      {["patch", "coordinate", "review"].includes(effect || "") && (
        <Arrival reduced={reduced}>
          <Person />
        </Arrival>
      )}
      {effect === "change" && (
        <Cylinder
          at={[2.8, 0.4, 1.6]}
          radius={0.23}
          height={0.65}
          color="#ff6a1f"
        />
      )}
      {effect === "repeat" && (
        <Box at={[0.6, 1.5, -1.63]} size={[0.15, 0.7, 0.04]} color="#ff6a1f" />
      )}
      {cid === "engineer" && effect === "power" && (
        <group position={[2.2, 1.25, -1.12]}>
          <Box at={[0, 0, 0]} size={[0.7, 0.4, 0.05]} color="#0967ff" />
          {[-0.2, 0, 0.2].map((x) => (
            <Box
              key={x}
              at={[x, 0, 0.04]}
              size={[0.11, 0.16, 0.03]}
              color="#69e1b8"
            />
          ))}
        </group>
      )}
      <Controls
        reduced={reduced}
        focus={spots[field.objects.findIndex((o) => o.id === selected)]}
      />
    </>
  );
}
export default function WorkplaceScene(props: {
  cid: CareerId;
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
      camera={{ position: [8, 7, 9], zoom: 55 }}
      dpr={[1, props.quality === "balanced" ? 1.25 : 2]}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: ACESFilmicToneMapping,
        outputColorSpace: SRGBColorSpace,
      }}
      frameloop={props.reduced ? "demand" : "always"}
    >
      <Room {...props} />
    </Canvas>
  );
}
