import { useRef, useState } from "react";
import {
  Excalidraw,
  MainMenu,
  convertToExcalidrawElements,
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
import { projectFor } from "./workplaces";
export default function DrawingBoard({
  initial,
  careerId = "farmer",
  onChange,
  locked,
}: {
  initial: DrawingScene;
  careerId?: CareerId;
  onChange: (scene: DrawingScene) => void;
  locked: boolean;
}) {
  const [editor, setEditor] = useState<ExcalidrawImperativeAPI | null>(null);
  const [error, setError] = useState("");
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const libraryFile = useRef<HTMLInputElement>(null);
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
    if (
      !editor ||
      (editor.getSceneElements().length &&
        !confirm(
          "현재 설계도를 기본 도안으로 바꿀까요? 이전 저장본은 수정 이력에 남아요.",
        ))
    )
      return;
    if (careerId !== "farmer") {
      const project = projectFor(careerId);
      const elements = convertToExcalidrawElements([
        {
          type: "text",
          x: 80,
          y: 60,
          text: project.title,
          fontSize: 26,
          strokeColor: "#262938",
        },
        ...project.nodes.map((label, i) => ({
          type: "rectangle" as const,
          x: 80 + i * 210,
          y: 180,
          width: 170,
          height: 100,
          backgroundColor: ["#ffe1ce", "#e6d6ff", "#d6e7ff", "#ffe1ce"][i],
          fillStyle: "solid" as const,
          label: { text: label },
        })),
        ...[0, 1, 2].map((i) => ({
          type: "arrow" as const,
          x: 253 + i * 210,
          y: 230,
          width: 32,
          height: 0,
        })),
        {
          type: "text",
          x: 80,
          y: 340,
          text: "연결, 배치, 안내를 바꾸고 나만의 해결 방법을 추가해 보세요.",
          fontSize: 18,
          strokeColor: "#5c6570",
        },
      ]);
      editor.updateScene({ elements });
      editor.scrollToContent();
      return;
    }
    const elements = convertToExcalidrawElements([
      {
        type: "rectangle",
        x: 80,
        y: 80,
        width: 670,
        height: 430,
        strokeColor: "#365747",
        backgroundColor: "#edf5e9",
        fillStyle: "solid",
        strokeWidth: 2,
      },
      {
        type: "text",
        x: 110,
        y: 100,
        text: "나의 스마트팜 개선 배치도",
        fontSize: 26,
        strokeColor: "#365747",
      },
      ...[140, 410].map((x) => ({
        type: "rectangle" as const,
        x,
        y: 210,
        width: 150,
        height: 200,
        backgroundColor: "#b2dfaa",
        fillStyle: "solid" as const,
        label: { text: x === 140 ? "A 재배대" : "B 재배대" },
      })),
      {
        type: "rectangle",
        x: 600,
        y: 220,
        width: 100,
        height: 70,
        backgroundColor: "#cdb6f0",
        fillStyle: "solid",
        label: { text: "급수 탱크" },
      },
      {
        type: "ellipse",
        x: 330,
        y: 170,
        width: 55,
        height: 55,
        backgroundColor: "#b4d1ff",
        fillStyle: "solid",
        label: { text: "센서" },
      },
      {
        type: "text",
        x: 110,
        y: 455,
        text: "환기 위치, 점검 동선, 인계 공간을 추가해 보세요.",
        fontSize: 17,
        strokeColor: "#5c6570",
      },
    ]);
    editor.updateScene({ elements });
    editor.scrollToContent();
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
    <>
      <div className="kc-board-tools">
        <button disabled={locked || !editor} onClick={seed}>
          {careerId === "farmer"
            ? "기본 온실 도안 넣기"
            : "직무 설계 도안 넣기"}
        </button>
        <button disabled={!editor} onClick={() => void svg()}>
          현재 설계도 SVG 받기
        </button>
        <button disabled={!editor} onClick={() => void png()}>
          PNG 그림 받기
        </button>
        <span>도형·화살표·글자로 표현해 봐요.</span>
      </div>
      {!locked && (
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
      )}
      {notice && (
        <p className="kc-note" role="status">
          {notice}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="kc-drawing-board">
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
            appState: { viewBackgroundColor: "#ffffff" },
            scrollToContent: true,
          }}
          onChange={(elements) =>
            onChange({
              elements: elements
                .filter((e) => !e.isDeleted)
                .map((e) => ({ ...e })),
              appState: { viewBackgroundColor: "#ffffff" },
            })
          }
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
        도형과 텍스트를 서버에 저장해요. 외부 이미지·링크 삽입은 지원하지
        않아요.
      </small>
    </>
  );
}
