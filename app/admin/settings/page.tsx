'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { Settings, Bell, Shield, Database, CheckCircle } from 'lucide-react';
import {
  getTimeoutConfig, saveTimeoutConfig, clearTimeoutConfig,
  DEFAULT_TIMEOUT_MINUTES, MINIMUM_TIMEOUT_MINUTES,
} from '@/lib/session-timeout';

export default function SettingsPage() {
  // Security state
  const [timeoutEnabled, setTimeoutEnabled] = useState(true);
  const [timeoutMinutes, setTimeoutMinutes] = useState(DEFAULT_TIMEOUT_MINUTES);
  const [securitySaved, setSecuritySaved] = useState(false);

  useEffect(() => {
    const config = getTimeoutConfig();
    // getTimeoutConfig already clamps to MINIMUM_TIMEOUT_MINUTES,
    // so if the stored value was below the floor (e.g. "2") it returns
    // DEFAULT_TIMEOUT_MINUTES here and the bad entry is silently replaced
    // the next time the user saves.
    setTimeoutEnabled(config.enabled);
    setTimeoutMinutes(config.minutes);
  }, []);

  const handleSaveSecurity = () => {
    const minutes = Math.max(MINIMUM_TIMEOUT_MINUTES, timeoutMinutes || DEFAULT_TIMEOUT_MINUTES);
    setTimeoutMinutes(minutes);
    saveTimeoutConfig(timeoutEnabled, minutes);
    setSecuritySaved(true);
    setTimeout(() => setSecuritySaved(false), 2500);
  };

  const handleResetTimeout = () => {
    clearTimeoutConfig();
    setTimeoutEnabled(true);
    setTimeoutMinutes(DEFAULT_TIMEOUT_MINUTES);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
        <p className="text-muted-foreground">Configure system-wide settings and preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              General Settings
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Basic system configuration options.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldGroup>
              <Field>
                <FieldLabel>System Name</FieldLabel>
                <Input defaultValue="Rakel Investments DBMS" className="bg-input border-border" />
              </Field>
              <Field>
                <FieldLabel>Admin Email</FieldLabel>
                <Input type="email" defaultValue="admin@rakelinvestments.com" className="bg-input border-border" />
              </Field>
              <Field>
                <FieldLabel>Support Contact</FieldLabel>
                <Input defaultValue="+1 (555) 123-4567" className="bg-input border-border" />
              </Field>
            </FieldGroup>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Configure notification preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Email Notifications', desc: 'Receive email alerts for system events', defaultOn: true },
              { label: 'Login Alerts', desc: 'Get notified on new user logins', defaultOn: true },
              { label: 'Data Upload Alerts', desc: 'Notifications for data uploads', defaultOn: false },
              { label: 'Weekly Reports', desc: 'Receive weekly analytics summary', defaultOn: true },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Switch defaultChecked={item.defaultOn} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Security
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Security and access control settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">Require 2FA for all users</p>
              </div>
              <Switch />
            </div>

            {/* Session Timeout toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium text-foreground">Session Timeout</p>
                <p className="text-xs text-muted-foreground">
                  Auto-logout users after inactivity
                </p>
              </div>
              <Switch
                checked={timeoutEnabled}
                onCheckedChange={setTimeoutEnabled}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium text-foreground">IP Whitelisting</p>
                <p className="text-xs text-muted-foreground">Restrict access by IP address</p>
              </div>
              <Switch />
            </div>

            {/* Session duration input — always visible, disabled when timeout is off */}
            <FieldGroup>
              <Field>
                <FieldLabel>
                  Session Duration (minutes)
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    default: {DEFAULT_TIMEOUT_MINUTES} min &mdash; min: {MINIMUM_TIMEOUT_MINUTES} min
                  </span>
                </FieldLabel>
                <Input
                  type="number"
                  min={MINIMUM_TIMEOUT_MINUTES}
                  max={480}
                  value={timeoutMinutes}
                  disabled={!timeoutEnabled}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10);
                    setTimeoutMinutes(isNaN(v) ? DEFAULT_TIMEOUT_MINUTES : v);
                  }}
                  className="bg-input border-border disabled:opacity-50"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {timeoutEnabled
                    ? `Users will be warned 2 minutes before the ${timeoutMinutes}-minute limit and logged out automatically.`
                    : 'Enable session timeout to configure the duration.'}
                </p>
              </Field>
            </FieldGroup>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-border text-foreground hover:bg-muted"
                onClick={handleResetTimeout}
                title={`Clear stored override — restores ${DEFAULT_TIMEOUT_MINUTES}-minute default`}
              >
                Reset to Default
              </Button>
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                onClick={handleSaveSecurity}
              >
                {securitySaved ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Saved
                  </>
                ) : (
                  'Save Security Settings'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Database */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Database
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Database configuration and maintenance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Database Status</span>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Backup</span>
                <span className="text-sm text-foreground">Today, 03:00 AM</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Storage Used</span>
                <span className="text-sm text-foreground">2.4 GB / 10 GB</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-border text-foreground hover:bg-muted">
                Backup Now
              </Button>
              <Button variant="outline" className="flex-1 border-border text-foreground hover:bg-muted">
                Optimize
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
