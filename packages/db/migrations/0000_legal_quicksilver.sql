CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_pool" (
	"id" serial PRIMARY KEY NOT NULL,
	"search_query" text NOT NULL,
	"url" text NOT NULL,
	"thumb_url" text NOT NULL,
	"photographer_name" text NOT NULL,
	"photographer_url" text NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"thumb_url" text NOT NULL,
	"photographer_name" text NOT NULL,
	"photographer_url" text NOT NULL,
	"source" text NOT NULL,
	"search_query" text NOT NULL,
	"status" text DEFAULT 'auto' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products_raw" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"product_class" text,
	"category_hierarchy" text,
	"description" text,
	"features" text,
	"rating_count" double precision,
	"average_rating" double precision,
	"review_count" double precision
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "shop_products" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"category" text NOT NULL,
	"price_cents" integer NOT NULL,
	CONSTRAINT "shop_products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_shop_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."shop_products"("product_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_products" ADD CONSTRAINT "shop_products_product_id_products_raw_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products_raw"("product_id") ON DELETE no action ON UPDATE no action;