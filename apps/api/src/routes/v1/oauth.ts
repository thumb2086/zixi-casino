import { FastifyInstance } from "fastify";
import { randomBytes, createHash } from "crypto";
import { OAuthRepository, SessionRepository, UserRepository } from "@repo/infrastructure";

const OAUTH_CODE_TTL = 10 * 60 * 1000;
const OAUTH_TOKEN_TTL = 30 * 24 * 60 * 60 * 1000;

function generateToken(): string {
  return "zixi_oat_" + randomBytes(24).toString("hex");
}

function generateAuthCode(): string {
  return "zixi_oac_" + randomBytes(16).toString("hex");
}

function hashClientSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

const oauthRepo = new OAuthRepository();
const sessionRepo = new SessionRepository();
const userRepo = new UserRepository();

export async function oauthRoutes(fastify: FastifyInstance) {

  // GET /authorize - initiate OAuth flow, returns consent info or redirects to login
  fastify.get("/authorize", async (request: any, reply: any) => {
    const { client_id, redirect_uri, response_type, state } = request.query;
    if (!client_id || !redirect_uri || response_type !== "code") {
      return reply.status(400).send({ success: false, error: "INVALID_REQUEST", message: "Missing or invalid OAuth parameters" });
    }

    const client = await oauthRepo.getClientByClientId(client_id);
    if (!client || !client.isActive) {
      return reply.status(400).send({ success: false, error: "INVALID_CLIENT", message: "Unknown or disabled client" });
    }

    const allowedUris: string[] = client.redirectUris || [];
    if (!allowedUris.some((uri: string) => redirect_uri.startsWith(uri))) {
      return reply.status(400).send({ success: false, error: "INVALID_REDIRECT_URI", message: "Redirect URI not allowed" });
    }

    const sessionId = request.headers?.["x-session-id"] || request.query?.sessionId;
    if (!sessionId) {
      return reply.send({ success: true, data: { needsLogin: true, clientName: client.name, scopes: client.scopes } });
    }

    const session = await sessionRepo.getSessionById(String(sessionId));
    if (!session || session.status !== "authorized") {
      return reply.send({ success: true, data: { needsLogin: true, clientName: client.name, scopes: client.scopes } });
    }

    const user = await userRepo.getUserById(session.userId);
    if (!user) {
      return reply.send({ success: true, data: { needsLogin: true, clientName: client.name, scopes: client.scopes } });
    }

    reply.send({
      success: true,
      data: {
        needsLogin: false,
        clientName: client.name,
        clientId: client_id,
        redirectUri: redirect_uri,
        scopes: client.scopes,
        state,
        user: { address: user.address, displayName: user.displayName },
      },
    });
  });

  // POST /approve - user approves consent, creates authorization code
  fastify.post("/approve", async (request: any, reply: any) => {
    const { client_id, redirect_uri, state } = request.body || {};
    if (!client_id || !redirect_uri) {
      return reply.status(400).send({ success: false, error: "INVALID_REQUEST", message: "Missing parameters" });
    }

    const sessionId = request.headers?.["x-session-id"] || request.body?.sessionId;
    if (!sessionId) {
      return reply.status(401).send({ success: false, error: "UNAUTHORIZED", message: "Not authenticated" });
    }

    const session = await sessionRepo.getSessionById(String(sessionId));
    if (!session || session.status !== "authorized") {
      return reply.status(401).send({ success: false, error: "UNAUTHORIZED", message: "Invalid session" });
    }

    const client = await oauthRepo.getClientByClientId(client_id);
    if (!client || !client.isActive) {
      return reply.status(400).send({ success: false, error: "INVALID_CLIENT" });
    }

    const code = generateAuthCode();
    await oauthRepo.saveAuthorizationCode({
      code,
      clientId: client_id,
      userId: session.userId,
      redirectUri: redirect_uri,
      scopes: client.scopes,
      state,
      expiresAt: new Date(Date.now() + OAUTH_CODE_TTL),
    });

    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set("code", code);
    if (state) redirectUrl.searchParams.set("state", state);

    reply.send({ success: true, data: { redirectUrl: redirectUrl.toString() } });
  });

  // POST /token - exchange authorization code for access token
  fastify.post("/token", async (request: any, reply: any) => {
    const { code, redirect_uri, client_id, client_secret } = request.body || {};

    if (!code || !client_id || !client_secret) {
      return reply.status(400).send({ error: "invalid_request", error_description: "Missing required parameters" });
    }

    const authCode = await oauthRepo.getAuthorizationCode(code);
    if (!authCode || authCode.used) {
      return reply.status(400).send({ error: "invalid_grant", error_description: "Authorization code invalid or already used" });
    }

    if (authCode.clientId !== client_id) {
      return reply.status(400).send({ error: "invalid_grant", error_description: "Client ID mismatch" });
    }

    if (new Date() > authCode.expiresAt) {
      return reply.status(400).send({ error: "invalid_grant", error_description: "Authorization code expired" });
    }

    const client = await oauthRepo.getClientByClientId(client_id);
    if (!client || client.clientSecret !== hashClientSecret(client_secret)) {
      return reply.status(400).send({ error: "invalid_client", error_description: "Invalid client credentials" });
    }

    if (redirect_uri && authCode.redirectUri !== redirect_uri) {
      return reply.status(400).send({ error: "invalid_grant", error_description: "Redirect URI mismatch" });
    }

    await oauthRepo.markAuthorizationCodeUsed(code);

    const accessToken = generateToken();
    await oauthRepo.saveAccessToken({
      token: accessToken,
      clientId: client_id,
      userId: authCode.userId,
      scopes: authCode.scopes,
      expiresAt: new Date(Date.now() + OAUTH_TOKEN_TTL),
    });

    reply.send({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: Math.floor(OAUTH_TOKEN_TTL / 1000),
      scope: authCode.scopes,
    });
  });

  // GET /userinfo - get user info with Bearer token
  fastify.get("/userinfo", async (request: any, reply: any) => {
    const authHeader = request.headers?.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "invalid_token", error_description: "Missing or invalid Authorization header" });
    }

    const token = authHeader.slice(7);
    const accessToken = await oauthRepo.getAccessToken(token);
    if (!accessToken) {
      return reply.status(401).send({ error: "invalid_token", error_description: "Token not found" });
    }

    if (new Date() > accessToken.expiresAt) {
      return reply.status(401).send({ error: "invalid_token", error_description: "Token expired" });
    }

    const user = await userRepo.getUserById(accessToken.userId);
    if (!user) {
      return reply.status(401).send({ error: "invalid_token", error_description: "User not found" });
    }

    reply.send({
      sub: user.id,
      address: user.address,
      displayName: user.displayName,
      isAdmin: user.isAdmin,
    });
  });

  // Admin: create OAuth client
  fastify.post("/clients", async (request: any, reply: any) => {
    const sessionId = request.headers?.["x-session-id"] || request.body?.sessionId;
    if (!sessionId) {
      return reply.status(401).send({ success: false, error: "UNAUTHORIZED" });
    }

    const session = await sessionRepo.getSessionById(String(sessionId));
    if (!session || session.status !== "authorized") {
      return reply.status(401).send({ success: false, error: "UNAUTHORIZED" });
    }

    const user = await userRepo.getUserById(session.userId);
    if (!user || !user.isAdmin) {
      return reply.status(403).send({ success: false, error: "FORBIDDEN" });
    }

    const { clientId, name, redirectUris, scopes } = request.body || {};
    if (!clientId || !name || !redirectUris?.length) {
      return reply.status(400).send({ success: false, error: "INVALID_REQUEST", message: "clientId, name, redirectUris required" });
    }

    const clientSecret = randomBytes(24).toString("hex");
    await oauthRepo.createClient({
      clientId,
      clientSecret: hashClientSecret(clientSecret),
      name,
      redirectUris,
      scopes: scopes || "profile",
    });

    reply.send({ success: true, data: { clientId, clientSecret } });
  });

  // Admin: list OAuth clients
  fastify.get("/clients", async (request: any, reply: any) => {
    const sessionId = request.headers?.["x-session-id"] || request.query?.sessionId;
    if (!sessionId) {
      return reply.status(401).send({ success: false, error: "UNAUTHORIZED" });
    }

    const session = await sessionRepo.getSessionById(String(sessionId));
    if (!session || session.status !== "authorized") {
      return reply.status(401).send({ success: false, error: "UNAUTHORIZED" });
    }

    const user = await userRepo.getUserById(session.userId);
    if (!user || !user.isAdmin) {
      return reply.status(403).send({ success: false, error: "FORBIDDEN" });
    }

    const clients = await oauthRepo.listClients();
    reply.send({ success: true, data: clients.map((c: any) => ({ clientId: c.clientId, name: c.name, redirectUris: c.redirectUris, scopes: c.scopes, isActive: c.isActive, createdAt: c.createdAt })) });
  });

  // Admin: delete OAuth client
  fastify.delete("/clients/:clientId", async (request: any, reply: any) => {
    const sessionId = request.headers?.["x-session-id"] || request.query?.sessionId;
    if (!sessionId) {
      return reply.status(401).send({ success: false, error: "UNAUTHORIZED" });
    }

    const session = await sessionRepo.getSessionById(String(sessionId));
    if (!session || session.status !== "authorized") {
      return reply.status(401).send({ success: false, error: "UNAUTHORIZED" });
    }

    const user = await userRepo.getUserById(session.userId);
    if (!user || !user.isAdmin) {
      return reply.status(403).send({ success: false, error: "FORBIDDEN" });
    }

    const { clientId } = (request as any).params;
    await oauthRepo.deleteClient(clientId);
    reply.send({ success: true });
  });
}
