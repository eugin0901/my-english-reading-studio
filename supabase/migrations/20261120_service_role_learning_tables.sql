grant usage on schema public to service_role;
grant select, insert, update on table public.profiles, public.terms to service_role;
grant select, insert on table public.messages, public.quizzes, public.attempts to service_role;
