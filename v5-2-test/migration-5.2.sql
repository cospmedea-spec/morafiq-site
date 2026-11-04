-- Run in MoraFiq-5-Test only. Does not alter 5.1 tables or functions.
create table if not exists public.mf52_documents (
 id uuid primary key default gen_random_uuid(),
 counselor_id uuid not null references public.mf5_counselors(user_id),
 center_id uuid not null references public.mf5_centers(id),
 kind text not null check(kind in ('annual_program','monthly_program','monthly_report','annual_report')),
 period text not null,
 title text not null check(char_length(title) between 3 and 160),
 content text not null check(char_length(content) between 10 and 12000),
 status text not null default 'draft' check(status in ('draft','submitted','returned','approved')),
 manager_note text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 submitted_at timestamptz,
 reviewed_at timestamptz
);
create index if not exists mf52_doc_center_idx on public.mf52_documents(center_id,status,created_at desc);
create index if not exists mf52_doc_owner_idx on public.mf52_documents(counselor_id,created_at desc);
alter table public.mf52_documents enable row level security;
revoke all on public.mf52_documents from anon,authenticated;

create or replace function public.mf52_my_documents() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Login required'; end if;
 return coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.mf52_documents d where d.counselor_id=auth.uid()),'[]'::jsonb);
end $$;

create or replace function public.mf52_save(p_id uuid,p_kind text,p_period text,p_title text,p_content text) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; doc_id uuid;
begin
 select c.center_id into cid from public.mf5_counselors c join public.mf5_centers m on m.id=c.center_id and m.status='approved' where c.user_id=auth.uid() and c.status='approved' and c.district_id is not null;
 if cid is null then raise exception 'Counselor not assigned to approved center'; end if;
 if p_kind not in ('annual_program','monthly_program','monthly_report','annual_report') then raise exception 'Invalid kind'; end if;
 if not ((p_kind in ('annual_program','annual_report') and p_period ~ '^20[0-9]{2}$') or (p_kind in ('monthly_program','monthly_report') and p_period ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$')) then raise exception 'Invalid period'; end if;
 if char_length(trim(coalesce(p_title,''))) not between 3 and 160 or char_length(trim(coalesce(p_content,''))) not between 10 and 12000 then raise exception 'Invalid title or content length'; end if;
 if p_id is null then
  insert into public.mf52_documents(counselor_id,center_id,kind,period,title,content) values(auth.uid(),cid,p_kind,p_period,trim(p_title),trim(p_content)) returning id into doc_id;
 else
  update public.mf52_documents set kind=p_kind,period=p_period,title=trim(p_title),content=trim(p_content),status='draft',manager_note='',updated_at=now() where id=p_id and counselor_id=auth.uid() and center_id=cid and status in ('draft','returned') returning id into doc_id;
  if doc_id is null then raise exception 'Cannot edit this document'; end if;
 end if;
 return doc_id;
end $$;

create or replace function public.mf52_submit(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.mf52_documents d set status='submitted',submitted_at=now(),updated_at=now(),manager_note='' where d.id=p_id and d.counselor_id=auth.uid() and d.status in ('draft','returned') and exists(select 1 from public.mf5_counselors c join public.mf5_centers m on m.id=c.center_id where c.user_id=auth.uid() and c.status='approved' and c.center_id=d.center_id and m.status='approved');
 if not found then raise exception 'Document cannot be submitted'; end if;
end $$;

create or replace function public.mf52_center_documents() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cid uuid;
begin
 select id into cid from public.mf5_centers where manager_id=auth.uid() and status='approved';
 if cid is null then raise exception 'Center not approved'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'kind',d.kind,'period',d.period,'title',d.title,'content',d.content,'status',d.status,'manager_note',d.manager_note,'created_at',d.created_at,'counselor_name',c.full_name) order by d.created_at desc) from public.mf52_documents d join public.mf5_counselors c on c.user_id=d.counselor_id where d.center_id=cid and d.status in ('submitted','returned','approved')),'[]'::jsonb);
end $$;

create or replace function public.mf52_review(p_id uuid,p_approve boolean,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 select id into cid from public.mf5_centers where manager_id=auth.uid() and status='approved';
 if cid is null then raise exception 'Center not approved'; end if;
 if char_length(coalesce(p_note,''))>1000 then raise exception 'Note too long'; end if;
 if not p_approve and length(trim(coalesce(p_note,'')))<3 then raise exception 'A correction note is required'; end if;
 update public.mf52_documents set status=case when p_approve then 'approved' else 'returned' end,manager_note=left(trim(coalesce(p_note,'')),1000),reviewed_at=now(),updated_at=now() where id=p_id and center_id=cid and status='submitted';
 if not found then raise exception 'Document unavailable for review'; end if;
end $$;

revoke all on function public.mf52_my_documents(),public.mf52_save(uuid,text,text,text,text),public.mf52_submit(uuid),public.mf52_center_documents(),public.mf52_review(uuid,boolean,text) from public,anon;
grant execute on function public.mf52_my_documents(),public.mf52_save(uuid,text,text,text,text),public.mf52_submit(uuid),public.mf52_center_documents(),public.mf52_review(uuid,boolean,text) to authenticated;
