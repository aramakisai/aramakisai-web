import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('executive', 'student_exhibitor');
  CREATE TYPE "public"."enum_sponsors_type" AS ENUM('ad', 'sponsor', 'food_truck', 'other');
  CREATE TYPE "public"."enum_sponsors_tier" AS ENUM('platinum', 'gold', 'silver', 'bronze');
  CREATE TYPE "public"."enum_student_exhibitions_category" AS ENUM('stage', 'exhibit', 'vendor', 'other');
  CREATE TYPE "public"."enum_student_exhibitions_status" AS ENUM('published', 'draft');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );

  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "enum_users_role" DEFAULT 'student_exhibitor' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );

  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_hero_url" varchar,
  	"sizes_hero_width" numeric,
  	"sizes_hero_height" numeric,
  	"sizes_hero_mime_type" varchar,
  	"sizes_hero_filesize" numeric,
  	"sizes_hero_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar
  );

  CREATE TABLE "announcements" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" jsonb,
  	"body_html" varchar,
  	"published_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "announcements_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );

  CREATE TABLE "topics" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" jsonb,
  	"body_html" varchar,
  	"image_id" integer,
  	"published_at" timestamp(3) with time zone,
  	"attachment_id" integer,
  	"sort" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "topics_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );

  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"content" jsonb,
  	"content_html" varchar,
  	"embed_url" varchar,
  	"embed_height" numeric,
  	"sort" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "sponsors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_sponsors_type" DEFAULT 'sponsor' NOT NULL,
  	"name" varchar NOT NULL,
  	"logo_id" integer,
  	"url" varchar,
  	"description" varchar,
  	"business_category" varchar,
  	"address" varchar,
  	"tier" "enum_sponsors_tier",
  	"area_id_id" integer,
  	"booth_number" numeric,
  	"booth_label" varchar,
  	"sort" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "faq_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL,
  	"sort" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "map_areas" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"geometry" jsonb NOT NULL,
  	"sort" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "stages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"area_id_id" integer,
  	"sort" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "time_slots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"start_at" timestamp(3) with time zone NOT NULL,
  	"end_at" timestamp(3) with time zone NOT NULL,
  	"sort" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "performance_slots" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stage_id_id" integer NOT NULL,
  	"time_slot_id_id" integer NOT NULL,
  	"exhibition_id_id" integer,
  	"title" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "student_exhibitions_category" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_student_exhibitions_category",
  	"id" serial PRIMARY KEY NOT NULL
  );

  CREATE TABLE "student_exhibitions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"owner_id" integer NOT NULL,
  	"status" "enum_student_exhibitions_status" DEFAULT 'draft' NOT NULL,
  	"name" varchar NOT NULL,
  	"organization_name" varchar NOT NULL,
  	"area_id_id" integer,
  	"booth_number" numeric,
  	"booth_label" varchar,
  	"description" varchar,
  	"links" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "student_exhibitions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );

  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );

  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"announcements_id" integer,
  	"topics_id" integer,
  	"pages_id" integer,
  	"sponsors_id" integer,
  	"faq_items_id" integer,
  	"map_areas_id" integer,
  	"stages_id" integer,
  	"time_slots_id" integer,
  	"performance_slots_id" integer,
  	"student_exhibitions_id" integer
  );

  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );

  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "festival_meta" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"event_days" jsonb,
  	"parking_map_id" integer,
  	"sns_links" jsonb,
  	"overview" jsonb,
  	"overview_html" varchar,
  	"hero_image_id" integer,
  	"theme_word" varchar,
  	"theme_description" jsonb,
  	"theme_description_html" varchar,
  	"venue_name" varchar,
  	"campus_map_url" varchar,
  	"contact_form_url" varchar,
  	"theme_image_id" integer,
  	"site_title" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );

  CREATE TABLE "page_home" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_message" jsonb,
  	"hero_message_html" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );

  CREATE TABLE "page_home_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );

  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "announcements_rels" ADD CONSTRAINT "announcements_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "announcements_rels" ADD CONSTRAINT "announcements_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "topics" ADD CONSTRAINT "topics_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "topics" ADD CONSTRAINT "topics_attachment_id_media_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "topics_rels" ADD CONSTRAINT "topics_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "topics_rels" ADD CONSTRAINT "topics_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_area_id_id_map_areas_id_fk" FOREIGN KEY ("area_id_id") REFERENCES "public"."map_areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stages" ADD CONSTRAINT "stages_area_id_id_map_areas_id_fk" FOREIGN KEY ("area_id_id") REFERENCES "public"."map_areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "performance_slots" ADD CONSTRAINT "performance_slots_stage_id_id_stages_id_fk" FOREIGN KEY ("stage_id_id") REFERENCES "public"."stages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "performance_slots" ADD CONSTRAINT "performance_slots_time_slot_id_id_time_slots_id_fk" FOREIGN KEY ("time_slot_id_id") REFERENCES "public"."time_slots"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "performance_slots" ADD CONSTRAINT "performance_slots_exhibition_id_id_student_exhibitions_id_fk" FOREIGN KEY ("exhibition_id_id") REFERENCES "public"."student_exhibitions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "student_exhibitions_category" ADD CONSTRAINT "student_exhibitions_category_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."student_exhibitions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "student_exhibitions" ADD CONSTRAINT "student_exhibitions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "student_exhibitions" ADD CONSTRAINT "student_exhibitions_area_id_id_map_areas_id_fk" FOREIGN KEY ("area_id_id") REFERENCES "public"."map_areas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "student_exhibitions_rels" ADD CONSTRAINT "student_exhibitions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."student_exhibitions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "student_exhibitions_rels" ADD CONSTRAINT "student_exhibitions_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_announcements_fk" FOREIGN KEY ("announcements_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_topics_fk" FOREIGN KEY ("topics_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sponsors_fk" FOREIGN KEY ("sponsors_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_faq_items_fk" FOREIGN KEY ("faq_items_id") REFERENCES "public"."faq_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_map_areas_fk" FOREIGN KEY ("map_areas_id") REFERENCES "public"."map_areas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stages_fk" FOREIGN KEY ("stages_id") REFERENCES "public"."stages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_time_slots_fk" FOREIGN KEY ("time_slots_id") REFERENCES "public"."time_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_performance_slots_fk" FOREIGN KEY ("performance_slots_id") REFERENCES "public"."performance_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_student_exhibitions_fk" FOREIGN KEY ("student_exhibitions_id") REFERENCES "public"."student_exhibitions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "festival_meta" ADD CONSTRAINT "festival_meta_parking_map_id_media_id_fk" FOREIGN KEY ("parking_map_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "festival_meta" ADD CONSTRAINT "festival_meta_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "festival_meta" ADD CONSTRAINT "festival_meta_theme_image_id_media_id_fk" FOREIGN KEY ("theme_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "page_home_rels" ADD CONSTRAINT "page_home_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."page_home"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "page_home_rels" ADD CONSTRAINT "page_home_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "media" USING btree ("sizes_hero_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "announcements_updated_at_idx" ON "announcements" USING btree ("updated_at");
  CREATE INDEX "announcements_created_at_idx" ON "announcements" USING btree ("created_at");
  CREATE INDEX "announcements_rels_order_idx" ON "announcements_rels" USING btree ("order");
  CREATE INDEX "announcements_rels_parent_idx" ON "announcements_rels" USING btree ("parent_id");
  CREATE INDEX "announcements_rels_path_idx" ON "announcements_rels" USING btree ("path");
  CREATE INDEX "announcements_rels_media_id_idx" ON "announcements_rels" USING btree ("media_id");
  CREATE INDEX "topics_image_idx" ON "topics" USING btree ("image_id");
  CREATE INDEX "topics_attachment_idx" ON "topics" USING btree ("attachment_id");
  CREATE INDEX "topics_updated_at_idx" ON "topics" USING btree ("updated_at");
  CREATE INDEX "topics_created_at_idx" ON "topics" USING btree ("created_at");
  CREATE INDEX "topics_rels_order_idx" ON "topics_rels" USING btree ("order");
  CREATE INDEX "topics_rels_parent_idx" ON "topics_rels" USING btree ("parent_id");
  CREATE INDEX "topics_rels_path_idx" ON "topics_rels" USING btree ("path");
  CREATE INDEX "topics_rels_media_id_idx" ON "topics_rels" USING btree ("media_id");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "sponsors_logo_idx" ON "sponsors" USING btree ("logo_id");
  CREATE INDEX "sponsors_area_id_idx" ON "sponsors" USING btree ("area_id_id");
  CREATE INDEX "sponsors_updated_at_idx" ON "sponsors" USING btree ("updated_at");
  CREATE INDEX "sponsors_created_at_idx" ON "sponsors" USING btree ("created_at");
  CREATE INDEX "faq_items_updated_at_idx" ON "faq_items" USING btree ("updated_at");
  CREATE INDEX "faq_items_created_at_idx" ON "faq_items" USING btree ("created_at");
  CREATE INDEX "map_areas_updated_at_idx" ON "map_areas" USING btree ("updated_at");
  CREATE INDEX "map_areas_created_at_idx" ON "map_areas" USING btree ("created_at");
  CREATE INDEX "stages_area_id_idx" ON "stages" USING btree ("area_id_id");
  CREATE INDEX "stages_updated_at_idx" ON "stages" USING btree ("updated_at");
  CREATE INDEX "stages_created_at_idx" ON "stages" USING btree ("created_at");
  CREATE INDEX "time_slots_updated_at_idx" ON "time_slots" USING btree ("updated_at");
  CREATE INDEX "time_slots_created_at_idx" ON "time_slots" USING btree ("created_at");
  CREATE INDEX "performance_slots_stage_id_idx" ON "performance_slots" USING btree ("stage_id_id");
  CREATE INDEX "performance_slots_time_slot_id_idx" ON "performance_slots" USING btree ("time_slot_id_id");
  CREATE INDEX "performance_slots_exhibition_id_idx" ON "performance_slots" USING btree ("exhibition_id_id");
  CREATE INDEX "performance_slots_updated_at_idx" ON "performance_slots" USING btree ("updated_at");
  CREATE INDEX "performance_slots_created_at_idx" ON "performance_slots" USING btree ("created_at");
  CREATE INDEX "student_exhibitions_category_order_idx" ON "student_exhibitions_category" USING btree ("order");
  CREATE INDEX "student_exhibitions_category_parent_idx" ON "student_exhibitions_category" USING btree ("parent_id");
  CREATE INDEX "student_exhibitions_owner_idx" ON "student_exhibitions" USING btree ("owner_id");
  CREATE INDEX "student_exhibitions_area_id_idx" ON "student_exhibitions" USING btree ("area_id_id");
  CREATE INDEX "student_exhibitions_updated_at_idx" ON "student_exhibitions" USING btree ("updated_at");
  CREATE INDEX "student_exhibitions_created_at_idx" ON "student_exhibitions" USING btree ("created_at");
  CREATE INDEX "student_exhibitions_rels_order_idx" ON "student_exhibitions_rels" USING btree ("order");
  CREATE INDEX "student_exhibitions_rels_parent_idx" ON "student_exhibitions_rels" USING btree ("parent_id");
  CREATE INDEX "student_exhibitions_rels_path_idx" ON "student_exhibitions_rels" USING btree ("path");
  CREATE INDEX "student_exhibitions_rels_media_id_idx" ON "student_exhibitions_rels" USING btree ("media_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_announcements_id_idx" ON "payload_locked_documents_rels" USING btree ("announcements_id");
  CREATE INDEX "payload_locked_documents_rels_topics_id_idx" ON "payload_locked_documents_rels" USING btree ("topics_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_sponsors_id_idx" ON "payload_locked_documents_rels" USING btree ("sponsors_id");
  CREATE INDEX "payload_locked_documents_rels_faq_items_id_idx" ON "payload_locked_documents_rels" USING btree ("faq_items_id");
  CREATE INDEX "payload_locked_documents_rels_map_areas_id_idx" ON "payload_locked_documents_rels" USING btree ("map_areas_id");
  CREATE INDEX "payload_locked_documents_rels_stages_id_idx" ON "payload_locked_documents_rels" USING btree ("stages_id");
  CREATE INDEX "payload_locked_documents_rels_time_slots_id_idx" ON "payload_locked_documents_rels" USING btree ("time_slots_id");
  CREATE INDEX "payload_locked_documents_rels_performance_slots_id_idx" ON "payload_locked_documents_rels" USING btree ("performance_slots_id");
  CREATE INDEX "payload_locked_documents_rels_student_exhibitions_id_idx" ON "payload_locked_documents_rels" USING btree ("student_exhibitions_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "festival_meta_parking_map_idx" ON "festival_meta" USING btree ("parking_map_id");
  CREATE INDEX "festival_meta_hero_image_idx" ON "festival_meta" USING btree ("hero_image_id");
  CREATE INDEX "festival_meta_theme_image_idx" ON "festival_meta" USING btree ("theme_image_id");
  CREATE INDEX "page_home_rels_order_idx" ON "page_home_rels" USING btree ("order");
  CREATE INDEX "page_home_rels_parent_idx" ON "page_home_rels" USING btree ("parent_id");
  CREATE INDEX "page_home_rels_path_idx" ON "page_home_rels" USING btree ("path");
  CREATE INDEX "page_home_rels_media_id_idx" ON "page_home_rels" USING btree ("media_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "announcements" CASCADE;
  DROP TABLE "announcements_rels" CASCADE;
  DROP TABLE "topics" CASCADE;
  DROP TABLE "topics_rels" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "sponsors" CASCADE;
  DROP TABLE "faq_items" CASCADE;
  DROP TABLE "map_areas" CASCADE;
  DROP TABLE "stages" CASCADE;
  DROP TABLE "time_slots" CASCADE;
  DROP TABLE "performance_slots" CASCADE;
  DROP TABLE "student_exhibitions_category" CASCADE;
  DROP TABLE "student_exhibitions" CASCADE;
  DROP TABLE "student_exhibitions_rels" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "festival_meta" CASCADE;
  DROP TABLE "page_home" CASCADE;
  DROP TABLE "page_home_rels" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_sponsors_type";
  DROP TYPE "public"."enum_sponsors_tier";
  DROP TYPE "public"."enum_student_exhibitions_category";
  DROP TYPE "public"."enum_student_exhibitions_status";`)
}
