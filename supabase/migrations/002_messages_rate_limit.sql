-- =============================================================================
-- Kinofan: messages jadvalida rate limit (spam oldini olish)
-- Har bir sender_id uchun daqiqada maksimum 30 ta xabar.
-- =============================================================================

create or replace function public.check_messages_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  msg_count integer;
begin
  select count(*)
  into msg_count
  from public.messages
  where sender_id = new.sender_id
    and created_at > (now() - interval '1 minute');

  if msg_count >= 30 then
    raise exception 'Rate limit: daqiqada 30 tadan ortiq xabar yuborish mumkin emas'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_messages_rate_limit on public.messages;
create trigger trigger_messages_rate_limit
  before insert on public.messages
  for each row
  execute function public.check_messages_rate_limit();
