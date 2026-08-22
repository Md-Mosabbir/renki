-- GENERATED FILE — DO NOT EDIT.
--
-- Snapshot of the current database schema, written by
-- backend/scripts/snapshot-schema.sh. Read this to learn the shape of a
-- table; read backend/migrations/ to learn how it got that way.
--
-- To change the schema, add a migration and re-run:
--     npm run migrate && npm run schema:snapshot

--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: friendships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.friendships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_id uuid NOT NULL,
    addressee_id uuid NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_friend_not_self CHECK ((requester_id <> addressee_id)),
    CONSTRAINT friendships_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'blocked'::character varying])::text[])))
);


--
-- Name: gender_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gender_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    verification_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    verified_at timestamp with time zone,
    video_retained boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    match_distance real,
    match_threshold real,
    matcher character varying(40),
    reviewed_by_user_id uuid,
    review_note text,
    CONSTRAINT chk_verification_distance_sane CHECK (((match_distance IS NULL) OR (match_distance >= (0)::double precision))),
    CONSTRAINT chk_verification_status CHECK (((verification_status)::text = ANY ((ARRAY['pending'::character varying, 'under_review'::character varying, 'verified'::character varying, 'failed'::character varying])::text[])))
);


--
-- Name: COLUMN gender_verifications.match_distance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.gender_verifications.match_distance IS 'Raw distance from the face matcher. Compare against match_threshold — the scale is model-specific and means nothing on its own.';


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    address character varying(255),
    kind character varying(20) DEFAULT 'other'::character varying NOT NULL,
    CONSTRAINT chk_locations_kind CHECK (((kind)::text = ANY ((ARRAY['campus'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT locations_latitude_check CHECK (((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision))),
    CONSTRAINT locations_longitude_check CHECK (((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)))
);


--
-- Name: qr_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qr_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ride_group_id uuid NOT NULL,
    code character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    reported_user_id uuid NOT NULL,
    ride_group_id uuid,
    reason character varying(100) NOT NULL,
    description text,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_report_not_self CHECK ((reporter_id <> reported_user_id)),
    CONSTRAINT reports_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'under_review'::character varying, 'resolved'::character varying, 'dismissed'::character varying])::text[])))
);


--
-- Name: ride_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ride_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ride_group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    satisfied boolean NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ride_group_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ride_group_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ride_group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    direction character varying(10) NOT NULL,
    status character varying(10) DEFAULT 'pending'::character varying NOT NULL,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_invite_responded_at CHECK ((((status)::text = 'pending'::text) = (responded_at IS NULL))),
    CONSTRAINT ride_group_invites_direction_check CHECK (((direction)::text = ANY ((ARRAY['invited'::character varying, 'requested'::character varying])::text[]))),
    CONSTRAINT ride_group_invites_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'declined'::character varying])::text[])))
);


--
-- Name: ride_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ride_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    destination_location_id uuid NOT NULL,
    departure_time timestamp with time zone NOT NULL,
    status character varying(20) DEFAULT 'matched'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    gender character varying(20) NOT NULL,
    formation character varying(20) DEFAULT 'matched'::character varying NOT NULL,
    created_by_user_id uuid,
    capacity smallint DEFAULT 2 NOT NULL,
    CONSTRAINT chk_matched_capacity_is_two CHECK ((((formation)::text <> 'matched'::text) OR (capacity = 2))),
    CONSTRAINT chk_ride_groups_capacity CHECK (((capacity >= 2) AND (capacity <= 6))),
    CONSTRAINT chk_ride_groups_formation CHECK (((formation)::text = ANY ((ARRAY['matched'::character varying, 'friends'::character varying])::text[]))),
    CONSTRAINT chk_ride_groups_friends_have_creator CHECK ((((formation)::text <> 'friends'::text) OR (created_by_user_id IS NOT NULL))),
    CONSTRAINT chk_ride_groups_gender CHECK (((gender)::text = ANY ((ARRAY['male'::character varying, 'female'::character varying])::text[]))),
    CONSTRAINT ride_groups_status_check CHECK (((status)::text = ANY ((ARRAY['matched'::character varying, 'active'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: ride_histories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ride_histories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id_a uuid NOT NULL,
    user_id_b uuid NOT NULL,
    shared_ride_count integer DEFAULT 0 NOT NULL,
    last_shared_at timestamp with time zone,
    CONSTRAINT chk_history_ordered CHECK ((user_id_a < user_id_b)),
    CONSTRAINT ride_histories_shared_ride_count_check CHECK ((shared_ride_count >= 0))
);


--
-- Name: ride_match_proposals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ride_match_proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    request_a_id uuid NOT NULL,
    request_b_id uuid NOT NULL,
    response_a character varying(10) DEFAULT 'pending'::character varying NOT NULL,
    response_b character varying(10) DEFAULT 'pending'::character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_proposal_distinct CHECK ((request_a_id <> request_b_id)),
    CONSTRAINT chk_proposal_ordered CHECK ((request_a_id < request_b_id)),
    CONSTRAINT ride_match_proposals_response_a_check CHECK (((response_a)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'declined'::character varying])::text[]))),
    CONSTRAINT ride_match_proposals_response_b_check CHECK (((response_b)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'declined'::character varying])::text[])))
);


