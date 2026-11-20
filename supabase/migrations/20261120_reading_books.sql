begin;

create table public.reading_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  unique (user_id, id)
);
create unique index reading_books_user_title on public.reading_books (user_id, lower(title));

alter table public.terms add constraint terms_owner_id_unique unique (user_id, id);
create table public.reading_book_terms (
  user_id uuid not null,
  book_id uuid not null,
  term_id uuid not null,
  primary key (user_id, book_id, term_id),
  foreign key (user_id, book_id) references public.reading_books(user_id, id) on delete cascade,
  foreign key (user_id, term_id) references public.terms(user_id, id) on delete cascade
);
create index reading_book_terms_owner_term on public.reading_book_terms (user_id, term_id);

alter table public.reading_books enable row level security;
alter table public.reading_book_terms enable row level security;
revoke all on public.reading_books, public.reading_book_terms from anon, authenticated;
grant select, insert on public.reading_books, public.reading_book_terms to service_role;

create function public.save_book_study_turn(
  p_user_id uuid, p_book_id uuid, p_message text, p_answer text, p_terms jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.reading_books where user_id = p_user_id and id = p_book_id) then
    raise foreign_key_violation using message = 'Reading book unavailable';
  end if;
  perform public.save_study_turn(p_user_id, p_message, p_answer, p_terms);
  insert into public.reading_book_terms (user_id, book_id, term_id)
  select p_user_id, p_book_id, term.id
  from public.terms term
  join jsonb_to_recordset(p_terms) as saved(expression text)
    on term.expression = saved.expression
  where term.user_id = p_user_id
  on conflict do nothing;
end;
$$;

revoke all on function public.save_book_study_turn(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_book_study_turn(uuid, uuid, text, text, jsonb) to service_role;

commit;
