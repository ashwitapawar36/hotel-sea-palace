import { io } from "socket.io-client";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const SOCKET_URL = new URL(API_URL, window.location.origin).origin;

let socket = null;

export function connectManagerSocket(token) {
  if (!token) return null;

  if (socket && socket.auth?.token !== token) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: false,
      reconnection: true,
    });

    socket.on("connect", () => {
      console.info("Manager live updates connected");
    });

    socket.on("connect_error", (error) => {
      console.error("Manager live updates failed:", error.message);
    });
  }

  if (!socket.connected) {
    socket.connect();
  }

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