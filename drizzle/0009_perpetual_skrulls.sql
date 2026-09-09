UPDATE "enrollments" SET "access_type" = 'locked' WHERE "access_type" = 'trial';--> statement-breakpoint
DROP TABLE "mentor_messages" CASCADE;--> statement-breakpoint
DROP TABLE "mentor_threads" CASCADE;--> statement-breakpoint
ALTER TABLE "lessons" DROP COLUMN "is_free";
