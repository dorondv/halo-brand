"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Post, type PostItem } from "@/libs/base44";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Plus,
    Sparkles,
    Grid3X3,
    Calendar1,
} from "lucide-react";
import {
    eachDayOfInterval,
    eachMonthOfInterval,
    endOfMonth,
    endOfYear,
    format,
    getDay,
    isSameDay,
    isSameMonth,
    isToday,
    startOfMonth,
    startOfYear,
} from "date-fns";
import { motion } from "framer-motion";

type CategoryKey =
    | "jewish"
    | "muslim"
    | "christian"
    | "commercial"
    | "international"
    | "sports"
    | "civil"
    | "national"
    | "banking";

const categoryConfig: Record<
    CategoryKey,
    { color: string; name: string; bgColor: string; borderColor: string; textColor: string }
> = {
    jewish: {
        color: "bg-blue-100 text-blue-800 border-blue-200",
        name: "יהדות וישראל",
        bgColor: "bg-blue-500",
        borderColor: "border-blue-300",
        textColor: "text-blue-700",
    },
    muslim: {
        color: "bg-green-100 text-green-800 border-green-200",
        name: "איסלאם",
        bgColor: "bg-green-500",
        borderColor: "border-green-300",
        textColor: "text-green-700",
    },
    christian: {
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        name: "נצרות",
        bgColor: "bg-yellow-500",
        borderColor: "border-yellow-300",
        textColor: "text-yellow-700",
    },
    commercial: {
        color: "bg-pink-100 text-pink-800 border-pink-200",
        name: "מסחרי",
        bgColor: "bg-pink-500",
        borderColor: "border-pink-300",
        textColor: "text-pink-700",
    },
    international: {
        color: "bg-purple-100 text-purple-800 border-purple-200",
        name: "בינלאומי",
        bgColor: "bg-purple-500",
        borderColor: "border-purple-300",
        textColor: "text-purple-700",
    },
    sports: {
        color: "bg-red-100 text-red-800 border-red-200",
        name: "ספורט",
        bgColor: "bg-red-500",
        borderColor: "border-red-300",
        textColor: "text-red-700",
    },
    civil: {
        color: "bg-gray-100 text-gray-800 border-gray-200",
        name: "אזרחי",
        bgColor: "bg-gray-500",
        borderColor: "border-gray-300",
        textColor: "text-gray-700",
    },
    national: {
        color: "bg-indigo-100 text-indigo-800 border-indigo-200",
        name: "לאומי",
        bgColor: "bg-indigo-500",
        borderColor: "border-indigo-300",
        textColor: "text-indigo-700",
    },
    banking: {
        color: "bg-amber-100 text-amber-800 border-amber-200",
        name: "בנקאות",
        bgColor: "bg-amber-500",
        borderColor: "border-amber-300",
        textColor: "text-amber-700",
    },
};

const importantDates: Record<
    string,
    { type: CategoryKey; name: string; category: string; description?: string }
> = {
    "2024-01-01": { type: "civil", name: "ראש השנה האזרחי", category: "אזרחי" },
    "2024-02-14": { type: "commercial", name: "יום האהבה - ולנטיינס", category: "מסחרי" },
    "2024-03-08": { type: "international", name: "יום האישה הבינלאומי", category: "בינלאומי" },
    "2024-04-22": { type: "international", name: "יום כדור הארץ", category: "בינלאומי" },
    "2024-04-23": { type: "jewish", name: "פסח", category: "יהודי" },
    "2024-05-12": { type: "commercial", name: "יום האם", category: "מסחרי" },
    "2024-06-16": { type: "commercial", name: "יום האב", category: "מסחרי" },
    "2024-09-16": { type: "jewish", name: "ראש השנה", category: "יהודי" },
    "2024-10-31": { type: "civil", name: "ליל כל הקדושים - האלווין", category: "אזרחי" },
    "2024-12-25": { type: "christian", name: "חג המולד", category: "נוצרי" },
};

