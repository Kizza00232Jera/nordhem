CREATE TABLE "eval_query_scores" (
	"run_id" uuid NOT NULL,
	"query_id" integer NOT NULL,
	"ndcg" double precision NOT NULL,
	"rr" double precision NOT NULL,
	"recall" double precision NOT NULL,
	CONSTRAINT "eval_query_scores_run_id_query_id_pk" PRIMARY KEY("run_id","query_id")
);
--> statement-breakpoint
CREATE TABLE "eval_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"index_name" text NOT NULL,
	"query_count" integer NOT NULL,
	"ndcg" double precision NOT NULL,
	"mrr" double precision NOT NULL,
	"recall" double precision NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eval_query_scores" ADD CONSTRAINT "eval_query_scores_run_id_eval_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."eval_runs"("id") ON DELETE cascade ON UPDATE no action;