create table public.personal_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null check (category in ('Driving licence', 'Insurance policy', 'Other')),
  title text not null check (length(trim(title)) between 1 and 120),
  details text not null default '' check (length(details) <= 2000),
  expiry date,
  filename text,
  attachment text check (length(attachment) <= 2796300),
  created_at timestamptz not null default now(),
  check ((filename is null) = (attachment is null))
);
create index personal_documents_user_id_idx on public.personal_documents(user_id);
alter table public.personal_documents enable row level security;
revoke all on public.personal_documents from public, anon, authenticated;
grant select, insert, update, delete on public.personal_documents to authenticated;
create policy "Users manage their own personal documents"
on public.personal_documents for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
