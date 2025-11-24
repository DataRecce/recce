import { axiosClient } from "./axiosClient";

/**
 * Send a keep-alive signal to the server to reset the idle timeout timer.
 * This prevents the server from shutting down due to inactivity.
 */
export async function sendKeepAlive(): Promise<void> {
  try {
    await axiosClient.post("/api/keep-alive");
  } catch (error) {
    // Silent fail - don't disrupt user experience if keep-alive fails
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.debug("[Idle Detection] Failed to send keep-alive", {
      error: errorMessage,
      timestamp: new Date().toISOString(),
      willRetryOnNextActivity: true,
    });
  }
}
