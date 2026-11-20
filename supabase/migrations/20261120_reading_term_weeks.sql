begin;

create table public.reading_term_weeks (
  user_id uuid not null,
  term_id uuid not null,
  book_id uuid,
  week_start date not null check (extract(dow from week_start) = 0),
  unique nulls not distinct (user_id, term_id, book_id, week_start),
  foreign key (user_id, term_id) references public.terms(user_id, id) on delete cascade,
  foreign key (user_id, book_id) references public.reading_books(user_id, id) on delete cascade
);
alter table public.reading_term_weeks enable row level security;
revoke all on public.reading_term_weeks from anon, authenticated;
grant select, insert, delete on public.reading_term_weeks to service_role;

create function public.reading_week_start(at_time timestamptz) returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select local_day - extract(dow from local_day)::integer
  from (select (at_time at time zone 'Asia/Seoul')::date as local_day) day;
$$;

insert into public.reading_term_weeks (user_id, term_id, book_id, week_start)
select term.user_id, term.id, link.book_id, public.reading_week_start(term.created_at)
from public.terms term
left join public.reading_book_terms link on link.user_id = term.user_id and link.term_id = term.id
on conflict do nothing;

create function public.save_weekly_study_turn(
  p_user_id uuid, p_book_id uuid, p_message text, p_answer text, p_terms jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_book_id is null then
    perform public.save_study_turn(p_user_id, p_message, p_answer, p_terms);
  else
    perform public.save_book_study_turn(p_user_id, p_book_id, p_message, p_answer, p_terms);
  end if;

  insert into public.reading_term_weeks (user_id, term_id, book_id, week_start)
  select p_user_id, term.id, p_book_id, public.reading_week_start(statement_timestamp())
  from public.terms term
  join jsonb_to_recordset(p_terms) as saved(expression text) on term.expression = saved.expression
  where term.user_id = p_user_id
  on conflict do nothing;
end;
$$;

create function public.assign_reading_term_book(
  p_user_id uuid, p_book_id uuid, p_term_id uuid, p_week_start date
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.terms where user_id = p_user_id and id = p_term_id)
     or not exists (select 1 from public.reading_books where user_id = p_user_id and id = p_book_id) then
    raise foreign_key_violation using message = 'Reading book or term unavailable';
  end if;

  insert into public.reading_book_terms (user_id, book_id, term_id)
  values (p_user_id, p_book_id, p_term_id)
  on conflict do nothing;

  insert into public.reading_term_weeks (user_id, term_id, book_id, week_start)
  select distinct p_user_id, p_term_id, p_book_id, weeks.week_start
  from (
    select week_start from public.reading_term_weeks where user_id = p_user_id and term_id = p_term_id
    union all
    select public.reading_week_start(term.created_at)
    from public.terms term
    where term.user_id = p_user_id and term.id = p_term_id
      and not exists (select 1 from public.reading_term_weeks where user_id = p_user_id and term_id = p_term_id)
  ) weeks
  where p_week_start is null or weeks.week_start = p_week_start
  on conflict do nothing;

  delete from public.reading_term_weeks
  where user_id = p_user_id and term_id = p_term_id and book_id is null
    and (p_week_start is null or week_start = p_week_start);
end;
$$;

revoke all on function public.reading_week_start(timestamptz),
  public.save_weekly_study_turn(uuid, uuid, text, text, jsonb),
  public.assign_reading_term_book(uuid, uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.reading_week_start(timestamptz),
  public.save_weekly_study_turn(uuid, uuid, text, text, jsonb),
  public.assign_reading_term_book(uuid, uuid, uuid, date) to service_role;

commit;
