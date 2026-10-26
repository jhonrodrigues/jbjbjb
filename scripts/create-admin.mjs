import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const url = process.env.DATABASE_URL?.trim();
if (!url && !(process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER && process.env.PGPASSWORD)) {
  console.error("DATABASE_URL não configurada.");
  process.exit(1);
}

let email = arg("email") || process.env.ADMIN_EMAIL;
let name = arg("name") || process.env.ADMIN_NAME;
let password = arg("password") || process.env.ADMIN_PASSWORD;
const update = process.argv.includes("--update");

if (!email || !name || !password) {
  if ((!email || !name || !password) && (!input.isTTY || !output.isTTY)) {
    console.error("Informe ADMIN_EMAIL, ADMIN_NAME e ADMIN_PASSWORD ou execute em um terminal interativo.");
    process.exit(1);
  }
  const rl = createInterface({ input, output });
  email ||= await rl.question("E-mail do administrador: ");
  name ||= await rl.question("Nome: ");
  rl.close();
  if (!password) password = await hiddenQuestion("Senha (mínimo 10 caracteres): ");
}

email = email.trim().toLowerCase();
name = name.trim();

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("E-mail inválido.");
  process.exit(1);
}
if (!password || password.length < 10) {
  console.error("A senha deve ter pelo menos 10 caracteres.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url || undefined, max: 1, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined });
const client = await pool.connect();
try {
  const { rows: existing } = await client.query("select id, email from jb_agent_users where email = $1", [email]);
  const hash = await bcrypt.hash(password, 12);
  if (existing[0] && !update) {
    console.error(`Usuário ${email} já existe. Use --update para redefinir a senha e garantir papel de administrador.`);
    process.exitCode = 1;
  } else if (existing[0]) {
    await client.query(
      "update jb_agent_users set name = $2, password_hash = $3, session_version = session_version + 1, role = 'admin', active = true, updated_at = now() where email = $1",
      [email, name, hash],
    );
    console.log(`Administrador atualizado: ${email}`);
  } else {
    await client.query(
      "insert into jb_agent_users (name, email, password_hash, role, active) values ($1, $2, $3, 'admin', true)",
      [name, email, hash],
    );
    console.log(`Administrador criado: ${email}`);
  }
} catch (error) {
  console.error("Falha ao criar administrador:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}

function hiddenQuestion(prompt) {
  return new Promise((resolve) => {
    output.write(prompt);
    input.resume();
    input.setRawMode(true);
    let value = "";
    const onData = (chunk) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\u0003") {
          input.setRawMode(false);
          input.off("data", onData);
          output.write("\n");
          process.exit(130);
        }
        if (char === "\r" || char === "\n") {
          input.setRawMode(false);
          input.off("data", onData);
          output.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            output.write("\b \b");
          }
          continue;
        }
        value += char;
        output.write("*");
      }
    };
    input.on("data", onData);
  });
}
