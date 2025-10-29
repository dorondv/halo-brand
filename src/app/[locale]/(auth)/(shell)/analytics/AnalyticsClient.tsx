"use client";

import React, { useEffect, useState } from "react";
import { AnalyticsEntity, Post, SocialAccount, type PostItem, type SocialAccountItem } from "@/libs/base44";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Users, Eye, MousePointer } from "lucide-react";
import { motion } from "framer-motion";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";

export default function AnalyticsClient(): React.ReactElement {
    const [posts, setPosts] = useState<PostItem[]>([]);
    const [accounts, setAccounts] = useState<SocialAccountItem[]>([]);
    const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        void (async () => {
            setIsLoading(true);
            try {
                await AnalyticsEntity.list("-date", 100);
                const [postsData, accountsData] = await Promise.all([
                    Post.list(),
                    SocialAccount.list(),
                ]);
                setPosts(postsData);
                setAccounts(accountsData);
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error("Error loading analytics:", error);
            }
            setIsLoading(false);
        })();
    }, []);

    const totalFollowers = accounts.reduce(
        (sum, account) => sum + (account.follower_count || 0),
        0,
    );
    const totalPosts = posts.length;
    const totalEngagement = posts.reduce((sum, post) => {
        const engagement = post.engagement || {};
        return (
            sum + (engagement.likes || 0) + (engagement.comments || 0) + (engagement.shares || 0)
        );
    }, 0);
    const avgEngagement = totalPosts > 0 ? totalEngagement / totalPosts : 0;

    const chartData = [
        { date: "1 week ago", followers: 1200, engagement: 85, reach: 2400 },
        { date: "6 days ago", followers: 1250, engagement: 92, reach: 2600 },
        { date: "5 days ago", followers: 1180, engagement: 76, reach: 2200 },
        { date: "4 days ago", followers: 1320, engagement: 108, reach: 2800 },
        { date: "3 days ago", followers: 1280, engagement: 95, reach: 2500 },
        { date: "2 days ago", followers: 1350, engagement: 115, reach: 3000 },
        { date: "Yesterday", followers: 1400, engagement: 125, reach: 3200 },
    ];

    return (
        <div className="min-h-screen p-6">
            <div className="max-w-7xl mx-auto space-y-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
                >
                    <div>
                        <h1 className="text-4xl font-bold bg-linear-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                            Analytics Dashboard
                        </h1>
                        <p className="text-slate-500 mt-2 text-lg">Track your social media performance</p>
                    </div>

                    <div>
                        <select
                            className="w-48 h-10 rounded-md border border-white/20 bg-white/70 px-3 text-sm"
                            value={selectedPlatform}
                            onChange={(e) => setSelectedPlatform(e.target.value)}
                        >
                            <option value="all">All Platforms</option>
                            <option value="instagram">Instagram</option>
                            <option value="twitter">X (Twitter)</option>
                            <option value="facebook">Facebook</option>
                            <option value="linkedin">LinkedIn</option>
                            <option value="youtube">YouTube</option>
                            <option value="tiktok">TikTok</option>
                            <option value="threads">Threads</option>
                        </select>
                    </div>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <Card className="glass-effect border-white/20 shadow-xl">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-slate-600 mb-2">Total Followers</p>
                                        <p className="text-3xl font-bold text-slate-900">{totalFollowers.toLocaleString()}</p>
                                        <div className="flex items-center gap-1 mt-2">
                                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                                            <span className="text-sm font-medium text-emerald-500">+12.5%</span>
                                            <span className="text-xs text-slate-400">vs last month</span>
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-linear-to-br from-blue-500 to-blue-600 shadow-lg">
                                        <Users className="w-6 h-6 text-white" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <Card className="glass-effect border-white/20 shadow-xl">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-slate-600 mb-2">Avg. Engagement</p>
                                        <p className="text-3xl font-bold text-slate-900">{avgEngagement.toFixed(0)}</p>
                                        <div className="flex items-center gap-1 mt-2">
                                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                                            <span className="text-sm font-medium text-emerald-500">+8.2%</span>
                                            <span className="text-xs text-slate-400">vs last month</span>
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 shadow-lg">
                                        <BarChart3 className="w-6 h-6 text-white" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <Card className="glass-effect border-white/20 shadow-xl">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-slate-600 mb-2">Total Posts</p>
                                        <p className="text-3xl font-bold text-slate-900">{totalPosts}</p>
                                        <div className="flex items-center gap-1 mt-2">
                                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                                            <span className="text-sm font-medium text-emerald-500">+5.1%</span>
                                            <span className="text-xs text-slate-400">vs last month</span>
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-linear-to-br from-orange-500 to-orange-600 shadow-lg">
                                        <Eye className="w-6 h-6 text-white" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                        <Card className="glass-effect border-white/20 shadow-xl">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-slate-600 mb-2">Click Rate</p>
                                        <p className="text-3xl font-bold text-slate-900">3.2%</p>
                                        <div className="flex items-center gap-1 mt-2">
                                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                                            <span className="text-sm font-medium text-emerald-500">+2.1%</span>
                                            <span className="text-xs text-slate-400">vs last month</span>
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-linear-to-br from-purple-500 to-purple-600 shadow-lg">
                                        <MousePointer className="w-6 h-6 text-white" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="glass-effect border-white/20 bg-white/50">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="engagement">Engagement</TabsTrigger>
                        <TabsTrigger value="growth">Growth</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="space-y-6">
                        <div className="grid lg:grid-cols-2 gap-6">
                            <Card className="glass-effect border-white/20 shadow-xl">
                                <CardHeader>
                                    <CardTitle>Follower Growth</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                                                <YAxis stroke="#64748b" fontSize={12} />
                                                <Tooltip contentStyle={{ backgroundColor: "rgba(255, 255, 255, 0.9)", border: "1px solid #e2e8f0", borderRadius: "8px" }} />
                                                <Line type="monotone" dataKey="followers" stroke="#3b82f6" strokeWidth={3} dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="glass-effect border-white/20 shadow-xl">
                                <CardHeader>
                                    <CardTitle>Engagement Rate</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                                                <YAxis stroke="#64748b" fontSize={12} />
                                                <Tooltip contentStyle={{ backgroundColor: "rgba(255, 255, 255, 0.9)", border: "1px solid #e2e8f0", borderRadius: "8px" }} />
                                                <Bar dataKey="engagement" fill="url(#engagementGradient)" radius={[4, 4, 0, 0]} />
                                                <defs>
                                                    <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.3} />
                                                    </linearGradient>
                                                </defs>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="engagement">
                        <Card className="glass-effect border-white/20 shadow-xl">
                            <CardHeader>
                                <CardTitle>Engagement Overview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-12 text-slate-500">
                                    <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                    <p>Detailed engagement analytics coming soon</p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="growth">
                        <Card className="glass-effect border-white/20 shadow-xl">
                            <CardHeader>
                                <CardTitle>Growth Analytics</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-12 text-slate-500">
                                    <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                    <p>Growth metrics dashboard coming soon</p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}


