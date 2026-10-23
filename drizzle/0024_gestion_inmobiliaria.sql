CREATE TABLE "estate_activity" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"actor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estate_client" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"role" text DEFAULT 'comprador' NOT NULL,
	"email" text,
	"budget_min" integer,
	"budget_max" integer,
	"preferred_city" text,
	"min_rooms" integer,
	"property_type" text,
	"assigned_user_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estate_deal" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"assigned_user_id" text,
	"phase" text DEFAULT 'nuevo' NOT NULL,
	"amount_cents" integer,
	"notes" text,
	"lost_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estate_document" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'otro' NOT NULL,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"visibility" text DEFAULT 'restringido' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"previous_id" text,
	"due_at" timestamp,
	"filename" text,
	"mime" text,
	"size" integer,
	"storage_id" text,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estate_offer" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"deal_id" text NOT NULL,
	"kind" text DEFAULT 'oferta' NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estate_visit" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"property_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"assigned_user_id" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"reference" text NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'piso' NOT NULL,
	"status" text DEFAULT 'disponible' NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"postal_code" text,
	"price_cents" integer NOT NULL,
	"area" integer NOT NULL,
	"rooms" integer NOT NULL,
	"bathrooms" integer NOT NULL,
	"garden" boolean DEFAULT false NOT NULL,
	"terrace" boolean DEFAULT false NOT NULL,
	"garage" boolean DEFAULT false NOT NULL,
	"description" text,
	"owner_contact_id" text,
	"assigned_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "estate_activity" ADD CONSTRAINT "estate_activity_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_activity" ADD CONSTRAINT "estate_activity_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_client" ADD CONSTRAINT "estate_client_id_contact_id_fk" FOREIGN KEY ("id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_client" ADD CONSTRAINT "estate_client_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_client" ADD CONSTRAINT "estate_client_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_deal" ADD CONSTRAINT "estate_deal_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_deal" ADD CONSTRAINT "estate_deal_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_deal" ADD CONSTRAINT "estate_deal_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_deal" ADD CONSTRAINT "estate_deal_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_document" ADD CONSTRAINT "estate_document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_document" ADD CONSTRAINT "estate_document_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_offer" ADD CONSTRAINT "estate_offer_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_offer" ADD CONSTRAINT "estate_offer_deal_id_estate_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."estate_deal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_offer" ADD CONSTRAINT "estate_offer_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_visit" ADD CONSTRAINT "estate_visit_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_visit" ADD CONSTRAINT "estate_visit_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_visit" ADD CONSTRAINT "estate_visit_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_visit" ADD CONSTRAINT "estate_visit_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_owner_contact_id_contact_id_fk" FOREIGN KEY ("owner_contact_id") REFERENCES "public"."contact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "estate_activity_org_entity_idx" ON "estate_activity" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "estate_client_org_idx" ON "estate_client" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "estate_deal_org_phase_idx" ON "estate_deal" USING btree ("organization_id","phase");--> statement-breakpoint
CREATE INDEX "estate_document_org_entity_idx" ON "estate_document" USING btree ("organization_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "estate_offer_org_deal_idx" ON "estate_offer" USING btree ("organization_id","deal_id");--> statement-breakpoint
CREATE INDEX "estate_visit_org_start_idx" ON "estate_visit" USING btree ("organization_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "property_org_reference_uq" ON "property" USING btree ("organization_id","reference");--> statement-breakpoint
CREATE INDEX "property_org_status_idx" ON "property" USING btree ("organization_id","status");