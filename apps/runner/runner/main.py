import threading
import time
import traceback

import socketio

from .config import Config
from .executor import run_task


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
            print("[runner] conectado ao orquestrador")

        @self.sio.event(namespace="/runner")
        def disconnect():
            print("[runner] desconectado")

        @self.sio.on("task.dispatch", namespace="/runner")
        def on_dispatch(task):
            threading.Thread(
                target=self._handle_task, args=(task,), daemon=True
            ).start()

        @self.sio.on("task.cancel", namespace="/runner")
        def on_cancel(data):
            print(f"[runner] cancelamento solicitado: {data}")

    def _emit_log(self, task_id: str, message: str, level: str = "info"):
        if not message:
            return
        print(f"[task {task_id[:8]}] {message}")
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
        if not self.busy.acquire(blocking=False):
            self._emit_log(task_id, "Runner ocupado; tarefa ignorada", "error")
            return
        try:
            self.sio.emit("task.accepted", {"taskId": task_id}, namespace="/runner")
            self.sio.emit("task.started", {"taskId": task_id}, namespace="/runner")
            exit_code = run_task(
                self.config,
                task,
                lambda msg, level="info": self._emit_log(task_id, msg, level),
            )
        except Exception as e:  # noqa: BLE001
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

    def _heartbeat_loop(self):
        while True:
            time.sleep(self.config.heartbeat_interval)
            if self.sio.connected:
                try:
                    self.sio.emit("heartbeat", {}, namespace="/runner")
                except Exception:
                    pass

    def start(self):
        print(f"[runner] conectando em {self.config.ws_url} ...")
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
    config = Config.from_env()
    agent = RunnerAgent(config)
    try:
        agent.start()
    except KeyboardInterrupt:
        print("\n[runner] encerrando...")


if __name__ == "__main__":
    main()
