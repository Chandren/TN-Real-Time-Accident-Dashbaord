"""
TN Accident Intel — SSE (Server-Sent Events) Broadcaster
Manages active SSE connections and broadcasts events to all subscribers
"""
import asyncio
import json
from typing import Set


class SSEBroadcaster:
    def __init__(self):
        self._queues: Set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=50)
        self._queues.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        self._queues.discard(q)

    async def broadcast(self, payload: dict):
        if not self._queues:
            return
        message = f"data: {json.dumps(payload)}\n\n"
        dead = set()
        for q in self._queues:
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                dead.add(q)
        for q in dead:
            self._queues.discard(q)

    @property
    def connection_count(self) -> int:
        return len(self._queues)


# Global singleton
broadcaster = SSEBroadcaster()
