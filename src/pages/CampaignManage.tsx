// CampaignManage.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCampaign } from '@/hooks/useCampaigns';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  Megaphone,
  Gift,
  MessageCircle,
  Settings,
  Users,
  TrendingUp,
  Send,
  ImagePlus,
  Trash2,
  Edit,
} from 'lucide-react';
import { createCampaignUpdate, cancelCampaign, getCampaignUpdates } from '@/lib/supabase';

export default function CampaignManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { campaign, isLoading, rewardTiers } = useCampaign(id ?? '');
  const [activeTab, setActiveTab] = useState('overview');
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateContent, setUpdateContent] = useState('');
  const [isPostingUpdate, setIsPostingUpdate] = useState(false);
  const [updates, setUpdates] = useState([]);

  // Load updates
  React.useEffect(() => {
    if (id) {
      getCampaignUpdates(id).then(setUpdates).catch(console.error);
    }
  }, [id]);

  // Check if user is the organizer
  const isOrganizer = campaign?.organizer.id === user?.id;

  if (!isOrganizer && !isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">You don't have permission to manage this campaign.</p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (isLoading || !campaign) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handlePostUpdate = async () => {
    if (!updateTitle.trim() || !updateContent.trim()) {
      toast.error('Please fill in both title and content');
      return;
    }
    setIsPostingUpdate(true);
    try {
      await createCampaignUpdate({
        campaign_id: id!,
        title: updateTitle,
        content: updateContent,
        author_id: user!.id,
        author_name: user!.name,
      });
      toast.success('Update posted successfully!');
      setUpdateTitle('');
      setUpdateContent('');
      // Refresh updates
      const newUpdates = await getCampaignUpdates(id!);
      setUpdates(newUpdates);
    } catch (error) {
      toast.error('Failed to post update');
    } finally {
      setIsPostingUpdate(false);
    }
  };

  const handleCancelCampaign = async () => {
    if (confirm('Are you sure you want to cancel this campaign? This action cannot be undone.')) {
      try {
        await cancelCampaign(id!);
        toast.success('Campaign cancelled');
        navigate('/dashboard');
      } catch (error) {
        toast.error('Failed to cancel campaign');
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold">Manage Campaign</h1>
        <Badge className={campaign.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
          {campaign.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-2">
              <img
                src={campaign.image}
                alt={campaign.title}
                className="w-full h-32 object-cover rounded-lg mb-3"
              />
              <p className="font-semibold text-sm line-clamp-2">{campaign.title}</p>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>RM{campaign.currentAmount.toLocaleString()} raised</span>
                <span>RM{campaign.goalAmount.toLocaleString()} goal</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Donors</span>
                <span className="font-semibold">{campaign.donorCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reward Tiers</span>
                <span className="font-semibold">{rewardTiers?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updates</span>
                <span className="font-semibold">{updates.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/20">
            <CardContent className="p-4">
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={handleCancelCampaign}
                disabled={campaign.status !== 'active'}
              >
                <Trash2 className="w-3 h-3 mr-2" />
                Cancel Campaign
              </Button>
              <p className="text-[10px] text-muted-foreground text-center mt-2">
                This will permanently close the campaign
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" className="gap-2">
                <TrendingUp className="w-4 h-4" /> Overview
              </TabsTrigger>
              <TabsTrigger value="updates" className="gap-2">
                <MessageCircle className="w-4 h-4" /> Post Update
              </TabsTrigger>
              <TabsTrigger value="rewards" className="gap-2">
                <Gift className="w-4 h-4" /> Rewards
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Performance</CardTitle>
                  <CardDescription>Track your campaign's progress and engagement</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-muted/30 rounded-lg">
                      <p className="text-2xl font-bold">{campaign.donorCount}</p>
                      <p className="text-xs text-muted-foreground">Total Donors</p>
                    </div>
                    <div className="text-center p-4 bg-muted/30 rounded-lg">
                      <p className="text-2xl font-bold">{updates.length}</p>
                      <p className="text-xs text-muted-foreground">Updates Posted</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Updates</CardTitle>
                </CardHeader>
                <CardContent>
                  {updates.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No updates yet. Post your first update!</p>
                  ) : (
                    <div className="space-y-4">
                      {updates.slice(0, 3).map((update: any) => (
                        <div key={update.id} className="border-b last:border-0 pb-3 last:pb-0">
                          <p className="font-semibold text-sm">{update.title}</p>
                          <p className="text-xs text-muted-foreground">{new Date(update.created_at).toLocaleDateString()}</p>
                          <p className="text-sm mt-1 line-clamp-2">{update.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Post Update Tab */}
            <TabsContent value="updates" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Share an Update</CardTitle>
                  <CardDescription>
                    Keep your supporters informed about campaign progress, milestones, and how their donations are making an impact.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Update Title</Label>
                    <Input
                      placeholder="e.g., We've reached 50% of our goal!"
                      value={updateTitle}
                      onChange={(e) => setUpdateTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Update Content</Label>
                    <Textarea
                      placeholder="Share the latest news, photos, or videos about your campaign..."
                      rows={6}
                      value={updateContent}
                      onChange={(e) => setUpdateContent(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Add Media (Coming Soon)</Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground">
                      <ImagePlus className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">Drag & drop images or click to upload</p>
                      <p className="text-xs">Supporters love seeing photos of the impact!</p>
                    </div>
                  </div>
                  <Button onClick={handlePostUpdate} disabled={isPostingUpdate} className="w-full">
                    {isPostingUpdate ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Publish Update
                  </Button>
                </CardContent>
              </Card>

              {/* Previous Updates */}
              {updates.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Previous Updates</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {updates.map((update: any) => (
                      <div key={update.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{update.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(update.created_at).toLocaleDateString()} at {new Date(update.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Edit className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-sm mt-2 whitespace-pre-wrap">{update.content}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Rewards Tab */}
            <TabsContent value="rewards" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Reward Tiers</CardTitle>
                  <CardDescription>Manage the rewards offered to your supporters</CardDescription>
                </CardHeader>
                <CardContent>
                  {rewardTiers && rewardTiers.length > 0 ? (
                    <div className="space-y-3">
                      {rewardTiers.map((tier: any) => (
                        <div key={tier.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold">{tier.name}</p>
                              <p className="text-sm text-muted-foreground">Minimum RM{tier.minAmount}</p>
                              <p className="text-sm mt-1">{tier.description}</p>
                            </div>
                            <Button variant="ghost" size="sm">
                              <Edit className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No reward tiers configured</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}