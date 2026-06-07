import os
import platform
import socket
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass
class Config:
    ws_url: str
    api_url: str
    token: str
    heartbeat_interval: int
    work_dir: str
    python_bin: str
    sdk_path: str
    host: str
    os_name: str

    @classmethod
    def from_env(cls) -> "Config":
        token = os.getenv("RUNNER_TOKEN", "").strip()
        if not token:
            raise SystemExit(
                "RUNNER_TOKEN não configurado. Crie um runner no portal e "
                "copie o token para o arquivo .env"
            )
        return cls(
            ws_url=os.getenv("PERSEUS_WS", "http://localhost:3000"),
            api_url=os.getenv("PERSEUS_API", "http://localhost:3000/api"),
            token=token,
            heartbeat_interval=int(os.getenv("HEARTBEAT_INTERVAL", "10")),
            work_dir=os.getenv("WORK_DIR", "_work"),
            python_bin=os.getenv("PYTHON_BIN", "python"),
            sdk_path=os.getenv("SDK_PATH", "").strip(),
            host=socket.gethostname(),
            os_name=f"{platform.system()} {platform.release()}",
        )
