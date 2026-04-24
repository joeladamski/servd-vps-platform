const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const multer = require("multer");
const { Pool } = require("pg");
const sharp = require("sharp");

const app = express();
const port = Number(process.env.PORT || 3000);
const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://servd:servdpassword@postgres:5432/servd";
const sessionSecret = process.env.SESSION_SECRET || "change-me-in-production";
const maxProfileImageBytes = Number(
  process.env.MAX_PROFILE_IMAGE_BYTES || 5 * 1024 * 1024
);
const profileImageSize = 512;

const pool = new Pool({
  connectionString: databaseUrl,
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxProfileImageBytes,
  },
});

app.set("trust proxy", 1);
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    store: new pgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 14,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  })
);

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function validateUsername(username) {
  return /^[a-z0-9_]{3,24}$/.test(username);
}

function renderLayout({ title, content, user, notice, bodyClass = "" }) {
  const nav = user
    ? `
      <nav>
        <a href="/dashboard">Dashboard</a>
        <a href="/u/${escapeHtml(user.username)}" target="_blank" rel="noreferrer">Public page</a>
        <form method="post" action="/logout">
          <button type="submit" class="secondary">Log out</button>
        </form>
      </nav>
    `
    : `
      <nav>
        <a href="/login">Log in</a>
        <a href="/signup">Sign up</a>
      </nav>
    `;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#171717">
    <meta name="theme-color" content="#171717" media="(prefers-color-scheme: dark)">
    <meta name="theme-color" content="#171717" media="(prefers-color-scheme: light)">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        color: #f7f2e8;
        color-scheme: dark;
        background:
          radial-gradient(circle at top, rgba(255, 210, 118, 0.15), transparent 35%),
          linear-gradient(160deg, #111111 0%, #171717 60%, #232323 100%);
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100dvh;
        color: #f7f2e8;
        background:
          radial-gradient(circle at top, rgba(255, 210, 118, 0.15), transparent 35%),
          linear-gradient(160deg, #111111 0%, #171717 60%, #232323 100%);
      }

      html {
        overscroll-behavior-y: none;
      }

      body {
        overscroll-behavior-y: none;
      }

      body.public-profile-page {
        color: #f7f2e8;
        background:
          radial-gradient(circle at top, rgba(255, 210, 118, 0.15), transparent 35%),
          linear-gradient(160deg, #111111 0%, #171717 60%, #232323 100%);
      }

      a {
        color: inherit;
      }

      .shell {
        width: min(1100px, calc(100% - 32px));
        margin: 0 auto;
        min-height: 100dvh;
        padding:
          calc(24px + env(safe-area-inset-top))
          0
          calc(48px + env(safe-area-inset-bottom));
        background:
          radial-gradient(circle at top, rgba(255, 210, 118, 0.15), transparent 35%),
          linear-gradient(160deg, #111111 0%, #171717 60%, #232323 100%);
      }

      nav {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: flex-end;
        margin-bottom: 24px;
        flex-wrap: wrap;
      }

      nav a,
      .button-link,
      nav button {
        border: 1px solid rgba(247, 242, 232, 0.2);
        background: rgba(255, 255, 255, 0.05);
        padding: 10px 14px;
        border-radius: 999px;
        text-decoration: none;
        color: inherit;
        cursor: pointer;
      }

      .button-link.primary {
        background: #ffd276;
        color: #111111;
        border-color: transparent;
        font-weight: 600;
      }

      .hero {
        display: grid;
        gap: 24px;
        grid-template-columns: 1.1fr 0.9fr;
      }

      .card {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(247, 242, 232, 0.14);
        border-radius: 24px;
        padding: 24px;
        backdrop-filter: blur(8px);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
      }

      .notice {
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255, 210, 118, 0.16);
        border: 1px solid rgba(255, 210, 118, 0.24);
        margin-bottom: 18px;
      }

      h1, h2, h3, p {
        margin-top: 0;
      }

      .eyebrow {
        color: #ffd276;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.78rem;
      }

      .headline {
        font-size: clamp(2.4rem, 5vw, 4.6rem);
        line-height: 0.95;
        margin-bottom: 16px;
      }

      .muted {
        color: rgba(247, 242, 232, 0.7);
        line-height: 1.6;
      }

      form {
        display: grid;
        gap: 14px;
      }

      label {
        display: grid;
        gap: 8px;
        font-size: 0.95rem;
      }

      input, textarea {
        width: 100%;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid rgba(247, 242, 232, 0.16);
        background: rgba(17, 17, 17, 0.45);
        color: inherit;
      }

      textarea {
        min-height: 96px;
        resize: vertical;
      }

      button {
        border: 0;
        border-radius: 14px;
        padding: 12px 16px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        background: #ffd276;
        color: #111111;
      }

      button.secondary {
        background: transparent;
        border: 1px solid rgba(247, 242, 232, 0.18);
        color: inherit;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 24px;
      }

      .link-list {
        display: grid;
        gap: 14px;
      }

      .link-item {
        display: grid;
        gap: 10px;
        padding: 16px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(247, 242, 232, 0.12);
      }

      .link-item header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .public-links a {
        display: block;
        text-decoration: none;
        padding: 16px 18px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(247, 242, 232, 0.16);
        margin-bottom: 12px;
      }

      .split {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .split > * {
        flex: 1 1 180px;
      }

      .inline-form {
        display: inline;
      }

      .profile-header {
        display: flex;
        gap: 16px;
        align-items: center;
        margin-bottom: 18px;
      }

      .profile-image {
        border-radius: 22px;
        object-fit: cover;
        flex: 0 0 auto;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(247, 242, 232, 0.12);
      }

      .profile-image-fallback {
        display: grid;
        place-items: center;
        font-size: 1.8rem;
        font-weight: 700;
        background:
          linear-gradient(135deg, rgba(255, 210, 118, 0.35), rgba(255, 255, 255, 0.08)),
          rgba(255, 255, 255, 0.06);
      }

      .profile-image-preview {
        display: flex;
        gap: 14px;
        align-items: center;
      }

      .form-hint {
        color: rgba(247, 242, 232, 0.64);
        font-size: 0.88rem;
        line-height: 1.5;
      }

      .public-profile-card {
        max-width: 860px;
        margin: 0 auto;
        padding: 48px 40px 40px;
      }

      .public-profile-header {
        display: grid;
        justify-items: center;
        text-align: center;
        gap: 18px;
        margin-bottom: 34px;
      }

      .public-profile-avatar {
        width: 500px;
        height: 500px;
        border-radius: 44px;
        box-shadow:
          0 42px 90px rgba(0, 0, 0, 0.45),
          0 20px 44px rgba(0, 0, 0, 0.22),
          0 0 0 1px rgba(255, 210, 118, 0.2);
      }

      .public-profile-name {
        font-size: clamp(2rem, 4vw, 3rem);
        line-height: 0.98;
        margin: 0;
      }

      .public-profile-username {
        margin: 0;
        color: #ffd276;
        font-size: 1rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .public-profile-bio {
        max-width: 640px;
        margin: 0 auto;
        font-size: 1.03rem;
        line-height: 1.8;
        color: rgba(247, 242, 232, 0.82);
      }

      .public-profile-links {
        margin-top: 40px;
      }

      .public-links {
        display: grid;
        gap: 16px;
      }

      .public-links a {
        display: block;
        text-decoration: none;
        padding: 22px 24px;
        border-radius: 22px;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.04));
        border: 1px solid rgba(247, 242, 232, 0.14);
        margin-bottom: 0;
        transition:
          transform 160ms ease,
          border-color 160ms ease,
          background 160ms ease,
          box-shadow 160ms ease;
      }

      .public-links a:hover {
        transform: translateY(-1px);
        border-color: rgba(255, 210, 118, 0.36);
        background:
          linear-gradient(180deg, rgba(255, 210, 118, 0.12), rgba(255, 255, 255, 0.05));
        box-shadow: 0 14px 32px rgba(0, 0, 0, 0.2);
      }

      .public-link-title {
        display: block;
        font-size: 1.08rem;
        font-weight: 700;
        margin-bottom: 8px;
      }

      .public-link-url {
        color: rgba(247, 242, 232, 0.62);
        font-size: 0.92rem;
        word-break: break-word;
      }

      @media (max-width: 860px) {
        .hero,
        .grid {
          grid-template-columns: 1fr;
        }

        nav {
          justify-content: flex-start;
        }

        .public-profile-card {
          padding: 34px 22px 24px;
          background: rgba(15, 15, 15, 0.78);
          border-color: rgba(247, 242, 232, 0.16);
        }

        .public-profile-avatar {
          width: 260px;
          height: 260px;
          border-radius: 40px;
          box-shadow:
            0 18px 42px rgba(0, 0, 0, 0.2),
            0 8px 18px rgba(0, 0, 0, 0.09),
            0 0 0 1px rgba(0, 0, 0, 0.06);
        }
      }

      @media (prefers-color-scheme: light) {
        html,
        body,
        .shell,
        body.public-profile-page {
          background:
            radial-gradient(circle at top, rgba(255, 210, 118, 0.15), transparent 35%),
            linear-gradient(160deg, #111111 0%, #171717 60%, #232323 100%);
          color: #f7f2e8;
        }
      }
    </style>
  </head>
  <body class="${escapeHtml(bodyClass)}">
    <div class="shell">
      ${nav}
      ${notice ? `<div class="notice">${escapeHtml(notice)}</div>` : ""}
      ${content}
    </div>
  </body>
</html>`;
}

function redirectWithMessage(res, path, message) {
  const target = new URLSearchParams({ notice: message }).toString();
  res.redirect(`${path}?${target}`);
}

async function fetchUserById(id) {
  const result = await pool.query(
    `select
       id,
       email,
       username,
       display_name,
       bio,
       avatar_content_type,
       avatar_updated_at
     from users
     where id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

function getProfileImagePath(user) {
  if (!user || !user.avatar_content_type) return "";

  const stamp = user.avatar_updated_at
    ? new Date(user.avatar_updated_at).getTime()
    : "1";

  return `/u/${encodeURIComponent(user.username)}/avatar?v=${stamp}`;
}

function renderProfileImage(user, { size = 96, className = "" } = {}) {
  const src = getProfileImagePath(user);
  const label = escapeHtml(user.display_name || user.username || "Profile");
  const classes = ["profile-image", className].filter(Boolean).join(" ");

  if (src) {
    return `<img src="${escapeHtml(src)}" alt="${label}" class="${classes}" width="${size}" height="${size}">`;
  }

  const initial = escapeHtml((user.username || "?").slice(0, 1).toUpperCase());
  return `<div class="${classes} profile-image-fallback" aria-label="${label}" style="width:${size}px; height:${size}px;">${initial}</div>`;
}

async function processProfileImageUpload(file) {
  if (!file) return null;

  if (!file.mimetype || !file.mimetype.startsWith("image/")) {
    const error = new Error("Only image uploads are allowed.");
    error.statusCode = 400;
    throw error;
  }

  let buffer;

  try {
    buffer = await sharp(file.buffer)
      .rotate()
      .resize(profileImageSize, profileImageSize, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (_error) {
    const error = new Error("Upload a valid image file.");
    error.statusCode = 400;
    throw error;
  }

  return {
    data: buffer,
    contentType: "image/webp",
  };
}

async function fetchLinksForUser(userId) {
  const result = await pool.query(
    "select id, title, url, position from links where user_id = $1 order by position asc, id asc",
    [userId]
  );
  return result.rows;
}

async function attachUser(req, _res, next) {
  if (!req.session.userId) {
    req.currentUser = null;
    return next();
  }

  try {
    req.currentUser = await fetchUserById(req.session.userId);
    if (!req.currentUser) {
      req.session.destroy(() => {});
    }
  } catch (error) {
    return next(error);
  }

  return next();
}

function requireAuth(req, res, next) {
  if (!req.currentUser) {
    return redirectWithMessage(res, "/login", "Log in to continue.");
  }
  return next();
}

app.use(attachUser);

app.get("/", async (req, res) => {
  if (req.currentUser) {
    return res.redirect("/dashboard");
  }

  const content = `
    <section class="hero">
      <div class="card">
        <p class="eyebrow">get.servd.pro</p>
        <h1 class="headline">A minimal profile page for all your links.</h1>
        <p class="muted">Create one account, set a short bio, and publish the links you want people to click. Nothing more.</p>
        <div class="split">
          <a href="/signup" class="button-link primary">Create account</a>
          <a href="/login" class="button-link">Log in</a>
        </div>
      </div>
      <div class="card">
        <h2>What’s included</h2>
        <p class="muted">Email/password auth, an editable profile, ordered links, and a public page at <code>/u/username</code>.</p>
        <p class="muted">The app is server-rendered, Postgres-backed, and small enough to run comfortably in Docker Compose.</p>
      </div>
    </section>
  `;

  return res.send(
    renderLayout({
      title: "get.servd.pro",
      content,
      user: null,
      notice: req.query.notice,
    })
  );
});

app.get("/signup", (req, res) => {
  if (req.currentUser) return res.redirect("/dashboard");

  const content = `
    <div class="card" style="max-width: 560px; margin: 0 auto;">
      <p class="eyebrow">Create account</p>
      <h1>Sign up</h1>
      <form method="post" action="/signup">
        <label>Username
          <input name="username" minlength="3" maxlength="24" required pattern="[a-z0-9_]{3,24}">
        </label>
        <label>Email
          <input type="email" name="email" required>
        </label>
        <label>Password
          <input type="password" name="password" minlength="8" required>
        </label>
        <button type="submit">Create account</button>
      </form>
    </div>
  `;

  res.send(
    renderLayout({
      title: "Sign up",
      content,
      user: null,
      notice: req.query.notice,
    })
  );
});

app.post("/signup", async (req, res, next) => {
  const username = normalizeUsername(req.body.username);
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!validateUsername(username)) {
    return redirectWithMessage(
      res,
      "/signup",
      "Username must be 3-24 characters using lowercase letters, numbers, or underscores."
    );
  }

  if (!email || password.length < 8) {
    return redirectWithMessage(
      res,
      "/signup",
      "Use a valid email and a password with at least 8 characters."
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `insert into users (username, email, password_hash)
       values ($1, $2, $3)
       returning id`,
      [username, email, passwordHash]
    );
    req.session.userId = result.rows[0].id;
    return redirectWithMessage(res, "/dashboard", "Account created.");
  } catch (error) {
    if (error.code === "23505") {
      return redirectWithMessage(
        res,
        "/signup",
        "That username or email is already in use."
      );
    }
    return next(error);
  }
});

app.get("/login", (req, res) => {
  if (req.currentUser) return res.redirect("/dashboard");

  const content = `
    <div class="card" style="max-width: 560px; margin: 0 auto;">
      <p class="eyebrow">Welcome back</p>
      <h1>Log in</h1>
      <form method="post" action="/login">
        <label>Email
          <input type="email" name="email" required>
        </label>
        <label>Password
          <input type="password" name="password" required>
        </label>
        <button type="submit">Log in</button>
      </form>
    </div>
  `;

  res.send(
    renderLayout({
      title: "Log in",
      content,
      user: null,
      notice: req.query.notice,
    })
  );
});

app.post("/login", async (req, res, next) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  try {
    const result = await pool.query(
      "select id, password_hash from users where email = $1",
      [email]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return redirectWithMessage(res, "/login", "Invalid email or password.");
    }

    req.session.userId = user.id;
    return redirectWithMessage(res, "/dashboard", "Logged in.");
  } catch (error) {
    return next(error);
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});

app.get("/dashboard", requireAuth, async (req, res, next) => {
  try {
    const links = await fetchLinksForUser(req.currentUser.id);
    const content = `
      <section class="grid">
        <div class="card">
          <p class="eyebrow">Profile</p>
          <div class="profile-header">
            ${renderProfileImage(req.currentUser)}
            <div>
              <h1>${escapeHtml(req.currentUser.display_name || req.currentUser.username)}</h1>
              <p class="muted">Public URL: <a href="/u/${escapeHtml(req.currentUser.username)}" target="_blank" rel="noreferrer">/u/${escapeHtml(req.currentUser.username)}</a></p>
            </div>
          </div>
          <form method="post" action="/profile" enctype="multipart/form-data">
            <label>Display name
              <input name="displayName" maxlength="80" value="${escapeHtml(req.currentUser.display_name || "")}">
            </label>
            <label>Bio
              <textarea name="bio" maxlength="240">${escapeHtml(req.currentUser.bio || "")}</textarea>
            </label>
            <div class="profile-image-preview">
              ${renderProfileImage(req.currentUser, { size: 80 })}
              <div>
                <label>Profile image
                  <input type="file" name="profileImage" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/tiff">
                </label>
                <p class="form-hint">Images are auto-cropped and resized to ${profileImageSize}x${profileImageSize}. Max upload size: ${Math.floor(maxProfileImageBytes / (1024 * 1024))} MB.</p>
              </div>
            </div>
            <button type="submit">Save profile</button>
          </form>
        </div>
        <div class="card">
          <p class="eyebrow">New link</p>
          <h2>Add a link</h2>
          <form method="post" action="/links">
            <label>Title
              <input name="title" maxlength="80" required>
            </label>
            <label>URL
              <input name="url" maxlength="255" required placeholder="https://example.com">
            </label>
            <label>Position
              <input type="number" name="position" min="1" max="999" value="${links.length + 1}">
            </label>
            <button type="submit">Add link</button>
          </form>
        </div>
      </section>
      <section class="card" style="margin-top: 24px;">
        <p class="eyebrow">Links</p>
        <h2>Your list</h2>
        <div class="link-list">
          ${
            links.length
              ? links
                  .map(
                    (link) => `
                      <article class="link-item">
                        <header>
                          <strong>${escapeHtml(link.title)}</strong>
                          <small>#${escapeHtml(link.position)}</small>
                        </header>
                        <a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.url)}</a>
                        <div class="split">
                          <form method="post" action="/links/${link.id}">
                            <input type="hidden" name="_method" value="patch">
                            <label>Title
                              <input name="title" maxlength="80" value="${escapeHtml(link.title)}" required>
                            </label>
                            <label>URL
                              <input name="url" maxlength="255" value="${escapeHtml(link.url)}" required>
                            </label>
                            <label>Position
                              <input type="number" name="position" min="1" max="999" value="${escapeHtml(link.position)}">
                            </label>
                            <button type="submit" class="secondary">Update</button>
                          </form>
                          <form method="post" action="/links/${link.id}/delete">
                            <button type="submit">Delete</button>
                          </form>
                        </div>
                      </article>
                    `
                  )
                  .join("")
              : `<p class="muted">No links yet. Add your first one above.</p>`
          }
        </div>
      </section>
    `;

    return res.send(
      renderLayout({
        title: "Dashboard",
        content,
        user: req.currentUser,
        notice: req.query.notice,
      })
    );
  } catch (error) {
    return next(error);
  }
});

app.post(
  "/profile",
  requireAuth,
  upload.single("profileImage"),
  async (req, res, next) => {
    const displayName = String(req.body.displayName || "").trim().slice(0, 80);
    const bio = String(req.body.bio || "").trim().slice(0, 240);

    try {
      const avatar = await processProfileImageUpload(req.file);
      const values = [displayName || null, bio || null, req.currentUser.id];
      let query =
        "update users set display_name = $1, bio = $2, updated_at = now() where id = $3";

      if (avatar) {
        values.push(avatar.data, avatar.contentType);
        query = `update users
          set display_name = $1,
              bio = $2,
              updated_at = now(),
              avatar_data = $4,
              avatar_content_type = $5,
              avatar_updated_at = now()
          where id = $3`;
      }

      await pool.query(query, values);
      return redirectWithMessage(
        res,
        "/dashboard",
        avatar ? "Profile and image updated." : "Profile updated."
      );
    } catch (error) {
      return next(error);
    }
  }
);

app.post("/links", requireAuth, async (req, res, next) => {
  const title = String(req.body.title || "").trim().slice(0, 80);
  const url = normalizeUrl(req.body.url);
  const position = Math.max(1, Number.parseInt(req.body.position, 10) || 1);

  if (!title || !url) {
    return redirectWithMessage(res, "/dashboard", "Add both a title and URL.");
  }

  try {
    await pool.query(
      "insert into links (user_id, title, url, position) values ($1, $2, $3, $4)",
      [req.currentUser.id, title, url, position]
    );
    return redirectWithMessage(res, "/dashboard", "Link added.");
  } catch (error) {
    return next(error);
  }
});

app.post("/links/:id", requireAuth, async (req, res, next) => {
  if (req.body._method !== "patch") {
    return res.status(405).send("Method not allowed");
  }

  const linkId = Number.parseInt(req.params.id, 10);
  const title = String(req.body.title || "").trim().slice(0, 80);
  const url = normalizeUrl(req.body.url);
  const position = Math.max(1, Number.parseInt(req.body.position, 10) || 1);

  if (!linkId || !title || !url) {
    return redirectWithMessage(res, "/dashboard", "Use a valid title and URL.");
  }

  try {
    const result = await pool.query(
      `update links
       set title = $1, url = $2, position = $3, updated_at = now()
       where id = $4 and user_id = $5`,
      [title, url, position, linkId, req.currentUser.id]
    );

    if (!result.rowCount) {
      return redirectWithMessage(res, "/dashboard", "Link not found.");
    }

    return redirectWithMessage(res, "/dashboard", "Link updated.");
  } catch (error) {
    return next(error);
  }
});

app.post("/links/:id/delete", requireAuth, async (req, res, next) => {
  const linkId = Number.parseInt(req.params.id, 10);

  try {
    await pool.query("delete from links where id = $1 and user_id = $2", [
      linkId,
      req.currentUser.id,
    ]);
    return redirectWithMessage(res, "/dashboard", "Link deleted.");
  } catch (error) {
    return next(error);
  }
});

app.get("/u/:username", async (req, res, next) => {
  try {
    const username = normalizeUsername(req.params.username);
    const userResult = await pool.query(
      `select
         id,
         username,
         display_name,
         bio,
         avatar_content_type,
         avatar_updated_at
       from users
       where username = $1`,
      [username]
    );
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).send(
        renderLayout({
          title: "Profile not found",
          user: req.currentUser,
          notice: null,
          content: `
            <div class="card" style="max-width: 680px; margin: 0 auto;">
              <h1>Profile not found</h1>
              <p class="muted">That public profile does not exist.</p>
            </div>
          `,
        })
      );
    }

    const links = await fetchLinksForUser(user.id);
    const content = `
      <div class="card public-profile-card">
        <section class="public-profile-header">
          ${renderProfileImage(user, { size: 144, className: "public-profile-avatar" })}
          <h1 class="public-profile-name">${escapeHtml(user.display_name || user.username)}</h1>
          <p class="public-profile-username">@${escapeHtml(user.username)}</p>
          <p class="public-profile-bio">${escapeHtml(user.bio || "No bio yet.")}</p>
        </section>
        <section class="public-profile-links public-links">
          ${
            links.length
              ? links
                  .map(
                    (link) => `
                      <a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">
                        <span class="public-link-title">${escapeHtml(link.title)}</span>
                        <span class="public-link-url">${escapeHtml(link.url)}</span>
                      </a>
                    `
                  )
                  .join("")
              : `<p class="muted">No links published yet.</p>`
          }
        </section>
      </div>
    `;

    return res.send(
      renderLayout({
        title: `${user.display_name || user.username} | get.servd.pro`,
        content,
        user: req.currentUser,
        notice: req.query.notice,
        bodyClass: "public-profile-page",
      })
    );
  } catch (error) {
    return next(error);
  }
});

app.get("/u/:username/avatar", async (req, res, next) => {
  try {
    const username = normalizeUsername(req.params.username);
    const result = await pool.query(
      `select avatar_data, avatar_content_type, avatar_updated_at
       from users
       where username = $1`,
      [username]
    );
    const user = result.rows[0];

    if (!user || !user.avatar_data || !user.avatar_content_type) {
      return res.status(404).send("Not found");
    }

    res.set("Content-Type", user.avatar_content_type);
    res.set("Cache-Control", "public, max-age=86400");

    if (user.avatar_updated_at) {
      res.set("Last-Modified", new Date(user.avatar_updated_at).toUTCString());
    }

    return res.send(user.avatar_data);
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  // Keep the response minimal; connection and query issues should surface in logs.
  console.error(error);

  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    return redirectWithMessage(
      res,
      "/dashboard",
      `Profile image must be under ${Math.floor(maxProfileImageBytes / (1024 * 1024))} MB.`
    );
  }

  if (error.statusCode === 400) {
    return redirectWithMessage(res, "/dashboard", error.message);
  }

  res.status(500).send(
    renderLayout({
      title: "Server error",
      user: null,
      notice: null,
      content: `
        <div class="card" style="max-width: 680px; margin: 0 auto;">
          <h1>Server error</h1>
          <p class="muted">Something went wrong while processing the request.</p>
        </div>
      `,
    })
  );
});

async function initializeDatabase() {
  await pool.query(`
    create table if not exists users (
      id bigserial primary key,
      username varchar(24) not null unique,
      email varchar(255) not null unique,
      password_hash text not null,
      display_name varchar(80),
      bio varchar(240),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    alter table users
      add column if not exists avatar_data bytea,
      add column if not exists avatar_content_type text,
      add column if not exists avatar_updated_at timestamptz;
  `);

  await pool.query(`
    create table if not exists links (
      id bigserial primary key,
      user_id bigint not null references users(id) on delete cascade,
      title varchar(80) not null,
      url varchar(255) not null,
      position integer not null default 1,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  `);
}

async function start() {
  await initializeDatabase();
  app.listen(port, () => {
    console.log(`servd app listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start application", error);
  process.exit(1);
});