export default function CalendarClient(): React.ReactElement {
    const [currentDate, setCurrentDate] = useState<Date>(new Date("2024-11-01"));
    const [posts, setPosts] = useState<PostItem[]>([]);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [showImportantDates, setShowImportantDates] = useState<boolean>(true);
    const [viewMode, setViewMode] = useState<"month" | "year">("month");

    const allCategoryTypes = [
        ...new Set(Object.values(importantDates).map((date) => date.type)),
    ] as CategoryKey[];
    const [selectedCategories, setSelectedCategories] = useState<CategoryKey[]>(
        allCategoryTypes,
    );

    useEffect(() => {
        void (async () => {
            const postsData = await Post.list();
            setPosts(postsData.filter((p) => p.scheduled_time));
        })();
    }, [currentDate]);

    const toggleCategory = (categoryType: CategoryKey) => {
        setSelectedCategories((prev) =>
            prev.includes(categoryType)
                ? prev.filter((c) => c !== categoryType)
                : [...prev, categoryType],
        );
    };

    const navigateTime = (direction: number) => {
        const newDate = new Date(currentDate);
        if (viewMode === "month") newDate.setMonth(currentDate.getMonth() + direction);
        else newDate.setFullYear(currentDate.getFullYear() + direction);
        setCurrentDate(newDate);
    };

    const getPostsForDate = (date: Date) =>
        posts.filter((post) => post.scheduled_time && isSameDay(new Date(post.scheduled_time), date));

    const getImportantDateForDay = (date: Date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        return importantDates[dateStr] || null;
    };

    const getImportantDatesForPeriod = (date: Date) => {
        if (viewMode === "month") {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            return Object.entries(importantDates)
                .filter(([dateKey]) => dateKey.startsWith(`${year}-${month}`))
                .map(([dateKey, event]) => ({ date: new Date(`${dateKey}T00:00:00`), ...event }))
                .filter((event) => selectedCategories.includes(event.type));
        }
        const year = date.getFullYear();
        return Object.entries(importantDates)
            .filter(([dateKey]) => dateKey.startsWith(`${year}`))
            .map(([dateKey, event]) => ({ date: new Date(`${dateKey}T00:00:00`), ...event }))
            .filter((event) => selectedCategories.includes(event.type));
    };

    const renderMonthView = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const startingDayIndex = getDay(monthStart);

        const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

        return (
            <>
                <div className="grid grid-cols-7 gap-4 mb-4">
                    {dayNames.map((day) => (
                        <div key={day} className="text-center font-medium text-slate-500 py-2">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-4">
                    {Array.from({ length: startingDayIndex }).map((_, index) => (
                        <div key={`padding-${index}`} />
                    ))}
                    {daysInMonth.map((date) => {
                        const dayPosts = getPostsForDate(date);
                        const importantDate = getImportantDateForDay(date);
                        const isSelected = selectedDate && isSameDay(date, selectedDate);
                        const isTodayDate = isToday(date);
                        const hasImportantDate =
                            importantDate && showImportantDates && selectedCategories.includes(importantDate.type);
                        const config = importantDate ? categoryConfig[importantDate.type] : null;

                        return (
                            <motion.div
                                key={date.toISOString()}
                                whileHover={{ scale: 1.05 }}
                                className={`aspect-square p-2 rounded-xl border-2 cursor-pointer transition-all duration-300 ${isSelected
                                        ? "border-blue-500 bg-blue-50"
                                        : isTodayDate
                                            ? "border-emerald-300 bg-emerald-50"
                                            : hasImportantDate && config
                                                ? `${config.borderColor} ${config.color.split(" ")[0]}`
                                                : dayPosts.length > 0
                                                    ? "border-orange-200 bg-orange-50 hover:border-orange-300"
                                                    : "border-white/30 hover:border-slate-200 hover:bg-white/50"
                                    }`}
                                onClick={() => setSelectedDate(date)}
                            >
                                <div className="h-full flex flex-col">
                                    <div
                                        className={`text-sm font-medium mb-1 ${isTodayDate
                                                ? "text-emerald-600"
                                                : isSelected
                                                    ? "text-blue-600"
                                                    : hasImportantDate && config
                                                        ? config.textColor
                                                        : isSameMonth(date, currentDate)
                                                            ? "text-slate-900"
                                                            : "text-slate-400"
                                            }`}
                                    >
                                        {format(date, "d")}
                                    </div>
                                    <div className="flex-1 space-y-1 overflow-hidden">
                                        {hasImportantDate && config && (
                                            <div
                                                className={`text-[11px] px-1 py-0.5 rounded font-medium ${config.color} line-clamp-2 text-center leading-tight`}
                                                title={importantDate.name}
                                            >
                                                {importantDate.name}
                                            </div>
                                        )}

                                        {dayPosts.slice(0, hasImportantDate ? 1 : 2).map((post) => (
                                            <div
                                                key={post.id}
                                                className="text-xs px-2 py-1 bg-blue-500 text-white rounded truncate"
                                                title={post.content}
                                            >
                                                {post.content.substring(0, 15)}...
                                            </div>
                                        ))}
                                        {dayPosts.length > (hasImportantDate ? 1 : 2) && (
                                            <div className="text-xs text-slate-500 text-center">
                                                + {dayPosts.length - (hasImportantDate ? 1 : 2)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </>
        );
    };

    const renderYearView = () => {
        const yearStart = startOfYear(currentDate);
        const yearEnd = endOfYear(currentDate);
        const monthsInYear = eachMonthOfInterval({ start: yearStart, end: yearEnd });

        return (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-6">
                {monthsInYear.map((month) => {
                    const allMonthEvents = getImportantDatesForPeriod(month);
                    const monthEvents = allMonthEvents.filter(
                        (event) => event.date.getMonth() === month.getMonth(),
                    );

                    return (
                        <motion.div
                            key={month.toISOString()}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/70 backdrop-blur-sm rounded-xl border border-white/20 p-4 hover:shadow-lg transition-all duration-300 cursor-pointer"
                            onClick={() => {
                                setCurrentDate(month);
                                setViewMode("month");
                            }}
                        >
                            <h3 className="font-bold text-slate-900 mb-3 text-center">{format(month, "MMMM")}</h3>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                                {monthEvents.slice(0, 5).map((event, index) => {
                                    const config = categoryConfig[event.type];
                                    return (
                                        <div key={index} className={`text-xs px-2 py-1 rounded ${config.color}`}>
                                            {format(event.date, "d/M")} - {event.name}
                                        </div>
                                    );
                                })}
                                {monthEvents.length > 5 && (
                                    <div className="text-xs text-slate-500 text-center">+ {monthEvents.length - 5}</div>
                                )}
                                {monthEvents.length === 0 && (
                                    <div className="text-xs text-slate-400 text-center py-2">אין אירועים</div>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        );
    };

    const selectedDatePosts = selectedDate ? getPostsForDate(selectedDate) : [];
    const selectedImportantEvent = selectedDate ? getImportantDateForDay(selectedDate) : null;
    const selectedDateImportant =
        selectedImportantEvent && selectedCategories.includes(selectedImportantEvent.type)
            ? selectedImportantEvent
            : null;
    const periodImportantDates = getImportantDatesForPeriod(currentDate);

    const legendItems: { type: CategoryKey }[] = [
        { type: "jewish" },
        { type: "muslim" },
        { type: "christian" },
        { type: "commercial" },
        { type: "international" },
        { type: "national" },
        { type: "banking" },
        { type: "sports" },
        { type: "civil" },
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
                            לוח שנה
                        </h1>
                        <p className="text-slate-500 mt-2 text-lg">תיאור לוח השנה</p>
                    </div>

                    <div className="flex gap-4 flex-wrap">
                        <div className="flex rounded-lg overflow-hidden border border-pink-200 bg-white/50">
                            <Button
                                variant={viewMode === "month" ? "default" : "ghost"}
                                onClick={() => setViewMode("month")}
                                className={`rounded-none ${viewMode === "month" ? "bg-pink-500 text-white hover:bg-pink-600" : "hover:bg-pink-50"}`}
                            >
                                <Calendar1 className="w-4 h-4 mr-2" />
                                חודשי
                            </Button>
                            <Button
                                variant={viewMode === "year" ? "default" : "ghost"}
                                onClick={() => setViewMode("year")}
                                className={`rounded-none ${viewMode === "year" ? "bg-pink-500 text-white hover:bg-pink-600" : "hover:bg-pink-50"}`}
                            >
                                <Grid3X3 className="w-4 h-4 mr-2" />
                                שנתי
                            </Button>
                        </div>

                        <Button
                            variant="outline"
                            onClick={() => setShowImportantDates(!showImportantDates)}
                            className="bg-white/70 border-pink-200 hover:bg-pink-50 text-pink-700"
                        >
                            <Sparkles className="w-4 h-4 mr-2" />
                            {showImportantDates ? "הסתר אירועים" : "הצג אירועים"}
                        </Button>

                        <Link href="/create-post">
                            <Button className="bg-linear-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300">
                                <Plus className="w-5 h-5 mr-2" />
                                תזמן פוסט
                            </Button>
                        </Link>
                    </div>
                </motion.div>

                <div className="grid lg:grid-cols-4 gap-8">
                    <div className="lg:col-span-3">
                        <Card className="glass-effect border-white/20 shadow-xl">
                            <CardHeader className="border-b border-white/10">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2">
                                        <CalendarIcon className="w-6 h-6 text-blue-500" />
                                        {viewMode === "month" ? format(currentDate, "MMMM yyyy") : format(currentDate, "yyyy")}
                                    </CardTitle>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="icon" onClick={() => navigateTime(-1)} className="hover:bg-blue-50">
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <Button variant="outline" size="icon" onClick={() => navigateTime(1)} className="hover:bg-blue-50">
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6">{viewMode === "month" ? renderMonthView() : renderYearView()}</CardContent>
                        </Card>

                        <Card className="glass-effect border-white/20 shadow-xl mt-6">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle>מקרא וסינון אירועים</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {legendItems.map((item) => {
                                        const config = categoryConfig[item.type];
                                        const isSelected = selectedCategories.includes(item.type);
                                        return (
                                            <div
                                                key={item.type}
                                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all duration-300 ${isSelected ? "bg-white/70 shadow-sm" : "opacity-50 hover:opacity-100"
                                                    }`}
                                                onClick={() => toggleCategory(item.type)}
                                            >
                                                <div className={`w-4 h-4 rounded ${config.bgColor}`}></div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm text-slate-600">{config.name}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        {viewMode === "month" && (
                            <Card className="glass-effect border-white/20 shadow-xl">
                                <CardHeader>
                                    <CardTitle>
                                        {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "בחר תאריך"}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {selectedDate ? (
                                        <div className="space-y-4">
                                            {selectedDateImportant && (
                                                <div className="p-3 border border-purple-200 rounded-lg bg-purple-50">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <Badge className={categoryConfig[selectedDateImportant.type].color}>
                                                            {categoryConfig[selectedDateImportant.type].name}
                                                        </Badge>
                                                    </div>
                                                    <h4 className="font-semibold text-purple-900">{selectedDateImportant.name}</h4>
                                                    {selectedDateImportant.description && (
                                                        <p className="text-sm text-purple-700 mt-2">{selectedDateImportant.description}</p>
                                                    )}
                                                </div>
                                            )}

                                            {selectedDatePosts.length > 0 ? (
                                                <div className="space-y-3">
                                                    <h4 className="font-semibold text-slate-900">הפוסטים שלך</h4>
                                                    {selectedDatePosts.map((post) => (
                                                        <div key={post.id} className="p-4 border border-white/30 rounded-xl">
                                                            <p className="font-medium text-slate-900 mb-2 line-clamp-2">{post.content}</p>
                                                            <div className="flex items-center justify-between">
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {format(new Date(post.scheduled_time as string), "h:mm a")}
                                                                </Badge>
                                                                <div className="text-xs text-slate-500">{post.platforms?.length} פלטפורמות</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                !selectedDateImportant && (
                                                    <div className="text-center py-8 text-slate-500">
                                                        <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                                        <p>אין פוסטים מתוזמנים</p>
                                                        <Link href="/create-post">
                                                            <Button className="mt-4 bg-linear-to-r from-blue-500 to-emerald-500 text-white">
                                                                תזמן פוסט
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-slate-500">
                                            <p>לחץ על תאריך כדי לראות אירועים</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        <Card className="glass-effect border-white/20 shadow-xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-purple-500" /> אירועים חשובים {viewMode === "month" ? "החודש" : "השנה"}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3 max-h-80 overflow-y-auto">
                                    {periodImportantDates.length > 0 ? (
                                        periodImportantDates.map((event, index) => {
                                            const config = categoryConfig[event.type];
                                            return (
                                                <div key={index} className="p-3 border border-white/30 rounded-lg hover:bg-white/50 transition-colors">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <Badge className={config.color} variant="secondary">
                                                            {config.name}
                                                        </Badge>
                                                        <span className="text-xs text-slate-500">
                                                            {format(event.date, viewMode === "month" ? "d/M" : "d/M/yyyy")}
                                                        </span>
                                                    </div>
                                                    <p className="font-medium text-sm text-slate-900">{event.name}</p>
                                                    {event.description && viewMode === "month" && (
                                                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{event.description}</p>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-center text-slate-500 py-4">אין אירועים מיוחדים {viewMode === "month" ? "החודש" : "השנה"}</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}


