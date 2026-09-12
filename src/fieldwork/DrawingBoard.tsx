import { useCallback, useEffect, useRef, useState } from "react";
import {
  Excalidraw,
  MainMenu,
  CaptureUpdateAction,
  exportToSvg,
  exportToBlob,
  loadLibraryFromBlob,
  restoreElements,
} from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import type { DrawingScene } from "./types";
import { downloadFile } from "./types";

import type { CareerId } from "../data";
import { drawingGuideDescriptions, projectTemplate } from "./project-templates";
import DrawingExample from "./DrawingExample";
import "./drawing-guide.css";
export default function DrawingBoard({
  initial,
  careerId = "farmer",
  onChange,
  locked,
  onStartNew,
}: {
  initial: DrawingScene;
  careerId?: CareerId;
  onChange: (scene: DrawingScene) => void;
  locked: boolean;
  onStartNew: () => void;
}) {
  const [editor, setEditor] = useState<ExcalidrawImperativeAPI | null>(null);
  const [error, setError] = useState("");
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [exampleOpen, setExampleOpen] = useState(false);
  const [hasElements, setHasElements] = useState(initial.elements.length > 0);
  const closeExample = useCallback(() => setExampleOpen(false), []);
  const libraryFile = useRef<HTMLInputElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const previousElements = useRef<string | null>(null);
  useEffect(() => {
    const host = canvasHost.current;
    if (!host) return;
    const containWheel = (event: WheelEvent) => {
      event.preventDefault();
    };
    host.addEventListener("wheel", containWheel, { passive: false });
    return () => host.removeEventListener("wheel", containWheel);
  }, []);
  const importLibrary = async (file?: File) => {
    if (!editor || libraryBusy) return;
    setLibraryBusy(true);
    setError("");
    setNotice("");
    try {
      if (file && file.size > 2_000_000)
        throw new Error("2MB 이하의 도형 라이브러리를 골라 주세요.");
      let blob: Blob;
      if (file) blob = file;
      else {
        const response = await fetch("/libraries/architecture.excalidrawlib");
        if (!response.ok)
          throw new Error("기본 라이브러리를 불러오지 못했어요.");
        blob = await response.blob();
      }
      const items = await loadLibraryFromBlob(blob);
      await editor.updateLibrary({
        libraryItems: items,
        merge: true,
        openLibraryMenu: true,
      });
      setNotice(
        `${items.length}개 도형을 가져왔어요. 라이브러리에서 눌러 배치해 보세요.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "라이브러리를 읽지 못했어요.");
    } finally {
      setLibraryBusy(false);
      if (libraryFile.current) libraryFile.current.value = "";
    }
  };
  const png = async () => {
    if (!editor) return;
    setError("");
    try {
      const blob = await exportToBlob({
        elements: editor.getSceneElements(),
        appState: { ...editor.getAppState(), exportBackground: true },
        files: {},
        mimeType: "image/png",
      });
      downloadFile(`KingCareer-${careerId}-설계도.png`, blob, "image/png");
    } catch {
      setError("PNG를 만들지 못했어요. 다시 시도해 주세요.");
    }
  };
  const seed = () => {
    if (!editor || locked) return;
    const current = editor.getSceneElements();
    if (current.length) {
      editor.scrollToContent(current, { fitToContent: true, animate: false });
      setNotice("");
      return;
    }
    const elements = projectTemplate(careerId);
    if (current.length + elements.length > 250) {
      setError(
        "도형이 많아 가이드를 더 넣기 어려워요. 완성 그림 예시를 참고하거나 필요 없는 도형을 지워 주세요.",
      );
      return;
    }
    editor.updateScene({
      elements: [...current, ...elements],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
    editor.scrollToContent(elements, { fitToContent: true, animate: false });
    setNotice("네모 안의 글을 두 번 눌러 고쳐요. 도형과 화살표도 자유롭게 그릴 수 있어요.");
  };
  const svg = async () => {
    if (!editor) return;
    setError("");
    try {
      const result = await exportToSvg({
        elements: editor.getSceneElements(),
        appState: { ...editor.getAppState(), exportBackground: true },
        files: {},
      });
      downloadFile(
        `KingCareer-${careerId}-설계도.svg`,
        result.outerHTML,
        "image/svg+xml;charset=utf-8",
      );
    } catch {
      setError("이미지를 내보내지 못했어요. 다시 시도해 주세요.");
    }
  };
  return (
    <section className="kc-editor-panel" aria-label="프로젝트 설계 도구">
      <div className="kc-board-tools" data-help="studio-tools">
        <button aria-label={hasElements ? "그림 전체 보기" : "손그림 흐름도 넣기"} disabled={locked || !editor} onClick={seed}>
          <span className="drawing-tool-full">{hasElements ? "그림 전체 보기" : "손그림 흐름도 넣기"}</span><span className="drawing-tool-short" aria-hidden="true">{hasElements ? "전체 보기" : "도안 넣기"}</span>
        </button>
        <button aria-label="완성 그림 예시" onClick={() => setExampleOpen(true)}><span className="drawing-tool-full">완성 그림 예시</span><span className="drawing-tool-short" aria-hidden="true">예시</span></button>
        <details className="kc-drawing-exports">
          <summary aria-label="그림 받기와 도형 라이브러리">더 보기</summary>
          <div>
            <button disabled={locked || !editor} onClick={onStartNew}>기존 초안 보관하고 새 손그림 시작</button>
            <button disabled={!editor} onClick={() => void svg()}>
              현재 설계도 SVG 받기
            </button>
            <button disabled={!editor} onClick={() => void png()}>
              PNG 그림 받기
            </button>
            {!locked && (
              <details className="kc-library-section">
                <summary>도형 라이브러리 · 필요한 도형 추가하기</summary>
                <div className="kc-library-tools">
                  <button
                    disabled={!editor || libraryBusy}
                    onClick={() => void importLibrary()}
                  >
                    {libraryBusy
                      ? "도형 불러오는 중…"
                      : "공개 배치도 도형 42개 가져오기"}
                  </button>
                  <button
                    disabled={!editor || libraryBusy}
                    onClick={() => libraryFile.current?.click()}
                  >
                    받아둔 라이브러리 파일 열기
                  </button>
                  <a
                    href="https://libraries.excalidraw.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    공개 도형 둘러보기
                  </a>
                  <input
                    ref={libraryFile}
                    type="file"
                    hidden
                    accept=".excalidrawlib,.json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void importLibrary(file);
                    }}
                  />
                  <small>
                    Architecture floor plan symbols · Arqtangeles · MIT ·{" "}
                    <a
                      href="/libraries/LICENSE-excalidraw-libraries.txt"
                      target="_blank"
                      rel="noreferrer"
                    >
                      이용 조건
                    </a>
                  </small>
                </div>
              </details>
            )}
          </div>
        </details>
      </div>
      {notice && (
        <p className="kc-note" role="status">
          {notice}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="kc-drawing-board" ref={canvasHost}>
        <Excalidraw
          excalidrawAPI={setEditor}
          langCode="ko-KR"
          theme="light"
          aiEnabled={false}
          viewModeEnabled={locked}
          handleKeyboardGlobally={false}
          initialData={{
            elements: restoreElements(
              initial.elements as unknown as Parameters<
                typeof restoreElements
              >[0],
              null,
            ),
            appState: { viewBackgroundColor: "#ffffff", currentItemStrokeColor: "#252525", currentItemBackgroundColor: "transparent", currentItemRoughness: 1.5, currentItemStrokeWidth: 2, currentItemFontFamily: 5 },
            scrollToContent: true,
          }}
          onChange={(elements) => {
            const visible = elements.filter(element => !element.isDeleted);
            setHasElements(visible.length > 0);
            const fingerprint = JSON.stringify(visible);
            // Excalidraw normalizes old scenes on mount and emits view changes.
            // Neither should create a new student revision before an edit.
            const previous = previousElements.current;
            previousElements.current = fingerprint;
            if (previous === null || previous === fingerprint) return;
            onChange({
              elements: visible.map(element => ({ ...element })),
              appState: { viewBackgroundColor: "#ffffff" },
            });
          }}
          onPaste={(data) => !data.files?.length}
          validateEmbeddable={false}
          onLinkOpen={(_element, event) => event.preventDefault()}
          UIOptions={{
            tools: { image: false },
            canvasActions: {
              loadScene: false,
              export: false,
              saveToActiveFile: false,
              toggleTheme: false,
            },
          }}
        >
          <MainMenu>
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
        </Excalidraw>
      </div>
      <small className="kc-board-footnote">
        {drawingGuideDescriptions[careerId]}
      </small>
      {exampleOpen && (
        <DrawingExample careerId={careerId} onClose={closeExample} />
      )}
    </section>
  );
}
