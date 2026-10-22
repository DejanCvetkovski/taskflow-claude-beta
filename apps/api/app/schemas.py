from typing import Annotated, Any

from pydantic import BaseModel, Strict, field_validator, model_validator
from pydantic_core import PydanticCustomError

TITLE_MAX_LENGTH = 120

# Strict so that null, numbers and "true"-style strings are rejected with 422.
# The PATCH fields default to None, but an explicit null is still validated
# (and rejected) because Pydantic only skips validation for omitted fields.
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
    title: StrictTitle = None
    completed: StrictCompleted = None

    @field_validator("title")
    @classmethod
    def _trim_title(cls, value: str) -> str:
        return _clean_title(value)

    @model_validator(mode="after")
    def _require_a_field(self) -> "TodoUpdate":
        if not self.model_fields_set & {"title", "completed"}:
            raise PydanticCustomError(
                "value_error",
                "At least one of title or completed is required",
            )
        return self

    def changes(self) -> dict[str, Any]:
        return self.model_dump(include=self.model_fields_set & {"title", "completed"})


class Todo(BaseModel):
    id: str
    title: str
    completed: bool
    created_at: str
    updated_at: str


class Health(BaseModel):
    status: str
