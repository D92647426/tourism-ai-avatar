from __future__ import annotations

import os
import pwd
import shlex
import shutil
import signal
import subprocess
import sys
from pathlib import Path


BACKEND_DIR = Path("/workspace/backend")
POSTGRES_DATA_DIR = Path("/var/lib/postgresql/data")
POSTGRES_SOCKET_DIR = Path("/var/run/postgresql")
ADMIN_KNOWLEDGE_DIR = Path("/workspace/data/admin_knowledge")

POSTGRES_DB = os.getenv("POSTGRES_DB", "lingtour")
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
BACKEND_PORT = int(os.getenv("BACKEND_PORT", "8000"))

POSTGRES_OS_USER = "postgres"
DATABASE_URL = f"postgresql+psycopg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@127.0.0.1:{POSTGRES_PORT}/{POSTGRES_DB}"

uvicorn_process: subprocess.Popen[str] | None = None


def sql_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def resolve_command(command: str) -> str:
    resolved = shutil.which(command)
    if not resolved:
        raise FileNotFoundError(command)
    return resolved


def as_postgres_user(command: list[str]) -> list[str]:
    if gosu := shutil.which("gosu"):
        return [gosu, POSTGRES_OS_USER, *command]
    if runuser := shutil.which("runuser"):
        return [runuser, "-u", POSTGRES_OS_USER, "--", *command]
    quoted = " ".join(shlex.quote(part) for part in command)
    return ["su", "-", POSTGRES_OS_USER, "-s", "/bin/sh", "-c", quoted]


def run(command: list[str], *, check: bool = True, capture_output: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=check,
        text=True,
        capture_output=capture_output,
    )


def run_postgres(command: list[str], *, check: bool = True, capture_output: bool = False) -> subprocess.CompletedProcess[str]:
    return run(as_postgres_user(command), check=check, capture_output=capture_output)


def postgres_uid_gid() -> tuple[int, int]:
    entry = pwd.getpwnam(POSTGRES_OS_USER)
    return entry.pw_uid, entry.pw_gid


def ensure_owned_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    uid, gid = postgres_uid_gid()
    os.chown(path, uid, gid)


def ensure_runtime_directories() -> None:
    ensure_owned_directory(POSTGRES_DATA_DIR)
    ensure_owned_directory(POSTGRES_SOCKET_DIR)
    ensure_owned_directory(ADMIN_KNOWLEDGE_DIR)


def configure_cluster_files() -> None:
    postgresql_conf = POSTGRES_DATA_DIR / "postgresql.conf"
    pg_hba_conf = POSTGRES_DATA_DIR / "pg_hba.conf"

    postgresql_marker = "# lingtour all-in-one settings"
    hba_marker = "# lingtour all-in-one access"

    existing_postgresql_conf = postgresql_conf.read_text(encoding="utf-8")
    if postgresql_marker not in existing_postgresql_conf:
        with postgresql_conf.open("a", encoding="utf-8") as handle:
            handle.write(
                "\n"
                f"{postgresql_marker}\n"
                "listen_addresses = '*'\n"
                f"port = {POSTGRES_PORT}\n"
                f"unix_socket_directories = '{POSTGRES_SOCKET_DIR.as_posix()}'\n"
                "password_encryption = 'scram-sha-256'\n"
            )

    existing_pg_hba = pg_hba_conf.read_text(encoding="utf-8")
    if hba_marker not in existing_pg_hba:
        with pg_hba_conf.open("a", encoding="utf-8") as handle:
            handle.write(
                "\n"
                f"{hba_marker}\n"
                "local   all             all                                     trust\n"
                "host    all             all             127.0.0.1/32            scram-sha-256\n"
                "host    all             all             0.0.0.0/0               scram-sha-256\n"
                "host    all             all             ::1/128                 scram-sha-256\n"
                "host    all             all             ::/0                    scram-sha-256\n"
            )


def initialize_cluster() -> None:
    if (POSTGRES_DATA_DIR / "PG_VERSION").exists():
        configure_cluster_files()
        return
    run_postgres(
        [
            resolve_command("initdb"),
            "-D",
            str(POSTGRES_DATA_DIR),
            "-U",
            POSTGRES_OS_USER,
            "--auth-local=trust",
            "--auth-host=scram-sha-256",
        ]
    )
    configure_cluster_files()


def start_postgres() -> None:
    run_postgres([resolve_command("pg_ctl"), "-D", str(POSTGRES_DATA_DIR), "-w", "start"])


def stop_postgres() -> None:
    if not (POSTGRES_DATA_DIR / "PG_VERSION").exists():
        return
    run_postgres(
        [resolve_command("pg_ctl"), "-D", str(POSTGRES_DATA_DIR), "-m", "fast", "-w", "stop"],
        check=False,
    )


def query_scalar(sql: str, database: str = "postgres") -> str:
    result = run_postgres(
        [
            resolve_command("psql"),
            "-tAc",
            sql,
            "-d",
            database,
        ],
        capture_output=True,
    )
    return result.stdout.strip()


def execute_sql(sql: str, database: str = "postgres") -> None:
    run_postgres(
        [
            resolve_command("psql"),
            "-v",
            "ON_ERROR_STOP=1",
            "-d",
            database,
            "-c",
            sql,
        ]
    )


def ensure_database_objects() -> None:
    quoted_user = sql_identifier(POSTGRES_USER)
    quoted_db = sql_identifier(POSTGRES_DB)
    quoted_password = sql_literal(POSTGRES_PASSWORD)
    quoted_user_name = sql_literal(POSTGRES_USER)
    quoted_db_name = sql_literal(POSTGRES_DB)

    if query_scalar(f"SELECT 1 FROM pg_roles WHERE rolname = {quoted_user_name}") != "1":
        execute_sql(f"CREATE ROLE {quoted_user} WITH LOGIN PASSWORD {quoted_password}")
    else:
        execute_sql(f"ALTER ROLE {quoted_user} WITH LOGIN PASSWORD {quoted_password}")

    if query_scalar(f"SELECT 1 FROM pg_database WHERE datname = {quoted_db_name}") != "1":
        execute_sql(f"CREATE DATABASE {quoted_db} OWNER {quoted_user}")

    execute_sql("CREATE EXTENSION IF NOT EXISTS vector", database=POSTGRES_DB)


def backend_environment() -> dict[str, str]:
    env = os.environ.copy()
    env["DATABASE_URL"] = DATABASE_URL
    env["PYTHONPATH"] = str(BACKEND_DIR)
    return env


def terminate_backend(*_: object) -> None:
    if uvicorn_process and uvicorn_process.poll() is None:
        uvicorn_process.terminate()


def start_backend() -> int:
    global uvicorn_process
    signal.signal(signal.SIGTERM, terminate_backend)
    signal.signal(signal.SIGINT, terminate_backend)
    uvicorn_process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            str(BACKEND_PORT),
        ],
        cwd=BACKEND_DIR,
        env=backend_environment(),
        text=True,
    )
    return uvicorn_process.wait()


def main() -> int:
    ensure_runtime_directories()
    initialize_cluster()
    start_postgres()
    try:
        ensure_database_objects()
        return start_backend()
    finally:
        stop_postgres()


if __name__ == "__main__":
    raise SystemExit(main())
