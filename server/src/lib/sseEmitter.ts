import type { Response } from 'express';

type SSEClient = { id: number; res: Response };

let clientId = 0;
const clients: Map<number, SSEClient> = new Map();

export function addSSEClient(res: Response): number {
  const id = ++clientId;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write(':ok\n\n');
  clients.set(id, { id, res });
  return id;
}

export function removeSSEClient(id: number): void {
  clients.delete(id);
}

export function emitSSEEvent(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients.values()) {
    try {
      client.res.write(payload);
    } catch {
      clients.delete(client.id);
    }
  }
}

export function getSSEClientCount(): number {
  return clients.size;
}
