import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "taskflow"

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            mongodb_uri=os.environ.get("MONGODB_URI", cls.mongodb_uri),
            mongodb_db=os.environ.get("MONGODB_DB", cls.mongodb_db),
        )
