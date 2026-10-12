-- Kawalan tulis ikut peranan (SYSTEM_BLUEPRINT.md §8).
-- Semua staf masih boleh membaca semua data operasi; tulis hanya untuk peranan yang berkenaan.
-- Admin sentiasa dibenarkan. Matriks ini mesti selari dengan lib/permissions.js.

create or replace function has_role(variadic roles user_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and (role = 'admin' or role = any(roles)))
$$;

-- Kesan sampingan trigger (stok, log peringkat, status job order) dijalankan sebagai sistem,
-- supaya peranan yang buat tindakan asal tidak perlu akses tulis pada jadual-jadual itu.
alter function lots_after_insert() security definer set search_path = public;
alter function batch_materials_issue() security definer set search_path = public;
alter function batches_guard() security definer set search_path = public;
alter function deliveries_after_insert() security definer set search_path = public;

-- Ganti staff_all (baca + tulis) dengan staff_read + polisi tulis ikut peranan
do $$
declare t text;
begin
  foreach t in array array[
    'clients', 'suppliers', 'products', 'raw_materials', 'bom_items',
    'raw_material_lots', 'stock_movements', 'production_lines', 'job_orders',
    'production_batches', 'batch_stage_logs', 'batch_materials', 'qc_checks',
    'invoices', 'payments', 'deliveries'
  ] loop
    execute format('drop policy if exists staff_all on %I', t);
    execute format('drop policy if exists staff_read on %I', t);
    execute format('create policy staff_read on %I for select using (is_staff())', t);
  end loop;
end $$;

create policy role_write on clients            for all using (has_role('planner', 'finance')) with check (has_role('planner', 'finance'));
create policy role_write on products           for all using (has_role('planner')) with check (has_role('planner'));
create policy role_write on bom_items          for all using (has_role('planner')) with check (has_role('planner'));
create policy role_write on raw_materials      for all using (has_role('planner', 'store')) with check (has_role('planner', 'store'));
create policy role_write on suppliers          for all using (has_role('store')) with check (has_role('store'));
create policy role_write on production_lines   for all using (has_role('planner')) with check (has_role('planner'));
create policy role_write on qc_checks          for all using (has_role('qc')) with check (has_role('qc'));
create policy role_write on payments           for all using (has_role('finance')) with check (has_role('finance'));
create policy role_write on deliveries         for all using (has_role('planner', 'store')) with check (has_role('planner', 'store'));
create policy role_write on batch_materials    for all using (has_role('store', 'supervisor')) with check (has_role('store', 'supervisor'));
-- Dikemas kini oleh trigger sahaja
create policy role_write on stock_movements    for all using (has_role('admin')) with check (has_role('admin'));
create policy role_write on batch_stage_logs   for all using (has_role('admin')) with check (has_role('admin'));

-- Lot: stor terima (GRN), QC luluskan/tolak
create policy role_insert on raw_material_lots for insert with check (has_role('store'));
create policy role_update on raw_material_lots for update using (has_role('store', 'qc')) with check (has_role('store', 'qc'));
create policy role_delete on raw_material_lots for delete using (has_role('admin'));

-- Job order: perancang cipta & rancang; kewangan boleh tukar status (deposit, selesai)
create policy role_insert on job_orders for insert with check (has_role('planner'));
create policy role_update on job_orders for update using (has_role('planner', 'finance')) with check (has_role('planner', 'finance'));
create policy role_delete on job_orders for delete using (has_role('admin'));

-- Invois: kewangan urus; perancang boleh keluarkan invois deposit/baki dari halaman job order
create policy role_write on invoices  for all using (has_role('finance')) with check (has_role('finance'));
create policy role_insert on invoices for insert with check (has_role('planner'));

-- Batch: perancang cipta & rancang; penyelia/stor/QC kemas kini (peringkat dikawal oleh batches_guard)
create policy role_insert on production_batches for insert with check (has_role('planner'));
create policy role_update on production_batches for update
  using (has_role('planner', 'supervisor', 'store', 'qc')) with check (has_role('planner', 'supervisor', 'store', 'qc'));
create policy role_delete on production_batches for delete using (has_role('admin'));

-- Peringkat batch: hanya QC boleh lulus/tolak; perancang tidak boleh ubah peringkat.
-- auth.uid() null = service role / SQL Editor, dibenarkan.
create or replace function batches_stage_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stage is distinct from old.stage and auth.uid() is not null then
    if new.stage in ('released', 'rejected') and not has_role('qc') then
      raise exception 'Hanya QC boleh lulus atau tolak batch';
    elsif new.stage not in ('released', 'rejected') and not has_role('supervisor', 'store') then
      raise exception 'Hanya penyelia atau stor boleh kemas kini peringkat batch';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists a_batches_stage_role on production_batches;
-- Nama bermula "a" supaya berjalan sebelum batches_guard (trigger BEFORE ikut abjad)
create trigger a_batches_stage_role before update on production_batches
  for each row execute function batches_stage_role();
