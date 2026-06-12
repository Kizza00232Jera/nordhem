import { Client } from "@elastic/elasticsearch";

export function createEsClient(node: string): Client {
  return new Client({ node });
}
