"use client";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { AuthGate } from "@/components/auth/auth-gate";
import { PageHeader } from "@/components/ui";

export default function ProfilePage() {
  return (
    <AuthGate>
      {(userId) => (
        <div>
          <PageHeader title="Your profile">
            How you show up — anonymous by default, revealed only on your terms.
          </PageHeader>
          <ProfileEditor userId={userId} />
        </div>
      )}
    </AuthGate>
  );
}
