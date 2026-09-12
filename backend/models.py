from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator
import json
import math

CareerId = Literal["developer", "nurse", "farmer", "engineer", "researcher"]
Text = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]
DraftText = Annotated[str, StringConstraints(max_length=5000)]
Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]
Username = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[A-Za-z0-9_.-]{3,32}$")]
RequestId = Annotated[str, StringConstraints(min_length=8, max_length=128, pattern=r"^[A-Za-z0-9_.:-]+$")]
Interest = Annotated[int, Field(ge=1, le=5)]
Version = Annotated[int, Field(ge=0)]
AnswerIndex = Annotated[int, Field(ge=0, le=2)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Register(Input):
    username: Username
    password: Password
    name: Name
    school: Short = ""
    grade: Short = ""
    region: Short = ""
    interests: list[Short] = Field(default_factory=list, max_length=6)


class Login(Input):
    username: Username
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class ProfilePatch(Input):
    name: Name | None = None
    school: Short | None = None
    grade: Short | None = None
    region: Short | None = None
    interests: list[Short] | None = Field(default=None, max_length=6)
    notifications: bool | None = None


class PasswordChange(Input):
    currentPassword: Annotated[str, StringConstraints(min_length=1, max_length=128)]
    newPassword: Password


class AccountDelete(Input):
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class Saved(Input):
    saved: bool


class RequestInput(Input):
    clientRequestId: RequestId


class Diagnosis(RequestInput):
    careerId: CareerId
    answers: list[Annotated[int, Field(ge=0, le=3)]] = Field(min_length=6, max_length=6)


class ExperienceEvent(RequestInput):
    careerId: CareerId
    kind: Literal["explored", "saved", "questioned"]
    text: Text = ""


class SimulationCreate(Input):
    careerId: CareerId


class SimulationTurn(RequestInput):
    kind: Literal["start", "choice", "free", "question", "continue", "inspect", "compare", "act", "verify", "handover"]
    objectId: Short | None = None
    actionId: Short | None = None
    optionId: Short | None = None
    choiceIndex: AnswerIndex | None = None
    text: Text = ""
    expectedVersion: Version


class SimulationComplete(RequestInput):
    reflection: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=5000)]
    liked: Text = ""
    disliked: Text = ""
    interest: Interest
    expectedVersion: Version


class RecoveryPosition(Input):
    x: Annotated[float, Field(ge=0, le=300, strict=True, allow_inf_nan=False)]
    y: Annotated[float, Field(ge=0, le=420, strict=True, allow_inf_nan=False)]


class RecoveryButton(RecoveryPosition):
    label: Annotated[str, StringConstraints(max_length=40)]
    target: Literal["login", "support"] | None


class RecoveryStudio(Input):
    kind: Literal["login-recovery"]
    version: Literal[2]
    message: Annotated[str, StringConstraints(max_length=240)]
    messagePosition: RecoveryPosition
    retry: RecoveryButton | None
    support: RecoveryButton | None
    preserveInput: Annotated[bool, Field(strict=True)] | None


class Draft(RequestInput):
    answers: list[DraftText] = Field(min_length=3, max_length=3)
    expectedVersion: Version
    scene: dict | None = None
    interest: Interest | None = None

    @field_validator("scene")
    @classmethod
    def validate_scene(cls, value):
        if value is None:
            return value
        if len(json.dumps(value, allow_nan=False).encode()) > 500_000:
            raise ValueError("배치도가 너무 커요. 요소를 줄여 주세요.")
        elements = value.get("elements")
        if not isinstance(elements, list) or len(elements) > 250:
            raise ValueError("배치도는 250개 이하의 도형으로 구성해 주세요.")
        seen = set()
        for element in elements:
            if not isinstance(element, dict) or element.get("type") not in {"rectangle", "diamond", "ellipse", "line", "arrow", "text", "freedraw", "frame", "embeddable"}:
                raise ValueError("이미지와 외부 삽입 요소는 지원하지 않아요.")
            if element.get("type") == "embeddable" or element.get("link"):
                raise ValueError("외부 링크 없이 도형과 글자로 작성해 주세요.")
            eid = element.get("id")
            if not isinstance(eid, str) or not eid or eid in seen:
                raise ValueError("도형 ID가 유효하지 않아요.")
            seen.add(eid)
            for key in ("x", "y", "width", "height"):
                number = element.get(key)
                if not isinstance(number, (int, float)) or not math.isfinite(number) or abs(number) > 1_000_000:
                    raise ValueError("도형 좌표가 유효하지 않아요.")
        scene = {"elements": elements, "appState": {"viewBackgroundColor": "#ffffff"}}
        if "studio" in value:
            if set(value) - {"elements", "appState", "studio"}:
                raise ValueError("작업 문서에는 도형과 설계 정보만 저장할 수 있어요. 작동 확인 기록은 서버에서 관리해요.")
            scene["studio"] = RecoveryStudio.model_validate(value["studio"]).model_dump()
        return scene


class Submit(RequestInput):
    interest: Interest | None = None
    expectedVersion: Version


class ProjectHelp(RequestInput):
    expectedVersion: Version
    mission: AnswerIndex
    intent: Literal["start", "improve", "check"]


class ProjectCheck(RequestInput):
    expectedVersion: Version
    scenario: Literal["recovered", "offline"]
    actions: list[Literal["retry", "support"]] = Field(max_length=8)
