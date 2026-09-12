import { useEffect, useState } from "react";
import { ArrowUpRight, Download, FileImage } from "lucide-react";
import { api, errorMessage } from "../api";
import type { Activity } from "../data";
import type { DrawingScene } from "./types";
import { downloadFile } from "./types";
import { sceneSvg } from "./ArtifactThumbnail";
type Artifact = Activity & { scene?: DrawingScene; observations?: string[] };
export default function ArtifactPreview({
  activityId,
  evaluation,
}: {
  activityId: string;
  evaluation?: Activity;
}) {
  const [loadedArtifact, setArtifact] = useState<Artifact | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const artifact = loadedArtifact && evaluation?.id === activityId
    ? { ...loadedArtifact, feedback: evaluation.feedback, observations: evaluation.observations, evaluationStatus: evaluation.evaluationStatus }
    : loadedArtifact;
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewRetry, setPreviewRetry] = useState(0);
  const hasDrawing = !!artifact?.scene?.elements.some((element) => !element.isDeleted);
  const diagramText = artifact?.scene?.elements
    .filter((element) => !element.isDeleted && element.type === "text")
    .map((element) => String(element.originalText ?? element.text ?? "").trim())
    .filter(Boolean) || [];
  useEffect(() => {
    let live = true;
    let url = "";
    setPreviewUrl("");
    setPreviewError("");
    if (loadedArtifact?.scene?.elements.some((element) => !element.isDeleted)) {
      void sceneSvg(loadedArtifact.scene).then((svg) => {
        if (!live) return;
        url = URL.createObjectURL(new Blob([svg.outerHTML], { type: "image/svg+xml" }));
        setPreviewUrl(url);
      }).catch(() => {
        if (live) setPreviewError("설계도 미리보기를 열지 못했어요. 설명과 제출물은 그대로 남아 있어요.");
      });
    }
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
  }, [loadedArtifact, previewRetry]);
  const downloadDocument = async () => {
    if (!artifact || exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const doc = document.implementation.createHTMLDocument(artifact.title);
      doc.documentElement.lang = "ko";
      const meta = doc.createElement("meta"); meta.setAttribute("charset", "utf-8"); doc.head.append(meta);
      const style = doc.createElement("style");
      style.textContent = "body{max-width:860px;margin:48px auto;padding:0 24px;font:16px/1.8 system-ui,sans-serif;color:#242638}h1{font-size:30px}h2{font-size:20px;color:#5d2ab6}p{white-space:pre-wrap;overflow-wrap:anywhere}img{width:100%;max-height:520px;object-fit:contain;border:1px solid #e5e5ec;border-radius:16px}small{color:#666}@media print{body{margin:0;max-width:none}h2{break-after:avoid}img,p{break-inside:avoid}}";
      doc.head.append(style);
      const add = (tag: string, text: string) => { const el = doc.createElement(tag); el.textContent = text; doc.body.append(el); };
      add("small", `KingCareer · ${new Date(artifact.date).toLocaleDateString("ko-KR")} · 제출한 수정본`);
      add("h1", artifact.title);
      if (artifact.scene?.elements.some((e) => !e.isDeleted)) {
        const svg = await sceneSvg(artifact.scene);
        const img = doc.createElement("img");
        img.alt = "제출한 설계도";
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`;
        doc.body.append(img);
      }
      artifact.answers.forEach((text, i) => { add("h2", ["발견한 문제", "개선 제안과 근거", "확인 방법"][i] || "나의 설명"); add("p", text); });
      if (artifact.reflection) { add("h2", "나에게 남은 것"); add("p", artifact.reflection); }
      if (artifact.interest != null) add("p", `활동 후 관심: ${artifact.interest} / 5`);
      add("h2", artifact.evaluationStatus === "ai_feedback" ? "AI 코치 피드백" : "활동 저장 안내 · AI 평가 아님");
      add("p", artifact.feedback);
      artifact.observations?.forEach((text) => add("p", text));
      add("small", "이 파일은 브라우저에서 열어 인쇄하거나 PDF로 저장할 수 있어요.");
      downloadFile(`KingCareer-${artifact.careerId}-${artifact.id.slice(0, 8)}-결과물.html`, `<!doctype html>\n${doc.documentElement.outerHTML}`, "text/html;charset=utf-8");
    } catch { setExportError("결과물 문서를 만들지 못했어요. 다시 시도해 주세요."); }
    finally { setExporting(false); }
  };
  useEffect(() => {
    let live = true;
    setError("");
    setArtifact(null);
    api<Artifact>(`/portfolio/${activityId}/artifact`)
      .then((value) => {
        if (live) setArtifact(value);
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      });
    return () => {
      live = false;
    };
  }, [activityId, retry]);
  return (
    <section className="portfolio-artifact" aria-label="제출한 설계도">
      <div className="portfolio-artifact-heading"><FileImage size={19} /><h3>내가 만든 설계도</h3><span>제출한 원본</span></div>
      {error && (
        <p className="portfolio-preview-error" role="alert">
          {error}{" "}
          <button
            onClick={() => { setError(""); setRetry((n) => n + 1); }}
          >
            다시 시도
          </button>
        </p>
      )}
      {!artifact ? (
        !error && <p className="portfolio-preview-loading" role="status">제출한 결과물을 불러오는 중…</p>
      ) : (
        <>
          <div className={`portfolio-artifact-image${hasDrawing ? "" : " is-empty"}`}>
            {previewUrl ? <img src={previewUrl} alt={`${artifact.title} — 제출한 설계도. 그림 속 글은 아래에서 읽을 수 있어요.`} />
              : previewError ? <div role="alert"><p>{previewError}</p><button onClick={() => setPreviewRetry((value) => value + 1)}>그림 다시 불러오기</button></div>
              : hasDrawing ? <p role="status">설계도를 펼치는 중…</p>
              : <div><img className="portfolio-artifact-crab" src={`/brand/12_career_kingcrabs/${artifact.careerId}.png`} alt="" /><p>설계도 없이 설명으로 남긴 결과물이야.<br />나의 아이디어를 읽어 봐.</p></div>}
          </div>
          {previewUrl && <div className="portfolio-artifact-image-actions"><a href={previewUrl} target="_blank" rel="noopener noreferrer">그림 크게 보기 <span className="sr-only">(새 탭)</span><ArrowUpRight size={16} /></a><a href={previewUrl} download={`KingCareer-${artifact.careerId}-설계도.svg`}><Download size={16} />그림 받기</a></div>}
          {diagramText.length > 0 && <details className="portfolio-artifact-transcript"><summary>그림 속 글 읽기</summary><ul>{diagramText.map((text, index) => <li className="preserve-text" key={index}>{text}</li>)}</ul></details>}
          <div className="portfolio-artifact-download">
            <button disabled={exporting} onClick={() => void downloadDocument()}><Download size={18} />{exporting ? "결과물 문서 만드는 중…" : "설계도와 설명 함께 받기"}</button>
            <p className="artifact-download-note">그림·설명·피드백을 한 파일에 담아 줄게.<br />받은 문서를 열어 인쇄하거나 PDF로 저장할 수 있어.</p>
            {exportError && <p role="alert">{exportError}</p>}
            <details className="portfolio-artifact-source"><summary>작업 원본 보관</summary><a href={`/api/v1/portfolio/${artifact.id}/artifact`} download>설계도·설명 원본 받기 (JSON)</a></details>
          </div>
        </>
      )}
    </section>
  );
}
