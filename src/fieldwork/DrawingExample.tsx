import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "../components";
import type { CareerId } from "../data";
import { sceneSvg } from "./ArtifactThumbnail";
import { drawingGuideDescriptions, projectTemplate } from "./project-templates";

export default function DrawingExample({
  careerId,
  onClose,
}: {
  careerId: CareerId;
  onClose: () => void;
}) {
  const [drawing, setDrawing] = useState<SVGSVGElement | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    let disposed = false;
    setDrawing(null);
    setError(false);
    void sceneSvg({
      elements: projectTemplate(careerId, true),
      appState: { viewBackgroundColor: "#ffffff" },
    }, false)
      .then((svg) => {
        if (disposed) return;
        // This trusted, local template is displayed in the document so it can
        // reuse editor fonts without exporting/embedding every font subset.
        setDrawing(svg);
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
    };
  }, [careerId, attempt]);
  useEffect(() => {
    const app = document.querySelector<HTMLElement>(".app-shell");
    const previous = app?.inert;
    if (app) app.inert = true;
    return () => {
      if (app) app.inert = previous ?? false;
    };
  }, []);
  return createPortal(
    <div className="drawing-example-overlay">
      <Modal title="완성 그림 예시" onClose={onClose}>
        <p className="drawing-example-intro">
          내 도안과 같은 손그림 흐름도예요. 연결과 메모를 어떻게 덧붙였는지 살펴봐요.
        </p>
        <figure>
          <div
            className={`drawing-example-image ${zoom ? "is-zoomed" : ""}`}
            tabIndex={0}
            role="region"
            aria-label="완성 그림 보기"
          >
            {drawing ? (
              <div role="img" aria-label={drawingGuideDescriptions[careerId]}
                ref={(host) => { if (host) host.replaceChildren(drawing); }} />
            ) : error ? (
              <p role="alert">
                예시 그림을 불러오지 못했어요.{" "}
                <button onClick={() => setAttempt((value) => value + 1)}>
                  다시 시도
                </button>
              </p>
            ) : (
              <p role="status">예시 그림을 준비하는 중…</p>
            )}
          </div>
          <figcaption>{drawingGuideDescriptions[careerId]}</figcaption>
        </figure>
        <footer>
          <p>연습용 예시 · 내 결과물에는 저장되지 않아요.</p>
          <button
            onClick={() => setZoom((value) => !value)}
            aria-pressed={zoom}
          >
            {zoom ? "전체 그림 보기" : "크게 보기"}
          </button>
          <button className="kc-button" onClick={onClose}>
            내 그림으로 돌아가기
          </button>
        </footer>
      </Modal>
    </div>,
    document.body,
  );
}
