-- Run once in a new Supabase project's SQL editor, or with supabase db push.
begin;
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 name text not null default '', timezone text not null default 'Asia/Kolkata',
 week_start integer not null default 1 check (week_start between 0 and 6),
 theme text not null default 'light' check (theme in ('light','dark','system')),
 reminders boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.habits (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('wake','study','growth','skill','meditation','custom')),
 position integer not null default 0, created_at timestamptz not null default now(),updated_at timestamptz not null default now(), unique(id,user_id)
);
create unique index default_kind_once on public.habits(user_id,kind) where kind <> 'custom';
create table public.habit_versions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 habit_id uuid not null, effective_from date not null,
 name text not null check(length(name)>0),description text not null default '',category text not null default 'Personal',icon text not null default 'spark',color text not null default 'green',
 tracking text not null check(tracking in ('checkbox','duration','count','window')),target numeric not null default 1 check(target>0),unit text not null default '',
 wake_start text not null default '06:30' check(wake_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),wake_end text not null default '07:00' check(wake_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),early_ok boolean not null default false,
 recurrence text not null default 'daily' check(recurrence in ('daily','weekdays','once')),weekdays integer[] not null default '{1,2,3,4,5}',start_date date not null,end_date date,archived boolean not null default false,reminder text not null default '',skill_rule text not null default 'session' check(skill_rule in ('session','minutes')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(habit_id,effective_from), foreign key(habit_id,user_id) references public.habits(id,user_id) on delete cascade,check(end_date is null or end_date>=start_date),check(weekdays <@ array[0,1,2,3,4,5,6])
);
create table public.daily_records (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,habit_id uuid not null,date date not null,
 value numeric not null default 0 check(value>=0),checked boolean not null default false,time text not null default '' check(time='' or time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),title text not null default '',source text not null default '',takeaway text not null default '',reflection text not null default '',notes text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(habit_id,date),foreign key(habit_id,user_id) references public.habits(id,user_id) on delete cascade
);
create table public.sessions (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('study','meditation','skill')),date date not null,timezone text not null default 'Asia/Kolkata',label text not null default '',notes text not null default '',minutes numeric not null default 0 check(minutes>=0 and minutes<=1440),
 segments jsonb not null default '[]' check(jsonb_typeof(segments)='array'),running_since timestamptz,state text not null default 'finished' check(state in ('running','paused','finished')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check((state='running')=(running_since is not null)),check(minutes=0 or (state='finished' and segments='[]'::jsonb))
);
create unique index one_active_timer on public.sessions(user_id,kind) where state <> 'finished';
create table public.tasks (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,title text not null check(length(title)>0),description text not null default '',date date not null,priority text not null default 'Medium' check(priority in ('Low','Medium','High')),category text not null default 'Personal',notes text not null default '',recurrence text not null default 'once' check(recurrence in ('once','daily','weekdays')),weekdays integer[] not null default '{1,2,3,4,5}',end_date date,completed_dates text[] not null default '{}',subtasks jsonb not null default '[]',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(end_date is null or end_date>=date),check(weekdays <@ array[0,1,2,3,4,5,6]),check(jsonb_typeof(subtasks)='array')
);
create table public.journals (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,date date not null,mood text not null default '',went_well text not null default '',learned text not null default '',improve text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,date)
);
create function public.touch_updated_at() returns trigger language plpgsql set search_path=public as $$begin new.updated_at=now();return new;end$$;
do $$declare t text;begin foreach t in array array['profiles','habits','habit_versions','daily_records','sessions','tasks','journals'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy own_rows on public.%I for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
 execute format('grant select, insert, update, delete on public.%I to authenticated',t);
 execute format('revoke all on public.%I from anon',t);
 execute format('create trigger touch before update on public.%I for each row execute function public.touch_updated_at()',t);
 if t <> 'profiles' then execute format('create index on public.%I (user_id)',t);end if;
 end loop;end$$;
create index on public.daily_records(user_id,date);
create index on public.sessions(user_id,date);
create index on public.tasks(user_id,date);
-- RPC is invoker security: every statement is subject to RLS.
create function public.initialize_workspace() returns void language plpgsql security invoker set search_path=public as $$
declare who uuid:=auth.uid(); d date; h uuid; k text; n integer:=0;
begin
 if who is null then raise exception 'Authentication required';end if;
 perform pg_advisory_xact_lock(hashtextextended(who::text,0));
 insert into profiles(user_id) values(who) on conflict do nothing;
 select (now() at time zone timezone)::date into d from profiles where user_id=who;
 foreach k in array array['wake','study','growth','skill','meditation'] loop
 if not exists(select 1 from habits where user_id=who and kind=k) then
 insert into habits(user_id,kind,position) values(who,k,n) returning id into h;
 insert into habit_versions(user_id,habit_id,effective_from,name,tracking,target,unit,start_date,icon,color,category) values
 (who,h,d,case k when 'wake' then 'Rise & shine' when 'study' then 'Deep work' when 'growth' then 'A little wiser' when 'skill' then 'Build a skill' else 'Find your calm' end,
 case k when 'wake' then 'window' when 'growth' then 'checkbox' else 'duration' end,
 case k when 'study' then 240 when 'meditation' then 30 else 1 end,case when k in ('study','skill','meditation') then 'min' else '' end,d,k,case k when 'study' then 'blue' when 'growth' then 'purple' when 'wake' then 'amber' else 'green' end,case k when 'study' then 'Learning' when 'growth' then 'Growth' when 'skill' then 'Learning' else 'Wellbeing' end);
 end if;n:=n+1;end loop;
end$$;
-- Locked, idempotent timer transitions use database time. Retrying finish cannot double count.
create function public.timer_transition(timer_id uuid,action text,timer_kind text default 'study',timer_label text default '',timer_notes text default '') returns public.sessions language plpgsql security invoker set search_path=public as $$
declare s sessions; tz text; stamp timestamptz:=clock_timestamp();
begin
 if action='start' then
 select timezone into tz from profiles where user_id=auth.uid();
 if tz is null then raise exception 'Initialize your workspace first';end if;
 insert into sessions(id,user_id,kind,date,timezone,label,notes,state,running_since) values(timer_id,auth.uid(),timer_kind,(stamp at time zone tz)::date,tz,timer_label,timer_notes,'running',stamp) on conflict(id) do nothing;
 end if;
 select * into s from sessions where id=timer_id and user_id=auth.uid() for update;
 if not found then raise exception 'Timer not found';end if;
 if action not in ('start','pause','resume','finish') then raise exception 'Unknown timer action';end if;
 if s.state='finished' then return s;end if;
 if action in ('pause','finish') and s.running_since is not null then
 s.segments:=s.segments||jsonb_build_array(jsonb_build_object('start',s.running_since,'end',stamp));s.running_since:=null;
 end if;
 if action='pause' then s.state:='paused';end if;
 if action='resume' and s.state='paused' then s.state:='running';s.running_since:=stamp;end if;
 if action='finish' then s.state:='finished';end if;
 update sessions set state=s.state,segments=s.segments,running_since=s.running_since where id=s.id returning * into s;
 return s;
end$$;
-- Enforce prospective edits even when a client calls the table API directly.
create function public.protect_habit_history() returns trigger language plpgsql security invoker set search_path=public as $$
declare d date; hid uuid;begin
 hid:=case when TG_OP='DELETE' then old.habit_id else new.habit_id end;
 select (now() at time zone timezone)::date into d from profiles where user_id=auth.uid();
 if TG_OP='DELETE' then raise exception 'Archive habits to preserve history';end if;
 if TG_OP='UPDATE' and old.effective_from<d then raise exception 'Past habit definitions are immutable; create a new effective version';end if;
 if new.effective_from<d then raise exception 'Target changes must be prospective';end if;
 if TG_OP='UPDATE' and (new.habit_id<>old.habit_id or new.user_id<>old.user_id or new.effective_from<>old.effective_from) then raise exception 'Version identity cannot change';end if;
 if exists(select 1 from habits where id=hid and kind <> 'custom' and ((kind='wake' and new.tracking<>'window') or (kind='growth' and new.tracking<>'checkbox') or (kind in ('study','skill','meditation') and new.tracking<>'duration'))) then raise exception 'Default habit tracking type is fixed';end if;
 return new;
end$$;
create trigger protect_history before insert or update or delete on public.habit_versions for each row execute function public.protect_habit_history();
-- Base habit rows cannot be deleted through clients (including cascading their history).
revoke delete on public.habits from authenticated;
revoke delete on public.habit_versions from authenticated;
revoke all on function public.initialize_workspace() from public;
revoke all on function public.timer_transition(uuid,text,text,text,text) from public;
grant execute on function public.initialize_workspace(),public.timer_transition(uuid,text,text,text,text) to authenticated;
commit;
