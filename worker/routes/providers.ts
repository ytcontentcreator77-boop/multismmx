import { Hono } from "hono";
import { isOwner } from "../env";
import { getProvider, importServices, listRemote, smm, type Provider } from "../providers";
import { type AppEnv, err } from "./app";

export const providers = new Hono<AppEnv>();
providers.use("*", async (c, next) => (isOwner(c.env, c.get("settings"), c.get("user").id) ? next() : err(c, 403, "FORBIDDEN")));

const mask = (p: Provider) => ({ ...p, api_key: p.api_key.slice(0, 4) + "••••" });

providers.get("/providers", async (c) => c.json({ items: (await c.env.DB.prepare("SELECT * FROM providers ORDER BY id").all<Provider>()).results.map(mask) }));

providers.post("/providers", async (c) => {
  const b = await c.req.json<{ name: string; api_url: string; api_key: string; usd_rate?: number }>().catch(() => null);
  if (!b?.name || !b.api_url || !b.api_key) return err(c, 400, "BAD_REQUEST");
  try { await smm({ api_url: b.api_url, api_key: b.api_key }, "balance"); } catch (e) { return err(c, 400, "PROVIDER_REJECTED"); }
  const r = await c.env.DB.prepare("INSERT INTO providers (name, api_url, api_key, usd_rate, created_at) VALUES (?1,?2,?3,?4,?5)").bind(b.name.slice(0, 60), b.api_url, b.api_key, b.usd_rate || 1, Date.now()).run();
  return c.json({ ok: true, id: r.meta.last_row_id });
});


providers.put("/providers/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const current = await getProvider(c.env, id);
  if (!current) return err(c, 404, "NOT_FOUND");
  const b = await c.req.json<{ name?: string; api_url?: string; api_key?: string; usd_rate?: number; enabled?: boolean }>().catch(() => null);
  if (!b) return err(c, 400, "BAD_REQUEST");
  const next = { ...current, ...b };
  const credentialsChanged = (b.api_url !== undefined && b.api_url !== current.api_url) || (b.api_key !== undefined && b.api_key !== current.api_key);
  if (credentialsChanged) {
    const active = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE provider_id = ?1 AND status IN ('submitting','pending','processing','in_progress')").bind(id).first<{n:number}>();
    if ((active?.n ?? 0) > 0) return err(c, 409, "PROVIDER_HAS_OPEN_ORDERS", { count: active?.n });
    try { await smm({ api_url: next.api_url, api_key: next.api_key }, "balance"); }
    catch { return err(c, 400, "PROVIDER_REJECTED"); }
  }
  if (b.usd_rate !== undefined && (!Number.isFinite(b.usd_rate) || b.usd_rate <= 0)) return err(c, 400, "BAD_REQUEST");
  await c.env.DB.prepare("UPDATE providers SET name=?1,api_url=?2,api_key=?3,usd_rate=?4,enabled=?5 WHERE id=?6")
    .bind((next.name || current.name).slice(0,60), next.api_url || current.api_url, next.api_key || current.api_key, next.usd_rate || current.usd_rate, b.enabled === undefined ? current.enabled : +b.enabled, id).run();
  return c.json({ ok: true });
});

providers.delete("/providers/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const active = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE provider_id = ?1 AND status IN ('submitting','pending','processing','in_progress')").bind(id).first<{n:number}>();
  if ((active?.n ?? 0) > 0) return err(c, 409, "PROVIDER_HAS_OPEN_ORDERS", { count: active?.n });
  await c.env.DB.prepare("UPDATE services SET enabled = 0 WHERE provider_id = ?1").bind(id).run();
  await c.env.DB.prepare("DELETE FROM providers WHERE id = ?1").bind(id).run();
  return c.json({ ok: true });
});

