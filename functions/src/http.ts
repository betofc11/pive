import { onRequest, type Request } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import type { Response } from "express";
import { adminApp } from "./admin";

export type { Request, Response };

// Verifies the Firebase ID token of a POST request (and answers the CORS preflight).
// Returns the uid, or null after sending the error response.
export const verifyAuthToken = async (req: Request, res: Response): Promise<string | null> => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.status(204).send("");
    return null;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed. Use POST." });
    return null;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing authorization header" });
    return null;
  }

  try {
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await getAuth(adminApp).verifyIdToken(token);
    return decodedToken.uid;
  } catch (err) {
    console.error("Token verification failed:", err);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
    return null;
  }
};

export interface EndpointContext {
  req: Request;
  res: Response;
  uid: string;
}

/**
 * An HTTP POST endpoint that requires a Firebase ID token and has access to the Gemini key.
 * Any error the handler throws becomes a 500 with `errorMessage`.
 */
export const aiEndpoint = (name: string, errorMessage: string, handler: (ctx: EndpointContext) => Promise<void>) =>
  onRequest(
    {
      cors: true,
      minInstances: 0,
      secrets: ["GEMINI_API_KEY"],
    },
    async (req, res) => {
      const uid = await verifyAuthToken(req, res);
      if (!uid) return;

      try {
        await handler({ req, res, uid });
      } catch (error) {
        console.error(`Error in ${name}:`, error);
        res.status(500).json({ error: errorMessage, message: error instanceof Error ? error.message : String(error) });
      }
    }
  );
