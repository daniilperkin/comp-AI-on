import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="COMPANION_",
        extra="ignore",
    )

    backend_port: int = 8765
    frontend_port: int = 6769
    db_path: str = ""
    timezone: str = ""
    firebase_credentials: str = ""
    firebase_project_id: str = ""

    @property
    def cors_origin(self) -> str:
        return f"http://localhost:{self.frontend_port}"

    @property
    def resolved_db_path(self) -> str:
        if self.db_path:
            return self.db_path
        return os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "database.db",
        )

    @property
    def sqlite_url(self) -> str:
        return f"sqlite:///{self.resolved_db_path}"


settings = Settings()
