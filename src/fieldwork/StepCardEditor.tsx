import { useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, BookOpen, ChevronDown, Plus, Trash2 } from "lucide-react";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { CareerId } from "../data";
import { readStepCards, stepMetadata, type StepCard } from "./step-card-data";
import { projectLearning, projectStepPrompts } from "./project-learning";
import type { DrawingScene } from "./types";
import "./project-learning.css";

const blank = (): StepCard => ({
  id: `kc-step-${crypto.randomUUID()}`,
  title: "",
  detail: "",
});
type Skeleton = NonNullable<Parameters<typeof convertToExcalidrawElements>[0]>;

function sceneWithCards(scene: DrawingScene, cards: StepCard[]): DrawingScene {
  const previousIds = new Set(
    scene.elements.filter(stepMetadata).map((element) => element.id),
  );
  const previousCards = scene.elements.filter((element) => element.type === "rectangle" && stepMetadata(element));
  const cardIds = new Set(previousCards.map((element) => element.id));
  const kept = scene.elements.filter(
    (element) =>
      !previousIds.has(element.id) && !cardIds.has(element.containerId),
  );
  const entered = cards.filter(
    (card) => card.title.trim() || card.detail.trim(),
  );
  // Keep freehand work intact, and place the card column alongside it.
  const offset = kept.reduce(
    (right, element) =>
      Math.max(right, Number(element.x || 0) + Number(element.width || 0)),
    0,
  );
  const left = previousCards.length ? Math.min(...previousCards.map((element) => Number(element.x))) : offset ? offset + 80 : 60;
  const skeleton: Skeleton = [];
  let top = 60;
  entered.forEach((card, index) => {
    const text = `${card.title}\n${card.detail}`.trimEnd();
    const lines = text
      .split("\n")
      .reduce(
        (total, line) => total + Math.max(1, Math.ceil(line.length / 20)),
        0,
      );
    const height = Math.max(140, lines * 28 + 56);
    skeleton.push({
      id: card.id,
      type: "rectangle",
      x: left,
      y: top,
      width: 440,
      height,
      backgroundColor: ["#FFF0E7", "#F0E8FF", "#EAF2FF"][index % 3],
      strokeColor: "#51465E",
      fillStyle: "solid",
      roughness: 0,
      label: { text, fontSize: 20, fontFamily: 2 },
      customData: { kingCareerStep: { schema: 1, order: index } },
    });
    if (index < entered.length - 1)
      skeleton.push({
        type: "arrow",
        id: `kc-step-link-${card.id}`,
        x: left + 220,
        y: top + height,
        width: 0,
        height: 52,
        start: { id: card.id },
        end: { id: entered[index + 1].id },
        endArrowhead: "arrow",
        roughness: 0,
        customData: { kingCareerStep: { schema: 1, order: index } },
      });
    top += height + 70;
  });
  const generated = convertToExcalidrawElements(skeleton, { regenerateIds: false }).map((element) => ({ ...element }));
  const retainedIds = new Set(kept.map((element) => element.id));
  const generatedById = new Map(generated.map((element) => [element.id, element]));
  // Retain labels added to arrows and the reciprocal bindings of freehand arrows.
  // A label on a removed connection becomes standalone text, so its words survive.
  for (const element of generated) {
    const previous = scene.elements.find((candidate) => candidate.id === element.id);
    const external = ((previous?.boundElements || []) as { id: string; type: "arrow" | "text" }[]).filter((binding) => retainedIds.has(binding.id));
    if (external.length) element.boundElements = [...(element.boundElements || []), ...external];
  }
  const retained = kept.map((element) => {
    if (typeof element.containerId === "string" && previousIds.has(element.containerId)) {
      const parent = generatedById.get(element.containerId);
      return parent ? { ...element, x: parent.x + parent.width / 2 - Number(element.width) / 2, y: parent.y + parent.height / 2 - Number(element.height) / 2 } : { ...element, containerId: null };
    }
    if (element.type === "arrow") {
      const copy = { ...element };
      for (const key of ["startBinding", "endBinding"]) {
        const binding = copy[key] as { elementId: string } | null;
        if (binding && previousIds.has(binding.elementId) && !generatedById.has(binding.elementId)) copy[key] = null;
      }
      return copy;
    }
    return element;
  });
  return {
    elements: [...retained, ...generated],
    appState: { viewBackgroundColor: "#ffffff" },
  };
}

