alter function public.reverse_posted_journal_entry(uuid, uuid, text, date, text)
  security invoker;

revoke all on function public.reverse_posted_journal_entry(uuid, uuid, text, date, text) from public;
revoke all on function public.reverse_posted_journal_entry(uuid, uuid, text, date, text) from anon;
grant execute on function public.reverse_posted_journal_entry(uuid, uuid, text, date, text) to authenticated;
grant execute on function public.reverse_posted_journal_entry(uuid, uuid, text, date, text) to service_role;
