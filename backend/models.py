from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

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
    answers: list[AnswerIndex] = Field(min_length=6, max_length=6)


class ExperienceEvent(RequestInput):
    careerId: CareerId
    kind: Literal["explored", "saved", "questioned"]
    text: Text = ""


class SimulationCreate(Input):
    careerId: CareerId


class SimulationTurn(RequestInput):
    kind: Literal["start", "choice", "free", "question", "continue"]
    choiceIndex: AnswerIndex | None = None
    text: Text = ""
    expectedVersion: Version


class SimulationComplete(RequestInput):
    reflection: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=5000)]
    liked: Text = ""
    disliked: Text = ""
    interest: Interest
    expectedVersion: Version


class Draft(RequestInput):
    answers: list[DraftText] = Field(min_length=3, max_length=3)
    expectedVersion: Version


class Submit(RequestInput):
    interest: Interest
    expectedVersion: Version
