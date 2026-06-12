import { createEsClient } from "./es/client.ts";
import { buildApp } from "./server.ts";

const esUrl = process.env.ES_URL ?? "http://localhost:9200";
const index = process.env.SEARCH_INDEX ?? "products";
const port = Number(process.env.PORT ?? 3001);

const app = buildApp({ es: createEsClient(esUrl), index, logger: true });
await app.listen({ port, host: "0.0.0.0" });
