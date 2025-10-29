"use client";

import React, { useState } from "react";
import { Post } from "@/libs/base44";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CreatePostClient(): React.ReactElement {
    const [content, setContent] = useState("");
    const [scheduled, setScheduled] = useState<string>("");
    const [platforms, setPlatforms] = useState<string[]>(["instagram", "twitter"]);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string>("");

    const togglePlatform = (p: string) =>
        setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

    const handleSubmit = async () => {
        setSaving(true);
        setMessage("");
        try {
            await Post.create({
                content: content.trim(),
                engagement: {},
                scheduled_time: scheduled ? new Date(scheduled).toISOString() : null,
                platforms,
            });
            setMessage("Post scheduled successfully!");
            setContent("");
            setScheduled("");
        } catch {
            setMessage("Failed to schedule post");
        }
        setSaving(false);
    };

    return (
        <div className="min-h-screen p-6">
            <div className="max-w-3xl mx-auto space-y-6">
                <h1 className="text-3xl font-bold">Create & Schedule Post</h1>

                <Card>
                    <CardHeader>
                        <CardTitle>Composer</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Content</label>
                            <textarea
                                className="w-full rounded-md border p-3 min-h-28"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Write your post..."
                            />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Schedule</label>
                                <Input
                                    type="datetime-local"
                                    value={scheduled}
                                    onChange={(e) => setScheduled(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Platforms</label>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        "instagram",
                                        "twitter",
                                        "facebook",
                                        "linkedin",
                                        "youtube",
                                        "tiktok",
                                    ].map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => togglePlatform(p)}
                                            className={`px-3 py-1 rounded-full text-sm border ${platforms.includes(p)
                                                    ? "bg-linear-to-r from-pink-500 to-pink-600 text-white"
                                                    : "bg-white"
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button onClick={handleSubmit} disabled={saving || !content.trim()}>
                                {saving ? "Saving..." : "Schedule"}
                            </Button>
                            {message && <span className="text-sm text-gray-600">{message}</span>}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