/** Categories (with counts and cheapest rate) of one provider, to pick from before importing. */
providers.get("/providers/:id/catalog", async (c) => {
  const p = await getProvider(c.env, Number(c.req.param("id")));
  if (!p) return err(c, 404, "NOT_FOUND");
  const q = (c.req.query("category") ?? "").toLowerCase();
  const all = await listRemote(p);
  const cats = new Map<string, number>();
  for (const s of all) cats.set(s.category, (cats.get(s.category) ?? 0) + 1);
  const services = q ? all.filter((s) => s.category.toLowerCase() === q).slice(0, 500) : [];
  return c.json({ categories: [...cats].map(([name, count]) => ({ name, count })), services });
});

providers.post("/providers/:id/import", async (c) => {
  const p = await getProvider(c.env, Number(c.req.param("id")));
  const b = await c.req.json<{ ids: (string | number)[]; platform: string }>().catch(() => null);
  if (!p || !p.enabled || !b?.ids?.length) return err(c, 400, "BAD_REQUEST");
  return c.json({ ok: true, imported: await importServices(c.env, p, b.ids.slice(0, 500), b.platform || "other") });
});

providers.put("/icons/service/:id", async (c) => {
  const b = await c.req.json<{ icon: string }>().catch(() => null);
  await c.env.DB.prepare("UPDATE services SET icon = ?1 WHERE id = ?2").bind((b?.icon ?? "").slice(0, 300), Number(c.req.param("id"))).run();
  return c.json({ ok: true });
});

providers.put("/icons/category", async (c) => {
  const b = await c.req.json<{ platform: string; category: string; icon: string }>().catch(() => null);
  if (!b) return err(c, 400, "BAD_REQUEST");
  await c.env.DB.prepare("INSERT INTO category_icons (platform, category, icon) VALUES (?1,?2,?3) ON CONFLICT DO UPDATE SET icon = excluded.icon").bind(b.platform, b.category, b.icon.slice(0, 300)).run();
  return c.json({ ok: true });
});

