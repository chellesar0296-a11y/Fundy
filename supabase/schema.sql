-- ============================================================
-- Fundy Fundraising Platform - Supabase Schema
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  email text not null,
  avatar_url text,
  bio text,
  role text not null default 'donor' check (role in ('admin', 'donor', 'organizer')),
  wallet_address text,
  is_verified boolean default false,
  verification_status text default 'none' check (verification_status in ('none', 'pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || new.email
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- CAMPAIGNS
-- ============================================================
create table if not exists public.campaigns (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  slug text not null unique,
  description text not null,
  short_description text not null,
  category text not null check (category in ('Medical', 'Education', 'Environment', 'Disaster', 'Community', 'Personal', 'Creative', 'Technology', 'Business', 'Animals', 'Sports')),
  goal_amount numeric(12,2) not null,
  current_amount numeric(12,2) default 0,
  donor_count integer default 0,
  image_url text,
  end_date timestamptz not null,
  organizer_id uuid references public.profiles(id) on delete cascade,
  status text default 'active' check (status in ('active', 'completed', 'draft', 'cancelled')),
  on_chain_id integer,
  updated_at timestamptz,
  created_at timestamptz default now()
);

alter table public.campaigns enable row level security;

create policy "Campaigns are viewable by everyone"
  on public.campaigns for select using (true);

create policy "Organizers can create campaigns"
  on public.campaigns for insert with check (auth.uid() = organizer_id);

create policy "Organizers can update their own campaigns"
  on public.campaigns for update using (auth.uid() = organizer_id);

create policy "Admins can update any campaign"
  on public.campaigns for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- DONATIONS
-- ============================================================
create table if not exists public.donations (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  donor_id uuid references public.profiles(id) on delete set null,
  donor_name text not null,
  amount numeric(10,2) not null check (amount > 0),
  message text,
  is_anonymous boolean default false,
  tx_hash text,
  donation_type text default 'eth' check (donation_type in ('eth', 'fdy')),
  created_at timestamptz default now()
);

alter table public.donations enable row level security;

create policy "Donations are viewable by everyone"
  on public.donations for select using (true);

create policy "Authenticated users can donate"
  on public.donations for insert with check (auth.uid() = donor_id or donor_id is null);

-- Auto-update campaign totals when donation is made
create or replace function public.handle_new_donation()
returns trigger as $$
begin
  update public.campaigns
  set
    current_amount = current_amount + new.amount,
    donor_count = donor_count + 1
  where id = new.campaign_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_donation_created on public.donations;
create trigger on_donation_created
  after insert on public.donations
  for each row execute procedure public.handle_new_donation();

-- ============================================================
-- REWARDS (Token/NFT reward tracking)
-- ============================================================
create table if not exists public.rewards (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  donor_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('ERC20', 'ERC721', 'badge')),
  name text not null,
  description text,
  image_url text,
  token_amount numeric,
  token_id text,
  contract_address text,
  tx_hash text,
  status text not null default 'pending' check (status in ('pending', 'minted', 'claimed', 'failed')),
  minted_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.rewards enable row level security;

create policy "Rewards viewable by owner or admin"
  on public.rewards for select
  using (auth.uid() = donor_id or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Only backend/admin can insert rewards"
  on public.rewards for insert
  with check (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Only backend/admin can update rewards"
  on public.rewards for update
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- ============================================================
-- REWARD TIERS
-- ============================================================
create table if not exists public.reward_tiers (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  min_amount numeric(10,2) not null check (min_amount > 0),
  type text not null check (type in ('ERC20', 'ERC721', 'badge')),
  name text not null,
  description text,
  quantity integer,
  token_amount numeric,
  is_physical boolean default false,
  created_at timestamptz default now()
);

alter table public.reward_tiers enable row level security;

create policy "Reward tiers viewable by everyone"
  on public.reward_tiers for select using (true);

create policy "Organizers can manage their campaign reward tiers"
  on public.reward_tiers for all
  using (exists (
    select 1 from public.campaigns c
    where c.id = campaign_id and c.organizer_id = auth.uid()
  ));

-- ============================================================
-- CAMPAIGN UPDATES
-- ============================================================
create table if not exists public.campaign_updates (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  title text not null,
  content text not null,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  image_url text,
  created_at timestamptz default now()
);

alter table public.campaign_updates enable row level security;

create policy "Campaign updates are viewable by everyone"
  on public.campaign_updates for select using (true);

create policy "Organizers can post updates to their campaigns"
  on public.campaign_updates for insert with check (
    auth.uid() = author_id and exists (
      select 1 from public.campaigns c
      where c.id = campaign_id and c.organizer_id = auth.uid()
    )
  );

-- ============================================================
-- VERIFICATION REQUESTS
-- ============================================================
create table if not exists public.verification_requests (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  full_name text not null,
  id_type text not null,
  id_number text not null,
  document_url text,
  selfie_url text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz default now(),
  updated_at timestamptz
);

alter table public.verification_requests enable row level security;

create policy "Users can view their own verification requests"
  on public.verification_requests for select
  using (auth.uid() = user_id or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Users can submit verification requests"
  on public.verification_requests for insert
  with check (auth.uid() = user_id);

create policy "Admins can update verification requests"
  on public.verification_requests for update
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- ============================================================
-- REPORTS
-- ============================================================
create table if not exists public.reports (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason_type text not null check (reason_type in ('spam', 'fraud', 'inappropriate', 'other')),
  reason_detail text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz default now()
);

alter table public.reports enable row level security;

create policy "Reports viewable by admins"
  on public.reports for select
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "Authenticated users can submit reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id or reporter_id is null);

create policy "Admins can update reports"
  on public.reports for update
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- ============================================================
-- CANCEL REQUESTS
-- Organizer submits reason → admin approves or rejects.
-- Approval: admin sets campaign status = 'cancelled' + calls cancelCampaign on-chain.
-- Rejection: campaign stays active.
-- NOTE: FDY tokens are NOT refunded on cancel — only ETH donations are refundable on-chain.
-- ============================================================
create table if not exists public.cancel_requests (
  id uuid default uuid_generate_v4() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  organizer_id uuid references public.profiles(id) on delete cascade not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz
);

alter table public.cancel_requests enable row level security;

create policy "Cancel requests viewable by organizer or admin"
  on public.cancel_requests for select
  using (
    auth.uid() = organizer_id or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Organizers can submit cancel requests for their active campaigns"
  on public.cancel_requests for insert
  with check (
    auth.uid() = organizer_id and
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_id
        and c.organizer_id = auth.uid()
        and c.status = 'active'
    )
  );

create policy "Admins can update cancel requests"
  on public.cancel_requests for update
  using (exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

-- ============================================================
-- handle_donation_reward — use campaign's reward_tiers
-- ============================================================
create or replace function public.handle_donation_reward()
returns trigger as $$
declare
  v_tier record;
begin
  if new.donor_id is null then return new; end if;

  select * into v_tier
  from public.reward_tiers
  where campaign_id = new.campaign_id
    and min_amount <= new.amount
  order by min_amount desc
  limit 1;

  if found then
    insert into public.rewards (campaign_id, donor_id, type, name, description, token_amount, status)
    values (
      new.campaign_id, new.donor_id,
      v_tier.type, v_tier.name,
      coalesce(v_tier.description, 'Thank you for your contribution!'),
      v_tier.token_amount,
      case when v_tier.type = 'badge' then 'minted' else 'pending' end
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_donation_reward on public.donations;
create trigger on_donation_reward
  after insert on public.donations
  for each row execute procedure public.handle_donation_reward();

-- ============================================================
-- CREDIT SCORES view
-- ============================================================
create or replace view public.donor_credit_scores as
select
  p.id,
  p.name,
  coalesce(sum(d.amount), 0)::numeric as total_donated,
  count(distinct d.id)::int as donation_count,
  count(distinct d.campaign_id)::int as campaigns_supported,
  least(1000, (coalesce(sum(d.amount), 0) * 2 + count(distinct d.campaign_id) * 50))::int as credit_score
from public.profiles p
left join public.donations d on d.donor_id = p.id
group by p.id, p.name;

-- ============================================================
-- SEED DATA - Sample Campaigns
-- ============================================================
insert into public.campaigns (title, slug, description, short_description, category, goal_amount, current_amount, donor_count, image_url, end_date, status)
values
(
  'Future Scholars: Universal Education Initiative',
  'future-scholars-education',
  'The Future Scholars initiative aims to break the cycle of poverty by providing quality education to children in remote areas. Your contribution helps us build classrooms, provide books, and support teachers who are making a difference in the lives of thousands of students. We believe that education is a fundamental human right, not a privilege.',
  'Providing essential learning materials and scholarships to underprivileged children worldwide.',
  'Education', 50000, 32450, 420,
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=800',
  '2026-12-31T23:59:59Z', 'active'
),
(
  'Emergency Medical Support for Pediatric Care',
  'emergency-medical-support',
  'Every second counts in medical emergencies. This campaign focuses on providing immediate financial support for complex pediatric surgeries that families otherwise could not afford. We work directly with specialized hospitals to ensure 100% of your donation goes to medical costs, saving lives one child at a time.',
  'Funding critical surgeries and medical equipment for children in urgent need.',
  'Medical', 75000, 58200, 890,
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=800',
  '2026-06-15T23:59:59Z', 'active'
),
(
  'Project Canopy: Restoring Global Rainforests',
  'project-canopy-reforestation',
  'Climate change is the challenge of our generation. Project Canopy is dedicated to restoring vital ecosystems by planting native tree species in deforested regions. Beyond planting, we employ local communities to monitor and protect these new forests for years to come.',
  'A massive reforestation project aiming to plant 1 million trees by the end of 2026.',
  'Environment', 25000, 12100, 156,
  'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&q=80&w=800',
  '2026-11-20T23:59:59Z', 'active'
),
(
  'Rapid Response: Cyclone Recovery Mission',
  'cyclone-recovery-mission',
  'The recent cyclone has left thousands without shelter or clean water. Our rapid response team is on the ground providing food kits, medical supplies, and temporary housing. This fund is dedicated to the long-term rebuilding of the community infrastructure.',
  'Immediate aid for families displaced by recent extreme weather events.',
  'Disaster', 100000, 88900, 1240,
  'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&q=80&w=800',
  '2026-04-30T23:59:59Z', 'active'
)
on conflict (slug) do nothing;

-- ============================================================
-- SEED DATA - Sample Reward Tiers
-- ============================================================
insert into public.reward_tiers (campaign_id, min_amount, type, name, description, token_amount)
select id, 10,  'badge',  'Scholar Supporter Badge', 'Digital badge for supporting education.', null        from public.campaigns where slug = 'future-scholars-education'
union all
select id, 25,  'ERC20',  'FUNDY Token Reward',      '50 FUNDY tokens for your generous donation.', 50      from public.campaigns where slug = 'future-scholars-education'
union all
select id, 100, 'ERC721', 'Scholar Hall of Fame NFT','Rare NFT: your name in the Fundy Hall of Fame.', null from public.campaigns where slug = 'future-scholars-education'
on conflict do nothing;

insert into public.reward_tiers (campaign_id, min_amount, type, name, description, token_amount)
select id, 10,  'badge',  'Lifesaver Badge',    'Badge awarded for supporting pediatric care.', null  from public.campaigns where slug = 'emergency-medical-support'
union all
select id, 50,  'ERC20',  'FUNDY Token Reward', '100 FUNDY tokens — thank you!', 100                  from public.campaigns where slug = 'emergency-medical-support'
union all
select id, 200, 'ERC721', 'Angel Donor NFT',    'Limited edition NFT for high-impact donors.', null   from public.campaigns where slug = 'emergency-medical-support'
on conflict do nothing;

insert into public.reward_tiers (campaign_id, min_amount, type, name, description, token_amount)
select id, 5,   'badge',  'Tree Planter Badge',  'You helped plant trees in the Amazon!', null        from public.campaigns where slug = 'project-canopy-reforestation'
union all
select id, 30,  'ERC20',  'FUNDY Token Reward',  '60 FUNDY tokens for going green.', 60               from public.campaigns where slug = 'project-canopy-reforestation'
union all
select id, 150, 'ERC721', 'Forest Guardian NFT', 'Exclusive NFT for top environment supporters.', null from public.campaigns where slug = 'project-canopy-reforestation'
on conflict do nothing;

insert into public.reward_tiers (campaign_id, min_amount, type, name, description, token_amount)
select id, 10,  'badge',  'First Responder Badge', 'Badge for rapid disaster relief support.', null   from public.campaigns where slug = 'cyclone-recovery-mission'
union all
select id, 25,  'ERC20',  'FUNDY Token Reward',    '50 FUNDY tokens for emergency donors.', 50        from public.campaigns where slug = 'cyclone-recovery-mission'
union all
select id, 100, 'ERC721', 'Hero Donor NFT',        'NFT commemorating your heroic contribution.', null from public.campaigns where slug = 'cyclone-recovery-mission'
on conflict do nothing;
