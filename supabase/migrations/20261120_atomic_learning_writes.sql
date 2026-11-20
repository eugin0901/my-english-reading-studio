begin;

create or replace function public.save_study_turn(
  p_user_id uuid, p_message text, p_answer text, p_terms jsonb
) returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.messages (user_id, role, content, created_at)
  values
    (p_user_id, 'user', p_message, statement_timestamp()),
    (p_user_id, 'assistant', p_answer, statement_timestamp() + interval '1 microsecond');

  insert into public.terms (user_id, expression, meaning, kind, example)
  select p_user_id, term.expression, term.meaning, term.type, term.example
  from jsonb_to_recordset(p_terms) as term(expression text, meaning text, type text, example text)
  on conflict (user_id, expression) do update
  set meaning = excluded.meaning, kind = excluded.kind, example = excluded.example;
$$;

create or replace function public.save_quiz_attempt(
  p_user_id uuid, p_quiz_id uuid, p_answers jsonb, p_score integer, p_wrong jsonb
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.attempts (user_id, quiz_id, answers, score, wrong_expressions)
  select p_user_id, q.id, p_answers, p_score, p_wrong
  from public.quizzes q
  where q.id = p_quiz_id and q.user_id = p_user_id
  on conflict (user_id, quiz_id) do nothing;

  if not found then
    return false;
  end if;

  update public.terms as term
  set wrong_count = term.wrong_count + 1
  where term.user_id = p_user_id
    and term.expression in (select jsonb_array_elements_text(p_wrong));

  return true;
end;
$$;

revoke all on function public.save_study_turn(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.save_quiz_attempt(uuid, uuid, jsonb, integer, jsonb) from public, anon, authenticated;
grant execute on function public.save_study_turn(uuid, text, text, jsonb) to service_role;
grant execute on function public.save_quiz_attempt(uuid, uuid, jsonb, integer, jsonb) to service_role;

commit;
