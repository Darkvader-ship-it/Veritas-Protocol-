'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, User, Twitter, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProfileSetupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileSetup({ isOpen, onClose }: ProfileSetupProps) {
  const { address } = useAccount();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [twitter, setTwitter] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load existing profile when modal opens
  useEffect(() => {
    if (isOpen && address) {
      loadProfile();
    }
  }, [isOpen, address]);

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const res = await fetch(`/api/user/profile?address=${address}`);
      const data = await res.json();

      if (data.success && data.profile) {
        setEmail(data.profile.email || '');
        setUsername(data.profile.username || '');
        setTwitter(data.profile.twitter_username || '');
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!address) {
      setError('Please connect your wallet first');
      return;
    }

    // Validate email if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          email: email || null,
          username: username || null,
          twitter: twitter || null,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to update profile');
        return;
      }

      setSuccess(true);
      toast({
        title: "Profile Updated! 🎉",
        description: "Your profile information has been saved successfully.",
      });

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Profile update error:', err);
      setError(err.message || 'Failed to update profile');
      toast({
        title: "Update Failed",
        description: err.message || 'Failed to update profile',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
          <DialogDescription>
            Add your contact information to help others find and connect with you.
          </DialogDescription>
        </DialogHeader>

        {loadingProfile ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email (Optional)
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Receive notifications about your predictions and trades
              </p>
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Display Name (Optional)
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="YourUsername"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">
                How you'll appear on leaderboards
              </p>
            </div>

            {/* Twitter */}
            <div className="space-y-2">
              <Label htmlFor="twitter" className="flex items-center gap-2">
                <Twitter className="h-4 w-4 text-muted-foreground" />
                Twitter Username (Optional)
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">@</span>
                <Input
                  id="twitter"
                  type="text"
                  placeholder="username"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value.replace('@', ''))}
                  disabled={loading}
                  maxLength={15}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Let others find you on social media
              </p>
            </div>

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Success */}
            {success && (
              <Alert className="border-success bg-success/10">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertDescription className="text-success">
                  Profile updated successfully!
                </AlertDescription>
              </Alert>
            )}

            {/* Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="flex-1"
              >
                Skip
              </Button>
              <Button
                type="submit"
                disabled={loading || success}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Profile'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