export default function StepCardEditor({
  initial,
  onChange,
  locked,
  example,
  careerId,
  onWriting,
}: {
  initial: DrawingScene;
  onChange: (scene: DrawingScene) => void;
  locked: boolean;
  example: string;
  careerId?: CareerId;
  onWriting?: () => void;
}) {
  const [cards, setCards] = useState(() => {
    const saved = readStepCards(initial);
    return saved.length ? saved : [blank()];
  });
  const [notice, setNotice] = useState("");
  const [scaffold, setScaffold] = useState(false);
  const currentScene = useRef(initial);
  const host = useRef<HTMLElement>(null);
  const learning = careerId ? projectLearning[careerId] : undefined;
  const prompts = careerId ? projectStepPrompts[careerId] : undefined;
  const hasCards = cards.some((card) => card.title.trim() || card.detail.trim());
  const hasArtwork = currentScene.current.elements.some((element) => !element.isDeleted);
  const change = (next: StepCard[]) => {
    const scene = sceneWithCards(currentScene.current, next);
    currentScene.current = scene;
    setCards(next);
    onChange(scene);
  };
  const focusTitle = (id: string) =>
    requestAnimationFrame(() =>
      Array.from(
        host.current?.querySelectorAll<HTMLElement>("[data-card-id]") || [],
      )
        .find((element) => element.dataset.cardId === id)
        ?.querySelector<HTMLInputElement>("input")
        ?.focus(),
    );
  const move = (index: number, direction: number) => {
    const next = [...cards];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    change(next);
    setNotice(`${index + 1}번 카드를 ${index + direction + 1}번째로 옮겼어요.`);
    focusTitle(cards[index].id);
  };
  return (
    <section
      className="step-editor"
      ref={host}
      aria-labelledby="step-editor-title"
    >
      <header>
        <h2 id="step-editor-title">어떤 순서로 해결할까?</h2>
        {learning ? (
          <p className="step-learning-goal"><span>만들 결과물</span>{learning.goal}</p>
        ) : <p>할 일을 한 장씩 적어봐. 순서대로 연결된 설계도로 저장돼.</p>}
        {initial.elements.some((element) => !element.isDeleted) && <small className="step-layout-note">카드를 고치면 카드 영역이 순서대로 정렬돼. 위치와 꾸밈은 ‘자유롭게 그리기’에서 다듬어줘.</small>}
      </header>
      {learning && (
        <div className="step-learning">
          <details className="step-worked-example">
            <summary><BookOpen size={18} aria-hidden="true" /><span>완성 예시 보기</span><ChevronDown size={18} aria-hidden="true" /></summary>
            <div className="step-worked-example-body">
              <p className="step-example-caption">연습용 예시야. 만드는 방법을 살펴보고 내 아이디어로 바꿔봐.</p>
              <ol>
                {learning.steps.map((step, index) => (
                  <li key={step.title}><span aria-hidden="true">{index + 1}</span><div><h3>{step.title}</h3><p>{step.detail}</p></div></li>
                ))}
              </ol>
              <p className="step-example-why"><strong>이렇게 만든 이유</strong>{learning.why}</p>
              <small>예시는 내 작업에 저장되지 않아.</small>
            </div>
          </details>
          {!hasCards && !hasArtwork && !scaffold && (
            <div className="step-scaffold-start">
              <p>첫 줄이 막막하면, 살펴보기 → 바꾸기 → 확인하기 순서로 생각해봐.</p>
              <button type="button" disabled={locked} onClick={() => {
                const next = [blank(), blank(), blank()];
                // Empty scaffolds are only local UI. Do not create artwork or
                // save a completed educational example as the learner's work.
                setCards(next);
                setScaffold(true);
                setNotice("빈 카드 3개를 준비했어요. 직접 내용을 적으면 설계도로 저장돼요.");
                focusTitle(next[0].id);
              }}><Plus size={17} aria-hidden="true" />3단계 틀로 시작</button>
            </div>
          )}
        </div>
      )}
      <ol className="step-card-list">
        {cards.map((card, index) => (
          <li key={card.id} data-card-id={card.id}>
            <fieldset disabled={locked}>
              <legend>
                <span>{index + 1}</span> 단계
              </legend>
              {scaffold && index < 3 && <p className="step-scaffold-prompt">{["무엇을 살펴볼까?", "무엇을 바꿔볼까?", "어떻게 확인할까?"][index]}</p>}
              <label>
                할 일
                <input
                  aria-label={`${index + 1}단계 할 일`}
                  value={card.title}
                  maxLength={60}
                  placeholder={prompts?.[index]?.title || (index === 0 ? `예: ${example}` : "다음에 할 일을 짧게 적어봐.")}
                  onChange={(event) =>
                    change(
                      cards.map((item) =>
                        item.id === card.id
                          ? { ...item, title: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <label>
                어떻게 할까? <small>선택</small>
                <textarea
                  aria-label={`${index + 1}단계 방법`}
                  value={card.detail}
                  maxLength={240}
                  rows={2}
                  placeholder={prompts?.[index]?.detail || "누가, 무엇을 할지 짧게 적어봐."}
                  onChange={(event) =>
                    change(
                      cards.map((item) =>
                        item.id === card.id
                          ? { ...item, detail: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </label>
              <div className="step-card-actions">
                <button
                  type="button"
                  disabled={index === 0}
                  aria-label={`${index + 1}단계 위로 이동`}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={16} /> 위로
                </button>
                <button
                  type="button"
                  disabled={index === cards.length - 1}
                  aria-label={`${index + 1}단계 아래로 이동`}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={16} /> 아래로
                </button>
                <button
                  type="button"
                  aria-label={`${index + 1}단계 삭제`}
                  onClick={() => {
                    const next = cards.filter((item) => item.id !== card.id);
                    if (!next.length) next.push(blank());
                    change(next);
                    setNotice(`${index + 1}단계를 지웠어요.`);
                    focusTitle(next[Math.min(index, next.length - 1)].id);
                  }}
                >
                  <Trash2 size={16} /> 삭제
                </button>
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="step-add"
        disabled={locked || cards.length >= 8}
        onClick={() => {
          const added = blank();
          setCards([...cards, added]);
          focusTitle(added.id);
        }}
      >
        <Plus size={18} /> 단계 추가 <span>{cards.length} / 8</span>
      </button>
      {hasCards && onWriting && (
        <div className="step-writing-next">
          <div><strong>다음은 내 아이디어 설명</strong><p>무엇을 바꿨는지, 왜 그렇게 했는지 짧게 정리해봐.</p></div>
          <button type="button" disabled={locked} onClick={onWriting}>이제 내 설명 쓰기<ArrowRight size={17} aria-hidden="true" /></button>
        </div>
      )}
      <p className="step-editor-footnote">
        ‘자유롭게 그리기’에서 설계도를 보고 그림 파일로 받을 수 있어.
      </p>
      <span className="sr-only" role="status">
        {notice}
      </span>
    </section>
  );
}