providers.get("/currencies", async (c) => c.json({ items: (await c.env.DB.prepare("SELECT * FROM currencies ORDER BY code").all()).results }));
providers.post("/currencies", async (c) => {
  const b = await c.req.json<{code:string;name:string;symbol:string;per_usd:number;decimals?:number}>().catch(()=>null);
  if (!b || !/^[A-Z]{3,5}$/.test(b.code) || !b.name?.trim() || !b.symbol?.trim() || !Number.isFinite(b.per_usd) || b.per_usd<=0) return err(c,400,"BAD_REQUEST");
  await c.env.DB.prepare("INSERT INTO currencies(code,name,symbol,per_usd,enabled,decimals,symbol_visible,markup_pct,is_default) VALUES(?1,?2,?3,?4,1,?5,1,0,0)").bind(b.code,b.name.slice(0,60),b.symbol.slice(0,8),b.per_usd,Math.max(0,Math.min(4,Math.floor(b.decimals??2)))).run();
  return c.json({ok:true});
});
providers.put("/currencies/:code", async (c) => {
  const b = await c.req.json<{name?:string;symbol?:string;per_usd?:number;enabled?:boolean;decimals?:number;symbol_visible?:boolean;markup_pct?:number;is_default?:boolean}>().catch(() => null);
  if (!b) return err(c, 400, "BAD_REQUEST");
  if (b.per_usd !== undefined && (!Number.isFinite(b.per_usd) || b.per_usd<=0)) return err(c,400,"BAD_REQUEST");
  if (b.markup_pct !== undefined && (!Number.isFinite(b.markup_pct) || b.markup_pct<0 || b.markup_pct>500)) return err(c,400,"BAD_REQUEST");
  if (b.decimals !== undefined && (!Number.isInteger(b.decimals) || b.decimals<0 || b.decimals>4)) return err(c,400,"BAD_REQUEST");
  if (b.symbol !== undefined && (!b.symbol.trim() || b.symbol.length>8)) return err(c,400,"BAD_REQUEST");
  if (b.name !== undefined && (!b.name.trim() || b.name.length>60)) return err(c,400,"BAD_REQUEST");
  const code=c.req.param("code");
  const current=await c.env.DB.prepare("SELECT code,is_default,enabled FROM currencies WHERE code=?1").bind(code).first<{code:string;is_default:number;enabled:number}>();
  if (!current) return err(c,404,"CURRENCY_NOT_FOUND");
  if (b.is_default && b.enabled === false) return err(c,400,"DEFAULT_CURRENCY_MUST_BE_ENABLED");
  if (b.is_default) await c.env.DB.prepare("UPDATE currencies SET is_default=0").run();
  if (b.enabled === false) {
    if (current.is_default) return err(c,400,"DEFAULT_CURRENCY_REQUIRED");
    const def=await c.env.DB.prepare("SELECT code FROM currencies WHERE is_default=1 AND enabled=1").first<{code:string}>();
    if (!def) return err(c,409,"DEFAULT_CURRENCY_REQUIRED");
    await c.env.DB.prepare("UPDATE users SET currency_code=?1 WHERE currency_code=?2").bind(def.code,code).run();
  }
  await c.env.DB.prepare("UPDATE currencies SET name=COALESCE(?1,name),symbol=COALESCE(?2,symbol),per_usd=COALESCE(?3,per_usd),enabled=COALESCE(?4,enabled),decimals=COALESCE(?5,decimals),symbol_visible=COALESCE(?6,symbol_visible),markup_pct=COALESCE(?7,markup_pct),is_default=COALESCE(?8,is_default) WHERE code=?9")
    .bind(b.name??null,b.symbol??null,b.per_usd??null,b.enabled===undefined?null:+b.enabled,b.decimals??null,b.symbol_visible===undefined?null:+b.symbol_visible,b.markup_pct??null,b.is_default===undefined?null:+b.is_default,code).run();
  return c.json({ ok: true });
});
providers.delete("/currencies/:code", async (c) => {
  const code=c.req.param("code");
  const currency=await c.env.DB.prepare("SELECT is_default FROM currencies WHERE code=?1").bind(code).first<{is_default:number}>();
  if (code==="USD" || currency?.is_default) return err(c,400,"DEFAULT_CURRENCY_REQUIRED");
  const used=await c.env.DB.prepare("SELECT COUNT(*) n FROM users WHERE currency_code=?1").bind(code).first<{n:number}>();
  if ((used?.n??0)>0) return err(c,409,"CURRENCY_IN_USE");
  await c.env.DB.prepare("DELETE FROM currencies WHERE code=?1").bind(code).run(); return c.json({ok:true});
});

providers.get("/payment-methods", async (c) => c.json({ items: (await c.env.DB.prepare("SELECT id,name,kind,currency,details,min_amount,fee_pct,icon,enabled,sort FROM payment_methods ORDER BY sort").all()).results }));
providers.put("/payment-methods/:id", async (c) => {
  const b = await c.req.json<Record<string, any>>().catch(() => null);
  if (!b) return err(c, 400, "BAD_REQUEST");
  await c.env.DB.prepare("UPDATE payment_methods SET name=COALESCE(?1,name), details=COALESCE(?2,details), currency=COALESCE(?3,currency), min_amount=COALESCE(?4,min_amount), fee_pct=COALESCE(?5,fee_pct), icon=COALESCE(?6,icon), enabled=COALESCE(?7,enabled), api_url=COALESCE(?8,api_url), api_key=COALESCE(?9,api_key) WHERE id=?10")
    .bind(b.name ?? null, b.details ?? null, b.currency ?? null, b.min_amount ?? null, b.fee_pct ?? null, b.icon ?? null, b.enabled === undefined ? null : +b.enabled, b.api_url ?? null, b.api_key ?? null, c.req.param("id")).run();
  return c.json({ ok: true });
});
