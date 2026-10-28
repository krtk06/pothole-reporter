/**
 * The backend runs against AWS RDS only.
 *
 * classifyDatabaseUrl is the one place that decides whether a DATABASE_URL may
 * be used. It parses the URL and checks the hostname, so a query parameter that
 * merely contains "rds.amazonaws.com" cannot pass. Messages never include the
 * password.
 */
export type DatabaseKind = "aws-rds" | "local" | "other" | "missing" | "malformed";

export interface DatabaseTarget {
  ok: boolean;
  kind: DatabaseKind;
  host: string;
  reason: string;
}

const RDS_HOST = /\.rds\.amazonaws\.com$/i;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function classifyDatabaseUrl(
  value: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): DatabaseTarget {
  if (!value) {
    return { ok: false, kind: "missing", host: "", reason: "DATABASE_URL is not set" };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, kind: "malformed", host: "", reason: "DATABASE_URL is not a valid URL" };
  }

  const host = parsed.hostname.toLowerCase();

  if (RDS_HOST.test(host)) {
    return { ok: true, kind: "aws-rds", host, reason: "AWS RDS endpoint" };
  }

  if (LOCAL_HOSTS.has(host) && env.DATABASE_ALLOW_LOCAL === "1") {
    return { ok: true, kind: "local", host, reason: "local database allowed by DATABASE_ALLOW_LOCAL" };
  }

  return { ok: false, kind: "other", host, reason: "not an AWS RDS endpoint" };
}

export function assertAwsDatabase(
  value: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): DatabaseTarget {
  const target = classifyDatabaseUrl(value, env);
  if (!target.ok) {
    const host = target.host ? ` (host: ${target.host})` : "";
    throw new Error(
      `Refusing to start: ${target.reason}${host}. ` +
        "This backend is AWS-only and requires an RDS PostgreSQL endpoint.",
    );
  }
  return target;
}
