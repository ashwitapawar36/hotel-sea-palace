import { api } from "./api";

function storageKey(tableNumber) {
  return `sea-palace-visit-${tableNumber}`;
}

function readSession(tableNumber) {
  const stored = localStorage.getItem(storageKey(tableNumber));

  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    throw new Error(
      "Your saved visit could not be read. Please contact the manager."
    );
  }
}

function saveSession(tableNumber, session) {
  localStorage.setItem(
    storageKey(tableNumber),
    JSON.stringify(session)
  );
}

function randomHex(byteCount) {
  const bytes = new Uint8Array(byteCount);
  window.crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function createSubmissionKey() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function requireSession(tableNumber) {
  const session = readSession(tableNumber);

  if (!session?.visitId || !session?.token) {
    throw new Error("Please start your table visit first.");
  }

  return session;
}

export async function startOrResumeVisit(tableNumber) {
  const number = Number(tableNumber);

  if (!Number.isInteger(number) || number < 1) {
    throw new Error("Please open your table's QR link.");
  }

  let session = readSession(number);

  if (!session) {
    session = {
      token: randomHex(32),
      visitId: null,
      pendingSubmission: null,
    };

    // Save before contacting the server. A lost response can then
    // be retried using the same token.
    saveSession(number, session);
  }

  const response = await api.post("/visits/start", {
    tableNumber: number,
    visitToken: session.token,
  });

  const visit = response?.data?.visit;

  if (!visit?.id) {
    throw new Error("Could not confirm your table visit.");
  }

  saveSession(number, {
    ...session,
    visitId: visit.id,
  });

  return visit;
}

export async function getVisitOrders(tableNumber) {
  const session = requireSession(tableNumber);

  const response = await api.get(`/visits/${session.visitId}`, {
    headers: {
      "X-Visit-Token": session.token,
    },
  });

  return response.data;
}

export function getPendingSubmission(tableNumber) {
  return readSession(tableNumber)?.pendingSubmission || null;
}

export async function submitOrderRound(tableNumber, payload) {
  const number = Number(tableNumber);

  // This also verifies that the saved token still owns the visit.
  await startOrResumeVisit(number);

  let session = requireSession(number);

  if (!session.pendingSubmission) {
    if (!payload?.items?.length) {
      throw new Error("Add at least one item before placing an order.");
    }

    const submissionKey = createSubmissionKey();

    session = {
      ...session,
      pendingSubmission: {
        submissionKey,
        payload: {
          ...payload,
          tableNumber: number,
          visitId: session.visitId,
          submissionKey,
        },
      },
    };

    // Keep the exact submitted items, not just the submission key.
    saveSession(number, session);
  }

  const pending = session.pendingSubmission;

  // If an earlier request is unresolved, this deliberately retries
  // that saved request instead of submitting changed cart contents.
  const response = await api.post(
    "/orders",
    pending.payload,
    {
      headers: {
        "X-Visit-Token": session.token,
      },
    }
  );

  const order = response?.data?.order;

  if (!order?.id) {
    throw new Error(
      "Order confirmation was not received. Retry to check the same submission."
    );
  }

  return {
    order,
    replayed: Boolean(response.data.replayed),
    submissionKey: pending.submissionKey,
  };
}

// Call only after the UI has accepted the successful order response.
// Network errors must never clear the saved submission.
export function acknowledgeOrderRound(tableNumber, submissionKey) {
  const session = requireSession(tableNumber);

  if (
    session.pendingSubmission?.submissionKey !== submissionKey
  ) {
    return;
  }

  saveSession(tableNumber, {
    ...session,
    pendingSubmission: null,
  });
}