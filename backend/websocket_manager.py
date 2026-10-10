from typing import List, Dict, Any
from fastapi import WebSocket
import json
import asyncio

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        async with self._lock:
            self.active_connections.append(websocket)

    async def disconnect(self, websocket: WebSocket):
        async with self._lock:
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        message = json.dumps({"type": event_type, "data": data}, default=str)
        async with self._lock:
            disconnected = []
            for connection in self.active_connections:
                try:
                    await connection.send_text(message)
                except Exception:
                    disconnected.append(connection)
            for bad_conn in disconnected:
                if bad_conn in self.active_connections:
                    self.active_connections.remove(bad_conn)

manager = ConnectionManager()
