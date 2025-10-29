"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function SupportClient(): React.ReactElement {
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [sent, setSent] = useState(false);

    return (
        <div className="min-h-screen p-6">
            <div className="max-w-3xl mx-auto space-y-6">
                <h1 className="text-3xl font-bold">Support</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>Contact support</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Subject</label>
                            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Message</label>
                            <textarea
                                className="w-full rounded-md border p-3 min-h-28"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                            />
                        </div>
                        <Button onClick={() => setSent(true)} disabled={sent || !subject.trim() || !message.trim()}>
                            {sent ? "Sent" : "Send"}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


