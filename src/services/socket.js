import { io } from "socket.io-client";

// Same-origin-relative API base minus the /api suffix, since Socket.IO
// connects to the server root, not the REST prefix.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const SOCKET_URL = API_URL.replace(/\/api\/?$/, "");

let socket = null;

// Only ever called with a manager's JWT access token - the backend's
// Socket.IO auth middleware rejects any connection that doesn't present a
// valid token, so customers (who never hold a manager token) can't connect.
export function connectManagerSocket(token) {
  if (socket) return socket;
  socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket", "polling"] });
  return socket;
}

export function disconnectManagerSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getManagerSocket() {
  return socket;
}
