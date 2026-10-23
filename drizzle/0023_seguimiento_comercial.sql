ALTER TABLE "lead" ADD COLUMN "next_action" text;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "next_action_at" timestamp;--> statement-breakpoint
ALTER TABLE "lead" ADD COLUMN "next_action_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "attention_mode" text;