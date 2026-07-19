import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { requireAuth, signToken } from "../middleware/auth.js";

export const authRouter = Router();

interface GithubUser {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
}

async function upsertGithubUser(profile: GithubUser, accessToken: string) {
  const result = await query<{
    id: string;
    username: string;
    role: string;
  }>(
    `INSERT INTO users (github_id, username, email, avatar_url, access_token)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (github_id) DO UPDATE SET
       username = EXCLUDED.username,
       email = COALESCE(EXCLUDED.email, users.email),
       avatar_url = EXCLUDED.avatar_url,
       access_token = EXCLUDED.access_token,
       updated_at = NOW()
     RETURNING id, username, role`,
    [
      String(profile.id),
      profile.login,
      profile.email,
      profile.avatar_url,
      accessToken,
    ]
  );
  return result.rows[0];
}

authRouter.get("/github", (_req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(400).json({
      success: false,
      error: "GITHUB_CLIENT_ID is not configured. Use demo login instead.",
    });
  }

  const redirectUri =
    process.env.GITHUB_CALLBACK_URL ||
    "http://localhost:4000/api/auth/github/callback";
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user user:email repo");
  res.redirect(url.toString());
});

authRouter.get("/github/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const appUrl = process.env.APP_URL || "http://localhost:5173";

  if (!code) {
    return res.redirect(`${appUrl}/login?error=missing_code`);
  }

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      return res.redirect(`${appUrl}/login?error=token_exchange_failed`);
    }

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
      },
    });
    const profile = (await userRes.json()) as GithubUser;
    const user = await upsertGithubUser(profile, tokenData.access_token);
    const jwt = signToken({
      id: user.id,
      username: user.username,
      role: user.role,
    });

    res.redirect(`${appUrl}/auth/callback?token=${jwt}`);
  } catch (error) {
    console.error(error);
    res.redirect(`${appUrl}/login?error=oauth_failed`);
  }
});

authRouter.post("/demo", async (req, res) => {
  const schema = z.object({
    username: z.string().min(2).max(39).optional(),
  });
  const { username } = schema.parse(req.body ?? {});
  const demoName = username || "demo-dev";

  const user = await upsertGithubUser(
    {
      id: 999001,
      login: demoName,
      email: `${demoName}@codeatlas.local`,
      avatar_url: `https://api.dicebear.com/9.x/shapes/svg?seed=${demoName}`,
    },
    "demo-token"
  );

  const token = signToken({
    id: user.id,
    username: user.username,
    role: user.role,
  });

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    },
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT id, github_id, username, email, avatar_url, role, created_at
     FROM users WHERE id = $1`,
    [req.user!.id]
  );
  if (!result.rows[0]) {
    return res.status(404).json({ success: false, error: "User not found" });
  }
  res.json({ success: true, data: result.rows[0] });
});
