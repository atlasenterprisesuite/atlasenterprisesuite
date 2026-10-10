do $$
declare r record;
begin
  for r in
    with missing as (
      select con.oid,
             n.nspname,
             c.relname,
             con.conname,
             array_to_string(array(
               select quote_ident(a.attname)
               from unnest(con.conkey) with ordinality k(attnum,ord)
               join pg_attribute a on a.attrelid=con.conrelid and a.attnum=k.attnum
               order by k.ord
             ), ', ') as cols,
             row_number() over(order by c.relname, con.conname) as rn
      from pg_constraint con
      join pg_class c on c.oid=con.conrelid
      join pg_namespace n on n.oid=c.relnamespace
      where con.contype='f'
        and n.nspname='public'
        and not exists (
          select 1
          from pg_index i
          where i.indrelid=con.conrelid
            and i.indisvalid
            and i.indisready
            and i.indnkeyatts >= cardinality(con.conkey)
            and (string_to_array(i.indkey::text,' ')::smallint[])[1:cardinality(con.conkey)] = con.conkey
        )
    )
    select * from missing where rn between 121 and 220
  loop
    execute format(
      'create index if not exists %I on %I.%I (%s)',
      'atlas_fk_' || substr(md5(r.oid::text || ':' || r.conname),1,20),
      r.nspname, r.relname, r.cols
    );
  end loop;
end $$;
