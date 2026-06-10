let clientId = 0;
const clients = new Map();
export function addSSEClient(res) {
    const id = ++clientId;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(':ok\n\n');
    clients.set(id, { id, res });
    return id;
}
export function removeSSEClient(id) {
    clients.delete(id);
}
export function emitSSEEvent(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of clients.values()) {
        try {
            client.res.write(payload);
        }
        catch {
            clients.delete(client.id);
        }
    }
}
export function getSSEClientCount() {
    return clients.size;
}
