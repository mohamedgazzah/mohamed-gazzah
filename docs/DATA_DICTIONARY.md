# Data dictionary

Generated from `src/db/schema.ts` by `npm run dictionary`. Do not edit by hand.

| Column | Type | Allowed values | Description |
| --- | --- | --- | --- |
| `id` | string |  | Stable, human-readable record id, e.g. US-2026-0412. Never reused. |
| `slug` | string |  | URL slug derived from the title. May change if the title changes; the id does not. |
| `title` | string (≤ 110 chars) |  | Factual headline. |
| `summary` | text |  | 2–4 neutral sentences. Markers like [1] refer to the numbered entries in `sources`. |
| `date_start` | date (YYYY-MM-DD) |  | Date the incident happened, or began. |
| `date_end` | date (YYYY-MM-DD) (nullable) |  | Last day, for multi-day events only. |
| `date_precision` | enum | `day`, `month`, `year` | How precisely the date is known. For month precision the day is shown as 01; for year, 01-01. |
| `state_fips` | string (2-digit FIPS) |  | State or territory FIPS code. |
| `state_code` | string (USPS) |  | Two-letter postal code for the state or territory. |
| `county_fips` | string (5-digit FIPS) (nullable) |  | County FIPS code, when known. |
| `city` | string (nullable) |  | City or town. Empty when only the state is known. |
| `lat` | number (nullable) |  | Latitude at the stated location precision. City-level records use the city centroid. |
| `lng` | number (nullable) |  | Longitude at the stated location precision. |
| `map_lat` | number (nullable) |  | Latitude used on the map. For city, neighborhood and state precision this includes a small random offset, stored once, so markers do not stack. Positions are approximate. |
| `map_lng` | number (nullable) |  | Longitude used on the map (see map_lat). |
| `location_precision` | enum | `exact_public_place`, `neighborhood`, `city`, `state` | How precisely the location is shown. Private homes are never shown more precisely than the neighborhood. |
| `incident_types` | enum[] | `HOM`, `ASLT`, `THRT`, `HARS`, `VAND`, `ARSN`, `DESC`, `MASS`, `PLOT`, `OFCL`, `SCHL`, `EMPL` | One or more taxonomy codes. See /methodology#taxonomy. |
| `target_type` | enum | `individual`, `multiple_individuals`, `mosque_islamic_center`, `school`, `business`, `home`, `vehicle`, `other` | What was targeted. |
| `target_attributes` | enum[] | `woman_wearing_hijab`, `child`, `student`, `religious_leader`, `arab`, `south_asian`, `black_muslim`, `perceived_muslim` | Attributes of the target, only when a source states them. |
| `severity` | integer 1–5 | `1`, `2`, `3`, `4`, `5` | 1 verbal or written, 2 property, 3 physical threat or attempt, 4 injury, 5 death. |
| `deaths` | integer (nullable) |  | Deaths. Empty when unknown; never zero by default. |
| `injuries` | integer (nullable) |  | Injuries. Empty when unknown; never zero by default. |
| `property_damage` | enum | `yes`, `no`, `unknown` | Whether a source reports property damage. |
| `perpetrator_type` | enum | `individual`, `group`, `organized_extremist_group`, `public_official`, `law_enforcement`, `unknown` | Who is alleged or found to be responsible. |
| `perpetrator_count` | integer (nullable) |  | Number of perpetrators, when a source states it. |
| `perpetrator_names` | string[] |  | Names of people charged and named by authorities or in public court records. Empty otherwise. Anyone not convicted is alleged. |
| `bias_indicators` | enum[] | `slur`, `stated_motive`, `symbol`, `target_selection`, `official_finding`, `hate_crime_charge` | Anti-Muslim elements stated by a source. The project never infers motive. |
| `verification_level` | enum | `V1`, `V2`, `V3` | V3 confirmed by authorities, V2 independently reported, V1 single-source report. Counts default to V2 and V3. |
| `legal_status` | enum | `reported`, `under_investigation`, `suspect_identified`, `arrested`, `charged`, `in_court`, `convicted`, `acquitted`, `dismissed`, `plea_deal`, `deferred`, `sentenced`, `no_arrest`, `suspect_deceased`, `not_prosecuted`, `unknown` | Current stage in the legal status lifecycle. |
| `hate_crime_charged` | enum | `yes`, `no`, `unknown` | Whether a hate-crime or bias-enhancement charge was filed. |
| `agencies_involved` | string[] |  | Police, prosecutors and other agencies named in sources. |
| `case_ids` | string[] |  | Ids of court cases tied to this incident. |
| `related_incident_ids` | string[] |  | Other records with the same perpetrator or in the same series. |
| `tags` | string[] |  | Free editorial tags, e.g. campus, election-related. |
| `source_types` | enum[] | `news`, `police`, `prosecutor`, `court_record`, `government`, `advocacy_org`, `academic`, `social_media`, `victim_statement` | Distinct types of the sources cited. |
| `source_count` | integer |  | Number of sources cited. Always at least 1. |
| `sources` | json array |  | Sources: n, outlet, title, author, url, archived_url, published_date, accessed_date, source_type, claim_attribution. |
| `legal_events` | json array |  | Dated legal events: date, event_type, description, case_id, source_n (the source that reports it). |
| `statements` | json array |  | Attributed responses: speaker, speaker_role, organization, statement_type, date, quote (≤ 25 words), paraphrase, source_n. |
| `cases` | json array |  | Court cases: id, name, court, jurisdiction, docket_number, case_type, parties, stage, next_date, courtlistener_url. |
| `change_log` | json array |  | Public change log: date, action (published, updated, unpublished), note, changed_fields, revision. |
| `methodology_version` | string |  | Inclusion-criteria version the record was published under. |
| `is_demo` | boolean |  | True only for fictional development records. Always false in production data. |
| `created_at` | datetime (UTC) |  | When the record was first drafted. |
| `published_at` | datetime (UTC) |  | When the record was first published. |
| `updated_at` | datetime (UTC) |  | When the published record last changed. |
