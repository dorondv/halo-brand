"use client";

import React, { useEffect, useState } from "react";
import { SocialAccount, type SocialAccountItem } from "@/libs/base44";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Instagram, Facebook, Twitter, Youtube, Linkedin, Plus } from "lucide-react";

const platformIcon: Record<string, React.ComponentType<any>> = {
    instagram: Instagram,
    facebook: Facebook,
    twitter: Twitter,
    youtube: Youtube,
    linkedin: Linkedin,
};

export default function ConnectionsClient(): React.ReactElement {
    const [accounts, setAccounts] = useState<SocialAccountItem[]>([]);

    useEffect(() => {
        void (async () => {
            const list = await SocialAccount.list();
            setAccounts(list);
        })();
    }, []);

    return (
        <div className="min-h-screen p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold">Connections</h1>
                    <Button className="bg-linear-to-r from-pink-500 to-pink-600 text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Connect Account
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Connected Accounts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid sm:grid-cols-2 gap-4">
                            {accounts.map((acc) => {
                                const Icon = platformIcon[acc.platform] ?? Linkedin;
                                return (
                                    <div key={acc.id} className="flex items-center justify-between p-4 border rounded-xl bg-white">
                                        <div className="flex items-center gap-3">
                                            <Icon className="w-6 h-6" />
                                            <div>
                                                <p className="font-semibold">{acc.account_name}</p>
                                                <p className="text-sm text-gray-500 capitalize">{acc.platform}</p>
                                            </div>
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {acc.follower_count?.toLocaleString()} followers
                                        </div>
                                    </div>
                                );
                            })}
                            {accounts.length === 0 && (
                                <p className="text-gray-500">No accounts connected yet.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


