import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowLeft,
  FileText,
  User,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  submitVerificationRequest,
  fetchUserVerificationRequest,
  DbVerificationRequest,
} from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    label: 'Under Review',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    desc: 'Your verification request has been submitted and is being reviewed by our team. This usually takes 1–3 business days.',
  },
  approved: {
    icon: CheckCircle2,
    label: 'Verified',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    desc: 'Congratulations! Your identity has been verified. A verified badge is now shown on your profile and campaigns.',
  },
  rejected: {
    icon: XCircle,
    label: 'Not Approved',
    color: 'bg-red-100 text-red-700 border-red-200',
    desc: 'Your verification request was not approved. Please check the admin note below and resubmit with the correct documents.',
  },
};

export default function VerificationRequest() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const [existingRequest, setExistingRequest] = useState<DbVerificationRequest | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [idType, setIdType] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!user) return;
    setFullName(user.name ?? '');
    fetchUserVerificationRequest(user.id)
      .then(setExistingRequest)
      .catch(() => setExistingRequest(null))
      .finally(() => setIsFetching(false));
  }, [user?.id]);

  if (!isAuthenticated && !isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <ShieldCheck className="w-16 h-16 text-primary mb-4 opacity-30" />
        <h2 className="text-2xl font-bold mb-2">Sign in Required</h2>
        <p className="text-muted-foreground mb-6">Please log in to apply for verification.</p>
        <Button onClick={() => navigate('/login')}>Log In</Button>
      </div>
    );
  }

  if (isFetching) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!user) return;
    if (!fullName.trim() || !idType || !idNumber.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }
    setIsSubmitting(true);
    try {
      const req = await submitVerificationRequest({
        user_id: user.id,
        full_name: fullName.trim(),
        id_type: idType,
        id_number: idNumber.trim(),
        document_url: documentUrl.trim() || null,
        selfie_url: selfieUrl.trim() || null,
        notes: notes.trim() || null,
      });
      setExistingRequest(req);
      toast.success('Verification request submitted! We will review it within 1–3 business days.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show status if request exists (and not rejected — allow resubmit)
  if (existingRequest && existingRequest.status !== 'rejected') {
    const cfg = STATUS_CONFIG[existingRequest.status];
    const Icon = cfg.icon;
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className={`border-2 ${cfg.color.includes('emerald') ? 'border-emerald-200' : cfg.color.includes('amber') ? 'border-amber-200' : 'border-red-200'}`}>
            <CardContent className="p-8 text-center">
              <div className={`inline-flex p-4 rounded-full mb-4 ${cfg.color}`}>
                <Icon className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold mb-2">
                <Badge className={`text-base px-4 py-1 ${cfg.color}`}>{cfg.label}</Badge>
              </h2>
              <p className="text-muted-foreground mt-4 leading-relaxed">{cfg.desc}</p>

              {existingRequest.admin_note && (
                <div className="mt-6 p-4 bg-muted/50 rounded-lg text-left">
                  <p className="text-sm font-semibold mb-1">Note from Admin:</p>
                  <p className="text-sm text-muted-foreground">{existingRequest.admin_note}</p>
                </div>
              )}

              <Separator className="my-6" />

              <div className="text-left space-y-2 text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">Submitted:</span> {new Date(existingRequest.created_at).toLocaleDateString()}</p>
                <p><span className="font-medium text-foreground">Name submitted:</span> {existingRequest.full_name}</p>
                <p><span className="font-medium text-foreground">ID type:</span> {existingRequest.id_type}</p>
              </div>

              <Button className="mt-6" variant="outline" onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-4 bg-primary/10 rounded-full">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-extrabold">Get Verified</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Verified organizers display a badge on their profile and campaigns, building donor trust and increasing fundraising success.
          </p>
        </div>

        {/* Benefits */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center text-sm">
            {[
              { icon: ShieldCheck, label: 'Verified Badge', desc: 'Shown on your profile & campaigns' },
              { icon: User, label: 'More Trust', desc: 'Donors feel safer contributing' },
              { icon: FileText, label: 'Priority Support', desc: 'Faster review for your campaigns' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <Icon className="w-5 h-5 text-primary mb-1" />
                <p className="font-semibold">{label}</p>
                <p className="text-muted-foreground text-xs">{desc}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {existingRequest?.status === 'rejected' && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Previous request was not approved</p>
              {existingRequest.admin_note && (
                <p className="mt-1 text-red-600">Admin note: {existingRequest.admin_note}</p>
              )}
              <p className="mt-1">Please resubmit with the correct information or documents below.</p>
            </div>
          </div>
        )}

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Identity Verification Form</CardTitle>
            <CardDescription>All information is kept confidential and used only for verification purposes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Full Legal Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="As shown on your ID document"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ID Type <span className="text-destructive">*</span></Label>
                <Select value={idType} onValueChange={setIdType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ID type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MyKad">MyKad (Malaysian IC)</SelectItem>
                    <SelectItem value="Passport">Passport</SelectItem>
                    <SelectItem value="SSM">SSM (Business Registration)</SelectItem>
                    <SelectItem value="Other">Other Government ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ID Number <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g. 900101-14-1234"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="text-sm font-semibold">Document Upload</p>
              <p className="text-xs text-muted-foreground mb-3">
                Upload a clear photo of your ID document. Accepted: JPG, PNG, PDF. Max 5MB.
                <br />For now, please paste a publicly accessible URL (Supabase Storage integration coming soon).
              </p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Upload className="w-4 h-4" /> ID Document URL
                  </Label>
                  <Input
                    placeholder="https://... (link to your document image)"
                    value={documentUrl}
                    onChange={(e) => setDocumentUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User className="w-4 h-4" /> Selfie with ID (URL)
                  </Label>
                  <Input
                    placeholder="https://... (photo of you holding the ID)"
                    value={selfieUrl}
                    onChange={(e) => setSelfieUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Additional Notes (Optional)</Label>
              <Textarea
                placeholder="e.g. I am applying as a registered NGO. Our SSM number is..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              By submitting, you confirm that all information provided is accurate and that you authorise Fundy to verify your identity. Your data is handled in accordance with our Privacy Policy.
            </p>

            <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting...</span>
              ) : (
                <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Submit Verification Request</span>
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
