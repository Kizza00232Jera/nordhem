CREATE TABLE "eval_judgments" (
	"query_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"grade" integer NOT NULL,
	CONSTRAINT "eval_judgments_query_id_product_id_pk" PRIMARY KEY("query_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "eval_queries" (
	"query_id" integer PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"query_class" text
);
--> statement-breakpoint
ALTER TABLE "eval_judgments" ADD CONSTRAINT "eval_judgments_query_id_eval_queries_query_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."eval_queries"("query_id") ON DELETE cascade ON UPDATE no action;