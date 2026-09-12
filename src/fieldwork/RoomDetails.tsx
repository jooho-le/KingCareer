import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import type { CareerId } from "../data";
import { Box, Model, Sign } from "./SceneKit";

export function AutomotiveBay({
  effect,
  reduced,
}: {
  effect?: string;
  reduced: boolean;
}) {
  const lift = useRef<Group>(null);
  useFrame((_, delta) => {
    if (lift.current) {
      const target = effect === "align" ? 0.36 : 0;
      lift.current.position.y = reduced
        ? target
        : lift.current.position.y +
          (target - lift.current.position.y) * Math.min(1, delta * 2);
    }
  });
  return (
    <>
      <Box at={[0, 0.07, 0]} size={[3.5, 0.12, 1.65]} color="#3a4351" metal />
      {[-0.7, 0.7].map((z) => (
        <group key={z}>
          <Box
            at={[0, 0.15, z]}
            size={[3.2, 0.09, 0.17]}
            color="#ff6a1f"
            metal
          />
          {[-1.35, 1.35].map((x) => (
            <Box
              key={x}
              at={[x, 0.28, z]}
              size={[0.14, 0.45, 0.14]}
              color="#82909b"
              metal
            />
          ))}
        </group>
      ))}
      <group
        ref={lift}
        position={[0, reduced && effect === "align" ? 0.36 : 0, 0]}
      >
        <Model
          file="car/sedan-sports.glb"
          length={2.85}
          at={[0, 0.22, 0]}
          rotation={[0, Math.PI / 2, 0]}
          paint
        />
      </group>
      <Sign
        title={effect === "align" ? "승인 점검 진행" : "시험 차량 · 정지 상태"}
        detail={
          effect === "align"
            ? "장착·균형 확인 / 재측정 대기"
            : "가상 시험 기록을 먼저 확인하세요"
        }
        at={[0, 0.22, 0.86]}
        width={1.75}
      />
      {effect === "align" && (
        <group position={[1.12, 0.67, 0.55]}>
          <Box at={[0, 0, 0]} size={[0.12, 0.6, 0.65]} color="#0967ff" metal />
          <mesh rotation={[Math.PI / 2, 0, Math.PI / 2]}>
            <torusGeometry args={[0.26, 0.022, 12, 48]} />
            <meshStandardMaterial
              color="#7c3aed"
              emissive="#7c3aed"
              emissiveIntensity={0.65}
            />
          </mesh>
        </group>
      )}
    </>
  );
}

export default function RoomDetails({ cid }: { cid: CareerId }) {
  const title = {
    developer: "SERVICE OPERATIONS",
    nurse: "CARE & HANDOVER",
    engineer: "MOBILITY LAB",
    researcher: "FOOD RESEARCH",
    farmer: "SMART FARM",
  }[cid];
  const accent =
    cid === "engineer" ? "#ff6a1f" : cid === "nurse" ? "#7c3aed" : "#0967ff";
  return (
    <>
      <Box at={[0, 2.36, -2.72]} size={[7.1, 0.11, 0.18]} color={accent} />
      <Sign
        title={title}
        detail="KingCareer / FIRST DAY AT WORK"
        at={[0, 2.04, -2.71]}
        width={2.6}
        color={accent}
      />
      {[-3.5, 3.5].map((x) => (
        <Box
          key={x}
          at={[x, 1.15, -2.63]}
          size={[0.12, 2.3, 0.18]}
          color="#8c9baa"
          metal
        />
      ))}
      {[-2, 2].map((x) => (
        <group key={x}>
          <Box at={[x, 2.28, -2.58]} size={[1.6, 0.065, 0.32]} color="#fff" />
          <mesh position={[x, 2.23, -2.57]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.4, 0.22]} />
            <meshStandardMaterial
              color="#fff"
              emissive="#fff5dd"
              emissiveIntensity={1.5}
            />
          </mesh>
        </group>
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <Box
          key={i}
          at={[-3.2 + i * 0.9, 0.079, 0]}
          size={[0.012, 0.009, 5.8]}
          color="#d3d9db"
        />
      ))}
      {[-2, -1, 0, 1, 2].map((z) => (
        <Box
          key={z}
          at={[0, 0.079, z]}
          size={[7.25, 0.009, 0.012]}
          color="#d3d9db"
        />
      ))}
      {cid === "engineer" ? (
        <>
          {[-1.65, 1.65].map((x) => (
            <Model
              key={x}
              file="car/cone.glb"
              length={0.43}
              at={[x - 0.9, 0.1, 1.43]}
            />
          ))}
          {[-2.7, -2.2, -1.7, -1.2, -0.7, -0.2, 0.3, 0.8].map((x) => (
            <Box
              key={x}
              at={[x, 0.09, -0.78]}
              size={[0.22, 0.01, 0.12]}
              color="#ff6a1f"
              rotation={[0, 0.35, 0]}
            />
          ))}
          <Sign
            title="TEST BAY 01"
            detail="가상 점검 · 주행 중지"
            at={[-0.9, 0.1, 1.72]}
            width={2.1}
            rotation={[-Math.PI / 2, 0, 0]}
            color={accent}
          />
        </>
      ) : (
        <>
          <Model
            file="furniture/pottedPlant.glb"
            length={0.95}
            at={[3.12, 0.1, 2.28]}
          />
          {cid === "developer" && (
            <>
              <Model
                file="furniture/chairDesk.glb"
                length={0.95}
                at={[-1.8, 0.1, 1.8]}
                rotation={[0, Math.PI, 0]}
              />
              <Model
                file="furniture/lampRoundFloor.glb"
                length={1.8}
                at={[-3.1, 0.1, -0.7]}
              />
            </>
          )}
          {cid === "nurse" && (
            <>
              <Box
                at={[-2.9, 1.28, 0.32]}
                size={[0.055, 2.2, 1.9]}
                color="#d3c6e6"
              />
              <Box
                at={[-2.9, 2.43, 0.32]}
                size={[0.065, 0.065, 2.1]}
                color="#80949f"
                metal
              />
              <Model
                file="furniture/cabinetBedDrawer.glb"
                length={0.65}
                at={[-2.48, 0.1, 1.68]}
              />
            </>
          )}
          {cid === "researcher" && (
            <>
              <Box
                at={[2.05, 0.7, -2.49]}
                size={[1.45, 0.1, 0.4]}
                color="#aebcc4"
                metal
              />
              {[0, 1, 2, 3].map((i) => (
                <mesh key={i} position={[1.56 + i * 0.3, 0.9, -2.48]}>
                  <cylinderGeometry args={[0.065, 0.065, 0.3, 24]} />
                  <meshPhysicalMaterial
                    color="#b8d8ee"
                    roughness={0.12}
                    transmission={0.6}
                    thickness={0.12}
                  />
                </mesh>
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}
