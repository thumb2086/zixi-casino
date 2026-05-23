// apps/api/src/utils/sse.ts
// Simple SSE (Server-Sent Events) manager for chat

import { FastifyReply } from "fastify";

interface SSEClient {
  id: string;
  reply: FastifyReply;
}

const clients: SSEClient[] = [];

export function addSSEClient(id: string, reply: FastifyReply) {
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.setHeader("Access-Control-Allow-Origin", "*");
  reply.raw.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  reply.raw.setHeader("Access-Control-Allow-Headers", "Content-Type, x-session-id");
  reply.raw.flushHeaders();

  // Send initial keepalive
  reply.raw.write(":ok\n\n");

  const client: SSEClient = { id, reply };
  clients.push(client);

  // Heartbeat every 10s
  const heartbeat = setInterval(() => {
    try { reply.raw.write(":heartbeat\n\n"); } catch {
      clearInterval(heartbeat);
    }
  }, 10000);

  // Remove on disconnect
  reply.raw.on("close", () => {
    clearInterval(heartbeat);
    const idx = clients.findIndex((c) => c.id === id);
    if (idx >= 0) clients.splice(idx, 1);
  });
}

export function broadcastChatMessage(msg: any) {
  const data = `data: ${JSON.stringify(msg)}\n\n`;
  for (const client of clients) {
    try {
      client.reply.raw.write(data);
    } catch {
      // Client disconnected, will be cleaned up on close
    }
  }
}
