import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Activity } from "../data";
import type { DrawingScene } from "./types";

export async function sceneSvg(scene: DrawingScene) {
  const { exportToSvg, restoreElements } = await import("@excalidraw/excalidraw");
  const elements = restoreElements(scene.elements as unknown as Parameters<typeof restoreElements>[0], null);
  return exportToSvg({ elements, appState: { ...scene.appState, exportBackground: true }, files: {} });
}

export default function ArtifactThumbnail({ activity }: { activity: Activity }) {
  const host = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "180px" });
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let objectUrl = "";
    setUrl("");
    setFailed(false);
    void api<Activity & { scene?: DrawingScene }>(`/portfolio/${activity.id}/artifact`, { signal: controller.signal })
      .then(async (artifact) => {
        if (!artifact.scene?.elements.some((el) => !el.isDeleted)) throw new Error("No drawing");
        const svg = await sceneSvg(artifact.scene);
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(new Blob([svg.outerHTML], { type: "image/svg+xml" }));
        setUrl(objectUrl);
      }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [activity.id, visible]);
  return <span ref={host} className="portfolio-drawing-thumb">
    {url ? <img src={url} alt={`${activity.title}의 실제 설계도`} /> : <span>{failed ? "설계도는 결과물에서 열어봐" : "내 설계도를 불러오는 중…"}</span>}
    <img className="portfolio-job-stamp" src={`/brand/12_career_kingcrabs/${activity.careerId}.png`} alt="" width={52} height={52} loading="lazy" />
  </span>;
}
