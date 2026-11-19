insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Manage own MotoTrack profile photo"
on storage.objects for all to authenticated
using (bucket_id = 'profile-photos' and name = (select auth.uid())::text || '/avatar')
with check (bucket_id = 'profile-photos' and name = (select auth.uid())::text || '/avatar');
