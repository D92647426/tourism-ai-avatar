from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    database_url: str = "postgresql+psycopg://postgres:postgres@127.0.0.1:5433/lingtour"
    vector_db_path: str = "data/vector_db/scenic_vector_store.json"
    pgvector_dimension: int = 256
    default_knowledge_base_id: str = "default"
    text_model_provider: str = "mock"
    text_model_name: str = "mock-guide"
    multimodal_model_provider: str = "mock"
    multimodal_model_name: str = "mock-vision"
    admin_username: str = "admin"
    admin_password: str = "123456"
    admin_token_secret: str = "lingtour-dev-admin-token-secret"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
