import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, TrendingUp, ShieldAlert, CheckCircle2,
  Clock, Loader2, AlertTriangle, RefreshCw, Gift, Ban, Eye,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS, AdminStats } from '@/lib/index';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

// ── Mock data ─────────────────────────────────────────────────
const MOCK_STATS: AdminStats = {
  totalCampaigns: 24,
  activeCampaigns: 18,
  totalDonations: 3847,
  totalRaised: 482300,
  pendingRewards: 126,
  totalUsers: 5890,
};

const MOCK_CAMPAIGNS = [
  { id: 'c1', title: 'Future Scholars',              status: 'active',    raised: 32450,  goal: 50000,  donors: 420,  flagged: false },
  { id: 'c2', title: 'Emergency Medical Support',    status: 'active',    raised: 58200,  goal: 75000,  donors: 890,  flagged: false },
  { id: 'c3', title: 'Project Canopy',               status: 'active',    raised: 12100,  goal: 25000,  donors: 156,  flagged: true  },
  { id: 'c4', title: 'Cyclone Recovery Mission',     status: 'completed', raised: 100000, goal: 100000, donors: 1240, flagged: false },
  { id: 'c5', title: 'Community Garden Initiative',  status: 'draft',     raised: 0,      goal: 8000,   donors: 0,    flagged: false },
];

const MOCK_USERS = [
  { id: 'u1', name: 'Sarah Jenkins',    email: 'sarah@example.com', role: 'donor',     donations: 8,  joined: '2025-03-12', status: 'active'    },
  { id: 'u2', name: 'Michael Rodriguez',email: 'mike@example.com',  role: 'organizer', donations: 2,  joined: '2025-05-20', status: 'active'    },
  { id: 'u3', name: 'Elena Liston',     email: 'elena@example.com', role: 'donor',     donations: 15, joined: '2025-01-08', status: 'active'    },
  { id: 'u4', name: 'Spam Account',     email: 'spam@bot.com',      role: 'donor',     donations: 0,  joined: '2026-04-01', status: 'suspended' },
];

const MOCK_REWARDS = [
  { id: 'r1', user: 'Sarah Jenkins',     campaign: 'Future Scholars',    type: 'ERC721', status: 'pending', amount: null },
  { id: 'r2', user: 'Elena Liston',      campaign: 'Cyclone Recovery',   type: 'ERC20',  status: 'pending', amount: 100  },
  { id: 'r3', user: 'Michael Rodriguez', campaign: 'Project Canopy',     type: 'badge',  status: 'minted',  amount: null },
];

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ title, value, icon: Icon, color = 'text-primary' }: {
  title: string; value: string | number; icon: React.ElementType; color?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`p-3 rounded-xl bg-muted/40 ${color}`}><Icon className="w-6 h-6" /></div>
        <div>
          <p className="text-2xl font-extrabold">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Campaign row ──────────────────────────────────────────────
