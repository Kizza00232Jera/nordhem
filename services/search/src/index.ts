import { createDb } from "@nordhem/db";
import { createEsClient } from "./es/client.ts";
import { buildApp } from "./server.ts";

const esUrl = process.env.ES_URL ?? "http://localhost:9200";
const index = process.env.SEARCH_INDEX ?? "products";
const shopIndex = process.env.SHOP_INDEX ?? "products-shop";
const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://nordhem:nordhem@localhost:5432/nordhem";
const port = Number(process.env.PORT ?? 3001);

const { db } = createDb(databaseUrl);
const app = buildApp({ es: createEsClient(esUrl), index, shopIndex, db, logger: true });
await app.listen({ port, host: "0.0.0.0" });
