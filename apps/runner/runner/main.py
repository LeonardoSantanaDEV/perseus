import os
import shutil
import threading
import time
import traceback

import socketio

from .config import Config
from .executor import run_task
from .logger import log


class RunnerAgent:
    def __init__(self, config: Config):
        self.config = config
        self.sio = socketio.Client(
            reconnection=True,
            reconnection_delay=2,
            logger=False,
            engineio_logger=False,
        )
        self.busy = threading.Lock()
        self._register_handlers()

    def _register_handlers(self):
        @self.sio.event(namespace="/runner")
        def connect():
            log.info("Conectado ao Perseus em %s", self.config.ws_url)

        @self.sio.event(namespace="/runner")
        def connect_error(data):
            log.error("Falha na conexão com Perseus: %s", data)

        @self.sio.event(namespace="/runner")
        def disconnect():
            log.warning("Desconectado do Perseus. Reconectando...")

        @self.sio.on("task.dispatch", namespace="/runner")
        def on_dispatch(task):
            log.info(
                "task.dispatch recebido: taskId=%s automationId=%s version=%s",
                task.get("taskId", "?"),
                task.get("automationId", "?"),
                task.get("version", "?"),
            )
            threading.Thread(
                target=self._handle_task, args=(task,), daemon=True
            ).start()

        @self.sio.on("task.cancel", namespace="/runner")
        def on_cancel(data):
            log.warning("Cancelamento solicitado: %s", data)

    def _emit_log(self, task_id: str, message: str, level: str = "info"):
        if not message:
            return
        log_fn = getattr(log, level if level in ("info", "warning", "error", "debug") else "info")
        log_fn("[task %s] %s", task_id[:8], message)
        try:
            self.sio.emit(
                "task.log",
                {"taskId": task_id, "message": message, "level": level},
                namespace="/runner",
            )
        except Exception:
            pass

    def _handle_task(self, task: dict):
        task_id = task["taskId"]
        log.info("Iniciando execução da tarefa %s", task_id)
        if not self.busy.acquire(blocking=False):
            msg = "Runner ocupado; tarefa ignorada"
            log.warning(msg)
            self._emit_log(task_id, msg, "error")
            return
        try:
            self.sio.emit("task.accepted", {"taskId": task_id}, namespace="/runner")
            self.sio.emit("task.started", {"taskId": task_id}, namespace="/runner")
            exit_code = run_task(
                self.config,
                task,
                lambda msg, level="info": self._emit_log(task_id, msg, level),
            )
            log.info("Tarefa %s concluída com exit_code=%s", task_id, exit_code)
        except Exception as e:  # noqa: BLE001
            log.exception("Erro inesperado na tarefa %s: %s", task_id, e)
            self._emit_log(task_id, f"Erro no runner: {e}", "error")
            self._emit_log(task_id, traceback.format_exc(), "error")
            exit_code = 1
        finally:
            self.busy.release()
            self.sio.emit(
                "task.finished",
                {"taskId": task_id, "exitCode": exit_code},
                namespace="/runner",
            )
            self._cleanup_work_dir(task_id)

    def _cleanup_work_dir(self, task_id: str):
        """Remove apenas o diretório efêmero da execução.

        O cache de ambientes (``_work/envs``) é preservado de propósito para
        reaproveitar o venv entre execuções da mesma automação.
        """
        if self.config.keep_work_dir:
            return
        work = os.path.abspath(os.path.join(self.config.work_dir, "runs", task_id))
        try:
            if os.path.isdir(work):
                shutil.rmtree(work, ignore_errors=True)
                log.info("Diretório de trabalho limpo: %s", work)
        except Exception as e:  # noqa: BLE001
            log.warning("Falha ao limpar work_dir %s: %s", work, e)

    def _heartbeat_loop(self):
        while True:
            time.sleep(self.config.heartbeat_interval)
            if self.sio.connected:
                try:
                    self.sio.emit("heartbeat", {}, namespace="/runner")
                except Exception:
                    pass

    def start(self):
        log.info("Perseus Runner iniciando. Host=%s OS=%s", self.config.host, self.config.os_name)
        log.info("Conectando em %s ...", self.config.ws_url)
        threading.Thread(target=self._heartbeat_loop, daemon=True).start()
        self.sio.connect(
            self.config.ws_url,
            namespaces=["/runner"],
            auth={
                "token": self.config.token,
                "host": self.config.host,
                "os": self.config.os_name,
            },
            transports=["websocket"],
        )
        self.sio.wait()


def main():
    log.info("=== Perseus Runner =========================")
    config = Config.from_env()
    log.info("Configuração carregada. PERSEUS_WS=%s", config.ws_url)
    agent = RunnerAgent(config)
    try:
        agent.start()
    except KeyboardInterrupt:
        log.info("Runner encerrado pelo usuário.")


if __name__ == "__main__":
    main()
