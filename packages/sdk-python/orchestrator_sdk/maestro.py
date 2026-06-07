import json
import os
import traceback
from typing import Any, Dict, Optional

import requests


class Maestro:
    """
    SDK para o bot reportar status ao orquestrador.

    Uso típico (dentro do main.py do bot):

        from orchestrator_sdk import Maestro

        maestro = Maestro.from_env()
        maestro.start_task()
        try:
            ...
            maestro.finish_task(status="SUCCESS", total_items=10, processed=10)
        except Exception as e:
            maestro.error(e)
            maestro.finish_task(status="FAILED")
    """

    def __init__(
        self,
        base_url: Optional[str],
        task_id: Optional[str],
        task_token: Optional[str],
        params: Optional[Dict[str, Any]] = None,
    ):
        self.base_url = (base_url or "").rstrip("/")
        self.task_id = task_id
        self.task_token = task_token
        self.params = params or {}
        # Modo offline: sem token/URL, apenas imprime (útil para rodar local)
        self.offline = not (self.base_url and self.task_token)
        self.session = requests.Session()
        if self.task_token:
            self.session.headers.update(
                {"Authorization": f"Bearer {self.task_token}"}
            )

    @classmethod
    def from_env(cls) -> "Maestro":
        params: Dict[str, Any] = {}
        raw = os.getenv("ORCH_PARAMS")
        if raw:
            try:
                params = json.loads(raw)
            except json.JSONDecodeError:
                params = {}
        return cls(
            base_url=os.getenv("ORCHESTRATOR_URL"),
            task_id=os.getenv("TASK_ID"),
            task_token=os.getenv("TASK_TOKEN"),
            params=params,
        )

    # ---------- Helpers ----------

    def _post(self, path: str, **kwargs) -> Optional[dict]:
        if self.offline:
            print(f"[maestro:offline] POST {path} {kwargs.get('json') or ''}")
            return None
        try:
            resp = self.session.post(
                f"{self.base_url}{path}", timeout=30, **kwargs
            )
            resp.raise_for_status()
            return resp.json() if resp.content else None
        except requests.RequestException as e:
            print(f"[maestro] falha em {path}: {e}")
            return None

    def get_params(self) -> Dict[str, Any]:
        return self.params

    def current_task(self) -> Optional[dict]:
        if self.offline:
            return {"id": self.task_id, "params": self.params}
        try:
            resp = self.session.get(
                f"{self.base_url}/sdk/tasks/current", timeout=30
            )
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException:
            return None

    # ---------- API pública ----------

    def start_task(self) -> None:
        self._post("/sdk/tasks/start")

    def log(self, message: str, level: str = "info") -> None:
        self._post("/sdk/tasks/log", json={"message": message, "level": level})

    def alert(self, message: str, payload: Optional[dict] = None) -> None:
        self._post(
            "/sdk/tasks/alert", json={"message": message, "payload": payload}
        )

    def error(self, error: Any, context: Optional[dict] = None) -> None:
        if isinstance(error, BaseException):
            message = f"{type(error).__name__}: {error}"
            payload = {"traceback": traceback.format_exc(), "context": context}
        else:
            message = str(error)
            payload = {"context": context}
        self._post("/sdk/tasks/error", json={"message": message, "payload": payload})

    def finish_task(
        self,
        status: str = "SUCCESS",
        total_items: Optional[int] = None,
        processed: Optional[int] = None,
        failed: Optional[int] = None,
        message: Optional[str] = None,
    ) -> None:
        self._post(
            "/sdk/tasks/finish",
            json={
                "status": "FAILED" if status.upper() == "FAILED" else "SUCCESS",
                "totalItems": total_items,
                "processed": processed,
                "failed": failed,
                "message": message,
            },
        )

    def post_artifact(self, file_path: str) -> None:
        if self.offline:
            print(f"[maestro:offline] artifact {file_path}")
            return
        try:
            with open(file_path, "rb") as f:
                self.session.post(
                    f"{self.base_url}/sdk/tasks/artifacts",
                    files={"file": (os.path.basename(file_path), f)},
                    timeout=120,
                )
        except (OSError, requests.RequestException) as e:
            print(f"[maestro] falha ao enviar artefato: {e}")
