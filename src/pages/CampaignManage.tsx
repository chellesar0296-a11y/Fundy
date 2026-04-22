import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Loader2, Gift, MessageCircle, TrendingUp,
  Send, ImagePlus, Trash2, Edit, Save, Info, Clock, XCircle, CheckCircle2, Ban,
} from 'lucide-react';
import {
  createCampaignUpdate,
  getCampaignUpdates,
  updateCampaign,
  uploadMedia,
  submitCancelRequest,
  fetchMyCancelRequest,
  DbCancelRequest,
} from '@/lib/supabase';

// ── Cancel Request Dialog ─────────────────────────────────────
function CancelRequestDialog({
  open,
  onClose,
  onSubmitted,
  existingRequest,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: (req: DbCancelRequest) => void;
  existingRequest: DbCancelRequest | null;
}) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (existingRequest) {
    const statusIcon = {
      pending:  <Clock className="w-5 h-5 text-amber-500" />,
      approved: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      rejected: <XCircle className="w-5 h-5 text-destructive" />,
    }[existingRequest.status];

    const statusColor = {
      pending:  'bg-amber-100 text-amber-700',
      approved: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-red-100 text-red-700',
    }[existingRequest.status];

    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {statusIcon} Cancel Request Status
            </DialogTitle>
            <DialogDescription>Your cancel request has been submitted and is being reviewed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-sm">
            <div className="p-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Your reason</p>
              <p>{existingRequest.reason}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
                {existingRequest.status.charAt(0).toUpperCase() + existingRequest.status.slice(1)}
              </span>
            </div>
            {existingRequest.admin_note && (
              <div className="p-3 bg-muted/40 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Admin note</p>
                <p>{existingRequest.admin_note}</p>
              </div>
            )}
            {existingRequest.status === 'pending' && (
              <p className="text-xs text-muted-foreground">
                Your campaign remains active while this request is under review.
              </p>
            )}
            <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" /> Request Campaign Cancellation
          </DialogTitle>
          <DialogDescription>
            Your request will be reviewed by our admin team. Your campaign stays active until approved.
            Once cancelled, <strong>ETH donations will be refundable on-chain</strong> — FDY tokens already earned are kept by donors.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>
              Reason for cancellation <span className="text-destructive">*</span>
            </Label>
            <Textarea
              placeholder="Please explain why you want to cancel this campaign..."
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>Admin will review your request and may approve or reject it. You will be notified by email.</span>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Back
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={isSubmitting || !reason.trim()}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  onSubmitted({ reason } as any);
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              {isSubmitting
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <Send className="w-4 h-4 mr-2" />}
              Submit Request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Cancelled Banner ──────────────────────────────────────────
function CancelledBanner() {
  return (
    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
      <Ban className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
      <div>
        <p className="font-semibold">This campaign has been cancelled</p>
        <p className="mt-0.5 text-red-700">
          Editing and posting updates are disabled. ETH donations are now refundable on-chain.
        </p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function CampaignManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { campaign, isLoading, rewardTiers } = useCampaign(id ?? '');
  const [activeTab, setActiveTab] = useState('overview');

  // Update post state
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateContent, setUpdateContent] = useState('');
  const [isPostingUpdate, setIsPostingUpdate] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [updates, setUpdates] = useState<any[]>([]);

  // Edit campaign state
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editShortDesc, setEditShortDesc] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');

  // Cancel request state
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelRequest, setCancelRequest] = useState<DbCancelRequest | null>(null);
  const [loadingCancelRequest, setLoadingCancelRequest] = useState(false);

  // Load updates
  React.useEffect(() => {
    if (id) {
      getCampaignUpdates(id).then(setUpdates).catch(console.error);
    }
  }, [id]);

  // Pre-fill edit fields when campaign loads
  React.useEffect(() => {
    if (campaign) {
      setEditTitle(campaign.title);
      setEditShortDesc(campaign.shortDescription);
      setEditDesc(campaign.description);
      setEditEndDate(campaign.endDate ? campaign.endDate.split('T')[0] : '');
      setEditImageUrl(campaign.image ?? '');
    }
  }, [campaign?.id]);

  // Load existing cancel request
  React.useEffect(() => {
    if (id) {
      fetchMyCancelRequest(id)
        .then(setCancelRequest)
        .catch(() => setCancelRequest(null));
    }
  }, [id]);

  const isOrganizer = campaign?.organizer.id === user?.id;

  // ── Derived: is this campaign fully cancelled? ──────────────
  const isCancelled =
    campaign?.status === 'cancelled' || cancelRequest?.status === 'approved';

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
    if (isCancelled) return;
    if (!updateTitle.trim() || !updateContent.trim()) {
      toast.error('Please fill in both title and content');
      return;
    }
    setIsPostingUpdate(true);
    try {
      let imageUrl: string | null = null;
      if (mediaFile) {
        setIsUploadingMedia(true);
        try {
          imageUrl = await uploadMedia(mediaFile, `updates/${id}`);
        } catch {
          toast.error('Failed to upload image. Post will be saved without it.');
        } finally {
          setIsUploadingMedia(false);
        }
      }
      await createCampaignUpdate({
        campaign_id: id!,
        title: updateTitle,
        content: updateContent,
        author_id: user!.id,
        author_name: user!.name,
        image_url: imageUrl,
      });
      toast.success('Update posted successfully!');
      setUpdateTitle('');
      setUpdateContent('');
      setMediaFile(null);
      setMediaPreview(null);
      setUpdates(await getCampaignUpdates(id!));
    } catch {
      toast.error('Failed to post update');
    } finally {
      setIsPostingUpdate(false);
    }
  };

  const handleSaveCampaign = async () => {
    if (isCancelled) return;
    if (!editTitle.trim()) { toast.error('Title cannot be empty'); return; }
    setIsSaving(true);
    try {
      await updateCampaign(id!, {
        title: editTitle.trim(),
        short_description: editShortDesc.trim(),
        description: editDesc.trim(),
        end_date: editEndDate ? new Date(editEndDate).toISOString() : undefined,
        image_url: editImageUrl.trim() || null,
      });
      toast.success('Campaign updated successfully!');
      setIsEditMode(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCancelDialog = async () => {
    setLoadingCancelRequest(true);
    try {
      const req = await fetchMyCancelRequest(id!);
      setCancelRequest(req);
    } catch {
      setCancelRequest(null);
    } finally {
      setLoadingCancelRequest(false);
      setShowCancelDialog(true);
    }
  };

  const handleCancelSubmit = async (partial: DbCancelRequest) => {
    try {
      const req = await submitCancelRequest(id!, user!.id, partial.reason);
      setCancelRequest(req);
      setShowCancelDialog(false);
      toast.success('Cancel request submitted. Admin will review it shortly.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit cancel request');
    }
  };

  // Cancel request status badge
  const cancelRequestBadge = cancelRequest ? {
    pending:  <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Cancel Pending Review</Badge>,
    approved: <Badge className="bg-red-100 text-red-700 border-0 text-xs">Cancelled</Badge>,
    rejected: <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">Cancel Rejected</Badge>,
  }[cancelRequest.status] : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold">Manage Campaign</h1>
        <Badge className={
          isCancelled
            ? 'bg-red-100 text-red-700'
            : campaign.status === 'active'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-600'
        }>
          {isCancelled ? 'cancelled' : campaign.status}
        </Badge>
        {cancelRequestBadge}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card className={isCancelled ? 'opacity-75' : ''}>
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

          {/* Cancel / status card */}
          <Card className={isCancelled ? 'border-red-200 bg-red-50/40' : 'border-destructive/20'}>
            <CardContent className="p-4">
              {isCancelled ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <Ban className="w-5 h-5 text-red-500" />
                  <p className="text-xs font-semibold text-red-700">Campaign Cancelled</p>
                  <p className="text-[10px] text-red-500">
                    ETH donations are now refundable on-chain.
                  </p>
                </div>
              ) : cancelRequest?.status === 'pending' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-amber-600 border-amber-300"
                  onClick={handleOpenCancelDialog}
                >
                  <Clock className="w-3 h-3 mr-2" />
                  View Cancel Request
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={handleOpenCancelDialog}
                  disabled={campaign.status !== 'active' || loadingCancelRequest}
                >
                  {loadingCancelRequest
                    ? <Loader2 className="w-3 h-3 animate-spin mr-2" />
                    : <Trash2 className="w-3 h-3 mr-2" />}
                  Request Cancellation
                </Button>
              )}
              {!isCancelled && (
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  Cancellation requires admin approval
                </p>
              )}
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
              {isCancelled && <CancelledBanner />}

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

              <Card className={isCancelled ? 'opacity-60 pointer-events-none' : ''}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Campaign Details</CardTitle>
                    <CardDescription>
                      {isCancelled
                        ? 'Editing is disabled for cancelled campaigns'
                        : "Edit your campaign's information"}
                    </CardDescription>
                  </div>
                  {/* Hide edit controls entirely when cancelled */}
                  {!isCancelled && (
                    !isEditMode ? (
                      <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                        <Edit className="w-3 h-3 mr-2" /> Edit
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setIsEditMode(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSaveCampaign} disabled={isSaving}>
                          {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Save className="w-3 h-3 mr-2" />}
                          Save
                        </Button>
                      </div>
                    )
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Always show read-only view when cancelled, regardless of isEditMode */}
                  {(!isEditMode || isCancelled) ? (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Title</p>
                        <p className="font-medium">{campaign.title}</p>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Short Description</p>
                        <p className="text-sm">{campaign.shortDescription}</p>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">End Date</p>
                        <p className="text-sm">{new Date(campaign.endDate).toLocaleDateString()}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Campaign Title</Label>
                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Short Description</Label>
                        <Input value={editShortDesc} onChange={(e) => setEditShortDesc(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Full Description</Label>
                        <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={6} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>End Date</Label>
                          <Input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Campaign Image URL</Label>
                          <Input value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} placeholder="https://..." />
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        The goal amount and reward tiers cannot be modified after creation to protect your backers.
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Recent Updates</CardTitle></CardHeader>
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
              {isCancelled ? (
                <>
                  <CancelledBanner />
                  {/* Read-only list of past updates when cancelled */}
                  {updates.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle>Previous Updates</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        {updates.map((update: any) => (
                          <div key={update.id} className="border rounded-lg p-4">
                            <p className="font-semibold">{update.title}</p>
                            <p className="text-xs text-muted-foreground">{new Date(update.created_at).toLocaleDateString()}</p>
                            <p className="text-sm mt-2 whitespace-pre-wrap">{update.content}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Share an Update</CardTitle>
                      <CardDescription>Keep your supporters informed about campaign progress.</CardDescription>
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
                          placeholder="Share the latest news about your campaign..."
                          rows={6}
                          value={updateContent}
                          onChange={(e) => setUpdateContent(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Add Image (Optional)</Label>
                        {mediaPreview ? (
                          <div className="relative">
                            <img src={mediaPreview} alt="Preview" className="w-full h-48 object-contain rounded-lg border bg-muted/30" />
                            <button
                              type="button"
                              onClick={() => { setMediaFile(null); setMediaPreview(null); }}
                              className="absolute top-2 right-2 bg-destructive text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-destructive/80"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                            <ImagePlus className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-sm font-medium">Click to upload an image</p>
                            <p className="text-xs mt-1">JPG, PNG, GIF up to 5MB</p>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 5 * 1024 * 1024) { toast.error('File size must be under 5MB'); return; }
                                setMediaFile(file);
                                setMediaPreview(URL.createObjectURL(file));
                              }}
                            />
                          </label>
                        )}
                      </div>
                      <Button
                        onClick={handlePostUpdate}
                        disabled={isPostingUpdate || isUploadingMedia}
                        className="w-full"
                      >
                        {isUploadingMedia
                          ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Uploading image...</>
                          : isPostingUpdate
                            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Publishing...</>
                            : <><Send className="w-4 h-4 mr-2" /> Publish Update</>}
                      </Button>
                    </CardContent>
                  </Card>

                  {updates.length > 0 && (
                    <Card>
                      <CardHeader><CardTitle>Previous Updates</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        {updates.map((update: any) => (
                          <div key={update.id} className="border rounded-lg p-4">
                            <p className="font-semibold">{update.title}</p>
                            <p className="text-xs text-muted-foreground">{new Date(update.created_at).toLocaleDateString()}</p>
                            <p className="text-sm mt-2 whitespace-pre-wrap">{update.content}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* Rewards Tab — read-only, no change needed */}
            <TabsContent value="rewards" className="space-y-6">
              {isCancelled && <CancelledBanner />}
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="font-semibold">Reward tiers are locked after campaign creation</p>
                  <p className="mt-0.5 text-amber-700">Reward tiers cannot be edited once the campaign is live. Contact support to add new tiers.</p>
                </div>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Reward Tiers</CardTitle>
                  <CardDescription>Your campaign's current reward structure</CardDescription>
                </CardHeader>
                <CardContent>
                  {rewardTiers && rewardTiers.length > 0 ? (
                    <div className="space-y-3">
                      {rewardTiers.map((tier: any) => (
                        <div key={tier.id} className="border rounded-lg p-4 bg-muted/20">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold">{tier.name}</p>
                              <p className="text-sm text-muted-foreground">Minimum RM{tier.minAmount}</p>
                              <p className="text-sm mt-1">{tier.description}</p>
                            </div>
                            <Badge variant="outline" className="shrink-0">{tier.type}</Badge>
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

      {/* Cancel Request Dialog */}
      <CancelRequestDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onSubmitted={handleCancelSubmit}
        existingRequest={cancelRequest}
      />
    </div>
  );
}