--
-- Name: ride_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ride_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    origin_location_id uuid NOT NULL,
    destination_location_id uuid NOT NULL,
    departure_time timestamp with time zone NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    ride_group_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_request_origin_dest_diff CHECK ((origin_location_id <> destination_location_id)),
    CONSTRAINT chk_ride_requests_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'proposed'::character varying, 'matched'::character varying, 'cancelled'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    filename text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: uber_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uber_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ride_group_id uuid NOT NULL,
    provider_ride_id character varying(100),
    fare_estimate numeric(8,2),
    ride_status character varying(50),
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    google_id character varying(100),
    profile_picture_url text,
    id_card_image_url text,
    gender character varying(20) DEFAULT 'unspecified'::character varying NOT NULL,
    university character varying(100) DEFAULT 'North South University'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    trust_stage character varying(20) DEFAULT 'new'::character varying NOT NULL,
    qr_token character varying(64),
    qr_token_expires_at timestamp with time zone,
    date_of_birth date,
    phone character varying(20),
    student_id character varying(20),
    profile_completed_at timestamp with time zone,
    is_admin boolean DEFAULT false NOT NULL,
    id_card_captured_at timestamp with time zone,
    CONSTRAINT chk_users_dob_sane CHECK (((date_of_birth IS NULL) OR ((date_of_birth > '1940-01-01'::date) AND (date_of_birth < CURRENT_DATE)))),
    CONSTRAINT chk_users_gender CHECK (((gender)::text = ANY ((ARRAY['male'::character varying, 'female'::character varying, 'unspecified'::character varying])::text[]))),
    CONSTRAINT chk_users_phone_format CHECK (((phone IS NULL) OR ((phone)::text ~ '^\+8801[3-9][0-9]{8}$'::text))),
    CONSTRAINT chk_users_qr_token_paired CHECK (((qr_token IS NULL) = (qr_token_expires_at IS NULL))),
    CONSTRAINT chk_users_student_id_format CHECK (((student_id IS NULL) OR ((student_id)::text ~ '^[0-9]{7,12}$'::text))),
    CONSTRAINT chk_users_trust_stage CHECK (((trust_stage)::text = ANY ((ARRAY['new'::character varying, 'verified'::character varying, 'established'::character varying])::text[])))
);


--
-- Name: COLUMN users.id_card_image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.id_card_image_url IS 'Path to the student ID card image in the private storage bucket. RETAINED as the reference photo for ride-time identity challenges (see migration 17; supersedes the transient-use note in migration 15). Obligations: private bucket only, never a public URL; serve through short-lived signed URLs; delete when the account is deleted.';


--
-- Name: COLUMN users.profile_completed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.profile_completed_at IS 'When the onboarding form was submitted. NULL means the form is unfinished. Separate from trust_stage, which tracks gender verification.';


--
-- Name: COLUMN users.id_card_captured_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.id_card_captured_at IS 'When the retained ID card image was captured. Drives retention and re-capture prompts; NULL means no card is on file.';


--
-- Name: friendships friendships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);


--
-- Name: gender_verifications gender_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gender_verifications
    ADD CONSTRAINT gender_verifications_pkey PRIMARY KEY (id);