function CampaignRow({ c, onAction }: { c: typeof MOCK_CAMPAIGNS[0]; onAction: (id: string, action: string) => void }) {
  const pct = Math.min(100, Math.round((c.raised / c.goal) * 100));
  const statusColor: Record<string, string> = {
    active:    'bg-emerald-100 text-emerald-700',
    completed: 'bg-blue-100 text-blue-700',
    draft:     'bg-slate-100 text-slate-600',
  };
  return (
    <tr className="border-b hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {c.flagged && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
          <span className="font-medium text-sm">{c.title}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[c.status] ?? ''}`}>{c.status}</span>
      </td>
      <td className="px-4 py-3">
        <div className="space-y-1 min-w-[100px]">
          <Progress value={pct} className="h-1.5" />
          <p className="text-xs text-muted-foreground">{pct}% · ${c.raised.toLocaleString()}</p>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-center">{c.donors}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => onAction(c.id, 'view')}><Eye className="w-3 h-3" /></Button>
          {c.status === 'active' && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onAction(c.id, 'suspend')}>
              <Ban className="w-3 h-3" />
            </Button>
          )}
          {c.status === 'draft' && (
            <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => onAction(c.id, 'approve')}>
              <CheckCircle2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState(MOCK_CAMPAIGNS);
  const [users, setUsers] = useState(MOCK_USERS);
  const [rewards, setRewards] = useState(MOCK_REWARDS);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCampaignAction = (id: string, action: string) => {
    if (action === 'approve') {
      setCampaigns((p) => p.map((c) => c.id === id ? { ...c, status: 'active' } : c));
      toast.success('Campaign approved and set to live.');
    } else if (action === 'suspend') {
      setCampaigns((p) => p.map((c) => c.id === id ? { ...c, status: 'draft', flagged: true } : c));
      toast.warning('Campaign suspended.');
    } else if (action === 'view') {
      navigate(`/campaign/${id}`);
    }
  };

  const handleMintReward = (id: string) => {
    setRewards((p) => p.map((r) => r.id === id ? { ...r, status: 'minted' } : r));
    toast.success('Reward minted and sent to the donor.');
  };

  const handleToggleUser = (id: string) => {
    setUsers((p) => p.map((u) => u.id === id ? { ...u, status: u.status === 'suspended' ? 'active' : 'suspended' } : u));
    toast.info('User status updated.');
  };

  const refresh = async () => {
    setIsRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsRefreshing(false);
    toast.success('Data refreshed.');
  };

  if (authLoading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  if (!isAuthenticated || user?.role !== 'admin') return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-destructive/10 p-6 rounded-full mb-6"><ShieldAlert className="w-16 h-16 text-destructive" /></div>
      <h2 className="text-3xl font-bold mb-4">Access denied</h2>
      <p className="text-muted-foreground max-w-md mb-8">This page is restricted to administrators only.</p>
      <Button variant="outline" onClick={() => navigate(ROUTE_PATHS.HOME)}>Back to Home</Button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <LayoutDashboard className="w-8 h-8 text-primary" /> Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">Platform monitoring · Campaign review · Reward management</p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={isRefreshing} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard title="Total campaigns"   value={MOCK_STATS.totalCampaigns}                    icon={LayoutDashboard} />
          <StatCard title="Active"            value={MOCK_STATS.activeCampaigns}                   icon={TrendingUp}      color="text-emerald-600" />
          <StatCard title="Donations"         value={MOCK_STATS.totalDonations.toLocaleString()}   icon={CheckCircle2} />
          <StatCard title="Total raised"      value={`$${(MOCK_STATS.totalRaised / 1000).toFixed(0)}K`} icon={TrendingUp} color="text-blue-600" />
          <StatCard title="Pending rewards"   value={MOCK_STATS.pendingRewards}                    icon={Gift}            color="text-amber-600" />
          <StatCard title="Registered users"  value={MOCK_STATS.totalUsers.toLocaleString()}       icon={Users} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="campaigns">
          <TabsList className="mb-6">
            <TabsTrigger value="campaigns" className="gap-2"><LayoutDashboard className="w-4 h-4" /> Campaigns</TabsTrigger>
            <TabsTrigger value="users"     className="gap-2"><Users           className="w-4 h-4" /> Users</TabsTrigger>
            <TabsTrigger value="rewards"   className="gap-2"><Gift            className="w-4 h-4" /> Rewards</TabsTrigger>
          </TabsList>

          {/* Campaigns */}
          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle>All Campaigns</CardTitle>
                <CardDescription>Review, approve, or suspend fundraising campaigns. ⚠️ flags indicate anomalies.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Campaign</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Progress</th>
                      <th className="px-4 py-3 text-center font-medium">Donors</th>
                      <th className="px-4 py-3 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <CampaignRow key={c.id} c={c} onAction={handleCampaignAction} />
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>View registered users, roles, and account status.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">User</th>
                      <th className="px-4 py-3 text-left font-medium">Role</th>
                      <th className="px-4 py-3 text-center font-medium">Donations</th>
                      <th className="px-4 py-3 text-left font-medium">Joined</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={u.role === 'organizer' ? 'default' : 'secondary'} className="text-xs">{u.role}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center">{u.donations}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{u.joined}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {u.status === 'active' ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost"
                            className={u.status === 'suspended' ? 'text-emerald-600' : 'text-destructive'}
                            onClick={() => handleToggleUser(u.id)}>
                            {u.status === 'suspended' ? <CheckCircle2 className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rewards */}
          <TabsContent value="rewards">
            <Card>
              <CardHeader>
                <CardTitle>Reward Distribution</CardTitle>
                <CardDescription>Manually trigger or inspect the on-chain mint status of donor rewards.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Donor</th>
                      <th className="px-4 py-3 text-left font-medium">Campaign</th>
                      <th className="px-4 py-3 text-left font-medium">Reward type</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rewards.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{r.user}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.campaign}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs">{r.type}</Badge>
                          {r.amount && <span className="ml-1 text-xs text-primary">{r.amount} tokens</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {r.status === 'pending' ? 'Pending' : 'Minted'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {r.status === 'pending' ? (
                            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleMintReward(r.id)}>
                              <Gift className="w-3 h-3" /> Trigger mint
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Complete
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
