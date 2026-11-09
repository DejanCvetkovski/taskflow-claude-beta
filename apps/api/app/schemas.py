from typing import Annotated, Any

from pydantic import BaseModel, Strict, field_validator
from pydantic.json_schema import SkipJsonSchema
from pydantic_core import PydanticCustomError

TITLE_MAX_LENGTH = 120

# Strict so that null, numbers and "true"-style strings are rejected with 422.
StrictTitle = Annotated[str, Strict()]
StrictCompleted = Annotated[bool, Strict()]


def _clean_title(value: str) -> str:
    title = value.strip()
    if not 1 <= len(title) <= TITLE_MAX_LENGTH:
        raise PydanticCustomError(
            "value_error",
            f"Title must be 1-{TITLE_MAX_LENGTH} characters after trimming",
        )
    return title


class TodoCreate(BaseModel):
    title: StrictTitle

    @field_validator("title")
    @classmethod
    def _trim_title(cls, value: str) -> str:
        return _clean_title(value)


class TodoUpdate(BaseModel):
    # Titles cannot be edited after creation. `title` is declared only so that
    # its presence (any value, including null) fails with a field-level 422 at
    # ["body", "title"]. It is declared before `completed` so that its message
    # is the first error when both rules fail. Other unknown fields are ignored.
    title: SkipJsonSchema[Any] = None
    completed: StrictCompleted

    @field_validator("title", mode="before")
    @classmethod
    def _reject_title(cls, value: Any) -> Any:
        raise PydanticCustomError("value_error", "Title cannot be changed")

    def changes(self) -> dict[str, Any]:
        return {"completed": self.completed}


class Todo(BaseModel):
    id: str
    title: str
    completed: bool
    created_at: str
    updated_at: str


class Health(BaseModel):
    status: str
