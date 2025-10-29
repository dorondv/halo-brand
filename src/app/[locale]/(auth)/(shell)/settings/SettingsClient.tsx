"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SettingsClient(): React.ReactElement {
    const [name, setName] = useState("Ariel");
    const [email, setEmail] = useState("user@example.com");
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    const handleSave = async () => {
        setSaving(true);
        setMessage("");
        await new Promise((r) => setTimeout(r, 700));
        setSaving(false);
        setMessage("Saved");
    };

    return (
        <div className="min-h-screen p-6">
            <div className="max-w-3xl mx-auto space-y-6">
                <h1 className="text-3xl font-bold">Settings</h1>

                <Card>
                    <CardHeader>
                        <CardTitle>Profile</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Full name</label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Email</label>
                            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
                        {message && <span className="text-sm text-gray-600 ml-2">{message}</span>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Notifications</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-gray-600">
                        <p>Email notifications: enabled</p>
                        <p>Weekly summary: enabled</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


