-- Urus akses staf: hanya admin (melalui API route + service role) boleh ubah role.
-- Staf biasa kekal boleh membaca profil (untuk paparan nama), tetapi tidak boleh menukar role sendiri.
drop policy if exists staff_all on profiles;
create policy staff_read on profiles for select using (is_staff());