--
-- Name: gender_verifications gender_verifications_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gender_verifications
    ADD CONSTRAINT gender_verifications_user_id_key UNIQUE (user_id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: qr_verifications qr_verifications_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_verifications
    ADD CONSTRAINT qr_verifications_code_key UNIQUE (code);


--
-- Name: qr_verifications qr_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_verifications
    ADD CONSTRAINT qr_verifications_pkey PRIMARY KEY (id);


--
-- Name: qr_verifications qr_verifications_ride_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_verifications
    ADD CONSTRAINT qr_verifications_ride_group_id_key UNIQUE (ride_group_id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: ride_feedback ride_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_feedback
    ADD CONSTRAINT ride_feedback_pkey PRIMARY KEY (id);


--
-- Name: ride_group_invites ride_group_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_group_invites
    ADD CONSTRAINT ride_group_invites_pkey PRIMARY KEY (id);


--
-- Name: ride_groups ride_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_groups
    ADD CONSTRAINT ride_groups_pkey PRIMARY KEY (id);


--
-- Name: ride_histories ride_histories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_histories
    ADD CONSTRAINT ride_histories_pkey PRIMARY KEY (id);


--
-- Name: ride_match_proposals ride_match_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_match_proposals
    ADD CONSTRAINT ride_match_proposals_pkey PRIMARY KEY (id);


--
-- Name: ride_requests ride_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_requests
    ADD CONSTRAINT ride_requests_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (filename);


--
-- Name: uber_integrations uber_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uber_integrations
    ADD CONSTRAINT uber_integrations_pkey PRIMARY KEY (id);


--
-- Name: uber_integrations uber_integrations_ride_group_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uber_integrations
    ADD CONSTRAINT uber_integrations_ride_group_id_key UNIQUE (ride_group_id);


--
-- Name: friendships uq_friend_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT uq_friend_pair UNIQUE (requester_id, addressee_id);


--
-- Name: ride_group_invites uq_group_invite; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_group_invites
    ADD CONSTRAINT uq_group_invite UNIQUE (ride_group_id, user_id);


--
-- Name: ride_histories uq_history_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_histories
    ADD CONSTRAINT uq_history_pair UNIQUE (user_id_a, user_id_b);


--
-- Name: ride_match_proposals uq_proposal_pair; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_match_proposals
    ADD CONSTRAINT uq_proposal_pair UNIQUE (request_a_id, request_b_id);


--
-- Name: ride_feedback uq_ride_feedback_once; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_feedback
    ADD CONSTRAINT uq_ride_feedback_once UNIQUE (ride_group_id, user_id);


--
-- Name: users uq_users_phone; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uq_users_phone UNIQUE (phone);


--
-- Name: users uq_users_student_id; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uq_users_student_id UNIQUE (student_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_qr_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_qr_token_key UNIQUE (qr_token);


--
-- Name: friendships_addressee_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX friendships_addressee_idx ON public.friendships USING btree (addressee_id);


--
-- Name: gender_verifications_queue_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gender_verifications_queue_idx ON public.gender_verifications USING btree (created_at) WHERE ((verification_status)::text = 'under_review'::text);


--
-- Name: gender_verifications_reviewed_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gender_verifications_reviewed_by_idx ON public.gender_verifications USING btree (reviewed_by_user_id);


--
-- Name: reports_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reports_group_idx ON public.reports USING btree (ride_group_id);


--
-- Name: reports_reported_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reports_reported_user_idx ON public.reports USING btree (reported_user_id);


--
-- Name: reports_reporter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reports_reporter_idx ON public.reports USING btree (reporter_id);


--
-- Name: ride_feedback_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ride_feedback_user_idx ON public.ride_feedback USING btree (user_id);


--
-- Name: ride_group_invites_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ride_group_invites_user_idx ON public.ride_group_invites USING btree (user_id, status);


--
-- Name: ride_groups_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ride_groups_created_by_idx ON public.ride_groups USING btree (created_by_user_id);


--
-- Name: ride_groups_destination_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ride_groups_destination_idx ON public.ride_groups USING btree (destination_location_id);


--
-- Name: ride_histories_user_b_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ride_histories_user_b_idx ON public.ride_histories USING btree (user_id_b);


--
-- Name: ride_match_proposals_a_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ride_match_proposals_a_idx ON public.ride_match_proposals USING btree (request_a_id);


--
-- Name: ride_match_proposals_b_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ride_match_proposals_b_idx ON public.ride_match_proposals USING btree (request_b_id);


--
-- Name: ride_requests_dest_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ride_requests_dest_idx ON public.ride_requests USING btree (destination_location_id);


--
-- Name: ride_requests_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ride_requests_group_idx ON public.ride_requests USING btree (ride_group_id);


--
-- Name: ride_requests_open_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ride_requests_open_idx ON public.ride_requests USING btree (destination_location_id, departure_time) WHERE ((status)::text = ANY ((ARRAY['pending'::character varying, 'proposed'::character varying])::text[]));


--
-- Name: ride_requests_origin_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ride_requests_origin_idx ON public.ride_requests USING btree (origin_location_id);


--
-- Name: ride_requests_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ride_requests_user_idx ON public.ride_requests USING btree (user_id);


--
-- Name: friendships friendships_addressee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: friendships friendships_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.friendships
    ADD CONSTRAINT friendships_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: gender_verifications gender_verifications_reviewed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gender_verifications
    ADD CONSTRAINT gender_verifications_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: gender_verifications gender_verifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gender_verifications
    ADD CONSTRAINT gender_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: qr_verifications qr_verifications_ride_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_verifications
    ADD CONSTRAINT qr_verifications_ride_group_id_fkey FOREIGN KEY (ride_group_id) REFERENCES public.ride_groups(id) ON DELETE CASCADE;


--
-- Name: reports reports_reported_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reports reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reports reports_ride_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_ride_group_id_fkey FOREIGN KEY (ride_group_id) REFERENCES public.ride_groups(id) ON DELETE SET NULL;


--
-- Name: ride_feedback ride_feedback_ride_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_feedback
    ADD CONSTRAINT ride_feedback_ride_group_id_fkey FOREIGN KEY (ride_group_id) REFERENCES public.ride_groups(id) ON DELETE CASCADE;


--
-- Name: ride_feedback ride_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_feedback
    ADD CONSTRAINT ride_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ride_group_invites ride_group_invites_ride_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_group_invites
    ADD CONSTRAINT ride_group_invites_ride_group_id_fkey FOREIGN KEY (ride_group_id) REFERENCES public.ride_groups(id) ON DELETE CASCADE;


--
-- Name: ride_group_invites ride_group_invites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_group_invites
    ADD CONSTRAINT ride_group_invites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ride_groups ride_groups_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_groups
    ADD CONSTRAINT ride_groups_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ride_groups ride_groups_destination_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_groups
    ADD CONSTRAINT ride_groups_destination_location_id_fkey FOREIGN KEY (destination_location_id) REFERENCES public.locations(id);


--
-- Name: ride_histories ride_histories_user_id_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_histories
    ADD CONSTRAINT ride_histories_user_id_a_fkey FOREIGN KEY (user_id_a) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ride_histories ride_histories_user_id_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_histories
    ADD CONSTRAINT ride_histories_user_id_b_fkey FOREIGN KEY (user_id_b) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ride_match_proposals ride_match_proposals_request_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_match_proposals
    ADD CONSTRAINT ride_match_proposals_request_a_id_fkey FOREIGN KEY (request_a_id) REFERENCES public.ride_requests(id) ON DELETE CASCADE;


--
-- Name: ride_match_proposals ride_match_proposals_request_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_match_proposals
    ADD CONSTRAINT ride_match_proposals_request_b_id_fkey FOREIGN KEY (request_b_id) REFERENCES public.ride_requests(id) ON DELETE CASCADE;


--
-- Name: ride_requests ride_requests_destination_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_requests
    ADD CONSTRAINT ride_requests_destination_location_id_fkey FOREIGN KEY (destination_location_id) REFERENCES public.locations(id);


--
-- Name: ride_requests ride_requests_origin_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_requests
    ADD CONSTRAINT ride_requests_origin_location_id_fkey FOREIGN KEY (origin_location_id) REFERENCES public.locations(id);


--
-- Name: ride_requests ride_requests_ride_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_requests
    ADD CONSTRAINT ride_requests_ride_group_id_fkey FOREIGN KEY (ride_group_id) REFERENCES public.ride_groups(id) ON DELETE SET NULL;


--
-- Name: ride_requests ride_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ride_requests
    ADD CONSTRAINT ride_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: uber_integrations uber_integrations_ride_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uber_integrations
    ADD CONSTRAINT uber_integrations_ride_group_id_fkey FOREIGN KEY (ride_group_id) REFERENCES public.ride_groups(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


