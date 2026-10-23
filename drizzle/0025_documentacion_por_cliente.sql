ALTER TABLE "estate_activity" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "estate_document" ALTER COLUMN "uploaded_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "estate_document" ADD COLUMN "document_type" text DEFAULT 'sin_clasificar' NOT NULL;--> statement-breakpoint
ALTER TABLE "estate_document" ADD COLUMN "subject_contact_id" text;--> statement-breakpoint
ALTER TABLE "estate_document" ADD COLUMN "property_id" text;--> statement-breakpoint
ALTER TABLE "estate_document" ADD COLUMN "deal_id" text;--> statement-breakpoint
ALTER TABLE "estate_document" ADD COLUMN "fulfils_document_id" text;--> statement-breakpoint
ALTER TABLE "estate_document" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "estate_document" ADD COLUMN "source_wa_message_id" text;--> statement-breakpoint
ALTER TABLE "estate_document" ADD COLUMN "source_media_asset_id" text;--> statement-breakpoint
ALTER TABLE "estate_document" ADD COLUMN "intake_error" text;--> statement-breakpoint
ALTER TABLE "estate_document" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "estate_document" ADD CONSTRAINT "estate_document_subject_contact_id_contact_id_fk" FOREIGN KEY ("subject_contact_id") REFERENCES "public"."contact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_document" ADD CONSTRAINT "estate_document_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_document" ADD CONSTRAINT "estate_document_deal_id_estate_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."estate_deal"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "estate_document_org_source_wamid_uq" ON "estate_document" USING btree ("organization_id","source_wa_message_id");