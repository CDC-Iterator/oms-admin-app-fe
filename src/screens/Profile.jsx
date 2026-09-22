import { useState } from "react";
import { KeyRound, UserCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { useChangePasswordMutation } from "../api/services/auth.js";
import { useAuth } from "../hooks/useAuth.js";
import { useToast } from "../hooks/useToast.js";
import { formatApiError } from "../lib/errors.js";

const FIELDS = [
  { key: "email", label: "Email" },
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "role", label: "Role" },
];

const EMPTY_PASSWORD_FORM = { current_password: "", new_password: "", confirm_password: "" };

function ChangePasswordCard() {
  const { showToast } = useToast();
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const [form, setForm] = useState(EMPTY_PASSWORD_FORM);
  const [error, setError] = useState(null);

  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    if (form.new_password !== form.confirm_password) {
      setError("New password and confirmation don't match.");
      return;
    }
    try {
      await changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
      }).unwrap();
      showToast("Password changed.");
      setForm(EMPTY_PASSWORD_FORM);
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="size-5" />
          Change password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={handleSubmit}>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="current_password">Current password</Label>
            <Input
              id="current_password"
              type="password"
              value={form.current_password}
              onChange={set("current_password")}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new_password">New password</Label>
            <Input id="new_password" type="password" value={form.new_password} onChange={set("new_password")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm_password">Confirm new password</Label>
            <Input
              id="confirm_password"
              type="password"
              value={form.confirm_password}
              onChange={set("confirm_password")}
              required
            />
          </div>
          <Button type="submit" size="sm" disabled={isLoading}>
            {isLoading ? "Saving…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// FIELDS are read-only — GET /api/auth/me/ (via AuthProvider); password is
// the one thing this screen can write, via /api/auth/change-password/.
export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <UserCircle className="size-5" />
            {user?.email || "Signed in"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
              <span className="text-xs text-muted-foreground uppercase">{f.label}</span>
              <span>{user?.[f.key] || "—"}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}
